import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/* ────────────────────────────────────────
   AUTH HELPERS
──────────────────────────────────────── */

/** Sign in with Google OAuth — opens account chooser popup */
export const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `${window.location.origin}/auth/callback`,
            queryParams: { prompt: 'select_account' }, // always show account chooser
        },
    })

/** Send 6-digit OTP to email */
export const sendEmailOtp = (email) =>
    supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true },
    })

/** Verify OTP entered by user */
export const verifyEmailOtp = (email, token) =>
    supabase.auth.verifyOtp({ email, token, type: 'email' })

/** Get current Supabase session */
export const getSession = () => supabase.auth.getSession()

/** Sign out */
export const signOut = () => supabase.auth.signOut()

/** Listen to auth state changes */
export const onAuthChange = (callback) =>
    supabase.auth.onAuthStateChange(callback)

/* ────────────────────────────────────────
   USER PROFILE HELPERS
──────────────────────────────────────── */

/** Fetch user profile from `users` table */
export const fetchUserProfile = async (userId) => {
    const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single()
    return { data, error }
}

/** Create or update user profile */
export const upsertUserProfile = async (profile) => {
    const { data, error } = await supabase
        .from('users')
        .upsert(profile, { onConflict: 'id' })
        .select()
        .single()
    return { data, error }
}

/* ────────────────────────────────────────
   PENDING INVITE HELPERS
──────────────────────────────────────── */

/**
 * Add one or more people to a group by email/phone.
 * If they're already on Spliter, they see it on next login.
 * If not, they'll get it when they sign up.
 */
export const addPendingMembers = async (groupId, identifiers, invitedBy) => {
    const rows = identifiers.map(({ value, type }) => ({
        group_id: groupId,
        identifier: value.trim().toLowerCase(),
        identifier_type: type,  // 'email' or 'phone'
        invited_by: invitedBy,
    }))
    return supabase.from('pending_members').insert(rows)
}

/**
 * Called after a user signs up OR logs in.
 * Finds all pending invites matching their email or phone
 * and converts them to real group_members rows.
 */
export const claimPendingInvites = async (userId, email, phone) => {
    const identifiers = []
    if (email) identifiers.push(email.trim().toLowerCase())
    // Normalise phone: strip +91 prefix for matching
    if (phone) {
        const stripped = phone.replace(/\D/g, '')
        if (stripped.length === 10) identifiers.push(stripped)
        if (stripped.length === 12) identifiers.push(stripped.slice(2))  // remove country code
    }
    if (!identifiers.length) return

    // Find all pending invites for this user
    const { data: pending } = await supabase
        .from('pending_members')
        .select('id, group_id')
        .in('identifier', identifiers)

    if (!pending?.length) return

    // Insert into real group_members (ignore duplicates)
    const memberRows = pending.map(p => ({ group_id: p.group_id, user_id: userId }))
    await supabase
        .from('group_members')
        .upsert(memberRows, { onConflict: 'group_id,user_id', ignoreDuplicates: true })

    // Clean up pending rows
    const ids = pending.map(p => p.id)
    await supabase.from('pending_members').delete().in('id', ids)

    return pending.map(p => p.group_id)  // return claimed group IDs
}

export default supabase
