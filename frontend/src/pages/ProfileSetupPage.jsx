import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { User, CreditCard, CheckCircle, AlertCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'

export default function ProfileSetupPage() {
    const { currentUser, completeProfile } = useApp()
    const navigate = useNavigate()
    const [profile, setProfile] = useState({
        full_name: currentUser?.full_name || '',
        phone: '',
        upi_id: '',
    })
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState('')
    const [done, setDone] = useState(false)
    const [doneMsg, setDoneMsg] = useState('Taking you to your dashboard...')

    const canSubmit = profile.full_name.trim() && profile.phone.length === 10 && profile.upi_id.includes('@')

    const handleSubmit = async () => {
        if (!canSubmit) return
        setError(''); setLoading(true)
        const { error: err, redirectTo } = await completeProfile(profile)
        setLoading(false)
        if (err) { setError(err.message || 'Something went wrong. Try again.'); return }

        // If they came via a group invite link, show a special message and go to the group
        if (redirectTo && redirectTo !== '/') {
            setDoneMsg('Taking you to your group... 👥')
        }
        setDone(true)
        // Slight delay so success animation plays before redirect
        setTimeout(() => navigate(redirectTo || '/', { replace: true }), 1200)
    }

    return (
        <div className="min-h-dvh animated-bg flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">

            {/* Background glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />

            {/* Logo */}
            <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
                <div className="text-5xl mb-3 float">💰</div>
                <h1 className="text-3xl font-extrabold gradient-text">Spliter</h1>
            </motion.div>

            <motion.div
                className="w-full max-w-sm glass rounded-3xl p-7 relative overflow-hidden"
                initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            >
                {/* Top gradient line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
                    style={{ background: 'linear-gradient(90deg, #7C3AED, #3B82F6, #06B6D4)' }} />

                {done ? (
                    <motion.div className="text-center py-6"
                        initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
                            <CheckCircle size={64} className="mx-auto mb-4" style={{ color: '#10B981' }} />
                        </motion.div>
                        <h2 className="text-xl font-bold text-white mb-2">Profile saved! 🎉</h2>
                        <p className="text-sm" style={{ color: '#94A3B8' }}>{doneMsg}</p>
                    </motion.div>
                ) : (
                    <>
                        <div className="mb-6">
                            <h2 className="text-xl font-bold text-white mb-1">Complete your profile ✨</h2>
                            <p className="text-sm" style={{ color: '#94A3B8' }}>
                                Hi{currentUser?.full_name ? `, ${currentUser.full_name.split(' ')[0]}` : ''}! Just a few details to get started.
                            </p>
                        </div>

                        {/* Error banner */}
                        {error && (
                            <motion.div className="flex items-center gap-2 p-3 rounded-xl mb-4"
                                style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}
                                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}>
                                <AlertCircle size={14} style={{ color: '#F43F5E', flexShrink: 0 }} />
                                <p className="text-xs font-medium" style={{ color: '#F43F5E' }}>{error}</p>
                            </motion.div>
                        )}

                        <div className="space-y-4 mb-6">
                            {/* Full Name */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#94A3B8' }}>Full Name</label>
                                <div className="relative">
                                    <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                                    <input type="text" placeholder="e.g. Rahul Sharma"
                                        value={profile.full_name}
                                        onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                                        className="input-field" style={{ paddingLeft: '40px' }} autoFocus
                                    />
                                </div>
                            </div>

                            {/* Phone */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#94A3B8' }}>Mobile Number</label>
                                <div className="flex items-center gap-2">
                                    <div className="flex items-center gap-2 px-3 py-[14px] rounded-2xl shrink-0"
                                        style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                        <span>🇮🇳</span>
                                        <span className="text-white font-semibold text-sm">+91</span>
                                    </div>
                                    <input type="tel" placeholder="10-digit mobile number"
                                        value={profile.phone}
                                        onChange={e => setProfile(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                        className="input-field flex-1"
                                    />
                                </div>
                                <p className="text-xs mt-1 pl-1" style={{ color: '#475569' }}>So friends can find and add you</p>
                            </div>

                            {/* UPI ID */}
                            <div>
                                <label className="text-xs font-semibold uppercase tracking-wider mb-1.5 block" style={{ color: '#94A3B8' }}>UPI ID</label>
                                <div className="relative">
                                    <CreditCard size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                                    <input type="text" placeholder="name@okicici  or  number@ybl"
                                        value={profile.upi_id}
                                        onChange={e => setProfile(p => ({ ...p, upi_id: e.target.value.trim() }))}
                                        className="input-field" style={{ paddingLeft: '40px' }}
                                    />
                                </div>
                                <p className="text-xs mt-1 pl-1" style={{ color: '#475569' }}>
                                    💸 Friends pay you directly via Google Pay using this
                                </p>
                            </div>
                        </div>

                        {/* Checklist */}
                        <div className="flex items-center gap-4 mb-5 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                            {[
                                { label: 'Name', done: !!profile.full_name.trim() },
                                { label: 'Phone', done: profile.phone.length === 10 },
                                { label: 'UPI', done: profile.upi_id.includes('@') },
                            ].map(item => (
                                <div key={item.label} className="flex items-center gap-1.5">
                                    <div className="w-4 h-4 rounded-full flex items-center justify-center"
                                        style={{ background: item.done ? 'rgba(16,185,129,0.2)' : 'rgba(255,255,255,0.06)' }}>
                                        <span style={{ color: item.done ? '#10B981' : '#475569', fontSize: '9px' }}>
                                            {item.done ? '✓' : '○'}
                                        </span>
                                    </div>
                                    <span className="text-xs font-medium" style={{ color: item.done ? '#10B981' : '#475569' }}>
                                        {item.label}
                                    </span>
                                </div>
                            ))}
                        </div>

                        <button className="btn-primary" onClick={handleSubmit}
                            disabled={!canSubmit || loading}>
                            {loading
                                ? <span className="flex items-center justify-center gap-2">
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Saving...
                                </span>
                                : "Let's Go 🚀"
                            }
                        </button>
                    </>
                )}
            </motion.div>
        </div>
    )
}
