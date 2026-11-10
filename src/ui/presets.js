/**
 * presets.js
 * Manajemen preset pengaturan watermark (Cap & Tinta).
 * ATURAN KEAMANAN: HANYA nilai pengaturan (teks, warna, opacity, sudut, dll.)
 * yang disimpan di localStorage. TIDAK PERNAH nama file, gambar, atau data sensitif.
 */

import { getTodayFormatted, DEFAULT_WATERMARK_SETTINGS } from '../core/watermark.js';

const STORAGE_KEY = 'tandain_presets';

export const BUILTIN_PRESETS = [
  {
    id: 'verif_bank',
    name: 'Verifikasi Bank',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `HANYA UNTUK VERIFIKASI BANK - ${getTodayFormatted()}`,
      pattern: 'tiled',
      fontSizePercent: 3.3,
      opacity: 0.32,
      color: '#C8372D', // Merah cap
      angle: -22,
      spacingXPercent: 26,
      spacingYPercent: 15,
      jitterPercent: 10
    }
  },
  {
    id: 'melamar_kerja',
    name: 'Melamar Kerja',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `HANYA UNTUK MELAMAR PEKERJAAN - ${getTodayFormatted()}`,
      pattern: 'tiled',
      fontSizePercent: 3.0,
      opacity: 0.28,
      color: '#1E3A8A', // Biru stempel dinas
      angle: -25,
      spacingXPercent: 28,
      spacingYPercent: 16,
      jitterPercent: 10
    }
  },
  {
    id: 'pendaftaran',
    name: 'Pendaftaran',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `SYARAT PENDAFTARAN - ${getTodayFormatted()}`,
      pattern: 'tiled',
      fontSizePercent: 3.0,
      opacity: 0.28,
      color: '#171922', // Tinta hitam
      angle: -28,
      spacingXPercent: 28,
      spacingYPercent: 16,
      jitterPercent: 8
    }
  },
  {
    id: 'cap_tengah',
    name: 'Cap Tengah',
    settings: {
      ...DEFAULT_WATERMARK_SETTINGS,
      text: `SALINAN RESMI\nVERIFIKASI ${getTodayFormatted()}`,
      pattern: 'single',
      fontSizePercent: 5.2,
      opacity: 0.38,
      color: '#C8372D', // Merah cap
      angle: -18,
      strokeOutline: true
    }
  }
];

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

export function saveCustomPreset(name, settings) {
  if (!name || !name.trim()) return false;

  const safeSettings = {
    text: String(settings.text || '').slice(0, 300),
    pattern: ['tiled', 'single', 'cross'].includes(settings.pattern) ? settings.pattern : 'tiled',
    fontSizePercent: Number(settings.fontSizePercent) || 3.2,
    color: String(settings.color || '#C8372D').slice(0, 20),
    opacity: Number(settings.opacity) || 0.3,
    angle: Number(settings.angle) || -25,
    spacingXPercent: Number(settings.spacingXPercent) || 28,
    spacingYPercent: Number(settings.spacingYPercent) || 16,
    jitterPercent: Number(settings.jitterPercent) || 10,
    staggerRows: Boolean(settings.staggerRows),
    strokeOutline: Boolean(settings.strokeOutline)
  };

  const newPreset = {
    id: 'custom_' + Date.now().toString(36),
    name: name.trim().slice(0, 40),
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
