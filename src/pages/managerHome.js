// ============================================
// Manager Home Page — Daily Briefing
// Greeting, budget progress, today's bills, quick actions
// ============================================

import { bills as billsApi, branches as branchesApi } from '../services/api.js';
import { formatCurrency, formatDate, todayStr } from '../data/store.js';
import { showToast } from '../components/toast.js';

export function render(container) {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  container.innerHTML = `
    <div class="manager-home">
      <div class="manager-greeting">
        <h2>${greeting}, ${session.userName || 'Manager'} 👋</h2>
        <p class="manager-branch-name">${session.branchName || 'Your Branch'}</p>
      </div>

      <!-- Budget Card -->
      <div class="card budget-card" id="budget-card">
        <div class="budget-card-title">Today's Budget</div>
        <div class="budget-bar-container">
          <div class="budget-bar" id="budget-bar"></div>
        </div>
        <div class="budget-numbers" id="budget-numbers">
          <span class="skeleton-text">Loading...</span>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-action-card" id="quick-submit-action">
        <span class="quick-action-icon">📷</span>
        <span class="quick-action-text">Submit a Bill</span>
        <span class="quick-action-arrow">→</span>
      </div>

      <div class="quick-action-card" id="quick-draft-action" style="display:none">
        <span class="quick-action-icon">📝</span>
        <span class="quick-action-text" id="draft-count-text">0 drafts waiting</span>
        <span class="quick-action-arrow">→</span>
      </div>

      <!-- Today's Bills -->
      <div class="card">
        <div class="card-header-row">
          <h3>Today's Bills</h3>
          <span class="card-count" id="today-bill-count">0</span>
        </div>
        <div id="today-bills-list" class="today-bills-list">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>
        <button class="btn-link view-all-link" id="view-all-bills" style="display:none">View All →</button>
      </div>

      <!-- Today's Tasks -->
      <div class="card">
        <h3>Today's Tasks</h3>
        <div class="task-list" id="task-list">
          <div class="task-item" id="task-attendance">
            <span class="task-icon">👥</span>
            <span class="task-text">Staff Attendance</span>
            <span class="task-status" id="attendance-status">Not logged</span>
          </div>
          <div class="task-item" id="task-petty-cash">
            <span class="task-icon">💰</span>
            <span class="task-text">Petty Cash</span>
            <span class="task-status" id="petty-cash-status">Open</span>
          </div>
          <div class="task-item" id="task-wastage">
            <span class="task-icon">🗑️</span>
            <span class="task-text">Wastage Log</span>
            <span class="task-status" id="wastage-status">—</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  const today = todayStr();

  // Load today's bills
  try {
    // Load bills — fetch all to find bills uploaded today regardless of bill_date
    const allBranchBills = await billsApi.list({ branch_id: session.branchId });
    
    // A bill counts as "today's" if either bill_date = today OR it was uploaded today
    const allBills = allBranchBills.filter(b => {
      const billDateMatch = (b.bill_date || '').startsWith(today);
      const uploadedToday = (b.uploaded_at || '').startsWith(today);
      return billDateMatch || uploadedToday;
    });
    const todayTotal = allBills.reduce((sum, b) => sum + (b.total_amount || 0), 0);

    document.getElementById('today-bill-count').textContent = allBills.length;

    const listEl = document.getElementById('today-bills-list');
    if (allBills.length === 0) {
      listEl.innerHTML = '<div class="empty-state-small">No bills submitted yet today</div>';
    } else {
      const displayBills = allBills.slice(0, 3);
      listEl.innerHTML = displayBills.map(b => `
        <div class="today-bill-row">
          <div class="today-bill-info">
            <span class="today-bill-vendor">${b.vendor_name || 'Unknown'}</span>
            <span class="today-bill-meta">${b.category || ''} · ${b.payment_mode || ''} · ${new Date(b.uploaded_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
          <span class="today-bill-amount">${formatCurrency(b.total_amount)}</span>
        </div>
      `).join('');

      if (allBills.length > 3) {
        document.getElementById('view-all-bills').style.display = 'block';
      }
    }

    // Update budget card (fetch branch info)
    try {
      const branches = await branchesApi.list();
      const branch = branches.find(b => b.id === session.branchId);
      if (branch && branch.daily_budget > 0) {
        const pct = Math.min(Math.round((todayTotal / branch.daily_budget) * 100), 100);
        const barColor = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
        document.getElementById('budget-bar').style.width = `${Math.min(pct, 100)}%`;
        document.getElementById('budget-bar').style.background = barColor;
        document.getElementById('budget-numbers').innerHTML = `
          <span>${formatCurrency(todayTotal)} / ${formatCurrency(branch.daily_budget)}</span>
          <span class="budget-pct" style="color:${barColor}">${pct}% used</span>
        `;
      } else {
        document.getElementById('budget-numbers').innerHTML = `
          <span>${formatCurrency(todayTotal)} spent today</span>
          <span class="budget-pct" style="color:#94a3b8">No budget set</span>
        `;
      }
    } catch {
      document.getElementById('budget-numbers').textContent = formatCurrency(todayTotal) + ' spent today';
    }
  } catch (err) {
    console.error('Failed to load bills:', err);
  }

  // Quick actions
  document.getElementById('quick-submit-action')?.addEventListener('click', () => {
    window.location.hash = 'manager-upload';
  });
  document.getElementById('view-all-bills')?.addEventListener('click', () => {
    window.location.hash = 'manager-bills';
  });

  // Task navigation
  document.getElementById('task-attendance')?.addEventListener('click', () => {
    window.location.hash = 'staff-attendance';
  });
  document.getElementById('task-petty-cash')?.addEventListener('click', () => {
    window.location.hash = 'petty-cash';
  });
  document.getElementById('task-wastage')?.addEventListener('click', () => {
    window.location.hash = 'wastage-log';
  });
}

export function cleanup() {}
