// ============================================
// Vendors Page v2.0 — API-based
// ============================================

import { vendors as vendorsApi } from '../services/api.js';
import { formatCurrency } from '../data/store.js';
import { showToast } from '../components/toast.js';

let _vendors = [];

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <div class="filters-bar">
        <div class="search-container"><span class="search-icon">🔍</span><input type="text" class="search-input" id="vendor-search" placeholder="Search vendors..."></div>
      </div>
      <div id="vendors-grid" class="recipe-grid">
        <div class="skeleton-row"></div>
      </div>
    </div>
  `;
}

export async function init() {
  try {
    _vendors = await vendorsApi.list();
    renderVendors();
  } catch (err) {
    document.getElementById('vendors-grid').innerHTML = `<div class="empty-state-small">Failed to load: ${err.message}</div>`;
  }

  document.getElementById('vendor-search')?.addEventListener('input', () => renderVendors());
}

function renderVendors() {
  const query = document.getElementById('vendor-search')?.value.toLowerCase().trim() || '';
  let filtered = query ? _vendors.filter(v => (v.name || '').toLowerCase().includes(query) || (v.category || '').toLowerCase().includes(query)) : _vendors;

  const grid = document.getElementById('vendors-grid');
  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state"><div class="empty-icon">🏭</div><h3>No vendors yet</h3><p>Vendors are auto-created when bills are submitted.</p></div>`;
    return;
  }

  filtered.sort((a, b) => (b.total_spend || 0) - (a.total_spend || 0));
  grid.innerHTML = filtered.map(v => `
    <div class="recipe-card">
      <div class="recipe-header">
        <h4 class="recipe-name">${v.name}</h4>
        <span class="badge ${v.preferred_status === 'preferred' ? 'badge-success' : v.preferred_status === 'blacklisted' ? 'badge-danger' : 'badge-muted'}">${v.preferred_status || 'neutral'}</span>
      </div>
      <div class="recipe-details">
        <div class="recipe-stat"><span class="recipe-stat-label">Total Spend</span><span class="recipe-stat-value">${formatCurrency(v.total_spend || 0)}</span></div>
        <div class="recipe-stat"><span class="recipe-stat-label">Bill Count</span><span class="recipe-stat-value">${v.bill_count || 0}</span></div>
        <div class="recipe-stat"><span class="recipe-stat-label">Avg Bill</span><span class="recipe-stat-value">${formatCurrency(v.avg_bill || 0)}</span></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:8px">
        ${v.category ? `Category: ${v.category}` : ''} ${v.gstin ? `· GSTIN: ${v.gstin}` : ''} ${v.contact ? `· ${v.contact}` : ''}
      </div>
      ${v.payment_terms ? `<div style="font-size:11px;color:var(--text-muted)">Terms: ${v.payment_terms}</div>` : ''}
    </div>
  `).join('');
}

export function cleanup() { _vendors = []; }
