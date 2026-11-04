// Necesario para que Chrome ofrezca «Instalar app». No guarda nada: todo va siempre a la red.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== location.origin) return; // el servidor de Google no se toca
  e.respondWith(fetch(r));
});
