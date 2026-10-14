/* Service worker de Medicamentos: guarda la app en el dispositivo para que abra sin conexión.
 * Solo funciona si la app se sirve por HTTPS.
 * Al publicar una versión nueva, cambiar VERSION: así los teléfonos bajan los archivos nuevos.
 * (Los DATOS del usuario no se tocan: viven en IndexedDB, no en este caché.) */
const VERSION = 'med-1.2.0';
const ARCHIVOS = ['./', './index.html', './manifest.json',
  './icon-180.png', './icon-192.png', './icon-512.png', './icon-maskable-512.png',
  './jspdf.min.js', './jspdf-autotable.min.js'];
const FUENTES = 'med-fuentes';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== FUENTES).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Tipografías de Google: primero el caché
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(FUENTES).then(c => c.match(req).then(r => r || fetch(req).then(res => { c.put(req, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== self.location.origin) return;

  // Archivos de la app: responde al instante desde el caché y actualiza en segundo plano
  e.respondWith(caches.open(VERSION).then(async c => {
    const cached = await c.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' ? await c.match('./index.html') : null);
    const red = fetch(req).then(res => { if (res && res.ok) c.put(req, res.clone()); return res; }).catch(() => null);
    if (cached) { e.waitUntil(red); return cached; }
    return (await red) || new Response('Sin conexión', { status: 503 });
  }));
});
