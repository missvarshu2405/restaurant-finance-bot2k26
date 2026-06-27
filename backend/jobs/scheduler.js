// ============================================
// Cron Job Scheduler
// Daily digest, budget reset, inactivity check
// ============================================

import cron from 'node-cron';
import { getAll, getWhere, insert, update } from '../services/memoryStore.js';
import { sendDailyDigest } from '../services/emailService.js';
import { sendDailySummaryWhatsApp } from '../services/whatsappService.js';

export function initCronJobs() {
  // Daily digest at 9 PM
  cron.schedule('0 21 * * *', async () => {
    console.log('📧 Running daily digest job...');
    try {
      await runDailyDigest();
    } catch (err) {
      console.error('Daily digest failed:', err);
    }
  });

  // Budget reset on 1st of every month at midnight
  cron.schedule('0 0 1 * *', async () => {
    console.log('🔄 Running monthly budget reset...');
    try {
      await runBudgetReset();
    } catch (err) {
      console.error('Budget reset failed:', err);
    }
  });

  // Inactivity check at 8 PM (check for branches with no bills in 24h)
  cron.schedule('0 20 * * *', async () => {
    console.log('🔍 Running inactivity check...');
    try {
      await runInactivityCheck();
    } catch (err) {
      console.error('Inactivity check failed:', err);
    }
  });

  // Morning budget reminder at 8 AM for managers
  cron.schedule('0 8 * * *', async () => {
    console.log('⏰ Running morning budget reminder...');
    try {
      await runMorningReminder();
    } catch (err) {
      console.error('Morning reminder failed:', err);
    }
  });

  // Month-end reminder on 25th at 10 AM
  cron.schedule('0 10 25 * *', async () => {
    console.log('📅 Running month-end reminder...');
    try {
      await runMonthEndReminder();
    } catch (err) {
      console.error('Month-end reminder failed:', err);
    }
  });

  console.log('⏰ Cron jobs initialized');
}

async function runDailyDigest() {
  const today = new Date().toISOString().split('T')[0];
  const owners = await getAll('owners');

  for (const owner of owners) {
    const branches = await getWhere('branches', b => b.owner_id === owner.id);
    const branchIds = branches.map(b => b.id);
    const allBills = await getAll('bills');
    const todayBills = allBills.filter(b => branchIds.includes(b.branch_id) && b.bill_date === today);

    if (todayBills.length === 0) continue;

    const totalSpend = todayBills.reduce((s, b) => s + (b.total_amount || 0), 0);

    // Top category
    const catMap = {};
    todayBills.forEach(b => { catMap[b.category || 'misc'] = (catMap[b.category || 'misc'] || 0) + (b.total_amount || 0); });
    const topCategory = Object.entries(catMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    // Top vendor
    const vendorMap = {};
    todayBills.forEach(b => { vendorMap[b.vendor_name || 'Unknown'] = (vendorMap[b.vendor_name || 'Unknown'] || 0) + (b.total_amount || 0); });
    const topVendor = Object.entries(vendorMap).sort((a, b) => b[1] - a[1])[0]?.[0] || 'None';

    // Branch breakdown
    const branchData = branches.map(br => {
      const brBills = todayBills.filter(b => b.branch_id === br.id);
      return { name: br.branch_name, spend: brBills.reduce((s, b) => s + (b.total_amount || 0), 0), billCount: brBills.length };
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
}

async function runBudgetReset() {
  // Reset category budget spend counters
  const budgets = await getAll('category_budgets');
  for (const b of budgets) {
    await update('category_budgets', b.id, { current_month_spend: 0 });
  }
  console.log(`Reset ${budgets.length} category budget counters`);
}

async function runInactivityCheck() {
  const today = new Date().toISOString().split('T')[0];
  const owners = await getAll('owners');

  for (const owner of owners) {
    const branches = await getWhere('branches', b => b.owner_id === owner.id && b.is_active);
    for (const branch of branches) {
      const allBills = await getAll('bills');
      const todayBills = allBills.filter(b => b.branch_id === branch.id && b.bill_date === today);
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
}

async function runMorningReminder() {
  const branches = (await getAll('branches')).filter(b => b.is_active);
  
  for (const branch of branches) {
    if (branch.daily_budget > 0) {
      const managers = await getWhere('managers', m => m.branch_id === branch.id && m.is_active);
      for (const mgr of managers) {
        await insert('notifications', {
          owner_id: branch.owner_id,
          branch_id: branch.id,
          type: 'budget_reminder',
          message: `☀️ Good morning! Today's budget: ₹${branch.daily_budget.toLocaleString('en-IN')} for ${branch.branch_name}`,
          read: false,
        });
      }
    }
  }
}

async function runMonthEndReminder() {
  const owners = await getAll('owners');
  for (const owner of owners) {
    await insert('notifications', {
      owner_id: owner.id,
      branch_id: null,
      type: 'month_end',
      message: `📅 Month-end reminder: Review pending bills and close all petty cash registers before month-end.`,
      read: false,
    });
  }
}
