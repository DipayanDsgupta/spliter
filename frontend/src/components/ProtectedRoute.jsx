import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function ProtectedRoute() {
    const { currentUser, isLoading, needsProfile } = useApp()

    if (isLoading) {
        return (
            <div className="min-h-dvh animated-bg flex flex-col items-center justify-center gap-4">
                <div className="text-5xl float">💰</div>
                <div className="w-8 h-8 border-2 rounded-full animate-spin"
                    style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7C3AED' }} />
                <p className="text-sm" style={{ color: '#94A3B8' }}>Loading Spliter...</p>
            </div>
        )
    }

    if (!currentUser) return <Navigate to="/auth" replace />

    // Authenticated but profile not yet completed → go to profile setup
    if (needsProfile) return <Navigate to="/profile-setup" replace />

    return <Outlet />
}
