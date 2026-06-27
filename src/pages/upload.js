// ============================================
// Upload Bill Page v3.0 — Zero-Wait Upload
// Three clean options: Gallery, Camera, Manual Entry
// Gallery/Camera: instant upload, background AI processing
// Manual: fill form and submit
// ============================================

import { categories, formatCurrency, todayStr, getCategoryInfo } from '../data/store.js';
import { bills as billsApi } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { renderShiftSelector, detectShift } from '../components/shiftSelector.js';

let lineItems = [{ description: '', qty: 1, unit: 'pcs', rate: 0, amount: 0 }];
let selectedShift = detectShift();
let currentMode = null; // 'gallery', 'camera', 'manual'

// Compress image before upload
async function compressImage(file, maxW = 1200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob((blob) => {
          resolve(new File([blob], file.name, { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.7);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function calcTotals() {
  const subtotal = lineItems.reduce((s, i) => s + (i.amount || 0), 0);
  const discountPct = parseFloat(document.getElementById('bill-discount-pct')?.value || 0);
  const discountAmtInput = document.getElementById('bill-discount-amt');
  let discountAmt = parseFloat(discountAmtInput?.value || 0);

  if (discountPct > 0 && discountAmt === 0) {
    discountAmt = Math.round(subtotal * discountPct / 100 * 100) / 100;
    if (discountAmtInput) discountAmtInput.value = discountAmt.toFixed(2);
  }

  const taxableAmount = subtotal - discountAmt;
  const cgstInput = document.getElementById('bill-cgst-amt');
  const sgstInput = document.getElementById('bill-sgst-amt');
  const gstRate = parseFloat(document.getElementById('bill-gst-rate')?.value || 0);

  let cgst = parseFloat(cgstInput?.value || 0);
  let sgst = parseFloat(sgstInput?.value || 0);

  if (cgst === 0 && sgst === 0 && gstRate > 0) {
    const totalGst = taxableAmount * gstRate / 100;
    cgst = Math.round(totalGst / 2 * 100) / 100;
    sgst = Math.round(totalGst / 2 * 100) / 100;
    if (cgstInput) cgstInput.value = cgst.toFixed(2);
    if (sgstInput) sgstInput.value = sgst.toFixed(2);
  }

  const roundOff = parseFloat(document.getElementById('bill-round-off')?.value || 0);
  const total = taxableAmount + cgst + sgst + roundOff;

  const el = document.getElementById('bill-totals');
  if (el) {
    el.innerHTML = `
      <div class="totals-row"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
      ${discountAmt > 0 ? `<div class="totals-row" style="color:#f97316"><span>Discount${discountPct > 0 ? ` (${discountPct}%)` : ''}</span><span>−${formatCurrency(discountAmt)}</span></div>` : ''}
      ${discountAmt > 0 ? `<div class="totals-row"><span>Taxable Amount</span><span>${formatCurrency(taxableAmount)}</span></div>` : ''}
      <div class="totals-row"><span>CGST (${gstRate / 2}%)</span><span>${formatCurrency(cgst)}</span></div>
      <div class="totals-row"><span>SGST (${gstRate / 2}%)</span><span>${formatCurrency(sgst)}</span></div>
      ${roundOff !== 0 ? `<div class="totals-row"><span>Round Off</span><span>${roundOff >= 0 ? '+' : ''}${formatCurrency(roundOff)}</span></div>` : ''}
      <div class="totals-row total"><span>Grand Total</span><span>${formatCurrency(total)}</span></div>
    `;
  }
}

function renderLineItems() {
  const container = document.getElementById('line-items-list');
  if (!container) return;

  container.innerHTML = lineItems.map((item, idx) => `
    <div class="line-item-row" data-idx="${idx}">
      <input type="text" class="form-input li-desc" placeholder="Item description" value="${item.description}">
      <input type="number" class="form-input li-qty" placeholder="Qty" value="${item.qty}" min="0" step="0.5" style="width:70px">
      <select class="form-input li-unit" style="width:70px">
        <option value="pcs" ${item.unit === 'pcs' ? 'selected' : ''}>pcs</option>
        <option value="kg" ${item.unit === 'kg' ? 'selected' : ''}>kg</option>
        <option value="ltr" ${item.unit === 'ltr' ? 'selected' : ''}>ltr</option>
        <option value="box" ${item.unit === 'box' ? 'selected' : ''}>box</option>
        <option value="pack" ${item.unit === 'pack' ? 'selected' : ''}>pack</option>
        <option value="dozen" ${item.unit === 'dozen' ? 'selected' : ''}>dozen</option>
        <option value="bag" ${item.unit === 'bag' ? 'selected' : ''}>bag</option>
        <option value="bottle" ${item.unit === 'bottle' ? 'selected' : ''}>bottle</option>
        <option value="can" ${item.unit === 'can' ? 'selected' : ''}>can</option>
      </select>
      <input type="number" class="form-input li-rate" placeholder="Rate (₹)" value="${item.rate || ''}" min="0" step="0.5" style="width:90px">
      <span class="li-amount">${formatCurrency(item.amount)}</span>
      <button class="btn btn-sm btn-danger li-remove" ${lineItems.length <= 1 ? 'disabled' : ''}>✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.line-item-row').forEach(row => {
    const idx = parseInt(row.dataset.idx);
    row.querySelector('.li-desc')?.addEventListener('input', (e) => { lineItems[idx].description = e.target.value; });
    row.querySelector('.li-qty')?.addEventListener('input', (e) => {
      lineItems[idx].qty = parseFloat(e.target.value) || 0;
      lineItems[idx].amount = lineItems[idx].qty * lineItems[idx].rate;
      row.querySelector('.li-amount').textContent = formatCurrency(lineItems[idx].amount);
      calcTotals();
    });
    row.querySelector('.li-unit')?.addEventListener('change', (e) => { lineItems[idx].unit = e.target.value; });
    row.querySelector('.li-rate')?.addEventListener('input', (e) => {
      lineItems[idx].rate = parseFloat(e.target.value) || 0;
      lineItems[idx].amount = lineItems[idx].qty * lineItems[idx].rate;
      row.querySelector('.li-amount').textContent = formatCurrency(lineItems[idx].amount);
      calcTotals();
    });
    row.querySelector('.li-remove')?.addEventListener('click', () => {
      if (lineItems.length > 1) { lineItems.splice(idx, 1); renderLineItems(); calcTotals(); }
    });
  });
}

export function render(container) {
  lineItems = [{ description: '', qty: 1, unit: 'pcs', rate: 0, amount: 0 }];
  selectedShift = detectShift();
  currentMode = null;

  container.innerHTML = `
    <div class="fade-up" style="max-width:900px">
      <!-- Upload Options — the 3 clean choices -->
      <div class="glass-card mb-3" id="upload-options-section">
        <h3 class="section-title" style="margin-bottom:4px">📤 Submit Bill</h3>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px">Choose how you'd like to add an expense</p>

        <div class="upload-options-grid">
          <!-- Gallery / Files -->
          <label class="upload-option-card" id="opt-gallery">
            <input type="file" accept="image/*" multiple class="upload-hidden-input" id="gallery-input">
            <div class="upload-option-icon">🖼️</div>
            <div class="upload-option-title">Upload from Gallery</div>
            <div class="upload-option-hint">Select one or more bill images</div>
          </label>

          <!-- Take Photo -->
          <label class="upload-option-card" id="opt-camera">
            <input type="file" accept="image/*" capture="environment" class="upload-hidden-input" id="camera-input">
            <div class="upload-option-icon">📷</div>
            <div class="upload-option-title">Take a Photo</div>
            <div class="upload-option-hint">Opens your camera</div>
          </label>

          <!-- Manual Entry -->
          <button class="upload-option-card" id="opt-manual">
            <div class="upload-option-icon">⌨️</div>
            <div class="upload-option-title">Enter Manually</div>
            <div class="upload-option-hint">Type bill details yourself</div>
          </button>
        </div>
      </div>

      <!-- Upload Preview (shown after selecting images) -->
      <div class="glass-card mb-3" id="upload-preview-section" style="display:none">
        <div class="flex items-center justify-between mb-2">
          <h3 class="section-title" style="margin-bottom:0">📎 Selected Bills</h3>
          <button class="btn btn-sm" id="clear-selection" style="color:var(--text-muted)">✕ Clear</button>
        </div>
        <div id="image-previews" class="image-preview-grid"></div>
        <button class="btn btn-primary btn-lg" id="upload-now-btn" style="width:100%;margin-top:16px;min-height:52px;font-size:16px;background:linear-gradient(135deg,#10b981,#059669)">
          📤 Upload & Process
        </button>
        <p style="color:var(--text-muted);font-size:12px;text-align:center;margin-top:8px">
          Bills will be processed by AI in the background — you don't need to wait
        </p>
      </div>

      <!-- Upload Success State -->
      <div class="glass-card mb-3" id="upload-success-section" style="display:none">
        <div style="text-align:center;padding:32px 16px">
          <div style="font-size:48px;margin-bottom:12px">✅</div>
          <h3 style="color:var(--text-primary);margin-bottom:8px" id="success-title">Bills Uploaded!</h3>
          <p style="color:var(--text-muted);font-size:14px" id="success-subtitle">Processing in background. Check My Expenses in a minute.</p>
          <div style="margin-top:24px;display:flex;gap:12px;justify-content:center">
            <button class="btn btn-primary" id="upload-more-btn">📤 Upload More</button>
            <button class="btn" id="view-expenses-btn">📋 My Expenses</button>
          </div>
        </div>
      </div>

      <!-- Manual Entry Form (hidden by default) -->
      <div id="manual-form-wrapper" style="display:none">
        <div class="glass-card mb-3" id="form-section">
          <h3 class="section-title">📝 Bill Details</h3>
          <form id="bill-form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Vendor Name *</label>
                <input type="text" class="form-input" id="bill-vendor" placeholder="e.g. Ram Vegetables" required>
              </div>
              <div class="form-group">
                <label class="form-label">Bill Date *</label>
                <input type="date" class="form-input" id="bill-date" value="${todayStr()}" required>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Bill / Invoice Number</label>
                <input type="text" class="form-input" id="bill-number" placeholder="e.g. INV-4821">
              </div>
              <div class="form-group">
                <label class="form-label">Vendor GSTIN</label>
                <input type="text" class="form-input" id="bill-vendor-gstin" placeholder="e.g. 29AABCT1234D1ZM">
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Category *</label>
                <select class="form-input" id="bill-category" required>
                  ${categories.map(c => `<option value="${c.key}">${c.icon} ${c.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label class="form-label">Payment Mode *</label>
                <select class="form-input" id="bill-payment" required>
                  <option value="cash">💵 Cash</option>
                  <option value="upi">📱 UPI</option>
                  <option value="card">💳 Card</option>
                  <option value="credit">📝 Credit</option>
                </select>
              </div>
            </div>
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">HSN Code</label>
                <input type="text" class="form-input" id="bill-hsn" placeholder="Optional">
              </div>
              <div class="form-group">
                <label class="form-label">Vendor Contact</label>
                <input type="text" class="form-input" id="bill-vendor-contact" placeholder="+91...">
              </div>
            </div>
            <div id="shift-mount"></div>
          </form>
        </div>

        <!-- Line Items -->
        <div class="glass-card mb-3" id="items-section">
          <div class="flex items-center justify-between mb-2">
            <h3 class="section-title" style="margin-bottom:0">📋 Line Items</h3>
            <button class="btn btn-sm btn-primary" id="add-line-item">+ Add Item</button>
          </div>
          <div class="line-items-header">
            <span>Description</span><span>Qty</span><span>Unit</span><span>Rate (₹)</span><span>Amount</span><span></span>
          </div>
          <div id="line-items-list"></div>
        </div>

        <!-- Discount -->
        <div class="glass-card mb-3" id="discount-section">
          <h3 class="section-title">🏷️ Discount</h3>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Discount %</label>
              <input type="number" class="form-input" id="bill-discount-pct" placeholder="e.g. 30" min="0" max="100" step="0.5" value="0">
            </div>
            <div class="form-group">
              <label class="form-label">Discount Amount (₹)</label>
              <input type="number" class="form-input" id="bill-discount-amt" placeholder="e.g. 166.86" min="0" step="0.01" value="0">
            </div>
          </div>
        </div>

        <!-- GST & Totals -->
        <div class="glass-card mb-3" id="gst-section">
          <h3 class="section-title">💰 GST & Totals</h3>
          <div class="form-row">
            <div class="form-group" style="max-width:160px">
              <label class="form-label">GST Rate (%)</label>
              <select class="form-input" id="bill-gst-rate">
                <option value="0">0%</option>
                <option value="5" selected>5%</option>
                <option value="12">12%</option>
                <option value="18">18%</option>
                <option value="28">28%</option>
              </select>
            </div>
            <div class="form-group" style="max-width:140px">
              <label class="form-label">CGST (₹)</label>
              <input type="number" class="form-input" id="bill-cgst-amt" placeholder="Auto" min="0" step="0.01" value="">
            </div>
            <div class="form-group" style="max-width:140px">
              <label class="form-label">SGST (₹)</label>
              <input type="number" class="form-input" id="bill-sgst-amt" placeholder="Auto" min="0" step="0.01" value="">
            </div>
            <div class="form-group" style="max-width:120px">
              <label class="form-label">Round Off</label>
              <input type="number" class="form-input" id="bill-round-off" placeholder="0" step="0.01" value="">
            </div>
          </div>
          <div id="bill-totals" class="totals-section"></div>
        </div>

        <!-- Submit -->
        <div class="flex items-center" style="gap:12px">
          <button class="btn btn-primary btn-lg" id="submit-bill" style="min-height:48px">📤 Submit Expense Bill</button>
          <button class="btn btn-lg" id="cancel-manual">← Back</button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  const selectedFiles = [];

  // === GALLERY OPTION ===
  document.getElementById('gallery-input')?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    selectedFiles.length = 0;
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        selectedFiles.push(file);
      }
    }

    if (selectedFiles.length === 0) {
      showToast('No valid images selected', 'error');
      return;
    }

    showImagePreviews(selectedFiles);
  });

  // === CAMERA OPTION ===
  document.getElementById('camera-input')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;

    selectedFiles.length = 0;
    selectedFiles.push(file);
    showImagePreviews(selectedFiles);
  });

  // === SHOW IMAGE PREVIEWS ===
  function showImagePreviews(files) {
    currentMode = 'gallery';
    document.getElementById('upload-options-section').style.display = 'none';
    document.getElementById('upload-preview-section').style.display = 'block';

    const grid = document.getElementById('image-previews');
    grid.innerHTML = '';

    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';
        div.innerHTML = `
          <img src="${e.target.result}" alt="Bill ${idx + 1}">
          <div class="image-preview-label">${file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name}</div>
        `;
        grid.appendChild(div);
      };
      reader.readAsDataURL(file);
    });
  }

  // === DUPLICATE ACTION MODAL ===
  function showDuplicateModal(duplicates, savedCount, failedScans, otherFailed) {
    // Remove existing modal if any
    document.getElementById('dup-modal-overlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'dup-modal-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px';

    overlay.innerHTML = `
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:16px;max-width:480px;width:100%;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.5)">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
          <div style="font-size:32px">🔄</div>
          <div>
            <div style="font-size:16px;font-weight:700;color:var(--text-primary)">Duplicate Bill${duplicates.length > 1 ? 's' : ''} Detected</div>
            <div style="font-size:13px;color:var(--text-muted)">${duplicates.length} bill${duplicates.length > 1 ? 's were' : ' was'} already uploaded before</div>
          </div>
        </div>

        <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:20px">
          ${duplicates.map((d, i) => `
            <div style="background:var(--bg-secondary);border-radius:10px;padding:12px;border-left:3px solid #f97316">
              <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:4px">📄 ${d.file || `Bill ${i + 1}`}</div>
              <div style="font-size:12px;color:var(--text-muted)">${d.message || 'This image matches a bill already on file.'}</div>
              <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
                <button class="btn btn-sm btn-danger dup-delete-btn" data-id="${d.duplicate_id}" data-idx="${i}" style="font-size:12px">🗑️ Delete Duplicate</button>
                <button class="btn btn-sm dup-pending-btn" data-id="${d.duplicate_id}" data-idx="${i}" style="font-size:12px;background:var(--amber);color:#000">⏳ Move to Pending</button>
                <button class="btn btn-sm dup-hold-btn" data-id="${d.duplicate_id}" data-idx="${i}" style="font-size:12px">🔒 Hold for Review</button>
              </div>
            </div>
          `).join('')}
        </div>

        <div style="display:flex;gap:10px">
          <button id="dup-dismiss-btn" class="btn btn-sm" style="flex:1;color:var(--text-muted)">Dismiss — Keep As Is</button>
        </div>

        ${savedCount > 0 ? `<div style="margin-top:12px;font-size:12px;color:var(--success);text-align:center">✅ ${savedCount} bill${savedCount !== 1 ? 's' : ''} saved successfully</div>` : ''}
      </div>
    `;

    document.body.appendChild(overlay);

    // Wire up buttons
    overlay.querySelectorAll('.dup-delete-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Deleting...';
        try {
          await billsApi.delete(id);
          btn.closest('div[style*="border-left"]').innerHTML = `<div style="color:var(--success);font-size:13px">✅ Deleted successfully</div>`;
        } catch (e) {
          showToast('Delete failed: ' + e.message, 'error');
          btn.disabled = false;
          btn.textContent = '🗑️ Delete Duplicate';
        }
      });
    });

    overlay.querySelectorAll('.dup-pending-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Moving...';
        try {
          await billsApi.update(id, { status: 'pending' });
          btn.closest('div[style*="border-left"]').innerHTML = `<div style="color:var(--amber);font-size:13px">⏳ Moved to Pending — manager will review</div>`;
        } catch (e) {
          showToast('Failed: ' + e.message, 'error');
          btn.disabled = false;
          btn.textContent = '⏳ Move to Pending';
        }
      });
    });

    overlay.querySelectorAll('.dup-hold-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        btn.disabled = true;
        btn.textContent = 'Holding...';
        try {
          await billsApi.update(id, { status: 'on_hold', owner_notes: 'Held for review — possible duplicate' });
          btn.closest('div[style*="border-left"]').innerHTML = `<div style="color:var(--purple);font-size:13px">🔒 On Hold — will check later</div>`;
        } catch (e) {
          showToast('Failed: ' + e.message, 'error');
          btn.disabled = false;
          btn.textContent = '🔒 Hold for Review';
        }
      });
    });

    document.getElementById('dup-dismiss-btn')?.addEventListener('click', () => overlay.remove());
  }

  // === UPLOAD NOW ===
  document.getElementById('upload-now-btn')?.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
      showToast('No images to upload', 'error');
      return;
    }

    const btn = document.getElementById('upload-now-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="ai-loading-spinner" style="width:20px;height:20px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px"></div> Processing with AI...';

    try {
      const formData = new FormData();
      for (const file of selectedFiles) {
        const compressed = await compressImage(file);
        formData.append('images', compressed);
      }

      const result = await billsApi.uploadAsync(formData);
      const items = result?.bills || [];
      const saved = items.filter(b => b.status === 'saved').length;
      const duplicates = items.filter(b => b.status === 'duplicate');
      const failedScans = items.filter(b => b.status === 'failed_scan');
      const otherFailed = items.filter(b => b.status === 'failed');

      document.getElementById('upload-preview-section').style.display = 'none';
      document.getElementById('upload-success-section').style.display = 'block';

      const parts = [];
      if (saved) parts.push(`${saved} saved`);
      if (duplicates.length) parts.push(`${duplicates.length} duplicate`);
      if (failedScans.length) parts.push(`${failedScans.length} need manual entry (scan failed)`);
      if (otherFailed.length) parts.push(`${otherFailed.length} failed`);

      document.getElementById('success-title').textContent =
        duplicates.length || failedScans.length || otherFailed.length ? 'Upload finished — check details' : `${saved} Bill${saved !== 1 ? 's' : ''} Saved!`;
      document.getElementById('success-subtitle').textContent = parts.join(', ') || 'Bills have been extracted and saved successfully.';
      selectedFiles.length = 0;

      // Show inline duplicate modal immediately if duplicates found
      if (duplicates.length > 0) {
        showDuplicateModal(duplicates, saved, failedScans, otherFailed);
      } else if (failedScans.length || otherFailed.length) {
        showToast(`⚠️ ${parts.join(', ')}`, 'info');
      } else {
        showToast(`✅ ${saved} bill(s) saved!`, 'success');
      }
    } catch (err) {
      showToast('Upload failed: ' + err.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '📤 Upload & Process';
    }
  });

  // === CLEAR SELECTION ===
  document.getElementById('clear-selection')?.addEventListener('click', () => {
    selectedFiles.length = 0;
    document.getElementById('upload-preview-section').style.display = 'none';
    document.getElementById('upload-options-section').style.display = 'block';
    // Reset file inputs
    document.getElementById('gallery-input').value = '';
    document.getElementById('camera-input').value = '';
  });

  // === UPLOAD MORE ===
  document.getElementById('upload-more-btn')?.addEventListener('click', () => {
    document.getElementById('upload-success-section').style.display = 'none';
    document.getElementById('upload-options-section').style.display = 'block';
    document.getElementById('gallery-input').value = '';
    document.getElementById('camera-input').value = '';
  });

  // === VIEW EXPENSES ===
  document.getElementById('view-expenses-btn')?.addEventListener('click', () => {
    window.location.hash = 'myExpenses';
  });

  // === MANUAL ENTRY ===
  document.getElementById('opt-manual')?.addEventListener('click', () => {
    currentMode = 'manual';
    document.getElementById('upload-options-section').style.display = 'none';
    document.getElementById('manual-form-wrapper').style.display = 'block';
    renderLineItems();
    calcTotals();

    // Shift selector
    const shiftMount = document.getElementById('shift-mount');
    if (shiftMount) renderShiftSelector(shiftMount, { currentShift: selectedShift, onChange: (s) => { selectedShift = s; } });
  });

  // === CANCEL MANUAL ===
  document.getElementById('cancel-manual')?.addEventListener('click', () => {
    document.getElementById('manual-form-wrapper').style.display = 'none';
    document.getElementById('upload-options-section').style.display = 'block';
  });

  // === MANUAL FORM EVENTS ===
  document.getElementById('add-line-item')?.addEventListener('click', () => {
    lineItems.push({ description: '', qty: 1, unit: 'pcs', rate: 0, amount: 0 });
    renderLineItems();
  });

  document.getElementById('bill-gst-rate')?.addEventListener('change', () => {
    const cgstEl = document.getElementById('bill-cgst-amt');
    const sgstEl = document.getElementById('bill-sgst-amt');
    if (cgstEl) cgstEl.value = '';
    if (sgstEl) sgstEl.value = '';
    calcTotals();
  });

  document.getElementById('bill-discount-pct')?.addEventListener('input', () => {
    document.getElementById('bill-discount-amt').value = '';
    document.getElementById('bill-cgst-amt').value = '';
    document.getElementById('bill-sgst-amt').value = '';
    calcTotals();
  });

  document.getElementById('bill-discount-amt')?.addEventListener('input', calcTotals);
  document.getElementById('bill-cgst-amt')?.addEventListener('input', calcTotals);
  document.getElementById('bill-sgst-amt')?.addEventListener('input', calcTotals);
  document.getElementById('bill-round-off')?.addEventListener('input', calcTotals);

  // === SUBMIT MANUAL BILL ===
  document.getElementById('submit-bill')?.addEventListener('click', async () => {
    const vendor = document.getElementById('bill-vendor')?.value.trim();
    const date = document.getElementById('bill-date')?.value;
    const category = document.getElementById('bill-category')?.value;
    const payment = document.getElementById('bill-payment')?.value;

    if (!vendor) { showToast('Please enter vendor name', 'error'); return; }
    if (!date) { showToast('Please select bill date', 'error'); return; }

    const validItems = lineItems.filter(i => i.description && i.amount > 0);
    if (validItems.length === 0) { showToast('Please add at least one line item with amount', 'error'); return; }

    const subtotal = validItems.reduce((s, i) => s + i.amount, 0);
    const discountPct = parseFloat(document.getElementById('bill-discount-pct')?.value || 0);
    const discountAmt = parseFloat(document.getElementById('bill-discount-amt')?.value || 0);
    const taxableAmount = subtotal - discountAmt;
    const gstRate = parseFloat(document.getElementById('bill-gst-rate')?.value || 0);
    const cgst = parseFloat(document.getElementById('bill-cgst-amt')?.value || 0);
    const sgst = parseFloat(document.getElementById('bill-sgst-amt')?.value || 0);
    const roundOff = parseFloat(document.getElementById('bill-round-off')?.value || 0);
    const total = taxableAmount + cgst + sgst + roundOff;

    const submitBtn = document.getElementById('submit-bill');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Submitting...';

    try {
      await billsApi.createJSON({
        vendor_name: vendor, bill_date: date,
        bill_number: document.getElementById('bill-number')?.value.trim() || '',
        vendor_gstin: document.getElementById('bill-vendor-gstin')?.value.trim() || '',
        vendor_contact: document.getElementById('bill-vendor-contact')?.value.trim() || '',
        hsn_code: document.getElementById('bill-hsn')?.value.trim() || '',
        category, payment_mode: payment,
        items: validItems, subtotal, discount_percent: discountPct,
        discount_amount: discountAmt, taxable_amount: taxableAmount,
        gst_rate: gstRate, cgst, sgst, round_off: roundOff, total_amount: total,
        shift: selectedShift, is_manual: true,
        ai_confidence: {},
      });

      showToast(`✅ Bill saved! — ${formatCurrency(total)}`, 'success');

      // Show success state
      document.getElementById('manual-form-wrapper').style.display = 'none';
      document.getElementById('upload-success-section').style.display = 'block';
      document.getElementById('success-title').textContent = 'Bill Saved!';
      document.getElementById('success-subtitle').textContent = `${vendor} — ${formatCurrency(total)}`;
    } catch (err) {
      showToast('Failed to submit: ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = '📤 Submit Expense Bill';
    }
  });
}

export function cleanup() { currentMode = null; }