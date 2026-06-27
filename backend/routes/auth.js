// ============================================
// Auth Routes — Login, Register, Session
// Supabase Auth or in-memory bcrypt
// ============================================

import { Router } from 'express';
import bcryptjs from 'bcryptjs';
import { generateToken, authMiddleware } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { findOne, getAll, insert, update, getById } from '../services/memoryStore.js';

const router = Router();

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res) => {
  try {
    const { email, username, password, role } = req.body;

    if (role === 'owner') {
      const owner = await findOne('owners', o => o.email === email);
      if (!owner) return res.status(401).json({ error: 'Invalid credentials' });
      const valid = await bcryptjs.compare(password, owner.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = generateToken({
        userId: owner.id,
        role: 'owner',
        ownerId: owner.id,
        branchId: null,
      });

      return res.json({
        token,
        user: {
          id: owner.id,
          email: owner.email,
          name: owner.business_name || 'Restaurant Owner',
          role: 'owner',
          branchId: null,
        },
      });
    }

    if (role === 'manager') {
      const loginField = email || username;
      const manager = await findOne('managers', m =>
        (m.username === loginField || m.email === loginField) && m.is_active
      );
      if (!manager) return res.status(401).json({ error: 'Invalid credentials' });

      const valid = manager.password_hash
        ? await bcryptjs.compare(password, manager.password_hash)
        : password === manager.password; // Fallback for migrated data

      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      // Get owner_id for branch access
      const branch = await getById('branches', manager.branch_id);

      const token = generateToken({
        userId: manager.id,
        role: 'manager',
        ownerId: manager.owner_id,
        branchId: manager.branch_id,
      });

      return res.json({
        token,
        user: {
          id: manager.id,
          name: manager.name,
          username: manager.username,
          role: 'manager',
          branchId: manager.branch_id,
          branchName: branch?.branch_name || 'Unknown',
          ownerId: manager.owner_id,
        },
      });
    }

    if (role === 'accountant') {
      const accountant = await findOne('accountants', a => a.email === email && a.is_active);
      if (!accountant) return res.status(401).json({ error: 'Invalid credentials' });

      // Check expiry
      if (accountant.access_expiry && new Date(accountant.access_expiry) < new Date()) {
        return res.status(403).json({ error: 'Account access has expired. Contact the owner.' });
      }

      const valid = accountant.password_hash
        ? await bcryptjs.compare(password, accountant.password_hash)
        : false;
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

      const token = generateToken({
        userId: accountant.id,
        role: 'accountant',
        ownerId: accountant.owner_id,
        branchId: null,
      });

      return res.json({
        token,
        user: {
          id: accountant.id,
          name: accountant.name,
          email: accountant.email,
          role: 'accountant',
          ownerId: accountant.owner_id,
        },
      });
    }

    return res.status(400).json({ error: 'Invalid role. Must be owner, manager, or accountant.' });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// POST /api/auth/register — owner registration
router.post('/register', authLimiter, async (req, res) => {
  try {
    const { email, password, businessName } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

    const exists = await findOne('owners', o => o.email === email);
    if (exists) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcryptjs.hash(password, 10);
    const owner = await insert('owners', {
      email,
      password_hash,
      business_name: businessName || '',
      gstin: '',
      pan: '',
      financial_year_start: 4,
      currency: 'INR',
    });

    const token = generateToken({
      userId: owner.id,
      role: 'owner',
      ownerId: owner.id,
      branchId: null,
    });

    return res.status(201).json({
      token,
      user: {
        id: owner.id,
        email: owner.email,
        name: owner.business_name || 'Restaurant Owner',
        role: 'owner',
      },
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// GET /api/auth/me — get current session
router.get('/me', authMiddleware, async (req, res) => {
  const { userId, role, ownerId, branchId } = req.user;

  if (role === 'owner') {
    const owner = await getById('owners', userId);
    if (!owner) return res.status(404).json({ error: 'User not found' });
    return res.json({
      id: owner.id,
      email: owner.email,
      name: owner.business_name || 'Restaurant Owner',
      role: 'owner',
      businessName: owner.business_name,
      gstin: owner.gstin,
      pan: owner.pan,
    });
  }

  if (role === 'manager') {
    const manager = await getById('managers', userId);
    if (!manager) return res.status(404).json({ error: 'User not found' });
    const branch = await getById('branches', manager.branch_id);
    return res.json({
      id: manager.id,
      name: manager.name,
      username: manager.username,
      role: 'manager',
      branchId: manager.branch_id,
      branchName: branch?.branch_name || 'Unknown',
    });
  }

  if (role === 'accountant') {
    const accountant = await getById('accountants', userId);
    if (!accountant) return res.status(404).json({ error: 'User not found' });
    return res.json({
      id: accountant.id,
      name: accountant.name,
      email: accountant.email,
      role: 'accountant',
    });
  }

  return res.status(400).json({ error: 'Unknown role' });
});

// PUT /api/auth/password — change password
router.put('/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const { userId, role } = req.user;

    if (role === 'owner') {
      const owner = await getById('owners', userId);
      const valid = await bcryptjs.compare(currentPassword, owner.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      const password_hash = await bcryptjs.hash(newPassword, 10);
      await update('owners', userId, { password_hash });
    } else if (role === 'manager') {
      const manager = await getById('managers', userId);
      const valid = manager.password_hash
        ? await bcryptjs.compare(currentPassword, manager.password_hash)
        : currentPassword === manager.password;
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
      const password_hash = await bcryptjs.hash(newPassword, 10);
      await update('managers', userId, { password_hash });
    }

    return res.json({ message: 'Password updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Password update failed' });
  }
});

export default router;
