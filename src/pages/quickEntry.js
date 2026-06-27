// ============================================
// Quick Entry Page — Recurring Vendor Shortcuts
// Spec §4.6: Fast submission for known vendors
// ============================================

import { recurringVendors as recApi, bills as billsApi } from '../services/api.js';
import { formatCurrency, todayStr, categories } from '../data/store.js';
import { showToast } from '../components/toast.js';
import { showModal, hideModal } from '../components/modal.js';
import { renderShiftSelector, detectShift } from '../components/shiftSelector.js';

let _vendors = [];
let selectedShift = detectShift();

export function render(container) {
  container.innerHTML = `
    <div class="fade-up" style="max-width:600px">
      <h3 class="section-title">⚡ Quick Entry</h3>
      <p style="color:var(--text-muted);margin-bottom:16px;font-size:13px">Tap a vendor to quickly submit an expense — no image needed for recurring vendors.</p>

      <div id="quick-vendors-grid" class="quick-vendor-grid">
        <div class="skeleton-row"></div>
      </div>

      <button class="btn btn-outline" id="add-recurring-btn" style="margin-top:16px;width:100%">+ Add Recurring Vendor</button>
    </div>
  `;
}

export async function init() {
  try {
    _vendors = await recApi.list();
    renderGrid();
  } catch (err) {
    document.getElementById('quick-vendors-grid').innerHTML = `<div class="empty-state-small">Failed to load: ${err.message}</div>`;
  }

  document.getElementById('add-recurring-btn')?.addEventListener('click', () => showAddForm());
}

function renderGrid() {
  const grid = document.getElementById('quick-vendors-grid');
  if (_vendors.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚡</div>
        <h3>No recurring vendors</h3>
        <p>Add your daily vegetable supplier, LPG vendor, or any recurring expense for ultra-fast entry.</p>
      </div>
    `;
    return;
  }

  const catIcons = {};
  categories.forEach(c => { catIcons[c.key] = c.icon; });

  grid.innerHTML = _vendors.map(v => `
    <div class="quick-vendor-card" data-vendor-id="${v.id}">
      <span class="quick-vendor-icon">${catIcons[v.category] || '📦'}</span>
      <span class="quick-vendor-name">${v.vendor_name || 'Vendor'}</span>
      <span class="quick-vendor-meta">${v.typical_amount ? formatCurrency(v.typical_amount) : ''} · ${v.frequency || 'daily'}</span>
    </div>
  `).join('');

  grid.querySelectorAll('.quick-vendor-card').forEach(card => {
    card.addEventListener('click', () => {
      const vendor = _vendors.find(v => v.id === card.dataset.vendorId);
      if (vendor) showQuickSubmit(vendor);
    });
  });
}

function showQuickSubmit(vendor) {
  const content = `
    <div class="quick-submit-form">
      <div class="form-group">
        <label class="form-label">Vendor</label>
        <div style="font-size:16px;font-weight:700">${vendor.vendor_name}</div>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Amount (₹) *</label>
          <input type="number" class="form-input" id="quick-amount" value="${vendor.typical_amount || ''}" min="0" style="font-size:20px;font-weight:700;text-align:center" autofocus>
        </div>
        <div class="form-group">
          <label class="form-label">Payment Mode *</label>
          <select class="form-input" id="quick-payment">
            <option value="cash">💵 Cash</option>
            <option value="upi">📱 UPI</option>
            <option value="card">💳 Card</option>
            <option value="credit">📝 Credit</option>
          </select>
        </div>
      </div>
      <div id="quick-shift-mount"></div>
      <div class="form-group">
        <label class="form-label">Notes (optional)</label>
        <input type="text" class="form-input" id="quick-notes" placeholder="Any notes...">
      </div>
      <div class="form-actions" style="margin-top:16px">
        <button class="btn btn-outline" id="cancel-quick">Cancel</button>
        <button class="btn btn-primary btn-lg" id="submit-quick" style="min-height:48px">📤 Submit</button>
      </div>
    </div>
  `;

  showModal({ title: `⚡ Quick Entry — ${vendor.vendor_name}`, content });

  // Shift selector
  const shiftMount = document.getElementById('quick-shift-mount');
  if (shiftMount) {
    selectedShift = detectShift();
    renderShiftSelector(shiftMount, { currentShift: selectedShift, onChange: (s) => { selectedShift = s; } });
  }

  document.getElementById('cancel-quick')?.addEventListener('click', hideModal);
  document.getElementById('submit-quick')?.addEventListener('click', async () => {
    const amount = parseFloat(document.getElementById('quick-amount').value);
    if (!amount || amount <= 0) return showToast('Enter a valid amount', 'error');

    const btn = document.getElementById('submit-quick');
    btn.disabled = true;
    btn.textContent = 'Submitting...';

    try {
      await billsApi.createJSON({
        vendor_name: vendor.vendor_name,
        bill_date: todayStr(),
        category: vendor.category || 'miscellaneous',
        payment_mode: document.getElementById('quick-payment').value,
        gst_rate: vendor.gst_rate || 0,
        subtotal: amount,
        cgst: amount * (vendor.gst_rate || 0) / 200,
        sgst: amount * (vendor.gst_rate || 0) / 200,
        total_amount: amount + (amount * (vendor.gst_rate || 0) / 100),
        items: [{ description: vendor.vendor_name, qty: 1, unit: 'lot', rate: amount, amount }],
        shift: selectedShift,
        is_manual: true,
        notes: document.getElementById('quick-notes').value.trim(),
      });

      hideModal();
      showToast(`✅ ${vendor.vendor_name} — ${formatCurrency(amount)} submitted!`, 'success');
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.textContent = '📤 Submit';
    }
  });
}

function showAddForm() {
  const content = `
    <div class="form-group"><label class="form-label">Vendor Name *</label><input type="text" class="form-input" id="rec-name" placeholder="e.g. Ram Vegetables"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-input" id="rec-cat">${categories.map(c => `<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Typical Amount (₹)</label><input type="number" class="form-input" id="rec-amount" placeholder="500" min="0"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Frequency</label>
        <select class="form-input" id="rec-freq"><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option></select>
      </div>
      <div class="form-group"><label class="form-label">GST Rate (%)</label>
        <select class="form-input" id="rec-gst"><option value="0">0%</option><option value="5">5%</option><option value="12">12%</option><option value="18">18%</option></select>
      </div>
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin:12px 0"><input type="checkbox" id="rec-image"> Image required</label>
    <div class="form-actions" style="margin-top:16px">
      <button class="btn btn-outline" id="cancel-rec">Cancel</button>
      <button class="btn btn-primary" id="save-rec">Add Vendor</button>
    </div>
  `;

  showModal({ title: 'Add Recurring Vendor', content });

  document.getElementById('cancel-rec')?.addEventListener('click', hideModal);
  document.getElementById('save-rec')?.addEventListener('click', async () => {
    const name = document.getElementById('rec-name').value.trim();
    if (!name) return showToast('Name required', 'error');

    try {
      await recApi.create({
        vendor_name: name,
        category: document.getElementById('rec-cat').value,
        typical_amount: parseFloat(document.getElementById('rec-amount').value) || 0,
        frequency: document.getElementById('rec-freq').value,
        gst_rate: parseFloat(document.getElementById('rec-gst').value) || 0,
        requires_image: document.getElementById('rec-image').checked,
      });
      hideModal();
      _vendors = await recApi.list();
      renderGrid();
      showToast('Recurring vendor added ✅', 'success');
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });
}

export function cleanup() { _vendors = []; }
