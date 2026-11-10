# Tandain — Watermark & Sensor Dokumen Offline

Aplikasi utilitas dokumen yang tenang, presisi, dan aman dengan bahasa desain Apple Human Interface Guidelines (iOS / macOS modern) untuk menambahkan watermark dan sensor manual pada dokumen penting (KTP, KK, NPWP, ijazah).

100% Client-Side. Berjalan seutuhnya di peramban pengguna tanpa server backend dan tanpa ada file yang dikirim ke internet.

---

## Fitur & Desain Apple Human Interface Guidelines

- **100% Offline & Privat**: Menggunakan Content Security Policy (CSP) ketat dengan `connect-src 'none'`. Tidak ada request jaringan, API, analytics, maupun skrip eksternal.
- **Bahasa Desain Apple (macOS & iOS)**:
  - Tata letak desktop 3-pane macOS: toolbar atas transparan, sidebar daftar berkas (Finder style), area kerja pratinjau tengah, dan inspector kanan dengan kartu Inset Grouped ala Pengaturan iOS.
  - Palet netral bersih (#F5F5F7 terang, #000000 / #1C1C1E gelap) dengan aksen tunggal biru sistem (#007AFF terang / #0A84FF gelap).
  - Tipografi sistem Apple: `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter"` dengan angka tabular untuk presisi metrik.
  - Tanpa emoji, tanpa dekorasi berlebihan, tanpa landing page. Antarmuka langsung berupa alat kerja.
- **Dukungan Format Dokumen**: JPG, PNG, WEBP, dan PDF (termasuk navigasi halaman PDF multi-halaman).
- **Pemrosesan Batch**: Kelola banyak dokumen sekaligus di sidebar, unduh per berkas atau secara kolektif dalam arsip ZIP lokal (`JSZip`).
- **Pratinjau Real-Time**:
  - Mode Tampilan: Hasil, Sebelum, dan Pembagi Belah (Interactive Split Drag dengan handle iOS presisi).
  - Kontrol pembesaran (Zoom) dan undo/redo.
- **Pengaturan Watermark**:
  - Pilihan Preset Cepat (Verifikasi Bank, Melamar Kerja, Pendaftaran, Cap Tengah).
  - Masukan teks dengan aksi cepat "Tambah tanggal hari ini".
  - Slider Intensitas (mengatur ukuran dan transparansi bersamaan).
  - Pola: Penuh atau Tengah.
  - Pengaturan Lanjutan (Disclosure): Sudut, jarak horizontal/vertikal, acak posisi, palet warna, garis tepi teks, dan simpan preset kustom.
- **Sensor Manual (Redaction)**:
  - Gambar kotak sensor hitam langsung di atas area sensitif (seperti NIK atau nomor rekening).
  - Pindahkan, ubah ukuran, atau hapus kotak terpilih.
  - Dukungan penuh pintasan keyboard (Delete, Backspace, Ctrl+Z / Cmd+Z, Ctrl+Y).
- **Pembersihan Memori Lengkap**:
  - Dialog konfirmasi konfirmasi atur ulang ala iOS modal.
  - Memanggil `URL.revokeObjectURL`, mengosongkan canvas (`width = 0, height = 0`), dan melepaskan semua buffer dari RAM.
- **PWA & Responsif Mobile**:
  - Mendukung Progressive Web App (PWA) untuk instalasi di Android, iOS, Windows, dan macOS.
  - Di layar sentuh mobile, kontrol tersaji sebagai bottom sheet dengan grabber dan target sentuh minimal 44px.

---

## Jaminan Keamanan & Teknis

1. **Pratinjau = Hasil Ekspor**: Menggunakan satu fungsi unifikasi `renderWatermark(ctx, width, height, settings)`. Semua parameter teks, jarak, dan jitter dihitung relatif terhadap lebar dokumen (`% width`).
2. **Metadata EXIF Dihapus Otomatis**: Citra diproses ulang melalui kanvas murni sebelum diekspor, sehingga tag EXIF (lokasi GPS, tipe perangkat, waktu pemotretan) terhapus secara permanen.
3. **Orientasi EXIF Konsisten**: Menggunakan `createImageBitmap(file, { imageOrientation: 'from-image' })` agar rotasi foto tetap akurat.
4. **Perataan Permanen (Flattening)**: Watermark dan kotak sensor menyatu ke dalam piksel citra. Pada berkas PDF, setiap halaman dirasterisasi ke canvas beresolusi tinggi lalu disusun ulang menjadi PDF baru (`pdf-lib`), sehingga watermark bukan merupakan lapisan vektor terpisah yang bisa disembunyikan.

---

## Struktur Direktori

```
tandain/
├── public/
│   ├── icons/             # Ikon aplikasi (SVG, 192px, 512px)
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
│   │   └── main.css       # Desain Apple HIG (iOS / macOS modern)
│   ├── ui/
│   │   ├── preview.js     # Canvas preview & split slider Apple
│   │   ├── presets.js     # Manajemen preset aman di localStorage
│   │   └── theme.js       # Pengatur tema otomatis prefers-color-scheme
│   ├── sw.js              # Source Service Worker PWA
│   └── main.js
├── index.html             # Antarmuka macOS 3-pane & CSP ketat
└── package.json
```

---

## Lisensi & Privasi

Aplikasi ini bersifat bebas dan terbuka. Seluruh pemrosesan berlangsung secara lokal di peramban pengguna tanpa ada data yang meninggalkan perangkat.
