import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, simplifyDebts, formatAmount, getAvatarColor, getInitials, generateGooglePayLink, generateSettlementId } from '../utils/helpers'
import { CheckCircle, TrendingDown, Loader2 } from 'lucide-react'
import { useState } from 'react'

export default function BalancesPage() {
    const { expenses, groups, getUserById, currentUser, pendingSettlements, createPendingSettlement } = useApp()
    const [loadingPayment, setLoadingPayment] = useState(null)

    // Global balances across ALL groups
    const allBalances = calculateNetBalances(expenses)
    const allTransactions = simplifyDebts(allBalances)

    // My transactions only
    const myTransactions = allTransactions.filter(
        t => t.from === currentUser?.id || t.to === currentUser?.id
    )

    // Overall balance
    const myNet = allBalances[currentUser?.id] || 0

    const GroupBalances = () => (
        <div className="space-y-3">
            {groups.map(group => {
                const groupExpenses = expenses.filter(e => e.group_id === group.id)
                const balances = calculateNetBalances(groupExpenses)
                const myGroupNet = balances[currentUser?.id] || 0
                const transactions = simplifyDebts(balances).filter(
                    t => t.from === currentUser?.id || t.to === currentUser?.id
                )
                if (Math.abs(myGroupNet) < 0.01) return null

                return (
                    <div key={group.id} className="card">
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-xl">{group.emoji}</span>
                            <div className="flex-1">
                                <p className="font-bold text-white text-sm">{group.name}</p>
                                <p className="text-xs text-[#94A3B8]">
                                    {myGroupNet > 0 ? `Others owe you ${formatAmount(myGroupNet)}` : `You owe ${formatAmount(-myGroupNet)}`}
                                </p>
                            </div>
                            <span className="font-extrabold text-base" style={{ color: myGroupNet > 0 ? '#10B981' : '#F43F5E' }}>
                                {myGroupNet > 0 ? '+' : ''}{formatAmount(myGroupNet)}
                            </span>
                        </div>

                        {transactions.map((t, i) => {
                            const fromUser = getUserById(t.from)
                            const toUser = getUserById(t.to)
                            const isMyPayment = t.from === currentUser?.id
                            const key = `${group.id}-${i}`

                            // Find if there's an ongoing or completed settlement for this exact debt
                            const activeSettlement = pendingSettlements.find(s =>
                                s.group_id === group.id &&
                                s.payer_id === t.from &&
                                s.receiver_id === t.to &&
                                Math.abs(Number(s.amount) - t.amount) < 0.01 // Floating point safe match
                            )

                            const isPending = activeSettlement?.status === 'pending'
                            const isCompleted = activeSettlement?.status === 'completed'

                            const handlePay = async () => {
                                if (!toUser?.upi_id) {
                                    alert(`${toUser?.full_name || 'User'} has not added a UPI ID.`)
                                    return
                                }
                                setLoadingPayment(key)
                                try {
                                    const settlementId = generateSettlementId()
                                    // 1. Create the pending tracker in the DB
                                    await createPendingSettlement({
                                        settlementId,
                                        groupId: group.id,
                                        payerId: currentUser.id,
                                        receiverId: toUser.id,
                                        amount: t.amount
                                    })
                                    // 2. Open Google Pay/UPI Intent
                                    const link = generateGooglePayLink({
                                        upiId: toUser.upi_id,
                                        name: toUser.full_name,
                                        amount: t.amount,
                                        note: settlementId, // CRITICAL: Pass the ID into the payment note!
                                    })
                                    window.location.href = link
                                } catch (e) {
                                    console.error("Payment init failed:", e)
                                    alert("Failed to initialize payment. Try again.")
                                } finally {
                                    setLoadingPayment(null)
                                }
                            }

                            return (
                                <div key={i} className="flex items-center gap-3 mt-2 pt-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                                    <div className="flex-1">
                                        <p className="text-sm text-white">
                                            {isMyPayment
                                                ? <>You → <span className="font-bold">{toUser?.full_name?.split(' ')[0]}</span></>
                                                : <><span className="font-bold">{fromUser?.full_name?.split(' ')[0]}</span> → You</>
                                            }
                                        </p>
                                        <p className="text-xs text-[#94A3B8] mt-0.5">{formatAmount(t.amount)}</p>
                                    </div>

                                    {isMyPayment && !isPending && !isCompleted && (
                                        <motion.button
                                            onClick={handlePay}
                                            disabled={loadingPayment === key}
                                            className="pay-btn flex items-center gap-2"
                                            whileTap={{ scale: 0.97 }}
                                        >
                                            {loadingPayment === key ? <Loader2 size={14} className="animate-spin" /> : '💸 Pay'}
                                        </motion.button>
                                    )}

                                    {isMyPayment && isPending && (
                                        <span className="text-xs font-semibold text-[#F59E0B] flex items-center gap-1 bg-[#F59E0B]/10 px-2 py-1.5 rounded-xl border border-[#F59E0B]/20">
                                            <Loader2 size={12} className="animate-spin" /> Verifying...
                                        </span>
                                    )}

                                    {isCompleted && (
                                        <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                                            <CheckCircle size={12} /> Paid
                                        </span>
                                    )}

                                    {!isMyPayment && isPending && (
                                        <span className="text-xs font-semibold text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2 py-1.5 rounded-xl flex items-center gap-1">
                                            <Loader2 size={12} className="animate-spin" /> Paying...
                                        </span>
                                    )}

                                    {!isMyPayment && !isPending && !isCompleted && (
                                        <span className="text-xs font-semibold text-[#94A3B8] bg-white/05 border border-white/05 px-2 py-1.5 rounded-xl">
                                            Awaiting
                                        </span>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )
            })}
        </div>
    )

    return (
        <div className="page animated-bg">
            <div className="px-5 pt-12 pb-6">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
                    <h1 className="text-2xl font-extrabold text-white">Settle Up</h1>
                    <p className="text-[#94A3B8] text-sm mt-1">All your dues across every group</p>
                </motion.div>

                {/* Summary banner */}
                <motion.div
                    className="rounded-3xl p-5 mb-6 relative overflow-hidden"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    style={{
                        background: myNet >= 0
                            ? 'linear-gradient(135deg, rgba(16,185,129,0.2), rgba(6,182,212,0.15))'
                            : 'linear-gradient(135deg, rgba(244,63,94,0.2), rgba(245,158,11,0.1))',
                        border: `1px solid ${myNet >= 0 ? 'rgba(16,185,129,0.3)' : 'rgba(244,63,94,0.3)'}`,
                    }}
                >
                    <div className="flex items-center gap-3">
                        <TrendingDown size={28} style={{ color: myNet >= 0 ? '#10B981' : '#F43F5E' }} />
                        <div>
                            <p className="text-[#94A3B8] text-sm">Overall Net Balance</p>
                            <p className="text-3xl font-extrabold" style={{ color: myNet >= 0 ? '#10B981' : '#F43F5E' }}>
                                {myNet >= 0 ? '+' : ''}{formatAmount(myNet)}
                            </p>
                            <p className="text-xs text-[#94A3B8] mt-1">
                                {myNet > 0 ? '🟢 People owe you this across all groups'
                                    : myNet < 0 ? '🔴 You owe this across all groups'
                                        : '✅ You\'re fully settled up!'}
                            </p>
                        </div>
                    </div>
                </motion.div>

                {/* Transactions */}
                {myTransactions.length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4 float">🎉</div>
                        <h2 className="text-xl font-bold text-white mb-2">All settled up!</h2>
                        <p className="text-[#94A3B8] text-sm">No pending dues. You're all clear!</p>
                    </div>
                ) : (
                    <>
                        <h2 className="text-base font-bold text-white mb-4">Pending settlements by group</h2>
                        <GroupBalances />
                    </>
                )}
            </div>
        </div>
    )
}
