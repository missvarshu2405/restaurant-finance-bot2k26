// ============================================
// Vercel Cron — Monthly Jobs (consolidated)
// Runs: Budget Reset + Month-End Reminder
// Schedule: 1st of every month at midnight UTC
// ============================================

import 'dotenv/config';
import { getAll, update, insert } from '../../backend/services/memoryStore.js';

export default async function handler(req, res) {
  // Verify this is a Vercel Cron request
  if (req.headers['authorization'] !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const results = { budgetReset: null, monthEndReminder: null };

  try {
    // --- Budget Reset ---
    const budgets = await getAll('category_budgets');
    for (const b of budgets) {
      await update('category_budgets', b.id, { current_month_spend: 0 });
    }
    results.budgetReset = `success — reset ${budgets.length} budgets`;
  } catch (err) {
    console.error('Budget reset failed:', err);
    results.budgetReset = `error: ${err.message}`;
  }

  try {
    // --- Month-End Reminder ---
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
    results.monthEndReminder = `success — notified ${owners.length} owners`;
  } catch (err) {
    console.error('Month-end reminder failed:', err);
    results.monthEndReminder = `error: ${err.message}`;
  }

  res.json({ ok: true, ran: 'monthly', results });
}
