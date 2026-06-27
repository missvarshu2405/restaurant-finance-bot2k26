// ============================================
// My Expenses Page v3.0 — With Bill Detail Modal
// ============================================

import { bills as billsApi } from '../services/api.js';
import { formatCurrency, formatDate, formatDateTime, getState, getCategoryInfo, categories } from '../data/store.js';
import { showToast } from '../components/toast.js';
import { refreshBadgeCount, refreshFailedScanBadge } from '../components/bottomNav.js';

let _bills = [];
let _failedScanBills = [];
let _activeTab = 'all'; // 'all' | 'failed-scans'
export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <div class="tabs-container">
        <button class="tab-btn active" id="tab-all-bills" data-tab="all">📋 All Bills</button>
        <button class="tab-btn" id="tab-failed-scans" data-tab="failed-scans">
          ⚠️ Failed Scans<span id="failed-scans-tab-count" style="display:none"></span>
        </button>
      </div>

      <!-- All Bills view -->
      <div id="all-bills-view">
        <div class="filters-bar">
          <div class="search-container"><span class="search-icon">🔍</span><input type="text" class="search-input" id="my-search" placeholder="Search vendor..."></div>
          <div class="filter-group"><label class="filter-label">Status:</label>
            <select class="filter-select" id="my-status-filter"><option value="all">All</option><option value="pending">Pending</option><option value="verified">Verified</option><option value="flagged">Flagged</option></select>
          </div>
        </div>
        <div class="expense-summary" style="display:flex;gap:12px;margin-bottom:16px">
          <span class="badge badge-info" id="my-sum-total">Loading...</span>
        </div>
        <div id="my-bills-list"><div class="skeleton-row"></div></div>
      </div>

     <!-- Failed Scans view -->
      <div id="failed-scans-view" style="display:none">
        <p style="color:var(--text-muted);margin-bottom:16px;font-size:13px">These bills couldn't be read automatically. Rescan with a clearer photo, or fill them in by hand.</p>
        <div id="failed-scans-list"><div class="skeleton-row"></div></div>
      </div>

      <input type="file" accept="image/*" id="rescan-file-input" style="display:none">
    </div>
  `;
}
export async function init() {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  _activeTab = 'all';

  try {
    _bills = await billsApi.list({ branch_id: session.branchId });
    renderBills();
  } catch (err) {
    document.getElementById('my-bills-list').innerHTML = `<div class="empty-state-small">Failed: ${err.message}</div>`;
  }

  document.getElementById('my-search')?.addEventListener('input', () => renderBills());
  document.getElementById('my-status-filter')?.addEventListener('change', () => renderBills());

  // Tabs
  document.getElementById('tab-all-bills')?.addEventListener('click', () => switchTab('all'));
  document.getElementById('tab-failed-scans')?.addEventListener('click', () => switchTab('failed-scans'));

  // Load failed-scan count for the tab badge right away (cheap call, manager-only data already)
  updateFailedScansTabCount();
}

function switchTab(tab) {
  _activeTab = tab;
  document.getElementById('tab-all-bills')?.classList.toggle('active', tab === 'all');
  document.getElementById('tab-failed-scans')?.classList.toggle('active', tab === 'failed-scans');
  document.getElementById('all-bills-view').style.display = tab === 'all' ? 'block' : 'none';
  document.getElementById('failed-scans-view').style.display = tab === 'failed-scans' ? 'block' : 'none';

  if (tab === 'failed-scans') {
    loadFailedScans();
  }
}

async function updateFailedScansTabCount() {
  try {
    const { count } = await billsApi.failedScanCount();
    const el = document.getElementById('failed-scans-tab-count');
    if (el) {
      el.textContent = ` (${count})`;
      el.style.display = count > 0 ? 'inline' : 'none';
    }
  } catch {
    // Silent fail
  }
}

async function loadFailedScans() {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  const listEl = document.getElementById('failed-scans-list');
  listEl.innerHTML = '<div class="skeleton-row"></div>';

  try {
    const allBranchBills = await billsApi.list({ branch_id: session.branchId, status: 'failed_scan' });
    _failedScanBills = allBranchBills;
    renderFailedScans();
  } catch (err) {
    listEl.innerHTML = `<div class="empty-state-small">Failed to load: ${err.message}</div>`;
  }
}

function renderFailedScans() {
  const listEl = document.getElementById('failed-scans-list');
  if (!listEl) return;

  if (_failedScanBills.length === 0) {
    listEl.innerHTML = `<div class="empty-state"><div class="empty-icon">✅</div><h3>No failed scans</h3><p>Every bill has been scanned successfully.</p></div>`;
    return;
  }

  listEl.innerHTML = _failedScanBills.map(b => `
    <div class="glass-card mb-3" data-bill-id="${b.id}" style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
      ${b.image_url ? `<img src="${b.image_url}" alt="Bill image" style="width:90px;height:90px;object-fit:cover;border-radius:8px;flex-shrink:0">` : `<div style="width:90px;height:90px;border-radius:8px;background:var(--bg-glass);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:28px">📷</div>`}
      <div style="flex:1;min-width:180px">
        <div style="font-weight:600">Scan failed</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">Uploaded ${formatDateTime(b.uploaded_at)} · ${b.scan_attempts || 3} attempt(s)</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-sm btn-primary rescan-btn" data-id="${b.id}">🔄 Rescan</button>
        <button class="btn btn-sm btn-outline fill-manually-btn" data-id="${b.id}">✏️ Fill Manually</button>
      </div>
    </div>
  `).join('');

  // Rescan buttons (Change 10 wires these up — see rescanBill below)
  listEl.querySelectorAll('.rescan-btn').forEach(btn => {
    btn.addEventListener('click', () => rescanBill(btn.dataset.id));
  });

  // Fill Manually buttons (opens the same edit form used for normal bills — Change 11)
  listEl.querySelectorAll('.fill-manually-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const bill = _failedScanBills.find(b => b.id === btn.dataset.id);
      if (bill) showBillDetail(bill, { startInEditMode: true });
    });
  });
}

function renderBills() {
  const query = document.getElementById('my-search')?.value.toLowerCase().trim() || '';
  const statusFilter = document.getElementById('my-status-filter')?.value || 'all';

  let filtered = _bills.filter(b => {
    if (b.status === 'failed_scan') return false; // these only ever show in the Failed Scans tab
    if (statusFilter !== 'all' && b.status !== statusFilter) return false;
    if (query && !(b.vendor_name || '').toLowerCase().includes(query)) return false;
    return true;
  }).sort((a, b) => new Date(b.uploaded_at || b.bill_date) - new Date(a.uploaded_at || a.bill_date));

  const total = filtered.reduce((s, b) => s + (b.total_amount || 0), 0);
  document.getElementById('my-sum-total').textContent = `${filtered.length} bills · ${formatCurrency(total)}`;

  const container = document.getElementById('my-bills-list');
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📋</div><h3>No bills</h3><p>Submit your first bill to see it here.</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(b => {
    const cat = getCategoryInfo(b.category);
    const statusClass = b.status === 'verified' ? 'badge-success' : b.status === 'flagged' ? 'badge-danger' : b.status === 'failed_scan' ? 'badge-warning' : 'badge-pending';
    const payIcons = { cash: '💵', upi: '📱', card: '💳', credit: '📝' };
    return `
      <div class="today-bill-row bill-clickable" data-bill-id="${b.id}" style="padding:12px 0;cursor:pointer">
        <div class="today-bill-info">
          <span class="today-bill-vendor">${b.vendor_name || 'Unknown'}</span>
          <span class="today-bill-meta">${cat.icon} ${cat.label} · ${payIcons[b.payment_mode] || ''} ${b.payment_mode || ''} · ${formatDate(b.bill_date)}</span>
        </div>
        <div style="text-align:right;display:flex;align-items:center;gap:8px">
          <div>
            <span class="today-bill-amount">${formatCurrency(b.total_amount)}</span>
            <span class="badge ${statusClass}" style="display:block;margin-top:4px;font-size:10px">${b.status || 'pending'}</span>
          </div>
          <span style="color:var(--text-muted);font-size:18px">›</span>
        </div>
      </div>
    `;
  }).join('');

  // Attach click handlers to each bill row
  container.querySelectorAll('.bill-clickable').forEach(row => {
    row.addEventListener('click', () => {
      const billId = row.dataset.billId;
      const bill = _bills.find(b => b.id === billId);
      if (bill) showBillDetail(bill);
    });
  });
}
function showBillDetail(bill, opts = {}) {
  // Remove any existing modal
  document.getElementById('bill-detail-overlay')?.remove();

  let isEditMode = !!opts.startInEditMode;
  // Working copy of line items used only while editing — discarded on Cancel
  let editItems = (bill.items || []).map(i => ({ ...i }));

  const payOptions = [
    { value: 'cash', label: '💵 Cash' },
    { value: 'upi', label: '📱 UPI' },
    { value: 'card', label: '💳 Card' },
    { value: 'credit', label: '📝 Credit' },
  ];
  function renderModalBody() {
    const cat = getCategoryInfo(bill.category);
    const payIcons = { cash: '💵 Cash', upi: '📱 UPI', card: '💳 Card', credit: '📝 Credit' };
    const statusClass = bill.status === 'verified' ? 'badge-success' : bill.status === 'flagged' ? 'badge-danger' : bill.status === 'failed_scan' ? 'badge-danger' : 'badge-pending';
    // --- Line items: read-only table OR editable rows ---
    let itemsHtml = '';
    if (isEditMode) {
      itemsHtml = `
        <div class="detail-section">
          <div class="detail-section-title">📦 Line Items</div>
          <div style="overflow-x:auto">
            <table class="detail-items-table" id="edit-items-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th><th></th></tr></thead>
              <tbody>
                ${editItems.map((i, idx) => `
                  <tr data-idx="${idx}">
                    <td><input type="text" class="form-input edit-item-desc" value="${i.description || ''}" style="min-width:100px"></td>
                    <td><input type="number" class="form-input edit-item-qty" value="${i.qty || 0}" style="width:60px" step="0.5"></td>
                    <td><input type="number" class="form-input edit-item-rate" value="${i.rate || 0}" style="width:80px" step="0.5"></td>
                    <td><input type="number" class="form-input edit-item-amount" value="${i.amount || 0}" style="width:90px" step="0.01"></td>
                    <td><button class="btn btn-sm btn-danger remove-edit-item" data-idx="${idx}">✕</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          <button class="btn btn-sm btn-outline" id="add-edit-item" style="margin-top:8px">+ Add Item</button>
        </div>
      `;
    } else if ((bill.items || []).length > 0) {
      itemsHtml = `
        <div class="detail-section">
          <div class="detail-section-title">📦 Line Items</div>
          <div style="overflow-x:auto">
            <table class="detail-items-table">
              <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
              <tbody>
                ${(bill.items || []).map(i => `<tr>
                  <td>${i.description || '—'}</td>
                  <td>${i.qty || 0} ${i.unit || ''}</td>
                  <td>${formatCurrency(i.rate || 0)}</td>
                  <td style="font-weight:600">${formatCurrency(i.amount || 0)}</td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    // --- Detail rows: read-only OR editable fields ---
    let detailsHtml;
    if (isEditMode) {
      detailsHtml = `
        <div class="detail-section">
          <div class="detail-section-title">📋 Bill Details</div>
          <div class="form-group"><label class="form-label">🏪 Vendor</label><input type="text" class="form-input" id="edit-vendor" value="${bill.vendor_name || ''}"></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div class="form-group"><label class="form-label">📅 Bill Date</label><input type="date" class="form-input" id="edit-date" value="${bill.bill_date || ''}"></div>
            <div class="form-group"><label class="form-label">#️⃣ Bill Number</label><input type="text" class="form-input" id="edit-bill-number" value="${bill.bill_number || ''}"></div>
            <div class="form-group"><label class="form-label">🏷️ Category</label>
              <select class="form-input" id="edit-category">
                ${categories.map(c => `<option value="${c.key}" ${bill.category === c.key ? 'selected' : ''}>${c.icon} ${c.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group"><label class="form-label">💳 Payment</label>
              <select class="form-input" id="edit-payment">
                ${payOptions.map(p => `<option value="${p.value}" ${bill.payment_mode === p.value ? 'selected' : ''}>${p.label}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px">
            <div class="form-group"><label class="form-label">📝 Subtotal</label><input type="number" class="form-input" id="edit-subtotal" value="${bill.subtotal || 0}" step="0.01"></div>
            <div class="form-group"><label class="form-label">🏷️ Discount (₹)</label><input type="number" class="form-input" id="edit-discount" value="${bill.discount_amount || 0}" step="0.01"></div>
            <div class="form-group"><label class="form-label">📊 CGST (₹)</label><input type="number" class="form-input" id="edit-cgst" value="${bill.cgst || 0}" step="0.01"></div>
            <div class="form-group"><label class="form-label">📊 SGST (₹)</label><input type="number" class="form-input" id="edit-sgst" value="${bill.sgst || 0}" step="0.01"></div>
            <div class="form-group"><label class="form-label">💰 Total Amount</label><input type="number" class="form-input" id="edit-total" value="${bill.total_amount || 0}" step="0.01"></div>
            <div class="form-group"><label class="form-label">🆔 GSTIN</label><input type="text" class="form-input" id="edit-gstin" value="${bill.vendor_gstin || ''}"></div>
          </div>
        </div>
      `;
    } else {
      const detailRows = [
        { label: 'Vendor', value: bill.vendor_name || '—', icon: '🏪' },
        { label: 'Bill Date', value: formatDate(bill.bill_date), icon: '📅' },
        { label: 'Bill Number', value: bill.bill_number || '—', icon: '#️⃣' },
        { label: 'Category', value: `${cat.icon} ${cat.label}`, icon: '🏷️' },
        { label: 'Payment', value: payIcons[bill.payment_mode] || bill.payment_mode || '—', icon: '💳' },
        { label: 'Subtotal', value: formatCurrency(bill.subtotal || 0), icon: '📝' },
      ];
      if (bill.discount_percent > 0 || bill.discount_amount > 0) {
        detailRows.push({ label: 'Discount', value: `${bill.discount_percent || 0}% (${formatCurrency(bill.discount_amount || 0)})`, icon: '🏷️' });
      }
      if (bill.taxable_amount > 0) detailRows.push({ label: 'Taxable Amount', value: formatCurrency(bill.taxable_amount), icon: '📊' });
      if (bill.gst_rate > 0) detailRows.push({ label: 'GST Rate', value: `${bill.gst_rate}%`, icon: '🧾' });
      if (bill.cgst > 0 || bill.sgst > 0) detailRows.push({ label: 'CGST / SGST', value: `${formatCurrency(bill.cgst || 0)} / ${formatCurrency(bill.sgst || 0)}`, icon: '📊' });
      if (bill.igst > 0) detailRows.push({ label: 'IGST', value: formatCurrency(bill.igst), icon: '📊' });
      if (bill.round_off) detailRows.push({ label: 'Round Off', value: formatCurrency(bill.round_off), icon: '🔄' });
      detailRows.push({ label: 'Total Amount', value: formatCurrency(bill.total_amount || 0), icon: '💰', bold: true });
      if (bill.vendor_gstin) detailRows.push({ label: 'GSTIN', value: bill.vendor_gstin, icon: '🆔' });
      if (bill.fssai_number) detailRows.push({ label: 'FSSAI', value: bill.fssai_number, icon: '🏥' });
      if (bill.vendor_contact) detailRows.push({ label: 'Contact', value: bill.vendor_contact, icon: '📞' });

      detailsHtml = `
        <div class="detail-section">
          <div class="detail-section-title">📋 Bill Details</div>
          ${detailRows.map(r => `
            <div class="detail-row ${r.bold ? 'detail-row-total' : ''}">
              <span class="detail-label">${r.icon} ${r.label}</span>
              <span class="detail-value">${r.value}</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    return `
      <div class="bill-detail-header">
        <button class="bill-detail-back" id="bill-detail-close">← Back</button>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="badge ${statusClass}" style="font-size:11px">${bill.status || 'pending'}</span>
          ${!isEditMode ? `<button class="btn btn-sm btn-outline" id="bill-edit-btn">✏️ Edit</button>` : ''}
        </div>
      </div>

      ${bill.image_url ? `
        <div class="bill-detail-image-container">
          <img src="${bill.image_url}" alt="Bill image" class="bill-detail-image" id="bill-detail-img">
          <button class="btn btn-sm" id="bill-img-fullscreen" style="position:absolute;bottom:8px;right:8px;background:rgba(0,0,0,0.6);color:white;border:none;border-radius:8px;padding:6px 12px;font-size:12px">🔍 Full Size</button>
        </div>
      ` : `
        <div style="text-align:center;padding:24px;color:var(--text-muted);background:var(--glass-bg);border-radius:12px;margin-bottom:16px">
          <div style="font-size:36px;margin-bottom:8px">📷</div>
          <div>No image uploaded</div>
        </div>
      `}

      ${detailsHtml}
      ${itemsHtml}

      <div class="detail-section" style="margin-top:12px">
        <div class="detail-row" style="border:none;padding:4px 0">
          <span class="detail-label" style="color:var(--text-muted);font-size:11px">Uploaded</span>
          <span class="detail-value" style="color:var(--text-muted);font-size:11px">${bill.uploaded_at ? new Date(bill.uploaded_at).toLocaleString('en-IN') : '—'}</span>
        </div>
        <div class="detail-row" style="border:none;padding:4px 0">
          <span class="detail-label" style="color:var(--text-muted);font-size:11px">Shift</span>
          <span class="detail-value" style="color:var(--text-muted);font-size:11px">${bill.shift || '—'}</span>
        </div>
      </div>

      <div style="padding:16px 0 24px;display:flex;gap:12px">
        ${isEditMode ? `
          <button class="btn btn-outline" id="bill-cancel-edit-btn" style="flex:1;min-height:44px">Cancel</button>
          <button class="btn btn-primary" id="bill-save-edit-btn" style="flex:1;min-height:44px">💾 Save Changes</button>
        ` : `
          <button class="btn btn-danger" id="bill-delete-btn" style="flex:1;min-height:44px">🗑️ Delete Bill</button>
        `}
      </div>
    `;
  }

  const overlay = document.createElement('div');
  overlay.className = 'bill-detail-overlay';
  overlay.id = 'bill-detail-overlay';
  overlay.innerHTML = `<div class="bill-detail-modal" id="bill-detail-modal-inner">${renderModalBody()}</div>`;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => overlay.classList.add('visible'));
  });

  const closeModal = () => {
    overlay.classList.remove('visible');
    setTimeout(() => overlay.remove(), 300);
  };

  function bindEvents() {
    const modalInner = document.getElementById('bill-detail-modal-inner');

    document.getElementById('bill-detail-close')?.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

    document.getElementById('bill-img-fullscreen')?.addEventListener('click', () => {
      const img = document.getElementById('bill-detail-img');
      if (img) window.open(img.src, '_blank');
    });

    // Enter edit mode
    document.getElementById('bill-edit-btn')?.addEventListener('click', () => {
      isEditMode = true;
      editItems = (bill.items || []).map(i => ({ ...i }));
      modalInner.innerHTML = renderModalBody();
      bindEvents();
    });

    // Cancel edit — discard changes, go back to read-only
    document.getElementById('bill-cancel-edit-btn')?.addEventListener('click', () => {
      isEditMode = false;
      modalInner.innerHTML = renderModalBody();
      bindEvents();
    });

    // Add item row (edit mode)
    document.getElementById('add-edit-item')?.addEventListener('click', () => {
      editItems.push({ description: '', qty: 1, unit: '', rate: 0, amount: 0 });
      modalInner.innerHTML = renderModalBody();
      bindEvents();
    });

    // Remove item row (edit mode)
    modalInner.querySelectorAll('.remove-edit-item').forEach(btn => {
      btn.addEventListener('click', () => {
        editItems.splice(parseInt(btn.dataset.idx), 1);
        modalInner.innerHTML = renderModalBody();
        bindEvents();
      });
    });

    // Save changes
    document.getElementById('bill-save-edit-btn')?.addEventListener('click', async () => {
      // Pull latest item values from the inputs before saving
      modalInner.querySelectorAll('#edit-items-table tbody tr').forEach(row => {
        const idx = parseInt(row.dataset.idx);
        if (!editItems[idx]) return;
        editItems[idx].description = row.querySelector('.edit-item-desc')?.value || '';
        editItems[idx].qty = parseFloat(row.querySelector('.edit-item-qty')?.value) || 0;
        editItems[idx].rate = parseFloat(row.querySelector('.edit-item-rate')?.value) || 0;
        editItems[idx].amount = parseFloat(row.querySelector('.edit-item-amount')?.value) || 0;
      });

      const updates = {
        vendor_name: document.getElementById('edit-vendor')?.value.trim() || '',
        bill_date: document.getElementById('edit-date')?.value || bill.bill_date,
        bill_number: document.getElementById('edit-bill-number')?.value.trim() || '',
        category: document.getElementById('edit-category')?.value || bill.category,
        payment_mode: document.getElementById('edit-payment')?.value || bill.payment_mode,
        subtotal: parseFloat(document.getElementById('edit-subtotal')?.value) || 0,
        discount_amount: parseFloat(document.getElementById('edit-discount')?.value) || 0,
        cgst: parseFloat(document.getElementById('edit-cgst')?.value) || 0,
        sgst: parseFloat(document.getElementById('edit-sgst')?.value) || 0,
        total_amount: parseFloat(document.getElementById('edit-total')?.value) || 0,
        vendor_gstin: document.getElementById('edit-gstin')?.value.trim() || '',
        items: editItems,
      };

      const saveBtn = document.getElementById('bill-save-edit-btn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';

      try {
        const updated = await billsApi.update(bill.id, updates);
        Object.assign(bill, updated || updates);

        // Reflect changes in the underlying lists so the page behind the modal is correct too
        const idxAll = _bills.findIndex(b => b.id === bill.id);
        if (idxAll > -1) Object.assign(_bills[idxAll], bill);
        const idxFailed = _failedScanBills.findIndex(b => b.id === bill.id);
        if (idxFailed > -1) Object.assign(_failedScanBills[idxFailed], bill);

        showToast('✅ Bill updated', 'success');
        isEditMode = false;
        modalInner.innerHTML = renderModalBody();
        bindEvents();
        renderBills();
      } catch (err) {
        showToast('Save failed: ' + err.message, 'error');
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Changes';
      }
    });

    // Delete
    document.getElementById('bill-delete-btn')?.addEventListener('click', async () => {
      if (!confirm(`Delete this bill from ${bill.vendor_name || 'Unknown'}?\n\nThis action cannot be undone.`)) return;

      const btn = document.getElementById('bill-delete-btn');
      btn.disabled = true;
      btn.textContent = 'Deleting...';

      try {
        await billsApi.delete(bill.id);
        showToast('Bill deleted successfully', 'success');
        _bills = _bills.filter(b => b.id !== bill.id);
        _failedScanBills = _failedScanBills.filter(b => b.id !== bill.id);
        renderBills();
        closeModal();
      } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = '🗑️ Delete Bill';
      }
    });
  }

  bindEvents();
}
let _rescanTargetId = null;

function rescanBill(billId) {
  _rescanTargetId = billId;
  const input = document.getElementById('rescan-file-input');
  if (!input) return;
  input.value = ''; // reset so picking the same file again still fires 'change'
  input.click();
}

// Wired once — handles whichever bill _rescanTargetId points to
document.addEventListener('change', async (e) => {
  if (e.target?.id !== 'rescan-file-input') return;
  const file = e.target.files?.[0];
  const billId = _rescanTargetId;
  if (!file || !billId) return;

  const bill = _failedScanBills.find(b => b.id === billId);
  if (!bill) return;

  // Find the card and show a busy state on its Rescan button
  const card = document.querySelector(`#failed-scans-list [data-bill-id="${billId}"]`);
  const btn = card?.querySelector('.rescan-btn');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '🔄 Scanning...';
  }

  try {
    const formData = new FormData();
    formData.append('image', file);
    const result = await billsApi.extract(formData);

    if (result.failed || !result.extracted) {
      showToast('Rescan failed — please fill this bill in manually.', 'error');
      if (btn) {
        btn.disabled = false;
        btn.textContent = '🔄 Rescan';
      }
      return;
    }

    const ext = result.extracted;

    // Update the SAME bill record — same ID, no duplicate created
    const updates = {
      vendor_name: ext.vendor_name || '',
      bill_date: ext.bill_date || new Date().toISOString().split('T')[0],
      bill_number: ext.bill_number || '',
      vendor_gstin: ext.vendor_gstin || '',
      vendor_contact: ext.vendor_contact || '',
      hsn_code: ext.hsn_code || '',
      fssai_number: ext.fssai_number || '',
      category: ext.category || 'miscellaneous',
      payment_mode: ext.payment_mode || 'cash',
      items: ext.items || [],
      subtotal: parseFloat(ext.subtotal) || 0,
      discount_percent: parseFloat(ext.discount_percent) || 0,
      discount_amount: parseFloat(ext.discount_amount) || 0,
      taxable_amount: parseFloat(ext.taxable_amount) || 0,
      gst_rate: parseFloat(ext.gst_rate) || 0,
      cgst: parseFloat(ext.cgst) || 0,
      sgst: parseFloat(ext.sgst) || 0,
      igst: parseFloat(ext.igst) || 0,
      round_off: parseFloat(ext.round_off) || 0,
      total_amount: parseFloat(ext.total_amount) || 0,
      ai_confidence: ext.confidence || {},
      status: 'pending',
      scan_attempts: 0,
    };
    if (result.image_url) updates.image_url = result.image_url;

    await billsApi.update(billId, updates);

    showToast('✅ Rescan successful — bill updated', 'success');

    // Remove from the failed-scans list and refresh badges everywhere
    _failedScanBills = _failedScanBills.filter(b => b.id !== billId);
    renderFailedScans();
    updateFailedScansTabCount();
    refreshFailedScanBadge();

  } catch (err) {
    showToast('Rescan failed: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.textContent = '🔄 Rescan';
    }
  } finally {
    _rescanTargetId = null;
  }
});
export function cleanup() {
  _bills = [];
  _failedScanBills = [];
  _activeTab = 'all';
  document.getElementById('bill-detail-overlay')?.remove();
}