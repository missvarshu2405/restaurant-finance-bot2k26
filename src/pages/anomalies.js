// ============================================
// Anomalies / Flagged Page v2.0 — API-based
// ============================================

import { bills as billsApi, branches as branchesApi } from '../services/api.js';
import { formatCurrency, formatDate, getState, getCategoryInfo } from '../data/store.js';
import { showToast } from '../components/toast.js';

let _flaggedBills = [];
let _branches = [];

const anomalyTypeLabels = {
  duplicate: '🔄 Duplicate Bill',
  round_number: '🔢 Round Number',
  unusual_amount: '📊 Unusual Amount',
  off_hours: '🌙 Off-Hours',
  missing_image: '📷 Missing Image',
  frequency_spike: '📈 Frequency Spike',
  new_vendor_high: '🆕 New Vendor High',
  category_mismatch: '🏷️ Category Mismatch',
  budget_overshoot: '💰 Budget Overshoot',
};

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <div class="filters-bar">
        <div class="filter-group">
          <label class="filter-label">Type:</label>
          <select class="filter-select" id="anomaly-type-filter">
            <option value="all">All Types</option>
            ${Object.entries(anomalyTypeLabels).map(([key, label]) => `<option value="${key}">${label}</option>`).join('')}
          </select>
        </div>
        <span class="badge badge-danger" id="anomaly-count">Loading...</span>
      </div>
      <div id="anomalies-list">
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </div>
    </div>
  `;
}

export async function init() {
  const state = getState();
  try {
    const params = { status: 'flagged' };
    if (state.selectedBranch && state.selectedBranch !== 'all') params.branch_id = state.selectedBranch;
    if (state.dateRange?.start) params.date_from = state.dateRange.start;
    if (state.dateRange?.end) params.date_to = state.dateRange.end;

    const [allBills, branchesList] = await Promise.all([
      billsApi.list(params),
      branchesApi.list(),
    ]);

    _flaggedBills = allBills.filter(b => b.status === 'flagged');
    _branches = branchesList;

    renderAnomalies();
  } catch (err) {
    document.getElementById('anomalies-list').innerHTML = `<div class="empty-state-small">Failed to load: ${err.message}</div>`;
  }

  document.getElementById('anomaly-type-filter')?.addEventListener('change', () => renderAnomalies());
}

function renderAnomalies() {
  const typeFilter = document.getElementById('anomaly-type-filter')?.value || 'all';
  let filtered = [..._flaggedBills];

  if (typeFilter !== 'all') {
    filtered = filtered.filter(b => {
      const flags = b.flags || [];
      return flags.some(f => (f.type || '').includes(typeFilter));
    });
  }

  document.getElementById('anomaly-count').textContent = `${filtered.length} flagged`;

  const branchMap = {};
  _branches.forEach(br => { branchMap[br.id] = br.branch_code || br.branch_name?.slice(0, 12) || '—'; });

  const container = document.getElementById('anomalies-list');
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><h3>No flagged items</h3><p>All bills look clean!</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(bill => {
    const cat = getCategoryInfo(bill.category);
    const flags = bill.flags || [];
    const flagTags = flags.map(f => {
      const label = anomalyTypeLabels[f.type] || f.type;
      return `<span class="badge badge-danger" style="margin:2px">${label}</span>`;
    }).join('');

    return `
      <div class="glass-card mb-2 anomaly-card" data-bill-id="${bill.id}">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px">
          <div>
            <div style="font-weight:700;font-size:15px">${bill.vendor_name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${formatDate(bill.bill_date)} · ${branchMap[bill.branch_id] || '—'} · ${cat.icon} ${cat.label}</div>
            <div style="margin-top:6px">${flagTags}</div>
            ${flags.map(f => f.description ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px">💡 ${f.description}</div>` : '').join('')}
          </div>
          <div style="text-align:right">
            <div style="font-size:18px;font-weight:800">${formatCurrency(bill.total_amount)}</div>
            <div class="btn-group" style="margin-top:8px">
              <button class="btn btn-sm btn-success resolve-btn" data-id="${bill.id}">✅ Verify</button>
              <button class="btn btn-sm btn-danger dismiss-btn" data-id="${bill.id}">🗑️ Delete</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Verify actions
  container.querySelectorAll('.resolve-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await billsApi.verify(btn.dataset.id);
        _flaggedBills = _flaggedBills.filter(b => b.id !== btn.dataset.id);
        renderAnomalies();
        showToast('Bill verified ✅', 'success');
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
      }
    });
  });

  // Delete actions
  container.querySelectorAll('.dismiss-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this bill?')) return;
      try {
        await billsApi.delete(btn.dataset.id);
        _flaggedBills = _flaggedBills.filter(b => b.id !== btn.dataset.id);
        renderAnomalies();
        showToast('Bill deleted', 'info');
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
      }
    });
  });
}

export function cleanup() {
  _flaggedBills = [];
  _branches = [];
}
