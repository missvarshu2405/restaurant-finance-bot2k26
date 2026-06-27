// ============================================
// Bills Routes — CRUD + AI Extraction + Upload
// Core of the zero-friction manager workflow
// ============================================

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/roleGuard.js';
import { uploadLimiter } from '../middleware/rateLimit.js';
import { getAll, getById, getWhere, insert, update, remove } from '../services/memoryStore.js';
import { extractBillData } from '../services/geminiService.js';
import { detectAnomalies } from '../services/anomalyEngine.js';
import { uploadBillImage } from '../services/supabaseStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Use memory storage for Vercel compatibility (no writable disk)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: (parseInt(process.env.MAX_FILE_SIZE_MB) || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  },
});

const router = Router();

// GET /api/bills — list bills (owner: all, manager: own branch)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { role, branchId, ownerId } = req.user;
    let bills;

    if (role === 'manager') {
      bills = await getWhere('bills', b => b.branch_id === branchId);
    } else {
      // Owner or accountant: filter by query params
      bills = await getAll('bills');
      const allBranches = await getAll('branches');
      // Match branches where owner_id equals ownerId OR (fallback) no owner_id set yet
      const ownerBranchIds = allBranches
        .filter(b => b.owner_id === ownerId || (!b.owner_id && req.user.role === 'owner'))
        .map(b => b.id);
      // If owner has no branches yet, show all bills (new account scenario)
      if (ownerBranchIds.length > 0) {
        bills = bills.filter(b => ownerBranchIds.includes(b.branch_id));
      }
      // Owner/accountant never receive failed_scan bills — manager-only territory
      bills = bills.filter(b => b.status !== 'failed_scan');
    }

    // Apply filters
    const { branch_id, status, category, date_from, date_to, vendor, search } = req.query;
    if (branch_id && branch_id !== 'all') bills = bills.filter(b => b.branch_id === branch_id);
    if (status) bills = bills.filter(b => b.status === status);
    if (category) bills = bills.filter(b => b.category === category);
    if (date_from) bills = bills.filter(b => b.bill_date >= date_from);
    if (date_to) bills = bills.filter(b => b.bill_date <= date_to);
    if (vendor) bills = bills.filter(b => b.vendor_name?.toLowerCase().includes(vendor.toLowerCase()));
    if (search) {
      const q = search.toLowerCase();
      bills = bills.filter(b =>
        b.vendor_name?.toLowerCase().includes(q) ||
        b.bill_number?.toLowerCase().includes(q) ||
        b.category?.toLowerCase().includes(q) ||
        b.owner_notes?.toLowerCase().includes(q)
      );
    }

    // Sort by date desc
    bills.sort((a, b) => (b.uploaded_at || '').localeCompare(a.uploaded_at || ''));

    res.json(bills);
  } catch (err) {
    console.error('List bills error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bills/failed-scan-count — count only, no bill details
router.get('/failed-scan-count', authMiddleware, async (req, res) => {
  try {
    const { role, branchId, ownerId } = req.user;
    let count = 0;

    if (role === 'manager') {
      const failed = await getWhere('bills', b => b.branch_id === branchId && b.status === 'failed_scan');
      count = failed.length;
    } else {
      // owner / accountant — count across all their branches
      const ownerBranches = await getWhere('branches', br => br.owner_id === ownerId);
      const ownerBranchIds = ownerBranches.map(br => br.id);
      const failed = await getWhere('bills', b => ownerBranchIds.includes(b.branch_id) && b.status === 'failed_scan');
      count = failed.length;
    }

    res.json({ count });
  } catch (err) {
    console.error('Failed scan count error:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/bills/:id — single bill
router.get('/:id', authMiddleware, async (req, res) => {
  const bill = await getById('bills', req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  res.json(bill);
});

// POST /api/bills — create bill (with optional image upload + AI extraction)
router.post('/', authMiddleware, uploadLimiter, upload.single('image'), async (req, res) => {
  try {
    const { role, userId, branchId } = req.user;
    const data = req.body;

    // Auto-detect shift from upload time
    const hour = new Date().getHours();
    let shift = 'dinner';
    if (hour >= 6 && hour < 11) shift = 'morning';
    else if (hour >= 11 && hour < 16) shift = 'lunch';

    // FIX #8 — compute image hash ONCE, reuse for both duplicate check and saving
    const imageHash = req.file
      ? crypto.createHash('sha256').update(req.file.buffer).digest('hex')
      : '';

    // Duplicate image check — block if same image hash already exists for this branch
    if (req.file) {
      const existingBills = await getWhere('bills', b => b.branch_id === (data.branch_id || branchId));
      const duplicate = existingBills.find(b => b.image_hash === imageHash);
      if (duplicate) {
        return res.status(409).json({
          error: 'duplicate_image',
          message: `Duplicate bill detected. This image was previously submitted on ${duplicate.bill_date} for ${duplicate.vendor_name || 'Unknown Vendor'} (₹${duplicate.total_amount || 0}). Duplicate entries are not permitted to prevent double accounting.`,
          duplicate_id: duplicate.id,
        });
      }
    }

    // Handle image upload to Supabase Storage
    let imageUrl = data.image_url || '';
    if (req.file) {
      try {
        imageUrl = await uploadBillImage(req.file.buffer, req.file.originalname);
      } catch (uploadErr) {
        console.warn('Image upload failed, continuing without image:', uploadErr.message);
      }
    }

    const billData = {
      branch_id: data.branch_id || branchId,
      manager_id: userId,
      vendor_name: data.vendor_name || '',
      bill_date: data.bill_date || new Date().toISOString().split('T')[0],
      bill_number: data.bill_number || '',
      vendor_gstin: data.vendor_gstin || '',
      vendor_contact: data.vendor_contact || '',
      hsn_code: data.hsn_code || '',
      fssai_number: data.fssai_number || '',
      category: data.category || 'miscellaneous',
      payment_mode: data.payment_mode || 'cash',
      items: typeof data.items === 'string' ? JSON.parse(data.items) : (data.items || []),
      subtotal: parseFloat(data.subtotal) || 0,
      discount_percent: parseFloat(data.discount_percent) || 0,
      discount_amount: parseFloat(data.discount_amount) || 0,
      taxable_amount: parseFloat(data.taxable_amount) || 0,
      gst_rate: parseFloat(data.gst_rate) || 0,
      cgst: parseFloat(data.cgst) || 0,
      sgst: parseFloat(data.sgst) || 0,
      igst: parseFloat(data.igst) || 0,
      round_off: parseFloat(data.round_off) || 0,
      total_amount: parseFloat(data.total_amount) || 0,
      image_url: imageUrl,
      image_hash: imageHash,
      status: data.status || 'pending',
      flags: [],
      owner_notes: '',
      ai_confidence: typeof data.ai_confidence === 'string' ? JSON.parse(data.ai_confidence) : (data.ai_confidence || {}),
      shift: data.shift || shift,
      is_manual: data.is_manual === 'true' || data.is_manual === true,
      is_recurring: data.is_recurring === 'true' || data.is_recurring === true,
      uploaded_at: new Date().toISOString(),
    };

    // Run anomaly detection
    const allBills = await getAll('bills');
    const branches = await getAll('branches');
    const anomalies = detectAnomalies(billData, allBills, branches);

    if (anomalies.length > 0) {
      billData.flags = anomalies.map(a => a.type);

      // Auto-flag high severity anomalies
      if (anomalies.some(a => a.severity === 'high')) {
        billData.status = 'flagged';
      }

      // Create notifications for anomalies
      const branch = await getById('branches', billData.branch_id);
      for (const a of anomalies) {
        await insert('notifications', {
          owner_id: branch?.owner_id || req.user.ownerId,
          branch_id: billData.branch_id,
          type: a.type,
          message: a.message,
          read: false,
        });
      }
    }

    // Budget alert check
    const branch = await getById('branches', billData.branch_id);
    if (branch?.daily_budget > 0) {
      const today = billData.bill_date;
      const todayBills = await getWhere('bills', b => b.branch_id === billData.branch_id && b.bill_date === today);
      const todayTotal = todayBills.reduce((sum, b) => sum + (b.total_amount || 0), 0) + billData.total_amount;
      const pct = Math.round((todayTotal / branch.daily_budget) * 100);

      if (pct >= 80) {
        await insert('notifications', {
          owner_id: branch.owner_id,
          branch_id: billData.branch_id,
          type: 'budget_alert',
          message: `⚠️ Budget Alert: ${branch.branch_name} at ${pct}% (₹${Math.round(todayTotal).toLocaleString('en-IN')} / ₹${branch.daily_budget.toLocaleString('en-IN')})`,
          read: false,
        });
      }
    }

    const bill = await insert('bills', billData);

    // Audit log
    await insert('audit_log', {
      owner_id: req.user.ownerId,
      actor_id: userId,
      actor_role: role,
      action: 'bill_uploaded',
      entity_type: 'bill',
      entity_id: bill.id,
      details: { vendor: bill.vendor_name, amount: bill.total_amount },
    });

    res.status(201).json({ bill, anomalies });
  } catch (err) {
    console.error('Create bill error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bills/extract — AI extraction from image (no bill save)
// geminiService already handles all model fallbacks internally — no retry loop needed here
router.post('/extract', authMiddleware, upload.single('image'), async (req, res) => {
  try {
    let imageBase64;

    if (req.file) {
      imageBase64 = req.file.buffer.toString('base64');
    } else if (req.body.image_base64) {
      imageBase64 = req.body.image_base64;
    } else {
      return res.status(400).json({ error: 'No image provided' });
    }

    // FIX #4 — removed 3-attempt outer retry loop (geminiService tries all models internally)
    let extracted = null;
    let lastErr = null;

    try {
      extracted = await extractBillData(imageBase64);
    } catch (err) {
      lastErr = err;
      console.error('AI Extraction failed inside /api/bills/extract:', err.message);
    }

    // Upload image to storage if present (do this regardless of extraction outcome)
    let imageUrl = null;
    if (req.file) {
      try {
        imageUrl = await uploadBillImage(req.file.buffer, req.file.originalname);
      } catch (uploadErr) {
        console.warn('Image upload failed:', uploadErr.message);
      }
    }

    if (!extracted) {
      return res.json({
        extracted: null,
        image_url: imageUrl,
        failed: true,
        scan_attempts: 1,
        error: lastErr?.message || 'AI extraction failed',
      });
    }

    res.json({
      extracted,
      image_url: imageUrl,
      failed: false,
      scan_attempts: 1,
    });
  } catch (err) {
    console.error('Unexpected error inside /api/bills/extract:', err.message);
    res.status(500).json({ error: `AI extraction failed: ${err.message}` });
  }
});

// POST /api/bills/upload-async — Upload images + AI extract + save
// Processes all images synchronously, then responds with results
router.post('/upload-async', authMiddleware, uploadLimiter, upload.array('images', 20), async (req, res) => {
  try {
    const { role, userId, branchId, ownerId } = req.user;
    const files = req.files || [];

    if (files.length === 0) {
      return res.status(400).json({ error: 'No images provided' });
    }

    // Auto-detect shift from upload time
    const hour = new Date().getHours();
    let shift = 'dinner';
    if (hour >= 6 && hour < 11) shift = 'morning';
    else if (hour >= 11 && hour < 16) shift = 'lunch';

    const results = [];

    for (const file of files) {
      try {
        console.log(`\n🔄 Processing bill image "${file.originalname}"...`);

        // Duplicate image check — skip if same image hash already saved for this branch
        const imageHash = crypto.createHash('sha256').update(file.buffer).digest('hex');
        const branchBills = await getWhere('bills', b => b.branch_id === branchId);
        const duplicate = branchBills.find(b => b.image_hash === imageHash);
        if (duplicate) {
          console.log(`  ⚠️ Duplicate image blocked: "${file.originalname}" matches bill ${duplicate.id}`);
          results.push({
            file: file.originalname,
            status: 'duplicate',
            duplicate_id: duplicate.id,
            message: `Duplicate bill detected. This image was previously submitted on ${duplicate.bill_date} for ${duplicate.vendor_name || 'Unknown Vendor'} (₹${duplicate.total_amount || 0}). Entry has been blocked to prevent double accounting.`,
          });
          try {
            await insert('notifications', {
              owner_id: ownerId,
              branch_id: branchId,
              type: 'duplicate',
              message: `🔄 Duplicate bill blocked: "${file.originalname}" matches a bill already on file for ${duplicate.vendor_name || 'Unknown Vendor'} (₹${duplicate.total_amount || 0}, ${duplicate.bill_date}).`,
              read: false,
            });
          } catch (e) { /* non-critical */ }
          continue;
        }

        // 1. Upload image to storage
        let imageUrl = '';
        try {
          imageUrl = await uploadBillImage(file.buffer, file.originalname);
          console.log(`  📸 Image uploaded: ${imageUrl}`);
        } catch (uploadErr) {
          console.warn(`  ⚠️ Image upload failed: ${uploadErr.message}`);
        }

        // 2. AI extraction — FIX #4: removed 3-attempt outer loop, geminiService handles fallbacks
        let extracted = null;
        let lastErr = null;

        try {
          const imageBase64 = file.buffer.toString('base64');
          extracted = await extractBillData(imageBase64);
          console.log(`  ✅ AI extracted: ${extracted.vendor_name || 'Unknown'} — ₹${extracted.total_amount || 0}`);
        } catch (extractErr) {
          lastErr = extractErr;
          console.error(`AI Extraction failed for "${file.originalname}":`, extractErr.message);
        }

        // 3. Save bill to database — branch on success vs. total failure
        let billData;

        if (extracted) {
          // Success path — save normally as 'pending'
          billData = {
            branch_id: branchId,
            manager_id: userId,
            vendor_name: extracted.vendor_name || '',
            bill_date: extracted.bill_date || new Date().toISOString().split('T')[0],
            bill_number: extracted.bill_number || '',
            vendor_gstin: extracted.vendor_gstin || '',
            vendor_contact: extracted.vendor_contact || '',
            hsn_code: extracted.hsn_code || '',
            fssai_number: extracted.fssai_number || '',
            category: extracted.category || 'miscellaneous',
            payment_mode: extracted.payment_mode || 'cash',
            items: extracted.items || [],
            subtotal: parseFloat(extracted.subtotal) || 0,
            discount_percent: parseFloat(extracted.discount_percent) || 0,
            discount_amount: parseFloat(extracted.discount_amount) || 0,
            taxable_amount: parseFloat(extracted.taxable_amount) || 0,
            gst_rate: parseFloat(extracted.gst_rate) || 0,
            cgst: parseFloat(extracted.cgst) || 0,
            sgst: parseFloat(extracted.sgst) || 0,
            igst: parseFloat(extracted.igst) || 0,
            round_off: parseFloat(extracted.round_off) || 0,
            total_amount: parseFloat(extracted.total_amount) || 0,
            image_url: imageUrl,
            image_hash: imageHash,
            status: 'pending',
            flags: [],
            owner_notes: '',
            ai_confidence: extracted.confidence || {},
            shift: shift,
            is_manual: false,
            is_recurring: false,
            scan_attempts: 1,
            uploaded_at: new Date().toISOString(),
          };
        } else {
          // AI failed — save with no invented data, status = failed_scan
          billData = {
            branch_id: branchId,
            manager_id: userId,
            vendor_name: '',
            bill_date: new Date().toISOString().split('T')[0],
            bill_number: '',
            vendor_gstin: '',
            vendor_contact: '',
            hsn_code: '',
            fssai_number: '',
            category: '',
            payment_mode: '',
            items: [],
            subtotal: 0,
            discount_percent: 0,
            discount_amount: 0,
            taxable_amount: 0,
            gst_rate: 0,
            cgst: 0,
            sgst: 0,
            igst: 0,
            round_off: 0,
            total_amount: 0,
            image_url: imageUrl,
            image_hash: imageHash,
            status: 'failed_scan',
            flags: [],
            owner_notes: '',
            ai_confidence: {},
            shift: shift,
            is_manual: false,
            is_recurring: false,
            scan_attempts: 1,
            uploaded_at: new Date().toISOString(),
          };
        }

        const bill = await insert('bills', billData);

        // 4. Run anomaly detection (only for successful scans — nothing to check on failed)
        if (extracted) {
          try {
            const allBills = await getAll('bills');
            const branches = await getAll('branches');
            const anomalies = detectAnomalies(billData, allBills, branches);

            if (anomalies.length > 0) {
              const flagTypes = anomalies.map(a => a.type);
              const updates = { flags: flagTypes };
              if (anomalies.some(a => a.severity === 'high')) updates.status = 'flagged';
              await update('bills', bill.id, updates);

              const branch = await getById('branches', branchId);
              for (const a of anomalies) {
                await insert('notifications', {
                  owner_id: branch?.owner_id || ownerId,
                  branch_id: branchId,
                  type: a.type,
                  message: a.message,
                  read: false,
                });
              }
            }
          } catch (e) { /* non-critical */ }
        }

        // 5. Push result + send notifications
        if (extracted) {
          console.log(`  💾 Bill saved: ${bill.id} — ${billData.vendor_name} — ₹${billData.total_amount}`);
          results.push({ id: bill.id, vendor: billData.vendor_name, amount: billData.total_amount, status: 'saved' });
        } else {
          console.log(`  ⚠️ Bill saved as failed_scan: ${bill.id} — "${file.originalname}"`);
          results.push({ id: bill.id, file: file.originalname, status: 'failed_scan', error: lastErr?.message || 'AI extraction failed' });

          // Notify manager
          try {
            await insert('notifications', {
              owner_id: ownerId,
              branch_id: branchId,
              type: 'scan_failed',
              message: `⚠️ A bill ("${file.originalname}") could not be scanned automatically and needs your attention.`,
              read: false,
            });
          } catch (e) { /* non-critical */ }

          // Notify owner — count only
          try {
            const ownerBranches = await getWhere('branches', br => br.owner_id === ownerId);
            const ownerBranchIds = ownerBranches.map(br => br.id);
            const failedBills = await getWhere('bills', b => ownerBranchIds.includes(b.branch_id) && b.status === 'failed_scan');
            await insert('notifications', {
              owner_id: ownerId,
              branch_id: null,
              type: 'scan_failed_count',
              message: `${failedBills.length} bill${failedBills.length !== 1 ? 's' : ''} need manager attention (scan failed).`,
              read: false,
            });
          } catch (e) { /* non-critical */ }
        }

        // 6. Audit log
        try {
          await insert('audit_log', {
            owner_id: ownerId, actor_id: userId, actor_role: role,
            action: extracted ? 'bill_uploaded' : 'bill_scan_failed',
            entity_type: 'bill', entity_id: bill.id,
            details: { vendor: bill.vendor_name, amount: bill.total_amount, scan_attempts: 1 },
          });
        } catch (e) { /* non-critical */ }

      } catch (billErr) {
        console.error(`  ❌ Bill processing failed:`, billErr.message);
        results.push({ file: file.originalname, status: 'failed', error: billErr.message });
      }
    }

    console.log(`\n✅ Processing complete: ${results.filter(r => r.status === 'saved').length}/${files.length} bill(s) saved`);

    res.status(201).json({
      message: `${results.filter(r => r.status === 'saved').length} bill(s) saved successfully`,
      count: results.length,
      bills: results,
    });

  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/bills/bulk-verify — bulk verify bills  ← MOVED HERE (was after PUT /:id/flag)
router.post('/bulk-verify', authMiddleware, requireRole('owner'), async (req, res) => {
  const { bill_ids } = req.body;
  if (!Array.isArray(bill_ids)) return res.status(400).json({ error: 'bill_ids must be an array' });

  const results = [];
  for (const id of bill_ids) {
    const bill = await getById('bills', id);
    if (bill) {
      await update('bills', id, {
        status: 'verified',
        verified_at: new Date().toISOString(),
        verified_by: req.user.userId,
      });
      results.push({ id, status: 'verified' });
    }
  }

  res.json({ verified: results.length, results });
});

// PUT /api/bills/:id — update bill
router.put('/:id', authMiddleware, async (req, res) => {
  const bill = await getById('bills', req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  // Managers can only update bills from their own branch
  if (req.user.role === 'manager' && bill.branch_id !== req.user.branchId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const updates = req.body;
  if (updates.items && typeof updates.items === 'string') {
    updates.items = JSON.parse(updates.items);
  }
  if (updates.ai_confidence && typeof updates.ai_confidence === 'string') {
    updates.ai_confidence = JSON.parse(updates.ai_confidence);
  }

  const updated = await update('bills', req.params.id, updates);

  // Audit log
  await insert('audit_log', {
    owner_id: req.user.ownerId,
    actor_id: req.user.userId,
    actor_role: req.user.role,
    action: 'bill_updated',
    entity_type: 'bill',
    entity_id: req.params.id,
    details: { updates: Object.keys(updates) },
  });

  res.json(updated);
});

// PUT /api/bills/:id/verify — verify a bill
router.put('/:id/verify', authMiddleware, requireRole('owner'), async (req, res) => {
  const bill = await getById('bills', req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  await update('bills', req.params.id, {
    status: 'verified',
    verified_at: new Date().toISOString(),
    verified_by: req.user.userId,
    flags: (bill.flags || []).filter(f => f !== 'duplicate'),
  });

  await insert('audit_log', {
    owner_id: req.user.ownerId,
    actor_id: req.user.userId,
    actor_role: 'owner',
    action: 'bill_verified',
    entity_type: 'bill',
    entity_id: req.params.id,
    details: { vendor: bill.vendor_name },
  });

  const updatedBill = await getById('bills', req.params.id);
  res.json(updatedBill);
});

// PUT /api/bills/:id/flag — flag a bill
router.put('/:id/flag', authMiddleware, requireRole('owner'), async (req, res) => {
  const bill = await getById('bills', req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  const flags = [...(bill.flags || [])];
  if (!flags.includes('manual_flag')) flags.push('manual_flag');

  await update('bills', req.params.id, {
    status: 'flagged',
    flags,
    owner_notes: req.body.reason || bill.owner_notes,
  });

  await insert('audit_log', {
    owner_id: req.user.ownerId,
    actor_id: req.user.userId,
    actor_role: 'owner',
    action: 'bill_flagged',
    entity_type: 'bill',
    entity_id: req.params.id,
    details: { vendor: bill.vendor_name, reason: req.body.reason },
  });

  const updatedBill = await getById('bills', req.params.id);
  res.json(updatedBill);
});

// DELETE /api/bills/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  const bill = await getById('bills', req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });

  // Only owner or the manager who uploaded it can delete
  if (req.user.role === 'manager' && bill.manager_id !== req.user.userId) {
    return res.status(403).json({ error: 'You can only delete your own bills' });
  }

  await remove('bills', req.params.id);

  await insert('audit_log', {
    owner_id: req.user.ownerId,
    actor_id: req.user.userId,
    actor_role: req.user.role,
    action: 'bill_deleted',
    entity_type: 'bill',
    entity_id: req.params.id,
    details: { vendor: bill.vendor_name, amount: bill.total_amount },
  });

  res.json({ message: 'Bill deleted' });
});

export default router;