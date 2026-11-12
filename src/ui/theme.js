/**
 * theme.js
 * Manajemen tema Tandain:
 * Default selalu terang (light mode) dengan dukungan toggle manual ke mode gelap.
 */

const THEME_KEY = 'tandain_theme';

export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  // Default selalu 'light' saat pertama kali dibuka, kecuali pernah diatur ke 'dark'
  const theme = savedTheme === 'dark' ? 'dark' : 'light';
  applyTheme(theme);
  return theme;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#0B0F19' : '#FFFFFF');
  }
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
