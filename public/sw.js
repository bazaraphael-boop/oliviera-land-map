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

// ===== Enregistrements hors connexion =====
// Une création, modification ou suppression qui échoue faute de réseau est
// gardée dans IndexedDB, l'application reçoit une réponse « acceptée », et la
// file est rejouée dans l'ordre au retour du réseau. Les ajouts reçoivent leur
// identifiant dès maintenant : la page peut s'en servir, et un renvoi en double
// est reconnu (conflit 409 = déjà enregistré).

const QUEUE_DB = 'mjo-offline';
const QUEUE_STORE = 'writes';

const openQueue = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(QUEUE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(QUEUE_STORE, { keyPath: 'seq', autoIncrement: true });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const queueTx = async (mode, run) => {
  const db = await openQueue();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, mode);
    const result = run(tx.objectStore(QUEUE_STORE));
    tx.oncomplete = () => resolve(result.result !== undefined ? result.result : result);
    tx.onerror = () => reject(tx.error);
  });
};

const queueAll = () => queueTx('readonly', (store) => store.getAll());
const queueAdd = (item) => queueTx('readwrite', (store) => store.add(item));
const queueRemove = (seq) => queueTx('readwrite', (store) => store.delete(seq));

const notifyClients = async (message) => {
  const clients = await self.clients.matchAll({ includeUncontrolled: true });
  clients.forEach((client) => client.postMessage(message));
};

const notifyQueueSize = async () => notifyClients({ type: 'queue-size', size: (await queueAll()).length });

// Réponse donnée à l'application pour une écriture mise en attente
const acceptedResponse = (method, headers, rows) => {
  const wantsRows = (headers.prefer || '').includes('return=representation');
  const wantsObject = (headers.accept || '').includes('vnd.pgrst.object');
  const responseHeaders = { 'Content-Type': 'application/json', 'X-Offline-Queued': '1' };
  if (!wantsRows) return new Response(null, { status: method === 'POST' ? 201 : 204, headers: responseHeaders });
  const body = wantsObject ? rows[0] || {} : rows;
  return new Response(JSON.stringify(body), { status: method === 'POST' ? 201 : 200, headers: responseHeaders });
};

const queueWrite = async (request, bodyText) => {
  const url = new URL(request.url);
  const headers = {};
  ['apikey', 'authorization', 'content-type', 'prefer', 'accept', 'content-profile'].forEach((name) => {
    const value = request.headers.get(name);
    if (value) headers[name] = value;
  });

  let rows = [];
  let body = bodyText;
  if (bodyText) {
    try {
      const parsed = JSON.parse(bodyText);
      const list = Array.isArray(parsed) ? parsed : [parsed];
      if (request.method === 'POST') {
        list.forEach((row) => {
          if (row && typeof row === 'object' && !row.id) row.id = crypto.randomUUID();
        });
        body = JSON.stringify(Array.isArray(parsed) ? list : list[0]);
        const now = new Date().toISOString();
        rows = list.map((row) => ({ created_at: now, ...row }));
      } else {
        rows = list;
      }
    } catch {
      // corps non JSON : envoyé tel quel
    }
  }

  await queueAdd({
    url: url.href,
    table: url.pathname.replace('/rest/v1/', ''),
    method: request.method,
    headers,
    body,
    queuedAt: Date.now(),
  });
  if (self.registration.sync) self.registration.sync.register('mjo-flush').catch(() => {});
  notifyQueueSize();
  return acceptedResponse(request.method, headers, rows);
};

// Rejoue la file dans l'ordre ; s'arrête au premier échec réseau
let flushing = null;
const flushQueue = (token) => {
  if (flushing) return flushing;
  flushing = (async () => {
    const items = await queueAll();
    let sent = 0;
    const failed = [];
    for (const item of items) {
      const headers = { ...item.headers };
      if (token) headers.authorization = `Bearer ${token}`;
      // La page n'attend plus de réponse : inutile de renvoyer les lignes
      headers.prefer = (headers.prefer || '').replace('return=representation', 'return=minimal');
      let response;
      try {
        response = await fetch(item.url, { method: item.method, headers, body: item.body });
      } catch {
        break; // toujours hors connexion
      }
      const alreadyApplied = item.method === 'POST' && response.status === 409;
      if (!response.ok && !alreadyApplied) {
        let message = `Erreur ${response.status}`;
        try {
          const detail = await response.json();
          message = detail.message || detail.error || message;
        } catch {
          // réponse sans détail
        }
        failed.push({ table: item.table, method: item.method, message });
      } else {
        sent++;
      }
      await queueRemove(item.seq);
    }
    // Les lectures gardées sont périmées : repartir des données du serveur
    if (sent > 0) await caches.delete(DATA_CACHE);
    await notifyClients({ type: 'queue-flushed', sent, failed, remaining: (await queueAll()).length });
  })()
    .catch((err) => console.warn('Envoi des enregistrements hors ligne :', err))
    .finally(() => {
      flushing = null;
    });
  return flushing;
};

self.addEventListener('sync', (event) => {
  if (event.tag === 'mjo-flush') event.waitUntil(flushQueue());
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'clear-data-cache') {
    event.waitUntil(caches.delete(DATA_CACHE));
  }
  if (event.data?.type === 'flush-queue') {
    event.waitUntil(flushQueue(event.data.token));
  }
  if (event.data?.type === 'get-queue-size') {
    event.waitUntil(notifyQueueSize());
  }
});

const isSupabaseRead = (url) => url.hostname.endsWith('.supabase.co') && url.pathname.startsWith('/rest/v1/');
// Écritures sur les tables (les appels /rpc/ sont des calculs : jamais mis en attente)
const isSupabaseWrite = (request, url) =>
  ['POST', 'PATCH', 'DELETE'].includes(request.method) &&
  url.hostname.endsWith('.supabase.co') &&
  url.pathname.startsWith('/rest/v1/') &&
  !url.pathname.startsWith('/rest/v1/rpc/');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (isSupabaseWrite(request, url)) {
    event.respondWith(
      (async () => {
        const bodyText = await request.clone().text();
        try {
          return await fetch(request);
        } catch {
          return queueWrite(request, bodyText);
        }
      })()
    );
    return;
  }

  if (request.method !== 'GET') return;

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
