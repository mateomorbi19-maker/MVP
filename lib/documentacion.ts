import { db, nuevoId } from './db'
import { guardarDocumento, borrarDocumento, type ArchivoGuardado } from './almacenamiento'

/**
 * Licencia, cédula del vehículo y los archivos de la documentación del asegurado.
 *
 * Nada de esto es un caso ni toca la cadena de custodia: es lo que la persona carga antes
 * del choque para no tener que buscarlo parada al lado del auto. Los datos a mano y los
 * archivos viven separados a propósito: cargar el PDF de la licencia no obliga a tipear su
 * número, y tipear el número no impide sumarle una foto.
 */

export const TIPOS_DOCUMENTACION = ['poliza', 'licencia', 'cedula'] as const
export type TipoDocumentacion = (typeof TIPOS_DOCUMENTACION)[number]

/** Tope por bloque: alcanza para frente, dorso y un PDF de varias versiones sin llenar el disco. */
export const MAXIMO_ARCHIVOS_DOCUMENTACION = 10

export interface DatosLicencia {
  numero: string | null
  categoria: string | null
  vencimiento: string | null
}

export interface DatosCedula {
  patente: string | null
  marca_modelo: string | null
  numero: string | null
  titular: string | null
}

export interface ArchivoDocumentacion {
  id: string
  tipo: TipoDocumentacion
  nombre: string | null
  mime: string
  bytes: number
  creado_en: string
}

export interface Documentacion {
  licencia: DatosLicencia | null
  cedula: DatosCedula | null
  archivos: ArchivoDocumentacion[]
}

export class ErrorDocumentacion extends Error {}

const recortar = (v: unknown, largo: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, largo)
  return s.length ? s : null
}

export function esTipoDocumentacion(v: unknown): v is TipoDocumentacion {
  return typeof v === 'string' && (TIPOS_DOCUMENTACION as readonly string[]).includes(v)
}

/**
 * La fecha se exige completa y real: un «2027-02-31» que el campo de fecha de algún
 * navegador deja pasar terminaría guardado como vencimiento y nadie lo notaría hasta el día
 * que haga falta mostrar la licencia.
 */
export function limpiarLicencia(entrada: Record<string, unknown>): DatosLicencia {
  const vencimientoCrudo = recortar(entrada.vencimiento, 10)
  let vencimiento: string | null = null
  if (vencimientoCrudo) {
    const d = new Date(`${vencimientoCrudo}T00:00:00Z`)
    const valida =
      /^\d{4}-\d{2}-\d{2}$/.test(vencimientoCrudo) &&
      !Number.isNaN(d.getTime()) &&
      d.toISOString().slice(0, 10) === vencimientoCrudo
    if (!valida) throw new ErrorDocumentacion('El vencimiento de la licencia tiene que ser una fecha completa, como 2027-05-31.')
    vencimiento = vencimientoCrudo
  }
  const datos = {
    numero: recortar(entrada.numero, 40),
    categoria: recortar(entrada.categoria, 20)?.toUpperCase() ?? null,
    vencimiento,
  }
  if (!datos.numero && !datos.categoria && !datos.vencimiento) {
    throw new ErrorDocumentacion('Completá al menos el número, la categoría o el vencimiento de la licencia.')
  }
  return datos
}

/** La patente va sin espacios ni guiones, igual que la de la póliza, para poder compararlas. */
export function limpiarCedula(entrada: Record<string, unknown>): DatosCedula {
  const patente = recortar(entrada.patente, 15)?.replace(/[\s-]/g, '').toUpperCase() || null
  const datos = {
    patente,
    marca_modelo: recortar(entrada.marca_modelo, 120),
    numero: recortar(entrada.numero, 40),
    titular: recortar(entrada.titular, 120),
  }
  if (!datos.patente && !datos.marca_modelo && !datos.numero && !datos.titular) {
    throw new ErrorDocumentacion('Completá al menos la patente, la marca y modelo, el número o el titular de la cédula.')
  }
  return datos
}

const mapearArchivo = (f: Record<string, unknown>): ArchivoDocumentacion => ({
  id: f.id as string,
  tipo: f.tipo as TipoDocumentacion,
  nombre: (f.nombre as string) ?? null,
  mime: f.mime as string,
  bytes: Number(f.bytes),
  creado_en: new Date(f.creado_en as string).toISOString(),
})

export async function leerDocumentacion(usuarioId: string): Promise<Documentacion> {
  const pg = await db()
  const [datos, archivos] = await Promise.all([
    pg.query('SELECT tipo, datos FROM documentacion_usuario WHERE usuario_id = $1', [usuarioId]),
    pg.query('SELECT * FROM archivos_usuario WHERE usuario_id = $1 ORDER BY creado_en ASC', [usuarioId]),
  ])
  const de = (tipo: string) => datos.rows.find((f) => f.tipo === tipo)?.datos ?? null
  return { licencia: de('licencia'), cedula: de('cedula'), archivos: archivos.rows.map(mapearArchivo) }
}

export async function guardarDatosDocumentacion(usuarioId: string, tipo: unknown, entrada: unknown): Promise<void> {
  if (tipo !== 'licencia' && tipo !== 'cedula') {
    throw new ErrorDocumentacion('El tipo tiene que ser licencia o cedula. Los datos de la póliza se cargan desde su propio formulario.')
  }
  const crudo = entrada && typeof entrada === 'object' ? (entrada as Record<string, unknown>) : {}
  const datos = tipo === 'licencia' ? limpiarLicencia(crudo) : limpiarCedula(crudo)
  const pg = await db()
  await pg.query(
    `INSERT INTO documentacion_usuario (usuario_id, tipo, datos) VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id, tipo) DO UPDATE SET datos = EXCLUDED.datos, actualizado_en = now()`,
    [usuarioId, tipo, JSON.stringify(datos)],
  )
}

export async function agregarArchivoDocumentacion(
  usuarioId: string,
  tipo: unknown,
  nombre: string | null,
  mime: string,
  bytes: Uint8Array,
): Promise<ArchivoDocumentacion> {
  if (!esTipoDocumentacion(tipo)) throw new ErrorDocumentacion('El tipo tiene que ser poliza, licencia o cedula.')
  const pg = await db()
  const cuantos = await pg.query('SELECT count(*)::int AS n FROM archivos_usuario WHERE usuario_id = $1 AND tipo = $2', [
    usuarioId,
    tipo,
  ])
  if ((cuantos.rows[0]?.n ?? 0) >= MAXIMO_ARCHIVOS_DOCUMENTACION) {
    throw new ErrorDocumentacion(
      `Ya hay ${MAXIMO_ARCHIVOS_DOCUMENTACION} archivos en este bloque. Quitá alguno antes de sumar otro.`,
    )
  }

  const id = nuevoId('ARC')
  // La carpeta es la del usuario y no la de una póliza: la licencia y la cédula no cuelgan de ninguna.
  const guardado: ArchivoGuardado = await guardarDocumento(`usuarios/${usuarioId}`, id, mime, bytes)
  const res = await pg.query(
    `INSERT INTO archivos_usuario (id, usuario_id, tipo, archivo, mime, bytes, sha256, nombre)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [id, usuarioId, tipo, guardado.archivo, guardado.mime, guardado.bytes, guardado.sha256, nombre?.slice(0, 160) ?? null],
  )
  return mapearArchivo(res.rows[0])
}

/** Devuelve la ruta y el mime sólo si el archivo es de quien lo pide; si no, null. */
export async function archivoDelUsuario(usuarioId: string, id: string): Promise<{ archivo: string; mime: string } | null> {
  const pg = await db()
  const res = await pg.query('SELECT archivo, mime FROM archivos_usuario WHERE id = $1 AND usuario_id = $2', [id, usuarioId])
  return res.rows[0] ?? null
}

export async function quitarArchivoDocumentacion(usuarioId: string, id: string): Promise<boolean> {
  const pg = await db()
  const res = await pg.query('DELETE FROM archivos_usuario WHERE id = $1 AND usuario_id = $2 RETURNING archivo', [
    id,
    usuarioId,
  ])
  if (!res.rows[0]) return false
  // La fila manda: si el disco falla, el archivo queda huérfano pero la persona ya no lo ve.
  await borrarDocumento(res.rows[0].archivo).catch(() => {})
  return true
}
