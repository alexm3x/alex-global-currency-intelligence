(() => {
  'use strict';

  const text = value => String(value ?? '').trim();
  const numberOrNull = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)) ? Number(value) : null;
  const safeUrl = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const compactTotals = totals => Object.fromEntries(Object.entries(totals || {}).filter(([currency, amount]) => currency && Number.isFinite(Number(amount))).map(([currency, amount]) => [String(currency).toUpperCase(), Number(amount)]));

  function buildSnapshot(profile = {}, research = {}, logistics = {}, itinerary = {}, cost = {}, report = {}, selectedWindow = {}) {
    const adults = Math.max(0, Number(profile.travelers?.adults) || 0);
    const children = Array.isArray(profile.travelers?.children) ? profile.travelers.children.length : 0;
    const maps = (Array.isArray(logistics.days) ? logistics.days : []).map(day => ({ date:text(day.date), url:safeUrl(day.maps_url), verdict:text(day.verdict) })).filter(day => day.url);
    const snapshot = {
      contract:'asc-travel-integration-v1',
      generated_at:new Date().toISOString(),
      trip_id:profile.trip_id || report.trip?.trip_id || null,
      destination:text(profile.destination_scope?.values?.join(', ') || report.trip?.destination || research.destination),
      dates:{ start:text(profile.dates?.start || report.trip?.start), end:text(profile.dates?.end || report.trip?.end) },
      origin:text(profile.origin?.city || profile.origin?.airports?.[0] || ''),
      travelers:{ adults, children, total:adults + children, rooms:Math.max(0, Number(profile.travelers?.rooms) || 0) },
      budget:{ amount:numberOrNull(profile.budget?.normalized_total) ?? numberOrNull(profile.budget?.amount), currency:text(profile.budget?.currency).toUpperCase() },
      selected_window:{ id:text(selectedWindow.id), label:text(selectedWindow.strategy_label || selectedWindow.label), score:numberOrNull(selectedWindow.asc_travel_window_score) },
      scores:{ logistics:numberOrNull(logistics.metrics?.logistics_score), cost_coverage:numberOrNull(cost.evidence?.coverage), pdf_completeness:numberOrNull(report.completeness?.score) },
      counts:{ researched:Array.isArray(research.items) ? research.items.length : 0, itinerary:Number(itinerary.metrics?.activities || 0), must_do:Number(itinerary.metrics?.must_do || 0), sources:Array.isArray(report.sources) ? report.sources.length : 0 },
      costs:{ totals_by_currency:compactTotals(cost.totals_by_currency), status:text(cost.total_status), reference_lines:Number(cost.evidence?.reference_lines || 0) },
      maps,
      contracts:{ research:text(research.contract), logistics:text(logistics.contract), itinerary:text(itinerary.contract), cost:text(cost.contract), pdf:text(report.contract) },
      integration_status:{
        flights_dashboard:'parameter_sync_only',
        stays:'parameter_sync_only_demo_data_never_promoted_to_live',
        opportunities:'trip_context_sync_only',
        favorites:'local_storage',
        alerts:'local_watch_intent_only_external_notification_inactive',
        budget:'same_currency_parameter_sync_only',
        maps:'verified_route_links_only',
        history:'local_storage_minimal_snapshot'
      }
    };
    return snapshot;
  }

  function storageRecord(snapshot = {}) {
    return {
      contract:'asc-travel-history-v1',
      saved_at:new Date().toISOString(),
      trip_id:snapshot.trip_id || null,
      destination:text(snapshot.destination),
      dates:{ start:text(snapshot.dates?.start), end:text(snapshot.dates?.end) },
      origin:text(snapshot.origin),
      travelers:{ total:Number(snapshot.travelers?.total || 0), rooms:Number(snapshot.travelers?.rooms || 0) },
      budget:{ amount:numberOrNull(snapshot.budget?.amount), currency:text(snapshot.budget?.currency) },
      selected_window:{ id:text(snapshot.selected_window?.id), label:text(snapshot.selected_window?.label), score:numberOrNull(snapshot.selected_window?.score) },
      scores:{ ...snapshot.scores },
      costs:{ totals_by_currency:compactTotals(snapshot.costs?.totals_by_currency), status:text(snapshot.costs?.status) },
      source_count:Number(snapshot.counts?.sources || 0),
      map_count:Array.isArray(snapshot.maps) ? snapshot.maps.length : 0
    };
  }

  function favoriteRecord(snapshot = {}) {
    const base = storageRecord(snapshot);
    return { ...base, contract:'asc-travel-favorite-v1', favorite_id:`fav-${base.trip_id || base.destination.toLowerCase().replace(/[^a-z0-9]+/g,'-') || 'trip'}-${base.dates.start || 'open'}` };
  }

  function alertIntent(snapshot = {}) {
    return {
      contract:'asc-travel-alert-intent-v1',
      created_at:new Date().toISOString(),
      trip_id:snapshot.trip_id || null,
      destination:text(snapshot.destination),
      dates:{ start:text(snapshot.dates?.start), end:text(snapshot.dates?.end) },
      selected_window:{ id:text(snapshot.selected_window?.id), score:numberOrNull(snapshot.selected_window?.score) },
      watch:{ prices:true, events:true, availability:true },
      status:'local_watch_intent_saved',
      external_notification_active:false,
      disclosure:'No external notification channel is activated by this local record.'
    };
  }

  function mergeBounded(current, record, max = 20, key = 'trip_id') {
    const rows = Array.isArray(current) ? current.filter(Boolean) : [];
    const identity = text(record?.[key]) || JSON.stringify(record?.dates || {}) + text(record?.destination);
    const filtered = rows.filter(item => (text(item?.[key]) || JSON.stringify(item?.dates || {}) + text(item?.destination)) !== identity);
    return [record, ...filtered].slice(0, Math.max(1, Number(max) || 20));
  }

  window.TravelIntegrationCore = { buildSnapshot, storageRecord, favoriteRecord, alertIntent, mergeBounded };
})();
