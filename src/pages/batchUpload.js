// ============================================
// Batch Upload Page — Multi-bill capture
// Spec §4.5: Up to 20 bills in one session
// ============================================

import { bills as billsApi } from '../services/api.js';
import { formatCurrency, todayStr } from '../data/store.js';
import { showToast } from '../components/toast.js';

let batchItems = []; // { id, file, dataUrl, status: 'queued'|'extracting'|'ready'|'error'|'submitted', extracted: {}, error: '' }
let batchIdCounter = 0;
let _isProcessingQueue = false;

export function render(container) {
  container.innerHTML = `
    <div class="fade-up" style="max-width:700px">
      <h3 class="section-title">📷 Batch Upload</h3>
      <p style="color:var(--text-muted);margin-bottom:16px;font-size:13px">Photograph up to 20 bills at once. AI extracts all details automatically.</p>

      <!-- Add Images -->
      <div class="glass-card mb-3">
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <label class="btn btn-primary btn-lg" style="cursor:pointer;flex:1;min-width:150px;text-align:center">
            📷 Add Bill Photos
            <input type="file" accept="image/*" multiple id="batch-file-input" style="display:none" capture="environment">
          </label>
          <label class="btn btn-outline btn-lg" style="cursor:pointer;flex:1;min-width:150px;text-align:center">
            🖼️ Pick from Gallery
            <input type="file" accept="image/*" multiple id="batch-gallery-input" style="display:none">
          </label>
        </div>
      </div>

      <!-- Progress Grid -->
      <div id="batch-grid" class="batch-grid"></div>

      <!-- Summary + Submit All -->
      <div id="batch-actions" style="display:none;margin-top:16px">
        <div id="batch-summary" style="margin-bottom:12px"></div>
        <div style="display:flex;gap:12px">
          <button class="btn btn-primary btn-lg" id="submit-all-btn" style="flex:1;min-height:48px">📤 Submit All Ready Bills</button>
          <button class="btn btn-outline" id="clear-batch-btn">🗑️ Clear All</button>
        </div>
      </div>
    </div>
  `;
}

export function init() {
  batchItems = [];
  batchIdCounter = 0;

  document.getElementById('batch-file-input')?.addEventListener('change', handleFiles);
  document.getElementById('batch-gallery-input')?.addEventListener('change', handleFiles);
  document.getElementById('submit-all-btn')?.addEventListener('click', submitAll);
  document.getElementById('clear-batch-btn')?.addEventListener('click', () => {
    batchItems = [];
    renderGrid();
    showToast('Batch cleared', 'info');
  });
}

async function getFileHash(file) {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function handleFiles(e) {
  const files = Array.from(e.target.files);
  if (files.length === 0) return;
  if (batchItems.length + files.length > 20) {
    showToast('Maximum 20 bills per batch', 'error');
    return;
  }

  // Hash all incoming files and check against already-queued items
  const existingHashes = new Set(batchItems.map(b => b.fileHash).filter(Boolean));
  const newFiles = [];
  let skippedCount = 0;

  for (const file of files) {
    const hash = await getFileHash(file);
    if (existingHashes.has(hash)) {
      skippedCount++;
    } else {
      existingHashes.add(hash);
      newFiles.push({ file, hash });
    }
  }

  if (skippedCount > 0) {
    showToast(
      `${skippedCount} duplicate bill image${skippedCount > 1 ? 's were' : ' was'} detected and skipped. This bill has already been added to the current batch.`,
      'warning'
    );
  }
  if (newFiles.length === 0) return;

  let remaining = newFiles.length;
  newFiles.forEach(({ file, hash }) => {
    const id = `batch-${++batchIdCounter}`;
    const reader = new FileReader();
    reader.onload = (ev) => {
      batchItems.push({
        id, file, fileHash: hash, dataUrl: ev.target.result,
        status: 'queued', extracted: {}, error: '',
      });
      renderGrid();
      remaining--;
      if (remaining === 0) {
        processQueue();
      }
    };
    reader.readAsDataURL(file);
  });
  e.target.value = '';
}

async function processQueue() {
  if (_isProcessingQueue) return;
  _isProcessingQueue = true;
  try {
    let next = batchItems.find(b => b.status === 'queued');
    while (next) {
      await extractBill(next.id);
      next = batchItems.find(b => b.status === 'queued');
    }
  } finally {
    _isProcessingQueue = false;
  }
}

async function extractBill(id) {
  const item = batchItems.find(b => b.id === id);
  if (!item) return;

  item.status = 'extracting';
  renderGrid();

  try {
    const formData = new FormData();
    formData.append('image', item.file);
    const result = await billsApi.extract(formData);
    if (result.failed || !result.extracted) {
      item.status = 'error';
      item.error = result.error || 'AI could not read this bill after 3 attempts';
    } else {
      item.extracted = result.extracted;
      item.status = 'ready';
    }
  } catch (err) {
    item.status = 'error';
    item.error = err.message;
  }
  renderGrid();
}

function renderGrid() {
  const grid = document.getElementById('batch-grid');
  const actions = document.getElementById('batch-actions');
  const summary = document.getElementById('batch-summary');

  if (batchItems.length === 0) {
    grid.innerHTML = '';
    actions.style.display = 'none';
    return;
  }

  actions.style.display = 'block';

  const readyCount = batchItems.filter(b => b.status === 'ready').length;
  const extractingCount = batchItems.filter(b => b.status === 'extracting').length;
  const errorCount = batchItems.filter(b => b.status === 'error').length;
  const submittedCount = batchItems.filter(b => b.status === 'submitted').length;
  const duplicateCount = batchItems.filter(b => b.status === 'duplicate').length;
  const readyTotal = batchItems.filter(b => b.status === 'ready').reduce((s, b) => s + (b.extracted.total_amount || 0), 0);

  summary.innerHTML = `
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <span class="badge badge-info">${batchItems.length} total</span>
      ${readyCount > 0 ? `<span class="badge badge-success">${readyCount} ready · ${formatCurrency(readyTotal)}</span>` : ''}
      ${extractingCount > 0 ? `<span class="badge badge-pending">${extractingCount} extracting...</span>` : ''}
      ${errorCount > 0 ? `<span class="badge badge-danger">${errorCount} failed</span>` : ''}
      ${duplicateCount > 0 ? `<span class="badge badge-warning" style="background:var(--accent-orange,#f59e0b);color:#fff">${duplicateCount} duplicate${duplicateCount > 1 ? 's' : ''} blocked</span>` : ''}
      ${submittedCount > 0 ? `<span class="badge badge-muted">${submittedCount} submitted</span>` : ''}
    </div>
  `;

  const statusIcons = { queued: '⏳', extracting: '🔄', ready: '✅', error: '❌', submitted: '📤', duplicate: '🔁' };
  const statusColors = { queued: 'var(--text-muted)', extracting: 'var(--accent-blue)', ready: 'var(--accent-green)', error: 'var(--accent-red)', submitted: 'var(--text-muted)', duplicate: 'var(--accent-orange, #f59e0b)' };

  grid.innerHTML = batchItems.map(item => `
    <div class="batch-item ${item.status}" data-id="${item.id}" style="border-left:3px solid ${statusColors[item.status]}">
      <div style="display:flex;gap:12px;align-items:center">
        <img src="${item.dataUrl}" alt="" style="width:50px;height:50px;object-fit:cover;border-radius:6px">
        <div style="flex:1;min-width:0">
          <div style="font-weight:600;font-size:14px">
            ${item.status === 'ready' ? (item.extracted.vendor_name || 'Unknown Vendor') :
      item.status === 'duplicate' ? '🔁 Duplicate Bill Detected' :
        statusIcons[item.status] + ' ' + item.status}
          </div>
          ${item.status === 'ready' ? `
            <div style="font-size:12px;color:var(--text-muted)">${item.extracted.category || '—'} · ${item.extracted.payment_mode || '—'}</div>
          ` : ''}
          ${item.status === 'duplicate' ? `
            <div style="font-size:11px;color:var(--accent-orange,#f59e0b);margin-top:2px">
              This bill image has already been submitted. Duplicate entries are not permitted to prevent double accounting.
            </div>
          ` : ''}
          ${item.status === 'error' ? `<div style="font-size:11px;color:var(--accent-red)">${item.error}</div>` : ''}
        </div>
        <div style="text-align:right">
          ${item.status === 'ready' ? `<div style="font-size:16px;font-weight:700">${formatCurrency(item.extracted.total_amount || 0)}</div>` : ''}
          ${item.status === 'duplicate' ? `<div style="font-size:11px;color:var(--accent-orange,#f59e0b);font-weight:600">BLOCKED</div>` : ''}
          ${item.status === 'error' ? `<button class="btn btn-sm retry-btn" data-id="${item.id}">🔄 Retry</button>` : ''}
          ${item.status !== 'submitted' ? `<button class="btn btn-sm btn-danger remove-btn" data-id="${item.id}" style="margin-top:4px">✕</button>` : ''}
        </div>
      </div>
    </div>
  `).join('');

  // Retry buttons
  grid.querySelectorAll('.retry-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (_isProcessingQueue) {
        showToast('Still processing other bills — please wait', 'info');
        return;
      }
      extractBill(btn.dataset.id);
    });
  });
  // Remove buttons
  grid.querySelectorAll('.remove-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      batchItems = batchItems.filter(b => b.id !== btn.dataset.id);
      renderGrid();
    });
  });
}

async function submitAll() {
  const readyItems = batchItems.filter(b => b.status === 'ready');
  if (readyItems.length === 0) return showToast('No bills ready to submit', 'error');

  const btn = document.getElementById('submit-all-btn');
  btn.disabled = true;
  btn.textContent = `Submitting ${readyItems.length} bills...`;

  let successCount = 0;
  for (const item of readyItems) {
    try {
      const formData = new FormData();
      formData.append('image', item.file);
      const ext = item.extracted;
      formData.append('vendor_name', ext.vendor_name || 'Unknown');
      formData.append('bill_date', ext.bill_date || todayStr());
      formData.append('category', ext.category || 'miscellaneous');
      formData.append('payment_mode', ext.payment_mode || 'cash');
      formData.append('total_amount', ext.total_amount || 0);
      formData.append('subtotal', ext.subtotal || ext.total_amount || 0);
      formData.append('gst_rate', ext.gst_rate || 0);
      formData.append('cgst', ext.cgst || 0);
      formData.append('sgst', ext.sgst || 0);
      formData.append('items', JSON.stringify(ext.items || []));
      formData.append('ai_confidence', JSON.stringify(ext.confidence || {}));
      formData.append('is_manual', 'false');

      const result = await billsApi.create(formData);
      // Check if backend returned a duplicate response (some API wrappers don't throw on 409)
      if (result?.error === 'duplicate_image') {
        item.status = 'duplicate';
        item.error = result.message || 'This bill has already been submitted previously.';
      } else {
        item.status = 'submitted';
        successCount++;
      }
    } catch (err) {
      if (err.status === 409 || err.message?.includes('duplicate_image')) {
        item.status = 'duplicate';
        item.error = 'This bill has already been submitted. Duplicate entries are not permitted.';
      } else {
        item.status = 'error';
        item.error = err.message;
      }
    }
    renderGrid();
  }

  btn.disabled = false;
  btn.textContent = '📤 Submit All Ready Bills';

  const duplicateItems = batchItems.filter(b => b.status === 'duplicate');
  if (duplicateItems.length > 0) {
    showToast(
      `${duplicateItems.length} duplicate bill${duplicateItems.length > 1 ? 's were' : ' was'} blocked to prevent double accounting.`,
      'warning'
    );
  }
  showToast(
    `${successCount} of ${readyItems.length} bill${readyItems.length > 1 ? 's' : ''} submitted successfully.`,
    successCount > 0 ? 'success' : 'error'
  );
}

export function cleanup() {
  batchItems = [];
  batchIdCounter = 0;
}