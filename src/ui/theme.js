/**
 * theme.js
 * Manajemen tema terang (kertas off-white) dan gelap (tinta gelap kebiruan).
 */

const THEME_KEY = 'tandain_theme';

export function initTheme() {
  const savedTheme = localStorage.getItem(THEME_KEY);
  let theme = savedTheme;
  if (theme !== 'dark' && theme !== 'light') {
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    theme = prefersDark ? 'dark' : 'light';
  }
  applyTheme(theme);
  return theme;
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
