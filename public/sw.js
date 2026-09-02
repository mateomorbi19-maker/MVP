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

/*
 * Cola de subida.
 *
 * Esto NO contradice la regla de arriba de no cachear nada. Esa regla es sobre SERVIR
 * contenido viejo; esto es un buffer de ESCRITURA que va en un solo sentido, guarda sólo
 * bytes producidos en este teléfono que todavía no llegaron al servidor, se borra al
 * confirmarse, y jamás responde un fetch.
 *
 * Background Sync no existe en iOS. Ahí la cola avanza sólo con la aplicación abierta, y
 * por eso la bomba también vive en el layout de la página.
 */
self.addEventListener('sync', (evento) => {
  if (evento.tag !== 'acta-cola') return
  evento.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientes) => {
      // El drenado real lo hace la página: tiene el mismo IndexedDB y la lógica en un solo
      // lugar. Si no hay ninguna abierta, se reintenta en el próximo disparo.
      for (const c of clientes) c.postMessage({ tipo: 'drenar-cola' })
    }),
  )
})
