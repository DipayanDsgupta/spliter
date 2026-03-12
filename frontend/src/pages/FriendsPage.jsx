import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { getAvatarColor, getInitials, calculateNetBalances, formatAmount } from '../utils/helpers'
import { UserPlus, Check, X, Loader2, Search, MessageCircle, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

export default function FriendsPage() {
    const {
        currentUser, friendships, friendRequests,
        sendFriendRequest, acceptFriendRequest, rejectFriendRequest,
        getFriendIdFromFriendship, getUserById,
        expenses, pendingSettlements
    } = useApp()

    const navigate = useNavigate()
    const [showAddForm, setShowAddForm] = useState(false)
    const [email, setEmail] = useState('')
    const [sending, setSending] = useState(false)
    const [actionId, setActionId] = useState(null)

    // Incoming requests (where I'm the receiver)
    const incomingRequests = friendRequests.filter(r => r.receiver_id === currentUser?.id)
    // Sent requests (where I'm the sender)
    const sentRequests = friendRequests.filter(r => r.sender_id === currentUser?.id)



    const handleSendRequest = async () => {
        if (!email.trim()) { toast.error('Enter an email address'); return }
        setSending(true)
        try {
            const target = await sendFriendRequest(email)
            toast.success(`Request sent to ${target.full_name}! 🎉`)
            setEmail('')
            setShowAddForm(false)
        } catch (e) {
            toast.error(e.message)
        } finally { setSending(false) }
    }

    const handleAccept = async (id) => {
        setActionId(id)
        try {
            await acceptFriendRequest(id)
            toast.success('Friend request accepted! 🤝')
        } catch { toast.error('Failed to accept.') }
        finally { setActionId(null) }
    }

    const handleReject = async (id) => {
        setActionId(id)
        try {
            await rejectFriendRequest(id)
            toast('Request rejected.', { icon: '❌' })
        } catch { toast.error('Failed.') }
        finally { setActionId(null) }
    }

    return (
        <div className="page animated-bg">
            <div className="px-5 pt-12 pb-6">
                {/* Header */}
                <motion.div
                    className="flex items-center justify-between mb-6"
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                >
                    <div>
                        <h1 className="text-2xl font-extrabold text-white">Friends</h1>
                        <p className="text-[#94A3B8] text-sm mt-1">
                            {friendships.length} friend{friendships.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                    <motion.button
                        className="w-10 h-10 rounded-2xl flex items-center justify-center"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                        whileTap={{ scale: 0.9 }}
                        onClick={() => setShowAddForm(!showAddForm)}
                    >
                        {showAddForm ? <X size={18} className="text-white" /> : <UserPlus size={18} className="text-white" />}
                    </motion.button>
                </motion.div>

                {/* Add friend form */}
                <AnimatePresence>
                    {showAddForm && (
                        <motion.div
                            className="card mb-5"
                            style={{ background: 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.2)' }}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <p className="text-sm font-bold text-white mb-3">Add a Friend</p>
                            <p className="text-xs text-[#94A3B8] mb-3">Enter their email address (they must have a Spliter account)</p>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 relative">
                                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                        placeholder="friend@email.com"
                                        className="w-full bg-white/05 border border-white/10 rounded-xl py-2.5 pl-9 pr-3 text-white text-sm outline-none focus:border-purple-500/50"
                                        onKeyDown={e => e.key === 'Enter' && handleSendRequest()}
                                        autoFocus
                                    />
                                </div>
                                <motion.button
                                    onClick={handleSendRequest}
                                    disabled={sending}
                                    className="px-4 py-2.5 rounded-xl text-sm font-bold text-white flex items-center gap-1.5"
                                    style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                                    whileTap={{ scale: 0.93 }}
                                >
                                    {sending ? <Loader2 size={14} className="animate-spin" /> : <><UserPlus size={14} /> Send</>}
                                </motion.button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Incoming friend requests */}
                {incomingRequests.length > 0 && (
                    <motion.div className="mb-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">
                            📨 Friend Requests · {incomingRequests.length}
                        </p>
                        <div className="space-y-2">
                            {incomingRequests.map(req => {
                                const sender = getUserById(req.sender_id)
                                const [c1, c2] = getAvatarColor(sender?.full_name || '')
                                return (
                                    <motion.div
                                        key={req.id}
                                        className="card flex items-center gap-3"
                                        style={{ background: 'rgba(245,158,11,0.06)', borderColor: 'rgba(245,158,11,0.15)' }}
                                        initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                                    >
                                        <div className="avatar text-white text-xs shrink-0"
                                            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                            {getInitials(sender?.full_name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{sender?.full_name || 'Unknown'}</p>
                                            <p className="text-[10px] text-[#94A3B8]">{sender?.email}</p>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <motion.button
                                                onClick={() => handleAccept(req.id)}
                                                disabled={actionId === req.id}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center bg-green-500/15 border border-green-500/25"
                                                whileTap={{ scale: 0.85 }}
                                            >
                                                {actionId === req.id ? <Loader2 size={14} className="animate-spin text-green-400" /> : <Check size={16} className="text-green-400" />}
                                            </motion.button>
                                            <motion.button
                                                onClick={() => handleReject(req.id)}
                                                disabled={actionId === req.id}
                                                className="w-8 h-8 rounded-xl flex items-center justify-center bg-red-500/15 border border-red-500/25"
                                                whileTap={{ scale: 0.85 }}
                                            >
                                                <X size={16} className="text-red-400" />
                                            </motion.button>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Sent requests (pending) */}
                {sentRequests.length > 0 && (
                    <motion.div className="mb-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                        <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">
                            📤 Sent Requests · {sentRequests.length}
                        </p>
                        <div className="space-y-2">
                            {sentRequests.map(req => {
                                const receiver = getUserById(req.receiver_id)
                                const [c1, c2] = getAvatarColor(receiver?.full_name || '')
                                return (
                                    <div key={req.id} className="card flex items-center gap-3" style={{ opacity: 0.7 }}>
                                        <div className="avatar text-white text-xs shrink-0"
                                            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                            {getInitials(receiver?.full_name)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-white truncate">{receiver?.full_name || req.receiver_id}</p>
                                            <p className="text-[10px] text-[#F59E0B]">Pending...</p>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </motion.div>
                )}

                {/* Friends list */}
                <div>
                    <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-3">
                        🤝 Your Friends
                    </p>
                    {friendships.length === 0 ? (
                        <motion.div
                            className="text-center py-14 rounded-3xl"
                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        >
                            <div className="text-4xl mb-3">👋</div>
                            <p className="text-white font-semibold text-sm mb-1">No friends yet</p>
                            <p className="text-[#475569] text-xs mb-4">Add friends to split expenses &amp; chat</p>
                            <motion.button
                                className="text-xs font-bold px-4 py-2 rounded-full mx-auto"
                                style={{ background: 'rgba(124,58,237,0.15)', color: '#9D5FF3', border: '1px solid rgba(124,58,237,0.3)' }}
                                onClick={() => setShowAddForm(true)}
                                whileTap={{ scale: 0.95 }}
                            >
                                + Add Your First Friend
                            </motion.button>
                        </motion.div>
                    ) : (
                        <div className="space-y-2">
                            {friendships.map((friendship, i) => {
                                const friendId = getFriendIdFromFriendship(friendship)
                                const friendUser = getUserById(friendId)
                                const [c1, c2] = getAvatarColor(friendUser?.full_name || '')

                                // Filter to expenses involving just these two users with NO group_id
                                const sharedExpenses = expenses.filter(e => 
                                    !e.group_id && 
                                    e.expense_splits?.some(s => s.user_id === currentUser?.id) &&
                                    e.expense_splits?.some(s => s.user_id === friendUser?.id)
                                )
                                
                                // Filter to settlements between these two users with NO group_id
                                const sharedSettlements = (pendingSettlements || []).filter(s => 
                                    !s.group_id && s.status === 'completed' &&
                                    ((s.payer_id === currentUser?.id && s.receiver_id === friendUser?.id) || 
                                     (s.payer_id === friendUser?.id && s.receiver_id === currentUser?.id))
                                )

                                const balances = calculateNetBalances(sharedExpenses, sharedSettlements)
                                const myNet = balances[currentUser?.id] || 0

                                return (
                                    <motion.div
                                        key={friendship.id}
                                        className="card cursor-pointer"
                                        whileHover={{ y: -1, borderColor: 'rgba(124,58,237,0.3)' }}
                                        whileTap={{ scale: 0.98 }}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.05 }}
                                        onClick={() => navigate(`/friends/${friendUser?.id}`)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="avatar text-white text-xs shrink-0"
                                                style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                                {getInitials(friendUser?.full_name)}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{friendUser?.full_name}</p>
                                                <p className="text-[10px] text-[#94A3B8]">{friendUser?.email}</p>
                                            </div>
                                            <div className="text-right shrink-0 mx-2">
                                                {Math.abs(myNet) < 1 ? (
                                                    <span className="text-xs font-semibold text-[#10B981]">Settled</span>
                                                ) : myNet > 0 ? (
                                                    <div>
                                                        <p className="text-[10px] text-[#94A3B8] leading-tight mb-0.5">you get</p>
                                                        <p className="font-bold text-xs amount-positive">{formatAmount(myNet)}</p>
                                                    </div>
                                                ) : (
                                                    <div>
                                                        <p className="text-[10px] text-[#94A3B8] leading-tight mb-0.5">you owe</p>
                                                        <p className="font-bold text-xs amount-negative">{formatAmount(-myNet)}</p>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5 shrink-0">
                                                <div
                                                    className="w-8 h-8 rounded-xl flex items-center justify-center"
                                                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.2)' }}
                                                >
                                                    <ChevronRight size={14} className="text-blue-400" />
                                                </div>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Group members note */}
                <motion.p
                    className="text-center text-[10px] text-[#475569] mt-6 px-4"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.4 }}
                >
                    💡 Group members are automatically added as friends when you join a group together
                </motion.p>
            </div>
        </div>
    )
}
