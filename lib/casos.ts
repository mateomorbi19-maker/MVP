import { db } from './db'
import { construirManifiesto } from './hash'
import { construirActa } from './acta'
import { analizar, type InformeConsistencia } from './consistencia'
import { fotosObligatorias } from './cuestionario'
import type { Clima } from './clima'
import type { Sello } from './sello'
import type { DatosExpediente } from './pdf'
import type { AlcanceCasos } from './sesion'
import type { Croquis } from './croquis'

export interface Caso {
  id: string
  creado_en: string
  cerrado_en: string | null
  estado: string
  poliza: string | null
  patente: string | null
  asegurado: string | null
  telefono: string | null
  respuestas: Record<string, unknown>
  gps: { lat: number; lon: number; precision_m: number | null; capturado_en: string } | null
  direccion: string | null
  clima: Clima | null
  consistencia: InformeConsistencia | null
  hash_maestro: string | null
  sello: Sello | null
  /** Ver VERSION_MANIFIESTO en lib/hash.ts. Las actuaciones viejas conservan la suya. */
  manifiesto_version: string
  usuario_id: string | null
  productor_id: string | null
  croquis: Croquis | null
}

const iso = (v: unknown): string => (v instanceof Date ? v.toISOString() : String(v))

function mapear(fila: Record<string, unknown>): Caso {
  return {
    id: fila.id as string,
    creado_en: iso(fila.creado_en),
    cerrado_en: fila.cerrado_en ? iso(fila.cerrado_en) : null,
    estado: fila.estado as string,
    poliza: (fila.poliza as string) ?? null,
    patente: (fila.patente as string) ?? null,
    asegurado: (fila.asegurado as string) ?? null,
    telefono: (fila.telefono as string) ?? null,
    respuestas: (fila.respuestas as Record<string, unknown>) ?? {},
    gps: (fila.gps as Caso['gps']) ?? null,
    direccion: (fila.direccion as string) ?? null,
    clima: (fila.clima as Clima) ?? null,
    consistencia: (fila.consistencia as InformeConsistencia) ?? null,
    hash_maestro: (fila.hash_maestro as string) ?? null,
    sello: (fila.sello as Sello) ?? null,
    manifiesto_version: (fila.manifiesto_version as string) ?? '1.0',
    usuario_id: (fila.usuario_id as string) ?? null,
    productor_id: (fila.productor_id as string) ?? null,
    croquis: (fila.croquis as Croquis) ?? null,
  }
}

export async function obtenerCaso(id: string): Promise<Caso | null> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM casos WHERE id = $1', [id])
  return res.rows[0] ? mapear(res.rows[0]) : null
}

/**
 * Listado, siempre acotado a quién pregunta.
 *
 * No tiene valor por defecto a propósito, y es deliberadamente rompedor: con un default
 * de "todos", cualquier llamador nuevo listaría la base entera sin darse cuenta. Y en
 * esta base hay datos personales de terceros que ni siquiera son usuarios del sistema.
 */
export async function listarCasos(alcance: AlcanceCasos): Promise<Caso[]> {
  const pg = await db()
  if (alcance.tipo === 'todos') {
    const res = await pg.query('SELECT * FROM casos ORDER BY creado_en DESC LIMIT 200')
    return res.rows.map(mapear)
  }
  const columna = alcance.tipo === 'de_productor' ? 'productor_id' : 'usuario_id'
  const valor = alcance.tipo === 'de_productor' ? alcance.productorId : alcance.usuarioId
  const res = await pg.query(
    `SELECT * FROM casos WHERE ${columna} = $1 ORDER BY creado_en DESC LIMIT 200`,
    [valor],
  )
  return res.rows.map(mapear)
}

export interface Media {
  id: string
  caso_id: string
  tipo: string
  guia_id: string | null
  archivo: string
  mime: string
  bytes: number
  sha256: string
  gps: { lat: number; lon: number } | null
  capturado_en: string
  firmante: string | null
  hash_firmado: string | null
}

export async function listarMedias(casoId: string): Promise<Media[]> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM medias WHERE caso_id = $1 ORDER BY capturado_en ASC', [casoId])
  return res.rows.map((m) => ({
    id: m.id,
    caso_id: m.caso_id,
    tipo: m.tipo,
    guia_id: m.guia_id,
    archivo: m.archivo,
    mime: m.mime,
    bytes: m.bytes,
    sha256: m.sha256,
    gps: m.gps,
    capturado_en: iso(m.capturado_en),
    firmante: m.firmante ?? null,
    hash_firmado: m.hash_firmado ?? null,
  }))
}

export interface Testigo {
  id: string
  nombre: string
  dni: string | null
  telefono: string | null
  relato: string | null
  consentimiento: boolean
  creado_en: string
  sha256: string
}

export async function listarTestigos(casoId: string): Promise<Testigo[]> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM testigos WHERE caso_id = $1 ORDER BY creado_en ASC', [casoId])
  return res.rows.map((t) => ({
    id: t.id,
    nombre: t.nombre,
    dni: t.dni,
    telefono: t.telefono,
    relato: t.relato,
    consentimiento: t.consentimiento,
    creado_en: iso(t.creado_en),
    sha256: t.sha256,
  }))
}

/** Recalcula el informe de consistencia con el estado actual del expediente. */
export async function calcularConsistencia(casoId: string): Promise<InformeConsistencia | null> {
  const caso = await obtenerCaso(casoId)
  if (!caso) return null
  const medias = await listarMedias(casoId)
  const testigos = await listarTestigos(casoId)

  return analizar({
    respuestas: caso.respuestas,
    clima: caso.clima,
    direccion: caso.direccion,
    gpsCapturadoEn: caso.gps?.capturado_en ?? null,
    fotos: medias.filter((m) => m.tipo === 'foto').map((m) => ({ guia_id: m.guia_id })),
    fotosObligatorias: fotosObligatorias(caso.respuestas),
    tieneAudio: medias.some((m) => m.tipo === 'audio'),
    tieneFirma: medias.some((m) => m.tipo === 'firma'),
    testigos: testigos.length,
  })
}

/** Arma el paquete completo que consume el generador de PDF. */
export async function datosExpediente(casoId: string): Promise<DatosExpediente | null> {
  const caso = await obtenerCaso(casoId)
  if (!caso) return null
  const [medias, testigos, manifiesto] = await Promise.all([
    listarMedias(casoId),
    listarTestigos(casoId),
    construirManifiesto(casoId),
  ])
  const consistencia = caso.consistencia ?? (await calcularConsistencia(casoId))

  return {
    caso: {
      id: caso.id,
      creado_en: caso.creado_en,
      cerrado_en: caso.cerrado_en,
      poliza: caso.poliza,
      patente: caso.patente,
      asegurado: caso.asegurado,
      telefono: caso.telefono,
      respuestas: caso.respuestas,
      gps: caso.gps,
      direccion: caso.direccion,
    },
    croquis: caso.croquis,
    hash_acta_actual: construirActa(caso, medias, testigos).hash,
    clima: caso.clima,
    consistencia,
    manifiesto,
    sello: caso.sello,
    medias: medias.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      guia_id: m.guia_id,
      archivo: m.archivo,
      mime: m.mime,
      sha256: m.sha256,
      capturado_en: m.capturado_en,
      gps: m.gps,
    })),
    testigos: testigos.map((t) => ({
      id: t.id,
      nombre: t.nombre,
      dni: t.dni,
      telefono: t.telefono,
      relato: t.relato,
      creado_en: t.creado_en,
      sha256: t.sha256,
    })),
  }
}

/** URL pública del sistema, para armar los links del QR de testigos. */
export function urlPublica(req?: Request): string {
  if (process.env.URL_PUBLICA) return process.env.URL_PUBLICA.replace(/\/$/, '')
  if (req) {
    const h = new Headers(req.headers)
    const host = h.get('x-forwarded-host') || h.get('host')
    const proto = h.get('x-forwarded-proto') || 'http'
    if (host) return `${proto}://${host}`
  }
  return 'http://localhost:3000'
}

/* ================= Datos del asegurado ================= */

/**
 * Los cuatro campos de la carátula.
 *
 * Ya no se piden al abrir la actuación: parado al lado del auto nadie tiene la póliza
 * a mano, y pedirla antes de empezar es lo que hace que la persona abandone. Se cargan
 * al final del recorrido, con el mismo PATCH que el resto.
 */
export interface DatosAsegurado {
  poliza: string | null
  patente: string | null
  asegurado: string | null
  telefono: string | null
}

const LARGOS: Record<keyof DatosAsegurado, number> = {
  poliza: 120,
  patente: 15,
  asegurado: 120,
  telefono: 40,
}

/** Normaliza lo que llega del cliente. La patente se guarda siempre en mayúsculas. */
export function limpiarDatosAsegurado(cuerpo: unknown): DatosAsegurado {
  const c = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>
  const limpiar = (clave: keyof DatosAsegurado): string | null => {
    const v = c[clave]
    if (typeof v !== 'string') return null
    const s = v.trim().slice(0, LARGOS[clave])
    if (s.length === 0) return null
    return clave === 'patente' ? s.toUpperCase() : s
  }
  return {
    poliza: limpiar('poliza'),
    patente: limpiar('patente'),
    asegurado: limpiar('asegurado'),
    telefono: limpiar('telefono'),
  }
}

/** Cuántos terceros se identificaron. Lo usa la pantalla de consentimiento. */
export async function contarTerceros(casoId: string): Promise<number> {
  const pg = await db()
  const res = await pg.query<{ n: string }>('SELECT count(*)::text AS n FROM terceros WHERE caso_id = $1', [casoId])
  return Number(res.rows[0]?.n ?? 0)
}
