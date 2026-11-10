/**
 * theme.js
 * Manajemen tema Apple Human Interface Guidelines:
 * Otomatis mengikuti prefers-color-scheme dengan dukungan toggle manual.
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

  // Dengarkan perubahan prefers-color-scheme otomatis
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Jika pengguna belum mengunci preferensi manual, ikuti sistem
      if (!localStorage.getItem(THEME_KEY)) {
        applyTheme(e.matches ? 'dark' : 'light');
      }
    });
  }

  return theme;
}

export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', theme === 'dark' ? '#1C1C1E' : '#F5F5F7');
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
