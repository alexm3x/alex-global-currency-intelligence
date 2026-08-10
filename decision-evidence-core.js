const CIAR_POINTS = Object.freeze({
  'STRONG POSITIVE': 2,
  'POSITIVE': 1,
  'NEUTRAL POSITIVE': 0.5,
  'MIXED': 0,
  'NEUTRAL': 0,
  'NEGATIVE': -1,
  'STRONG NEGATIVE': -2
});

const BRIEFING_POINTS = Object.freeze({
  'COMPRAR EN TRAMOS': 2,
  'COMPRAR': 2,
  'COMPRAR EN CORRECCIÓN': 1,
  'MANTENER/VIGILAR': 0,
  'MANTENER': 0,
  'VIGILAR': 0,
  'REDUCIR': -1,
  'EVITAR': -2
});

const TICKER_ALIASES = Object.freeze({ GOOGL: ['GOOGL', 'GOOG'], GOOG: ['GOOG', 'GOOGL'] });

export function cleanTicker(value) {
  return String(value || '').trim().toUpperCase();
}

export function tickerVariants(value) {
  const ticker = cleanTicker(value);
  return TICKER_ALIASES[ticker] || [ticker];
}

export function daysBetween(dateValue, nowValue = new Date()) {
  const start = Date.parse(dateValue || '');
  const end = nowValue instanceof Date ? nowValue.getTime() : Date.parse(nowValue || '');
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.max(0, Math.floor((end - start) / 86400000));
}

export function findCiarRecord(ticker, ciar) {
  const variants = tickerVariants(ticker);
  const records = Array.isArray(ciar?.records) ? ciar.records : [];
  const exact = records.find(item => cleanTicker(item.ticker) === variants[0]);
  if (exact) return { ...exact, proxy: false, requestedTicker: cleanTicker(ticker) };
  const proxy = records.find(item => variants.slice(1).includes(cleanTicker(item.ticker)) || (item.proxyFor || []).some(value => cleanTicker(value) === cleanTicker(ticker)));
  return proxy ? { ...proxy, proxy: true, requestedTicker: cleanTicker(ticker) } : null;
}

export function analystEvidence(ticker, ciar, nowValue = new Date()) {
  const record = findCiarRecord(ticker, ciar);
  if (!record) return null;
  const ageDays = daysBetween(record.asOf, nowValue);
  const stale = ageDays === null || ageDays > Number(ciar?.windowDays || 45);
  const signalKey = String(record.signal || '').trim().toUpperCase();
  const points = stale ? 0 : (CIAR_POINTS[signalKey] ?? 0);
  return {
    available: true,
    stale,
    ageDays,
    points,
    signal: record.signal || 'N/D',
    bullishPct: Number.isFinite(Number(record.bullishPct)) ? Number(record.bullishPct) : null,
    consensusScore: Number.isFinite(Number(record.consensusScore)) ? Number(record.consensusScore) : null,
    netChange: Number.isFinite(Number(record.netChange)) ? Number(record.netChange) : null,
    totalAnalysts: Number.isFinite(Number(record.totalAnalysts)) ? Number(record.totalAnalysts) : null,
    asOf: record.asOf || null,
    sourceTicker: record.ticker,
    proxy: Boolean(record.proxy),
    proxyNote: record.proxy ? `${record.ticker} se usa como proxy del mismo emisor para ${cleanTicker(ticker)}; no se trata como dato idéntico de clase.` : null
  };
}

export function briefingEvidence(ticker, briefing) {
  const variants = tickerVariants(ticker);
  const equities = Array.isArray(briefing?.equities) ? briefing.equities : [];
  const item = equities.find(row => variants.includes(cleanTicker(row.ticker)));
  const watch = (Array.isArray(briefing?.watch) ? briefing.watch : []).filter(entry => variants.some(symbol => String(entry).toUpperCase().includes(symbol)));
  if (!item && !watch.length) return null;
  const classification = String(item?.classification || 'VIGILAR').trim().toUpperCase();
  return {
    available: true,
    points: BRIEFING_POINTS[classification] ?? 0,
    classification: item?.classification || 'VIGILAR',
    confidence: item?.confidence || null,
    thesis: item?.thesis || null,
    watch,
    date: briefing?.date || null,
    title: briefing?.title || null
  };
}

export function macroEvidence(macro, briefing) {
  if (!macro && !briefing) return null;
  const reasons = [];
  let points = 0;
  const risk = String(briefing?.risk || '').trim().toLowerCase();
  if (risk.includes('elev')) { points -= 1; reasons.push('Daily Briefing clasifica el riesgo agregado como elevado.'); }
  else if (risk.includes('moder')) { points -= 0.5; reasons.push('El riesgo agregado es moderado.'); }
  else if (risk.includes('baj')) { points += 0.5; reasons.push('El riesgo agregado es bajo.'); }

  const vix = macro?.risk || macro?.providers?.cboe?.data?.risk || null;
  const regime = String(vix?.regime || '').trim().toLowerCase();
  if (regime.includes('bajo')) { points += 0.5; reasons.push('VIX en régimen bajo frente a su media de 20 días.'); }
  else if (regime.includes('alto')) { points -= 0.5; reasons.push('VIX en régimen alto.'); }

  const us = macro?.economies?.US || null;
  return {
    available: Boolean(macro || briefing),
    points,
    risk: briefing?.risk || null,
    stance: briefing?.stance || null,
    vix: Number.isFinite(Number(vix?.vix)) ? Number(vix.vix) : null,
    vixAverage20: Number.isFinite(Number(vix?.average20)) ? Number(vix.average20) : null,
    vixRegime: vix?.regime || null,
    policyRateUS: Number.isFinite(Number(us?.policyRate?.value)) ? Number(us.policyRate.value) : null,
    generatedAt: macro?.generatedAt || null,
    reasons,
    signals: (Array.isArray(briefing?.threeSignals) ? briefing.threeSignals : []).slice(0, 3)
  };
}

export function contextLabel(points) {
  if (points >= 2.5) return 'Soporte fuerte';
  if (points >= 1) return 'Soporte';
  if (points > -1) return 'Mixto';
  if (points > -2) return 'Cautela';
  return 'Cautela alta';
}

export function executionGuidance(label) {
  if (label === 'Soporte fuerte') return 'Si el precio entra en terreno de compra, mantener ejecución por tramos según el sizing base; el contexto no justifica anticipar el precio.';
  if (label === 'Soporte') return 'El contexto acompaña la tesis. Ejecutar sólo dentro del terreno de compra y conservar disciplina de tramos.';
  if (label === 'Mixto') return 'No acelerar la entrada por narrativa. Exigir que precio, preparación y tesis sigan alineados antes de ejecutar.';
  if (label === 'Cautela') return 'Si el precio entra en terreno, usar una primera entrada más conservadora y revisar el catalizador pendiente antes de ampliar.';
  return 'No acelerar una entrada sólo porque la valoración parezca atractiva; priorizar resolución de riesgos y nueva evidencia.';
}

export function buildContextOverlay(ticker, { ciar, briefing, macro }, nowValue = new Date()) {
  const analyst = analystEvidence(ticker, ciar, nowValue);
  const briefingItem = briefingEvidence(ticker, briefing);
  const macroItem = macroEvidence(macro, briefing);
  const eventPenalty = briefingItem?.watch?.length ? -0.5 : 0;
  const contributors = [analyst, briefingItem, macroItem].filter(item => item?.available);
  const totalPoints = contributors.reduce((sum, item) => sum + Number(item.points || 0), 0) + eventPenalty;
  const label = contributors.length ? contextLabel(totalPoints) : 'Sin cobertura';
  return {
    ticker: cleanTicker(ticker),
    label,
    totalPoints: contributors.length ? Math.round(totalPoints * 10) / 10 : null,
    evidenceCount: contributors.length,
    analyst,
    briefing: briefingItem,
    macro: macroItem,
    eventPenalty,
    execution: contributors.length ? executionGuidance(label) : 'No hay evidencia contextual suficiente para modificar la ejecución base.',
    governance: {
      changesFairValue: false,
      changesBuyTerrain: false,
      changesBaseDecisionScore: false,
      principle: 'La Fase 3 agrega evidencia contextual; no reescribe precio, Fair Value ni terreno de compra.'
    }
  };
}
