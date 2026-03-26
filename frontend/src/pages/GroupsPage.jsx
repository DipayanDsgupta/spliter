import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, ChevronRight, X, Check, Camera } from 'lucide-react'
import { useApp } from '../context/AppContext'
import PullToRefresh from '../components/PullToRefresh'
import { calculateNetBalances, formatAmount, getAvatarColor, getInitials } from '../utils/helpers'
import { addPendingMembers } from '../services/supabase'
import toast from 'react-hot-toast'
import { QRCodeSVG } from 'qrcode.react'

const EMOJIS = ['🏖️', '🏠', '🎉', '✈️', '🍕', '💼', '🎮', '🏕️', '🚗', '🎯', '🎓', '💊', '🐾', '🛠️', '🎵']

/* ══════════════════════════════════════════
   CREATE GROUP MODAL
══════════════════════════════════════════ */
function CreateGroupModal({ onClose }) {
    const { addGroup, friends, currentUser, isSupabaseConfigured } = useApp()
    const navigate = useNavigate()

    const [step, setStep] = useState('form')    // 'form' | 'share'
    const [name, setName] = useState('')
    const [emoji, setEmoji] = useState('🎯')
    const [selected, setSelected] = useState([])
    const [loading, setLoading] = useState(false)
    const [createdGroup, setCreatedGroup] = useState(null)

    const toggleFriend = id => setSelected(p =>
        p.includes(id) ? p.filter(x => x !== id) : [...p, id]
    )

    const create = async () => {
        if (!name.trim()) return
        setLoading(true)
        const safety = setTimeout(() => {
            setLoading(false)
            toast.error('DB save timed out.')
        }, 10000)
        try {
            const members = [currentUser.id, ...selected]
            const group = await addGroup({ name: name.trim(), emoji, members })
            clearTimeout(safety)
            setLoading(false)
            setCreatedGroup(group)
            setStep('share')
        } catch (e) {
            clearTimeout(safety)
            setLoading(false)
            toast.error(`ERROR: ${e?.message || 'Unknown'}`)
        }
    }

    const goToGroup = () => { onClose(); navigate(`/groups/${createdGroup.id}`) }

    const shareWhatsApp = () => {
        const msg = encodeURIComponent(`Hey! Join my group *${createdGroup.name}* on Spliter — split expenses easily! 💰\n\nGroup ID: ${createdGroup.id}\n\nDownload the app and use this ID to join!`)
        window.open(`https://wa.me/?text=${msg}`, '_blank')
    }
    const copyId = async () => {
        await navigator.clipboard.writeText(createdGroup.id)
        toast.success('Group ID copied! 📋')
    }
    const nativeShare = async () => {
        if (navigator.share) {
            await navigator.share({ title: `Join ${createdGroup.name} on Spliter`, text: `Split expenses easily on Spliter! 💰\n\nGroup ID: ${createdGroup.id}\n\nDownload the app and use this ID to join!` })
        } else { await copyId() }
    }

    return (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step === 'share' ? goToGroup : onClose} />

            <motion.div className="relative w-full max-w-sm z-10 rounded-3xl flex flex-col"
                style={{ background: '#141428', border: '1px solid rgba(255,255,255,0.10)', maxHeight: '85dvh' }}
                initial={{ y: 50, scale: 0.95, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 20, scale: 0.95, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}>

                <AnimatePresence mode="wait">

                    {/* ── SHARE SHEET ── */}
                    {step === 'share' && createdGroup && (
                        <motion.div key="share" className="px-6 pt-6 pb-6"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="text-center mb-5">
                                <div className="text-5xl mb-3">{createdGroup.emoji}</div>
                                <h2 className="text-xl font-bold text-white mb-1">"{createdGroup.name}" created! 🎉</h2>
                                <p className="text-sm" style={{ color: '#94A3B8' }}>Invite friends to join</p>
                            </div>

                            {/* QR Code */}
                            <div className="flex justify-center mb-5">
                                <div className="bg-white p-3 rounded-2xl">
                                    <QRCodeSVG
                                        value={`spliter://join/${createdGroup.id}`}
                                        size={160}
                                        bgColor="#ffffff"
                                        fgColor="#0D0D1A"
                                        level="M"
                                    />
                                </div>
                            </div>
                            <p className="text-center text-[10px] text-[#64748B] mb-4">Scan this QR to join the group</p>

                            {/* Invite link preview */}
                            <div className="flex items-center gap-2 p-3 rounded-2xl mb-4"
                                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                                <p className="text-xs flex-1 truncate font-mono" style={{ color: '#9D5FF3' }}>
                                    {createdGroup.id}
                                </p>
                                <button onClick={copyId} className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0"
                                    style={{ background: 'rgba(124,58,237,0.2)', color: '#9D5FF3' }}>
                                    Copy ID
                                </button>
                            </div>

                            {/* Share buttons */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <motion.button onClick={shareWhatsApp} whileTap={{ scale: 0.96 }}
                                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm"
                                    style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>
                                    📱 WhatsApp
                                </motion.button>
                                <motion.button onClick={nativeShare} whileTap={{ scale: 0.96 }}
                                    className="flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F1F5F9' }}>
                                    🔗 Share
                                </motion.button>
                            </div>

                            <button className="btn-primary" onClick={goToGroup}>Open Group →</button>
                        </motion.div>
                    )}

                    {/* ── FORM ── */}
                    {step === 'form' && (
                        <motion.div key="form" className="flex flex-col flex-1 overflow-hidden" exit={{ opacity: 0 }}>
                            <div className="overflow-y-auto flex-1 px-6 pt-6 pb-2">
                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-xl font-extrabold text-white">New Group</h2>
                                    <button onClick={onClose} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                                        <X size={16} className="text-[#94A3B8]" />
                                    </button>
                                </div>

                                {/* Emoji picker */}
                                <p className="label-xs mb-2">Pick an icon</p>
                                <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
                                    {EMOJIS.map(e => (
                                        <button key={e} onClick={() => setEmoji(e)}
                                            className="w-10 h-10 rounded-xl text-xl shrink-0 transition-all"
                                            style={{
                                                background: emoji === e ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.05)',
                                                border: `2px solid ${emoji === e ? '#7C3AED' : 'rgba(255,255,255,0.08)'}`,
                                                transform: emoji === e ? 'scale(1.15)' : 'scale(1)',
                                            }}>
                                            {e}
                                        </button>
                                    ))}
                                </div>

                                {/* Group name */}
                                <p className="label-xs mb-2">Group Name</p>
                                <input type="text" placeholder="e.g. Goa Trip 2025, Flat Expenses..."
                                    value={name} onChange={e => setName(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && name.trim() && create()}
                                    className="input-field mb-5" autoFocus />

                                {/* Existing friends */}
                                {friends.length > 0 && (
                                    <div className="mb-4">
                                        <p className="label-xs mb-2">Friends on Spliter
                                            <span className="text-[#475569] normal-case font-normal"> (already have accounts)</span>
                                        </p>
                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            {friends.map(f => {
                                                const isSel = selected.includes(f.id)
                                                const [c1, c2] = getAvatarColor(f.full_name)
                                                return (
                                                    <button key={f.id} onClick={() => toggleFriend(f.id)}
                                                        className="w-full flex items-center gap-3 p-3 rounded-xl transition-all"
                                                        style={{
                                                            background: isSel ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                                                            border: `1px solid ${isSel ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.06)'}`,
                                                        }}>
                                                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                                                            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                                            {getInitials(f.full_name)}
                                                        </div>
                                                        <div className="flex-1 text-left">
                                                            <p className="text-white text-sm font-medium">{f.full_name}</p>
                                                            {f.phone && <p className="text-[#475569] text-xs">{f.phone}</p>}
                                                        </div>
                                                        <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                                                            style={{ background: isSel ? '#7C3AED' : 'rgba(255,255,255,0.08)' }}>
                                                            {isSel && <Check size={11} className="text-white" />}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Sticky Create button */}
                            <div className="px-6 py-4 shrink-0 mt-auto"
                                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#141428' }}>
                                {selected.length > 0 && (
                                    <p className="text-xs text-center mb-2" style={{ color: '#64748B' }}>
                                        Group: you + {selected.length} friend{selected.length !== 1 ? 's' : ''}
                                    </p>
                                )}
                                <button className="btn-primary flex items-center justify-center gap-2"
                                    onClick={create} disabled={!name.trim() || loading}>
                                    {loading
                                        ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating...</>
                                        : <><Plus size={16} /> Create Group</>
                                    }
                                </button>
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </motion.div>
        </motion.div>
    )
}

/* ══════════════════════════════════════════
   JOIN GROUP MODAL (with QR Scanner)
══════════════════════════════════════════ */
function JoinGroupModal({ onClose }) {
    const { joinGroup } = useApp()
    const navigate = useNavigate()
    const [groupId, setGroupId] = useState('')
    const [loading, setLoading] = useState(false)
    const [scanning, setScanning] = useState(false)
    const scannerRef = useRef(null)
    const scannerInstanceRef = useRef(null)

    const handleJoin = async (idToJoin) => {
        const gid = (idToJoin || groupId).trim()
        if (!gid) return
        setLoading(true)
        try {
            const group = await joinGroup(gid)
            toast.success(`Joined ${group.name}!`)
            onClose()
            navigate(`/groups/${group.id}`)
        } catch (e) {
            toast.error(e.message || 'Invalid ID or already joined')
            setLoading(false)
        }
    }

    const startScanner = async () => {
        // Request camera permission first
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
            // Got permission — stop the preview stream, html5-qrcode will start its own
            stream.getTracks().forEach(t => t.stop())
        } catch (permErr) {
            console.warn('Camera permission denied:', permErr)
            if (permErr.name === 'NotAllowedError') {
                toast.error('Camera permission denied. Please allow camera access in your device settings.')
            } else if (permErr.name === 'NotFoundError') {
                toast.error('No camera found on this device.')
            } else {
                toast.error('Could not access camera. Please check permissions.')
            }
            return
        }

        setScanning(true)
        const { Html5Qrcode } = await import('html5-qrcode')
        setTimeout(async () => {
            try {
                const scanner = new Html5Qrcode('qr-reader')
                scannerInstanceRef.current = scanner
                await scanner.start(
                    { facingMode: 'environment' },
                    { fps: 10, qrbox: { width: 220, height: 220 } },
                    (decodedText) => {
                        let id = decodedText
                        if (decodedText.startsWith('spliter://join/')) {
                            id = decodedText.replace('spliter://join/', '')
                        }
                        scanner.stop().catch(() => {})
                        scannerInstanceRef.current = null
                        setScanning(false)
                        setGroupId(id)
                        handleJoin(id)
                    },
                    () => {}
                )
            } catch (e) {
                console.warn('Scanner start error:', e)
                toast.error('Scanner failed to start. Try again.')
                setScanning(false)
            }
        }, 200)
    }

    const stopScanner = () => {
        if (scannerInstanceRef.current) {
            scannerInstanceRef.current.stop().catch(() => {})
            scannerInstanceRef.current = null
        }
        setScanning(false)
    }

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (scannerInstanceRef.current) {
                scannerInstanceRef.current.stop().catch(() => {})
            }
        }
    }, [])

    return (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { stopScanner(); onClose() }} />
            <motion.div className="relative w-full max-w-sm z-10 p-6 rounded-3xl"
                style={{ background: '#141428', border: '1px solid rgba(255,255,255,0.10)' }}
                initial={{ y: 50, scale: 0.95, opacity: 0 }} animate={{ y: 0, scale: 1, opacity: 1 }}
                exit={{ y: 20, scale: 0.95, opacity: 0 }}>
                <div className="flex justify-between items-center mb-5">
                    <h2 className="text-xl font-extrabold text-white">Join Group</h2>
                    <button onClick={() => { stopScanner(); onClose() }} className="p-2 bg-white/5 rounded-full hover:bg-white/10">
                        <X size={16} className="text-[#94A3B8]" />
                    </button>
                </div>

                {scanning ? (
                    <div>
                        <div id="qr-reader" ref={scannerRef}
                            className="rounded-2xl overflow-hidden mb-4"
                            style={{ border: '2px solid rgba(124,58,237,0.3)' }} />
                        <p className="text-xs text-center text-[#94A3B8] mb-4">Point your camera at a Spliter QR code</p>
                        <button onClick={stopScanner}
                            className="w-full py-3 rounded-2xl text-sm font-bold text-[#94A3B8] bg-white/5 border border-white/10">
                            Cancel Scan
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Scan QR button */}
                        <motion.button onClick={startScanner} whileTap={{ scale: 0.96 }}
                            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm mb-4"
                            style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#9D5FF3' }}>
                            <Camera size={18} /> Scan QR Code
                        </motion.button>

                        <div className="flex items-center gap-3 mb-4">
                            <div className="h-[1px] flex-1 bg-white/10" />
                            <span className="text-xs text-[#64748B] font-medium">or enter ID</span>
                            <div className="h-[1px] flex-1 bg-white/10" />
                        </div>

                        <div className="mb-5">
                            <p className="text-xs text-[#94A3B8] mb-3">Paste the Group ID shared by your friend.</p>
                            <input type="text" placeholder="Enter group ID..."
                                value={groupId} onChange={e => setGroupId(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleJoin()}
                                className="input-field w-full font-mono text-sm" autoFocus />
                        </div>
                        <button onClick={() => handleJoin()} disabled={!groupId.trim() || loading}
                            className="btn-primary w-full">
                            {loading ? 'Joining...' : 'Join Group 🚀'}
                        </button>
                    </>
                )}
            </motion.div>
        </motion.div>
    )
}

/* ══════════════════════════════════════════
   GROUPS PAGE
══════════════════════════════════════════ */
export default function GroupsPage() {
    const navigate = useNavigate()
    const { groups, expenses, currentUser, pendingSettlements, sponsorships, manualRefresh } = useApp()
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)
    const [showJoin, setShowJoin] = useState(false)

    const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <PullToRefresh onRefresh={manualRefresh}>
            <div className="page animated-bg">
                <div className="px-5 pt-12 pb-24">

                    {/* Header */}
                    <motion.div className="flex items-center justify-between mb-6"
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                        <div>
                            <h1 className="text-2xl font-extrabold text-white">Groups</h1>
                            <p className="text-[#94A3B8] text-sm mt-1">
                                {groups.length === 0 ? 'No groups yet' : `${groups.length} active group${groups.length !== 1 ? 's' : ''}`}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                        <motion.button
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl font-bold text-sm text-[#94A3B8] bg-white/5 hover:bg-white/10 border border-white/5 shadow-md"
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setShowJoin(true)}>
                            Join
                        </motion.button>
                        <motion.button
                            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-2xl font-bold text-sm text-white shadow-md shadow-purple-500/20"
                            style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => setShowCreate(true)}>
                            <Plus size={16} /> New
                        </motion.button>
                    </div>
                </motion.div>

                {/* Search */}
                {groups.length > 0 && (
                    <div className="relative mb-6">
                        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
                        <input type="text" placeholder="Search groups..."
                            value={search} onChange={e => setSearch(e.target.value)}
                            className="input-field" style={{ paddingLeft: '40px' }} />
                    </div>
                )}

                {/* Empty state */}
                {groups.length === 0 && (
                    <motion.div className="text-center py-16 rounded-3xl mt-4"
                        style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="text-5xl mb-4">👥</div>
                        <p className="text-white font-bold text-lg mb-2">No groups yet</p>
                        <p className="text-[#94A3B8] text-sm mb-6 max-w-xs mx-auto">
                            Create a group for trips, flatmates, or join an existing one
                        </p>
                        <div className="flex flex-col gap-3 w-4/5 mx-auto">
                            <motion.button className="w-full px-6 py-3 rounded-2xl font-bold text-sm text-white shadow-md shadow-purple-500/20"
                                style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                                onClick={() => setShowCreate(true)} whileTap={{ scale: 0.97 }}>
                                + Create New Group
                            </motion.button>
                            <motion.button className="w-full px-6 py-3 rounded-2xl font-bold text-sm text-[#94A3B8] bg-white/5 border border-white/10"
                                onClick={() => setShowJoin(true)} whileTap={{ scale: 0.97 }}>
                                Join with Group ID
                            </motion.button>
                        </div>
                    </motion.div>
                )}

                {/* Groups list */}
                <div className="space-y-3">
                    {filtered.map((group, i) => {
                        const groupExpenses = expenses.filter(e => e.group_id === group.id)
                        const groupCompletedSettlements = (pendingSettlements || []).filter(s => s.group_id === group.id && s.status === 'completed')
                        const groupSponsorships = (sponsorships || []).filter(s => s.group_id === group.id)
                        const balances = calculateNetBalances(groupExpenses, groupCompletedSettlements, groupSponsorships)
                        const myNet = balances[currentUser?.id] || 0
                        return (
                            <motion.button key={group.id} className="w-full card text-left"
                                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.06 }}
                                whileHover={{ y: -2, borderColor: 'rgba(124,58,237,0.3)' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => navigate(`/groups/${group.id}`)}>
                                <div className="flex items-center gap-4">
                                    <div className="text-3xl">{group.emoji}</div>
                                    <div className="flex-1 min-w-0">
                                        <h3 className="font-bold text-white text-[15px] truncate">{group.name}</h3>
                                        <div className="flex items-center gap-2 mt-1">
                                            <Users size={11} className="text-[#94A3B8]" />
                                            <span className="text-xs text-[#94A3B8]">{group.members.length} member{group.members.length !== 1 ? 's' : ''}</span>
                                            <span className="text-[#475569]">·</span>
                                            <span className="text-xs text-[#94A3B8]">{groupExpenses.length} expense{groupExpenses.length !== 1 ? 's' : ''}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="text-right">
                                            {Math.abs(myNet) < 1
                                                ? <span className="text-xs font-semibold text-[#10B981]">✓ Settled</span>
                                                : myNet > 0
                                                    ? <><p className="text-[10px] text-[#94A3B8]">you get</p><p className="font-bold text-sm amount-positive">{formatAmount(myNet)}</p></>
                                                    : <><p className="text-[10px] text-[#94A3B8]">you owe</p><p className="font-bold text-sm amount-negative">{formatAmount(-myNet)}</p></>
                                            }
                                        </div>
                                        <ChevronRight size={16} className="text-[#475569]" />
                                    </div>
                                </div>
                                <div className="flex items-center mt-3">
                                    {group.members.slice(0, 7).map((mid, mi) => {
                                        const [c1, c2] = getAvatarColor(mid)
                                        return (
                                            <div key={mid} className="w-6 h-6 rounded-full border-2 shrink-0"
                                                style={{
                                                    background: `linear-gradient(135deg, ${c1}, ${c2})`,
                                                    borderColor: '#141428', marginLeft: mi > 0 ? '-5px' : '0',
                                                }} />
                                        )
                                    })}
                                    {group.members.length > 7 && <span className="text-[10px] text-[#475569] ml-1">+{group.members.length - 7}</span>}
                                </div>
                            </motion.button>
                        )
                    })}
                </div>

                {filtered.length === 0 && groups.length > 0 && (
                    <div className="text-center py-12">
                        <p className="text-white font-semibold">No results for "{search}"</p>
                        <p className="text-[#94A3B8] text-sm mt-1">Try a different name</p>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showCreate && <CreateGroupModal onClose={() => setShowCreate(false)} />}
                {showJoin && <JoinGroupModal onClose={() => setShowJoin(false)} />}
            </AnimatePresence>
            </div>
        </PullToRefresh>
    )
}
