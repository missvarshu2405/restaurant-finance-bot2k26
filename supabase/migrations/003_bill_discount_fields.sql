-- ============================================
-- Migration 003: Add discount/GST enhancement fields to bills
-- Supports: discounts, actual GST amounts, round-off, FSSAI
-- ============================================

ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS taxable_amount NUMERIC(12,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS round_off NUMERIC(8,2) DEFAULT 0;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS fssai_number TEXT DEFAULT '';
