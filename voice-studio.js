(() => {
  'use strict';

  const PREF_KEY = 'agci.voiceStudio.preferences.v1';
  const DATA_URL = 'podcast/latest.json';
  const $ = (s, r=document) => r.querySelector(s);
  const esc = (v='') => String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt = sec => { sec=Math.max(0,Math.round(Number(sec)||0)); return `${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`; };

  let episode = null;
  let prefs = readPrefs();
  let state = {playing:false, paused:false, preview:false, index:0, plan:[]};
  let observer = null;

  function readPrefs(){
    const fallback={voice:'cio-institucional',duration:'completo',speed:1};
    try { return {...fallback,...(JSON.parse(localStorage.getItem(PREF_KEY)||'null')||{})}; } catch { return fallback; }
  }
  function savePrefs(){ try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch {} }

  function installStyles(){
    if ($('#agciVoiceStudioStyles')) return;
    const style=document.createElement('style');
    style.id='agciVoiceStudioStyles';
    style.textContent=`
      .agci-voice-studio{margin:16px 0;padding:16px;border:1px solid #4c5055;background:#202328;color:#fff}
      .agci-voice-studio__head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;margin-bottom:12px}
      .agci-voice-studio__head h4{margin:2px 0 3px;font-size:17px;color:#fff}.agci-voice-studio__head p{margin:0;color:#b9b9b9;font-size:11px}
      .agci-voice-studio__badge{font-size:9px;letter-spacing:.08em;color:#e1a0a4;font-weight:800;white-space:nowrap}
      .agci-voice-studio__grid{display:grid;grid-template-columns:1.2fr 1fr .75fr;gap:10px}
      .agci-voice-field{display:grid;gap:5px}.agci-voice-field label{font-size:10px;color:#cfcfcf;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
      .agci-voice-field select{width:100%;min-height:42px;border:1px solid #5d6167;background:#17191c;color:#fff;padding:8px;font:inherit;font-size:12px}
      .agci-voice-studio__summary{margin:12px 0;padding:10px 12px;border-left:3px solid #8f1d24;background:#17191c;color:#d6d6d6;font-size:11px;line-height:1.45}
      .agci-voice-studio__actions{display:flex;flex-wrap:wrap;gap:8px}.agci-voice-studio button{min-height:42px;border:1px solid #fff;background:#fff;color:#17191c;padding:9px 12px;font:inherit;font-size:12px;font-weight:800;cursor:pointer}
      .agci-voice-studio button.secondary{background:transparent;color:#fff;border-color:#666}.agci-voice-studio button:disabled{opacity:.45;cursor:not-allowed}
      .agci-voice-studio__status{margin-top:10px;color:#b9b9b9;font-size:10px;min-height:15px}
      .agci-voice-studio__profile{margin-top:8px;color:#ddd;font-size:11px}.agci-voice-studio__profile strong{color:#fff}
      .agci-voice-studio__fallback{margin-top:8px;color:#8f9398;font-size:9px}
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
    const root=$('#morningContent')||document.body;
    observer.observe(root,{childList:true,subtree:true});
  }

  function profileOptions(router){
    return Object.values(router.profiles).map(p=>`<option value="${esc(p.id)}" ${prefs.voice===p.id?'selected':''}>${esc(p.label)}</option>`).join('');
  }
  function durationOptions(router){
    return Object.entries(router.durationPresets).map(([id,d])=>`<option value="${esc(id)}" ${prefs.duration===id?'selected':''}>${esc(d.label)}</option>`).join('');
  }
  function speedOptions(router){
    return router.speeds.map(v=>`<option value="${v}" ${Number(prefs.speed)===Number(v)?'selected':''}>${v}×</option>`).join('');
  }

  async function mount(player){
    if($('#agciVoiceStudio')) return;
    installStyles();
    const router=window.AGCIVoiceRouter;
    if(!router) return;
    try { episode=await loadEpisode(); await router.loadDictionary(); } catch(err) { console.warn('AGCI Voice Studio',err); return; }
    const box=document.createElement('section');
    box.id='agciVoiceStudio';
    box.className='agci-voice-studio';
    box.setAttribute('aria-labelledby','agciVoiceStudioTitle');
    box.innerHTML=`
      <div class="agci-voice-studio__head"><div><span class="agci-voice-studio__badge">FASE 3B · VOICE STUDIO</span><h4 id="agciVoiceStudioTitle">Personalice la narración</h4><p>La tesis y los hechos no cambian; sólo cambia la forma de escucharlos.</p></div><span class="agci-voice-studio__badge">ES-MX · LOCAL</span></div>
      <div class="agci-voice-studio__grid">
        <div class="agci-voice-field"><label for="agciVoiceProfile">Voz</label><select id="agciVoiceProfile">${profileOptions(router)}</select></div>
        <div class="agci-voice-field"><label for="agciVoiceDuration">Duración / enfoque</label><select id="agciVoiceDuration">${durationOptions(router)}</select></div>
        <div class="agci-voice-field"><label for="agciVoiceSpeed">Velocidad</label><select id="agciVoiceSpeed">${speedOptions(router)}</select></div>
      </div>
      <div id="agciVoiceSummary" class="agci-voice-studio__summary"></div>
      <div class="agci-voice-studio__actions">
        <button type="button" id="agciVoicePreview">▶ Escuchar muestra</button>
        <button type="button" id="agciVoiceListen">▶ Escuchar configuración</button>
        <button type="button" id="agciVoiceStop" class="secondary">■ Detener</button>
      </div>
      <div id="agciVoiceStatus" class="agci-voice-studio__status" aria-live="polite"></div>
      <div class="agci-voice-studio__fallback">Fallback: voz local del dispositivo → audio publicado eSpeak NG → transcripción. No se ha activado TTS de pago.</div>`;
    const existingPersonalize=player.querySelector('.morning-personalize');
    if(existingPersonalize) existingPersonalize.insertAdjacentElement('beforebegin',box); else player.appendChild(box);
    bind();
    renderSummary();
  }

  function renderSummary(){
    const router=window.AGCIVoiceRouter;
    if(!router||!episode)return;
    const profile=router.profiles[prefs.voice]||router.profiles['cio-institucional'];
    const preset=router.durationPresets[prefs.duration]||router.durationPresets.completo;
    const secs=router.estimateSeconds(episode,prefs.voice,prefs.duration,prefs.speed);
    const voices=router.available();
    $('#agciVoiceSummary').innerHTML=`<strong>${esc(profile.label)}</strong> · ${esc(preset.label)} · ${prefs.speed}× · duración estimada ${fmt(secs)}<div class="agci-voice-studio__profile">${esc(profile.description)} <strong>${voices.localVoices}</strong> voces en español detectadas en este dispositivo.</div>`;
  }

  function bind(){
    $('#agciVoiceProfile')?.addEventListener('change',e=>{prefs.voice=e.target.value;savePrefs();renderSummary();stopSpeech();});
    $('#agciVoiceDuration')?.addEventListener('change',e=>{prefs.duration=e.target.value;savePrefs();renderSummary();stopSpeech();});
    $('#agciVoiceSpeed')?.addEventListener('change',e=>{prefs.speed=Number(e.target.value)||1;savePrefs();renderSummary();stopSpeech();});
    $('#agciVoicePreview')?.addEventListener('click',preview);
    $('#agciVoiceListen')?.addEventListener('click',toggleFull);
    $('#agciVoiceStop')?.addEventListener('click',stopSpeech);
  }

  function previewText(){
    const signal=(episode.threeSignals||[])[0];
    const raw=`AGCI Morning Intelligence. ${episode.executiveSummary || ''} ${signal?`${signal.label}. ${signal.summary}`:''}`;
    return raw.split(/\s+/).slice(0,48).join(' ')+'.';
  }

  function speakerRole(chapter,index){
    const p=window.AGCIVoiceRouter.profiles[prefs.voice];
    if(p?.mode!=='dual') return 'CIO';
    if(chapter?.speaker) return String(chapter.speaker).toUpperCase();
    return index%2?'ANALISTA':'CIO';
  }

  function preview(){
    stopSpeech(false);
    if(!('speechSynthesis' in window)){fallbackMessage();return;}
    state.preview=true;
    const u=window.AGCIVoiceRouter.utteranceFor(previewText(),{profileId:prefs.voice,role:'CIO',speed:prefs.speed});
    if(!u){fallbackMessage();return;}
    u.onstart=()=>setStatus(`Muestra · ${window.AGCIVoiceRouter.profiles[prefs.voice].label}`);
    u.onend=()=>{state.preview=false;setStatus('Muestra terminada.');};
    u.onerror=()=>fallbackMessage();
    speechSynthesis.speak(u);
  }

  function toggleFull(){
    if(!('speechSynthesis' in window)){fallbackMessage();return;}
    if(state.playing && speechSynthesis.paused){speechSynthesis.resume();state.paused=false;setListenLabel('❚❚ Pausar configuración');setStatus(`Reanudando · capítulo ${state.index+1}/${state.plan.length}`);return;}
    if(state.playing && !state.paused){speechSynthesis.pause();state.paused=true;setListenLabel('▶ Reanudar configuración');setStatus(`Pausado · capítulo ${state.index+1}/${state.plan.length}`);return;}
    stopPublishedAudio();
    stopSpeech(false);
    state.plan=window.AGCIVoiceRouter.chapterPlan(episode,prefs.duration);
    if(!state.plan.length){setStatus('No hay capítulos disponibles para esta selección.');return;}
    state.index=0;state.playing=true;state.paused=false;state.preview=false;
    setListenLabel('❚❚ Pausar configuración');
    speakCurrent();
  }

  function speakCurrent(){
    if(!state.playing) return;
    const chapter=state.plan[state.index];
    if(!chapter){finishFull();return;}
    const role=speakerRole(chapter,state.index);
    const u=window.AGCIVoiceRouter.utteranceFor(`${chapter.title}. ${chapter.text}`,{profileId:prefs.voice,role,speed:prefs.speed});
    if(!u){fallbackMessage();return;}
    u.onstart=()=>setStatus(`${role} · ${chapter.title} · ${state.index+1}/${state.plan.length}`);
    u.onend=()=>{if(!state.playing)return;state.index+=1;if(state.index>=state.plan.length)finishFull();else speakCurrent();};
    u.onerror=()=>fallbackMessage();
    speechSynthesis.speak(u);
  }

  function finishFull(){state.playing=false;state.paused=false;state.index=0;setListenLabel('▶ Escuchar configuración');setStatus('Configuración terminada.');}
  function stopPublishedAudio(){const stop=$('#miStop');if(stop)stop.click();}
  function stopSpeech(update=true){
    if('speechSynthesis' in window)speechSynthesis.cancel();
    state={playing:false,paused:false,preview:false,index:0,plan:[]};
    setListenLabel('▶ Escuchar configuración');
    if(update)setStatus('Narración detenida.');
  }
  function setListenLabel(v){const b=$('#agciVoiceListen');if(b)b.textContent=v;}
  function setStatus(v){const s=$('#agciVoiceStatus');if(s)s.textContent=v;}
  function fallbackMessage(){stopSpeech(false);setStatus('La voz personalizada no está disponible en este navegador. Use el audio publicado o la transcripción.');}

  document.addEventListener('visibilitychange',()=>{if(document.hidden && state.preview) stopSpeech(false);});
  window.addEventListener('beforeunload',()=>stopSpeech(false));
  document.addEventListener('DOMContentLoaded',waitForPlayer);
  window.AGCIVoiceStudio={preferences:()=>({...prefs}),stop:()=>stopSpeech(false)};
})();
