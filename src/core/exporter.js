/**
 * exporter.js
 * Modul untuk mengekspor dokumen yang sudah diratakan (flattened).
 * Metadata EXIF otomatis terhapus karena melalui rasterisasi ulang di Canvas.
 * Mendukung format PNG, JPG (kualitas 0.92), PDF (via pdf-lib), dan arsip ZIP (via JSZip).
 */

import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { renderWatermark } from './watermark.js';
import { renderRedactions } from './redact.js';
import { createTrackedObjectURL, revokeTrackedObjectURL, clearCanvas } from './cleanup.js';

/**
 * Konversi canvas menjadi Blob secara asynchronous
 * @param {HTMLCanvasElement} canvas
 * @param {string} mimeType
 * @param {number} [quality]
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Gagal mengonversi canvas ke blob'));
    }, mimeType, quality);
  });
}

/**
 * Trigger download file ke browser pengguna secara aman
 * @param {Blob} blob
 * @param {string} filename
 */
export function triggerDownload(blob, filename) {
  const url = createTrackedObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Bersihkan object URL setelah browser memulai download
  setTimeout(() => {
    revokeTrackedObjectURL(url);
  }, 3000);
}

/**
 * Render satu halaman dokumen resolusi penuh dengan redaction dan watermark
 * @param {Object} pageObj { bitmap, width, height }
 * @param {Array} redactionBoxes
 * @param {Object} watermarkSettings
 * @returns {Promise<HTMLCanvasElement>}
 */
export async function renderFullPageCanvas(pageObj, redactionBoxes, watermarkSettings) {
  // Tunggu font lokal siap
  if (document.fonts && document.fonts.ready) {
    await document.fonts.ready;
  }

  const canvas = document.createElement('canvas');
  canvas.width = pageObj.width;
  canvas.height = pageObj.height;
  const ctx = canvas.getContext('2d', { alpha: false });

  // 1. Gambar latar belakang (halaman asli tanpa EXIF)
  ctx.drawImage(pageObj.bitmap, 0, 0, canvas.width, canvas.height);

  // 2. Render kotak sensor (redaction) - isExport=true
  renderRedactions(ctx, canvas.width, canvas.height, redactionBoxes, null, true);

  // 3. Render watermark (fungsi tunggal yang sama persis dengan preview)
  renderWatermark(ctx, canvas.width, canvas.height, watermarkSettings);

  return canvas;
}

/**
 * Bersihkan ekstensi dari nama file asli
 */
function getBaseName(filename) {
  return filename.replace(/\.[^/.]+$/, '');
}

/**
 * Export dokumen tunggal
 * @param {LoadedDocument} doc
 * @param {RedactionManager} redactionManager
 * @param {Object} watermarkSettings
 * @param {'png'|'jpg'|'pdf'} format
 * @param {(progressText: string) => void} [onProgress]
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function exportDocument(doc, redactionManager, watermarkSettings, format = 'png', onProgress) {
  const baseName = getBaseName(doc.name);

  // Kasus PDF multi-halaman atau export ke format PDF
  if (format === 'pdf' || (doc.isPdf && doc.pages.length > 1)) {
    if (onProgress) onProgress(`Memproses PDF: ${doc.name}...`);
    const pdfDoc = await PDFDocument.create();

    for (let i = 0; i < doc.pages.length; i++) {
      if (onProgress) onProgress(`Merender halaman ${i + 1} dari ${doc.pages.length}...`);
      const page = doc.pages[i];
      const pageKey = `${doc.id}_p${i}`;
      const boxes = redactionManager.getBoxes(pageKey);

      const pageCanvas = await renderFullPageCanvas(page, boxes, watermarkSettings);

      // Konversi canvas halaman ke JPEG 0.92 buffer
      const jpgBlob = await canvasToBlob(pageCanvas, 'image/jpeg', 0.92);
      clearCanvas(pageCanvas);

      const jpgBuffer = await jpgBlob.arrayBuffer();
      const embeddedJpg = await pdfDoc.embedJpg(jpgBuffer);

      // Buat halaman PDF baru dengan ukuran yang sama persis
      const pdfPage = pdfDoc.addPage([page.width, page.height]);
      pdfPage.drawImage(embeddedJpg, {
        x: 0,
        y: 0,
        width: page.width,
        height: page.height
      });
    }

    const pdfBytes = await pdfDoc.save();
    const resultBlob = new Blob([pdfBytes], { type: 'application/pdf' });
    const filename = `${baseName}_watermarked.pdf`;

    return { blob: resultBlob, filename };
  }

  // Kasus Gambar Tunggal (atau halaman pertama jika bukan PDF)
  const page = doc.pages[0];
  const pageKey = `${doc.id}_p0`;
  const boxes = redactionManager.getBoxes(pageKey);

  if (onProgress) onProgress(`Merender ${doc.name}...`);
  const fullCanvas = await renderFullPageCanvas(page, boxes, watermarkSettings);

  let resultBlob;
  let filename;

  if (format === 'jpg') {
    resultBlob = await canvasToBlob(fullCanvas, 'image/jpeg', 0.92);
    filename = `${baseName}_watermarked.jpg`;
  } else {
    resultBlob = await canvasToBlob(fullCanvas, 'image/png');
    filename = `${baseName}_watermarked.png`;
  }

  clearCanvas(fullCanvas);
  return { blob: resultBlob, filename };
}

/**
 * Export kumpulan file (Batch) sebagai ZIP
 * @param {Array<LoadedDocument>} docs
 * @param {RedactionManager} redactionManager
 * @param {Object} watermarkSettings
 * @param {'png'|'jpg'|'pdf'} format
 * @param {(progressText: string, percent: number) => void} [onProgress]
 * @returns {Promise<Blob>}
 */
export async function exportBatchAsZip(docs, redactionManager, watermarkSettings, format = 'png', onProgress) {
  const zip = new JSZip();
  const total = docs.length;

  for (let i = 0; i < total; i++) {
    const doc = docs[i];
    if (onProgress) {
      const p = Math.round((i / total) * 90);
      onProgress(`Memproses (${i + 1}/${total}): ${doc.name}`, p);
    }

    const { blob, filename } = await exportDocument(doc, redactionManager, watermarkSettings, format);
    zip.file(filename, blob);
  }

  if (onProgress) onProgress('Mengompres arsip ZIP...', 95);
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  }, (metadata) => {
    if (onProgress) {
      onProgress(`Mengompres ZIP: ${Math.round(metadata.percent)}%`, 90 + Math.round(metadata.percent * 0.1));
    }
  });

  return zipBlob;
}
