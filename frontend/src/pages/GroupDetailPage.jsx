import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Users, Zap, ChevronDown, ChevronUp, Copy, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, simplifyDebts, formatAmount, getAvatarColor, getInitials, formatDate, CATEGORIES, generateGooglePayLink } from '../utils/helpers'

function MemberBalance({ userId, net, group }) {
    const { getUserById, currentUser, removeMember } = useApp()
    const user = getUserById(userId)
    const isMe = userId === currentUser?.id
    const isAdmin = userId === group?.created_by
    const iAmAdmin = currentUser?.id === group?.created_by
    const [c1, c2] = getAvatarColor(user?.full_name || '')

    const handleRemove = async () => {
        if (!window.confirm(`Remove ${user?.full_name} from the group?`)) return;
        await removeMember(group.id, userId);
        toast.success('Member removed');
    }

    return (
        <div className="flex items-center gap-3 py-2.5">
            <div className="avatar text-white text-xs shrink-0" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                {getInitials(user?.full_name)}
            </div>
            <div className="flex-1 min-w-0 flex items-center gap-2">
                <p className="text-white text-sm font-semibold truncate">
                    {isMe ? 'You' : user?.full_name?.split(' ')[0]}
                </p>
                {isAdmin && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                        style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA', border: '1px solid rgba(59,130,246,0.3)' }}>
                        Admin
                    </span>
                )}
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

            {iAmAdmin && !isMe && Math.abs(net) < 1 && (
                <button onClick={handleRemove} className="p-1.5 rounded-lg ml-1 hover:bg-white/5" title="Remove Member">
                    <Trash2 size={14} className="text-red-400" />
                </button>
            )}
        </div>
    )
}

function SettleTransactions({ transactions, group }) {
    const { getUserById, currentUser } = useApp()
    const [paid, setPaid] = useState({})

    return (
        <div className="space-y-3">
            {transactions.map((t, i) => {
                const fromUser = getUserById(t.from)
                const toUser = getUserById(t.to)
                const isMe = t.from === currentUser?.id
                const isPaid = paid[i]

                const payLink = generateGooglePayLink({
                    upiId: toUser?.upi_id,
                    name: toUser?.full_name,
                    amount: t.amount,
                    note: `${group?.name} Settlement`,
                })

                return (
                    <motion.div
                        key={i}
                        className="p-4 rounded-2xl"
                        style={{
                            background: isMe ? 'rgba(244,63,94,0.07)' : 'rgba(255,255,255,0.03)',
                            border: `1px solid ${isMe ? 'rgba(244,63,94,0.2)' : 'rgba(255,255,255,0.07)'}`,
                        }}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.07 }}
                    >
                        <div className="flex items-center gap-3">
                            {/* From */}
                            <div className="text-center">
                                <div className="avatar text-white text-[10px] mx-auto mb-1"
                                    style={{ background: `linear-gradient(135deg, ${getAvatarColor(fromUser?.full_name)[0]}, ${getAvatarColor(fromUser?.full_name)[1]})` }}>
                                    {getInitials(fromUser?.full_name)}
                                </div>
                                <p className="text-[10px] text-[#94A3B8]">{isMe ? 'You' : fromUser?.full_name?.split(' ')[0]}</p>
                            </div>

                            {/* Arrow + Amount */}
                            <div className="flex-1 text-center">
                                <p className="font-extrabold text-white text-base">{formatAmount(t.amount)}</p>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-purple-500/50" />
                                    <span className="text-purple-400 text-xs">→</span>
                                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-purple-500/50" />
                                </div>
                            </div>

                            {/* To */}
                            <div className="text-center">
                                <div className="avatar text-white text-[10px] mx-auto mb-1"
                                    style={{ background: `linear-gradient(135deg, ${getAvatarColor(toUser?.full_name)[0]}, ${getAvatarColor(toUser?.full_name)[1]})` }}>
                                    {getInitials(toUser?.full_name)}
                                </div>
                                <p className="text-[10px] text-[#94A3B8]">{toUser?.full_name?.split(' ')[0]}</p>
                            </div>
                        </div>

                        {/* Pay button (only if it's you who owes) */}
                        {isMe && !isPaid && (
                            <motion.a
                                href={payLink}
                                className="pay-btn w-full mt-3 justify-center"
                                style={{ textDecoration: 'none' }}
                                onClick={() => {
                                    setTimeout(() => {
                                        if (window.confirm(`Mark ₹${t.amount} as paid to ${toUser?.full_name}?`)) {
                                            setPaid(prev => ({ ...prev, [i]: true }))
                                        }
                                    }, 500)
                                }}
                                whileHover={{ y: -1 }}
                                whileTap={{ scale: 0.97 }}
                            >
                                <span>💸</span>
                                Pay via Google Pay
                            </motion.a>
                        )}

                        {isPaid && (
                            <div className="mt-3 text-center text-xs font-semibold text-green-400">
                                ✓ Marked as paid
                            </div>
                        )}
                    </motion.div>
                )
            })}
        </div>
    )
}

export default function GroupDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { getGroupById, getExpensesByGroup, getUserById, currentUser } = useApp()

    const group = getGroupById(id)
    const expenses = getExpensesByGroup(id)
    const [showSimplified, setShowSimplified] = useState(false)
    const [activeTab, setActiveTab] = useState('expenses') // 'expenses' | 'balances'

    if (!group) return (
        <div className="flex items-center justify-center min-h-dvh">
            <p className="text-[#94A3B8]">Group not found</p>
        </div>
    )

    const balances = calculateNetBalances(expenses)
    const transactions = simplifyDebts(balances)
    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

    return (
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

                {/* "Simplify Debts" button */}
                <motion.button
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-5"
                    style={{
                        background: showSimplified
                            ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.2))'
                            : 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(59,130,246,0.2))',
                        border: `1px solid ${showSimplified ? 'rgba(16,185,129,0.4)' : 'rgba(124,58,237,0.4)'}`,
                    }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setShowSimplified(!showSimplified)}
                >
                    <Zap size={16} style={{ color: showSimplified ? '#10B981' : '#9D5FF3' }} />
                    <span style={{ color: showSimplified ? '#10B981' : '#9D5FF3' }}>
                        {showSimplified ? `${transactions.length} settlements needed` : 'Simplify Debts ⚡'}
                    </span>
                    {showSimplified ? <ChevronUp size={14} className="text-green-400" /> : <ChevronDown size={14} className="text-purple-400" />}
                </motion.button>

                {/* Simplified transactions */}
                <AnimatePresence>
                    {showSimplified && (
                        <motion.div
                            className="mb-5"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.3 }}
                        >
                            <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">
                                Minimum settlements to clear all debts
                            </p>
                            <SettleTransactions transactions={transactions} group={group} />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Tabs */}
                <div className="flex gap-2 mb-5">
                    {['expenses', 'balances'].map(tab => (
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
                        {expenses.length === 0 && (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-3">📝</div>
                                <p className="text-white font-semibold">No expenses yet</p>
                                <p className="text-[#94A3B8] text-sm">Tap + to add the first expense</p>
                            </div>
                        )}
                        {[...expenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((exp, i) => {
                            const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[7]
                            const payers = exp.paid_by.map(p => getUserById(p.user_id)?.full_name?.split(' ')[0]).join(', ')
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
                                                Paid by {payers} · {formatDate(exp.created_at)}
                                            </p>
                                            {exp.note && (
                                                <p className="text-xs text-[#475569] mt-0.5 italic">"{exp.note}"</p>
                                            )}
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="font-extrabold text-white text-sm">{formatAmount(exp.amount)}</p>
                                            <p className="text-[10px] text-[#94A3B8] mt-0.5">
                                                your share: <span className="text-[#F43F5E] font-semibold">{formatAmount(myShare)}</span>
                                            </p>
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
                                <MemberBalance key={mid} userId={mid} net={balances[mid] || 0} group={group} />
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
