// ============================================
// Wastage Log Routes
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getAll, getById, getWhere, insert, update, remove } from '../services/memoryStore.js';

const router = Router();

// GET /api/wastage
router.get('/', authMiddleware, async (req, res) => {
  const branchId = req.query.branch_id || req.user.branchId;
  let wastage = await getWhere('wastage_log', w => w.branch_id === branchId);
  if (req.query.date_from) wastage = wastage.filter(w => w.logged_at >= req.query.date_from);
  if (req.query.date_to) wastage = wastage.filter(w => w.logged_at <= req.query.date_to + 'T23:59:59');
  wastage.sort((a, b) => (b.logged_at || '').localeCompare(a.logged_at || ''));
  res.json(wastage);
});

// POST /api/wastage
router.post('/', authMiddleware, async (req, res) => {
  const data = req.body;
  const entry = await insert('wastage_log', {
    branch_id: data.branch_id || req.user.branchId,
    manager_id: req.user.userId,
    item_name: data.item_name,
    qty: parseFloat(data.qty) || 0,
    unit: data.unit || 'kg',
    reason: data.reason || 'spoilage',
    estimated_value: parseFloat(data.estimated_value) || 0,
    linked_bill_id: data.linked_bill_id || null,
    logged_at: new Date().toISOString(),
  });
  res.status(201).json(entry);
});

// DELETE /api/wastage/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  await remove('wastage_log', req.params.id);
  res.json({ message: 'Wastage entry deleted' });
});

export default router;
