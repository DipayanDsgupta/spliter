import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CATEGORIES, getAvatarColor, getInitials, formatAmount } from '../utils/helpers'
import toast from 'react-hot-toast'

const SPLIT_METHODS = [
    { id: 'equal', label: 'Equally' },
    { id: 'unequal', label: 'Unequal' },
]

export default function EditExpensePage() {
    const { expenseId } = useParams()
    const navigate = useNavigate()
    const { expenses, updateExpense, groups, currentUser, getUserById } = useApp()

    const expense = expenses.find(e => e.id === expenseId)
    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState('')
    const [category, setCategory] = useState('food')
    const [note, setNote] = useState('')
    const [splitMethod, setSplitMethod] = useState('equal')
    const [participants, setParticipants] = useState([])
    const [payers, setPayers] = useState([])
    const [payerAmounts, setPayerAmounts] = useState({})
    const [unequalAmounts, setUnequalAmounts] = useState({})
    const [loading, setLoading] = useState(false)

    const group = expense?.group_id ? groups.find(g => g.id === expense.group_id) : null
    const expenseParticipantIds = [...new Set([...(expense?.splits?.map(s => s.user_id) || []), ...(expense?.paid_by?.map(p => p.user_id) || [])])]
    const groupMembers = group 
        ? group.members.map(id => getUserById(id)).filter(Boolean) 
        : expenseParticipantIds.map(id => getUserById(id)).filter(Boolean)

    // Load expense data on mount
    useEffect(() => {
        if (!expense) return
        setTitle(expense.title || '')
        setAmount(String(expense.amount || ''))
        setCategory(expense.category || 'food')
        setNote(expense.note || '')
        setParticipants(expense.splits?.map(s => s.user_id) || [])
        setPayers(expense.paid_by?.map(p => p.user_id) || [])

        const pa = {}
        expense.paid_by?.forEach(p => { pa[p.user_id] = String(p.amount_paid) })
        setPayerAmounts(pa)

        // Detect if unequal
        if (expense.splits?.length > 1) {
            const first = expense.splits[0]?.amount_owed
            const isEqual = expense.splits.every(s => Math.abs(s.amount_owed - first) < 0.01)
            if (!isEqual) {
                setSplitMethod('unequal')
                const ua = {}
                expense.splits?.forEach(s => { ua[s.user_id] = String(s.amount_owed) })
                setUnequalAmounts(ua)
            }
        }
    }, [expense])

    if (!expense) {
        navigate('/', { replace: true })
        return null
    }

    const toggleParticipant = (pid) => {
        setParticipants(prev => prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid])
    }

    const togglePayer = (pid) => {
        if (payers.includes(pid)) {
            if (payers.length > 1) {
                setPayers(prev => prev.filter(x => x !== pid))
                setPayerAmounts(prev => { const n = { ...prev }; delete n[pid]; return n })
            }
        } else {
            setPayers(prev => [...prev, pid])
            setPayerAmounts(prev => ({ ...prev, [pid]: '' }))
        }
    }

    const totalUnequal = participants.reduce((s, uid) => s + (parseFloat(unequalAmounts[uid]) || 0), 0)
    const totalPaidSplit = Object.values(payerAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)

    const buildSplits = () => {
        const amt = parseFloat(amount)
        if (splitMethod === 'equal') {
            const share = amt / participants.length
            return participants.map(uid => ({ user_id: uid, amount_owed: Math.round(share * 100) / 100 }))
        }
        return participants.map(uid => ({ user_id: uid, amount_owed: parseFloat(unequalAmounts[uid] || 0) }))
    }

    const buildPaidBy = () => {
        if (payers.length === 1) return [{ user_id: payers[0], amount_paid: parseFloat(amount) }]
        return payers.map(uid => ({ user_id: uid, amount_paid: parseFloat(payerAmounts[uid] || 0) }))
    }

    const canSubmit = () => {
        if (!title.trim() || !parseFloat(amount)) return false
        if (participants.length === 0) return false
        if (payers.length > 1 && Math.abs(totalPaidSplit - parseFloat(amount)) > 0.1) return false
        if (splitMethod === 'unequal' && Math.abs(totalUnequal - parseFloat(amount)) > 0.1) return false
        return true
    }

    const handleSave = async () => {
        if (!canSubmit()) return
        setLoading(true)
        try {
            await updateExpense(expenseId, {
                title: title.trim(),
                amount: parseFloat(amount),
                category,
                note: note.trim(),
                paid_by: buildPaidBy(),
                splits: buildSplits(),
            })
            toast.success('Expense updated! ✅')
            navigate(-1)
        } catch (e) {
            toast.error(e.message || 'Failed to update')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-dvh animated-bg">
            <div className="px-5 pt-10 pb-32 safe-bottom">
                <div className="flex items-center gap-4 mb-7">
                    <motion.button className="w-10 h-10 rounded-2xl glass flex items-center justify-center"
                        whileTap={{ scale: 0.9 }} onClick={() => navigate(-1)}>
                        <ArrowLeft size={18} className="text-white" />
                    </motion.button>
                    <h1 className="text-xl font-extrabold text-white">Edit Expense</h1>
                </div>

                <div className="space-y-4">
                    {/* Amount */}
                    <div className="card text-center py-6" style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.2)' }}>
                        <p className="text-[#94A3B8] text-sm mb-2">Amount</p>
                        <div className="flex items-center justify-center gap-2">
                            <span className="text-3xl font-bold text-[#94A3B8]">₹</span>
                            <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
                                className="text-4xl font-extrabold text-white bg-transparent outline-none text-center"
                                style={{ width: `${Math.max(3, (amount || '0').length) * 30}px`, maxWidth: '200px' }} />
                        </div>
                    </div>

                    {/* Title */}
                    <input type="text" placeholder="Expense title" value={title}
                        onChange={e => setTitle(e.target.value)} className="input-field" />

                    {/* Category */}
                    <div>
                        <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-2">Category</p>
                        <div className="grid grid-cols-4 gap-2">
                            {CATEGORIES.map(cat => (
                                <button key={cat.id} onClick={() => setCategory(cat.id)}
                                    className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all"
                                    style={{
                                        background: category === cat.id ? `${cat.color}20` : 'rgba(255,255,255,0.04)',
                                        border: `1px solid ${category === cat.id ? `${cat.color}50` : 'rgba(255,255,255,0.07)'}`,
                                    }}>
                                    <span className="text-lg">{cat.emoji}</span>
                                    <span className="text-[9px] font-semibold" style={{ color: category === cat.id ? cat.color : '#94A3B8' }}>
                                        {cat.label.split(' ')[0]}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Note */}
                    <input type="text" placeholder="Note (optional)" value={note}
                        onChange={e => setNote(e.target.value)} className="input-field" />

                    {/* Who paid */}
                    <div>
                        <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-3">Who paid?</p>
                        <div className="space-y-2">
                            {groupMembers.filter(p => p).map(person => {
                                const isPayer = payers.includes(person.id)
                                const [c1, c2] = getAvatarColor(person.full_name || '')
                                return (
                                    <div key={person.id} className="flex items-center gap-3">
                                        <button onClick={() => togglePayer(person.id)}
                                            className="flex items-center gap-3 flex-1 p-3 rounded-xl transition-all"
                                            style={{
                                                background: isPayer ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                                                border: `1px solid ${isPayer ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
                                            }}>
                                            <div className="avatar text-white text-[10px]" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                                {getInitials(person.full_name)}
                                            </div>
                                            <span className="text-sm font-medium text-white flex-1 text-left">
                                                {person.id === currentUser?.id ? 'You' : person.full_name?.split(' ')[0]}
                                            </span>
                                            <div className="w-5 h-5 rounded-full flex items-center justify-center"
                                                style={{ background: isPayer ? '#7C3AED' : 'rgba(255,255,255,0.08)' }}>
                                                {isPayer && <span className="text-white text-xs">✓</span>}
                                            </div>
                                        </button>
                                        {isPayer && payers.length > 1 && (
                                            <input type="number" placeholder="Amount" value={payerAmounts[person.id] || ''}
                                                onChange={e => setPayerAmounts(prev => ({ ...prev, [person.id]: e.target.value }))}
                                                className="input-field" style={{ width: '100px', flexShrink: 0 }} />
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                        {payers.length > 1 && (
                            <p className="text-xs mt-2 text-right"
                                style={{ color: Math.abs(totalPaidSplit - parseFloat(amount || 0)) < 0.1 ? '#10B981' : '#F43F5E' }}>
                                Allocated: {formatAmount(totalPaidSplit)} / {formatAmount(parseFloat(amount || 0))}
                            </p>
                        )}
                    </div>

                    {/* Split among */}
                    <div>
                        <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-3">Split among</p>
                        <div className="flex flex-wrap gap-2 mb-4">
                            {groupMembers.filter(p => p).map(person => {
                                const isSelected = participants.includes(person.id)
                                return (
                                    <button key={person.id} onClick={() => toggleParticipant(person.id)}
                                        className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5"
                                        style={{
                                            background: isSelected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                                            color: isSelected ? '#fff' : '#94A3B8',
                                            border: `1px solid ${isSelected ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.05)'}`,
                                        }}>
                                        {person.id === currentUser?.id ? 'You' : person.full_name?.split(' ')[0]}
                                        {isSelected && <span className="text-[#7C3AED]">✓</span>}
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    {/* Split method */}
                    <div>
                        <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-3">Split method</p>
                        <div className="flex gap-2 mb-4">
                            {SPLIT_METHODS.map(m => (
                                <button key={m.id} onClick={() => setSplitMethod(m.id)}
                                    className={`split-option ${splitMethod === m.id ? 'active' : ''}`}>
                                    {m.label}
                                </button>
                            ))}
                        </div>

                        {splitMethod === 'equal' && participants.length > 0 && (
                            <div className="card text-center" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
                                <p className="text-[#94A3B8] text-sm">Each person pays</p>
                                <p className="text-2xl font-extrabold text-green-400 mt-1">
                                    ₹{(parseFloat(amount || 0) / participants.length).toFixed(2)}
                                </p>
                            </div>
                        )}

                        {splitMethod === 'unequal' && (
                            <div className="space-y-2">
                                {groupMembers.filter(m => m && participants.includes(m.id)).map(person => {
                                    const [c1, c2] = getAvatarColor(person.full_name || '')
                                    return (
                                        <div key={person.id} className="flex items-center gap-3">
                                            <div className="avatar text-white text-[10px]" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                                {getInitials(person.full_name)}
                                            </div>
                                            <span className="text-sm text-white flex-1">
                                                {person.id === currentUser?.id ? 'You' : person.full_name?.split(' ')[0]}
                                            </span>
                                            <div className="flex items-center gap-1">
                                                <span className="text-[#94A3B8] text-sm">₹</span>
                                                <input type="number" value={unequalAmounts[person.id] || ''}
                                                    onChange={e => setUnequalAmounts(prev => ({ ...prev, [person.id]: e.target.value }))}
                                                    className="input-field text-right"
                                                    style={{ width: '90px', padding: '8px 12px', fontSize: '14px' }} />
                                            </div>
                                        </div>
                                    )
                                })}
                                <p className="text-xs text-right font-semibold"
                                    style={{ color: Math.abs(totalUnequal - parseFloat(amount || 0)) < 0.1 ? '#10B981' : '#F43F5E' }}>
                                    Total: {formatAmount(totalUnequal)} / {formatAmount(parseFloat(amount || 0))}
                                </p>
                            </div>
                        )}
                    </div>

                    <button className="btn-primary flex items-center justify-center gap-2"
                        disabled={!canSubmit() || loading} onClick={handleSave}>
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </span>
                        ) : (<><Save size={16} /> Save Changes</>)}
                    </button>
                </div>
            </div>
        </div>
    )
}
