/**
 * redact.js
 * Modul untuk sensor manual (redaction kotak hitam).
 * Semua koordinat disimpan dalam rentang relatif [0..1] terhadap lebar dan tinggi dokumen asli,
 * sehingga hasil sensor tepat di posisi yang sama saat preview maupun saat export resolusi tinggi.
 */

export class RedactionManager {
  constructor() {
    // Peta kotak sensor per dokumen/halaman: fileKey -> Array<RedactionBox>
    // RedactionBox: { id, x, y, width, height } (semua 0..1)
    this.boxesMap = new Map();
    this.selectedBoxId = null;
    this.activeHandle = null; // 'nw', 'ne', 'se', 'sw', 'move', 'create'
    this.dragStart = null;
    this.dragOriginalBox = null;
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
   * Set kotak untuk file tertentu
   */
  setBoxes(fileKey, boxes) {
    this.boxesMap.set(fileKey, [...boxes]);
  }

  /**
   * Tambah kotak baru
   */
  addBox(fileKey, box) {
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
  hitTest(fileKey, normX, normY, handleRadiusNorm = 0.02) {
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
      // Border seleksi kuning-emas / emerald cerah
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);

      // Corner handles
      const handleSize = Math.max(8, Math.min(16, width * 0.02));
      const halfH = handleSize / 2;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#059669';
      ctx.lineWidth = 2;

      const corners = [
        [bx - halfH, by - halfH],
        [bx + bw - halfH, by - halfH],
        [bx + bw - halfH, by + bh - halfH],
        [bx - halfH, by + bh - halfH]
      ];

      for (const [cx, cy] of corners) {
        ctx.fillRect(cx, cy, handleSize, handleSize);
        ctx.strokeRect(cx, cy, handleSize, handleSize);
      }
    }

    ctx.restore();
  }
}
