const CACHE = 'way-to-winter-magic-v3.4.0';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './rewards.js',
  './manifest.webmanifest',
  './data/markets.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './assets/stickers/castle-magic-large.svg',
  './assets/stickers/castle-magic-locked.svg',
  './assets/stickers/castle-magic-new.svg',
  './assets/stickers/castle-magic-share.svg',
  './assets/stickers/castle-magic-small.svg',
  './assets/stickers/castle-magic-unlocked.svg',
  './assets/stickers/city-collector-large.svg',
  './assets/stickers/city-collector-locked.svg',
  './assets/stickers/city-collector-new.svg',
  './assets/stickers/city-collector-share.svg',
  './assets/stickers/city-collector-small.svg',
  './assets/stickers/city-collector-unlocked.svg',
  './assets/stickers/cozy-collector-large.svg',
  './assets/stickers/cozy-collector-locked.svg',
  './assets/stickers/cozy-collector-new.svg',
  './assets/stickers/cozy-collector-share.svg',
  './assets/stickers/cozy-collector-small.svg',
  './assets/stickers/cozy-collector-unlocked.svg',
  './assets/stickers/de-ticket-pro-large.svg',
  './assets/stickers/de-ticket-pro-locked.svg',
  './assets/stickers/de-ticket-pro-new.svg',
  './assets/stickers/de-ticket-pro-share.svg',
  './assets/stickers/de-ticket-pro-small.svg',
  './assets/stickers/de-ticket-pro-unlocked.svg',
  './assets/stickers/first-magic-large.svg',
  './assets/stickers/first-magic-locked.svg',
  './assets/stickers/first-magic-new.svg',
  './assets/stickers/first-magic-share.svg',
  './assets/stickers/first-magic-small.svg',
  './assets/stickers/first-magic-unlocked.svg',
  './assets/stickers/five-moments-large.svg',
  './assets/stickers/five-moments-locked.svg',
  './assets/stickers/five-moments-new.svg',
  './assets/stickers/five-moments-share.svg',
  './assets/stickers/five-moments-small.svg',
  './assets/stickers/five-moments-unlocked.svg',
  './assets/stickers/forest-christmas-large.svg',
  './assets/stickers/forest-christmas-locked.svg',
  './assets/stickers/forest-christmas-new.svg',
  './assets/stickers/forest-christmas-share.svg',
  './assets/stickers/forest-christmas-small.svg',
  './assets/stickers/forest-christmas-unlocked.svg',
  './assets/stickers/light-hunter-large.svg',
  './assets/stickers/light-hunter-locked.svg',
  './assets/stickers/light-hunter-new.svg',
  './assets/stickers/light-hunter-share.svg',
  './assets/stickers/light-hunter-small.svg',
  './assets/stickers/light-hunter-unlocked.svg',
  './assets/stickers/night-magic-large.svg',
  './assets/stickers/night-magic-locked.svg',
  './assets/stickers/night-magic-new.svg',
  './assets/stickers/night-magic-share.svg',
  './assets/stickers/night-magic-small.svg',
  './assets/stickers/night-magic-unlocked.svg',
  './assets/stickers/premiere-night-large.svg',
  './assets/stickers/premiere-night-locked.svg',
  './assets/stickers/premiere-night-new.svg',
  './assets/stickers/premiere-night-share.svg',
  './assets/stickers/premiere-night-small.svg',
  './assets/stickers/premiere-night-unlocked.svg',
  './assets/stickers/taste-journey-large.svg',
  './assets/stickers/taste-journey-locked.svg',
  './assets/stickers/taste-journey-new.svg',
  './assets/stickers/taste-journey-share.svg',
  './assets/stickers/taste-journey-small.svg',
  './assets/stickers/taste-journey-unlocked.svg',
  './assets/stickers/winter-bronze-large.svg',
  './assets/stickers/winter-bronze-locked.svg',
  './assets/stickers/winter-bronze-new.svg',
  './assets/stickers/winter-bronze-share.svg',
  './assets/stickers/winter-bronze-small.svg',
  './assets/stickers/winter-bronze-unlocked.svg',
  './assets/stickers/winter-gold-large.svg',
  './assets/stickers/winter-gold-locked.svg',
  './assets/stickers/winter-gold-new.svg',
  './assets/stickers/winter-gold-share.svg',
  './assets/stickers/winter-gold-small.svg',
  './assets/stickers/winter-gold-unlocked.svg',
  './assets/stickers/winter-master-large.svg',
  './assets/stickers/winter-master-locked.svg',
  './assets/stickers/winter-master-new.svg',
  './assets/stickers/winter-master-share.svg',
  './assets/stickers/winter-master-small.svg',
  './assets/stickers/winter-master-unlocked.svg',
  './assets/stickers/winter-silver-large.svg',
  './assets/stickers/winter-silver-locked.svg',
  './assets/stickers/winter-silver-new.svg',
  './assets/stickers/winter-silver-share.svg',
  './assets/stickers/winter-silver-small.svg',
  './assets/stickers/winter-silver-unlocked.svg',
  './assets/stickers/winter-weekend-large.svg',
  './assets/stickers/winter-weekend-locked.svg',
  './assets/stickers/winter-weekend-new.svg',
  './assets/stickers/winter-weekend-share.svg',
  './assets/stickers/winter-weekend-small.svg',
  './assets/stickers/winter-weekend-unlocked.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.hostname === 'api.transitous.org') return;
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('./index.html', self.registration.scope))));
    return;
  }

  event.respondWith(caches.match(event.request).then(cached => {
    if (cached) return cached;
    return fetch(event.request).then(response => {
      if (response.ok) caches.open(CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    });
  }));
});
