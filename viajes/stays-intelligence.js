(function () {
  'use strict';

  if (window.__VIAJES_ASC_STAYS_INTELLIGENCE__) return;
  window.__VIAJES_ASC_STAYS_INTELLIGENCE__ = true;

  var panel = document.getElementById('smartStaysPanel');
  var form = document.getElementById('staysSearchForm');
  var cardsHost = document.getElementById('staysTopCards');
  var tableBody = document.getElementById('staysTableBody');
  if (!panel || !form || !cardsHost || !tableBody) return;

  var DATA_URL = 'data/stays-demo.json';
  var CACHE_KEY = 'viajesASCStaysDemoCache';
  var SAVED_KEY = 'viajesASCStaysSaved';
  var ALERTS_KEY = 'viajesASCStaysAlerts';
  var MANUAL_KEY = 'viajesASCManualStays';
  var state = {
    payload: null,
    rows: [],
    filtered: [],
    saved: new Set(JSON.parse(localStorage.getItem(SAVED_KEY) || '[]')),
    alerts: new Set(JSON.parse(localStorage.getItem(ALERTS_KEY) || '[]'))
  };

  var byId = function (id) { return document.getElementById(id); };
  var clamp = function (value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, Number(value) || 0)); };
  var escapeHtml = function (value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (character) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character];
    });
  };
  var parseDate = function (value) {
    if (!value) return null;
    var bits = value.split('-').map(Number);
    return bits.length === 3 ? new Date(bits[0], bits[1] - 1, bits[2], 12, 0, 0) : null;
  };
  var isoDate = function (date) {
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
  };
  var addDays = function (date, days) {
    var copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  };
  var getNights = function () {
    var start = parseDate(byId('stayCheckIn').value);
    var end = parseDate(byId('stayCheckOut').value);
    if (!start || !end) return 30;
    return Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000));
  };

  function setDefaultDates() {
    if (byId('stayCheckIn').value && byId('stayCheckOut').value) return;
    var start = addDays(new Date(), 60);
    start.setHours(12, 0, 0, 0);
    byId('stayCheckIn').value = isoDate(start);
    byId('stayCheckOut').value = isoDate(addDays(start, 30));
    byId('stayCheckOut').min = isoDate(addDays(start, 1));
  }

  function fxRate(currency) {
    var rates = state.payload && state.payload.meta && state.payload.meta.fxRatesPerUSD;
    return Number(rates && rates[currency]) || 1;
  }

  function selectedCurrency() {
    return byId('stayCurrency').value || 'MXN';
  }

  function formatMoney(usdValue) {
    var currency = selectedCurrency();
    var converted = (Number(usdValue) || 0) * fxRate(currency);
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: currency === 'JPY' ? 0 : 0
    }).format(converted);
  }

  function budgetInUSD() {
    var amount = Number(byId('stayBudget').value);
    return Number.isFinite(amount) && amount > 0 ? amount / fxRate(selectedCurrency()) : 0;
  }

  function labelForScore(score) {
    if (score >= 90) return 'Oportunidad excepcional';
    if (score >= 80) return 'Excelente calidad/precio';
    if (score >= 70) return 'Buena oportunidad';
    if (score >= 60) return 'Precio razonable';
    return 'No recomendada';
  }

  function computeOffer(source) {
    var nights = getNights();
    var unitNights = Number(state.payload && state.payload.meta && state.payload.meta.pricingUnitNights) || 30;
    var scale = nights / unitNights;
    var basePrice = (Number(source.basePrice) || 0) * scale;
    var cleaningFee = Number(source.cleaningFee) || 0;
    var serviceFee = (Number(source.serviceFee) || 0) * scale;
    var taxes = (Number(source.taxes) || 0) * scale;
    var resortFee = (Number(source.resortFee) || 0) * scale;
    var parkingFee = (Number(source.parkingFee) || 0) * scale;
    var mandatoryFees = Number(source.mandatoryFees) || 0;
    var discount = (Number(source.discount) || 0) * scale;
    var pointsValue = byId('stayBonvoy').checked ? (Number(source.pointsValue) || 0) * scale : 0;
    var totalPrice = Math.max(0, basePrice + cleaningFee + serviceFee + taxes + resortFee + parkingFee + mandatoryFees - discount - pointsValue);
    var marketMedian = (Number(source.marketMedian) || totalPrice) * scale;
    var savingsAmount = marketMedian - totalPrice;
    var savingsPercent = marketMedian > 0 ? savingsAmount / marketMedian * 100 : 0;
    var priceScore = clamp(50 + savingsPercent * 2.5, 0, 100);
    var qualityScore = clamp(((Number(source.rating) || 0) / 5 * 55) + ((Number(source.qualityConsistency) || 0) * .45), 0, 100);
    var freshnessScore = source.verifiedAt ? 88 : clamp((Number(source.confidence) || 0) * 100 - 12, 0, 100);
    var score = priceScore * .30
      + qualityScore * .20
      + clamp(source.locationScore, 0, 100) * .15
      + clamp(source.feeScore, 0, 100) * .15
      + clamp(source.cancellationScore, 0, 100) * .10
      + freshnessScore * .10;
    var verifiedRecently = Boolean(source.verifiedAt) && Date.now() - new Date(source.verifiedAt).getTime() <= 43200000;
    var superOpportunity = savingsPercent >= 15
      && Number(source.rating) >= 4.5
      && !(source.risks || []).some(function (risk) { return /cargo|fee.*desconoc|sin identificar/i.test(risk); })
      && verifiedRecently
      && source.availabilityStatus === 'confirmed';
    return Object.assign({}, source, {
      nights: nights,
      basePriceCalculated: basePrice,
      cleaningFeeCalculated: cleaningFee,
      serviceFeeCalculated: serviceFee,
      taxesCalculated: taxes,
      resortFeeCalculated: resortFee,
      parkingFeeCalculated: parkingFee,
      mandatoryFeesCalculated: mandatoryFees,
      discountCalculated: discount,
      pointsValueCalculated: pointsValue,
      totalPriceCalculated: totalPrice,
      effectiveNightlyPriceCalculated: totalPrice / nights,
      marketMedianCalculated: marketMedian,
      savingsAmountCalculated: savingsAmount,
      savingsPercentCalculated: savingsPercent,
      ascStayScoreCalculated: Math.round(score),
      opportunityLabelCalculated: superOpportunity ? 'Súper oportunidad' : labelForScore(score),
      superOpportunity: superOpportunity
    });
  }

  function hydrateRows() {
    var published = Array.isArray(state.payload && state.payload.items) ? state.payload.items : [];
    var manual = JSON.parse(localStorage.getItem(MANUAL_KEY) || '[]');
    state.rows = published.concat(Array.isArray(manual) ? manual : []).map(computeOffer);
  }

  function matchesFilters(row) {
    var destination = byId('stayDestination').value.trim().toLowerCase();
    var haystack = [row.destination, row.neighborhood, row.propertyName].join(' ').toLowerCase();
    if (destination && !haystack.includes(destination)) return false;
    if (Number(row.guests) < Number(byId('stayGuests').value || 1)) return false;
    if (Number(row.bedrooms) < Number(byId('stayBedrooms').value || 0)) return false;
    if (Number(row.rating) < Number(byId('stayQuality').value || 0)) return false;
    if (byId('stayCancellation').value === 'flexible' && row.cancellationPolicy !== 'flexible') return false;
    var budget = budgetInUSD();
    if (budget && row.totalPriceCalculated > budget) return false;
    var amenities = Array.isArray(row.amenities) ? row.amenities : [];
    var required = [
      ['stayKitchen', 'kitchen'],
      ['stayLaundry', 'laundry'],
      ['stayParking', 'parking'],
      ['stayBeach', 'beach']
    ];
    return required.every(function (entry) { return !byId(entry[0]).checked || amenities.includes(entry[1]); });
  }

  function sortRows(rows) {
    var sort = byId('staysSort').value;
    return rows.sort(function (a, b) {
      if (sort === 'total') return a.totalPriceCalculated - b.totalPriceCalculated;
      if (sort === 'night') return a.effectiveNightlyPriceCalculated - b.effectiveNightlyPriceCalculated;
      if (sort === 'rating') return Number(b.rating) - Number(a.rating);
      return b.ascStayScoreCalculated - a.ascStayScoreCalculated;
    });
  }

  function uniquePick(candidates, used) {
    var found = candidates.find(function (row) { return !used.has(row.offerId); });
    if (found) used.add(found.offerId);
    return found;
  }

  function shortlist(rows) {
    if (!rows.length) return [];
    var used = new Set();
    var byTotal = rows.slice().sort(function (a, b) { return a.totalPriceCalculated - b.totalPriceCalculated; });
    var byValue = rows.slice().sort(function (a, b) { return b.ascStayScoreCalculated - a.ascStayScoreCalculated; });
    var byLong = rows.slice().sort(function (a, b) {
      var aScore = Number(a.feeScore) + a.savingsPercentCalculated;
      var bScore = Number(b.feeScore) + b.savingsPercentCalculated;
      return bScore - aScore;
    });
    var byFlexible = rows.filter(function (row) { return row.cancellationPolicy === 'flexible'; }).sort(function (a, b) { return b.cancellationScore - a.cancellationScore; });
    var byPoints = rows.filter(function (row) { return Number(row.pointsValue) > 0 || /Marriott/i.test(row.source); }).sort(function (a, b) { return b.pointsValueCalculated - a.pointsValueCalculated || b.ascStayScoreCalculated - a.ascStayScoreCalculated; });
    var picks = [
      { category: 'Mejor costo total', row: uniquePick(byTotal, used) },
      { category: 'Mejor calidad/precio', row: uniquePick(byValue, used) },
      { category: 'Mejor larga estancia', row: uniquePick(byLong, used) },
      { category: 'Mejor cancelación flexible', row: uniquePick(byFlexible.length ? byFlexible : byValue, used) },
      { category: 'Mejor oportunidad con puntos', row: uniquePick(byPoints.length ? byPoints : byValue, used) }
    ];
    return picks.filter(function (item) { return item.row; });
  }

  function groupCount(row) {
    return state.rows.filter(function (candidate) { return candidate.propertyId === row.propertyId; }).length;
  }

  function riskCopy(row) {
    var risks = Array.isArray(row.risks) ? row.risks : [];
    return risks.length ? risks.slice(0, 2).join(' · ') : 'Sin riesgos adicionales declarados';
  }

  function sourceUrl(row) {
    return /^https:\/\//i.test(row.sourceUrl || '') ? row.sourceUrl : '#';
  }

  function cardHtml(item) {
    var row = item.row;
    var count = groupCount(row);
    var saved = state.saved.has(row.offerId);
    var alerted = state.alerts.has(row.offerId);
    var reason = row.savingsPercentCalculated > 0
      ? formatMoney(row.savingsAmountCalculated) + ' debajo de su mediana comparable (' + row.savingsPercentCalculated.toFixed(1) + '%).'
      : 'La calidad compensa parcialmente un costo por encima de la mediana.';
    return [
      '<article class="stay-card" data-offer-id="' + escapeHtml(row.offerId) + '">',
      '<div class="stay-card__visual"><span>Imagen no disponible · demo</span></div>',
      '<div class="stay-card__body">',
      '<p class="stay-card__category">' + escapeHtml(item.category) + '</p>',
      '<h3>' + escapeHtml(row.propertyName) + '</h3>',
      '<p class="stay-card__location">' + escapeHtml(row.neighborhood) + ' · ' + escapeHtml(row.source) + (count > 1 ? ' · ' + count + ' plataformas' : '') + '</p>',
      '<div class="stay-card__score"><span>' + escapeHtml(row.opportunityLabelCalculated) + '</span><strong>' + row.ascStayScoreCalculated + '</strong></div>',
      '<div class="stay-card__price"><span>Costo total real · ' + row.nights + ' noches</span><strong>' + formatMoney(row.totalPriceCalculated) + '</strong><small>' + formatMoney(row.effectiveNightlyPriceCalculated) + ' por noche · ★ ' + Number(row.rating).toFixed(1) + ' demo</small></div>',
      '<p class="stay-card__reason">' + escapeHtml(reason) + '</p>',
      '<p class="stay-card__risk">Revisar: ' + escapeHtml(riskCopy(row)) + '</p>',
      '<div class="stay-card__actions">',
      '<a href="' + escapeHtml(sourceUrl(row)) + '" target="_blank" rel="noopener noreferrer" aria-disabled="' + (sourceUrl(row) === '#') + '">Verificar en la fuente ↗</a>',
      '<button type="button" data-stay-compare="' + escapeHtml(row.offerId) + '">Comparar</button>',
      '<button type="button" data-stay-save="' + escapeHtml(row.offerId) + '" class="' + (saved ? 'is-saved' : '') + '">' + (saved ? 'Guardada' : 'Guardar') + '</button>',
      '<button type="button" data-stay-alert="' + escapeHtml(row.offerId) + '" class="' + (alerted ? 'is-saved' : '') + '">' + (alerted ? 'Alerta creada' : 'Crear alerta') + '</button>',
      '</div></div></article>'
    ].join('');
  }

  function renderCards(rows) {
    var items = shortlist(rows);
    if (!items.length) {
      cardsHost.innerHTML = '<div class="stays-empty"><strong>No hay escenarios que coincidan</strong><span>Quite uno o más filtros, escriba Sunny Isles, Tokyo o Madrid, o agregue manualmente una oferta. El sistema no inventará resultados para un destino sin datos.</span></div>';
      return;
    }
    cardsHost.innerHTML = items.map(cardHtml).join('');
  }

  function renderTable(rows) {
    tableBody.innerHTML = rows.map(function (row) {
      var comparison = row.savingsPercentCalculated >= 0
        ? row.savingsPercentCalculated.toFixed(1) + '% menor'
        : Math.abs(row.savingsPercentCalculated).toFixed(1) + '% mayor';
      return [
        '<tr>',
        '<td><strong>' + escapeHtml(row.propertyName) + '</strong><small>' + escapeHtml(row.neighborhood) + ' · ' + row.nights + ' noches</small></td>',
        '<td>' + escapeHtml(row.source) + '<small>' + (groupCount(row) > 1 ? groupCount(row) + ' fuentes agrupadas' : 'Fuente única') + '</small></td>',
        '<td><strong>' + formatMoney(row.totalPriceCalculated) + '</strong><small>Incluye cargos conocidos</small></td>',
        '<td>' + formatMoney(row.effectiveNightlyPriceCalculated) + '</td>',
        '<td>' + comparison + '</td>',
        '<td>★ ' + Number(row.rating).toFixed(1) + '<small>Dato demostrativo</small></td>',
        '<td><span class="stays-score-pill">' + row.ascStayScoreCalculated + '</span></td>',
        '<td><a class="stays-table-action" href="' + escapeHtml(sourceUrl(row)) + '" target="_blank" rel="noopener noreferrer">Verificar ↗</a></td>',
        '</tr>'
      ].join('');
    }).join('');
  }

  function renderRecommendation(rows) {
    if (!rows.length) {
      byId('staysRecommendationTitle').textContent = 'Sin recomendación responsable';
      byId('staysRecommendationText').textContent = 'No existen datos trazables que coincidan con estos parámetros. Ajuste filtros o cargue una oferta manual; no se generarán precios ficticios adicionales.';
      byId('stayBestSaving').textContent = '—';
      byId('stayConfidence').textContent = '—';
      byId('stayMarketCoverage').textContent = '0 ofertas';
      return;
    }
    var best = rows.slice().sort(function (a, b) { return b.ascStayScoreCalculated - a.ascStayScoreCalculated; })[0];
    var alternatives = rows.filter(function (row) { return row.offerId !== best.offerId; }).length;
    var confidence = Math.round((Number(best.confidence) || 0) * 100);
    var timing = best.verifiedAt ? 'Revise las condiciones y considere reservar si la disponibilidad sigue vigente.' : 'No reserve todavía: primero confirme el precio y la disponibilidad en la fuente.';
    var flex = Number(byId('stayFlex').value) || 0;
    var flexCopy = flex ? ' La ventana de ±' + flex + ' día(s) quedó registrada, pero aún no existe inventario conectado para recalcular fechas cercanas.' : '';
    byId('staysRecommendationTitle').textContent = best.propertyName;
    byId('staysRecommendationText').textContent = 'Lidera entre ' + rows.length + ' escenarios por su costo total, calidad y estructura de cargos. Ahorro indicativo: ' + formatMoney(Math.max(0, best.savingsAmountCalculated)) + ' frente a la mediana demostrativa; se comparó contra ' + alternatives + ' alternativa(s). ' + timing + flexCopy + ' Riesgo principal: ' + riskCopy(best) + '.';
    byId('stayBestSaving').textContent = formatMoney(Math.max.apply(null, rows.map(function (row) { return Math.max(0, row.savingsAmountCalculated); })));
    byId('stayConfidence').textContent = confidence + '% · demo';
    byId('stayMarketCoverage').textContent = rows.length + ' ofertas';
  }

  function render() {
    hydrateRows();
    var rows = sortRows(state.rows.filter(matchesFilters));
    state.filtered = rows;
    renderCards(rows);
    renderTable(rows);
    renderRecommendation(rows);
    byId('staysResultSummary').textContent = rows.length + ' alternativas · ' + getNights() + ' noches · ' + selectedCurrency();
  }

  function persistSet(key, set) {
    localStorage.setItem(key, JSON.stringify(Array.from(set)));
  }

  function compareOffer(offerId) {
    var row = state.rows.find(function (candidate) { return candidate.offerId === offerId; });
    if (!row) return;
    var peers = state.rows.filter(function (candidate) { return candidate.propertyId === row.propertyId; }).sort(function (a, b) { return a.totalPriceCalculated - b.totalPriceCalculated; });
    var lines = peers.map(function (peer) {
      return peer.source + ': ' + formatMoney(peer.totalPriceCalculated) + ' total · ' + formatMoney(peer.effectiveNightlyPriceCalculated) + '/noche';
    });
    if (lines.length === 1) lines.push('No existe una segunda publicación del mismo inmueble en el contrato actual.');
    window.alert('Comparación demostrativa\n\n' + lines.join('\n') + '\n\nVerifique disponibilidad, depósitos y cargos finales en cada fuente.');
  }

  function addManualOffer(event) {
    event.preventDefault();
    var data = new FormData(event.currentTarget);
    var currency = selectedCurrency();
    var rate = fxRate(currency);
    var base = Number(data.get('basePrice')) / rate;
    var cleaning = Number(data.get('cleaningFee')) / rate;
    var service = Number(data.get('serviceFee')) / rate;
    var taxes = Number(data.get('taxes')) / rate;
    var manual = {
      offerId: 'manual-' + Date.now(),
      propertyId: 'manual-' + Date.now(),
      propertyName: String(data.get('propertyName') || 'Oferta manual'),
      source: String(data.get('source') || 'Carga manual'),
      destination: byId('stayDestination').value || 'Destino manual',
      neighborhood: 'Carga del usuario',
      nights: 30,
      guests: Number(byId('stayGuests').value) || 1,
      bedrooms: Number(byId('stayBedrooms').value) || 0,
      rating: Number(data.get('rating')) || 0,
      reviewCount: null,
      basePrice: base,
      cleaningFee: cleaning,
      serviceFee: service,
      taxes: taxes,
      resortFee: 0,
      parkingFee: 0,
      mandatoryFees: 0,
      discount: 0,
      pointsValue: 0,
      currency: 'USD',
      marketMedian: (base + cleaning + service + taxes) * 1.1,
      cancellationPolicy: 'unknown',
      availabilityStatus: 'manual-no-verificada',
      sourceUrl: String(data.get('sourceUrl') || '#'),
      verifiedAt: null,
      isStale: true,
      confidence: 0.45,
      risks: ['Carga manual sin verificación', 'Cargos adicionales por confirmar'],
      amenities: [],
      locationScore: 50,
      feeScore: 60,
      cancellationScore: 40,
      qualityConsistency: 60
    };
    var saved = JSON.parse(localStorage.getItem(MANUAL_KEY) || '[]');
    saved.push(manual);
    localStorage.setItem(MANUAL_KEY, JSON.stringify(saved));
    event.currentTarget.reset();
    render();
  }

  async function loadData() {
    byId('staysUpdatedAt').textContent = 'Actualizando contrato…';
    try {
      var response = await fetch(DATA_URL + '?t=' + Date.now(), { cache: 'no-store' });
      if (!response.ok) throw new Error('HTTP ' + response.status);
      var payload = await response.json();
      if (!payload || payload.meta.dataMode !== 'synthetic-demo' || !Array.isArray(payload.items)) throw new Error('Contrato demostrativo inválido');
      state.payload = payload;
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      byId('staysUpdatedAt').textContent = 'Contrato demo · ' + payload.items.length + ' escenarios';
      render();
    } catch (error) {
      var cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached && Array.isArray(cached.items)) {
        state.payload = cached;
        byId('staysUpdatedAt').textContent = 'Contrato demo en caché';
        render();
      } else {
        byId('staysUpdatedAt').textContent = 'No fue posible cargar el contrato';
        cardsHost.innerHTML = '<div class="stays-empty"><strong>Datos no disponibles</strong><span>La pestaña permanece operativa, pero requiere el archivo de escenarios para ejecutar cálculos.</span></div>';
      }
    }
  }

  form.addEventListener('submit', function (event) { event.preventDefault(); render(); });
  form.addEventListener('change', function (event) {
    if (event.target.id === 'stayCheckIn') {
      var start = parseDate(event.target.value);
      if (start) {
        byId('stayCheckOut').min = isoDate(addDays(start, 1));
        if (parseDate(byId('stayCheckOut').value) <= start) byId('stayCheckOut').value = isoDate(addDays(start, 30));
      }
    }
    render();
  });
  byId('staysSort').addEventListener('change', render);
  byId('staysRefreshButton').addEventListener('click', loadData);
  byId('staysToggleTable').addEventListener('click', function () {
    var wrap = byId('staysTableWrap');
    var hidden = !wrap.hasAttribute('hidden');
    if (hidden) wrap.setAttribute('hidden', '');
    else wrap.removeAttribute('hidden');
    this.setAttribute('aria-expanded', String(!hidden));
    this.textContent = hidden ? 'Mostrar tabla' : 'Ocultar tabla';
  });
  cardsHost.addEventListener('click', function (event) {
    var compare = event.target.closest('[data-stay-compare]');
    var save = event.target.closest('[data-stay-save]');
    var alertButton = event.target.closest('[data-stay-alert]');
    if (compare) compareOffer(compare.dataset.stayCompare);
    if (save) {
      var saveId = save.dataset.staySave;
      if (state.saved.has(saveId)) state.saved.delete(saveId); else state.saved.add(saveId);
      persistSet(SAVED_KEY, state.saved);
      render();
    }
    if (alertButton) {
      var alertId = alertButton.dataset.stayAlert;
      if (state.alerts.has(alertId)) state.alerts.delete(alertId); else state.alerts.add(alertId);
      persistSet(ALERTS_KEY, state.alerts);
      render();
    }
  });
  byId('manualStayForm').addEventListener('submit', addManualOffer);
  window.addEventListener('viajes:workspace', function (event) {
    if (event.detail && event.detail.name === 'stays' && state.payload) render();
  });

  setDefaultDates();
  loadData();
})();
