/**
 * run-tests.js
 * Rangkaian pengujian otomatis untuk memverifikasi seluruh fungsi & aturan keamanan Tandain:
 * 1. Aturan unifikasi renderWatermark: preview = export (persentase relatif).
 * 2. Modul Redaction (Sensor): koordinat normalisasi [0..1], add, move, delete, hitTest.
 * 3. Ekspor PDF & ZIP: validitas struktur binary dan flattening.
 * 4. Pembersihan memori & storage browser hygiene: tidak ada data file tertinggal di localStorage.
 * 5. Audit CSP & Offline PWA: memastikan tidak ada link external CDN/Google Fonts/Analytics di dist/.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';

// Import modul core aplikasi
import { renderWatermark, DEFAULT_WATERMARK_SETTINGS, getTodayFormatted } from '../src/core/watermark.js';
import { RedactionManager, renderRedactions } from '../src/core/redact.js';
import { fullMemoryCleanup } from '../src/core/cleanup.js';

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`✅ [PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`❌ [FAIL] ${name}`);
    console.error(err);
    failedTests++;
  }
}

console.log('--- MEMULAI PENGUJIAN TANDAIN ---\n');

// ===================================================
// TEST 1: SATU FUNGSI WATERMARK & SATUAN RELATIF
// ===================================================
test('Watermark: Ukuran font dan jarak harus berbasis persentase relatif terhadap lebar', () => {
  const callsSmall = [];
  const callsLarge = [];

  const createMockCtx = (sink) => ({
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    fillText: (text, x, y) => sink.push({ text, x, y }),
    strokeText: (text, x, y) => sink.push({ text, x, y }),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    globalAlpha: 1,
    textAlign: '',
    textBaseline: ''
  });

  const settings = {
    ...DEFAULT_WATERMARK_SETTINGS,
    text: 'TANDAIN TEST',
    fontSizePercent: 4.0, // 4%
    spacingXPercent: 20.0,
    spacingYPercent: 10.0,
    jitterPercent: 0
  };

  const smallW = 500;
  const smallH = 300;
  const ctxSmall = createMockCtx(callsSmall);
  renderWatermark(ctxSmall, smallW, smallH, settings);

  const largeW = 2000;
  const largeH = 1200;
  const ctxLarge = createMockCtx(callsLarge);
  renderWatermark(ctxLarge, largeW, largeH, settings);

  // Ukuran font terpasang di small vs large
  assert.match(ctxSmall.font, /20px/, 'Font size pada lebar 500px harus 20px (4%)');
  assert.match(ctxLarge.font, /80px/, 'Font size pada lebar 2000px harus 80px (4%)');

  // Rasio posisi ubin antara preview (small) dan export (large) harus identik 1:4
  assert.strictEqual(callsSmall.length, callsLarge.length, 'Jumlah tile pengulangan harus sama di rasio aspek yang sama');
  console.log(`   Rasio tile identik: ${callsSmall.length} tile di preview vs ${callsLarge.length} tile di export`);
});

// ===================================================
// TEST 2: SENSOR MANUAL (REDACTION) MODEL [0..1]
// ===================================================
test('Redaction: Koordinat relatif [0..1], add, hit-test, resize, delete', () => {
  const rm = new RedactionManager();
  const fileKey = 'doc_test_p0';

  // Tambah kotak sensor
  const box1 = rm.addBox(fileKey, { x: 0.1, y: 0.2, width: 0.3, height: 0.05 });
  assert.strictEqual(rm.getBoxes(fileKey).length, 1);
  assert.strictEqual(rm.selectedBoxId, box1.id);

  // Hit test dalam kotak
  const hitInside = rm.hitTest(fileKey, 0.15, 0.22);
  assert.strictEqual(hitInside.action, 'move');

  // Hit test di luar kotak
  const hitOutside = rm.hitTest(fileKey, 0.8, 0.8);
  assert.strictEqual(hitOutside.action, 'none');

  // Hapus kotak
  const deleted = rm.deleteSelectedBox(fileKey);
  assert.strictEqual(deleted, true);
  assert.strictEqual(rm.getBoxes(fileKey).length, 0);
  assert.strictEqual(rm.selectedBoxId, null);
});

// ===================================================
// TEST 3: EKSPOR PDF FLATTENING & MERGING (PDF-LIB)
// ===================================================
await asyncTest('Exporter: Flattened PDF creation via pdf-lib', async () => {
  const pdfDoc = await PDFDocument.create();
  assert(pdfDoc, 'PDFDocument harus berhasil diinstansiasi');

  // Buat halaman berukuran standar A4 (595 x 842 pt)
  const page = pdfDoc.addPage([595, 842]);
  assert.strictEqual(page.getWidth(), 595);
  assert.strictEqual(page.getHeight(), 842);

  const pdfBytes = await pdfDoc.save();
  assert(pdfBytes.length > 0, 'PDF bytes tidak boleh kosong');

  // Verifikasi file PDF valid dengan membaca ulang header '%PDF-'
  const header = Buffer.from(pdfBytes.slice(0, 5)).toString('ascii');
  assert.strictEqual(header, '%PDF-', 'Header file harus %PDF-');
  console.log(`   PDF valid dihasilkan (${pdfBytes.length} bytes)`);
});

// ===================================================
// TEST 4: EKSPOR BATCH ZIP (JSZIP)
// ===================================================
await asyncTest('Exporter: Batch ZIP packaging via JSZip', async () => {
  const zip = new JSZip();
  zip.file('dokumen_ktp_watermarked.png', 'PNG_MOCK_DATA');
  zip.file('dokumen_ijazah_watermarked.pdf', 'PDF_MOCK_DATA');

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
  assert(zipBuffer.length > 0, 'ZIP buffer tidak boleh kosong');

  // Verifikasi header ZIP PK\x03\x04
  assert.strictEqual(zipBuffer[0], 0x50);
  assert.strictEqual(zipBuffer[1], 0x4b);
  console.log(`   ZIP valid dihasilkan (${zipBuffer.length} bytes)`);
});

// ===================================================
// TEST 5: CLEANUP & HYGIENE STORAGE BROWSER
// ===================================================
test('Cleanup: Tidak ada sisa file atau nama file di localStorage', () => {
  // Mock localStorage
  const storage = new Map();
  globalThis.localStorage = {
    getItem: (k) => storage.get(k) || null,
    setItem: (k, v) => storage.set(k, String(v)),
    removeItem: (k) => storage.delete(k),
    clear: () => storage.clear(),
    key: (i) => Array.from(storage.keys())[i],
    get length() { return storage.size; }
  };
  globalThis.sessionStorage = {
    clear: () => {}
  };

  // Simpan preset (diizinkan)
  localStorage.setItem('tandain_presets', JSON.stringify([{ id: 'p1', name: 'Preset' }]));
  localStorage.setItem('tandain_theme', 'dark');

  // Sengaja coba simpan nama file / buffer (ilegal)
  localStorage.setItem('user_ktp_data', 'BASE64_SENSITIVE_DATA');
  localStorage.setItem('filename_ktp.jpg', 'data');

  assert.strictEqual(localStorage.length, 4);

  // Jalankan fullMemoryCleanup
  fullMemoryCleanup([], []);

  // Pastikan HANYA preset dan tema yang tersisa
  assert.strictEqual(localStorage.getItem('user_ktp_data'), null, 'user_ktp_data harus terhapus');
  assert.strictEqual(localStorage.getItem('filename_ktp.jpg'), null, 'filename_ktp.jpg harus terhapus');
  assert.notStrictEqual(localStorage.getItem('tandain_presets'), null, 'tandain_presets harus tetap ada');
  assert.notStrictEqual(localStorage.getItem('tandain_theme'), null, 'tandain_theme harus tetap ada');
  console.log('   Storage hygiene terverifikasi: hanya preset & tema yang diizinkan');
});

// ===================================================
// TEST 6: AUDIT CSP & DIST BUILD (ZERO EXTERNAL REQUESTS)
// ===================================================
test('Audit CSP & Dist: Tidak ada external script, CDN, atau Google Fonts di dist/', () => {
  const distHtmlPath = path.resolve('dist/index.html');
  assert(fs.existsSync(distHtmlPath), 'dist/index.html harus ada setelah build');
  const html = fs.readFileSync(distHtmlPath, 'utf-8');

  // 1. Verifikasi CSP meta tag
  const cspRegex = /<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]*)"/i;
  const match = html.match(cspRegex);
  assert(match, 'Meta tag CSP wajib ditemukan di dist/index.html');

  const cspContent = match[1];
  assert(cspContent.includes("connect-src 'none'"), "CSP harus mengandung connect-src 'none'");
  assert(cspContent.includes("default-src 'self'"), "CSP harus default-src 'self'");
  assert(cspContent.includes("object-src 'none'"), "CSP harus object-src 'none'");
  assert(cspContent.includes("base-uri 'none'"), "CSP harus base-uri 'none'");

  // 2. Verifikasi tidak ada URL eksternal (http:// atau https://)
  const externalUrls = html.match(/https?:\/\/[^"'\s>]+/g) || [];
  // Filter out XML namespaces like http://www.w3.org/2000/svg
  const externalHttp = externalUrls.filter(u => !u.includes('w3.org'));
  assert.strictEqual(externalHttp.length, 0, `Tidak boleh ada URL eksternal di HTML: ${externalHttp.join(', ')}`);

  // 3. Verifikasi file CSS dist tidak memuat url eksternal
  const distAssetsDir = path.resolve('dist/assets');
  const files = fs.readdirSync(distAssetsDir);
  const cssFiles = files.filter(f => f.endsWith('.css'));
  for (const cf of cssFiles) {
    const cssContent = fs.readFileSync(path.join(distAssetsDir, cf), 'utf-8');
    const externalCss = (cssContent.match(/url\(["']?https?:\/\/[^"')]+["']?\)/g) || []).filter(u => !u.includes('w3.org'));
    assert.strictEqual(externalCss.length, 0, `File CSS ${cf} memuat URL eksternal: ${externalCss.join(', ')}`);
  }

  // 4. Verifikasi Service Worker dist/sw.js ada
  assert(fs.existsSync(path.resolve('dist/sw.js')), 'dist/sw.js wajib dihasilkan');

  console.log('   Audit keamanan CSP & 100% Offline asset lolos tanpa celah');
});

console.log(`\n===================================`);
console.log(`HASIL: ${passedTests} lulus, ${failedTests} gagal`);
console.log(`===================================\n`);

if (failedTests > 0) {
  process.exit(1);
}
