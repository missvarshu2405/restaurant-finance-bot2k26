// ============================================
// Notifications Page v2.0 — API-based
// ============================================

import { notifications as notifApi } from '../services/api.js';
import { formatDateTime } from '../data/store.js';
import { showToast } from '../components/toast.js';

let _notifications = [];

export function render(container) {
  container.innerHTML = `
    <div class="fade-up">
      <div class="filters-bar notif-filters-bar">
        <button class="btn btn-sm" id="mark-all-read">✅ Mark All Read</button>
        <div class="filter-group">
          <label class="filter-label">Filter:</label>
          <select class="filter-select" id="notif-filter">
            <option value="all">All</option>
            <option value="unread">Unread</option>
            <option value="budget">Budget Alerts</option>
            <option value="anomaly">Anomalies</option>
            <option value="bill">Bills</option>
          </select>
        </div>
      </div>
      <div id="notifications-list">
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
        <div class="skeleton-row"></div>
      </div>
    </div>
  `;
}

export async function init() {
  try {
    _notifications = await notifApi.list();
    renderList();
  } catch (err) {
    document.getElementById('notifications-list').innerHTML = `<div class="empty-state-small">Failed to load: ${err.message}</div>`;
  }

  document.getElementById('notif-filter')?.addEventListener('change', () => renderList());

  document.getElementById('mark-all-read')?.addEventListener('click', async () => {
    const unreadIds = _notifications.filter(n => !n.read).map(n => n.id);
    if (unreadIds.length === 0) return showToast('No unread notifications', 'info');
    try {
      await notifApi.markRead(unreadIds);
      _notifications.forEach(n => n.read = true);
      renderList();
      showToast('All marked as read ✅', 'success');
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });
}

function renderList() {
  const filter = document.getElementById('notif-filter')?.value || 'all';
  let filtered = [..._notifications];
  if (filter === 'unread') filtered = filtered.filter(n => !n.read);
  else if (filter !== 'all') filtered = filtered.filter(n => (n.type || '').includes(filter));

  const container = document.getElementById('notifications-list');
  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">🔔</div><h3>No notifications</h3><p>${filter === 'unread' ? 'All caught up!' : 'No notifications match this filter'}</p></div>`;
    return;
  }

  const typeIcons = { budget_warning: '⚠️', budget_breach: '🚨', anomaly: '🚩', duplicate: '🔄', scan_failed: '📷', scan_failed_count: '📷', bill_submitted: '📤', system: 'ℹ️', inactivity: '💤', digest: '📊' };

  container.innerHTML = filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map(n => {
    const icon = typeIcons[n.type] || '🔔';
    const unreadClass = n.read ? '' : 'notif-unread';
    return `
      <div class="notif-row ${unreadClass}" data-notif-id="${n.id}">
        <span class="notif-icon">${icon}</span>
        <div class="notif-content">
          <div class="notif-message">${n.message}</div>
          <div class="notif-time">${formatDateTime(n.created_at)}</div>
        </div>
        ${!n.read ? `<button class="btn btn-sm notif-read-btn" data-id="${n.id}">Mark Read</button>` : '<span class="notif-read-badge">✓</span>'}
      </div>
    `;
  }).join('');

  container.querySelectorAll('.notif-read-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        await notifApi.markRead([btn.dataset.id]);
        const n = _notifications.find(x => x.id === btn.dataset.id);
        if (n) n.read = true;
        renderList();
      } catch (err) {
        showToast('Failed', 'error');
      }
    });
  });
}

export function cleanup() { _notifications = []; }
