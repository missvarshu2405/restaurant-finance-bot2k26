// ============================================
// Settings Page v2.0 — API-based
// ============================================

import { auth } from '../services/api.js';
import { showToast } from '../components/toast.js';

export function render(container) {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');

  container.innerHTML = `
    <div class="fade-up" style="max-width:700px">
      <!-- Account Info -->
      <div class="glass-card mb-3">
        <h3 class="section-title">👤 Account Information</h3>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Name</label><div style="font-size:16px;font-weight:600">${session.userName || session.name || '—'}</div></div>
          <div class="form-group"><label class="form-label">Email</label><div>${session.email || '—'}</div></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">Role</label><div><span class="badge badge-info">${session.role || '—'}</span></div></div>
          <div class="form-group"><label class="form-label">Branch</label><div>${session.branchName || 'All Branches'}</div></div>
        </div>
      </div>

      <!-- Change Password -->
      <div class="glass-card mb-3">
        <h3 class="section-title">🔒 Change Password</h3>
        <div class="form-group"><label class="form-label">Current Password</label><input type="password" class="form-input" id="set-current-pass"></div>
        <div class="form-row">
          <div class="form-group"><label class="form-label">New Password</label><input type="password" class="form-input" id="set-new-pass"></div>
          <div class="form-group"><label class="form-label">Confirm Password</label><input type="password" class="form-input" id="set-confirm-pass"></div>
        </div>
        <button class="btn btn-primary" id="save-password">Update Password</button>
      </div>

      <!-- Notification Preferences -->
      <div class="glass-card mb-3">
        <h3 class="section-title">🔔 Notification Preferences</h3>
        <div style="display:flex;flex-direction:column;gap:12px">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" checked> Email daily digest (9pm)</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" checked> Budget breach alerts</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox" checked> Anomaly notifications</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer"><input type="checkbox"> WhatsApp notifications</label>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="glass-card" style="border:1px solid var(--accent-red)">
        <h3 class="section-title" style="color:var(--accent-red)">⚠️ Danger Zone</h3>
        <button class="btn btn-danger" id="logout-btn">🚪 Logout</button>
      </div>
    </div>
  `;
}

export function init() {
  document.getElementById('save-password')?.addEventListener('click', async () => {
    const current = document.getElementById('set-current-pass').value;
    const newPass = document.getElementById('set-new-pass').value;
    const confirm = document.getElementById('set-confirm-pass').value;

    if (!current || !newPass) return showToast('Fill all password fields', 'error');
    if (newPass !== confirm) return showToast('Passwords don\'t match', 'error');
    if (newPass.length < 4) return showToast('Password must be at least 4 characters', 'error');

    try {
      await auth.changePassword({ currentPassword: current, newPassword: newPass });
      showToast('Password updated ✅', 'success');
      document.getElementById('set-current-pass').value = '';
      document.getElementById('set-new-pass').value = '';
      document.getElementById('set-confirm-pass').value = '';
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    localStorage.removeItem('rl_token');
    localStorage.removeItem('rl_session');
    window.location.hash = '';
    window.location.reload();
  });
}

export function cleanup() {}
