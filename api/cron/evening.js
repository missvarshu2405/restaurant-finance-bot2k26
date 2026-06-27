// ============================================
// Vercel Cron — Evening Jobs (consolidated)
// Runs: Daily Digest + Inactivity Check
// Schedule: 9 PM IST (3:30 PM UTC)
// ============================================

import 'dotenv/config';
import { getAll, getWhere, insert } from '../../backend/services/memoryStore.js';
import { sendDailyDigest } from '../../backend/services/emailService.js';

export default async function handler(req, res) {
  // Verify this is a Vercel Cron request
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = { dailyDigest: null, inactivityCheck: null };

  try {
    // --- Daily Digest ---
    const today = new Date().toISOString().split('T')[0];
    const owners = await getAll('owners');

    for (const owner of owners) {
      const branches = await getWhere('branches', b => b.owner_id === owner.id);
      const branchIds = branches.map(b => b.id);
      const allBills = await getAll('bills');
      const todayBills = allBills.filter(
        b => branchIds.includes(b.branch_id) && b.bill_date === today
      );

      if (todayBills.length === 0) continue;

      const totalSpend = todayBills.reduce((s, b) => s + (b.total_amount || 0), 0);

      const catMap = {};
      todayBills.forEach(b => {
        catMap[b.category || 'misc'] = (catMap[b.category || 'misc'] || 0) + (b.total_amount || 0);
      });
      const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

      const vendorMap = {};
      todayBills.forEach(b => {
        vendorMap[b.vendor_name || 'Unknown'] = (vendorMap[b.vendor_name || 'Unknown'] || 0) + (b.total_amount || 0);
      });
      const topVendor = Object.entries(vendorMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

      const branchData = branches.map(br => {
        const brBills = todayBills.filter(b => b.branch_id === br.id);
        return {
          name: br.branch_name,
          spend: brBills.reduce((s, b) => s + (b.total_amount || 0), 0),
          billCount: brBills.length,
        };
      });

      await sendDailyDigest({
        to: owner.email,
        ownerName: owner.business_name || 'Owner',
        date: today,
        branches: branchData,
        totalSpend,
        topCategory,
        topVendor,
      });
    }
    results.dailyDigest = 'success';
  } catch (err) {
    console.error('Daily digest failed:', err);
    results.dailyDigest = `error: ${err.message}`;
  }

  try {
    // --- Inactivity Check ---
    const today = new Date().toISOString().split('T')[0];
    const owners = await getAll('owners');

    for (const owner of owners) {
      const branches = await getWhere('branches', b => b.owner_id === owner.id && b.is_active);
      for (const branch of branches) {
        const allBills = await getAll('bills');
        const todayBills = allBills.filter(
          b => b.branch_id === branch.id && b.bill_date === today
        );
        if (todayBills.length === 0) {
          await insert('notifications', {
            owner_id: owner.id,
            branch_id: branch.id,
            type: 'inactivity',
            message: `📭 No bills submitted today from ${branch.branch_name}`,
            read: false,
          });
        }
      }
    }
    results.inactivityCheck = 'success';
  } catch (err) {
    console.error('Inactivity check failed:', err);
    results.inactivityCheck = `error: ${err.message}`;
  }

  res.json({ ok: true, ran: 'evening', results });
}
