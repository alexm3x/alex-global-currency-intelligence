(() => {
  'use strict';

  const root = document.documentElement;
  const motion = document.querySelector('.travel-motion');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const precisePointer = window.matchMedia('(pointer: fine)');
  let frame = 0;

  const primarySelector = [
    '.assistant-primary', '.asc-os-primary', '.asc-command-submit',
    '.stays-search__submit', '.multi-route-verify',
    'button[type="submit"]', 'a.bg-goldx', 'button.bg-goldx'
  ].join(',');
  const secondarySelector = [
    '.assistant-secondary', '.asc-os-secondary', '#refreshButton',
    '.multi-add-button', '.asc-compare-add'
  ].join(',');

  function classify(control) {
    control.classList.add('asc-depth-control');
    control.classList.toggle('asc-depth-control--primary', control.matches(primarySelector));
    control.classList.toggle('asc-depth-control--secondary', !control.matches(primarySelector) && control.matches(secondarySelector));
  }

  function decorate(scope = document) {
    if (scope.matches?.('button, a[role="button"], label.opportunity-file-button')) classify(scope);
    scope.querySelectorAll?.('button, a[role="button"], label.opportunity-file-button').forEach(classify);
    scope.querySelectorAll?.('.decision-viz, .metric-card, .result-card, .v3-panel').forEach(surface => surface.classList.add('asc-depth-surface'));
  }

  function syncMotionPreference() {
    root.dataset.ascMotion = reducedMotion.matches ? 'reduced' : 'full';
  }

  function updatePointer(event) {
    if (reducedMotion.matches || !precisePointer.matches || !motion) return;
    if (frame) cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      const x = (event.clientX / window.innerWidth) * 2 - 1;
      const y = (event.clientY / window.innerHeight) * 2 - 1;
      root.style.setProperty('--asc-glow-x', `${(x * -7).toFixed(1)}px`);
      root.style.setProperty('--asc-glow-y', `${(y * -5).toFixed(1)}px`);
      root.style.setProperty('--asc-globe-x', `${(x * 9).toFixed(1)}px`);
      root.style.setProperty('--asc-globe-y', `${(y * 6).toFixed(1)}px`);
      root.style.setProperty('--asc-codes-x', `${(x * -5).toFixed(1)}px`);
    });
  }

  root.classList.add('asc-visual-system');
  decorate();
  syncMotionPreference();

  new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
    if (node.nodeType === Node.ELEMENT_NODE) decorate(node);
  }))).observe(document.body, { childList: true, subtree: true });

  reducedMotion.addEventListener?.('change', syncMotionPreference);
  window.addEventListener('pointermove', updatePointer, { passive: true });
  document.addEventListener('visibilitychange', () => root.classList.toggle('asc-page-hidden', document.hidden));
})();
