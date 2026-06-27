// ============================================
// Users (Managers) Page v2.0 — API-based
// ============================================

import { managers as managersApi, branches as branchesApi } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';

let _managers = [];
let _branches = [];

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <div class="page-actions"><button class="btn btn-primary" id="add-manager-btn">+ Add Manager</button></div>
      <div class="table-container glass-card">
        <table class="data-table" id="managers-table">
          <thead><tr><th>Name</th><th>Username</th><th>Branch</th><th>Email</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody id="managers-tbody"><tr><td colspan="6"><div class="skeleton-row"></div></td></tr></tbody>
        </table>
      </div>
    </div>
  `;
}

export async function init() {
  try {
    [_managers, _branches] = await Promise.all([managersApi.list(), branchesApi.list()]);
    renderManagers();
  } catch (err) {
    document.getElementById('managers-tbody').innerHTML = `<tr><td colspan="6" class="empty-state-small">Failed: ${err.message}</td></tr>`;
  }

  document.getElementById('add-manager-btn')?.addEventListener('click', () => showManagerForm());
}

function renderManagers() {
  const branchMap = {};
  _branches.forEach(b => { branchMap[b.id] = b.branch_name || b.branch_code; });

  const tbody = document.getElementById('managers-tbody');
  if (_managers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-muted)">No managers yet. Add one to enable bill uploads.</td></tr>`;
    return;
  }

  tbody.innerHTML = _managers.map(m => `
    <tr>
      <td style="font-weight:600">${m.name}</td>
      <td>${m.username || '—'}</td>
      <td>${branchMap[m.branch_id] || '—'}</td>
      <td>${m.email || '—'}</td>
      <td><span class="badge ${m.is_active !== false ? 'badge-success' : 'badge-muted'}">${m.is_active !== false ? 'Active' : 'Inactive'}</span></td>
      <td>
        <div class="btn-group">
          <button class="btn btn-sm edit-mgr" data-id="${m.id}">✏️</button>
          <button class="btn btn-sm btn-danger del-mgr" data-id="${m.id}">🗑️</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.edit-mgr').forEach(btn => {
    btn.addEventListener('click', () => {
      const mgr = _managers.find(m => m.id === btn.dataset.id);
      if (mgr) showManagerForm(mgr);
    });
  });

  tbody.querySelectorAll('.del-mgr').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Delete this manager?')) return;
      try {
        await managersApi.delete(btn.dataset.id);
        _managers = _managers.filter(m => m.id !== btn.dataset.id);
        renderManagers();
        showToast('Manager deleted', 'info');
      } catch (err) { showToast('Failed: ' + err.message, 'error'); }
    });
  });
}

function showManagerForm(mgr = null) {
  const isEdit = !!mgr;
  const content = `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Name *</label><input type="text" class="form-input" id="mgr-name" value="${mgr?.name || ''}" required></div>
      <div class="form-group"><label class="form-label">Username *</label><input type="text" class="form-input" id="mgr-uname" value="${mgr?.username || ''}" required></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">${isEdit ? 'New Password (leave blank to keep)' : 'Password *'}</label><input type="password" class="form-input" id="mgr-pass" placeholder="Min 4 chars"></div>
      <div class="form-group"><label class="form-label">Branch *</label>
        <select class="form-input" id="mgr-branch">
          ${_branches.filter(b => b.is_active !== false).map(b => `<option value="${b.id}" ${mgr?.branch_id === b.id ? 'selected' : ''}>${b.branch_name}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Email</label><input type="email" class="form-input" id="mgr-email" value="${mgr?.email || ''}"></div>
      <div class="form-group"><label class="form-label">WhatsApp</label><input type="text" class="form-input" id="mgr-whatsapp" value="${mgr?.whatsapp || ''}"></div>
    </div>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-outline" id="cancel-mgr">Cancel</button>
      <button class="btn btn-primary" id="save-mgr">${isEdit ? 'Update' : 'Create'}</button>
    </div>
  `;

  showModal({ title: isEdit ? 'Edit Manager' : 'Add Manager', content });

  document.getElementById('cancel-mgr')?.addEventListener('click', hideModal);
  document.getElementById('save-mgr')?.addEventListener('click', async () => {
    const name = document.getElementById('mgr-name').value.trim();
    const username = document.getElementById('mgr-uname').value.trim();
    if (!name || !username) return showToast('Name and username required', 'error');

    const data = {
      name, username,
      branch_id: document.getElementById('mgr-branch').value,
      email: document.getElementById('mgr-email').value.trim(),
      whatsapp: document.getElementById('mgr-whatsapp').value.trim(),
    };
    const pass = document.getElementById('mgr-pass').value;
    if (pass) data.password = pass;
    else if (!isEdit) return showToast('Password is required for new managers', 'error');

    try {
      if (isEdit) { await managersApi.update(mgr.id, data); showToast('Updated ✅', 'success'); }
      else { await managersApi.create(data); showToast('Created ✅', 'success'); }
      hideModal();
      _managers = await managersApi.list();
      renderManagers();
    } catch (err) { showToast('Failed: ' + err.message, 'error'); }
  });
}

export function cleanup() { _managers = []; _branches = []; }
