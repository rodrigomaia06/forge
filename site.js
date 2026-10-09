(() => {
  const button = document.querySelector('.theme-button');
  const sync = () => {
    const theme = document.documentElement.dataset.theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    button.textContent = `${next === 'dark' ? 'Dark' : 'Light'} theme`;
    button.setAttribute('aria-label', `Switch to ${next} theme`);
    document.querySelectorAll('[data-screen]').forEach((image) => {
      image.src = `assets/${image.dataset.screen}-${theme}.webp`;
    });
  };
  button.addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('forge-site-theme', theme);
    } catch {
      // The toggle works even when its preference cannot be saved.
    }
    sync();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (event) => {
    try {
      if (localStorage.getItem('forge-site-theme')) return;
    } catch {
      // Follow the system when storage is unavailable.
    }
    document.documentElement.dataset.theme = event.matches ? 'dark' : 'light';
    sync();
  });
  sync();
})();
