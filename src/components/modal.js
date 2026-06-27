// ============================================
// Modal Component
// ============================================

let modalRoot = null;

function ensureRoot() {
  if (!modalRoot) {
    modalRoot = document.getElementById('modal-root');
  }
}

export function showModal({ title, content, size = 'default', onClose, footer = '' }) {
  ensureRoot();
  const sizeClass = size === 'large' ? 'large' : size === 'small' ? 'small' : '';

  modalRoot.innerHTML = `
    <div class="modal-overlay" id="modal-overlay">
      <div class="modal-container ${sizeClass}">
        <div class="modal-header">
          <h3 class="modal-title">${title}</h3>
          <button class="modal-close" id="modal-close-btn">×</button>
        </div>
        <div class="modal-body" id="modal-body">
          ${content}
        </div>
        ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
      </div>
    </div>
  `;

  // Animate in
  requestAnimationFrame(() => {
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.classList.add('visible');
  });

  // Close handlers
  const closeHandler = () => {
    hideModal();
    if (onClose) onClose();
  };

  document.getElementById('modal-close-btn').addEventListener('click', closeHandler);
  document.getElementById('modal-overlay').addEventListener('click', (e) => {
    if (e.target.id === 'modal-overlay') closeHandler();
  });

  // ESC key
  const escHandler = (e) => {
    if (e.key === 'Escape') {
      closeHandler();
      document.removeEventListener('keydown', escHandler);
    }
  };
  document.addEventListener('keydown', escHandler);

  return document.getElementById('modal-body');
}

export function hideModal() {
  ensureRoot();
  const overlay = document.getElementById('modal-overlay');
  if (overlay) {
    overlay.classList.remove('visible');
    setTimeout(() => {
      modalRoot.innerHTML = '';
    }, 250);
  }
}
