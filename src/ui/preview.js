/**
 * preview.js
 * Modul preview interaktif dokumen di Canvas.
 * Memastikan aturan teknis:
 * - Menggunakan fungsi renderWatermark yang sama persis
 * - Menangani devicePixelRatio dengan benar
 * - Mendukung perbandingan Sebelum / Sesudah (Before / After)
 * - Mendukung interaksi sensor (redaction) pointer touch & mouse
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
    if (!this.activePage || !this.isRedactionMode || !this.redactionManager) return;
    this.canvas.setPointerCapture(e.pointerId);

    const { normX, normY } = this.getNormalizedCoordinates(e);
    const hit = this.redactionManager.hitTest(this.fileKey, normX, normY, 0.03);

    if (hit.action === 'select') {
      this.redactionManager.selectedBoxId = hit.box.id;
      this.dragAction = 'move';
      this.dragStartPos = { normX, normY };
      this.initialBoxState = { ...hit.box };
      if (this.onSelectionChange) this.onSelectionChange(hit.box);
      this.render();
    } else if (['move', 'nw', 'ne', 'se', 'sw'].includes(hit.action)) {
      this.dragAction = hit.action;
      this.dragStartPos = { normX, normY };
      this.initialBoxState = { ...hit.box };
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

  handlePointerMove(e) {
    if (!this.dragAction || !this.activePage || !this.redactionManager) {
      // Perbarui cursor hover saat mode sensor aktif
      if (this.isRedactionMode && this.redactionManager) {
        const { normX, normY } = this.getNormalizedCoordinates(e);
        const hit = this.redactionManager.hitTest(this.fileKey, normX, normY, 0.03);
        if (hit.action === 'move') this.canvas.style.cursor = 'move';
        else if (hit.action === 'nw' || hit.action === 'se') this.canvas.style.cursor = 'nwse-resize';
        else if (hit.action === 'ne' || hit.action === 'sw') this.canvas.style.cursor = 'nesw-resize';
        else if (hit.action === 'select') this.canvas.style.cursor = 'pointer';
        else this.canvas.style.cursor = 'crosshair';
      } else {
        this.canvas.style.cursor = 'default';
      }
      return;
    }

    const { normX, normY } = this.getNormalizedCoordinates(e);
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

  handlePointerUp(e) {
    if (!this.dragAction) return;

    if (this.dragAction === 'create' && this.creatingBox) {
      // Simpan kotak jika dimensinya signifikan (> 1% layar)
      if (this.creatingBox.width > 0.01 && this.creatingBox.height > 0.01) {
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

  /**
   * Render utama preview ke canvas
   */
  async render() {
    if (!this.activePage || !this.activePage.bitmap) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      return;
    }

    // Tunggu font siap
    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    // 1. Hitung ukuran tampilan sesuai kontainer dan aspek rasio
    const containerWidth = this.container.clientWidth || 600;
    const maxHeight = Math.max(300, window.innerHeight * 0.58);
    const docAspect = this.activePage.width / this.activePage.height;

    let displayWidth = containerWidth;
    let displayHeight = displayWidth / docAspect;

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * docAspect;
    }

    // 2. Terapkan devicePixelRatio untuk ketajaman retina/HP
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

    // 4. Jika mode 'before', tampilkan hanya gambar asli tanpa watermark & sensor
    if (this.viewMode === 'before') {
      ctx.restore();
      return;
    }

    // 5. Render kotak sensor (redaction)
    if (this.redactionManager && this.fileKey) {
      const boxes = this.redactionManager.getBoxes(this.fileKey);
      const selectedId = this.isRedactionMode ? this.redactionManager.selectedBoxId : null;
      renderRedactions(ctx, renderW, renderH, boxes, selectedId, false);

      // Render kotak yang sedang dibuat saat drag
      if (this.creatingBox) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2;
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

    // 7. Jika mode 'split', gambar divider pemisah dan bandingkan
    if (this.viewMode === 'split') {
      const splitX = Math.round(renderW * this.splitRatio);

      // Gambar ulang sisi kiri murni dokumen asli
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, renderH);
      ctx.clip();
      ctx.drawImage(this.activePage.bitmap, 0, 0, renderW, renderH);
      ctx.restore();

      // Garis pembatas split
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, renderH);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Handle bulatan di tengah garis split
      ctx.fillStyle = '#059669';
      ctx.beginPath();
      ctx.arc(splitX, renderH / 2, 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◀▶', splitX, renderH / 2);

      // Label teks Asli vs Watermark
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(8, 8, 60, 22);
      ctx.fillRect(renderW - 88, 8, 80, 22);
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 11px sans-serif';
      ctx.fillText('ASLI', 38, 19);
      ctx.fillText('WATERMARK', renderW - 48, 19);
      ctx.restore();
    }

    ctx.restore();
  }
}
