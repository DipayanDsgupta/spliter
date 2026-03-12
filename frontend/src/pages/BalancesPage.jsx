import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, simplifyDebts, formatAmount, generateGooglePayLink, generateSettlementId } from '../utils/helpers'
import { CheckCircle, TrendingDown, Loader2, X, Check, Clock } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function BalancesPage() {
    const {
        expenses, groups, getUserById, currentUser,
        pendingSettlements, createPendingSettlement, cancelPendingSettlement,
        approveSettlement, rejectSettlement
    } = useApp()

    const [loadingPayment, setLoadingPayment] = useState(null)
    const [cancelingPayment, setCancelingPayment] = useState(null)
    const [approvingPayment, setApprovingPayment] = useState(null)
    const [rejectingPayment, setRejectingPayment] = useState(null)

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
                            const isMyReceivable = t.to === currentUser?.id
                            const key = `${group.id}-${i}`

                            // Find if there's an ongoing or completed settlement for this exact debt
                            const activeSettlement = pendingSettlements.find(s =>
                                s.group_id === group.id &&
                                s.payer_id === t.from &&
                                s.receiver_id === t.to &&
                                (s.status === 'pending' || s.status === 'completed')
                            )

                            const isPending = activeSettlement?.status === 'pending'
                            const isCompleted = activeSettlement?.status === 'completed'

                            // ─── PAYER: initiate payment ───
                            const handlePay = async () => {
                                if (!toUser?.upi_id) {
                                    toast.error(`${toUser?.full_name || 'User'} has not added a UPI ID.`)
                                    return
                                }
                                setLoadingPayment(key)
                                try {
                                    const settlementId = generateSettlementId()
                                    await createPendingSettlement({
                                        settlementId,
                                        groupId: group.id,
                                        payerId: currentUser.id,
                                        receiverId: toUser.id,
                                        amount: t.amount
                                    })
                                    const link = generateGooglePayLink({
                                        upiId: toUser.upi_id,
                                        name: toUser.full_name,
                                        amount: t.amount,
                                        note: settlementId,
                                    })
                                    window.location.href = link
                                } catch (e) {
                                    console.error("Payment init failed:", e)
                                    toast.error("Failed to initialize payment. Try again.")
                                } finally {
                                    setLoadingPayment(null)
                                }
                            }

                            // ─── PAYER: cancel pending settlement ───
                            const handleCancel = async () => {
                                if (!activeSettlement) return
                                setCancelingPayment(activeSettlement.id)
                                try {
                                    await cancelPendingSettlement(activeSettlement.id)
                                    toast.success('Payment request cancelled.')
                                } catch (e) {
                                    toast.error('Failed to cancel.')
                                } finally {
                                    setCancelingPayment(null)
                                }
                            }

                            // ─── RECEIVER: approve payment ───
                            const handleApprove = async () => {
                                if (!activeSettlement) return
                                setApprovingPayment(activeSettlement.id)
                                try {
                                    await approveSettlement(activeSettlement.id)
                                    toast.success(`Payment of ${formatAmount(Number(activeSettlement.amount))} approved! ✅`)
                                } catch (e) {
                                    console.error("Approve failed:", e)
                                    toast.error('Failed to approve payment.')
                                } finally {
                                    setApprovingPayment(null)
                                }
                            }

                            // ─── RECEIVER: reject payment claim ───
                            const handleReject = async () => {
                                if (!activeSettlement) return
                                setRejectingPayment(activeSettlement.id)
                                try {
                                    await rejectSettlement(activeSettlement.id)
                                    toast('Payment claim rejected.', { icon: '❌' })
                                } catch (e) {
                                    toast.error('Failed to reject.')
                                } finally {
                                    setRejectingPayment(null)
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

                                    {/* ══════ PAYER's VIEW ══════ */}

                                    {/* Pay button (no active settlement) */}
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

                                    {/* Payer: waiting for receiver's approval */}
                                    {isMyPayment && isPending && (
                                        <div className="flex flex-col items-end gap-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-semibold text-[#F59E0B] flex items-center gap-1 bg-[#F59E0B]/10 px-2 py-1.5 rounded-xl border border-[#F59E0B]/20">
                                                    <Clock size={10} /> Awaiting {toUser?.full_name?.split(' ')[0]}'s approval
                                                </span>
                                            </div>
                                            <motion.button
                                                onClick={handleCancel}
                                                disabled={cancelingPayment === activeSettlement.id}
                                                className="text-[10px] font-semibold text-red-400 cursor-pointer hover:bg-red-500/30 flex items-center gap-0.5 bg-red-500/15 px-1.5 py-1 rounded-lg border border-red-500/25 transition-colors"
                                                whileTap={{ scale: 0.92 }}
                                                title="Cancel this payment request"
                                            >
                                                {cancelingPayment === activeSettlement.id
                                                    ? <Loader2 size={10} className="animate-spin" />
                                                    : <><X size={10} /> Cancel</>
                                                }
                                            </motion.button>
                                        </div>
                                    )}

                                    {/* ══════ RECEIVER's VIEW ══════ */}

                                    {/* Receiver: approve or reject the payer's claim */}
                                    {isMyReceivable && !isMyPayment && isPending && (
                                        <div className="flex flex-col items-end gap-1.5">
                                            <span className="text-[10px] font-medium text-[#F59E0B] bg-[#F59E0B]/10 border border-[#F59E0B]/20 px-2 py-1 rounded-lg">
                                                {fromUser?.full_name?.split(' ')[0]} says paid {formatAmount(Number(activeSettlement.amount))}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <motion.button
                                                    onClick={handleApprove}
                                                    disabled={approvingPayment === activeSettlement.id}
                                                    className="text-[10px] font-semibold text-green-400 cursor-pointer hover:bg-green-500/30 flex items-center gap-0.5 bg-green-500/15 px-2 py-1 rounded-lg border border-green-500/25 transition-colors"
                                                    whileTap={{ scale: 0.92 }}
                                                    title="Confirm you received this payment"
                                                >
                                                    {approvingPayment === activeSettlement.id
                                                        ? <Loader2 size={10} className="animate-spin" />
                                                        : <><Check size={10} /> Approve</>
                                                    }
                                                </motion.button>
                                                <motion.button
                                                    onClick={handleReject}
                                                    disabled={rejectingPayment === activeSettlement.id}
                                                    className="text-[10px] font-semibold text-red-400 cursor-pointer hover:bg-red-500/30 flex items-center gap-0.5 bg-red-500/15 px-2 py-1 rounded-lg border border-red-500/25 transition-colors"
                                                    whileTap={{ scale: 0.92 }}
                                                    title="Reject — payment not received"
                                                >
                                                    {rejectingPayment === activeSettlement.id
                                                        ? <Loader2 size={10} className="animate-spin" />
                                                        : <><X size={10} /> Reject</>
                                                    }
                                                </motion.button>
                                            </div>
                                        </div>
                                    )}

                                    {/* ══════ SHARED VIEWS ══════ */}

                                    {/* Settlement completed — visible to both payer and receiver */}
                                    {isCompleted && (
                                        <span className="text-xs font-semibold text-green-400 flex items-center gap-1">
                                            <CheckCircle size={12} /> Settled
                                        </span>
                                    )}

                                    {/* Receiver: no settlement in progress (payer hasn't clicked Pay yet) */}
                                    {isMyReceivable && !isMyPayment && !isPending && !isCompleted && (
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
