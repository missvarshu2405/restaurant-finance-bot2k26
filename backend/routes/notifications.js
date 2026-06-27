// ============================================
// Notification Routes
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getAll, getWhere, getById, insert, update, remove } from '../services/memoryStore.js';

const router = Router();

// GET /api/notifications
router.get('/', authMiddleware, async (req, res) => {
  let notifications;
  if (req.user.role === 'manager') {
    notifications = await getWhere('notifications', n => n.branch_id === req.user.branchId);
  } else {
    notifications = await getWhere('notifications', n => n.owner_id === req.user.ownerId);
  }
  notifications.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  if (req.query.limit) notifications = notifications.slice(0, parseInt(req.query.limit));
  res.json(notifications);
});

// GET /api/notifications/unread-count
router.get('/unread-count', authMiddleware, async (req, res) => {
  let notifications;
  if (req.user.role === 'manager') {
    notifications = await getWhere('notifications', n => n.branch_id === req.user.branchId && !n.read);
  } else {
    notifications = await getWhere('notifications', n => n.owner_id === req.user.ownerId && !n.read);
  }
  res.json({ count: notifications.length });
});

// PUT /api/notifications/mark-read
router.put('/mark-read', authMiddleware, async (req, res) => {
  const { ids } = req.body;
  if (Array.isArray(ids)) {
    for (const id of ids) {
      await update('notifications', id, { read: true });
    }
  } else {
    // Mark all as read
    const notifications = req.user.role === 'manager'
      ? await getWhere('notifications', n => n.branch_id === req.user.branchId)
      : await getWhere('notifications', n => n.owner_id === req.user.ownerId);
    for (const n of notifications) {
      await update('notifications', n.id, { read: true });
    }
  }
  res.json({ message: 'Notifications marked as read' });
});

// DELETE /api/notifications/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  await remove('notifications', req.params.id);
  res.json({ message: 'Notification deleted' });
});

export default router;
