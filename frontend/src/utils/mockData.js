// Mock data for development — replace with real API calls when backend is ready

export const MOCK_USER = {
    id: 'user-1',
    full_name: 'You (Demo)',
    phone: '+919876543210',
    email: 'demo@spliter.app',
    upi_id: 'demo@okicici',
}

export const MOCK_FRIENDS = [
    { id: 'user-2', full_name: 'Rahul Sharma', phone: '+919876500001', upi_id: 'rahul@okicici', email: 'rahul@gmail.com' },
    { id: 'user-3', full_name: 'Priya Mehta', phone: '+919876500002', upi_id: 'priya@ybl', email: 'priya@gmail.com' },
    { id: 'user-4', full_name: 'Arjun Singh', phone: '+919876500003', upi_id: 'arjun@paytm', email: 'arjun@gmail.com' },
    { id: 'user-5', full_name: 'Sneha Patel', phone: '+919876500004', upi_id: 'sneha@oksbi', email: 'sneha@gmail.com' },
    { id: 'user-6', full_name: 'Vikram Nair', phone: '+919876500005', upi_id: 'vikram@ybl', email: 'vikram@gmail.com' },
    { id: 'user-7', full_name: 'Ananya Roy', phone: '+919876500006', upi_id: 'ananya@okaxis', email: 'ananya@gmail.com' },
    { id: 'user-8', full_name: 'Dev Kumar', phone: '+919876500007', upi_id: 'dev@okicici', email: 'dev@gmail.com' },
    { id: 'user-9', full_name: 'Meera Joshi', phone: '+919876500008', upi_id: 'meera@upi', email: 'meera@gmail.com' },
]

export const MOCK_GROUPS = [
    {
        id: 'group-1',
        name: 'Goa Trip 2025',
        emoji: '🏖️',
        members: ['user-1', 'user-2', 'user-3', 'user-4', 'user-5', 'user-6', 'user-7', 'user-8', 'user-9'],
        created_at: '2025-03-01T10:00:00Z',
        total_expenses: 95000,
    },
    {
        id: 'group-2',
        name: 'Apartment Flat',
        emoji: '🏠',
        members: ['user-1', 'user-2', 'user-3', 'user-4'],
        created_at: '2025-01-15T10:00:00Z',
        total_expenses: 42000,
    },
    {
        id: 'group-3',
        name: 'Mumbai Office Team',
        emoji: '💼',
        members: ['user-1', 'user-5', 'user-6', 'user-7'],
        created_at: '2025-02-01T10:00:00Z',
        total_expenses: 18500,
    },
]

export const MOCK_EXPENSES = [
    // Goa Trip
    {
        id: 'exp-1',
        group_id: 'group-1',
        title: 'Train Tickets (All Members)',
        amount: 18000,
        category: 'travel',
        paid_by: [
            { user_id: 'user-2', amount_paid: 10000 },
            { user_id: 'user-3', amount_paid: 8000 },
        ],
        splits: [
            { user_id: 'user-1', amount_owed: 2000 },
            { user_id: 'user-2', amount_owed: 2000 },
            { user_id: 'user-3', amount_owed: 2000 },
            { user_id: 'user-4', amount_owed: 2000 },
            { user_id: 'user-5', amount_owed: 2000 },
            { user_id: 'user-6', amount_owed: 2000 },
            { user_id: 'user-7', amount_owed: 2000 },
            { user_id: 'user-8', amount_owed: 2000 },
            { user_id: 'user-9', amount_owed: 2000 },
        ],
        created_at: '2025-03-10T08:00:00Z',
        note: 'Mumbai to Goa express train',
    },
    {
        id: 'exp-2',
        group_id: 'group-1',
        title: 'Hotel Booking (3 Nights)',
        amount: 27000,
        category: 'hotel',
        paid_by: [
            { user_id: 'user-2', amount_paid: 10000 },
            { user_id: 'user-3', amount_paid: 5000 },
            { user_id: 'user-4', amount_paid: 12000 },
        ],
        splits: [
            { user_id: 'user-1', amount_owed: 3000 },
            { user_id: 'user-2', amount_owed: 3000 },
            { user_id: 'user-3', amount_owed: 3000 },
            { user_id: 'user-4', amount_owed: 3000 },
            { user_id: 'user-5', amount_owed: 3000 },
            { user_id: 'user-6', amount_owed: 3000 },
            { user_id: 'user-7', amount_owed: 3000 },
            { user_id: 'user-8', amount_owed: 3000 },
            { user_id: 'user-9', amount_owed: 3000 },
        ],
        created_at: '2025-03-10T10:00:00Z',
        note: '3 nights at Taj Goa',
    },
    {
        id: 'exp-3',
        group_id: 'group-1',
        title: 'Beach Shack Dinner',
        amount: 9800,
        category: 'food',
        paid_by: [{ user_id: 'user-1', amount_paid: 9800 }],
        splits: [
            { user_id: 'user-1', amount_owed: 1089 },
            { user_id: 'user-2', amount_owed: 1089 },
            { user_id: 'user-3', amount_owed: 1089 },
            { user_id: 'user-4', amount_owed: 1089 },
            { user_id: 'user-5', amount_owed: 1089 },
            { user_id: 'user-6', amount_owed: 1089 },
            { user_id: 'user-7', amount_owed: 1089 },
            { user_id: 'user-8', amount_owed: 1089 },
            { user_id: 'user-9', amount_owed: 1067 },
        ],
        created_at: '2025-03-11T19:00:00Z',
        note: 'Baga beach dinner 🌊',
    },
    // Apartment
    {
        id: 'exp-4',
        group_id: 'group-2',
        title: 'Monthly Rent',
        amount: 32000,
        category: 'utilities',
        paid_by: [{ user_id: 'user-2', amount_paid: 32000 }],
        splits: [
            { user_id: 'user-1', amount_owed: 8000 },
            { user_id: 'user-2', amount_owed: 8000 },
            { user_id: 'user-3', amount_owed: 8000 },
            { user_id: 'user-4', amount_owed: 8000 },
        ],
        created_at: '2025-03-01T00:00:00Z',
        note: 'March rent',
    },
    {
        id: 'exp-5',
        group_id: 'group-2',
        title: 'Electricity Bill',
        amount: 4200,
        category: 'utilities',
        paid_by: [{ user_id: 'user-1', amount_paid: 4200 }],
        splits: [
            { user_id: 'user-1', amount_owed: 1050 },
            { user_id: 'user-2', amount_owed: 1050 },
            { user_id: 'user-3', amount_owed: 1050 },
            { user_id: 'user-4', amount_owed: 1050 },
        ],
        created_at: '2025-03-05T10:00:00Z',
    },
    // Office team
    {
        id: 'exp-6',
        group_id: 'group-3',
        title: 'Team Lunch at Trattoria',
        amount: 6800,
        category: 'food',
        paid_by: [{ user_id: 'user-1', amount_paid: 6800 }],
        splits: [
            { user_id: 'user-1', amount_owed: 1700 },
            { user_id: 'user-5', amount_owed: 1700 },
            { user_id: 'user-6', amount_owed: 1700 },
            { user_id: 'user-7', amount_owed: 1700 },
        ],
        created_at: '2025-03-08T13:00:00Z',
    },
]

export const MOCK_SETTLEMENTS = [
    {
        id: 'settle-1',
        from_user: 'user-4',
        to_user: 'user-2',
        amount: 5000,
        status: 'pending',
        group_id: 'group-1',
        created_at: '2025-03-12T10:00:00Z',
    },
]
