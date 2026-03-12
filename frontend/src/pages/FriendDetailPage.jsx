import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Plus, Zap, ChevronDown, ChevronUp, Copy, Trash2, CheckCircle, MessageCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, simplifyDebts, formatAmount, getAvatarColor, getInitials, formatDate, formatTime, CATEGORIES } from '../utils/helpers'

function SettleTransactions({ transactions }) {
    const { getUserById, currentUser, pendingSettlements } = useApp()

    return (
        <div className="space-y-3">
            {transactions.map((t, i) => {
                const fromUser = getUserById(t.from)
                const toUser = getUserById(t.to)
                const isMe = t.from === currentUser?.id

                // Check for settlements on this pair
                const pairSettled = pendingSettlements
                    .filter(s => !s.group_id && s.payer_id === t.from && s.receiver_id === t.to && s.status === 'completed')
                    .reduce((sum, s) => sum + Number(s.amount), 0)

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
                            <div className="text-center">
                                <div className="avatar text-white text-[10px] mx-auto mb-1"
                                    style={{ background: `linear-gradient(135deg, ${getAvatarColor(fromUser?.full_name)[0]}, ${getAvatarColor(fromUser?.full_name)[1]})` }}>
                                    {getInitials(fromUser?.full_name)}
                                </div>
                                <p className="text-[10px] text-[#94A3B8]">{isMe ? 'You' : fromUser?.full_name?.split(' ')[0]}</p>
                            </div>
                            <div className="flex-1 text-center">
                                <p className="font-extrabold text-white text-base">{formatAmount(t.amount)}</p>
                                <div className="flex items-center justify-center gap-1 mt-1">
                                    <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent to-purple-500/50" />
                                    <span className="text-purple-400 text-xs">→</span>
                                    <div className="h-[1px] flex-1 bg-gradient-to-l from-transparent to-purple-500/50" />
                                </div>
                                {pairSettled > 0 && (
                                    <p className="text-[10px] text-green-400/70 mt-1 flex items-center justify-center gap-0.5">
                                        <CheckCircle size={9} /> {formatAmount(pairSettled)} already settled
                                    </p>
                                )}
                            </div>
                            <div className="text-center">
                                <div className="avatar text-white text-[10px] mx-auto mb-1"
                                    style={{ background: `linear-gradient(135deg, ${getAvatarColor(toUser?.full_name)[0]}, ${getAvatarColor(toUser?.full_name)[1]})` }}>
                                    {getInitials(toUser?.full_name)}
                                </div>
                                <p className="text-[10px] text-[#94A3B8]">{toUser?.full_name?.split(' ')[0]}</p>
                            </div>
                        </div>

                        {/* Copy UPI + settle hint */}
                        {isMe && toUser?.upi_id && (
                            <motion.button
                                className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-colors"
                                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#A78BFA' }}
                                onClick={() => { navigator.clipboard.writeText(toUser.upi_id); toast.success(`UPI ID copied: ${toUser.upi_id}`) }}
                                whileTap={{ scale: 0.97 }}
                            >
                                <Copy size={12} /> Copy UPI: {toUser.upi_id}
                            </motion.button>
                        )}
                        {isMe && (
                            <p className="text-[10px] text-[#64748B] text-center mt-2">Go to Settle Up tab to mark as paid</p>
                        )}
                    </motion.div>
                )
            })}
        </div>
    )
}

export default function FriendDetailPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { getUserById, expenses, currentUser, deleteExpense, pendingSettlements, friendships } = useApp()

    const friend = getUserById(id)
    const friendship = friendships.find(f => 
        (f.user_a_id === currentUser?.id && f.user_b_id === id) || 
        (f.user_a_id === id && f.user_b_id === currentUser?.id)
    )

    const [showSimplified, setShowSimplified] = useState(false)
    const [activeTab, setActiveTab] = useState('expenses') // 'expenses' | 'balances'

    useEffect(() => {
        if (!friend) {
            navigate('/', { replace: true })
        }
    }, [friend, navigate])

    if (!friend) return null

    // Filter to expenses involving just these two users with NO group_id
    const sharedExpenses = expenses.filter(e => 
        !e.group_id && 
        e.expense_splits?.some(s => s.user_id === currentUser?.id) &&
        e.expense_splits?.some(s => s.user_id === id)
    )
    
    // Filter to settlements between these two users with NO group_id
    const sharedSettlements = (pendingSettlements || []).filter(s => 
        !s.group_id && s.status === 'completed' &&
        ((s.payer_id === currentUser?.id && s.receiver_id === id) || 
         (s.payer_id === id && s.receiver_id === currentUser?.id))
    )

    const balances = calculateNetBalances(sharedExpenses, sharedSettlements)
    const transactions = simplifyDebts(balances)
    const totalSpent = sharedExpenses.reduce((s, e) => s + e.amount, 0)
    
    // Total net balance for Current User
    const myNetBalance = balances[currentUser?.id] || 0

    return (
        <div className="page animated-bg">
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
                            <span className="text-2xl">👤</span>
                            <h1 className="text-xl font-extrabold text-white truncate">{friend.full_name}</h1>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                            Individual Shared Expenses
                        </p>
                    </div>
                    <motion.button
                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate(`/add-expense?friend=${id}`)}
                    >
                        <Plus size={18} className="text-white" />
                    </motion.button>
                </div>

                {/* Net Balance & Spend Card */}
                <div className="card mb-5 flex flex-col items-center py-6" style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.2)' }}>
                    <p className="text-[#94A3B8] text-xs font-medium mb-1">Your Net Balance</p>
                    {Math.abs(myNetBalance) < 1 ? (
                        <p className="text-2xl font-extrabold text-[#10B981]">Settled Up ✅</p>
                    ) : myNetBalance > 0 ? (
                        <p className="text-2xl font-extrabold text-[#10B981]">Gets back {formatAmount(myNetBalance)}</p>
                    ) : (
                        <p className="text-2xl font-extrabold text-[#F43F5E]">Owes {formatAmount(-myNetBalance)}</p>
                    )}

                    <div className="w-full mt-5 flex divide-x divide-white/10 border-t border-white/10 pt-4">
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Total spend</p>
                            <p className="font-bold text-white">{formatAmount(totalSpent)}</p>
                        </div>
                        <div className="flex-1 text-center">
                            <p className="text-[10px] text-[#94A3B8] uppercase tracking-wider mb-1">Expenses</p>
                            <p className="font-bold text-white">{sharedExpenses.length}</p>
                        </div>
                    </div>
                </div>

                {/* Friend Chat button */}
                <motion.button
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-3"
                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60A5FA' }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/chat?friendship=${friendship?.id}`)}
                >
                    <MessageCircle size={16} /> Open Chat
                </motion.button>

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
                        {showSimplified ? `${transactions.length} settlements needed` : 'View Settlement ⚡'}
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
                            <SettleTransactions transactions={transactions} />
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
                        {sharedExpenses.length === 0 && (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-3">📝</div>
                                <p className="text-white font-semibold">No shared expenses yet</p>
                                <p className="text-[#94A3B8] text-sm">Tap + to add a shared individual expense</p>
                            </div>
                        )}
                        {[...sharedExpenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((exp, i) => {
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
                                            {(exp.created_by === currentUser?.id) && (
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (window.confirm("Delete this individual expense?")) {
                                                            await deleteExpense(exp.id);
                                                            toast.success('Expense deleted');
                                                        }
                                                    }}
                                                    className="mt-2 text-[#94A3B8] hover:text-red-400 p-1"
                                                    title="Delete Expense"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {/* Payer breakdown */}
                                    {exp.paid_by.length > 1 && (
                                        <div className="mt-3 pt-3 border-t border-white/05">
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
                        <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-4">Balance Breakdown</p>
                        <div className="divide-y" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                            <div className="flex items-center gap-3 py-2.5">
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <p className="text-white text-sm font-semibold truncate">You</p>
                                </div>
                                <div className="text-right shrink-0">
                                    {Math.abs(balances[currentUser?.id]) < 1 ? (
                                        <span className="text-xs font-semibold text-[#10B981] bg-green-500/10 px-2 py-1 rounded-full">✓ Settled</span>
                                    ) : balances[currentUser?.id] > 0 ? (
                                        <span className="text-sm font-bold amount-positive">+{formatAmount(balances[currentUser?.id] || 0)}</span>
                                    ) : (
                                        <span className="text-sm font-bold amount-negative">-{formatAmount(-(balances[currentUser?.id] || 0))}</span>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3 py-2.5">
                                <div className="flex-1 min-w-0 flex items-center gap-2">
                                    <p className="text-white text-sm font-semibold truncate">{friend.full_name}</p>
                                </div>
                                <div className="text-right shrink-0">
                                    {Math.abs(balances[friend.id]) < 1 ? (
                                        <span className="text-xs font-semibold text-[#10B981] bg-green-500/10 px-2 py-1 rounded-full">✓ Settled</span>
                                    ) : balances[friend.id] > 0 ? (
                                        <span className="text-sm font-bold amount-positive">+{formatAmount(balances[friend.id] || 0)}</span>
                                    ) : (
                                        <span className="text-sm font-bold amount-negative">-{formatAmount(-(balances[friend.id] || 0))}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
