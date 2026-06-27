// ============================================
// API Service — Fetch wrapper for backend
// Replaces direct localStorage calls
// ============================================

const API_BASE = '/api';

let _token = localStorage.getItem('rl_token') || null;

export function setToken(token) {
  _token = token;
  if (token) localStorage.setItem('rl_token', token);
  else localStorage.removeItem('rl_token');
}

export function getToken() {
  return _token;
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const headers = { ...options.headers };

  if (_token) {
    headers['Authorization'] = `Bearer ${_token}`;
  }

  // Don't set Content-Type for FormData (let browser set boundary)
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    // Don't treat 401 on login or session-check as "session expired"
    const isAuthEndpoint = endpoint === '/auth/login' || endpoint === '/auth/register' || endpoint === '/auth/me';
    if (!isAuthEndpoint) {
      // Token expired mid-session — clear and reload
      setToken(null);
      window.location.hash = '';
      window.location.reload();
      throw new Error('Session expired. Please login again.');
    }
    // For auth endpoints, just let the error propagate normally
    const errorData = await response.json().catch(() => ({ error: 'Authentication failed' }));
    throw new Error(errorData.error || 'Authentication failed');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(errorData.error || `Request failed: ${response.status}`);
  }

  return response.json();
}

// --- Auth ---
export const auth = {
  login: (data) => request('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  me: () => request('/auth/me'),
  changePassword: (data) => request('/auth/password', { method: 'PUT', body: JSON.stringify(data) }),
};

export const bills = {
  list: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/bills${qs ? '?' + qs : ''}`);
  },
  get: (id) => request(`/bills/${id}`),
  create: (formData) => request('/bills', { method: 'POST', body: formData }),
  createJSON: (data) => request('/bills', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/bills/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  verify: (id) => request(`/bills/${id}/verify`, { method: 'PUT' }),
  flag: (id, reason) => request(`/bills/${id}/flag`, { method: 'PUT', body: JSON.stringify({ reason }) }),
  bulkVerify: (billIds) => request('/bills/bulk-verify', { method: 'POST', body: JSON.stringify({ bill_ids: billIds }) }),
  delete: (id) => request(`/bills/${id}`, { method: 'DELETE' }),
  extract: (formData) => request('/bills/extract', { method: 'POST', body: formData }),
  uploadAsync: (formData) => request('/bills/upload-async', { method: 'POST', body: formData }),
  failedScanCount: () => request('/bills/failed-scan-count'),
};

// --- Branches ---
export const branches = {
  list: () => request('/branches'),
  get: (id) => request(`/branches/${id}`),
  create: (data) => request('/branches', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/branches/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/branches/${id}`, { method: 'DELETE' }),
};

// --- Managers ---
export const managers = {
  list: () => request('/managers'),
  get: (id) => request(`/managers/${id}`),
  create: (data) => request('/managers', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/managers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/managers/${id}`, { method: 'DELETE' }),
};

// --- Vendors ---
export const vendors = {
  list: () => request('/vendors'),
  get: (id) => request(`/vendors/${id}`),
  create: (data) => request('/vendors', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/vendors/${id}`, { method: 'DELETE' }),
  stats: () => request('/vendors/stats/all'),
};

// --- Reports ---
export const reports = {
  pnl: (params = {}) => request(`/reports/pnl?${new URLSearchParams(params)}`),
  gst: (params = {}) => request(`/reports/gst?${new URLSearchParams(params)}`),
  cashflow: (params = {}) => request(`/reports/cashflow?${new URLSearchParams(params)}`),
  vendorPayments: (params = {}) => request(`/reports/vendor-payments?${new URLSearchParams(params)}`),
  shiftCost: (params = {}) => request(`/reports/shift-cost?${new URLSearchParams(params)}`),
  recipeCost: () => request('/reports/recipe-cost'),
  staffCost: (params = {}) => request(`/reports/staff-cost?${new URLSearchParams(params)}`),
  wastage: (params = {}) => request(`/reports/wastage?${new URLSearchParams(params)}`),
  utility: (params = {}) => request(`/reports/utility?${new URLSearchParams(params)}`),
  budgetActual: (params = {}) => request(`/reports/budget-actual?${new URLSearchParams(params)}`),
  anomalies: (params = {}) => request(`/reports/anomalies?${new URLSearchParams(params)}`),
  yearEnd: (params = {}) => request(`/reports/year-end?${new URLSearchParams(params)}`),
};

// --- Notifications ---
export const notifications = {
  list: (params = {}) => request(`/notifications?${new URLSearchParams(params)}`),
  unreadCount: () => request('/notifications/unread-count'),
  markRead: (ids) => request('/notifications/mark-read', { method: 'PUT', body: JSON.stringify({ ids }) }),
};

// --- Staff ---
export const staff = {
  list: (params = {}) => request(`/staff?${new URLSearchParams(params)}`),
  create: (data) => request('/staff', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/staff/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/staff/${id}`, { method: 'DELETE' }),
  getAttendance: (params = {}) => request(`/staff/attendance?${new URLSearchParams(params)}`),
  logAttendance: (data) => request('/staff/attendance', { method: 'POST', body: JSON.stringify(data) }),
};

// --- Petty Cash ---
export const pettyCash = {
  get: (params = {}) => request(`/petty-cash?${new URLSearchParams(params)}`),
  save: (data) => request('/petty-cash', { method: 'POST', body: JSON.stringify(data) }),
  history: (params = {}) => request(`/petty-cash/history?${new URLSearchParams(params)}`),
};

// --- Wastage ---
export const wastage = {
  list: (params = {}) => request(`/wastage?${new URLSearchParams(params)}`),
  create: (data) => request('/wastage', { method: 'POST', body: JSON.stringify(data) }),
  delete: (id) => request(`/wastage/${id}`, { method: 'DELETE' }),
};

// --- Recipes ---
export const recipes = {
  list: () => request('/recipes'),
  get: (id) => request(`/recipes/${id}`),
  create: (data) => request('/recipes', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/recipes/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/recipes/${id}`, { method: 'DELETE' }),
};

// --- Recurring Vendors ---
export const recurringVendors = {
  list: (params = {}) => request(`/recurring-vendors?${new URLSearchParams(params)}`),
  create: (data) => request('/recurring-vendors', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) => request(`/recurring-vendors/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  delete: (id) => request(`/recurring-vendors/${id}`, { method: 'DELETE' }),
};
