// ============================================
// Petty Cash Page — Cash Reconciliation
// Opening balance → cash bills tracked → closing balance
// ============================================

import { pettyCash as pcApi, bills as billsApi } from '../services/api.js';
import { formatCurrency, todayStr } from '../data/store.js';
import { showToast } from '../components/toast.js';

export function render(container) {
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  container.innerHTML = `
    <div class="petty-cash-page">
      <div class="card">
        <h3>💰 Petty Cash · ${today}</h3>

        <div class="petty-cash-form">
          <div class="form-group">
            <label class="form-label">Opening Balance</label>
            <div class="input-with-prefix">
              <span class="input-prefix">₹</span>
              <input type="number" class="form-input" id="pc-opening" placeholder="5000" min="0" step="1">
            </div>
          </div>

          <div class="petty-cash-summary" id="pc-summary">
            <div class="pc-row">
              <span>Cash spent on bills:</span>
              <span id="pc-cash-spent" class="pc-value">₹0</span>
            </div>
            <div class="pc-row">
              <span>Number of cash bills:</span>
              <span id="pc-bill-count" class="pc-value">0</span>
            </div>
            <div class="pc-row pc-row-highlight">
              <span>Expected Closing:</span>
              <span id="pc-expected" class="pc-value">₹0</span>
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Actual Closing Balance</label>
            <div class="input-with-prefix">
              <span class="input-prefix">₹</span>
              <input type="number" class="form-input" id="pc-closing" placeholder="Enter actual cash count" min="0" step="1">
            </div>
          </div>

          <div class="pc-variance-display" id="pc-variance" style="display:none">
            <span id="pc-variance-label">Variance:</span>
            <span id="pc-variance-amount" class="pc-variance-amount">₹0</span>
          </div>

          <div class="form-group">
            <label class="form-label">Notes (optional)</label>
            <textarea class="form-input" id="pc-notes" rows="2" placeholder="Any notes about the cash count"></textarea>
          </div>

          <button class="btn btn-primary" id="pc-submit" style="width:100%">Submit Close</button>
        </div>
      </div>
    </div>
  `;
}

export async function init() {
  const session = JSON.parse(localStorage.getItem('rl_session') || '{}');
  const today = todayStr();

  // Load existing data
  try {
    const pcData = await pcApi.get({ branch_id: session.branchId, date: today });

    if (pcData.entry) {
      document.getElementById('pc-opening').value = pcData.entry.opening_balance || '';
      if (pcData.entry.closing_balance !== null) {
        document.getElementById('pc-closing').value = pcData.entry.closing_balance;
      }
      if (pcData.entry.notes) {
        document.getElementById('pc-notes').value = pcData.entry.notes;
      }
    }

    updateSummary(pcData.cashSpent, pcData.cashBillCount);
  } catch (err) {
    console.error('Failed to load petty cash:', err);
  }

  // Recalculate on opening balance change
  document.getElementById('pc-opening')?.addEventListener('input', () => updateCalculations());

  // Show variance on closing balance input
  document.getElementById('pc-closing')?.addEventListener('input', () => {
    const opening = parseFloat(document.getElementById('pc-opening').value) || 0;
    const cashSpent = parseFloat(document.getElementById('pc-cash-spent').textContent.replace(/[₹,]/g, '')) || 0;
    const expected = opening - cashSpent;
    const closing = parseFloat(document.getElementById('pc-closing').value);

    if (!isNaN(closing)) {
      const variance = closing - expected;
      const varianceEl = document.getElementById('pc-variance');
      varianceEl.style.display = 'flex';
      const amountEl = document.getElementById('pc-variance-amount');
      amountEl.textContent = `₹${Math.abs(variance).toLocaleString('en-IN')}`;
      if (Math.abs(variance) < 1) {
        amountEl.className = 'pc-variance-amount variance-ok';
        amountEl.textContent = '₹0 ✅';
      } else if (variance < 0) {
        amountEl.className = 'pc-variance-amount variance-short';
        amountEl.textContent = `₹${Math.abs(variance).toLocaleString('en-IN')} short`;
      } else {
        amountEl.className = 'pc-variance-amount variance-over';
        amountEl.textContent = `₹${variance.toLocaleString('en-IN')} over`;
      }
    }
  });

  // Submit
  document.getElementById('pc-submit')?.addEventListener('click', async () => {
    const opening = parseFloat(document.getElementById('pc-opening').value);
    const closing = parseFloat(document.getElementById('pc-closing').value);
    const notes = document.getElementById('pc-notes').value;

    if (isNaN(opening)) return showToast('Enter opening balance', 'error');
    if (isNaN(closing)) return showToast('Enter actual closing balance', 'error');

    try {
      await pcApi.save({
        branch_id: session.branchId,
        date: today,
        opening_balance: opening,
        closing_balance: closing,
        notes,
      });
      showToast('Petty cash submitted ✓', 'success');
    } catch (err) {
      showToast('Failed: ' + err.message, 'error');
    }
  });

  function updateSummary(cashSpent, billCount) {
    document.getElementById('pc-cash-spent').textContent = formatCurrency(cashSpent || 0);
    document.getElementById('pc-bill-count').textContent = billCount || 0;
    updateCalculations();
  }

  function updateCalculations() {
    const opening = parseFloat(document.getElementById('pc-opening').value) || 0;
    const cashSpent = parseFloat(document.getElementById('pc-cash-spent').textContent.replace(/[₹,]/g, '')) || 0;
    const expected = opening - cashSpent;
    document.getElementById('pc-expected').textContent = formatCurrency(expected);
  }
}

export function cleanup() {}
