import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import SplashScreen from './SplashScreen'

export default function ProtectedRoute() {
    const { currentUser, isLoading, needsProfile } = useApp()

    if (isLoading) {
        return <SplashScreen />
    }

    if (!currentUser) return <Navigate to="/auth" replace />

    // Authenticated but profile not yet completed → go to profile setup
    if (needsProfile) return <Navigate to="/profile-setup" replace />

    return <Outlet />
}
