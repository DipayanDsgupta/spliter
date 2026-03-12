import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Users, UserCheck, TrendingUp, User } from 'lucide-react'
import { useApp } from '../context/AppContext'

const NAV_ITEMS = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Users, label: 'Groups', path: '/groups' },
    { icon: UserCheck, label: 'Friends', path: '/friends' },
    { icon: TrendingUp, label: 'Settle', path: '/balances' },
    { icon: User, label: 'Profile', path: '/profile' },
]

export default function BottomNav() {
    const location = useLocation()
    const navigate = useNavigate()
    const { unreadNotifCount } = useApp()

    // Hide on auth, add expense, profile setup, and chat pages
    const hide = ['/auth', '/add-expense', '/profile-setup', '/chat'].some(p => location.pathname.startsWith(p))
    if (hide) return null

    return (
        <nav className="bottom-nav">
            <div className="flex items-center justify-around px-2 py-2">
                {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
                    const isActive = location.pathname === path ||
                        (path === '/groups' && location.pathname.startsWith('/groups')) ||
                        (path === '/friends' && location.pathname.startsWith('/friends'))
                    const isProfile = path === '/profile'
                    return (
                        <button
                            key={path}
                            onClick={() => navigate(path)}
                            className="flex flex-col items-center gap-1 px-3 py-1.5 rounded-2xl transition-all relative"
                            style={{ minWidth: '56px' }}
                        >
                            {/* Active indicator */}
                            {isActive && (
                                <motion.div
                                    className="absolute inset-0 rounded-2xl"
                                    style={{ background: 'rgba(124,58,237,0.15)' }}
                                    layoutId="nav-indicator"
                                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                                />
                            )}

                            <motion.div
                                className="relative"
                                animate={{
                                    scale: isActive ? 1.15 : 1,
                                    y: isActive ? -1 : 0,
                                }}
                                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                            >
                                <Icon
                                    size={20}
                                    style={{ color: isActive ? '#9D5FF3' : '#475569' }}
                                    strokeWidth={isActive ? 2.5 : 1.8}
                                />
                                {/* Notification badge on Profile */}
                                {isProfile && unreadNotifCount > 0 && (
                                    <span
                                        className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full text-[9px] font-extrabold text-white"
                                        style={{ background: '#F43F5E', boxShadow: '0 0 8px rgba(244,63,94,0.5)' }}
                                    >
                                        {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
                                    </span>
                                )}
                            </motion.div>
                            <span
                                className="text-[10px] font-semibold relative z-10 transition-colors"
                                style={{ color: isActive ? '#9D5FF3' : '#475569' }}
                            >
                                {label}
                            </span>
                        </button>
                    )
                })}
            </div>
        </nav>
    )
}
