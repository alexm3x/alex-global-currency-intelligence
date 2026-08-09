(() => {
  'use strict';

  const PREF_KEY = 'agci.voiceStudio.preferences.v2';
  const DATA_URL = 'podcast/latest.json';
  const $ = (s, r=document) => r.querySelector(s);
  const esc = (v='') => String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = sec => { sec=Math.max(0,Math.round(Number(sec)||0)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; };
  const wordCount = text => String(text||'').trim().split(/\s+/).filter(Boolean).length;

  const MODES = {
    completo: {label:'Completo · 3–4 min', ids:['apertura','senales','mercados','inversion','mexico','capital','ia','viajes','acciones'], budget:470},
    ejecutivo: {label:'Ejecutivo · 2–3 min', ids:['senales','mercados','inversion','mexico','acciones'], budget:340},
    express: {label:'Express · 75–110 s', ids:['senales','mercados','acciones'], budget:220},
    mercados: {label:'Sólo Mercados · ~90 s', ids:['senales','mercados'], budget:200},
    inversiones: {label:'Sólo Inversiones · ~75 s', ids:['inversion','acciones'], budget:180},
    'mexico-negocios': {label:'México + Negocios · ~2 min', ids:['mexico','capital','acciones'], budget:250},
    'ia-tecnologia': {label:'IA + Tecnología · ~2 min', ids:['ia','inversion','acciones'], budget:250},
    viajes: {label:'Viajes · ~75 s', ids:['viajes','acciones'], budget:170}
  };

  let episode = null;
  let prefs = readPrefs();
  let state = {playing:false, paused:false, preview:false, index:0, plan:[], timer:null, startedAt:0, elapsedBase:0, estimate:0};
  let observer = null;

  function readPrefs(){
    const fallback={voice:'private-banking',duration:'completo',speed:1};
    try { return {...fallback,...(JSON.parse(localStorage.getItem(PREF_KEY)||'null')||{})}; } catch { return fallback; }
  }
  function savePrefs(){ try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} }

  function trimSentences(text, maxWords){
    const input=String(text||'').replace(/\s+/g,' ').trim();
    if(wordCount(input)<=maxWords)return input;
    const sentences=input.split(/(?<=[.!?])\s+/).filter(Boolean);
    const out=[];let n=0;
    for(const s of sentences){const w=wordCount(s);if(out.length&&n+w>maxWords)break;out.push(s);n+=w;if(n>=maxWords)break;}
    return out.length?out.join(' '):input.split(/\s+/).slice(0,maxWords).join(' ')+'.';
  }

  function installStyles(){
    if ($('#agciVoiceStudioStyles')) return;
    const style=document.createElement('style');
    style.id='agciVoiceStudioStyles';
    style.textContent=`
      .agci-voice-studio{margin:14px 0;padding:16px;border:1px solid #4c5055;background:#202328;color:#fff}
      .agci-voice-studio__head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:12px}
      .agci-voice-studio__head h4{margin:2px 0 3px;font-size:17px;color:#fff}.agci-voice-studio__head p{margin:0;color:#b9b9b9;font-size:11px;line-height:1.45}
      .agci-voice-studio__badge{font-size:9px;letter-spacing:.08em;color:#e1a0a4;font-weight:800;white-space:nowrap}
      .agci-voice-studio__grid{display:grid;grid-template-columns:1.2fr 1fr .75fr;gap:10px}
      .agci-voice-field{display:grid;gap:5px}.agci-voice-field label{font-size:10px;color:#cfcfcf;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
      .agci-voice-field select{width:100%;min-height:44px;border:1px solid #5d6167;background:#17191c;color:#fff;padding:8px;font:inherit;font-size:12px}
      .agci-voice-studio__summary{margin:12px 0;padding:10px 12px;border-left:3px solid #8f1d24;background:#17191c;color:#d6d6d6;font-size:11px;line-height:1.45}
      .agci-voice-studio__actions{display:flex;flex-wrap:wrap;gap:8px}.agci-voice-studio button{min-height:44px;border:1px solid #fff;background:#fff;color:#17191c;padding:9px 12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
      .agci-voice-studio button.secondary{background:transparent;color:#fff;border-color:#666}.agci-voice-studio button:disabled{opacity:.45;cursor:not-allowed}
      .agci-voice-studio__status{margin-top:10px;color:#d0d0d0;font-size:10px;min-height:15px}.agci-voice-studio__profile{margin-top:8px;color:#ddd;font-size:11px}.agci-voice-studio__profile strong{color:#fff}
      .agci-voice-studio__fallback{margin-top:8px;color:#8f9398;font-size:9px}.agci-natural-badge{display:inline-flex;align-items:center;gap:6px;margin:0 0 8px;padding:5px 8px;border:1px solid #6b6f75;color:#fff;font-size:9px;font-weight:800;letter-spacing:.05em}
      @media(max-width:820px){.agci-voice-studio__grid{grid-template-columns:1fr}.agci-voice-studio__actions{display:grid;grid-template-columns:1fr 1fr}.agci-voice-studio button{width:100%}}
      @media(max-width:440px){.agci-voice-studio{padding:13px}.agci-voice-studio__head{flex-direction:column}.agci-voice-studio__actions{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  async function loadEpisode(){
    const r=await fetch(`${DATA_URL}?v=${Date.now()}`,{cache:'no-store'});
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    if(!d?.date||!Array.isArray(d.chapters)||!d.chapters.length) throw new Error('Episodio inválido');
    return d;
  }

  function waitForPlayer(){
    const player=$('#morningContent .morning-player');
    if(player){ mount(player); return; }
    observer=new MutationObserver(()=>{const p=$('#morningContent .morning-player');if(p){observer.disconnect();mount(p);}});
    observer.observe($('#morningContent')||document.body,{childList:true,subtree:true});
  }

  function profileOptions(router){return Object.values(router.profiles).map(p=>`<option value="${esc(p.id)}" ${prefs.voice===p.id?'selected':''}>${esc(p.label)}</option>`).join('');}
  function durationOptions(){return Object.entries(MODES).map(([id,d])=>`<option value="${esc(id)}" ${prefs.duration===id?'selected':''}>${esc(d.label)}</option>`).join('');}
  function speedOptions(router){return router.speeds.map(v=>`<option value="${v}" ${Number(prefs.speed)===Number(v)?'selected':''}>${v}×</option>`).join('');}

  function buildPlan(){
    const mode=MODES[prefs.duration]||MODES.completo;
    const map=new Map((episode.chapters||[]).map(c=>[String(c.id||'').toLowerCase(),c]));
    const selected=mode.ids.map(id=>map.get(id)).filter(Boolean);
    const per=Math.max(25,Math.floor(mode.budget/Math.max(1,selected.length)));
    let used=0;
    return selected.map((c,i)=>{
      const remaining=mode.budget-used;
      const slots=selected.length-i;
      const allowance=Math.max(22,Math.min(per,Math.floor(remaining/slots)+8));
      const text=trimSentences(c.text,allowance);
      used+=wordCount(`${c.title} ${text}`);
      return {...c,text};
    });
  }

  function estimatePlan(plan){
    const router=window.AGCIVoiceRouter;
    const profile=router?.profiles?.[prefs.voice]||router?.profiles?.['private-banking'];
    const wpm=Math.max(120,(profile?.wpm||145)*Number(prefs.speed||1));
    return Math.min(240,Math.max(45,Math.round(plan.reduce((n,c)=>n+wordCount(`${c.title} ${c.text}`),0)/wpm*60)));
  }

  async function mount(player){
    if($('#agciVoiceStudio')) return;
    installStyles();
    const router=window.AGCIVoiceRouter;
    if(!router) return;
    try { episode=await loadEpisode(); await router.loadDictionary(); } catch(err) { console.warn('AGCI Voice Studio',err); return; }
    const box=document.createElement('section');
    box.id='agciVoiceStudio';box.className='agci-voice-studio';box.setAttribute('aria-labelledby','agciVoiceStudioTitle');
    box.innerHTML=`
      <div class="agci-voice-studio__head"><div><span class="agci-voice-studio__badge">NATURAL FIRST · ≤4 MIN</span><h4 id="agciVoiceStudioTitle">Morning Intelligence — voz natural</h4><p>eSpeak deja de ser la experiencia principal. AGCI utiliza primero la mejor voz en español disponible en este dispositivo.</p></div><span class="agci-voice-studio__badge">ES-MX</span></div>
      <div class="agci-voice-studio__grid">
        <div class="agci-voice-field"><label for="agciVoiceProfile">Estilo de voz</label><select id="agciVoiceProfile">${profileOptions(router)}</select></div>
        <div class="agci-voice-field"><label for="agciVoiceDuration">Duración / enfoque</label><select id="agciVoiceDuration">${durationOptions()}</select></div>
        <div class="agci-voice-field"><label for="agciVoiceSpeed">Velocidad</label><select id="agciVoiceSpeed">${speedOptions(router)}</select></div>
      </div>
      <div id="agciVoiceSummary" class="agci-voice-studio__summary"></div>
      <div class="agci-voice-studio__actions"><button type="button" id="agciVoicePreview">▶ Escuchar muestra</button><button type="button" id="agciVoiceListen">▶ Escuchar podcast</button><button type="button" id="agciVoiceStop" class="secondary">■ Detener</button></div>
      <div id="agciVoiceStatus" class="agci-voice-studio__status" aria-live="polite"></div>
      <div class="agci-voice-studio__fallback">El MP3 eSpeak queda únicamente como respaldo técnico temporal. No se activó ningún TTS de pago.</div>`;
    const oldPersonalize=player.querySelector('.morning-personalize');
    if(oldPersonalize) oldPersonalize.insertAdjacentElement('beforebegin',box); else player.prepend(box);
    bind();
    makeNaturalPrimary();
    renderSummary();
  }

  function renderSummary(){
    const router=window.AGCIVoiceRouter;if(!router||!episode)return;
    const profile=router.profiles[prefs.voice]||router.profiles['private-banking'];
    const plan=buildPlan();const secs=estimatePlan(plan);state.estimate=secs;
    const voices=router.available();
    $('#agciVoiceSummary').innerHTML=`<span class="agci-natural-badge">VERSIÓN EJECUTIVA · ${fmt(secs)}</span><br><strong>${esc(profile.label)}</strong> · ${esc((MODES[prefs.duration]||MODES.completo).label)} · ${prefs.speed}×<div class="agci-voice-studio__profile">${esc(profile.description)} <strong>${voices.localVoices}</strong> voces en español detectadas. Límite absoluto de la experiencia principal: 4:00.</div>`;
    const fresh=$('#morningFreshness');if(fresh)fresh.textContent=`${episode.date} · versión natural ${fmt(secs)}`;
  }

  function bind(){
    $('#agciVoiceProfile')?.addEventListener('change',e=>{prefs.voice=e.target.value;savePrefs();stopSpeech(false);renderSummary();});
    $('#agciVoiceDuration')?.addEventListener('change',e=>{prefs.duration=e.target.value;savePrefs();stopSpeech(false);renderSummary();});
    $('#agciVoiceSpeed')?.addEventListener('change',e=>{prefs.speed=Number(e.target.value)||1;savePrefs();stopSpeech(false);renderSummary();});
    $('#agciVoicePreview')?.addEventListener('click',preview);
    $('#agciVoiceListen')?.addEventListener('click',toggleFull);
    $('#agciVoiceStop')?.addEventListener('click',()=>stopSpeech(true));
  }

  function makeNaturalPrimary(){
    const play=$('#miPlay'),mini=$('#miMiniPlay'),stop=$('#miStop'),back=$('#miBack'),forward=$('#miForward');
    if(play){play.innerHTML='▶ <span>Escuchar versión natural · ≤4 min</span>';play.addEventListener('click',interceptPlay,true);}
    mini?.addEventListener('click',interceptPlay,true);
    stop?.addEventListener('click',interceptStop,true);
    back?.addEventListener('click',e=>{if(!state.playing)return;e.preventDefault();e.stopImmediatePropagation();jump(-1);},true);
    forward?.addEventListener('click',e=>{if(!state.playing)return;e.preventDefault();e.stopImmediatePropagation();jump(1);},true);
    const note=$('.morning-tech-note');if(note)note.textContent='Experiencia principal: voz natural del dispositivo. MP3 sintético anterior: sólo respaldo temporal.';
  }

  function interceptPlay(e){
    if(!('speechSynthesis' in window))return;
    e.preventDefault();e.stopImmediatePropagation();toggleFull();
  }
  function interceptStop(e){if(!state.playing&&!state.paused)return;e.preventDefault();e.stopImmediatePropagation();stopSpeech(true);}

  function previewText(){
    const signal=(episode.threeSignals||[])[0];
    return trimSentences(`Buenos días. Este es AGCI Morning Intelligence. ${episode.executiveSummary||''} ${signal?`${signal.label}. ${signal.summary}`:''}`,55);
  }

  function preview(){
    stopSpeech(false);
    if(!('speechSynthesis' in window)){setStatus('Este dispositivo no ofrece una voz natural compatible.');return;}
    state.preview=true;
    const u=window.AGCIVoiceRouter.utteranceFor(previewText(),{profileId:prefs.voice,role:'CIO',speed:prefs.speed});
    if(!u){setStatus('No encontré una voz española utilizable en este dispositivo.');return;}
    u.onstart=()=>setStatus(`Muestra · ${window.AGCIVoiceRouter.profiles[prefs.voice].label}`);
    u.onend=()=>{state.preview=false;setStatus('Muestra terminada.');};
    u.onerror=()=>setStatus('La muestra de voz no pudo reproducirse.');
    speechSynthesis.speak(u);
  }

  function toggleFull(){
    if(!('speechSynthesis' in window)){setStatus('La voz natural no está disponible; utilice la transcripción.');return;}
    if(state.playing && speechSynthesis.paused){speechSynthesis.resume();state.paused=false;setStatus('Reanudando podcast.');setLabels(true);return;}
    if(state.playing && !state.paused){speechSynthesis.pause();state.paused=true;setStatus('Podcast pausado.');setLabels(false,true);return;}
    stopPublishedAudio();stopSpeech(false);
    state.plan=buildPlan();state.index=0;state.playing=true;state.paused=false;state.preview=false;state.estimate=estimatePlan(state.plan);state.startedAt=Date.now();state.elapsedBase=0;
    setLabels(true);speakCurrent();
  }

  function speakerRole(chapter,index){const p=window.AGCIVoiceRouter.profiles[prefs.voice];if(p?.mode!=='dual')return'CIO';return chapter?.speaker?String(chapter.speaker).toUpperCase():(index%2?'ANALISTA':'CIO');}

  function speakCurrent(){
    if(!state.playing)return;
    const chapter=state.plan[state.index];if(!chapter){finishFull();return;}
    const role=speakerRole(chapter,state.index);
    const u=window.AGCIVoiceRouter.utteranceFor(`${chapter.title}. ${chapter.text}`,{profileId:prefs.voice,role,speed:prefs.speed});
    if(!u){setStatus('No se pudo resolver una voz natural.');stopSpeech(false);return;}
    u.onstart=()=>setStatus(`${role} · ${chapter.title} · ${state.index+1}/${state.plan.length}`);
    u.onend=()=>{if(!state.playing)return;state.index+=1;if(state.index>=state.plan.length)finishFull();else speakCurrent();};
    u.onerror=()=>{setStatus('La voz natural se interrumpió. Puede reintentar o abrir la transcripción.');stopSpeech(false);};
    speechSynthesis.speak(u);
  }

  function jump(delta){if(!state.plan.length)return;speechSynthesis.cancel();state.index=Math.max(0,Math.min(state.plan.length-1,state.index+delta));state.playing=true;state.paused=false;speakCurrent();}
  function finishFull(){state.playing=false;state.paused=false;state.index=0;setLabels(false);setStatus('Morning Intelligence terminado.');}
  function stopPublishedAudio(){const a=document.querySelector('audio');if(a){try{a.pause();a.currentTime=0;}catch{}}}
  function stopSpeech(update=true){if('speechSynthesis'in window)speechSynthesis.cancel();if(state.timer)clearInterval(state.timer);state={playing:false,paused:false,preview:false,index:0,plan:[],timer:null,startedAt:0,elapsedBase:0,estimate:0};setLabels(false);if(update)setStatus('Narración detenida.');}
  function setLabels(active,paused=false){const studio=$('#agciVoiceListen');if(studio)studio.textContent=active&&!paused?'❚❚ Pausar podcast':paused?'▶ Reanudar podcast':'▶ Escuchar podcast';const main=$('#miPlay');if(main)main.innerHTML=active&&!paused?'❚❚ <span>Pausar</span>':paused?'▶ <span>Reanudar versión natural</span>':'▶ <span>Escuchar versión natural · ≤4 min</span>';const mini=$('#miMiniPlay');if(mini)mini.textContent=active&&!paused?'❚❚':'▶';}
  function setStatus(v){const s=$('#agciVoiceStatus');if(s)s.textContent=v;}

  document.addEventListener('visibilitychange',()=>{if(document.hidden&&state.preview)stopSpeech(false);});
  window.addEventListener('beforeunload',()=>stopSpeech(false));
  document.addEventListener('DOMContentLoaded',waitForPlayer);
  window.AGCIVoiceStudio={preferences:()=>({...prefs}),stop:()=>stopSpeech(false),play:toggleFull};
})();
