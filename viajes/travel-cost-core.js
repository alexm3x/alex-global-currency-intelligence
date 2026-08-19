(() => {
  'use strict';

  const present = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const cleanCurrency = value => String(value || '').trim().toUpperCase().slice(0, 8);
  const safeUrl = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };

  function observedBasis(category, observed = {}) {
    const note = String(observed.note || '').toLowerCase();
    if (!present(observed.amount)) return { kind:'missing', sum:false };
    if (/\b(total|trip total|total trip|total estancia|estancia total|total stay|stay total|grupo|group total|party total|total del grupo)\b/.test(note)) return { kind:'explicit_total', sum:true };
    if (category === 'lodging' && /(por noche|per night|nightly)/.test(note)) return { kind:'nightly_reference', sum:false };
    if (category === 'flight' && /(por persona|per person|por pasajero|per passenger|por viajero|per traveler)/.test(note)) return { kind:'per_person_reference', sum:false };
    if (category === 'activity' && /(por persona|per person|por boleto|per ticket|ticket|desde|from)/.test(note)) return { kind:'unit_reference', sum:false };
    return { kind:'unknown_basis', sum:false };
  }

  function lineFromObserved(category, label, observed = {}, fallbackSource = {}) {
    if (!present(observed.amount) || Number(observed.amount) < 0) return null;
    const currency = cleanCurrency(observed.currency);
    if (!currency) return null;
    const basis = observedBasis(category, observed);
    return {
      id:`${category}-${String(label || '').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'') || 'observed'}`,
      category,
      label:String(label || 'Precio observado'),
      amount:Number(observed.amount),
      currency,
      note:String(observed.note || ''),
      observed_at:String(observed.observed_at || fallbackSource.observed_at || ''),
      source_title:String(observed.source_title || fallbackSource.source_title || ''),
      source_url:safeUrl(observed.source_url || fallbackSource.source_url),
      basis:basis.kind,
      included_in_observed_subtotal:basis.sum,
      status:'observed'
    };
  }

  function selectedActivityIds(itinerary = {}) {
    const ids = new Set();
    for (const day of Array.isArray(itinerary.days) ? itinerary.days : []) {
      for (const stop of Array.isArray(day.selected) ? day.selected : []) if (stop?.id) ids.add(String(stop.id));
    }
    return ids;
  }

  function activityLines(itinerary = {}, research = {}) {
    const selected = selectedActivityIds(itinerary);
    const lines = [];
    for (const item of Array.isArray(research.items) ? research.items : []) {
      if (!selected.has(String(item.id || ''))) continue;
      const line = lineFromObserved('activity', item.name || 'Actividad', item.price_observed || {}, { source_title:item.source_title, source_url:item.source_url, observed_at:research.verified_at });
      if (line) lines.push(line);
    }
    return lines;
  }

  function selectedWindowLines(selectedWindow = {}) {
    const lines = [];
    const flight = lineFromObserved('flight', 'Vuelo observado', selectedWindow.flight_observed || {});
    const lodging = lineFromObserved('lodging', 'Alojamiento observado', selectedWindow.lodging_observed || {});
    if (flight) lines.push(flight);
    if (lodging) lines.push(lodging);
    return lines;
  }

  function totalsByCurrency(lines = []) {
    const totals = {};
    for (const line of lines) {
      if (!line.included_in_observed_subtotal || !present(line.amount) || !line.currency) continue;
      totals[line.currency] = Math.round(((totals[line.currency] || 0) + Number(line.amount)) * 100) / 100;
    }
    return totals;
  }

  function evidenceByCategory(lines = []) {
    const categories = ['flight','lodging','activity','local_transport','meals'];
    const result = Object.fromEntries(categories.map(category => [category, lines.some(line => line.category === category)]));
    return { categories:result, coverage:Math.round(Object.values(result).filter(Boolean).length / categories.length * 100) };
  }

  function uniqueSources(lines = []) {
    const seen = new Set(), sources = [];
    for (const line of lines) {
      if (!line.source_url || seen.has(line.source_url)) continue;
      seen.add(line.source_url);
      sources.push({ title:line.source_title || line.label, url:line.source_url, observed_at:line.observed_at || null });
    }
    return sources;
  }

  function budgetComparison(profile = {}, totals = {}) {
    const currency = cleanCurrency(profile.budget?.currency);
    const budget = present(profile.budget?.normalized_total) && Number(profile.budget.normalized_total) > 0 ? Number(profile.budget.normalized_total) : present(profile.budget?.amount) && Number(profile.budget.amount) > 0 ? Number(profile.budget.amount) : null;
    if (!budget || !currency || !present(totals[currency])) return null;
    const observed = Number(totals[currency]);
    return { currency, budget, observed_subtotal:observed, remaining:Math.round((budget-observed)*100)/100, usage_pct:Math.round(observed/budget*1000)/10, basis:'same_currency_only_no_fx_conversion' };
  }

  function buildCost(profile = {}, research = {}, itinerary = {}, selectedWindow = {}) {
    const lines = [...selectedWindowLines(selectedWindow), ...activityLines(itinerary, research)];
    const totals = totalsByCurrency(lines);
    const evidence = evidenceByCategory(lines);
    const included = lines.filter(line => line.included_in_observed_subtotal);
    const references = lines.filter(line => !line.included_in_observed_subtotal);
    const missing = Object.entries(evidence.categories).filter(([,has]) => !has).map(([category]) => category);
    const mixedCurrencies = new Set(lines.map(line => line.currency).filter(Boolean)).size > 1;
    const eventPremium = present(selectedWindow.event_premium_pct) ? Number(selectedWindow.event_premium_pct) : null;
    const risks = [];
    if (!evidence.categories.flight) risks.push('Vuelo sin precio observado utilizable.');
    if (!evidence.categories.lodging) risks.push('Alojamiento sin precio observado utilizable.');
    if (references.length) risks.push(`${references.length} precio(s) observado(s) tienen base unitaria o desconocida y no se suman.`);
    if (mixedCurrencies) risks.push('Hay precios en monedas distintas; no se aplica conversión FX automática.');
    if (eventPremium !== null) risks.push('Event Premium se muestra como señal y no se vuelve a sumar a precios ya observados.');
    const totalStatus = included.length && missing.length === 0 ? 'complete_observed' : included.length ? 'partial_observed' : 'reference_only';
    return {
      contract:'asc-travel-cost-v1',
      generated_at:new Date().toISOString(),
      profile_id:profile.trip_id || null,
      destination:profile.destination_scope?.values?.join(', ') || research.destination || '',
      lines,
      totals_by_currency:totals,
      budget_comparison:budgetComparison(profile, totals),
      evidence:{ ...evidence, missing_categories:missing, included_lines:included.length, reference_lines:references.length },
      event_premium_pct:eventPremium,
      total_status:totalStatus,
      risks,
      sources:uniqueSources(lines),
      methodology:{ summation:'only_explicit_total_basis', unit_prices:'visible_but_excluded', currency:'never_converted_without_explicit_fx_evidence', event_premium:'never_double_counted', missing_costs:'never_imputed' }
    };
  }

  window.TravelCostCore = { observedBasis, lineFromObserved, selectedActivityIds, activityLines, selectedWindowLines, totalsByCurrency, evidenceByCategory, budgetComparison, buildCost };
})();
