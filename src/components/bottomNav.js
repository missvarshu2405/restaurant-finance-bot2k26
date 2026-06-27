// ============================================
// Bottom Navigation Bar — Mobile
// Manager: 📷 Submit, 📊 Summary, 📋 Bills, 👤 Me
// Owner: 🏠 Home, 💰 Expenses, 📊 Reports, 🔔 Alerts, ⋯ More
// "More" opens a slide-up drawer with all hidden nav items
// ============================================

import { notifications as notifApi, bills as billsApi } from '../services/api.js';
const managerTabs = [
  { id: 'manager-upload', icon: '📷', label: 'Submit' },
  { id: 'manager-home', icon: '📊', label: 'Summary' },
  { id: 'manager-bills', icon: '📋', label: 'Bills', hasFailedScanBadge: true },
  { id: 'manager-me', icon: '👤', label: 'Me', isDrawer: true },
];

const ownerTabs = [
  { id: 'dashboard', icon: '🏠', label: 'Home' },
  { id: 'expenses', icon: '💰', label: 'Expenses' },
  { id: 'reports', icon: '📊', label: 'Reports' },
  { id: 'notifications', icon: '🔔', label: 'Alerts', hasBadge: true },
  { id: 'more', icon: '⋯', label: 'More', isDrawer: true },
];

// Items shown in the "More" drawer (Owner)
const ownerDrawerSections = [
  { section: 'Main', items: [
    { id: 'branches', icon: '🏪', label: 'Branches' },
  ]},
  { section: 'Finance', items: [
    { id: 'vendors', icon: '🏭', label: 'Vendors' },
    { id: 'budgets', icon: '💰', label: 'Budgets' },
    { id: 'recipes', icon: '👨‍🍳', label: 'Recipe Costing' },
  ]},
  { section: 'Insights', items: [
    { id: 'anomalies', icon: '🚨', label: 'Flagged Items' },
  ]},
  { section: 'Admin', items: [
    { id: 'users', icon: '👥', label: 'Managers' },
    { id: 'audit', icon: '📝', label: 'Audit Log' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ]},
];

let _unreadCount = 0;
let _failedScanCount = 0;
let _drawerVisible = false;

export function renderBottomNav(container, activePage, onNavigate, session) {
  const isOwner = session?.role === 'owner';
  const tabs = isOwner ? ownerTabs : managerTabs;

  const nav = document.createElement('nav');
  nav.className = 'bottom-nav';
  nav.id = 'bottom-nav';

  nav.innerHTML = tabs.map(tab => {
    const isActive = tab.isDrawer ? false : activePage === tab.id;
    let badgeHtml = '';
    if (tab.hasBadge && _unreadCount > 0) {
      badgeHtml = `<span class="bottom-nav-badge">${_unreadCount > 99 ? '99+' : _unreadCount}</span>`;
    } else if (tab.hasFailedScanBadge && _failedScanCount > 0) {
      badgeHtml = `<span class="bottom-nav-badge failed-scan-badge">${_failedScanCount > 99 ? '99+' : _failedScanCount}</span>`;
    }
    return `
      <button class="bottom-nav-tab ${isActive ? 'active' : ''}" data-page="${tab.id}" id="nav-tab-${tab.id}">
        <span class="bottom-nav-icon">${tab.icon}</span>
        ${badgeHtml}
        <span class="bottom-nav-label">${tab.label}</span>
      </button>
    `;
  }).join('');

  container.appendChild(nav);

  nav.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', () => {
      const tab = tabs.find(t => t.id === el.dataset.page);
      if (tab?.isDrawer) {
        showDrawer(activePage, onNavigate, session);
      } else {
        onNavigate(el.dataset.page);
      }
    });
  });

  // Fetch unread count + failed-scan count (manager only)
  refreshBadgeCount();
  if (!isOwner) refreshFailedScanBadge();
}
function showDrawer(activePage, onNavigate, session) {
  if (_drawerVisible) return;
  _drawerVisible = true;

  // Remove any existing drawer
  const existing = document.getElementById('mobile-drawer-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'mobile-drawer-overlay';
  overlay.id = 'mobile-drawer-overlay';

  const userName = session?.userName || session?.name || 'User';
  const roleLabels = { owner: 'Owner', manager: 'Manager', accountant: 'Accountant' };
  const role = session?.role || 'owner';
  const isOwner = role === 'owner';

  let drawerHtml = `
    <div class="mobile-drawer" id="mobile-drawer">
      <div class="mobile-drawer-handle"></div>
      <div class="mobile-drawer-header">
        <div>
          <div class="mobile-drawer-title">Menu</div>
          <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${userName} · ${roleLabels[role] || role}</div>
        </div>
        <button class="mobile-drawer-close" id="drawer-close-btn">×</button>
      </div>
  `;

  const managerDrawerSections = [
    { section: 'View', items: [
      { id: 'myExpenses', icon: '📋', label: 'My Expenses' },
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

  const sections = isOwner ? ownerDrawerSections : managerDrawerSections;
  sections.forEach(section => {
    drawerHtml += `
      <div class="mobile-drawer-section">
        <div class="mobile-drawer-section-label">${section.section}</div>
      </div>
      <div class="mobile-drawer-nav">
    `;
    section.items.forEach(item => {
      const isActive = activePage === item.id;
      drawerHtml += `
        <button class="mobile-drawer-item ${isActive ? 'active' : ''}" data-drawer-page="${item.id}">
          <span class="mobile-drawer-item-icon">${item.icon}</span>
          <span class="mobile-drawer-item-label">${item.label}</span>
          <span class="mobile-drawer-item-arrow">›</span>
        </button>
      `;
    });
    drawerHtml += `</div>`;
  });

  // Logout at bottom
  drawerHtml += `
    <div class="mobile-drawer-divider"></div>
    <div class="mobile-drawer-nav" style="padding-bottom:16px">
      <button class="mobile-drawer-item danger" id="drawer-logout-btn">
        <span class="mobile-drawer-item-icon">🚪</span>
        <span class="mobile-drawer-item-label">Logout</span>
      </button>
    </div>
  `;

  drawerHtml += `</div>`;
  overlay.innerHTML = drawerHtml;
  document.body.appendChild(overlay);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('visible');
    });
  });

  // Close handlers
  const closeDrawer = () => {
    overlay.classList.remove('visible');
    _drawerVisible = false;
    setTimeout(() => overlay.remove(), 350);
  };

  // Click overlay to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeDrawer();
  });

  // Close button
  document.getElementById('drawer-close-btn')?.addEventListener('click', closeDrawer);

  // Navigate items
  overlay.querySelectorAll('[data-drawer-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.drawerPage;
      closeDrawer();
      // Small delay so the drawer closes smoothly first
      setTimeout(() => onNavigate(page), 150);
    });
  });

  // Logout
  document.getElementById('drawer-logout-btn')?.addEventListener('click', () => {
    closeDrawer();
    localStorage.removeItem('rl_token');
    localStorage.removeItem('rl_session');
    window.location.hash = '';
    window.location.reload();
  });
}

export async function refreshBadgeCount() {
  try {
    const { count } = await notifApi.unreadCount();
    _unreadCount = count;
    const badge = document.querySelector('.bottom-nav-badge:not(.failed-scan-badge)');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  } catch {
    // Silent fail
  }
}

export async function refreshFailedScanBadge() {
  try {
    const { count } = await billsApi.failedScanCount();
    _failedScanCount = count;
    const badge = document.querySelector('.bottom-nav-badge.failed-scan-badge');
    if (badge) {
      badge.textContent = count > 99 ? '99+' : count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    }
  } catch {
    // Silent fail
  }
}
export function hideBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = 'none';
}

export function showBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (nav) nav.style.display = 'flex';
}
