import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, simplifyDebts, formatAmount, formatDate, generateSettlementId } from '../utils/helpers'
import { CheckCircle, TrendingDown, Loader2, X, Check, Clock, Copy, ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function BalancesPage() {
    const {
        expenses, groups, getUserById, currentUser,
        pendingSettlements, createPendingSettlement, cancelPendingSettlement,
        approveSettlement, rejectSettlement
    } = useApp()

    // UI states
    const [payingKey, setPayingKey] = useState(null)   // which transaction shows "I've Paid" input
    const [payAmount, setPayAmount] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [actionId, setActionId] = useState(null)     // ID being processed (cancel/approve/reject)
    const [expandedThread, setExpandedThread] = useState({}) // which threads are expanded

    // Get completed settlements for balance calculation
    const completedSettlements = pendingSettlements.filter(s => s.status === 'completed')

    // Global adjusted balances
    const allBalances = calculateNetBalances(expenses, completedSettlements)
    const allTransactions = simplifyDebts(allBalances)
    const myTransactions = allTransactions.filter(
        t => t.from === currentUser?.id || t.to === currentUser?.id
    )
    const myNet = allBalances[currentUser?.id] || 0

    // ─── Clipboard helper ───
    const copyUpi = (upiId) => {
        navigator.clipboard.writeText(upiId)
        toast.success(`UPI ID copied: ${upiId}`, { icon: '📋' })
    }

    // ─── Payer: submit "I've Paid" request ───
    const handleSendRequest = async (group, t) => {
        const amount = parseFloat(payAmount)
        if (!amount || amount <= 0) {
            toast.error('Enter a valid amount')
            return
        }

        // Calculate max: remaining - already pending
        const pairPending = pendingSettlements.filter(s =>
            s.group_id === group.id &&
            s.payer_id === t.from &&
            s.receiver_id === t.to &&
            s.status === 'pending'
        )
        const totalPending = pairPending.reduce((sum, s) => sum + Number(s.amount), 0)
        const maxPayable = Math.round((t.amount - totalPending) * 100) / 100

        if (amount > maxPayable + 0.01) {
            toast.error(`Maximum you can request is ${formatAmount(maxPayable)}`)
            return
        }

        setSubmitting(true)
        try {
            await createPendingSettlement({
                settlementId: generateSettlementId(),
                groupId: group.id,
                payerId: currentUser.id,
                receiverId: t.to,
                amount
            })
            toast.success(`Request for ${formatAmount(amount)} sent!`)
            setPayingKey(null)
            setPayAmount('')
        } catch (e) {
            console.error(e)
            toast.error('Failed to send request.')
        } finally {
            setSubmitting(false)
        }
    }

    // ─── Action handlers ───
    const handleCancel = async (id) => {
        setActionId(id)
        try {
            await cancelPendingSettlement(id)
            toast.success('Request cancelled.')
        } catch { toast.error('Failed.') }
        finally { setActionId(null) }
    }

    const handleApprove = async (settlement) => {
        setActionId(settlement.id)
        try {
            await approveSettlement(settlement.id)
            toast.success(`Approved ${formatAmount(Number(settlement.amount))}! ✅`)
        } catch { toast.error('Failed to approve.') }
        finally { setActionId(null) }
    }

    const handleReject = async (id) => {
        setActionId(id)
        try {
            await rejectSettlement(id)
            toast('Request rejected.', { icon: '❌' })
        } catch { toast.error('Failed.') }
        finally { setActionId(null) }
    }

    // ─── Toggle settlement thread ───
    const toggleThread = (key) => {
        setExpandedThread(prev => ({ ...prev, [key]: !prev[key] }))
    }

    // ═══════════════════════════════════════
    //  GROUP BALANCES COMPONENT
    // ═══════════════════════════════════════
    const GroupBalances = () => (
        <div className="space-y-4">
            {groups.map(group => {
                const groupExpenses = expenses.filter(e => e.group_id === group.id)
                const groupCompletedSettlements = completedSettlements.filter(s => s.group_id === group.id)
                const balances = calculateNetBalances(groupExpenses, groupCompletedSettlements)
                const myGroupNet = balances[currentUser?.id] || 0
                const transactions = simplifyDebts(balances).filter(
                    t => t.from === currentUser?.id || t.to === currentUser?.id
                )

                // Also check for pending requests in this group even if balances are settled
                const groupPendingRequests = pendingSettlements.filter(s =>
                    s.group_id === group.id &&
                    s.status === 'pending' &&
                    (s.payer_id === currentUser?.id || s.receiver_id === currentUser?.id)
                )

                if (Math.abs(myGroupNet) < 0.01 && groupPendingRequests.length === 0) return null

                return (
                    <div key={group.id} className="card">
                        {/* Group header */}
                        <div className="flex items-center gap-3 mb-3">
                            <span className="text-xl">{group.emoji}</span>
                            <div className="flex-1">
                                <p className="font-bold text-white text-sm">{group.name}</p>
                                <p className="text-xs text-[#94A3B8]">
                                    {myGroupNet > 0
                                        ? `Others owe you ${formatAmount(myGroupNet)}`
                                        : myGroupNet < 0
                                            ? `You owe ${formatAmount(-myGroupNet)}`
                                            : 'All settled up'}
                                </p>
                            </div>
                            {Math.abs(myGroupNet) >= 0.01 && (
                                <span className="font-extrabold text-base" style={{ color: myGroupNet > 0 ? '#10B981' : '#F43F5E' }}>
                                    {myGroupNet > 0 ? '+' : ''}{formatAmount(myGroupNet)}
                                </span>
                            )}
                        </div>

                        {/* Each transaction / debt line */}
                        {transactions.map((t, i) => {
                            const fromUser = getUserById(t.from)
                            const toUser = getUserById(t.to)
                            const isMyPayment = t.from === currentUser?.id
                            const isMyReceivable = t.to === currentUser?.id
                            const key = `${group.id}-${t.from}-${t.to}`

                            // Find ALL settlements for this pair in this group
                            const pairSettlements = pendingSettlements
                                .filter(s =>
                                    s.group_id === group.id &&
                                    s.payer_id === t.from &&
                                    s.receiver_id === t.to
                                )
                                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

                            const pendingOnes = pairSettlements.filter(s => s.status === 'pending')
                            const completedOnes = pairSettlements.filter(s => s.status === 'completed')
                            const totalPending = pendingOnes.reduce((sum, s) => sum + Number(s.amount), 0)
                            const totalSettled = completedOnes.reduce((sum, s) => sum + Number(s.amount), 0)
                            const availableToPay = Math.round((t.amount - totalPending) * 100) / 100
                            const hasThread = pairSettlements.length > 0
                            const isThreadOpen = expandedThread[key]
                            const isPayFormOpen = payingKey === key

                            return (
                                <div key={i} className="mt-3 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                                    {/* ─── Main debt line ─── */}
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1">
                                            <p className="text-sm text-white font-medium">
                                                {isMyPayment
                                                    ? <>You → <span className="font-bold">{toUser?.full_name?.split(' ')[0]}</span></>
                                                    : <><span className="font-bold">{fromUser?.full_name?.split(' ')[0]}</span> → You</>
                                                }
                                            </p>
                                            <p className="text-xs text-[#94A3B8] mt-0.5">
                                                {formatAmount(t.amount)} remaining
                                                {totalSettled > 0 && (
                                                    <span className="text-green-400/70 ml-1">
                                                        · {formatAmount(totalSettled)} settled
                                                    </span>
                                                )}
                                            </p>
                                        </div>

                                        <span className="font-extrabold text-base" style={{ color: isMyPayment ? '#F43F5E' : '#10B981' }}>
                                            {formatAmount(t.amount)}
                                        </span>
                                    </div>

                                    {/* ─── Payer actions: Copy UPI + I've Paid ─── */}
                                    {isMyPayment && (
                                        <div className="flex items-center gap-2 mt-2.5">
                                            {toUser?.upi_id && (
                                                <motion.button
                                                    onClick={() => copyUpi(toUser.upi_id)}
                                                    className="text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-colors"
                                                    style={{
                                                        background: 'rgba(124,58,237,0.12)',
                                                        border: '1px solid rgba(124,58,237,0.25)',
                                                        color: '#A78BFA'
                                                    }}
                                                    whileTap={{ scale: 0.93 }}
                                                >
                                                    <Copy size={11} /> Copy UPI
                                                </motion.button>
                                            )}

                                            {availableToPay > 0.01 && (
                                                <motion.button
                                                    onClick={() => {
                                                        if (isPayFormOpen) {
                                                            setPayingKey(null)
                                                            setPayAmount('')
                                                        } else {
                                                            setPayingKey(key)
                                                            setPayAmount(availableToPay.toString())
                                                        }
                                                    }}
                                                    className="text-[11px] font-semibold flex items-center gap-1 px-2.5 py-1.5 rounded-xl transition-colors"
                                                    style={{
                                                        background: 'rgba(16,185,129,0.12)',
                                                        border: '1px solid rgba(16,185,129,0.25)',
                                                        color: '#34D399'
                                                    }}
                                                    whileTap={{ scale: 0.93 }}
                                                >
                                                    💰 I've Paid
                                                </motion.button>
                                            )}

                                            {totalPending > 0 && (
                                                <span className="text-[10px] text-[#F59E0B] font-medium bg-[#F59E0B]/10 px-2 py-1 rounded-lg border border-[#F59E0B]/20 flex items-center gap-1">
                                                    <Clock size={9} /> {formatAmount(totalPending)} pending
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* ─── "I've Paid" inline form ─── */}
                                    <AnimatePresence>
                                        {isPayFormOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-2.5 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                                                    <p className="text-[11px] text-[#94A3B8] font-medium mb-2">
                                                        How much did you pay {toUser?.full_name?.split(' ')[0]}?
                                                    </p>
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 relative">
                                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-[#94A3B8] font-bold">₹</span>
                                                            <input
                                                                type="number"
                                                                value={payAmount}
                                                                onChange={e => setPayAmount(e.target.value)}
                                                                max={availableToPay}
                                                                step="0.01"
                                                                className="w-full bg-white/05 border border-white/10 rounded-lg py-2 pl-7 pr-3 text-white text-sm font-semibold outline-none focus:border-purple-500/50"
                                                                placeholder="0.00"
                                                                autoFocus
                                                            />
                                                        </div>
                                                        <motion.button
                                                            onClick={() => handleSendRequest(group, t)}
                                                            disabled={submitting}
                                                            className="text-[11px] font-bold px-3 py-2 rounded-lg text-white flex items-center gap-1"
                                                            style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                                                            whileTap={{ scale: 0.93 }}
                                                        >
                                                            {submitting
                                                                ? <Loader2 size={12} className="animate-spin" />
                                                                : <>Send <Check size={12} /></>
                                                            }
                                                        </motion.button>
                                                    </div>
                                                    <p className="text-[10px] text-[#64748B] mt-1.5">
                                                        {toUser?.full_name?.split(' ')[0]} will need to approve this request
                                                    </p>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>

                                    {/* ─── Receiver: pending approval requests ─── */}
                                    {isMyReceivable && !isMyPayment && pendingOnes.length > 0 && (
                                        <div className="mt-2.5 space-y-2">
                                            {pendingOnes.map(s => (
                                                <motion.div
                                                    key={s.id}
                                                    className="p-2.5 rounded-xl flex items-center gap-2"
                                                    style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                                                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                                >
                                                    <div className="flex-1">
                                                        <p className="text-[11px] text-[#F59E0B] font-semibold">
                                                            {fromUser?.full_name?.split(' ')[0]} says paid {formatAmount(Number(s.amount))}
                                                        </p>
                                                        <p className="text-[9px] text-[#94A3B8] mt-0.5">
                                                            Check your Google Pay & approve
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <motion.button
                                                            onClick={() => handleApprove(s)}
                                                            disabled={actionId === s.id}
                                                            className="text-[10px] font-bold text-green-400 bg-green-500/15 hover:bg-green-500/25 px-2 py-1.5 rounded-lg border border-green-500/25 flex items-center gap-0.5 transition-colors"
                                                            whileTap={{ scale: 0.9 }}
                                                        >
                                                            {actionId === s.id ? <Loader2 size={10} className="animate-spin" /> : <><Check size={10} /> Approve</>}
                                                        </motion.button>
                                                        <motion.button
                                                            onClick={() => handleReject(s.id)}
                                                            disabled={actionId === s.id}
                                                            className="text-[10px] font-bold text-red-400 bg-red-500/15 hover:bg-red-500/25 px-2 py-1.5 rounded-lg border border-red-500/25 flex items-center gap-0.5 transition-colors"
                                                            whileTap={{ scale: 0.9 }}
                                                        >
                                                            {actionId === s.id ? <Loader2 size={10} className="animate-spin" /> : <><X size={10} /> Reject</>}
                                                        </motion.button>
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* ─── Settlement thread toggle ─── */}
                                    {hasThread && (
                                        <button
                                            className="mt-2 text-[10px] font-semibold text-[#64748B] hover:text-[#94A3B8] flex items-center gap-1 transition-colors"
                                            onClick={() => toggleThread(key)}
                                        >
                                            {isThreadOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                                            {pairSettlements.length} settlement{pairSettlements.length > 1 ? 's' : ''} history
                                        </button>
                                    )}

                                    {/* ─── Settlement thread (expanded) ─── */}
                                    <AnimatePresence>
                                        {isThreadOpen && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: 'auto', opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                transition={{ duration: 0.2 }}
                                                className="overflow-hidden"
                                            >
                                                <div className="mt-2 space-y-1.5 pl-3" style={{ borderLeft: '2px solid rgba(124,58,237,0.2)' }}>
                                                    {pairSettlements.map(s => {
                                                        const isSettled = s.status === 'completed'
                                                        const isPending = s.status === 'pending'
                                                        const isMySentRequest = s.payer_id === currentUser?.id

                                                        return (
                                                            <div key={s.id} className="flex items-center gap-2 py-1">
                                                                <div className="flex-1">
                                                                    <p className="text-[11px] font-medium" style={{ color: isSettled ? '#10B981' : '#F59E0B' }}>
                                                                        {isSettled ? <CheckCircle size={10} className="inline mr-1" /> : <Clock size={10} className="inline mr-1" />}
                                                                        {formatAmount(Number(s.amount))}
                                                                        {isSettled && ' · settled'}
                                                                        {isPending && isMySentRequest && ' · awaiting approval'}
                                                                        {isPending && !isMySentRequest && ' · needs your approval'}
                                                                    </p>
                                                                    <p className="text-[9px] text-[#64748B]">
                                                                        {s.verified_at
                                                                            ? formatDate(s.verified_at)
                                                                            : formatDate(s.created_at)}
                                                                    </p>
                                                                </div>

                                                                {/* Payer can cancel their own pending request */}
                                                                {isPending && isMySentRequest && (
                                                                    <motion.button
                                                                        onClick={() => handleCancel(s.id)}
                                                                        disabled={actionId === s.id}
                                                                        className="text-[9px] font-semibold text-red-400 bg-red-500/10 px-1.5 py-0.5 rounded-md border border-red-500/20 flex items-center gap-0.5"
                                                                        whileTap={{ scale: 0.9 }}
                                                                    >
                                                                        {actionId === s.id ? <Loader2 size={8} className="animate-spin" /> : <><X size={8} /> Cancel</>}
                                                                    </motion.button>
                                                                )}
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                            )
                        })}

                        {/* Show pending requests that don't match any current transaction (edge case: fully settled but request still pending) */}
                        {(() => {
                            const orphanedPending = pendingSettlements.filter(s =>
                                s.group_id === group.id &&
                                s.status === 'pending' &&
                                s.receiver_id === currentUser?.id &&
                                !transactions.some(t => t.from === s.payer_id && t.to === s.receiver_id)
                            )
                            if (orphanedPending.length === 0) return null
                            return orphanedPending.map(s => {
                                const payer = getUserById(s.payer_id)
                                return (
                                    <motion.div
                                        key={s.id}
                                        className="mt-3 pt-3 border-t p-2.5 rounded-xl flex items-center gap-2"
                                        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}
                                        initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                    >
                                        <div className="flex-1">
                                            <p className="text-[11px] text-[#F59E0B] font-semibold">
                                                {payer?.full_name?.split(' ')[0]} says paid {formatAmount(Number(s.amount))}
                                            </p>
                                            <p className="text-[9px] text-[#94A3B8] mt-0.5">Check your Google Pay & approve</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <motion.button
                                                onClick={() => handleApprove(s)}
                                                disabled={actionId === s.id}
                                                className="text-[10px] font-bold text-green-400 bg-green-500/15 hover:bg-green-500/25 px-2 py-1.5 rounded-lg border border-green-500/25 flex items-center gap-0.5"
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                {actionId === s.id ? <Loader2 size={10} className="animate-spin" /> : <><Check size={10} /> Approve</>}
                                            </motion.button>
                                            <motion.button
                                                onClick={() => handleReject(s.id)}
                                                disabled={actionId === s.id}
                                                className="text-[10px] font-bold text-red-400 bg-red-500/15 hover:bg-red-500/25 px-2 py-1.5 rounded-lg border border-red-500/25 flex items-center gap-0.5"
                                                whileTap={{ scale: 0.9 }}
                                            >
                                                {actionId === s.id ? <Loader2 size={10} className="animate-spin" /> : <><X size={10} /> Reject</>}
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                )
                            })
                        })()}
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
                {myTransactions.length === 0 && pendingSettlements.filter(s => s.status === 'pending' && (s.payer_id === currentUser?.id || s.receiver_id === currentUser?.id)).length === 0 ? (
                    <div className="text-center py-16">
                        <div className="text-5xl mb-4 float">🎉</div>
                        <h2 className="text-xl font-bold text-white mb-2">All settled up!</h2>
                        <p className="text-[#94A3B8] text-sm">No pending dues. You're all clear!</p>
                    </div>
                ) : (
                    <>
                        <h2 className="text-base font-bold text-white mb-4">Settlements by group</h2>
                        <GroupBalances />
                    </>
                )}
            </div>
        </div>
    )
}
