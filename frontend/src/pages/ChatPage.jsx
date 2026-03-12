import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Send, Smile, TrendingUp } from 'lucide-react'
import { getAvatarColor, getInitials, formatAmount, calculateNetBalances, simplifyDebts } from '../utils/helpers'
import { supabase } from '../services/supabase'

// Common emoji picker (simple inline)
const QUICK_EMOJIS = ['😀', '😂', '❤️', '👍', '🙏', '🎉', '🔥', '💰', '🍕', '☕', '🏖️', '✈️', '🏠', '🚗', '🎬', '🍔']

export default function ChatPage() {
    const { groupId } = useParams()
    const [searchParams] = useSearchParams()
    const friendshipId = searchParams.get('friendship')
    const navigate = useNavigate()

    const {
        currentUser, getUserById, getGroupById,
        loadChatMessages, sendChatMessage,
        expenses, pendingSettlements, friendships, getFriendIdFromFriendship,
    } = useApp()

    const [messages, setMessages] = useState([])
    const [input, setInput] = useState('')
    const [sending, setSending] = useState(false)
    const [showEmojis, setShowEmojis] = useState(false)
    const messagesEndRef = useRef(null)
    const inputRef = useRef(null)

    // Determine chat type + reference
    const chatType = groupId ? 'group' : 'direct'
    const referenceId = groupId || friendshipId
    const group = groupId ? getGroupById(groupId) : null

    // For direct chats, find the friend
    const friendship = friendshipId ? friendships.find(f => f.id === friendshipId) : null
    const friendId = friendship ? getFriendIdFromFriendship(friendship) : null
    const friendUser = friendId ? getUserById(friendId) : null

    // Chat title
    const chatTitle = group ? group.name : friendUser?.full_name?.split(' ')[0] || 'Chat'
    const chatEmoji = group ? group.emoji : '💬'

    // Calculate balance for the expense banner
    const completedSettlements = pendingSettlements.filter(s => s.status === 'completed')
    let bannerText = ''
    let bannerAmount = 0
    let bannerPositive = true
    let expenseLink = ''

    if (group) {
        const groupExpenses = expenses.filter(e => e.group_id === groupId)
        const groupSettlements = completedSettlements.filter(s => s.group_id === groupId)
        const balances = calculateNetBalances(groupExpenses, groupSettlements)
        bannerAmount = balances[currentUser?.id] || 0
        bannerPositive = bannerAmount >= 0
        bannerText = bannerAmount > 0.01 ? `You're owed ${formatAmount(bannerAmount)}` :
            bannerAmount < -0.01 ? `You owe ${formatAmount(-bannerAmount)}` :
                'All settled up ✅'
        expenseLink = `/groups/${groupId}`
    }

    // Load messages on mount + realtime subscription
    const loadMessages = useCallback(async () => {
        if (!referenceId) return
        const msgs = await loadChatMessages(chatType, referenceId)
        setMessages(msgs)
    }, [chatType, referenceId, loadChatMessages])

    useEffect(() => {
        loadMessages()

        // Subscribe to chat updates for real-time
        const channel = supabase.channel(`chat_${referenceId}`)
            .on('postgres_changes', {
                event: 'UPDATE',
                schema: 'public',
                table: 'chats',
                filter: `reference_id=eq.${referenceId}`,
            }, () => {
                loadMessages()
            })
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'chats',
                filter: `reference_id=eq.${referenceId}`,
            }, () => {
                loadMessages()
            })
            .subscribe()

        // Also poll every 5s for reliability
        const poll = setInterval(loadMessages, 5000)

        return () => {
            supabase.removeChannel(channel)
            clearInterval(poll)
        }
    }, [referenceId, loadMessages])

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = async () => {
        const text = input.trim()
        if (!text || sending) return
        setSending(true)
        setInput('')
        setShowEmojis(false)

        // Optimistic update
        const tempMsg = {
            id: `temp-${Date.now()}`,
            sender: currentUser.id,
            text,
            ts: new Date().toISOString(),
        }
        setMessages(prev => [...prev, tempMsg])

        try {
            await sendChatMessage(chatType, referenceId, text)
            // Reload to get the actual persisted message
            await loadMessages()
        } catch (e) {
            console.error('Send failed:', e)
            // Remove optimistic message on failure
            setMessages(prev => prev.filter(m => m.id !== tempMsg.id))
        } finally {
            setSending(false)
            inputRef.current?.focus()
        }
    }

    const insertEmoji = (emoji) => {
        setInput(prev => prev + emoji)
        inputRef.current?.focus()
    }

    // Group messages by time clusters (5 min gap = new cluster)
    const formatTime = (ts) => {
        const d = new Date(ts)
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    const formatDateHeader = (ts) => {
        const d = new Date(ts)
        const today = new Date()
        if (d.toDateString() === today.toDateString()) return 'Today'
        const yesterday = new Date(today)
        yesterday.setDate(today.getDate() - 1)
        if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
        return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
    }

    return (
        <div className="page" style={{ display: 'flex', flexDirection: 'column', height: '100dvh', background: '#0B0B1A' }}>
            {/* ─── Header ─── */}
            <div className="px-4 pt-10 pb-3 shrink-0" style={{ background: 'rgba(13,13,26,0.95)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-3">
                    <motion.button
                        className="w-9 h-9 rounded-xl glass flex items-center justify-center"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={16} className="text-white" />
                    </motion.button>
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <span className="text-lg">{chatEmoji}</span>
                            <h1 className="text-base font-bold text-white truncate">{chatTitle}</h1>
                        </div>
                        {group && (
                            <p className="text-[10px] text-[#94A3B8] ml-7">{group.members.length} members</p>
                        )}
                    </div>
                </div>

                {/* ─── Expense banner ─── */}
                {(group || friendship) && (
                    <motion.button
                        className="w-full mt-2 py-2 px-3 rounded-xl flex items-center gap-2 text-left"
                        style={{
                            background: bannerPositive
                                ? 'rgba(16,185,129,0.08)'
                                : 'rgba(244,63,94,0.08)',
                            border: `1px solid ${bannerPositive ? 'rgba(16,185,129,0.15)' : 'rgba(244,63,94,0.15)'}`,
                        }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => expenseLink && navigate(expenseLink)}
                    >
                        <TrendingUp size={14} style={{ color: bannerPositive ? '#10B981' : '#F43F5E' }} />
                        <span className="text-[11px] font-semibold flex-1" style={{ color: bannerPositive ? '#10B981' : '#F43F5E' }}>
                            {bannerText}
                        </span>
                        <span className="text-[9px] text-[#94A3B8]">View expenses →</span>
                    </motion.button>
                )}
            </div>

            {/* ─── Messages area ─── */}
            <div className="flex-1 overflow-y-auto px-4 py-3" style={{ scrollBehavior: 'smooth' }}>
                {messages.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-4xl mb-3">💬</div>
                        <p className="text-[#94A3B8] text-sm font-medium">No messages yet</p>
                        <p className="text-[#475569] text-xs mt-1">Say hello to get the conversation started!</p>
                    </div>
                ) : (
                    <>
                        {messages.map((msg, i) => {
                            const isMe = msg.sender === currentUser?.id
                            const senderUser = getUserById(msg.sender)
                            const [c1, c2] = getAvatarColor(senderUser?.full_name || '')
                            const showAvatar = !isMe && (i === 0 || messages[i - 1]?.sender !== msg.sender)
                            const showName = showAvatar

                            // Date header
                            const showDateHeader = i === 0 ||
                                formatDateHeader(msg.ts) !== formatDateHeader(messages[i - 1]?.ts)

                            return (
                                <div key={msg.id}>
                                    {showDateHeader && (
                                        <div className="text-center my-4">
                                            <span className="text-[10px] font-semibold text-[#475569] bg-white/05 px-3 py-1 rounded-full">
                                                {formatDateHeader(msg.ts)}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex items-end gap-2 mb-1 ${isMe ? 'flex-row-reverse' : ''}`}>
                                        {/* Avatar (only for others) */}
                                        {!isMe && (
                                            <div className="shrink-0 w-6">
                                                {showAvatar ? (
                                                    <div
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-[8px] font-bold text-white"
                                                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                                                    >
                                                        {getInitials(senderUser?.full_name)}
                                                    </div>
                                                ) : <div className="w-6" />}
                                            </div>
                                        )}

                                        {/* Bubble */}
                                        <div
                                            className="max-w-[75%] rounded-2xl px-3 py-2"
                                            style={{
                                                background: isMe
                                                    ? 'linear-gradient(135deg, #7C3AED, #3B82F6)'
                                                    : 'rgba(255,255,255,0.07)',
                                                borderBottomRightRadius: isMe ? '6px' : '16px',
                                                borderBottomLeftRadius: isMe ? '16px' : '6px',
                                            }}
                                        >
                                            {showName && (
                                                <p className="text-[9px] font-bold mb-0.5" style={{ color: c1 }}>
                                                    {senderUser?.full_name?.split(' ')[0]}
                                                </p>
                                            )}
                                            <p className="text-[13px] text-white leading-relaxed break-words">
                                                {msg.text}
                                            </p>
                                            <p className="text-[8px] mt-0.5 text-right" style={{ color: isMe ? 'rgba(255,255,255,0.5)' : '#64748B' }}>
                                                {formatTime(msg.ts)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                        <div ref={messagesEndRef} />
                    </>
                )}
            </div>

            {/* ─── Emoji picker ─── */}
            {showEmojis && (
                <motion.div
                    className="px-4 py-2 shrink-0"
                    style={{ background: 'rgba(13,13,26,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                >
                    <div className="flex flex-wrap gap-2">
                        {QUICK_EMOJIS.map(emoji => (
                            <button
                                key={emoji}
                                onClick={() => insertEmoji(emoji)}
                                className="text-xl hover:scale-125 transition-transform w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/05"
                            >
                                {emoji}
                            </button>
                        ))}
                    </div>
                </motion.div>
            )}

            {/* ─── Input bar ─── */}
            <div className="px-3 py-2.5 shrink-0 safe-bottom" style={{ background: 'rgba(13,13,26,0.95)', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div className="flex items-center gap-2">
                    <motion.button
                        onClick={() => setShowEmojis(!showEmojis)}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{ background: showEmojis ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.05)' }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Smile size={18} style={{ color: showEmojis ? '#9D5FF3' : '#94A3B8' }} />
                    </motion.button>
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSend()}
                        placeholder="Type a message..."
                        className="flex-1 bg-white/05 border border-white/08 rounded-xl py-2.5 px-4 text-white text-sm outline-none focus:border-purple-500/40 placeholder:text-[#475569]"
                    />
                    <motion.button
                        onClick={handleSend}
                        disabled={!input.trim() || sending}
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                            background: input.trim() ? 'linear-gradient(135deg, #7C3AED, #3B82F6)' : 'rgba(255,255,255,0.05)',
                            opacity: input.trim() ? 1 : 0.4,
                        }}
                        whileTap={{ scale: 0.9 }}
                    >
                        <Send size={16} className="text-white" />
                    </motion.button>
                </div>
            </div>
        </div>
    )
}
