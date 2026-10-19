/* D&B Informatique — service worker
   Objectif : l'application doit s'ouvrir même sans réseau, sur le terrain comme chez un client. */
const CACHE = 'dbi-gestion-v4';
const COQUILLE = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(cles => Promise.all(cles.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Jamais de cache sur les appels Firestore : la synchronisation gère elle-même le hors-ligne. */
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('firebaseio.com')) return;

  /* Kit de développement Firebase : on sert le cache et on rafraîchit en arrière-plan. */
  if (url.hostname === 'www.gstatic.com') {
    e.respondWith(caches.open(CACHE).then(async c => {
      const cache = await c.match(req);
      const reseau = fetch(req).then(r => { if (r.ok) c.put(req, r.clone()); return r; }).catch(() => cache);
      return cache || reseau;
    }));
    return;
  }

  /* Coquille de l'application : réseau d'abord, cache en secours. */
  e.respondWith(
    fetch(req).then(r => {
      if (r.ok && url.origin === location.origin) {
        const copie = r.clone();
        caches.open(CACHE).then(c => c.put(req, copie));
      }
      return r;
    }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
  );
});
