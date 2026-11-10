/**
 * main.js
 * Titik masuk utama aplikasi Tandain.
 * Menghubungkan seluruh modul core, state manajemen, dan interaksi UI.
 */

import './styles/main.css';
import { initTheme, toggleTheme } from './ui/theme.js';
import { getSavedPresets, saveCustomPreset, deleteCustomPreset, BUILTIN_PRESETS } from './ui/presets.js';
import { DEFAULT_WATERMARK_SETTINGS, getTodayFormatted } from './core/watermark.js';
import { RedactionManager } from './core/redact.js';
import { DocumentPreview } from './ui/preview.js';
import { loadDocument } from './core/loader.js';
import { exportDocument, exportBatchAsZip, triggerDownload } from './core/exporter.js';
import { fullMemoryCleanup } from './core/cleanup.js';

// ==========================================
// STATE APLIKASI (Hanya hidup di RAM)
// ==========================================
let loadedDocuments = [];
let activeDocIndex = 0;
let watermarkSettings = { ...DEFAULT_WATERMARK_SETTINGS };
let redactionManager = new RedactionManager();
let exportFormat = 'png'; // 'png' | 'jpg' | 'pdf'
let preview = null;

// ==========================================
// TOAST NOTIFIKASI
// ==========================================
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
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

  // Background KTP biru langit
  const grad = ctx.createLinearGradient(0, 0, 856, 540);
  grad.addColorStop(0, '#bae6fd');
  grad.addColorStop(0.5, '#7dd3fc');
  grad.addColorStop(1, '#38bdf8');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 856, 540);

  // Pola garis halus keamanan latar
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.lineWidth = 1;
  for (let i = -540; i < 856; i += 24) {
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

  // Garis batas header
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

  // Placeholder Foto Wajah
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
  canvas.width = 0;
  canvas.height = 0;
  return bitmap;
}

// ==========================================
// INISIALISASI & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  // 1. Inisialisasi Tema
  initTheme();
  document.getElementById('btnToggleTheme')?.addEventListener('click', () => {
    toggleTheme();
  });

  // 2. Setup Canvas Preview
  const previewCanvas = document.getElementById('previewCanvas');
  const canvasViewport = document.getElementById('canvasViewport');
  preview = new DocumentPreview(previewCanvas, canvasViewport);

  // 3. Callback saat ada kotak sensor terpilih
  preview.onSelectionChange = (selectedBox) => {
    const floatBar = document.getElementById('redactFloatBar');
    if (floatBar) {
      if (selectedBox) floatBar.classList.add('visible');
      else floatBar.classList.remove('visible');
    }
    updateRedactionPanel();
  };

  // 4. Inisialisasi Dropzone & File Input
  setupFileInputs();

  // 5. Inisialisasi Kontrol Toolbar Preview
  setupPreviewToolbar();

  // 6. Inisialisasi Panel Kontrol & Presets
  setupWatermarkControls();
  setupRedactionControls();
  setupExportControls();
  setupPresetDropdown();

  // 7. Tombol Reset Utama
  document.getElementById('btnResetApp')?.addEventListener('click', resetAll);

  // 8. Registrasi Service Worker PWA (jika didukung)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {
        // Ignored in dev / non-sw env
      });
    });
  }
});

// ==========================================
// PENANGANAN INPUT BERKAS
// ==========================================
function setupFileInputs() {
  const dropzoneCard = document.getElementById('dropzoneCard');
  const fileInput = document.getElementById('fileInput');
  const btnBrowseFile = document.getElementById('btnBrowseFile');
  const btnSampleDoc = document.getElementById('btnSampleDoc');

  btnBrowseFile?.addEventListener('click', () => fileInput?.click());
  dropzoneCard?.addEventListener('click', (e) => {
    if (e.target !== btnBrowseFile && e.target !== btnSampleDoc) {
      fileInput?.click();
    }
  });

  // Drag & Drop
  ['dragenter', 'dragover'].forEach(eventName => {
    dropzoneCard?.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropzoneCard.classList.add('drag-over');
    });
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropzoneCard?.addEventListener(eventName, (e) => {
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
    e.target.value = ''; // Reset input agar bisa pilih file yang sama
  });

  // Contoh KTP Dummy
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
      showToast('Dokumen contoh KTP berhasil dimuat!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal membuat dokumen contoh', 'error');
    }
  });
}

/**
 * Memproses daftar file yang dipilih
 */
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

  loadedDocuments = [...loadedDocuments, ...newDocs];
  activeDocIndex = loadedDocuments.length - newDocs.length; // Fokus ke file pertama yang baru dimasukkan
  showWorkspace();
  showToast(`${newDocs.length} berkas berhasil dimuat 100% offline!`, 'success');
}

// ==========================================
// TAMPILAN WORKSPACE & BATCH SELECTOR
// ==========================================
function showWorkspace() {
  const dropzone = document.getElementById('dropzoneSection');
  const workspace = document.getElementById('workspaceSection');
  if (dropzone) dropzone.style.display = 'none';
  if (workspace) workspace.style.display = 'grid';

  updateBatchStrip();
  updateActiveDocumentView();
}

function updateBatchStrip() {
  const batchContainer = document.getElementById('batchContainer');
  const batchStrip = document.getElementById('batchStrip');
  const batchCountBadge = document.getElementById('batchCountBadge');
  const btnBatchZip = document.getElementById('btnDownloadBatchZip');

  if (!batchContainer || !batchStrip) return;

  if (loadedDocuments.length > 1) {
    batchContainer.style.display = 'block';
    if (btnBatchZip) btnBatchZip.style.display = 'flex';
    if (batchCountBadge) batchCountBadge.textContent = `${loadedDocuments.length} Berkas`;

    batchStrip.innerHTML = '';
    loadedDocuments.forEach((doc, idx) => {
      const chip = document.createElement('div');
      chip.className = `batch-chip ${idx === activeDocIndex ? 'active' : ''}`;
      chip.innerHTML = `
        <span>${doc.isPdf ? '📄' : '🖼️'} ${doc.name}</span>
      `;
      chip.addEventListener('click', () => {
        activeDocIndex = idx;
        updateBatchStrip();
        updateActiveDocumentView();
      });
      batchStrip.appendChild(chip);
    });
  } else {
    batchContainer.style.display = 'none';
    if (btnBatchZip) btnBatchZip.style.display = 'none';
  }
}

function updateActiveDocumentView() {
  const doc = loadedDocuments[activeDocIndex];
  if (!doc) return;

  const page = doc.pages[doc.activePageIndex];
  const fileKey = `${doc.id}_p${doc.activePageIndex}`;

  // Multi-page PDF navigation
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

  // Perbarui preview
  preview.setDocumentPage(page, fileKey, redactionManager, watermarkSettings);
  updateRedactionPanel();
}

// ==========================================
// TOOLBAR PREVIEW (ASLI / HASIL / BELAH & SENSOR)
// ==========================================
function setupPreviewToolbar() {
  const btnAfter = document.getElementById('btnViewAfter');
  const btnBefore = document.getElementById('btnViewBefore');
  const btnSplit = document.getElementById('btnViewSplit');
  const btnToggleRedact = document.getElementById('btnToggleRedact');
  const btnDeleteSelectedBox = document.getElementById('btnDeleteSelectedBox');
  const btnPrevPage = document.getElementById('btnPrevPage');
  const btnNextPage = document.getElementById('btnNextPage');

  function setActiveViewBtn(btn) {
    [btnAfter, btnBefore, btnSplit].forEach(b => b?.classList.remove('active'));
    btn?.classList.add('active');
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
    const doc = loadedDocuments[activeDocIndex];
    if (doc) {
      const fileKey = `${doc.id}_p${doc.activePageIndex}`;
      const deleted = redactionManager.deleteSelectedBox(fileKey);
      if (deleted) {
        preview.render();
        preview.onSelectionChange(null);
        showToast('Kotak sensor dihapus', 'info');
      }
    }
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
}

function syncRedactTabButton(enabled) {
  const btnPanel = document.getElementById('btnPanelToggleRedact');
  if (btnPanel) {
    btnPanel.textContent = enabled ? 'Non-aktifkan Mode Sensor' : 'Aktifkan Mode Sensor';
    btnPanel.style.background = enabled ? '#0f172a' : '';
  }
}

// ==========================================
// PENGATURAN WATERMARK & PRESET
// ==========================================
function setupWatermarkControls() {
  const inputText = document.getElementById('inputWatermarkText');
  const sliderOpacity = document.getElementById('sliderOpacity');
  const sliderFontSize = document.getElementById('sliderFontSize');
  const sliderAngle = document.getElementById('sliderAngle');
  const sliderSpacingX = document.getElementById('sliderSpacingX');
  const sliderSpacingY = document.getElementById('sliderSpacingY');
  const sliderJitter = document.getElementById('sliderJitter');
  const checkOutline = document.getElementById('checkOutline');
  const customColorPicker = document.getElementById('customColorPicker');

  // Nilai Awal
  if (inputText) inputText.value = watermarkSettings.text;
  if (sliderOpacity) sliderOpacity.value = Math.round(watermarkSettings.opacity * 100);
  if (sliderFontSize) sliderFontSize.value = watermarkSettings.fontSizePercent;
  if (sliderAngle) sliderAngle.value = watermarkSettings.angle;
  if (sliderSpacingX) sliderSpacingX.value = watermarkSettings.spacingXPercent;
  if (sliderSpacingY) sliderSpacingY.value = watermarkSettings.spacingYPercent;
  if (sliderJitter) sliderJitter.value = watermarkSettings.jitterPercent;
  if (checkOutline) checkOutline.checked = watermarkSettings.strokeOutline;

  // Event Input Teks
  inputText?.addEventListener('input', (e) => {
    watermarkSettings.text = e.target.value;
    preview.setWatermarkSettings(watermarkSettings);
  });

  // Quick Insert Pills
  document.querySelectorAll('.pill-insert[data-insert]').forEach(btn => {
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

  // Slider Events
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

  // Checkbox Stroke Outline
  checkOutline?.addEventListener('change', (e) => {
    watermarkSettings.strokeOutline = e.target.checked;
    preview.setWatermarkSettings(watermarkSettings);
  });

  // Color Swatches
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(sw => {
    sw.addEventListener('click', () => {
      swatches.forEach(s => s.classList.remove('active'));
      sw.classList.add('active');
      const c = sw.getAttribute('data-color') || '#059669';
      watermarkSettings.color = c;
      if (customColorPicker) customColorPicker.value = c;
      preview.setWatermarkSettings(watermarkSettings);
    });
  });

  customColorPicker?.addEventListener('input', (e) => {
    swatches.forEach(s => s.classList.remove('active'));
    watermarkSettings.color = e.target.value;
    preview.setWatermarkSettings(watermarkSettings);
  });
}

// ==========================================
// PRESET DROPDOWN
// ==========================================
function setupPresetDropdown() {
  const select = document.getElementById('presetSelect');
  const btnSave = document.getElementById('btnSavePreset');
  const btnDelete = document.getElementById('btnDeletePreset');

  function renderOptions() {
    if (!select) return;
    const presets = getSavedPresets();
    select.innerHTML = '<option value="">-- Pilih Preset Rekomendasi --</option>';

    presets.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = `${p.isCustom ? '⭐ ' : ''}${p.name}`;
      select.appendChild(opt);
    });
  }

  renderOptions();

  select?.addEventListener('change', (e) => {
    const presetId = e.target.value;
    if (!presetId) {
      if (btnDelete) btnDelete.style.display = 'none';
      return;
    }

    const presets = getSavedPresets();
    const found = presets.find(p => p.id === presetId);
    if (found) {
      applyPresetSettings(found.settings);
      if (btnDelete) btnDelete.style.display = found.isCustom ? 'inline-block' : 'none';
      showToast(`Preset "${found.name}" diterapkan`, 'info');
    }
  });

  btnSave?.addEventListener('click', () => {
    const name = prompt('Masukkan nama preset baru:');
    if (!name || !name.trim()) return;

    const saved = saveCustomPreset(name.trim(), watermarkSettings);
    if (saved) {
      renderOptions();
      select.value = saved.id;
      if (btnDelete) btnDelete.style.display = 'inline-block';
      showToast(`Preset "${saved.name}" berhasil disimpan`, 'success');
    }
  });

  btnDelete?.addEventListener('click', () => {
    const presetId = select.value;
    if (!presetId) return;
    if (confirm('Hapus preset ini dari browser Anda?')) {
      deleteCustomPreset(presetId);
      renderOptions();
      btnDelete.style.display = 'none';
      showToast('Preset dihapus', 'info');
    }
  });
}

function applyPresetSettings(newSettings) {
  watermarkSettings = { ...watermarkSettings, ...newSettings };

  // Sinkronkan form inputs
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

  // Warna
  const swatches = document.querySelectorAll('.color-swatch');
  swatches.forEach(s => {
    s.classList.toggle('active', s.getAttribute('data-color') === watermarkSettings.color);
  });
  if (customColorPicker) customColorPicker.value = watermarkSettings.color;

  preview.setWatermarkSettings(watermarkSettings);
}

// ==========================================
// KONTROL PANEL SENSOR (REDACTION)
// ==========================================
function setupRedactionControls() {
  const btnPanelToggle = document.getElementById('btnPanelToggleRedact');
  const btnClearAll = document.getElementById('btnClearPageRedactions');

  btnPanelToggle?.addEventListener('click', () => {
    const isNow = !preview.isRedactionMode;
    preview.setRedactionMode(isNow);
    document.getElementById('btnToggleRedact')?.classList.toggle('active', isNow);
    syncRedactTabButton(isNow);
    showToast(isNow ? 'Mode Sensor aktif' : 'Mode Sensor non-aktif', 'info');
  });

  btnClearAll?.addEventListener('click', () => {
    const doc = loadedDocuments[activeDocIndex];
    if (doc) {
      const fileKey = `${doc.id}_p${doc.activePageIndex}`;
      redactionManager.clearAllBoxes(fileKey);
      preview.render();
      updateRedactionPanel();
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
      padding: 0.35rem 0.6rem; border-radius: 6px; font-size: 0.825rem;
      background: ${isSel ? 'var(--primary-100)' : 'var(--bg-card-subtle)'};
      border: 1px solid ${isSel ? 'var(--primary-500)' : 'var(--border-color)'};
    `;
    item.innerHTML = `
      <span>⬛ Kotak #${i + 1} (${Math.round(b.width * 100)}% × ${Math.round(b.height * 100)}%)</span>
      <button style="border: none; background: transparent; color: #ef4444; cursor: pointer; font-weight: bold;">✕</button>
    `;

    // Klik untuk seleksi kotak
    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'BUTTON') {
        redactionManager.selectedBoxId = b.id;
        preview.render();
        preview.onSelectionChange(b);
      }
    });

    // Tombol hapus satuan
    item.querySelector('button')?.addEventListener('click', (e) => {
      e.stopPropagation();
      redactionManager.selectedBoxId = b.id;
      redactionManager.deleteSelectedBox(fileKey);
      preview.render();
      preview.onSelectionChange(null);
      updateRedactionPanel();
    });

    listEl.appendChild(item);
  });
}

// ==========================================
// TAB SWITCHING & EXPORT
// ==========================================
function setupExportControls() {
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

  // Format selection cards
  const formatCards = document.querySelectorAll('.format-radio-card');
  const formatLabel = document.getElementById('downloadFormatLabel');

  formatCards.forEach(card => {
    card.addEventListener('click', () => {
      formatCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      exportFormat = card.getAttribute('data-format') || 'png';
      if (formatLabel) formatLabel.textContent = exportFormat.toUpperCase();
    });
  });

  // Download Dokumen Aktif
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

  // Download Batch ZIP
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
// RESET & BERSIHKAN SEMUA DATA
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

  // Reset UI View
  const dropzone = document.getElementById('dropzoneSection');
  const workspace = document.getElementById('workspaceSection');
  if (workspace) workspace.style.display = 'none';
  if (dropzone) dropzone.style.display = 'block';

  showToast('Memori telah dibersihkan secara menyeluruh', 'info');
}
