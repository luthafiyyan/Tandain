/**
 * watermark.js
 * SATU-SATUNYA fungsi rendering watermark yang digunakan baik untuk
 * preview interaktif maupun saat export resolusi penuh.
 *
 * Semua dimensi memakai persentase relatif terhadap lebar (width) gambar,
 * sehingga hasil preview ukuran kecil identik 100% dengan ekspor ukuran asli.
 */

// Simple deterministic hash for consistent jitter across renders (prevents flickering)
function hash2d(x, y, seed = 1) {
  let h = (x * 374761393 + y * 668265263 + seed * 1013904223) ^ 0x5bf03635;
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296; // 0..1
}

/**
 * Format string tanggal hari ini dalam format DD/MM/YYYY
 */
export function getTodayFormatted() {
  const d = new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/**
 * Preset bawaan aplikasi
 */
export const DEFAULT_WATERMARK_SETTINGS = {
  text: `Hanya untuk keperluan verifikasi - ${getTodayFormatted()}`,
  fontSizePercent: 3.2,       // 3.2% dari lebar gambar
  color: '#059669',           // Hijau emerald default
  opacity: 0.30,              // 30% default
  angle: -25,                 // -25 derajat miring
  spacingXPercent: 28.0,      // 28% dari lebar gambar
  spacingYPercent: 16.0,      // 16% dari lebar gambar
  jitterPercent: 12.0,        // 12% variasi posisi agar sulit dihapus otomatis
  staggerRows: true,          // Baris selang-seling (pola bata)
  strokeOutline: false        // Garis tepi tipis agar terbaca di latar gelap/terang
};

/**
 * Render watermark berulang ke konteks canvas
 *
 * @param {CanvasRenderingContext2D} ctx - Konteks canvas 2D
 * @param {number} width - Lebar target canvas (px)
 * @param {number} height - Tinggi target canvas (px)
 * @param {typeof DEFAULT_WATERMARK_SETTINGS} settings - Pengaturan watermark
 */
export function renderWatermark(ctx, width, height, settings = DEFAULT_WATERMARK_SETTINGS) {
  if (!ctx || width <= 0 || height <= 0) return;
  const text = (settings.text || '').trim();
  if (!text) return;

  ctx.save();

  // 1. Hitung ukuran font berbasis persentase lebar (resolusi independen)
  const fontSizePx = Math.max(8, (settings.fontSizePercent / 100) * width);
  const fontName = `'Inter', system-ui, -apple-system, sans-serif`;
  ctx.font = `600 ${fontSizePx}px ${fontName}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 2. Setup warna dan opacity
  ctx.globalAlpha = Math.max(0.01, Math.min(1, settings.opacity ?? 0.3));
  ctx.fillStyle = settings.color || '#059669';

  if (settings.strokeOutline) {
    ctx.strokeStyle = settings.color === '#ffffff' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.6)';
    ctx.lineWidth = Math.max(1, fontSizePx * 0.08);
  }

  // 3. Hitung jarak grid relatif terhadap lebar
  const spacingX = Math.max(fontSizePx * 2, ((settings.spacingXPercent || 25) / 100) * width);
  const spacingY = Math.max(fontSizePx * 1.5, ((settings.spacingYPercent || 15) / 100) * width);
  const jitterAmount = ((settings.jitterPercent || 0) / 100) * spacingX * 0.35;

  // 4. Hitung diagonal untuk menutupi seluruh canvas saat diputar
  const diagonal = Math.hypot(width, height);
  const centerX = width / 2;
  const centerY = height / 2;

  // 5. Transformasi rotasi terpusat
  ctx.translate(centerX, centerY);
  const rad = ((settings.angle ?? -25) * Math.PI) / 180;
  ctx.rotate(rad);

  // Pisahkan multi-line jika ada baris baru
  const lines = text.split('\n');
  const lineHeight = fontSizePx * 1.25;

  // 6. Pola Tiling berulang
  const startX = -diagonal;
  const endX = diagonal;
  const startY = -diagonal;
  const endY = diagonal;

  let rowIndex = 0;
  for (let y = startY; y <= endY; y += spacingY) {
    let colIndex = 0;
    // Stagger per baris seperti pola susunan batu bata
    const rowOffset = (settings.staggerRows && (Math.abs(rowIndex) % 2 === 1)) ? spacingX * 0.5 : 0;

    for (let x = startX - spacingX; x <= endX + spacingX; x += spacingX) {
      // Deterministic jitter
      let jitX = 0;
      let jitY = 0;
      if (jitterAmount > 0) {
        const randX = hash2d(rowIndex, colIndex, 101) * 2 - 1; // -1 .. 1
        const randY = hash2d(rowIndex, colIndex, 202) * 2 - 1;
        jitX = randX * jitterAmount;
        jitY = randY * jitterAmount;
      }

      const posX = x + rowOffset + jitX;
      const posY = y + jitY;

      // Render setiap baris teks
      const totalBlockHeight = (lines.length - 1) * lineHeight;
      const blockStartY = posY - totalBlockHeight / 2;

      for (let l = 0; l < lines.length; l++) {
        const lineY = blockStartY + l * lineHeight;
        if (settings.strokeOutline) {
          ctx.strokeText(lines[l], posX, lineY);
        }
        ctx.fillText(lines[l], posX, lineY);
      }

      colIndex++;
    }
    rowIndex++;
  }

  ctx.restore();
}
