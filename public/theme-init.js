(function () {
  try {
    var saved = localStorage.getItem('tandain_theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', '#0B0F19');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
    }
  } catch (_) {}
})();
