// ============================================
// RestaurantLedger v2.0 — Main App Router
// Mobile-first with bottom nav + desktop sidebar
// ============================================

import { auth, setToken, getToken } from './services/api.js';
import { renderSidebar } from './components/sidebar.js';
import { renderBottomNav, refreshBadgeCount } from './components/bottomNav.js';
import { renderHeader } from './components/header.js';
import { initToast, showToast } from './components/toast.js';
import { destroyAllCharts } from './components/charts.js';
import {
  categories, formatCurrency, formatDate, formatDateTime, todayStr,
  getState, setState,
} from './data/store.js';

// --- Page imports (lazy-loaded pattern, keeping imports for now) ---
import * as loginPage from './pages/login.js';
import * as overviewPage from './pages/overview.js';
import * as branchesPage from './pages/branches.js';
import * as expensesPage from './pages/expenses.js';
import * as vendorsPage from './pages/vendors.js';
import * as budgetsPage from './pages/budgets.js';
import * as usersPage from './pages/users.js';
import * as reportsPage from './pages/reports.js';
import * as notificationsPage from './pages/notifications.js';
import * as anomaliesPage from './pages/anomalies.js';
import * as auditPage from './pages/audit.js';
import * as settingsPage from './pages/settings.js';
import * as uploadPage from './pages/upload.js';
import * as myExpensesPage from './pages/myExpenses.js';
import * as mySummaryPage from './pages/mySummary.js';

// New v2.0 page stubs (will be implemented in subsequent phases)
import * as managerHomePage from './pages/managerHome.js';
import * as staffAttendancePage from './pages/staffAttendance.js';
import * as pettyCashPage from './pages/pettyCash.js';
import * as wastageLogPage from './pages/wastageLog.js';
import * as recipesPage from './pages/recipes.js';
import * as quickEntryPage from './pages/quickEntry.js';
import * as batchUploadPage from './pages/batchUpload.js';

// Owner pages
const ownerPages = {
  dashboard: { module: overviewPage, title: 'Live Dashboard', subtitle: 'Real-time business overview' },
  overview: { module: overviewPage, title: 'Overview', subtitle: 'All branches at a glance' },
  branches: { module: branchesPage, title: 'Branches', subtitle: 'Manage your restaurant branches' },
  expenses: { module: expensesPage, title: 'Expenses', subtitle: 'All bills and expense records' },
  vendors: { module: vendorsPage, title: 'Vendors', subtitle: 'Supplier analytics & scorecards' },
  budgets: { module: budgetsPage, title: 'Budgets', subtitle: 'Budget tracking & alerts' },
  users: { module: usersPage, title: 'Managers', subtitle: 'Manage manager accounts' },
  reports: { module: reportsPage, title: 'Reports', subtitle: '12 restaurant-specific reports' },
  notifications: { module: notificationsPage, title: 'Notifications', subtitle: 'Alerts & notifications' },
  anomalies: { module: anomaliesPage, title: 'Flagged Items', subtitle: '9-type anomaly detection' },
  audit: { module: auditPage, title: 'Audit Log', subtitle: 'Activity trail' },
  settings: { module: settingsPage, title: 'Settings', subtitle: 'Business configuration' },
  recipes: { module: recipesPage, title: 'Recipe Costing', subtitle: 'Menu item cost analysis' },
  more: { module: settingsPage, title: 'More', subtitle: 'Settings & tools' },
};

// Manager pages
const managerPages = {
  'manager-upload': { module: uploadPage, title: 'Submit Bill', subtitle: 'Camera-first bill upload' },
  'manager-home': { module: managerHomePage, title: 'Summary', subtitle: 'Your daily briefing' },
  'manager-bills': { module: myExpensesPage, title: 'My Bills', subtitle: 'Your branch bills' },
  'manager-me': { module: mySummaryPage, title: 'Me', subtitle: 'Your profile & tasks' },
  'staff-attendance': { module: staffAttendancePage, title: 'Staff Attendance', subtitle: 'Log daily attendance' },
  'petty-cash': { module: pettyCashPage, title: 'Petty Cash', subtitle: 'Cash reconciliation' },
  'wastage-log': { module: wastageLogPage, title: 'Wastage Log', subtitle: 'Track food wastage' },
  upload: { module: uploadPage, title: 'Upload Bill', subtitle: 'Upload expense bill' },
  'quick-entry': { module: quickEntryPage, title: 'Quick Entry', subtitle: 'Recurring vendor shortcuts' },
  'batch-upload': { module: batchUploadPage, title: 'Batch Upload', subtitle: 'Upload multiple bills' },
  myExpenses: { module: myExpensesPage, title: 'My Expenses', subtitle: 'Your branch expense records' },
  mySummary: { module: mySummaryPage, title: 'Branch Summary', subtitle: 'Daily & weekly summaries' },
  audit: { module: auditPage, title: 'Activity Log', subtitle: 'Your activity trail' },
};

let currentPageModule = null;
let _session = null;

function isMobile() {
  return window.innerWidth < 768;
}

function getSession() {
  if (_session) return _session;
  try {
    const raw = localStorage.getItem('rl_session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function setSession(session) {
  _session = session;
  if (session) localStorage.setItem('rl_session', JSON.stringify(session));
  else localStorage.removeItem('rl_session');
}

function clearSession() {
  _session = null;
  localStorage.removeItem('rl_session');
  localStorage.removeItem('rl_token');
  setToken(null);
}

function getPages() {
  const session = getSession();
  return session?.role === 'manager' ? managerPages : ownerPages;
}

function getDefaultPage() {
  const session = getSession();
  return session?.role === 'manager' ? 'manager-upload' : 'dashboard';
}

function renderAppShell() {
  const app = document.getElementById('app');
  const session = getSession();
  const mobile = isMobile();

  if (mobile) {
    app.innerHTML = `
      <div class="app-container app-mobile">
        <div class="main-area main-area-mobile">
          <header class="page-header page-header-mobile" id="page-header"></header>
          <main class="content-area content-area-mobile" id="content-area"></main>
        </div>
      </div>
    `;
    // Bottom nav is appended to body
    const existingNav = document.getElementById('bottom-nav');
    if (existingNav) existingNav.remove();
  } else {
    app.innerHTML = `
      <div class="app-container">
        <aside class="sidebar" id="sidebar"></aside>
        <div class="main-area">
          <header class="page-header" id="page-header"></header>
          <main class="content-area" id="content-area"></main>
        </div>
      </div>
    `;
  }
}

export function navigateTo(page) {
  const pages = getPages();
  const session = getSession();
  if (!pages[page]) page = getDefaultPage();

  if (currentPageModule && currentPageModule.cleanup) {
    currentPageModule.cleanup();
  }
  destroyAllCharts();

  setState('currentPage', page);
  window.location.hash = page;

  const pageConfig = pages[page];
  const mobile = isMobile();
  const isOwner = session?.role === 'owner';

  // Sidebar (desktop only)
  if (!mobile) {
    const sidebarEl = document.getElementById('sidebar');
    if (sidebarEl) renderSidebar(sidebarEl, page, navigateTo, session);
  } else {
    // Bottom nav
    const existingNav = document.getElementById('bottom-nav');
    if (existingNav) existingNav.remove();
    renderBottomNav(document.body, page, navigateTo, session);
  }

  renderHeader(document.getElementById('page-header'), {
    title: pageConfig.title,
    subtitle: pageConfig.subtitle,
    session,
    showBranchFilter: isOwner && ['overview', 'dashboard', 'expenses', 'reports', 'anomalies', 'budgets'].includes(page),
    showDateFilter: isOwner && ['overview', 'dashboard', 'expenses', 'reports', 'anomalies'].includes(page),
    onBranchChange: (branchId) => { setState('selectedBranch', branchId); navigateTo(page); },
    onDateRangeChange: (start, end) => { setState('dateRange', { start, end }); navigateTo(page); },
    onLogout: handleLogout,
    isMobile: mobile,
  });

  const content = document.getElementById('content-area');
  content.scrollTop = 0;
  currentPageModule = pageConfig.module;
  pageConfig.module.render(content);
  if (pageConfig.module.init) pageConfig.module.init();
}

async function handleLogin(role, loginData) {
  try {
    const response = await auth.login(loginData);
    setToken(response.token);
    setSession({
      ...response.user,
      role: response.user.role,
      userId: response.user.id,
      userName: response.user.name,
      branchId: response.user.branchId || null,
      branchName: response.user.branchName || null,
    });
    showToast(`Welcome, ${response.user.name}!`, 'success');
    renderAppShell();
    navigateTo(getDefaultPage());
  } catch (err) {
    showToast(err.message || 'Login failed', 'error');
    throw err;
  }
}

function handleLogout() {
  clearSession();
  currentPageModule = null;
  window.location.hash = '';
  init();
}

async function init() {
  initToast();
  const session = getSession();
  const token = getToken();

  if (!session || !token) {
    clearSession();
    const app = document.getElementById('app');
    loginPage.render(app, handleLogin);
    if (loginPage.init) loginPage.init(handleLogin);
    return;
  }

  // Verify session is still valid
  try {
    await auth.me();
  } catch {
    clearSession();
    const app = document.getElementById('app');
    loginPage.render(app, handleLogin);
    if (loginPage.init) loginPage.init(handleLogin);
    return;
  }

  renderAppShell();
  const hash = window.location.hash.replace('#', '') || getDefaultPage();
  navigateTo(hash);
}

// Handle resize: re-render shell if crossing mobile/desktop boundary
let _wasMobile = isMobile();
window.addEventListener('resize', () => {
  const nowMobile = isMobile();
  if (nowMobile !== _wasMobile) {
    _wasMobile = nowMobile;
    const session = getSession();
    if (session) {
      renderAppShell();
      navigateTo(getState().currentPage || getDefaultPage());
    }
  }
});

window.addEventListener('hashchange', () => {
  const session = getSession();
  if (!session) return;
  const hash = window.location.hash.replace('#', '') || getDefaultPage();
  if (hash !== getState().currentPage) navigateTo(hash);
});

document.addEventListener('DOMContentLoaded', init);

export { handleLogout, getSession, setSession, clearSession };
