import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, ArrowLeft, Trash2, Calendar, Search, Loader2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { formatAmount, formatDate } from '../utils/helpers'
import { useState } from 'react'
import toast from 'react-hot-toast'
import PullToRefresh from '../components/PullToRefresh'

export default function SettlementHistoryPage() {
    const navigate = useNavigate()
    const { currentUser, pendingSettlements, groups, getUserById, deleteSettlement, manualRefresh } = useApp()
    const [deletingId, setDeletingId] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')

    // Get strictly completed settlements involving currentUser
    const myCompleted = pendingSettlements
        .filter(s => s.status === 'completed' && (s.payer_id === currentUser?.id || s.receiver_id === currentUser?.id))
        .sort((a, b) => new Date(b.verified_at || b.created_at) - new Date(a.verified_at || a.created_at))

    const totalSettledByMe = myCompleted.filter(s => s.payer_id === currentUser?.id).reduce((sum, s) => sum + Number(s.amount), 0)
    const totalReceivedByMe = myCompleted.filter(s => s.receiver_id === currentUser?.id).reduce((sum, s) => sum + Number(s.amount), 0)

    const handleDelete = async (e, id) => {
        e.stopPropagation()
        if (!window.confirm("Delete this settlement history entry? This will not affect actual group balances, but the history record will be removed.")) return

        try {
            setDeletingId(id)
            await deleteSettlement(id)
            toast.success("Settlement history removed")
        } catch (error) {
            console.error(error)
            toast.error("Failed to delete settlement history")
        } finally {
            setDeletingId(null)
        }
    }

    // Filter logic
    const filteredSettlements = myCompleted.filter(s => {
        if (!searchTerm) return true
        const isMePayer = s.payer_id === currentUser?.id
        const otherUser = getUserById(isMePayer ? s.receiver_id : s.payer_id)
        const otherName = otherUser?.full_name?.toLowerCase() || ''
        const group = groups.find(g => g.id === s.group_id)
        const groupName = group?.name?.toLowerCase() || ''
        const term = searchTerm.toLowerCase()
        return otherName.includes(term) || groupName.includes(term)
    })

    return (
        <PullToRefresh onRefresh={manualRefresh}>
            <div className="page animated-bg min-h-screen">
                <div className="px-5 pt-12 pb-24 max-w-lg mx-auto">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-6 relative z-10">
                        <motion.button
                            onClick={() => navigate(-1)}
                            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-white/5 border border-white/10 text-white"
                            whileTap={{ scale: 0.9 }}
                            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                        >
                            <ArrowLeft size={20} />
                        </motion.button>
                        <motion.h1 
                            className="text-xl font-extrabold text-white"
                            initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }}
                        >
                            History
                        </motion.h1>
                    </div>

                    {/* Summary Card */}
                    <motion.div
                        className="card mb-6"
                        style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.18)' }}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                    >
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wider mb-1">You Paid</p>
                                <p className="text-xl font-extrabold text-[#F43F5E]">{formatAmount(totalSettledByMe)}</p>
                            </div>
                            <div className="w-px h-8 bg-white/10"></div>
                            <div className="text-right">
                                <p className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wider mb-1">You Received</p>
                                <p className="text-xl font-extrabold text-[#10B981]">{formatAmount(totalReceivedByMe)}</p>
                            </div>
                        </div>
                    </motion.div>

                    {/* Search Field */}
                    {myCompleted.length > 0 && (
                        <motion.div className="relative mb-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B]" />
                            <input
                                type="text"
                                placeholder="Search by name or group..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white text-sm outline-none focus:border-purple-500/50"
                            />
                        </motion.div>
                    )}

                    {/* Settlement List */}
                    {myCompleted.length === 0 ? (
                        <motion.div className="text-center py-12" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                                📅
                            </div>
                            <h2 className="text-lg font-bold text-white mb-1">No History Yet</h2>
                            <p className="text-[#94A3B8] text-sm">Your past settlements will appear here.</p>
                        </motion.div>
                    ) : filteredSettlements.length === 0 ? (
                        <div className="text-center py-8">
                            <p className="text-[#64748B] text-sm">No settlements match your search.</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <AnimatePresence>
                                {filteredSettlements.map((s, i) => {
                                    const isMePayer = s.payer_id === currentUser?.id
                                    const otherUser = getUserById(isMePayer ? s.receiver_id : s.payer_id)
                                    const otherName = otherUser?.full_name || 'Unknown'
                                    const group = groups.find(g => g.id === s.group_id)

                                    return (
                                        <motion.div
                                            key={s.id}
                                            layout
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, scale: 0.95 }}
                                            transition={{ delay: i * 0.05 }}
                                            className="card p-4 relative group"
                                            style={{ background: 'rgba(255,255,255,0.03)' }}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className="w-10 h-10 rounded-xl flex items-center justify-center mt-1 shrink-0"
                                                    style={{ background: isMePayer ? 'rgba(244,63,94,0.12)' : 'rgba(16,185,129,0.12)' }}>
                                                    <CheckCircle size={18} style={{ color: isMePayer ? '#F43F5E' : '#10B981' }} />
                                                </div>
                                                <div className="flex-1 min-w-0 pr-8">
                                                    <p className="text-sm font-semibold text-white truncate">
                                                        {isMePayer ? `You paid ${otherName}` : `${otherName} paid you`}
                                                    </p>
                                                    <div className="flex items-center gap-1.5 mt-1.5 text-[11px] text-[#64748B]">
                                                        <span>{group ? `${group.emoji} ${group.name}` : 'Direct'}</span>
                                                        <span>·</span>
                                                        <span className="flex items-center gap-1"><Calendar size={10} /> {formatDate(s.verified_at || s.created_at)}</span>
                                                    </div>
                                                </div>
                                                <p className="text-sm font-extrabold shrink-0" style={{ color: isMePayer ? '#F43F5E' : '#10B981' }}>
                                                    {isMePayer ? '-' : '+'}{formatAmount(Number(s.amount))}
                                                </p>
                                            </div>

                                            {/* Delete Button */}
                                            <button
                                                onClick={(e) => handleDelete(e, s.id)}
                                                disabled={deletingId === s.id}
                                                className="absolute top-4 right-4 text-[#64748B] hover:text-[#F43F5E] transition-colors p-1"
                                            >
                                                {deletingId === s.id ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                            </button>
                                        </motion.div>
                                    )
                                })}
                            </AnimatePresence>
                        </div>
                    )}
                </div>
            </div>
        </PullToRefresh>
    )
}
