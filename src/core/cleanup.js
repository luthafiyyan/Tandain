/**
 * cleanup.js
 * Bertanggung jawab membersihkan memori, mencabut Object URL,
 * dan memastikan tidak ada data file yang tertinggal di memori browser.
 */

// Kumpulan URL blob yang pernah dibuat dalam sesi
const activeObjectUrls = new Set();

/**
 * Buat Object URL yang terdaftar untuk pelacakan dan pembersihan otomatis
 * @param {Blob|File} blob
 * @returns {string}
 */
export function createTrackedObjectURL(blob) {
  const url = URL.createObjectURL(blob);
  activeObjectUrls.add(url);
  return url;
}

/**
 * Cabut spesifik Object URL
 * @param {string} url
 */
export function revokeTrackedObjectURL(url) {
  if (url && activeObjectUrls.has(url)) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
    activeObjectUrls.delete(url);
  }
}

/**
 * Cabut semua Object URL yang sedang aktif
 */
export function revokeAllObjectURLs() {
  for (const url of activeObjectUrls) {
    try {
      URL.revokeObjectURL(url);
    } catch (_) {}
  }
  activeObjectUrls.clear();
}

/**
 * Kosongkan canvas secara menyeluruh (reset dimensi ke 0 dan clear rect)
 * @param {HTMLCanvasElement} canvas
 */
export function clearCanvas(canvas) {
  if (!canvas) return;
  try {
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  } catch (_) {}
  canvas.width = 0;
  canvas.height = 0;
}

/**
 * Tutup ImageBitmap jika ada
 * @param {ImageBitmap} bitmap
 */
export function closeBitmap(bitmap) {
  if (bitmap && typeof bitmap.close === 'function') {
    try {
      bitmap.close();
    } catch (_) {}
  }
}

/**
 * Bersihkan seluruh memori dokumen yang tersimpan
 * @param {Array<{ bitmap?: ImageBitmap, previewUrl?: string }>} items
 * @param {HTMLCanvasElement[]} canvases
 */
export function fullMemoryCleanup(items = [], canvases = []) {
  // 1. Tutup semua ImageBitmap
  if (Array.isArray(items)) {
    for (const item of items) {
      if (item) {
        if (item.bitmap) closeBitmap(item.bitmap);
        if (Array.isArray(item.pages)) {
          for (const page of item.pages) {
            if (page?.bitmap) closeBitmap(page.bitmap);
            if (page?.previewUrl) revokeTrackedObjectURL(page.previewUrl);
          }
        }
        if (item.previewUrl) revokeTrackedObjectURL(item.previewUrl);
      }
    }
  }

  // 2. Cabut semua URL object
  revokeAllObjectURLs();

  // 3. Reset semua canvas
  if (Array.isArray(canvases)) {
    for (const cvs of canvases) {
      clearCanvas(cvs);
    }
  }

  // 4. Pastikan storage bersih dari file data (hanya preset teks yang diizinkan)
  // Bersihkan data sementara yang mungkin tak sengaja tersimpan
  try {
    const allowedKeys = ['tandain_presets', 'tandain_theme', 'tandain_active_preset'];
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && !allowedKeys.includes(key)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
    sessionStorage.clear();
  } catch (_) {}
}
