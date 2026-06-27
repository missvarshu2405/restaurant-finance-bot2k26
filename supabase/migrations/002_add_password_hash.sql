-- ============================================
-- RestaurantLedger v2.0 — Schema Migration
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Add password_hash to owners (required for authentication)
ALTER TABLE owners ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '';

-- 2. Add password_hash and password to managers
ALTER TABLE managers ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';
ALTER TABLE managers ADD COLUMN IF NOT EXISTS password TEXT DEFAULT '';

-- 3. Add password_hash to accountants
ALTER TABLE accountants ADD COLUMN IF NOT EXISTS password_hash TEXT DEFAULT '';

-- 4. Create helper function for future auto-migrations
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN EXECUTE query; END; $$;

-- 5. Grant storage access for bill images
-- (Run only if the bill-images bucket policy doesn't exist yet)
INSERT INTO storage.policies (name, bucket_id, operation, definition)
SELECT 'Allow public read', 'bill-images', 'SELECT', 'true'
WHERE NOT EXISTS (
  SELECT 1 FROM storage.policies WHERE name = 'Allow public read' AND bucket_id = 'bill-images'
);

-- Done! You can verify by running:
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'owners' AND column_name = 'password_hash';
