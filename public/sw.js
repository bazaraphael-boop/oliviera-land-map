// Service worker : application utilisable hors connexion.
// - Coquille de l'app : toutes les pages et ressources du build sont mises en
//   cache d'après asset-manifest.json (généré par Vite), et resynchronisées à
//   chaque ouverture en ligne pour suivre les nouvelles publications.
// - Données : les lectures Supabase passent par le réseau et, hors connexion,
//   la dernière réponse reçue est servie. Ce cache est vidé à la déconnexion.

const APP_CACHE = 'mjo-app-v2';
const DATA_CACHE = 'mjo-data-v1';
const MANIFEST_URL = '/asset-manifest.json';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png',
  '/favicon.ico',
];

const manifestFiles = (manifest) => {
  const files = new Set();
  Object.values(manifest).forEach((entry) => {
    if (entry.file) files.add('/' + entry.file);
    (entry.css || []).forEach((f) => files.add('/' + f));
    (entry.assets || []).forEach((f) => files.add('/' + f));
  });
  return files;
};

// Met le cache de l'app au niveau de la dernière publication
let syncing = null;
const syncAppCache = () => {
  if (syncing) return syncing;
  syncing = (async () => {
    const response = await fetch(MANIFEST_URL, { cache: 'no-store' });
    if (!response.ok) return;
    const manifest = await response.clone().json();
    const cache = await caches.open(APP_CACHE);
    const previous = await cache.match(MANIFEST_URL);
    if (previous && (await previous.text()) === JSON.stringify(manifest)) return;

    const wanted = manifestFiles(manifest);
    const cachedKeys = await cache.keys();
    const cachedPaths = new Set(cachedKeys.map((req) => new URL(req.url).pathname));
    const missing = [...wanted].filter((path) => !cachedPaths.has(path));
    await Promise.all(
      missing.map((path) => cache.add(path).catch((err) => console.warn('Cache hors ligne :', path, err)))
    );
    // Retirer les fichiers d'anciennes publications
    await Promise.all(
      cachedKeys
        .filter((req) => {
          const path = new URL(req.url).pathname;
          return path.startsWith('/assets/') && !wanted.has(path);
        })
        .map((req) => cache.delete(req))
    );
    await cache.put(MANIFEST_URL, new Response(JSON.stringify(manifest)));
  })()
    .catch((err) => console.warn('Synchronisation du cache hors ligne :', err))
    .finally(() => {
      syncing = null;
    });
  return syncing;
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_CACHE)
      .then((cache) => cache.addAll(SHELL).catch((err) => console.warn('Pre-cache warning:', err)))
      .then(syncAppCache)
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== APP_CACHE && key !== DATA_CACHE).map((key) => caches.delete(key)))
      )
  );
  self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'clear-data-cache') {
    event.waitUntil(caches.delete(DATA_CACHE));
  }
});

const isSupabaseRead = (url) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Pages : réseau d'abord, sinon la coquille de l'app
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(APP_CACHE).then((cache) => cache.put('/index.html', copy));
            event.waitUntil(syncAppCache());
          }
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) || (await caches.match('/')))
    );
    return;
  }

  // Données Supabase : réseau d'abord, dernière réponse connue hors connexion
  if (isSupabaseRead(url)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request, { cacheName: DATA_CACHE });
          return cached || Response.error();
        })
    );
    return;
  }

  // Fichiers de l'app : cache d'abord (noms versionnés), puis réseau
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(APP_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        });
      })
    );
  }
});
