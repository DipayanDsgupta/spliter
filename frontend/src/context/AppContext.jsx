import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { Preferences } from '@capacitor/preferences'
import { supabase, onAuthChange, fetchUserProfile, upsertUserProfile, signOut, claimPendingInvites } from '../services/supabase'
import { MOCK_FRIENDS, MOCK_GROUPS, MOCK_EXPENSES, MOCK_SETTLEMENTS } from '../utils/mockData'
import toast from 'react-hot-toast'
import { sendNotification } from '../utils/notify'

const AppContext = createContext(null)

const SUPABASE_CONFIGURED =
    !!import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL'

export function AppProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null)
    const [needsProfile, setNeedsProfile] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [dataLoading, setDataLoading] = useState(true)

    const [friends, setFriends] = useState(SUPABASE_CONFIGURED ? [] : MOCK_FRIENDS)
    const [groups, setGroups] = useState(SUPABASE_CONFIGURED ? [] : MOCK_GROUPS)
    const [expenses, setExpenses] = useState(SUPABASE_CONFIGURED ? [] : MOCK_EXPENSES)
    const [settlements, setSettlements] = useState(SUPABASE_CONFIGURED ? [] : MOCK_SETTLEMENTS)
    const [pendingSettlements, setPendingSettlements] = useState([])
    const [sponsorships, setSponsorships] = useState([])
    const [notifications, setNotifications] = useState([])
    const [unreadNotifCount, setUnreadNotifCount] = useState(0)
    const prevGroupsRef = useRef([])

    // A ref to hold the load functions so initAuth can call them without stale closures
    const loadAllDataRef = useRef(null)

    /* ── Load groups + expenses in PARALLEL (fast!) ── */
    const loadUserData = useCallback(async (userId) => {
        if (!SUPABASE_CONFIGURED) return
        try {
            // Step 1: get group IDs this user belongs to
            const { data: memberRows } = await supabase
                .from('group_members')
                .select('group_id, groups(id, name, emoji, created_at, created_by)')
                .eq('user_id', userId)

            const groupIds = memberRows ? memberRows.map(r => r.group_id) : []
            const loadedGroups = memberRows ? memberRows.map(r => ({ ...r.groups, members: [] })) : []

            // Handle removed groups notification
            const prev = prevGroupsRef.current
            if (prev.length > 0) {
                const currentIds = loadedGroups.map(g => g.id)
                const lostGroups = prev.filter(g => !currentIds.includes(g.id))
                lostGroups.forEach(g => {
                    sendNotification('Group Update', `You were removed from group "${g.name}" or it was deleted 🚫`, 'error')
                })
            }

            // Step 2: fetch all-group-members + expenses + pending settlements IN PARALLEL
            // We use .or to fetch expenses for our groups OR individual expenses (group_id.is.null)
            const expenseQueryOr = groupIds.length > 0 
                ? `group_id.in.(${groupIds.map(id => `"${id}"`).join(',')}),group_id.is.null` 
                : `group_id.is.null`

            const promises = [
                supabase.from('expenses').select('*, expense_splits(*)').or(expenseQueryOr).order('created_at', { ascending: false }),
                supabase.from('settlements_tracker').select('*').or(`payer_id.eq.${userId},receiver_id.eq.${userId}`).order('created_at', { ascending: false })
            ]

            if (groupIds.length > 0) {
                promises.push(supabase.from('group_members').select('group_id, user_id').in('group_id', groupIds))
                promises.push(supabase.from('sponsorships').select('*').in('group_id', groupIds).order('created_at', { ascending: false }))
            } else {
                promises.push(Promise.resolve({ data: [] })) // Dummy resolved for membersRes
                promises.push(Promise.resolve({ data: [] })) // Dummy resolved for sponsorshipsRes
            }

            const [expensesRes, settlementsRes, membersRes, sponsorshipsRes] = await Promise.all(promises)

            // Populate members per group & extract unique user IDs
            const uniqueUserIds = new Set()
            if (membersRes.data) {
                loadedGroups.forEach(g => {
                    const groupMembers = membersRes.data.filter(m => m.group_id === g.id).map(m => m.user_id)
                    g.members = groupMembers
                    groupMembers.forEach(uid => { if (uid !== userId) uniqueUserIds.add(uid) })
                })
            }

            // --- Real-time difference detection for Notifications ---
            if (prev.length > 0) {
                const currentIds = loadedGroups.map(g => g.id)
                // 1. Did we lose any groups?
                const lostGroups = prev.filter(g => !currentIds.includes(g.id))
                lostGroups.forEach(g => {
                    sendNotification('Group Update', `You were removed from group "${g.name}" or it was deleted 🚫`, 'error')
                })

                // 2. Did any existing groups lose members?
                loadedGroups.forEach(currGroup => {
                    const oldGroup = prev.find(g => g.id === currGroup.id)
                    if (oldGroup) {
                        const lostMembers = oldGroup.members.filter(m => !currGroup.members.includes(m))
                        if (lostMembers.length > 0) {
                            sendNotification('Member Removed', `A member was removed from "${currGroup.name}"`, 'info')
                        }
                    }
                })
            }
            prevGroupsRef.current = loadedGroups
            setGroups(loadedGroups)

            // Step 3: Fetch all friends' profiles explicitly so we bypass any Supabase FK cache errors
            if (uniqueUserIds.size > 0) {
                const { data: friendsData } = await supabase.from('users').select('*').in('id', Array.from(uniqueUserIds))
                if (friendsData) setFriends(friendsData)
            }

            // Map expenses
            if (expensesRes.data) {
                setExpenses(expensesRes.data.map(e => ({
                    ...e,
                    paid_by: e.expense_splits?.filter(s => s.amount_paid > 0)
                        .map(s => ({ user_id: s.user_id, amount_paid: s.amount_paid })) || [],
                    splits: e.expense_splits?.map(s => ({
                        user_id: s.user_id, amount_owed: s.amount_owed,
                    })) || [],
                })))
            } else {
                setExpenses([])
            }

            if (settlementsRes?.data) {
                setPendingSettlements(settlementsRes.data)
            }
            if (sponsorshipsRes?.data) {
                setSponsorships(sponsorshipsRes.data)
            }
        } catch (err) {
            console.warn('Data load error:', err)
        }
    }, [])

    /* ── Claim /join/:groupId link — returns claimed groupId so we can redirect ── */
    const claimJoinLink = async (userId) => {
        const pendingGroupId = sessionStorage.getItem('spliter_join_group')
        if (!pendingGroupId) return null
        sessionStorage.removeItem('spliter_join_group')
        try {
            await supabase
                .from('group_members')
                .upsert(
                    { group_id: pendingGroupId, user_id: userId },
                    { onConflict: 'group_id,user_id', ignoreDuplicates: true }
                )
            return pendingGroupId   // ← caller can use this to redirect
        } catch (e) {
            console.warn('claimJoinLink error', e)
            return null
        }
    }

    /* ── Refs ── */
    const dataLoaded = useRef(false)

    /* ── Auth bootstrapping ── */
    useEffect(() => {
        if (!SUPABASE_CONFIGURED) {
            const saved = localStorage.getItem('spliter_user')
            if (saved) setCurrentUser(JSON.parse(saved))
            setTimeout(() => { setIsLoading(false); setDataLoading(false) }, 400)
            return
        }

        dataLoaded.current = false

        // Safety: never stay stuck loading forever
        const safetyTimer = setTimeout(() => setIsLoading(false), 10000)

        // ──────────────────────────────────────────────────
        // PHASE 1: Read cache FIRST for instant dashboard render
        // ──────────────────────────────────────────────────
        ;(async () => {
            try {
                const { value: cached } = await Preferences.get({ key: 'spliter_user_cache' })
                if (cached) {
                    const parsed = JSON.parse(cached)
                    if (parsed && parsed.id) {
                        setCurrentUser(parsed)
                        setNeedsProfile(false)
                        setIsLoading(false) // <-- instant dashboard render from cache
                    }
                }
            } catch (e) { /* corrupted cache */ }
        })()

        // ──────────────────────────────────────────────────
        // PHASE 2: onAuthStateChange is the SOLE session driver
        // Supabase v2 fires INITIAL_SESSION on subscribe when
        // a persisted session exists. This is the ONLY reliable
        // way to detect sessions with async storage.
        // ──────────────────────────────────────────────────
        const handleSession = async (event, session) => {
            // Ignore events with no session (except SIGNED_OUT)
            if (!session?.user) {
                if (event === 'SIGNED_OUT' || event === 'INITIAL_SESSION') {
                    // No session exists — clear cache, go to login
                    await Preferences.remove({ key: 'spliter_user_cache' })
                    setCurrentUser(null)
                    setNeedsProfile(false)
                    setIsLoading(false)
                    dataLoaded.current = false
                }
                return
            }

            const userId = session.user.id

            // ── Load user profile ──
            try {
                const { data: profileData } = await fetchUserProfile(userId)
                if (profileData?.full_name && profileData?.upi_id) {
                    const userObj = { id: userId, email: session.user.email || '', ...profileData }
                    setCurrentUser(userObj)
                    await Preferences.set({ key: 'spliter_user_cache', value: JSON.stringify(userObj) })
                    setNeedsProfile(false)
                    setIsLoading(false)
                } else {
                    // New user — needs profile setup
                    setCurrentUser({
                        id: userId,
                        email: session.user.email || session.user.user_metadata?.email || '',
                        full_name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
                    })
                    setNeedsProfile(true)
                    setIsLoading(false)
                    return // Don't load data for incomplete profiles
                }
            } catch (e) {
                console.warn('Profile fetch error:', e)
                // Keep cached user if available, just ensure loading stops
                setIsLoading(false)
            }

            // ── Load ALL app data (groups, expenses, friends, notifications) ──
            if (!dataLoaded.current) {
                dataLoaded.current = true
                setDataLoading(true)
                try {
                    if (loadAllDataRef.current) {
                        await loadAllDataRef.current(userId)
                    } else {
                        await loadUserData(userId)
                    }
                } catch (e) {
                    console.warn('Data load error:', e)
                    dataLoaded.current = false
                } finally {
                    setIsLoading(false)
                    setDataLoading(false)
                }
            }

            // ── Background: claim invites (non-blocking) ──
            if (event === 'SIGNED_IN') {
                Promise.all([
                    claimPendingInvites(userId, session.user.email, ''),
                    claimJoinLink(userId),
                ]).catch(e => console.warn('Invite claim error:', e))
            }
        }

        const { data: { subscription } } = onAuthChange((event, session) => {
            // Handle: INITIAL_SESSION (app reopen), SIGNED_IN (fresh login),
            // TOKEN_REFRESHED (silent refresh), SIGNED_OUT (logout)
            if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
                handleSession(event, session)
            }
        })

        return () => {
            clearTimeout(safetyTimer)
            subscription.unsubscribe()
        }
    }, [loadUserData])

    /* ── End handleUserSession / Auth bootstrap ── */

    /* ── completeProfile — returns redirectTo if user came via invite link ── */
    const completeProfile = async ({ full_name, phone, upi_id }) => {
        if (!SUPABASE_CONFIGURED) {
            const user = { id: 'user-1', email: currentUser?.email || '', full_name, phone, upi_id }
            setCurrentUser(user); setNeedsProfile(false)
            localStorage.setItem('spliter_user', JSON.stringify(user))
            return { error: null, redirectTo: null }
        }

        const { data: authData } = await supabase.auth.getUser()
        const userId = authData?.user?.id
        if (!userId) return { error: { message: 'Not authenticated' }, redirectTo: null }

        const digits = phone.replace(/\D/g, '').slice(-10)
        const normalizedPhone = digits.length === 10 ? `+91${digits}` : phone
        const { data, error } = await upsertUserProfile({
            id: userId, email: currentUser?.email || '',
            full_name, phone: normalizedPhone,
            upi_id, updated_at: new Date().toISOString(),
        })

        if (!error) {
            setCurrentUser(prev => ({ ...prev, ...data }))
            setNeedsProfile(false)

            // Claim everything IN PARALLEL for speed
            const [, claimedGroupId] = await Promise.all([
                claimPendingInvites(userId, currentUser?.email, phone.replace(/\D/g, '').slice(-10)),
                claimJoinLink(userId),   // returns groupId or null
            ])

            // Load data after claiming
            await loadUserData(userId)

            // Tell ProfileSetupPage where to redirect (group or dashboard)
            const redirectTo = claimedGroupId ? `/groups/${claimedGroupId}` : '/'
            return { error: null, redirectTo }
        }
        return { error, redirectTo: null }
    }

    /* ── Logout ── */
    const logout = async () => {
        if (!SUPABASE_CONFIGURED) {
            setCurrentUser(null)
            localStorage.removeItem('spliter_user')
            window.location.href = '/auth'
            return
        }
        await signOut()
        setCurrentUser(null); setNeedsProfile(false)
        window.location.href = '/auth'
    }

    /* ── Demo login ── */
    const login = (user) => {
        const u = user || { id: 'user-1', full_name: 'Demo User', email: 'demo@spliter.app', phone: '+919876543210', upi_id: 'demo@okicici' }
        setCurrentUser(u)
        localStorage.setItem('spliter_user', JSON.stringify(u))
    }

    /* ── Data helpers ── */
    const addExpense = async (expense) => {
        const id = `exp-${Date.now()}`
        const { paid_by, splits, ...insertData } = expense
        const e = { ...insertData, id, created_at: new Date().toISOString() }

        // Build the expense_splits rows locally for both db and optimistic update
        const splitRows = []
        const combinedUserIds = [...new Set([...paid_by.map(p => p.user_id), ...splits.map(s => s.user_id)])]

        for (const uid of combinedUserIds) {
            const paid = paid_by.find(p => p.user_id === uid)?.amount_paid || 0
            const owed = splits.find(s => s.user_id === uid)?.amount_owed || 0
            if (paid > 0 || owed > 0) {
                splitRows.push({ expense_id: id, user_id: uid, amount_paid: paid, amount_owed: owed })
            }
        }

        if (SUPABASE_CONFIGURED && currentUser) {
            e.created_by = currentUser.id
            const { data, error } = await supabase.from('expenses').insert(e).select().single()
            if (error) throw new Error(error.message || "Failed to save expense base")

            const { error: splitErr } = await supabase.from('expense_splits').insert(splitRows)
            if (splitErr) {
                // If splits fail, we should probably delete the expense or throw
                await supabase.from('expenses').delete().eq('id', id)
                throw new Error("Failed to save expense splits")
            }

            const fullObj = { ...(data || e), paid_by, splits, expense_splits: splitRows }
            setExpenses(prev => [fullObj, ...prev])
            return fullObj
        }

        const fullObj = { ...e, paid_by, splits, expense_splits: splitRows }
        setExpenses(prev => [fullObj, ...prev])
        return fullObj
    }

    const addGroup = async (group) => {
        const id = `${Date.now()}`
        const g = { ...group, id, created_at: new Date().toISOString(), total_expenses: 0 }

        if (SUPABASE_CONFIGURED && currentUser) {
            const { data: inserted, error: insertErr } = await supabase
                .from('groups')
                .insert({ id, name: g.name, emoji: g.emoji, created_by: currentUser.id, created_at: g.created_at })
                .select().single()

            if (insertErr) throw new Error(insertErr.message || "Failed to create group in Database")

            const groupId = inserted?.id || id
            g.id = groupId

            const memberIds = [...new Set([currentUser.id, ...group.members])]
            const { error: memErr } = await supabase.from('group_members').insert(
                memberIds.map(uid => ({ group_id: groupId, user_id: uid }))
            )

            if (memErr) throw new Error(memErr.message || "Failed to add members to group")

            setGroups(prev => [g, ...prev])
            return g
        }

        setGroups(prev => [g, ...prev])
        return g
    }

    const joinGroup = async (groupId) => {
        if (!SUPABASE_CONFIGURED || !currentUser) throw new Error('Not configured')

        // 1. Verify group exists
        const { data: group } = await supabase.from('groups').select('*').eq('id', groupId).single()
        if (!group) throw new Error('Group not found')

        // 2. Join it
        const { error } = await supabase.from('group_members').upsert({ group_id: groupId, user_id: currentUser.id }, { onConflict: 'group_id,user_id', ignoreDuplicates: true })
        if (error) throw error

        // 3. Data will reload via Realtime, but let's fast-track it:
        await loadUserData(currentUser.id)
        return group
    }

    const removeMember = async (groupId, userId) => {
        if (!SUPABASE_CONFIGURED) return
        try {
            await supabase.from('group_members').delete().match({ group_id: groupId, user_id: userId })
            // Data reloads via Realtime, but here's a local optimistic update
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, members: g.members.filter(m => m !== userId) } : g))
        } catch (e) { console.error('removeMember error:', e) }
    }

    const deleteGroup = async (groupId) => {
        if (!SUPABASE_CONFIGURED) return
        try {
            // DB: delete settlements and sponsorships for this group first
            await supabase.from('settlements_tracker').delete().eq('group_id', groupId)
            await supabase.from('sponsorships').delete().eq('group_id', groupId)
            await supabase.from('groups').delete().eq('id', groupId)
            // Local state: cascade-clear everything tied to this group
            setGroups(prev => prev.filter(g => g.id !== groupId))
            setExpenses(prev => prev.filter(e => e.group_id !== groupId))
            setPendingSettlements(prev => prev.filter(s => s.group_id !== groupId))
            setSponsorships(prev => prev.filter(s => s.group_id !== groupId))
        } catch (e) { console.error('deleteGroup error:', e) }
    }

    const transferAdmin = async (groupId, newAdminId) => {
        if (!SUPABASE_CONFIGURED) return
        try {
            const { error } = await supabase.from('groups').update({ created_by: newAdminId }).eq('id', groupId)
            if (error) throw error
            setGroups(prev => prev.map(g => g.id === groupId ? { ...g, created_by: newAdminId } : g))
        } catch (e) {
            console.error('transferAdmin error:', e)
            throw e
        }
    }

    const deleteExpense = async (expenseId) => {
        if (!SUPABASE_CONFIGURED) return
        const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
        if (error) throw error
        setExpenses(prev => prev.filter(e => e.id !== expenseId))
    }

    const updateExpense = async (expenseId, updatedData) => {
        const { paid_by, splits, ...updateFields } = updatedData
        if (SUPABASE_CONFIGURED) {
            // Update expense base fields
            const { error: expErr } = await supabase.from('expenses').update(updateFields).eq('id', expenseId)
            if (expErr) throw new Error(expErr.message || 'Failed to update expense')

            // Delete old splits and insert new ones
            await supabase.from('expense_splits').delete().eq('expense_id', expenseId)

            const combinedUserIds = [...new Set([...paid_by.map(p => p.user_id), ...splits.map(s => s.user_id)])]
            const splitRows = combinedUserIds.map(uid => ({
                expense_id: expenseId,
                user_id: uid,
                amount_paid: paid_by.find(p => p.user_id === uid)?.amount_paid || 0,
                amount_owed: splits.find(s => s.user_id === uid)?.amount_owed || 0,
            })).filter(r => r.amount_paid > 0 || r.amount_owed > 0)

            const { error: splitErr } = await supabase.from('expense_splits').insert(splitRows)
            if (splitErr) throw new Error('Failed to update expense splits')
        }

        // Optimistic update — include expense_splits for data consistency
        const updatedSplitRows = [...new Set([...paid_by.map(p => p.user_id), ...splits.map(s => s.user_id)])]
            .map(uid => ({
                expense_id: expenseId,
                user_id: uid,
                amount_paid: paid_by.find(p => p.user_id === uid)?.amount_paid || 0,
                amount_owed: splits.find(s => s.user_id === uid)?.amount_owed || 0,
            }))
            .filter(r => r.amount_paid > 0 || r.amount_owed > 0)

        setExpenses(prev => prev.map(e => e.id === expenseId
            ? { ...e, ...updateFields, paid_by, splits, expense_splits: updatedSplitRows }
            : e
        ))
    }

    /* ── Sponsorships ── */
    const loadSponsorships = async (groupId) => {
        if (!SUPABASE_CONFIGURED) return []
        try {
            const { data, error } = await supabase
                .from('sponsorships')
                .select('*')
                .eq('group_id', groupId)
                .order('created_at', { ascending: false })
            if (error) { console.error('Load sponsorships error:', error); return [] }
            setSponsorships(prev => {
                const otherGroups = prev.filter(s => s.group_id !== groupId)
                return [...otherGroups, ...(data || [])]
            })
            return data || []
        } catch (e) {
            console.error('loadSponsorships error:', e)
            return []
        }
    }

    const addSponsorship = async ({ groupId, sponsorId, recipientId, amount, percentage, note }) => {
        if (!SUPABASE_CONFIGURED) return
        const row = {
            group_id: groupId,
            sponsor_id: sponsorId,
            recipient_id: recipientId,
            amount: Math.round(amount * 100) / 100,
            percentage: percentage || null,
            note: note || '',
        }
        const { data, error } = await supabase.from('sponsorships').insert([row]).select().single()
        if (error) throw new Error(error.message || 'Failed to create sponsorship')
        setSponsorships(prev => [data, ...prev])
        return data
    }

    const deleteSponsorship = async (sponsorshipId) => {
        if (!SUPABASE_CONFIGURED) return
        const { error } = await supabase.from('sponsorships').delete().eq('id', sponsorshipId)
        if (error) throw new Error(error.message || 'Failed to delete sponsorship')
        setSponsorships(prev => prev.filter(s => s.id !== sponsorshipId))
    }

    /* ── EXPERIMENTAL: createPendingSettlement ── */
    const createPendingSettlement = async ({ settlementId, groupId, payerId, receiverId, amount }) => {
        if (!SUPABASE_CONFIGURED) return null
        const { data, error } = await supabase.from('settlements_tracker').insert([{
            settlement_id: settlementId,
            group_id: groupId || null,
            payer_id: payerId,
            receiver_id: receiverId,
            amount: amount,
            status: 'pending'
        }]).select().single()

        if (error) throw error
        setPendingSettlements(prev => [data, ...prev])
        return data
    }

    const cancelPendingSettlement = async (settlementId) => {
        if (!SUPABASE_CONFIGURED) return
        const { error } = await supabase.from('settlements_tracker').delete().eq('id', settlementId)
        if (error) throw error
        setPendingSettlements(prev => prev.filter(s => s.id !== settlementId))
    }

    const deleteSettlement = async (settlementId) => {
        if (!SUPABASE_CONFIGURED) return
        const { error } = await supabase.from('settlements_tracker').delete().eq('id', settlementId)
        if (error) throw new Error(error.message || 'Failed to delete settlement')
        setPendingSettlements(prev => prev.filter(s => s.id !== settlementId))
    }

    /** Receiver approves a pending settlement (marks it completed) */
    const approveSettlement = async (settlementDbId) => {
        if (!SUPABASE_CONFIGURED) return
        const { error } = await supabase
            .from('settlements_tracker')
            .update({
                status: 'completed',
                verified_at: new Date().toISOString()
            })
            .eq('id', settlementDbId)
        if (error) throw error
        setPendingSettlements(prev => prev.map(s =>
            s.id === settlementDbId
                ? { ...s, status: 'completed', verified_at: new Date().toISOString() }
                : s
        ))
    }

    /** Receiver rejects a pending settlement (deletes it so payer can retry) */
    const rejectSettlement = async (settlementDbId) => {
        if (!SUPABASE_CONFIGURED) return
        const { error } = await supabase.from('settlements_tracker').delete().eq('id', settlementDbId)
        if (error) throw error
        setPendingSettlements(prev => prev.filter(s => s.id !== settlementDbId))
    }

    const getUserById = id => id === currentUser?.id ? currentUser : friends.find(f => f.id === id) || null
    const getGroupById = id => groups.find(g => g.id === id) || null
    const getExpensesByGroup = gid => expenses.filter(e => e.group_id === gid)
    const markSettled = id => setSettlements(prev => prev.map(s => s.id === id ? { ...s, status: 'settled' } : s))

    /* ══════════════════════════════════════════
       FRIEND SYSTEM
    ══════════════════════════════════════════ */



    /* ══════════════════════════════════════════
       NOTIFICATIONS
    ══════════════════════════════════════════ */

    const loadNotifications = useCallback(async (userId) => {
        if (!SUPABASE_CONFIGURED) return
        try {
            // Cleanup old notifications (24h+)
            await supabase.rpc('cleanup_old_notifications', { p_user_id: userId })

            // Fetch remaining
            const { data } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(50)
            if (data) {
                setNotifications(data)
                setUnreadNotifCount(data.filter(n => !n.is_read).length)
            }
        } catch (e) { console.warn('loadNotifications error:', e) }
    }, [])

    // assign the ref so initAuth's doLoadAllData can call all loaders.
    loadAllDataRef.current = async (userId) => {
        try {
            await Promise.all([
                loadUserData(userId),
                loadNotifications(userId),
            ])
        } catch (e) {
            console.warn('loadAllData error:', e)
        }
    }

    /* ── Manual Refresh (for Pull-to-Refresh) ── */
    const manualRefresh = useCallback(async () => {
        if (!SUPABASE_CONFIGURED || !currentUser?.id) return
        await Promise.all([
            loadUserData(currentUser.id),
            loadNotifications(currentUser.id),
        ])
    }, [currentUser?.id, loadUserData, loadNotifications])

    const markNotificationRead = async (notifId) => {
        if (!SUPABASE_CONFIGURED) return
        await supabase.from('notifications').update({ is_read: true }).eq('id', notifId)
        setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, is_read: true } : n))
        setUnreadNotifCount(prev => Math.max(0, prev - 1))
    }

    const markAllNotificationsRead = async () => {
        if (!SUPABASE_CONFIGURED || !currentUser) return
        await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUser.id).eq('is_read', false)
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
        setUnreadNotifCount(0)
    }

    /* ── Realtime Data Syncing (Placed here to avoid TDZ errors) ── */
    useEffect(() => {
        if (!SUPABASE_CONFIGURED || !currentUser) return

        let debounceTimer
        let notifDebounceTimer
        let pollInterval

        const triggerReload = () => {
            clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => loadUserData(currentUser.id), 300)
        }

        const triggerNotifReload = () => {
            clearTimeout(notifDebounceTimer)
            notifDebounceTimer = setTimeout(() => loadNotifications(currentUser.id), 300)
        }

        // Subscribe to realtime changes
        const channel = supabase.channel(`spliter_sync_${currentUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, triggerReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, triggerReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, triggerReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'settlements_tracker' }, triggerReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, triggerNotifReload)
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Realtime connected ✅')
                    clearInterval(pollInterval)
                }
                if (status === 'CHANNEL_ERROR') {
                    console.warn('Realtime error, falling back to polling:', err)
                    if (!pollInterval) {
                        pollInterval = setInterval(() => {
                            loadUserData(currentUser.id)
                            loadNotifications(currentUser.id)
                        }, 30000)
                    }
                }
                if (status === 'TIMED_OUT') {
                    console.warn('Realtime timed out, retrying...')
                }
            })

        pollInterval = setInterval(() => {
            loadUserData(currentUser.id)
            loadNotifications(currentUser.id)
        }, 30000)

        return () => {
            supabase.removeChannel(channel)
            clearTimeout(debounceTimer)
            clearTimeout(notifDebounceTimer)
            clearInterval(pollInterval)
        }
    }, [currentUser, loadUserData, loadNotifications])

    /* ══════════════════════════════════════════
       CHAT SYSTEM (JSON blob storage)
    ══════════════════════════════════════════ */

    /** Load chat messages for a group or direct conversation */
    const loadChatMessages = async (chatType, referenceId) => {
        if (!SUPABASE_CONFIGURED) return []
        try {
            const { data } = await supabase
                .from('chats')
                .select('messages')
                .eq('chat_type', chatType)
                .eq('reference_id', referenceId)
                .single()
            return data?.messages || []
        } catch {
            return []
        }
    }

    /** Send a chat message (atomic append via RPC) */
    const sendChatMessage = async (chatType, referenceId, content) => {
        if (!SUPABASE_CONFIGURED || !currentUser) return
        const message = {
            id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            sender: currentUser.id,
            text: content.trim(),
            ts: new Date().toISOString(),
        }
        await supabase.rpc('append_chat_message', {
            p_chat_type: chatType,
            p_reference_id: referenceId,
            p_message: message,
        })
        return message
    }

    const value = {
        currentUser, setCurrentUser,
        login, logout, completeProfile, needsProfile,
        isLoading, dataLoading, isSupabaseConfigured: SUPABASE_CONFIGURED,
        friends, setFriends,
        groups, addGroup, joinGroup, removeMember, deleteGroup, transferAdmin,
        expenses, addExpense, deleteExpense, updateExpense,
        settlements, markSettled,
        pendingSettlements, createPendingSettlement, cancelPendingSettlement, approveSettlement, rejectSettlement, deleteSettlement,
        getUserById, getGroupById, getExpensesByGroup,
        // Notifications
        notifications, unreadNotifCount, loadNotifications, markNotificationRead, markAllNotificationsRead,
        // Chat
        loadChatMessages, sendChatMessage,
        // Sponsorships
        sponsorships, loadSponsorships, addSponsorship, deleteSponsorship,
        // Pull-to-Refresh
        manualRefresh,
    }

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
    const ctx = useContext(AppContext)
    if (!ctx) throw new Error('useApp must be used within AppProvider')
    return ctx
}
