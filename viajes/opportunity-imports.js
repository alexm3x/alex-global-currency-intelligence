(() => {
  'use strict';

  const buttons = [...document.querySelectorAll('[data-workspace-tab]')];
  const panel = document.getElementById('opportunityImportPanel');
  const grid = document.getElementById('opportunityImportGrid');
  const status = document.getElementById('opportunityImportStatus');
  const updated = document.getElementById('opportunityUpdatedAt');
  const fileInput = document.getElementById('opportunityHtmlInput');
  if (!buttons.length || !panel || !grid) return;

  const workspacePanels = new Map(
    [...document.querySelectorAll('[data-workspace-panel]')].map(section => [section.dataset.workspacePanel, section])
  );
  const dashboardSections = [...document.querySelectorAll('main > section')].filter(section => !section.dataset.workspacePanel);
  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]);
  const numericPrice = value => {
    const normalized = String(value ?? '').replace(/[^\d.,-]/g, '').trim();
    if (!normalized) return null;
    const comma = normalized.lastIndexOf(',');
    const dot = normalized.lastIndexOf('.');
    let canonical = normalized;
    if (comma > dot) canonical = normalized.replace(/\./g, '').replace(',', '.');
    else canonical = normalized.replace(/,/g, '');
    const price = Number(canonical);
    return Number.isFinite(price) ? price : null;
  };
  const formatPrice = value => value == null ? 'Precio por verificar' : new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 2
  }).format(value);

  function switchTab(name) {
    const selected = name === 'intelligence' || workspacePanels.has(name) ? name : 'intelligence';
    buttons.forEach(button => {
      const active = button.dataset.workspaceTab === selected;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-selected', String(active));
    });
    dashboardSections.forEach(section => section.classList.toggle('hidden', selected !== 'intelligence'));
    workspacePanels.forEach((section, key) => section.classList.toggle('hidden', key !== selected));
    localStorage.setItem('viajesASCWorkspaceTab', selected);
    window.dispatchEvent(new CustomEvent('viajes:workspace', { detail: { name: selected } }));
  }

  function normalizeRows(payload) {
    const rows = Array.isArray(payload) ? payload : payload?.items;
    return (Array.isArray(rows) ? rows : []).map((row, index) => ({
      name: String(row.name || row.nombre || `Oportunidad ${index + 1}`),
      price: numericPrice(row.price ?? row.precio),
      rating_or_airline: String(row.rating_or_airline || row.calificacion_aerolinea || row.rating || row.airline || 'Por verificar'),
      url: String(row.url || row.enlace || '#'),
      source: String(row.source || row.fuente || 'HTML importado')
    }));
  }

  function render(rows, metadata = {}) {
    const safeRows = normalizeRows(rows);
    status.textContent = safeRows.length ? `${safeRows.length} oportunidad(es) disponibles` : 'No hay oportunidades importadas todavía';
    updated.textContent = metadata.generated_at ? `Actualizado ${new Date(metadata.generated_at).toLocaleString('es-MX')}` : 'Carga local / sin fecha';
    grid.innerHTML = safeRows.map((row, index) => {
      const safeUrl = /^https?:\/\//i.test(row.url) ? row.url : '#';
      return `<article class="opportunity-import-card">
        <div class="opportunity-import-card__top"><span>OFERTA ${String(index + 1).padStart(2, '0')}</span><b>${escapeHtml(row.source)}</b></div>
        <h2>${escapeHtml(row.name)}</h2>
        <strong class="opportunity-import-price">${formatPrice(row.price)}</strong>
        <p>${escapeHtml(row.rating_or_airline)}</p>
        <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" aria-disabled="${safeUrl === '#'}">Verificar oferta <span aria-hidden="true">↗</span></a>
      </article>`;
    }).join('') || '<div class="opportunity-import-empty"><strong>Lista preparada</strong><span>Ejecute el importador diario o seleccione un archivo HTML local para mostrar oportunidades.</span></div>';
    localStorage.setItem('viajesASCImportedOpportunities', JSON.stringify({ items: safeRows, generated_at: metadata.generated_at || new Date().toISOString() }));
  }

  function rowsFromHtml(html) {
    const documentNode = new DOMParser().parseFromString(html, 'text/html');
    return [...documentNode.querySelectorAll('[data-opportunity], .opportunity, .listing, .offer')].map(card => {
      const link = card.querySelector('a[href]');
      const pick = (attribute, selectors) => card.getAttribute(attribute)
        || selectors.map(selector => card.querySelector(selector)?.textContent?.trim()).find(Boolean);
      return {
        name: pick('data-name', ['[data-name]', '.name', '.title', 'h2', 'h3']),
        price: pick('data-price', ['[data-price]', '.price', '.amount']),
        rating_or_airline: pick('data-rating', ['[data-rating]', '.rating', '.airline']),
        url: card.getAttribute('data-url') || link?.href || '#',
        source: 'HTML local'
      };
    }).filter(row => row.name);
  }

  async function loadPublished() {
    try {
      const response = await fetch(`data/data_dashboard.json?t=${Date.now()}`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      render(payload.items || payload, payload);
    } catch (error) {
      const cached = JSON.parse(localStorage.getItem('viajesASCImportedOpportunities') || 'null');
      render(cached?.items || [], cached || {});
      status.textContent += ' · datos locales';
    }
  }

  buttons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.workspaceTab)));
  fileInput?.addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rows = rowsFromHtml(await file.text());
      if (!rows.length) throw new Error('No se localizaron ofertas con los selectores configurados.');
      render(rows, { generated_at: new Date().toISOString() });
      status.textContent = `${rows.length} oportunidad(es) importadas desde ${file.name}`;
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = '';
    }
  });

  switchTab(localStorage.getItem('viajesASCWorkspaceTab') || 'intelligence');
  loadPublished();
})();

(() => {
  'use strict';
  const load = (src, marker, errorMessage) => {
    if (document.querySelector(`script[${marker}]`)) return;
    const script = document.createElement('script');
    script.src = src;
    script.setAttribute(marker, 'true');
    script.addEventListener('error', () => console.error(errorMessage));
    document.body.appendChild(script);
  };
  load('asc-global-experience.js', 'data-asc-global-experience', 'Viajes ASC: no fue posible cargar la capa global de experiencia.');
  load('asc-travel-os.js', 'data-asc-travel-os', 'Viajes ASC: no fue posible cargar Travel DNA / Copilot / Compare.');
  load('asc-intelligence-command.js', 'data-asc-intelligence-command', 'Viajes ASC: no fue posible cargar Intelligence / Command Center / Monitoring.');
})();
