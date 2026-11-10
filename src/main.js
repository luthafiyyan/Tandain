/**
 * main.js
 * Titik masuk utama aplikasi Tandain dengan desain iOS / macOS modern:
 * Bersih, tenang, presisi, dan mengikuti prinsip Apple Human Interface Guidelines.
 */

import './styles/main.css';
import { initTheme, toggleTheme } from './ui/theme.js';
import { getSavedPresets, saveCustomPreset, BUILTIN_PRESETS } from './ui/presets.js';
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
let watermarkSettings = {
  ...DEFAULT_WATERMARK_SETTINGS,
  color: '#C8372D'
};
let redactionManager = new RedactionManager();
let exportFormat = 'png';
let preview = null;
let currentZoom = 1.0;

// Mapping Intensitas Apple (1..5)
const INTENSITY_LEVELS = {
  1: { opacity: 0.16, fontSizePercent: 2.4, label: 'Sangat Tipis' },
  2: { opacity: 0.24, fontSizePercent: 2.8, label: 'Tipis' },
  3: { opacity: 0.32, fontSizePercent: 3.3, label: 'Standar' },
  4: { opacity: 0.42, fontSizePercent: 4.0, label: 'Tegas' },
  5: { opacity: 0.55, fontSizePercent: 5.0, label: 'Tebal' }
};

function findClosestIntensityLevel(opacity) {
  let bestLevel = 3;
  let minDiff = Infinity;
  for (const [lvl, cfg] of Object.entries(INTENSITY_LEVELS)) {
    const diff = Math.abs(cfg.opacity - opacity);
    if (diff < minDiff) {
      minDiff = diff;
      bestLevel = parseInt(lvl, 10);
    }
  }
  return bestLevel;
}

// ==========================================
// TOAST NOTIFIKASI (Apple Floating Pill)
// ==========================================
function showToast(message, duration = 2600) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.2s ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 200);
  }, duration);
}

// ==========================================
// DUMMY KTP GENERATOR (Pengujian Cepat)
// ==========================================
async function createDummyKtpBitmap() {
  const canvas = document.createElement('canvas');
  canvas.width = 856;
  canvas.height = 540;
  const ctx = canvas.getContext('2d');

  const grad = ctx.createLinearGradient(0, 0, 856, 540);
  grad.addColorStop(0, '#bae6fd');
  grad.addColorStop(0.5, '#7dd3fc');
  grad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 856, 540);

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 1.2;
  for (let i = -540; i < 856; i += 26) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.bezierCurveTo(i + 200, 180, i + 100, 360, i + 300, 540);
    ctx.stroke();
  }

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

  ctx.font = 'bold 24px monospace';
  ctx.textAlign = 'left';
  ctx.fillText('NIK          : 3174051208900003', 50, 140);

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
// INISIALISASI
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.getElementById('btnToggleTheme')?.addEventListener('click', toggleTheme);

  // Setup Popover Privasi
  setupOfflinePopover();

  // Setup Canvas Preview
  const previewCanvas = document.getElementById('previewCanvas');
  const canvasViewport = document.getElementById('canvasViewport');
  preview = new DocumentPreview(previewCanvas, canvasViewport);

  preview.onSelectionChange = (selectedBox) => {
    const floatBar = document.getElementById('redactFloatBar');
    if (floatBar) {
      floatBar.style.display = selectedBox ? 'flex' : 'none';
    }
    updateSensorList();
    updateUndoRedoButtons();
  };

  setupFileInputs();
  setupStageToolbar();
  setupControlPanel();
  setupToolbarModes();
  setupResetModal();
  setupKeyboardShortcuts();

  // Mobile Bottom Sheet Detent Toggle (Tap & Touch Swipe)
  const drawerHandle = document.querySelector('.mobile-drawer-handle');
  const inspector = document.getElementById('inspectorPanel');
  drawerHandle?.addEventListener('click', () => {
    inspector?.classList.toggle('expanded');
    setTimeout(() => preview?.render(), 320);
  });

  let touchStartY = 0;
  drawerHandle?.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  drawerHandle?.addEventListener('touchend', (e) => {
    const touchEndY = e.changedTouches[0].clientY;
    const diff = touchStartY - touchEndY;
    if (diff > 25) {
      inspector?.classList.add('expanded');
      setTimeout(() => preview?.render(), 320);
    } else if (diff < -25) {
      inspector?.classList.remove('expanded');
      setTimeout(() => preview?.render(), 320);
    }
  }, { passive: true });

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
});

// ==========================================
// POPOVER PRIVASI TUNGGAL
// ==========================================
function setupOfflinePopover() {
  const chip = document.getElementById('btnOfflineChip');
  const popover = document.getElementById('offlinePopover');
  if (!chip || !popover) return;

  chip.addEventListener('click', (e) => {
    e.stopPropagation();
    const isVis = popover.classList.toggle('visible');
    chip.setAttribute('aria-expanded', String(isVis));
  });

  document.addEventListener('click', (e) => {
    if (!popover.contains(e.target) && e.target !== chip) {
      popover.classList.remove('visible');
      chip.setAttribute('aria-expanded', 'false');
    }
  });
}

// ==========================================
// MODAL ALERT KONFIRMASI ATUR ULANG (RESET)
// ==========================================
function setupResetModal() {
  const modal = document.getElementById('resetModal');
  const btnTrigger = document.getElementById('btnResetApp');
  const btnCancel = document.getElementById('btnCancelReset');
  const btnConfirm = document.getElementById('btnConfirmReset');

  btnTrigger?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });

  btnCancel?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  btnConfirm?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
    resetAll();
  });
}

// ==========================================
// INPUT FILE & DROPZONE
// ==========================================
function setupFileInputs() {
  const dropzoneCard = document.getElementById('dropzoneCard');
  const fileInput = document.getElementById('fileInput');
  const btnBrowse = document.getElementById('btnBrowseFile');
  const btnSample = document.getElementById('btnSampleDoc');
  const btnAddMore = document.getElementById('btnAddMoreDocs');

  btnBrowse?.addEventListener('click', (e) => {
    e.stopPropagation();
    fileInput?.click();
  });

  btnAddMore?.addEventListener('click', () => fileInput?.click());

  dropzoneCard?.addEventListener('click', (e) => {
    if (e.target !== btnBrowse && e.target !== btnSample) {
      fileInput?.click();
    }
  });

  dropzoneCard?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
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

  btnSample?.addEventListener('click', async (e) => {
    e.stopPropagation();
    try {
      showToast('Memuat contoh dokumen...');
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
      showWorkspaceView();
      showToast('Contoh dokumen siap.');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat contoh dokumen.');
    }
  });
}

async function handleFiles(files) {
  showToast(`Membaca ${files.length} dokumen...`);

  const newDocs = [];
  for (const file of files) {
    try {
      const doc = await loadDocument(file);
      newDocs.push(doc);
    } catch (err) {
      console.error('Gagal membaca:', file.name, err);
      showToast(`Gagal membaca ${file.name}`);
    }
  }

  if (newDocs.length === 0) return;

  const previousCount = loadedDocuments.length;
  loadedDocuments = [...loadedDocuments, ...newDocs];
  activeDocIndex = previousCount;
  showWorkspaceView();
}

function showWorkspaceView() {
  const dropzoneCard = document.getElementById('dropzoneCard');
  const previewArea = document.getElementById('previewArea');
  const btnDownload = document.getElementById('btnDownloadActive');
  const btnDownloadTop = document.getElementById('btnDownloadActiveTop');

  if (dropzoneCard) dropzoneCard.style.display = 'none';
  if (previewArea) previewArea.style.display = 'flex';
  if (btnDownload) btnDownload.disabled = false;
  if (btnDownloadTop) btnDownloadTop.disabled = false;

  updateSidebarList();
  updateActiveDocView();
}

// ==========================================
// SIDEBAR DAFTAR DOKUMEN (FINDER STYLE)
// ==========================================
function updateSidebarList() {
  const batchStrip = document.getElementById('batchStrip');
  const batchCountBadge = document.getElementById('batchCountBadge');
  const btnBatchZip = document.getElementById('btnDownloadBatchZip');
  const sidebarDocs = document.getElementById('sidebarDocs');

  if (!batchStrip) return;

  sidebarDocs?.classList.toggle('has-docs', loadedDocuments.length > 1);

  if (batchCountBadge) batchCountBadge.textContent = String(loadedDocuments.length);

  if (loadedDocuments.length > 1) {
    if (btnBatchZip) btnBatchZip.style.display = 'block';
  } else {
    if (btnBatchZip) btnBatchZip.style.display = 'none';
  }

  batchStrip.innerHTML = '';
  loadedDocuments.forEach((doc, idx) => {
    const item = document.createElement('div');
    item.className = `doc-list-item ${idx === activeDocIndex ? 'active' : ''}`;
    
    item.innerHTML = `
      <div class="doc-item-left">
        <span class="doc-format-pill">${doc.isPdf ? 'PDF' : 'IMG'}</span>
        <span class="doc-title-text" title="${doc.name}">${doc.name}</span>
      </div>
      <button class="btn-doc-remove" title="Hapus dokumen" aria-label="Hapus dokumen">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M18 6L6 18M6 6l12 12"/></svg>
      </button>
    `;

    item.addEventListener('click', (e) => {
      if (e.target.closest('.btn-doc-remove')) return;
      activeDocIndex = idx;
      updateSidebarList();
      updateActiveDocView();
    });

    item.querySelector('.btn-doc-remove')?.addEventListener('click', (e) => {
      e.stopPropagation();
      removeDocAt(idx);
    });

    batchStrip.appendChild(item);
  });
}

function removeDocAt(idx) {
  if (idx < 0 || idx >= loadedDocuments.length) return;
  const doc = loadedDocuments[idx];
  fullMemoryCleanup([doc], []);
  loadedDocuments.splice(idx, 1);

  if (loadedDocuments.length === 0) {
    resetAll();
    return;
  }

  if (idx < activeDocIndex) {
    activeDocIndex--;
  } else if (activeDocIndex >= loadedDocuments.length) {
    activeDocIndex = loadedDocuments.length - 1;
  }
  updateSidebarList();
  updateActiveDocView();
}

function updateActiveDocView() {
  const doc = loadedDocuments[activeDocIndex];
  if (!doc) return;

  const page = doc.pages[doc.activePageIndex];
  const fileKey = `${doc.id}_p${doc.activePageIndex}`;

  // Nama file di panel unduh
  const docNameLabel = document.getElementById('activeDocName');
  if (docNameLabel) docNameLabel.textContent = doc.name;

  // Navigasi PDF Multi-halaman
  const pdfPageNav = document.getElementById('pdfPageNav');
  const pageNavIndicator = document.getElementById('pageNavIndicator');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');

  if (doc.pages.length > 1) {
    if (pdfPageNav) pdfPageNav.style.display = 'flex';
    if (pageNavIndicator) pageNavIndicator.textContent = `Hal ${doc.activePageIndex + 1} dari ${doc.pages.length}`;
    if (btnPrevPage) btnPrevPage.disabled = doc.activePageIndex <= 0;
    if (btnNextPage) btnNextPage.disabled = doc.activePageIndex >= doc.pages.length - 1;
  } else {
    if (pdfPageNav) pdfPageNav.style.display = 'none';
  }

  preview.setDocumentPage(page, fileKey, redactionManager, watermarkSettings);
  updateSensorList();
  updateUndoRedoButtons();
}

// ==========================================
// TOOLBAR ATAS: MODE WATERMARK VS SENSOR
// ==========================================
function setupToolbarModes() {
  const tabWatermark = document.getElementById('tabModeWatermark');
  const tabSensor = document.getElementById('tabModeSensor');
  const watermarkGroup = document.getElementById('watermarkControlsGroup');
  const sensorGroup = document.getElementById('sensorControlsGroup');
  const exportGroup = document.getElementById('exportControlsGroup');
  const checkSensor = document.getElementById('checkSensorMode');
  const btnToggleStageSensor = document.getElementById('btnToggleStageSensor');

  // Mobile Tabs
  const mTabWatermark = document.getElementById('mTabWatermark');
  const mTabSensor = document.getElementById('mTabSensor');
  const mTabUnduh = document.getElementById('mTabUnduh');

  function activateMode(mode) {
    const isWatermark = mode === 'watermark';
    const isSensor = mode === 'sensor';
    const isUnduh = mode === 'unduh';
    const isMobile = window.innerWidth <= 768;

    [tabWatermark, tabSensor].forEach(t => t?.classList.remove('active'));
    [mTabWatermark, mTabSensor, mTabUnduh].forEach(t => t?.classList.remove('active'));

    if (btnToggleStageSensor) {
      btnToggleStageSensor.classList.toggle('active', isSensor);
      btnToggleStageSensor.setAttribute('aria-pressed', String(isSensor));
    }

    if (isWatermark) {
      tabWatermark?.classList.add('active');
      mTabWatermark?.classList.add('active');
      if (watermarkGroup) watermarkGroup.style.display = 'block';
      if (sensorGroup) sensorGroup.style.display = 'none';
      if (exportGroup) exportGroup.style.display = isMobile ? 'none' : 'block';
      preview?.setRedactionMode(false);
      if (checkSensor) checkSensor.checked = false;
    } else if (isSensor) {
      tabSensor?.classList.add('active');
      mTabSensor?.classList.add('active');
      if (watermarkGroup) watermarkGroup.style.display = 'none';
      if (sensorGroup) sensorGroup.style.display = 'block';
      if (exportGroup) exportGroup.style.display = isMobile ? 'none' : 'block';
      preview?.setRedactionMode(true);
      if (checkSensor) checkSensor.checked = true;
    } else if (isUnduh) {
      mTabUnduh?.classList.add('active');
      if (watermarkGroup) watermarkGroup.style.display = 'none';
      if (sensorGroup) sensorGroup.style.display = 'none';
      if (exportGroup) exportGroup.style.display = 'block';
    }
  }

  window.addEventListener('resize', () => {
    const isMobile = window.innerWidth <= 768;
    if (!isMobile) {
      if (exportGroup) exportGroup.style.display = 'block';
      if (mTabUnduh?.classList.contains('active')) {
        activateMode('watermark');
      }
    }
  });

  tabWatermark?.addEventListener('click', () => activateMode('watermark'));
  tabSensor?.addEventListener('click', () => activateMode('sensor'));

  btnToggleStageSensor?.addEventListener('click', () => {
    const isCurrentlySensor = preview?.isRedactionMode;
    activateMode(isCurrentlySensor ? 'watermark' : 'sensor');
  });

  mTabWatermark?.addEventListener('click', () => activateMode('watermark'));
  mTabSensor?.addEventListener('click', () => activateMode('sensor'));
  mTabUnduh?.addEventListener('click', () => activateMode('unduh'));

  checkSensor?.addEventListener('change', (e) => {
    activateMode(e.target.checked ? 'sensor' : 'watermark');
  });
}

// ==========================================
// STAGE TOOLBAR (VIEW, UNDO, ZOOM)
// ==========================================
function setupStageToolbar() {
  const btnAfter = document.getElementById('btnViewAfter');
  const btnBefore = document.getElementById('btnViewBefore');
  const btnSplit = document.getElementById('btnViewSplit');
  const btnDeleteSelectedBox = document.getElementById('btnDeleteSelectedBox');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');
  const btnUndo = document.getElementById('btnUndo');
  const btnRedo = document.getElementById('btnRedo');
  const btnZoomIn = document.getElementById('btnZoomIn');
  const btnZoomOut = document.getElementById('btnZoomOut');

  function setSegActive(btn) {
    [btnAfter, btnBefore, btnSplit].forEach(b => {
      b?.classList.remove('active');
      b?.setAttribute('aria-selected', 'false');
    });
    btn?.classList.add('active');
    btn?.setAttribute('aria-selected', 'true');
  }

  btnAfter?.addEventListener('click', () => {
    setSegActive(btnAfter);
    preview.setViewMode('after');
  });

  btnBefore?.addEventListener('click', () => {
    setSegActive(btnBefore);
    preview.setViewMode('before');
  });

  btnSplit?.addEventListener('click', () => {
    setSegActive(btnSplit);
    preview.setViewMode('split');
  });

  btnDeleteSelectedBox?.addEventListener('click', deleteActiveRedactionBox);

  btnPrevPage?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc && doc.activePageIndex > 0) {
      doc.activePageIndex--;
      updateActiveDocView();
    }
  });

  btnNextPage?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc && doc.activePageIndex < doc.pages.length - 1) {
      doc.activePageIndex++;
      updateActiveDocView();
    }
  });

  btnUndo?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc) {
      const fileKey = `${doc.id}_p${doc.activePageIndex}`;
      if (redactionManager.undo(fileKey)) {
        preview.render();
        updateSensorList();
        updateUndoRedoButtons();
      }
    }
  });

  btnRedo?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc) {
      const fileKey = `${doc.id}_p${doc.activePageIndex}`;
      if (redactionManager.redo(fileKey)) {
        preview.render();
        updateSensorList();
        updateUndoRedoButtons();
      }
    }
  });

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
      updateSensorList();
      updateUndoRedoButtons();
      showToast('Kotak sensor dihapus.');
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

function updateSensorList() {
  const doc = loadedDocuments[activeDocIndex];
  const listTable = document.getElementById('sensorChips');
  const emptyState = document.getElementById('sensorBoxListEmpty');
  if (!doc || !listTable) return;

  const fileKey = `${doc.id}_p${doc.activePageIndex}`;
  const boxes = redactionManager.getBoxes(fileKey);

  if (boxes.length === 0) {
    if (emptyState) emptyState.style.display = 'flex';
    listTable.innerHTML = '';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';
  listTable.innerHTML = '';

  boxes.forEach((b, i) => {
    const isSel = b.id === redactionManager.selectedBoxId;
    const row = document.createElement('div');
    row.className = `sensor-row-item ${isSel ? 'active' : ''}`;
    row.innerHTML = `
      <span>Kotak ${i + 1}</span>
      <button class="btn-row-del" title="Hapus kotak">Hapus</button>
    `;

    row.addEventListener('click', (e) => {
      if (e.target.classList.contains('btn-row-del')) return;
      redactionManager.selectedBoxId = b.id;
      preview.render();
      preview.onSelectionChange(b);
    });

    row.querySelector('.btn-row-del')?.addEventListener('click', (e) => {
      e.stopPropagation();
      redactionManager.selectedBoxId = b.id;
      redactionManager.deleteSelectedBox(fileKey);
      preview.render();
      preview.onSelectionChange(null);
      updateSensorList();
      updateUndoRedoButtons();
    });

    listTable.appendChild(row);
  });
}

// ==========================================
// KEYBOARD SHORTCUTS
// ==========================================
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;

    if ((e.key === 'Delete' || e.key === 'Backspace') && redactionManager.selectedBoxId) {
      e.preventDefault();
      deleteActiveRedactionBox();
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      const doc = loadedDocuments[activeDocIndex];
      if (doc) {
        const fileKey = `${doc.id}_p${doc.activePageIndex}`;
        if (e.shiftKey) {
          if (redactionManager.redo(fileKey)) {
            preview.render();
            updateSensorList();
            updateUndoRedoButtons();
          }
        } else {
          if (redactionManager.undo(fileKey)) {
            preview.render();
            updateSensorList();
            updateUndoRedoButtons();
          }
        }
      }
    }
  });
}

// ==========================================
// CONTROL PANEL (WATERMARK & LANJUTAN)
// ==========================================
function setupControlPanel() {
  const inputText = document.getElementById('inputWatermarkText');
  const btnInsertDate = document.getElementById('btnInsertDate');
  const sliderIntensity = document.getElementById('sliderIntensity');
  const valIntensityLabel = document.getElementById('valIntensityLabel');

  renderPresetChips();

  // Terapkan preset pertama secara default agar sinkron 100%
  const presets = getSavedPresets();
  if (presets.length > 0) {
    applyPresetSettings(presets[0].settings);
  } else {
    if (inputText) inputText.value = watermarkSettings.text;
  }

  inputText?.addEventListener('input', (e) => {
    watermarkSettings.text = e.target.value;
    preview.setWatermarkSettings(watermarkSettings);
  });

  // Tombol "+ tanggal hari ini"
  btnInsertDate?.addEventListener('click', () => {
    const today = getTodayFormatted();
    if (inputText) {
      const current = inputText.value;
      if (current.includes(today)) return;
      inputText.value = current ? `${current} - ${today}` : today;
      watermarkSettings.text = inputText.value;
      preview.setWatermarkSettings(watermarkSettings);
    }
  });

  // Slider Intensitas
  sliderIntensity?.addEventListener('input', (e) => {
    const lvl = parseInt(e.target.value, 10) || 3;
    const config = INTENSITY_LEVELS[lvl] || INTENSITY_LEVELS[3];

    watermarkSettings.opacity = config.opacity;
    watermarkSettings.fontSizePercent = config.fontSizePercent;

    if (valIntensityLabel) valIntensityLabel.textContent = config.label;
    preview.setWatermarkSettings(watermarkSettings);
  });

  // Toggle Pola (Penuh / Tengah)
  const patternBtns = document.querySelectorAll('.pattern-toggle-btn');
  patternBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      patternBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      watermarkSettings.pattern = btn.getAttribute('data-pattern') || 'tiled';
      preview.setWatermarkSettings(watermarkSettings);
    });
  });

  // Disclosure Pengaturan Lanjutan
  const btnAccordion = document.getElementById('btnToggleAccordion');
  const accordionContent = document.getElementById('accordionContent');
  const accordionArrow = document.getElementById('accordionArrow');

  btnAccordion?.addEventListener('click', () => {
    const isExpanded = accordionContent?.style.display !== 'none';
    if (accordionContent) accordionContent.style.display = isExpanded ? 'none' : 'flex';
    accordionArrow?.classList.toggle('open', !isExpanded);
    btnAccordion.setAttribute('aria-expanded', String(!isExpanded));
  });

  setupAdvancedSliders();
  setupDownloadControls();
}

function renderPresetChips() {
  const container = document.getElementById('presetChipsContainer');
  if (!container) return;

  const presets = getSavedPresets();
  container.innerHTML = '';

  presets.forEach((p, idx) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `preset-chip-btn ${idx === 0 ? 'active' : ''}`;
    chip.textContent = p.name;

    chip.addEventListener('click', () => {
      document.querySelectorAll('.preset-chip-btn').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      applyPresetSettings(p.settings);
    });

    container.appendChild(chip);
  });
}

function applyPresetSettings(newSettings) {
  watermarkSettings = { ...watermarkSettings, ...newSettings };

  const inputText = document.getElementById('inputWatermarkText');
  const sliderIntensity = document.getElementById('sliderIntensity');
  const valIntensityLabel = document.getElementById('valIntensityLabel');
  const sliderAngle = document.getElementById('sliderAngle');
  const sliderSpacingX = document.getElementById('sliderSpacingX');
  const sliderSpacingY = document.getElementById('sliderSpacingY');
  const sliderJitter = document.getElementById('sliderJitter');
  const checkOutline = document.getElementById('checkOutline');
  const customInk = document.getElementById('customColorPicker');

  if (inputText) inputText.value = watermarkSettings.text;

  if (sliderIntensity && valIntensityLabel && watermarkSettings.opacity !== undefined) {
    const lvl = findClosestIntensityLevel(watermarkSettings.opacity);
    sliderIntensity.value = lvl;
    valIntensityLabel.textContent = INTENSITY_LEVELS[lvl].label;
  }

  if (sliderAngle) {
    sliderAngle.value = watermarkSettings.angle;
    document.getElementById('valAngle').textContent = `${watermarkSettings.angle}°`;
  }
  if (sliderSpacingX) {
    sliderSpacingX.value = watermarkSettings.spacingXPercent;
    document.getElementById('valSpacingX').textContent = `${watermarkSettings.spacingXPercent}%`;
  }
  if (sliderSpacingY) {
    sliderSpacingY.value = watermarkSettings.spacingYPercent;
    document.getElementById('valSpacingY').textContent = `${watermarkSettings.spacingYPercent}%`;
  }
  if (sliderJitter) {
    sliderJitter.value = watermarkSettings.jitterPercent;
    document.getElementById('valJitter').textContent = `${watermarkSettings.jitterPercent}%`;
  }
  if (checkOutline) checkOutline.checked = watermarkSettings.strokeOutline;

  // Pola
  document.querySelectorAll('.pattern-toggle-btn').forEach(b => {
    b.classList.toggle('active', b.getAttribute('data-pattern') === (watermarkSettings.pattern || 'tiled'));
  });

  // Warna Teks
  document.querySelectorAll('.color-dot').forEach(d => {
    d.classList.toggle('active', d.getAttribute('data-color') === watermarkSettings.color);
  });
  if (customInk && watermarkSettings.color) customInk.value = watermarkSettings.color;

  preview.setWatermarkSettings(watermarkSettings);
}

function setupAdvancedSliders() {
  const sliderAngle = document.getElementById('sliderAngle');
  const sliderSpacingX = document.getElementById('sliderSpacingX');
  const sliderSpacingY = document.getElementById('sliderSpacingY');
  const sliderJitter = document.getElementById('sliderJitter');
  const checkOutline = document.getElementById('checkOutline');
  const customInk = document.getElementById('customColorPicker');
  const btnSavePreset = document.getElementById('btnSavePreset');

  sliderAngle?.addEventListener('input', (e) => {
    watermarkSettings.angle = parseFloat(e.target.value);
    document.getElementById('valAngle').textContent = `${watermarkSettings.angle}°`;
    preview.setWatermarkSettings(watermarkSettings);
  });

  sliderSpacingX?.addEventListener('input', (e) => {
    watermarkSettings.spacingXPercent = parseFloat(e.target.value);
    document.getElementById('valSpacingX').textContent = `${watermarkSettings.spacingXPercent}%`;
    preview.setWatermarkSettings(watermarkSettings);
  });

  sliderSpacingY?.addEventListener('input', (e) => {
    watermarkSettings.spacingYPercent = parseFloat(e.target.value);
    document.getElementById('valSpacingY').textContent = `${watermarkSettings.spacingYPercent}%`;
    preview.setWatermarkSettings(watermarkSettings);
  });

  sliderJitter?.addEventListener('input', (e) => {
    watermarkSettings.jitterPercent = parseFloat(e.target.value);
    document.getElementById('valJitter').textContent = `${watermarkSettings.jitterPercent}%`;
    preview.setWatermarkSettings(watermarkSettings);
  });

  checkOutline?.addEventListener('change', (e) => {
    watermarkSettings.strokeOutline = e.target.checked;
    preview.setWatermarkSettings(watermarkSettings);
  });

  const colorDots = document.querySelectorAll('.color-dot');
  colorDots.forEach(dot => {
    dot.addEventListener('click', () => {
      colorDots.forEach(c => c.classList.remove('active'));
      dot.classList.add('active');
      const c = dot.getAttribute('data-color') || '#C8372D';
      watermarkSettings.color = c;
      if (customInk) customInk.value = c;
      preview.setWatermarkSettings(watermarkSettings);
    });
  });

  customInk?.addEventListener('input', (e) => {
    colorDots.forEach(c => c.classList.remove('active'));
    watermarkSettings.color = e.target.value;
    preview.setWatermarkSettings(watermarkSettings);
  });

  btnSavePreset?.addEventListener('click', () => {
    const name = prompt('Nama preset baru:');
    if (!name || !name.trim()) return;

    const saved = saveCustomPreset(name.trim(), watermarkSettings);
    if (saved) {
      renderPresetChips();
      showToast(`Preset "${saved.name}" tersimpan.`);
    }
  });
}

// ==========================================
// UNDUH & EKSPOR DOKUMEN
// ==========================================
function setupDownloadControls() {
  const formatBtns = document.querySelectorAll('.format-btn');
  const formatLabel = document.getElementById('downloadFormatLabel');
  const btnDownload = document.getElementById('btnDownloadActive');
  const btnDownloadTop = document.getElementById('btnDownloadActiveTop');
  const btnBatchZip = document.getElementById('btnDownloadBatchZip');

  formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      formatBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      exportFormat = btn.getAttribute('data-format') || 'png';
      if (formatLabel) formatLabel.textContent = exportFormat.toUpperCase();
    });
  });

  async function executeDownload() {
    const doc = loadedDocuments[activeDocIndex];
    if (!doc) return;

    if (btnDownload) btnDownload.disabled = true;
    if (btnDownloadTop) btnDownloadTop.disabled = true;
    showToast(`Memproses ${doc.name}...`);

    try {
      const { blob, filename } = await exportDocument(doc, redactionManager, watermarkSettings, exportFormat);
      triggerDownload(blob, filename);
      showToast(`Tersimpan: ${filename}`);
    } catch (err) {
      console.error(err);
      showToast('Gagal memproses dokumen.');
    } finally {
      if (btnDownload) btnDownload.disabled = false;
      if (btnDownloadTop) btnDownloadTop.disabled = false;
    }
  }

  btnDownload?.addEventListener('click', executeDownload);
  btnDownloadTop?.addEventListener('click', executeDownload);

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

      triggerDownload(zipBlob, `tandain_dokumen_${Date.now()}.zip`);
      showToast('Semua dokumen berhasil diunduh dalam ZIP.');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat arsip ZIP.');
    } finally {
      btnBatchZip.disabled = false;
      setTimeout(() => {
        if (progressBox) progressBox.style.display = 'none';
      }, 3000);
    }
  });
}

// ==========================================
// RESET MEMORI LENGKAP
// ==========================================
function resetAll() {
  const previewCanvas = document.getElementById('previewCanvas');
  fullMemoryCleanup(loadedDocuments, [previewCanvas]);

  loadedDocuments = [];
  activeDocIndex = 0;
  redactionManager = new RedactionManager();
  currentZoom = 1.0;
  preview?.clear();
  preview?.setViewMode('after');

  // Bersihkan input berkas agar berkas yang sama bisa dipilih kembali
  const fileInput = document.getElementById('fileInput');
  if (fileInput) fileInput.value = '';

  const dropzoneCard = document.getElementById('dropzoneCard');
  const previewArea = document.getElementById('previewArea');
  const btnDownload = document.getElementById('btnDownloadActive');
  const btnDownloadTop = document.getElementById('btnDownloadActiveTop');
  const docNameLabel = document.getElementById('activeDocName');

  if (dropzoneCard) dropzoneCard.style.display = 'flex';
  if (previewArea) previewArea.style.display = 'none';
  if (btnDownload) btnDownload.disabled = true;
  if (btnDownloadTop) btnDownloadTop.disabled = true;
  if (docNameLabel) docNameLabel.textContent = '-';

  // Kembalikan preset dan pengaturan cap ke kondisi awal bawaan
  const presets = getSavedPresets();
  if (presets.length > 0) {
    applyPresetSettings(presets[0].settings);
    document.querySelectorAll('.preset-chip-btn').forEach((c, i) => {
      c.classList.toggle('active', i === 0);
    });
  }

  // Kembalikan mode ke Watermark (jika sebelumnya sedang di mode Sensor)
  const tabWatermark = document.getElementById('tabModeWatermark');
  tabWatermark?.click();

  updateSidebarList();
  updateSensorList();
  updateUndoRedoButtons();

  // Toast wajib:
  showToast('Semua data dihapus dari memori.');
}
