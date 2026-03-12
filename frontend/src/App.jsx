import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import { AppProvider } from './context/AppContext'
import ProtectedRoute from './components/ProtectedRoute'
import BottomNav from './components/BottomNav'
import AuthPage from './pages/AuthPage'
import AuthCallback from './pages/AuthCallback'
import ProfileSetupPage from './pages/ProfileSetupPage'
import JoinGroupPage from './pages/JoinGroupPage'
import Dashboard from './pages/Dashboard'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import AddExpensePage from './pages/AddExpensePage'
import BalancesPage from './pages/BalancesPage'
import ActivityPage from './pages/ActivityPage'
import FriendsPage from './pages/FriendsPage'
import ProfilePage from './pages/ProfilePage'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            style: {
              background: '#1A1A35',
              color: '#F1F5F9',
              border: '1px solid rgba(124,58,237,0.3)',
              borderRadius: '14px',
              fontSize: '14px',
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              fontWeight: '600',
            },
            success: {
              iconTheme: { primary: '#10B981', secondary: '#F1F5F9' },
            },
          }}
        />
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile-setup" element={<ProfileSetupPage />} />
          <Route path="/join/:groupId" element={<JoinGroupPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/add-expense" element={<AddExpensePage />} />
            <Route path="/balances" element={<BalancesPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <BottomNav />
      </BrowserRouter>
    </AppProvider>
  )
}
