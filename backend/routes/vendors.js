// ============================================
// Vendor Routes — CRUD + Scorecard
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getAll, getById, getWhere, findOne, insert, update, remove } from '../services/memoryStore.js';

const router = Router();

// GET /api/vendors — list all vendors for this owner
router.get('/', authMiddleware, async (req, res) => {
  const vendors = await getWhere('vendors', v => v.owner_id === req.user.ownerId);
  res.json(vendors);
});

// GET /api/vendors/:id — vendor detail with scorecard
router.get('/:id', authMiddleware, async (req, res) => {
  const vendor = await getById('vendors', req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });

  // Build scorecard
  const allBills = (await getAll('bills')).filter(b => b.vendor_name?.toLowerCase() === vendor.name.toLowerCase());
  const totalSpend = allBills.reduce((s, b) => s + (b.total_amount || 0), 0);
  const avgBillValue = allBills.length > 0 ? totalSpend / allBills.length : 0;
  const branchesServed = [...new Set(allBills.map(b => b.branch_id))].length;
  const paymentModes = {};
  allBills.forEach(b => { paymentModes[b.payment_mode || 'other'] = (paymentModes[b.payment_mode || 'other'] || 0) + 1; });

  // Price trend (monthly averages)
  const monthlyAvg = {};
  allBills.forEach(b => {
    const month = b.bill_date?.substring(0, 7);
    if (month) {
      if (!monthlyAvg[month]) monthlyAvg[month] = { total: 0, count: 0 };
      monthlyAvg[month].total += b.total_amount || 0;
      monthlyAvg[month].count++;
    }
  });
  const priceTrend = Object.entries(monthlyAvg)
    .map(([month, data]) => ({ month, average: Math.round(data.total / data.count) }))
    .sort((a, b) => a.month.localeCompare(b.month));

  res.json({
    ...vendor,
    scorecard: {
      totalSpend,
      billCount: allBills.length,
      avgBillValue: Math.round(avgBillValue),
      branchesServed,
      paymentModes,
      priceTrend,
      lastBillDate: allBills.sort((a, b) => (b.bill_date || '').localeCompare(a.bill_date || ''))[0]?.bill_date || null,
    },
  });
});

// POST /api/vendors
router.post('/', authMiddleware, requireRole('owner'), async (req, res) => {
  const data = req.body;
  const vendor = await insert('vendors', {
    owner_id: req.user.ownerId,
    name: data.name,
    gstin: data.gstin || '',
    contact: data.contact || '',
    category: data.category || 'miscellaneous',
    preferred_status: data.preferred_status || 'normal',
    payment_terms: data.payment_terms || '',
    bank_details: data.bank_details || {},
    notes: data.notes || '',
  });
  res.status(201).json(vendor);
});

// PUT /api/vendors/:id
router.put('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const vendor = await getById('vendors', req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  const updated = await update('vendors', req.params.id, req.body);
  res.json(updated);
});

// DELETE /api/vendors/:id
router.delete('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const vendor = await getById('vendors', req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Vendor not found' });
  await remove('vendors', req.params.id);
  res.json({ message: 'Vendor deleted' });
});

// GET /api/vendors/stats/all — vendor stats from bill data
router.get('/stats/all', authMiddleware, async (req, res) => {
  const ownerBranches = (await getWhere('branches', b => b.owner_id === req.user.ownerId)).map(b => b.id);
  const bills = (await getAll('bills')).filter(b => ownerBranches.includes(b.branch_id));

  const vendorMap = {};
  bills.forEach(b => {
    const name = b.vendor_name || 'Unknown';
    if (!vendorMap[name]) vendorMap[name] = { bills: [], total: 0, count: 0 };
    vendorMap[name].bills.push(b);
    vendorMap[name].total += b.total_amount || 0;
    vendorMap[name].count++;
  });

  const stats = Object.entries(vendorMap).map(([name, data]) => {
    const lastBill = data.bills.sort((a, b) => (b.bill_date || '').localeCompare(a.bill_date || ''))[0];
    return {
      vendorName: name,
      totalSpend: data.total,
      billCount: data.count,
      avgBillValue: Math.round(data.total / data.count),
      primaryCategory: lastBill?.category || 'miscellaneous',
      branchesServed: [...new Set(data.bills.map(b => b.branch_id))].length,
      lastSeen: lastBill?.bill_date || '',
      gstin: lastBill?.vendor_gstin || '',
    };
  }).sort((a, b) => b.totalSpend - a.totalSpend);

  res.json(stats);
});

export default router;
