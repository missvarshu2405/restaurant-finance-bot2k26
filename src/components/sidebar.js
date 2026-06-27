// ============================================
// Sidebar Component — Role-based navigation (v2.0)
// Now supports Owner / Manager / Accountant
// Badge counts fetched from API
// ============================================

import { notifications as notifApi, bills as billsApi } from '../services/api.js';
const ownerNav = [
  { section: 'Main', items: [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'branches', icon: '🏪', label: 'Branches' },
  ]},
  { section: 'Finance', items: [
    { id: 'expenses', icon: '📋', label: 'All Expenses' },
    { id: 'vendors', icon: '🏭', label: 'Vendors' },
    { id: 'budgets', icon: '💰', label: 'Budgets' },
    { id: 'recipes', icon: '👨‍🍳', label: 'Recipe Costing' },
  ]},
  { section: 'Insights', items: [
    { id: 'reports', icon: '📊', label: 'Reports' },
    { id: 'anomalies', icon: '🚨', label: 'Flagged' },
    { id: 'notifications', icon: '🔔', label: 'Notifications', hasBadge: true },
  ]},
  { section: 'Admin', items: [
    { id: 'users', icon: '👥', label: 'Managers' },
    { id: 'audit', icon: '📝', label: 'Audit Log' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ]},
];

const managerNav = [
  { section: 'Quick Actions', items: [
    { id: 'upload', icon: '📤', label: 'Upload Bill' },
    { id: 'manager-home', icon: '📊', label: 'Summary' },
  ]},
  { section: 'View', items: [
    { id: 'myExpenses', icon: '📋', label: 'My Expenses', hasFailedScanBadge: true },
    { id: 'mySummary', icon: '📈', label: 'Branch Summary' },
  ]},
  { section: 'Daily Tasks', items: [
    { id: 'staff-attendance', icon: '👥', label: 'Staff Attendance' },
    { id: 'petty-cash', icon: '💰', label: 'Petty Cash' },
    { id: 'wastage-log', icon: '🗑️', label: 'Wastage Log' },
  ]},
  { section: 'System', items: [
    { id: 'audit', icon: '📝', label: 'Activity Log' },
  ]},
];

const accountantNav = [
  { section: 'Main', items: [
    { id: 'dashboard', icon: '🏠', label: 'Dashboard' },
    { id: 'expenses', icon: '📋', label: 'Expenses' },
    { id: 'vendors', icon: '🏭', label: 'Vendors' },
  ]},
  { section: 'Reports', items: [
    { id: 'reports', icon: '📊', label: 'Reports' },
  ]},
];

let _unreadCount = 0;
let _failedScanCount = 0;

export function renderSidebar(container, activePage, onNavigate, session) {
  const role = session?.role || 'owner';
  const navItems = role === 'manager' ? managerNav : role === 'accountant' ? accountantNav : ownerNav;

  let html = `
    <div class="sidebar-logo">
      <div class="sidebar-logo-icon">🍽️</div>
      <div>
        <div class="sidebar-logo-text">RestaurantLedger</div>
        <div class="sidebar-logo-sub">${role === 'owner' ? 'Owner Dashboard' : role === 'manager' ? 'Manager Portal' : 'Accountant View'}</div>
      </div>
    </div>
  `;

  navItems.forEach(section => {
    html += `
      <div class="sidebar-section">
        <div class="sidebar-section-label">${section.section}</div>
        <nav class="sidebar-nav">
    `;
    section.items.forEach(item => {
      const isActive = activePage === item.id;
      let badgeHtml = '';
      if (item.hasBadge && _unreadCount > 0) {
        badgeHtml = `<span class="sidebar-link-badge">${_unreadCount > 99 ? '99+' : _unreadCount}</span>`;
      } else if (item.hasFailedScanBadge && _failedScanCount > 0) {
        badgeHtml = `<span class="sidebar-link-badge failed-scan-badge">${_failedScanCount > 99 ? '99+' : _failedScanCount}</span>`;
      }
      html += `
        <div class="sidebar-link ${isActive ? 'active' : ''}" data-page="${item.id}">
          <span class="sidebar-link-icon">${item.icon}</span>
          <span>${item.label}</span>
          ${badgeHtml}
        </div>
      `;
    });
    html += `</nav></div>`;
  });

  // User footer
  const roleLabels = { owner: '🏢 Owner', manager: '👨‍🍳 Manager', accountant: '📊 Accountant' };
  const userName = session?.userName || session?.name || 'User';
  html += `
    <div class="sidebar-footer">
      <div class="sidebar-user" id="sidebar-logout" title="Click to logout">
        <div class="sidebar-avatar">${userName.split(' ').map(n => n[0]).join('').slice(0, 2)}</div>
        <div>
          <div class="sidebar-user-name">${userName}</div>
          <div class="sidebar-user-role">${roleLabels[role] || role}</div>
        </div>
      </div>
    </div>
  `;

  container.innerHTML = html;

  container.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => onNavigate(el.dataset.page));
  });

  // Fetch unread count + failed-scan count
  fetchUnreadCount();
  if (role === 'manager') fetchFailedScanCount();
}

async function fetchUnreadCount() {
  try {
    const { count } = await notifApi.unreadCount();
    _unreadCount = count;
    const badges = document.querySelectorAll('.sidebar-link-badge:not(.failed-scan-badge)');
    badges.forEach(b => {
      b.textContent = count > 99 ? '99+' : count;
      b.style.display = count > 0 ? 'inline' : 'none';
    });
  } catch {
    // Silent fail
  }
}

async function fetchFailedScanCount() {
  try {
    const { count } = await billsApi.failedScanCount();
    _failedScanCount = count;
    const badge = document.querySelector('.sidebar-link-badge.failed-scan-badge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'inline' : 'none';
    }
  } catch {
    // Silent fail
  }
}