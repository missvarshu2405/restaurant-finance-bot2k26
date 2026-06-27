// ============================================
// Audit Log Page v2.0 — API-based
// ============================================

import { formatDateTime } from '../data/store.js';

let _auditLog = [];

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <div class="glass-card">
        <div class="table-container">
          <table class="data-table">
            <thead><tr><th>Time</th><th>Actor</th><th>Action</th><th>Details</th></tr></thead>
            <tbody id="audit-tbody"><tr><td colspan="4"><div class="skeleton-row"></div></td></tr></tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  try {
    const response = await fetch('/api/bills', { headers: { 'Authorization': `Bearer ${localStorage.getItem('rl_token')}`, 'Content-Type': 'application/json' } });
    // Audit log is usually a separate endpoint — for now show recent activity from bills
    const bills = await response.json();
    const activities = bills.slice(0, 50).map(b => ({
      time: b.uploaded_at || b.created_at,
      actor: b.uploaderName || 'Manager',
      action: 'bill_submitted',
      details: `${b.vendor_name} — ${b.total_amount ? '₹' + Number(b.total_amount).toLocaleString('en-IN') : ''}`,
    }));
    _auditLog = activities;
    renderLog();
  } catch (err) {
    document.getElementById('audit-tbody').innerHTML = `<tr><td colspan="4" class="empty-state-small">Failed to load: ${err.message}</td></tr>`;
  }
}

function renderLog() {
  const tbody = document.getElementById('audit-tbody');
  if (_auditLog.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:24px;color:var(--text-muted)">No activity yet</td></tr>`;
    return;
  }

  const actionLabels = { bill_submitted: '📤 Bill Submitted', bill_verified: '✅ Bill Verified', bill_flagged: '🚩 Bill Flagged', settings_updated: '⚙️ Settings Updated', branch_created: '🏪 Branch Created', manager_created: '👤 Manager Created' };

  tbody.innerHTML = _auditLog.sort((a, b) => new Date(b.time) - new Date(a.time)).map(entry => `
    <tr>
      <td style="white-space:nowrap">${formatDateTime(entry.time)}</td>
      <td style="font-weight:600">${entry.actor}</td>
      <td>${actionLabels[entry.action] || entry.action}</td>
      <td style="color:var(--text-muted);max-width:300px;overflow:hidden;text-overflow:ellipsis">${entry.details || '—'}</td>
    </tr>
  `).join('');
}

export function cleanup() { _auditLog = []; }
