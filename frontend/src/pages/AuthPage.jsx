import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, ArrowLeft, Phone, User, CreditCard, CheckCircle, Shield, AlertCircle } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
    signInWithGoogle,
    sendEmailOtp,
    verifyEmailOtp,
} from '../services/supabase'

const STEPS = {
    LANDING: 'landing',
    EMAIL_OTP: 'email_otp',
    OTP_VERIFY: 'otp_verify',
    PROFILE: 'profile',
    SUCCESS: 'success',
}

export default function AuthPage() {
    const { completeProfile, isSupabaseConfigured } = useApp()

    const [step, setStep] = useState(STEPS.LANDING)
    const [email, setEmail] = useState('')
    const [otp, setOtp] = useState(['', '', '', '', '', ''])
    const [profile, setProfile] = useState({ full_name: '', phone: '', upi_id: '' })
    const [loading, setLoading] = useState(false)
    const [googleLoading, setGLoading] = useState(false)
    const [error, setError] = useState('')
    const [timer, setTimer] = useState(30)
    const [canResend, setCanResend] = useState(false)
    const otpRefs = useRef([])

    /* OTP countdown */
    useEffect(() => {
        if (step !== STEPS.OTP_VERIFY) return
        let t = 30; setTimer(30); setCanResend(false)
        const iv = setInterval(() => { t--; setTimer(t); if (t <= 0) { clearInterval(iv); setCanResend(true) } }, 1000)
        return () => clearInterval(iv)
    }, [step])

    const isValidEmail = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

    /* ── Google Sign-In ── */
    const handleGoogle = async () => {
        setError('')
        if (!isSupabaseConfigured) {
            // Demo mode — skip to profile
            setStep(STEPS.PROFILE)
            return
        }
        setGLoading(true)
        const { error: err } = await signInWithGoogle()
        if (err) { setError(err.message); setGLoading(false) }
        // If no error, page redirects to Google login automatically
    }

    /* ── Send Email OTP ── */
    const handleSendOtp = async () => {
        if (!isValidEmail(email)) { setError('Enter a valid email address'); return }
        setError(''); setLoading(true)

        if (!isSupabaseConfigured) {
            // Demo mode
            await new Promise(r => setTimeout(r, 1200))
            setLoading(false)
            setStep(STEPS.OTP_VERIFY)
            setTimeout(() => otpRefs.current[0]?.focus(), 300)
            return
        }

        const { error: err } = await sendEmailOtp(email)
        setLoading(false)
        if (err) { setError(err.message); return }
        setStep(STEPS.OTP_VERIFY)
        setTimeout(() => otpRefs.current[0]?.focus(), 300)
    }

    /* ── Verify OTP ── */
    const handleVerifyOtp = async () => {
        const token = otp.join('')
        if (token.length < 6) return
        setError(''); setLoading(true)

        if (!isSupabaseConfigured) {
            await new Promise(r => setTimeout(r, 1200))
            setLoading(false)
            setStep(STEPS.PROFILE)
            return
        }

        const { error: err } = await verifyEmailOtp(email, token)
        setLoading(false)
        if (err) { setError('Invalid OTP. Please try again.'); return }
        setStep(STEPS.PROFILE)
    }

    /* ── OTP input handlers ── */
    const handleOtpChange = (i, v) => {
        if (!/^\d*$/.test(v)) return
        const next = [...otp]; next[i] = v.slice(-1); setOtp(next)
        if (v && i < 5) otpRefs.current[i + 1]?.focus()
    }
    const handleOtpKey = (i, e) => {
        if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus()
    }

    /* ── Profile submit ── */
    const handleProfileSubmit = async () => {
        const { full_name, phone, upi_id } = profile
        if (!full_name.trim() || !phone.trim() || !upi_id.trim()) return
        setError(''); setLoading(true)
        const { error: err } = await completeProfile({ email, ...profile })
        setLoading(false)
        if (err) { setError(err.message || 'Something went wrong'); return }
        setStep(STEPS.SUCCESS)
    }

    const slide = {
        initial: { opacity: 0, x: 30 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -30 },
        transition: { duration: 0.25, ease: 'easeInOut' },
    }

    const ErrorBanner = () => error ? (
        <motion.div
            className="flex items-center gap-2 p-3 rounded-xl mb-4"
            style={{ background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.3)' }}
            initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        >
            <AlertCircle size={14} style={{ color: '#F43F5E', flexShrink: 0 }} />
            <p className="text-xs font-medium" style={{ color: '#F43F5E' }}>{error}</p>
        </motion.div>
    ) : null

    return (
        <div className="min-h-dvh animated-bg flex flex-col items-center justify-center px-5 py-10 relative overflow-hidden">

            {/* Background glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />
            <div className="absolute bottom-10 right-0 w-72 h-72 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.08) 0%, transparent 70%)' }} />

            {/* Demo mode banner */}
            {!isSupabaseConfigured && (
                <motion.div
                    className="w-full max-w-sm mb-4 p-3 rounded-2xl text-center"
                    style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)' }}
                    initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                >
                    <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>
                        🧪 Demo Mode — Supabase not connected yet
                    </p>
                </motion.div>
            )}

            {/* Logo */}
            <motion.div className="text-center mb-8" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                <div className="text-5xl mb-3 float">💰</div>
                <h1 className="text-3xl font-extrabold gradient-text">Spliter</h1>
                <p className="text-sm mt-1" style={{ color: '#94A3B8' }}>Split smarter. Settle faster.</p>
            </motion.div>

            {/* Card */}
            <div className="w-full max-w-sm glass rounded-3xl p-7 relative overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
                    style={{ background: 'linear-gradient(90deg, #7C3AED, #3B82F6, #06B6D4)' }} />

                <AnimatePresence mode="wait">

                    {/* ── LANDING ── */}
                    {step === STEPS.LANDING && (
                        <motion.div key="landing" {...slide}>
                            <h2 className="text-xl font-bold text-white mb-1">Welcome! 👋</h2>
                            <p className="text-sm mb-5" style={{ color: '#94A3B8' }}>Sign in or create your account</p>

                            <ErrorBanner />

                            {/* Google button */}
                            <motion.button
                                onClick={handleGoogle}
                                disabled={googleLoading}
                                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-bold text-sm mb-2"
                                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.13)', color: '#F1F5F9' }}
                                whileHover={{ background: 'rgba(255,255,255,0.10)', y: -1 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                {googleLoading
                                    ? <><span className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Connecting...</>
                                    : <>
                                        <svg width="18" height="18" viewBox="0 0 24 24">
                                            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                                            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                        </svg>
                                        Continue with Google
                                    </>
                                }
                            </motion.button>

                            <p className="text-xs px-1 mb-5" style={{ color: '#475569' }}>
                                ✨ Opens a popup showing all Google accounts on your device — tap one & you're in instantly
                            </p>

                            {/* Divider */}
                            <div className="flex items-center gap-3 mb-4">
                                <div className="flex-1 h-[1px]" style={{ background: 'rgba(255,255,255,0.07)' }} />
                                <span className="text-xs font-semibold" style={{ color: '#475569' }}>or sign in with email</span>
                                <div className="flex-1 h-[1px]" style={{ background: 'rgba(255,255,255,0.07)' }} />
                            </div>

                            {/* Email input */}
                            <div className="relative mb-2">
                                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                                <input
                                    type="email"
                                    placeholder="Enter your email address"
                                    value={email}
                                    onChange={e => { setEmail(e.target.value); setError('') }}
                                    onKeyDown={e => e.key === 'Enter' && email && setStep(STEPS.EMAIL_OTP)}
                                    className="input-field"
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>

                            <button
                                className="btn-primary mt-2"
                                onClick={() => { if (!isValidEmail(email)) { setError('Enter a valid email'); return } setError(''); setStep(STEPS.EMAIL_OTP) }}
                                disabled={!email.trim()}
                            >
                                Send OTP to Email →
                            </button>
                        </motion.div>
                    )}

                    {/* ── EMAIL CONFIRM ── */}
                    {step === STEPS.EMAIL_OTP && (
                        <motion.div key="email-otp" {...slide}>
                            <button onClick={() => { setStep(STEPS.LANDING); setError('') }}
                                className="flex items-center gap-1 text-sm mb-5 hover:text-white transition-colors"
                                style={{ color: '#94A3B8' }}>
                                <ArrowLeft size={14} /> Back
                            </button>

                            <div className="mb-5">
                                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
                                    style={{ background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)' }}>
                                    <Mail size={20} style={{ color: '#3B82F6' }} />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-1">Check your email</h2>
                                <p className="text-sm" style={{ color: '#94A3B8' }}>We'll send a 6-digit OTP to</p>
                                <p className="font-bold text-white mt-0.5">{email}</p>
                            </div>

                            <ErrorBanner />

                            <div className="relative mb-4">
                                <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    className="input-field"
                                    style={{ paddingLeft: '40px' }}
                                />
                            </div>

                            <button className="btn-primary" onClick={handleSendOtp} disabled={loading || !isValidEmail(email)}>
                                {loading
                                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Sending...</span>
                                    : '📧 Send OTP'
                                }
                            </button>
                            <p className="text-center text-xs mt-3" style={{ color: '#475569' }}>OTP sent free via Supabase · arrives in &lt;10 seconds</p>
                        </motion.div>
                    )}

                    {/* ── OTP VERIFY ── */}
                    {step === STEPS.OTP_VERIFY && (
                        <motion.div key="otp" {...slide}>
                            <button onClick={() => { setStep(STEPS.EMAIL_OTP); setOtp(['', '', '', '', '', '']); setError('') }}
                                className="flex items-center gap-1 text-sm mb-5 hover:text-white transition-colors"
                                style={{ color: '#94A3B8' }}>
                                <ArrowLeft size={14} /> Back
                            </button>

                            <div className="mb-5">
                                <div className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
                                    style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)' }}>
                                    <Shield size={20} style={{ color: '#9D5FF3' }} />
                                </div>
                                <h2 className="text-xl font-bold text-white mb-1">Enter OTP</h2>
                                <p className="text-sm" style={{ color: '#94A3B8' }}>
                                    Sent to <span className="text-white font-semibold">{email}</span>
                                </p>
                            </div>

                            <ErrorBanner />

                            <div className="flex gap-2 justify-between mb-5">
                                {otp.map((digit, i) => (
                                    <input key={i} ref={el => otpRefs.current[i] = el}
                                        type="tel" maxLength={1} value={digit}
                                        onChange={e => handleOtpChange(i, e.target.value)}
                                        onKeyDown={e => handleOtpKey(i, e)}
                                        className={`otp-input ${digit ? 'filled' : ''}`}
                                    />
                                ))}
                            </div>

                            <button className="btn-primary mb-4" onClick={handleVerifyOtp} disabled={otp.join('').length < 6 || loading}>
                                {loading
                                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Verifying...</span>
                                    : 'Verify OTP ✓'
                                }
                            </button>

                            <p className="text-center text-sm" style={{ color: '#94A3B8' }}>
                                {canResend
                                    ? <button onClick={handleSendOtp} style={{ color: '#9D5FF3' }} className="font-semibold hover:underline">Resend OTP</button>
                                    : <>Resend in <span className="text-white font-semibold">{timer}s</span></>
                                }
                            </p>
                        </motion.div>
                    )}

                    {/* ── PROFILE ── */}
                    {step === STEPS.PROFILE && (
                        <motion.div key="profile" {...slide}>
                            <div className="mb-5">
                                <h2 className="text-xl font-bold text-white mb-1">Complete Profile ✨</h2>
                                <p className="text-sm" style={{ color: '#94A3B8' }}>A few details to get you started</p>
                            </div>

                            <ErrorBanner />

                            <div className="space-y-3 mb-5">
                                {/* Full Name */}
                                <div className="relative">
                                    <User size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                                    <input type="text" placeholder="Full Name"
                                        value={profile.full_name}
                                        onChange={e => setProfile(p => ({ ...p, full_name: e.target.value }))}
                                        className="input-field" style={{ paddingLeft: '40px' }} autoFocus
                                    />
                                </div>

                                {/* Email — readonly */}
                                <div className="relative">
                                    <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                                    <input type="email" value={email} readOnly
                                        className="input-field" style={{ paddingLeft: '40px', opacity: 0.55, cursor: 'default' }}
                                    />
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                                        style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981' }}>verified ✓</span>
                                </div>

                                {/* Phone */}
                                <div>
                                    <div className="flex items-center gap-2">
                                        <div className="flex items-center gap-2 px-3 py-[14px] rounded-2xl shrink-0"
                                            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                                            <span>🇮🇳</span>
                                            <span className="text-white font-semibold text-sm">+91</span>
                                        </div>
                                        <input type="tel" placeholder="Mobile Number (10 digits)"
                                            value={profile.phone}
                                            onChange={e => setProfile(p => ({ ...p, phone: e.target.value.replace(/\D/g, '').slice(0, 10) }))}
                                            className="input-field flex-1"
                                        />
                                    </div>
                                    <p className="text-xs mt-1 pl-1" style={{ color: '#475569' }}>📞 So friends can find you by number</p>
                                </div>

                                {/* UPI ID */}
                                <div>
                                    <div className="relative">
                                        <CreditCard size={15} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: '#94A3B8' }} />
                                        <input type="text" placeholder="UPI ID  (e.g. name@okicici)"
                                            value={profile.upi_id}
                                            onChange={e => setProfile(p => ({ ...p, upi_id: e.target.value }))}
                                            className="input-field" style={{ paddingLeft: '40px' }}
                                        />
                                    </div>
                                    <p className="text-xs mt-1 pl-1" style={{ color: '#475569' }}>💸 Friends pay you directly via Google Pay using this</p>
                                </div>
                            </div>

                            <button className="btn-primary"
                                onClick={handleProfileSubmit}
                                disabled={!profile.full_name.trim() || profile.phone.length < 10 || !profile.upi_id.trim() || loading}
                            >
                                {loading
                                    ? <span className="flex items-center justify-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />Setting up...</span>
                                    : "Let's Go 🚀"
                                }
                            </button>
                        </motion.div>
                    )}

                    {/* ── SUCCESS ── */}
                    {step === STEPS.SUCCESS && (
                        <motion.div key="success" className="text-center py-8" {...slide}>
                            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}
                                transition={{ type: 'spring', stiffness: 220, damping: 12 }}>
                                <CheckCircle size={64} className="mx-auto mb-4" style={{ color: '#10B981' }} />
                            </motion.div>
                            <h2 className="text-xl font-bold text-white mb-2">You're all set! 🎉</h2>
                            <p className="text-sm mb-5" style={{ color: '#94A3B8' }}>Loading your dashboard...</p>
                            <div className="flex justify-center">
                                <span className="w-5 h-5 border-2 rounded-full animate-spin"
                                    style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7C3AED' }} />
                            </div>
                        </motion.div>
                    )}

                </AnimatePresence>
            </div>

            {step === STEPS.LANDING && (
                <motion.p className="text-center text-xs mt-5" style={{ color: '#475569' }}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
                    🔒 Your data is private & never sold
                </motion.p>
            )}
        </div>
    )
}
