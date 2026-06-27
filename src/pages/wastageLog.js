// ============================================
// Wastage Log Page — Quick add form
// ============================================

import { wastage as wastageApi } from '../services/api.js';
import { formatCurrency, todayStr } from '../data/store.js';
import { showToast } from '../components/toast.js';

export function render(container) {
  container.innerHTML = `
    <div class="wastage-page">
      <div class="card">
        <h3>🗑️ Log Wastage</h3>
        <div class="wastage-form">
          <div class="form-group">
            <label class="form-label">Item</label>
            <input type="text" class="form-input" id="wastage-item" placeholder="e.g., Tomatoes" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Quantity</label>
              <input type="number" class="form-input" id="wastage-qty" placeholder="2" min="0" step="0.1">
            </div>
            <div class="form-group">
              <label class="form-label">Unit</label>
              <select class="form-input" id="wastage-unit">
                <option value="kg">kg</option>
                <option value="g">grams</option>
                <option value="litre">litres</option>
                <option value="pieces">pieces</option>
                <option value="packets">packets</option>
              </select>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Reason</label>
              <select class="form-input" id="wastage-reason">
                <option value="spoilage">🥀 Spoilage</option>
                <option value="over_prep">🍳 Over-prep</option>
                <option value="dropped">💥 Dropped</option>
                <option value="expired">⏰ Expired</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Est. Cost (₹)</label>
              <input type="number" class="form-input" id="wastage-cost" placeholder="80" min="0">
            </div>
          </div>
          <button class="btn btn-primary" id="add-wastage-btn" style="width:100%">Add Entry ✓</button>
        </div>
      </div>

      <div class="card">
        <div class="card-header-row">
          <h3>Today's Wastage</h3>
          <span class="card-count" id="wastage-total">₹0</span>
        </div>
        <div id="wastage-list" class="wastage-list">
          <div class="skeleton-row"></div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  const today = todayStr();

  // Load today's wastage
  await loadWastageList();

  // Add wastage entry
  document.getElementById('add-wastage-btn')?.addEventListener('click', async () => {
    const item = document.getElementById('wastage-item').value.trim();
    if (!item) return showToast('Enter item name', 'error');

    try {
      await wastageApi.create({
        branch_id: session.branchId,
        item_name: item,
        qty: parseFloat(document.getElementById('wastage-qty').value) || 0,
        unit: document.getElementById('wastage-unit').value,
        reason: document.getElementById('wastage-reason').value,
        estimated_value: parseFloat(document.getElementById('wastage-cost').value) || 0,
      });
      showToast(`${item} logged ✓`, 'success');
      document.getElementById('wastage-item').value = '';
      document.getElementById('wastage-qty').value = '';
      document.getElementById('wastage-cost').value = '';
      await loadWastageList();
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });

  async function loadWastageList() {
    try {
      const entries = await wastageApi.list({ branch_id: session.branchId, date_from: today, date_to: today });
      const totalValue = entries.reduce((sum, w) => sum + (w.estimated_value || 0), 0);
      document.getElementById('wastage-total').textContent = formatCurrency(totalValue);

      const listEl = document.getElementById('wastage-list');
      if (entries.length === 0) {
        listEl.innerHTML = '<div class="empty-state-small">No wastage logged today 🎉</div>';
      } else {
        listEl.innerHTML = entries.map(w => {
          const reasonIcons = { spoilage: '🥀', over_prep: '🍳', dropped: '💥', expired: '⏰' };
          return `
            <div class="wastage-row">
              <div class="wastage-info">
                <span class="wastage-item-name">${reasonIcons[w.reason] || '🗑️'} ${w.item_name}</span>
                <span class="wastage-meta">${w.qty} ${w.unit} · ${w.reason.replace('_', '-')}</span>
              </div>
              <span class="wastage-cost">${formatCurrency(w.estimated_value)}</span>
            </div>
          `;
        }).join('');
      }
    } catch {
      document.getElementById('wastage-list').innerHTML = '<div class="empty-state-small">Failed to load</div>';
    }
  }
}

export function cleanup() {}
