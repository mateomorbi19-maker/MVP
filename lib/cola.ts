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
 * por eso no se permite cerrar hasta confirmar todas las piezas pendientes. Safari
 * además desaloja el almacenamiento del sitio tras siete días sin uso: una foto en cola
 * puede desaparecer, y eso no se puede evitar desde el navegador.
 */

const BASE = 'acta-cola'
const ALMACEN = 'piezas'

export interface PiezaEnCola {
  id: string
  casoId: string
  tipo: 'foto' | 'audio' | 'documento'
  guiaId: string | null
  mime: string
  sha256: string
  /** Cuándo la sacó el teléfono, en hora del teléfono. */
  tomadaEn: string
  lat: number | null
  lon: number | null
  intentos: number
  error?: string
  estadoHttp?: number
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
        // El éxito del request no garantiza que la escritura haya quedado durable.
        tx.oncomplete = () => {
          db.close()
          resolver(pedido.result)
        }
        tx.onabort = () => {
          db.close()
          rechazar(tx.error ?? new Error('No se pudo confirmar el guardado local. Liberá espacio y reintentá.'))
        }
        tx.onerror = () => {
          db.close()
          rechazar(tx.error ?? pedido.error ?? new Error('Falló el almacén local.'))
        }
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

async function marcarIntento(pieza: PiezaEnCola, error: string, estadoHttp?: number): Promise<void> {
  await conAlmacen('readwrite', (almacen) => {
    const pedido = almacen.get(pieza.id) as IDBRequest<PiezaEnCola | undefined>
    pedido.onsuccess = () => {
      // La persona pudo retirar el borrador mientras el servidor respondía: no se recrea.
      const actual = pedido.result
      if (actual) almacen.put({ ...actual, intentos: actual.intentos + 1, error, estadoHttp })
    }
    return pedido
  })
}

/**
 * Intenta subir todo lo pendiente.
 *
 * Sólo borra una pieza cuando el servidor confirma su recepción. Un rechazo conserva
 * los bytes y su motivo: un 409 puede indicar un cierre concurrente y no una recepción.
 */
interface ResultadoDrenaje {
  subidas: number
  errores: Array<{ casoId: string; error: Error }>
}

async function drenarPendientes(): Promise<ResultadoDrenaje> {
  if (typeof indexedDB === 'undefined') return { subidas: 0, errores: [] }
  let subidas = 0
  const errores: ResultadoDrenaje['errores'] = []
  for (const pendiente of await todasLasPendientes()) {
    // El snapshot puede incluir un borrador retirado mientras se enviaba la pieza anterior.
    const pieza = await conAlmacen<PiezaEnCola | undefined>('readonly', (almacen) => almacen.get(pendiente.id))
    if (!pieza) continue
    let motivo: string | null = null
    let estadoHttp: number | undefined
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
      if (res.ok) {
        await quitar(pieza.id)
        subidas++
        continue
      }
      const respuesta = await res.json().catch(() => ({}))
      estadoHttp = res.status
      motivo = typeof respuesta.error === 'string' ? respuesta.error : 'No se confirmó la recepción. Revisá la conexión y reintentá.'
    } catch (error) {
      motivo = error instanceof Error ? error.message : 'Recuperá la conexión para subir el archivo guardado en este teléfono.'
    }
    await marcarIntento(pieza, motivo ?? 'Reintentá subir el archivo.', estadoHttp)
    errores.push({ casoId: pieza.casoId, error: new Error(`${motivo} El archivo sigue guardado en este teléfono.`) })
  }
  return { subidas, errores }
}

let drenajeEnCurso: Promise<ResultadoDrenaje> | null = null

/** La bomba global y el recorrido comparten un único envío por pieza. */
export async function drenar(casoId?: string): Promise<number> {
  drenajeEnCurso ??= drenarPendientes().finally(() => { drenajeEnCurso = null })
  const resultado = await drenajeEnCurso
  const fallo = resultado.errores.find((e) => !casoId || e.casoId === casoId)
  if (fallo) throw fallo.error
  return resultado.subidas
}
