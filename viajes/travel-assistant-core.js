(() => {
  'use strict';

  const VERSION = 'travel-data-v4';
  const CONCERN_RULES = {
    security: 'Priorizar destinos con mejor perfil de riesgo y fuentes verificables.',
    hidden_costs: 'Penalizar datos incompletos y comparar costo total, no tarifa publicitaria.',
    visa: 'Verificar requisitos migratorios antes de considerar la opción ejecutable.',
    weather: 'Advertir estacionalidad y clima cuando la fuente no esté disponible.',
    layovers: 'Penalizar conectividad baja y trayectos con fricción logística.',
    fatigue: 'Favorecer trayectos directos y menor tiempo puerta a puerta.',
    lodging_quality: 'Elevar el peso de calidad, ubicación y confianza del alojamiento.',
    location: 'Priorizar zonas convenientes y enlaces de verificación de ubicación.',
    food: 'Mantener alimentación como restricción de verificación previa.',
    accessibility: 'Excluir opciones que no puedan confirmar accesibilidad requerida.',
    cancellation: 'Exigir verificación de flexibilidad y políticas antes de reservar.',
    fx: 'Elevar el peso de ventaja cambiaria y medios de pago.',
    connectivity: 'Elevar el peso de conectividad y trabajo remoto.',
    crowds: 'Advertir saturación turística y favorecer fechas flexibles.'
  };

  const clamp = (value, min, max, fallback = min) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? Math.min(max, Math.max(min, numeric)) : fallback;
  };

  const text = (value, max = 500) => String(value ?? '')
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/<\/?(?:script|style|iframe)[^>]*>/gi, '')
    .replace(/\b(?:ignore|override|reveal|expose)\s+(?:all\s+)?(?:previous|system|developer|secret|prompt|instruction)s?\b/gi, '[contenido no operativo]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

  const list = (value, max = 20) => [...new Set((Array.isArray(value) ? value : [])
    .map(item => text(item, 120))
    .filter(Boolean))].slice(0, max);

  const integer = (value, min, max, fallback) => Math.round(clamp(value, min, max, fallback));

  function tripId() {
    if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
    return `trip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function nightsBetween(start, end, fallback = 7) {
    const startTime = Date.parse(`${start || ''}T12:00:00`);
    const endTime = Date.parse(`${end || ''}T12:00:00`);
    if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) return fallback;
    return Math.max(1, Math.round((endTime - startTime) / 86400000));
  }

  function deriveFromComments(comments) {
    const clean = text(comments, 1500);
    if (!clean) return { preferences: [], constraints: [] };
    const lower = clean.toLowerCase();
    const preferences = [];
    const constraints = [];
    const preferenceSignals = {
      gastronom: 'gastronomía', golf: 'golf', buce: 'buceo', playa: 'playa y descanso',
      esqu: 'esquí', museo: 'cultura e historia', cultur: 'cultura e historia',
      spa: 'bienestar y spa', compr: 'compras', negocio: 'negocios y conectividad'
    };
    Object.entries(preferenceSignals).forEach(([needle, label]) => {
      if (lower.includes(needle)) preferences.push(label);
    });
    const constraintSignals = [
      [/\b(sin escalas|vuelo directo obligatorio)\b/, 'Vuelo directo obligatorio'],
      [/\b(no|evitar)\s+(?:quiero\s+)?(?:zona\s+)?peligros/i, 'Evitar zonas con riesgo de seguridad'],
      [/\b(alergia|celiac|sin gluten|movilidad reducida|silla de ruedas)\b/i, 'Necesidad personal que requiere verificación previa'],
      [/\b(no reembolsable|cancelaci[oó]n flexible)\b/i, 'Política de cancelación verificable']
    ];
    constraintSignals.forEach(([pattern, label]) => {
      if (pattern.test(clean)) constraints.push(label);
    });
    return { preferences: list(preferences), constraints: list(constraints) };
  }

  function createProfile(raw = {}) {
    const adults = integer(raw.adults, 1, 12, 1);
    const childCount = integer(raw.childCount ?? raw.minors, 0, 8, 0);
    const childAges = (Array.isArray(raw.childAges) ? raw.childAges : [])
      .slice(0, childCount)
      .map(age => integer(age, 0, 17, 8));
    while (childAges.length < childCount) childAges.push(8);
    const start = /^\d{4}-\d{2}-\d{2}$/.test(raw.start || '') ? raw.start : null;
    const end = /^\d{4}-\d{2}-\d{2}$/.test(raw.end || '') ? raw.end : null;
    const comments = text(raw.comments, 1500);
    const derived = deriveFromComments(comments);
    const concerns = list(raw.concerns);
    const hardConstraints = list([
      ...(raw.hardConstraints || []),
      ...derived.constraints,
      ...(concerns.includes('accessibility') ? ['Accesibilidad verificable'] : []),
      ...(raw.directPreference === 'required' ? ['Vuelo directo obligatorio'] : [])
    ]);
    const destinationMode = ['fixed', 'region', 'open'].includes(raw.destinationMode)
      ? raw.destinationMode
      : text(raw.destination, 120) ? 'fixed' : 'open';
    const destinationValues = destinationMode === 'open'
      ? []
      : list([raw.destination, ...(raw.destinationValues || [])], 8);
    const amount = clamp(raw.budgetAmount, 0, 1_000_000_000, 0);
    const rooms = integer(raw.rooms, 1, 8, 1);
    const nights = nightsBetween(start, end, integer(raw.nightsMin, 1, 60, 7));
    const basis = ['total', 'person', 'night'].includes(raw.budgetBasis) ? raw.budgetBasis : 'total';
    const normalizedTotal = basis === 'person'
      ? amount * (adults + childCount)
      : basis === 'night' ? amount * rooms * nights : amount;

    return {
      schema_version: VERSION,
      trip_id: text(raw.tripId, 80) || tripId(),
      created_at: raw.createdAt || new Date().toISOString(),
      origin: {
        city: text(raw.originCity || raw.origin, 120),
        airports: list(raw.originAirports?.length ? raw.originAirports : [raw.origin || 'MEX'], 5)
      },
      destination_scope: { mode: destinationMode, values: destinationValues },
      dates: {
        start, end, month: text(raw.month, 7) || null,
        flex_days: integer(raw.flexDays, 0, 31, 0),
        nights_min: integer(raw.nightsMin, 1, 60, nights),
        nights_max: integer(raw.nightsMax, 1, 90, nights)
      },
      travelers: {
        adults, children: childAges, rooms,
        relation: text(raw.groupType, 40) || 'solo',
        room_preferences: list(raw.roomPreferences),
        accessibility: text(raw.accessibility, 500)
      },
      budget: {
        amount, normalized_total: normalizedTotal,
        currency: /^[A-Z]{3}$/.test(raw.currency || '') ? raw.currency : 'MXN',
        basis,
        includes: list(raw.budgetIncludes?.length ? raw.budgetIncludes : ['flights', 'lodging', 'destination']),
        strictness: ['strict', 'moderate', 'opportunity'].includes(raw.strictness) ? raw.strictness : 'moderate',
        contingency_pct: integer(raw.contingencyPct, 0, 50, 10)
      },
      transport: {
        cabin: ['economy', 'premium', 'business', 'first'].includes(raw.cabin) ? raw.cabin : 'economy',
        direct_preference: ['required', 'preferred', 'indifferent'].includes(raw.directPreference) ? raw.directPreference : 'preferred',
        max_stops: integer(raw.maxStops, 0, 4, raw.directPreference === 'required' ? 0 : 1),
        max_total_hours: raw.maxTotalHours ? clamp(raw.maxTotalHours, 1, 72, null) : null
      },
      lodging: {
        types: list(raw.lodgingTypes?.length ? raw.lodgingTypes : ['hotel']),
        category_min: raw.categoryMin ? clamp(raw.categoryMin, 1, 5, null) : null,
        location_preferences: list(raw.locationPreferences)
      },
      priorities: list([...(raw.priorities || []), ...derived.preferences], 10),
      hard_constraints: hardConstraints,
      concerns,
      concern_rules: concerns.map(key => CONCERN_RULES[key]).filter(Boolean),
      free_comments: comments,
      derived_preferences: derived.preferences,
      clarifications: [],
      consent: { search_confirmed: false, save_profile: Boolean(raw.saveProfile) }
    };
  }

  function validateProfile(profile) {
    const errors = [];
    if (profile?.schema_version !== VERSION) errors.push('schema_version');
    if (!profile?.origin?.airports?.length) errors.push('origin');
    if (!profile?.budget?.amount || profile.budget.amount <= 0) errors.push('budget.amount');
    if ((profile?.travelers?.adults || 0) < 1) errors.push('travelers.adults');
    if ((profile?.travelers?.rooms || 0) < 1) errors.push('travelers.rooms');
    if (profile?.destination_scope?.mode !== 'open' && !profile.destination_scope.values.length) errors.push('destination_scope.values');
    if (profile?.dates?.start && profile?.dates?.end && Date.parse(profile.dates.end) <= Date.parse(profile.dates.start)) errors.push('dates.range');
    return { valid: errors.length === 0, errors };
  }

  function analyzeProfile(profile) {
    const validation = validateProfile(profile);
    const travelers = profile.travelers.adults + profile.travelers.children.length;
    const business = ['business', 'first'].includes(profile.transport.cabin);
    const budgetPerTraveler = profile.budget.normalized_total / Math.max(1, travelers);
    const tensions = [];
    if (business && budgetPerTraveler < 90000) tensions.push('presupuesto frente a cabina premium');
    if (profile.transport.direct_preference === 'required' && profile.destination_scope.mode === 'open') tensions.push('vuelo directo frente a destino abierto');
    if (profile.dates.flex_days === 0 && profile.budget.strictness === 'strict') tensions.push('fechas fijas frente a presupuesto estricto');
    if (profile.travelers.rooms > travelers) tensions.push('habitaciones frente al número de viajeros');
    let viability = validation.valid ? 'high' : 'low';
    if (validation.valid && tensions.length) viability = business && budgetPerTraveler < 45000 ? 'low' : 'medium';
    const strategy = profile.destination_scope.mode === 'open'
      ? 'Comparar destinos por costo total, conectividad, FX y prioridades; excluir primero cualquier opción que exceda las restricciones confirmadas.'
      : `Priorizar ${profile.destination_scope.values.join(', ')} y comparar fechas flexibles, costo total y calidad antes de abrir alternativas cercanas.`;
    return {
      viability,
      tension: tensions[0] || 'No se detecta una tensión material inicial.',
      strategy,
      travelers,
      nights: nightsBetween(profile.dates.start, profile.dates.end, profile.dates.nights_min),
      validation
    };
  }

  function destinationMatches(destination, profile) {
    if (!profile || profile.destination_scope.mode === 'open') return true;
    const wanted = profile.destination_scope.values.map(value => value.toLowerCase());
    if (!wanted.length) return true;
    const haystack = [destination.city, destination.country, destination.airport, ...(destination.tags || [])]
      .join(' ').toLowerCase();
    return wanted.some(value => haystack.includes(value) || value.includes((destination.country || '').toLowerCase()));
  }

  function scoreAdjustment(destination, profile) {
    if (!profile) return 0;
    let score = 0;
    const haystack = [destination.city, destination.country, destination.why_value, ...(destination.tags || [])].join(' ').toLowerCase();
    score += profile.priorities.filter(priority => haystack.includes(priority.toLowerCase().split(' ')[0])).length * 4;
    if (profile.concerns.includes('security')) score += ((Number(destination.riskScore) || 50) - 50) * .08;
    if (profile.concerns.includes('layovers') || profile.concerns.includes('fatigue')) score += ((Number(destination.connectivityScore ?? destination.connectivity_score) || 50) - 50) * .06;
    if (profile.concerns.includes('hidden_costs')) score += ((Number(destination.confidence) || .5) - .5) * 12;
    if (profile.concerns.includes('fx')) score += Math.max(-4, Math.min(4, Number(destination.fx_advantage_pct) || 0));
    return score;
  }

  function selectRecommendations(eligible = [], ranked = []) {
    const pool = eligible.length ? eligible : ranked;
    if (!pool.length) return [];
    const categories = [
      ['Mejor equilibrio', [...pool].sort((a, b) => (b.query_score || 0) - (a.query_score || 0))[0]],
      ['Mejor precio', [...pool].sort((a, b) => (a.budgetAssessment?.total || Infinity) - (b.budgetAssessment?.total || Infinity))[0]],
      ['Mejor experiencia', [...pool].sort((a, b) => (b.qualityScore ?? b.quality_score ?? 0) - (a.qualityScore ?? a.quality_score ?? 0))[0]]
    ];
    const used = new Set();
    const output = [];
    for (const [label, preferred] of categories) {
      const candidate = [preferred, ...pool, ...ranked].find(item => item && !used.has(item.id));
      if (!candidate) continue;
      used.add(candidate.id);
      output.push({ ...candidate, recommendationLabel: label });
    }
    return output;
  }

  window.TravelAssistantCore = {
    VERSION,
    CONCERN_RULES,
    createProfile,
    validateProfile,
    analyzeProfile,
    destinationMatches,
    scoreAdjustment,
    selectRecommendations,
    sanitizeText: text,
    nightsBetween
  };
  if (window.TravelDataV4) {
    window.TravelDataV4.normalizeTripProfile = createProfile;
    window.TravelDataV4.validateTripProfile = validateProfile;
    window.TravelDataV4.trip_profile = { schema_version: VERSION };
  }
})();
