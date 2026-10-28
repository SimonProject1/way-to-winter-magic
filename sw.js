const CACHE = 'way-to-winter-magic-v4.0.0';
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
  './assets/stickers/castle-magic-large.webp',
  './assets/stickers/castle-magic-locked.webp',
  './assets/stickers/castle-magic-new.webp',
  './assets/stickers/castle-magic-share.webp',
  './assets/stickers/castle-magic-small.webp',
  './assets/stickers/castle-magic-unlocked.webp',
  './assets/stickers/city-collector-large.webp',
  './assets/stickers/city-collector-locked.webp',
  './assets/stickers/city-collector-new.webp',
  './assets/stickers/city-collector-share.webp',
  './assets/stickers/city-collector-small.webp',
  './assets/stickers/city-collector-unlocked.webp',
  './assets/stickers/cozy-collector-large.webp',
  './assets/stickers/cozy-collector-locked.webp',
  './assets/stickers/cozy-collector-new.webp',
  './assets/stickers/cozy-collector-share.webp',
  './assets/stickers/cozy-collector-small.webp',
  './assets/stickers/cozy-collector-unlocked.webp',
  './assets/stickers/de-ticket-pro-large.webp',
  './assets/stickers/de-ticket-pro-locked.webp',
  './assets/stickers/de-ticket-pro-new.webp',
  './assets/stickers/de-ticket-pro-share.webp',
  './assets/stickers/de-ticket-pro-small.webp',
  './assets/stickers/de-ticket-pro-unlocked.webp',
  './assets/stickers/first-magic-large.webp',
  './assets/stickers/first-magic-locked.webp',
  './assets/stickers/first-magic-new.webp',
  './assets/stickers/first-magic-share.webp',
  './assets/stickers/first-magic-small.webp',
  './assets/stickers/first-magic-unlocked.webp',
  './assets/stickers/five-moments-large.webp',
  './assets/stickers/five-moments-locked.webp',
  './assets/stickers/five-moments-new.webp',
  './assets/stickers/five-moments-share.webp',
  './assets/stickers/five-moments-small.webp',
  './assets/stickers/five-moments-unlocked.webp',
  './assets/stickers/forest-christmas-large.webp',
  './assets/stickers/forest-christmas-locked.webp',
  './assets/stickers/forest-christmas-new.webp',
  './assets/stickers/forest-christmas-share.webp',
  './assets/stickers/forest-christmas-small.webp',
  './assets/stickers/forest-christmas-unlocked.webp',
  './assets/stickers/light-hunter-large.webp',
  './assets/stickers/light-hunter-locked.webp',
  './assets/stickers/light-hunter-new.webp',
  './assets/stickers/light-hunter-share.webp',
  './assets/stickers/light-hunter-small.webp',
  './assets/stickers/light-hunter-unlocked.webp',
  './assets/stickers/night-magic-large.webp',
  './assets/stickers/night-magic-locked.webp',
  './assets/stickers/night-magic-new.webp',
  './assets/stickers/night-magic-share.webp',
  './assets/stickers/night-magic-small.webp',
  './assets/stickers/night-magic-unlocked.webp',
  './assets/stickers/premiere-night-large.webp',
  './assets/stickers/premiere-night-locked.webp',
  './assets/stickers/premiere-night-new.webp',
  './assets/stickers/premiere-night-share.webp',
  './assets/stickers/premiere-night-small.webp',
  './assets/stickers/premiere-night-unlocked.webp',
  './assets/stickers/taste-journey-large.webp',
  './assets/stickers/taste-journey-locked.webp',
  './assets/stickers/taste-journey-new.webp',
  './assets/stickers/taste-journey-share.webp',
  './assets/stickers/taste-journey-small.webp',
  './assets/stickers/taste-journey-unlocked.webp',
  './assets/stickers/winter-bronze-large.webp',
  './assets/stickers/winter-bronze-locked.webp',
  './assets/stickers/winter-bronze-new.webp',
  './assets/stickers/winter-bronze-share.webp',
  './assets/stickers/winter-bronze-small.webp',
  './assets/stickers/winter-bronze-unlocked.webp',
  './assets/stickers/winter-gold-large.webp',
  './assets/stickers/winter-gold-locked.webp',
  './assets/stickers/winter-gold-new.webp',
  './assets/stickers/winter-gold-share.webp',
  './assets/stickers/winter-gold-small.webp',
  './assets/stickers/winter-gold-unlocked.webp',
  './assets/stickers/winter-master-large.webp',
  './assets/stickers/winter-master-locked.webp',
  './assets/stickers/winter-master-new.webp',
  './assets/stickers/winter-master-share.webp',
  './assets/stickers/winter-master-small.webp',
  './assets/stickers/winter-master-unlocked.webp',
  './assets/stickers/winter-silver-large.webp',
  './assets/stickers/winter-silver-locked.webp',
  './assets/stickers/winter-silver-new.webp',
  './assets/stickers/winter-silver-share.webp',
  './assets/stickers/winter-silver-small.webp',
  './assets/stickers/winter-silver-unlocked.webp',
  './assets/stickers/winter-weekend-large.webp',
  './assets/stickers/winter-weekend-locked.webp',
  './assets/stickers/winter-weekend-new.webp',
  './assets/stickers/winter-weekend-share.webp',
  './assets/stickers/winter-weekend-small.webp',
  './assets/stickers/winter-weekend-unlocked.webp',
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
