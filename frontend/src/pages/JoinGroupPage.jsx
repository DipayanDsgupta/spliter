import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { supabase } from '../services/supabase'

/**
 * /join/:groupId
 *
 * Opened when a friend clicks the invite link.
 * - If already logged in AND profile complete → add to group, go to group page
 * - If not logged in → save groupId to sessionStorage, go to /auth
 *   AppContext will pick it up after login and add the user
 */
export default function JoinGroupPage() {
    const { groupId } = useParams()
    const { currentUser, needsProfile, isLoading } = useApp()
    const navigate = useNavigate()
    const [status, setStatus] = useState('loading') // 'loading' | 'joining' | 'redirecting'

    useEffect(() => {
        if (isLoading) return

        if (!currentUser || needsProfile) {
            // Save the group to claim after sign-up
            sessionStorage.setItem('spliter_join_group', groupId)
            navigate('/auth', { replace: true })
            return
        }

        // Already logged in — add to group and redirect
        const joinGroup = async () => {
            setStatus('joining')
            await supabase
                .from('group_members')
                .upsert(
                    { group_id: groupId, user_id: currentUser.id },
                    { onConflict: 'group_id,user_id', ignoreDuplicates: true }
                )
            setStatus('redirecting')
            setTimeout(() => navigate(`/groups/${groupId}`, { replace: true }), 1000)
        }

        joinGroup()
    }, [isLoading, currentUser, needsProfile, groupId, navigate])

    const messages = {
        loading: 'Loading...',
        joining: 'Joining the group...',
        redirecting: 'Done! Taking you to the group 🎉',
    }

    return (
        <div className="min-h-dvh animated-bg flex flex-col items-center justify-center gap-5">
            <motion.div
                className="text-6xl float"
                initial={{ scale: 0 }} animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200 }}
            >
                👥
            </motion.div>
            <div className="text-center">
                <h1 className="text-xl font-bold text-white mb-1">You've been invited!</h1>
                <p className="text-sm" style={{ color: '#94A3B8' }}>{messages[status]}</p>
            </div>
            <div className="w-8 h-8 border-2 rounded-full animate-spin"
                style={{ borderColor: 'rgba(124,58,237,0.3)', borderTopColor: '#7C3AED' }} />
        </div>
    )
}
