import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../services/supabase'

/**
 * This page handles the redirect after Google OAuth login.
 * Supabase redirects back to /auth/callback with the session tokens in the URL.
 * We just need to render this briefly — Supabase SDK auto-processes the tokens.
 */
export default function AuthCallback() {
    const navigate = useNavigate()

    useEffect(() => {
        // Supabase handles the token exchange automatically via onAuthStateChange
        // We just wait briefly and redirect to home — the context will pick up the session
        const timer = setTimeout(() => navigate('/', { replace: true }), 1500)
        return () => clearTimeout(timer)
    }, [navigate])

    return (
        <div className="min-h-dvh animated-bg flex flex-col items-center justify-center gap-4">
            <div className="text-5xl float">💰</div>
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
                style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7C3AED' }} />
            <p style={{ color: '#94A3B8' }} className="text-sm">Signing you in...</p>
        </div>
    )
}
