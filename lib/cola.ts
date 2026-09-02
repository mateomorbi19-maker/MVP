/**
 * Cola de subida, en el teléfono.
 *
 * La foto se guarda en IndexedDB APENAS se saca, antes de intentar subirla. Sin esto,
 * sacar una foto sin señal en el lugar del hecho la pierde: es la pieza más difícil de
 * recuperar y la que más falta hace.
 *
 * NO viola la regla del service worker de no cachear nada. Esa regla es sobre SERVIR
 * contenido viejo, y esto es un buffer de ESCRITURA: guarda sólo bytes producidos en este
 * teléfono que todavía no llegaron al servidor, va en un solo sentido, se borra en cuanto
 * se confirma, y jamás responde un fetch.
 *
 * LÍMITE HONESTO EN iPhone: no hay Background Sync. La cola sólo avanza mientras la
 * aplicación está abierta y al frente. Si la persona saca las fotos sin señal y cierra la
 * aplicación, esperan hasta que la vuelva a abrir. Por eso la bomba vive en el layout, y
 * por eso al cerrar con pendientes se declara el hash de cada una en la cadena. Safari
 * además desaloja el almacenamiento del sitio tras siete días sin uso: una foto en cola
 * puede desaparecer, y eso no se puede evitar desde el navegador.
 */

const BASE = 'acta-cola'
const ALMACEN = 'piezas'

export interface PiezaEnCola {
  id: string
  casoId: string
  tipo: 'foto' | 'audio'
  guiaId: string | null
  mime: string
  sha256: string
  /** Cuándo la sacó el teléfono, en hora del teléfono. */
  tomadaEn: string
  lat: number | null
  lon: number | null
  intentos: number
  bytes: Blob
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    const pedido = indexedDB.open(BASE, 1)
    pedido.onupgradeneeded = () => {
      const db = pedido.result
      if (!db.objectStoreNames.contains(ALMACEN)) {
        const almacen = db.createObjectStore(ALMACEN, { keyPath: 'id' })
        almacen.createIndex('caso', 'casoId')
      }
    }
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rechazar(pedido.error ?? new Error('No se pudo abrir el almacén local.'))
  })
}

function conAlmacen<T>(modo: IDBTransactionMode, fn: (a: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return abrir().then(
    (db) =>
      new Promise<T>((resolver, rechazar) => {
        const tx = db.transaction(ALMACEN, modo)
        const pedido = fn(tx.objectStore(ALMACEN))
        pedido.onsuccess = () => resolver(pedido.result)
        pedido.onerror = () => rechazar(pedido.error ?? new Error('Falló el almacén local.'))
        tx.oncomplete = () => db.close()
      }),
  )
}

/** El sha256 de los bytes que salieron de la cámara, calculado en el teléfono. */
export async function huellaDe(bytes: Blob): Promise<string> {
  const buffer = await bytes.arrayBuffer()
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function encolar(pieza: Omit<PiezaEnCola, 'intentos'>): Promise<void> {
  await conAlmacen('readwrite', (a) => a.put({ ...pieza, intentos: 0 }))
}

export async function pendientesDe(casoId: string): Promise<PiezaEnCola[]> {
  const todas = await conAlmacen<PiezaEnCola[]>('readonly', (a) => a.getAll() as IDBRequest<PiezaEnCola[]>)
  return todas.filter((p) => p.casoId === casoId)
}

export async function todasLasPendientes(): Promise<PiezaEnCola[]> {
  return conAlmacen<PiezaEnCola[]>('readonly', (a) => a.getAll() as IDBRequest<PiezaEnCola[]>)
}

export async function quitar(id: string): Promise<void> {
  await conAlmacen('readwrite', (a) => a.delete(id))
}

async function marcarIntento(pieza: PiezaEnCola): Promise<void> {
  await conAlmacen('readwrite', (a) => a.put({ ...pieza, intentos: pieza.intentos + 1 }))
}

/**
 * Intenta subir todo lo pendiente.
 *
 * Devuelve cuántas subió. Una pieza que el servidor rechaza por 4xx —la actuación cerrada,
 * el archivo inválido— se saca de la cola: reintentarla para siempre no la va a arreglar y
 * mantendría el aviso encendido sin motivo. Un fallo de red se reintenta.
 */
export async function drenar(): Promise<number> {
  if (typeof indexedDB === 'undefined') return 0
  let subidas = 0
  for (const pieza of await todasLasPendientes()) {
    try {
      const cuerpo = new FormData()
      cuerpo.append('archivo', new File([pieza.bytes], `${pieza.id}.bin`, { type: pieza.mime }))
      cuerpo.append('tipo', pieza.tipo)
      if (pieza.guiaId) cuerpo.append('guia_id', pieza.guiaId)
      if (pieza.lat !== null) cuerpo.append('lat', String(pieza.lat))
      if (pieza.lon !== null) cuerpo.append('lon', String(pieza.lon))
      cuerpo.append('idempotencia', pieza.id)
      cuerpo.append('sha256_cliente', pieza.sha256)
      cuerpo.append('tomada_en', pieza.tomadaEn)

      const res = await fetch(`/api/casos/${pieza.casoId}/media`, { method: 'POST', body: cuerpo })
      if (res.ok || res.status === 409) {
        await quitar(pieza.id)
        subidas++
        continue
      }
      if (res.status >= 400 && res.status < 500) {
        await quitar(pieza.id)
        continue
      }
      await marcarIntento(pieza)
    } catch {
      // Sin red. Se queda en la cola y se reintenta cuando vuelva.
      await marcarIntento(pieza)
    }
  }
  return subidas
}
