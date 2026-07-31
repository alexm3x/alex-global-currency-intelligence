(() => {
  const WORKER_URL = 'https://agci-market-data.proadmexico.workers.dev/';
  const TOP20_ECONOMIES = new Set([
    'Estados Unidos','China','Alemania','Japón','India','Reino Unido','Francia','Italia',
    'Brasil','Canadá','Rusia','Corea del Sur','Australia','España','México','Indonesia',
    'Turquía','Países Bajos','Arabia Saudita','Suiza'
  ]);

  const nav = document.querySelector('.main-nav');
  if (nav && !nav.querySelector('[data-view="opportunities"]')) {
    const button = document.createElement('button');
    button.dataset.view = 'opportunities';
    button.textContent = 'Oportunidades';
    nav.insertBefore(button, nav.querySelector('[data-view="briefing"]'));
    button.addEventListener('click', () => setView('opportunities'));
  }

  const section = document.createElement('section');
  section.id = 'opportunities';
  section.className = 'view';
  section.innerHTML = `
    <div class="page-head">
      <p class="rubric">AGCI VALUE OPPORTUNITIES</p>
      <h2>Top 5 oportunidades de compra frente al dólar</h2>
      <p>Monedas de economías Top 20 que combinan infravaloración, fundamentos, riesgo aceptable y un punto de entrada no sobreextendido.</p>
    </div>
    <div class="opportunity-disclaimer">
      <strong>Modelo de oportunidad, no recomendación personalizada.</strong>
      Una moneda fuerte o con momentum elevado no se considera automáticamente una compra. El modelo exige margen de valoración y penaliza la sobreextensión.
    </div>
    <div class="opportunity-meta" id="opportunityMeta">Cargando datos de mercado…</div>
    <div class="opportunity-grid" id="opportunityGrid"></div>
    <article class="opportunity-method">
      <div>
        <p class="rubric">REVISED SELECTION ENGINE</p>
        <h3>Cómo se seleccionan</h3>
      </div>
      <div class="opportunity-formula">
        <span><b>45%</b> Infravaloración</span>
        <span><b>20%</b> Fundamentos</span>
        <span><b>15%</b> Riesgo</span>
        <span><b>10%</b> Momentum sostenible</span>
        <span><b>10%</b> Punto de entrada</span>
      </div>
      <p>Filtros previos: valoración mínima de 72, fundamentos mínimos de 55 y riesgo mínimo de 45. Se aplica una penalización adicional cuando el momentum supera 75 sin suficiente descuento de valoración. Una apreciación reciente fuerte frente al dólar reduce, en lugar de aumentar, la calidad del punto de entrada.</p>
    </article>`;
  document.querySelector('main').appendChild(section);

  function marketMoveVsUsd(quote) {
    if (!quote || !Number.isFinite(Number(quote.percentChange))) return null;
    const move = Number(quote.percentChange);
    return quote.symbol.endsWith('/USD') ? move : -move;
  }

  function uniqueEligibleCurrencies() {
    const byCode = new Map();
    DATA.filter(d => TOP20_ECONOMIES.has(d.country) && d.code !== 'USD').forEach(d => {
      const current = byCode.get(d.code);
      if (!current || d.score > current.score) byCode.set(d.code, d);
    });
    return [...byCode.values()];
  }

  function entryScore(move) {
    if (move === null) return 50;
    if (move > 0) return Math.max(15, 50 - move * 18);
    if (move >= -1.5) return Math.min(80, 60 + Math.abs(move) * 12);
    return Math.max(20, 80 - (Math.abs(move) - 1.5) * 22);
  }

  function sustainableMomentum(momentum) {
    if (momentum <= 65) return momentum;
    if (momentum <= 75) return 75 - (momentum - 65) * 0.5;
    return Math.max(35, 70 - (momentum - 75) * 2);
  }

  function overextensionPenalty(d, usdMove) {
    let penalty = 0;
    if (d.momentum > 75) penalty += (d.momentum - 75) * 0.9;
    if (d.valuation < 80 && d.momentum > 75) penalty += (80 - d.valuation) * 0.55;
    if (usdMove !== null && usdMove > 0.75) penalty += (usdMove - 0.75) * 8;
    return penalty;
  }

  function eligibilityReason(d) {
    if (d.valuation < 72) return 'Valoración insuficiente';
    if (d.fundamentals < 55) return 'Fundamentos débiles';
    if (d.risk < 45) return 'Riesgo excesivo';
    return null;
  }

  function render(quotes = [], updatedAt = null, nextUpdateAt = null) {
    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));
    const pairMap = {
      EUR:'EUR/USD', GBP:'GBP/USD', AUD:'AUD/USD', JPY:'USD/JPY', MXN:'USD/MXN',
      BRL:'USD/BRL', CNY:'USD/CNY', INR:'USD/INR', CAD:'USD/CAD', KRW:'USD/KRW',
      IDR:'USD/IDR', TRY:'USD/TRY', CHF:'USD/CHF', SAR:'USD/SAR', RUB:'USD/RUB'
    };

    const evaluated = uniqueEligibleCurrencies().map(d => {
      const quote = quoteMap.get(pairMap[d.code]);
      const usdMove = marketMoveVsUsd(quote);
      const entry = entryScore(usdMove);
      const momentumQuality = sustainableMomentum(d.momentum);
      const penalty = overextensionPenalty(d, usdMove);
      const exclusion = eligibilityReason(d);
      const opportunityScore =
        d.valuation * 0.45 +
        d.fundamentals * 0.20 +
        d.risk * 0.15 +
        momentumQuality * 0.10 +
        entry * 0.10 - penalty;
      return {...d, quote, usdMove, entry, momentumQuality, penalty, exclusion, opportunityScore};
    });

    const ranked = evaluated
      .filter(d => !d.exclusion && d.opportunityScore >= 60)
      .sort((a,b) => b.opportunityScore - a.opportunityScore)
      .slice(0,5);

    const grid = document.getElementById('opportunityGrid');
    if (!ranked.length) {
      grid.innerHTML = '<article class="opportunity-card"><h3>Sin oportunidades calificadas</h3><p>Ninguna moneda supera actualmente los filtros mínimos de valoración, fundamentos y riesgo.</p></article>';
    } else {
      grid.innerHTML = ranked.map((d,i) => {
        const moveText = d.usdMove === null ? 'Sin cotización conectada' : `${d.usdMove >= 0 ? '+' : ''}${d.usdMove.toFixed(2)}% vs USD`;
        const marketClass = d.usdMove === null ? 'neutral-market' : d.usdMove > 0.75 ? 'negative' : 'positive';
        const entryLabel = d.usdMove === null ? 'Datos parciales' : d.usdMove > 0.75 ? 'Entrada sobreextendida' : d.usdMove < -2 ? 'Caída excesiva' : 'Entrada aceptable';
        return `
          <article class="opportunity-card" data-currency="${d.country}">
            <div class="opportunity-rank">0${i+1}</div>
            <div class="opportunity-head">
              <div><span class="currency-code">${d.code}</span><small>${d.country} · ${d.currency}</small></div>
              <div class="opportunity-score"><span>Value opportunity</span><strong>${d.opportunityScore.toFixed(1)}</strong></div>
            </div>
            <h3>${d.signal}</h3>
            <p>${d.thesis || 'Oportunidad basada en valoración, fundamentos, riesgo y calidad del punto de entrada.'}</p>
            <div class="opportunity-metrics">
              <span><small>Valoración</small><b>${d.valuation}</b></span>
              <span><small>Fundamentos</small><b>${d.fundamentals}</b></span>
              <span><small>Riesgo</small><b>${d.risk}</b></span>
            </div>
            <div class="market-confirmation ${marketClass}"><span>${moveText}</span><b>${entryLabel}</b></div>
            <button type="button">Abrir ficha →</button>
          </article>`;
      }).join('');
    }

    const mxn = evaluated.find(d => d.code === 'MXN');
    const mxnNote = mxn?.exclusion
      ? `MXN excluido: ${mxn.exclusion}.`
      : mxn && mxn.penalty > 0
        ? `MXN penalizado por sobreextensión: ${mxn.penalty.toFixed(1)} puntos.`
        : '';

    const meta = document.getElementById('opportunityMeta');
    const updated = updatedAt ? new Date(updatedAt).toLocaleString('es-MX', {dateStyle:'medium', timeStyle:'short'}) : 'no disponible';
    const next = nextUpdateAt ? new Date(nextUpdateAt).toLocaleString('es-MX', {dateStyle:'medium', timeStyle:'short'}) : 'aprox. 6 horas';
    meta.innerHTML = `<span><b>Mercado actualizado:</b> ${updated}</span><span><b>Próxima actualización:</b> ${next}</span>${mxnNote ? `<span><b>Control conceptual:</b> ${mxnNote}</span>` : ''}`;
  }

  document.addEventListener('click', e => {
    const card = e.target.closest('.opportunity-card');
    if (card && card.dataset.currency && typeof openCurrency === 'function') openCurrency(card.dataset.currency);
  });

  fetch(WORKER_URL, {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => render(data.quotes || [], data.updatedAt, data.nextUpdateAt))
    .catch(() => render());
})();
