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
    id: 'ktp_verif',
    name: 'Verifikasi KTP / Bank',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `HANYA UNTUK VERIFIKASI BANK - ${getTodayFormatted()}`,
      fontSizePercent: 3.2,
      opacity: 0.32,
      color: '#dc2626', // Merah agar mencolok di KTP
      angle: -22
    }
  },
  {
    id: 'lamar_kerja',
    name: 'Melamar Pekerjaan',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `Hanya untuk melamar pekerjaan di [Nama Perusahaan] - ${getTodayFormatted()}`,
      fontSizePercent: 3.0,
      opacity: 0.28,
      color: '#059669', // Emerald
      angle: -25
    }
  },
  {
    id: 'pendaftaran',
    name: 'Pendaftaran Sekolah / Kampus',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `Syarat Pendaftaran Akademik - ${getTodayFormatted()}`,
      fontSizePercent: 3.0,
      opacity: 0.25,
      color: '#1d4ed8', // Biru
      angle: -30
    }
  },
  {
    id: 'npwp_fintech',
    name: 'NPWP / E-Wallet / Fintech',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `Verifikasi Akun Fintech - ${getTodayFormatted()}`,
      fontSizePercent: 3.4,
      opacity: 0.30,
      color: '#4b5563', // Abu-abu gelap
      angle: -25
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
 * @param {string} name Nama preset
 * @param {Object} settings Objek pengaturan watermark
 */
export function saveCustomPreset(name, settings) {
  if (!name || !name.trim()) return false;

  // Pastikan HANYA properti styling yang disimpan (sanitasi ketat)
  const safeSettings = {
    text: String(settings.text || '').slice(0, 300),
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
 * @param {string} presetId
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
