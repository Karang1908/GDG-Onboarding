/* Theme toggle. The <html data-theme> attribute is set by a blocking inline
   script in each page's <head>, so this file only has to wire the control. */
(function () {
  const KEY = 'gdg-theme';
  const root = document.documentElement;
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;

  function paint() {
    const dark = root.getAttribute('data-theme') === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    btn.setAttribute(
      'aria-label',
      dark ? 'Switch to light theme' : 'Switch to dark theme'
    );
    btn.querySelector('.icon-sun').classList.toggle('hidden', !dark);
    btn.querySelector('.icon-moon').classList.toggle('hidden', dark);
  }

  btn.addEventListener('click', () => {
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    root.setAttribute('data-theme', next);
    try {
      localStorage.setItem(KEY, next);
    } catch (e) {
      /* private mode - theme just won't persist */
    }
    paint();
    // Let the wheel repaint: its colours are read from CSS custom properties.
    window.dispatchEvent(new CustomEvent('themechange'));
  });

  paint();
})();
