// ============================================
// Expenses Page v2.0 — API-based
// Inline approve, bulk actions, search
// ============================================

import { bills as billsApi, branches as branchesApi } from '../services/api.js';
import { formatCurrency, formatDate, formatDateTime, getState, getCategoryInfo, categories } from '../data/store.js';
import { showToast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';

let _bills = [];
let _branches = [];
let _selectedIds = new Set();
let _searchQuery = '';
let _statusFilter = 'all';
let _categoryFilter = 'all';

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <!-- Filters Bar -->
      <div class="filters-bar">
        <div class="search-container" style="max-width:250px">
          <span class="search-icon">🔍</span>
          <input type="text" class="search-input" id="expense-search" placeholder="Search vendor, bill#, category...">
        </div>
        <div class="filter-group">
          <label class="filter-label">Status:</label>
          <select class="filter-select" id="expense-status-filter">
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="verified">Verified</option>
            <option value="flagged">Flagged</option>
            <option value="processing">Processing</option>
          </select>
        </div>
        <div class="filter-group">
          <label class="filter-label">Category:</label>
          <select class="filter-select" id="expense-cat-filter">
            <option value="all">All Categories</option>
            ${categories.map(c => `<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}
          </select>
        </div>
        <div class="btn-group" style="margin-left:auto">
          <button class="btn btn-sm btn-success" id="bulk-verify-btn" style="display:none">✅ Verify Selected</button>
          <button class="btn btn-sm btn-warning" id="bulk-flag-btn" style="display:none">🚩 Flag Selected</button>
        </div>
      </div>

      <!-- Summary Bar -->
      <div class="expense-summary" id="expense-summary" style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
        <span class="badge badge-info" id="sum-total">Loading...</span>
        <span class="badge badge-pending" id="sum-pending">—</span>
        <span class="badge badge-success" id="sum-verified">—</span>
        <span class="badge badge-danger" id="sum-flagged">—</span>
      </div>

      <!-- Bills Table (Desktop) -->
      <div class="glass-card expenses-desktop-table">
        <div class="table-container">
          <table class="data-table" id="expenses-table">
            <thead>
              <tr>
                <th style="width:32px"><input type="checkbox" id="select-all-bills"></th>
                <th>Date</th>
                <th>Branch</th>
                <th>Vendor</th>
                <th>Category</th>
                <th>Payment</th>
                <th class="text-right">Amount</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="expenses-tbody">
              <tr><td colspan="9"><div class="skeleton-row"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Bills Cards (Mobile) -->
      <div class="mobile-bills-list" id="mobile-bills-list"></div>
    </div>
  `;
}

export async function init() {
  const state = getState();

  try {
    const params = {};
    if (state.selectedBranch && state.selectedBranch !== 'all') params.branch_id = state.selectedBranch;
    if (state.dateRange?.start) params.date_from = state.dateRange.start;
    if (state.dateRange?.end) params.date_to = state.dateRange.end;

    const [allBills, branchesList] = await Promise.all([
      billsApi.list(params),
      branchesApi.list(),
    ]);

    _bills = allBills;
    _branches = branchesList;
    _selectedIds.clear();
    _searchQuery = '';
    _statusFilter = 'all';
    _categoryFilter = 'all';

    renderBillsTable();
    updateSummary();
  } catch (err) {
    document.getElementById('expenses-tbody').innerHTML = `<tr><td colspan="9" class="empty-state-small">Failed to load: ${err.message}</td></tr>`;
  }

  // Search
  document.getElementById('expense-search')?.addEventListener('input', (e) => {
    _searchQuery = e.target.value.toLowerCase().trim();
    renderBillsTable();
  });

  // Filters
  document.getElementById('expense-status-filter')?.addEventListener('change', (e) => {
    _statusFilter = e.target.value;
    renderBillsTable();
  });
  document.getElementById('expense-cat-filter')?.addEventListener('change', (e) => {
    _categoryFilter = e.target.value;
    renderBillsTable();
  });

  // Select all
  document.getElementById('select-all-bills')?.addEventListener('change', (e) => {
    const checked = e.target.checked;
    const filtered = getFilteredBills();
    if (checked) filtered.forEach(b => _selectedIds.add(b.id));
    else _selectedIds.clear();
    renderBillsTable();
    updateBulkButtons();
  });

  // Bulk verify
  document.getElementById('bulk-verify-btn')?.addEventListener('click', async () => {
    if (_selectedIds.size === 0) return;
    try {
      await billsApi.bulkVerify([..._selectedIds]);
      showToast(`✅ ${_selectedIds.size} bills verified`, 'success');
      _selectedIds.clear();
      // Refresh
      const params = {};
      const state = getState();
      if (state.selectedBranch && state.selectedBranch !== 'all') params.branch_id = state.selectedBranch;
      if (state.dateRange?.start) params.date_from = state.dateRange.start;
      if (state.dateRange?.end) params.date_to = state.dateRange.end;
      _bills = await billsApi.list(params);
      renderBillsTable();
      updateSummary();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });
}

function getFilteredBills() {
  return _bills.filter(b => {
    if (b.status === 'failed_scan') return false; // safety net — owner never sees these
    if (_statusFilter !== 'all' && b.status !== _statusFilter) return false;
    if (_categoryFilter !== 'all' && b.category !== _categoryFilter) return false;
    if (_searchQuery) {
      const searchable = [b.vendor_name, b.bill_number, b.category, b.payment_mode, b.uploaderName || ''].join(' ').toLowerCase();
      if (!searchable.includes(_searchQuery)) return false;
    }
    return true;
  });
}
function updateSummary() {
  const total = _bills.reduce((s, b) => s + (b.total_amount || 0), 0);
  const pending = _bills.filter(b => b.status === 'pending');
  const verified = _bills.filter(b => b.status === 'verified');
  const flagged = _bills.filter(b => b.status === 'flagged');

  document.getElementById('sum-total').textContent = `${_bills.length} bills · ${formatCurrency(total)}`;
  document.getElementById('sum-pending').textContent = `${pending.length} pending`;
  document.getElementById('sum-verified').textContent = `${verified.length} verified`;
  document.getElementById('sum-flagged').textContent = `${flagged.length} flagged`;
}

function updateBulkButtons() {
  const show = _selectedIds.size > 0;
  document.getElementById('bulk-verify-btn').style.display = show ? 'inline-flex' : 'none';
  document.getElementById('bulk-flag-btn').style.display = show ? 'inline-flex' : 'none';
}

function renderBillsTable() {
  const filtered = getFilteredBills();
  const branchMap = {};
  _branches.forEach(br => { branchMap[br.id] = br.branch_code || br.branch_name?.slice(0, 12) || '—'; });

  const sorted = filtered.sort((a, b) => new Date(b.uploaded_at || b.bill_date) - new Date(a.uploaded_at || a.bill_date));

  // --- Desktop table ---
  const tbody = document.getElementById('expenses-tbody');
  if (sorted.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:24px;color:var(--text-muted)">No bills found</td></tr>`;
  } else {
    tbody.innerHTML = sorted.map(bill => {
      const cat = getCategoryInfo(bill.category);
      const statusClass = bill.status === 'verified' ? 'badge-success' : bill.status === 'flagged' ? 'badge-danger' : bill.status === 'processing' ? 'badge-info' : 'badge-pending';
      const isChecked = _selectedIds.has(bill.id);
      const payIcons = { cash: '💵', upi: '📱', card: '💳', credit: '📝' };

      return `<tr data-bill-id="${bill.id}">
        <td><input type="checkbox" class="bill-checkbox" data-id="${bill.id}" ${isChecked ? 'checked' : ''}></td>
        <td>${formatDate(bill.bill_date)}</td>
        <td>${branchMap[bill.branch_id] || '—'}</td>
        <td style="font-weight:600">${bill.vendor_name || '—'}</td>
        <td>${cat.icon} ${cat.label}</td>
        <td>${payIcons[bill.payment_mode] || ''} ${bill.payment_mode || ''}</td>
        <td class="text-right" style="font-weight:700">${formatCurrency(bill.total_amount)}</td>
        <td><span class="badge ${statusClass}">${bill.status || 'pending'}</span></td>
        <td>
          <div class="btn-group">
            ${bill.status === 'pending' ? `<button class="btn btn-sm btn-success inline-verify" data-id="${bill.id}" title="Verify">✅</button>` : ''}
            ${bill.status !== 'flagged' ? `<button class="btn btn-sm btn-warning inline-flag" data-id="${bill.id}" title="Flag">🚩</button>` : ''}
            <button class="btn btn-sm view-bill" data-id="${bill.id}" title="View">👁️</button>
          </div>
        </td>
      </tr>`;
    }).join('');
  }

  // Bind desktop table events
  bindTableEvents(tbody);

  // --- Mobile cards ---
  const mobileList = document.getElementById('mobile-bills-list');
  if (mobileList) {
    if (sorted.length === 0) {
      mobileList.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No bills found</h3><p>Try adjusting your filters</p></div>`;
    } else {
      mobileList.innerHTML = sorted.map(bill => {
        const cat = getCategoryInfo(bill.category);
        const statusClass = bill.status === 'verified' ? 'badge-success' : bill.status === 'flagged' ? 'badge-danger' : bill.status === 'processing' ? 'badge-info' : 'badge-pending';
        const payIcons = { cash: '💵', upi: '📱', card: '💳', credit: '📝' };

        return `
          <div class="mobile-bill-card" data-bill-id="${bill.id}">
            <div class="mobile-bill-card-top">
              <span class="mobile-bill-vendor">${bill.vendor_name || 'Unknown Vendor'}</span>
              <span class="mobile-bill-amount">${formatCurrency(bill.total_amount)}</span>
            </div>
            <div class="mobile-bill-meta">
              <span class="mobile-bill-meta-item">📅 ${formatDate(bill.bill_date)}</span>
              <span class="mobile-bill-meta-item">🏪 ${branchMap[bill.branch_id] || '—'}</span>
              <span class="mobile-bill-meta-item">${cat.icon} ${cat.label}</span>
              ${bill.payment_mode ? `<span class="mobile-bill-meta-item">${payIcons[bill.payment_mode] || ''} ${bill.payment_mode}</span>` : ''}
            </div>
            <div class="mobile-bill-bottom">
              <span class="badge ${statusClass}">${bill.status || 'pending'}</span>
              <div class="mobile-bill-actions">
                ${bill.status === 'pending' ? `<button class="btn btn-sm btn-success inline-verify" data-id="${bill.id}">✅</button>` : ''}
                ${bill.status !== 'flagged' ? `<button class="btn btn-sm btn-warning inline-flag" data-id="${bill.id}">🚩</button>` : ''}
                <button class="btn btn-sm view-bill" data-id="${bill.id}">👁️</button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      // Bind mobile card events
      bindTableEvents(mobileList);
    }
  }
}

function bindTableEvents(container) {
  // Bind checkboxes
  container.querySelectorAll('.bill-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      if (e.target.checked) _selectedIds.add(e.target.dataset.id);
      else _selectedIds.delete(e.target.dataset.id);
      updateBulkButtons();
    });
  });

  // Inline verify
  container.querySelectorAll('.inline-verify').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        await billsApi.verify(id);
        const bill = _bills.find(b => b.id === id);
        if (bill) bill.status = 'verified';
        renderBillsTable();
        updateSummary();
        showToast('Bill verified ✅', 'success');
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
      }
    });
  });

  // Inline flag
  container.querySelectorAll('.inline-flag').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      try {
        await billsApi.flag(id, 'Manual flag by owner');
        const bill = _bills.find(b => b.id === id);
        if (bill) bill.status = 'flagged';
        renderBillsTable();
        updateSummary();
        showToast('Bill flagged 🚩', 'info');
      } catch (err) {
        showToast('Failed: ' + err.message, 'error');
      }
    });
  });

  // View bill detail
  container.querySelectorAll('.view-bill').forEach(btn => {
    btn.addEventListener('click', () => showBillDetail(btn.dataset.id));
  });
}

function showBillDetail(billId) {
  const bill = _bills.find(b => b.id === billId);
  if (!bill) return;
  if (bill.status === 'failed_scan') return;

  let isEditMode = false;
  let editItems = (bill.items || []).map(i => ({ ...i }));

  const payOptions = [
    { value: 'cash', label: '💵 Cash' },
    { value: 'upi', label: '📱 UPI' },
    { value: 'card', label: '💳 Card' },
    { value: 'credit', label: '📝 Credit' },
  ];

  function renderContent() {
    const cat = getCategoryInfo(bill.category);
    const items = bill.items || [];

    let itemsHtml = '';
    if (isEditMode) {
      itemsHtml = `
        <h4 style="margin:12px 0 8px">Line Items</h4>
        <div style="overflow-x:auto">
          <table class="data-table" style="font-size:12px" id="owner-edit-items-table">
            <thead><tr><th>Item</th><th>Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th><th></th></tr></thead>
            <tbody>
              ${editItems.map((i, idx) => `
                <tr data-idx="${idx}">
                  <td><input type="text" class="form-input owner-edit-item-desc" value="${i.description || ''}" style="min-width:100px"></td>
                  <td><input type="number" class="form-input owner-edit-item-qty" value="${i.qty || 0}" style="width:60px" step="0.5"></td>
                  <td><input type="number" class="form-input owner-edit-item-rate" value="${i.rate || 0}" style="width:80px" step="0.5"></td>
                  <td><input type="number" class="form-input owner-edit-item-amount" value="${i.amount || 0}" style="width:90px" step="0.01"></td>
                  <td><button class="btn btn-sm btn-danger owner-remove-edit-item" data-idx="${idx}">✕</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <button class="btn btn-sm btn-outline" id="owner-add-edit-item" style="margin-top:8px">+ Add Item</button>
      `;
    } else if (items.length > 0) {
      itemsHtml = `
        <h4 style="margin:12px 0 8px">Line Items</h4>
        <table class="data-table" style="font-size:12px">
          <thead><tr><th>Item</th><th>Qty</th><th class="text-right">Rate</th><th class="text-right">Amount</th></tr></thead>
          <tbody>${items.map(i => `<tr><td>${i.description}</td><td>${i.qty} ${i.unit || ''}</td><td class="text-right">${formatCurrency(i.rate)}</td><td class="text-right">${formatCurrency(i.amount)}</td></tr>`).join('')}</tbody>
        </table>
      `;
    }

    let detailsHtml;
    if (isEditMode) {
      detailsHtml = `
        <div class="form-group"><label class="form-label">Vendor</label><input type="text" class="form-input" id="owner-edit-vendor" value="${bill.vendor_name || ''}"></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label class="form-label">Date</label><input type="date" class="form-input" id="owner-edit-date" value="${bill.bill_date || ''}"></div>
          <div class="form-group"><label class="form-label">Bill #</label><input type="text" class="form-input" id="owner-edit-bill-number" value="${bill.bill_number || ''}"></div>
          <div class="form-group"><label class="form-label">Category</label>
            <select class="form-input" id="owner-edit-category">
              ${categories.map(c => `<option value="${c.key}" ${bill.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Payment</label>
            <select class="form-input" id="owner-edit-payment">
              ${payOptions.map(p => `<option value="${p.value}" ${bill.payment_mode === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">GSTIN</label><input type="text" class="form-input" id="owner-edit-gstin" value="${bill.vendor_gstin || ''}"></div>
        </div>
      `;
    } else {
      detailsHtml = `
        <div class="form-group"><label class="form-label">Vendor</label><div style="font-size:16px;font-weight:700">${bill.vendor_name}</div></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group"><label class="form-label">Date</label><div>${formatDate(bill.bill_date)}</div></div>
          <div class="form-group"><label class="form-label">Bill #</label><div>${bill.bill_number || '—'}</div></div>
          <div class="form-group"><label class="form-label">Category</label><div>${cat.icon} ${cat.label}</div></div>
          <div class="form-group"><label class="form-label">Payment</label><div>${bill.payment_mode || '—'}</div></div>
          <div class="form-group"><label class="form-label">GSTIN</label><div>${bill.vendor_gstin || '—'}</div></div>
          <div class="form-group"><label class="form-label">Shift</label><div>${bill.shift || '—'}</div></div>
        </div>
      `;
    }

    let totalsHtml;
    if (isEditMode) {
      totalsHtml = `
        <div style="margin-top:16px;padding:12px;background:var(--bg-glass);border-radius:var(--radius-md)">
          <div class="form-group"><label class="form-label">Subtotal</label><input type="number" class="form-input" id="owner-edit-subtotal" value="${bill.subtotal || 0}" step="0.01"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">CGST (₹)</label><input type="number" class="form-input" id="owner-edit-cgst" value="${bill.cgst || 0}" step="0.01"></div>
            <div class="form-group"><label class="form-label">SGST (₹)</label><input type="number" class="form-input" id="owner-edit-sgst" value="${bill.sgst || 0}" step="0.01"></div>
          </div>
          <div class="form-group"><label class="form-label">Total Amount</label><input type="number" class="form-input" id="owner-edit-total" value="${bill.total_amount || 0}" step="0.01"></div>
        </div>
      `;
    } else {
      totalsHtml = `
        <div style="margin-top:16px;padding:12px;background:var(--bg-glass);border-radius:var(--radius-md)">
          <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${formatCurrency(bill.subtotal)}</span></div>
          <div style="display:flex;justify-content:space-between"><span>GST (${bill.gst_rate || 0}%)</span><span>${formatCurrency((bill.cgst || 0) + (bill.sgst || 0))}</span></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:16px;border-top:1px solid var(--border-glass);padding-top:8px;margin-top:8px"><span>Total</span><span>${formatCurrency(bill.total_amount)}</span></div>
        </div>
      `;
    }

    return `
      <div style="display:flex;gap:20px;flex-wrap:wrap">
        ${bill.image_url ? `<div style="flex:1;min-width:200px"><img src="${bill.image_url}" style="width:100%;border-radius:var(--radius-md);max-height:400px;object-fit:contain" alt="Bill image"></div>` : ''}
        <div style="flex:1;min-width:300px">
          ${!isEditMode ? `<div style="text-align:right;margin-bottom:8px"><button class="btn btn-sm btn-outline" id="owner-bill-edit-btn">✏️ Edit</button></div>` : ''}
          ${detailsHtml}
          ${itemsHtml}
          ${totalsHtml}
          <div style="font-size:11px;color:var(--text-muted);margin-top:8px">Uploaded: ${formatDateTime(bill.uploaded_at)} · Status: ${bill.status}</div>
          <div style="display:flex;gap:12px;margin-top:16px">
            ${isEditMode ? `
              <button class="btn btn-outline" id="owner-bill-cancel-btn" style="flex:1">Cancel</button>
              <button class="btn btn-primary" id="owner-bill-save-btn" style="flex:1">💾 Save Changes</button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  function bindModalEvents() {
    document.getElementById('owner-bill-edit-btn')?.addEventListener('click', () => {
      isEditMode = true;
      editItems = (bill.items || []).map(i => ({ ...i }));
      rerender();
    });

    document.getElementById('owner-bill-cancel-btn')?.addEventListener('click', () => {
      isEditMode = false;
      rerender();
    });

    document.getElementById('owner-add-edit-item')?.addEventListener('click', () => {
      editItems.push({ description: '', qty: 1, unit: '', rate: 0, amount: 0 });
      rerender();
    });

    document.querySelectorAll('.owner-remove-edit-item').forEach(btn => {
      btn.addEventListener('click', () => {
        editItems.splice(parseInt(btn.dataset.idx), 1);
        rerender();
      });
    });

    document.getElementById('owner-bill-save-btn')?.addEventListener('click', async () => {
      document.querySelectorAll('#owner-edit-items-table tbody tr').forEach(row => {
        const idx = parseInt(row.dataset.idx);
        if (!editItems[idx]) return;
        editItems[idx].description = row.querySelector('.owner-edit-item-desc')?.value || '';
        editItems[idx].qty = parseFloat(row.querySelector('.owner-edit-item-qty')?.value) || 0;
        editItems[idx].rate = parseFloat(row.querySelector('.owner-edit-item-rate')?.value) || 0;
        editItems[idx].amount = parseFloat(row.querySelector('.owner-edit-item-amount')?.value) || 0;
      });

      const updates = {
        vendor_name: document.getElementById('owner-edit-vendor')?.value.trim() || '',
        bill_date: document.getElementById('owner-edit-date')?.value || bill.bill_date,
        bill_number: document.getElementById('owner-edit-bill-number')?.value.trim() || '',
        category: document.getElementById('owner-edit-category')?.value || bill.category,
        payment_mode: document.getElementById('owner-edit-payment')?.value || bill.payment_mode,
        vendor_gstin: document.getElementById('owner-edit-gstin')?.value.trim() || '',
        subtotal: parseFloat(document.getElementById('owner-edit-subtotal')?.value) || 0,
        cgst: parseFloat(document.getElementById('owner-edit-cgst')?.value) || 0,
        sgst: parseFloat(document.getElementById('owner-edit-sgst')?.value) || 0,
        total_amount: parseFloat(document.getElementById('owner-edit-total')?.value) || 0,
        items: editItems,
      };

      const saveBtn = document.getElementById('owner-bill-save-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const updated = await billsApi.update(bill.id, updates);
        Object.assign(bill, updated || updates);

        const idxAll = _bills.findIndex(b => b.id === bill.id);
        if (idxAll > -1) Object.assign(_bills[idxAll], bill);

        showToast('✅ Bill updated', 'success');
        isEditMode = false;
        rerender();
        renderBillsTable();
        updateSummary();
      } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
      }
    });
  }

  function rerender() {
    const body = document.getElementById('modal-body');
    if (body) body.innerHTML = renderContent();
    bindModalEvents();
  }

  showModal({ title: `Bill — ${bill.vendor_name}`, content: renderContent(), size: 'large' });
  bindModalEvents();
}
export function cleanup() {
  _bills = [];
  _branches = [];
  _selectedIds.clear();
}
