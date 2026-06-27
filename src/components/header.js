// ============================================
// Header Component v2.0 — API-based
// ============================================

import { branches as branchesApi } from '../services/api.js';
import { getState } from '../data/store.js';

let _branches = [];

export function renderHeader(container, { title, subtitle, session, showBranchFilter, showDateFilter, onBranchChange, onDateRangeChange, onLogout, isMobile }) {
  const state = getState();
  let filtersHtml = '';

  if (showBranchFilter && _branches.length > 0) {
    filtersHtml += `
      <div class="filter-group">
        <label class="filter-label">Branch:</label>
        <select class="filter-select" id="header-branch-filter">
          <option value="all" ${state.selectedBranch === 'all' ? 'selected' : ''}>All Branches</option>
          ${_branches.filter(b => b.is_active !== false).map(b => `
            <option value="${b.id}" ${state.selectedBranch === b.id ? 'selected' : ''}>${b.branch_name}</option>
          `).join('')}
        </select>
      </div>
    `;
  }

  if (showDateFilter && !isMobile) {
    filtersHtml += `
      <div class="filter-group">
        <label class="filter-label">From:</label>
        <input type="date" class="filter-select" id="header-date-start" value="${state.dateRange.start}">
      </div>
      <div class="filter-group">
        <label class="filter-label">To:</label>
        <input type="date" class="filter-select" id="header-date-end" value="${state.dateRange.end}">
      </div>
    `;
  }

  const branchInfo = session?.role === 'manager' && session.branchName
    ? `<span class="badge badge-info" style="margin-left:8px">📍 ${session.branchName}</span>` : '';

  container.innerHTML = `
    <div class="header-left">
      <div>
        <div class="header-title">${title}${branchInfo}</div>
        ${subtitle && !isMobile ? `<div class="header-subtitle">${subtitle}</div>` : ''}
      </div>
    </div>
    <div class="header-right">
      <div class="header-filter">${filtersHtml}</div>
      ${!isMobile ? `<button class="btn btn-sm" id="header-logout-btn" style="margin-left:12px;color:var(--accent-red)">🚪 Logout</button>` : ''}
    </div>
  `;

  const branchFilter = container.querySelector('#header-branch-filter');
  if (branchFilter && onBranchChange) branchFilter.addEventListener('change', (e) => onBranchChange(e.target.value));

  const dateStart = container.querySelector('#header-date-start');
  const dateEnd = container.querySelector('#header-date-end');
  if (dateStart && dateEnd && onDateRangeChange) {
    dateStart.addEventListener('change', () => onDateRangeChange(dateStart.value, dateEnd.value));
    dateEnd.addEventListener('change', () => onDateRangeChange(dateStart.value, dateEnd.value));
  }

  document.getElementById('header-logout-btn')?.addEventListener('click', () => { if (onLogout) onLogout(); });

  // Fetch branches for filter (async, updates on next render)
  if (showBranchFilter && _branches.length === 0) {
    fetchBranches();
  }
}

async function fetchBranches() {
  try {
    _branches = await branchesApi.list();
  } catch {
    // Use existing
  }
}
