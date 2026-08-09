const CACHE_VERSION = 'agci-v4-natural-20260809';
const SHELL_CACHE = `${CACHE_VERSION}-shell`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const AUDIO_CACHE = `${CACHE_VERSION}-audio`;
const CORE = [
  './',
  './index.html',
  './styles.css',
  './morning-intelligence.css',
  './morning-intelligence.js',
  './voice-router.js',
  './voice-studio.js',
  './pronunciation-dictionary.json',
  './daily-briefing-cover.js',
  './site.webmanifest',
  './podcast/',
  './podcast/latest.json',
  './data/daily-briefing-latest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('agci-') && ![SHELL_CACHE, DATA_CACHE, AUDIO_CACHE].includes(k)).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || network || new Response(JSON.stringify({isStale:true,error:'offline'}), {status:503,headers:{'Content-Type':'application/json'}});
}

async function networkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request)) || (await cache.match('./index.html')) || Response.error();
  }
}

async function cacheAudio(request) {
  const cache = await caches.open(AUDIO_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  if (url.pathname.endsWith('.json') || url.pathname.endsWith('/feed.xml')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }
  if (url.pathname.endsWith('.mp3')) {
    event.respondWith(cacheAudio(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request, SHELL_CACHE));
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CACHE_EPISODE' && event.data.url) {
    event.waitUntil(caches.open(AUDIO_CACHE).then(cache => cache.add(event.data.url)).catch(() => null));
  }
});

self.addEventListener('push', event => {
  let payload = {title:'AGCI Morning Intelligence',body:'Nueva edición disponible.',url:'./'};
  try { payload = {...payload,...event.data?.json()}; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    icon: './icons/agci-icon.svg',
    badge: './icons/agci-icon.svg',
    data: {url: payload.url || './'},
    tag: 'agci-morning-intelligence',
    renotify: false
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.origin).href;
  event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list => {
    const open = list.find(c => c.url.startsWith(self.location.origin));
    if (open) { open.navigate(target); return open.focus(); }
    return clients.openWindow(target);
  }));
});
