import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase, onAuthChange, fetchUserProfile, upsertUserProfile, signOut, claimPendingInvites } from '../services/supabase'
import { MOCK_FRIENDS, MOCK_GROUPS, MOCK_EXPENSES, MOCK_SETTLEMENTS } from '../utils/mockData'

const AppContext = createContext(null)

const SUPABASE_CONFIGURED =
    !!import.meta.env.VITE_SUPABASE_URL &&
    import.meta.env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL'

export function AppProvider({ children }) {
    const [currentUser, setCurrentUser] = useState(null)
    const [needsProfile, setNeedsProfile] = useState(false)
    const [isLoading, setIsLoading] = useState(true)

    const [friends, setFriends] = useState(SUPABASE_CONFIGURED ? [] : MOCK_FRIENDS)
    const [groups, setGroups] = useState(SUPABASE_CONFIGURED ? [] : MOCK_GROUPS)
    const [expenses, setExpenses] = useState(SUPABASE_CONFIGURED ? [] : MOCK_EXPENSES)
    const [settlements, setSettlements] = useState(SUPABASE_CONFIGURED ? [] : MOCK_SETTLEMENTS)

    /* ── Load groups + expenses in PARALLEL (fast!) ── */
    const loadUserData = useCallback(async (userId) => {
        if (!SUPABASE_CONFIGURED) return
        try {
            // Step 1: get group IDs this user belongs to
            const { data: memberRows } = await supabase
                .from('group_members')
                .select('group_id, groups(id, name, emoji, created_at)')
                .eq('user_id', userId)

            if (!memberRows?.length) return

            const groupIds = memberRows.map(r => r.group_id)
            const loadedGroups = memberRows.map(r => ({ ...r.groups, members: [] }))

            // Step 2: fetch all-group-members + expenses IN PARALLEL
            const [membersRes, expensesRes] = await Promise.all([
                supabase.from('group_members').select('group_id, user_id').in('group_id', groupIds),
                supabase.from('expenses').select('*, expense_splits(*)').in('group_id', groupIds).order('created_at', { ascending: false }),
            ])

            // Populate members per group & extract unique user IDs
            const uniqueUserIds = new Set()
            if (membersRes.data) {
                loadedGroups.forEach(g => {
                    const groupMembers = membersRes.data.filter(m => m.group_id === g.id).map(m => m.user_id)
                    g.members = groupMembers
                    groupMembers.forEach(uid => { if (uid !== userId) uniqueUserIds.add(uid) })
                })
            }
            setGroups(loadedGroups)

            // Step 3: Fetch all friends' profiles explicitly so we bypass any Supabase FK cache errors
            if (uniqueUserIds.size > 0) {
                const { data: friendsData } = await supabase.from('users').select('*').in('id', Array.from(uniqueUserIds))
                if (friendsData) setFriends(friendsData)
            }

            // Map expenses
            if (expensesRes.data?.length) {
                setExpenses(expensesRes.data.map(e => ({
                    ...e,
                    paid_by: e.expense_splits?.filter(s => s.amount_paid > 0)
                        .map(s => ({ user_id: s.user_id, amount_paid: s.amount_paid })) || [],
                    splits: e.expense_splits?.map(s => ({
                        user_id: s.user_id, amount_owed: s.amount_owed,
                    })) || [],
                })))
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

    /* ── Handle profile-complete session (existing user login) ── */
    const sessionHandled = useRef(false)

    const handleUserSession = useCallback(async (authUser) => {
        // Prevent double-init from getSession + onAuthChange firing simultaneously
        if (sessionHandled.current) return
        sessionHandled.current = true

        try {
            const { data } = await fetchUserProfile(authUser.id)

            if (data?.full_name && data?.upi_id) {
                setCurrentUser({ id: authUser.id, email: authUser.email || '', ...data })
                setNeedsProfile(false)
                setIsLoading(false) // ← Show page IMMEDIATELY — data loads in background

                // Background: claim invites + load data (non-blocking)
                Promise.all([
                    claimPendingInvites(authUser.id, authUser.email, data.phone),
                    claimJoinLink(authUser.id),
                ]).then(() => loadUserData(authUser.id))
                    .catch(err => console.warn('Background load error:', err))
            } else {
                // New user — profile incomplete, send to setup
                setCurrentUser({
                    id: authUser.id,
                    email: authUser.email || authUser.user_metadata?.email || '',
                    full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
                })
                setNeedsProfile(true)
                setIsLoading(false)
            }
        } catch (e) {
            console.error('Session init error:', e)
            setIsLoading(false)
            sessionHandled.current = false // allow retry on error
        }
    }, [loadUserData])

    /* ── Auth bootstrapping ── */
    useEffect(() => {
        if (!SUPABASE_CONFIGURED) {
            const saved = localStorage.getItem('spliter_user')
            if (saved) setCurrentUser(JSON.parse(saved))
            setTimeout(() => setIsLoading(false), 400)
            return
        }

        // Reset guard on mount so re-renders work correctly
        sessionHandled.current = false

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) handleUserSession(session.user)
            else setIsLoading(false)
        })

        const { data: { subscription } } = onAuthChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                await handleUserSession(session.user)
            }
            if (event === 'SIGNED_OUT') {
                sessionHandled.current = false
                setCurrentUser(null)
                setNeedsProfile(false)
                setIsLoading(false)
            }
        })

        return () => subscription.unsubscribe()
    }, [handleUserSession])

    /* ── Realtime Data Syncing ── */
    useEffect(() => {
        if (!SUPABASE_CONFIGURED || !currentUser) return

        let debounceTimer
        let pollInterval

        const triggerReload = () => {
            clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
                loadUserData(currentUser.id)
            }, 300)
        }

        // Subscribe to realtime changes
        const channel = supabase.channel(`spliter_sync_${currentUser.id}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, triggerReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, triggerReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expense_splits' }, triggerReload)
            .subscribe((status, err) => {
                if (status === 'SUBSCRIBED') {
                    console.log('Realtime connected ✅')
                    // Clear fallback poll if realtime is working
                    clearInterval(pollInterval)
                }
                if (status === 'CHANNEL_ERROR') {
                    console.warn('Realtime error, falling back to polling:', err)
                    // Start fallback polling every 30s if realtime fails
                    if (!pollInterval) {
                        pollInterval = setInterval(() => loadUserData(currentUser.id), 30000)
                    }
                }
                if (status === 'TIMED_OUT') {
                    console.warn('Realtime timed out, retrying...')
                }
            })

        // Safety: start a fallback poll that gets cleared once realtime connects
        pollInterval = setInterval(() => loadUserData(currentUser.id), 30000)

        return () => {
            supabase.removeChannel(channel)
            clearTimeout(debounceTimer)
            clearInterval(pollInterval)
        }
    }, [currentUser, loadUserData])

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

        if (SUPABASE_CONFIGURED && currentUser) {
            e.created_by = currentUser.id
            const { data, error } = await supabase.from('expenses').insert(e).select().single()
            if (error) throw new Error(error.message || "Failed to save expense base")

            // Build the expense_splits rows
            const splitRows = []
            const combinedUserIds = [...new Set([...paid_by.map(p => p.user_id), ...splits.map(s => s.user_id)])]

            for (const uid of combinedUserIds) {
                const paid = paid_by.find(p => p.user_id === uid)?.amount_paid || 0
                const owed = splits.find(s => s.user_id === uid)?.amount_owed || 0
                if (paid > 0 || owed > 0) {
                    splitRows.push({ expense_id: id, user_id: uid, amount_paid: paid, amount_owed: owed })
                }
            }

            const { error: splitErr } = await supabase.from('expense_splits').insert(splitRows)
            if (splitErr) {
                // If splits fail, we should probably delete the expense or throw
                await supabase.from('expenses').delete().eq('id', id)
                throw new Error("Failed to save expense splits")
            }

            const fullObj = { ...(data || e), paid_by, splits }
            setExpenses(prev => [fullObj, ...prev])
            return fullObj
        }

        const fullObj = { ...e, paid_by, splits }
        setExpenses(prev => [fullObj, ...prev])
        return fullObj
    }

    const addGroup = async (group) => {
        const id = `group-${Date.now()}`
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

    const getUserById = id => id === currentUser?.id ? currentUser : friends.find(f => f.id === id) || null
    const getGroupById = id => groups.find(g => g.id === id) || null
    const getExpensesByGroup = gid => expenses.filter(e => e.group_id === gid)
    const markSettled = id => setSettlements(prev => prev.map(s => s.id === id ? { ...s, status: 'settled' } : s))

    const value = {
        currentUser, setCurrentUser,
        login, logout, completeProfile, needsProfile,
        isLoading, isSupabaseConfigured: SUPABASE_CONFIGURED,
        friends, setFriends,
        groups, addGroup, joinGroup, removeMember,
        expenses, addExpense,
        settlements, markSettled,
        getUserById, getGroupById, getExpensesByGroup,
    }

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
    const ctx = useContext(AppContext)
    if (!ctx) throw new Error('useApp must be used within AppProvider')
    return ctx
}
