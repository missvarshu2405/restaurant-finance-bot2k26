# 🍽️ RestaurantLedger — Product Definition v2.0

> **Mobile-First | AI-Powered | Restaurant-Native**
> Complete redesign of the expense management platform, with phone as the primary device for all manager operations.

---

## Table of Contents

1. [Vision & Executive Summary](#1-vision--executive-summary)
2. [Mobile-First Design Philosophy](#2-mobile-first-design-philosophy)
3. [New Architecture](#3-new-architecture)
4. [The Zero-Friction Manager Workflow](#4-the-zero-friction-manager-workflow-core-redesign)
5. [User Roles & Permissions](#5-user-roles--permissions)
6. [Manager Portal — Mobile UI](#6-manager-portal--mobile-ui)
7. [Owner Dashboard — Web + Mobile](#7-owner-dashboard--web--mobile)
8. [Restaurant-Specific Features](#8-restaurant-specific-features-differentiators)
9. [Reports — Complete Set](#9-reports--complete-set-12-reports)
10. [Notifications & Communication](#10-notifications--communication)
11. [Data Model v2.0](#11-data-model-v20--supabase--postgresql)
12. [Competitive Analysis](#12-competitive-analysis--feature-parity)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [File & Project Structure](#14-file--project-structure)
15. [Change Summary v1 → v2](#15-change-summary-v10--v20)
16. [Design Principles](#16-design--ux-principles)

---

## 1. Vision & Executive Summary

RestaurantLedger is a **zero-friction, AI-first expense management platform** purpose-built for multi-branch restaurants in India. The v2.0 redesign is built ground-up with one rule: **a manager's phone is the only device that matters for daily operations.**

### The Problem with v1.0

The v1.0 manager upload flow had 4–6 mandatory steps per bill:

```
Upload image → click "AI Extract" → wait → review all fields → correct mistakes → click Submit
```

With 10–20 bills a day, this becomes a burden that managers skip or rush through — leading to bad data.

### The v2.0 Solution

```
Open camera / pick photo → tap Submit
```

Two actions. AI extracts everything automatically in the background. The manager never sees an "Extract" button again.

### What Changes at a Glance

|
 Area 
|
 v1.0 
|
 v2.0 
|
|
------
|
------
|
------
|
|
**
Primary device
**
|
 Desktop browser 
|
 📱 Phone (camera-first) 
|
|
**
Manager upload steps
**
|
 4–6 clicks 
|
 2 taps 
|
|
**
AI trigger
**
|
 Manual button click 
|
 Automatic on image capture 
|
|
**
Data storage
**
|
 localStorage (~5MB, single device) 
|
 Supabase cloud (unlimited, multi-device) 
|
|
**
Backend
**
|
 None (100% client-side) 
|
 Node.js + Express API 
|
|
**
Auth
**
|
 Plain-text in localStorage 
|
 Supabase Auth (JWT + bcrypt) 
|
|
**
Images
**
|
 base64 in localStorage 
|
 Supabase Storage (permanent URLs) 
|
|
**
Gemini API key
**
|
 Exposed in browser JS 
|
 Server-side 
`.env`
 only 
|
|
**
Notifications
**
|
 In-app badges only 
|
 In-app + Email + WhatsApp 
|
|
**
Restaurant features
**
|
 Generic finance dashboard 
|
 Shifts, recipe costing, wastage, staff wages 
|
|
**
Reports
**
|
 4 basic tabs 
|
 12 restaurant-specific reports 
|

---

## 2. Mobile-First Design Philosophy

> **The manager is standing in a kitchen, holding a phone, with wet hands, under fluorescent lights. Every design decision must account for this.**

### 2.1 Core Mobile Rules

- **Thumb Zone First** — All primary actions (Submit, Camera, Quick Entry) are in the bottom 40% of the screen, reachable with one thumb.
- **No horizontal scroll** — Every table, card, and chart fits within a 390px viewport.
- **Tap targets ≥ 48px** — No tiny buttons. Every interactive element is finger-friendly.
- **Camera is the primary input** — The bill upload screen opens the device camera by default; file picker is the secondary option.
- **Offline-tolerant** — Bills drafted offline are queued and submitted automatically when connectivity returns.
- **One-handed operation** — The upload flow is completable without ever needing two hands.
- **Large text for key data** — Budget status, today's total, bill amount — all rendered at ≥20px so they're readable at arm's length.

### 2.2 Responsive Breakpoints

|
 Breakpoint 
|
 Device 
|
 Layout 
|
|
------------
|
--------
|
--------
|
|
`< 480px`
|
 Phone (portrait) 
|
 Single column, bottom nav bar, full-width cards 
|
|
`480–768px`
|
 Phone (landscape) / small tablet 
|
 Two-column cards, bottom nav 
|
|
`768–1024px`
|
 Tablet 
|
 Sidebar + content, top nav 
|
|
`> 1024px`
|
 Desktop 
|
 Fixed sidebar + multi-column dashboard 
|

### 2.3 Navigation — Mobile vs Desktop

**Mobile (Manager):** Bottom navigation bar with 4 tabs — no sidebar. Tabs: `📷 Submit`, `📊 Summary`, `📋 Bills`, `👤 Me`.

**Mobile (Owner):** Bottom navigation bar: `🏠 Home`, `💰 Expenses`, `📊 Reports`, `🔔 Alerts`, `⚙️ More`.

**Desktop (Owner):** Full fixed sidebar (same as v1.0, enhanced). Managers rarely use desktop; owner may.

### 2.4 Bill Upload — Camera vs File Picker

The upload input on mobile uses a dual-option sheet that appears from the bottom:

```
┌────────────────────────────────┐
│  Add Bill                      │
├────────────────────────────────┤
│  📷  Take Photo                │  ← Primary (triggers device camera)
│  🖼️  Choose from Gallery       │  ← Secondary (file picker)
│  ⌨️  Enter Manually            │  ← Escape hatch (no image)
└────────────────────────────────┘
```

On web/desktop: drag-and-drop zone with a file picker button. No camera option (desktop browsers handle this inconsistently).

The HTML input for camera capture on mobile:
```html

```
`capture="environment"` opens the rear camera directly — no app-switcher, no gallery confusion.

---

## 3. New Architecture

### 3.1 Technology Stack

|
 Layer 
|
 Technology 
|
 Notes 
|
|
-------
|
-----------
|
-------
|
|
**
Frontend
**
|
 Vite + Vanilla JS 
|
 Keep existing; restructure for mobile-first 
|
|
**
Styling
**
|
 Vanilla CSS (extend existing) 
|
 Add mobile breakpoints, touch styles, bottom nav 
|
|
**
Backend
**
|
 Node.js + Express 
*
(NEW)
*
|
 API gateway, auth proxy, scheduled jobs 
|
|
**
Database
**
|
 Supabase (PostgreSQL) 
*
(NEW)
*
|
 Cloud, multi-device, Row-Level Security 
|
|
**
Auth
**
|
 Supabase Auth 
*
(NEW)
*
|
 JWT tokens, bcrypt, email-based sessions 
|
|
**
File Storage
**
|
 Supabase Storage 
*
(NEW)
*
|
 Bill images as signed URLs; no more base64 
|
|
**
AI / OCR
**
|
 Google Gemini (server-side) 
|
 Same models; key moved to backend 
`.env`
|
|
**
Job Queue
**
|
 node-cron 
*
(NEW)
*
|
 Daily digest, reminders, budget resets 
|
|
**
Email
**
|
 Resend / Nodemailer 
*
(NEW)
*
|
 Daily digest, alerts, monthly reports 
|
|
**
WhatsApp
**
|
 Meta Cloud API 
*
(optional, NEW)
*
|
 Budget alerts, daily summary 
|
|
**
Charts
**
|
 Chart.js 
|
 Keep existing 
|
|
**
PDF / CSV
**
|
 jsPDF + jspdf-autotable 
|
 Keep existing 
|
|
**
Realtime
**
|
 Supabase Realtime 
*
(NEW)
*
|
 Live dashboard updates for owner 
|

### 3.2 System Layers

```
┌─────────────────────────────────────────────┐
│  CLIENT (Browser / PWA)                     │
│  Vite SPA — pages, components, services     │
│  Communicates via HTTPS REST to backend     │
└────────────────┬────────────────────────────┘
                 │
┌────────────────▼────────────────────────────┐
│  BACKEND API (Node.js + Express)            │
│  /auth  /bills  /reports  /branches         │
│  /managers  /vendors  /notifications        │
│  Calls: Supabase, Gemini, Email, WhatsApp   │
└──────┬──────────┬──────────┬────────────────┘
       │          │          │
┌──────▼──┐  ┌───▼────┐  ┌──▼──────────────┐
│Supabase │  │Gemini  │  │Email / WhatsApp  │
│Postgres │  │AI API  │  │Resend / Meta API │
│Storage  │  │(server)│  │                  │
└─────────┘  └────────┘  └─────────────────-┘
```

### 3.3 Critical Security Fixes vs v1.0

|
 Vulnerability 
|
 v1.0 
|
 v2.0 Fix 
|
|
--------------
|
------
|
----------
|
|
 Gemini API key in browser JS 
|
 ❌ Exposed 
|
 ✅ Backend 
`.env`
 only 
|
|
 Passwords stored plain-text 
|
 ❌ localStorage 
|
 ✅ bcrypt via Supabase Auth 
|
|
 No session security 
|
 ❌ sessionStorage 
|
 ✅ JWT httpOnly cookies 
|
|
 No data isolation 
|
 ❌ All in one localStorage blob 
|
 ✅ Supabase RLS per manager/branch 
|
|
 Images fill localStorage 
|
 ❌ base64, breaks at ~20 bills 
|
 ✅ Supabase Storage, unlimited 
|
|
 Single device only 
|
 ❌ localStorage 
|
 ✅ Cloud sync, any device 
|

---

## 4. The Zero-Friction Manager Workflow (Core Redesign)

### 4.1 The Old Flow vs The New Flow

**v1.0 — 6 steps:**
```
1. Open Upload Bill page
2. Tap/drag to upload image
3. Tap "Extract with AI" button
4. Wait 3–8 seconds
5. Review every extracted field
6. Tap Submit
```

**v2.0 — 2 steps:**
```
1. Tap 📷 and capture bill (or pick from gallery)
2. Tap Submit
   ↑ AI runs automatically between these two steps
```

### 4.2 Redesigned Upload Flow (Step by Step)

```
Manager opens app → taps 📷 Submit tab

┌─────────────────────────┐
│  [Camera opens]         │  ← capture="environment" fires instantly
│  Manager photographs    │
│  bill                   │
└───────────┬─────────────┘
            │ image captured
            ▼
┌─────────────────────────┐
│  Preview shown          │  ← thumbnail at top
│  "Reading bill..." ⏳   │  ← subtle spinner, non-blocking
│                         │
│  [Vendor] ░░░░░░░░░░    │  ← skeleton loading, fields appear as extracted
│  [Date]   ░░░░░░        │
│  [Amount] ░░░░░░░░░░░   │
│                         │
│  [ Submit Bill ] ← BIG  │  ← always active; manager can tap now
└─────────────────────────┘
            │
     AI fills fields as extracted (animated reveal)
            │
            ▼
┌─────────────────────────┐
│  ✅ Kapil Electronics   │  ← fields filled, amber = low-confidence
│  📅 12 Jun 2026         │
│  💰 ₹3,240              │
│  🏷️ Dry Goods           │
│  💳 UPI                 │
│                         │
│  [ Submit Bill ] ← BIG  │  ← manager taps here
└─────────────────────────┘
            │
            ▼
   Duplicate check + Budget check (silent)
            │
            ▼
   ✅ "Bill submitted — ₹3,240 | Today: ₹18,640"
   Form resets → ready for next bill
```

### 4.3 Submit Before AI Completes (Graceful Handling)

If the manager taps Submit before Gemini finishes extracting:

- Bill is saved with status `processing` immediately.
- A background job updates the bill once AI completes (within 10–30 seconds).
- Owner sees the bill in "Processing" state with a spinner — not as "Pending" yet.
- Manager gets a silent toast: "Bill saved — details being extracted."
- Once extraction completes, status auto-moves to `pending` and the owner sees the full data.

### 4.4 AI Confidence Indicators

Fields extracted with < 60% confidence are highlighted so the manager knows to check:

```
┌─────────────────────────┐
│  ✅ Kapil Electronics   │  ← green: high confidence
│  ⚠️ 12 Jun 2026         │  ← amber: please verify date
│  ✅ ₹3,240              │
│  ⚠️ Dry Goods           │  ← amber: AI guessed category
└─────────────────────────┘
```

Amber fields show a small "AI guessed — tap to edit" label beneath them.

### 4.5 Batch Upload Mode

For managers with a stack of bills at end-of-day:

1. Manager taps **Batch Mode** toggle on the Submit screen.
2. Manager photographs or picks up to 20 bill images in one session.
3. A progress grid shows each bill: `Queued → Extracting → Ready → Error`.
4. Manager taps any card to review/edit its extracted data.
5. One tap: **"Submit All Ready Bills"** — all processed bills save in a single action.
6. Failed extractions stay highlighted; manager can retry or enter manually.

```
┌─── Batch Upload (6 bills) ───────┐
│ ✅ Kapil Electronics  ₹3,240     │
│ ✅ Sri Balaji Veg     ₹1,890     │
│ ⏳ Extracting...                 │
│ ✅ National Gas       ₹2,100     │
│ ❌ Unreadable — [Retry] [Manual] │
│ ✅ Star Cleaning      ₹640       │
│                                  │
│  [ Submit 4 Ready Bills ]        │
└──────────────────────────────────┘
```

### 4.6 Quick-Entry Mode (Known/Recurring Vendors)

For predictable recurring expenses — daily vegetable supplier, weekly LPG, monthly rent:

1. Owner marks a vendor as **Recurring** with defaults: category, GST rate, typical amount, image required (yes/no).
2. Manager opens Quick-Entry from the Submit tab.
3. Manager sees a pinned grid of recurring vendors (max 8, customisable).
4. Manager taps vendor → enters amount → selects payment mode → taps Submit.
5. Done in under 5 seconds. No image required unless owner configured it as mandatory.

```
┌─── Quick Entry ──────────────────┐
│                                  │
│  [🥦 Veggie Man]  [🛢️ Gas Co]   │
│  [🥛 Dairy Farm]  [🧹 Clean Co] │
│  [👥 Staff Daily] [🏠 Rent]     │
│                                  │
│  + Add Recurring Vendor          │
└──────────────────────────────────┘
```

---

## 5. User Roles & Permissions

### 5.1 Role Overview

|
 Role 
|
 Who 
|
 Primary Device 
|
 Primary Goal 
|
|
------
|
-----
|
----------------
|
-------------
|
|
**
Owner
**
|
 Restaurant owner / director 
|
 Desktop (primary), Phone (monitoring) 
|
 Monitor finances, act on insights, approve anomalies 
|
|
**
Manager
**
|
 Branch manager / head chef 
|
 📱 
**
Phone (only)
**
|
 Submit bills fast, track branch budget 
|
|
**
Accountant
**
|
 External CA / finance team 
|
 Desktop 
|
 Read-only data for tax / audit 
|
|
**
Staff
**
*
(Phase 2)
*
|
 Kitchen/floor staff 
|
 📱 Phone 
|
 Log petty cash, request reimbursements 
|

### 5.2 Manager Role — Mobile-Only Design

The manager portal is built as if the manager has **no access to a desktop**. Every feature available to a manager must work perfectly at 390px width with touch input:

- Bill upload via camera
- Batch upload with progress grid
- Quick-entry for recurring vendors
- Branch budget status (big, readable card)
- My expenses list (swipeable rows)
- Staff attendance (simple checkbox list)
- Petty cash log (running total)
- Wastage log (tap to add entry)

### 5.3 Accountant Role *(New in v2.0)*

Missing entirely from v1.0. Critical for real restaurant operations:

- Read-only access to all financial data across all branches.
- Can export GST reports, P&L statements, vendor payment records.
- Cannot see manager passwords, cannot edit or delete bills.
- Receives a monthly summary email automatically (configurable).
- Can leave notes/comments on bills visible to the owner.
- Access is time-bounded (owner sets an expiry date).

### 5.4 Authentication (v2.0 vs v1.0)

|
 Aspect 
|
 v1.0 
|
 v2.0 
|
|
--------
|
------
|
------
|
|
 Password storage 
|
 Plain text in localStorage 
|
 bcrypt via Supabase Auth 
|
|
 Session mechanism 
|
 sessionStorage (lost on tab close) 
|
 JWT in httpOnly cookie 
|
|
 Session on mobile 
|
 Lost every app switch 
|
 Persists across app switches 
|
|
 Password reset 
|
 Not implemented 
|
 Email-based reset (Supabase) 
|
|
 Owner account 
|
 Single hardcoded 
`admin@restaurant.com`
|
 Any email, registered at setup 
|
|
 Manager login 
|
 Username + password 
|
 Username or email + password 
|
|
 2FA 
|
 Not implemented 
|
 Optional TOTP for owner 
*
(Phase 2)
*
|

---

## 6. Manager Portal — Mobile UI

### 6.1 Bottom Navigation Bar

```
┌────────────────────────────────────────┐
│                                        │
│           (page content)               │
│                                        │
├────────┬────────┬────────┬────────────-┤
│ 📷     │ 📊     │ 📋     │  👤        │
│ Submit │Summary │ Bills  │  Me        │
└────────┴────────┴────────┴────────────-┘
```

The Submit tab is **always first** — it's the primary action.

### 6.2 Home / Summary Tab

When a manager logs in, the Summary tab shows a daily briefing:

```
┌────────────────────────────────────────┐
│  Good morning, Ravi 👋                 │
│  Indiranagar Branch                    │
├────────────────────────────────────────┤
│  Today's Budget                        │
│  ████████████░░░░  ₹12,400 / ₹18,000  │
│                          69% used      │
├────────────────────────────────────────┤
│  📷 Submit a Bill                 →    │  ← quick action shortcut
├────────────────────────────────────────┤
│  📝 1 draft waiting               →    │  ← if any unsaved drafts
├────────────────────────────────────────┤
│  Today's Bills (5)                     │
│  Kapil Electronics  ₹3,240  10:32am   │
│  Sri Balaji Veg     ₹1,890   9:14am   │
│  National Gas       ₹2,100   8:50am   │
│                        View All →      │
├────────────────────────────────────────┤
│  👥 Staff attendance not logged yet    │  ← gentle reminder
└────────────────────────────────────────┘
```

### 6.3 Submit Tab — Bill Upload Screen

```
┌────────────────────────────────────────┐
│  ← Submit Bill                         │
├────────────────────────────────────────┤
│                                        │
│  ┌──────────────────────────────────┐  │
│  │                                  │  │
│  │   📷  Tap to open camera        │  │  ← primary CTA, full-width
│  │                                  │  │
│  │   🖼️  Choose from gallery       │  │  ← secondary
│  │                                  │  │
│  │   ⌨️  Enter manually            │  │  ← escape hatch
│  └──────────────────────────────────┘  │
│                                        │
│  ─── or ─── Quick Entry               │
│  [🥦 Veggie] [🛢️ Gas] [👥 Staff] [+] │
└────────────────────────────────────────┘
```

After image capture, the screen transitions to the bill form:

```
┌────────────────────────────────────────┐
│  ← Bill Details          [📷 Retake]   │
├────────────────────────────────────────┤
│  [Bill thumbnail — small, top-right]   │
│                                        │
│  ⏳ AI reading bill...                 │
│                                        │
│  Vendor *                              │
│  ┌────────────────────────────────┐   │
│  │ Kapil Electronics              │   │  ← filled by AI
│  └────────────────────────────────┘   │
│                                        │
│  Date *              Category *        │
│  ┌──────────────┐  ┌───────────────┐  │
│  │ 12 Jun 2026  │  │ ⚠️ Dry Goods │  │  ← amber = low confidence
│  └──────────────┘  └───────────────┘  │
│                                        │
│  Amount *            Payment *         │
│  ┌──────────────┐  ┌───────────────┐  │
│  │ ₹ 3,240      │  │ UPI           │  │
│  └──────────────┘  └───────────────┘  │
│                                        │
│  GST                 Bill No.          │
│  ┌──────────────┐  ┌───────────────┐  │
│  │ 18%          │  │ INV-2024-441  │  │
│  └──────────────┘  └───────────────┘  │
│                                        │
│  Notes (optional)                      │
│  ┌────────────────────────────────┐   │
│  │                                │   │
│  └────────────────────────────────┘   │
│                                        │
├────────────────────────────────────────┤
│                                        │
│  ┌────────────────────────────────┐   │
│  │     ✅  Submit Bill             │   │  ← BIG button, bottom
│  └────────────────────────────────┘   │
│                                        │
└────────────────────────────────────────┘
```

### 6.4 Bills Tab

Swipeable bill list for the current manager's branch:

```
┌────────────────────────────────────────┐
│  My Bills         [🔍] [Filter ▾]     │
│  Today · ₹18,640 total                 │
├────────────────────────────────────────┤
│  ┌────────────────────────────────┐   │
│  │ Kapil Electronics     ₹3,240  │   │
│  │ Dry Goods · UPI · 10:32am     │   │
│  │ ✅ Pending review              │   │
│  └────────────────────────────────┘   │
│  ┌────────────────────────────────┐   │
│  │ Sri Balaji Veg        ₹1,890  │   │
│  │ Produce · Cash · 9:14am        │   │
│  │ ✅ Verified                    │   │
│  └────────────────────────────────┘   │
└────────────────────────────────────────┘
```

Swipe left on a bill row → Delete / Edit options (for bills not yet verified).

### 6.5 Restaurant-Ops Features (Manager, Mobile)

These are in the **Me** tab under "Today's Tasks":

**Staff Attendance** — simple checklist per shift:
```
┌─── Staff Attendance · 17 Jun ──────────┐
│  Morning Shift                         │
│  ✅  Ramu (Cook)                       │
│  ✅  Lakshmi (Helper)                  │
│  ❌  Suresh (Waiter) — absent          │
│  [+ Add staff]          [Submit] ✓     │
└────────────────────────────────────────┘
```

**Petty Cash** — running total with opening/closing balance:
```
┌─── Petty Cash · 17 Jun ────────────────┐
│  Opening Balance: ₹5,000               │
│  Cash spent on bills: ₹3,240           │
│  Expected Closing: ₹1,760              │
│                                        │
│  Actual Closing:                       │
│  ┌────────────────────────────────┐   │
│  │ ₹ 1,760                        │   │
│  └────────────────────────────────┘   │
│                                        │
│  Variance: ₹0 ✅                       │
│            [Submit Close]              │
└────────────────────────────────────────┘
```

**Wastage Log** — quick add form:
```
┌─── Log Wastage ───────────────────────┐
│  Item:     [Tomatoes           ]       │
│  Quantity: [2 kg               ]       │
│  Reason:   [Spoilage ▾         ]       │
│  Est. Cost:[₹ 80               ]       │
│                    [Add Entry] ✓       │
└────────────────────────────────────────┘
```

---

## 7. Owner Dashboard — Web + Mobile

### 7.1 Owner Navigation

**On Desktop — Sidebar:**

```
📊 RestaurantLedger

Home
├── 🏠 Live Dashboard
└── 📈 Daily Pulse

Finances
├── 📋 All Expenses       [pending count]
├── 🚨 Needs Attention    [flagged count]
└── 🏭 Vendors

Operations
├── 🏪 Branches
├── 👥 Managers
└── 🔁 Recurring Expenses

Intelligence
├── 📊 Reports (12)
├── 💰 Budget Tracker
└── 👨‍🍳 Recipe Costing

Compliance
├── 🧾 GST Filing
└── 📝 Audit Trail

Notifications                [unread]
⚙️ Settings
```

**On Mobile — Bottom Nav (Owner):**
```
🏠 Home | 💰 Expenses | 📊 Reports | 🔔 Alerts | ⋯ More
```

### 7.2 Live Dashboard (Owner)

Real-time view of the entire business, using Supabase Realtime:

- **Live Spend Counter** — today's spend ticking up as managers submit bills across all branches.
- **Branch Health Matrix** — grid card per branch showing budget status (green / amber / red).
- **Unusual Activity Banner** — appears if any branch's spend is 30%+ above its own historical average for this time of day.
- **Pending Bills** requiring attention — duplicates and anomalies sorted by age.
- **Top Vendors Today** — highest-spend vendors across all branches.
- **Payment Mode Donut** — cash vs UPI vs card vs credit split.
- **30-Day Trend** — line chart with branch-level comparison.

### 7.3 Expenses Page (Enhanced)

|
 Enhancement 
|
 What It Does 
|
|
-------------
|
-------------
|
|
 Inline quick-approve 
|
 Verify a bill from the table row — no modal needed 
|
|
 Bulk actions 
|
 Select multiple → Verify All / Flag All / Export Selected 
|
|
 Smart search 
|
 Searches vendor, bill number, manager name, category, notes simultaneously 
|
|
 Bill thumbnail column 
|
 Small image preview in table row — instantly check if it's a valid receipt 
|
|
 AI confidence badge 
|
`High / Medium / Low`
 confidence shown per bill — low-confidence auto-flagged 
|
|
 Side-by-side viewer 
|
 Bill image + extracted data side by side in the detail modal 
|

### 7.4 Vendor Scorecard (Enhanced)

Full intelligence per vendor:

- Total spend, bill count, average bill value, branches served, payment mode preference.
- **Price Trend chart** — this vendor's average bill value over 6 months.
- **Cross-branch comparison** — if the same category vendor is used in multiple branches, compare per-unit cost.
- Mark as Preferred / Blacklisted.
- Track payment terms (Net 7, Net 30) and outstanding dues.
- Vendor contact directory with GSTIN and bank details.

---

## 8. Restaurant-Specific Features (Differentiators)

These features make RestaurantLedger different from generic tools like Zoho Expense or Expensify. They reflect how Indian restaurants actually operate.

### 8.1 Shift-Based Cost Tracking

Restaurants run in shifts. Costs should be trackable per shift, not just per day.

- Owner defines shift templates per branch: Morning (6am–11am), Lunch (11am–4pm), Dinner (4pm–11pm), or custom.
- Shift auto-detected from the time of bill submission.
- Manager can override shift if needed.
- **Shift Cost Report**: Cost breakdown by shift — identify if dinner service is consistently over budget.

### 8.2 Recipe / Menu Costing

A major differentiator. Restaurants need to know if their dishes are profitable.

- Owner creates a **Recipe database**: each recipe lists ingredients with quantities (e.g., Butter Chicken = 200g chicken, 50g butter, 10g spices).
- Ingredients are mapped to expense categories and vendors.
- When a purchase bill is processed, the system auto-calculates ingredient cost per unit (e.g., chicken is ₹180/kg this week).
- **Recipe Costing Dashboard**: Current ingredient cost per recipe, updated automatically.
- **Menu Price Alert**: If ingredient costs rise so that a dish's gross margin drops below a set threshold (e.g., 60%), the owner gets an alert.
- **Historical Cost Tracking**: How the production cost of Dish X has changed over 6 months.

### 8.3 Wastage & Spoilage Tracking

Food wastage is a critical hidden cost centre.

- Manager logs a wastage event on their phone: Item, quantity, reason (spoilage / over-prep / dropped / expired).
- Wastage is linked back to the purchase that sourced that ingredient.
- **Monthly Wastage Report**: Total value of wasted inventory per branch, per category.
- **Top Wasted Items**: Identify which ingredients are most frequently wasted — a procurement and training signal.

### 8.4 LPG & Utility Consumption Tracker

Fuel and electricity are top-3 expenses for Indian restaurant kitchens.

- When a bill is categorised as Fuel/Gas or Electricity, the system asks: how many units / cylinders?
- **Consumption Rate**: LPG cylinders per month per branch — spot if a branch is burning more than usual.
- **Cost per Cylinder Over Time**: Track if LPG prices are rising.
- **Utility Budget Alerts**: Separate budget thresholds for fuel and electricity, independent of the main daily budget.

### 8.5 Cash Management Module

Many Indian restaurants still operate heavily in cash.

- **Petty Cash Register**: Manager logs opening cash balance at day start.
- Cash-out events are recorded as managers upload cash-payment bills.
- **End-of-Day Cash Count**: Manager submits closing balance; system calculates discrepancy.
- **Cash Reconciliation Report**: Daily expected vs actual cash per branch.
- **Cash Variance Alert**: If closing cash is more than ₹500 short of expected, flag to owner immediately.

### 8.6 Staff Cost Tracking

Staff wages are the #1 expense for most restaurants.

- **Staff Register per branch**: Name, role (cook, waiter, cleaner), wage type (daily/monthly), rate.
- **Attendance Logging**: Manager logs which staff worked each day via a simple checklist on their phone.
- **Auto-calculated wage expense**: Attendance × daily rate → expected daily wage bill computed automatically.
- **Wage Bill Matching**: When the salary bill is uploaded, it is compared to the auto-calculated expected amount — any discrepancy is flagged.
- **Overtime Tracking**: Manager notes overtime; calculated at 1.5× rate.
- **Monthly Staff Cost Summary**: Total wage bill per branch, broken down by role.

### 8.7 Inventory Pulse *(Lightweight)*

Not a full inventory system — just enough to give owners a financial pulse on stock.

- Manager can flag that a key ingredient is running low → triggers a procurement reminder to the owner.
- **Purchase vs. Consumption tracking**: Compare what was purchased this week vs. what should have been consumed.
- **Dead Stock Alerts**: If an item is purchased repeatedly but consistently wasted, flag it.

---

## 9. Reports — Complete Set (12 Reports)

|
#
|
 Report Name 
|
 Who Uses It 
|
 What It Shows 
|
|
---
|
-------------
|
-------------
|
---------------
|
|
 1 
|
**
P&L Summary
**
|
 Owner, Accountant 
|
 Category expense vs. last month, % change, grand total 
|
|
 2 
|
**
GST Report
**
|
 Owner, Accountant 
|
 All GST bills, GSTIN-wise summary, ITC-claimable amounts, GSTR-ready export 
|
|
 3 
|
**
Cash Flow
**
|
 Owner 
|
 Payment mode breakdown, daily cash flow chart 
|
|
 4 
|
**
Vendor Payments
**
|
 Owner, Accountant 
|
 Per-vendor spend, bill count, avg value, payment mode preference 
|
|
 5 
|
**
Shift Cost Report
**
|
 Owner 
|
 Cost by shift (morning/lunch/dinner) across all branches 
|
|
 6 
|
**
Recipe Cost Report
**
|
 Owner 
|
 Per-dish ingredient cost, gross margin %, 3-month trend 
|
|
 7 
|
**
Staff Cost Report
**
|
 Owner, Accountant 
|
 Wage bill per branch, per role, attendance rate, overtime 
|
|
 8 
|
**
Wastage Report
**
|
 Owner 
|
 Total wastage value, top wasted items, wastage as % of purchase value 
|
|
 9 
|
**
Utility Consumption
**
|
 Owner 
|
 LPG cylinders/month, electricity units, cost per cylinder, trend 
|
|
 10 
|
**
Budget vs. Actual
**
|
 Owner 
|
 Daily/monthly budget vs. actual spend per branch, % variance 
|
|
 11 
|
**
Anomaly & Fraud Report
**
|
 Owner 
|
 Duplicate bills, round-number spikes, unusual vendor amounts, AI-flagged 
|
|
 12 
|
**
Year-End Summary
**
|
 Owner, Accountant 
|
 Annual P&L by category, top vendors, total GST, month-by-month chart 
|

### 9.1 GST Report Enhancement (GSTR-Ready)

- Separate tables for CGST / SGST / IGST (for inter-state purchases).
- ITC (Input Tax Credit) column — mark which bills are ITC-claimable (vendor has GSTIN on file).
- Export format compatible with GSTIN portal (GSTR-2A reconciliation).
- HSN-wise summary for filing.
- TDS tracking for contractor payments (Section 194C) — missing in v1.0.

### 9.2 Anomaly Detection Engine (9 Types)

|
 Anomaly Type 
|
 Detection Logic 
|
 Action 
|
|
--------------
|
----------------
|
--------
|
|
 Duplicate bill 
|
 Same branch + date + vendor + amount ±2% 
|
 Auto-flag, owner notification 
|
|
 Round-number spike 
|
 Bills ending in exactly 000 or 500 above ₹5,000 
|
 Flag for review 
|
|
 Unusual vendor amount 
|
 Bill amount > 3σ from vendor's historical average 
|
 Flag with explanation 
|
|
 Off-hours submission 
|
 Bill submitted between 2am–5am 
|
 Soft flag, manager noted 
|
|
 Missing image (high value) 
|
 Bills >₹2,000 submitted without image 
|
 Block submission (configurable) 
|
|
 Frequency spike 
|
 Same vendor billed 3+ times in one day 
|
 Flag as unusual 
|
|
 New vendor, high amount 
|
 First-time vendor with bill >₹10,000 
|
 Flag for owner approval 
|
|
 Category mismatch 
|
 AI confidence <60% on category classification 
|
 Auto-flag for correction 
|
|
 Budget overshoot pattern 
|
 Branch consistently exceeds budget by same % 
|
 Weekly pattern alert 
|

---

## 10. Notifications & Communication

### 10.1 Channels

|
 Channel 
|
 Status 
|
 Use Cases 
|
|
---------
|
--------
|
-----------
|
|
 In-app (badge + notification centre) 
|
 ✅ Keep & enhance 
|
 All alerts; real-time via Supabase Realtime 
|
|
 Email (Resend / Nodemailer) 
|
 🆕 New 
|
 Daily digest, monthly reports, budget breach, anomaly summary 
|
|
 WhatsApp (Meta Cloud API) 
|
 🆕 Optional 
|
 Real-time budget alerts, daily summary — high-engagement in India 
|
|
 Browser push notifications 
|
 🆕 Phase 2 
|
 Urgent alerts when app is closed 
|

### 10.2 Automated Notification Schedule

|
 Trigger / Schedule 
|
 Recipient 
|
 Message Type 
|
 Channel 
|
|
-------------------
|
-----------
|
-------------
|
---------
|
|
 Bill submitted (real-time) 
|
 Owner 
|
 New bill alert if >₹5,000 
|
 In-app 
|
|
 Budget reaches 80% 
|
 Owner + Manager 
|
 Budget warning with current total 
|
 In-app + Email 
|
|
 Budget exceeded 100% 
|
 Owner + Manager 
|
 Budget breach alert 
|
 In-app + Email + WhatsApp 
|
|
 Duplicate detected 
|
 Owner 
|
 Duplicate flagged for review 
|
 In-app + Email 
|
|
 Anomaly detected 
|
 Owner 
|
 Anomaly report with details 
|
 In-app + Email 
|
|
 Daily at 9pm 
|
 Owner 
|
 Digest: total spend, top category, branch comparison 
|
 Email + WhatsApp 
|
|
 Daily at 8am 
|
 Managers 
|
 Today's budget reminder 
|
 In-app + WhatsApp 
|
|
 Monthly on 1st 
|
 Owner + Accountant 
|
 Monthly P&L summary, GST report PDF 
|
 Email 
|
|
 25th of month 
|
 Owner 
|
 Month-end closing reminder 
|
 Email 
|
|
 No bills for 24h (working day) 
|
 Owner 
|
 Inactivity alert: "Branch X has no bills today" 
|
 In-app + Email 
|
|
 Cash variance detected 
|
 Owner 
|
 Petty cash mismatch at end of day 
|
 In-app + WhatsApp 
|

---

## 11. Data Model v2.0 — Supabase / PostgreSQL

All data moves from localStorage to Supabase. Row-Level Security (RLS) policies enforce access control at the database layer — managers can only query their own branch's data regardless of what the client sends.

### 11.1 Core Tables

|
 Table 
|
 Key Columns 
|
 Notes 
|
|
-------
|
-------------
|
-------
|
|
`owners`
|
 id, email, business_name, gstin, pan, financial_year_start, currency 
|
 Supabase Auth user ID as PK 
|
|
`branches`
|
 id, owner_id, branch_code, branch_name, address, city, gstin, daily_budget, monthly_budget, is_active 
|
 RLS: owner sees all; manager sees own branch 
|
|
`managers`
|
 id, owner_id, branch_id, name, username, email, whatsapp, role, is_active 
|
 Supabase Auth for login; no plain-text passwords 
|
|
`bills`
|
 id, branch_id, manager_id, vendor_name, bill_date, bill_number, vendor_gstin, category, payment_mode, items (jsonb), subtotal, gst_rate, cgst, sgst, total_amount, image_url, status, flags, ai_confidence, shift, is_manual, uploaded_at 
|
`image_url`
 points to Supabase Storage 
|
|
`vendors`
|
 id, owner_id, name, gstin, contact, category, preferred_status, payment_terms, notes 
|
 Auto-created from bill data; enrichable 
|
|
`notifications`
|
 id, owner_id, branch_id, type, message, read, created_at 
|
 Realtime subscription for in-app badges 
|
|
`audit_log`
|
 id, owner_id, actor_id, actor_role, action, entity_type, entity_id, details (jsonb), created_at 
|
 Immutable; no DELETE via RLS 
|
|
`recipes`
|
 id, owner_id, name, selling_price, ingredients (jsonb), target_margin 
|
 Recipe costing 
|
|
`wastage_log`
|
 id, branch_id, manager_id, item_name, qty, unit, reason, estimated_value, logged_at 
|
 Wastage tracking 
|
|
`staff_register`
|
 id, branch_id, name, role, wage_type, daily_rate, monthly_salary, is_active 
|
 Staff cost module 
|
|
`attendance_log`
|
 id, branch_id, staff_id, date, present, overtime_hours 
|
 Attendance + wage calc 
|
|
`petty_cash_log`
|
 id, branch_id, manager_id, date, opening_balance, closing_balance, expected_closing 
|
 Cash reconciliation 
|
|
`category_budgets`
|
 id, branch_id, category, monthly_limit, current_month_spend 
|
 Category-level budgets (new) 
|
|
`recurring_vendors`
|
 id, branch_id, vendor_id, frequency, typical_amount, category, gst_rate, requires_image 
|
 Quick-entry templates 
|

### 11.2 Bill Status Lifecycle

```
image selected
      │
      ▼
  [processing]  ← bill saved; AI extraction in progress
      │
      ▼ AI completes
  [pending]     ← awaiting owner review
      │
  ┌───┴──────────────────┐
  ▼                      ▼
[verified]           [flagged]   ← owner flagged, or auto-flagged by anomaly engine
                         │
                         ▼
                    [verified]   ← owner can override flagged → verified
```

**Draft state**: Manager started filling manually but did not submit → auto-saved as `draft`; shown as "pending draft" on their home screen.

### 11.3 Bill Data Captured

|
 Field 
|
 Source 
|
 Required 
|
|
-------
|
--------
|
----------
|
|
 Branch ID 
|
 Manager's session 
|
 ✅ Auto 
|
|
 Vendor Name 
|
 AI or manual 
|
 ✅ 
|
|
 Bill Date 
|
 AI or manual (default: today) 
|
 ✅ 
|
|
 Bill Number 
|
 AI or manual (auto-generated if blank) 
|
 Optional 
|
|
 Vendor GSTIN 
|
 AI or manual 
|
 Optional 
|
|
 Vendor Contact 
|
 AI or manual 
|
 Optional 
|
|
 HSN Code 
|
 AI or manual 
|
 Optional 
|
|
 Category 
|
 AI-classified or manual (15 categories) 
|
 ✅ 
|
|
 Payment Mode 
|
 AI-detected or manual (Cash/UPI/Card/Credit) 
|
 ✅ 
|
|
 Line Items 
|
 AI or manual (description, qty, unit, rate, amount) 
|
 ✅ min 1 
|
|
 GST Rate 
|
 AI or manual (0/5/12/18/28%) 
|
 ✅ 
|
|
 Subtotal 
|
 Auto-calculated from items 
|
 Auto 
|
|
 CGST / SGST 
|
 Auto-calculated 
|
 Auto 
|
|
 Total Amount 
|
 Subtotal + GST 
|
 Auto 
|
|
 Shift 
|
 Auto from upload time, manager can override 
|
 Auto 
|
|
 Bill Image 
|
 Compressed JPEG, uploaded to Supabase Storage 
|
 Optional 
|
|
 AI Confidence 
|
 Per-field confidence from Gemini 
|
 Auto 
|

---

## 12. Competitive Analysis & Feature Parity

### 12.1 Competitor Overview

|
 Competitor 
|
 Primary Focus 
|
 Restaurant-Specific 
|
 India-Optimised 
|
 Price 
|
|
------------
|
--------------
|
--------------------
|
-----------------
|
----
|
|
 Zoho Expense 
|
 General expense mgmt 
|
 ❌ No 
|
 ✅ Yes 
|
 ₹1,050/user/mo 
|
|
 Expensify 
|
 Travel & reimbursement 
|
 ❌ No 
|
 ❌ No 
|
 $10/user/mo 
|
|
 PettyFi 
|
 Petty cash tracking 
|
 ⚠️ Partial 
|
 ✅ Yes 
|
 ₹499/mo 
|
|
 Gofrugal 
|
 Full restaurant ERP 
|
 ✅ Yes 
|
 ✅ Yes 
|
 ₹5,000+/mo 
|
|
 Posist / RanceLab 
|
 POS + some expense 
|
 ✅ Yes 
|
 ✅ Yes 
|
 ₹3,000+/mo 
|
|
**
RestaurantLedger v2.0
**
|
 Restaurant-native expense mgmt 
|
 ✅ 
**
Yes
**
|
 ✅ 
**
Yes
**
|
 Lower than Gofrugal 
|

### 12.2 Feature Parity Matrix

|
 Feature 
|
 Zoho 
|
 Expensify 
|
 Gofrugal 
|
 RestaurantLedger v2 
|
|
---------
|
------
|
-----------
|
----------
|
---------------------
|
|
 AI bill extraction 
|
 ✅ 
|
 ✅ 
|
 ⚠️ 
|
 ✅ Auto (no button) 
|
|
 Zero-click AI submit 
|
 ❌ 
|
 ❌ 
|
 ❌ 
|
 ✅ 
**
Unique
**
|
|
 Mobile-first design 
|
 ⚠️ 
|
 ✅ 
|
 ❌ 
|
 ✅ Phone-native 
|
|
 Camera-first capture 
|
 ⚠️ 
|
 ✅ 
|
 ❌ 
|
 ✅ 
|
|
 Batch bill upload 
|
 ⚠️ 
|
 ✅ 
|
 ❌ 
|
 ✅ 
|
|
 Quick-entry recurring 
|
 ⚠️ 
|
 ❌ 
|
 ❌ 
|
 ✅ 
**
Unique
**
|
|
 Multi-branch support 
|
 ✅ 
|
 ❌ 
|
 ✅ 
|
 ✅ 
|
|
 GST report (India) 
|
 ✅ 
|
 ❌ 
|
 ✅ 
|
 ✅ GSTR-ready 
|
|
 Duplicate detection 
|
 ⚠️ 
|
 ❌ 
|
 ✅ 
|
 ✅ + 8 more anomaly types 
|
|
 Vendor scorecard 
|
 ✅ 
|
 ❌ 
|
 ✅ 
|
 ✅ + price trends 
|
|
 Budget alerts 
|
 ✅ 
|
 ✅ 
|
 ✅ 
|
 ✅ + WhatsApp 
|
|
 Shift-based cost tracking 
|
 ❌ 
|
 ❌ 
|
 ✅ 
|
 ✅ 
|
|
 Recipe / menu costing 
|
 ❌ 
|
 ❌ 
|
 ✅ 
|
 ✅ 
|
|
 Wastage tracking 
|
 ❌ 
|
 ❌ 
|
 ✅ 
|
 ✅ 
|
|
 Staff attendance + wages 
|
 ⚠️ 
|
 ❌ 
|
 ✅ 
|
 ✅ 
|
|
 LPG / utility tracker 
|
 ❌ 
|
 ❌ 
|
 ⚠️ 
|
 ✅ 
|
|
 Petty cash reconciliation 
|
 ❌ 
|
 ❌ 
|
 ✅ 
|
 ✅ 
|
|
 Accountant role 
|
 ✅ 
|
 ✅ 
|
 ✅ 
|
 ✅ 
|
|
 WhatsApp notifications 
|
 ❌ 
|
 ❌ 
|
 ❌ 
|
 ✅ 
**
India-first
**
|
|
 Live dashboard (realtime) 
|
 ❌ 
|
 ❌ 
|
 ❌ 
|
 ✅ 
|

---

## 13. Implementation Roadmap

### Phase 1 — Foundation & Core UX Fix (Weeks 1–4)

Fix the manager workflow and the broken infrastructure first. Everything else builds on this.

|
 Task 
|
 Effort 
|
 Priority 
|
|
------
|
--------
|
----------
|
|
 Set up Supabase project; migrate schema from localStorage 
|
 M 
|
 🔴 P0 
|
|
 Implement Supabase Auth (replace plain-text sessions) 
|
 M 
|
 🔴 P0 
|
|
 Move Gemini API calls to backend Node.js proxy 
|
 S 
|
 🔴 P0 
|
|
**
Auto-trigger AI extraction on image select — remove the button
**
|
 S 
|
 🔴 P0 
|
|
 Progressive form fill as AI streams results 
|
 M 
|
 🟢 P1 
|
|
 Save bill as 
`processing`
 if submitted before AI completes 
|
 S 
|
 🟢 P1 
|
|
 Mobile bottom navigation bar (manager + owner) 
|
 M 
|
 🟢 P1 
|
|
 Camera-first bill capture (
`capture="environment"`
 input) 
|
 S 
|
 🟢 P1 
|
|
 Migrate bill images from base64 to Supabase Storage 
|
 M 
|
 🟢 P1 
|
|
 Add Accountant role with read-only access 
|
 S 
|
 🟡 P2 
|
|
 Batch upload mode (multi-image queue UI) 
|
 M 
|
 🟡 P2 
|
|
 Data export / import for full backup (critical missing feature) 
|
 S 
|
 🟢 P1 
|

### Phase 2 — Restaurant Features (Weeks 5–10)

|
 Task 
|
 Effort 
|
 Priority 
|
|
------
|
--------
|
----------
|
|
 Shift-based cost tracking (auto-detect, UI, reports) 
|
 M 
|
 🟢 P1 
|
|
 Quick-entry mode for recurring vendors 
|
 S 
|
 🟢 P1 
|
|
 Staff register + attendance logging (mobile checklist) 
|
 M 
|
 🟡 P2 
|
|
 Petty cash register + reconciliation 
|
 M 
|
 🟡 P2 
|
|
 Wastage log module 
|
 S 
|
 🟡 P2 
|
|
 Enhanced vendor scorecard with price trend charts 
|
 M 
|
 🟡 P2 
|
|
 Full 9-type anomaly detection engine 
|
 M 
|
 🟢 P1 
|
|
 Category-level budgets 
|
 S 
|
 🟡 P2 
|
|
 GST report: GSTR-ready export, ITC column, TDS tracking 
|
 M 
|
 🟢 P1 
|
|
 Year-end summary report 
|
 S 
|
 🟡 P2 
|
|
 Daily email digest (Resend integration) 
|
 S 
|
 🟡 P2 
|
|
 WhatsApp notifications (Meta Cloud API) 
|
 L 
|
 🟡 P3 
|

### Phase 3 — Intelligence Layer (Weeks 11–16)

|
 Task 
|
 Effort 
|
 Priority 
|
|
------
|
--------
|
----------
|
|
 Recipe / menu costing module 
|
 L 
|
 🟢 P2 
|
|
 LPG / utility consumption tracker 
|
 M 
|
 🟡 P2 
|
|
 Live dashboard with Supabase Realtime 
|
 M 
|
 🟢 P2 
|
|
 Inline quick-approve from expense table row 
|
 S 
|
 🟢 P1 
|
|
 Side-by-side bill image + data viewer 
|
 S 
|
 🟡 P2 
|
|
 AI confidence score display + auto-flag low-confidence 
|
 S 
|
 🟢 P2 
|
|
 Vendor payment terms + outstanding dues tracking 
|
 M 
|
 🟡 P3 
|
|
 2FA for owner account (TOTP) 
|
 S 
|
 🟡 P3 
|

> **Effort key:** S = 1–3 days · M = 3–7 days · L = 1–2 weeks

---

## 14. File & Project Structure

```
restaurant-ledger/
├── backend/                          # Node.js + Express API (NEW)
│   ├── routes/
│   │   ├── auth.js
│   │   ├── bills.js
│   │   ├── branches.js
│   │   ├── managers.js
│   │   ├── vendors.js
│   │   ├── reports.js
│   │   └── notifications.js
│   ├── services/
│   │   ├── geminiService.js          # Gemini API (server-side only)
│   │   ├── emailService.js           # Resend / Nodemailer
│   │   ├── whatsappService.js        # Meta Cloud API
│   │   └── anomalyEngine.js          # 9-type anomaly detection
│   ├── jobs/
│   │   ├── dailyDigest.js            # node-cron: 9pm digest
│   │   ├── budgetReset.js            # Monthly budget reset
│   │   └── inactivityCheck.js        # 24h no-bill alert
│   ├── middleware/
│   │   ├── auth.js                   # JWT verify
│   │   ├── roleGuard.js              # owner / manager / accountant
│   │   └── rateLimit.js
│   └── .env                          # SUPABASE_URL, GEMINI_KEY, RESEND_KEY
│
├── frontend/                         # Vite + Vanilla JS (restructured)
│   └── src/
│       ├── pages/
│       │   ├── manager/
│       │   │   ├── home.js           # Manager home / daily briefing (NEW)
│       │   │   ├── upload.js         # Redesigned: auto-AI, camera-first
│       │   │   ├── batchUpload.js    # Batch mode (NEW)
│       │   │   ├── quickEntry.js     # Recurring vendor quick submit (NEW)
│       │   │   ├── myBills.js        # Swipeable bill list
│       │   │   ├── branchSummary.js
│       │   │   ├── staffAttendance.js # (NEW)
│       │   │   ├── pettyCash.js       # (NEW)
│       │   │   └── wastageLog.js      # (NEW)
│       │   └── owner/
│       │       ├── dashboard.js       # Live dashboard (enhanced)
│       │       ├── expenses.js        # Inline approve, bulk actions
│       │       ├── vendors.js         # Scorecard with price trends
│       │       ├── budgets.js
│       │       ├── managers.js
│       │       ├── branches.js
│       │       ├── recipes.js         # Recipe costing (NEW)
│       │       ├── anomalies.js
│       │       ├── notifications.js
│       │       ├── audit.js
│       │       ├── settings.js
│       │       └── reports/
│       │           ├── pnl.js
│       │           ├── gst.js
│       │           ├── cashflow.js
│       │           ├── vendorPayments.js
│       │           ├── shiftCost.js   # (NEW)
│       │           ├── recipeCost.js  # (NEW)
│       │           ├── staffCost.js   # (NEW)
│       │           ├── wastage.js     # (NEW)
│       │           ├── utility.js     # (NEW)
│       │           ├── budgetActual.js
│       │           ├── anomalyReport.js
│       │           └── yearEnd.js     # (NEW)
│       ├── components/
│       │   ├── sidebar.js            # Desktop only (owner)
│       │   ├── bottomNav.js          # Mobile nav bar (NEW)
│       │   ├── header.js
│       │   ├── charts.js
│       │   ├── table.js
│       │   ├── modal.js
│       │   ├── toast.js
│       │   ├── billThumbnail.js      # (NEW)
│       │   ├── confidenceBadge.js    # (NEW)
│       │   ├── shiftSelector.js      # (NEW)
│       │   ├── batchQueue.js         # (NEW)
│       │   └── cameraCapture.js      # (NEW) — handles capture vs gallery
│       ├── services/
│       │   ├── api.js                # Fetch wrapper → backend
│       │   ├── authService.js        # Supabase Auth client
│       │   └── realtimeService.js    # Supabase Realtime subscriptions
│       └── style.css                 # Extended with mobile breakpoints
│
└── supabase/
    ├── migrations/                   # SQL schema files
    ├── seed.sql                      # Demo data
    └── policies.sql                  # RLS rules
```

---

## 15. Change Summary v1.0 → v2.0

### What Stays (Unchanged or Kept As-Is)

|
 Feature 
|
 Notes 
|
|
---------
|
-------
|
|
 Vite + Vanilla JS frontend 
|
 Zero migration cost; solid foundation 
|
|
 Chart.js charts 
|
 Line, donut, bar — keep and extend 
|
|
 jsPDF + CSV exports 
|
 Working exports; keep entirely 
|
|
 15 expense categories 
|
 Well-calibrated for Indian restaurants 
|
|
 Dark mode glassmorphism UI 
|
 Very high quality; keep as-is 
|
|
 Hash-based routing 
|
 Simple and functional 
|
|
 GST calculator in bill form 
|
 Keep; extend with IGST 
|
|
 Gemini 8-model fallback chain 
|
 Keep; just move calls to backend 
|
|
 INR currency formatting 
|
 India-only product 
|
|
 Duplicate detection logic 
|
 Keep; add 8 more anomaly types on top 
|
|
 Audit logging 
|
 Keep; move from localStorage to Supabase table 
|

### What Changes (Modified)

|
 Feature 
|
 v1.0 
|
 v2.0 
|
|
---------
|
------
|
------
|
|
 AI extract trigger 
|
 Manual button click 
|
**
Automatic on image select
**
|
|
 Bill form 
|
 Full form shown immediately 
|
 Progressive reveal as AI fills fields 
|
|
 Data storage 
|
 localStorage (fragile, single-device) 
|
 Supabase PostgreSQL (cloud) 
|
|
 Bill images 
|
 base64 in localStorage 
|
 Supabase Storage (permanent URLs) 
|
|
 Authentication 
|
 Plain text, sessionStorage 
|
 Supabase Auth, JWT, bcrypt 
|
|
 Gemini API calls 
|
 Client-side (key exposed) 
|
 Server-side proxy (key in .env) 
|
|
 Manager landing 
|
 Upload Bill page 
|
 Branch overview home screen 
|
|
 Vendor page 
|
 Basic spend table 
|
 Full scorecard with price trends 
|
|
 GST report 
|
 Basic table 
|
 GSTR-ready, ITC column, TDS 
|
|
 Anomaly detection 
|
 Duplicate check only 
|
 9-type anomaly engine 
|
|
 Notifications 
|
 In-app only 
|
 In-app + Email + WhatsApp 
|
|
 Reports 
|
 4 tabs 
|
 12 restaurant-specific reports 
|
|
 Navigation (mobile) 
|
 Desktop sidebar (unusable on phone) 
|
 Bottom nav bar, thumb-friendly 
|
|
 Upload input 
|
 Drag-and-drop zone only 
|
 Camera-first + gallery + manual 
|

### What Is Added (New)

|
 Feature 
|
 Category 
|
|
---------
|
---------
|
|
 Camera-first bill capture 
|
 Mobile UX 
|
|
 Mobile bottom navigation bar 
|
 Mobile UX 
|
|
 Batch bill upload mode 
|
 Manager UX 
|
|
 Quick-entry mode for recurring vendors 
|
 Manager UX 
|
|
 Save as 
`processing`
 if AI still running 
|
 Manager UX 
|
|
 AI confidence indicators per field 
|
 Intelligence 
|
|
 Manager home screen (daily briefing) 
|
 Manager UX 
|
|
 Accountant read-only role 
|
 Access Control 
|
|
 Backend API server (Node.js) 
|
 Architecture 
|
|
 Supabase cloud database 
|
 Architecture 
|
|
 Supabase Auth (JWT, bcrypt) 
|
 Security 
|
|
 Supabase Storage for bill images 
|
 Storage 
|
|
 Shift-based cost tracking 
|
 Restaurant Feature 
|
|
 Recipe / menu costing 
|
 Restaurant Feature 
|
|
 Wastage & spoilage tracking 
|
 Restaurant Feature 
|
|
 LPG & utility consumption tracker 
|
 Restaurant Feature 
|
|
 Cash management / petty cash register 
|
 Restaurant Feature 
|
|
 Staff attendance & auto-wage calculation 
|
 Restaurant Feature 
|
|
 Lightweight inventory pulse 
|
 Restaurant Feature 
|
|
 Live dashboard with Supabase Realtime 
|
 Owner Dashboard 
|
|
 Branch health matrix (at-a-glance grid) 
|
 Owner Dashboard 
|
|
 Inline quick-approve from table 
|
 Owner Dashboard 
|
|
 Bulk bill actions 
|
 Owner Dashboard 
|
|
 AI confidence score per bill 
|
 Intelligence 
|
|
 Side-by-side image + data viewer 
|
 Owner Dashboard 
|
|
 Vendor price trend charts 
|
 Vendor Intelligence 
|
|
 Category-level budgets 
|
 Budgeting 
|
|
 8 additional anomaly types 
|
 Intelligence 
|
|
 Daily email digest 
|
 Notifications 
|
|
 WhatsApp notifications 
|
 Notifications 
|
|
 Full data export / import backup 
|
 Data Safety 
|
|
 7 new restaurant-specific reports 
|
 Reports 
|
|
 GSTR-ready GST report + TDS tracking 
|
 Compliance 
|

### What Is Removed

|
 Item 
|
 Reason 
|
|
------
|
--------
|
|
 "Extract with AI" button 
|
 Replaced by automatic trigger — no explicit action needed 
|
|
 localStorage as primary database 
|
 Fragile, single-device, 5MB limit 
|
|
 base64 bill image storage 
|
 Broke the app at scale; images filled localStorage 
|
|
 Client-side Gemini API calls 
|
 API key was exposed in browser DevTools 
|
|
 Plain-text password storage 
|
 Critical security liability 
|
|
 sessionStorage sessions 
|
 Lost on every app switch on mobile 
|
|
 Single hardcoded owner credential 
|
 Replaced by Supabase Auth registration 
|

---

## 16. Design & UX Principles

|
 Principle 
|
 What It Means in Practice 
|
|
-----------
|
--------------------------
|
|
**
2-tap maximum for managers
**
|
 Select image → Submit. Every additional tap is a product failure. 
|
|
**
Phone is the truth
**
|
 If a feature doesn't work well at 390px with thumbs, it doesn't ship. 
|
|
**
Camera is the input device
**
|
 The bill camera opens by default. File picker and manual entry are fallbacks. 
|
|
**
AI is invisible
**
|
 AI runs silently. Show progress, never block. No buttons that say "Extract". 
|
|
**
Errors caught at submission, not at month-end
**
|
 Duplicate detection, confidence flags, and anomaly detection work at upload time. 
|
|
**
Restaurant-native vocabulary
**
|
 Use "shift", "LPG cylinder", "wastage", "mise en place" — not "transaction", "attachment", "receipt". 
|
|
**
India-first
**
|
 GST (CGST/SGST/IGST), UPI, INR, WhatsApp — first-class features. 
|
|
**
Owner sees insight, not data
**
|
 Dashboard answers "Is my business spending more than usual today?" — not "Here are 847 rows." 
|
|
**
Trust AI, verify with colour
**
|
 AI extraction is a suggestion. Amber = low confidence. Green = high confidence. Manager knows at a glance. 
|
|
**
Offline-tolerant
**
|
 Bills drafted offline queue and submit when connectivity returns. No data loss. 
|

---

*RestaurantLedger v2.0 — A manager's only job is to take a photo and tap Submit. The rest is ours.*