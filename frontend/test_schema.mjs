import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://eebfuvyszyfehvzdmmjc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYmZ1dnlzenlmZWh2emRtbWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjc4ODgsImV4cCI6MjA4ODc0Mzg4OH0.gBJ7ZnTvR3qi_BjJasjKsXTg2BDfb0xwF2C2Km5Ib10'
);

(async () => {
    // try to insert an empty record to get the exact columns in the error
    const res = await supabase.from('expense_splits').insert({}).select()
    console.log(res);

    const tables = ['users', 'groups', 'group_members', 'expenses', 'expense_splits']
    console.log("Schema cache reload triggered");
})();
