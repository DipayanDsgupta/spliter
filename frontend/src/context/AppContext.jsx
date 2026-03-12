import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { supabase, onAuthChange, fetchUserProfile, upsertUserProfile, signOut, claimPendingInvites } from '../services/supabase'
import { MOCK_FRIENDS, MOCK_GROUPS, MOCK_EXPENSES, MOCK_SETTLEMENTS } from '../utils/mockData'
import toast from 'react-hot-toast'

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
    const [pendingSettlements, setPendingSettlements] = useState([])
    const [friendships, setFriendships] = useState([])
    const [friendRequests, setFriendRequests] = useState([])
    const [notifications, setNotifications] = useState([])
    const [unreadNotifCount, setUnreadNotifCount] = useState(0)
    const prevGroupsRef = useRef([])

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
                    toast.error(`You were removed from group "${g.name}" or it was deleted 🚫`, { duration: 5000 })
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
            } else {
                promises.push(Promise.resolve({ data: [] })) // Dummy resolved for membersRes
            }

            const [expensesRes, settlementsRes, membersRes] = await Promise.all(promises)

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
                    toast.error(`You were removed from group "${g.name}" or it was deleted 🚫`, { duration: 5000 })
                })

                // 2. Did any existing groups lose members?
                loadedGroups.forEach(currGroup => {
                    const oldGroup = prev.find(g => g.id === currGroup.id)
                    if (oldGroup) {
                        const lostMembers = oldGroup.members.filter(m => !currGroup.members.includes(m))
                        if (lostMembers.length > 0) {
                            toast(`A member was removed from "${currGroup.name}" ℹ️`, { icon: '🚪' })
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
                const userObj = { id: authUser.id, email: authUser.email || '', ...data }
                setCurrentUser(userObj)
                localStorage.setItem('spliter_user_cache', JSON.stringify(userObj))
                setNeedsProfile(false)
                setIsLoading(false) // ← Show page IMMEDIATELY — data loads in background

                // Background: claim invites + load data (non-blocking)
                Promise.all([
                    claimPendingInvites(authUser.id, authUser.email, data.phone),
                    claimJoinLink(authUser.id),
                ]).then(() => {
                    loadUserData(authUser.id)
                    loadFriendData(authUser.id)
                    loadNotifications(authUser.id)
                }).catch(err => console.warn('Background load error:', err))
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

            // Critical Fix: If network is stuck or fetch fails on refresh, 
            // fallback to cache instead of leaving currentUser as null (which kicks them out).
            const cached = localStorage.getItem('spliter_user_cache')
            if (cached) {
                const parsed = JSON.parse(cached)
                // Need to ensure the cached user matches the auth user ID to prevent account bleed
                if (parsed.id === authUser.id) {
                    setCurrentUser(parsed)
                    setNeedsProfile(false)
                }
            } else {
                setCurrentUser({
                    id: authUser.id,
                    email: authUser.email || authUser.user_metadata?.email || '',
                    full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || 'User',
                })
            }

            setIsLoading(false)
            sessionHandled.current = false // allow retry on error
            loadUserData(authUser.id) // Try to load their groups anyway in background
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

        // 10-second safety fallback: Never get stuck continuously loading
        const safetyTimer = setTimeout(() => {
            setIsLoading(false)
        }, 10000)

        const initAuth = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession()
                if (error) {
                    console.warn('getSession error:', error)
                    setIsLoading(false)
                    return
                }
                if (session?.user) {
                    await handleUserSession(session.user)
                } else {
                    setIsLoading(false)
                }
            } catch (err) {
                console.error('getSession exception:', err)
                setIsLoading(false)
            }
        }
        initAuth()

        const { data: { subscription } } = onAuthChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                await handleUserSession(session.user)
            }
            if (event === 'SIGNED_OUT') {
                sessionHandled.current = false
                localStorage.removeItem('spliter_user_cache')
                setCurrentUser(null)
                setNeedsProfile(false)
                setIsLoading(false)
            }
        })

        return () => {
            clearTimeout(safetyTimer)
            subscription.unsubscribe()
        }
    }, [handleUserSession])

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

    const deleteGroup = async (groupId) => {
        if (!SUPABASE_CONFIGURED) return
        try {
            await supabase.from('groups').delete().eq('id', groupId)
            setGroups(prev => prev.filter(g => g.id !== groupId))
            setExpenses(prev => prev.filter(e => e.group_id !== groupId))
        } catch (e) { console.error('deleteGroup error:', e) }
    }

    const deleteExpense = async (expenseId) => {
        if (!SUPABASE_CONFIGURED) return
        const { error } = await supabase.from('expenses').delete().eq('id', expenseId)
        if (error) throw error
        setExpenses(prev => prev.filter(e => e.id !== expenseId))
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

    /** Load friendships + friend requests for current user */
    const loadFriendData = useCallback(async (userId) => {
        if (!SUPABASE_CONFIGURED) return
        try {
            const [friendshipsRes, requestsRes] = await Promise.all([
                supabase.from('friendships').select('*').or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`),
                supabase.from('friend_requests').select('*').or(`sender_id.eq.${userId},receiver_id.eq.${userId}`).eq('status', 'pending'),
            ])
            if (friendshipsRes.data) setFriendships(friendshipsRes.data)
            if (requestsRes.data) setFriendRequests(requestsRes.data)

            // Fetch friend user profiles
            const friendUserIds = new Set()
            friendshipsRes.data?.forEach(f => {
                if (f.user_a_id !== userId) friendUserIds.add(f.user_a_id)
                if (f.user_b_id !== userId) friendUserIds.add(f.user_b_id)
            })
            requestsRes.data?.forEach(r => {
                if (r.sender_id !== userId) friendUserIds.add(r.sender_id)
                if (r.receiver_id !== userId) friendUserIds.add(r.receiver_id)
            })
            if (friendUserIds.size > 0) {
                const { data: friendProfiles } = await supabase.from('users').select('*').in('id', Array.from(friendUserIds))
                if (friendProfiles) {
                    setFriends(prev => {
                        const existing = new Map(prev.map(f => [f.id, f]))
                        friendProfiles.forEach(fp => existing.set(fp.id, fp))
                        return Array.from(existing.values())
                    })
                }
            }
        } catch (e) { console.warn('loadFriendData error:', e) }
    }, [])

    /** Send a friend request by email */
    const sendFriendRequest = async (email) => {
        if (!SUPABASE_CONFIGURED || !currentUser) throw new Error('Not configured')
        const trimmed = email.trim().toLowerCase()
        if (trimmed === currentUser.email?.toLowerCase()) throw new Error('Cannot add yourself')

        // Find user by email
        const { data: targetUser } = await supabase.from('users').select('id, full_name, email').eq('email', trimmed).single()
        if (!targetUser) throw new Error('No user found with that email. They need to sign up first.')

        // Check if already friends
        const [idA, idB] = [currentUser.id, targetUser.id].sort()
        const { data: existing } = await supabase.from('friendships').select('id').eq('user_a_id', idA).eq('user_b_id', idB).single()
        if (existing) throw new Error(`Already friends with ${targetUser.full_name}`)

        // Check existing pending request
        const { data: existingReq } = await supabase.from('friend_requests').select('id').eq('sender_id', currentUser.id).eq('receiver_id', targetUser.id).single()
        if (existingReq) throw new Error('Friend request already sent')

        // Send request
        const { data, error } = await supabase.from('friend_requests').insert({ sender_id: currentUser.id, receiver_id: targetUser.id }).select().single()
        if (error) throw error
        setFriendRequests(prev => [data, ...prev])

        // Create notification for the target user
        await supabase.from('notifications').insert({
            user_id: targetUser.id,
            type: 'friend_request',
            title: 'New Friend Request',
            body: `${currentUser.full_name} wants to be your friend`,
            reference_id: data.id,
        })

        return targetUser
    }

    /** Accept a friend request */
    const acceptFriendRequest = async (requestId) => {
        if (!SUPABASE_CONFIGURED || !currentUser) return
        const request = friendRequests.find(r => r.id === requestId)
        if (!request) throw new Error('Request not found')

        // Update request status
        await supabase.from('friend_requests').update({ status: 'accepted' }).eq('id', requestId)

        // Create friendship (sorted IDs for uniqueness)
        const [idA, idB] = [request.sender_id, request.receiver_id].sort()
        await supabase.from('friendships').upsert({ user_a_id: idA, user_b_id: idB }, { onConflict: 'user_a_id,user_b_id', ignoreDuplicates: true })

        // Notify sender
        await supabase.from('notifications').insert({
            user_id: request.sender_id,
            type: 'friend_accepted',
            title: 'Friend Request Accepted',
            body: `${currentUser.full_name} accepted your friend request! 🎉`,
            reference_id: requestId,
        })

        setFriendRequests(prev => prev.filter(r => r.id !== requestId))
        await loadFriendData(currentUser.id)
    }

    /** Reject a friend request */
    const rejectFriendRequest = async (requestId) => {
        if (!SUPABASE_CONFIGURED) return
        await supabase.from('friend_requests').delete().eq('id', requestId)
        setFriendRequests(prev => prev.filter(r => r.id !== requestId))
    }

    /** Remove a friendship */
    const removeFriend = async (friendshipId) => {
        if (!SUPABASE_CONFIGURED) return
        await supabase.from('friendships').delete().eq('id', friendshipId)
        setFriendships(prev => prev.filter(f => f.id !== friendshipId))
    }

    /** Get friend ID from a friendship record */
    const getFriendIdFromFriendship = (friendship) => {
        if (!currentUser) return null
        return friendship.user_a_id === currentUser.id ? friendship.user_b_id : friendship.user_a_id
    }

    /** Check if user is my friend */
    const isFriend = (userId) => {
        return friendships.some(f =>
            (f.user_a_id === currentUser?.id && f.user_b_id === userId) ||
            (f.user_a_id === userId && f.user_b_id === currentUser?.id)
        )
    }

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
        let friendDebounceTimer
        let notifDebounceTimer
        let pollInterval

        const triggerReload = () => {
            clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => loadUserData(currentUser.id), 300)
        }

        const triggerFriendReload = () => {
            clearTimeout(friendDebounceTimer)
            friendDebounceTimer = setTimeout(() => loadFriendData(currentUser.id), 300)
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
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friend_requests' }, triggerFriendReload)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, triggerFriendReload)
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
                            loadFriendData(currentUser.id)
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
            loadFriendData(currentUser.id)
            loadNotifications(currentUser.id)
        }, 30000)

        return () => {
            supabase.removeChannel(channel)
            clearTimeout(debounceTimer)
            clearTimeout(friendDebounceTimer)
            clearTimeout(notifDebounceTimer)
            clearInterval(pollInterval)
        }
    }, [currentUser, loadUserData, loadFriendData, loadNotifications])

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
        isLoading, isSupabaseConfigured: SUPABASE_CONFIGURED,
        friends, setFriends,
        groups, addGroup, joinGroup, removeMember, deleteGroup,
        expenses, addExpense, deleteExpense,
        settlements, markSettled,
        pendingSettlements, createPendingSettlement, cancelPendingSettlement, approveSettlement, rejectSettlement,
        getUserById, getGroupById, getExpensesByGroup,
        // Friend system
        friendships, friendRequests, sendFriendRequest, acceptFriendRequest, rejectFriendRequest, removeFriend,
        getFriendIdFromFriendship, isFriend, loadFriendData,
        // Notifications
        notifications, unreadNotifCount, loadNotifications, markNotificationRead, markAllNotificationsRead,
        // Chat
        loadChatMessages, sendChatMessage,
    }

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export const useApp = () => {
    const ctx = useContext(AppContext)
    if (!ctx) throw new Error('useApp must be used within AppProvider')
    return ctx
}
