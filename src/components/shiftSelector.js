// ============================================
// Shift Selector Component
// Auto-detect from time, allow override
// ============================================

const DEFAULT_SHIFTS = [
  { name: 'Morning', start: '06:00', end: '11:00', icon: '🌅' },
  { name: 'Lunch', start: '11:00', end: '16:00', icon: '☀️' },
  { name: 'Dinner', start: '16:00', end: '23:00', icon: '🌙' },
];

export function detectShift(hour) {
  if (hour === undefined) hour = new Date().getHours();
  if (hour >= 6 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 16) return 'lunch';
  return 'dinner';
}

export function renderShiftSelector(container, { currentShift, onChange, shifts }) {
  const shiftList = shifts || DEFAULT_SHIFTS;
  const selected = currentShift || detectShift();

  container.innerHTML = `
    <div class="shift-selector">
      <label class="form-label">Shift</label>
      <div class="shift-options">
        ${shiftList.map(s => {
          const value = s.name.toLowerCase();
          return `
            <button class="shift-option ${value === selected ? 'active' : ''}" data-shift="${value}">
              <span class="shift-icon">${s.icon}</span>
              <span class="shift-name">${s.name}</span>
              <span class="shift-time">${s.start}–${s.end}</span>
            </button>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.shift-option').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.shift-option').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (onChange) onChange(btn.dataset.shift);
    });
  });
}
