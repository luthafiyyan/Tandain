# Tandain 🖋️ — Cap & Sensor Dokumen 100% Offline

Aplikasi alat kerja praktis, aman, dan privat berkonsep **"Cap & Tinta"** untuk menambahkan watermark stempel resmi serta sensor manual (redaction) pada dokumen sensitif (KTP, KK, NPWP, Ijazah, dll).

**100% Client-Side. Berjalan seutuhnya di peramban pengguna tanpa server backend dan tanpa ada file yang diunggah ke internet.**

---

## ✨ Fitur & Konsep Desain "Cap & Tinta"

- 🔒 **100% Offline & Privat**: Menggunakan Content Security Policy (CSP) ketat dengan `connect-src 'none'`. Tidak ada request jaringan, API, analytics, maupun skrip eksternal.
- 🖋️ **Konsep Visual Cap & Tinta**:
  - Estetika kertas off-white hangat (`#F6F2EA`) dengan tinta hitam kebiruan dan aksen tunggal **merah cap stempel** (`#C8372D`).
  - Tipografi lokal: font display berkarakter **Fraunces**, sans-serif **Inter**, dan monospace **JetBrains Mono** via `@fontsource`.
  - Desain *Tool-First*: langsung menampilkan area kerja tanpa landing page atau brosur korporat.
- 🖼️ **Dukungan Format Lengkap**: JPG, PNG, WEBP, dan PDF (termasuk PDF multi-halaman).
- 📦 **Pemrosesan Batch**: Dukung banyak file sekaligus, unduh per dokumen atau sekaligus dalam arsip ZIP lokal (`JSZip`).
- 👁️ **Preview Real-Time Interaktif**:
  - Tampilan Hasil (Cap & Sensor)
  - Tampilan Dokumen Asli (Sebelum)
  - Mode Garis Belah Interaktif (drag langsung di atas canvas untuk membandingkan secara presisi)
  - Fitur Zoom In (+), Zoom Out (-), dan responsif terhadap layar sentuh / retina mobile.
- 🔤 **Pengaturan Cap Sederhana & Taktil**:
  - **Mode Cepat**: Chip preset (`Verifikasi Bank`, `Melamar Kerja`, `Pendaftaran`, `Cap Tengah`), tombol cepat `+ Tanggal hari ini`, dan satu slider terpadu `Tipis ↔ Tebal` (mengatur transparansi & ukuran font bersamaan).
  - **Pengaturan Lanjutan**: Sudut kemiringan, jarak X & Y, variasi posisi acak, palet tinta resmi, dan garis tepi teks.
- ⬛ **Sensor Manual (Redaction)**:
  - Buat kotak hitam pekat di atas data sensitif (seperti 6 digit terakhir NIK, tanggal lahir, nomor rekening).
  - Kotak dapat digeser, diubah ukurannya (resize), dan dihapus dengan mudah.
  - Dilengkapi sistem **Undo (`Ctrl+Z`)** & **Redo (`Ctrl+Y`)** serta tombol hapus cepat (`Delete` / `Backspace`).
- 💾 **Manajemen Preset Aman**:
  - Simpan dan muat preset gaya cap kustom di `localStorage` (hanya pengaturan teks/gaya, tidak pernah gambar atau nama file).
- 🧹 **Pembersihan Memori Lengkap**:
  - Tombol **Reset** memanggil `URL.revokeObjectURL`, mengosongkan canvas (`width = 0, height = 0`), dan melepaskan semua referensi buffer dari RAM.
- 📱 **PWA & Mobile-First**:
  - Siap di-install sebagai Progressive Web App (PWA) di Android, iOS, Windows, dan macOS.
  - Dukungan Mode Gelap (Dark Mode: tinta gelap kebiruan) dan Mode Terang (Light Mode: kertas hangat).

---

## 🛡️ Jaminan Keamanan & Teknis

1. **Preview = Hasil Ekspor**: Menggunakan SATU fungsi unifikasi `renderWatermark(ctx, width, height, settings)`. Seluruh ukuran font, jarak, dan jitter menggunakan persentase relatif terhadap lebar gambar (`% width`), bukan pixel tetap.
2. **Metadata EXIF Dihapus Otomatis**: Foto dari kamera smartphone dirender ulang melalui HTML5 Canvas murni sebelum diekspor, sehingga tag EXIF (lokasi GPS, tipe kamera, waktu pemotretan) hilang secara permanen.
3. **Orientasi EXIF Konsisten**: Memuat gambar dengan `createImageBitmap(file, { imageOrientation: 'from-image' })` agar rotasi foto HP tegak/miring tetap tepat.
4. **Flattening Permanen**: Hasil akhir diratakan ke pixel gambar. Untuk PDF, tiap halaman dirasterisasi ke canvas beresolusi tinggi lalu disusun menjadi PDF baru (`pdf-lib`), sehingga watermark dan kotak sensor menyatu permanen dan bukan layer vektor terpisah yang bisa disembunyikan.

---

## 📁 Struktur Direktori

```
tandain/
├── public/
│   ├── icons/             # Ikon PWA (SVG, 192px, 512px)
│   ├── manifest.webmanifest
│   └── sw.js              # Service Worker precache offline
├── src/
│   ├── core/
│   │   ├── cleanup.js     # Pembersihan memori & URL revocations
│   │   ├── exporter.js    # Ekspor PNG, JPG (0.92), PDF, & ZIP
│   │   ├── loader.js      # Baca gambar & PDF ke memori (pdfjs-dist)
│   │   ├── redact.js      # Sensor manual kotak relatif [0..1]
│   │   └── watermark.js   # Fungsi renderWatermark tunggal
│   ├── styles/
│   │   └── main.css       # Desain emerald modern & responsif
│   ├── ui/
│   │   ├── preview.js     # Canvas preview & interaksi sensor
│   │   ├── presets.js     # Manajemen preset aman di localStorage
│   │   └── theme.js       # Pengatur tema gelap / terang
│   ├── sw.js              # Source Service Worker PWA
│   └── main.js            # Entry point aplikasi
├── test/
│   ├── run-tests.js       # Pengujian otomatis seluruh modul
│   ├── test-exif.js       # Pengujian stripping metadata EXIF
│   └── test-aspect-ratio.js # Pengujian konsistensi preview vs export
├── index.html             # CSP Meta tag ketat
├── vite.config.js         # Konfigurasi Vite & PWA lokal
└── package.json
```

---

## 🚀 Menjalankan Proyek Secara Lokal

### Prasyarat
- Node.js (v18+)
- npm

### 1. Instal Dependensi
```bash
npm install
```

### 2. Jalankan Mode Pengembangan
```bash
npm run dev
```

Buka URL lokal yang muncul di terminal (misalnya `http://localhost:5173`).

### 3. Build untuk Produksi
```bash
npm run build
```

Hasil build yang siap di-deploy (misalnya ke GitHub Pages, Cloudflare Pages, atau dijalankan lokal via server offline) akan berada di folder `dist/`.

### 4. Menjalankan Pengujian Otomatis
```bash
node test/run-tests.js
node test/test-exif.js
node test/test-aspect-ratio.js
```

---

## 📜 Lisensi
Lisensi MIT — Bebas digunakan untuk keperluan pribadi maupun umum untuk menjaga privasi dokumen warga Indonesia.
