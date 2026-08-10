(() => {
  'use strict';

  const DATA_URL = 'podcast/latest.json';
  const $ = (s, r=document) => r.querySelector(s);

  async function loadEpisode() {
    const r = await fetch(`${DATA_URL}?v=${Date.now()}`, {cache:'no-store'});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  function decorate(episode) {
    const player = $('#morningContent .morning-player');
    if (!player || $('#agciPublishedVoiceStatus')) return false;

    const box = document.createElement('div');
    box.id = 'agciPublishedVoiceStatus';
    box.style.cssText = 'margin:10px 0;padding:9px 11px;border-left:3px solid #8f1d24;background:#202328;color:#fff;font-size:11px;line-height:1.45';

    if (episode?.voiceMode === 'google-chirp3-hd' && episode?.audioUrl) {
      box.innerHTML = '<strong>GOOGLE CHIRP 3 HD</strong> · Audio profesional publicado. La reproducción usa el MP3 oficial y no la voz sintética del navegador.';
      const note = $('.morning-tech-note');
      if (note) note.textContent = 'Experiencia principal: Google Chirp 3 HD. Voz del dispositivo: únicamente fallback si no existe audio publicado.';
      const play = $('#miPlay');
      if (play) play.innerHTML = '▶ <span>Escuchar Morning Intelligence</span>';
    } else if (episode?.audioUrl) {
      box.innerHTML = '<strong>AUDIO PUBLICADO</strong> · Se reproduce el MP3 disponible. Google Chirp 3 HD quedará activo cuando se complete la credencial de Google Cloud.';
    } else {
      box.innerHTML = '<strong>FALLBACK LOCAL</strong> · No hay MP3 publicado; el reproductor puede utilizar la voz disponible en este dispositivo.';
    }

    const personalize = player.querySelector('.morning-personalize');
    if (personalize) personalize.insertAdjacentElement('beforebegin', box);
    else player.prepend(box);
    return true;
  }

  async function init() {
    let episode;
    try { episode = await loadEpisode(); }
    catch (err) { console.warn('AGCI published voice status', err); return; }

    if (decorate(episode)) return;
    const observer = new MutationObserver(() => {
      if (decorate(episode)) observer.disconnect();
    });
    observer.observe(document.body, {childList:true, subtree:true});
    window.setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
