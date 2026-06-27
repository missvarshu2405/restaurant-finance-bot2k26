// ============================================
// Branches Page v2.0 — API-based
// ============================================

import { branches as branchesApi, bills as billsApi } from '../services/api.js';
import { formatCurrency, formatDate } from '../data/store.js';
import { showToast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';

let _branches = [];

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <div class="page-actions">
        <button class="btn btn-primary" id="add-branch-btn">+ Add Branch</button>
      </div>
      <div class="stats-grid" id="branches-grid">
        <div class="skeleton-row"></div>
      </div>
    </div>
  `;
}

export async function init() {
  try {
    _branches = await branchesApi.list();
    renderBranches();
  } catch (err) {
    document.getElementById('branches-grid').innerHTML = `<div class="empty-state-small">Failed to load: ${err.message}</div>`;
  }

  document.getElementById('add-branch-btn')?.addEventListener('click', () => showBranchForm());
}

function renderBranches() {
  const grid = document.getElementById('branches-grid');
  if (_branches.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏪</div><h3>No branches yet</h3><p>Add your first restaurant branch to get started.</p></div>`;
    return;
  }

  grid.innerHTML = _branches.map(b => {
    const isActive = b.is_active !== false;
    return `
      <div class="stat-card ${isActive ? 'blue' : ''}" style="cursor:pointer" data-branch-id="${b.id}">
        <div class="stat-card-header">
          <div class="stat-icon ${isActive ? 'blue' : ''}">${isActive ? '🏪' : '⏸️'}</div>
          <span class="stat-label">${b.branch_code || ''}</span>
        </div>
        <div style="font-size:18px;font-weight:700;margin-bottom:4px">${b.branch_name}</div>
        <div style="font-size:12px;color:var(--text-muted)">${b.address || b.city || '—'}</div>
        <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
          <span class="badge badge-info">Budget: ${formatCurrency(b.daily_budget || 0)}/day</span>
          <span class="badge ${isActive ? 'badge-success' : 'badge-muted'}">${isActive ? 'Active' : 'Inactive'}</span>
        </div>
        <div class="btn-group" style="margin-top:12px">
          <button class="btn btn-sm edit-branch" data-id="${b.id}">✏️ Edit</button>
          <button class="btn btn-sm btn-danger toggle-branch" data-id="${b.id}">${isActive ? '⏸️ Deactivate' : '▶️ Activate'}</button>
        </div>
      </div>
    `;
  }).join('');

  // Edit
  grid.querySelectorAll('.edit-branch').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const branch = _branches.find(b => b.id === btn.dataset.id);
      if (branch) showBranchForm(branch);
    });
  });

  // Toggle
  grid.querySelectorAll('.toggle-branch').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const branch = _branches.find(b => b.id === btn.dataset.id);
      if (!branch) return;
      try {
        await branchesApi.update(branch.id, { is_active: branch.is_active === false ? true : false });
        branch.is_active = branch.is_active === false ? true : false;
        renderBranches();
        showToast(`Branch ${branch.is_active ? 'activated' : 'deactivated'}`, 'success');
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
      }
    });
  });
}

function showBranchForm(branch = null) {
  const isEdit = !!branch;
  const content = `
    <div class="form-group"><label class="form-label">Branch Name *</label><input type="text" class="form-input" id="branch-name" value="${branch?.branch_name || ''}" placeholder="e.g. Indiranagar Branch" required></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Branch Code</label><input type="text" class="form-input" id="branch-code" value="${branch?.branch_code || ''}" placeholder="e.g. IND-101"></div>
      <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-input" id="branch-gstin" value="${branch?.gstin || ''}" placeholder="29AABCT1234D1ZM"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Address</label><input type="text" class="form-input" id="branch-address" value="${branch?.address || ''}"></div>
      <div class="form-group"><label class="form-label">City</label><input type="text" class="form-input" id="branch-city" value="${branch?.city || ''}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Daily Budget (₹)</label><input type="number" class="form-input" id="branch-daily-budget" value="${branch?.daily_budget || ''}" min="0"></div>
      <div class="form-group"><label class="form-label">Monthly Budget (₹)</label><input type="number" class="form-input" id="branch-monthly-budget" value="${branch?.monthly_budget || ''}" min="0"></div>
    </div>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-outline" id="cancel-branch">Cancel</button>
      <button class="btn btn-primary" id="save-branch">${isEdit ? 'Update' : 'Create'} Branch</button>
    </div>
  `;

  showModal({ title: isEdit ? 'Edit Branch' : 'Add Branch', content });

  document.getElementById('cancel-branch')?.addEventListener('click', hideModal);
  document.getElementById('save-branch')?.addEventListener('click', async () => {
    const name = document.getElementById('branch-name').value.trim();
    if (!name) return showToast('Name is required', 'error');

    const data = {
      branch_name: name,
      branch_code: document.getElementById('branch-code').value.trim(),
      gstin: document.getElementById('branch-gstin').value.trim(),
      address: document.getElementById('branch-address').value.trim(),
      city: document.getElementById('branch-city').value.trim(),
      daily_budget: parseFloat(document.getElementById('branch-daily-budget').value) || 0,
      monthly_budget: parseFloat(document.getElementById('branch-monthly-budget').value) || 0,
    };

    try {
      if (isEdit) {
        await branchesApi.update(branch.id, data);
        showToast('Branch updated ✅', 'success');
      } else {
        await branchesApi.create(data);
        showToast('Branch created ✅', 'success');
      }
      hideModal();
      _branches = await branchesApi.list();
      renderBranches();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });
}

export function cleanup() { _branches = []; }
