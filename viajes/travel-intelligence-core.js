(() => {
  'use strict';

  const EXPERIENCE_WEIGHTS = Object.freeze({ importance: 0.20, exclusivity: 0.15, date_match: 0.15, affinity: 0.15, value: 0.10, availability: 0.05, location: 0.05, quality: 0.10, cultural_relevance: 0.03, rarity: 0.02 });
  const OPPORTUNITY_WEIGHTS = Object.freeze({ date_match: 0.30, rarity: 0.25, exclusivity: 0.20, importance: 0.10, availability: 0.05, affinity: 0.05, value: 0.05 });
  const WINDOW_WEIGHTS = Object.freeze({ extraordinary_events: 0.25, price_quality: 0.20, flight: 0.15, lodging: 0.15, affinity: 0.10, weather: 0.05, saturation: 0.05, logistics: 0.05 });
  const MONTHS = Object.freeze({ enero:0,january:0,febrero:1,february:1,marzo:2,march:2,abril:3,april:3,mayo:4,may:4,junio:5,june:5,julio:6,july:6,agosto:7,august:7,septiembre:8,setiembre:8,september:8,octubre:9,october:9,noviembre:10,november:10,diciembre:11,december:11 });
  const SEASONS = Object.freeze({ primavera:[2,4],spring:[2,4],verano:[5,7],summer:[5,7],otono:[8,10],autumn:[8,10],fall:[8,10],invierno:[11,1],winter:[11,1] });

  const clamp = value => Math.max(0, Math.min(100, Number(value)));
  const finite = value => Number.isFinite(Number(value));
  const iso = date => new Date(date).toISOString().slice(0, 10);
  const utc = (year, month, day=1) => new Date(Date.UTC(year, month, day));
  const addDays = (value, days) => { const date = new Date(`${value}T00:00:00Z`); date.setUTCDate(date.getUTCDate()+days); return iso(date); };
  const daysBetween = (a,b) => Math.round((Date.parse(`${b}T00:00:00Z`)-Date.parse(`${a}T00:00:00Z`))/86400000);
  const textKey = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[–—]/g,'-').trim();
  const lastDay = (year, month) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  function weightedScore(signals = {}, weights = {}) {
    let totalWeight = 0;
    let weighted = 0;
    Object.entries(weights).forEach(([key, weight]) => {
      const value = signals?.[key];
      if (!finite(value)) return;
      totalWeight += Number(weight) || 0;
      weighted += clamp(value) * (Number(weight) || 0);
    });
    if (totalWeight <= 0) return null;
    return Math.round((weighted / totalWeight) * 10) / 10;
  }

  function classification(score) {
    if (!finite(score)) return 'PENDIENTE DE DATOS';
    if (score >= 90) return 'IMPERDIBLE';
    if (score >= 80) return 'MUY RECOMENDABLE';
    if (score >= 68) return 'RECOMENDABLE';
    if (score >= 55) return 'SI HAY TIEMPO';
    return 'PRESCINDIBLE';
  }

  function opportunityLabel(score) {
    if (!finite(score)) return 'PENDIENTE';
    if (score >= 92) return 'EXCEPCIONAL';
    if (score >= 80) return 'EXTRAORDINARIA';
    if (score >= 68) return 'BUEN VALOR';
    return 'NORMAL';
  }

  function windowVerdict(score, coverage = 0) {
    if (!finite(score)) return 'PENDIENTE DE DATOS';
    if (coverage < .35) return 'DATOS PARCIALES';
    if (score >= 88) return 'VENTANA EXCEPCIONAL';
    if (score >= 78) return 'MUY CONVENIENTE';
    if (score >= 68) return 'CONVENIENTE';
    if (score >= 58) return 'INTERESANTE';
    return 'DÉBIL FRENTE A ALTERNATIVAS';
  }

  function eventPremium(item = {}) {
    return finite(item.event_premium_pct) ? Math.round(Number(item.event_premium_pct) * 10) / 10 : null;
  }
  function scoreExperience(item = {}) { return weightedScore(item.signals || {}, EXPERIENCE_WEIGHTS); }
  function scoreOpportunity(item = {}, collisionBoost = 0) {
    const base = weightedScore(item.signals || {}, OPPORTUNITY_WEIGHTS);
    if (!finite(base)) return null;
    return Math.round(Math.min(100, base + Math.max(0, Number(collisionBoost) || 0)) * 10) / 10;
  }
  function travelWindowScore(factors = {}, customWeights = {}) { return weightedScore(factors, { ...WINDOW_WEIGHTS, ...(customWeights || {}) }); }

  function collisionEngine(items = []) {
    const candidates = (Array.isArray(items) ? items : []).filter(item => {
      const opportunity = finite(item.opportunity_index) ? Number(item.opportunity_index) : scoreOpportunity(item);
      return opportunity >= 82 && item.verification_status === 'confirmed';
    });
    const count = candidates.length;
    const detected = count >= 3;
    const boost = detected ? Math.min(8, 2 + (count - 3) * 1.5) : 0;
    return { detected, count, boost: Math.round(boost * 10) / 10, label: detected ? 'TRAVEL COLLISION DETECTED' : 'Sin colisión extraordinaria' };
  }

  function enrichItem(item = {}, collisionBoost = 0) {
    const experience = scoreExperience(item);
    const opportunity = scoreOpportunity(item, collisionBoost);
    return { ...item, asc_experience_score: experience, opportunity_index: opportunity, executive_classification: classification(experience), opportunity_label: opportunityLabel(opportunity), event_premium_pct: eventPremium(item) };
  }

  function scoreResearch(payload = {}) {
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    let items = rawItems.map(item => enrichItem(item, 0));
    const firstCollision = collisionEngine(items);
    if (firstCollision.detected) items = rawItems.map(item => enrichItem(item, firstCollision.boost));
    const collision = collisionEngine(items);
    const confirmed = items.filter(item => item.verification_status === 'confirmed').length;
    const extraordinary = items.filter(item => Number(item.opportunity_index) >= 80).length;
    return { ...payload, items, scoring: { contract: 'asc-travel-intelligence-v1', experience_weights: EXPERIENCE_WEIGHTS, opportunity_weights: OPPORTUNITY_WEIGHTS, window_weights: WINDOW_WEIGHTS }, metrics: { total_items: items.length, confirmed_items: confirmed, extraordinary_items: extraordinary, collision } };
  }

  function parseApproxPeriod(value, now = new Date()) {
    const raw = textKey(value);
    if (!raw) return null;
    const exact = raw.match(/(20\d{2})-(\d{2})-(\d{2})\D+(20\d{2})-(\d{2})-(\d{2})/);
    if (exact) {
      const start = `${exact[1]}-${exact[2]}-${exact[3]}`, end = `${exact[4]}-${exact[5]}-${exact[6]}`;
      if (Date.parse(start) <= Date.parse(end)) return { start, end, label: `${start} → ${end}`, basis: 'exact_range' };
    }
    const nextMonths = raw.match(/(?:proximos|siguientes|next)\s+(\d{1,2})\s+(?:mes|meses|month|months)/);
    if (nextMonths) {
      const count = Math.max(1, Math.min(12, Number(nextMonths[1])));
      const startDate = utc(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const endDate = new Date(startDate); endDate.setUTCMonth(endDate.getUTCMonth() + count); endDate.setUTCDate(endDate.getUTCDate() - 1);
      return { start: iso(startDate), end: iso(endDate), label: `Próximos ${count} meses`, basis: 'relative_months' };
    }
    const quarter = raw.match(/\bq([1-4])\s*(20\d{2})\b/);
    if (quarter) {
      const q = Number(quarter[1]), year = Number(quarter[2]), startMonth=(q-1)*3, endMonth=startMonth+2;
      return { start: iso(utc(year,startMonth,1)), end: iso(utc(year,endMonth,lastDay(year,endMonth))), label:`Q${q} ${year}`, basis:'quarter' };
    }
    const yearMatch = raw.match(/\b(20\d{2})\b/);
    let year = yearMatch ? Number(yearMatch[1]) : now.getUTCFullYear();
    const seasonName = Object.keys(SEASONS).find(name => new RegExp(`\\b${name}\\b`).test(raw));
    if (seasonName) {
      const [startMonth,endMonth] = SEASONS[seasonName];
      if (!yearMatch && startMonth < now.getUTCMonth()) year += 1;
      const endYear = endMonth < startMonth ? year + 1 : year;
      return { start: iso(utc(year,startMonth,1)), end: iso(utc(endYear,endMonth,lastDay(endYear,endMonth))), label:`${seasonName} ${year}`, basis:'calendar_season' };
    }
    const monthMatches = [...raw.matchAll(new RegExp(`\\b(${Object.keys(MONTHS).join('|')})\\b`,'g'))];
    if (monthMatches.length) {
      const first = MONTHS[monthMatches[0][1]], last = MONTHS[monthMatches[Math.min(1,monthMatches.length-1)][1]];
      if (!yearMatch && first < now.getUTCMonth()) year += 1;
      const endYear = last < first ? year + 1 : year;
      return { start: iso(utc(year,first,1)), end: iso(utc(endYear,last,lastDay(endYear,last))), label:String(value).trim(), basis:monthMatches.length > 1 ? 'month_range' : 'month' };
    }
    if (yearMatch) return { start:`${year}-01-01`, end:`${year}-12-31`, label:String(year), basis:'year' };
    return null;
  }

  function generateCandidateWindows(range, durationDays = 4, maxCandidates = 90) {
    if (!range?.start || !range?.end) return [];
    const duration = Math.max(2, Math.min(30, Math.round(Number(durationDays) || 4)));
    const totalStarts = daysBetween(range.start, range.end) - duration + 2;
    if (totalStarts <= 0) return [];
    const all = [];
    for (let offset=0; offset<totalStarts; offset++) {
      const start=addDays(range.start,offset), end=addDays(start,duration-1);
      all.push({ id:`w-${start.replaceAll('-','')}-${end.replaceAll('-','')}`, start, end, duration_days:duration, range_basis:range.basis || 'approximate' });
    }
    if (all.length <= maxCandidates) return all;
    const step=(all.length-1)/(maxCandidates-1), picked=[], seen=new Set();
    for(let i=0;i<maxCandidates;i++){const item=all[Math.round(i*step)];if(item&&!seen.has(item.id)){seen.add(item.id);picked.push(item);}}
    return picked;
  }

  function overlaps(window, item) {
    const start=String(item?.date_start || '').slice(0,10), end=String(item?.date_end || item?.date_start || '').slice(0,10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;
    return start <= window.end && end >= window.start;
  }

  function prelimWindow(window, items = []) {
    const matched=(Array.isArray(items)?items:[]).filter(item=>overlaps(window,item));
    const opp=matched.map(item=>Number(item.opportunity_index)).filter(Number.isFinite).sort((a,b)=>b-a);
    const affinity=matched.map(item=>Number(item.signals?.affinity)).filter(Number.isFinite);
    const value=matched.map(item=>Number(item.signals?.value)).filter(Number.isFinite);
    const premiums=matched.map(item=>Number(item.event_premium_pct)).filter(Number.isFinite);
    let extraordinary=null;
    if(opp.length){const top=opp.slice(0,3);const avg=top.reduce((a,b)=>a+b,0)/top.length;extraordinary=Math.min(100,opp[0]*.7+avg*.3+Math.min(9,Math.max(0,opp.length-1)*3));}
    const avgAffinity=affinity.length?affinity.reduce((a,b)=>a+b,0)/affinity.length:null;
    const avgValue=value.length?value.reduce((a,b)=>a+b,0)/value.length:null;
    const preliminary=weightedScore({extraordinary_events:extraordinary,affinity:avgAffinity},{extraordinary_events:.75,affinity:.25});
    return {...window,matched_items:matched.map(item=>item.id),opportunity_count:matched.length,extraordinary_events:finite(extraordinary)?Math.round(extraordinary*10)/10:null,affinity:finite(avgAffinity)?Math.round(avgAffinity*10)/10:null,event_value:finite(avgValue)?Math.round(avgValue*10)/10:null,event_premium_pct:premiums.length?Math.round((premiums.reduce((a,b)=>a+b,0)/premiums.length)*10)/10:null,preliminary_score:preliminary};
  }

  function shortlistWindows(windows = [], items = [], limit = 8) {
    const enriched=windows.map(window=>prelimWindow(window,items));
    const ranked=[...enriched].sort((a,b)=>(Number(b.preliminary_score)||-1)-(Number(a.preliminary_score)||-1)||(b.opportunity_count||0)-(a.opportunity_count||0));
    const selected=[], used=new Set();
    const add=item=>{if(item&&!used.has(item.id)&&selected.length<limit){used.add(item.id);selected.push(item);}};
    ranked.slice(0,Math.max(3,limit-3)).forEach(add);
    if(enriched.length){add(enriched[0]);add(enriched[Math.floor(enriched.length/2)]);add(enriched[enriched.length-1]);}
    ranked.forEach(add);
    return selected.slice(0,limit).sort((a,b)=>a.start.localeCompare(b.start));
  }

  function comparativeScores(windows, field) {
    const groups=new Map(), output={};
    windows.forEach(window=>{const obs=window?.[field];if(!finite(obs?.amount)||!obs?.currency)return;const currency=obs.currency.toUpperCase();if(!groups.has(currency))groups.set(currency,[]);groups.get(currency).push({id:window.id,value:Number(obs.amount)});});
    groups.forEach(values=>{if(values.length<2)return;const nums=values.map(x=>x.value), min=Math.min(...nums), max=Math.max(...nums);values.forEach(({id,value})=>{output[id]=max===min?75:Math.round((100-((value-min)/(max-min))*50)*10)/10;});});
    return output;
  }

  function mergeWindowResearch(shortlist = [], payload = {}) {
    const researched=Array.isArray(payload.windows)?payload.windows:[];
    const map=new Map(researched.map(item=>[item.id,item]));
    const raw=shortlist.map(base=>({...base,...(map.get(base.id)||{}),matched_items:base.matched_items,opportunity_count:base.opportunity_count,extraordinary_events:base.extraordinary_events,affinity:base.affinity,event_value:base.event_value,preliminary_score:base.preliminary_score}));
    const flightScores=comparativeScores(raw,'flight_observed'), lodgingScores=comparativeScores(raw,'lodging_observed');
    const totalRows=raw.map(window=>{const f=window.flight_observed,l=window.lodging_observed;if(finite(f?.amount)&&finite(l?.amount)&&f.currency&&l.currency&&f.currency.toUpperCase()===l.currency.toUpperCase())return {...window,total_observed:{amount:Number(f.amount)+Number(l.amount),currency:f.currency.toUpperCase()}};return window;});
    const totalScores=comparativeScores(totalRows,'total_observed');
    return totalRows.map(window=>{
      const priceQuality=finite(totalScores[window.id])?weightedScore({cost:totalScores[window.id],event_value:window.event_value},{cost:.7,event_value:.3}):null;
      const factors={extraordinary_events:window.extraordinary_events,price_quality:priceQuality,flight:flightScores[window.id]??null,lodging:lodgingScores[window.id]??null,affinity:window.affinity,weather:finite(window.weather?.score)?Number(window.weather.score):null,saturation:finite(window.saturation?.score)?Number(window.saturation.score):null,logistics:finite(window.logistics?.score)?Number(window.logistics.score):null};
      const score=travelWindowScore(factors), available=Object.values(factors).filter(finite).length, coverage=available/Object.keys(WINDOW_WEIGHTS).length;
      const premium=finite(window.event_premium?.value)?Number(window.event_premium.value):window.event_premium_pct;
      return {...window,event_premium_pct:finite(premium)?Math.round(Number(premium)*10)/10:null,factors,asc_travel_window_score:score,evidence_coverage:Math.round(coverage*100)/100,verdict:windowVerdict(score,coverage)};
    }).sort((a,b)=>(Number(b.asc_travel_window_score)||-1)-(Number(a.asc_travel_window_score)||-1)||(Number(b.preliminary_score)||-1)-(Number(a.preliminary_score)||-1));
  }

  function selectWindowStrategies(windows = []) {
    const pool=[...windows], used=new Set();
    const pick=(metric,label,key,requires=true)=>{const candidates=pool.filter(w=>!used.has(w.id)&&(!requires||finite(metric(w)))).sort((a,b)=>(Number(metric(b))||-Infinity)-(Number(metric(a))||-Infinity));const window=candidates[0]||null;if(window)used.add(window.id);return window?{key,label,window}:null;};
    const balance=pick(w=>w.asc_travel_window_score,'MEJOR FECHA GENERAL','balance');
    const opportunity=pick(w=>w.extraordinary_events??w.preliminary_score,'MEJOR OPORTUNIDAD','experience');
    const value=pick(w=>w.factors?.price_quality??weightedScore({flight:w.factors?.flight,lodging:w.factors?.lodging},{flight:.5,lodging:.5}),'MEJOR PRECIO / VALOR','save');
    return { balance, opportunity, value, top3:[balance,opportunity,value].filter(Boolean) };
  }

  window.TravelIntelligenceCore = { EXPERIENCE_WEIGHTS, OPPORTUNITY_WEIGHTS, WINDOW_WEIGHTS, weightedScore, classification, opportunityLabel, windowVerdict, eventPremium, scoreExperience, scoreOpportunity, travelWindowScore, collisionEngine, enrichItem, scoreResearch, parseApproxPeriod, generateCandidateWindows, overlaps, prelimWindow, shortlistWindows, mergeWindowResearch, selectWindowStrategies };
})();
