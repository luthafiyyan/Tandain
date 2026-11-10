/**
 * theme.js
 * Manajemen tema gelap (Dark Mode), terang (Light Mode),
 * dan aksen palet visual modern (Emerald, Sapphire, Amethyst, Stealth).
 */

const THEME_KEY = 'tandain_theme';
const ACCENT_KEY = 'tandain_accent';

export const ACCENTS = [
  { id: 'emerald', name: 'Emerald Security', icon: '🛡️', color: '#10b981' },
  { id: 'sapphire', name: 'Cyber Sapphire', icon: '⚡', color: '#0ea5e9' },
  { id: 'amethyst', name: 'Amethyst Vault', icon: '🟣', color: '#a855f7' },
  { id: 'stealth', name: 'Stealth Slate', icon: '⬛', color: '#94a3b8' }
];

export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  let theme = savedTheme;
  if (theme !== 'dark' && theme !== 'light') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }
  applyTheme(theme);

  const savedAccent = localStorage.getItem(ACCENT_KEY) || 'emerald';
  applyAccent(savedAccent);

  return { theme, accent: savedAccent };
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (_) {}
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  return next;
}

export function applyAccent(accent) {
  const valid = ACCENTS.some(a => a.id === accent) ? accent : 'emerald';
  document.documentElement.setAttribute('data-accent', valid);
  try {
    localStorage.setItem(ACCENT_KEY, valid);
  } catch (_) {}
  return valid;
}
