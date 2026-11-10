/**
 * presets.js
 * Manajemen preset pengaturan watermark.
 * ATURAN KEAMANAN: HANYA nilai pengaturan (teks, warna, opacity, sudut, dll.)
 * yang disimpan di localStorage. TIDAK PERNAH nama file, gambar, atau data sensitif.
 */

import { getTodayFormatted, DEFAULT_WATERMARK_SETTINGS } from '../core/watermark.js';

const STORAGE_KEY = 'tandain_presets';

export const BUILTIN_PRESETS = [
  {
    id: 'ktp_bank',
    name: 'KTP - Verifikasi Bank / Pinjaman',
    icon: '💳',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `HANYA UNTUK VERIFIKASI BANK - ${getTodayFormatted()}`,
      pattern: 'tiled',
      fontSizePercent: 3.2,
      opacity: 0.35,
      color: '#dc2626', // Merah tegas
      angle: -22,
      spacingXPercent: 26,
      spacingYPercent: 15,
      jitterPercent: 10
    }
  },
  {
    id: 'lamar_kerja',
    name: 'Ijazah & KK - Melamar Pekerjaan',
    icon: '💼',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `HANYA UNTUK MELAMAR PEKERJAAN - ${getTodayFormatted()}`,
      pattern: 'tiled',
      fontSizePercent: 3.0,
      opacity: 0.28,
      color: '#059669', // Emerald
      angle: -25,
      spacingXPercent: 28,
      spacingYPercent: 16,
      jitterPercent: 12
    }
  },
  {
    id: 'npwp_fintech',
    name: 'NPWP / E-Wallet / Fintech',
    icon: '📱',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `VERIFIKASI AKUN FINTECH - ${getTodayFormatted()}`,
      pattern: 'tiled',
      fontSizePercent: 3.2,
      opacity: 0.32,
      color: '#0284c7', // Biru laut
      angle: -25,
      spacingXPercent: 26,
      spacingYPercent: 15,
      jitterPercent: 12
    }
  },
  {
    id: 'pendaftaran_kampus',
    name: 'Pendaftaran Sekolah / Kampus',
    icon: '🎓',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `SYARAT PENDAFTARAN AKADEMIK - ${getTodayFormatted()}`,
      pattern: 'tiled',
      fontSizePercent: 2.8,
      opacity: 0.25,
      color: '#475569', // Abu-abu formal
      angle: -30,
      spacingXPercent: 30,
      spacingYPercent: 18,
      jitterPercent: 8
    }
  },
  {
    id: 'cap_tengah',
    name: 'Cap Tengah (Single Center)',
    icon: '🎯',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `DOKUMEN RESMI\nVERIFIKASI ${getTodayFormatted()}`,
      pattern: 'single',
      fontSizePercent: 5.5,
      opacity: 0.40,
      color: '#dc2626',
      angle: -20,
      strokeOutline: true
    }
  }
];

/**
 * Muat daftar preset (preset bawaan + preset kustom pengguna)
 */
export function getSavedPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [...BUILTIN_PRESETS];
    const custom = JSON.parse(raw);
    if (Array.isArray(custom)) {
      return [...BUILTIN_PRESETS, ...custom];
    }
  } catch (e) {
    console.warn('Gagal membaca preset dari localStorage:', e);
  }
  return [...BUILTIN_PRESETS];
}

/**
 * Simpan preset baru dari pengaturan saat ini
 */
export function saveCustomPreset(name, settings) {
  if (!name || !name.trim()) return false;

  const safeSettings = {
    text: String(settings.text || '').slice(0, 300),
    pattern: ['tiled', 'single', 'cross'].includes(settings.pattern) ? settings.pattern : 'tiled',
    fontSizePercent: Number(settings.fontSizePercent) || 3.2,
    color: String(settings.color || '#059669').slice(0, 20),
    opacity: Number(settings.opacity) || 0.3,
    angle: Number(settings.angle) || -25,
    spacingXPercent: Number(settings.spacingXPercent) || 28,
    spacingYPercent: Number(settings.spacingYPercent) || 16,
    jitterPercent: Number(settings.jitterPercent) || 12,
    staggerRows: Boolean(settings.staggerRows),
    strokeOutline: Boolean(settings.strokeOutline)
  };

  const newPreset = {
    id: 'custom_' + Date.now().toString(36),
    name: name.trim().slice(0, 50),
    icon: '⭐',
    settings: safeSettings,
    isCustom: true
  };

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const customPresets = raw ? JSON.parse(raw) : [];
    customPresets.push(newPreset);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
    return newPreset;
  } catch (e) {
    console.error('Gagal menyimpan preset ke localStorage:', e);
    return false;
  }
}

/**
 * Hapus preset kustom
 */
export function deleteCustomPreset(presetId) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    let customPresets = JSON.parse(raw);
    customPresets = customPresets.filter(p => p.id !== presetId);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(customPresets));
    return true;
  } catch (e) {
    return false;
  }
}
