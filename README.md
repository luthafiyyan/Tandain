# Tandain

Utilitas web client-side untuk pembubuhan watermark berulang dan sensor manual (redaction) pada dokumen identitas penting (KTP, KK, NPWP, ijazah, transkrip nilai, dan sertifikat) dengan jaminan privasi 100% luring (offline) tanpa backend.

---

## Latar Belakang

Pencurian identitas dan penyalahgunaan salinan dokumen kependudukan untuk pinjaman daring tanpa izin maupun penipuan finansial merupakan risiko nyata. Membubuhkan tanda air (*watermark*) bertuliskan tujuan spesifik dan tanggal penggunaan, serta menyensor sebagian digit nomor identitas (seperti NIK atau nomor rekening), merupakan langkah mitigasi standar yang disarankan oleh otoritas perlindungan data pribadi.

Kebanyakan alat watermark daring yang tersedia saat ini mengharuskan pengguna mengunggah dokumen ke server pihak ketiga. Tandain dibangun dengan pendekatan **Zero-Network Architecture**: seluruh proses rendering, pembacaan, dan pembuatan berkas dilakukan langsung di memori perangkat pengguna melalui Web APIs standar.

---

## Prinsip Keamanan & Privasi

1. **Content Security Policy (CSP) Tanpa Koneksi Jaringan**
   Aplikasi menerapkan kebijakan keamanan peramban yang sangat ketat melalui meta tag:
   ```html
   default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self'; connect-src 'none'; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none';
   ```
   Direktif `connect-src 'none'` menjamin peramban memblokir seluruh upaya transmisi data melalui `fetch`, `XMLHttpRequest`, `WebSocket`, maupun `EventSource`.

2. **Siklus Hidup Data Berbasis RAM (Zero Storage)**
   - Berkas dokumen hanya didekode ke dalam memori kerja (RAM) sebagai objek `ImageBitmap`.
   - Tidak ada data dokumen, thumbnail, maupun nama berkas yang disimpan di `localStorage`, `sessionStorage`, `IndexedDB`, atau `CacheStorage`.
   - Penyimpanan lokal peramban hanya diizinkan untuk menyimpan preferensi konfigurasi watermark teks (tanpa keterkaitan dengan dokumen apa pun).

3. **Sanitasi Metadata EXIF Otomatis**
   Foto dokumen dari kamera telepon pintar sering kali memuat metadata sensitif seperti koordinat lokasi GPS, model perangkat, dan stempel waktu. Tandain membaca citra dengan orientasi EXIF yang tepat, lalu merender ulang dokumen secara utuh ke HTML5 Canvas baru sebelum ekspor, sehingga seluruh tag EXIF otomatis hilang dari berkas keluaran.

4. **Perataan Piksel Permanen (Flattening)**
   Tanda air dan kotak sensor hitam disatukan langsung ke matriks piksel citra. Untuk dokumen PDF, setiap halaman dirender ulang menjadi citra resolusi tinggi lalu disusun kembali menjadi berkas PDF baru melalui `pdf-lib`. Watermark dan sensor bukan merupakan lapisan teks atau vektor terpisah yang dapat dihapus menggunakan editor PDF standar.

5. **Pembersihan Memori Lengkap (Cleanup)**
   Saat tombol "Atur ulang" dikonfirmasi atau setelah dokumen ditutup, aplikasi memanggil `URL.revokeObjectURL()` pada seluruh URL blob, mengosongkan dimensi elemen canvas ke `0 × 0`, dan memutus semua referensi buffer memori untuk memfasilitasi pengumpulan sampah (*garbage collection*) oleh mesin JavaScript.

---

## Desain Antarmuka (Apple Human Interface Guidelines)

Antarmuka dirancang mengikuti estetika modern macOS dan iOS:

- **Tata Letak macOS 3-Pane (Desktop)**:
  - **Toolbar Atas**: Menggunakan material transparan (*backdrop-filter blur*), memuat judul aplikasi, indikator status privasi, pengendali mode kerja, serta aksi cepat unduh dan atur ulang.
  - **Sidebar Kiri (~240px)**: Navigasi daftar berkas dokumen aktif bergaya Finder, dilengkapi indikator jenis berkas dan tombol penambahan berkas.
  - **Area Panggung (Tengah)**: Area pratinjau dokumen netral dengan pembagi belah (*interactive split slider*) untuk membandingkan dokumen sebelum dan sesudah secara presisi.
  - **Inspector Kanan (~300px)**: Kartu pengaturan bertipe *Inset Grouped* ala Pengaturan iOS dengan baris-baris berpemisah tipis *hairline*.
- **Tata Letak iOS (Mobile)**:
  - Pratinjau dokumen di bagian atas dengan kontrol yang tersaji rapi dalam *Bottom Sheet Drawer* berfitur *grabber handle*.
  - Target sentuh minimal 44 piksel pada seluruh kontrol dan mematuhi margin area aman (*safe-area-inset*).
- **Palet Warna Netral & Presisi**:
  - Aksen tunggal Biru Sistem (`#007AFF` pada mode terang, `#0A84FF` pada mode gelap).
  - Permukaan netral (#F5F5F7 / #FFFFFF pada mode terang, #000000 / #2C2C2E pada mode gelap).
  - Sinkronisasi otomatis dengan preferensi tema sistem operasi (`prefers-color-scheme`) disertai tombol pengalihan manual.
- **Tipografi Sistem**:
  - Menggunakan font stack sistem `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", system-ui, sans-serif`.
  - Font Inter di-bundle secara mandiri melalui `@fontsource/inter` untuk memastikan tampilan konsisten di peramban non-Apple tanpa ketergantungan CDN eksternal.
  - Seluruh angka metrik dan nilai slider menggunakan `font-variant-numeric: tabular-nums`.

---

## Fitur Utama

- **Dukungan Format Lengkap**: Menerima berkas gambar (JPG, PNG, WEBP) dan dokumen PDF (termasuk navigasi halaman PDF multi-halaman).
- **Pemrosesan Kolektif (Batch Processing)**: Pengguna dapat memilih banyak berkas sekaligus, beralih antar dokumen secara langsung, serta mengunduh seluruh hasil akhir dalam arsip `.ZIP` tunggal.
- **Paritas Pratinjau vs Hasil Ekspor**: Menggunakan fungsi rendering tunggal `renderWatermark(ctx, width, height, settings)`. Seluruh proporsi ukuran huruf, spasi antarbaris, dan pergeseran acak (*jitter*) dihitung berbasis persentase relatif terhadap lebar dokumen (`% width`), bukan piksel statis.
- **Preset Kebutuhan Umum**:
  - Verifikasi Bank
  - Melamar Kerja
  - Pendaftaran
  - Cap Tengah
  - Kemampuan menyimpan preset kustom ke memori pengaturan lokal peramban.
- **Sensor Manual (Redaction)**: Pembuatan kotak hitam pekat di atas area data rahasia dengan dukungan penggeseran, penyesuaian ukuran (*resize*), penghapusan, dan pembatalan (*Undo* `Ctrl+Z` / *Redo* `Ctrl+Y`).
- **Progressive Web App (PWA)**: Terdaftar dengan Service Worker berbasis Workbox lokal untuk kemampuan instalasi dan operasional penuh saat perangkat berada dalam mode pesawat (*airplane mode*).

---

## Struktur Direktori

```
tandain/
├── public/
│   ├── icons/                  # Ikon aplikasi (SVG master, 192px, 512px)
│   ├── manifest.webmanifest    # Manifest konfigurasi PWA
│   └── sw.js                   # Service Worker precache offline
├── src/
│   ├── core/
│   │   ├── cleanup.js          # Rutinitas sanitasi memori dan storage hygiene
│   │   ├── exporter.js         # Generator ekspor PNG, JPG, PDF-lib, dan JSZip
│   │   ├── loader.js           # Pengurai berkas citra dan pdfjs-dist
│   │   ├── redact.js           # Manajemen koordinat sensor manual [0..1]
│   │   └── watermark.js        # Mesin kalkulasi dan rendering watermark tunggal
│   ├── styles/
│   │   └── main.css            # Sistem token desain Apple HIG (macOS & iOS)
│   ├── ui/
│   │   ├── presets.js          # Pengelola preset bawaan dan kustom
│   │   ├── preview.js          # Renderer canvas, interaksi sentuh, dan split handle
│   │   └── theme.js            # Sinkronisasi tema terang/gelap otomatis
│   ├── sw.js                   # Sumber injeksi Service Worker
│   └── main.js                 # Integrasi logika antarmuka dan kontrol aplikasi
├── test/
│   ├── run-tests.js            # Pengujian unit, audit CSP, dan hygiene storage
│   ├── test-aspect-ratio.js    # Pengujian konsistensi densitas pratinjau vs ekspor
│   └── test-exif.js            # Pengujian pembersihan tag metadata EXIF
├── index.html                  # Antarmuka utama dan deklarasi CSP ketat
├── package.json
└── vite.config.js
```

---

## Panduan Pemasangan & Pengembangan

### Prasyarat
- Node.js versi 18 atau yang lebih baru
- npm versi 9 atau yang lebih baru

### Instalasi Dependensi
```bash
npm install
```

### Menjalankan Server Pengembangan Lokal
```bash
npm run dev
```

### Membangun Berkas Distribusi Produksi
```bash
npm run build
```
Hasil kompilasi akan tersimpan di dalam direktori `dist/` dengan seluruh dependensi ter-bundle secara mandiri.

### Menjalankan Pratinjau Hasil Build
```bash
npm run preview
```

---

## Pengujian Otomatis

Proyek ini dilengkapi dengan skrip pengujian berbasis Node.js untuk memvalidasi integritas fungsi dan aturan keamanan tanpa memerlukan peramban eksternal:

```bash
# Menjalankan rangkaian pengujian inti (Watermark, Redaction, PDF, ZIP, Storage, CSP)
node test/run-tests.js

# Menjalankan pengujian konsistensi rasio aspek (Landscape & Portrait)
node test/test-aspect-ratio.js

# Menjalankan pengujian sanitasi metadata EXIF
node test/test-exif.js
```

Rangkaian pengujian mencakup:
- **Verifikasi Paritas Rendering**: Memastikan kerapatan ubin watermark pada canvas pratinjau berukuran kecil identik dengan kanvas ekspor beresolusi tinggi.
- **Audit CSP & Dependensi Eksternal**: Memverifikasi bahwa berkas kompilasi produksi `dist/index.html` dan `dist/assets/*.css` tidak memuat URL eksternal ke CDN, analitik, atau server fon pihak ketiga.
- **Audit Storage Hygiene**: Menjamin bahwa setelah operasi pembersihan dijalankan, tidak ada data dokumen atau nama berkas yang tertinggal di penyimpanan browser.

---

## Lisensi

Proyek ini didistribusikan di bawah lisensi MIT. Anda bebas menggunakan, memodifikasi, dan mendistribusikan perangkat lunak ini untuk keperluan pribadi maupun komersial.
