import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, TrendingUp, Users, ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, simplifyDebts, formatAmount, getAvatarColor, getInitials, formatDate, CATEGORIES } from '../utils/helpers'

function StatCard({ label, amount, positive, icon: Icon }) {
    return (
        <motion.div
            className="stat-card"
            style={{
                background: positive
                    ? 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(6,182,212,0.06))'
                    : 'linear-gradient(135deg, rgba(244,63,94,0.12), rgba(245,158,11,0.06))',
                border: `1px solid ${positive ? 'rgba(16,185,129,0.2)' : 'rgba(244,63,94,0.2)'}`,
            }}
            whileTap={{ scale: 0.97 }}
        >
            <div className="flex items-center gap-2 mb-2">
                <Icon size={14} style={{ color: positive ? '#10B981' : '#F43F5E' }} />
                <span className="text-xs text-[#94A3B8] font-medium">{label}</span>
            </div>
            <p className="text-xl font-extrabold" style={{ color: positive ? '#10B981' : '#F43F5E' }}>
                {formatAmount(Math.abs(amount))}
            </p>
        </motion.div>
    )
}

function GroupCard({ group, onClick }) {
    const { getExpensesByGroup, currentUser, getUserById, pendingSettlements } = useApp()
    const expenses = getExpensesByGroup(group.id)

    // Calculate user's net in this group (adjusted for settlements)
    const groupCompletedSettlements = (pendingSettlements || []).filter(s => s.group_id === group.id && s.status === 'completed')
    const balances = calculateNetBalances(expenses, groupCompletedSettlements)
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
                        <span className="text-xs font-semibold text-[#94A3B8] bg-white/05 px-2 py-1 rounded-full">Settled</span>
                    ) : myNet > 0 ? (
                        <div>
                            <p className="text-xs text-[#94A3B8]">you get</p>
                            <p className="font-bold text-base amount-positive">{formatAmount(myNet)}</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-xs text-[#94A3B8]">you owe</p>
                            <p className="font-bold text-base amount-negative">{formatAmount(-myNet)}</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

function FriendCard({ friendUser, onClick }) {
    const { expenses, currentUser, pendingSettlements } = useApp()

    // Filter to expenses involving just these two users with NO group_id
    const sharedExpenses = expenses.filter(e => 
        !e.group_id && 
        e.expense_splits?.some(s => s.user_id === currentUser?.id) &&
        e.expense_splits?.some(s => s.user_id === friendUser?.id)
    )
    
    // Filter to settlements between these two users with NO group_id
    const sharedSettlements = (pendingSettlements || []).filter(s => 
        !s.group_id && s.status === 'completed' &&
        ((s.payer_id === currentUser?.id && s.receiver_id === friendUser?.id) || 
         (s.payer_id === friendUser?.id && s.receiver_id === currentUser?.id))
    )

    const balances = calculateNetBalances(sharedExpenses, sharedSettlements)
    const myNet = balances[currentUser?.id] || 0

    const [c1, c2] = getAvatarColor(friendUser?.full_name || '')

    return (
        <motion.div
            className="card cursor-pointer"
            whileHover={{ y: -2, borderColor: 'rgba(124,58,237,0.3)' }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            transition={{ duration: 0.15 }}
        >
            <div className="flex items-center gap-4">
                <div className="avatar text-white text-[16px] shrink-0 w-10 h-10 flex items-center justify-center rounded-xl"
                    style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                    {getInitials(friendUser?.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-white text-[15px] truncate">{friendUser?.full_name}</h3>
                    <p className="text-xs text-[#94A3B8] mt-0.5">{sharedExpenses.length} individual expenses</p>
                </div>
                <div className="text-right shrink-0">
                    {Math.abs(myNet) < 1 ? (
                        <span className="text-xs font-semibold text-[#94A3B8] bg-white/05 px-2 py-1 rounded-full">Settled</span>
                    ) : myNet > 0 ? (
                        <div>
                            <p className="text-xs text-[#94A3B8]">you get</p>
                            <p className="font-bold text-base amount-positive">{formatAmount(myNet)}</p>
                        </div>
                    ) : (
                        <div>
                            <p className="text-xs text-[#94A3B8]">you owe</p>
                            <p className="font-bold text-base amount-negative">{formatAmount(-myNet)}</p>
                        </div>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

function RecentActivity() {
    const { expenses, getUserById } = useApp()
    const recent = [...expenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5)

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
                            <p className="text-[10px] text-[#94A3B8] mt-0.5">{exp.splits.length} people</p>
                        </div>
                    </motion.div>
                )
            })}
        </div>
    )
}

export default function Dashboard() {
    const navigate = useNavigate()
    const { currentUser, groups, expenses, pendingSettlements, friendships, getUserById, getFriendIdFromFriendship } = useApp()

    // Calculate overall net balance (adjusted for settlements)
    const completedSettlements = (pendingSettlements || []).filter(s => s.status === 'completed')
    const allBalances = calculateNetBalances(expenses, completedSettlements)
    const myNet = allBalances[currentUser?.id] || 0
    const totalOwedToMe = Math.max(0, myNet)
    const totalIOwe = Math.max(0, -myNet)

    const firstName = currentUser?.full_name?.split(' ')[0] || 'there'

    return (
        <div className="page animated-bg">
            {/* Header */}
            <div className="px-5 pt-12 pb-6">
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
                        <p className="text-4xl font-extrabold text-white mb-1">
                            {myNet >= 0 ? '+' : '-'}{formatAmount(Math.abs(myNet))}
                        </p>
                        <p className="text-white/60 text-sm">
                            {myNet >= 0 ? '🟢 Overall you are owed money' : '🔴 Overall you owe money'}
                        </p>
                    </div>
                </motion.div>

                {/* Stat cards */}
                <motion.div
                    className="flex gap-3 mb-8"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                >
                    <StatCard label="You'll receive" amount={totalOwedToMe} positive={true} icon={ArrowDownLeft} />
                    <StatCard label="You owe" amount={totalIOwe} positive={false} icon={ArrowUpRight} />
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
                        className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm glass-bright"
                        whileTap={{ scale: 0.97 }}
                        onClick={() => navigate('/balances')}
                    >
                        <TrendingUp size={18} className="text-green-400" />
                        <span className="text-white">Settle Up</span>
                    </motion.button>
                </motion.div>

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
                    {groups.length === 0 ? (
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

                {/* Friends */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Your Friends</h2>
                        <button
                            className="text-purple-400 text-sm font-semibold flex items-center gap-1"
                            onClick={() => navigate('/friends')}
                        >
                            See all <ArrowUpRight size={14} />
                        </button>
                    </div>
                    {friendships.length === 0 ? (
                        <motion.div
                            className="text-center py-10 rounded-3xl cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
                            onClick={() => navigate('/friends')}
                            whileTap={{ scale: 0.98 }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        >
                            <div className="text-4xl mb-3">👋</div>
                            <p className="text-white font-semibold text-sm mb-1">No friends yet</p>
                            <p className="text-[#475569] text-xs mb-4">Add a friend to split expenses directly</p>
                            <span className="text-xs font-bold px-4 py-2 rounded-full"
                                style={{ background: 'rgba(124,58,237,0.15)', color: '#9D5FF3', border: '1px solid rgba(124,58,237,0.3)' }}>
                                + Add Friend
                            </span>
                        </motion.div>
                    ) : (
                        <div className="space-y-3">
                            {friendships.slice(0, 3).map((friendship, i) => {
                                const friendId = getFriendIdFromFriendship(friendship)
                                const friendUser = getUserById(friendId)
                                if (!friendUser) return null;
                                return (
                                    <motion.div
                                        key={friendship.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                    >
                                        <FriendCard friendUser={friendUser} onClick={() => navigate(`/friends/${friendUser.id}`)} />
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Friends */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-lg font-bold text-white">Your Friends</h2>
                        <button
                            className="text-purple-400 text-sm font-semibold flex items-center gap-1"
                            onClick={() => navigate('/friends')}
                        >
                            See all <ArrowUpRight size={14} />
                        </button>
                    </div>
                    {friendships.length === 0 ? (
                        <motion.div
                            className="text-center py-10 rounded-3xl cursor-pointer"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
                            onClick={() => navigate('/friends')}
                            whileTap={{ scale: 0.98 }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        >
                            <div className="text-4xl mb-3">👋</div>
                            <p className="text-white font-semibold text-sm mb-1">No friends yet</p>
                            <p className="text-[#475569] text-xs mb-4">Add a friend to split expenses directly</p>
                            <span className="text-xs font-bold px-4 py-2 rounded-full"
                                style={{ background: 'rgba(124,58,237,0.15)', color: '#9D5FF3', border: '1px solid rgba(124,58,237,0.3)' }}>
                                + Add Friend
                            </span>
                        </motion.div>
                    ) : (
                        <div className="space-y-3">
                            {friendships.slice(0, 3).map((friendship, i) => {
                                const friendId = getFriendIdFromFriendship(friendship)
                                const friendUser = getUserById(friendId)
                                if (!friendUser) return null;
                                return (
                                    <motion.div
                                        key={friendship.id}
                                        initial={{ opacity: 0, y: 16 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.08 }}
                                    >
                                        <FriendCard friendUser={friendUser} onClick={() => navigate(`/friends/${friendUser.id}`)} />
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Recent activity */}
                <div>
                    <h2 className="text-lg font-bold text-white mb-4">Recent Activity</h2>
                    <RecentActivity />
                </div>
            </div>
        </div>
    )
}
