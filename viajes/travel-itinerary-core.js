(() => {
  'use strict';

  const present = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const numeric = value => present(value) ? Number(value) : null;
  const dateKey = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0, 10)) ? String(value).slice(0, 10) : null;

  function phaseFromMinutes(minutes) {
    if (!present(minutes)) return 'flexible';
    const value = Number(minutes) % 1440;
    if (value < 720) return 'morning';
    if (value < 870) return 'lunch';
    if (value < 1080) return 'afternoon';
    return 'evening';
  }

  function activityClassification(item = {}) {
    const candidates = [item.opportunity_index, item.asc_experience_score].filter(present).map(Number);
    if (!candidates.length) return 'PENDIENTE DE DATOS';
    const score = Math.max(...candidates);
    if (score >= 90) return 'IMPERDIBLE';
    if (score >= 80) return 'MUY RECOMENDABLE';
    if (score >= 68) return 'RECOMENDABLE';
    if (score >= 55) return 'SI HAY TIEMPO';
    return 'PRESCINDIBLE';
  }

  function paceLimit(profile = {}) {
    const pace = String(profile.planning?.pace || 'balanced').toLowerCase();
    if (/relax|tranquil|slow|ligero/.test(pace)) return 3;
    if (/intense|intenso|active|activo|fast/.test(pace)) return 5;
    return 4;
  }

  function researchIndex(research = {}) {
    return new Map((Array.isArray(research.items) ? research.items : []).map(item => [String(item.id || ''), item]));
  }

  function enrichStop(stop = {}, item = {}) {
    const opportunity = numeric(item.opportunity_index ?? stop.opportunity_index);
    const experience = numeric(item.asc_experience_score);
    return {
      ...stop,
      date: dateKey(stop.date || item.date_start),
      opportunity_index: opportunity,
      asc_experience_score: experience,
      executive_classification: item.executive_classification || activityClassification({ opportunity_index: opportunity, asc_experience_score: experience }),
      why_relevant: String(item.why_relevant || ''),
      price_observed: item.price_observed || null,
      availability: String(item.availability || 'unknown'),
      source_title: String(item.source_title || ''),
      source_url: String(item.source_url || stop.source_url || ''),
      source_type: String(item.source_type || ''),
      period: phaseFromMinutes(stop.time?.start),
      schedule_basis: stop.time ? (stop.time.end !== null ? 'source_time_range' : 'source_start_time') : 'time_unverified'
    };
  }

  function overlapsRange(stop, start, end) {
    if (!stop?.time || !present(stop.time.start)) return false;
    const stopStart = Number(stop.time.start);
    const stopEnd = present(stop.time.end) ? Number(stop.time.end) : stopStart;
    return stopStart < end && stopEnd > start;
  }

  function planningBlocks(selected = []) {
    if (!Array.isArray(selected) || !selected.length) return [];
    const blocks = [];
    if (!selected.some(stop => overlapsRange(stop, 780, 840))) {
      blocks.push({ id:'planning-lunch', type:'planning_block', label:'Comida / pausa logística', period:'lunch', start:780, end:840, evidence:'generated_planning_block', cost_status:'not_priced' });
    }
    if (selected.length >= 3 && !selected.some(stop => overlapsRange(stop, 1050, 1080))) {
      blocks.push({ id:'planning-buffer', type:'planning_block', label:'Margen de traslado / descanso', period:'afternoon', start:1050, end:1080, evidence:'generated_planning_block', cost_status:'not_priced' });
    }
    return blocks;
  }

  function priorityValue(stop = {}) {
    const values = [stop.opportunity_index, stop.asc_experience_score].filter(present).map(Number);
    return values.length ? Math.max(...values) : -1;
  }

  function buildDay(logisticsDay = {}, research = {}, profile = {}) {
    const index = researchIndex(research);
    const enriched = (Array.isArray(logisticsDay.stops) ? logisticsDay.stops : []).map(stop => enrichStop(stop, index.get(String(stop.id)) || {}));
    const fixed = enriched.filter(stop => stop.time).sort((a,b) => Number(a.time.start) - Number(b.time.start));
    const flexible = enriched.filter(stop => !stop.time).sort((a,b) => priorityValue(b) - priorityValue(a));
    const limit = paceLimit(profile);
    const flexibleSlots = Math.max(0, limit - fixed.length);
    const selected = fixed.concat(flexible.slice(0, flexibleSlots));
    const alternates = flexible.slice(flexibleSlots);
    const periods = { morning:[], lunch:[], afternoon:[], evening:[], flexible:[] };
    for (const stop of selected) periods[stop.period || 'flexible'].push(stop);
    const generated = planningBlocks(selected);
    const impossible = Number(logisticsDay.metrics?.impossible_segments || 0);
    const strained = Number(logisticsDay.metrics?.strained_segments || 0);
    const overloaded = fixed.length > limit || impossible > 0 || selected.length > limit;
    const verdict = impossible ? 'REORDENAR ANTES DE USAR' : strained ? 'ITINERARIO CON AJUSTES' : overloaded ? 'DÍA SOBRECARGADO' : 'ITINERARIO EQUILIBRADO';
    return {
      date: logisticsDay.date,
      selected,
      alternates,
      periods,
      planning_blocks: generated,
      logistics: { verdict:logisticsDay.verdict || '', score:numeric(logisticsDay.metrics?.logistics_score), impossible_segments:impossible, strained_segments:strained, unverified_segments:Number(logisticsDay.metrics?.unverified_segments || 0), maps_url:logisticsDay.maps_url || null },
      metrics: { selected_count:selected.length, fixed_count:fixed.length, flexible_count:selected.length-fixed.length, alternate_count:alternates.length, pace_limit:limit, overloaded, source_time_coverage:selected.length ? Math.round(selected.filter(stop => stop.time).length / selected.length * 100) : 0 },
      verdict
    };
  }

  function buildItinerary(profile = {}, research = {}, logistics = {}) {
    const days = (Array.isArray(logistics.days) ? logistics.days : []).map(day => buildDay(day, research, profile));
    const totals = days.reduce((acc, day) => {
      acc.activities += day.selected.length;
      acc.alternates += day.alternates.length;
      acc.overloaded += day.metrics.overloaded ? 1 : 0;
      acc.must_do += day.selected.filter(stop => stop.executive_classification === 'IMPERDIBLE').length;
      return acc;
    }, { activities:0, alternates:0, overloaded:0, must_do:0 });
    const activeDays = days.filter(day => day.selected.length).length;
    return {
      contract:'asc-travel-itinerary-v1',
      generated_at:new Date().toISOString(),
      profile_id:profile.trip_id || null,
      destination:profile.destination_scope?.values?.join(', ') || logistics.destination || research.destination || '',
      dates:{ start:dateKey(profile.dates?.start), end:dateKey(profile.dates?.end) },
      days,
      metrics:{ ...totals, active_days:activeDays, pace_limit:paceLimit(profile) },
      verdict:totals.overloaded ? 'REVISAR DÍAS SOBRECARGADOS' : activeDays ? 'ITINERARIO EJECUTABLE' : 'PENDIENTE DE ACTIVIDADES VERIFICADAS',
      methodology:{ named_activities:'only_from_research_and_logistics', fixed_times:'never_retimed', untimed_activities:'kept_flexible', meal_and_rest_blocks:'generic_planning_only', missing_evidence:'never_filled_with_invented_venues_or_prices' }
    };
  }

  window.TravelItineraryCore = { phaseFromMinutes, activityClassification, paceLimit, researchIndex, enrichStop, planningBlocks, buildDay, buildItinerary };
})();
