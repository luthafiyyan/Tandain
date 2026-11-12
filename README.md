<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./public/icons/Tandain_logo_dark.png">
    <img src="./public/icons/Tandain_logo.png" width="320" alt="Tandain Logo" />
  </picture>
  <p><strong>Watermark & Sensor Dokumen Kependudukan 100% Offline: <em>Tandain dokumenmu, tanpa upload</em></strong></p>

  <p align="center">
    <a href="#"><img src="https://img.shields.io/badge/STATUS-PRODUCTION_READY-34C759?style=for-the-badge" alt="Status" /></a>
    <a href="#"><img src="https://img.shields.io/badge/ARCHITECTURE-100%25_CLIENT--SIDE-007AFF?style=for-the-badge" alt="Client Side" /></a>
    <a href="#"><img src="https://img.shields.io/badge/NETWORK-CONNECT--SRC_'NONE'-1D1D1F?style=for-the-badge" alt="CSP Strict" /></a>
    <a href="#"><img src="https://img.shields.io/badge/VITE-6.X-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite" /></a>
    <a href="#"><img src="https://img.shields.io/badge/PWA-100%25_OFFLINE-FF9500?style=for-the-badge" alt="PWA" /></a>
  </p>
  <p align="center">
    <a href="#"><img src="https://img.shields.io/badge/STORAGE-ZERO_PERSISTENCE-5856D6?style=for-the-badge" alt="Storage" /></a>
    <a href="#"><img src="https://img.shields.io/badge/TESTED_WITH-NODE_TESTS-30D158?style=for-the-badge" alt="Tests" /></a>
    <a href="#"><img src="https://img.shields.io/badge/DESIGN-NATURAL_STUDIO-0F172A?style=for-the-badge" alt="Design Natural Studio" /></a>
    <a href="#"><img src="https://img.shields.io/badge/LICENSE-MIT-8E8E93?style=for-the-badge" alt="License" /></a>
  </p>
</div>

---

## 📖 Tentang Tandain

**Tandain** adalah aplikasi web modern dan privat yang dirancang khusus untuk memfasilitasi pembubuhan tanda air (*watermark*) pengaman serta penyensoran manual (*redaction*) pada salinan dokumen kependudukan dan arsip penting (KTP, Kartu Keluarga, NPWP, ijazah, transkrip nilai, buku nikah, dan sertifikat).

Platform ini menggantikan kebiasaan menggunakan alat watermark daring konvensional yang mewajibkan pengguna mengunggah dokumen pribadi ke server pihak ketiga yang rentan terhadap kebocoran data (*data breach*) dan penyalahgunaan identitas untuk pinjaman daring ilegal. Dengan **Tandain**, seluruh siklus pemrosesan file berjalan **100% di memori perangkat pengguna (client-side)**. Dokumen Anda tidak pernah dikirim ke server mana pun, tidak memerlukan akun, dan sepenuhnya bebas dari pelacakan.

---

## ✨ Fitur Utama

- **Paritas Pratinjau 1:1 (Identik dengan Hasil Ekspor)**: Menggunakan satu mesin rendering unifikasi `renderWatermark`. Semua parameter ukuran huruf, jarak antar teks, dan variasi posisi (*jitter*) dihitung berbasis persentase relatif terhadap lebar dokumen (`% width`), bukan piksel tetap.
- **Sensor Manual (Redaction)**: Pengguna dapat menggambar kotak hitam pekat di atas data rahasia (seperti NIK atau nomor rekening). Kotak dapat digeser, disesuaikan ukurannya, dihapus, serta dilengkapi fitur *Undo* (`Ctrl+Z` / `Cmd+Z`) dan *Redo* (`Ctrl+Y`).
- **Penghapusan Metadata EXIF Otomatis**: Citra hasil foto kamera HP dirender ulang melalui canvas murni sebelum diekspor, sehingga data lokasi GPS, jenis perangkat, dan tanggal pemotretan otomatis terhapus secara permanen.
- **Perataan Piksel Permanen (Flattening)**: Tanda air dan sensor menyatu langsung ke piksel citra. Pada berkas PDF, tiap halaman dirasterisasi ke canvas beresolusi tinggi lalu disusun menjadi PDF baru (`pdf-lib`), sehingga watermark bukan merupakan lapisan teks terpisah yang bisa dihapus.
- **Preset Kebutuhan Standar**: Pilihan cepat sekali klik untuk berbagai keperluan:
  - *Verifikasi Bank*
  - *Melamar Kerja*
  - *Pendaftaran*
  - *Cap Tengah*
  - Dukungan menyimpan preset kustom sendiri ke penyimpanan pengaturan peramban.
- **Pengaturan Lanjutan yang Komprehensif**: Kustomisasi presisi mencakup sudut rotasi (-90° hingga +90°), tingkat transparansi/opasitas, kerapatan ubin (*spacing*), skala ukuran teks, pilihan warna stempel resmi (merah dinas, biru pengaman, hitam, custom picker), serta pilihan font lokal terintegrasi.
- **Mode Gelap & Terang Adaptif (Zero-FOUC)**: Aplikasi langsung membuka antarmuka dalam mode terang bersih tanpa jeda kedipan gelap (*no flash of dark mode*), disertai dukungan beralih ke mode gelap secara instan dan logo yang adaptif (teks navy di mode terang, teks putih di mode gelap).
- **Desain Mobile Responsif**: Navigasi alami di perangkat layar sentuh melalui bilah tindakan bawah (*bottom floating bar*), laci pengaturan modular (*bottom sheet*), dan target interaksi sentuh minimal 44 piksel.
- **Dukungan Format Luas**: Menerima format citra JPG, PNG, WEBP, serta berkas dokumen PDF multi-halaman dengan penomoran halaman (*pagination*) interaktif.
- **Pemrosesan Kolektif (Batch)**: Pilih banyak berkas sekaligus dan unduh satu per satu atau secara serentak dalam arsip berformat `.ZIP` (`JSZip`).
- **PWA & Beroperasi Penuh Tanpa Internet**: Aplikasi siap diinstal sebagai Progressive Web App di Android, iOS, Windows, dan macOS, serta tetap dapat digunakan saat perangkat berada dalam mode pesawat (*airplane mode*).

---

## 🔒 Arsitektur Keamanan & Zero-Network

Tandain dibangun di atas prinsip privasi paling ketat untuk melindungi integritas dokumen kependudukan:

### 1. Kebijakan Keamanan Konten (Content Security Policy)
Aplikasi mengunci akses jaringan melalui meta tag CSP ketat:
```html
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'none'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none';
```
> **Catatan Teknis**: Direktif `connect-src 'none'` memastikan bahwa peramban Anda secara mutlak menolak setiap upaya pengiriman data melalui `fetch`, `XMLHttpRequest`, `WebSocket`, analitik pihak ketiga, maupun skrip eksternal.

### 2. Siklus Hidup Memori Murni (Zero Storage)
- Berkas dokumen hanya didekode ke dalam RAM sebagai objek `ImageBitmap`.
- Aplikasi **tidak pernah** menyimpan dokumen, gambar, atau nama berkas di `localStorage`, `sessionStorage`, `IndexedDB`, maupun `CacheStorage`.
- `localStorage` hanya dipakai untuk menyimpan preferensi teks konfigurasi watermark dan pilihan tema.

### 3. Pembersihan Memori Total (Memory Hygiene)
Saat tombol **Atur ulang** ditekan atau dokumen dihapus:
- Memanggil `URL.revokeObjectURL()` pada seluruh objek blob yang pernah dibuat.
- Mengosongkan dimensi elemen canvas ke `width = 0, height = 0`.
- Memutus seluruh referensi array buffer untuk memfasilitasi *Garbage Collection* mesin JavaScript.

---

## 🎨 Bahasa Desain (Crafted Document Studio)

Antarmuka dirancang dengan estetika studio dokumen modern yang tenang, presisi, dan fungsional:

| Komponen | Implementasi Desain Utilitas |
| :--- | :--- |
| **Tata Letak Desktop** | Model studio 3 kolom fleksibel: Toolbar ringkas, Sidebar daftar dokumen aktif, Kanvas dokumen sentral dengan kontras latar meja kerja, dan Panel kontrol ergonomis di kanan. |
| **Keadaan Kosong (Empty State)** | Saat belum ada dokumen yang dimuat, dropzone menyambut pengguna dengan fokus penuh di tengah layar, lengkap dengan penjelas format dan jaminan privasi yang transparan. |
| **Tata Letak Mobile** | Pratinjau responsif adaptif dengan kontrol berbasis kartu sentuh yang ramah jari (target sentuh minimal 44 piksel). |
| **Warna Fungsional** | Palet slate netral dengan aksen stempel dinas merah terracotta (`#C8372D`) dan biru pengaman (`#1D4ED8` / `#3B82F6`) untuk aksi utama. |
| **Tipografi Presisi** | Font *Inter* untuk elemen antarmuka dan *JetBrains Mono* untuk angka tabular, sudut, dan persentase metrik. |
| **Aksesibilitas & Affordance** | Kursor pointer eksplisit pada seluruh kontrol interaktif, indikator fokus cincin kontras tinggi, dan kontras warna yang melampaui standar WCAG AA (4.5:1). |

---

## 🚀 Panduan Memulai Cepat

### Prasyarat
- [Node.js](https://nodejs.org/) (versi 18 ke atas disarankan)
- Peramban web modern yang mendukung HTML5 Canvas dan Web Workers

### 1. Klon Repositori
```bash
git clone https://github.com/luthafiyyan/Tandain.git
cd Tandain
```

### 2. Pasang Dependensi
```bash
npm install
```

### 3. Jalankan Server Pengembangan Lokal
```bash
npm run dev
```
Buka tautan lokal yang tampil di terminal (biasanya `http://localhost:5173`) pada peramban Anda.

### 4. Membangun Berkas Distribusi Produksi
```bash
npm run build
```
Hasil build produksi siap rilis akan disimpan di dalam direktori `dist/` dengan seluruh aset telah ter-bundle secara lokal.

### 5. Menjalankan Pratinjau Build Produksi
```bash
npm run preview
```

---

## 🧪 Pengujian Otomatis

Proyek ini dilengkapi rangkaian pengujian unit otomatis tanpa ketergantungan harness luar untuk memverifikasi fungsionalitas dan kepatuhan aturan keamanan:

```bash
# 1. Rangkaian uji fungsionalitas inti, paritas watermark, storage hygiene, dan audit CSP
node test/run-tests.js

# 2. Uji konsistensi densitas ubin watermark pada rasio landscape dan portrait
node test/test-aspect-ratio.js

# 3. Uji pembersihan segmen metadata EXIF (GPS, kamera, waktu)
node test/test-exif.js
```

### Matriks Pengujian:
- [x] **Watermark Parity**: Proporsi ukuran font dan kerapatan ubin identik antara canvas pratinjau dan hasil ekspor resolusi tinggi.
- [x] **Redaction Manager**: Koordinat normalisasi relatif `[0..1]`, manipulasi penambahan, seleksi, penggeseran, dan penghapusan kotak.
- [x] **PDF Flattening**: Validasi sintaks berkas PDF keluaran via `pdf-lib`.
- [x] **Batch ZIP Packaging**: Validasi integritas arsip ZIP multi-berkas via `JSZip`.
- [x] **Storage Hygiene**: Memastikan tidak ada sisa berkas dokumen yang tersimpan di penyimpanan lokal peramban.
- [x] **Audit CSP & Offline Assets**: Menjamin tidak ada permintaan HTTP/HTTPS ke server eksternal, Google Fonts, CDN, maupun analitik.

---

## 📁 Struktur Direktori

```
tandain/
├── public/
│   ├── icons/                  # Logo resmi, varian mode gelap, favicon, & ikon PWA
│   │   ├── Tandain_logo.png
│   │   ├── Tandain_logo_dark.png
│   │   ├── Tandain_Favicon.png
│   │   ├── icon-192.png
│   │   └── icon-512.png
│   ├── favicon.ico             # Favicon standar browser
│   ├── manifest.webmanifest    # Manifest konfigurasi PWA luring
│   ├── theme-init.js           # Skrip inisialisasi tema awal sinkron (Zero-FOUC)
│   └── sw.js                   # Service Worker precache lokal
├── src/
│   ├── core/
│   │   ├── cleanup.js          # Rutinitas pelepasan memori & storage hygiene
│   │   ├── exporter.js         # Generator ekspor PNG, JPG, PDF-lib, dan ZIP
│   │   ├── loader.js           # Pengurai berkas gambar & pdfjs-dist
│   │   ├── redact.js           # Mesin kotak sensor manual berkoordinat [0..1]
│   │   └── watermark.js        # Fungsi tunggal kalkulasi dan rendering watermark
│   ├── styles/
│   │   └── main.css            # Sistem token desain studio dokumen & tata letak responsif
│   ├── ui/
│   │   ├── presets.js          # Pengelola preset bawaan dan kustom lokal
│   │   ├── preview.js          # Pratinjau canvas, split handle, dan gestur sentuh
│   │   └── theme.js            # Sinkronisasi tema terang/gelap otomatis
│   ├── sw.js                   # Sumber injeksi Service Worker PWA
│   └── main.js                 # Pengendali alur antarmuka dan interaksi pengguna
├── test/
│   ├── run-tests.js            # Uji unit fungsional, CSP audit, dan hygiene
│   ├── test-aspect-ratio.js    # Uji konsistensi orientasi gambar
│   └── test-exif.js            # Uji sanitasi metadata EXIF
├── index.html                  # Antarmuka studio dokumen 3-kolom & meta CSP ketat
├── package.json
└── vite.config.js
```

---

## 👨‍💻 Pengembang

Aplikasi ini dikembangkan dan dirawat oleh **[Luthafiyyan](https://www.threads.com/@luthafiyyan_)**.

---

## 📄 Lisensi

Didistribusikan di bawah lisensi [MIT](LICENSE). Anda bebas menggunakan, memodifikasi, dan mendistribusikan perangkat lunak ini baik untuk keperluan pribadi maupun komersial.
