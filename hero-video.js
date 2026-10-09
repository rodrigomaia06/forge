(() => {
  const video = document.querySelector('.hero-video');
  const control = document.querySelector('.hero-video-control');
  const still = document.querySelector('.phone-screen img');
  if (!video || !control || !still) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let pausedByUser = false;
  let failed = false;
  let theme;
  const label = () => {
    control.textContent = video.paused ? 'Play video' : 'Pause video';
    control.setAttribute('aria-label', `${video.paused ? 'Play' : 'Pause'} workout preview`);
  };
  const fallback = () => {
    video.hidden = true;
    still.hidden = false;
  };
  const update = () => {
    if (motion.matches || failed) {
      video.pause();
      fallback();
      control.hidden = true;
      return;
    }
    const nextTheme = document.documentElement.dataset.theme;
    if (nextTheme !== theme) {
      theme = nextTheme;
      fallback();
      const format = video.canPlayType('video/mp4') ? 'mp4' : 'webm';
      video.src = `assets/hero-workout-${theme}.${format}`;
      video.load();
    }
    if (visible && !document.hidden && !pausedByUser) {
      video.muted = true;
      video.hidden = false;
      video.play().catch(() => {
        fallback();
        control.hidden = false;
        label();
      });
    } else video.pause();
    label();
  };
  video.addEventListener('playing', () => {
    if (motion.matches || failed) return;
    video.hidden = false;
    still.hidden = true;
    control.hidden = false;
    label();
  });
  video.addEventListener('pause', label);
  video.addEventListener('error', () => {
    failed = true;
    update();
  });
  control.addEventListener('click', () => {
    pausedByUser = !video.paused;
    update();
  });
  document.addEventListener('forge-theme-change', () => {
    failed = false;
    update();
  });
  document.addEventListener('visibilitychange', update);
  motion.addEventListener('change', update);
  new IntersectionObserver(
    ([entry]) => {
      visible = entry.isIntersecting;
      update();
    },
    { threshold: 0.15 },
  ).observe(document.querySelector('.phone-preview'));
})();
