/*
 * Service worker.
 *
 * Su función acá es habilitar la instalación como aplicación y acelerar el arranque.
 * NO cachea páginas ni respuestas de la API, y eso es deliberado: este sistema
 * produce prueba, y servir una versión vieja de un expediente desde el caché sería
 * mucho peor que tardar un segundo más en cargar.
 *
 * Sólo se guardan los archivos estáticos, que llevan hash en el nombre y por lo
 * tanto nunca cambian de contenido para una misma URL.
 */

const CACHE = 'acta-digital-v1'

self.addEventListener('install', (evento) => {
  evento.waitUntil(caches.open(CACHE).then((c) => c.addAll(['/iconos/icono-192.png', '/iconos/icono-512.png'])))
  self.skipWaiting()
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((claves) => Promise.all(claves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const peticion = evento.request
  if (peticion.method !== 'GET') return

  const url = new URL(peticion.url)
  if (url.origin !== self.location.origin) return

  // La API y las páginas van siempre a la red: los datos del expediente y el
  // estado de la actuación tienen que ser los actuales, sin excepción.
  if (url.pathname.startsWith('/api/')) return
  if (peticion.mode === 'navigate' || peticion.destination === 'document') return

  const esEstatico =
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/iconos/') ||
    ['style', 'script', 'font', 'image'].includes(peticion.destination)

  if (!esEstatico) return

  evento.respondWith(
    caches.match(peticion).then((enCache) => {
      if (enCache) return enCache
      return fetch(peticion).then((respuesta) => {
        if (respuesta.ok && respuesta.type === 'basic') {
          const copia = respuesta.clone()
          caches.open(CACHE).then((c) => c.put(peticion, copia))
        }
        return respuesta
      })
    }),
  )
})
