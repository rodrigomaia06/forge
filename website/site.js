(() => {
  const button = document.querySelector('.theme-button');
  const sync = () => {
    const theme = document.documentElement.dataset.theme;
    const next = theme === 'dark' ? 'light' : 'dark';
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'icon');
    icon.setAttribute('aria-hidden', 'true');
    const shape = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    shape.setAttribute('href', `assets/icons.svg#${next === 'dark' ? 'moon' : 'sun'}`);
    icon.append(shape);
    button.replaceChildren(icon);
    button.setAttribute('aria-label', `Switch to ${next} theme`);
    button.title = `Switch to ${next} theme`;
    document.querySelectorAll('[data-screen]').forEach((image) => {
      image.src = `assets/${image.dataset.screen}-${theme}.webp`;
    });
    document.dispatchEvent(new Event('forge-theme-change'));
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

  const gallery = document.querySelector('.gallery');
  const dialog = document.querySelector('.screen-dialog');
  if (!gallery || !dialog) return;

  const previous = document.querySelector('[data-gallery-prev]');
  const next = document.querySelector('[data-gallery-next]');
  const updateControls = () => {
    previous.disabled = gallery.scrollLeft <= parseFloat(getComputedStyle(gallery).paddingLeft) + 2;
    next.disabled = gallery.scrollLeft >= gallery.scrollWidth - gallery.clientWidth - 2;
  };
  const move = (direction) => {
    const figure = gallery.querySelector('figure');
    const step = figure.getBoundingClientRect().width + parseFloat(getComputedStyle(gallery).gap);
    gallery.scrollBy({
      left: direction * step,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  previous.addEventListener('click', () => move(-1));
  next.addEventListener('click', () => move(1));
  gallery.addEventListener('scroll', updateControls, { passive: true });
  window.addEventListener('resize', updateControls);
  gallery.addEventListener('keydown', (event) => {
    if (event.target !== gallery || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    move(event.key === 'ArrowRight' ? 1 : -1);
  });
  gallery.querySelectorAll('figure').forEach((figure) => {
    const image = figure.querySelector('img');
    const open = document.createElement('button');
    open.type = 'button';
    open.className = 'screenshot-open';
    open.setAttribute('aria-label', `View ${figure.querySelector('h3').textContent} screenshot`);
    image.before(open);
    const frame = document.createElement('span');
    frame.className = 'gallery-phone';
    const display = document.createElement('span');
    display.className = 'gallery-display';
    display.append(image);
    const bezel = document.createElement('img');
    bezel.className = 'iphone-bezel';
    bezel.src = 'assets/iphone-frame.webp';
    bezel.alt = '';
    bezel.width = 1311;
    bezel.height = 2708;
    bezel.loading = 'lazy';
    frame.append(display, bezel);
    open.append(frame);
    open.addEventListener('click', () => {
      const preview = dialog.querySelector('img');
      preview.dataset.screen = image.dataset.screen;
      preview.src = image.src;
      preview.alt = image.alt;
      dialog.querySelector('h2').textContent = figure.querySelector('h3').textContent;
      dialog.showModal();
    });
  });
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const bounds = dialog.getBoundingClientRect();
    if (
      event.clientX < bounds.left ||
      event.clientX > bounds.right ||
      event.clientY < bounds.top ||
      event.clientY > bounds.bottom
    )
      dialog.close();
  });
  document.querySelector('.gallery-controls').hidden = false;
  updateControls();
})();
