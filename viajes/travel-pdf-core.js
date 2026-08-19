(() => {
  'use strict';

  const safeUrl = value => {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' ? url.href : '';
    } catch { return ''; }
  };
  const numberOrNull = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const text = value => String(value ?? '').trim();
  const isoDay = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ? String(value) : null;
  const overlaps = (start, end, itemStart, itemEnd) => {
    const a = isoDay(start), b = isoDay(end), c = isoDay(itemStart), d = isoDay(itemEnd || itemStart);
    return Boolean(a && b && c && d && c <= b && d >= a);
  };

  function tripSummary(profile = {}, research = {}) {
    const start = isoDay(profile.dates?.start) || null;
    const end = isoDay(profile.dates?.end) || null;
    const destination = text(profile.destination_scope?.values?.join(', ') || research.destination || '');
    const adults = Math.max(0, Number(profile.travelers?.adults) || 0);
    const children = Array.isArray(profile.travelers?.children) ? profile.travelers.children.length : 0;
    return {
      trip_id: profile.trip_id || null,
      destination,
      start,
      end,
      travelers: adults + children,
      adults,
      children,
      rooms: Math.max(0, Number(profile.travelers?.rooms) || 0),
      origin: text(profile.origin?.city || profile.origin?.airports?.[0] || ''),
      planning_mode: text(profile.planning?.mode || 'known_dates')
    };
  }

  function onlyDuringTrip(profile = {}, research = {}) {
    const start = profile.dates?.start;
    const end = profile.dates?.end;
    return (Array.isArray(research.items) ? research.items : [])
      .filter(item => item?.verification_status === 'confirmed')
      .filter(item => overlaps(start, end, item.date_start, item.date_end))
      .filter(item => {
        const opportunity = numberOrNull(item.opportunity_index) || 0;
        const rarity = numberOrNull(item.signals?.rarity) || 0;
        const exclusivity = numberOrNull(item.signals?.exclusivity) || 0;
        return opportunity >= 80 || rarity >= 80 || exclusivity >= 80 || /IMPERDIBLE|MUY RECOMENDABLE/i.test(text(item.executive_classification));
      })
      .sort((a, b) => (numberOrNull(b.opportunity_index) || 0) - (numberOrNull(a.opportunity_index) || 0))
      .slice(0, 10)
      .map(item => ({
        id: text(item.id),
        name: text(item.name),
        category: text(item.category),
        date_start: isoDay(item.date_start),
        date_end: isoDay(item.date_end || item.date_start),
        venue: text(item.venue),
        location: text(item.location),
        opportunity_index: numberOrNull(item.opportunity_index),
        asc_experience_score: numberOrNull(item.asc_experience_score),
        executive_classification: text(item.executive_classification),
        source_title: text(item.source_title),
        source_url: safeUrl(item.source_url),
        verification_status: 'confirmed'
      }));
  }

  function itinerarySection(itinerary = {}) {
    return (Array.isArray(itinerary.days) ? itinerary.days : []).map(day => ({
      date: isoDay(day.date),
      verdict: text(day.verdict),
      selected: (Array.isArray(day.selected) ? day.selected : []).map(stop => ({
        id: text(stop.id), name: text(stop.name), venue: text(stop.venue), location: text(stop.location),
        category: text(stop.category), executive_classification: text(stop.executive_classification),
        opportunity_index: numberOrNull(stop.opportunity_index), asc_experience_score: numberOrNull(stop.asc_experience_score),
        time: stop.time && Number.isFinite(Number(stop.time.start)) ? { start:Number(stop.time.start), end:Number.isFinite(Number(stop.time.end)) ? Number(stop.time.end) : null } : null,
        schedule_basis: text(stop.schedule_basis), source_url: safeUrl(stop.source_url)
      })),
      planning_blocks: (Array.isArray(day.planning_blocks) ? day.planning_blocks : []).map(block => ({
        type:'planning_block', period:text(block.period), label:text(block.label), evidence:'generated_planning_block', cost_status:'not_priced'
      })),
      alternates: (Array.isArray(day.alternates) ? day.alternates : []).map(stop => ({ id:text(stop.id), name:text(stop.name) }))
    }));
  }

  function logisticsSection(logistics = {}) {
    return {
      verdict:text(logistics.verdict),
      score:numberOrNull(logistics.metrics?.logistics_score),
      impossible:Number(logistics.metrics?.impossible || 0),
      strained:Number(logistics.metrics?.strained || 0),
      unverified:Number(logistics.metrics?.unverified || 0),
      days:(Array.isArray(logistics.days) ? logistics.days : []).filter(day => Array.isArray(day.stops) && day.stops.length).map(day => ({
        date:isoDay(day.date), verdict:text(day.verdict), stops:day.stops.length,
        geo_coverage:numberOrNull(day.metrics?.geo_coverage), time_coverage:numberOrNull(day.metrics?.time_coverage),
        logistics_score:numberOrNull(day.metrics?.logistics_score), maps_url:safeUrl(day.maps_url)
      }))
    };
  }

  function costSection(cost = {}) {
    return {
      status:text(cost.total_status),
      totals_by_currency:{ ...(cost.totals_by_currency || {}) },
      coverage:numberOrNull(cost.evidence?.coverage),
      included_lines:Number(cost.evidence?.included_lines || 0),
      reference_lines:Number(cost.evidence?.reference_lines || 0),
      missing_categories:Array.isArray(cost.evidence?.missing_categories) ? [...cost.evidence.missing_categories] : [],
      budget_comparison:cost.budget_comparison ? { ...cost.budget_comparison } : null,
      event_premium_pct:numberOrNull(cost.event_premium_pct),
      lines:(Array.isArray(cost.lines) ? cost.lines : []).map(line => ({
        category:text(line.category), label:text(line.label), amount:numberOrNull(line.amount), currency:text(line.currency),
        note:text(line.note), basis:text(line.basis), included_in_observed_subtotal:Boolean(line.included_in_observed_subtotal),
        observed_at:text(line.observed_at), source_title:text(line.source_title), source_url:safeUrl(line.source_url)
      })),
      risks:Array.isArray(cost.risks) ? [...cost.risks].map(text) : []
    };
  }

  function collectSources(research = {}, cost = {}, itinerary = {}) {
    const all = [];
    for (const source of Array.isArray(research.sources) ? research.sources : []) all.push({ title:text(source.title || source.source_title), url:safeUrl(source.url || source.source_url), observed_at:text(source.observed_at || research.verified_at), type:text(source.type || 'research') });
    for (const source of Array.isArray(cost.sources) ? cost.sources : []) all.push({ title:text(source.title), url:safeUrl(source.url), observed_at:text(source.observed_at), type:'cost' });
    for (const day of Array.isArray(itinerary.days) ? itinerary.days : []) for (const stop of Array.isArray(day.selected) ? day.selected : []) if (safeUrl(stop.source_url)) all.push({ title:text(stop.name), url:safeUrl(stop.source_url), observed_at:'', type:'itinerary' });
    const seen = new Set();
    return all.filter(source => {
      if (!source.url || seen.has(source.url)) return false;
      seen.add(source.url); return true;
    }).slice(0, 60);
  }

  function executiveDecision(research = {}, selectedWindow = {}, logistics = {}, itinerary = {}, cost = {}) {
    const collision = research.collision || {};
    const top = (Array.isArray(research.items) ? research.items : []).slice().sort((a,b)=>(numberOrNull(b.opportunity_index)||0)-(numberOrNull(a.opportunity_index)||0))[0];
    return {
      asc_travel_window_score:numberOrNull(selectedWindow.asc_travel_window_score),
      window_label:text(selectedWindow.strategy_label || selectedWindow.label),
      top_opportunity:top ? { name:text(top.name), opportunity_index:numberOrNull(top.opportunity_index), classification:text(top.executive_classification) } : null,
      collision_detected:Boolean(collision.detected), collision_count:Number(collision.count || 0),
      logistics_score:numberOrNull(logistics.metrics?.logistics_score), logistics_verdict:text(logistics.verdict),
      itinerary_activities:Number(itinerary.metrics?.activities || 0), itinerary_must_do:Number(itinerary.metrics?.must_do || 0),
      cost_coverage:numberOrNull(cost.evidence?.coverage), cost_status:text(cost.total_status)
    };
  }

  function completeness(report) {
    const checks = {
      dates:Boolean(report.trip.start && report.trip.end),
      research:report.only_during_trip.length > 0 || report.sources.some(source => source.type === 'research'),
      itinerary:report.itinerary.some(day => day.selected.length > 0),
      logistics:report.logistics.days.length > 0,
      costs:report.costs.lines.length > 0,
      sources:report.sources.length > 0
    };
    const complete = Object.values(checks).filter(Boolean).length;
    return { checks, score:Math.round(complete / Object.keys(checks).length * 100), status:complete === Object.keys(checks).length ? 'complete_evidence_package' : 'partial_evidence_package' };
  }

  function buildReport(profile = {}, research = {}, logistics = {}, itinerary = {}, cost = {}, selectedWindow = {}) {
    const report = {
      contract:'asc-travel-pdf-v1',
      generated_at:new Date().toISOString(),
      title:'VIAJES ASC · GUÍA EJECUTIVA DE VIAJE',
      trip:tripSummary(profile, research),
      decision:executiveDecision(research, selectedWindow, logistics, itinerary, cost),
      only_during_trip:onlyDuringTrip(profile, research),
      itinerary:itinerarySection(itinerary),
      logistics:logisticsSection(logistics),
      costs:costSection(cost),
      sources:collectSources(research, cost, itinerary),
      methodology:{
        research:'confirmed or explicitly status-labelled evidence only',
        itinerary:'selected researched activities; generic planning blocks are never presented as bookings',
        logistics:'distance/transfer estimates retain provenance and are not live traffic',
        costs:'only explicit-total price bases are summed; unit prices remain references; no implicit FX conversion',
        pdf:'browser-native print document generated from Phase 3-8 contracts without adding travel facts'
      }
    };
    report.completeness = completeness(report);
    return report;
  }

  window.TravelPdfCore = { tripSummary, onlyDuringTrip, itinerarySection, logisticsSection, costSection, collectSources, executiveDecision, completeness, buildReport };
})();
