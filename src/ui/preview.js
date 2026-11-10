/**
 * preview.js
 * Modul preview interaktif dokumen di Canvas.
 * - Menggunakan SATU fungsi renderWatermark unifikasi
 * - Menangani devicePixelRatio dengan benar
 * - Mode Asli, Hasil, dan Belah (Interactive Split Drag)
 * - Interaksi Sensor (Redaction) Touch & Mouse dengan Undo/Redo support
 * - Zoom & Pan responsif
 */

import { renderWatermark } from '../core/watermark.js';
import { renderRedactions } from '../core/redact.js';

export class DocumentPreview {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLElement} container
   */
  constructor(canvas, container) {
    this.canvas = canvas;
    this.container = container;
    this.ctx = canvas.getContext('2d');

    this.activePage = null; // { bitmap, width, height }
    this.fileKey = null;
    this.watermarkSettings = null;
    this.redactionManager = null;

    // Mode tampilan: 'after' (hasil watermark), 'before' (dokumen asli), 'split' (slider belah)
    this.viewMode = 'after';
    this.splitRatio = 0.5; // 0..1 untuk mode split
    this.isDraggingSplit = false;

    // Zoom level: 1 = fit to container, > 1 = zoomed in
    this.zoomScale = 1.0;

    // Mode sensor aktif atau tidak
    this.isRedactionMode = false;

    // State pointer interaksi sensor
    this.dragAction = null; // 'create' | 'move' | 'nw' | 'ne' | 'se' | 'sw'
    this.dragStartPos = null; // { normX, normY }
    this.initialBoxState = null;
    this.creatingBox = null;

    // Callback event saat perubahan seleksi kotak
    this.onSelectionChange = null;

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    window.addEventListener('pointermove', this.handlePointerMove.bind(this));
    window.addEventListener('pointerup', this.handlePointerUp.bind(this));
    window.addEventListener('pointercancel', this.handlePointerUp.bind(this));

    // Handle resize window
    window.addEventListener('resize', () => {
      this.render();
    });
  }

  setDocumentPage(pageObj, fileKey, redactionManager, watermarkSettings) {
    this.activePage = pageObj;
    this.fileKey = fileKey;
    this.redactionManager = redactionManager;
    this.watermarkSettings = watermarkSettings;
    this.render();
  }

  setWatermarkSettings(settings) {
    this.watermarkSettings = settings;
    this.render();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.render();
  }

  setSplitRatio(ratio) {
    this.splitRatio = Math.max(0.05, Math.min(0.95, ratio));
    this.render();
  }

  setZoom(scale) {
    this.zoomScale = Math.max(0.5, Math.min(3.0, scale));
    this.render();
  }

  setRedactionMode(enabled) {
    this.isRedactionMode = enabled;
    if (!enabled && this.redactionManager) {
      this.redactionManager.selectedBoxId = null;
      if (this.onSelectionChange) this.onSelectionChange(null);
    }
    this.render();
  }

  /**
   * Dapatkan koordinat normalisasi [0..1] dari event pointer
   */
  getNormalizedCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;

    const normX = (clientX - rect.left) / rect.width;
    const normY = (clientY - rect.top) / rect.height;

    return {
      normX: Math.max(0, Math.min(1, normX)),
      normY: Math.max(0, Math.min(1, normY))
    };
  }

  handlePointerDown(e) {
    if (!this.activePage) return;
    const { normX, normY } = this.getNormalizedCoordinates(e);

    // 1. Cek apakah pengguna mengklik garis pembatas Split
    if (this.viewMode === 'split') {
      const splitTolerance = 0.05; // 5% toleransi area garis split
      if (Math.abs(normX - this.splitRatio) <= splitTolerance) {
        this.isDraggingSplit = true;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Interaksi Sensor Redaction
    if (this.isRedactionMode && this.redactionManager) {
      this.canvas.setPointerCapture(e.pointerId);
      const hit = this.redactionManager.hitTest(this.fileKey, normX, normY, 0.035);

      if (hit.action === 'select') {
        this.redactionManager.selectedBoxId = hit.box.id;
        this.dragAction = 'move';
        this.dragStartPos = { normX, normY };
        this.initialBoxState = { ...hit.box };
        this.redactionManager.pushSnapshot(this.fileKey);
        if (this.onSelectionChange) this.onSelectionChange(hit.box);
        this.render();
      } else if (['move', 'nw', 'ne', 'se', 'sw'].includes(hit.action)) {
        this.dragAction = hit.action;
        this.dragStartPos = { normX, normY };
        this.initialBoxState = { ...hit.box };
        this.redactionManager.pushSnapshot(this.fileKey);
      } else {
        // Klik di luar kotak: mulai menggambar kotak sensor baru
        this.dragAction = 'create';
        this.dragStartPos = { normX, normY };
        this.creatingBox = {
          x: normX,
          y: normY,
          width: 0.001,
          height: 0.001
        };
        this.redactionManager.selectedBoxId = null;
        if (this.onSelectionChange) this.onSelectionChange(null);
        this.render();
      }
    }
  }

  handlePointerMove(e) {
    if (!this.activePage) return;
    const { normX, normY } = this.getNormalizedCoordinates(e);

    // A. Geser garis split view
    if (this.isDraggingSplit) {
      this.splitRatio = Math.max(0.05, Math.min(0.95, normX));
      this.render();
      return;
    }

    // B. Perbarui kursor saat hover garis split
    if (this.viewMode === 'split' && !this.isRedactionMode) {
      if (Math.abs(normX - this.splitRatio) <= 0.05) {
        this.canvas.style.cursor = 'ew-resize';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }

    // C. Interaksi sensor
    if (!this.dragAction || !this.redactionManager) {
      if (this.isRedactionMode && this.redactionManager) {
        const hit = this.redactionManager.hitTest(this.fileKey, normX, normY, 0.035);
        if (hit.action === 'move') this.canvas.style.cursor = 'move';
        else if (hit.action === 'nw' || hit.action === 'se') this.canvas.style.cursor = 'nwse-resize';
        else if (hit.action === 'ne' || hit.action === 'sw') this.canvas.style.cursor = 'nesw-resize';
        else if (hit.action === 'select') this.canvas.style.cursor = 'pointer';
        else this.canvas.style.cursor = 'crosshair';
      }
      return;
    }

    const dx = normX - this.dragStartPos.normX;
    const dy = normY - this.dragStartPos.normY;

    if (this.dragAction === 'create') {
      const minX = Math.min(this.dragStartPos.normX, normX);
      const minY = Math.min(this.dragStartPos.normY, normY);
      const w = Math.abs(normX - this.dragStartPos.normX);
      const h = Math.abs(normY - this.dragStartPos.normY);
      this.creatingBox = { x: minX, y: minY, width: w, height: h };
      this.render();
    } else if (this.dragAction === 'move' && this.initialBoxState) {
      const selected = this.redactionManager.getBoxes(this.fileKey).find(b => b.id === this.redactionManager.selectedBoxId);
      if (selected) {
        selected.x = Math.max(0, Math.min(1 - selected.width, this.initialBoxState.x + dx));
        selected.y = Math.max(0, Math.min(1 - selected.height, this.initialBoxState.y + dy));
        this.render();
      }
    } else if (['nw', 'ne', 'se', 'sw'].includes(this.dragAction) && this.initialBoxState) {
      const selected = this.redactionManager.getBoxes(this.fileKey).find(b => b.id === this.redactionManager.selectedBoxId);
      if (selected) {
        let x1 = this.initialBoxState.x;
        let y1 = this.initialBoxState.y;
        let x2 = this.initialBoxState.x + this.initialBoxState.width;
        let y2 = this.initialBoxState.y + this.initialBoxState.height;

        if (this.dragAction === 'nw') {
          x1 = Math.min(x2 - 0.02, normX);
          y1 = Math.min(y2 - 0.02, normY);
        } else if (this.dragAction === 'ne') {
          x2 = Math.max(x1 + 0.02, normX);
          y1 = Math.min(y2 - 0.02, normY);
        } else if (this.dragAction === 'se') {
          x2 = Math.max(x1 + 0.02, normX);
          y2 = Math.max(y1 + 0.02, normY);
        } else if (this.dragAction === 'sw') {
          x1 = Math.min(x2 - 0.02, normX);
          y2 = Math.max(y1 + 0.02, normY);
        }

        selected.x = Math.max(0, x1);
        selected.y = Math.max(0, y1);
        selected.width = Math.min(1 - selected.x, x2 - x1);
        selected.height = Math.min(1 - selected.y, y2 - y1);
        this.render();
      }
    }
  }

  handlePointerUp() {
    if (this.isDraggingSplit) {
      this.isDraggingSplit = false;
    }

    if (this.dragAction) {
      if (this.dragAction === 'create' && this.creatingBox) {
        if (this.creatingBox.width > 0.015 && this.creatingBox.height > 0.015) {
          const added = this.redactionManager.addBox(this.fileKey, this.creatingBox);
          if (this.onSelectionChange) this.onSelectionChange(added);
        }
        this.creatingBox = null;
      }
      this.dragAction = null;
      this.dragStartPos = null;
      this.initialBoxState = null;
      this.render();
    }
  }

  /**
   * Render utama preview ke canvas
   */
  async render() {
    if (!this.activePage || !this.activePage.bitmap) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      return;
    }

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // 1. Dimensi tampilan responsif
    const containerWidth = (this.container.clientWidth || 600) - 16;
    const maxHeight = Math.max(340, window.innerHeight * 0.60);
    const docAspect = this.activePage.width / this.activePage.height;

    let displayWidth = containerWidth;
    let displayHeight = displayWidth / docAspect;

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * docAspect;
    }

    // Terapkan Zoom scale
    displayWidth *= this.zoomScale;
    displayHeight *= this.zoomScale;

    // 2. Terapkan devicePixelRatio untuk retina/HP
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.round(displayWidth * dpr);
    this.canvas.height = Math.round(displayHeight * dpr);
    this.canvas.style.width = `${Math.round(displayWidth)}px`;
    this.canvas.style.height = `${Math.round(displayHeight)}px`;

    const ctx = this.ctx;
    ctx.save();
    ctx.scale(dpr, dpr);

    const renderW = Math.round(displayWidth);
    const renderH = Math.round(displayHeight);

    // 3. Render gambar asli sebagai latar belakang
    ctx.drawImage(this.activePage.bitmap, 0, 0, renderW, renderH);

    // 4. Jika mode 'before', stop di sini
    if (this.viewMode === 'before') {
      ctx.restore();
      return;
    }

    // 5. Render kotak sensor (redaction)
    if (this.redactionManager && this.fileKey) {
      const boxes = this.redactionManager.getBoxes(this.fileKey);
      const selectedId = this.isRedactionMode ? this.redactionManager.selectedBoxId : null;
      renderRedactions(ctx, renderW, renderH, boxes, selectedId, false);

      // Render kotak yang sedang ditarik kursor
      if (this.creatingBox) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        const bx = Math.round(this.creatingBox.x * renderW);
        const by = Math.round(this.creatingBox.y * renderH);
        const bw = Math.round(this.creatingBox.width * renderW);
        const bh = Math.round(this.creatingBox.height * renderH);
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();
      }
    }

    // 6. Render watermark menggunakan SATU fungsi unifikasi renderWatermark()
    if (this.watermarkSettings) {
      renderWatermark(ctx, renderW, renderH, this.watermarkSettings);
    }

    // 7. Jika mode 'split', gambar pembatas interaktif
    if (this.viewMode === 'split') {
      const splitX = Math.round(renderW * this.splitRatio);

      // Potong dan gambar ulang sisi kiri sebagai gambar murni tanpa watermark
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, renderH);
      ctx.clip();
      ctx.drawImage(this.activePage.bitmap, 0, 0, renderW, renderH);
      ctx.restore();

      // Garis pemisah neon dengan shadow
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, renderH);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 6;
      ctx.stroke();

      // Tombol handle melingkar di tengah garis split
      ctx.fillStyle = '#10b981';
      ctx.beginPath();
      ctx.arc(splitX, renderH / 2, 16, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(splitX, renderH / 2, 13, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#065f46';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◀▶', splitX, renderH / 2);

      // Pill label Asli vs Watermark
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(12, 12, 64, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '700 10px sans-serif';
      ctx.fillText('ASLI', 44, 24);

      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.beginPath();
      ctx.roundRect(renderW - 96, 12, 84, 24, 6);
      ctx.fill();
      ctx.fillStyle = '#34d399';
      ctx.font = '700 10px sans-serif';
      ctx.fillText('WATERMARK', renderW - 54, 24);

      ctx.restore();
    }

    ctx.restore();
  }
}
