import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Receipt, Wallet } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
    formatAmount,
    formatDate,
    formatTime,
    getAvatarColor,
    getInitials,
    CATEGORIES,
} from '../utils/helpers'
import PullToRefresh from '../components/PullToRefresh'
import { useEffect } from 'react'

export default function MemberSpendingDetailPage() {
    const { id: groupId, memberId } = useParams()
    const [searchParams] = useSearchParams()
    const tab = searchParams.get('tab') || 'actual_cost'
    const navigate = useNavigate()
    const { getGroupById, getExpensesByGroup, getUserById, currentUser, sponsorships, loadSponsorships, manualRefresh } = useApp()

    const group = getGroupById(groupId)
    const expenses = getExpensesByGroup(groupId)
    const member = getUserById(memberId)

    useEffect(() => {
        if (groupId) loadSponsorships(groupId)
    }, [groupId])

    if (!group || !member) {
        navigate('/', { replace: true })
        return null
    }

    const isMe = memberId === currentUser?.id
    const memberName = isMe ? 'You' : member?.full_name
    const [c1, c2] = getAvatarColor(member?.full_name || '')

    // Build activity list based on tab
    const activities = useMemo(() => {
        const sorted = [...expenses].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

        if (tab === 'actual_cost') {
            const groupSponsorships = (sponsorships || []).filter(s => s.group_id === groupId)
            const mySponsorships = groupSponsorships.filter(s => s.sponsor_id === memberId || s.recipient_id === memberId)
            
            const spActivities = mySponsorships.map(sp => {
                const isSponsor = sp.sponsor_id === memberId
                const other = getUserById(isSponsor ? sp.recipient_id : sp.sponsor_id)
                const amt = Number(sp.amount)
                return {
                    id: `sp-${sp.id}`,
                    type: 'sponsorship',
                    title: isSponsor ? `Sponsored ${other?.full_name?.split(' ')[0]}` : `Sponsored by ${other?.full_name?.split(' ')[0]}`,
                    created_at: sp.created_at,
                    note: sp.note,
                    memberAmount: isSponsor ? amt : -amt,
                    amount: amt,
                    cat: { color: '#F59E0B', emoji: '🎁' }
                }
            })

            // Show expenses where this member has a share (amount_owed > 0)
            const expActivities = sorted
                .map(exp => {
                    const split = exp.splits?.find(s => s.user_id === memberId)
                    if (!split || split.amount_owed <= 0) return null
                    const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[7]
                    return { ...exp, type: 'expense', memberAmount: split.amount_owed, cat }
                })
                .filter(Boolean)
                
            return [...expActivities, ...spActivities].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        } else {
            // Show expenses where this member paid (amount_paid > 0)
            return sorted
                .map(exp => {
                    const payer = exp.paid_by?.find(p => p.user_id === memberId)
                    if (!payer || payer.amount_paid <= 0) return null
                    const cat = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[7]
                    return { ...exp, memberAmount: payer.amount_paid, cat }
                })
                .filter(Boolean)
        }
    }, [expenses, memberId, tab])

    const totalMemberAmount = activities.reduce((s, a) => s + a.memberAmount, 0)

    const isActualCost = tab === 'actual_cost'
    const accent = isActualCost ? '#F59E0B' : '#34D399'
    const headerBg = isActualCost ? 'rgba(245,158,11,0.08)' : 'rgba(16,185,129,0.08)'
    const headerBorder = isActualCost ? 'rgba(245,158,11,0.2)' : 'rgba(16,185,129,0.2)'

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
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="avatar text-white text-xs shrink-0"
                            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                            {getInitials(member?.full_name)}
                        </div>
                        <div className="flex-1 min-w-0">
                            <h1 className="text-lg font-extrabold text-white truncate">{memberName}</h1>
                            <p className="text-[10px] text-[#94A3B8]">
                                {group.emoji} {group.name}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Summary card */}
                <motion.div className="card mb-5"
                    style={{ background: headerBg, borderColor: headerBorder }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center gap-3">
                        {isActualCost
                            ? <Receipt size={20} style={{ color: accent }} />
                            : <Wallet size={20} style={{ color: accent }} />
                        }
                        <div className="flex-1">
                            <p className="text-[#94A3B8] text-xs font-medium">
                                {isActualCost ? 'Total Consumed (Shares)' : 'Total Paid Out'}
                            </p>
                            <p className="text-xl font-extrabold" style={{ color: accent }}>
                                {formatAmount(totalMemberAmount)}
                            </p>
                        </div>
                        <div className="text-right">
                            <p className="text-[#94A3B8] text-xs font-medium">Activities</p>
                            <p className="text-xl font-extrabold text-white">{activities.length}</p>
                        </div>
                    </div>
                    <p className="text-[10px] text-[#64748B] mt-2 italic">
                        {isActualCost
                            ? `${isMe ? 'Your' : memberName + "'s"} share across all group expenses`
                            : `Amount ${isMe ? 'you' : memberName} physically paid`
                        }
                    </p>
                </motion.div>

                {/* Activity list */}
                <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">
                    {isActualCost ? '🧾 Expense Breakdown' : '💰 Payment Breakdown'}
                </p>

                {activities.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="text-4xl mb-3">📭</div>
                        <p className="text-white font-semibold">No activities found</p>
                        <p className="text-[#94A3B8] text-sm">
                            {isActualCost
                                ? `${isMe ? 'You have' : memberName + ' has'} no shares in this group`
                                : `${isMe ? 'You haven\'t' : memberName + ' hasn\'t'} paid for any expense`
                            }
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {activities.map((act, idx) => (
                            <motion.div key={act.id} className="card"
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: idx * 0.04 }}
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-9 h-9 rounded-xl flex items-center justify-center text-base mt-0.5 shrink-0"
                                        style={{ background: `${act.cat.color}18`, border: `1px solid ${act.cat.color}30` }}>
                                        {act.cat.emoji}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-white text-sm truncate">{act.title}</p>
                                        <p className="text-[10px] text-[#64748B] mt-0.5">
                                            {formatDate(act.created_at)} at {formatTime(act.created_at)}
                                        </p>
                                        {act.note && (
                                            <p className="text-[10px] text-[#475569] mt-0.5 italic">"{act.note}"</p>
                                        )}
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-extrabold" style={{ color: act.memberAmount < 0 ? '#10B981' : accent }}>
                                            {act.memberAmount < 0 ? '-' : '+'}{formatAmount(Math.abs(act.memberAmount))}
                                        </p>
                                        {act.type === 'expense' && (
                                            <p className="text-[9px] text-[#64748B] mt-0.5">
                                                of {formatAmount(act.amount)}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
            </div>
        </PullToRefresh>
    )
}
