// ============================================
// Anomaly Detection Engine — 9 Types
// Runs on every bill submission + batch scan
// FIX: round_number threshold raised (was ₹5k, now ₹10k)
//      category_mismatch only fires when confidence field exists
//      budget_overshoot uses new bill amount in calculation
// ============================================

import { getAll, getWhere, insert } from './memoryStore.js';

const ANOMALY_TYPES = {
  DUPLICATE: 'duplicate',
  ROUND_NUMBER: 'round_number_spike',
  UNUSUAL_AMOUNT: 'unusual_vendor_amount',
  OFF_HOURS: 'off_hours_submission',
  MISSING_IMAGE: 'missing_image_high_value',
  FREQUENCY_SPIKE: 'frequency_spike',
  NEW_VENDOR_HIGH: 'new_vendor_high_amount',
  CATEGORY_MISMATCH: 'category_mismatch',
  BUDGET_OVERSHOOT: 'budget_overshoot_pattern',
};

/**
 * Run all anomaly checks on a single bill.
 * Returns array of { type, severity, message, details }
 */
export function detectAnomalies(bill, allBills, branches) {
  const anomalies = [];
  const branchBills = allBills.filter(b => b.branch_id === bill.branch_id);

  // 1. Duplicate bill: same branch + date + vendor + amount ±2%
  const dupes = branchBills.filter(b =>
    b.id !== bill.id &&
    b.bill_date === bill.bill_date &&
    b.vendor_name?.toLowerCase() === bill.vendor_name?.toLowerCase() &&
    bill.vendor_name && // skip if vendor name is empty
    Math.abs(b.total_amount - bill.total_amount) / Math.max(b.total_amount, 1) < 0.02
  );
  if (dupes.length > 0) {
    anomalies.push({
      type: ANOMALY_TYPES.DUPLICATE,
      severity: 'medium',
      message: `Possible duplicate: ${bill.vendor_name} — ₹${bill.total_amount} on ${bill.bill_date}`,
      details: { duplicate_of: dupes.map(d => d.id) },
    });
  }

  // 2. Round-number spike: bills ending in exactly 000 above ₹10,000 (raised from ₹5k)
  //    Also require it's a perfectly round thousand, not just any 500-multiple
  if (bill.total_amount > 10000 && bill.total_amount % 1000 === 0) {
    anomalies.push({
      type: ANOMALY_TYPES.ROUND_NUMBER,
      severity: 'low', // downgraded from medium — very common in legitimate invoices
      message: `Round number amount: ₹${bill.total_amount} — may need verification`,
      details: { amount: bill.total_amount },
    });
  }

  // 3. Unusual vendor amount: bill > 3σ from vendor's historical average
  const vendorBills = allBills.filter(b =>
    b.vendor_name?.toLowerCase() === bill.vendor_name?.toLowerCase() &&
    bill.vendor_name &&
    b.id !== bill.id
  );
  if (vendorBills.length >= 3) {
    const amounts = vendorBills.map(b => b.total_amount);
    const mean = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const stdDev = Math.sqrt(amounts.reduce((s, x) => s + Math.pow(x - mean, 2), 0) / amounts.length);
    if (stdDev > 0 && Math.abs(bill.total_amount - mean) > 3 * stdDev) {
      anomalies.push({
        type: ANOMALY_TYPES.UNUSUAL_AMOUNT,
        severity: 'high',
        message: `Unusual amount for ${bill.vendor_name}: ₹${bill.total_amount} (avg: ₹${Math.round(mean)}, σ: ₹${Math.round(stdDev)})`,
        details: { mean: Math.round(mean), std_dev: Math.round(stdDev), deviation: Math.round(Math.abs(bill.total_amount - mean) / stdDev) },
      });
    }
  }

  // 4. Off-hours submission: bill submitted between 2am–5am
  const uploadHour = new Date(bill.uploaded_at || Date.now()).getHours();
  if (uploadHour >= 2 && uploadHour < 5) {
    anomalies.push({
      type: ANOMALY_TYPES.OFF_HOURS,
      severity: 'low',
      message: `Bill submitted at unusual hour (${uploadHour}:00)`,
      details: { upload_hour: uploadHour },
    });
  }

  // 5. Missing image for high-value bills (>₹5,000) — raised threshold
  if (bill.total_amount > 5000 && !bill.image_url) {
    anomalies.push({
      type: ANOMALY_TYPES.MISSING_IMAGE,
      severity: 'medium',
      message: `High-value bill (₹${bill.total_amount}) submitted without image`,
      details: { amount: bill.total_amount },
    });
  }

  // 6. Frequency spike: same vendor billed 3+ times in one day
  const sameDayVendor = branchBills.filter(b =>
    b.bill_date === bill.bill_date &&
    b.vendor_name?.toLowerCase() === bill.vendor_name?.toLowerCase() &&
    bill.vendor_name
  );
  if (sameDayVendor.length >= 3) {
    anomalies.push({
      type: ANOMALY_TYPES.FREQUENCY_SPIKE,
      severity: 'medium',
      message: `${bill.vendor_name} billed ${sameDayVendor.length} times on ${bill.bill_date}`,
      details: { count: sameDayVendor.length, bill_ids: sameDayVendor.map(b => b.id) },
    });
  }

  // 7. New vendor, high amount: first-time vendor with bill >₹10,000
  if (bill.total_amount > 10000 && vendorBills.length === 0 && bill.vendor_name) {
    anomalies.push({
      type: ANOMALY_TYPES.NEW_VENDOR_HIGH,
      severity: 'high',
      message: `First-time vendor ${bill.vendor_name} with high amount: ₹${bill.total_amount}`,
      details: { amount: bill.total_amount, is_new_vendor: true },
    });
  }

  // 8. Category mismatch: AI confidence <60% on category
  //    Only fire if ai_confidence.category is a real number (not undefined/null)
  const catConf = bill.ai_confidence?.category;
  if (typeof catConf === 'number' && catConf < 0.6) {
    anomalies.push({
      type: ANOMALY_TYPES.CATEGORY_MISMATCH,
      severity: 'low',
      message: `Low AI confidence on category (${Math.round(catConf * 100)}%)`,
      details: { confidence: catConf, category: bill.category },
    });
  }

  // 9. Budget overshoot pattern: check daily budget
  //    Include THIS bill's amount in the total (was missing before)
  const branch = branches.find(br => br.id === bill.branch_id);
  if (branch?.daily_budget > 0) {
    const todayBills = branchBills.filter(b => b.bill_date === bill.bill_date && b.id !== bill.id);
    const todayTotal = todayBills.reduce((sum, b) => sum + (b.total_amount || 0), 0) + (bill.total_amount || 0);
    const pct = (todayTotal / branch.daily_budget) * 100;
    if (pct > 100) {
      anomalies.push({
        type: ANOMALY_TYPES.BUDGET_OVERSHOOT,
        severity: 'high',
        message: `Budget exceeded: ${Math.round(pct)}% of daily budget used (₹${Math.round(todayTotal)} / ₹${branch.daily_budget})`,
        details: { percentage: Math.round(pct), total: Math.round(todayTotal), budget: branch.daily_budget },
      });
    }
  }

  return anomalies;
}

/**
 * Get anomaly summary for reporting
 */
export function getAnomalySummary(bills, branches) {
  const allAnomalies = [];
  for (const bill of bills) {
    const detected = detectAnomalies(bill, bills, branches);
    if (detected.length > 0) {
      allAnomalies.push({ bill_id: bill.id, bill, anomalies: detected });
    }
  }
  return allAnomalies;
}

export { ANOMALY_TYPES };