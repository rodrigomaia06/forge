(() => {
  const video = document.querySelector('.hero-video');
  const control = document.querySelector('.phone-screen');
  const still = document.querySelector('.phone-screen img');
  if (!video || !control || !still) return;

  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let visible = false;
  let pausedByUser = false;
  let failed = false;
  let theme;
  const label = () => {
    const action = `${video.paused ? 'Play' : 'Pause'} app preview`;
    control.setAttribute('aria-label', action);
    control.title = action;
  };
  const fallback = () => {
    video.hidden = true;
    still.hidden = false;
  };
  const update = () => {
    if (motion.matches || failed) {
      video.pause();
      fallback();
      control.disabled = true;
      return;
    }
    control.disabled = false;
    const nextTheme = document.documentElement.dataset.theme;
    if (nextTheme !== theme) {
      theme = nextTheme;
      fallback();
      const format = video.canPlayType('video/mp4') ? 'mp4' : 'webm';
      video.src = `assets/hero-iphone-tabs-${theme}.${format}`;
      video.load();
      video.defaultPlaybackRate = 1.5;
      video.playbackRate = 1.5;
    }
    if (visible && !document.hidden && !pausedByUser) {
      video.muted = true;
      video.hidden = false;
      video.play().catch(() => {
        fallback();
        control.disabled = false;
        label();
      });
    } else video.pause();
    label();
  };
  video.addEventListener('playing', () => {
    if (motion.matches || failed) return;
    video.hidden = false;
    still.hidden = true;
    control.disabled = false;
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
