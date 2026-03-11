import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase, onAuthChange, fetchUserProfile, upsertUserProfile, signOut, claimPendingInvites } from '../services/supabase'
import { MOCK_FRIENDS, MOCK_GROUPS, MOCK_EXPENSES, MOCK_SETTLEMENTS } from '../utils/mockData'

/** Wraps a promise with a timeout — avoids hanging on slow/missing DB */
const withTimeout = (promise, ms = 6000) =>
    Promise.race([
        promise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ])

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

            // Populate members per group
            if (membersRes.data) {
                loadedGroups.forEach(g => {
                    g.members = membersRes.data.filter(m => m.group_id === g.id).map(m => m.user_id)
                })
            }
            setGroups(loadedGroups)

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
    const handleUserSession = useCallback(async (authUser) => {
        const { data } = await fetchUserProfile(authUser.id)

        if (data?.full_name && data?.upi_id) {
            setCurrentUser({ id: authUser.id, email: authUser.email || '', ...data })
            setNeedsProfile(false)

            // Run claim + load in PARALLEL — don't await sequentially
            await Promise.all([
                claimPendingInvites(authUser.id, authUser.email, data.phone),
                claimJoinLink(authUser.id),
            ])
            // Load data after claiming (so newly joined groups appear)
            await loadUserData(authUser.id)
        } else {
            // New user — profile incomplete, send to setup
            setCurrentUser({
                id: authUser.id,
                email: authUser.email || authUser.user_metadata?.email || '',
                full_name: authUser.user_metadata?.full_name || authUser.user_metadata?.name || '',
            })
            setNeedsProfile(true)
        }
        setIsLoading(false)
    }, [loadUserData])

    /* ── Auth bootstrapping ── */
    useEffect(() => {
        if (!SUPABASE_CONFIGURED) {
            const saved = localStorage.getItem('spliter_user')
            if (saved) setCurrentUser(JSON.parse(saved))
            setTimeout(() => setIsLoading(false), 400)
            return
        }

        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session?.user) handleUserSession(session.user)
            else setIsLoading(false)
        })

        const { data: { subscription } } = onAuthChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) await handleUserSession(session.user)
            if (event === 'SIGNED_OUT') { setCurrentUser(null); setNeedsProfile(false); setIsLoading(false) }
        })

        return () => subscription.unsubscribe()
    }, [handleUserSession])

    /* ── Realtime Data Syncing ── */
    useEffect(() => {
        if (!SUPABASE_CONFIGURED || !currentUser) return

        const channel = supabase.channel('public:spliter_activity')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members' }, () => {
                loadUserData(currentUser.id)
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses' }, () => {
                loadUserData(currentUser.id)
            })
            .subscribe()

        return () => { supabase.removeChannel(channel) }
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

        const normalizedPhone = `+91${phone.replace(/\D/g, '').slice(-10)}`
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
    const addExpense = (expense) => {
        const e = { ...expense, id: `exp-${Date.now()}`, created_at: new Date().toISOString() }
        setExpenses(prev => [e, ...prev])
        return e
    }

    const addGroup = async (group) => {
        const id = `group-${Date.now()}`
        const g = { ...group, id, created_at: new Date().toISOString(), total_expenses: 0 }

        if (SUPABASE_CONFIGURED && currentUser) {
            try {
                // Insert group row with a timeout — if tables don't exist or network is slow,
                // we fall through and still create the group in local state
                const { data: inserted, error: insertErr } = await withTimeout(
                    supabase
                        .from('groups')
                        .insert({ id, name: g.name, emoji: g.emoji, created_by: currentUser.id, created_at: g.created_at })
                        .select().single()
                )

                if (insertErr) throw insertErr

                const groupId = inserted?.id || id
                g.id = groupId

                const memberIds = [...new Set([currentUser.id, ...group.members])]
                await withTimeout(
                    supabase.from('group_members').insert(
                        memberIds.map(uid => ({ group_id: groupId, user_id: uid }))
                    )
                )
            } catch (err) {
                const reason = err?.message === 'timeout' ? 'DB timeout' : (err?.message || err?.code || 'unknown')
                console.warn(`addGroup DB save skipped (${reason}) — group saved locally only`)
            }
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
