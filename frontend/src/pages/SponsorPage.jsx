import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Gift, Percent, Hash, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useApp } from '../context/AppContext'
import { formatAmount, getAvatarColor, getInitials, calculateMemberShares } from '../utils/helpers'
import PullToRefresh from '../components/PullToRefresh'

export default function SponsorPage() {
    const { id: groupId } = useParams()
    const [searchParams] = useSearchParams()
    const preselectedMember = searchParams.get('member')
    const navigate = useNavigate()
    const { getGroupById, getExpensesByGroup, getUserById, currentUser, sponsorships, loadSponsorships, addSponsorship, deleteSponsorship, manualRefresh } = useApp()

    const group = getGroupById(groupId)
    const expenses = getExpensesByGroup(groupId)
    const groupSponsorships = sponsorships.filter(s => s.group_id === groupId)

    const [recipientId, setRecipientId] = useState(preselectedMember || '')
    const [mode, setMode] = useState('amount') // 'amount' | 'percentage'
    const [amount, setAmount] = useState('')
    const [percentage, setPercentage] = useState('')
    const [note, setNote] = useState('')
    const [loading, setLoading] = useState(false)

    // Load sponsorships on mount
    useEffect(() => {
        if (groupId) loadSponsorships(groupId)
    }, [groupId])

    // Calculate recipient's total shares for percentage mode
    const rawShares = useMemo(() => calculateMemberShares(expenses), [expenses])

    if (!group) {
        navigate('/', { replace: true })
        return null
    }

    const iAmAdmin = currentUser?.id === group.created_by

    const recipientTotalShares = recipientId ? (rawShares[recipientId] || 0) : 0
    const computedAmount = mode === 'percentage'
        ? Math.round((recipientTotalShares * (parseFloat(percentage) || 0) / 100) * 100) / 100
        : parseFloat(amount) || 0

    const canSubmit = recipientId && computedAmount > 0 && recipientId !== currentUser?.id

    const otherMembers = group.members.filter(m => m !== currentUser?.id)

    const handleSubmit = async () => {
        if (!canSubmit) return
        setLoading(true)
        try {
            await addSponsorship({
                groupId,
                sponsorId: currentUser.id,
                recipientId,
                amount: computedAmount,
                percentage: mode === 'percentage' ? parseFloat(percentage) : null,
                note: note.trim(),
            })
            toast.success(`Sponsored ${formatAmount(computedAmount)} 🎁`)
            setAmount('')
            setPercentage('')
            setNote('')
            setRecipientId('')
        } catch (e) {
            toast.error(e.message || 'Failed to create sponsorship')
        } finally {
            setLoading(false)
        }
    }

    return (
        <PullToRefresh onRefresh={manualRefresh}>
            <div className="page animated-bg">
                <div className="px-5 pt-10 pb-28">
                    {/* Header */}
                <div className="flex items-center gap-4 mb-6">
                    <motion.button className="w-10 h-10 rounded-2xl glass flex items-center justify-center"
                        whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
                        <ArrowLeft size={18} className="text-white" />
                    </motion.button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <Gift size={20} className="text-amber-400" />
                            <h1 className="text-xl font-extrabold text-white truncate">Sponsor a Friend</h1>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5">{group.emoji} {group.name}</p>
                    </div>
                </div>

                {/* Info card */}
                <motion.div className="card mb-5"
                    style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="text-xs text-[#94A3B8]">
                        🎁 Cover part or all of a friend's share. Their actual cost reduces and yours increases.
                        This affects all balance calculations.
                    </p>
                </motion.div>

                {/* Select recipient */}
                <div className="mb-5">
                    <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">Who to sponsor?</p>
                    <div className="space-y-2">
                        {otherMembers.map(mid => {
                            const user = getUserById(mid)
                            const isSelected = recipientId === mid
                            const [c1, c2] = getAvatarColor(user?.full_name || '')
                            const memberShares = rawShares[mid] || 0
                            return (
                                <button key={mid} onClick={() => setRecipientId(isSelected ? '' : mid)}
                                    className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                                    style={{
                                        background: isSelected ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                                        border: `1px solid ${isSelected ? 'rgba(245,158,11,0.35)' : 'rgba(255,255,255,0.07)'}`,
                                    }}>
                                    <div className="avatar text-white text-xs shrink-0"
                                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                        {getInitials(user?.full_name)}
                                    </div>
                                    <div className="flex-1 text-left">
                                        <p className="text-white text-sm font-semibold">{user?.full_name}</p>
                                        <p className="text-[10px] text-[#64748B]">Total share: {formatAmount(memberShares)}</p>
                                    </div>
                                    <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                        style={{ background: isSelected ? '#F59E0B' : 'rgba(255,255,255,0.08)' }}>
                                        {isSelected && <span className="text-black text-xs font-bold">✓</span>}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                </div>

                {recipientId && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                        {/* Mode toggle */}
                        <div className="flex gap-2 mb-4">
                            <button onClick={() => setMode('amount')}
                                className="flex-1 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                                style={{
                                    background: mode === 'amount' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${mode === 'amount' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                    color: mode === 'amount' ? '#F59E0B' : '#94A3B8',
                                }}>
                                <Hash size={14} /> Fixed Amount
                            </button>
                            <button onClick={() => setMode('percentage')}
                                className="flex-1 py-3 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                                style={{
                                    background: mode === 'percentage' ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${mode === 'percentage' ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.07)'}`,
                                    color: mode === 'percentage' ? '#F59E0B' : '#94A3B8',
                                }}>
                                <Percent size={14} /> Percentage
                            </button>
                        </div>

                        {/* Amount/Percentage input */}
                        <div className="card text-center py-5 mb-4" style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.2)' }}>
                            {mode === 'amount' ? (
                                <>
                                    <p className="text-[#94A3B8] text-sm mb-2">Sponsor Amount</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <span className="text-2xl font-bold text-[#94A3B8]">₹</span>
                                        <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                                            placeholder="0" className="text-3xl font-extrabold text-white bg-transparent outline-none text-center"
                                            style={{ width: '150px' }} />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-[#94A3B8] text-sm mb-2">Percentage of {getUserById(recipientId)?.full_name?.split(' ')[0]}'s share</p>
                                    <div className="flex items-center justify-center gap-2">
                                        <input type="number" value={percentage} onChange={e => setPercentage(e.target.value)}
                                            placeholder="0" min="1" max="100"
                                            className="text-3xl font-extrabold text-white bg-transparent outline-none text-center"
                                            style={{ width: '100px' }} />
                                        <span className="text-2xl font-bold text-[#94A3B8]">%</span>
                                    </div>
                                    {computedAmount > 0 && (
                                        <p className="text-sm font-bold text-amber-400 mt-2">= {formatAmount(computedAmount)}</p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* Note */}
                        <input type="text" placeholder="Note (optional)" value={note}
                            onChange={e => setNote(e.target.value)} className="input-field mb-5" />

                        {/* Submit */}
                        <button className="btn-primary flex items-center justify-center gap-2 w-full"
                            disabled={!canSubmit || loading} onClick={handleSubmit}>
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Creating...
                                </span>
                            ) : (<><Gift size={16} /> Sponsor {computedAmount > 0 ? formatAmount(computedAmount) : ''}</>)}
                        </button>
                    </motion.div>
                )}

                {/* Existing sponsorships */}
                {groupSponsorships.length > 0 && (
                    <div className="mt-8">
                        <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">
                            🎁 Active Sponsorships
                        </p>
                        <div className="space-y-2.5">
                            {groupSponsorships.map((sp, idx) => {
                                const sponsor = getUserById(sp.sponsor_id)
                                const recipient = getUserById(sp.recipient_id)
                                const isMySponsor = sp.sponsor_id === currentUser?.id
                                const canDelete = iAmAdmin || isMySponsor

                                return (
                                    <motion.div key={sp.id} className="card"
                                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: idx * 0.05 }}>
                                        <div className="flex items-center gap-3">
                                            <Gift size={18} className="text-amber-400 shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-white text-sm font-semibold">
                                                    {isMySponsor ? 'You' : sponsor?.full_name?.split(' ')[0]} → {sp.recipient_id === currentUser?.id ? 'You' : recipient?.full_name?.split(' ')[0]}
                                                </p>
                                                <p className="text-[10px] text-[#64748B]">
                                                    {sp.percentage ? `${sp.percentage}% of shares` : 'Fixed amount'}
                                                    {sp.note ? ` · "${sp.note}"` : ''}
                                                </p>
                                            </div>
                                            <span className="text-sm font-extrabold text-amber-400">{formatAmount(sp.amount)}</span>
                                            {canDelete && (
                                                <button onClick={async () => {
                                                    if (!window.confirm('Delete this sponsorship?')) return
                                                    try {
                                                        await deleteSponsorship(sp.id)
                                                        toast.success('Sponsorship removed')
                                                    } catch { toast.error('Failed to delete') }
                                                }} className="p-1.5 hover:bg-white/5 rounded-lg">
                                                    <Trash2 size={13} className="text-red-400" />
                                                </button>
                                            )}
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </div>
                )}
            </div>
            </div>
        </PullToRefresh>
    )
}
