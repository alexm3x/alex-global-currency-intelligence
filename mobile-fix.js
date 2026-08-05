(() => {
  const body = document.body;
  const menuButton = document.querySelector('.menu-btn');
  const nav = document.querySelector('.main-nav');
  if (!menuButton || !nav) return;

  const marker = document.createElement('span');
  marker.setAttribute('aria-hidden', 'true');
  menuButton.textContent = '';
  menuButton.appendChild(marker);
  menuButton.setAttribute('aria-expanded', 'false');
  menuButton.setAttribute('aria-controls', 'mainNavigation');
  nav.id = nav.id || 'mainNavigation';

  function closeMenu() {
    body.classList.remove('mobile-menu-open');
    menuButton.setAttribute('aria-expanded', 'false');
  }

  function toggleMenu() {
    const open = body.classList.toggle('mobile-menu-open');
    menuButton.setAttribute('aria-expanded', String(open));
  }

  menuButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleMenu();
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('button, a')) closeMenu();
  });

  document.addEventListener('click', (event) => {
    if (body.classList.contains('mobile-menu-open') && !nav.contains(event.target) && !menuButton.contains(event.target)) closeMenu();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeMenu();
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 700) closeMenu();
  }, { passive: true });

  window.addEventListener('orientationchange', closeMenu, { passive: true });
})();
