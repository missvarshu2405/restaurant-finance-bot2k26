// ============================================
// Manager Routes — CRUD
// ============================================

import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getAll, getById, getWhere, findOne, insert, update, remove } from '../services/memoryStore.js';

const router = Router();

// GET /api/managers
router.get('/', authMiddleware, requireRole('owner'), async (req, res) => {
  const managers = await getWhere('managers', m => m.owner_id === req.user.ownerId);
  // Strip password fields
  const safe = managers.map(({ password_hash, password, ...m }) => m);
  res.json(safe);
});

// GET /api/managers/:id
router.get('/:id', authMiddleware, async (req, res) => {
  const manager = await getById('managers', req.params.id);
  if (!manager) return res.status(404).json({ error: 'Manager not found' });
  const { password_hash, password, ...safe } = manager;
  res.json(safe);
});

// POST /api/managers
router.post('/', authMiddleware, requireRole('owner'), async (req, res) => {
  const data = req.body;
  if (!data.username || !data.password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  // Check username uniqueness
  const exists = await findOne('managers', m => m.username === data.username);
  if (exists) return res.status(409).json({ error: 'Username already exists' });

  const password_hash = await bcryptjs.hash(data.password, 10);
  const manager = await insert('managers', {
    owner_id: req.user.ownerId,
    branch_id: data.branch_id,
    name: data.name,
    username: data.username,
    email: data.email || '',
    whatsapp: data.whatsapp || '',
    role: 'manager',
    password_hash,
    is_active: true,
  });

  await insert('audit_log', {
    owner_id: req.user.ownerId,
    actor_id: req.user.userId,
    actor_role: 'owner',
    action: 'manager_created',
    entity_type: 'manager',
    entity_id: manager.id,
    details: { name: manager.name },
  });

  const { password_hash: _, ...safe } = manager;
  res.status(201).json(safe);
});

// PUT /api/managers/:id
router.put('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const manager = await getById('managers', req.params.id);
  if (!manager) return res.status(404).json({ error: 'Manager not found' });

  const updates = { ...req.body };

  // If username changing, check uniqueness
  if (updates.username && updates.username !== manager.username) {
    const exists = await findOne('managers', m => m.username === updates.username && m.id !== req.params.id);
    if (exists) return res.status(409).json({ error: 'Username already exists' });
  }

  // If password changing, hash it
  if (updates.password) {
    updates.password_hash = await bcryptjs.hash(updates.password, 10);
    delete updates.password;
  }

  const updated = await update('managers', req.params.id, updates);
  const { password_hash: _, password: __, ...safe } = updated;
  res.json(safe);
});

// DELETE /api/managers/:id
router.delete('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  const manager = await getById('managers', req.params.id);
  if (!manager) return res.status(404).json({ error: 'Manager not found' });

  await remove('managers', req.params.id);

  await insert('audit_log', {
    owner_id: req.user.ownerId,
    actor_id: req.user.userId,
    actor_role: 'owner',
    action: 'manager_deleted',
    entity_type: 'manager',
    entity_id: req.params.id,
    details: { name: manager.name },
  });

  res.json({ message: 'Manager deleted' });
});

export default router;
