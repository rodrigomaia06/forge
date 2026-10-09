(() => {
  let preference;
  try {
    preference = localStorage.getItem('forge-site-theme');
  } catch {
    // Browsers that block storage still get the system theme.
  }
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.dataset.theme =
    preference === 'dark' || preference === 'light' ? preference : systemDark ? 'dark' : 'light';
})();
