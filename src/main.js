/**
 * main.js
 * Titik masuk utama aplikasi Tandain.
 * Menghubungkan seluruh modul core, state manajemen, dan interaksi UI modern.
 */

import './styles/main.css';
import { initTheme, toggleTheme } from './ui/theme.js';
import { getSavedPresets, saveCustomPreset, deleteCustomPreset, BUILTIN_PRESETS } from './ui/presets.js';
import { DEFAULT_WATERMARK_SETTINGS, getTodayFormatted } from './core/watermark.js';
import { RedactionManager } from './core/redact.js';
import { DocumentPreview } from './ui/preview.js';
import { loadDocument } from './core/loader.js';
import { exportDocument, exportBatchAsZip, triggerDownload } from './core/exporter.js';
import { fullMemoryCleanup, clearCanvas } from './core/cleanup.js';

// ==========================================
// STATE APLIKASI (Hanya hidup di RAM)
// ==========================================
let loadedDocuments = [];
let activeDocIndex = 0;
let watermarkSettings = { ...DEFAULT_WATERMARK_SETTINGS };
let redactionManager = new RedactionManager();
let exportFormat = 'png'; // 'png' | 'jpg' | 'pdf'
let preview = null;
let currentZoom = 1.0;

// ==========================================
// TOAST NOTIFIKASI MODERN
// ==========================================
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 250);
  }, duration);
}

// ==========================================
// DUMMY KTP GENERATOR (Untuk pengujian cepat)
// ==========================================
async function createDummyKtpBitmap() {
  const canvas = document.createElement('canvas');
  canvas.width = 856;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');

  // Background KTP biru langit bergradasi
  const grad = ctx.createLinearGradient(0, 0, 856, 540);
  grad.addColorStop(0, '#bae6fd');
  grad.addColorStop(0.5, '#7dd3fc');
  grad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 856, 540);

  // Pola garis halus keamanan guilloche
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.2;
  for (let i = -540; i < 856; i += 26) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.bezierCurveTo(i + 200, 180, i + 100, 360, i + 300, 540);
    ctx.stroke();
  }

  // Header KTP
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('REPUBLIK INDONESIA', 428, 42);
  ctx.font = 'bold 17px sans-serif';
  ctx.fillText('PROVINSI DKI JAKARTA', 428, 68);
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('KOTA JAKARTA SELATAN', 428, 88);

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(40, 100);
  ctx.lineTo(816, 100);
  ctx.stroke();

  // NIK
  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('NIK          : 3174051208900003', 50, 140);

  // Field Data Diri
  const fields = [
    ['Nama', 'WARGA CONTOH TANDAIN'],
    ['Tempat/Tgl Lahir', 'JAKARTA, 12-08-1990'],
    ['Jenis Kelamin', 'LAKI-LAKI'],
    ['Alamat', 'JL. KEAMANAN DATA NO. 10'],
    ['RT/RW', '005/002'],
    ['Kel/Desa', 'SENAYAN'],
    ['Kecamatan', 'KEBAYORAN BARU'],
    ['Agama', 'ISLAM'],
    ['Status Perkawinan', 'KAWIN'],
    ['Pekerjaan', 'KARYAWAN SWASTA'],
    ['Kewarganegaraan', 'WNI'],
    ['Berlaku Hingga', 'SEUMUR HIDUP']
  ];

  ctx.font = '600 13px sans-serif';
  let startY = 175;
  for (const [label, val] of fields) {
    ctx.fillStyle = '#1e293b';
    ctx.fillText(label.padEnd(18, ' ') + ': ' + val, 50, startY);
    startY += 24;
  }

  // Kotak Pas Foto
  ctx.fillStyle = '#cbd5e1';
  ctx.fillRect(640, 140, 160, 210);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.strokeRect(640, 140, 160, 210);

  ctx.fillStyle = '#94a3b8';
  ctx.beginPath();
  ctx.arc(720, 210, 40, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(720, 310, 60, Math.PI, 0);
  ctx.fill();

  ctx.fillStyle = '#475569';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAS FOTO', 720, 280);

  // Tanda Tangan Box
  ctx.strokeStyle = '#64748b';
  ctx.strokeRect(640, 370, 160, 70);
  ctx.font = 'italic 18px cursive, sans-serif';
  ctx.fillStyle = '#0f172a';
  ctx.fillText('Contoh TTD', 720, 415);

  const bitmap = await window.createImageBitmap(canvas);
  clearCanvas(canvas);
  return bitmap;
}

// ==========================================
// INISIALISASI APLIKASI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.getElementById('btnToggleTheme')?.addEventListener('click', toggleTheme);

  const previewCanvas = document.getElementById('previewCanvas');
  const canvasViewport = document.getElementById('canvasViewport');
  preview = new DocumentPreview(previewCanvas, canvasViewport);

  // Callback saat seleksi kotak sensor berubah
  preview.onSelectionChange = (selectedBox) => {
    const floatBar = document.getElementById('redactFloatBar');
    if (floatBar) {
      if (selectedBox) floatBar.classList.add('visible');
      else floatBar.classList.remove('visible');
    }
    updateRedactionPanel();
    updateUndoRedoButtons();
  };

  setupFileInputs();
  setupStageToolbar();
  setupStudioWatermark();
  setupStudioRedact();
  setupStudioExport();
  setupKeyboardShortcuts();

  document.getElementById('btnResetApp')?.addEventListener('click', resetAll);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
});

// ==========================================
// INPUT FILE & DRAG DROP
// ==========================================
function setupFileInputs() {
  const dropzoneCard = document.getElementById('dropzoneCard');
  const fileInput = document.getElementById('fileInput');
  const btnBrowseFile = document.getElementById('btnBrowseFile');
  const btnSampleDoc = document.getElementById('btnSampleDoc');
  const btnAddMore = document.getElementById('btnAddMoreDocs');

  btnBrowseFile?.addEventListener('click', () => fileInput?.click());
  btnAddMore?.addEventListener('click', () => fileInput?.click());

  dropzoneCard?.addEventListener('click', (e) => {
    if (e.target !== btnBrowseFile && e.target !== btnSampleDoc) {
      fileInput?.click();
    }
  });

  ['dragenter', 'dragover'].forEach(name => {
    dropzoneCard?.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneCard.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(name => {
    dropzoneCard?.addEventListener(name, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneCard.classList.remove('drag-over');
    });
  });

  dropzoneCard?.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt ? Array.from(dt.files) : [];
    if (files.length > 0) handleFiles(files);
  });

  fileInput?.addEventListener('change', (e) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    if (files.length > 0) handleFiles(files);
    e.target.value = '';
  });

  btnSampleDoc?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      showToast('Membuat dokumen contoh KTP...', 'info');
      const sampleBitmap = await createDummyKtpBitmap();
      const sampleDoc = {
        id: 'doc_sample_ktp',
        name: 'Contoh_KTP_Indonesia.png',
        size: 512000,
        type: 'image',
        isPdf: false,
        width: sampleBitmap.width,
        height: sampleBitmap.height,
        bitmap: sampleBitmap,
        pages: [{ pageNumber: 1, width: sampleBitmap.width, height: sampleBitmap.height, bitmap: sampleBitmap }],
        activePageIndex: 0
      };

      loadedDocuments = [sampleDoc];
      activeDocIndex = 0;
      showWorkspace();
      showToast('Dokumen contoh KTP siap diuji!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat dokumen contoh', 'error');
    }
  });
}

async function handleFiles(files) {
  showToast(`Membaca ${files.length} dokumen di perangkat Anda...`, 'info');

  const newDocs = [];
  for (const file of files) {
    try {
      const doc = await loadDocument(file, (msg) => showToast(msg, 'info', 1500));
      newDocs.push(doc);
    } catch (err) {
      console.error('Gagal membaca file:', file.name, err);
      showToast(`Gagal membaca ${file.name}`, 'error');
    }
  }

  if (newDocs.length === 0) return;

  const previousCount = loadedDocuments.length;
  loadedDocuments = [...loadedDocuments, ...newDocs];
  activeDocIndex = previousCount;
  showWorkspace();
  showToast(`${newDocs.length} berkas berhasil dimuat 100% offline!`, 'success');
}

// ==========================================
// WORKSPACE DISPLAY & BATCH GALLERY
// ==========================================
function showWorkspace() {
  const dropzone = document.getElementById('dropzoneSection');
  const workspace = document.getElementById('workspaceSection');
  if (dropzone) dropzone.style.display = 'none';
  if (workspace) workspace.style.display = 'grid';

  updateBatchGallery();
  updateActiveDocumentView();
}

function updateBatchGallery() {
  const batchContainer = document.getElementById('batchContainer');
  const batchStrip = document.getElementById('batchStrip');
  const batchCountBadge = document.getElementById('batchCountBadge');
  const btnBatchZip = document.getElementById('btnDownloadBatchZip');

  if (!batchContainer || !batchStrip) return;

  if (loadedDocuments.length > 1) {
    batchContainer.style.display = 'block';
    if (btnBatchZip) btnBatchZip.style.display = 'flex';
    if (batchCountBadge) batchCountBadge.textContent = String(loadedDocuments.length);

    batchStrip.innerHTML = '';
    loadedDocuments.forEach((doc, idx) => {
      const card = document.createElement('div');
      card.className = `batch-card ${idx === activeDocIndex ? 'active' : ''}`;
      card.innerHTML = `
        <span>${doc.isPdf ? '📄' : '🖼️'}</span>
        <span style="max-width: 140px; overflow: hidden; text-overflow: ellipsis;">${doc.name}</span>
        <button class="btn-remove-batch" title="Hapus dari daftar" style="border: none; background: transparent; color: #ef4444; cursor: pointer; padding: 2px 4px; font-weight: bold;">✕</button>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('btn-remove-batch')) return;
        activeDocIndex = idx;
        updateBatchGallery();
        updateActiveDocumentView();
      });

      card.querySelector('.btn-remove-batch')?.addEventListener('click', (e) => {
        e.stopPropagation();
        removeDocumentAt(idx);
      });

      batchStrip.appendChild(card);
    });
  } else {
    batchContainer.style.display = 'none';
    if (btnBatchZip) btnBatchZip.style.display = 'none';
  }
}

function removeDocumentAt(index) {
  if (index < 0 || index >= loadedDocuments.length) return;
  const doc = loadedDocuments[index];
  fullMemoryCleanup([doc], []);
  loadedDocuments.splice(index, 1);

  if (loadedDocuments.length === 0) {
    resetAll();
    return;
  }

  if (activeDocIndex >= loadedDocuments.length) {
    activeDocIndex = loadedDocuments.length - 1;
  }
  updateBatchGallery();
  updateActiveDocumentView();
  showToast('Dokumen dihapus dari daftar', 'info');
}

function updateActiveDocumentView() {
  const doc = loadedDocuments[activeDocIndex];
  if (!doc) return;

  const page = doc.pages[doc.activePageIndex];
  const fileKey = `${doc.id}_p${doc.activePageIndex}`;

  // Navigasi PDF Multi-halaman
  const pdfPageNav = document.getElementById('pdfPageNav');
  const pageNavIndicator = document.getElementById('pageNavIndicator');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');

  if (doc.pages.length > 1) {
    if (pdfPageNav) pdfPageNav.style.display = 'flex';
    if (pageNavIndicator) pageNavIndicator.textContent = `Halaman ${doc.activePageIndex + 1} / ${doc.pages.length}`;
    if (btnPrevPage) btnPrevPage.disabled = doc.activePageIndex <= 0;
    if (btnNextPage) btnNextPage.disabled = doc.activePageIndex >= doc.pages.length - 1;
  } else {
    if (pdfPageNav) pdfPageNav.style.display = 'none';
  }

  preview.setDocumentPage(page, fileKey, redactionManager, watermarkSettings);
  updateRedactionPanel();
  updateUndoRedoButtons();
}

// ==========================================
// STAGE TOOLBAR (VIEW MODES, SENSOR, ZOOM, UNDO)
// ==========================================
function setupStageToolbar() {
  const btnAfter = document.getElementById('btnViewAfter');
  const btnBefore = document.getElementById('btnViewBefore');
  const btnSplit = document.getElementById('btnViewSplit');
  const btnToggleRedact = document.getElementById('btnToggleRedact');
  const btnDeleteSelectedBox = document.getElementById('btnDeleteSelectedBox');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');

  function setActiveViewBtn(activeBtn) {
    [btnAfter, btnBefore, btnSplit].forEach(b => b?.classList.remove('active'));
    activeBtn?.classList.add('active');
  }

  btnAfter?.addEventListener('click', () => {
    setActiveViewBtn(btnAfter);
    preview.setViewMode('after');
  });

  btnBefore?.addEventListener('click', () => {
    setActiveViewBtn(btnBefore);
    preview.setViewMode('before');
  });

  btnSplit?.addEventListener('click', () => {
    setActiveViewBtn(btnSplit);
    preview.setViewMode('split');
  });

  btnToggleRedact?.addEventListener('click', () => {
    const isNow = !preview.isRedactionMode;
    preview.setRedactionMode(isNow);
    btnToggleRedact.classList.toggle('active', isNow);
    syncRedactTabButton(isNow);
    showToast(isNow ? 'Mode Sensor aktif: Seret kursor di preview untuk membuat kotak sensor' : 'Mode Sensor non-aktif', 'info');
  });

  btnDeleteSelectedBox?.addEventListener('click', () => {
    deleteActiveRedactionBox();
  });

  btnPrevPage?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc && doc.activePageIndex > 0) {
      doc.activePageIndex--;
      updateActiveDocumentView();
    }
  });

  btnNextPage?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc && doc.activePageIndex < doc.pages.length - 1) {
      doc.activePageIndex++;
      updateActiveDocumentView();
    }
  });

  // Undo / Redo
  btnUndo?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc) {
      const fileKey = `${doc.id}_p${doc.activePageIndex}`;
      if (redactionManager.undo(fileKey)) {
        preview.render();
        updateRedactionPanel();
        updateUndoRedoButtons();
        showToast('Undo berhasil', 'info', 1000);
      }
    }
  });

  btnRedo?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc) {
      const fileKey = `${doc.id}_p${doc.activePageIndex}`;
      if (redactionManager.redo(fileKey)) {
        preview.render();
        updateRedactionPanel();
        updateUndoRedoButtons();
        showToast('Redo berhasil', 'info', 1000);
      }
    }
  });

  // Zoom
  btnZoomIn?.addEventListener('click', () => {
    currentZoom = Math.min(2.5, currentZoom + 0.2);
    preview.setZoom(currentZoom);
  });

  btnZoomOut?.addEventListener('click', () => {
    currentZoom = Math.max(0.6, currentZoom - 0.2);
    preview.setZoom(currentZoom);
  });
}

function deleteActiveRedactionBox() {
  const doc = loadedDocuments[activeDocIndex];
  if (doc) {
    const fileKey = `${doc.id}_p${doc.activePageIndex}`;
    const deleted = redactionManager.deleteSelectedBox(fileKey);
    if (deleted) {
      preview.render();
      preview.onSelectionChange(null);
      updateUndoRedoButtons();
      showToast('Kotak sensor dihapus', 'info');
    }
  }
}

function updateUndoRedoButtons() {
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const doc = loadedDocuments[activeDocIndex];
  if (!doc) return;

  const fileKey = `${doc.id}_p${doc.activePageIndex}`;
  if (btnUndo) btnUndo.disabled = !redactionManager.canUndo(fileKey);
  if (btnRedo) btnRedo.disabled = !redactionManager.canRedo(fileKey);
}

function syncRedactTabButton(enabled) {
  const btnPanel = document.getElementById('btnPanelToggleRedact');
  if (btnPanel) {
    btnPanel.textContent = enabled ? 'Non-aktifkan Mode Sensor' : 'Aktifkan Mode Sensor';
    btnPanel.style.background = enabled ? '#1e293b' : '';
  }
}

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    // Abaikan jika fokus di textarea/input
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    // Delete / Backspace untuk hapus kotak sensor terpilih
    if ((e.key === 'Delete' || e.key === 'Backspace') && redactionManager.selectedBoxId) {
      e.preventDefault();
      deleteActiveRedactionBox();
    }

    // Ctrl+Z (Undo) & Ctrl+Y (Redo)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      const doc = loadedDocuments[activeDocIndex];
      if (doc) {
        const fileKey = `${doc.id}_p${doc.activePageIndex}`;
        if (e.shiftKey) {
          if (redactionManager.redo(fileKey)) {
            preview.render();
            updateRedactionPanel();
            updateUndoRedoButtons();
          }
        } else {
          if (redactionManager.undo(fileKey)) {
            preview.render();
            updateRedactionPanel();
            updateUndoRedoButtons();
          }
        }
      }
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      const doc = loadedDocuments[activeDocIndex];
      if (doc) {
        const fileKey = `${doc.id}_p${doc.activePageIndex}`;
        if (redactionManager.redo(fileKey)) {
          preview.render();
          updateRedactionPanel();
          updateUndoRedoButtons();
        }
      }
    }
  });
}

// ==========================================
// STUDIO WATERMARK (PRESETS & CONTROLS)
// ==========================================
function setupStudioWatermark() {
  const inputText = document.getElementById('inputWatermarkText');
  const sliderOpacity = document.getElementById('sliderOpacity');
  const sliderFontSize = document.getElementById('sliderFontSize');
  const sliderAngle = document.getElementById('sliderAngle');
  const sliderSpacingX = document.getElementById('sliderSpacingX');
  const sliderSpacingY = document.getElementById('sliderSpacingY');
  const sliderJitter = document.getElementById('sliderJitter');
  const checkOutline = document.getElementById('checkOutline');
  const customColorPicker = document.getElementById('customColorPicker');
  const btnSavePreset = document.getElementById('btnSavePreset');

  renderPresetCards();

  if (inputText) inputText.value = watermarkSettings.text;
  if (sliderOpacity) sliderOpacity.value = Math.round(watermarkSettings.opacity * 100);
  if (sliderFontSize) sliderFontSize.value = watermarkSettings.fontSizePercent;
  if (sliderAngle) sliderAngle.value = watermarkSettings.angle;
  if (sliderSpacingX) sliderSpacingX.value = watermarkSettings.spacingXPercent;
  if (sliderSpacingY) sliderSpacingY.value = watermarkSettings.spacingYPercent;
  if (sliderJitter) sliderJitter.value = watermarkSettings.jitterPercent;
  if (checkOutline) checkOutline.checked = watermarkSettings.strokeOutline;

  inputText?.addEventListener('input', (e) => {
    watermarkSettings.text = e.target.value;
    preview.setWatermarkSettings(watermarkSettings);
  });

  // Quick Tags
  document.querySelectorAll('.tag-btn[data-insert]').forEach(btn => {
    btn.addEventListener('click', () => {
      let insertStr = btn.getAttribute('data-insert') || '';
      if (insertStr === '[tanggal]') {
        insertStr = getTodayFormatted();
      }
      if (inputText) {
        const start = inputText.selectionStart;
        const end = inputText.selectionEnd;
        const current = inputText.value;
        inputText.value = current.substring(0, start) + ' ' + insertStr + ' ' + current.substring(end);
        watermarkSettings.text = inputText.value;
        preview.setWatermarkSettings(watermarkSettings);
      }
    });
  });

  // Pattern Selector (Tiled, Single, Cross)
  const patternBtns = document.querySelectorAll('.pattern-btn');
  patternBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      patternBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const pattern = btn.getAttribute('data-pattern') || 'tiled';
      watermarkSettings.pattern = pattern;
      preview.setWatermarkSettings(watermarkSettings);
    });
  });

  function bindSlider(sliderEl, badgeId, transformVal, key, suffix = '%') {
    if (!sliderEl) return;
    const badge = document.getElementById(badgeId);
    sliderEl.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      watermarkSettings[key] = transformVal(val);
      if (badge) badge.textContent = `${val}${suffix}`;
      preview.setWatermarkSettings(watermarkSettings);
    });
  }

  bindSlider(sliderOpacity, 'valOpacity', v => v / 100, 'opacity', '%');
  bindSlider(sliderFontSize, 'valFontSize', v => v, 'fontSizePercent', '%');
  bindSlider(sliderAngle, 'valAngle', v => v, 'angle', '°');
  bindSlider(sliderSpacingX, 'valSpacingX', v => v, 'spacingXPercent', '%');
  bindSlider(sliderSpacingY, 'valSpacingY', v => v, 'spacingYPercent', '%');
  bindSlider(sliderJitter, 'valJitter', v => v, 'jitterPercent', '%');

  checkOutline?.addEventListener('change', (e) => {
    watermarkSettings.strokeOutline = e.target.checked;
    preview.setWatermarkSettings(watermarkSettings);
  });

  // Color Swatches
  const colorDots = document.querySelectorAll('.color-dot');
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      const c = dot.getAttribute('data-color') || '#059669';
      watermarkSettings.color = c;
      if (customColorPicker) customColorPicker.value = c;
      preview.setWatermarkSettings(watermarkSettings);
    });
  });

  customColorPicker?.addEventListener('input', (e) => {
    colorDots.forEach(d => d.classList.remove('active'));
    watermarkSettings.color = e.target.value;
    preview.setWatermarkSettings(watermarkSettings);
  });

  btnSavePreset?.addEventListener('click', () => {
    const name = prompt('Nama preset baru Anda:');
    if (!name || !name.trim()) return;

    const saved = saveCustomPreset(name.trim(), watermarkSettings);
    if (saved) {
      renderPresetCards();
      showToast(`Preset "${saved.name}" berhasil disimpan!`, 'success');
    }
  });
}

function renderPresetCards() {
  const container = document.getElementById('presetCardsContainer');
  if (!container) return;

  const presets = getSavedPresets();
  container.innerHTML = '';

  presets.forEach(p => {
    const chip = document.createElement('div');
    chip.className = 'preset-chip';
    chip.innerHTML = `
      <span style="font-size: 1.1rem;">${p.icon || '🏷️'}</span>
      <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${p.name}</span>
      ${p.isCustom ? `<button class="btn-del-preset" title="Hapus Preset" style="border: none; background: transparent; color: #ef4444; cursor: pointer; font-size: 0.75rem;">✕</button>` : ''}
    `;

    chip.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-del-preset')) return;
      document.querySelectorAll('.preset-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyPresetSettings(p.settings);
      showToast(`Preset "${p.name}" aktif`, 'info', 1500);
    });

    chip.querySelector('.btn-del-preset')?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`Hapus preset "${p.name}"?`)) {
        deleteCustomPreset(p.id);
        renderPresetCards();
        showToast('Preset dihapus', 'info');
      }
    });

    container.appendChild(chip);
  });
}

function applyPresetSettings(newSettings) {
  watermarkSettings = { ...watermarkSettings, ...newSettings };

  const inputText = document.getElementById('inputWatermarkText');
  const sliderOpacity = document.getElementById('sliderOpacity');
  const sliderFontSize = document.getElementById('sliderFontSize');
  const sliderAngle = document.getElementById('sliderAngle');
  const sliderSpacingX = document.getElementById('sliderSpacingX');
  const sliderSpacingY = document.getElementById('sliderSpacingY');
  const sliderJitter = document.getElementById('sliderJitter');
  const checkOutline = document.getElementById('checkOutline');
  const customColorPicker = document.getElementById('customColorPicker');

  if (inputText) inputText.value = watermarkSettings.text;
  if (sliderOpacity) {
    sliderOpacity.value = Math.round(watermarkSettings.opacity * 100);
    document.getElementById('valOpacity').textContent = `${sliderOpacity.value}%`;
  }
  if (sliderFontSize) {
    sliderFontSize.value = watermarkSettings.fontSizePercent;
    document.getElementById('valFontSize').textContent = `${sliderFontSize.value}%`;
  }
  if (sliderAngle) {
    sliderAngle.value = watermarkSettings.angle;
    document.getElementById('valAngle').textContent = `${sliderAngle.value}°`;
  }
  if (sliderSpacingX) {
    sliderSpacingX.value = watermarkSettings.spacingXPercent;
    document.getElementById('valSpacingX').textContent = `${sliderSpacingX.value}%`;
  }
  if (sliderSpacingY) {
    sliderSpacingY.value = watermarkSettings.spacingYPercent;
    document.getElementById('valSpacingY').textContent = `${sliderSpacingY.value}%`;
  }
  if (sliderJitter) {
    sliderJitter.value = watermarkSettings.jitterPercent;
    document.getElementById('valJitter').textContent = `${sliderJitter.value}%`;
  }
  if (checkOutline) checkOutline.checked = watermarkSettings.strokeOutline;

  // Pattern buttons
  document.querySelectorAll('.pattern-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-pattern') === (watermarkSettings.pattern || 'tiled'));
  });

  // Color
  document.querySelectorAll('.color-dot').forEach(d => {
    d.classList.toggle('active', d.getAttribute('data-color') === watermarkSettings.color);
  });
  if (customColorPicker) customColorPicker.value = watermarkSettings.color;

  preview.setWatermarkSettings(watermarkSettings);
}

// ==========================================
// STUDIO SENSOR (REDACT)
// ==========================================
function setupStudioRedact() {
  const btnPanelToggle = document.getElementById('btnPanelToggleRedact');
  const btnClearAll = document.getElementById('btnClearPageRedactions');

  btnPanelToggle?.addEventListener('click', () => {
    const isNow = !preview.isRedactionMode;
    preview.setRedactionMode(isNow);
    document.getElementById('btnToggleRedact')?.classList.toggle('active', isNow);
    syncRedactTabButton(isNow);
    showToast(isNow ? 'Mode Sensor aktif: Seret pada dokumen untuk membuat kotak sensor' : 'Mode Sensor dinonaktifkan', 'info');
  });

  btnClearAll?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc) {
      const fileKey = `${doc.id}_p${doc.activePageIndex}`;
      redactionManager.clearAllBoxes(fileKey);
      preview.render();
      updateRedactionPanel();
      updateUndoRedoButtons();
      showToast('Semua kotak sensor di halaman ini dibersihkan', 'info');
    }
  });
}

function updateRedactionPanel() {
  const doc = loadedDocuments[activeDocIndex];
  const listEl = document.getElementById('redactionList');
  const badge = document.getElementById('redactCountBadge');
  if (!doc || !listEl) return;

  const fileKey = `${doc.id}_p${doc.activePageIndex}`;
  const boxes = redactionManager.getBoxes(fileKey);

  if (badge) badge.textContent = String(boxes.length);

  if (boxes.length === 0) {
    listEl.innerHTML = `<p style="font-size: 0.8rem; color: var(--text-muted); font-style: italic;">Belum ada kotak sensor pada halaman ini.</p>`;
    return;
  }

  listEl.innerHTML = '';
  boxes.forEach((b, i) => {
    const isSel = b.id === redactionManager.selectedBoxId;
    const item = document.createElement('div');
    item.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 0.45rem 0.75rem; border-radius: 8px; font-size: 0.825rem; font-weight: 600;
      background: ${isSel ? 'var(--primary-subtle)' : 'var(--bg-subtle)'};
      border: 1px solid ${isSel ? 'var(--primary)' : 'var(--border-light)'};
      cursor: pointer; transition: all 0.15s ease;
    `;
    item.innerHTML = `
      <span>⬛ Kotak #${i + 1} (${Math.round(b.width * 100)}% × ${Math.round(b.height * 100)}%)</span>
      <button style="border: none; background: transparent; color: #ef4444; cursor: pointer; font-weight: bold; font-size: 0.9rem;">✕</button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        redactionManager.selectedBoxId = b.id;
        preview.render();
        preview.onSelectionChange(b);
      }
    });

    item.querySelector('button')?.addEventListener('click', (e) => {
      e.stopPropagation();
      redactionManager.selectedBoxId = b.id;
      redactionManager.deleteSelectedBox(fileKey);
      preview.render();
      preview.onSelectionChange(null);
      updateRedactionPanel();
      updateUndoRedoButtons();
    });

    listEl.appendChild(item);
  });
}

// ==========================================
// STUDIO EXPORT
// ==========================================
function setupStudioExport() {
  const tabWatermark = document.getElementById('tabBtnWatermark');
  const tabRedact = document.getElementById('tabBtnRedact');
  const tabExport = document.getElementById('tabBtnExport');

  const panelWatermark = document.getElementById('panelWatermark');
  const panelRedact = document.getElementById('panelRedact');
  const panelExport = document.getElementById('panelExport');

  function setTab(activeTab, activePanel) {
    [tabWatermark, tabRedact, tabExport].forEach(t => t?.classList.remove('active'));
    [panelWatermark, panelRedact, panelExport].forEach(p => {
      if (p) p.style.display = 'none';
    });
    activeTab?.classList.add('active');
    if (activePanel) activePanel.style.display = 'flex';
  }

  tabWatermark?.addEventListener('click', () => setTab(tabWatermark, panelWatermark));
  tabRedact?.addEventListener('click', () => setTab(tabRedact, panelRedact));
  tabExport?.addEventListener('click', () => setTab(tabExport, panelExport));

  const formatCards = document.querySelectorAll('.format-card');
  const formatLabel = document.getElementById('downloadFormatLabel');

  formatCards.forEach(card => {
    card.addEventListener('click', () => {
      formatCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      exportFormat = card.getAttribute('data-format') || 'png';
      if (formatLabel) formatLabel.textContent = exportFormat.toUpperCase();
    });
  });

  const btnDownloadActive = document.getElementById('btnDownloadActive');
  btnDownloadActive?.addEventListener('click', async () => {
    const doc = loadedDocuments[activeDocIndex];
    if (!doc) return;

    btnDownloadActive.disabled = true;
    showToast(`Memproses ${doc.name} ke ${exportFormat.toUpperCase()}...`, 'info');

    try {
      const { blob, filename } = await exportDocument(doc, redactionManager, watermarkSettings, exportFormat, (msg) => {
        showToast(msg, 'info', 1500);
      });

      triggerDownload(blob, filename);
      showToast(`Berhasil mengunduh: ${filename}`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses dokumen', 'error');
    } finally {
      btnDownloadActive.disabled = false;
    }
  });

  const btnBatchZip = document.getElementById('btnDownloadBatchZip');
  btnBatchZip?.addEventListener('click', async () => {
    if (loadedDocuments.length === 0) return;

    btnBatchZip.disabled = true;
    const progressBox = document.getElementById('exportProgressBox');
    const progressBar = document.getElementById('exportProgressBar');
    const progressText = document.getElementById('exportProgressText');
    const progressPercent = document.getElementById('exportProgressPercent');

    if (progressBox) progressBox.style.display = 'block';

    try {
      const zipBlob = await exportBatchAsZip(
        loadedDocuments,
        redactionManager,
        watermarkSettings,
        exportFormat,
        (text, percent) => {
          if (progressText) progressText.textContent = text;
          if (progressPercent) progressPercent.textContent = `${percent}%`;
          if (progressBar) progressBar.style.width = `${percent}%`;
        }
      );

      triggerDownload(zipBlob, `tandain_dokumen_batch_${Date.now()}.zip`);
      showToast('Semua dokumen berhasil diunduh dalam arsip ZIP!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat arsip ZIP', 'error');
    } finally {
      btnBatchZip.disabled = false;
      setTimeout(() => {
        if (progressBox) progressBox.style.display = 'none';
      }, 3000);
    }
  });
}

// ==========================================
// RESET & BERSIHKAN SEMUA DATA DARI MEMORI
// ==========================================
function resetAll() {
  if (loadedDocuments.length > 0) {
    const confirmed = confirm('Hapus seluruh dokumen dan sensor dari memori browser?');
    if (!confirmed) return;
  }

  const previewCanvas = document.getElementById('previewCanvas');
  fullMemoryCleanup(loadedDocuments, [previewCanvas]);

  loadedDocuments = [];
  activeDocIndex = 0;
  redactionManager = new RedactionManager();
  watermarkSettings = { ...DEFAULT_WATERMARK_SETTINGS };
  currentZoom = 1.0;

  const dropzone = document.getElementById('dropzoneSection');
  const workspace = document.getElementById('workspaceSection');
  if (workspace) workspace.style.display = 'none';
  if (dropzone) dropzone.style.display = 'block';

  showToast('Memori telah dibersihkan secara menyeluruh', 'info');
}
