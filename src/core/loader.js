/**
 * loader.js
 * Modul untuk membaca file (JPG, PNG, WEBP, PDF) sepenuhnya di memori.
 * Menggunakan createImageBitmap({ imageOrientation: 'from-image' }) agar rotasi EXIF foto HP konsisten.
 * Merender PDF per halaman menggunakan pdfjs-dist lokal.
 */

import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Set lokal worker URL tanpa CDN
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

/**
 * Muat gambar tunggal menggunakan createImageBitmap dengan orientasi EXIF
 * @param {Blob|File} file
 * @returns {Promise<ImageBitmap>}
 */
export async function loadImageBitmap(file) {
  try {
    // Standard modern API: auto-handles EXIF orientation
    if (typeof window.createImageBitmap === 'function') {
      return await window.createImageBitmap(file, {
        imageOrientation: 'from-image'
      });
    }
  } catch (err) {
    console.warn('createImageBitmap dengan imageOrientation gagal, mencoba fallback HTMLImageElement', err);
  }

  // Fallback via HTMLImageElement jika createImageBitmap gagal
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        if (typeof window.createImageBitmap === 'function') {
          const bmp = await window.createImageBitmap(img);
          resolve(bmp);
        } else {
          resolve(img);
        }
      } catch (e) {
        resolve(img);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Gagal memuat gambar'));
    };
    img.src = url;
  });
}

/**
 * Muat file PDF dan rasterisasi setiap halaman menjadi ImageBitmap
 * @param {File} file
 * @param {(progress: { current: number, total: number }) => void} [onProgress]
 * @returns {Promise<Array<{ pageNumber: number, width: number, height: number, bitmap: ImageBitmap }>>}
 */
export async function loadPdfPages(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({
    data: arrayBuffer,
    cMapUrl: undefined,
    cMapPacked: false,
    useSystemFonts: true
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;
  const pages = [];

  // Render scale: 2.0 untuk ketajaman tinggi dokumen
  const RENDER_SCALE = 2.0;

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: RENDER_SCALE });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const ctx = canvas.getContext('2d', { alpha: false });

    // Latar belakang putih standar dokumen PDF
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport
    }).promise;

    // Ubah canvas halaman menjadi ImageBitmap berkinerja tinggi
    const bitmap = await window.createImageBitmap(canvas);

    pages.push({
      pageNumber: i,
      width: canvas.width,
      height: canvas.height,
      bitmap: bitmap
    });

    // Bersihkan canvas sementara
    canvas.width = 0;
    canvas.height = 0;

    if (onProgress) {
      onProgress({ current: i, total: numPages });
    }
  }

  return pages;
}

/**
 * Memproses file yang diinput pengguna (gambar atau PDF)
 * @param {File} file
 * @param {(status: string) => void} [onStatus]
 * @returns {Promise<LoadedDocument>}
 */
export async function loadDocument(file, onStatus) {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const fileId = 'doc_' + Math.random().toString(36).slice(2, 10);

  if (isPdf) {
    if (onStatus) onStatus(`Membaca PDF: ${file.name}...`);
    const pages = await loadPdfPages(file, (p) => {
      if (onStatus) onStatus(`Merasterisasi halaman ${p.current} dari ${p.total}...`);
    });

    return {
      id: fileId,
      name: file.name,
      size: file.size,
      type: 'pdf',
      isPdf: true,
      pages: pages,
      activePageIndex: 0
    };
  } else {
    if (onStatus) onStatus(`Memuat gambar: ${file.name}...`);
    const bitmap = await loadImageBitmap(file);

    return {
      id: fileId,
      name: file.name,
      size: file.size,
      type: 'image',
      isPdf: false,
      width: bitmap.width,
      height: bitmap.height,
      bitmap: bitmap,
      pages: [
        {
          pageNumber: 1,
          width: bitmap.width,
          height: bitmap.height,
          bitmap: bitmap
        }
      ],
      activePageIndex: 0
    };
  }
}
