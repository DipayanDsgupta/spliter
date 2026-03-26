import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'

export default function SplashScreen({ onFinish }) {
    const [progress, setProgress] = useState(0)

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval)
                    if (onFinish) setTimeout(onFinish, 300)
                    return 100
                }
                return prev + 2
            })
        }, 30)
        return () => clearInterval(interval)
    }, [onFinish])

    return (
        <div className="min-h-dvh flex flex-col items-center justify-center"
            style={{ background: '#0D0D1A' }}>
            
            {/* Animated background orbs */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div
                    className="absolute w-64 h-64 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)', top: '20%', left: '10%' }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                />
                <motion.div
                    className="absolute w-48 h-48 rounded-full"
                    style={{ background: 'radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)', bottom: '25%', right: '15%' }}
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
                />
            </div>

            {/* Logo with animations */}
            <motion.div
                className="relative z-10 flex flex-col items-center"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
            >
                {/* Glow ring behind logo */}
                <motion.div
                    className="absolute w-28 h-28 rounded-3xl"
                    style={{ background: 'rgba(124,58,237,0.15)', filter: 'blur(20px)' }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* Logo */}
                <motion.img
                    src="/logo.jpg"
                    alt="Spliter"
                    className="w-24 h-24 rounded-3xl shadow-2xl relative z-10"
                    style={{ boxShadow: '0 12px 40px rgba(124,58,237,0.4)' }}
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />

                {/* App name */}
                <motion.h1
                    className="text-3xl font-extrabold mt-6 gradient-text"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3, duration: 0.5 }}
                >
                    Spliter
                </motion.h1>

                <motion.p
                    className="text-sm mt-1"
                    style={{ color: '#94A3B8' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                >
                    Split smarter. Settle faster.
                </motion.p>

                {/* Progress bar */}
                <motion.div
                    className="w-48 h-1 rounded-full mt-8 overflow-hidden"
                    style={{ background: 'rgba(255,255,255,0.08)' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                >
                    <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #7C3AED, #3B82F6, #06B6D4)', width: `${progress}%` }}
                        transition={{ duration: 0.1 }}
                    />
                </motion.div>

                <motion.p
                    className="text-xs mt-3 font-medium"
                    style={{ color: '#64748B' }}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                >
                    Loading your data...
                </motion.p>
            </motion.div>
        </div>
    )
}
