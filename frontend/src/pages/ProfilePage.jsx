import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { getAvatarColor, getInitials, formatAmount, calculateNetBalances } from '../utils/helpers'
import { LogOut, Copy, CheckCircle, ChevronRight, Edit2, Save, X } from 'lucide-react'
import { upsertUserProfile } from '../services/supabase'
import toast from 'react-hot-toast'

export default function ProfilePage() {
    const { currentUser, logout, expenses, groups, setCurrentUser } = useApp()
    const [copied, setCopied] = useState(false)
    const [editing, setEditing] = useState(false)
    const [saving, setSaving] = useState(false)
    const [form, setForm] = useState({
        full_name: currentUser?.full_name || '',
        phone: (currentUser?.phone || '').replace('+91', ''),
        upi_id: currentUser?.upi_id || '',
    })

    const [c1, c2] = getAvatarColor(currentUser?.full_name || '')

    const allBalances = calculateNetBalances(expenses)
    const myNet = allBalances[currentUser?.id] || 0
    const totalSpent = expenses
        .flatMap(e => e.splits)
        .filter(s => s.user_id === currentUser?.id)
        .reduce((sum, s) => sum + s.amount_owed, 0)

    const copyUPI = () => {
        navigator.clipboard.writeText(currentUser?.upi_id || '')
        setCopied(true)
        toast.success('UPI ID copied!')
        setTimeout(() => setCopied(false), 2000)
    }

    const startEdit = () => {
        setForm({
            full_name: currentUser?.full_name || '',
            phone: (currentUser?.phone || '').replace('+91', ''),
            upi_id: currentUser?.upi_id || '',
        })
        setEditing(true)
    }

    const cancelEdit = () => setEditing(false)

    const saveProfile = async () => {
        if (!form.full_name.trim() || !form.upi_id.trim()) {
            toast.error('Name and UPI ID are required')
            return
        }
        setSaving(true)
        const updated = {
            id: currentUser.id,
            email: currentUser.email,
            full_name: form.full_name.trim(),
            phone: form.phone ? `+91${form.phone.replace(/\D/g, '').slice(0, 10)}` : '',
            upi_id: form.upi_id.trim(),
            updated_at: new Date().toISOString(),
        }

        if (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
            const { error } = await upsertUserProfile(updated)
            if (error) { toast.error('Failed to save. Try again.'); setSaving(false); return }
        }

        // Update context — reflects immediately everywhere
        if (typeof setCurrentUser === 'function') {
            setCurrentUser(prev => ({ ...prev, ...updated }))
        }
        localStorage.setItem('spliter_user_profile', JSON.stringify(updated))
        setSaving(false)
        setEditing(false)
        toast.success('Profile updated! ✅')
    }

    const stats = [
        { label: 'Groups', value: groups.length },
        { label: 'Total Spent', value: formatAmount(totalSpent) },
        { label: 'Net Balance', value: myNet >= 0 ? `+${formatAmount(myNet)}` : formatAmount(myNet) },
    ]

    return (
        <div className="page animated-bg">
            <div className="px-5 pt-12 pb-6">

                {/* ── Header avatar ── */}
                <motion.div className="text-center mb-6" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
                    <motion.div
                        className="w-24 h-24 rounded-3xl mx-auto flex items-center justify-center text-3xl font-extrabold text-white mb-4 relative"
                        style={{ background: `linear-gradient(135deg, ${c1}, ${c2})`, boxShadow: `0 8px 30px ${c1}50` }}
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 200, delay: 0.1 }}
                    >
                        {getInitials(currentUser?.full_name)}
                        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-400 rounded-full border-2 border-[#0D0D1A]" />
                    </motion.div>
                    <h1 className="text-2xl font-extrabold text-white">{currentUser?.full_name}</h1>
                    <p className="text-[#94A3B8] text-sm mt-1">{currentUser?.phone}</p>
                    <p className="text-[#475569] text-xs mt-0.5">{currentUser?.email}</p>
                </motion.div>

                {/* ── Stats ── */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                    {stats.map((s, i) => (
                        <motion.div key={s.label} className="card text-center py-3"
                            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}>
                            <p className="text-base font-extrabold text-white">{s.value}</p>
                            <p className="text-[10px] text-[#94A3B8] mt-1">{s.label}</p>
                        </motion.div>
                    ))}
                </div>

                {/* ── Profile info card (view / edit) ── */}
                <AnimatePresence mode="wait">
                    {editing ? (
                        /* ─── EDIT MODE ─── */
                        <motion.div key="edit"
                            className="card mb-5"
                            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                            <div className="flex items-center justify-between mb-4">
                                <p className="text-sm font-bold text-white">Edit Profile</p>
                                <button onClick={cancelEdit}
                                    className="w-7 h-7 rounded-full flex items-center justify-center"
                                    style={{ background: 'rgba(255,255,255,0.07)' }}>
                                    <X size={14} className="text-[#94A3B8]" />
                                </button>
                            </div>

                            <div className="space-y-3 mb-4">
                                <div>
                                    <label className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider block mb-1">Full Name</label>
                                    <input type="text" value={form.full_name}
                                        onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                                        className="input-field" placeholder="Your full name" />
                                </div>

                                <div>
                                    <label className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider block mb-1">Mobile Number</label>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-1.5 px-3 py-[14px] rounded-2xl shrink-0"
                                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <span className="text-sm">🇮🇳</span>
                                            <span className="text-white text-sm font-semibold">+91</span>
                                        </div>
                                        <input type="tel" placeholder="10-digit number"
                                            value={form.phone}
                                            onChange={e => setForm(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                            className="input-field flex-1" />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider block mb-1">UPI ID</label>
                                    <input type="text" value={form.upi_id}
                                        onChange={e => setForm(p => ({ ...p, upi_id: e.target.value.trim() }))}
                                        className="input-field" placeholder="name@okicici" />
                                    <p className="text-xs mt-1 text-[#475569]">💸 Used for Google Pay payment links</p>
                                </div>
                            </div>

                            <button className="btn-primary flex items-center justify-center gap-2"
                                onClick={saveProfile} disabled={saving}>
                                {saving
                                    ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Saving...</>
                                    : <><Save size={15} />Save Changes</>
                                }
                            </button>
                        </motion.div>
                    ) : (
                        /* ─── VIEW MODE ─── */
                        <motion.div key="view" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                            {/* UPI card */}
                            <div className="card mb-3"
                                style={{ background: 'rgba(16,185,129,0.07)', borderColor: 'rgba(16,185,129,0.2)' }}>
                                <p className="text-xs text-[#94A3B8] font-semibold uppercase tracking-wider mb-2">💳 Your UPI ID</p>
                                <div className="flex items-center justify-between gap-3">
                                    <p className="font-bold text-white text-base truncate">{currentUser?.upi_id || '—'}</p>
                                    <button onClick={copyUPI}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold shrink-0"
                                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                        {copied ? <CheckCircle size={12} /> : <Copy size={12} />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                            </div>

                            {/* Edit button */}
                            <motion.button
                                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl mb-5 font-semibold text-sm"
                                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#9D5FF3' }}
                                onClick={startEdit} whileTap={{ scale: 0.97 }}>
                                <Edit2 size={14} />
                                Edit Profile — Name, Phone &amp; UPI ID
                            </motion.button>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Settings menu ── */}
                <motion.div className="card mb-5"
                    style={{ padding: 0 }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}>
                    {[
                        { icon: '🔔', label: 'Notifications', action: () => toast('Coming soon!') },
                        { icon: '🔒', label: 'Privacy & Security', action: () => toast('Coming soon!') },
                        { icon: '❓', label: 'Help & Support', action: () => toast('Coming soon!') },
                    ].map((item, i) => (
                        <button key={item.label} onClick={item.action}
                            className="w-full flex items-center gap-3 px-5 py-4 transition-colors"
                            style={{ borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                            <span className="text-lg">{item.icon}</span>
                            <span className="flex-1 text-left text-sm font-medium text-white">{item.label}</span>
                            <ChevronRight size={16} className="text-[#475569]" />
                        </button>
                    ))}
                </motion.div>

                {/* ── Logout ── */}
                <motion.button
                    className="btn-secondary flex items-center justify-center gap-2"
                    style={{ color: '#F43F5E', borderColor: 'rgba(244,63,94,0.3)' }}
                    onClick={() => { if (window.confirm('Log out of Spliter?')) logout() }}
                    whileTap={{ scale: 0.97 }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}>
                    <LogOut size={16} />
                    Sign Out
                </motion.button>

                <p className="text-center text-[#475569] text-xs mt-6">Spliter v1.0 · Built with ❤️</p>
            </div>
        </div>
    )
}
