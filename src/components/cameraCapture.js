// ============================================
// Camera Capture Component
// Bottom sheet: Take Photo / Gallery / Manual
// capture="environment" for rear camera on mobile
// ============================================

export function renderCameraCapture(container, { onImageCaptured, onManualEntry }) {
  container.innerHTML = `
    <div class="camera-capture" id="camera-capture-container">
      <div class="camera-capture-options">
        <label class="camera-option camera-option-primary" id="camera-take-photo">
          <input type="file" accept="image/*" capture="environment" class="camera-input" id="camera-input-capture">
          <span class="camera-option-icon">📷</span>
          <span class="camera-option-label">Take Photo</span>
          <span class="camera-option-hint">Opens rear camera</span>
        </label>

        <label class="camera-option camera-option-secondary" id="camera-gallery">
          <input type="file" accept="image/*" class="camera-input" id="camera-input-gallery">
          <span class="camera-option-icon">🖼️</span>
          <span class="camera-option-label">Choose from Gallery</span>
        </label>

        <button class="camera-option camera-option-tertiary" id="camera-manual">
          <span class="camera-option-icon">⌨️</span>
          <span class="camera-option-label">Enter Manually</span>
        </button>
      </div>

      <!-- Desktop: drag-and-drop zone -->
      <div class="camera-dropzone" id="camera-dropzone">
        <div class="camera-dropzone-icon">📤</div>
        <div class="camera-dropzone-text">Drag & drop bill image here</div>
        <div class="camera-dropzone-hint">or click to browse files</div>
        <input type="file" accept="image/*" class="camera-input" id="camera-input-drop">
      </div>
    </div>
  `;

  // Handle file inputs
  const handleFile = async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    const compressed = await compressImage(file);
    if (onImageCaptured) onImageCaptured(compressed.dataUrl, compressed.file, file.name);
  };

  ['camera-input-capture', 'camera-input-gallery', 'camera-input-drop'].forEach(id => {
    const input = document.getElementById(id);
    input?.addEventListener('change', (e) => {
      if (e.target.files?.[0]) handleFile(e.target.files[0]);
    });
  });

  // Manual entry button
  document.getElementById('camera-manual')?.addEventListener('click', () => {
    if (onManualEntry) onManualEntry();
  });

  // Drag and drop
  const dropzone = document.getElementById('camera-dropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      if (e.dataTransfer.files?.[0]) handleFile(e.dataTransfer.files[0]);
    });
    dropzone.addEventListener('click', () => {
      document.getElementById('camera-input-drop')?.click();
    });
  }
}

// Image compression — resize to 800px max width, 60% quality JPEG
async function compressImage(file) {
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
        const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        canvas.toBlob((blob) => {
          resolve({ dataUrl, file: new File([blob], file.name, { type: 'image/jpeg' }) });
        }, 'image/jpeg', 0.6);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
