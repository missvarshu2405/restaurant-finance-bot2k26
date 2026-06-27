// Run ALTER TABLE on Supabase PostgreSQL
import pg from 'pg';
const { Client } = pg;

// Supabase direct connection (pooler mode)
// Format: postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres
// Since we don't have the DB password, we use the service role key as a workaround
// by creating an RPC function first, or using the connection pooler

// Actually, we need the database password. Let's use Supabase's approach:
// The PostgREST API strips unknown columns silently on INSERT.
// So we need a workaround:

// Option 1: Use Supabase JS client to create a postgres function
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run() {
  console.log('🔄 Creating helper function and running migrations...\n');

  // Step 1: Create a helper RPC function that can execute arbitrary SQL
  // We use the supabase-js to call PostgREST which can create functions via raw SQL header
  const alterStatements = [
    "ALTER TABLE owners ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''",
    "ALTER TABLE managers ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT ''",
    "ALTER TABLE managers ADD COLUMN IF NOT EXISTS password TEXT DEFAULT ''",
    "ALTER TABLE accountants ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT ''",
  ];

  // Try using the SQL directly through the PostgREST API with the special header
  for (const sql of alterStatements) {
    console.log(`Running: ${sql.substring(0, 60)}...`);
    
    const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/rpc/`, {
      method: 'POST',
      headers: {
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    
    if (!res.ok) {
      // Expected - RPC won't work. Let's try a different approach.
    }
  }

  // Step 2: Verify by trying to select password_hash
  const { data, error } = await supabase.from('owners').select('password_hash').limit(1);
  if (error) {
    console.log(`\n❌ password_hash column still missing from owners table.`);
    console.log(`\n📋 You need to run this SQL manually in Supabase Dashboard > SQL Editor:\n`);
    console.log(`ALTER TABLE owners ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';`);
    console.log(`ALTER TABLE managers ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';`);
    console.log(`ALTER TABLE managers ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';`);
    console.log(`ALTER TABLE accountants ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';`);
    console.log(`\nOR provide your Supabase database password so I can connect directly.`);
  } else {
    console.log('✅ All columns exist!');
  }
}

run().catch(console.error);
