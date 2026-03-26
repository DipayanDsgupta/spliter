/**
 * Debt Simplification Algorithm
 * Uses a greedy min-transactions approach:
 * Given a set of balances (positive = owed money, negative = owes money),
 * returns the minimum list of transactions to settle all debts.
 */

export function simplifyDebts(balances) {
    // balances: { userId: netAmount }  (positive = owed to, negative = owes)
    const creditors = [] // people who are owed money
    const debtors = []   // people who owe money

    for (const [userId, amount] of Object.entries(balances)) {
        if (amount > 0.01) creditors.push({ userId, amount })
        else if (amount < -0.01) debtors.push({ userId, amount: -amount })
    }

    creditors.sort((a, b) => b.amount - a.amount)
    debtors.sort((a, b) => b.amount - a.amount)

    const transactions = []
    let i = 0, j = 0

    while (i < creditors.length && j < debtors.length) {
        const credit = creditors[i]
        const debt = debtors[j]
        const settle = Math.min(credit.amount, debt.amount)

        transactions.push({
            from: debt.userId,
            to: credit.userId,
            amount: Math.round(settle * 100) / 100,
        })

        credit.amount -= settle
        debt.amount -= settle

        if (credit.amount < 0.01) i++
        if (debt.amount < 0.01) j++
    }

    return transactions
}

/**
 * Calculate net balances for a group
 * expenses: array of { id, amount, paid_by: [{user_id, amount_paid}], splits: [{user_id, amount_owed}] }
 */
export function calculateNetBalances(expenses, completedSettlements = [], sponsorships = []) {
    const balances = {}

    for (const expense of expenses) {
        // Credit payers
        for (const payer of expense.paid_by) {
            balances[payer.user_id] = (balances[payer.user_id] || 0) + payer.amount_paid
        }
        // Debit sharers
        for (const split of expense.splits) {
            balances[split.user_id] = (balances[split.user_id] || 0) - split.amount_owed
        }
    }

    // Apply completed settlements: payer gets credit, receiver gets debit
    for (const s of completedSettlements) {
        const amt = Number(s.amount)
        balances[s.payer_id] = (balances[s.payer_id] || 0) + amt
        balances[s.receiver_id] = (balances[s.receiver_id] || 0) - amt
    }

    // Dynamically calculate raw shares for percentage sponsorships
    const rawShares = {}
    for (const expense of expenses) {
        for (const split of expense.splits) {
            rawShares[split.user_id] = (rawShares[split.user_id] || 0) + split.amount_owed
        }
    }

    // Apply sponsorships: sponsor takes on recipient's debt
    for (const sp of sponsorships) {
        let amt = Number(sp.amount)
        if (sp.percentage) {
            const recipientTotalShares = rawShares[sp.recipient_id] || 0
            amt = Math.round((recipientTotalShares * Number(sp.percentage) / 100) * 100) / 100
        }

        if (amt > 0) {
            balances[sp.sponsor_id] = (balances[sp.sponsor_id] || 0) - amt  // sponsor owes more
            balances[sp.recipient_id] = (balances[sp.recipient_id] || 0) + amt  // recipient owes less
        }
    }

    return balances
}

/**
 * Generate a random 10-character alphanumeric settlement ID
 */
export function generateSettlementId() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let text = ''
    for (let i = 0; i < 10; i++) {
        text += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return text
}

/**
 * Generate Google Pay UPI deep link
 */
export function generateGooglePayLink({ upiId, name, amount, note }) {
    const encodedNote = encodeURIComponent(note || 'Spliter Settlement')
    const encodedName = encodeURIComponent(name || '')
    const roundedAmount = Math.round(amount * 100) / 100

    // tez:// opens Google Pay specifically; upi:// opens any UPI app
    const isMobile = /Android|iPhone/i.test(navigator.userAgent)
    const scheme = isMobile ? 'tez' : 'upi'

    return `${scheme}://upi/pay?pa=${upiId}&pn=${encodedName}&am=${roundedAmount}&cu=INR&tn=${encodedNote}`
}

/**
 * Format currency for display
 */
export function formatAmount(amount, showSign = false) {
    const abs = Math.abs(amount)
    const formatted = new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 2,
    }).format(abs)

    if (showSign) {
        return amount >= 0 ? `+${formatted}` : `-${formatted}`
    }
    return formatted
}

/**
 * Get avatar color based on name
 */
export function getAvatarColor(name) {
    const colors = [
        ['#7C3AED', '#5B21B6'], // purple
        ['#3B82F6', '#1D4ED8'], // blue
        ['#06B6D4', '#0891B2'], // cyan
        ['#10B981', '#059669'], // green
        ['#F59E0B', '#D97706'], // amber
        ['#F43F5E', '#E11D48'], // rose
        ['#8B5CF6', '#7C3AED'], // violet
        ['#14B8A6', '#0D9488'], // teal
    ]
    const idx = name ? name.charCodeAt(0) % colors.length : 0
    return colors[idx]
}

/**
 * Get initials from name
 */
export function getInitials(name) {
    if (!name) return '?'
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

/**
 * Format date relative to now
 */
export function formatDate(dateStr) {
    const date = new Date(dateStr)
    const now = new Date()
    
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const nowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const days = Math.round((nowStart - dateStart) / 86400000)

    if (days === 0) return 'Today'
    if (days === 1) return 'Yesterday'
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatTime(dateStr) {
    const date = new Date(dateStr)
    return date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true })
}

/**
 * Calculate how much each member has actually spent (paid out of pocket)
 * Returns { userId: totalAmountPaid }
 */
export function calculateMemberSpendings(expenses) {
    const spendings = {}
    for (const expense of expenses) {
        for (const payer of expense.paid_by) {
            spendings[payer.user_id] = (spendings[payer.user_id] || 0) + payer.amount_paid
        }
    }
    return spendings
}

/**
 * Build daily spending data for time-series graph
 * Returns sorted array of { date: 'YYYY-MM-DD', [userId]: amountSpentThatDay, ... }
 */
export function buildDailySpendingData(expenses) {
    const dailyMap = {} // date -> { userId: amount }

    for (const expense of expenses) {
        const date = new Date(expense.created_at).toISOString().split('T')[0]
        if (!dailyMap[date]) dailyMap[date] = {}
        for (const payer of expense.paid_by) {
            dailyMap[date][payer.user_id] = (dailyMap[date][payer.user_id] || 0) + payer.amount_paid
        }
    }

    return Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, userAmounts]) => ({ date, ...userAmounts }))
}

/**
 * Calculate each member's total share (amount_owed) — what they actually consumed
 * Returns { userId: totalAmountOwed }
 */
export function calculateMemberShares(expenses, sponsorships = []) {
    const shares = {}
    for (const expense of expenses) {
        for (const split of expense.splits) {
            shares[split.user_id] = (shares[split.user_id] || 0) + split.amount_owed
        }
    }
    // Adjust for sponsorships
    for (const sp of sponsorships) {
        let amt = Number(sp.amount)
        if (sp.percentage) {
            const recipientTotalShares = shares[sp.recipient_id] || 0
            amt = Math.round((recipientTotalShares * Number(sp.percentage) / 100) * 100) / 100
        }

        if (amt > 0) {
            shares[sp.recipient_id] = (shares[sp.recipient_id] || 0) - amt  // recipient's cost reduced
            shares[sp.sponsor_id] = (shares[sp.sponsor_id] || 0) + amt     // sponsor's cost increased
        }
    }
    return shares
}

/**
 * Build daily shares data for time-series graph (based on amount_owed)
 * Returns sorted array of { date: 'YYYY-MM-DD', [userId]: sharesThatDay, ... }
 */
export function buildDailySharesData(expenses) {
    const dailyMap = {}
    for (const expense of expenses) {
        const date = new Date(expense.created_at).toISOString().split('T')[0]
        if (!dailyMap[date]) dailyMap[date] = {}
        for (const split of expense.splits) {
            dailyMap[date][split.user_id] = (dailyMap[date][split.user_id] || 0) + split.amount_owed
        }
    }
    return Object.entries(dailyMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, userAmounts]) => ({ date, ...userAmounts }))
}

export const CATEGORIES = [
    { id: 'food', label: 'Food & Drinks', emoji: '🍕', color: '#F59E0B' },
    { id: 'travel', label: 'Travel', emoji: '✈️', color: '#3B82F6' },
    { id: 'hotel', label: 'Hotel & Stay', emoji: '🏨', color: '#8B5CF6' },
    { id: 'entertainment', label: 'Entertainment', emoji: '🎬', color: '#F43F5E' },
    { id: 'utilities', label: 'Utilities', emoji: '⚡', color: '#10B981' },
    { id: 'shopping', label: 'Shopping', emoji: '🛍️', color: '#06B6D4' },
    { id: 'transport', label: 'Transport', emoji: '🚗', color: '#14B8A6' },
    { id: 'other', label: 'Other', emoji: '📦', color: '#94A3B8' },
]
