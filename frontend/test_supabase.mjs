import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://eebfuvyszyfehvzdmmjc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYmZ1dnlzenlmZWh2emRtbWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjc4ODgsImV4cCI6MjA4ODc0Mzg4OH0.gBJ7ZnTvR3qi_BjJasjKsXTg2BDfb0xwF2C2Km5Ib10'
);

async function test() {
    console.log("---- Fetching users ----");
    const u = await supabase.from('users').select('*').limit(1);
    console.log(u.error ? `Error: ${u.error.message}` : (u.data.length ? 'Users table exists' : 'Users table EMPTY but exists'));

    console.log("---- Fetching expenses ----");
    const ex = await supabase.from('expenses').select('*').limit(1);
    console.log(ex.error ? `Error: ${ex.error.message}` : (ex.data.length ? 'Expenses exists' : 'Expenses EMPTY'));

    console.log("---- Fetching expense_splits ----");
    const es = await supabase.from('expense_splits').select('*').limit(1);
    console.log(es.error ? `Error: ${es.error.message}` : (es.data.length ? 'expense_splits exists' : 'expense_splits EMPTY'));
}

test();
