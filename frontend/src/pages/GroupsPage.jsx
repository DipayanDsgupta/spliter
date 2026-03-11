import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Users, ChevronRight, X, Check } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { calculateNetBalances, formatAmount, getAvatarColor, getInitials } from '../utils/helpers'
import { addPendingMembers } from '../services/supabase'
import toast from 'react-hot-toast'

const EMOJIS = ['🏖️', '🏠', '🎉', '✈️', '🍕', '💼', '🎮', '🏕️', '🚗', '🎯', '🎓', '💊', '🐾', '🛠️', '🎵']
const isEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
const isPhone = v => /^[6-9]\d{9}$/.test(v.replace(/\D/g, ''))

/* ── helpers ── */
const getInviteLink = (group) => `${window.location.origin}/join/${group.id}`

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
    const [inviteInput, setInvite] = useState('')
    const [inviteList, setInviteList] = useState([])
    const [inputError, setInputError] = useState('')
    const [loading, setLoading] = useState(false)
    const [createdGroup, setCreatedGroup] = useState(null)

    const toggleFriend = id => setSelected(p =>
        p.includes(id) ? p.filter(x => x !== id) : [...p, id]
    )

    const addInvite = () => {
        const raw = inviteInput.trim(); if (!raw) return; setInputError('')
        let value = raw, type = ''
        if (isEmail(raw)) { type = 'email'; value = raw.toLowerCase() }
        else if (isPhone(raw)) { type = 'phone'; value = raw.replace(/\D/g, '') }
        else { setInputError('Enter a valid email or 10-digit mobile number'); return }
        if (inviteList.find(i => i.value === value)) { setInputError('Already added'); return }
        setInviteList(p => [...p, {
            value, type,
            label: type === 'email' ? raw : `+91 ${value.slice(0, 5)} ${value.slice(5)}`,
        }])
        setInvite('')
    }
    const removeInvite = v => setInviteList(p => p.filter(i => i.value !== v))

    const create = async () => {
        if (!name.trim()) return
        setLoading(true)

        // Safety: if anything hangs > 10s, force-complete so UI never gets stuck
        const safety = setTimeout(() => {
            setLoading(false)
            toast.error('DB save timed out — run SQL tables in Supabase to persist data.')
        }, 10000)

        try {
            const members = [currentUser.id, ...selected]
            const group = await addGroup({ name: name.trim(), emoji, members })
            if (isSupabaseConfigured && inviteList.length > 0) {
                try { await addPendingMembers(group.id, inviteList, currentUser.id) }
                catch (e) { console.warn('pending invite error', e) }
            }
            clearTimeout(safety)
            setLoading(false)
            setCreatedGroup(group)
            setStep('share')
        } catch (e) {
            clearTimeout(safety)
            setLoading(false)
            toast.error('Something went wrong, please try again.')
        }
    }

    const goToGroup = () => { onClose(); navigate(`/groups/${createdGroup.id}`) }

    const shareWhatsApp = () => {
        const link = getInviteLink(createdGroup)
        const msg = encodeURIComponent(`Hey! I added you to *${createdGroup.name}* on Spliter — split expenses easily! 💰\n\nJoin here 👉 ${link}`)
        window.open(`https://wa.me/?text=${msg}`, '_blank')
    }
    const shareSMS = () => {
        const link = getInviteLink(createdGroup)
        const msg = encodeURIComponent(`Join "${createdGroup.name}" on Spliter 👉 ${link}`)
        window.open(`sms:?body=${msg}`, '_blank')
    }
    const copyLink = async () => {
        await navigator.clipboard.writeText(getInviteLink(createdGroup))
        toast.success('Invite link copied! 📋')
    }
    const nativeShare = async () => {
        const link = getInviteLink(createdGroup)
        if (navigator.share) {
            await navigator.share({ title: `Join ${createdGroup.name} on Spliter`, text: `Split expenses with me! 💰`, url: link })
        } else { await copyLink() }
    }

    return (
        <motion.div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={step === 'share' ? goToGroup : onClose} />

            <motion.div className="relative w-full max-w-lg z-10 rounded-t-3xl sm:rounded-3xl flex flex-col"
                style={{ background: '#141428', border: '1px solid rgba(255,255,255,0.10)', maxHeight: '90dvh' }}
                initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 28, stiffness: 320 }}>

                {/* Top gradient */}
                <div className="h-[2px] w-full shrink-0 rounded-t-3xl"
                    style={{ background: 'linear-gradient(90deg, #7C3AED, #3B82F6, #06B6D4)' }} />
                <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-3 shrink-0" />

                <AnimatePresence mode="wait">

                    {/* ── SHARE SHEET ── */}
                    {step === 'share' && createdGroup && (
                        <motion.div key="share" className="px-6 pt-4 pb-6"
                            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="text-center mb-6">
                                <div className="text-5xl mb-3">{createdGroup.emoji}</div>
                                <h2 className="text-xl font-bold text-white mb-1">"{createdGroup.name}" created! 🎉</h2>
                                <p className="text-sm" style={{ color: '#94A3B8' }}>Invite friends to join</p>
                            </div>

                            {/* Invite link preview */}
                            <div className="flex items-center gap-2 p-3 rounded-2xl mb-5"
                                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                                <p className="text-xs flex-1 truncate font-mono" style={{ color: '#9D5FF3' }}>
                                    {getInviteLink(createdGroup)}
                                </p>
                                <button onClick={copyLink} className="px-3 py-1.5 rounded-xl text-xs font-bold shrink-0"
                                    style={{ background: 'rgba(124,58,237,0.2)', color: '#9D5FF3' }}>
                                    Copy
                                </button>
                            </div>

                            {/* Share buttons */}
                            <div className="grid grid-cols-2 gap-3 mb-5">
                                <motion.button onClick={shareWhatsApp} whileTap={{ scale: 0.96 }}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm"
                                    style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.25)', color: '#25D366' }}>
                                    <span className="text-lg">📱</span> WhatsApp
                                </motion.button>

                                <motion.button onClick={shareSMS} whileTap={{ scale: 0.96 }}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm"
                                    style={{ background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.25)', color: '#60A5FA' }}>
                                    <span className="text-lg">💬</span> SMS
                                </motion.button>

                                <motion.button onClick={nativeShare} whileTap={{ scale: 0.96 }}
                                    className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-sm col-span-2"
                                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#F1F5F9' }}>
                                    <span className="text-lg">🔗</span> Share via any app
                                </motion.button>
                            </div>

                            {inviteList.length > 0 && (
                                <div className="p-3 rounded-2xl mb-4"
                                    style={{ background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)' }}>
                                    <p className="text-xs font-semibold" style={{ color: '#10B981' }}>
                                        ✅ {inviteList.length} email/phone invite{inviteList.length > 1 ? 's' : ''} saved —
                                        they'll auto-join when they sign up!
                                    </p>
                                </div>
                            )}

                            <button className="btn-primary" onClick={goToGroup}>Open Group →</button>
                        </motion.div>
                    )}

                    {/* ── FORM ── */}
                    {step === 'form' && (
                        <motion.div key="form" className="flex flex-col flex-1 overflow-hidden" exit={{ opacity: 0 }}>
                            {/* Scrollable body */}
                            <div className="overflow-y-auto flex-1 px-6 pt-4 pb-2">

                                <div className="flex items-center justify-between mb-5">
                                    <h2 className="text-xl font-bold text-white">New Group</h2>
                                    <button onClick={onClose}
                                        className="w-8 h-8 rounded-full flex items-center justify-center"
                                        style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)' }}>
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

                                {/* Add by email/phone */}
                                <div className="mb-5">
                                    <div className="flex items-center gap-2 mb-2">
                                        <p className="label-xs">Add by Email or Phone</p>
                                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                                            style={{ background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
                                            works even if not signed up
                                        </span>
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="email@example.com or 9876543210"
                                            value={inviteInput}
                                            onChange={e => { setInvite(e.target.value); setInputError('') }}
                                            onKeyDown={e => e.key === 'Enter' && addInvite()}
                                            className="input-field flex-1" style={{ fontSize: '13px' }} />
                                        <button onClick={addInvite}
                                            className="px-4 rounded-2xl font-bold text-sm shrink-0"
                                            style={{ background: 'rgba(124,58,237,0.2)', color: '#9D5FF3', border: '1px solid rgba(124,58,237,0.35)' }}>
                                            Add
                                        </button>
                                    </div>
                                    {inputError && <p className="text-xs mt-1.5 pl-1" style={{ color: '#F43F5E' }}>{inputError}</p>}

                                    {/* Pending invite list */}
                                    {inviteList.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {inviteList.map(inv => (
                                                <div key={inv.value}
                                                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
                                                    style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)' }}>
                                                    <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                                                        style={{ background: 'rgba(59,130,246,0.15)' }}>
                                                        {inv.type === 'email' ? '📧' : '📱'}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-white text-sm font-medium truncate">{inv.label}</p>
                                                        <p className="text-[#475569] text-xs">
                                                            {inv.type === 'email' ? 'Will auto-join on sign-up' : 'Will auto-join when they register'}
                                                        </p>
                                                    </div>
                                                    <button onClick={() => removeInvite(inv.value)}
                                                        className="w-6 h-6 rounded-full flex items-center justify-center shrink-0"
                                                        style={{ background: 'rgba(244,63,94,0.12)' }}>
                                                        <X size={11} style={{ color: '#F43F5E' }} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {inviteList.length === 0 && (
                                        <div className="mt-3 p-3 rounded-xl"
                                            style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.07)' }}>
                                            <p className="text-xs" style={{ color: '#475569' }}>
                                                💡 <strong style={{ color: '#64748B' }}>How it works:</strong> Friend gets a shareable link. When they sign up with the same email/phone, they auto-join this group.
                                            </p>
                                        </div>
                                    )}
                                </div>

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
                            <div className="px-6 py-4 shrink-0"
                                style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: '#141428' }}>
                                {(selected.length + inviteList.length) > 0 && (
                                    <p className="text-xs text-center mb-2" style={{ color: '#64748B' }}>
                                        Group: you + {selected.length} friend{selected.length !== 1 ? 's' : ''}
                                        {inviteList.length > 0 && ` + ${inviteList.length} invite${inviteList.length > 1 ? 's' : ''}`}
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
   GROUPS PAGE
══════════════════════════════════════════ */
export default function GroupsPage() {
    const navigate = useNavigate()
    const { groups, expenses, currentUser } = useApp()
    const [search, setSearch] = useState('')
    const [showCreate, setShowCreate] = useState(false)

    const filtered = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))

    return (
        <div className="page animated-bg">
            <div className="px-5 pt-12 pb-6">

                {/* Header */}
                <motion.div className="flex items-center justify-between mb-6"
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <div>
                        <h1 className="text-2xl font-extrabold text-white">Groups</h1>
                        <p className="text-[#94A3B8] text-sm mt-1">
                            {groups.length === 0 ? 'No groups yet' : `${groups.length} active group${groups.length !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                    <motion.button
                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl font-bold text-sm text-white"
                        style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                        whileHover={{ scale: 1.03, boxShadow: '0 6px 20px rgba(124,58,237,0.4)' }}
                        whileTap={{ scale: 0.96 }}
                        onClick={() => setShowCreate(true)}>
                        <Plus size={18} /> New Group
                    </motion.button>
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
                            Create a group for trips, flatmates, or any shared expenses
                        </p>
                        <motion.button className="px-6 py-3 rounded-2xl font-bold text-sm text-white"
                            style={{ background: 'linear-gradient(135deg, #7C3AED, #3B82F6)' }}
                            onClick={() => setShowCreate(true)} whileTap={{ scale: 0.97 }}>
                            + Create your first group
                        </motion.button>
                    </motion.div>
                )}

                {/* Groups list */}
                <div className="space-y-3">
                    {filtered.map((group, i) => {
                        const groupExpenses = expenses.filter(e => e.group_id === group.id)
                        const balances = calculateNetBalances(groupExpenses)
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
            </AnimatePresence>
        </div>
    )
}
