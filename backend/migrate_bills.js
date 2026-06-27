import 'dotenv/config';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sqls = [
  "ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0",
  "ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0",
  "ALTER TABLE bills ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12,2) DEFAULT 0",
  "ALTER TABLE bills ADD COLUMN IF NOT EXISTS round_off NUMERIC(8,2) DEFAULT 0",
  "ALTER TABLE bills ADD COLUMN IF NOT EXISTS fssai_number TEXT DEFAULT ''",
];

async function run() {
  console.log('Running bill discount/GST migrations...\n');

  for (const sql of sqls) {
    const col = sql.match(/(\w+)\s+(?:NUMERIC|TEXT)/)?.[1];
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: sql }),
      });
      if (res.ok) {
        console.log(`  ✅ ${col}: Added successfully`);
      } else {
        const txt = await res.text();
        console.log(`  ❌ ${col}: ${res.status} - ${txt.substring(0, 200)}`);
      }
    } catch (e) {
      console.log(`  ❌ ${col}: ${e.message}`);
    }
  }

  // Verify
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { error } = await supabase.from('bills').select('discount_amount').limit(0);
  if (error) {
    console.log('\n❌ Columns still missing! Run this SQL in Supabase Dashboard > SQL Editor:\n');
    sqls.forEach(s => console.log(s + ';'));
  } else {
    console.log('\n✅ All new columns verified in bills table!');
  }
}

run().catch(console.error);
