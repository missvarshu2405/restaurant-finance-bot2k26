// ============================================
// Unified Data Store — Supabase or In-Memory
// Auto-selects based on SUPABASE_URL env var
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';

// ---- Detect mode ----
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const USE_SUPABASE = !!(SUPABASE_URL && SUPABASE_KEY);

let supabase = null;
if (USE_SUPABASE) {
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  console.log('📦 Data store: Supabase connected');

  // Auto-migrate: ensure password_hash columns exist
  (async () => {
    try {
      // Create the exec_sql function if it doesn't exist (allows running DDL via RPC)
      const createFnSQL = `
        CREATE OR REPLACE FUNCTION exec_sql(query text)
        RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
        BEGIN EXECUTE query; END; $$;
      `;
      // Use the /rest/v1/rpc endpoint with raw fetch since supabase-js can't create functions
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query: createFnSQL }),
      });
    } catch (e) { /* ignore if function creation fails */ }

    // Try the RPC-based migration
    const migrations = [
      "ALTER TABLE owners ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''",
      "ALTER TABLE managers ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT ''",
      "ALTER TABLE managers ADD COLUMN IF NOT EXISTS password TEXT DEFAULT ''",
      "ALTER TABLE accountants ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT ''",
      // v2.1 — Bill discount/GST enhancements
      "ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0",
      "ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0",
      "ALTER TABLE bills ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12,2) DEFAULT 0",
      "ALTER TABLE bills ADD COLUMN IF NOT EXISTS round_off NUMERIC(8,2) DEFAULT 0",
      "ALTER TABLE bills ADD COLUMN IF NOT EXISTS fssai_number TEXT DEFAULT ''",
    ];

    for (const sql of migrations) {
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
          const tableName = sql.match(/TABLE (\w+)/)?.[1];
          const colName = sql.match(/COLUMN.*?(\w+)\s+(?:TEXT|NUMERIC)/)?.[1];
          console.log(`  ✅ Migration: ${tableName}.${colName}`);
        }
      } catch (e) { /* migration will be handled manually */ }
    }

    // Verify columns exist
    const { error } = await supabase.from('owners').select('password_hash').limit(0);
    if (error) {
      console.warn('  ⚠️  Auto-migration incomplete — run this SQL in Supabase Dashboard > SQL Editor:');
      console.warn("     ALTER TABLE owners ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';");
      console.warn("     ALTER TABLE managers ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';");
      console.warn("     ALTER TABLE managers ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';");
      console.warn("     ALTER TABLE accountants ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';");
    } else {
      console.log('  ✅ All schema columns verified');
    }
  })();
} else {
  console.log('📦 Data store: In-memory (no SUPABASE_URL)');
}

// ---- In-memory tables (fallback) ----
const db = {
  owners: [],
  branches: [],
  managers: [],
  accountants: [],
  vendors: [],
  bills: [],
  notifications: [],
  audit_log: [],
  recipes: [],
  wastage_log: [],
  staff_register: [],
  attendance_log: [],
  petty_cash_log: [],
  category_budgets: [],
  recurring_vendors: [],
};

// ============================================
// CRUD Functions (async, works with both modes)
// ============================================

async function getAll(table) {
  if (!USE_SUPABASE) return db[table] || [];
  const { data, error } = await supabase.from(table).select('*');
  if (error) { console.error(`getAll(${table}):`, error.message); return []; }
  return data || [];
}

async function getById(table, id) {
  if (!USE_SUPABASE) return (db[table] || []).find(row => row.id === id) || null;
  const { data, error } = await supabase.from(table).select('*').eq('id', id).maybeSingle();
  if (error) { console.error(`getById(${table}, ${id}):`, error.message); return null; }
  return data;
}

async function getWhere(table, predicateOrFilters) {
  if (!USE_SUPABASE) return (db[table] || []).filter(predicateOrFilters);
  // For Supabase, predicateOrFilters is an object of { column: value } pairs
  if (typeof predicateOrFilters === 'function') {
    // Fallback: fetch all and filter in JS (for complex predicates)
    const all = await getAll(table);
    return all.filter(predicateOrFilters);
  }
  let query = supabase.from(table).select('*');
  for (const [key, value] of Object.entries(predicateOrFilters)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query;
  if (error) { console.error(`getWhere(${table}):`, error.message); return []; }
  return data || [];
}

async function findOne(table, predicateOrFilters) {
  if (!USE_SUPABASE) return (db[table] || []).find(predicateOrFilters) || null;
  if (typeof predicateOrFilters === 'function') {
    const all = await getAll(table);
    return all.find(predicateOrFilters) || null;
  }
  let query = supabase.from(table).select('*');
  for (const [key, value] of Object.entries(predicateOrFilters)) {
    query = query.eq(key, value);
  }
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) { console.error(`findOne(${table}):`, error.message); return null; }
  return data;
}

async function insert(table, data) {
  if (!USE_SUPABASE) {
    const row = { id: uuidv4(), created_at: new Date().toISOString(), ...data };
    db[table].push(row);
    return row;
  }
  const row = { id: uuidv4(), ...data };
  const { data: inserted, error } = await supabase.from(table).insert(row).select().single();
  if (error) {
    console.error(`insert(${table}):`, error.message);
    throw new Error(`DB insert failed (${table}): ${error.message}`);
  }
  return inserted;
}

async function update(table, id, updates) {
  if (!USE_SUPABASE) {
    const row = (db[table] || []).find(r => r.id === id);
    if (row) Object.assign(row, updates);
    return row;
  }
  const { data, error } = await supabase.from(table).update(updates).eq('id', id).select().single();
  if (error) { console.error(`update(${table}, ${id}):`, error.message); return null; }
  return data;
}

async function remove(table, id) {
  if (!USE_SUPABASE) {
    const idx = (db[table] || []).findIndex(row => row.id === id);
    if (idx > -1) { db[table].splice(idx, 1); return true; }
    return false;
  }
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) { console.error(`remove(${table}, ${id}):`, error.message); return false; }
  return true;
}

async function removeWhere(table, predicateOrFilters) {
  if (!USE_SUPABASE) {
    db[table] = (db[table] || []).filter(row => !predicateOrFilters(row));
    return;
  }
  if (typeof predicateOrFilters === 'function') {
    const all = await getAll(table);
    const toDelete = all.filter(predicateOrFilters);
    for (const row of toDelete) {
      await supabase.from(table).delete().eq('id', row.id);
    }
  } else {
    let query = supabase.from(table).delete();
    for (const [key, value] of Object.entries(predicateOrFilters)) {
      query = query.eq(key, value);
    }
    await query;
  }
}

async function count(table, predicate) {
  if (!USE_SUPABASE) {
    if (!predicate) return (db[table] || []).length;
    return (db[table] || []).filter(predicate).length;
  }
  if (predicate) {
    const all = await getAll(table);
    return all.filter(predicate).length;
  }
  const { count: cnt, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
  if (error) return 0;
  return cnt || 0;
}

// ---- Export ----
export {
  db,
  getAll,
  getById,
  getWhere,
  findOne,
  insert,
  update,
  remove,
  removeWhere,
  count,
};
