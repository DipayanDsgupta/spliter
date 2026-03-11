import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Home, Users, Activity, TrendingUp, User } from 'lucide-react'

const NAV_ITEMS = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Users, label: 'Groups', path: '/groups' },
    { icon: Activity, label: 'Activity', path: '/activity' },
    { icon: TrendingUp, label: 'Settle', path: '/balances' },
    { icon: User, label: 'Profile', path: '/profile' },
]

export default function BottomNav() {
    const location = useLocation()
    const navigate = useNavigate()

    // Hide on auth and add expense pages
    const hide = ['/auth', '/add-expense'].some(p => location.pathname.startsWith(p))
    if (hide) return null

    return (
        <nav className="bottom-nav">
            <div className="flex items-center justify-around px-2 py-2">
                {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
                    const isActive = location.pathname === path ||
                        (path === '/groups' && location.pathname.startsWith('/groups'))
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
