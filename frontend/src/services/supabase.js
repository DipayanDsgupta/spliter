import { createClient } from '@supabase/supabase-js'
import { Preferences } from '@capacitor/preferences'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || ''
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

// Custom storage for Supabase to use Capacitor Preferences instead of fragile localStorage
const capacitorStorage = {
    getItem: async (key) => {
        const { value } = await Preferences.get({ key })
        return value
    },
    setItem: async (key, value) => {
        await Preferences.set({ key, value })
    },
    removeItem: async (key) => {
        await Preferences.remove({ key })
    },
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: capacitorStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
    }
})

/* ────────────────────────────────────────
   AUTH HELPERS
──────────────────────────────────────── */

// Google OAuth removed - using Email OTP only
/*
export const signInWithGoogle = () =>
    supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: `com.spliter.app://auth/callback`,
            queryParams: { prompt: 'select_account' }, // always show account chooser
        },
    })
*/

/** Send 6-digit OTP to email */
export const sendEmailOtp = (email) => {
    const cleanEmail = email.trim().toLowerCase()
    return supabase.auth.signInWithOtp({
        email: cleanEmail,
        options: { shouldCreateUser: true },
    })
}

/**
 * Verify OTP entered by user.
 * We try multiple types to ensure compatibility between new and existing users.
 */
export const verifyEmailOtp = async (email, token) => {
    const cleanEmail = email.trim().toLowerCase()

    // Attempt 1: Standard login OTP type
    let result = await supabase.auth.verifyOtp({
        email: cleanEmail,
        token,
        type: 'email'
    })

    // Attempt 2: Signup confirmation type (fallback)
    if (result.error) {
        const signupResult = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token,
            type: 'signup'
        })
        if (!signupResult.error) return signupResult
    }

    // Attempt 3: Magiclink type (often used for existing user OTPs)
    if (result.error) {
        const magicResult = await supabase.auth.verifyOtp({
            email: cleanEmail,
            token,
            type: 'magiclink'
        })
        if (!magicResult.error) return magicResult
    }

    return result
}

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
    try {
        const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', userId)
            .single()
        return { data, error }
    } catch (err) {
        return { data: null, error: err }
    }
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

export const addPendingMembers = async (groupId, identifiers, invitedBy) => {
    const rows = identifiers.map(({ value, type }) => ({
        group_id: groupId,
        identifier: value.trim().toLowerCase(),
        identifier_type: type,
        invited_by: invitedBy,
    }))
    return supabase.from('pending_members').insert(rows)
}

export const claimPendingInvites = async (userId, email, phone) => {
    const identifiers = []
    if (email) identifiers.push(email.trim().toLowerCase())
    if (phone) {
        const stripped = phone.replace(/\D/g, '')
        if (stripped.length === 10) identifiers.push(stripped)
        if (stripped.length === 12) identifiers.push(stripped.slice(2))
    }
    if (!identifiers.length) return

    const { data: pending } = await supabase
        .from('pending_members')
        .select('id, group_id')
        .in('identifier', identifiers)

    if (!pending?.length) return

    const memberRows = pending.map(p => ({ group_id: p.group_id, user_id: userId }))
    await supabase
        .from('group_members')
        .upsert(memberRows, { onConflict: 'group_id,user_id', ignoreDuplicates: true })

    const ids = pending.map(p => p.id)
    await supabase.from('pending_members').delete().in('id', ids)

    return pending.map(p => p.group_id)
}

export default supabase
