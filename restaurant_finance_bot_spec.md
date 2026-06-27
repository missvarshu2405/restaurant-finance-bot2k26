# 📊 RestaurantLedger — WhatsApp-Native Multi-Branch Finance & Expense Management Bot
### Product Specification Document (v1.0)
> **Intended Use:** This document is the complete implementation blueprint for the RestaurantLedger system. It is structured for a developer or AI coding assistant to build from scratch. All flows, data models, roles, edge cases, and feature details are fully described.

---

## 1. Product Overview

**RestaurantLedger** is a WhatsApp-based expense tracking and financial management system built for restaurant owners who operate **multiple branches or outlets**. It eliminates paper-based bookkeeping and scattered receipts by allowing branch managers or staff to upload bills directly via WhatsApp. The system uses **OCR (Optical Character Recognition) + AI** to extract bill details automatically, categorize expenses, and surface everything to the owner through a **real-time web dashboard**.

The system also powers downstream financial use cases including **GST filing, profit & loss reporting, vendor spend analysis, budget tracking, audit trails, and payroll expense tracking**.

**Core Value Proposition:**
- No app to install — managers use WhatsApp they already have
- Bills uploaded as images → data extracted automatically (no manual entry)
- Owner sees all branches in one consolidated dashboard
- Audit-ready records with source bill images attached
- GST and tax reports auto-generated from expense data

---

## 2. System Architecture Overview

```
Manager / Staff (WhatsApp)
          │
          ▼
[WhatsApp Business API — Meta Cloud API / Twilio]
          │
          ▼
[Bot Backend Server — Node.js / Python FastAPI]
          │
   ┌──────┴───────────────────────────────────────┐
   │                                              │
[Session & Auth Layer]               [Bill Processing Pipeline]
[Restaurant Code Validation]         [OCR Engine — Google Vision /
[Role Management]                     AWS Textract / Azure Form Recognizer]
                                      [AI Extraction & Categorization]
   │                                              │
   └───────────────────┬──────────────────────────┘
                       │
                 [Core Database]
                 PostgreSQL / Supabase
                 (Owners, Branches, Bills, Expenses, Users)
                       │
          ┌────────────┴──────────────┐
          │                           │
  [Owner Dashboard]           [Report Engine]
  (Web — React)               GST Reports / P&L /
  Multi-branch view           CSV / PDF Exports
```

---

## 3. User Roles

| Role | Interface | Responsibilities |
|---|---|---|
| **Owner** | Web Dashboard + WhatsApp (optional) | Create branches, view all expenses, generate reports, manage users |
| **Branch Manager** | WhatsApp Bot | Submit bills, view branch summary, manage daily expense log |
| **Staff / Helper** | WhatsApp Bot | Upload bills only (limited access, no view of summaries) |
| **Accountant** | Web Dashboard (read-only) | View reports, export for GST filing |
| **System (Bot)** | Automated | OCR processing, daily summaries, alerts, reminders |

---

## 4. Owner Setup Flow (Web Dashboard)

Before any WhatsApp interaction is possible, the owner sets up the system via the web dashboard.

### 4.1 Owner Registration

- Owner signs up on the web dashboard with email + password.
- Provides business details:
  - Business / Brand name
  - GSTIN (optional — needed for GST features)
  - PAN number (optional)
  - Business address
  - Financial year start month (default: April for India)
  - Currency (default: INR ₹)

### 4.2 Creating a Branch / Restaurant

For each branch, the owner fills:

| Field | Description |
|---|---|
| Branch Name | e.g., "Spice Garden — Koramangala" |
| Branch Code | Auto-generated **unique 6-character alphanumeric code** (e.g., `SG-K01`) — owner can customize |
| Address | Full address with city and pincode |
| GSTIN (Branch) | Branch-specific GSTIN if registered separately |
| Branch Manager Name | For reference |
| Branch Manager WhatsApp | For automated summaries and alerts |
| Monthly Budget | Optional — enables budget alert when overspent |
| Active Status | Toggle on/off |

**Branch Code** is the key credential given to managers. It is short, memorable, and unique across the entire system.

### 4.3 Adding WhatsApp Users Per Branch

The owner registers which WhatsApp numbers are authorized to submit bills for each branch:

- Add number → assign role (Manager / Staff)
- A number can be authorized for multiple branches (if a person manages multiple locations)
- Unauthorized numbers attempting to use the bot receive a rejection message

---

## 5. WhatsApp Bot — Manager/Staff Flow

### 5.1 First-Time Interaction

When an **authorized** WhatsApp number messages the bot for the first time:

```
Bot: Welcome to RestaurantLedger 👋
     Please enter your Restaurant Branch Code to get started.
```

Manager enters their branch code (e.g., `SG-K01`):

```
Bot: ✅ Branch Verified!

     📍 Spice Garden — Koramangala
     Address: 45, 12th Main, Koramangala, Bengaluru — 560034
     Manager: Ravi Kumar

     Is this correct? (Yes / No)
```

If **Yes** → session is linked to this branch, and the main menu is shown.
If **No** → bot asks them to re-enter the correct code.

**Security Notes:**
- Session is linked to both the WhatsApp number AND the branch code.
- If a number is not in the authorized list for that branch code → access denied.
- Branch code is case-insensitive.

### 5.2 Returning User

On subsequent messages, the bot recognizes the WhatsApp number:

```
Bot: Welcome back, Ravi! 👋
     Branch: Spice Garden — Koramangala

     What would you like to do?
     1. 📤 Upload a Bill
     2. 📋 Today's Expense Log
     3. 📅 This Week's Summary
     4. 💬 Add Manual Expense
     5. ❓ Help
```

A returning user does **not** need to re-enter the branch code unless they are authorized for multiple branches, in which case the bot asks them to confirm or switch branches.

### 5.3 Switching Branches (Multi-Branch Staff)

If a number is authorized for more than one branch:

```
Bot: You're authorized for multiple branches:
     1. Spice Garden — Koramangala (SG-K01)
     2. Spice Garden — Indiranagar (SG-IN2)

     Which branch are you submitting for today?
```

---

## 6. Bill Upload Flow (Core Feature)

### 6.1 Uploading a Bill

From the main menu, manager selects "Upload a Bill" or simply **sends an image directly** — the bot detects that an image was sent and triggers the bill flow.

```
Bot: 📤 Please send a clear photo of the bill.
     Make sure all text is visible and not blurry.
```

Manager sends a photo of the bill (vegetable invoice, milk bill, gas cylinder receipt, maintenance invoice, etc.)

### 6.2 OCR & AI Extraction Pipeline

Once the image is received:

**Step 1 — Image Validation**
- Check image quality (resolution, blur detection).
- If unreadable: `"This image is too blurry. Please retake and send again."`
- Supported formats: JPG, PNG, PDF (single page), HEIC (auto-converted).

**Step 2 — OCR Processing**
- Image sent to OCR engine (Google Cloud Vision API / AWS Textract / Azure Form Recognizer).
- Raw text extracted from the bill.

**Step 3 — AI Data Extraction**
- Extracted text is parsed by an AI model (Claude API) with a structured prompt.
- Fields extracted:

| Field | Description |
|---|---|
| `vendor_name` | Name of the shop/supplier |
| `vendor_contact` | Phone or address if present |
| `bill_date` | Date on the bill |
| `bill_number` | Invoice/bill number if present |
| `items` | Line items: description, quantity, unit, rate, amount |
| `subtotal` | Amount before tax |
| `gst_amount` | GST charged (CGST + SGST or IGST) |
| `gst_rate` | GST % if shown |
| `total_amount` | Final total payable |
| `payment_mode` | Cash / UPI / Credit (if mentioned) |
| `hsn_code` | HSN/SAC code if present (for GST) |

**Step 4 — Auto-Categorization**
- AI assigns an expense category based on item names and vendor:

| Category | Examples |
|---|---|
| `produce` | Vegetables, fruits, greens |
| `dairy` | Milk, paneer, butter, cream, curd |
| `meat_seafood` | Chicken, mutton, fish |
| `dry_goods` | Rice, flour, pulses, spices |
| `beverages` | Cold drinks, juices, water cans |
| `packaging` | Boxes, bags, tissue, foil |
| `fuel_gas` | LPG cylinder, kerosene |
| `cleaning` | Detergent, housekeeping supplies |
| `maintenance` | Repairs, equipment servicing |
| `electricity` | Electricity bill |
| `water` | Water bill, tanker charges |
| `rent` | Monthly rent invoice |
| `staff_wages` | Salary, wages, daily labour |
| `marketing` | Printing, ads, promotions |
| `miscellaneous` | Anything unclassified |

**Step 5 — Confirmation to Manager**

Bot sends the extracted details back for confirmation:

```
Bot: 🧾 Bill Scanned Successfully!

     Vendor: Ram Vegetables Mart
     Date: 10 Jun 2025
     Bill No: INV-4821

     Items:
     • Tomatoes — 10 kg @ ₹35 = ₹350
     • Onions — 15 kg @ ₹28 = ₹420
     • Coriander — 2 kg @ ₹60 = ₹120

     Subtotal: ₹890
     GST (5%): ₹44.50
     Total: ₹934.50

     Category: 🥦 Produce
     Payment: Cash

     ✅ Confirm and Save?
     (Yes / Edit / Wrong Bill)
```

### 6.3 Manager Confirmation Options

**"Yes"** → Bill saved, confirmation sent:
```
Bot: ✅ Bill saved! 
     Expense ID: EXP-20250610-0047
     Today's total for Koramangala: ₹4,230

     Send another bill or type 'menu' to go back.
```

**"Edit"** → Bot allows field-by-field correction:
```
Bot: Which field would you like to correct?
     1. Vendor Name
     2. Date
     3. Total Amount
     4. Category
     5. Payment Mode
     (Reply with number)
```
After correction, updated record is saved.

**"Wrong Bill"** → Bill discarded, process restarts.

### 6.4 Multi-Page / Multiple Bills in One Session

- Manager can upload multiple bills one after another in the same session.
- Each is processed independently and added to the day's expense log.
- After 5 minutes of inactivity, session returns to main menu.

### 6.5 Manual Expense Entry (No Bill Available)

For cases where no physical bill exists (e.g., petty cash, tips, small purchases):

```
Bot: No bill? No problem. Enter the details manually:

     1. Expense description (e.g., "Auto fare to market")
     2. Amount (₹)
     3. Category
     4. Date (today / DD-MM-YYYY)
     5. Payment mode (Cash / UPI / Card)
```

Manual entries are flagged as `bill_available: false` and shown distinctly in reports.

---

## 7. Daily Expense Log (Manager View via WhatsApp)

### 7.1 Today's Summary

Manager selects "Today's Expense Log":

```
Bot: 📋 Spice Garden — Koramangala
     Date: 10 Jun 2025

     ── Expenses Today ──────────────
     🥦 Produce          ₹934.50
     🥛 Dairy            ₹1,200.00
     🛢️ Fuel/Gas          ₹850.00
     🧹 Cleaning         ₹300.00
     ─────────────────────────────
     Total Today:        ₹3,284.50
     Budget Used:        65% of ₹5,000/day

     Bills Uploaded: 7  |  Manual Entries: 1
     
     Type 'bills' to see each bill or 'menu' to go back.
```

### 7.2 This Week's Summary

A day-by-day breakdown for the current week, with totals per category.

### 7.3 Budget Alert

If daily or monthly budget is set by the owner and 80% is reached:

```
Bot: ⚠️ Budget Alert — Koramangala
     You've used ₹4,100 of your ₹5,000 daily budget (82%).
     Remaining: ₹900

     (This alert has been sent to the owner as well.)
```

Owner also gets this alert on WhatsApp or as a dashboard notification.

---

## 8. Owner Dashboard (Web Application)

### 8.1 Overview / Home Screen

The first screen the owner sees after login:

**Top Bar:** Date range selector | Branch filter (All / Individual) | Currency

**Summary Cards:**
- Total Expenses Today (all branches)
- Total Expenses This Month
- Bills Uploaded Today
- Branches with no activity today (alert)
- Outstanding/Unverified Bills

**Charts:**
- Daily expense trend (last 30 days) — line chart
- Expense by category — donut chart
- Branch comparison — bar chart (side by side)

---

### 8.2 Branch-Wise View

Owner can drill into any branch:

- All bills uploaded with thumbnails of original images
- Extracted data table with edit capability
- Category breakdown
- Day-by-day timeline
- Budget vs actual gauge

---

### 8.3 Expense Management

**Bills Table View:**

| Column | Description |
|---|---|
| Date | Bill date |
| Branch | Branch name |
| Vendor | Supplier name |
| Category | Auto-classified |
| Amount | Total amount |
| GST | GST component |
| Payment Mode | Cash/UPI/Card |
| Uploaded By | Staff name |
| Bill Image | Thumbnail → click to view full |
| Status | Verified / Pending Review / Flagged |
| Actions | Edit, Delete, Flag, Download |

**Owner Actions:**
- **Verify** a bill (mark as reviewed)
- **Flag** a bill for follow-up or dispute
- **Edit** any incorrectly extracted field
- **Delete** a duplicate or erroneous entry
- **Add notes** to any expense

---

### 8.4 Vendor Management

Auto-built from bill data:

- List of all vendors across all branches
- Total spend per vendor (monthly / yearly)
- Frequency of purchases
- Average bill value
- Vendor contact details (from scanned bills)
- Flag unreliable or high-risk vendors

**Use Case:** Owner can see if a branch is paying inflated prices to a vendor compared to other branches purchasing the same goods.

---

### 8.5 Budget Management

Per branch, owner sets:
- **Daily budget** — alert at 80%, hard stop notification at 100%
- **Monthly budget** — same
- **Category-level budget** — e.g., Produce should not exceed ₹30,000/month

Dashboard shows budget vs actuals with traffic-light indicators (green/amber/red).

---

## 9. Financial Reports & Use Cases

### 9.1 Profit & Loss Support Report

> *Note: This system tracks expenses only. Revenue data needs to be entered manually or integrated from a POS system. The P&L report shows the expense side; revenue is added manually or via integration.*

- Monthly expense summary per category
- Branch-wise expense breakdown
- Month-over-month comparison
- Year-to-date totals
- Exportable as PDF or Excel

---

### 9.2 GST Filing Support (India-Specific)

This is one of the most powerful features for Indian restaurant owners.

**GSTR-2A / Input Tax Credit (ITC) Tracking:**
- All bills with GST amounts are tagged with HSN code, GSTIN of vendor (if present), CGST/SGST/IGST split
- Monthly ITC summary generated — total GST paid on purchases, eligible for input credit
- Report formatted as per GST filing requirements

**GSTR-9 (Annual Return) Support:**
- Annual expense and GST summary per category
- HSN-wise purchase summary

**Export Format:**
- GST-ready Excel export matching government portal column formats
- PDF summary for accountant review

**Caveat shown to user:** "This report is for reference and accounting assistance. Please have a qualified CA verify before filing."

---

### 9.3 TDS Tracking (Future / Optional)

- If a vendor payment exceeds ₹30,000 in a year, flag for TDS deduction
- Generate TDS liability report for accountant

---

### 9.4 Vendor Payment Reports

- How much is owed to each vendor (if credit purchases are tracked)
- Monthly vendor payment schedule
- Oldest unpaid bills flagged

---

### 9.5 Staff Wage / Labour Cost Tracking

- Wages entered as expense entries under `staff_wages` category
- Daily, weekly, monthly wage summary per branch
- Useful for labour cost as % of revenue analysis

---

### 9.6 Cash Flow Report

- Total cash outflow per day / week / month
- Broken down by payment mode (Cash vs UPI vs Card vs Credit)
- Helps owner track how much physical cash is flowing out of each branch

---

### 9.7 Year-End Summary

- Full year expense report per branch and consolidated
- Category totals for the financial year
- Comparison with previous year
- Suitable for annual CA/auditor handoff

---

### 9.8 Anomaly & Fraud Detection (Automated)

The system flags unusual patterns:

| Trigger | Flag |
|---|---|
| Same bill uploaded twice (duplicate detection by amount + date + vendor) | 🔴 Duplicate |
| Bill date is in the future | 🔴 Invalid Date |
| Total amount much higher than branch average for that category | 🟡 Unusually High |
| Same vendor billed every day at round numbers (₹500, ₹1000 exactly) | 🟡 Suspicious Pattern |
| Manual entry without bill for amounts above ₹500 | 🟡 No Bill |
| No bills uploaded for a branch for 2+ consecutive days | 🟡 Inactivity Alert |

Owner receives a **daily digest of flagged items** via WhatsApp and on dashboard.

---

## 10. Automated Notifications & Reminders

### 10.1 Daily Summary to Owner (WhatsApp)

Every evening at a configurable time (default: 9 PM):

```
📊 Daily Expense Summary — 10 Jun 2025

Spice Garden — Koramangala:  ₹3,284
Spice Garden — Indiranagar:  ₹4,120
Spice Garden — Whitefield:   ₹2,890
──────────────────────────────────────
Total Today (All Branches):  ₹10,294

⚠️ Koramangala is at 82% of daily budget.
🔴 2 flagged bills need your review.

View full report: [Dashboard Link]
```

### 10.2 Branch Activity Reminder to Managers

If no bill has been uploaded by a branch by a set time (e.g., 2 PM for morning purchases):

```
Bot: 📋 Reminder, Ravi!
     No bills have been uploaded for Koramangala today.
     Please upload your morning purchase bills when convenient.
```

### 10.3 Monthly Closing Reminder

On the last 2 days of the month:

```
Bot: 📅 Month-end approaching!
     Please upload any pending bills for June before 30th Jun.
     Missing bills will affect your GST and P&L reports.
```

### 10.4 Budget Breach Alert

Immediately when a branch crosses its budget:

- Manager gets: "⚠️ You've exceeded today's budget for Koramangala."
- Owner gets: "🔴 Budget Alert: Koramangala has exceeded ₹5,000 daily budget. Total today: ₹5,340."

### 10.5 Duplicate Bill Alert

Immediately when a duplicate is detected:

```
Bot: ⚠️ This looks like a duplicate bill!
     A similar bill was already uploaded today:
     Vendor: Ram Vegetables | ₹934.50 | 10 Jun

     Is this a different bill? (Yes, save it / No, discard)
```

---

## 11. Data Models

### Table: `owners`
```sql
id                UUID PRIMARY KEY
name              VARCHAR(150)
email             VARCHAR(150) UNIQUE
password_hash     TEXT
business_name     VARCHAR(200)
gstin             VARCHAR(20)
pan               VARCHAR(15)
business_address  TEXT
financial_year_start SMALLINT DEFAULT 4  -- April
currency          VARCHAR(5) DEFAULT 'INR'
whatsapp_number   VARCHAR(20)
created_at        TIMESTAMP
```

### Table: `branches`
```sql
id                UUID PRIMARY KEY
owner_id          UUID REFERENCES owners(id)
branch_name       VARCHAR(200)
branch_code       VARCHAR(10) UNIQUE NOT NULL
address           TEXT
city              VARCHAR(100)
pincode           VARCHAR(10)
gstin             VARCHAR(20)
daily_budget      DECIMAL(12,2)
monthly_budget    DECIMAL(12,2)
manager_name      VARCHAR(150)
manager_whatsapp  VARCHAR(20)
is_active         BOOLEAN DEFAULT TRUE
created_at        TIMESTAMP
```

### Table: `authorized_users`
```sql
id                UUID PRIMARY KEY
branch_id         UUID REFERENCES branches(id)
whatsapp_number   VARCHAR(20)
name              VARCHAR(150)
role              ENUM('manager','staff')
is_active         BOOLEAN DEFAULT TRUE
added_by          UUID REFERENCES owners(id)
added_at          TIMESTAMP
UNIQUE(branch_id, whatsapp_number)
```

### Table: `expense_bills`
```sql
id                UUID PRIMARY KEY
branch_id         UUID REFERENCES branches(id)
uploaded_by       UUID REFERENCES authorized_users(id)
bill_date         DATE
bill_number       VARCHAR(100)
vendor_name       VARCHAR(200)
vendor_contact    VARCHAR(100)
vendor_gstin      VARCHAR(20)
category          VARCHAR(50)
items             JSONB         -- [{description, qty, unit, rate, amount}]
subtotal          DECIMAL(12,2)
gst_rate          DECIMAL(5,2)
cgst              DECIMAL(12,2)
sgst              DECIMAL(12,2)
igst              DECIMAL(12,2)
total_gst         DECIMAL(12,2)
total_amount      DECIMAL(12,2)
payment_mode      ENUM('cash','upi','card','credit','other')
hsn_code          VARCHAR(20)
image_url         TEXT          -- stored in cloud storage
ocr_raw_text      TEXT          -- raw OCR output for reference
is_manual_entry   BOOLEAN DEFAULT FALSE
bill_available    BOOLEAN DEFAULT TRUE
status            ENUM('pending','verified','flagged','duplicate') DEFAULT 'pending'
flags             TEXT[]        -- ['duplicate','unusual_amount']
owner_notes       TEXT
uploaded_at       TIMESTAMP
verified_at       TIMESTAMP
verified_by       UUID REFERENCES owners(id)
```

### Table: `category_budgets`
```sql
id                UUID PRIMARY KEY
branch_id         UUID REFERENCES branches(id)
category          VARCHAR(50)
monthly_limit     DECIMAL(12,2)
alert_at_pct      SMALLINT DEFAULT 80
```

### Table: `vendors`
```sql
id                UUID PRIMARY KEY
owner_id          UUID REFERENCES owners(id)
vendor_name       VARCHAR(200)
vendor_contact    VARCHAR(100)
gstin             VARCHAR(20)
primary_category  VARCHAR(50)
is_flagged        BOOLEAN DEFAULT FALSE
flag_reason       TEXT
first_seen        DATE
last_seen         DATE
```

### Table: `notifications_log`
```sql
id                UUID PRIMARY KEY
recipient         VARCHAR(20)   -- whatsapp number
recipient_role    ENUM('owner','manager','staff')
branch_id         UUID REFERENCES branches(id)
type              VARCHAR(50)   -- 'daily_summary','budget_alert','duplicate_flag' etc.
message_preview   TEXT
sent_at           TIMESTAMP
delivery_status   VARCHAR(20)
```

### Table: `audit_log`
```sql
id                UUID PRIMARY KEY
action            VARCHAR(100)  -- 'bill_uploaded','bill_edited','bill_deleted','user_added'
performed_by      VARCHAR(100)
bill_id           UUID REFERENCES expense_bills(id)
branch_id         UUID REFERENCES branches(id)
old_value         JSONB
new_value         JSONB
timestamp         TIMESTAMP
```

---

## 12. OCR & AI Extraction Details

### 12.1 Recommended OCR Engines

| Engine | Strength | Recommended For |
|---|---|---|
| **Google Cloud Vision API** | Best for handwritten + printed Indian bills | Primary recommendation |
| **AWS Textract** | Excellent for structured invoices | Alternative |
| **Azure Form Recognizer** | Best for preformatted invoice layouts | Alternative |

### 12.2 AI Extraction Prompt Strategy

After OCR, raw text is passed to Claude API with a structured prompt:

```
System: You are a financial data extraction assistant for Indian restaurants.
Extract structured data from this bill/invoice text. 
Return ONLY valid JSON with these fields: 
vendor_name, bill_date (YYYY-MM-DD), bill_number, items (array), 
subtotal, gst_amount, total_amount, payment_mode, hsn_code.
If a field is not found, use null. Never guess; extract only what is present.

User: [RAW OCR TEXT FROM BILL]
```

### 12.3 Handling Poor Quality Bills

- Blurry image detected → reject with guidance to retake
- Handwritten bills → OCR attempted, confidence score checked; if below threshold, manual confirmation required
- Non-bill images (selfies, random photos) → detected and rejected
- Multi-item bills → all line items extracted individually
- Bills in regional languages (Hindi, Kannada, Tamil) → handled by Google Vision's multilingual OCR

### 12.4 Duplicate Detection Logic

Before saving a bill, check:
1. Same branch + same date + same vendor name + same total amount → **exact duplicate**
2. Same branch + same date + same vendor name + amount within ±2% → **likely duplicate** (ask manager to confirm)
3. Same image hash (MD5 of image file) → **same file uploaded again**

---

## 13. Admin Dashboard (Web Application) — Full Feature List

### 13.1 Navigation Structure

```
Sidebar:
├── 🏠 Overview (All Branches)
├── 🏪 Branches
│   ├── All Branches
│   └── [Branch Name] × N
├── 📋 Expenses
│   ├── All Bills
│   ├── Pending Review
│   └── Flagged Items
├── 🏭 Vendors
├── 👥 Users & Access
├── 📊 Reports
│   ├── P&L Summary
│   ├── GST Report
│   ├── Cash Flow
│   ├── Vendor Payments
│   └── Year-End Summary
├── 💰 Budgets
├── 🔔 Notifications
└── ⚙️ Settings
```

### 13.2 Key Dashboard Interactions

- **Date Range Picker** — filter everything by custom date range
- **Branch Multi-Select** — compare any subset of branches
- **Export Button** — present on every table/report view (CSV + PDF)
- **Search Bar** — search across all bills by vendor, amount, category
- **Bill Image Viewer** — click any bill row to see original image side-by-side with extracted data

### 13.3 Accountant Access

- Owner can invite an accountant by email
- Accountant gets read-only access to reports and bill data
- No ability to add/edit/delete anything
- Can download GST and P&L reports directly

---

## 14. Security & Access Control

- **Branch Code** is the first layer of access — without it, no data is accessible
- Branch code is paired with **authorized WhatsApp number** — code alone is not enough
- All bill images stored in private cloud storage (Cloudinary / AWS S3 / Supabase Storage) — not publicly accessible
- Owner dashboard uses **JWT authentication** with refresh tokens
- All API endpoints require authentication; branch data is scoped to owner account
- **Audit log** captures every edit, deletion, or access event with timestamp and actor
- Bill images are retained for **7 years** (legal compliance for tax records in India)
- HTTPS enforced on all web traffic
- WhatsApp API interactions go through Meta's end-to-end encrypted platform

---

## 15. Tech Stack Recommendations

| Layer | Recommended Technology |
|---|---|
| **Bot Backend** | Node.js (Express) or Python (FastAPI) |
| **WhatsApp Integration** | Meta WhatsApp Cloud API (free tier available) |
| **OCR** | Google Cloud Vision API |
| **AI Extraction** | Claude API (claude-sonnet-4-20250514) |
| **Database** | PostgreSQL via Supabase |
| **File Storage** | Supabase Storage or AWS S3 |
| **Real-time Alerts** | WebSockets (Socket.io) or Supabase Realtime |
| **Job Scheduler** | node-cron (Node) or Celery Beat (Python) |
| **Frontend Dashboard** | React.js + Tailwind CSS + Recharts |
| **Auth** | Supabase Auth or custom JWT |
| **PDF Report Generation** | Puppeteer (headless Chrome) or pdfkit |
| **Excel Export** | ExcelJS |
| **Hosting** | Railway / Render / DigitalOcean |
| **Duplicate Image Detection** | MD5 hash comparison on upload |

---

## 16. Bot Conversation State Management

Each WhatsApp session tracks:

```json
{
  "phone": "+919876543210",
  "authorized_user_id": "uuid",
  "branch_id": "uuid",
  "branch_name": "Spice Garden — Koramangala",
  "role": "manager",
  "step": "awaiting_bill_confirmation",
  "current_bill_draft": {
    "image_url": "...",
    "ocr_text": "...",
    "extracted": { "vendor_name": "...", "total": 934.50, ... },
    "confidence_score": 0.94
  },
  "bills_uploaded_today": 7,
  "last_activity": "2025-06-10T14:32:00Z"
}
```

Sessions expire after **20 minutes of inactivity**.

---

## 17. Phased Development Plan

### Phase 1 — Core MVP
- Owner web signup and branch creation
- Branch code generation
- Authorized user management
- WhatsApp bot: branch code verification + bill image upload
- OCR extraction + AI parsing
- Basic bill confirmation flow
- Simple owner dashboard: bills list per branch

### Phase 2 — Intelligence & Operations
- Auto-categorization
- Duplicate detection
- Manual expense entry
- Daily summary to manager (WhatsApp)
- Daily summary to owner (WhatsApp)
- Budget alerts

### Phase 3 — Reporting & Finance
- GST report generation
- P&L expense summary
- Cash flow report
- Vendor management view
- Excel + PDF exports
- Accountant read-only access

### Phase 4 — Analytics & Advanced
- Anomaly/fraud detection
- Branch comparison analytics
- Vendor price benchmarking across branches
- Year-end summary
- TDS tracking
- Multi-language OCR support
- Category-level budgets

---

## 18. Example Conversation Flow

```
[First time — Manager Ravi messages the bot]

Bot:  Welcome to RestaurantLedger! 👋
      Please enter your Branch Code.

Ravi: SG-K01

Bot:  ✅ Branch Found!

      📍 Spice Garden — Koramangala
      45, 12th Main, Koramangala, Bengaluru — 560034
      Manager: Ravi Kumar

      Is this your branch? (Yes / No)

Ravi: Yes

Bot:  You're all set, Ravi! 🎉
      What would you like to do?
      1. 📤 Upload a Bill
      2. 📋 Today's Expense Log
      3. 📅 This Week's Summary
      4. 💬 Add Manual Expense
      5. ❓ Help

Ravi: [Sends photo of a vegetable bill]

Bot:  📸 Got it! Processing your bill...
      ⏳ (usually takes 5–10 seconds)

Bot:  🧾 Bill Scanned!

      Vendor: Ram Vegetables Mart
      Date: 10 Jun 2025 | Bill No: INV-4821

      Items:
      • Tomatoes — 10 kg @ ₹35 = ₹350
      • Onions — 15 kg @ ₹28 = ₹420
      • Coriander — 2 kg @ ₹60 = ₹120

      Subtotal: ₹890
      GST (5%): ₹44.50
      Total: ₹934.50

      Category: 🥦 Produce
      Payment: Cash

      ✅ Save this bill? (Yes / Edit / Discard)

Ravi: Yes

Bot:  ✅ Saved! Expense ID: EXP-20250610-0047
      Koramangala total today: ₹4,219.50

      Send another bill or type 'menu'.

Ravi: menu

Bot:  What would you like to do?
      1. 📤 Upload a Bill
      2. 📋 Today's Expense Log
      ...

Ravi: 2

Bot:  📋 Spice Garden — Koramangala
      10 Jun 2025

      🥦 Produce           ₹1,869.50
      🥛 Dairy             ₹1,200.00
      🛢️ Fuel/Gas           ₹850.00
      🧹 Cleaning          ₹300.00
      ─────────────────────────────
      Total Today:         ₹4,219.50
      Budget Used: 84% ⚠️

      Bills: 9 uploaded | 0 manual

[9 PM — Bot sends to Owner]

Bot:  📊 Daily Expense Summary — 10 Jun 2025

      Koramangala:   ₹4,219  ⚠️ 84% of budget
      Indiranagar:   ₹3,870  ✅
      Whitefield:    ₹2,940  ✅
      ──────────────────────────────
      Total Today:   ₹11,029

      🔴 1 flagged bill needs review.
      View dashboard: [Link]
```

---

## 19. Compliance & Legal Notes

- Bill images must be stored for a minimum of **6–8 years** (Indian tax law compliance).
- GST reports are advisory tools — always validate with a qualified CA before filing.
- System does not file GST directly; it generates ready-to-use data for the filing portal or CA.
- Payment data (UPI/card) is metadata only — no actual transaction processing happens here.
- Personal data (staff WhatsApp numbers) must not be shared externally per IT Act 2000 / DPDP Act 2023.

---

*Document Version: 1.0 | Created for development handoff | Designed for Indian restaurant market with INR as default currency and Indian GST compliance built in. Currency, tax rules, and regulatory sections can be adapted for other markets.*
