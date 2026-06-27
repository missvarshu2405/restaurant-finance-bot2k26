// ============================================
// Login Page v3.0 — Premium Redesign
// Owner / Manager / Accountant
// Mobile-friendly, API-based auth
// With Owner Signup support
// ============================================

import { showToast } from '../components/toast.js';
import { auth, setToken } from '../services/api.js';

let loginCallback = null;
let activeTab = 'owner';
let isSignupMode = false;

const TAB_CONFIG = {
  owner: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    label: 'Owner',
    gradient: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    glow: 'rgba(99, 102, 241, 0.4)',
  },
  manager: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,
    label: 'Manager',
    gradient: 'linear-gradient(135deg, #10b981, #059669)',
    glow: 'rgba(16, 185, 129, 0.4)',
  },
  accountant: {
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    label: 'Accountant',
    gradient: 'linear-gradient(135deg, #8b5cf6, #a855f7)',
    glow: 'rgba(139, 92, 246, 0.4)',
  },
};

export function render(container, handleLogin) {
  loginCallback = handleLogin;
  isSignupMode = false;

  container.innerHTML = `
    <div class="login-wrapper-v3">
      <!-- Animated background -->
      <div class="login-bg-effects">
        <div class="login-orb login-orb-1"></div>
        <div class="login-orb login-orb-2"></div>
        <div class="login-orb login-orb-3"></div>
        <div class="login-grid-overlay"></div>
      </div>

      <div class="login-card-v3">
        <!-- Brand Header -->
        <div class="login-brand">
          <div class="login-brand-icon">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 2h18v20H3z" opacity="0"/>
              <circle cx="12" cy="10" r="3"/>
              <path d="M5 18c0-3.87 3.13-7 7-7s7 3.13 7 7"/>
              <path d="M7 3h10"/>
              <path d="M12 3v4"/>
              <circle cx="7" cy="3" r="1"/>
              <circle cx="17" cy="3" r="1"/>
            </svg>
          </div>
          <h1 class="login-brand-name">RestaurantLedger</h1>
          <p class="login-brand-tagline">Multi-Branch Finance Manager</p>
        </div>

        <!-- Auth Container -->
        <div id="auth-container" class="login-auth-container">
          ${renderLoginForms()}
        </div>
      </div>

      <!-- Footer badge -->
      <div class="login-footer-badge">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        Secured with end-to-end encryption
      </div>
    </div>
  `;
}

function renderLoginForms() {
  const tabButtons = Object.entries(TAB_CONFIG)
    .map(([key, cfg]) => `
      <button class="login-tab-v3 ${activeTab === key ? 'active' : ''}" data-tab="${key}">
        <span class="login-tab-icon">${cfg.icon}</span>
        <span class="login-tab-label">${cfg.label}</span>
      </button>
    `).join('');

  return `
    <div class="login-tabs-v3">
      <div class="login-tabs-track">
        ${tabButtons}
      </div>
    </div>

    <!-- Owner Login Form -->
    <form class="login-form-v3" id="owner-login-form" style="display:${activeTab === 'owner' ? 'flex' : 'none'}">
      <div class="login-input-group">
        <label class="login-label" for="owner-email">Email Address</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
          </span>
          <input type="email" class="login-input" id="owner-email" placeholder="admin@restaurant.com" required autocomplete="email">
        </div>
      </div>
      <div class="login-input-group">
        <label class="login-label" for="owner-password">Password</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <input type="password" class="login-input" id="owner-password" placeholder="Enter your password" required autocomplete="current-password">
          <button type="button" class="login-password-toggle" data-target="owner-password" aria-label="Toggle password visibility">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <button type="submit" class="login-submit-v3" id="owner-submit-btn" style="--btn-gradient: ${TAB_CONFIG.owner.gradient}; --btn-glow: ${TAB_CONFIG.owner.glow}">
        <span class="login-btn-text">Sign In as Owner</span>
        <span class="login-btn-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </button>
    </form>

    <!-- Manager Login Form -->
    <form class="login-form-v3" id="manager-login-form" style="display:${activeTab === 'manager' ? 'flex' : 'none'}">
      <div class="login-input-group">
        <label class="login-label" for="mgr-username">Username or Email</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </span>
          <input type="text" class="login-input" id="mgr-username" placeholder="Your username" required autocomplete="username">
        </div>
      </div>
      <div class="login-input-group">
        <label class="login-label" for="mgr-password">Password</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <input type="password" class="login-input" id="mgr-password" placeholder="Enter your password" required autocomplete="current-password">
          <button type="button" class="login-password-toggle" data-target="mgr-password" aria-label="Toggle password visibility">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <button type="submit" class="login-submit-v3" id="mgr-submit-btn" style="--btn-gradient: ${TAB_CONFIG.manager.gradient}; --btn-glow: ${TAB_CONFIG.manager.glow}">
        <span class="login-btn-text">Sign In as Manager</span>
        <span class="login-btn-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </button>
    </form>

    <!-- Accountant Login Form -->
    <form class="login-form-v3" id="accountant-login-form" style="display:${activeTab === 'accountant' ? 'flex' : 'none'}">
      <div class="login-input-group">
        <label class="login-label" for="acct-email">Email Address</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
          </span>
          <input type="email" class="login-input" id="acct-email" placeholder="accountant@firm.com" required autocomplete="email">
        </div>
      </div>
      <div class="login-input-group">
        <label class="login-label" for="acct-password">Password</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <input type="password" class="login-input" id="acct-password" placeholder="Enter your password" required autocomplete="current-password">
          <button type="button" class="login-password-toggle" data-target="acct-password" aria-label="Toggle password visibility">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
          </button>
        </div>
      </div>
      <button type="submit" class="login-submit-v3" style="--btn-gradient: ${TAB_CONFIG.accountant.gradient}; --btn-glow: ${TAB_CONFIG.accountant.glow}">
        <span class="login-btn-text">Sign In as Accountant</span>
        <span class="login-btn-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </button>
    </form>

    <div class="login-divider">
      <span class="login-divider-line"></span>
      <span class="login-divider-text">or</span>
      <span class="login-divider-line"></span>
    </div>

    <div class="login-toggle-v3" id="login-toggle">
      <span>Don't have an account?</span>
      <button type="button" class="login-toggle-link-v3" id="toggle-signup-btn">Create Owner Account</button>
    </div>
  `;
}

function renderSignupForm() {
  return `
    <div class="signup-header-v3">
      <div class="signup-badge-v3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
        New Account
      </div>
      <h2 class="signup-title-v3">Create Owner Account</h2>
      <p class="signup-subtitle-v3">Set up your restaurant finance dashboard in seconds</p>
    </div>

    <form class="login-form-v3" id="signup-form">
      <div class="login-input-group">
        <label class="login-label" for="signup-business">Business Name</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </span>
          <input type="text" class="login-input" id="signup-business" placeholder="e.g. Spice Garden Restaurant" required autocomplete="organization">
        </div>
      </div>
      <div class="login-input-group">
        <label class="login-label" for="signup-email">Email Address</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M22 7l-10 7L2 7"/></svg>
          </span>
          <input type="email" class="login-input" id="signup-email" placeholder="owner@restaurant.com" required autocomplete="email">
        </div>
      </div>
      <div class="login-input-group">
        <label class="login-label" for="signup-password">Password</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </span>
          <input type="password" class="login-input" id="signup-password" placeholder="Min 6 characters" required minlength="6" autocomplete="new-password">
        </div>
        <div class="password-strength" id="password-strength"></div>
      </div>
      <div class="login-input-group">
        <label class="login-label" for="signup-confirm">Confirm Password</label>
        <div class="login-input-wrapper">
          <span class="login-input-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </span>
          <input type="password" class="login-input" id="signup-confirm" placeholder="Re-enter password" required minlength="6" autocomplete="new-password">
        </div>
      </div>
      <button type="submit" class="login-submit-v3 signup-submit-v3" id="signup-submit-btn" style="--btn-gradient: linear-gradient(135deg, #8b5cf6, #6366f1); --btn-glow: rgba(139, 92, 246, 0.4)">
        <span class="login-btn-text signup-btn-text">Create Account & Get Started</span>
        <span class="login-btn-arrow">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
        </span>
      </button>
    </form>

    <div class="login-divider">
      <span class="login-divider-line"></span>
      <span class="login-divider-text">or</span>
      <span class="login-divider-line"></span>
    </div>

    <div class="login-toggle-v3" id="login-toggle">
      <span>Already have an account?</span>
      <button type="button" class="login-toggle-link-v3" id="toggle-login-btn">Sign In</button>
    </div>
  `;
}

function switchToSignup() {
  isSignupMode = true;
  const container = document.getElementById('auth-container');
  container.style.opacity = '0';
  container.style.transform = 'translateY(12px) scale(0.98)';

  setTimeout(() => {
    container.innerHTML = renderSignupForm();
    void container.offsetHeight;
    container.style.opacity = '1';
    container.style.transform = 'translateY(0) scale(1)';
    bindSignupEvents();
  }, 250);
}

function switchToLogin() {
  isSignupMode = false;
  const container = document.getElementById('auth-container');
  container.style.opacity = '0';
  container.style.transform = 'translateY(12px) scale(0.98)';

  setTimeout(() => {
    container.innerHTML = renderLoginForms();
    void container.offsetHeight;
    container.style.opacity = '1';
    container.style.transform = 'translateY(0) scale(1)';
    bindLoginEvents();
  }, 250);
}

function updatePasswordStrength(password) {
  const el = document.getElementById('password-strength');
  if (!el) return;

  if (!password) { el.innerHTML = ''; return; }

  let score = 0;
  if (password.length >= 6) score++;
  if (password.length >= 10) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: 'Very Weak', cls: 'strength-weak', pct: 20 },
    { label: 'Weak', cls: 'strength-weak', pct: 35 },
    { label: 'Fair', cls: 'strength-fair', pct: 55 },
    { label: 'Good', cls: 'strength-good', pct: 75 },
    { label: 'Strong', cls: 'strength-strong', pct: 100 },
  ];

  const level = levels[Math.min(score, levels.length - 1)];
  el.innerHTML = `
    <div class="strength-bar-track">
      <div class="strength-bar-fill ${level.cls}" style="width:${level.pct}%"></div>
    </div>
    <span class="strength-label ${level.cls}">${level.label}</span>
  `;
}

function bindPasswordToggles() {
  document.querySelectorAll('.login-password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (input) {
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        btn.innerHTML = isPassword
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
      }
    });
  });
}

function bindSignupEvents() {
  document.getElementById('toggle-login-btn')?.addEventListener('click', switchToLogin);
  bindPasswordToggles();

  document.getElementById('signup-password')?.addEventListener('input', (e) => {
    updatePasswordStrength(e.target.value);
  });

  document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('signup-submit-btn');
    const btnText = btn.querySelector('.signup-btn-text');

    const businessName = document.getElementById('signup-business').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;

    if (password !== confirm) {
      showToast('Passwords do not match.', 'error');
      document.getElementById('signup-confirm').focus();
      return;
    }

    if (password.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      document.getElementById('signup-password').focus();
      return;
    }

    btn.disabled = true;
    btnText.textContent = 'Creating your account...';

    try {
      const response = await auth.register({ email, password, businessName });

      setToken(response.token);
      showToast(`Welcome, ${response.user.name}! Your account is ready.`, 'success');

      const { setSession } = await import('../main.js');
      setSession({
        ...response.user,
        role: response.user.role,
        userId: response.user.id,
        userName: response.user.name,
        branchId: null,
        branchName: null,
      });

      window.location.reload();
    } catch (err) {
      showToast(err.message || 'Registration failed. Please try again.', 'error');
      btn.disabled = false;
      btnText.textContent = 'Create Account & Get Started';
    }
  });
}

function updateActiveTabStyle() {
  const cfg = TAB_CONFIG[activeTab];
  document.querySelectorAll('.login-submit-v3:not(.signup-submit-v3)').forEach(btn => {
    if (btn.closest('form')?.style.display !== 'none') {
      btn.style.setProperty('--btn-gradient', cfg.gradient);
      btn.style.setProperty('--btn-glow', cfg.glow);
    }
  });
}

function bindLoginEvents() {
  // Tab switching
  document.querySelectorAll('.login-tab-v3').forEach(tab => {
    tab.addEventListener('click', () => {
      activeTab = tab.dataset.tab;
      document.querySelectorAll('.login-tab-v3').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      document.getElementById('owner-login-form').style.display = activeTab === 'owner' ? 'flex' : 'none';
      document.getElementById('manager-login-form').style.display = activeTab === 'manager' ? 'flex' : 'none';
      document.getElementById('accountant-login-form').style.display = activeTab === 'accountant' ? 'flex' : 'none';

      // Update toggle visibility (signup only for owners)
      const toggle = document.getElementById('login-toggle');
      const divider = document.querySelector('.login-divider');
      if (activeTab === 'owner') {
        toggle.style.display = 'flex';
        if (divider) divider.style.display = 'flex';
      } else {
        toggle.style.display = 'none';
        if (divider) divider.style.display = 'none';
      }

      updateActiveTabStyle();
    });
  });

  // Toggle to signup
  document.getElementById('toggle-signup-btn')?.addEventListener('click', switchToSignup);

  // Password toggles
  bindPasswordToggles();

  // Owner login
  document.getElementById('owner-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('owner-submit-btn');
    const btnText = btn.querySelector('.login-btn-text');
    btn.disabled = true;
    btnText.textContent = 'Signing in...';
    try {
      const email = document.getElementById('owner-email').value.trim();
      const password = document.getElementById('owner-password').value;
      await loginCallback('owner', { email, password, role: 'owner' });
    } catch (err) {
      showToast(err.message || 'Invalid email or password.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btnText.textContent = 'Sign In as Owner'; }
    }
  });

  // Manager login
  document.getElementById('manager-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('mgr-submit-btn');
    const btnText = btn.querySelector('.login-btn-text');
    btn.disabled = true;
    btnText.textContent = 'Signing in...';
    try {
      const username = document.getElementById('mgr-username').value.trim();
      const password = document.getElementById('mgr-password').value;
      await loginCallback('manager', { username, password, role: 'manager' });
    } catch (err) {
      showToast(err.message || 'Invalid username/password.', 'error');
    } finally {
      if (btn) { btn.disabled = false; btnText.textContent = 'Sign In as Manager'; }
    }
  });

  // Accountant login
  document.getElementById('accountant-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const email = document.getElementById('acct-email').value.trim();
      const password = document.getElementById('acct-password').value;
      await loginCallback('accountant', { email, password, role: 'accountant' });
    } catch (err) {
      showToast(err.message || 'Invalid credentials.', 'error');
    }
  });
}

export function init(handleLogin) {
  if (handleLogin) loginCallback = handleLogin;
  bindLoginEvents();
}
