import { useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { motion } from 'framer-motion'
import { AppProvider, useApp } from './context/AppContext'
import ProtectedRoute from './components/ProtectedRoute'
import BottomNav from './components/BottomNav'
import AuthPage from './pages/AuthPage'
import AuthCallback from './pages/AuthCallback'
import ProfileSetupPage from './pages/ProfileSetupPage'
import JoinGroupPage from './pages/JoinGroupPage'
import Dashboard from './pages/Dashboard'
import GroupsPage from './pages/GroupsPage'
import GroupDetailPage from './pages/GroupDetailPage'
import SpendingsPage from './pages/SpendingsPage'
import MemberSpendingDetailPage from './pages/MemberSpendingDetailPage'
import AddExpensePage from './pages/AddExpensePage'
import EditExpensePage from './pages/EditExpensePage'
import SimplifyDebtsPage from './pages/SimplifyDebtsPage'
import SponsorPage from './pages/SponsorPage'
import BalancesPage from './pages/BalancesPage'
import ActivityPage from './pages/ActivityPage'
import ChatPage from './pages/ChatPage'
import ProfilePage from './pages/ProfilePage'
import SettlementHistoryPage from './pages/SettlementHistoryPage'

export default function Root() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </AppProvider>
  )
}

function AppLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoading } = useApp()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // Android hardware back button handler
  useEffect(() => {
    const handleBackButton = (e) => {
      // If we're on a root-level page, let the OS handle it (minimize app)
      const rootPages = ['/', '/auth', '/groups', '/activity', '/balances', '/profile']
      if (rootPages.includes(location.pathname)) return

      // Otherwise go back in history
      e.preventDefault()
      navigate(-1)
    }

    // Capacitor/Cordova back button event
    document.addEventListener('backbutton', handleBackButton)

    return () => {
      document.removeEventListener('backbutton', handleBackButton)
    }
  }, [location.pathname, navigate])

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-screen w-screen animated-bg">
        <motion.div
           initial={{ opacity: 0, scale: 0.8 }}
           animate={{ opacity: 1, scale: 1 }}
           transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
        >
            <div className="w-20 h-20 rounded-3xl mb-4 mx-auto flex items-center justify-center text-4xl shadow-2xl shadow-purple-500/20 text-white" 
                 style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}>
                🎯
            </div>
        </motion.div>
        <p className="text-[#94A3B8] font-bold text-sm animate-pulse tracking-wide uppercase">Loading Data...</p>
      </div>
    )
  }

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 2500,
          style: {
            background: '#1A1A35',
            color: '#F1F5F9',
            border: '1px solid rgba(124,58,237,0.3)',
            borderRadius: '18px',
            fontSize: '14px',
            fontWeight: '600',
            backdropFilter: 'blur(10px)',
          }
        }}
      />
      <div id="main-scroll-container" className="flex-1 flex flex-col h-full overflow-x-hidden overflow-y-auto">
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/profile-setup" element={<ProfileSetupPage />} />
          <Route path="/join/:groupId" element={<JoinGroupPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/:id" element={<GroupDetailPage />} />
            <Route path="/groups/:id/spendings" element={<SpendingsPage />} />
            <Route path="/groups/:id/spendings/:memberId" element={<MemberSpendingDetailPage />} />
            <Route path="/add-expense" element={<AddExpensePage />} />
            <Route path="/edit-expense/:expenseId" element={<EditExpensePage />} />
            <Route path="/groups/:id/settle" element={<SimplifyDebtsPage />} />
            <Route path="/groups/:id/sponsor" element={<SponsorPage />} />
            <Route path="/balances" element={<BalancesPage />} />
            <Route path="/activity" element={<ActivityPage />} />
            <Route path="/chat/:groupId" element={<ChatPage />} />
            <Route path="/chat" element={<ChatPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settlement-history" element={<SettlementHistoryPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
      <BottomNav />
    </>
  )
}
