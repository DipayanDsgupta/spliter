import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, TrendingUp, BarChart3, Wallet, Receipt, ChevronRight, Gift } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
    calculateMemberSpendings,
    calculateMemberShares,
    buildDailySpendingData,
    buildDailySharesData,
    formatAmount,
    getAvatarColor,
    getInitials,
} from '../utils/helpers'
import PullToRefresh from '../components/PullToRefresh'

/* ─── Tiny SVG line chart (no deps) ─── */
function SpendingChart({ dailyData, memberIds, getUserById, currentUser, accentHue }) {
    const WIDTH = 340
    const HEIGHT = 180
    const PAD = { top: 16, right: 12, bottom: 32, left: 48 }
    const plotW = WIDTH - PAD.left - PAD.right
    const plotH = HEIGHT - PAD.top - PAD.bottom

    const cumulative = useMemo(() => {
        const running = {}
        memberIds.forEach(id => { running[id] = 0 })
        return dailyData.map(d => {
            const point = { date: d.date }
            memberIds.forEach(id => {
                running[id] += (d[id] || 0)
                point[id] = running[id]
            })
            return point
        })
    }, [dailyData, memberIds])

    const [tooltip, setTooltip] = useState(null)

    if (dailyData.length === 0) return null

    const maxVal = Math.max(1, ...cumulative.flatMap(d => memberIds.map(id => d[id] || 0)))

    const xScale = (i) => PAD.left + (cumulative.length === 1 ? plotW / 2 : (i / (cumulative.length - 1)) * plotW)
    const yScale = (v) => PAD.top + plotH - (v / maxVal) * plotH

    const formatDateLabel = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00')
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    }

    const yTicks = [0, maxVal * 0.25, maxVal * 0.5, maxVal * 0.75, maxVal]
    const formatShort = (v) => {
        if (v >= 10000) return `₹${(v / 1000).toFixed(0)}k`
        if (v >= 1000) return `₹${(v / 1000).toFixed(1)}k`
        return `₹${Math.round(v)}`
    }

    const xLabelStep = Math.max(1, Math.floor(cumulative.length / 5))

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ maxHeight: '220px' }}>
                {yTicks.map((v, i) => (
                    <g key={i}>
                        <line x1={PAD.left} y1={yScale(v)} x2={WIDTH - PAD.right} y2={yScale(v)}
                            stroke="rgba(255,255,255,0.06)" strokeDasharray="4,3" />
                        <text x={PAD.left - 4} y={yScale(v) + 3} textAnchor="end" fontSize="8" fill="#64748B">
                            {formatShort(v)}
                        </text>
                    </g>
                ))}
                {cumulative.map((d, i) => {
                    if (i % xLabelStep !== 0 && i !== cumulative.length - 1) return null
                    return (
                        <text key={i} x={xScale(i)} y={HEIGHT - 6} textAnchor="middle" fontSize="8" fill="#64748B">
                            {formatDateLabel(d.date)}
                        </text>
                    )
                })}
                {memberIds.map(id => {
                    const [c1] = getAvatarColor(getUserById(id)?.full_name || '')
                    const points = cumulative.map((d, i) => `${xScale(i)},${yScale(d[id] || 0)}`).join(' ')
                    return (
                        <g key={id}>
                            <defs>
                                <linearGradient id={`grad-${accentHue}-${id}`} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={c1} stopOpacity="0.15" />
                                    <stop offset="100%" stopColor={c1} stopOpacity="0" />
                                </linearGradient>
                            </defs>
                            <polygon
                                points={`${xScale(0)},${yScale(0)} ${points} ${xScale(cumulative.length - 1)},${yScale(0)}`}
                                fill={`url(#grad-${accentHue}-${id})`}
                            />
                            <polyline points={points} fill="none" stroke={c1} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            {cumulative.map((d, i) => (
                                <circle key={i} cx={xScale(i)} cy={yScale(d[id] || 0)} r={3}
                                    fill={c1} stroke="#0F0F23" strokeWidth="1.5"
                                    style={{ cursor: 'pointer' }} onClick={() => setTooltip(tooltip === i ? null : i)} />
                            ))}
                        </g>
                    )
                })}
                {tooltip !== null && tooltip < cumulative.length && (
                    <line x1={xScale(tooltip)} y1={PAD.top} x2={xScale(tooltip)} y2={PAD.top + plotH}
                        stroke="rgba(255,255,255,0.2)" strokeDasharray="3,2" />
                )}
            </svg>
            {tooltip !== null && tooltip < cumulative.length && (
                <motion.div
                    className="absolute top-0 left-1/2 -translate-x-1/2 p-2.5 rounded-xl z-10"
                    style={{ background: 'rgba(20,20,40,0.95)', border: '1px solid rgba(255,255,255,0.1)', minWidth: '140px' }}
                    initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                >
                    <p className="text-[10px] text-[#94A3B8] font-semibold mb-1.5">
                        {formatDateLabel(cumulative[tooltip].date)}
                    </p>
                    {memberIds.map(id => {
                        const user = getUserById(id)
                        const [c1] = getAvatarColor(user?.full_name || '')
                        return (
                            <div key={id} className="flex items-center gap-2 py-0.5">
                                <div className="w-2 h-2 rounded-full shrink-0" style={{ background: c1 }} />
                                <span className="text-[10px] text-white/80 flex-1">
                                    {id === currentUser?.id ? 'You' : user?.full_name?.split(' ')[0]}
                                </span>
                                <span className="text-[10px] font-bold text-white">
                                    {formatAmount(cumulative[tooltip][id] || 0)}
                                </span>
                            </div>
                        )
                    })}
                    <button onClick={() => setTooltip(null)} className="text-[9px] text-[#64748B] mt-1 w-full text-center">
                        tap to close
                    </button>
                </motion.div>
            )}
        </div>
    )
}

/* ─── Reusable member list with progress bars ─── */
function MemberSpendList({ sortedMembers, amounts, total, getUserById, currentUser, accentColor, onMemberClick, groupSponsorships = [] }) {
    return (
        <div className="space-y-2.5">
            {sortedMembers.map((memberId, idx) => {
                const user = getUserById(memberId)
                const val = amounts[memberId] || 0
                const pct = total > 0 ? ((val / total) * 100) : 0
                const isMe = memberId === currentUser?.id
                const [c1, c2] = getAvatarColor(user?.full_name || '')

                return (
                    <motion.div key={memberId} className="card cursor-pointer active:scale-[0.98] transition-transform"
                        initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.06 }}
                        onClick={() => onMemberClick?.(memberId)}
                    >
                        <div className="flex items-center gap-3 mb-2.5">
                            <div className="avatar text-white text-xs shrink-0"
                                style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                {getInitials(user?.full_name)}
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="text-white text-sm font-bold truncate">
                                    {isMe ? 'You' : user?.full_name}
                                </p>
                                <p className="text-[10px] text-[#64748B]">
                                    {pct.toFixed(1)}% of group total
                                </p>
                            </div>
                            <div className="text-right shrink-0">
                                <p className="text-sm font-extrabold" style={{ color: val > 0 ? accentColor : '#94A3B8' }}>
                                    {formatAmount(val)}
                                </p>
                            </div>
                            <ChevronRight size={14} className="text-[#475569] shrink-0" />
                        </div>
                        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
                            <motion.div className="h-full rounded-full"
                                style={{ background: `linear-gradient(90deg, ${c1}, ${c2})` }}
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(pct, 100)}%` }}
                                transition={{ delay: idx * 0.06 + 0.2, duration: 0.6, ease: 'easeOut' }}
                            />
                        </div>
                        {/* Sponsorship badges */}
                        {groupSponsorships.filter(sp => sp.recipient_id === memberId || sp.sponsor_id === memberId).map(sp => {
                            const isSponsor = sp.sponsor_id === memberId
                            const other = getUserById(isSponsor ? sp.recipient_id : sp.sponsor_id)
                            const otherName = (isSponsor ? sp.recipient_id : sp.sponsor_id) === currentUser?.id ? 'You' : other?.full_name?.split(' ')[0]
                            return (
                                <div key={sp.id} className="flex items-center gap-1.5 mt-1.5">
                                    <Gift size={10} className="text-amber-400" />
                                    <p className="text-[9px] text-amber-400/80">
                                        {isSponsor
                                            ? `Sponsored ${otherName} ${formatAmount(sp.amount)}`
                                            : `Sponsored by ${otherName} ${formatAmount(sp.amount)}`}
                                    </p>
                                </div>
                            )
                        })}
                    </motion.div>
                )
            })}
        </div>
    )
}

/* ─── Chart + Legend wrapper ─── */
function ChartSection({ dailyData, activeMembers, getUserById, currentUser, title, accentHue }) {
    if (dailyData.length === 0) return null
    return (
        <motion.div className="card mt-5"
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        >
            <div className="flex items-center gap-2 mb-4">
                <BarChart3 size={16} className="text-purple-400" />
                <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider">{title}</p>
            </div>
            <SpendingChart dailyData={dailyData} memberIds={activeMembers}
                getUserById={getUserById} currentUser={currentUser} accentHue={accentHue} />
            <div className="flex flex-wrap gap-3 mt-4 pt-3 border-t" style={{ borderColor: 'rgba(255,255,255,0.05)' }}>
                {activeMembers.map(mid => {
                    const user = getUserById(mid)
                    const [c1] = getAvatarColor(user?.full_name || '')
                    return (
                        <div key={mid} className="flex items-center gap-1.5">
                            <div className="w-2.5 h-2.5 rounded-full" style={{ background: c1 }} />
                            <span className="text-[10px] text-[#94A3B8] font-medium">
                                {mid === currentUser?.id ? 'You' : user?.full_name?.split(' ')[0]}
                            </span>
                        </div>
                    )
                })}
            </div>
            <p className="text-[9px] text-[#475569] mt-3 text-center">Tap on dots to see cumulative values per date</p>
        </motion.div>
    )
}

/* ════════════════════════════════════ */
/*           SPENDINGS PAGE            */
/* ════════════════════════════════════ */

const TABS = [
    { id: 'actual_cost', label: 'Actual Cost', icon: Receipt, desc: 'How much each person consumed (their share)', accent: '#F59E0B', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' },
    { id: 'paid_out', label: 'Paid Out', icon: Wallet, desc: 'How much each person paid out of pocket', accent: '#34D399', bg: 'rgba(16,185,129,0.10)', border: 'rgba(16,185,129,0.25)' },
]

export default function SpendingsPage() {
    const { id } = useParams()
    const navigate = useNavigate()
    const { getGroupById, getExpensesByGroup, getUserById, currentUser, sponsorships, loadSponsorships, manualRefresh } = useApp()
    const [activeTab, setActiveTab] = useState('actual_cost')

    const group = getGroupById(id)
    const expenses = getExpensesByGroup(id)

    useEffect(() => {
        if (id) loadSponsorships(id)
    }, [id])

    if (!group) {
        navigate('/', { replace: true })
        return null
    }

    const groupSponsorships = (sponsorships || []).filter(s => s.group_id === id)
    const spendings = calculateMemberSpendings(expenses)              // paid out of pocket
    const shares = calculateMemberShares(expenses, groupSponsorships) // actual cost (shares, adjusted for sponsorships)
    const dailySpendData = buildDailySpendingData(expenses)
    const dailySharesData = buildDailySharesData(expenses)
    const totalSpent = expenses.reduce((s, e) => s + e.amount, 0)

    const currentAmounts = activeTab === 'actual_cost' ? shares : spendings
    const currentDaily = activeTab === 'actual_cost' ? dailySharesData : dailySpendData
    const currentTab = TABS.find(t => t.id === activeTab)

    // Sort members by current metric (highest first)
    const sortedMembers = [...group.members].sort((a, b) => (currentAmounts[b] || 0) - (currentAmounts[a] || 0))
    const activeMembers = sortedMembers.filter(mid => (currentAmounts[mid] || 0) > 0)

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
                            <TrendingUp size={20} className="text-emerald-400" />
                            <h1 className="text-xl font-extrabold text-white truncate">Spendings</h1>
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5">
                            {group.emoji} {group.name} · Spending analytics
                        </p>
                    </div>
                </div>

                {/* Total spend summary */}
                <motion.div className="card mb-5"
                    style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.2)' }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                >
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-[#94A3B8] text-xs font-medium mb-1">Total Group Spend</p>
                            <p className="text-2xl font-extrabold gradient-text">{formatAmount(totalSpent)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-[#94A3B8] text-xs font-medium mb-1">Expenses</p>
                            <p className="text-2xl font-extrabold text-white">{expenses.length}</p>
                        </div>
                    </div>
                </motion.div>

                {/* ── Tab switcher ── */}
                <div className="flex gap-2 mb-5">
                    {TABS.map(tab => {
                        const Icon = tab.icon
                        const isActive = activeTab === tab.id
                        return (
                            <button key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className="flex-1 py-3 rounded-xl font-semibold text-xs transition-all flex items-center justify-center gap-1.5"
                                style={{
                                    background: isActive ? tab.bg : 'rgba(255,255,255,0.04)',
                                    border: `1px solid ${isActive ? tab.border : 'rgba(255,255,255,0.07)'}`,
                                    color: isActive ? tab.accent : '#94A3B8',
                                }}
                            >
                                <Icon size={14} />
                                {tab.label}
                            </button>
                        )
                    })}
                </div>

                {/* Tab description */}
                <p className="text-[11px] text-[#64748B] mb-4 text-center italic">
                    {currentTab.desc}
                </p>

                {/* ── Tab content (animated) ── */}
                <AnimatePresence mode="wait">
                    <motion.div key={activeTab}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.2 }}
                    >
                        {expenses.length === 0 ? (
                            <div className="text-center py-12">
                                <div className="text-4xl mb-3">📊</div>
                                <p className="text-white font-semibold">No expenses yet</p>
                                <p className="text-[#94A3B8] text-sm">Add expenses to see spending analytics</p>
                            </div>
                        ) : (
                            <>
                                {/* Member list */}
                                <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">
                                    {activeTab === 'actual_cost' ? '🧾 What Each Person Consumed' : '💰 What Each Person Paid'}
                                </p>
                                <MemberSpendList
                                    sortedMembers={sortedMembers}
                                    amounts={currentAmounts}
                                    total={totalSpent}
                                    getUserById={getUserById}
                                    currentUser={currentUser}
                                    accentColor={currentTab.accent}
                                    onMemberClick={(memberId) => navigate(`/groups/${id}/spendings/${memberId}?tab=${activeTab}`)}
                                    groupSponsorships={activeTab === 'actual_cost' ? groupSponsorships : []}
                                />

                                {/* Time-series chart */}
                                <ChartSection
                                    dailyData={currentDaily}
                                    activeMembers={activeMembers}
                                    getUserById={getUserById}
                                    currentUser={currentUser}
                                    title={activeTab === 'actual_cost' ? 'Consumption Over Time' : 'Payments Over Time'}
                                    accentHue={activeTab}
                                />
                            </>
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
            </div>
        </PullToRefresh>
    )
}
