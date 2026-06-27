// ============================================
// RestaurantLedger — Real Data Store
// localStorage-based persistent data layer
// No mock data — everything is created by users
// ============================================

const STORAGE_KEY = 'restaurant_ledger_data';
const SESSION_KEY = 'restaurant_ledger_session';

// --- Categories (static) ---
export const categories = [
  { key: 'produce', label: 'Produce', icon: '🥦' },
  { key: 'dairy', label: 'Dairy', icon: '🥛' },
  { key: 'meat_seafood', label: 'Meat & Seafood', icon: '🍗' },
  { key: 'dry_goods', label: 'Dry Goods', icon: '🌾' },
  { key: 'beverages', label: 'Beverages', icon: '🥤' },
  { key: 'packaging', label: 'Packaging', icon: '📦' },
  { key: 'fuel_gas', label: 'Fuel / Gas', icon: '🛢️' },
  { key: 'cleaning', label: 'Cleaning', icon: '🧹' },
  { key: 'maintenance', label: 'Maintenance', icon: '🔧' },
  { key: 'electricity', label: 'Electricity', icon: '⚡' },
  { key: 'water', label: 'Water', icon: '💧' },
  { key: 'rent', label: 'Rent', icon: '🏠' },
  { key: 'staff_wages', label: 'Staff Wages', icon: '👥' },
  { key: 'marketing', label: 'Marketing', icon: '📢' },
  { key: 'miscellaneous', label: 'Miscellaneous', icon: '📎' },
];

export function getCategoryInfo(key) {
  return categories.find(c => c.key === key) || { key, label: key, icon: '📎' };
}

// --- ID Generation ---
export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function generateBranchCode(name) {
  const parts = name.replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
  let code = parts.map(p => p[0]?.toUpperCase() || '').join('').slice(0, 3);
  if (code.length < 2) code = name.slice(0, 3).toUpperCase();
  code += '-' + String(Math.floor(Math.random() * 900) + 100);
  return code;
}

// --- Formatting ---
export function formatCurrency(amount) {
  return '₹' + Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function todayStr() {
  return new Date().toISOString().split('T')[0];
}

// --- Core Storage ---
const DEFAULT_DATA = {
  owner: {
    id: 'owner-1',
    email: '',
    name: 'Restaurant Owner',
    businessName: '',
    gstin: '',
    pan: '',
    businessAddress: '',
    financialYearStart: 4,
    currency: 'INR',
    createdAt: new Date().toISOString(),
  },
  branches: [],
  managers: [],
  bills: [],
  auditLog: [],
  notifications: [],
};

function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      // Ensure all keys exist (migrations) — deep-merge owner so new defaults apply
      const merged = { ...DEFAULT_DATA, ...data, owner: { ...DEFAULT_DATA.owner, ...data.owner } };
      // Migration: always sync API keys from code defaults
      merged.owner.geminiApiKey = DEFAULT_DATA.owner.geminiApiKey;
      merged.owner.geminiApiKeyFallback = DEFAULT_DATA.owner.geminiApiKeyFallback;
      saveData(merged);
      return merged;
    }
  } catch (e) {
    console.error('Failed to load data:', e);
  }
  const initial = JSON.parse(JSON.stringify(DEFAULT_DATA));
  saveData(initial);
  return initial;
}

function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('Storage full or failed:', e);
    alert('⚠️ Storage is full. Please delete some old bills to continue.');
  }
}

let _data = null;
function getData() {
  if (!_data) _data = loadData();
  return _data;
}

function persist() {
  saveData(getData());
}

// === Auth ===
export function getOwner() {
  return getData().owner;
}

export function updateOwner(updates) {
  Object.assign(getData().owner, updates);
  persist();
  addAuditEntry('settings_updated', getData().owner.name, {});
}

export function authenticateOwner(email, password) {
  const owner = getData().owner;
  return owner.email === email && owner.password === password ? owner : null;
}

export function authenticateManager(username, password) {
  const mgr = getData().managers.find(m => m.username === username && m.password === password && m.isActive);
  return mgr || null;
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setSession(session) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY);
}

// === Branches ===
export function getBranches() {
  return getData().branches;
}

export function getBranchById(id) {
  return getData().branches.find(b => b.id === id) || null;
}

export function getBranchByCode(code) {
  return getData().branches.find(b => b.branchCode.toLowerCase() === code.toLowerCase()) || null;
}

export function getBranchName(branchId) {
  const b = getBranchById(branchId);
  return b ? b.branchName : 'Unknown';
}

export function getBranchShortName(branchId) {
  const b = getBranchById(branchId);
  if (!b) return 'Unknown';
  const parts = b.branchName.split('—');
  return parts.length > 1 ? parts[1].trim() : b.branchName;
}

export function addBranch(data) {
  const branch = {
    id: generateId('br'),
    branchCode: data.branchCode || generateBranchCode(data.branchName),
    isActive: true,
    createdAt: new Date().toISOString(),
    dailyBudget: 0,
    monthlyBudget: 0,
    ...data,
  };
  getData().branches.push(branch);
  persist();
  addAuditEntry('branch_created', getSession()?.userName || 'System', { branchName: branch.branchName });
  return branch;
}

export function updateBranch(id, updates) {
  const branch = getBranchById(id);
  if (branch) {
    Object.assign(branch, updates);
    persist();
    addAuditEntry('branch_updated', getSession()?.userName || 'System', { branchName: branch.branchName });
  }
  return branch;
}

export function deleteBranch(id) {
  const data = getData();
  const idx = data.branches.findIndex(b => b.id === id);
  if (idx > -1) {
    const name = data.branches[idx].branchName;
    data.branches.splice(idx, 1);
    // Also remove associated managers
    data.managers = data.managers.filter(m => m.branchId !== id);
    // Also remove associated bills
    data.bills = data.bills.filter(b => b.branchId !== id);
    persist();
    addAuditEntry('branch_deleted', getSession()?.userName || 'System', { branchName: name });
  }
}

// === Managers ===
export function getManagers() {
  return getData().managers;
}

export function getManagerById(id) {
  return getData().managers.find(m => m.id === id) || null;
}

export function getManagersByBranch(branchId) {
  return getData().managers.filter(m => m.branchId === branchId);
}

export function addManager(data) {
  // Check username uniqueness
  if (getData().managers.some(m => m.username === data.username)) {
    throw new Error('Username already exists');
  }
  const manager = {
    id: generateId('mgr'),
    isActive: true,
    createdAt: new Date().toISOString(),
    ...data,
  };
  getData().managers.push(manager);
  persist();
  addAuditEntry('manager_created', getSession()?.userName || 'System', { managerName: manager.name });
  return manager;
}

export function updateManager(id, updates) {
  const mgr = getManagerById(id);
  if (mgr) {
    // If username is being changed, check uniqueness
    if (updates.username && updates.username !== mgr.username) {
      if (getData().managers.some(m => m.username === updates.username && m.id !== id)) {
        throw new Error('Username already exists');
      }
    }
    Object.assign(mgr, updates);
    persist();
    addAuditEntry('manager_updated', getSession()?.userName || 'System', { managerName: mgr.name });
  }
  return mgr;
}

export function deleteManager(id) {
  const data = getData();
  const idx = data.managers.findIndex(m => m.id === id);
  if (idx > -1) {
    const name = data.managers[idx].name;
    data.managers.splice(idx, 1);
    persist();
    addAuditEntry('manager_deleted', getSession()?.userName || 'System', { managerName: name });
  }
}

export function getManagerName(managerId) {
  const m = getManagerById(managerId);
  return m ? m.name : 'Unknown';
}

// === Bills ===
export function getBills() {
  return getData().bills;
}

export function getBillById(id) {
  return getData().bills.find(b => b.id === id) || null;
}

export function getBillsByBranch(branchId) {
  if (!branchId || branchId === 'all') return getData().bills;
  return getData().bills.filter(b => b.branchId === branchId);
}

export function getBillsByDateRange(bills, startDate, endDate) {
  if (!startDate && !endDate) return bills;
  return bills.filter(b => {
    if (startDate && b.billDate < startDate) return false;
    if (endDate && b.billDate > endDate) return false;
    return true;
  });
}

export function getTodayBills(branchId) {
  const today = todayStr();
  return getBillsByBranch(branchId).filter(b => b.billDate === today);
}

export function getThisMonthBills(branchId) {
  const now = new Date();
  const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  return getBillsByBranch(branchId).filter(b => b.billDate >= startOfMonth);
}

export function addBill(data) {
  const bill = {
    id: generateId('bill'),
    status: 'pending',
    flags: [],
    ownerNotes: '',
    verifiedAt: null,
    verifiedBy: null,
    uploadedAt: new Date().toISOString(),
    ...data,
  };

  // Duplicate detection: same branch + date + vendor + amount (±2%)
  const dupes = getData().bills.filter(b =>
    b.branchId === bill.branchId &&
    b.billDate === bill.billDate &&
    b.vendorName.toLowerCase() === bill.vendorName.toLowerCase() &&
    Math.abs(b.totalAmount - bill.totalAmount) / Math.max(b.totalAmount, 1) < 0.02
  );
  if (dupes.length > 0) {
    bill.flags.push('duplicate');
    addNotification(bill.branchId, 'duplicate_flag',
      `🔴 Possible duplicate: ${bill.vendorName} — ${formatCurrency(bill.totalAmount)} on ${formatDate(bill.billDate)}`);
  }

  // Budget alert check
  const branch = getBranchById(bill.branchId);
  if (branch && branch.dailyBudget > 0) {
    const todayTotal = sumAmount(getTodayBills(bill.branchId)) + bill.totalAmount;
    const pct = (todayTotal / branch.dailyBudget) * 100;
    if (pct >= 80) {
      addNotification(bill.branchId, 'budget_alert',
        `⚠️ Budget Alert: ${getBranchShortName(bill.branchId)} has used ${Math.round(pct)}% of daily budget (${formatCurrency(todayTotal)} / ${formatCurrency(branch.dailyBudget)})`);
    }
  }

  getData().bills.push(bill);
  persist();
  addAuditEntry('bill_uploaded', data.uploaderName || 'Manager', { vendorName: bill.vendorName, amount: bill.totalAmount, branchId: bill.branchId });
  return bill;
}

export function updateBill(id, updates) {
  const bill = getBillById(id);
  if (bill) {
    const old = { ...bill };
    Object.assign(bill, updates);
    persist();
    addAuditEntry('bill_edited', getSession()?.userName || 'System', {
      billId: id, oldAmount: old.totalAmount, newAmount: bill.totalAmount,
    });
  }
  return bill;
}

export function verifyBill(id) {
  const bill = getBillById(id);
  if (bill) {
    bill.status = 'verified';
    bill.verifiedAt = new Date().toISOString();
    bill.verifiedBy = getSession()?.userId || 'owner-1';
    bill.flags = bill.flags.filter(f => f !== 'duplicate');
    persist();
    addAuditEntry('bill_verified', getSession()?.userName || 'Owner', { billId: id, vendorName: bill.vendorName });
  }
  return bill;
}

export function flagBill(id, reason = '') {
  const bill = getBillById(id);
  if (bill) {
    bill.status = 'flagged';
    if (!bill.flags.includes('manual_flag')) bill.flags.push('manual_flag');
    if (reason) bill.ownerNotes = reason;
    persist();
    addAuditEntry('bill_flagged', getSession()?.userName || 'Owner', { billId: id, vendorName: bill.vendorName });
  }
  return bill;
}

export function deleteBill(id) {
  const data = getData();
  const idx = data.bills.findIndex(b => b.id === id);
  if (idx > -1) {
    const bill = data.bills[idx];
    data.bills.splice(idx, 1);
    persist();
    addAuditEntry('bill_deleted', getSession()?.userName || 'System', { billId: id, vendorName: bill.vendorName });
  }
}

// === Notifications ===
export function getNotifications() {
  return getData().notifications;
}

export function addNotification(branchId, type, message) {
  getData().notifications.unshift({
    id: generateId('notif'),
    branchId,
    type,
    message,
    createdAt: new Date().toISOString(),
    read: false,
  });
  // Keep only last 200
  if (getData().notifications.length > 200) {
    getData().notifications = getData().notifications.slice(0, 200);
  }
  persist();
}

export function getUnreadNotificationCount() {
  return getData().notifications.filter(n => !n.read).length;
}

export function markNotificationsRead() {
  getData().notifications.forEach(n => { n.read = true; });
  persist();
}

// === Audit Log ===
export function getAuditLog() {
  return getData().auditLog;
}

export function addAuditEntry(action, performedBy, details = {}) {
  getData().auditLog.unshift({
    id: generateId('audit'),
    action,
    performedBy,
    details,
    timestamp: new Date().toISOString(),
  });
  // Keep only last 500
  if (getData().auditLog.length > 500) {
    getData().auditLog = getData().auditLog.slice(0, 500);
  }
  persist();
}

// === Query Helpers ===
export function sumAmount(bills) {
  return bills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
}

export function groupByCategory(bills) {
  const groups = {};
  bills.forEach(b => {
    const key = b.category || 'miscellaneous';
    if (!groups[key]) groups[key] = { bills: [], total: 0 };
    groups[key].bills.push(b);
    groups[key].total += b.totalAmount || 0;
  });
  return groups;
}

export function groupByDate(bills) {
  const groups = {};
  bills.forEach(b => {
    const key = b.billDate;
    if (!groups[key]) groups[key] = { bills: [], total: 0 };
    groups[key].bills.push(b);
    groups[key].total += b.totalAmount || 0;
  });
  return groups;
}

export function groupByBranch(bills) {
  const groups = {};
  bills.forEach(b => {
    if (!groups[b.branchId]) groups[b.branchId] = { bills: [], total: 0 };
    groups[b.branchId].bills.push(b);
    groups[b.branchId].total += b.totalAmount || 0;
  });
  return groups;
}

export function groupByPaymentMode(bills) {
  const groups = {};
  bills.forEach(b => {
    const key = b.paymentMode || 'other';
    if (!groups[key]) groups[key] = { bills: [], total: 0 };
    groups[key].bills.push(b);
    groups[key].total += b.totalAmount || 0;
  });
  return groups;
}

export function groupByVendor(bills) {
  const groups = {};
  bills.forEach(b => {
    const key = b.vendorName || 'Unknown';
    if (!groups[key]) groups[key] = { bills: [], total: 0, count: 0 };
    groups[key].bills.push(b);
    groups[key].total += b.totalAmount || 0;
    groups[key].count++;
  });
  return groups;
}

export function getVendorStats(branchId) {
  const bills = getBillsByBranch(branchId);
  const byVendor = groupByVendor(bills);
  return Object.entries(byVendor).map(([name, data]) => {
    const lastBill = data.bills.sort((a, b) => b.billDate.localeCompare(a.billDate))[0];
    const branchIds = [...new Set(data.bills.map(b => b.branchId))];
    return {
      vendorName: name,
      primaryCategory: lastBill?.category || 'miscellaneous',
      totalSpend: data.total,
      billCount: data.count,
      avgBillValue: data.count > 0 ? data.total / data.count : 0,
      branchesServed: branchIds.length,
      lastSeen: lastBill?.billDate || '',
      gstin: lastBill?.vendorGstin || '',
    };
  }).sort((a, b) => b.totalSpend - a.totalSpend);
}

export function getFlaggedBills(branchId) {
  return getBillsByBranch(branchId).filter(b => b.status === 'flagged' || (b.flags && b.flags.length > 0));
}

export function getPendingBills(branchId) {
  return getBillsByBranch(branchId).filter(b => b.status === 'pending');
}

// === Image Processing ===
export function processImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const maxW = 800;
        let w = img.width, h = img.height;
        if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// === App State (in-memory, not persisted) ===
const appState = {
  currentPage: 'login',
  selectedBranch: 'all',
  dateRange: {
    start: (() => { const d = new Date(); d.setDate(d.getDate() - 29); return d.toISOString().split('T')[0]; })(),
    end: todayStr(),
  },
};

export function getState() { return appState; }
export function setState(key, value) { appState[key] = value; }

// === Reset (for development) ===
export function resetAllData() {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY);
  _data = null;
}
