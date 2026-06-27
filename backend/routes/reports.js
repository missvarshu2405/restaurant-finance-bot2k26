// ============================================
// Reports Routes — All 12 report endpoints
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getAll, getWhere, getById } from '../services/memoryStore.js';
import { getAnomalySummary } from '../services/anomalyEngine.js';

const router = Router();

async function getOwnerBills(ownerId, filters = {}) {
  const branches = await getWhere('branches', b => b.owner_id === ownerId);
  const branchIds = branches.map(b => b.id);
  let bills = (await getAll('bills')).filter(b => branchIds.includes(b.branch_id));
  if (filters.branch_id && filters.branch_id !== 'all') bills = bills.filter(b => b.branch_id === filters.branch_id);
  if (filters.date_from) bills = bills.filter(b => b.bill_date >= filters.date_from);
  if (filters.date_to) bills = bills.filter(b => b.bill_date <= filters.date_to);
  bills = bills.filter(b => b.status !== 'failed_scan');
  return { bills, branches };
}
// 1. P&L Summary
router.get('/pnl', authMiddleware, requireRole('owner', 'accountant'), async (req, res) => {
  const { bills } = await getOwnerBills(req.user.ownerId, req.query);
  const byCategory = {};
  bills.forEach(b => {
    const cat = b.category || 'miscellaneous';
    if (!byCategory[cat]) byCategory[cat] = { total: 0, count: 0, bills: [] };
    byCategory[cat].total += b.total_amount || 0;
    byCategory[cat].count++;
  });
  const grandTotal = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
  res.json({ categories: byCategory, grandTotal, billCount: bills.length });
});

// 2. GST Report (GSTR-ready)
router.get('/gst', authMiddleware, requireRole('owner', 'accountant'), async (req, res) => {
  const { bills } = await getOwnerBills(req.user.ownerId, req.query);
  const gstBills = bills.filter(b => (b.gst_rate || 0) > 0);
  const totalCGST = gstBills.reduce((s, b) => s + (b.cgst || 0), 0);
  const totalSGST = gstBills.reduce((s, b) => s + (b.sgst || 0), 0);
  const totalIGST = gstBills.reduce((s, b) => s + (b.igst || 0), 0);
  const totalTax = totalCGST + totalSGST + totalIGST;
  const itcClaimable = gstBills.filter(b => b.vendor_gstin).reduce((s, b) => s + (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0), 0);

  // Group by GST rate
  const byRate = {};
  gstBills.forEach(b => {
    const rate = b.gst_rate || 0;
    if (!byRate[rate]) byRate[rate] = { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, count: 0 };
    byRate[rate].taxableValue += b.subtotal || 0;
    byRate[rate].cgst += b.cgst || 0;
    byRate[rate].sgst += b.sgst || 0;
    byRate[rate].igst += b.igst || 0;
    byRate[rate].count++;
  });

  // Group by GSTIN
  const byGstin = {};
  gstBills.filter(b => b.vendor_gstin).forEach(b => {
    const gstin = b.vendor_gstin;
    if (!byGstin[gstin]) byGstin[gstin] = { vendor: b.vendor_name, taxableValue: 0, tax: 0, count: 0 };
    byGstin[gstin].taxableValue += b.subtotal || 0;
    byGstin[gstin].tax += (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0);
    byGstin[gstin].count++;
  });

  res.json({ totalCGST, totalSGST, totalIGST, totalTax, itcClaimable, byRate, byGstin, billCount: gstBills.length });
});

// 3. Cash Flow
router.get('/cashflow', authMiddleware, requireRole('owner'), async (req, res) => {
  const { bills } = await getOwnerBills(req.user.ownerId, req.query);
  const byPaymentMode = {};
  const byDate = {};
  bills.forEach(b => {
    const mode = b.payment_mode || 'other';
    byPaymentMode[mode] = (byPaymentMode[mode] || 0) + (b.total_amount || 0);
    const date = b.bill_date;
    if (!byDate[date]) byDate[date] = 0;
    byDate[date] += b.total_amount || 0;
  });
  const dailyCashFlow = Object.entries(byDate).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
  res.json({ byPaymentMode, dailyCashFlow });
});

// 4. Vendor Payments
router.get('/vendor-payments', authMiddleware, requireRole('owner', 'accountant'), async (req, res) => {
  const { bills } = await getOwnerBills(req.user.ownerId, req.query);
  const vendorMap = {};
  bills.forEach(b => {
    const name = b.vendor_name || 'Unknown';
    if (!vendorMap[name]) vendorMap[name] = { total: 0, count: 0, paymentModes: {} };
    vendorMap[name].total += b.total_amount || 0;
    vendorMap[name].count++;
    const mode = b.payment_mode || 'other';
    vendorMap[name].paymentModes[mode] = (vendorMap[name].paymentModes[mode] || 0) + 1;
  });
  const vendors = Object.entries(vendorMap).map(([name, data]) => ({
    vendorName: name, totalSpend: data.total, billCount: data.count,
    avgBillValue: Math.round(data.total / data.count), paymentModes: data.paymentModes,
  })).sort((a, b) => b.totalSpend - a.totalSpend);
  res.json(vendors);
});

// 5. Shift Cost Report
router.get('/shift-cost', authMiddleware, requireRole('owner'), async (req, res) => {
  const { bills, branches } = await getOwnerBills(req.user.ownerId, req.query);
  const byShift = {};
  const byBranchShift = {};
  bills.forEach(b => {
    const shift = b.shift || 'unknown';
    byShift[shift] = (byShift[shift] || 0) + (b.total_amount || 0);
    const key = `${b.branch_id}|${shift}`;
    if (!byBranchShift[key]) byBranchShift[key] = { branch_id: b.branch_id, shift, total: 0, count: 0 };
    byBranchShift[key].total += b.total_amount || 0;
    byBranchShift[key].count++;
  });
  res.json({ byShift, byBranchShift: Object.values(byBranchShift) });
});

// 6. Recipe Cost Report
router.get('/recipe-cost', authMiddleware, requireRole('owner'), async (req, res) => {
  const recipes = await getWhere('recipes', r => r.owner_id === req.user.ownerId);
  const report = recipes.map(r => {
    const ingredientCost = (r.ingredients || []).reduce((sum, ing) => sum + (ing.cost_per_unit || 0) * (ing.qty || 0), 0);
    const margin = r.selling_price > 0 ? ((r.selling_price - ingredientCost) / r.selling_price) * 100 : 0;
    return {
      id: r.id, name: r.name, sellingPrice: r.selling_price, ingredientCost: Math.round(ingredientCost * 100) / 100,
      margin: Math.round(margin * 10) / 10, targetMargin: r.target_margin, belowTarget: margin < (r.target_margin || 60),
      ingredients: r.ingredients,
    };
  });
  res.json(report);
});

// 7. Staff Cost Report
router.get('/staff-cost', authMiddleware, requireRole('owner', 'accountant'), async (req, res) => {
  const { branches } = await getOwnerBills(req.user.ownerId, req.query);
  const branchIds = branches.map(b => b.id);
  const staff = (await getAll('staff_register')).filter(s => branchIds.includes(s.branch_id));
  const attendance = (await getAll('attendance_log')).filter(a => branchIds.includes(a.branch_id));

  const byBranch = {};
  staff.forEach(s => {
    if (!byBranch[s.branch_id]) byBranch[s.branch_id] = { staff: [], totalWages: 0 };
    const staffAttendance = attendance.filter(a => a.staff_id === s.id && a.present);
    const daysWorked = staffAttendance.length;
    const overtimeHours = staffAttendance.reduce((sum, a) => sum + (a.overtime_hours || 0), 0);
    const wages = s.wage_type === 'daily' ? daysWorked * (s.daily_rate || 0) + overtimeHours * (s.daily_rate || 0) * 1.5 / 8 : s.monthly_salary || 0;
    byBranch[s.branch_id].staff.push({ ...s, daysWorked, overtimeHours, calculatedWages: Math.round(wages) });
    byBranch[s.branch_id].totalWages += wages;
  });
  res.json(byBranch);
});

// 8. Wastage Report
router.get('/wastage', authMiddleware, requireRole('owner'), async (req, res) => {
  const { branches } = await getOwnerBills(req.user.ownerId, req.query);
  const branchIds = branches.map(b => b.id);
  let wastage = (await getAll('wastage_log')).filter(w => branchIds.includes(w.branch_id));
  if (req.query.date_from) wastage = wastage.filter(w => w.logged_at >= req.query.date_from);
  if (req.query.date_to) wastage = wastage.filter(w => w.logged_at <= req.query.date_to + 'T23:59:59');

  const totalValue = wastage.reduce((s, w) => s + (w.estimated_value || 0), 0);
  const byItem = {};
  wastage.forEach(w => {
    if (!byItem[w.item_name]) byItem[w.item_name] = { total: 0, count: 0 };
    byItem[w.item_name].total += w.estimated_value || 0;
    byItem[w.item_name].count++;
  });
  const topWasted = Object.entries(byItem).map(([name, data]) => ({ itemName: name, totalValue: data.total, count: data.count })).sort((a, b) => b.totalValue - a.totalValue);

  res.json({ totalValue, entryCount: wastage.length, topWasted, entries: wastage });
});

// 9. Utility Consumption
router.get('/utility', authMiddleware, requireRole('owner'), async (req, res) => {
  const { bills } = await getOwnerBills(req.user.ownerId, req.query);
  const utilityBills = bills.filter(b => ['fuel_gas', 'electricity', 'water'].includes(b.category));
  const byCategory = {};
  utilityBills.forEach(b => {
    if (!byCategory[b.category]) byCategory[b.category] = { total: 0, count: 0, monthly: {} };
    byCategory[b.category].total += b.total_amount || 0;
    byCategory[b.category].count++;
    const month = b.bill_date?.substring(0, 7);
    if (month) byCategory[b.category].monthly[month] = (byCategory[b.category].monthly[month] || 0) + (b.total_amount || 0);
  });
  res.json(byCategory);
});

// 10. Budget vs Actual
router.get('/budget-actual', authMiddleware, requireRole('owner'), async (req, res) => {
  const { bills, branches } = await getOwnerBills(req.user.ownerId, req.query);
  const report = branches.map(branch => {
    const branchBills = bills.filter(b => b.branch_id === branch.id);
    const totalSpend = branchBills.reduce((s, b) => s + (b.total_amount || 0), 0);

    // Daily breakdown
    const byDate = {};
    branchBills.forEach(b => {
      if (!byDate[b.bill_date]) byDate[b.bill_date] = 0;
      byDate[b.bill_date] += b.total_amount || 0;
    });
    const dailyData = Object.entries(byDate).map(([date, actual]) => ({
      date, actual, budget: branch.daily_budget || 0, variance: (branch.daily_budget || 0) - actual,
      variancePct: branch.daily_budget > 0 ? Math.round(((branch.daily_budget - actual) / branch.daily_budget) * 100) : 0,
    })).sort((a, b) => a.date.localeCompare(b.date));

    return {
      branchId: branch.id, branchName: branch.branch_name,
      dailyBudget: branch.daily_budget, monthlyBudget: branch.monthly_budget,
      totalSpend, dailyData,
    };
  });
  res.json(report);
});

// 11. Anomaly & Fraud Report
router.get('/anomalies', authMiddleware, requireRole('owner'), async (req, res) => {
  const { bills, branches } = await getOwnerBills(req.user.ownerId, req.query);
  const anomalies = getAnomalySummary(bills, branches);
  res.json(anomalies);
});

// 12. Year-End Summary
router.get('/year-end', authMiddleware, requireRole('owner', 'accountant'), async (req, res) => {
  const year = req.query.year || new Date().getFullYear();
  const { bills, branches } = await getOwnerBills(req.user.ownerId, { date_from: `${year}-01-01`, date_to: `${year}-12-31` });
  const grandTotal = bills.reduce((s, b) => s + (b.total_amount || 0), 0);
  const totalGST = bills.reduce((s, b) => s + (b.cgst || 0) + (b.sgst || 0) + (b.igst || 0), 0);

  // Monthly breakdown
  const monthly = {};
  bills.forEach(b => {
    const month = b.bill_date?.substring(0, 7);
    if (month) monthly[month] = (monthly[month] || 0) + (b.total_amount || 0);
  });

  // By category
  const byCategory = {};
  bills.forEach(b => {
    const cat = b.category || 'miscellaneous';
    byCategory[cat] = (byCategory[cat] || 0) + (b.total_amount || 0);
  });

  // Top vendors
  const vendorMap = {};
  bills.forEach(b => {
    const name = b.vendor_name || 'Unknown';
    vendorMap[name] = (vendorMap[name] || 0) + (b.total_amount || 0);
  });
  const topVendors = Object.entries(vendorMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([name, total]) => ({ name, total }));

  res.json({ year, grandTotal, totalGST, billCount: bills.length, monthly, byCategory, topVendors });
});

export default router;
