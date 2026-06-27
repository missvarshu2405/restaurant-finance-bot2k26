// ============================================
// Budgets Page v2.0 — API-based
// ============================================

import { branches as branchesApi, bills as billsApi } from '../services/api.js';
import { formatCurrency, getState } from '../data/store.js';
import { showToast } from '../components/toast.js';

let _branches = [];
let _bills = [];

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <div id="budgets-grid" class="stats-grid">
        <div class="skeleton-row"></div>
      </div>
    </div>
  `;
}

export async function init() {
  try {
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const todayStr = today.toISOString().split('T')[0];

    const [branchesList, allBills] = await Promise.all([
      branchesApi.list(),
      billsApi.list({ date_from: monthStart, date_to: todayStr }),
    ]);

    _branches = branchesList;
    _bills = allBills;
    renderBudgets();
  } catch (err) {
    document.getElementById('budgets-grid').innerHTML = `<div class="empty-state-small">Failed: ${err.message}</div>`;
  }
}

function renderBudgets() {
  const grid = document.getElementById('budgets-grid');
  const todayStr = new Date().toISOString().split('T')[0];
  const activeBranches = _branches.filter(b => b.is_active !== false);

  if (activeBranches.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">💰</div><h3>No branches</h3><p>Create branches first to set budgets.</p></div>`;
    return;
  }

  grid.innerHTML = activeBranches.map(branch => {
    const branchBills = _bills.filter(b => b.branch_id === branch.id);
    const todayBills = branchBills.filter(b => (b.bill_date || '').startsWith(todayStr));
    const monthBills = branchBills;

    const todaySpend = todayBills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const monthSpend = monthBills.reduce((s, b) => s + (b.total_amount || 0), 0);

    const dailyBudget = branch.daily_budget || 0;
    const monthlyBudget = branch.monthly_budget || 0;

    const dailyPct = dailyBudget > 0 ? Math.min(Math.round((todaySpend / dailyBudget) * 100), 150) : 0;
    const monthlyPct = monthlyBudget > 0 ? Math.min(Math.round((monthSpend / monthlyBudget) * 100), 150) : 0;

    const dailyColor = dailyPct >= 100 ? '#ef4444' : dailyPct >= 80 ? '#f59e0b' : '#10b981';
    const monthlyColor = monthlyPct >= 100 ? '#ef4444' : monthlyPct >= 80 ? '#f59e0b' : '#10b981';

    return `
      <div class="stat-card">
        <div style="font-size:16px;font-weight:700;margin-bottom:16px">${branch.branch_name}</div>

        <div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px">
            <span>Daily Budget</span>
            <span style="color:${dailyColor}">${dailyPct}%</span>
          </div>
          <div class="budget-bar-container">
            <div class="budget-bar" style="width:${Math.min(dailyPct, 100)}%;background:${dailyColor}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-top:4px">
            <span>${formatCurrency(todaySpend)}</span>
            <span style="color:var(--text-muted)">${dailyBudget > 0 ? formatCurrency(dailyBudget) : 'Not set'}</span>
          </div>
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px">
            <span>Monthly Budget</span>
            <span style="color:${monthlyColor}">${monthlyPct}%</span>
          </div>
          <div class="budget-bar-container">
            <div class="budget-bar" style="width:${Math.min(monthlyPct, 100)}%;background:${monthlyColor}"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:13px;font-weight:600;margin-top:4px">
            <span>${formatCurrency(monthSpend)}</span>
            <span style="color:var(--text-muted)">${monthlyBudget > 0 ? formatCurrency(monthlyBudget) : 'Not set'}</span>
          </div>
        </div>

        <div style="margin-top:12px;font-size:11px;color:var(--text-muted)">${todayBills.length} bills today · ${monthBills.length} this month</div>
      </div>
    `;
  }).join('');
}

export function cleanup() { _branches = []; _bills = []; }
