import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Zap, Copy, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, simplifyDebts, formatAmount, getAvatarColor, getInitials } from '../utils/helpers'
import PullToRefresh from '../components/PullToRefresh'

export default function SimplifyDebtsPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { getGroupById, getExpensesByGroup, getUserById, currentUser, pendingSettlements, sponsorships, loadSponsorships, manualRefresh } = useApp()

    const group = getGroupById(id)
    const expenses = getExpensesByGroup(id)

    useEffect(() => {
        if (id) loadSponsorships(id)
    }, [id])

    if (!group) {
        navigate('/', { replace: true })
        return null
    }

    const groupCompletedSettlements = (pendingSettlements || []).filter(s => s.group_id === id && s.status === 'completed')
    const groupSponsorships = (sponsorships || []).filter(s => s.group_id === id)
    const balances = calculateNetBalances(expenses, groupCompletedSettlements, groupSponsorships)
    const transactions = simplifyDebts(balances)

    const allSettled = transactions.length === 0

    return (
        <PullToRefresh onRefresh={manualRefresh}>
            <div className="page animated-bg">
                <div className="px-5 pt-10 pb-28">
                    {/* Header */}
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
                            <Zap size={20} className="text-purple-400" />
                            <h1 className="text-xl font-extrabold text-white truncate">Simplify Debts</h1>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                            {group.emoji} {group.name}
                        </p>
                    </div>
                </div>

                {/* Summary card */}
                <motion.div className="card mb-5"
                    style={{
                        background: allSettled ? 'rgba(16,185,129,0.06)' : 'rgba(124,58,237,0.06)',
                        borderColor: allSettled ? 'rgba(16,185,129,0.2)' : 'rgba(124,58,237,0.2)'
                    }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                >
                    {allSettled ? (
                        <div className="text-center py-4">
                            <div className="text-4xl mb-2">🎉</div>
                            <p className="text-lg font-extrabold text-green-400">All Settled Up!</p>
                            <p className="text-xs text-[#94A3B8] mt-1">No pending debts in this group</p>
                        </div>
                    ) : (
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[#94A3B8] text-xs font-medium mb-1">Settlements Needed</p>
                                <p className="text-2xl font-extrabold gradient-text">{transactions.length}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-[#94A3B8] text-xs font-medium mb-1">Total to Transfer</p>
                                <p className="text-2xl font-extrabold text-white">
                                    {formatAmount(transactions.reduce((s, t) => s + t.amount, 0))}
                                </p>
                            </div>
                        </div>
                    )}
                </motion.div>

                {/* Description */}
                {!allSettled && (
                    <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-4">
                        ⚡ Minimum settlements to clear all debts
                    </p>
                )}

                {/* Transactions */}
                <div className="space-y-3">
                    {transactions.map((t, i) => {
                        const fromUser = getUserById(t.from)
                        const toUser = getUserById(t.to)
                        const isMe = t.from === currentUser?.id

                        const pairSettled = (pendingSettlements || [])
                            .filter(s => s.group_id === group.id && s.payer_id === t.from && s.receiver_id === t.to && s.status === 'completed')
                            .reduce((sum, s) => sum + Number(s.amount), 0)

                        return (
                            <motion.div key={i}
                                className="card"
                                style={{
                                    background: isMe ? 'rgba(244,63,94,0.07)' : undefined,
                                    borderColor: isMe ? 'rgba(244,63,94,0.2)' : undefined,
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
            </div>
            </div>
        </PullToRefresh>
    )
}
