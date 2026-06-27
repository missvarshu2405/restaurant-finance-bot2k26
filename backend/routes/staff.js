// ============================================
// Staff Routes — Register + Attendance
// ============================================

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { getAll, getById, getWhere, insert, update, remove } from '../services/memoryStore.js';

const router = Router();

// --- Staff Register ---

// GET /api/staff — list staff for a branch
router.get('/', authMiddleware, async (req, res) => {
  const branchId = req.query.branch_id || req.user.branchId;
  const staff = await getWhere('staff_register', s => s.branch_id === branchId);
  res.json(staff);
});

// POST /api/staff
router.post('/', authMiddleware, async (req, res) => {
  const data = req.body;
  const staff = await insert('staff_register', {
    branch_id: data.branch_id || req.user.branchId,
    name: data.name,
    role: data.role || 'helper',
    wage_type: data.wage_type || 'daily',
    daily_rate: parseFloat(data.daily_rate) || 0,
    monthly_salary: parseFloat(data.monthly_salary) || 0,
    is_active: true,
  });
  res.status(201).json(staff);
});

// PUT /api/staff/:id
router.put('/:id', authMiddleware, async (req, res) => {
  const staff = await getById('staff_register', req.params.id);
  if (!staff) return res.status(404).json({ error: 'Staff not found' });
  const updated = await update('staff_register', req.params.id, req.body);
  res.json(updated);
});

// DELETE /api/staff/:id
router.delete('/:id', authMiddleware, requireRole('owner'), async (req, res) => {
  await remove('staff_register', req.params.id);
  res.json({ message: 'Staff removed' });
});

// --- Attendance ---

// GET /api/staff/attendance — get attendance for date
router.get('/attendance', authMiddleware, async (req, res) => {
  const { branch_id, date, shift } = req.query;
  const branchId = branch_id || req.user.branchId;
  let attendance = await getWhere('attendance_log', a => a.branch_id === branchId);
  if (date) attendance = attendance.filter(a => a.date === date);
  if (shift) attendance = attendance.filter(a => a.shift === shift);
  res.json(attendance);
});

// POST /api/staff/attendance — log attendance (bulk)
router.post('/attendance', authMiddleware, async (req, res) => {
  const { entries, date, shift } = req.body;
  if (!Array.isArray(entries)) return res.status(400).json({ error: 'entries must be an array' });

  const results = [];
  for (const entry of entries) {
    // Upsert: check if already exists
    const existing = await getWhere('attendance_log', a =>
      a.staff_id === entry.staff_id && a.date === (date || entry.date) && a.shift === (shift || entry.shift || 'morning')
    );
    if (existing.length > 0) {
      const updated = await update('attendance_log', existing[0].id, {
        present: entry.present,
        overtime_hours: entry.overtime_hours || 0,
      });
      results.push(updated);
    } else {
      const inserted = await insert('attendance_log', {
        branch_id: entry.branch_id || req.user.branchId,
        staff_id: entry.staff_id,
        date: date || entry.date || new Date().toISOString().split('T')[0],
        shift: shift || entry.shift || 'morning',
        present: entry.present !== false,
        overtime_hours: entry.overtime_hours || 0,
      });
      results.push(inserted);
    }
  }

  res.json({ logged: results.length, entries: results });
});

export default router;
