// ============================================
// Staff Attendance Page — Mobile Checklist
// ============================================

import { staff as staffApi } from '../services/api.js';
import { showToast } from '../components/toast.js';
import { detectShift } from '../components/shiftSelector.js';

let staffList = [];
let attendanceState = {};

export function render(container) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const currentShift = detectShift();

  container.innerHTML = `
    <div class="attendance-page">
      <div class="card">
        <h3>👥 Staff Attendance · ${today}</h3>

        <div class="shift-toggle" id="shift-toggle">
          <button class="shift-btn ${currentShift === 'morning' ? 'active' : ''}" data-shift="morning">🌅 Morning</button>
          <button class="shift-btn ${currentShift === 'lunch' ? 'active' : ''}" data-shift="lunch">☀️ Lunch</button>
          <button class="shift-btn ${currentShift === 'dinner' ? 'active' : ''}" data-shift="dinner">🌙 Dinner</button>
        </div>

        <div id="staff-list" class="staff-checklist">
          <div class="skeleton-row"></div>
          <div class="skeleton-row"></div>
        </div>

        <div class="attendance-actions">
          <button class="btn btn-outline" id="add-staff-btn">+ Add Staff</button>
          <button class="btn btn-primary" id="submit-attendance-btn">Submit ✓</button>
        </div>
      </div>

      <!-- Add Staff Modal -->
      <div class="inline-form" id="add-staff-form" style="display:none">
        <div class="card">
          <h4>Add Staff Member</h4>
          <div class="form-group">
            <label class="form-label">Name</label>
            <input type="text" class="form-input" id="new-staff-name" placeholder="Staff name" required>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Role</label>
              <select class="form-input" id="new-staff-role">
                <option value="cook">Cook</option>
                <option value="waiter">Waiter</option>
                <option value="helper" selected>Helper</option>
                <option value="cleaner">Cleaner</option>
                <option value="cashier">Cashier</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">Daily Rate (₹)</label>
              <input type="number" class="form-input" id="new-staff-rate" placeholder="500" min="0">
            </div>
          </div>
          <div class="form-actions">
            <button class="btn btn-outline" id="cancel-add-staff">Cancel</button>
            <button class="btn btn-primary" id="save-staff-btn">Add</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  let currentShift = detectShift();

  // Load staff list
  try {
    staffList = await staffApi.list({ branch_id: session.branchId });
    renderStaffList();
  } catch (err) {
    document.getElementById('staff-list').innerHTML = '<div class="empty-state-small">Failed to load staff</div>';
  }

  // Load existing attendance
  try {
    const today = new Date().toISOString().split('T')[0];
    const existing = await staffApi.getAttendance({ branch_id: session.branchId, date: today, shift: currentShift });
    existing.forEach(a => { attendanceState[a.staff_id] = a.present; });
    renderStaffList();
  } catch {}

  // Shift toggle
  document.querySelectorAll('.shift-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      currentShift = btn.dataset.shift;
      document.querySelectorAll('.shift-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      attendanceState = {};
      try {
        const today = new Date().toISOString().split('T')[0];
        const existing = await staffApi.getAttendance({ branch_id: session.branchId, date: today, shift: currentShift });
        existing.forEach(a => { attendanceState[a.staff_id] = a.present; });
      } catch {}
      renderStaffList();
    });
  });

  // Submit attendance
  document.getElementById('submit-attendance-btn')?.addEventListener('click', async () => {
    const entries = staffList.filter(s => s.is_active).map(s => ({
      staff_id: s.id,
      present: attendanceState[s.id] !== false,
      branch_id: session.branchId,
    }));
    try {
      await staffApi.logAttendance({ entries, date: new Date().toISOString().split('T')[0], shift: currentShift });
      showToast('Attendance submitted ✓', 'success');
    } catch (err) {
      showToast('Failed to submit: ' + err.message, 'error');
    }
  });

  // Add staff
  document.getElementById('add-staff-btn')?.addEventListener('click', () => {
    document.getElementById('add-staff-form').style.display = 'block';
  });
  document.getElementById('cancel-add-staff')?.addEventListener('click', () => {
    document.getElementById('add-staff-form').style.display = 'none';
  });
  document.getElementById('save-staff-btn')?.addEventListener('click', async () => {
    const name = document.getElementById('new-staff-name').value.trim();
    if (!name) return showToast('Name is required', 'error');
    try {
      const newStaff = await staffApi.create({
        name,
        role: document.getElementById('new-staff-role').value,
        daily_rate: parseFloat(document.getElementById('new-staff-rate').value) || 0,
        wage_type: 'daily',
        branch_id: session.branchId,
      });
      staffList.push(newStaff);
      renderStaffList();
      document.getElementById('add-staff-form').style.display = 'none';
      document.getElementById('new-staff-name').value = '';
      showToast(`${name} added ✓`, 'success');
    } catch (err) {
      showToast('Failed to add: ' + err.message, 'error');
    }
  });

  function renderStaffList() {
    const listEl = document.getElementById('staff-list');
    const activeStaff = staffList.filter(s => s.is_active);
    if (activeStaff.length === 0) {
      listEl.innerHTML = '<div class="empty-state-small">No staff added yet. Tap "+ Add Staff" to start.</div>';
      return;
    }
    listEl.innerHTML = activeStaff.map(s => {
      const isPresent = attendanceState[s.id] !== false;
      return `
        <div class="staff-row" data-staff-id="${s.id}">
          <button class="attendance-toggle ${isPresent ? 'present' : 'absent'}" data-staff-id="${s.id}">
            ${isPresent ? '✅' : '❌'}
          </button>
          <div class="staff-info">
            <span class="staff-name">${s.name}</span>
            <span class="staff-role">${s.role}</span>
          </div>
          ${!isPresent ? '<span class="absent-label">absent</span>' : ''}
        </div>
      `;
    }).join('');

    listEl.querySelectorAll('.attendance-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const staffId = btn.dataset.staffId;
        attendanceState[staffId] = attendanceState[staffId] === false ? true : false;
        renderStaffList();
      });
    });
  }
}

export function cleanup() {
  staffList = [];
  attendanceState = {};
}
