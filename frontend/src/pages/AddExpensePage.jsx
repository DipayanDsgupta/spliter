import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Plus, Minus, DollarSign, ChevronDown } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { CATEGORIES, getAvatarColor, getInitials, formatAmount } from '../utils/helpers'
import toast from 'react-hot-toast'

const SPLIT_METHODS = [
    { id: 'equal', label: 'Equally' },
    { id: 'unequal', label: 'Unequal' },
    { id: 'percent', label: 'By %' },
]

export default function AddExpensePage() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { addExpense, groups, friends, currentUser } = useApp()

    const preselectedGroup = searchParams.get('group') || ''

    const [title, setTitle] = useState('')
    const [amount, setAmount] = useState('')
    const [category, setCategory] = useState('food')
    const [note, setNote] = useState('')
    const [groupId, setGroupId] = useState(preselectedGroup)
    const [splitMethod, setSplitMethod] = useState('equal')
    const [participants, setParticipants] = useState([])
    const [payers, setPayers] = useState([])
    const [payerAmounts, setPayerAmounts] = useState({})
    const [unequalAmounts, setUnequalAmounts] = useState({})
    const [percentAmounts, setPercentAmounts] = useState({})
    const [step, setStep] = useState(1) // 1: basic, 2: split
    const [loading, setLoading] = useState(false)

    const selectedGroup = groups.find(g => g.id === groupId)
    const allPeople = [currentUser, ...friends]
    const groupMembers = selectedGroup
        ? allPeople.filter(p => selectedGroup.members.includes(p.id))
        : allPeople

    // Initialize participants & payers when group changes
    useEffect(() => {
        if (selectedGroup) {
            setParticipants(selectedGroup.members)
            setPayers([currentUser.id])
            setPayerAmounts({ [currentUser.id]: '' })
        }
    }, [groupId])

    const toggleParticipant = (pid) => {
        setParticipants(prev =>
            prev.includes(pid) ? prev.filter(x => x !== pid) : [...prev, pid]
        )
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

    const getEqualShare = () => {
        if (!participants.length || !amount) return 0
        return (parseFloat(amount) / participants.length).toFixed(2)
    }

    const totalPercent = participants.reduce((s, uid) => s + (parseFloat(percentAmounts[uid]) || 0), 0)
    const totalUnequal = participants.reduce((s, uid) => s + (parseFloat(unequalAmounts[uid]) || 0), 0)
    const totalPaidSplit = Object.values(payerAmounts).reduce((s, v) => s + (parseFloat(v) || 0), 0)

    const buildSplits = () => {
        const amt = parseFloat(amount)
        if (splitMethod === 'equal') {
            const share = amt / participants.length
            return participants.map(uid => ({ user_id: uid, amount_owed: Math.round(share * 100) / 100 }))
        }
        if (splitMethod === 'unequal') {
            return participants.map(uid => ({
                user_id: uid,
                amount_owed: parseFloat(unequalAmounts[uid] || 0)
            }))
        }
        if (splitMethod === 'percent') {
            return participants.map(uid => ({
                user_id: uid,
                amount_owed: Math.round((parseFloat(percentAmounts[uid] || 0) / 100) * amt * 100) / 100
            }))
        }
        return []
    }

    const buildPaidBy = () => {
        if (payers.length === 1) {
            return [{ user_id: payers[0], amount_paid: parseFloat(amount) }]
        }
        return payers.map(uid => ({
            user_id: uid,
            amount_paid: parseFloat(payerAmounts[uid] || 0)
        }))
    }

    const canProceed = title.trim() && parseFloat(amount) > 0 && groupId

    const canSubmit = () => {
        if (!canProceed) return false
        if (participants.length === 0) return false
        if (payers.length > 1 && Math.abs(totalPaidSplit - parseFloat(amount)) > 0.1) return false
        if (splitMethod === 'unequal' && Math.abs(totalUnequal - parseFloat(amount)) > 0.1) return false
        if (splitMethod === 'percent' && Math.abs(totalPercent - 100) > 0.5) return false
        return true
    }

    const handleSubmit = async () => {
        if (!canSubmit()) return
        setLoading(true)
        try {
            await addExpense({
                group_id: groupId,
                title: title.trim(),
                amount: parseFloat(amount),
                category,
                note: note.trim(),
                paid_by: buildPaidBy(),
                splits: buildSplits(),
            })
            setLoading(false)
            toast.success('Expense added! 🎉')
            navigate(groupId ? `/groups/${groupId}` : '/')
        } catch (e) {
            setLoading(false)
            toast.error(e.message || 'Failed to add expense')
        }
    }

    return (
        <div className="min-h-dvh animated-bg">
            <div className="px-5 pt-10 pb-20">
                {/* Header */}
                <div className="flex items-center gap-4 mb-7">
                    <motion.button
                        className="w-10 h-10 rounded-2xl glass flex items-center justify-center"
                        whileTap={{ scale: 0.9 }}
                        onClick={() => navigate(-1)}
                    >
                        <ArrowLeft size={18} className="text-white" />
                    </motion.button>
                    <h1 className="text-xl font-extrabold text-white">Add Expense</h1>
                </div>

                {/* Step indicator */}
                <div className="flex items-center gap-3 mb-7">
                    {[1, 2].map(s => (
                        <div key={s} className="flex items-center gap-2">
                            <div
                                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all"
                                style={{
                                    background: step >= s ? 'linear-gradient(135deg, #7C3AED, #3B82F6)' : 'rgba(255,255,255,0.07)',
                                    color: step >= s ? 'white' : '#94A3B8',
                                }}
                            >
                                {s}
                            </div>
                            {s === 1 && <div className="flex-1 h-[1px]" style={{ background: step > 1 ? 'linear-gradient(to right, #7C3AED, #3B82F6)' : 'rgba(255,255,255,0.1)', width: '40px' }} />}
                        </div>
                    ))}
                    <span className="text-[#94A3B8] text-sm ml-2">{step === 1 ? 'Expense details' : 'Split details'}</span>
                </div>

                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            {/* Amount — Big input */}
                            <div className="card text-center py-8" style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.2)' }}>
                                <p className="text-[#94A3B8] text-sm mb-3">How much?</p>
                                <div className="flex items-center justify-center gap-2">
                                    <span className="text-3xl font-bold text-[#94A3B8]">₹</span>
                                    <input
                                        type="number"
                                        placeholder="0"
                                        value={amount}
                                        onChange={e => setAmount(e.target.value)}
                                        className="text-5xl font-extrabold text-white bg-transparent outline-none text-center"
                                        style={{ width: `${Math.max(3, (amount || '0').length) * 35}px`, maxWidth: '220px' }}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {/* Title */}
                            <input
                                type="text"
                                placeholder="What's this expense? (e.g. Train Tickets)"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="input-field"
                            />

                            {/* Group */}
                            <div className="relative">
                                <select
                                    value={groupId}
                                    onChange={e => setGroupId(e.target.value)}
                                    className="input-field appearance-none cursor-pointer"
                                    style={{ paddingRight: '36px' }}
                                >
                                    <option value="">Select Group</option>
                                    {groups.map(g => (
                                        <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
                                    ))}
                                </select>
                                <ChevronDown size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none" />
                            </div>

                            {/* Category */}
                            <div>
                                <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-2">Category</p>
                                <div className="grid grid-cols-4 gap-2">
                                    {CATEGORIES.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setCategory(cat.id)}
                                            className="flex flex-col items-center gap-1 p-2.5 rounded-xl transition-all"
                                            style={{
                                                background: category === cat.id ? `${cat.color}20` : 'rgba(255,255,255,0.04)',
                                                border: `1px solid ${category === cat.id ? `${cat.color}50` : 'rgba(255,255,255,0.07)'}`,
                                            }}
                                        >
                                            <span className="text-xl">{cat.emoji}</span>
                                            <span className="text-[9px] font-semibold text-center leading-tight" style={{ color: category === cat.id ? cat.color : '#94A3B8' }}>
                                                {cat.label.split(' ')[0]}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Note */}
                            <input
                                type="text"
                                placeholder="Add a note (optional)"
                                value={note}
                                onChange={e => setNote(e.target.value)}
                                className="input-field"
                            />

                            <button
                                className="btn-primary"
                                disabled={!canProceed}
                                onClick={() => setStep(2)}
                            >
                                Next: Split Details →
                            </button>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-5"
                        >
                            {/* Summary */}
                            <div className="card flex items-center gap-3" style={{ background: 'rgba(124,58,237,0.06)', borderColor: 'rgba(124,58,237,0.2)' }}>
                                <span className="text-2xl">{CATEGORIES.find(c => c.id === category)?.emoji}</span>
                                <div className="flex-1">
                                    <p className="font-bold text-white">{title}</p>
                                    <p className="text-[#94A3B8] text-sm">{selectedGroup?.emoji} {selectedGroup?.name}</p>
                                </div>
                                <p className="text-xl font-extrabold gradient-text">₹{amount}</p>
                            </div>

                            {/* Paid by */}
                            <div>
                                <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider mb-3">Who paid?</p>
                                <div className="space-y-2">
                                    {groupMembers.map(person => {
                                        const isPayer = payers.includes(person.id)
                                        const [c1, c2] = getAvatarColor(person.full_name)
                                        return (
                                            <div key={person.id} className="flex items-center gap-3">
                                                <button
                                                    onClick={() => togglePayer(person.id)}
                                                    className="flex items-center gap-3 flex-1 p-3 rounded-xl transition-all"
                                                    style={{
                                                        background: isPayer ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                                                        border: `1px solid ${isPayer ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.07)'}`,
                                                    }}
                                                >
                                                    <div className="avatar text-white text-[10px]" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                                        {getInitials(person.full_name)}
                                                    </div>
                                                    <span className="text-sm font-medium text-white flex-1 text-left">
                                                        {person.id === currentUser.id ? 'You' : person.full_name.split(' ')[0]}
                                                    </span>
                                                    <div className="w-5 h-5 rounded-full flex items-center justify-center transition-all"
                                                        style={{ background: isPayer ? '#7C3AED' : 'rgba(255,255,255,0.08)' }}>
                                                        {isPayer && <span className="text-white text-xs">✓</span>}
                                                    </div>
                                                </button>
                                                {isPayer && payers.length > 1 && (
                                                    <input
                                                        type="number"
                                                        placeholder="Amount"
                                                        value={payerAmounts[person.id] || ''}
                                                        onChange={e => setPayerAmounts(prev => ({ ...prev, [person.id]: e.target.value }))}
                                                        className="input-field"
                                                        style={{ width: '100px', flexShrink: 0 }}
                                                    />
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                                {payers.length > 1 && (
                                    <p
                                        className="text-xs mt-2 text-right"
                                        style={{ color: Math.abs(totalPaidSplit - parseFloat(amount || 0)) < 0.1 ? '#10B981' : '#F43F5E' }}
                                    >
                                        Allocated: {formatAmount(totalPaidSplit)} / {formatAmount(parseFloat(amount || 0))}
                                    </p>
                                )}
                            </div>

                            {/* Split among */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <p className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wider">Split among</p>
                                    <button
                                        className="text-xs text-[#7C3AED] font-bold"
                                        onClick={() => setParticipants(participants.length === groupMembers.length ? [] : groupMembers.map(m => m.id))}
                                    >
                                        {participants.length === groupMembers.length ? 'Deselect All' : 'Select All'}
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2 mb-6">
                                    {groupMembers.map(person => {
                                        const isSelected = participants.includes(person.id)
                                        return (
                                            <button
                                                key={`part-${person.id}`}
                                                onClick={() => toggleParticipant(person.id)}
                                                className="px-3 py-1.5 rounded-full text-[11px] font-bold transition-all flex items-center gap-1.5"
                                                style={{
                                                    background: isSelected ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                                                    color: isSelected ? '#fff' : '#94A3B8',
                                                    border: `1px solid ${isSelected ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.05)'}`
                                                }}
                                            >
                                                {person.id === currentUser.id ? 'You' : person.full_name.split(' ')[0]}
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
                                        <button
                                            key={m.id}
                                            onClick={() => setSplitMethod(m.id)}
                                            className={`split-option ${splitMethod === m.id ? 'active' : ''}`}
                                        >
                                            {m.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Equal split preview */}
                                {splitMethod === 'equal' && (
                                    <div className="card text-center" style={{ background: 'rgba(16,185,129,0.06)', borderColor: 'rgba(16,185,129,0.2)' }}>
                                        <p className="text-[#94A3B8] text-sm">Each person pays</p>
                                        <p className="text-2xl font-extrabold text-green-400 mt-1">₹{getEqualShare()}</p>
                                        <p className="text-xs text-[#94A3B8] mt-1">among {participants.length} people</p>
                                    </div>
                                )}

                                {/* Participants list for unequal/percent */}
                                {(splitMethod === 'unequal' || splitMethod === 'percent') && (
                                    <div className="space-y-2">
                                        {groupMembers.filter(m => participants.includes(m.id)).map(person => {
                                            const [c1, c2] = getAvatarColor(person.full_name)
                                            return (
                                                <div key={person.id} className="flex items-center gap-3">
                                                    <div className="avatar text-white text-[10px]" style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}>
                                                        {getInitials(person.full_name)}
                                                    </div>
                                                    <span className="text-sm text-white flex-1">
                                                        {person.id === currentUser.id ? 'You' : person.full_name.split(' ')[0]}
                                                    </span>
                                                    <div className="flex items-center gap-1">
                                                        {splitMethod === 'percent' && <span className="text-[#94A3B8] text-sm">%</span>}
                                                        {splitMethod === 'unequal' && <span className="text-[#94A3B8] text-sm">₹</span>}
                                                        <input
                                                            type="number"
                                                            value={splitMethod === 'unequal' ? (unequalAmounts[person.id] || '') : (percentAmounts[person.id] || '')}
                                                            onChange={e => {
                                                                if (splitMethod === 'unequal') setUnequalAmounts(prev => ({ ...prev, [person.id]: e.target.value }))
                                                                else setPercentAmounts(prev => ({ ...prev, [person.id]: e.target.value }))
                                                            }}
                                                            className="input-field text-right"
                                                            style={{ width: '90px', padding: '8px 12px', fontSize: '14px' }}
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        <p
                                            className="text-xs text-right font-semibold"
                                            style={{
                                                color: splitMethod === 'unequal'
                                                    ? (Math.abs(totalUnequal - parseFloat(amount || 0)) < 0.1 ? '#10B981' : '#F43F5E')
                                                    : (Math.abs(totalPercent - 100) < 0.5 ? '#10B981' : '#F43F5E')
                                            }}
                                        >
                                            {splitMethod === 'unequal' && `Total: ${formatAmount(totalUnequal)} / ${formatAmount(parseFloat(amount || 0))}`}
                                            {splitMethod === 'percent' && `Total: ${totalPercent.toFixed(1)}% / 100%`}
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button className="btn-secondary" style={{ width: 'auto', padding: '14px 20px' }} onClick={() => setStep(1)}>
                                    ← Back
                                </button>
                                <button
                                    className="btn-primary"
                                    disabled={!canSubmit() || loading}
                                    onClick={handleSubmit}
                                >
                                    {loading ? (
                                        <span className="flex items-center justify-center gap-2">
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            Saving...
                                        </span>
                                    ) : 'Add Expense ✓'}
                                </button>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    )
}
