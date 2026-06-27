-- ============================================
-- RestaurantLedger v2.0 — Database Schema
-- 14 tables covering all v2.0 features
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. OWNERS
-- =============================================
CREATE TABLE owners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  business_name TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  pan TEXT DEFAULT '',
  business_address TEXT DEFAULT '',
  financial_year_start INT DEFAULT 4,
  currency TEXT DEFAULT 'INR',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. BRANCHES
-- =============================================
CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  branch_code TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  address TEXT DEFAULT '',
  city TEXT DEFAULT '',
  gstin TEXT DEFAULT '',
  daily_budget NUMERIC(12,2) DEFAULT 0,
  monthly_budget NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  shift_templates JSONB DEFAULT '[
    {"name": "Morning", "start": "06:00", "end": "11:00"},
    {"name": "Lunch", "start": "11:00", "end": "16:00"},
    {"name": "Dinner", "start": "16:00", "end": "23:00"}
  ]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 3. MANAGERS
-- =============================================
CREATE TABLE managers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT DEFAULT '',
  password TEXT DEFAULT '',
  email TEXT DEFAULT '',
  whatsapp TEXT DEFAULT '',
  role TEXT DEFAULT 'manager',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 4. ACCOUNTANTS (new in v2.0)
-- =============================================
CREATE TABLE accountants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT DEFAULT '',
  access_expiry DATE,
  receives_monthly_summary BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 5. VENDORS
-- =============================================
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  gstin TEXT DEFAULT '',
  contact TEXT DEFAULT '',
  category TEXT DEFAULT 'miscellaneous',
  preferred_status TEXT DEFAULT 'normal',  -- normal, preferred, blacklisted
  payment_terms TEXT DEFAULT '',           -- Net 7, Net 30, etc.
  bank_details JSONB DEFAULT '{}'::jsonb,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 6. BILLS (core table — enhanced for v2.0)
-- =============================================
CREATE TABLE bills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES managers(id),
  vendor_name TEXT NOT NULL DEFAULT '',
  vendor_id UUID REFERENCES vendors(id),
  bill_date DATE NOT NULL DEFAULT CURRENT_DATE,
  bill_number TEXT DEFAULT '',
  vendor_gstin TEXT DEFAULT '',
  vendor_contact TEXT DEFAULT '',
  hsn_code TEXT DEFAULT '',
  category TEXT DEFAULT 'miscellaneous',
  payment_mode TEXT DEFAULT 'cash',       -- cash, upi, card, credit
  items JSONB DEFAULT '[]'::jsonb,        -- [{description, qty, unit, rate, amount}]
  subtotal NUMERIC(12,2) DEFAULT 0,
  gst_rate NUMERIC(5,2) DEFAULT 0,
  cgst NUMERIC(12,2) DEFAULT 0,
  sgst NUMERIC(12,2) DEFAULT 0,
  igst NUMERIC(12,2) DEFAULT 0,
  total_amount NUMERIC(12,2) DEFAULT 0,
  image_url TEXT DEFAULT '',
  status TEXT DEFAULT 'pending',          -- draft, processing, pending, verified, flagged
  flags TEXT[] DEFAULT '{}',
  owner_notes TEXT DEFAULT '',
  ai_confidence JSONB DEFAULT '{}'::jsonb, -- {overall: 0.85, vendor: 0.9, date: 0.7, ...}
  shift TEXT DEFAULT '',                  -- morning, lunch, dinner
  is_manual BOOLEAN DEFAULT false,
  is_recurring BOOLEAN DEFAULT false,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  verified_at TIMESTAMPTZ,
  verified_by UUID
);

-- =============================================
-- 7. NOTIFICATIONS
-- =============================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  branch_id UUID REFERENCES branches(id),
  type TEXT NOT NULL,                     -- budget_alert, duplicate_flag, anomaly, etc.
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 8. AUDIT LOG
-- =============================================
CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  actor_id UUID,
  actor_role TEXT DEFAULT 'system',
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id UUID,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 9. RECIPES (new in v2.0 — menu costing)
-- =============================================
CREATE TABLE recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_id UUID NOT NULL REFERENCES owners(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  selling_price NUMERIC(12,2) DEFAULT 0,
  target_margin NUMERIC(5,2) DEFAULT 60,  -- target gross margin %
  ingredients JSONB DEFAULT '[]'::jsonb,   -- [{name, qty, unit, category, cost_per_unit}]
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 10. WASTAGE LOG (new in v2.0)
-- =============================================
CREATE TABLE wastage_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES managers(id),
  item_name TEXT NOT NULL,
  qty NUMERIC(10,3) DEFAULT 0,
  unit TEXT DEFAULT 'kg',
  reason TEXT DEFAULT 'spoilage',          -- spoilage, over_prep, dropped, expired
  estimated_value NUMERIC(12,2) DEFAULT 0,
  linked_bill_id UUID REFERENCES bills(id),
  logged_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 11. STAFF REGISTER (new in v2.0)
-- =============================================
CREATE TABLE staff_register (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'helper',              -- cook, waiter, helper, cleaner, cashier
  wage_type TEXT DEFAULT 'daily',          -- daily, monthly
  daily_rate NUMERIC(10,2) DEFAULT 0,
  monthly_salary NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 12. ATTENDANCE LOG (new in v2.0)
-- =============================================
CREATE TABLE attendance_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  staff_id UUID NOT NULL REFERENCES staff_register(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  shift TEXT DEFAULT 'morning',
  present BOOLEAN DEFAULT true,
  overtime_hours NUMERIC(4,1) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(staff_id, date, shift)
);

-- =============================================
-- 13. PETTY CASH LOG (new in v2.0)
-- =============================================
CREATE TABLE petty_cash_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  manager_id UUID NOT NULL REFERENCES managers(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  opening_balance NUMERIC(12,2) DEFAULT 0,
  closing_balance NUMERIC(12,2),
  expected_closing NUMERIC(12,2) DEFAULT 0,
  variance NUMERIC(12,2) DEFAULT 0,
  notes TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, date)
);

-- =============================================
-- 14. CATEGORY BUDGETS (new in v2.0)
-- =============================================
CREATE TABLE category_budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  monthly_limit NUMERIC(12,2) DEFAULT 0,
  current_month_spend NUMERIC(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(branch_id, category)
);

-- =============================================
-- 15. RECURRING VENDORS (new in v2.0)
-- =============================================
CREATE TABLE recurring_vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id),
  vendor_name TEXT NOT NULL,
  frequency TEXT DEFAULT 'daily',          -- daily, weekly, monthly
  typical_amount NUMERIC(12,2) DEFAULT 0,
  category TEXT DEFAULT 'miscellaneous',
  gst_rate NUMERIC(5,2) DEFAULT 0,
  payment_mode TEXT DEFAULT 'cash',
  requires_image BOOLEAN DEFAULT false,
  icon TEXT DEFAULT '📦',
  display_order INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes for performance
-- =============================================
CREATE INDEX idx_bills_branch_date ON bills(branch_id, bill_date);
CREATE INDEX idx_bills_status ON bills(status);
CREATE INDEX idx_bills_manager ON bills(manager_id);
CREATE INDEX idx_bills_vendor ON bills(vendor_name);
CREATE INDEX idx_bills_category ON bills(category);
CREATE INDEX idx_notifications_owner ON notifications(owner_id, read);
CREATE INDEX idx_audit_log_owner ON audit_log(owner_id, created_at);
CREATE INDEX idx_wastage_branch ON wastage_log(branch_id, logged_at);
CREATE INDEX idx_attendance_branch_date ON attendance_log(branch_id, date);
CREATE INDEX idx_petty_cash_branch ON petty_cash_log(branch_id, date);
CREATE INDEX idx_staff_branch ON staff_register(branch_id);
CREATE INDEX idx_recurring_branch ON recurring_vendors(branch_id);
