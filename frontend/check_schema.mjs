import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://eebfuvyszyfehvzdmmjc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYmZ1dnlzenlmZWh2emRtbWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjc4ODgsImV4cCI6MjA4ODc0Mzg4OH0.gBJ7ZnTvR3qi_BjJasjKsXTg2BDfb0xwF2C2Km5Ib10'
);

async function check() {
  const testId = `exp-test-${Date.now()}`;
  const { error: insErr } = await supabase.from('expenses').insert([{
    id: testId,
    title: 'Test null group',
    amount: 100,
    created_by: '00000000-0000-0000-0000-000000000000'
  }]);
  
  console.log('Insert err:', insErr ? insErr.message : 'Success! Null group allowed');

  if (!insErr) {
    await supabase.from('expenses').delete().eq('id', testId);
  }
}
check();
