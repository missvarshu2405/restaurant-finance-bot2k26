// ============================================
// Petty Cash Routes
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getAll, getById, getWhere, findOne, insert, update } from '../services/memoryStore.js';

const router = Router();

// GET /api/petty-cash — get petty cash for branch + date
router.get('/', authMiddleware, async (req, res) => {
  const branchId = req.query.branch_id || req.user.branchId;
  const date = req.query.date || new Date().toISOString().split('T')[0];
  const entry = await findOne('petty_cash_log', p => p.branch_id === branchId && p.date === date);

  // Calculate expected closing from cash bills
  const cashBills = await getWhere('bills', b => b.branch_id === branchId && b.bill_date === date && b.payment_mode === 'cash');
  const cashSpent = cashBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const opening = entry?.opening_balance || 0;
  const expectedClosing = opening - cashSpent;

  res.json({
    entry: entry || null,
    cashSpent,
    expectedClosing,
    cashBillCount: cashBills.length,
  });
});

// POST /api/petty-cash — create or update petty cash entry
router.post('/', authMiddleware, async (req, res) => {
  const data = req.body;
  const branchId = data.branch_id || req.user.branchId;
  const date = data.date || new Date().toISOString().split('T')[0];

  // Check if exists (upsert)
  const existing = await findOne('petty_cash_log', p => p.branch_id === branchId && p.date === date);

  // Calculate expected closing
  const cashBills = await getWhere('bills', b => b.branch_id === branchId && b.bill_date === date && b.payment_mode === 'cash');
  const cashSpent = cashBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);
  const opening = parseFloat(data.opening_balance) || existing?.opening_balance || 0;
  const expectedClosing = opening - cashSpent;
  const closing = data.closing_balance !== undefined ? parseFloat(data.closing_balance) : null;
  const variance = closing !== null ? closing - expectedClosing : 0;

  if (existing) {
    const updated = await update('petty_cash_log', existing.id, {
      opening_balance: opening,
      closing_balance: closing,
      expected_closing: expectedClosing,
      variance,
      notes: data.notes || existing.notes,
      submitted_at: closing !== null ? new Date().toISOString() : existing.submitted_at,
    });
    return res.json(updated);
  }

  const entry = await insert('petty_cash_log', {
    branch_id: branchId,
    manager_id: req.user.userId,
    date,
    opening_balance: opening,
    closing_balance: closing,
    expected_closing: expectedClosing,
    variance,
    notes: data.notes || '',
    submitted_at: closing !== null ? new Date().toISOString() : null,
  });

  // Alert if variance > ₹500
  if (closing !== null && Math.abs(variance) > 500) {
    const branch = await getById('branches', branchId);
    await insert('notifications', {
      owner_id: branch?.owner_id || req.user.ownerId,
      branch_id: branchId,
      type: 'cash_variance',
      message: `💰 Cash variance: ${branch?.branch_name || 'Branch'} — ₹${Math.abs(variance).toLocaleString('en-IN')} ${variance < 0 ? 'short' : 'over'}`,
      read: false,
    });
  }

  res.status(201).json(entry);
});

// GET /api/petty-cash/history — get history for branch
router.get('/history', authMiddleware, async (req, res) => {
  const branchId = req.query.branch_id || req.user.branchId;
  const entries = (await getWhere('petty_cash_log', p => p.branch_id === branchId))
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  res.json(entries);
});

export default router;
