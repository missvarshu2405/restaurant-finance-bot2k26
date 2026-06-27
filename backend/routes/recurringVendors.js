// ============================================
// Recurring Vendors Routes — Quick Entry
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getAll, getById, getWhere, insert, update, remove } from '../services/memoryStore.js';

const router = Router();

// GET /api/recurring-vendors
router.get('/', authMiddleware, async (req, res) => {
  const branchId = req.query.branch_id || req.user.branchId;
  const vendors = (await getWhere('recurring_vendors', v => v.branch_id === branchId && v.is_active))
    .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
  res.json(vendors);
});

// POST /api/recurring-vendors
router.post('/', authMiddleware, requireRole('owner'), async (req, res) => {
  const data = req.body;
  const vendor = await insert('recurring_vendors', {
    branch_id: data.branch_id,
    vendor_id: data.vendor_id || null,
    vendor_name: data.vendor_name,
    frequency: data.frequency || 'daily',
    typical_amount: parseFloat(data.typical_amount) || 0,
    category: data.category || 'miscellaneous',
    gst_rate: parseFloat(data.gst_rate) || 0,
    payment_mode: data.payment_mode || 'cash',
    requires_image: data.requires_image || false,
    icon: data.icon || '📦',
    display_order: data.display_order || 0,
    is_active: true,
  });
  res.status(201).json(vendor);
});

// PUT /api/recurring-vendors/:id
router.put('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const vendor = await getById('recurring_vendors', req.params.id);
  if (!vendor) return res.status(404).json({ error: 'Recurring vendor not found' });
  const updated = await update('recurring_vendors', req.params.id, req.body);
  res.json(updated);
});

// DELETE /api/recurring-vendors/:id
router.delete('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  await remove('recurring_vendors', req.params.id);
  res.json({ message: 'Recurring vendor deleted' });
});

export default router;
