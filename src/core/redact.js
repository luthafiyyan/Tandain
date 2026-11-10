/**
 * redact.js
 * Modul untuk sensor manual (redaction kotak hitam).
 * Semua koordinat disimpan dalam rentang relatif [0..1] terhadap lebar dan tinggi dokumen asli,
 * sehingga hasil sensor tepat di posisi yang sama saat preview maupun saat export resolusi tinggi.
 * Dilengkapi dengan sistem Undo/Redo dan manajemen interaksi multi-halaman.
 */

export class RedactionManager {
  constructor() {
    // Peta kotak sensor per dokumen/halaman: fileKey -> Array<RedactionBox>
    // RedactionBox: { id, x, y, width, height } (semua 0..1)
    this.boxesMap = new Map();
    this.selectedBoxId = null;

    // History stacks untuk Undo / Redo: fileKey -> Array<Array<RedactionBox>>
    this.undoStacks = new Map();
    this.redoStacks = new Map();
  }

  /**
   * Dapatkan daftar kotak untuk file / halaman tertentu
   * @param {string} fileKey
   * @returns {Array<{id: string, x: number, y: number, width: number, height: number}>}
   */
  getBoxes(fileKey) {
    if (!this.boxesMap.has(fileKey)) {
      this.boxesMap.set(fileKey, []);
    }
    return this.boxesMap.get(fileKey);
  }

  /**
   * Simpan snapshot untuk Undo sebelum memodifikasi state
   */
  pushSnapshot(fileKey) {
    if (!this.undoStacks.has(fileKey)) {
      this.undoStacks.set(fileKey, []);
    }
    const stack = this.undoStacks.get(fileKey);
    const current = this.getBoxes(fileKey).map(b => ({ ...b }));
    stack.push(current);
    if (stack.length > 30) stack.shift(); // Maksimal 30 langkah riwayat

    // Kosongkan redo saat ada aksi baru
    if (this.redoStacks.has(fileKey)) {
      this.redoStacks.get(fileKey).length = 0;
    }
  }

  /**
   * Batalkan aksi terakhir (Undo)
   */
  undo(fileKey) {
    const undoStack = this.undoStacks.get(fileKey);
    if (!undoStack || undoStack.length === 0) return false;

    if (!this.redoStacks.has(fileKey)) {
      this.redoStacks.set(fileKey, []);
    }
    const redoStack = this.redoStacks.get(fileKey);
    redoStack.push(this.getBoxes(fileKey).map(b => ({ ...b })));

    const prev = undoStack.pop();
    this.boxesMap.set(fileKey, prev);
    this.selectedBoxId = null;
    return true;
  }

  /**
   * Ulangi aksi yang dibatalkan (Redo)
   */
  redo(fileKey) {
    const redoStack = this.redoStacks.get(fileKey);
    if (!redoStack || redoStack.length === 0) return false;

    if (!this.undoStacks.has(fileKey)) {
      this.undoStacks.set(fileKey, []);
    }
    const undoStack = this.undoStacks.get(fileKey);
    undoStack.push(this.getBoxes(fileKey).map(b => ({ ...b })));

    const next = redoStack.pop();
    this.boxesMap.set(fileKey, next);
    this.selectedBoxId = null;
    return true;
  }

  canUndo(fileKey) {
    const stack = this.undoStacks.get(fileKey);
    return !!(stack && stack.length > 0);
  }

  canRedo(fileKey) {
    const stack = this.redoStacks.get(fileKey);
    return !!(stack && stack.length > 0);
  }

  /**
   * Tambah kotak baru
   */
  addBox(fileKey, box) {
    this.pushSnapshot(fileKey);
    const boxes = this.getBoxes(fileKey);
    const newBox = {
      id: 'box_' + Math.random().toString(36).slice(2, 9),
      x: Math.max(0, Math.min(1, box.x)),
      y: Math.max(0, Math.min(1, box.y)),
      width: Math.max(0.01, Math.min(1, box.width)),
      height: Math.max(0.01, Math.min(1, box.height))
    };
    boxes.push(newBox);
    this.selectedBoxId = newBox.id;
    return newBox;
  }

  /**
   * Hapus kotak terpilih
   */
  deleteSelectedBox(fileKey) {
    if (!this.selectedBoxId) return false;
    this.pushSnapshot(fileKey);
    const boxes = this.getBoxes(fileKey);
    const index = boxes.findIndex(b => b.id === this.selectedBoxId);
    if (index !== -1) {
      boxes.splice(index, 1);
      this.selectedBoxId = null;
      return true;
    }
    return false;
  }

  /**
   * Hapus semua kotak untuk file ini
   */
  clearAllBoxes(fileKey) {
    const boxes = this.getBoxes(fileKey);
    if (boxes.length === 0) return;
    this.pushSnapshot(fileKey);
    this.boxesMap.set(fileKey, []);
    this.selectedBoxId = null;
  }

  /**
   * Hit test pada canvas preview
   * @param {string} fileKey
   * @param {number} normX Relatif 0..1
   * @param {number} normY Relatif 0..1
   * @param {number} handleRadiusNorm Radius handle relatif terhadap canvas
   */
  hitTest(fileKey, normX, normY, handleRadiusNorm = 0.03) {
    const boxes = this.getBoxes(fileKey);

    // Cek handle kotak terpilih terlebih dahulu
    if (this.selectedBoxId) {
      const selected = boxes.find(b => b.id === this.selectedBoxId);
      if (selected) {
        const x2 = selected.x + selected.width;
        const y2 = selected.y + selected.height;

        const handles = [
          { type: 'nw', x: selected.x, y: selected.y },
          { type: 'ne', x: x2, y: selected.y },
          { type: 'se', x: x2, y: y2 },
          { type: 'sw', x: selected.x, y: y2 }
        ];

        for (const h of handles) {
          if (Math.hypot(normX - h.x, normY - h.y) <= handleRadiusNorm * 1.5) {
            return { action: h.type, box: selected };
          }
        }

        // Cek apakah di dalam kotak terpilih
        if (normX >= selected.x && normX <= x2 && normY >= selected.y && normY <= y2) {
          return { action: 'move', box: selected };
        }
      }
    }

    // Cek kotak lain dari atas ke bawah (urutan render terbalik)
    for (let i = boxes.length - 1; i >= 0; i--) {
      const b = boxes[i];
      if (normX >= b.x && normX <= b.x + b.width && normY >= b.y && normY <= b.y + b.height) {
        return { action: 'select', box: b };
      }
    }

    return { action: 'none', box: null };
  }
}

/**
 * Render kotak sensor pada canvas (digunakan saat preview dan saat export)
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} width - Lebar canvas target
 * @param {number} height - Tinggi canvas target
 * @param {Array<{id: string, x: number, y: number, width: number, height: number}>} boxes
 * @param {string|null} selectedBoxId - ID kotak yang sedang aktif diedit (null saat export)
 * @param {boolean} isExport - Jika true, hanya gambar kotak hitam pekat tanpa garis bantu UI
 */
export function renderRedactions(ctx, width, height, boxes = [], selectedBoxId = null, isExport = false) {
  if (!ctx || !Array.isArray(boxes) || boxes.length === 0) return;

  for (const box of boxes) {
    const bx = Math.round(box.x * width);
    const by = Math.round(box.y * height);
    const bw = Math.round(box.width * width);
    const bh = Math.round(box.height * height);

    ctx.save();

    // 1. Gambar kotak hitam solid sensor
    ctx.fillStyle = '#000000';
    ctx.fillRect(bx, by, bw, bh);

    // 2. Jika bukan export dan ini adalah kotak terpilih, gambar highlight editing
    if (!isExport && box.id === selectedBoxId) {
      // Glow effect dan border neon
      ctx.shadowColor = 'rgba(16, 185, 129, 0.4)';
      ctx.shadowBlur = 8;
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2.5;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.shadowBlur = 0;

      // Handle pojok bulat modern
      const handleRadius = Math.max(5, Math.min(10, width * 0.014));
      const corners = [
        [bx, by],
        [bx + bw, by],
        [bx + bw, by + bh],
        [bx, by + bh]
      ];

      for (const [cx, cy] of corners) {
        ctx.fillStyle = '#10b981';
        ctx.beginPath();
        ctx.arc(cx, cy, handleRadius + 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(cx, cy, handleRadius - 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
