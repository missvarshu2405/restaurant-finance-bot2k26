# 🍽️ RestaurantLedger v2.0

A full-stack, AI-powered expense management system built specifically for multi-branch Indian restaurants. Managers photograph bills with their phones; owners see real-time spend analytics, anomaly flags, and GST-ready reports — all without manual data entry.

---

## ✨ Features

### 🤖 AI Bill Extraction
- Photograph any bill — printed, handwritten (kaccha), regional-language, or GST invoice
- Google Gemini AI (with automatic fallback across 3 models: `gemini-2.5-flash`, `gemini-2.5-flash-lite`, `gemini-2.5-pro`, and across up to 3 API keys) extracts vendor name, date, line items, GST breakdown, discount, payment mode, and more
- Confidence scoring displayed per extracted field
- Handles Indian date formats (DD/MM/YYYY, DD-MM-YY), multiple Indian languages (Hindi, Marathi, Tamil, Kannada, Telugu, Bengali, Gujarati), and UPI/GPay/PhonePe payment detection

### 🏢 Multi-Branch Management
- Owner account manages multiple restaurant branches from one dashboard
- Each branch has daily and monthly budgets, shift templates, and its own manager
- Branch-level analytics and cross-branch comparisons on the overview dashboard

### 🔐 Role-Based Access

| Role | Access |
|------|--------|
| **Owner** | Full access — all branches, reports, anomalies, settings, user management |
| **Manager** | Branch-scoped — bill upload, petty cash, staff attendance, wastage log, own bills |
| **Accountant** | Read-only reporting — P&L, GST report, vendor payments, year-end summary |

### 🚨 Anomaly Detection (9 Types)

Runs automatically on every bill submission and batch scan:

1. **Duplicate bill** — same vendor + date + amount ±2%
2. **Round-number spike** — amounts ending in 000/500 above ₹5,000
3. **Unusual vendor amount** — statistical outlier vs. vendor history
4. **Off-hours submission**
5. **Missing image** on high-value bills
6. **Vendor frequency spike**
7. **New vendor high amount**
8. **Category mismatch**
9. **Budget overshoot pattern**

### 📊 Reports (12 Types)

- P&L Summary by category
- GST Report (GSTR-ready, with ITC claimable)
- Cash Flow
- Vendor Payments
- Shift Cost Analysis
- Recipe Cost (menu item profitability)
- Staff Cost
- Wastage Report
- Utility Bills
- Budget vs Actual
- Anomaly Report
- Year-End Summary

### 📦 Other Modules

- **Petty Cash** — cash reconciliation with opening/closing balance
- **Staff Attendance** — daily attendance logging per branch
- **Wastage Log** — food wastage tracking by item
- **Recipe Costing** — ingredient cost breakdown per menu item
- **Vendor Management** — scorecards, preferred/blacklisted status, payment terms, GSTIN tracking
- **Recurring Vendors** — Quick Entry shortcuts for frequent suppliers
- **Batch Upload** — upload multiple bills at once
- **Budget Alerts** — real-time notifications when branches approach or exceed budgets
- **Audit Log** — full activity trail per user

### 🔔 Notifications & Scheduled Jobs

- Daily digest email at 9 PM (bill count, total spend, top category)
- Morning budget reminder at 8 AM
- Inactivity check at 8 PM (flags branches with no bills in 24h)
- Month-end reminder on the 25th
- Monthly budget reset on the 1st
- Optional WhatsApp notifications via Meta Cloud API

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS (ES Modules), Vite, Chart.js, jsPDF |
| Backend | Node.js, Express.js |
| Database | Supabase (PostgreSQL) — falls back to in-memory store without config |
| AI/OCR | Google Gemini API (multi-model with automatic fallback) |
| Auth | JWT (jsonwebtoken) + bcryptjs password hashing |
| Email | Nodemailer (SMTP / Gmail) |
| WhatsApp | Meta Cloud API (optional) |
| Deployment | Vercel (frontend + API functions + cron jobs) |

---

## 📁 Project Structure

```
restaurant-finance-bot/
├── src/                        # Frontend (Vite + Vanilla JS)
│   ├── components/             # Reusable UI components
│   │   ├── bottomNav.js        # Mobile bottom navigation
│   │   ├── sidebar.js          # Desktop sidebar navigation
│   │   ├── header.js           # App header with branch selector
│   │   ├── cameraCapture.js    # Camera/file bill upload
│   │   ├── charts.js           # Chart.js wrappers
│   │   ├── table.js            # Sortable/filterable data table
│   │   ├── modal.js            # Modal component
│   │   ├── toast.js            # Toast notification
│   │   ├── confidenceBadge.js  # AI confidence indicator
│   │   └── shiftSelector.js    # Shift picker
│   ├── pages/                  # Page modules (owner + manager views)
│   │   ├── login.js            # Owner / Manager / Accountant login + signup
│   │   ├── overview.js         # Live dashboard (all branches)
│   │   ├── upload.js           # Camera-first bill upload
│   │   ├── batchUpload.js      # Multi-bill upload
│   │   ├── quickEntry.js       # Recurring vendor shortcuts
│   │   ├── expenses.js         # Owner expenses view
│   │   ├── myExpenses.js       # Manager expenses view
│   │   ├── reports.js          # 12-report hub
│   │   ├── anomalies.js        # Flagged bills
│   │   ├── vendors.js          # Vendor management
│   │   ├── branches.js         # Branch management
│   │   ├── budgets.js          # Budget tracking
│   │   ├── users.js            # Manager accounts
│   │   ├── staffAttendance.js  # Attendance logging
│   │   ├── pettyCash.js        # Petty cash reconciliation
│   │   ├── wastageLog.js       # Food wastage tracking
│   │   ├── recipes.js          # Recipe costing
│   │   ├── managerHome.js      # Manager daily briefing
│   │   ├── mySummary.js        # Branch summary
│   │   ├── audit.js            # Activity log
│   │   ├── notifications.js    # Alerts view
│   │   └── settings.js         # Business settings
│   ├── services/
│   │   ├── api.js              # Authenticated API client
│   │   ├── ocrService.js       # Client-side Gemini OCR (fallback)
│   │   └── exportService.js    # PDF / CSV export
│   ├── data/
│   │   └── store.js            # App state, formatters, categories
│   ├── main.js                 # App router + auth orchestration
│   └── style.css               # Global styles (mobile-first)
│
├── backend/                    # Express.js API
│   ├── server.js               # Entry point, middleware, route registration
│   ├── routes/
│   │   ├── auth.js             # Login, signup, token refresh
│   │   ├── bills.js            # Bill CRUD + AI extraction endpoint
│   │   ├── branches.js         # Branch management
│   │   ├── managers.js         # Manager account management
│   │   ├── vendors.js          # Vendor CRUD + analytics
│   │   ├── reports.js          # 12 report endpoints
│   │   ├── notifications.js    # Notification read/clear
│   │   ├── staff.js            # Staff attendance
│   │   ├── pettyCash.js        # Petty cash entries
│   │   ├── wastage.js          # Wastage log
│   │   ├── recipes.js          # Recipe costing
│   │   └── recurringVendors.js # Recurring vendor shortcuts
│   ├── services/
│   │   ├── geminiService.js    # Gemini AI with 3-model fallback
│   │   ├── anomalyEngine.js    # 9-type anomaly detection
│   │   ├── memoryStore.js      # In-memory DB (Supabase fallback)
│   │   ├── emailService.js     # Nodemailer daily digest
│   │   ├── whatsappService.js  # Meta Cloud API notifications
│   │   └── supabaseStorage.js  # File upload to Supabase Storage
│   ├── middleware/
│   │   ├── auth.js             # JWT verification
│   │   ├── roleGuard.js        # Role-based route protection
│   │   └── rateLimit.js        # express-rate-limit config
│   ├── jobs/
│   │   └── scheduler.js        # node-cron job definitions
│   └── .env.example            # Environment variable template
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql       # 14-table schema
│       ├── 002_add_password_hash.sql
│       ├── 003_bill_discount_fields.sql
│       ├── 004_failed_scan_fields.sql
│       └── 005_image_hash_column.sql
│
├── api/                        # Vercel serverless functions
│   ├── index.js                # API gateway (wraps Express)
│   └── cron/
│       ├── evening.js          # Daily digest (9:30 PM UTC)
│       └── monthly.js          # Monthly summary (6 PM UTC, 1st)
│
├── vercel.json                 # Vercel deployment config + cron schedule
├── vite.config.js              # Vite build config
└── index.html                  # SPA shell
```

> **Note:** if this project was generated from a zip file, double-check that `005_image_hash_column.sql` actually lives at `supabase/migrations/005_image_hash_column.sql`. A packaging issue can sometimes nest it one level too deep (e.g. `supabase/migrations/supabase/migrations/005_image_hash_column.sql`) — if so, move it up one level before running migrations.

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (optional — app runs with in-memory store without it)
- A [Google Gemini API key](https://aistudio.google.com) for AI bill extraction

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd restaurant-finance-bot

# Install frontend dependencies
npm install

# Install backend dependencies
cd backend && npm install && cd ..
```

> If you're moving this project between operating systems (e.g. `node_modules` was zipped on Windows and you're now on Mac/Linux, or vice versa), native build tools like `esbuild` and `rollup` won't run. Delete both `node_modules` folders and `package-lock.json` files and reinstall on the target machine:
> ```bash
> rm -rf node_modules package-lock.json backend/node_modules backend/package-lock.json
> npm install
> cd backend && npm install && cd ..
> ```

### 2. Configure Environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` and fill in:

```env
PORT=3001
NODE_ENV=development
JWT_SECRET=<a-long-random-secret>

# Supabase (leave blank to use in-memory store)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Gemini AI (required for bill extraction)
GEMINI_API_KEY=
GEMINI_API_KEY_FALLBACK=
GEMINI_API_KEY_FALLBACK_2=

# Email notifications (optional)
EMAIL_ENABLED=false
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=
EMAIL_PASS=

# WhatsApp (optional)
WHATSAPP_ENABLED=false
WHATSAPP_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
```

Leaving `SUPABASE_URL` blank is fine for local testing — the backend automatically falls back to an in-memory store and logs `Using in-memory store` on startup. Data won't persist across restarts in that mode.

### 3. Set Up the Database (if using Supabase)

Run the migrations **in order** in the Supabase SQL editor:

```
supabase/migrations/001_initial_schema.sql
supabase/migrations/002_add_password_hash.sql
supabase/migrations/003_bill_discount_fields.sql
supabase/migrations/004_failed_scan_fields.sql
supabase/migrations/005_image_hash_column.sql
```

### 4. Run Locally

```bash
# Start backend (in /backend)
npm run dev   # runs on http://localhost:3001

# Start frontend (in project root, separate terminal)
npm run dev   # runs on http://localhost:5173
```

To confirm the backend started cleanly, you should see something like:

```
🍽️  RestaurantLedger API v2.0
   Server running on http://localhost:3001
   Environment: development
   Supabase: Using in-memory store   (or "Connected" if SUPABASE_URL is set)

⏰ Cron jobs initialized
```

---

## 🔧 Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| `SyntaxError: Illegal return statement` on backend start | A `return` statement sitting outside its enclosing function (mismatched braces) | Run `node --check <file>` to locate the exact file/line, then verify every `{` has a matching `}` in the right place |
| `SyntaxError: Unexpected token 'export'` | A helper function above the route definitions never closed, so route handlers got nested inside it as dead code | Make sure helper functions used by route files (e.g. `getOwnerBills` in `reports.js`) close with `}` immediately after their `return` statement, *before* any `router.get(...)` calls |
| Some `/api/reports/*` endpoints return 404 | Route handlers were defined inside another function and never registered on the router (see above) | Run `node --check backend/routes/reports.js` — if it passes, restart the backend and recheck |
| `Cannot find module @rollup/rollup-<platform>` or `@esbuild/<platform>` during `npm run dev` / `vite build` | `node_modules` was installed on a different OS/architecture than the one you're running on now | Delete `node_modules` and `package-lock.json`, then `npm install` fresh on the machine you're actually using |
| Startup log says `Using in-memory store` even though `.env` looks filled in | `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` are present as keys but have empty values | Fill in real values from your Supabase project settings, or leave them blank intentionally for in-memory mode |

Before reporting a bug, it's worth running a quick syntax sweep across the backend:

```bash
cd backend
for f in $(find . -name "*.js" -not -path "./node_modules/*"); do node --check "$f" || echo "FAILED: $f"; done
```

No `FAILED:` lines means every file parses cleanly.

---

## 🌐 Deployment (Vercel)

The project is pre-configured for Vercel with `vercel.json`.

```bash
npm install -g vercel
vercel
```

Set the same environment variables from `backend/.env` in your Vercel project dashboard under **Settings → Environment Variables**.

Cron jobs run automatically via Vercel Cron:

| Job | Schedule | Endpoint |
|-----|----------|----------|
| Daily Digest | 9:30 PM UTC daily | `GET /api/cron/evening` |
| Monthly Summary | 6 PM UTC on the 1st | `GET /api/cron/monthly` |

---

## 🗄️ Database Schema

The Supabase schema has 14 tables:

| Table | Purpose |
|-------|---------|
| `owners` | Restaurant owner accounts |
| `branches` | Individual restaurant locations |
| `managers` | Branch manager accounts |
| `accountants` | Read-only finance user accounts |
| `vendors` | Supplier/vendor directory |
| `bills` | Expense bill records (core table) |
| `bill_items` | Line items extracted from bills |
| `budgets` | Daily/monthly budget targets per branch |
| `notifications` | In-app notification log |
| `staff` | Staff member directory |
| `staff_attendance` | Daily attendance records |
| `petty_cash` | Petty cash entries and reconciliation |
| `wastage_log` | Food wastage records |
| `recipes` | Menu item recipe and costing data |

---

## 📡 API Endpoints

All routes are prefixed with `/api/`.

### Authentication

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/auth/login` | Login (owner / manager / accountant) |
| `POST` | `/auth/register` | Owner signup |

### Bills

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/bills` | List bills |
| `POST` | `/bills` | Create a bill |
| `POST` | `/bills/extract` | AI extraction from bill image |

### Reports

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/reports/pnl` | P&L by category |
| `GET` | `/reports/gst` | GST report (GSTR-ready) |
| `GET` | `/reports/cashflow` | Cash flow over time |
| `GET` | `/reports/vendor-payments` | Vendor payment summary |
| `GET` | `/reports/shift-cost` | Cost by shift |
| `GET` | `/reports/recipe-cost` | Recipe profitability |
| `GET` | `/reports/staff-cost` | Staff wage analysis |
| `GET` | `/reports/wastage` | Wastage cost report |
| `GET` | `/reports/utility` | Utility bill tracker |
| `GET` | `/reports/budget-actual` | Budget vs. actual spend |
| `GET` | `/reports/anomalies` | Anomaly detection report |
| `GET` | `/reports/year-end` | Year-end financial summary |

### System

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/api/health` | Health check (`{ status: "ok", version: "2.0.0" }`) |

---

## 🏷️ Bill Categories

Bills are auto-categorised by AI into:

`produce` · `dairy` · `meat_seafood` · `dry_goods` · `beverages` · `packaging` · `fuel_gas` · `cleaning` · `maintenance` · `electricity` · `water` · `rent` · `staff_wages` · `marketing` · `miscellaneous`

---

## 📄 License

Private / proprietary. All rights reserved.