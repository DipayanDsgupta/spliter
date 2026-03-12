import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eebfuvyszyfehvzdmmjc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYmZ1dnlzenlmZWh2emRtbWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjc4ODgsImV4cCI6MjA4ODc0Mzg4OH0.gBJ7ZnTvR3qi_BjJasjKsXTg2BDfb0xwF2C2Km5Ib10'
);

async function check() {
  const { data, error } = await supabase.from('expenses').select('*').limit(1);
  console.log('Expenses query:', error ? error.message : 'Success');
  
  // Let's try inserting an expense with no group_id
  const testId = `exp-test-${Date.now()}`;
  const { error: insErr } = await supabase.from('expenses').insert([{
    id: testId,
    description: 'Test null group',
    amount: 100,
    created_by: '00000000-0000-0000-0000-000000000000',
    type: 'individual'
  }]);
  
  console.log('Insert err:', insErr ? insErr.message : 'Success! Null group allowed');
}
check();
