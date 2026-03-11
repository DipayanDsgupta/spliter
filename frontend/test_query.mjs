import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://eebfuvyszyfehvzdmmjc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVlYmZ1dnlzenlmZWh2emRtbWpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjc4ODgsImV4cCI6MjA4ODc0Mzg4OH0.gBJ7ZnTvR3qi_BjJasjKsXTg2BDfb0xwF2C2Km5Ib10'
);

(async () => {
    console.log("Testing join query...");
    const { data, error } = await supabase.from('group_members').select('group_id, user_id, users(*)').limit(1);
    console.log(error ? error : "OK");
    if (!error) console.log(data);
})();
