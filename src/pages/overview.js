// ============================================
// Overview / Dashboard Page v2.1
// Owner dashboard — API-based data
// FIX: closed stats-grid div, owner data now shows
// ============================================

import { bills as billsApi, branches as branchesApi } from '../services/api.js';
import { formatCurrency, formatDate, getState, getCategoryInfo, categories } from '../data/store.js';
import { createLineChart, createDonutChart, createBarChart } from '../components/charts.js';
let _bills = [];
let _branches = [];

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <!-- Stats Grid -->
      <div class="stats-grid" id="stats-grid">
        <div class="stat-card emerald stagger-1 fade-up">
          <div class="stat-card-header"><div class="stat-icon emerald">💰</div><span class="stat-label">Today's Expenses</span></div>
          <div class="stat-value" id="stat-today-total"><span class="skeleton-text"></span></div>
          <span class="stat-change positive" id="stat-today-count">loading...</span>
        </div>
        <div class="stat-card blue stagger-2 fade-up">
          <div class="stat-card-header"><div class="stat-icon blue">📅</div><span class="stat-label">This Month</span></div>
          <div class="stat-value" id="stat-month-total"><span class="skeleton-text"></span></div>
          <span class="stat-change positive" id="stat-month-count">loading...</span>
        </div>
        <div class="stat-card amber stagger-3 fade-up">
          <div class="stat-card-header"><div class="stat-icon amber">📤</div><span class="stat-label">Bills Today</span></div>
          <div class="stat-value" id="stat-today-bills"><span class="skeleton-text"></span></div>
          <span class="stat-change" id="stat-today-label">loading...</span>
        </div>
        <div class="stat-card purple stagger-4 fade-up">
          <div class="stat-card-header"><div class="stat-icon purple">🔍</div><span class="stat-label">Pending Review</span></div>
          <div class="stat-value" id="stat-pending"><span class="skeleton-text"></span></div>
          <span class="stat-change" id="stat-pending-amount">loading...</span>
        </div>
        <div class="stat-card red stagger-5 fade-up">
          <div class="stat-card-header"><div class="stat-icon red">🚩</div><span class="stat-label">Flagged Items</span></div>
          <div class="stat-value" id="stat-flagged"><span class="skeleton-text"></span></div>
          <span class="stat-change" id="stat-flagged-amount">loading...</span>
        </div>
        <div class="stat-card amber stagger-6 fade-up">
          <div class="stat-card-header"><div class="stat-icon amber">📷</div><span class="stat-label">Unscanned Bills</span></div>
          <div class="stat-value" id="stat-failed-scan"><span class="skeleton-text"></span></div>
          <span class="stat-change" id="stat-failed-scan-label">loading...</span>
        </div>
      </div><!-- /.stats-grid  ← THIS WAS MISSING -->

      <!-- Charts Row -->
      <div class="grid-2-1 mb-3">
        <div class="chart-card">
          <div class="chart-card-title">Daily Expense Trend</div>
          <div class="chart-card-subtitle">Expenses over selected date range</div>
          <div class="chart-container" style="height:280px">
            <canvas id="chart-daily-trend"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-title">Category Breakdown</div>
          <div class="chart-card-subtitle">Spending distribution by category</div>
          <div class="chart-container" style="height:280px">
            <canvas id="chart-category"></canvas>
          </div>
        </div>
      </div>

      <!-- Branch Comparison -->
      <div class="chart-card mb-3" id="branch-chart-container" style="display:none">
        <div class="chart-card-title">Branch Comparison</div>
        <div class="chart-card-subtitle">Total expenses by branch for selected period</div>
        <div class="chart-container" style="height:250px">
          <canvas id="chart-branch-compare"></canvas>
        </div>
      </div>

      <!-- Recent Bills -->
      <div class="glass-card">
        <div class="section-title">📋 Recent Bills</div>
        <div id="recent-bills-container">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const state = getState();
  const selectedBranch = state.selectedBranch;

  try {
    // Fetch bills and branches in parallel
    const params = {};
    if (selectedBranch && selectedBranch !== 'all') params.branch_id = selectedBranch;
    if (state.dateRange.start) params.date_from = state.dateRange.start;
    if (state.dateRange.end) params.date_to = state.dateRange.end;

    const [allBills, branchesList] = await Promise.all([
      billsApi.list(params),
      branchesApi.list(),
    ]);

    _bills = allBills;
    _branches = branchesList;

    // Fetch failed-scan count separately — count only, never bill details
    billsApi.failedScanCount()
      .then(({ count }) => {
        const el = document.getElementById('stat-failed-scan');
        if (el) el.textContent = count;
        const label = document.getElementById('stat-failed-scan-label');
        if (label) {
          label.textContent = count > 0 ? 'needs manager attention' : 'all scanned ✅';
          label.className = `stat-change ${count > 0 ? 'negative' : 'positive'}`;
        }
      })
      .catch(() => {
        const el = document.getElementById('stat-failed-scan');
        if (el) el.textContent = '—';
      });

    // Calculate stats
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().split('T')[0];

    const todayBills = allBills.filter(b => {
      const billDateMatch = (b.bill_date || '').startsWith(today);
      const uploadedToday = (b.uploaded_at || '').startsWith(today);
      return billDateMatch || uploadedToday;
    });
    const monthBills = allBills.filter(b => {
      const bDate = (b.bill_date || '');
      const uDate = (b.uploaded_at || '').split('T')[0];
      return bDate >= monthStartStr || uDate >= monthStartStr;
    });
    const pendingBills = allBills.filter(b => b.status === 'pending');
    const flaggedBills = allBills.filter(b => b.status === 'flagged');

    const todayTotal = todayBills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const monthTotal = monthBills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const pendingTotal = pendingBills.reduce((s, b) => s + (b.total_amount || 0), 0);
    const flaggedTotal = flaggedBills.reduce((s, b) => s + (b.total_amount || 0), 0);

    // Update stat cards — guard every getElementById in case DOM wasn't ready
    const setEl = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    const setClass = (id, cls) => { const e = document.getElementById(id); if (e) e.className = cls; };

    setEl('stat-today-total', formatCurrency(todayTotal));
    setEl('stat-today-count', `📈 ${todayBills.length} bill${todayBills.length !== 1 ? 's' : ''}`);
    setEl('stat-month-total', formatCurrency(monthTotal));
    setEl('stat-month-count', `${monthBills.length} bill${monthBills.length !== 1 ? 's' : ''}`);
    setEl('stat-today-bills', todayBills.length);
    setEl('stat-today-label', 'uploaded today');
    setClass('stat-today-label', `stat-change ${todayBills.length > 0 ? 'positive' : 'negative'}`);
    setEl('stat-pending', pendingBills.length);
    setEl('stat-pending-amount', formatCurrency(pendingTotal));
    setClass('stat-pending-amount', `stat-change ${pendingBills.length > 10 ? 'negative' : 'positive'}`);
    setEl('stat-flagged', flaggedBills.length);
    const flaggedAmtEl = document.getElementById('stat-flagged-amount');
    if (flaggedAmtEl) {
      flaggedAmtEl.textContent = flaggedBills.length > 0 ? formatCurrency(flaggedTotal) : 'All clear ✅';
      flaggedAmtEl.className = `stat-change ${flaggedBills.length > 0 ? 'negative' : 'positive'}`;
    }

    // Charts
    if (allBills.length === 0) {
      const rb = document.getElementById('recent-bills-container');
      if (rb) rb.innerHTML = `
        <div style="text-align:center;padding:40px;color:var(--text-muted)">
          <div style="font-size:48px;margin-bottom:12px">📊</div>
          <h3 style="font-size:18px;margin-bottom:8px">No expense data yet</h3>
          <p>Create branches and add managers to start tracking expenses.</p>
        </div>
      `;
      return;
    }

    // Daily trend chart
    const dateGroups = {};
    allBills.forEach(b => {
      const d = b.bill_date || '';
      if (!dateGroups[d]) dateGroups[d] = 0;
      dateGroups[d] += b.total_amount || 0;
    });
    const trendLabels = [];
    const trendData = [];
    const startD = new Date(state.dateRange.start);
    const endD = new Date(state.dateRange.end);
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const ds = d.toISOString().split('T')[0];
      trendLabels.push(d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }));
      trendData.push(Math.round(dateGroups[ds] || 0));
    }
    if (document.getElementById('chart-daily-trend')) {
      createLineChart('chart-daily-trend', {
        labels: trendLabels,
        datasets: [{ label: 'Daily Expenses', data: trendData, fill: true }],
      });
    }

    // Category donut
    const catMap = {};
    allBills.forEach(b => {
      const cat = b.category || 'miscellaneous';
      if (!catMap[cat]) catMap[cat] = 0;
      catMap[cat] += b.total_amount || 0;
    });
    const catLabels = [];
    const catData = [];
    Object.keys(catMap).sort((a, b) => catMap[b] - catMap[a]).slice(0, 10).forEach(key => {
      const info = getCategoryInfo(key);
      catLabels.push(info.icon + ' ' + info.label);
      catData.push(Math.round(catMap[key]));
    });
    if (catLabels.length > 0 && document.getElementById('chart-category')) {
      createDonutChart('chart-category', { labels: catLabels, data: catData });
    }

    // Branch comparison
    if (_branches.length > 1) {
      const branchMap = {};
      allBills.forEach(b => {
        const bid = b.branch_id;
        if (!branchMap[bid]) branchMap[bid] = 0;
        branchMap[bid] += b.total_amount || 0;
      });
      const brLabels = [];
      const brData = [];
      _branches.filter(br => br.is_active !== false).forEach(br => {
        if (selectedBranch !== 'all' && br.id !== selectedBranch) return;
        brLabels.push(br.branch_name?.split(' ').map(w => w[0]).join('') || br.branch_code || 'Branch');
        brData.push(Math.round(branchMap[br.id] || 0));
      });
      if (brLabels.length > 0 && document.getElementById('chart-branch-compare')) {
        const bc = document.getElementById('branch-chart-container');
        if (bc) bc.style.display = 'block';
        createBarChart('chart-branch-compare', {
          labels: brLabels,
          datasets: [{ label: 'Total Expenses', data: brData }],
        });
      }
    }

    // Recent bills table
    const recentBills = [...allBills]
      .sort((a, b) => new Date(b.uploaded_at || b.bill_date) - new Date(a.uploaded_at || a.bill_date))
      .slice(0, 10);
    const branchNameMap = {};
    _branches.forEach(br => { branchNameMap[br.id] = br.branch_code || br.branch_name?.slice(0, 8) || '—'; });

    const rb = document.getElementById('recent-bills-container');
    if (rb) {
      rb.innerHTML = recentBills.length > 0 ? `
        <div class="table-container">
          <table class="data-table">
            <thead><tr>
              <th>Date</th><th>Branch</th><th>Vendor</th><th>Category</th><th class="text-right">Amount</th><th>Status</th>
            </tr></thead>
            <tbody>
              ${recentBills.map(bill => {
        const cat = getCategoryInfo(bill.category);
        const statusClass = bill.status === 'verified' ? 'badge-success' : bill.status === 'flagged' ? 'badge-danger' : 'badge-pending';
        return `<tr>
                  <td>${formatDate(bill.bill_date)}</td>
                  <td>${branchNameMap[bill.branch_id] || '—'}</td>
                  <td>${bill.vendor_name || '—'}</td>
                  <td>${cat.icon} ${cat.label}</td>
                  <td class="text-right" style="font-weight:600">${formatCurrency(bill.total_amount)}</td>
                  <td><span class="badge ${statusClass}">${bill.status || 'pending'}</span></td>
                </tr>`;
      }).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div style="text-align:center;padding:24px;color:var(--text-muted)">No bills in the selected date range.</div>';
    }

  } catch (err) {
    console.error('Dashboard load failed:', err);
    const rb = document.getElementById('recent-bills-container');
    if (rb) rb.innerHTML = `<div class="empty-state-small">Failed to load: ${err.message}</div>`;
  }
}

export function cleanup() {
  _bills = [];
  _branches = [];
}