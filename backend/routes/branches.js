// ============================================
// Branch Routes — CRUD
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getAll, getById, getWhere, insert, update, remove, removeWhere } from '../services/memoryStore.js';

const router = Router();

// GET /api/branches
router.get('/', authMiddleware, async (req, res) => {
  const { role, ownerId, branchId } = req.user;
  let branches;
  if (role === 'manager') {
    branches = await getWhere('branches', b => b.id === branchId);
  } else {
    branches = await getWhere('branches', b => b.owner_id === ownerId);
  }
  res.json(branches);
});

// GET /api/branches/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const branch = await getById('branches', req.params.id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });
  res.json(branch);
});

// POST /api/branches
router.post('/', authMiddleware, requireRole('owner'), async (req, res) => {
  const data = req.body;
  const branch = await insert('branches', {
    owner_id: req.user.ownerId,
    branch_code: data.branch_code || generateBranchCode(data.branch_name),
    branch_name: data.branch_name,
    address: data.address || '',
    city: data.city || '',
    gstin: data.gstin || '',
    daily_budget: parseFloat(data.daily_budget) || 0,
    monthly_budget: parseFloat(data.monthly_budget) || 0,
    is_active: true,
    shift_templates: data.shift_templates || [
      { name: 'Morning', start: '06:00', end: '11:00' },
      { name: 'Lunch', start: '11:00', end: '16:00' },
      { name: 'Dinner', start: '16:00', end: '23:00' },
    ],
  });

  await insert('audit_log', {
    owner_id: req.user.ownerId,
    actor_id: req.user.userId,
    actor_role: 'owner',
    action: 'branch_created',
    entity_type: 'branch',
    entity_id: branch.id,
    details: { branch_name: branch.branch_name },
  });

  res.status(201).json(branch);
});

// PUT /api/branches/:id
router.put('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const branch = await getById('branches', req.params.id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });

  const updates = req.body;
  if (updates.daily_budget) updates.daily_budget = parseFloat(updates.daily_budget);
  if (updates.monthly_budget) updates.monthly_budget = parseFloat(updates.monthly_budget);

  const updated = await update('branches', req.params.id, updates);
  res.json(updated);
});

// DELETE /api/branches/:id
router.delete('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const branch = await getById('branches', req.params.id);
  if (!branch) return res.status(404).json({ error: 'Branch not found' });

  // Remove associated data
  await removeWhere('managers', m => m.branch_id === req.params.id);
  await removeWhere('bills', b => b.branch_id === req.params.id);
  await removeWhere('staff_register', s => s.branch_id === req.params.id);
  await remove('branches', req.params.id);

  await insert('audit_log', {
    owner_id: req.user.ownerId,
    actor_id: req.user.userId,
    actor_role: 'owner',
    action: 'branch_deleted',
    entity_type: 'branch',
    entity_id: req.params.id,
    details: { branch_name: branch.branch_name },
  });

  res.json({ message: 'Branch deleted' });
});

function generateBranchCode(name) {
  const parts = (name || '').replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  let code = parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0, 3);
  if (code.length < 2) code = (name || 'BR').slice(0, 3).toUpperCase();
  code += '-' + String(Math.floor(Math.random() * 900) + 100);
  return code;
}

export default router;
