(() => {
  'use strict';

  const ROUTER_VERSION = '1.0.0-phase3b';
  const DEFAULT_DICTIONARY_URL = 'pronunciation-dictionary.json';

  const PROFILES = {
    'cio-institucional': {
      id: 'cio-institucional',
      label: 'CIO Institucional',
      description: 'Maduro, sereno y con autoridad sin dramatismo.',
      mode: 'single',
      preferredGender: 'male',
      voiceTokens: ['jorge','diego','carlos','raul','enrique','male','hombre'],
      baseRate: 0.96,
      pitch: 0.92,
      volume: 1,
      wpm: 138
    },
    'private-banking': {
      id: 'private-banking',
      label: 'Private Banking',
      description: 'Elegante, cercana e institucional.',
      mode: 'single',
      preferredGender: 'female',
      voiceTokens: ['paulina','monica','mónica','sabina','helena','female','mujer'],
      baseRate: 0.99,
      pitch: 1.02,
      volume: 1,
      wpm: 142
    },
    'markets-desk': {
      id: 'markets-desk',
      label: 'Markets Desk',
      description: 'Más ágil y denso para seguimiento de mercado.',
      mode: 'single',
      preferredGender: 'neutral',
      voiceTokens: ['es-mx','mexico','mexican','spanish'],
      baseRate: 1.08,
      pitch: 0.98,
      volume: 1,
      wpm: 155
    },
    'executive-brief': {
      id: 'executive-brief',
      label: 'Executive Brief',
      description: 'Directo, conciso y orientado a decisiones.',
      mode: 'single',
      preferredGender: 'neutral',
      voiceTokens: ['es-mx','mexico','spanish'],
      baseRate: 1.12,
      pitch: 1,
      volume: 1,
      wpm: 165
    },
    'cio-analista': {
      id: 'cio-analista',
      label: 'CIO + Analista',
      description: 'Formato conversacional natural con dos voces.',
      mode: 'dual',
      preferredGender: 'dual',
      voiceTokens: [],
      baseRate: 1,
      pitch: 1,
      volume: 1,
      wpm: 145
    }
  };

  const DURATION_PRESETS = {
    completo: {label:'Completo · 8–12 min', ids:null},
    ejecutivo: {label:'Ejecutivo · 5–7 min', ids:['senales','mercados','inversion','mexico','acciones']},
    express: {label:'Express · 2–3 min', ids:['senales','mercados','acciones']},
    mercados: {label:'Sólo Mercados', ids:['senales','mercados']},
    inversiones: {label:'Sólo Inversiones', ids:['inversion']},
    'mexico-negocios': {label:'México + Negocios', ids:['mexico','capital','acciones']},
    'ia-tecnologia': {label:'IA + Tecnología', ids:['ia','inversion','acciones']},
    viajes: {label:'Viajes', ids:['viajes','acciones']}
  };

  const SPEEDS = [0.9, 1, 1.1, 1.25, 1.5, 1.75, 2];
  let dictionary = {terms:[]};

  function normalize(s='') {
    return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function spanishVoices() {
    if (!('speechSynthesis' in window)) return [];
    const voices = speechSynthesis.getVoices() || [];
    const spanish = voices.filter(v => /^es([_-]|$)/i.test(v.lang || ''));
    return spanish.length ? spanish : voices;
  }

  function scoreVoice(voice, profile, role='CIO') {
    const key = normalize(`${voice.name || ''} ${voice.lang || ''}`);
    let score = 0;
    if (/es-mx|es_mx|mexic/.test(key)) score += 40;
    else if (/^es/.test(normalize(voice.lang || ''))) score += 24;
    for (const token of profile.voiceTokens || []) if (key.includes(normalize(token))) score += 12;
    if (role === 'ANALISTA' && /(paulina|monica|sabina|helena|female|mujer)/.test(key)) score += 28;
    if (role === 'CIO' && /(jorge|diego|carlos|raul|enrique|male|hombre)/.test(key)) score += 20;
    if (voice.default) score += 5;
    return score;
  }

  function resolveVoice(profileId='cio-institucional', role='CIO') {
    const profile = PROFILES[profileId] || PROFILES['cio-institucional'];
    const voices = spanishVoices();
    if (!voices.length) return null;
    const ranked = voices.map(v => ({v, score:scoreVoice(v, profile, role)})).sort((a,b)=>b.score-a.score);
    if (profile.mode === 'dual' && role === 'ANALISTA') {
      const female = ranked.find(x => /(paulina|monica|mónica|sabina|helena|female|mujer)/i.test(`${x.v.name} ${x.v.lang}`));
      if (female) return female.v;
      return ranked[1]?.v || ranked[0]?.v || null;
    }
    return ranked[0]?.v || null;
  }

  async function loadDictionary(url=DEFAULT_DICTIONARY_URL) {
    try {
      const r = await fetch(`${url}?v=${Date.now()}`, {cache:'no-store'});
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      if (!Array.isArray(data.terms)) throw new Error('diccionario inválido');
      dictionary = data;
    } catch {
      dictionary = {terms:[]};
    }
    return dictionary;
  }

  function escapeRegex(v='') { return String(v).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

  function applyPronunciation(text='') {
    let out = String(text || '');
    for (const item of dictionary.terms || []) {
      if (!item?.match || !item?.speak) continue;
      const flags = item.caseSensitive ? 'g' : 'gi';
      out = out.replace(new RegExp(escapeRegex(item.match), flags), item.speak);
    }
    return out;
  }

  function chapterPlan(episode, preset='completo') {
    const chapters = Array.isArray(episode?.chapters) ? episode.chapters : [];
    const def = DURATION_PRESETS[preset] || DURATION_PRESETS.completo;
    if (!def.ids) return chapters;
    const byId = new Map(chapters.map(c => [String(c.id || '').toLowerCase(), c]));
    return def.ids.map(id => byId.get(id)).filter(Boolean);
  }

  function wordCount(text='') { return String(text).trim().split(/\s+/).filter(Boolean).length; }
  function estimateSeconds(episode, profileId='cio-institucional', preset='completo', speed=1) {
    const profile = PROFILES[profileId] || PROFILES['cio-institucional'];
    const words = chapterPlan(episode, preset).reduce((n,c)=>n+wordCount(`${c.title || ''} ${c.text || ''}`),0);
    return Math.max(20, Math.round((words / Math.max(80, profile.wpm * Number(speed || 1))) * 60));
  }

  function utteranceFor(text, {profileId='cio-institucional', role='CIO', speed=1}={}) {
    if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) return null;
    const profile = PROFILES[profileId] || PROFILES['cio-institucional'];
    const u = new SpeechSynthesisUtterance(applyPronunciation(text));
    const voice = resolveVoice(profileId, role);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'es-MX';
    u.rate = Math.min(2, Math.max(0.5, profile.baseRate * Number(speed || 1)));
    u.pitch = profile.mode === 'dual' && role === 'ANALISTA' ? 1.05 : profile.pitch;
    u.volume = profile.volume;
    return u;
  }

  function available() {
    return {
      browserSpeech: Boolean('speechSynthesis' in window && window.SpeechSynthesisUtterance),
      localVoices: spanishVoices().length,
      premiumProviderConfigured: false,
      openSourcePublishedAudio: true,
      fallbackChain: ['TTS premium (no configurado)','Voz local del dispositivo','Audio publicado eSpeak NG','Transcripción']
    };
  }

  window.AGCIVoiceRouter = {
    version: ROUTER_VERSION,
    profiles: PROFILES,
    durationPresets: DURATION_PRESETS,
    speeds: SPEEDS,
    loadDictionary,
    applyPronunciation,
    chapterPlan,
    estimateSeconds,
    resolveVoice,
    utteranceFor,
    available
  };
})();
