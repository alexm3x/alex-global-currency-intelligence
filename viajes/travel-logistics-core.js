(() => {
  'use strict';

  const present = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const dateKey = value => /^\d{4}-\d{2}-\d{2}$/.test(String(value || '').slice(0,10)) ? String(value).slice(0,10) : null;
  const normalizeText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  function parseTime(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return null;
    const normalized = raw.replace(/\./g, '').replace(/\s+/g, ' ');
    const range = normalized.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*(?:-|–|—|a|to)\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i);
    const single = normalized.match(/\b(\d{1,2})(?::(\d{2}))\s*(am|pm)?\b/i) || normalized.match(/\b(\d{1,2})\s*(am|pm)\b/i);
    const toMinutes = (h, m='0', suffix='') => {
      let hour = Number(h), minute = Number(m || 0);
      if (hour > 23 || minute > 59) return null;
      if (suffix) {
        const s = suffix.toLowerCase();
        if (hour > 12) return null;
        if (s === 'pm' && hour < 12) hour += 12;
        if (s === 'am' && hour === 12) hour = 0;
      }
      return hour * 60 + minute;
    };
    if (range) {
      const start = toMinutes(range[1], range[2], range[3] || range[6] || '');
      const end = toMinutes(range[4], range[5], range[6] || range[3] || '');
      return start === null || end === null ? null : { start, end: end >= start ? end : end + 1440, precision:'range' };
    }
    if (single) {
      const suffix = single[3] || single[2] || '';
      const minute = single[3] ? single[2] : '0';
      const start = toMinutes(single[1], minute, suffix);
      return start === null ? null : { start, end:null, precision:'start_only' };
    }
    return null;
  }

  function haversineKm(a, b) {
    if (![a?.lat,a?.lon,b?.lat,b?.lon].every(present)) return null;
    const rad = degree => Number(degree) * Math.PI / 180;
    const r = 6371;
    const dLat = rad(Number(b.lat)-Number(a.lat));
    const dLon = rad(Number(b.lon)-Number(a.lon));
    const lat1 = rad(a.lat), lat2 = rad(b.lat);
    const h = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLon/2)**2;
    return Math.round((2*r*Math.asin(Math.sqrt(h)))*10)/10;
  }

  function transferEstimate(distanceKm) {
    if (!present(distanceKm)) return null;
    const km = Math.max(0, Number(distanceKm));
    let minutes;
    if (km <= 1.2) minutes = 10 + km * 10;
    else if (km <= 6) minutes = 16 + km * 5;
    else if (km <= 20) minutes = 24 + km * 3.2;
    else minutes = 35 + km * 2.1;
    return { minutes:Math.max(8,Math.round(minutes)), basis:'estimated_from_straight_line_distance', confidence: km <= 20 ? 'medium' : 'low' };
  }

  function stopFromItem(item = {}) {
    const coordinates = item.coordinates || item.geo || {};
    const lat = present(coordinates.lat ?? item.lat) ? Number(coordinates.lat ?? item.lat) : null;
    const lon = present(coordinates.lon ?? coordinates.lng ?? item.lon ?? item.lng) ? Number(coordinates.lon ?? coordinates.lng ?? item.lon ?? item.lng) : null;
    return {
      id:String(item.id || `stop-${normalizeText(item.name || 'actividad').replace(/\s+/g,'-') || 'actividad'}-${dateKey(item.date_start) || 'sin-fecha'}`),
      name:String(item.name || 'Actividad'),
      category:String(item.category || 'experiencia'),
      date:dateKey(item.date_start),
      time:parseTime(item.time),
      time_raw:String(item.time || ''),
      venue:String(item.venue || ''),
      location:String(item.location || ''),
      lat, lon,
      verification_status:String(item.verification_status || 'pending'),
      opportunity_index:present(item.opportunity_index) ? Number(item.opportunity_index) : null,
      source_url:String(item.source_url || '')
    };
  }

  function groupByDay(items = [], profile = {}) {
    const start = dateKey(profile?.dates?.start), end = dateKey(profile?.dates?.end);
    const stops = (Array.isArray(items) ? items : []).map(stopFromItem).filter(stop => stop.date && (!start || stop.date >= start) && (!end || stop.date <= end));
    const days = new Map();
    for (const stop of stops) {
      if (!days.has(stop.date)) days.set(stop.date, []);
      days.get(stop.date).push(stop);
    }
    for (const list of days.values()) list.sort((a,b) => (a.time?.start ?? 9999) - (b.time?.start ?? 9999) || (b.opportunity_index ?? -1) - (a.opportunity_index ?? -1));
    if (start && end) {
      let cursor = new Date(`${start}T00:00:00Z`), last = new Date(`${end}T00:00:00Z`);
      while (cursor <= last) {
        const key = cursor.toISOString().slice(0,10);
        if (!days.has(key)) days.set(key, []);
        cursor.setUTCDate(cursor.getUTCDate()+1);
      }
    }
    return [...days.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([date,stops])=>({date,stops}));
  }

  function temporalConflict(a,b) {
    if (!a?.time || !b?.time) return null;
    if (a.time.end !== null && b.time.start < a.time.end) return { level:'impossible', reason:'overlap', gap_minutes:b.time.start-a.time.end };
    if (a.time.start === b.time.start && a.id !== b.id) return { level:'impossible', reason:'same_start_time', gap_minutes:0 };
    if (a.time.end === null) return { level:'unknown', reason:'first_duration_unknown', gap_minutes:null };
    return { level:'ok', reason:'no_overlap', gap_minutes:b.time.start-a.time.end };
  }

  function segmentAnalysis(a,b) {
    const temporal = temporalConflict(a,b);
    const distance = haversineKm(a,b);
    const transfer = transferEstimate(distance);
    if (temporal?.level === 'impossible') return {from:a.id,to:b.id,distance_km:distance,transfer,temporal,feasibility:'impossible'};
    if (!a.time || !b.time || a.time.end === null) return {from:a.id,to:b.id,distance_km:distance,transfer,temporal,feasibility:'unverified'};
    const gap = b.time.start - a.time.end;
    if (transfer && gap < transfer.minutes) return {from:a.id,to:b.id,distance_km:distance,transfer,temporal:{...temporal,gap_minutes:gap},feasibility:'strained'};
    if (!transfer && normalizeText(a.location || a.venue) && normalizeText(a.location || a.venue) === normalizeText(b.location || b.venue)) return {from:a.id,to:b.id,distance_km:0,transfer:{minutes:8,basis:'same_named_place',confidence:'medium'},temporal:{...temporal,gap_minutes:gap},feasibility:gap>=8?'ok':'strained'};
    return {from:a.id,to:b.id,distance_km:distance,transfer,temporal:{...temporal,gap_minutes:gap},feasibility:transfer?'ok':'unverified'};
  }

  function clusterStops(stops = []) {
    const clusters=[];
    for (const stop of stops) {
      let match = clusters.find(cluster => {
        if (present(stop.lat) && present(stop.lon) && present(cluster.centroid?.lat) && present(cluster.centroid?.lon)) return haversineKm(stop,cluster.centroid) <= 3;
        const a=normalizeText(stop.location || stop.venue), b=cluster.key;
        return a && b && (a===b || a.includes(b) || b.includes(a));
      });
      if (!match) { match={id:`cluster-${clusters.length+1}`,key:normalizeText(stop.location || stop.venue),stops:[],centroid:null};clusters.push(match); }
      match.stops.push(stop);
      const geo=match.stops.filter(x=>present(x.lat)&&present(x.lon));
      if (geo.length) match.centroid={lat:geo.reduce((s,x)=>s+Number(x.lat),0)/geo.length,lon:geo.reduce((s,x)=>s+Number(x.lon),0)/geo.length};
    }
    return clusters.map(cluster=>({...cluster,label:cluster.stops[0]?.location||cluster.stops[0]?.venue||'Zona por confirmar'}));
  }

  function mapsDirectionsUrl(stops = []) {
    const labels=stops.map(stop=>[stop.venue,stop.location].filter(Boolean).join(', ')).filter(Boolean);
    if (labels.length < 2) return null;
    const origin=labels[0], destination=labels.at(-1), waypoints=labels.slice(1,-1).slice(0,8);
    const params=new URLSearchParams({api:'1',origin,destination,travelmode:'walking'});
    if (waypoints.length) params.set('waypoints',waypoints.join('|'));
    return `https://www.google.com/maps/dir/?${params.toString()}`;
  }

  function analyzeDay(day = {}) {
    const stops = Array.isArray(day.stops) ? day.stops : [];
    const segments=[];
    for (let i=0;i<stops.length-1;i++) segments.push(segmentAnalysis(stops[i],stops[i+1]));
    const impossible=segments.filter(x=>x.feasibility==='impossible').length;
    const strained=segments.filter(x=>x.feasibility==='strained').length;
    const unverified=segments.filter(x=>x.feasibility==='unverified').length;
    const geoStops=stops.filter(x=>present(x.lat)&&present(x.lon)).length;
    const timedStops=stops.filter(x=>x.time).length;
    const scorePenalty=impossible*45+strained*20+unverified*5;
    const logisticsScore=Math.max(0,Math.round((100-scorePenalty)*10)/10);
    const verdict=impossible?'INVIABLE':strained?'AJUSTAR TRASLADOS':unverified?'REQUIERE VERIFICACIÓN':'FACTIBLE';
    return {...day,segments,clusters:clusterStops(stops),maps_url:mapsDirectionsUrl(stops),metrics:{impossible_segments:impossible,strained_segments:strained,unverified_segments:unverified,geo_coverage:stops.length?Math.round(geoStops/stops.length*100):0,time_coverage:stops.length?Math.round(timedStops/stops.length*100):0,logistics_score:logisticsScore},verdict};
  }

  function analyzeTrip(profile = {}, research = {}) {
    const days=groupByDay(research.items || [], profile).map(analyzeDay);
    const totals=days.reduce((acc,day)=>{acc.impossible+=day.metrics.impossible_segments;acc.strained+=day.metrics.strained_segments;acc.unverified+=day.metrics.unverified_segments;acc.stops+=day.stops.length;acc.score+=day.metrics.logistics_score;return acc;},{impossible:0,strained:0,unverified:0,stops:0,score:0});
    const activeDays=days.filter(day=>day.stops.length).length;
    const score=activeDays?Math.round(totals.score/activeDays*10)/10:null;
    const verdict=totals.impossible?'REQUIERE REORDENAR':totals.strained?'FACTIBLE CON AJUSTES':totals.unverified?'FACTIBILIDAD PARCIAL':'LOGÍSTICA FACTIBLE';
    return {contract:'asc-travel-logistics-v1',generated_at:new Date().toISOString(),profile_id:profile.trip_id||null,destination:profile.destination_scope?.values?.join(', ')||research.destination||'',hotel:profile.planning?.hotel||null,days,metrics:{...totals,active_days:activeDays,logistics_score:score},verdict,methodology:{distance:'haversine_when_coordinates_exist',transfer:'conservative_estimate_from_straight_line_distance',unknown_data:'never_scored_as_zero'}};
  }

  window.TravelLogisticsCore={parseTime,haversineKm,transferEstimate,stopFromItem,groupByDay,temporalConflict,segmentAnalysis,clusterStops,mapsDirectionsUrl,analyzeDay,analyzeTrip};
})();
