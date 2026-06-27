// ============================================
// My Summary / Branch Summary v2.0 — API-based
// ============================================

import { bills as billsApi, branches as branchesApi } from '../services/api.js';
import { formatCurrency, todayStr, getCategoryInfo } from '../data/store.js';
import { createDonutChart, createBarChart } from '../components/charts.js';

export function render(container) {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  const userName = session.userName || session.name || 'Manager';
  const branchName = session.branchName || 'Branch';
  const initials = userName.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

  container.innerHTML = `
    <div class="fade-up">
      <!-- Profile Card -->
      <div class="glass-card mb-3" style="display:flex;align-items:center;justify-content:space-between;gap:16px">
        <div style="display:flex;align-items:center;gap:14px">
          <div style="width:48px;height:48px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:18px;color:white;flex-shrink:0">${initials}</div>
          <div>
            <div style="font-weight:600;font-size:15px;color:var(--text-primary)">${userName}</div>
            <div style="font-size:12px;color:var(--text-muted)">Manager · ${branchName}</div>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" id="me-logout-btn" style="flex-shrink:0">🚪 Logout</button>
      </div>

      <div class="stats-grid" id="summary-stats">
        <div class="stat-card emerald"><div class="stat-card-header"><div class="stat-icon emerald">💰</div><span class="stat-label">Today</span></div><div class="stat-value" id="sum-today"><span class="skeleton-text"></span></div></div>
        <div class="stat-card blue"><div class="stat-card-header"><div class="stat-icon blue">📅</div><span class="stat-label">This Week</span></div><div class="stat-value" id="sum-week"><span class="skeleton-text"></span></div></div>
        <div class="stat-card purple"><div class="stat-card-header"><div class="stat-icon purple">📊</div><span class="stat-label">This Month</span></div><div class="stat-value" id="sum-month"><span class="skeleton-text"></span></div></div>
      </div>

      <div class="grid-2 mb-3">
        <div class="chart-card"><div class="chart-card-title">Category Breakdown</div><div class="chart-container" style="height:250px"><canvas id="chart-my-category"></canvas></div></div>
        <div class="chart-card"><div class="chart-card-title">Daily Spend (7 days)</div><div class="chart-container" style="height:250px"><canvas id="chart-my-daily"></canvas></div></div>
      </div>
    </div>
  `;
}

export async function init() {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  try {
    const today = new Date();
    const weekAgo = new Date(today); weekAgo.setDate(weekAgo.getDate() - 6);
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const bills = await billsApi.list({
      branch_id: session.branchId,
    });

    const todayStr2 = todayStr();
    const todayBills = bills.filter(b => {
      const billDateMatch = (b.bill_date || '').startsWith(todayStr2);
      const uploadedToday = (b.uploaded_at || '').startsWith(todayStr2);
      return billDateMatch || uploadedToday;
    });
    const weekBills = bills.filter(b => {
      const bDate = new Date(b.bill_date);
      const uDate = new Date(b.uploaded_at);
      return bDate >= weekAgo || uDate >= weekAgo;
    });
    const monthBills = bills.filter(b => {
      const bDate = new Date(b.bill_date);
      const uDate = new Date(b.uploaded_at);
      return bDate >= monthStart || uDate >= monthStart;
    });

    document.getElementById('sum-today').textContent = formatCurrency(todayBills.reduce((s, b) => s + (b.total_amount || 0), 0));
    document.getElementById('sum-week').textContent = formatCurrency(weekBills.reduce((s, b) => s + (b.total_amount || 0), 0));
    document.getElementById('sum-month').textContent = formatCurrency(monthBills.reduce((s, b) => s + (b.total_amount || 0), 0));

    // Category donut
    const catMap = {};
    bills.forEach(b => { const c = b.category || 'misc'; catMap[c] = (catMap[c] || 0) + (b.total_amount || 0); });
    const catLabels = []; const catData = [];
    Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]).slice(0, 8).forEach(k => {
      const info = getCategoryInfo(k);
      catLabels.push(info.icon + ' ' + info.label);
      catData.push(Math.round(catMap[k]));
    });
    if (catLabels.length > 0) createDonutChart('chart-my-category', { labels: catLabels, data: catData });

    // Daily bar (last 7 days)
    const dailyLabels = []; const dailyData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      dailyLabels.push(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
      dailyData.push(Math.round(bills.filter(b => (b.bill_date || '').startsWith(ds) || (b.uploaded_at || '').startsWith(ds)).reduce((s, b) => s + (b.total_amount || 0), 0)));
    }
    createBarChart('chart-my-daily', { labels: dailyLabels, datasets: [{ label: 'Daily Spend', data: dailyData }] });
  } catch (err) {
    console.error('Summary failed:', err);
  }

  // Logout handler
  document.getElementById('me-logout-btn')?.addEventListener('click', () => {
    if (confirm('Are you sure you want to logout?')) {
      localStorage.removeItem('rl_token');
      localStorage.removeItem('rl_session');
      window.location.hash = '';
      window.location.reload();
    }
  });
}

export function cleanup() {}
