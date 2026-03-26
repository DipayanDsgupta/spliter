import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { LogOut, Plus, ChevronRight, TrendingUp, BarChart3, Users, Clock, ArrowUpRight, ArrowDownLeft, Copy, Wallet, CheckCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import PullToRefresh from '../components/PullToRefresh'
import { calculateNetBalances, simplifyDebts, formatAmount, getAvatarColor, getInitials, formatTime, CATEGORIES, formatDate } from '../utils/helpers'

function StatCard({ label, amount, positive, icon: Icon }) {
    return (
        <motion.div
            className="stat-card"
            style={{
                background: positive
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(6,182,212,0.05))'
                    : 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(245,158,11,0.05))',
                border: `1px solid ${positive ? 'rgba(16,185,129,0.18)' : 'rgba(244,63,94,0.18)'}`,
            }}
            whileTap={{ scale: 0.97 }}
        >
            <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                    style={{ background: positive ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)' }}>
                    <Icon size={13} style={{ color: positive ? '#10B981' : '#F43F5E' }} />
                </div>
                <span className="text-xs text-[#94A3B8] font-medium">{label}</span>
            </div>
            <p className="text-xl font-extrabold" style={{ color: positive ? '#10B981' : '#F43F5E' }}>
                {formatAmount(Math.abs(amount))}
            </p>
        </motion.div>
    )
}

function GroupCard({ group, onClick }) {
    const { getExpensesByGroup, currentUser, getUserById, pendingSettlements, sponsorships, manualRefresh } = useApp()
    const expenses = getExpensesByGroup(group.id)

    // Calculate user's net in this group (adjusted for settlements)
    const groupCompletedSettlements = (pendingSettlements || []).filter(s => s.group_id === group.id && s.status === 'completed')
    const groupSponsorships = (sponsorships || []).filter(s => s.group_id === group.id)
    const balances = calculateNetBalances(expenses, groupCompletedSettlements, groupSponsorships)
    const myNet = balances[currentUser?.id] || 0

    return (
        <motion.div
            className="card cursor-pointer"
            whileHover={{ y: -2, borderColor: 'rgba(124,58,237,0.3)' }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            transition={{ duration: 0.15 }}
        >
            <div className="flex items-center gap-4">
                <div className="text-3xl">{group.emoji}</div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-[15px] truncate">{group.name}</h3>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{group.members.length} members · {expenses.length} expenses</p>
                </div>
                <div className="text-right shrink-0">
                    {Math.abs(myNet) < 1 ? (
                        <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ color: '#10B981', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)' }}>✓ Settled</span>
                    ) : myNet > 0 ? (
                        <div>
                            <p className="text-xs text-[#94A3B8]">you get</p>
                            <p className="font-bold text-base" style={{ color: '#10B981' }}>{formatAmount(myNet)}</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-xs text-[#94A3B8]">you owe</p>
                            <p className="font-bold text-base" style={{ color: '#F43F5E' }}>{formatAmount(-myNet)}</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}


function RecentActivity() {
    const { expenses, getUserById, currentUser } = useApp()
    
    // Only show expenses that the current user is a part of
    const userExpenses = expenses.filter(e => 
        e.paid_by?.some(p => p.user_id === currentUser?.id) || 
        e.expense_splits?.some(s => s.user_id === currentUser?.id)
    )

    const recent = [...userExpenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)

    if (recent.length === 0) return (
        <motion.div
            className="text-center py-8 rounded-3xl"
            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        >
            <div className="text-4xl mb-3">📭</div>
            <p className="text-white font-semibold text-sm mb-1">No activity yet</p>
            <p className="text-[#475569] text-xs">Add an expense to get started</p>
        </motion.div>
    )

    return (
        <div className="space-y-3">
            {recent.map((exp, i) => {
                const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[7]
                const payers = exp.paid_by.map(p => getUserById(p.user_id)?.full_name?.split(' ')[0]).join(', ')
                return (
                    <motion.div
                        key={exp.id}
                        className="flex items-center gap-4 p-4 card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        whileTap={{ scale: 0.98 }}
                    >
                        <div
                            className="w-10 h-10 rounded-2xl flex items-center justify-center text-lg shrink-0"
                            style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}
                        >
                            {cat.emoji}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="font-semibold text-white text-sm truncate">{exp.title}</p>
                            <p className="text-xs text-[#94A3B8] mt-0.5">{payers} paid · {formatDate(exp.created_at)}</p>
                        </div>
                        <div className="text-right shrink-0">
                            <p className="font-bold text-white text-sm">{formatAmount(exp.amount)}</p>
                            <p className="text-[10px] text-[#94A3B8] font-medium mt-0.5">{formatTime(exp.created_at)}</p>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}

export default function Dashboard() {
    const navigate = useNavigate()
    const { currentUser, groups, expenses, pendingSettlements, sponsorships, getUserById, manualRefresh, dataLoading } = useApp()

    // Calculate overall net balance (adjusted for settlements)
    const completedSettlements = (pendingSettlements || []).filter(s => s.status === 'completed')
    const allBalances = calculateNetBalances(expenses, completedSettlements, sponsorships)
    const myNet = allBalances[currentUser?.id] || 0
    
    // Accurate calculation for "You'll receive" and "You owe"
    const allTransactions = simplifyDebts(allBalances)
    const myTransactions = allTransactions.filter(
        t => t.from === currentUser?.id || t.to === currentUser?.id
    )
    
    let totalOwedToMe = 0
    let totalIOwe = 0
    myTransactions.forEach(t => {
        if (t.to === currentUser?.id) totalOwedToMe += t.amount
        if (t.from === currentUser?.id) totalIOwe += t.amount
    })

    const firstName = currentUser?.full_name?.split(' ')[0] || 'there'

    return (
        <PullToRefresh onRefresh={manualRefresh}>
            <div className="page animated-bg">
                {/* Header */}
                <div className="px-5 pt-12 pb-24">
                <motion.div
                    className="flex items-center justify-between mb-6"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <div>
                        <p className="text-[#94A3B8] text-sm font-medium">Good morning,</p>
                        <h1 className="text-2xl font-extrabold text-white">{firstName} 👋</h1>
                    </div>
                    <motion.button
                        className="w-10 h-10 rounded-2xl glass-bright flex items-center justify-center text-lg"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate('/profile')}
                    >
                        {getInitials(currentUser?.full_name)}
                    </motion.button>
                </motion.div>

                {/* Main balance card */}
                <motion.div
                    className="rounded-3xl p-6 mb-5 relative overflow-hidden"
                    style={{ background: 'linear-gradient(135deg, #7C3AED 0%, #3B82F6 60%, #06B6D4 100%)' }}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 }}
                >
                    {/* Decorative circles */}
                    <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-white/10" />
                    <div className="absolute -right-2 top-8 w-20 h-20 rounded-full bg-white/08" />

                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Wallet size={14} className="text-white/70" />
                            <p className="text-white/70 text-sm font-medium">Net Balance</p>
                        </div>
                        {dataLoading ? (
                            <>
                                <div className="h-10 w-56 rounded-xl bg-white/15 animate-pulse mb-2" />
                                <div className="h-4 w-44 rounded-lg bg-white/10 animate-pulse" />
                            </>
                        ) : (
                            <>
                                <p className="text-4xl font-extrabold text-white mb-1">
                                    {myNet >= 0 ? '+' : '-'}{formatAmount(Math.abs(myNet))}
                                </p>
                                <p className="text-white/60 text-sm">
                                    {myNet >= 0 ? '🟢 Overall you are owed money' : '🔴 Overall you owe money'}
                                </p>
                            </>
                        )}
                    </div>
                </motion.div>

                {/* Stat cards */}
                <motion.div
                    className="flex gap-3 mb-8"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    {dataLoading ? (
                        <>
                            <div className="flex-1 stat-card" style={{ background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(6,182,212,0.05))', border: '1px solid rgba(16,185,129,0.18)' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-500/15 animate-pulse" />
                                    <div className="h-3 w-20 rounded bg-white/10 animate-pulse" />
                                </div>
                                <div className="h-6 w-24 rounded-lg bg-white/10 animate-pulse" />
                            </div>
                            <div className="flex-1 stat-card" style={{ background: 'linear-gradient(135deg, rgba(244,63,94,0.10), rgba(245,158,11,0.05))', border: '1px solid rgba(244,63,94,0.18)' }}>
                                <div className="flex items-center gap-2 mb-3">
                                    <div className="w-6 h-6 rounded-lg bg-rose-500/15 animate-pulse" />
                                    <div className="h-3 w-16 rounded bg-white/10 animate-pulse" />
                                </div>
                                <div className="h-6 w-20 rounded-lg bg-white/10 animate-pulse" />
                            </div>
                        </>
                    ) : (
                        <>
                            <StatCard label="You'll receive" amount={totalOwedToMe} positive={true} icon={ArrowDownLeft} />
                            <StatCard label="You owe" amount={totalIOwe} positive={false} icon={ArrowUpRight} />
                        </>
                    )}
                </motion.div>

                {/* Quick actions */}
                <motion.div
                    className="flex gap-3 mb-8"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25 }}
                >
                    <motion.button
                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm text-white"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                        whileHover={{ y: -2, boxShadow: '0 8px 25px rgba(124,58,237,0.4)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/add-expense')}
                    >
                        <Plus size={18} /> Add Expense
                    </motion.button>
                    <motion.button
                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm"
                        style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.10)' }}
                        whileHover={{ borderColor: 'rgba(16,185,129,0.3)' }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/balances')}
                    >
                        <TrendingUp size={18} style={{ color: '#10B981' }} />
                        <span className="text-white">Settle Up</span>
                    </motion.button>
                </motion.div>

                {/* Settlement History */}
                {!dataLoading && completedSettlements.filter(s => s.payer_id === currentUser?.id || s.receiver_id === currentUser?.id).length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-bold text-white">Settlement History</h2>
                            <button
                                className="text-green-400 text-sm font-semibold flex items-center gap-1"
                                onClick={() => navigate('/balances')}
                            >
                                See all <ArrowUpRight size={14} />
                            </button>
                        </div>
                        <div className="space-y-2.5">
                            {completedSettlements
                                .filter(s => s.payer_id === currentUser?.id || s.receiver_id === currentUser?.id)
                                .sort((a, b) => new Date(b.verified_at || b.created_at) - new Date(a.verified_at || a.created_at))
                                .slice(0, 5)
                                .map((s, i) => {
                                    const isMePayer = s.payer_id === currentUser?.id
                                    const otherUser = getUserById(isMePayer ? s.receiver_id : s.payer_id)
                                    const otherName = otherUser?.full_name?.split(' ')[0] || 'Unknown'
                                    const group = groups.find(g => g.id === s.group_id)
                                    return (
                                        <motion.div
                                            key={s.id}
                                            className="card"
                                            style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.18)' }}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.05 }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                                                    style={{ background: 'rgba(16,185,129,0.15)' }}>
                                                    <CheckCircle size={16} className="text-green-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm font-semibold text-white truncate">
                                                        {isMePayer ? `You paid ${otherName}` : `${otherName} paid you`}
                                                    </p>
                                                    <p className="text-[10px] text-[#94A3B8] mt-0.5">
                                                        {group ? `${group.emoji} ${group.name}` : 'Direct'} · {formatDate(s.verified_at || s.created_at)}
                                                    </p>
                                                </div>
                                                <p className="font-extrabold text-sm shrink-0" style={{ color: isMePayer ? '#F43F5E' : '#10B981' }}>
                                                    {isMePayer ? '-' : '+'}{formatAmount(Number(s.amount))}
                                                </p>
                                            </div>
                                        </motion.div>
                                    )
                                })}
                        </div>
                    </div>
                )}

                {/* Groups */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Your Groups</h2>
                        <button
                            className="text-purple-400 text-sm font-semibold flex items-center gap-1"
                            onClick={() => navigate('/groups')}
                        >
                            See all <ArrowUpRight size={14} />
                        </button>
                    </div>
                    {dataLoading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => (
                                <div key={i} className="card">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-2xl bg-white/8 animate-pulse" />
                                        <div className="flex-1">
                                            <div className="h-4 w-28 rounded bg-white/10 animate-pulse mb-2" />
                                            <div className="h-3 w-36 rounded bg-white/6 animate-pulse" />
                                        </div>
                                        <div className="h-5 w-20 rounded-lg bg-white/8 animate-pulse" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : groups.length === 0 ? (
                        <motion.div
                            className="text-center py-10 rounded-3xl cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
                            onClick={() => navigate('/groups')}
                            whileTap={{ scale: 0.98 }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        >
                            <div className="text-4xl mb-3">👥</div>
                            <p className="text-white font-semibold text-sm mb-1">No groups yet</p>
                            <p className="text-[#475569] text-xs mb-4">Create a group to start splitting expenses</p>
                            <span className="text-xs font-bold px-4 py-2 rounded-full"
                                style={{ background: 'rgba(124,58,237,0.15)', color: '#9D5FF3', border: '1px solid rgba(124,58,237,0.3)' }}>
                                + Create Group
                            </span>
                        </motion.div>
                    ) : (
                        <div className="space-y-3">
                            {groups.slice(0, 3).map((group, i) => (
                                <motion.div
                                    key={group.id}
                                    initial={{ opacity: 0, y: 16 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.08 }}
                                >
                                    <GroupCard group={group} onClick={() => navigate(`/groups/${group.id}`)} />
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>




                {/* Recent activity */}
                <div>
                    <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
                    {dataLoading ? (
                        <div className="space-y-3">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex items-center gap-4 p-4 card">
                                    <div className="w-10 h-10 rounded-2xl bg-white/8 animate-pulse shrink-0" />
                                    <div className="flex-1">
                                        <div className="h-4 w-32 rounded bg-white/10 animate-pulse mb-2" />
                                        <div className="h-3 w-40 rounded bg-white/6 animate-pulse" />
                                    </div>
                                    <div className="h-5 w-16 rounded bg-white/8 animate-pulse" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <RecentActivity />
                    )}
                </div>
            </div>
            </div>
        </PullToRefresh>
    )
}
