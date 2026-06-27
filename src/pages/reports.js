// ============================================
// Reports Page v2.0 — API-based, 12 reports
// ============================================

import { reports as reportsApi, branches as branchesApi } from '../services/api.js';
import { formatCurrency, getState, getCategoryInfo, categories, todayStr } from '../data/store.js';
import { createLineChart, createDonutChart, createBarChart } from '../components/charts.js';
import { showToast } from '../components/toast.js';

const REPORT_TABS = [
  { id: 'pnl', icon: '📊', label: 'P&L Summary' },
  { id: 'gst', icon: '🧾', label: 'GST Report' },
  { id: 'cashflow', icon: '💰', label: 'Cash Flow' },
  { id: 'vendor', icon: '🏭', label: 'Vendor Payments' },
  { id: 'shift', icon: '🕐', label: 'Shift Cost' },
  { id: 'recipe', icon: '👨‍🍳', label: 'Recipe Cost' },
  { id: 'staff', icon: '👥', label: 'Staff Cost' },
  { id: 'wastage', icon: '🗑️', label: 'Wastage' },
  { id: 'utility', icon: '⚡', label: 'Utility' },
  { id: 'budget', icon: '📈', label: 'Budget vs Actual' },
  { id: 'anomaly', icon: '🚨', label: 'Anomaly Report' },
  { id: 'yearend', icon: '📅', label: 'Year-End' },
];

let activeTab = 'pnl';

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <!-- Report Tabs -->
      <div class="report-tabs-scroll" id="report-tabs" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">
        ${REPORT_TABS.map(t => `
          <button class="btn btn-sm report-tab ${t.id === activeTab ? 'btn-primary' : ''}" data-tab="${t.id}">
            ${t.icon} ${t.label}
          </button>
        `).join('')}
      </div>

      <!-- Date Range -->
      <div class="filters-bar report-date-filters mb-3">
        <div class="filter-group">
          <label class="filter-label">From:</label>
          <input type="date" class="filter-select" id="report-date-from" value="${getState().dateRange.start}">
        </div>
        <div class="filter-group">
          <label class="filter-label">To:</label>
          <input type="date" class="filter-select" id="report-date-to" value="${getState().dateRange.end}">
        </div>
        <button class="btn btn-sm btn-primary" id="report-refresh">🔄 Refresh</button>
      </div>

      <!-- Report Content -->
      <div class="glass-card" id="report-content">
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </div>
    </div>
  `;
}

export async function init() {
  // Tab clicks
  document.getElementById('report-tabs')?.querySelectorAll('.report-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('.report-tab').forEach(b => b.classList.remove('btn-primary'));
      btn.classList.add('btn-primary');
      loadReport();
    });
  });

  document.getElementById('report-refresh')?.addEventListener('click', loadReport);

  await loadReport();
}

async function loadReport() {
  const content = document.getElementById('report-content');
  content.innerHTML = '<div class="skeleton-row"></div><div class="skeleton-row"></div>';

  const params = {
    date_from: document.getElementById('report-date-from')?.value || getState().dateRange.start,
    date_to: document.getElementById('report-date-to')?.value || getState().dateRange.end,
  };
  const state = getState();
  if (state.selectedBranch && state.selectedBranch !== 'all') params.branch_id = state.selectedBranch;

  try {
    switch (activeTab) {
      case 'pnl': await renderPnl(content, params); break;
      case 'gst': await renderGst(content, params); break;
      case 'cashflow': await renderCashflow(content, params); break;
      case 'vendor': await renderVendorPayments(content, params); break;
      case 'shift': await renderShiftCost(content, params); break;
      case 'recipe': await renderRecipeCost(content); break;
      case 'staff': await renderStaffCost(content, params); break;
      case 'wastage': await renderWastage(content, params); break;
      case 'utility': await renderUtility(content, params); break;
      case 'budget': await renderBudgetActual(content, params); break;
      case 'anomaly': await renderAnomalyReport(content, params); break;
      case 'yearend': await renderYearEnd(content, params); break;
      default: content.innerHTML = '<p>Select a report tab</p>';
    }
  } catch (err) {
    content.innerHTML = `<div class="empty-state-small">Failed to load report: ${err.message}</div>`;
  }
}

async function renderPnl(el, params) {
  const data = await reportsApi.pnl(params);
  const cats = data.categories || [];
  el.innerHTML = `
    <h3 class="section-title">📊 P&L Summary</h3>
    <div class="table-container">
      <table class="data-table">
        <thead><tr><th>Category</th><th class="text-right">Current Period</th><th class="text-right">Bill Count</th></tr></thead>
        <tbody>
          ${cats.map(c => {
            const info = getCategoryInfo(c.category);
            return `<tr><td>${info.icon} ${info.label}</td><td class="text-right">${formatCurrency(c.total)}</td><td class="text-right">${c.count}</td></tr>`;
          }).join('')}
          <tr style="font-weight:800;border-top:2px solid var(--border-glass)"><td>Grand Total</td><td class="text-right">${formatCurrency(data.grand_total || 0)}</td><td class="text-right">${data.total_bills || 0}</td></tr>
        </tbody>
      </table>
    </div>
  `;
}

async function renderGst(el, params) {
  const data = await reportsApi.gst(params);
  const bills = data.bills || [];
  el.innerHTML = `
    <h3 class="section-title">🧾 GST Report</h3>
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Total CGST</div><div class="stat-value">${formatCurrency(data.total_cgst || 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Total SGST</div><div class="stat-value">${formatCurrency(data.total_sgst || 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Total GST</div><div class="stat-value">${formatCurrency((data.total_cgst || 0) + (data.total_sgst || 0))}</div></div>
    </div>
    <div class="table-container">
      <table class="data-table" style="font-size:12px">
        <thead><tr><th>Vendor</th><th>GSTIN</th><th>HSN</th><th class="text-right">Taxable</th><th class="text-right">CGST</th><th class="text-right">SGST</th><th class="text-right">Total</th></tr></thead>
        <tbody>${bills.slice(0, 50).map(b => `<tr><td>${b.vendor_name || '—'}</td><td>${b.vendor_gstin || '—'}</td><td>${b.hsn_code || '—'}</td><td class="text-right">${formatCurrency(b.subtotal)}</td><td class="text-right">${formatCurrency(b.cgst)}</td><td class="text-right">${formatCurrency(b.sgst)}</td><td class="text-right">${formatCurrency(b.total_amount)}</td></tr>`).join('')}</tbody>
      </table>
    </div>
  `;
}

async function renderCashflow(el, params) {
  const data = await reportsApi.cashflow(params);
  const modes = data.by_payment_mode || {};
  el.innerHTML = `
    <h3 class="section-title">💰 Cash Flow</h3>
    <div class="chart-container" style="height:250px;margin-bottom:16px"><canvas id="chart-cashflow"></canvas></div>
    <div class="table-container">
      <table class="data-table"><thead><tr><th>Payment Mode</th><th class="text-right">Amount</th><th class="text-right">Count</th></tr></thead>
      <tbody>${Object.entries(modes).map(([mode, info]) => `<tr><td>${mode}</td><td class="text-right">${formatCurrency(info.total || 0)}</td><td class="text-right">${info.count || 0}</td></tr>`).join('')}</tbody></table>
    </div>
  `;
  const mLabels = Object.keys(modes);
  const mData = mLabels.map(k => Math.round(modes[k].total || 0));
  if (mLabels.length > 0) createDonutChart('chart-cashflow', { labels: mLabels, data: mData });
}

async function renderVendorPayments(el, params) {
  const data = await reportsApi.vendorPayments(params);
  const vendors = data.vendors || [];
  el.innerHTML = `
    <h3 class="section-title">🏭 Vendor Payments</h3>
    <div class="table-container"><table class="data-table"><thead><tr><th>Vendor</th><th class="text-right">Total Spend</th><th class="text-right">Bills</th><th class="text-right">Avg Bill</th><th>Payment Pref</th></tr></thead>
    <tbody>${vendors.sort((a, b) => (b.total || 0) - (a.total || 0)).slice(0, 30).map(v => `<tr><td style="font-weight:600">${v.vendor_name}</td><td class="text-right">${formatCurrency(v.total)}</td><td class="text-right">${v.count}</td><td class="text-right">${formatCurrency(v.avg || 0)}</td><td>${v.primary_payment || '—'}</td></tr>`).join('')}</tbody></table></div>
  `;
}

async function renderShiftCost(el, params) {
  const data = await reportsApi.shiftCost(params);
  const shifts = data.shifts || {};
  el.innerHTML = `
    <h3 class="section-title">🕐 Shift Cost Report</h3>
    <div class="stats-grid" style="margin-bottom:16px">
      ${Object.entries(shifts).map(([name, info]) => `
        <div class="stat-card"><div class="stat-label">${name}</div><div class="stat-value">${formatCurrency(info.total || 0)}</div><div class="stat-change">${info.count || 0} bills</div></div>
      `).join('')}
    </div>
    <div class="chart-container" style="height:250px"><canvas id="chart-shift"></canvas></div>
  `;
  const sLabels = Object.keys(shifts);
  const sData = sLabels.map(k => Math.round(shifts[k].total || 0));
  if (sLabels.length > 0) createBarChart('chart-shift', { labels: sLabels, datasets: [{ label: 'Shift Cost', data: sData }] });
}

async function renderRecipeCost(el) {
  const data = await reportsApi.recipeCost();
  const recipes = data.recipes || [];
  el.innerHTML = `
    <h3 class="section-title">👨‍🍳 Recipe Cost Report</h3>
    <div class="table-container"><table class="data-table"><thead><tr><th>Recipe</th><th class="text-right">Selling Price</th><th class="text-right">Ingredient Cost</th><th class="text-right">Margin</th><th>Status</th></tr></thead>
    <tbody>${recipes.map(r => {
      const margin = r.selling_price > 0 ? Math.round(((r.selling_price - r.ingredient_cost) / r.selling_price) * 100) : 0;
      const ok = margin >= (r.target_margin || 60);
      return `<tr><td style="font-weight:600">${r.name}</td><td class="text-right">${formatCurrency(r.selling_price)}</td><td class="text-right">${formatCurrency(r.ingredient_cost)}</td><td class="text-right">${margin}%</td><td><span class="badge ${ok ? 'badge-success' : 'badge-danger'}">${ok ? 'Healthy' : 'Low Margin'}</span></td></tr>`;
    }).join('')}</tbody></table></div>
  `;
}

async function renderStaffCost(el, params) {
  const data = await reportsApi.staffCost(params);
  const staff = data.staff || [];
  el.innerHTML = `
    <h3 class="section-title">👥 Staff Cost Report</h3>
    <div class="stat-card" style="margin-bottom:16px"><div class="stat-label">Total Wage Bill</div><div class="stat-value">${formatCurrency(data.total_wage || 0)}</div></div>
    <div class="table-container"><table class="data-table"><thead><tr><th>Name</th><th>Role</th><th>Days Present</th><th class="text-right">Daily Rate</th><th class="text-right">Calculated Pay</th></tr></thead>
    <tbody>${staff.map(s => `<tr><td style="font-weight:600">${s.name}</td><td>${s.role || '—'}</td><td>${s.days_present || 0}</td><td class="text-right">${formatCurrency(s.daily_rate || 0)}</td><td class="text-right">${formatCurrency(s.calculated_pay || 0)}</td></tr>`).join('')}</tbody></table></div>
  `;
}

async function renderWastage(el, params) {
  const data = await reportsApi.wastage(params);
  const items = data.items || [];
  el.innerHTML = `
    <h3 class="section-title">🗑️ Wastage Report</h3>
    <div class="stat-card" style="margin-bottom:16px"><div class="stat-label">Total Wastage Value</div><div class="stat-value" style="color:var(--accent-red)">${formatCurrency(data.total_value || 0)}</div></div>
    <div class="table-container"><table class="data-table"><thead><tr><th>Item</th><th>Qty</th><th>Reason</th><th class="text-right">Est. Value</th><th>Date</th></tr></thead>
    <tbody>${items.map(i => `<tr><td>${i.item_name}</td><td>${i.qty} ${i.unit || ''}</td><td>${i.reason || '—'}</td><td class="text-right">${formatCurrency(i.estimated_value || 0)}</td><td>${i.logged_at ? new Date(i.logged_at).toLocaleDateString('en-IN') : '—'}</td></tr>`).join('')}</tbody></table></div>
  `;
}

async function renderUtility(el, params) {
  const data = await reportsApi.utility(params);
  el.innerHTML = `
    <h3 class="section-title">⚡ Utility Consumption</h3>
    <div class="stats-grid">
      <div class="stat-card"><div class="stat-label">Gas / LPG</div><div class="stat-value">${formatCurrency(data.gas_total || 0)}</div><div class="stat-change">${data.gas_count || 0} bills</div></div>
      <div class="stat-card"><div class="stat-label">Electricity</div><div class="stat-value">${formatCurrency(data.electricity_total || 0)}</div><div class="stat-change">${data.electricity_count || 0} bills</div></div>
      <div class="stat-card"><div class="stat-label">Water</div><div class="stat-value">${formatCurrency(data.water_total || 0)}</div><div class="stat-change">${data.water_count || 0} bills</div></div>
    </div>
  `;
}

async function renderBudgetActual(el, params) {
  const data = await reportsApi.budgetActual(params);
  const branches = data.branches || [];
  el.innerHTML = `
    <h3 class="section-title">📈 Budget vs Actual</h3>
    <div class="table-container"><table class="data-table"><thead><tr><th>Branch</th><th class="text-right">Budget</th><th class="text-right">Actual</th><th class="text-right">Variance</th><th>Status</th></tr></thead>
    <tbody>${branches.map(b => {
      const variance = (b.actual || 0) - (b.budget || 0);
      const pct = b.budget > 0 ? Math.round(((b.actual || 0) / b.budget) * 100) : 0;
      return `<tr><td style="font-weight:600">${b.branch_name}</td><td class="text-right">${formatCurrency(b.budget || 0)}</td><td class="text-right">${formatCurrency(b.actual || 0)}</td><td class="text-right" style="color:${variance > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}">${variance > 0 ? '+' : ''}${formatCurrency(variance)}</td><td><span class="badge ${pct > 100 ? 'badge-danger' : pct > 80 ? 'badge-warning' : 'badge-success'}">${pct}%</span></td></tr>`;
    }).join('')}</tbody></table></div>
  `;
}

async function renderAnomalyReport(el, params) {
  const data = await reportsApi.anomalies(params);
  const anomalies = data.anomalies || [];
  el.innerHTML = `
    <h3 class="section-title">🚨 Anomaly & Fraud Report</h3>
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Total Anomalies</div><div class="stat-value">${data.total || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Resolved</div><div class="stat-value">${data.resolved || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value" style="color:var(--accent-red)">${data.pending || 0}</div></div>
    </div>
    ${anomalies.length > 0 ? `<div class="table-container"><table class="data-table"><thead><tr><th>Type</th><th>Vendor</th><th class="text-right">Amount</th><th>Description</th></tr></thead>
    <tbody>${anomalies.slice(0, 30).map(a => `<tr><td><span class="badge badge-danger">${a.type}</span></td><td>${a.vendor_name || '—'}</td><td class="text-right">${formatCurrency(a.amount || 0)}</td><td style="font-size:12px;color:var(--text-muted)">${a.description || '—'}</td></tr>`).join('')}</tbody></table></div>` : '<p style="color:var(--text-muted)">No anomalies detected</p>'}
  `;
}

async function renderYearEnd(el, params) {
  const data = await reportsApi.yearEnd(params);
  const months = data.monthly || [];
  el.innerHTML = `
    <h3 class="section-title">📅 Year-End Summary</h3>
    <div class="stats-grid" style="margin-bottom:16px">
      <div class="stat-card"><div class="stat-label">Annual Total</div><div class="stat-value">${formatCurrency(data.annual_total || 0)}</div></div>
      <div class="stat-card"><div class="stat-label">Total Bills</div><div class="stat-value">${data.total_bills || 0}</div></div>
      <div class="stat-card"><div class="stat-label">Total GST</div><div class="stat-value">${formatCurrency(data.total_gst || 0)}</div></div>
    </div>
    <div class="chart-container" style="height:250px;margin-bottom:16px"><canvas id="chart-yearend"></canvas></div>
    ${months.length > 0 ? `<div class="table-container"><table class="data-table"><thead><tr><th>Month</th><th class="text-right">Spend</th><th class="text-right">Bills</th></tr></thead>
    <tbody>${months.map(m => `<tr><td>${m.month}</td><td class="text-right">${formatCurrency(m.total || 0)}</td><td class="text-right">${m.count || 0}</td></tr>`).join('')}</tbody></table></div>` : ''}
  `;
  if (months.length > 0) {
    createBarChart('chart-yearend', { labels: months.map(m => m.month), datasets: [{ label: 'Monthly Spend', data: months.map(m => Math.round(m.total || 0)) }] });
  }
}

export function cleanup() { activeTab = 'pnl'; }
