// ============================================
// Toast Notification Component
// ============================================

let toastContainer = null;

export function initToast() {
  toastContainer = document.getElementById('toast-root');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toast-root';
    document.body.appendChild(toastContainer);
  }
  toastContainer.className = 'toast-container';
}

const icons = {
  success: '✅',
  error: '❌',
  warning: '⚠️',
  info: 'ℹ️',
};

export function showToast(message, type = 'info') {
  if (!toastContainer) initToast();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span> <span>${message}</span>`;

  toastContainer.appendChild(toast);

  // Auto-remove after animation
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3200);
}
