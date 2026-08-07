(() => {
  const API = 'https://agci-equity-fundamentals.proadmexico.workers.dev';
  const LIST_KEY = 'agci:equity-intelligence:list:v1';
  const SNAP_KEY = 'agci:equity-performance:snapshots:v1';
  const META_KEY = 'agci:equity-performance:meta:v1';
  const MAX = 10;
  const REFRESH_MS = 8 * 60 * 60 * 1000;
  const DEFAULTS = ['AAPL','MSFT','AMZN','GOOGL','JPM','V','COST','LLY','XOM','NVDA'];

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
  const num = (v,d=1) => finite(v) ? Number(v).toFixed(d) : 'N/A';
  const pct = v => finite(v) ? `${(Math.abs(Number(v)) <= 2 ? Number(v)*100 : Number(v)).toFixed(1)}%` : 'N/A';
  const money = v => finite(v) ? `$${Number(v).toLocaleString('en-US',{maximumFractionDigits:2})}` : 'N/A';
  const read = (k,f) => { try { return JSON.parse(localStorage.getItem(k)) ?? f; } catch { return f; } };
  const normalize = values => [...new Set(values.map(v => String(v).trim().toUpperCase()).filter(v => /^[A-Z][A-Z0-9.-]{0,9}$/.test(v)))].slice(0,MAX);

  function list() {
    const own = read(LIST_KEY, []);
    const comp = read('agci:equity-comparator:v1', []);
    return normalize(own.length ? own : comp.length ? comp : DEFAULTS);
  }

  function saveList(values) {
    const clean = normalize(values);
    localStorage.setItem(LIST_KEY, JSON.stringify(clean));
    localStorage.setItem('agci:equity-comparator:v1', JSON.stringify(clean));
    return clean;
  }

  function delta(now, before) {
    if (!finite(now) || !finite(before) || Number(before) === 0) return null;
    return ((Number(now) / Number(before)) - 1) * 100;
  }

  function deltaHtml(v) {
    if (!finite(v)) return '<span class="eqp-na">N/A</span>';
    const cls = Number(v) > 0 ? 'up' : Number(v) < 0 ? 'down' : 'flat';
    const sign = Number(v) > 0 ? '+' : '';
    return `<span class="eqp-change ${cls}">${sign}${Number(v).toFixed(2)}%</span>`;
  }

  function ensurePanel() {
    const view = document.getElementById('equityIntelligence');
    if (!view || document.getElementById('eqpPanel')) return false;

    const badge = view.querySelector('.eqi-badge');
    if (badge) badge.innerHTML = '10 posiciones<br><strong>máximo</strong>';
    const intro = view.querySelector('.eqi-head p');
    if (intro) intro.textContent = 'Lista propia de hasta 10 acciones, desempeño de precio, ratios fundamentales y contraste con fuentes externas.';

    const panel = document.createElement('section');
    panel.id = 'eqpPanel';
    panel.className = 'eqp-panel';
    panel.innerHTML = `
      <div class="eqp-head">
        <div><p class="rubric">AGCI · 10 STOCK MONITOR</p><h3>Desempeño y ratios</h3><p>Seguimiento de hasta 10 acciones. El tablero revalida la información cada 8 horas, equivalente a tres ciclos diarios mientras el portal está en uso.</p></div>
        <div class="eqp-status"><span id="eqpDot"></span><strong id="eqpState">Pendiente</strong><small id="eqpUpdated">Sin actualización</small></div>
      </div>
      <div class="eqp-controls">
        <textarea id="eqpSymbols" rows="2" aria-label="Lista de hasta diez acciones" placeholder="AAPL, MSFT, AMZN..."></textarea>
        <button id="eqpRefresh" type="button">Actualizar ahora</button>
        <button id="eqpResetBase" type="button">Reiniciar base</button>
        <span id="eqpMessage" role="status"></span>
      </div>
      <div class="eqp-kpis" id="eqpKpis"></div>
      <div class="eqp-table-wrap" id="eqpTable"><p class="eqp-empty">Ingrese hasta 10 acciones y actualice el tablero.</p></div>
      <p class="eqp-note">Δ ciclo compara contra la lectura anterior. Δ seguimiento compara contra la primera lectura guardada en este navegador. Los precios y ratios dependen de la disponibilidad del servicio AGCI/Twelve Data/SEC.</p>`;

    const firstPanel = view.querySelector('.eqi-panel[data-eqi-panel="portfolio"]');
    if (firstPanel) firstPanel.prepend(panel); else view.appendChild(panel);

    const input = document.getElementById('eqpSymbols');
    input.value = list().join(', ');
    input.addEventListener('change', syncInputs);
    document.getElementById('eqpRefresh').addEventListener('click', () => refresh(true));
    document.getElementById('eqpResetBase').addEventListener('click', resetBase);

    const deepInput = document.getElementById('eqiSymbols');
    if (deepInput) {
      deepInput.value = list().join(', ');
      deepInput.addEventListener('change', () => {
        const clean = saveList(deepInput.value.split(/[\s,;]+/));
        deepInput.value = clean.join(', ');
        input.value = clean.join(', ');
      });
    }

    const deepAnalyze = document.getElementById('eqiAnalyze');
    if (deepAnalyze) deepAnalyze.addEventListener('click', syncInputs, true);

    const meta = read(META_KEY, {});
    if (!meta.lastRefresh || Date.now() - Number(meta.lastRefresh) >= REFRESH_MS) refresh(false);
    else {
      renderSaved();
      scheduleNext(Number(meta.lastRefresh));
    }
    return true;
  }

  function syncInputs() {
    const input = document.getElementById('eqpSymbols');
    const deepInput = document.getElementById('eqiSymbols');
    const source = input?.value || deepInput?.value || '';
    const clean = saveList(source.split(/[\s,;]+/));
    if (input) input.value = clean.join(', ');
    if (deepInput) deepInput.value = clean.join(', ');
    const msg = document.getElementById('eqpMessage');
    if (msg) msg.textContent = clean.length === MAX ? 'Lista completa: 10/10.' : `${clean.length}/10 acciones.`;
    return clean;
  }

  async function refresh(manual) {
    const symbols = syncInputs();
    if (!symbols.length) return;
    const button = document.getElementById('eqpRefresh');
    const state = document.getElementById('eqpState');
    const msg = document.getElementById('eqpMessage');
    if (button) button.disabled = true;
    if (state) state.textContent = 'Actualizando…';
    if (msg) msg.textContent = manual ? 'Consultando datos actuales…' : 'Actualización programada…';
    try {
      const response = await fetch(`${API}/compare?symbols=${encodeURIComponent(symbols.join(','))}`, {cache:'no-store'});
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !Array.isArray(payload.analyses)) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
      const snapshots = read(SNAP_KEY, {});
      const now = Date.now();
      payload.analyses.filter(a => a.company).forEach(a => {
        const price = a.company.price;
        const prev = snapshots[a.ticker] || {};
        snapshots[a.ticker] = {
          baseline: finite(prev.baseline) ? prev.baseline : price,
          previous: finite(prev.current) ? prev.current : price,
          current: price,
          updatedAt: now
        };
      });
      localStorage.setItem(SNAP_KEY, JSON.stringify(snapshots));
      localStorage.setItem(META_KEY, JSON.stringify({lastRefresh:now,payload}));
      render(payload, snapshots, now);
      scheduleNext(now);
      if (msg) msg.textContent = `${payload.analyses.filter(a=>a.company).length} acciones actualizadas.`;
    } catch (e) {
      if (state) state.textContent = 'No disponible';
      if (msg) msg.textContent = `No fue posible actualizar: ${e.message}`;
      renderSaved();
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderSaved() {
    const meta = read(META_KEY, {});
    if (meta.payload?.analyses) render(meta.payload, read(SNAP_KEY, {}), Number(meta.lastRefresh || 0));
  }

  function render(payload, snapshots, updatedAt) {
    const valid = payload.analyses.filter(a => a.company);
    const state = document.getElementById('eqpState');
    const updated = document.getElementById('eqpUpdated');
    const dot = document.getElementById('eqpDot');
    if (state) state.textContent = payload.isStale ? 'En caché' : 'Actualizado';
    if (updated) updated.textContent = updatedAt ? new Date(updatedAt).toLocaleString('es-MX') : 'Sin fecha';
    if (dot) dot.className = payload.isStale ? 'stale' : 'fresh';

    const changes = valid.map(a => delta(a.company.price, snapshots[a.ticker]?.previous)).filter(finite);
    const positive = changes.filter(v => Number(v) > 0).length;
    const avgScore = valid.length ? valid.reduce((s,a)=>s+Number(a.score?.total||0),0)/valid.length : 0;
    const avgMove = changes.length ? changes.reduce((a,b)=>a+Number(b),0)/changes.length : null;
    document.getElementById('eqpKpis').innerHTML = `
      <div><span>Acciones</span><strong>${valid.length}/10</strong></div>
      <div><span>Subiendo en ciclo</span><strong>${positive}</strong></div>
      <div><span>Δ promedio ciclo</span><strong>${finite(avgMove) ? `${avgMove>0?'+':''}${Number(avgMove).toFixed(2)}%` : 'N/A'}</strong></div>
      <div><span>Score promedio</span><strong>${num(avgScore,0)}</strong></div>`;

    document.getElementById('eqpTable').innerHTML = `<table class="eqp-table"><thead><tr>
      <th>Ticker</th><th>Precio</th><th>Δ ciclo</th><th>Δ seguimiento</th><th>P/E</th><th>P/S</th><th>EV/EBITDA</th><th>FCF Yield</th><th>Ingresos YoY</th><th>Margen op.</th><th>ROE</th><th>ROIC</th><th>Deuda/EBITDA</th><th>Score</th><th>Confianza</th>
      </tr></thead><tbody>${valid.map(a => row(a, snapshots[a.ticker] || {})).join('')}</tbody></table>`;
  }

  function row(a, snap) {
    const c = a.company, r = c.ratios || {}, g = c.growth || {};
    return `<tr><td><strong>${esc(a.ticker)}</strong><small>${esc(c.companyName)}</small></td><td>${money(c.price)}</td><td>${deltaHtml(delta(c.price,snap.previous))}</td><td>${deltaHtml(delta(c.price,snap.baseline))}</td><td>${num(r.peTTM)}</td><td>${num(r.priceToSales)}</td><td>${num(r.evEbitda)}</td><td>${pct(r.fcfYield)}</td><td>${pct(g.revenueYoY)}</td><td>${pct(r.operatingMargin)}</td><td>${pct(r.roe)}</td><td>${pct(r.roic)}</td><td>${num(r.netDebtToEbitda)}</td><td><strong>${num(a.score?.total,0)}</strong></td><td>${num(a.confidence,0)}%</td></tr>`;
  }

  function resetBase() {
    localStorage.removeItem(SNAP_KEY);
    localStorage.removeItem(META_KEY);
    const msg = document.getElementById('eqpMessage');
    if (msg) msg.textContent = 'Base de seguimiento reiniciada. La próxima lectura será el nuevo punto inicial.';
    refresh(true);
  }

  let timer;
  function scheduleNext(last) {
    clearTimeout(timer);
    const wait = Math.max(60000, REFRESH_MS - (Date.now() - last));
    timer = setTimeout(() => refresh(false), wait);
  }

  function init() {
    if (ensurePanel()) return;
    const observer = new MutationObserver(() => { if (ensurePanel()) observer.disconnect(); });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();