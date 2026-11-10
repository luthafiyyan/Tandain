/**
 * preview.js
 * Modul preview interaktif dokumen di Canvas dengan estetika "Cap & Tinta".
 * - Menggunakan SATU fungsi renderWatermark unifikasi
 * - Menangani devicePixelRatio dengan benar
 * - Mode Asli, Hasil, dan Belah (Interactive Split Drag)
 * - Interaksi Sensor (Redaction) Touch & Mouse dengan Undo/Redo support
 * - Zoom responsif
 * - Animasi cap menempel (stamp animation)
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

    // Mode tampilan: 'after' (hasil cap), 'before' (dokumen asli), 'split' (slider belah)
    this.viewMode = 'after';
    this.splitRatio = 0.5;
    this.isDraggingSplit = false;

    // Zoom level
    this.zoomScale = 1.0;

    // Mode sensor
    this.isRedactionMode = false;

    // State pointer interaksi sensor
    this.dragAction = null;
    this.dragStartPos = null;
    this.initialBoxState = null;
    this.creatingBox = null;

    this.onSelectionChange = null;

    this.initEvents();
  }

  initEvents() {
    this.canvas.addEventListener('pointerdown', this.handlePointerDown.bind(this));
    window.addEventListener('pointermove', this.handlePointerMove.bind(this));
    window.addEventListener('pointerup', this.handlePointerUp.bind(this));
    window.addEventListener('pointercancel', this.handlePointerUp.bind(this));

    window.addEventListener('resize', () => {
      this.render();
    });
  }

  setDocumentPage(pageObj, fileKey, redactionManager, watermarkSettings) {
    this.activePage = pageObj;
    this.fileKey = fileKey;
    this.redactionManager = redactionManager;
    this.watermarkSettings = watermarkSettings;
    this.triggerStampAnimation();
    this.render();
  }

  setWatermarkSettings(settings) {
    this.watermarkSettings = settings;
    this.render();
  }

  triggerStampAnimation() {
    if (!this.canvas) return;
    this.canvas.classList.remove('stamp-applied');
    // Force reflow
    void this.canvas.offsetWidth;
    this.canvas.classList.add('stamp-applied');
    setTimeout(() => {
      this.canvas.classList.remove('stamp-applied');
    }, 350);
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

    // 1. Cek garis pembatas Split
    if (this.viewMode === 'split') {
      const splitTolerance = 0.05;
      if (Math.abs(normX - this.splitRatio) <= splitTolerance) {
        this.isDraggingSplit = true;
        this.canvas.setPointerCapture(e.pointerId);
        return;
      }
    }

    // 2. Interaksi Sensor
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

    if (this.isDraggingSplit) {
      this.splitRatio = Math.max(0.05, Math.min(0.95, normX));
      this.render();
      return;
    }

    if (this.viewMode === 'split' && !this.isRedactionMode) {
      if (Math.abs(normX - this.splitRatio) <= 0.05) {
        this.canvas.style.cursor = 'ew-resize';
      } else {
        this.canvas.style.cursor = 'default';
      }
    }

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

  async render() {
    if (!this.activePage || !this.activePage.bitmap) {
      this.canvas.width = 0;
      this.canvas.height = 0;
      return;
    }

    if (document.fonts && document.fonts.ready) {
      await document.fonts.ready;
    }

    const containerWidth = (this.container.clientWidth || 600) - 16;
    const maxHeight = Math.max(340, window.innerHeight * 0.62);
    const docAspect = this.activePage.width / this.activePage.height;

    let displayWidth = containerWidth;
    let displayHeight = displayWidth / docAspect;

    if (displayHeight > maxHeight) {
      displayHeight = maxHeight;
      displayWidth = displayHeight * docAspect;
    }

    displayWidth *= this.zoomScale;
    displayHeight *= this.zoomScale;

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

    // 1. Render gambar asli sebagai latar
    ctx.drawImage(this.activePage.bitmap, 0, 0, renderW, renderH);

    // 2. Mode 'before' (hanya gambar asli)
    if (this.viewMode === 'before') {
      ctx.restore();
      return;
    }

    // 3. Render kotak sensor (redaction)
    if (this.redactionManager && this.fileKey) {
      const boxes = this.redactionManager.getBoxes(this.fileKey);
      const selectedId = this.isRedactionMode ? this.redactionManager.selectedBoxId : null;
      renderRedactions(ctx, renderW, renderH, boxes, selectedId, false);

      if (this.creatingBox) {
        ctx.save();
        ctx.fillStyle = 'rgba(20, 22, 28, 0.85)';
        ctx.strokeStyle = '#C8372D';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        const bx = Math.round(this.creatingBox.x * renderW);
        const by = Math.round(this.creatingBox.y * renderH);
        const bw = Math.round(this.creatingBox.width * renderW);
        const bh = Math.round(this.creatingBox.height * renderH);
        ctx.fillRect(bx, by, bw, bh);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.restore();
      }
    }

    // 4. Render watermark (fungsi unifikasi tunggal)
    if (this.watermarkSettings) {
      renderWatermark(ctx, renderW, renderH, this.watermarkSettings);
    }

    // 5. Mode split pembanding
    if (this.viewMode === 'split') {
      const splitX = Math.round(renderW * this.splitRatio);

      // Gambar ulang sisi kiri sebagai dokumen asli
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitX, renderH);
      ctx.clip();
      ctx.drawImage(this.activePage.bitmap, 0, 0, renderW, renderH);
      ctx.restore();

      // Garis pemisah merah cap
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(splitX, 0);
      ctx.lineTo(splitX, renderH);
      ctx.strokeStyle = '#C8372D';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Tombol handle stempel bundar di tengah
      ctx.fillStyle = '#C8372D';
      ctx.beginPath();
      ctx.arc(splitX, renderH / 2, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(splitX, renderH / 2, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#C8372D';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('◀▶', splitX, renderH / 2);

      // Label teks Asli vs Ber-cap
      ctx.fillStyle = 'rgba(23, 25, 34, 0.85)';
      ctx.beginPath();
      ctx.roundRect(10, 10, 52, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '700 9px monospace';
      ctx.fillText('ASLI', 36, 21);

      ctx.fillStyle = 'rgba(23, 25, 34, 0.85)';
      ctx.beginPath();
      ctx.roundRect(renderW - 74, 10, 64, 22, 4);
      ctx.fill();
      ctx.fillStyle = '#F87171';
      ctx.font = '700 9px monospace';
      ctx.fillText('BER-CAP', renderW - 42, 21);

      ctx.restore();
    }

    ctx.restore();
  }
}
