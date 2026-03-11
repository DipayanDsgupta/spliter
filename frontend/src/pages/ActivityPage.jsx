import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { formatDate, CATEGORIES, formatAmount, getAvatarColor, getInitials } from '../utils/helpers'

export default function ActivityPage() {
    const { expenses, getUserById } = useApp()
    const sorted = [...expenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    // Group by date
    const groups = {}
    for (const exp of sorted) {
        const day = formatDate(exp.created_at)
        if (!groups[day]) groups[day] = []
        groups[day].push(exp)
    }

    return (
        <div className="page animated-bg">
            <div className="px-5 pt-12 pb-6">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                    <h1 className="text-2xl font-extrabold text-white">Activity</h1>
                    <p className="text-[#94A3B8] text-sm mt-1">All your expense history</p>
                </motion.div>

                {Object.entries(groups).map(([day, dayExpenses]) => (
                    <div key={day} className="mb-6">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="h-[1px] flex-1 bg-white/06" />
                            <span className="text-xs font-bold text-[#475569] uppercase tracking-wider px-2">{day}</span>
                            <div className="h-[1px] flex-1 bg-white/06" />
                        </div>
                        <div className="space-y-3">
                            {dayExpenses.map((exp, i) => {
                                const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[7]
                                const payers = exp.paid_by.map(p => {
                                    const u = getUserById(p.user_id)
                                    return `${u?.full_name?.split(' ')[0]} (${formatAmount(p.amount_paid)})`
                                }).join(', ')

                                return (
                                    <motion.div
                                        key={exp.id}
                                        className="card"
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.04 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <div className="flex items-start gap-3">
                                            <div
                                                className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0"
                                                style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}
                                            >
                                                {cat.emoji}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-start justify-between gap-2">
                                                    <p className="font-bold text-white text-sm leading-tight">{exp.title}</p>
                                                    <p className="font-extrabold text-white text-base shrink-0">{formatAmount(exp.amount)}</p>
                                                </div>
                                                <p className="text-xs text-[#94A3B8] mt-1">Paid by {payers}</p>

                                                {/* Category pill */}
                                                <div className="flex items-center gap-2 mt-2">
                                                    <span
                                                        className="category-pill"
                                                        style={{ background: `${cat.color}15`, color: cat.color, border: `1px solid ${cat.color}30` }}
                                                    >
                                                        {cat.emoji} {cat.label}
                                                    </span>
                                                    <span className="text-[10px] text-[#475569]">{exp.splits.length} people</span>
                                                </div>

                                                {exp.note && (
                                                    <p className="text-xs text-[#475569] mt-1.5 italic">"{exp.note}"</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Member avatars */}
                                        <div className="flex items-center gap-1 mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                            <p className="text-[10px] text-[#475569] mr-1">Split among:</p>
                                            {exp.splits.slice(0, 8).map((s, si) => {
                                                const [c1, c2] = getAvatarColor(getUserById(s.user_id)?.full_name || '')
                                                return (
                                                    <div
                                                        key={s.user_id}
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white border"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${c1}, ${c2})`,
                                                            borderColor: '#1A1A35',
                                                            marginLeft: si > 0 ? '-4px' : '0',
                                                        }}
                                                    >
                                                        {si === 7 && exp.splits.length > 8 ? `+${exp.splits.length - 7}` : getInitials(getUserById(s.user_id)?.full_name)}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}
