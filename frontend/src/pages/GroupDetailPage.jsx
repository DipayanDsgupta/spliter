import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Users, Zap, Copy, Trash2, CheckCircle, MessageCircle, Shield, TrendingUp, Pencil, Gift } from 'lucide-react'
import toast from 'react-hot-toast'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, simplifyDebts, formatAmount, getAvatarColor, getInitials, formatDate, formatTime, CATEGORIES } from '../utils/helpers'
import PullToRefresh from '../components/PullToRefresh'

function MemberBalance({ userId, net }) {
    const { getUserById, currentUser } = useApp()
    const user = getUserById(userId)
    const isMe = userId === currentUser?.id
    const [c1, c2] = getAvatarColor(user?.full_name || '')

    return (
        <div className="flex items-center gap-3 py-2.5">
            <div className="avatar text-white text-xs shrink-0" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                {getInitials(user?.full_name)}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-semibold truncate">
                    {isMe ? 'You' : user?.full_name?.split(' ')[0]}
                </p>
            </div>
            <div className="text-right shrink-0">
                {Math.abs(net) < 1 ? (
                    <span className="text-xs font-semibold text-[#10B981] bg-green-500/10 px-2 py-1 rounded-full">✓ Settled</span>
                ) : net > 0 ? (
                    <span className="text-sm font-bold amount-positive">+{formatAmount(net)}</span>
                ) : (
                    <span className="text-sm font-bold amount-negative">-{formatAmount(-net)}</span>
                )}
            </div>
        </div>
    )
}



export default function GroupDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { getGroupById, getExpensesByGroup, getUserById, currentUser, deleteGroup, deleteExpense, removeMember, pendingSettlements, transferAdmin, sponsorships, loadSponsorships, manualRefresh } = useApp()

    const group = getGroupById(id)
    const expenses = getExpensesByGroup(id)
    const [activeTab, setActiveTab] = useState('expenses')
    const [showTransfer, setShowTransfer] = useState(false)
    const [transferring, setTransferring] = useState(false)

    useEffect(() => {
        if (!group) {
            navigate('/', { replace: true })
        }
    }, [group, navigate])

    useEffect(() => {
        if (id) loadSponsorships(id)
    }, [id])

    if (!group) return null // returning null avoids flashy flashes while it redirects

    const groupCompletedSettlements = (pendingSettlements || []).filter(s => s.group_id === id && s.status === 'completed')
    const groupSponsorships = (sponsorships || []).filter(s => s.group_id === id)
    const balances = calculateNetBalances(expenses, groupCompletedSettlements, groupSponsorships)
    const transactions = simplifyDebts(balances)
    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

    const combinedActivity = [
        ...expenses.map(e => ({ ...e, type: 'expense' })),
        ...groupCompletedSettlements.map(s => ({ ...s, type: 'settlement' }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return (
        <PullToRefresh onRefresh={manualRefresh}>
            <div className="page animated-bg">
                {/* Header */}
            <div className="px-5 pt-10 pb-5">
                <div className="flex items-center gap-4 mb-6">
                    <motion.button
                        className="w-10 h-10 rounded-2xl glass flex items-center justify-center"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={18} className="text-white" />
                    </motion.button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">{group.emoji}</span>
                            <h1 className="text-xl font-extrabold text-white truncate">{group.name}</h1>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                            {group.members.length} members · ID: <span className="font-mono text-white select-all">{group.id.slice(0, 15)}...</span>
                        </p>
                        <button onClick={() => { navigator.clipboard.writeText(group.id); toast.success('Group ID copied! Share this with your friends to join.'); }}
                            className="text-[10px] uppercase font-bold text-purple-400 flex items-center gap-1 mt-1 hover:text-purple-300">
                            <Copy size={10} /> Copy ID to invite
                        </button>
                    </div>
                    <motion.button
                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate(`/add-expense?group=${id}`)}
                    >
                        <Plus size={18} className="text-white" />
                    </motion.button>
                </div>

                {/* Total spent card */}
                <div className="card mb-5" style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.2)' }}>
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[#94A3B8] text-xs font-medium mb-1">Total Group Spend</p>
                            <p className="text-2xl font-extrabold gradient-text">{formatAmount(totalSpent)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[#94A3B8] text-xs font-medium mb-1">Transactions</p>
                            <p className="text-2xl font-extrabold text-white">{expenses.length}</p>
                        </div>
                    </div>
                </div>

                {/* Group Chat button */}
                <motion.button
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-3"
                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60A5FA' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/chat/${id}`)}
                >
                    <MessageCircle size={16} /> Group Chat
                </motion.button>

                {/* Spendings button */}
                <motion.button
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-3"
                    style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: '#34D399' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/groups/${id}/spendings`)}
                >
                    <TrendingUp size={16} /> Spendings
                </motion.button>

                {/* "Simplify Debts" button → navigates to separate page */}
                <motion.button
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-5"
                    style={{ background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.2))', border: '1px solid rgba(124,58,237,0.4)' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/groups/${id}/settle`)}
                >
                    <Zap size={16} style={{ color: '#9D5FF3' }} />
                    <span style={{ color: '#9D5FF3' }}>
                        {transactions.length > 0 ? `${transactions.length} settlements needed` : 'All settled ✓'}
                    </span>
                </motion.button>

                {/* Tabs */}
                <div className="flex gap-2 mb-5">
                    {['expenses', 'balances', 'members'].map(tab => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className="flex-1 py-3 rounded-xl font-semibold text-sm capitalize transition-all"
                            style={{
                                background: activeTab === tab ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.04)',
                                border: `1px solid ${activeTab === tab ? 'rgba(124,58,237,0.5)' : 'rgba(255,255,255,0.07)'}`,
                                color: activeTab === tab ? '#9D5FF3' : '#94A3B8',
                            }}
                        >
                            {tab}
                        </button>
                    ))}
                </div>

                {/* Expenses tab */}
                {activeTab === 'expenses' && (
                    <div className="space-y-3">
                        {combinedActivity.length === 0 && (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-3">📝</div>
                                <p className="text-white font-semibold">No activity yet</p>
                                <p className="text-[#94A3B8] text-sm">Tap + to add the first expense</p>
                            </div>
                        )}
                        {combinedActivity.map((activity, i) => {
                            if (activity.type === 'settlement') {
                                const payer = getUserById(activity.payer_id)
                                const receiver = getUserById(activity.receiver_id)
                                const isMePayer = activity.payer_id === currentUser?.id
                                const verb = isMePayer ? 'You paid' : `${payer?.full_name?.split(' ')[0]} paid`
                                const target = activity.receiver_id === currentUser?.id ? 'you' : receiver?.full_name?.split(' ')[0]

                                return (
                                    <motion.div
                                        key={`settlement-${activity.id}`}
                                        className="card bg-green-900/10 border border-green-500/20"
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mt-0.5 shrink-0 bg-green-500/20 text-green-400">
                                                💸
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-bold text-white text-sm">
                                                    {verb} {target}
                                                </p>
                                                <p className="text-[10px] text-[#94A3B8] mt-0.5">
                                                    Debt settled · {formatDate(activity.created_at)} at {formatTime(activity.created_at)}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="font-extrabold text-green-400 text-sm">
                                                    {isMePayer ? '-' : '+'}{formatAmount(activity.amount)}
                                                </p>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            }

                            const exp = activity
                            const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[7]
                            const payers = exp.paid_by.map(p => getUserById(p.user_id)?.full_name?.split(' ')[0]).join(', ')
                            const splitAmong = exp.splits.map(s => getUserById(s.user_id)?.full_name?.split(' ')[0]).join(', ')
                            const myShare = exp.splits.find(s => s.user_id === currentUser?.id)?.amount_owed || 0

                            return (
                                <motion.div
                                    key={exp.id}
                                    className="card"
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                >
                                    <div className="flex items-start gap-3">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg mt-0.5 shrink-0"
                                            style={{ background: `${cat.color}18`, border: `1px solid ${cat.color}30` }}
                                        >
                                            {cat.emoji}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-white text-sm">{exp.title}</p>
                                            <p className="text-xs text-[#94A3B8] mt-0.5">
                                                Paid by {payers} · {formatDate(exp.created_at)} at {formatTime(exp.created_at)}
                                            </p>
                                            <p className="text-[10px] text-[#64748B] mt-0.5 leading-tight">
                                                For: {splitAmong}
                                            </p>
                                            {exp.note && (
                                                <p className="text-xs text-[#475569] mt-1 italic">"{exp.note}"</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0 flex flex-col items-end">
                                            <p className="font-extrabold text-white text-sm">{formatAmount(exp.amount)}</p>
                                            <p className="text-[10px] text-[#94A3B8] mt-0.5">
                                                your share: <span className="text-[#F43F5E] font-semibold">{formatAmount(myShare)}</span>
                                            </p>
                                            {(currentUser?.id === group.created_by) && (
                                                <div className="flex items-center gap-1 mt-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); navigate(`/edit-expense/${exp.id}`) }}
                                                        className="text-[#94A3B8] hover:text-blue-400 p-1"
                                                        title="Edit Expense"
                                                    >
                                                        <Pencil size={13} />
                                                    </button>
                                                    <button
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (window.confirm("Delete this expense?")) {
                                                                await deleteExpense(exp.id);
                                                                toast.success('Expense deleted');
                                                            }
                                                        }}
                                                        className="text-[#94A3B8] hover:text-red-400 p-1"
                                                        title="Delete Expense"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Payer breakdown */}
                                    {exp.paid_by.length > 1 && (
                                        <div className="mt-3 pt-3 border-t border-white/05">
                                            <p className="text-[10px] text-[#475569] uppercase tracking-wider mb-2">Multiple payers</p>
                                            <div className="flex flex-wrap gap-2">
                                                {exp.paid_by.map(p => {
                                                    const u = getUserById(p.user_id)
                                                    return (
                                                        <span key={p.user_id} className="text-[11px] font-semibold px-2 py-1 rounded-full"
                                                            style={{ background: 'rgba(124,58,237,0.15)', color: '#9D5FF3', border: '1px solid rgba(124,58,237,0.25)' }}>
                                                            {u?.full_name?.split(' ')[0]}: {formatAmount(p.amount_paid)}
                                                        </span>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )
                        })}
                    </div>
                )}

                {/* Balances tab */}
                {activeTab === 'balances' && (
                    <div className="card">
                        <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-4">Net Balance per Member</p>
                        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            {group.members.map(mid => (
                                <MemberBalance key={mid} userId={mid} net={balances[mid] || 0} />
                            ))}
                        </div>
                    </div>
                )}

                {/* Members tab */}
                {activeTab === 'members' && (
                    <div className="space-y-3">
                        <div className="card">
                            <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-4">👥 Group Members</p>
                            <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                {group.members.map(mid => {
                                    const user = getUserById(mid)
                                    const isMe = mid === currentUser?.id
                                    const isAdmin = mid === group.created_by
                                    const iAmAdmin = currentUser?.id === group.created_by
                                    const [c1, c2] = getAvatarColor(user?.full_name || '')

                                    return (
                                        <div key={mid} className="flex items-center gap-3 py-3">
                                            <div className="avatar text-white text-xs shrink-0" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                                {getInitials(user?.full_name)}
                                            </div>
                                            <div className="flex-1 min-w-0 flex items-center gap-2">
                                                <p className="text-white text-sm font-semibold truncate">
                                                    {isMe ? 'You' : user?.full_name}
                                                </p>
                                                {isAdmin && (
                                                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)' }}>
                                                        Admin
                                                    </span>
                                                )}
                                            </div>
                                            {iAmAdmin && !isMe && (
                                                <button onClick={async () => {
                                                    if (!window.confirm(`Remove ${user?.full_name} from the group?`)) return;
                                                    await removeMember(group.id, mid);
                                                    toast.success('Member removed');
                                                }} className="p-1.5 rounded-lg hover:bg-white/5" title="Remove Member">
                                                    <Trash2 size={14} className="text-red-400" />
                                                </button>
                                            )}
                                            {!isMe && (
                                                <button onClick={() => navigate(`/groups/${id}/sponsor?member=${mid}`)}
                                                    className="p-1.5 rounded-lg hover:bg-amber-500/10" title="Sponsor">
                                                    <Gift size={14} className="text-amber-400" />
                                                </button>
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                        </div>

                        {/* Admin controls */}
                        {currentUser?.id === group.created_by && (
                            <div className="space-y-3">
                                <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider">🛡️ Admin Controls</p>
                                <button
                                    onClick={() => setShowTransfer(true)}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-purple-500/30 text-purple-400 font-bold hover:bg-purple-500/10 transition-colors bg-purple-500/5"
                                >
                                    <Shield size={16} /> Transfer Admin
                                </button>
                                <button
                                    onClick={async () => {
                                        if (window.confirm(`Are you sure you want to delete "${group.name}"? This will permanently delete the group and ALL its expenses.`)) {
                                            await deleteGroup(group.id);
                                            toast.success('Group deleted permanently');
                                            navigate('/');
                                        }
                                    }}
                                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border border-red-500/30 text-red-500 font-bold hover:bg-red-500/10 transition-colors bg-red-500/5 shadow-lg shadow-red-500/5"
                                >
                                    <Trash2 size={16} /> Delete Entire Group
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Transfer Admin Modal */}
                <AnimatePresence>
                    {showTransfer && (
                        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setShowTransfer(false)} />
                            <motion.div className="relative w-full max-w-sm z-10 p-6 rounded-3xl"
                                style={{ background: '#141428', border: '1px solid rgba(255,255,255,0.10)' }}
                                initial={{ y: 50, scale: 0.95, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
                                exit={{ y: 20, scale: 0.95, opacity: 0 }}>
                                <div className="flex justify-between items-center mb-5">
                                    <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                                        <Shield size={18} className="text-purple-400" /> Transfer Admin
                                    </h2>
                                    <button onClick={() => setShowTransfer(false)} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                                        <span className="text-[#94A3B8] text-sm">✕</span>
                                    </button>
                                </div>
                                <p className="text-xs text-[#94A3B8] mb-4">Select a member to make the new admin. You will lose admin privileges.</p>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {group.members.filter(mid => mid !== currentUser?.id).map(mid => {
                                        const user = getUserById(mid)
                                        const [c1, c2] = getAvatarColor(user?.full_name || '')
                                        return (
                                            <motion.button key={mid}
                                                onClick={async () => {
                                                    if (!window.confirm(`Transfer admin to ${user?.full_name}? You will no longer be the admin.`)) return
                                                    setTransferring(true)
                                                    try {
                                                        await transferAdmin(group.id, mid)
                                                        toast.success(`${user?.full_name} is now the admin! 👑`)
                                                        setShowTransfer(false)
                                                    } catch (e) {
                                                        toast.error('Failed to transfer admin')
                                                    } finally {
                                                        setTransferring(false)
                                                    }
                                                }}
                                                disabled={transferring}
                                                className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                                                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
                                                whileHover={{ borderColor: 'rgba(124,58,237,0.4)' }}
                                                whileTap={{ scale: 0.97 }}
                                            >
                                                <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                                    style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                                    {getInitials(user?.full_name)}
                                                </div>
                                                <div className="flex-1 text-left">
                                                    <p className="text-white text-sm font-medium">{user?.full_name}</p>
                                                </div>
                                                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg"
                                                    style={{ background: 'rgba(124,58,237,0.15)', color: '#9D5FF3', border: '1px solid rgba(124,58,237,0.3)' }}>
                                                    Make Admin
                                                </span>
                                            </motion.button>
                                        )
                                    })}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
            </div>
        </PullToRefresh>
    )
}
