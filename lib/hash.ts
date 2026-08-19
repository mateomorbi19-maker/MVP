import { createHash } from 'node:crypto'
import type { PoolClient } from 'pg'
import { db } from './db'

/**
 * Cadena de custodia.
 *
 * Cada acción sobre un expediente se registra como un evento cuyo hash incluye el hash
 * del evento anterior. Alterar o borrar cualquier eslabón rompe todos los siguientes,
 * y eso es detectable por cualquiera con el verificador público.
 *
 * IMPORTANTE — límite honesto de esta versión:
 * la firma es una firma ELECTRÓNICA de demostración (clave local del servidor).
 * Para tener firma DIGITAL en los términos de la Ley 25.506 —con presunción de autoría
 * e integridad de los arts. 7 y 8— hay que firmar con un certificado emitido por un
 * certificador licenciado (Encode, Lakaut, Box Custodia o Digilogix). Ver README.
 */

export function sha256(dato: string | Buffer | Uint8Array): string {
  return createHash('sha256').update(dato).digest('hex')
}

/**
 * Serialización canónica: claves ordenadas en todos los niveles.
 * Sin esto, dos objetos idénticos podrían producir hashes distintos según el orden
 * en que se armaron, y la verificación fallaría por un motivo que no es una alteración.
 */
export function canonico(valor: unknown): string {
  if (valor === null || valor === undefined) return 'null'
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : 'null'
  if (typeof valor === 'boolean' || typeof valor === 'string') return JSON.stringify(valor)
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`
  if (typeof valor === 'object') {
    const obj = valor as Record<string, unknown>
    const claves = Object.keys(obj).sort()
    return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico(obj[k])}`).join(',')}}`
  }
  return 'null'
}

export function hashEvento(entrada: {
  caso_id: string
  ts: string
  tipo: string
  detalle: unknown
  hash_previo: string | null
}): string {
  return sha256(
    [entrada.hash_previo ?? 'GENESIS', entrada.caso_id, entrada.ts, entrada.tipo, canonico(entrada.detalle)].join('|'),
  )
}

/**
 * Registra un eslabón nuevo. Usa SELECT ... FOR UPDATE sobre el caso para que dos
 * requests simultáneas no encadenen sobre el mismo eslabón previo.
 */
export async function registrarEvento(
  casoId: string,
  tipo: string,
  detalle: Record<string, unknown> = {},
  clienteExistente?: PoolClient,
): Promise<{ hash: string; id: number }> {
  const pg = await db()
  const cliente = clienteExistente ?? (await pg.connect())
  const propio = !clienteExistente
  try {
    if (propio) await cliente.query('BEGIN')
    await cliente.query('SELECT id FROM casos WHERE id = $1 FOR UPDATE', [casoId])
    const previo = await cliente.query<{ hash: string }>(
      'SELECT hash FROM eventos WHERE caso_id = $1 ORDER BY id DESC LIMIT 1',
      [casoId],
    )
    const hashPrevio = previo.rows[0]?.hash ?? null
    const ts = new Date().toISOString()
    const hash = hashEvento({ caso_id: casoId, ts, tipo, detalle, hash_previo: hashPrevio })
    const res = await cliente.query<{ id: string }>(
      `INSERT INTO eventos (caso_id, ts, tipo, detalle, hash_previo, hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [casoId, ts, tipo, JSON.stringify(detalle), hashPrevio, hash],
    )
    if (propio) await cliente.query('COMMIT')
    return { hash, id: Number(res.rows[0].id) }
  } catch (err) {
    if (propio) await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    if (propio) cliente.release()
  }
}

export interface EslabonManifiesto {
  n: number
  ts: string
  tipo: string
  hash_previo: string | null
  hash: string
  detalle: Record<string, unknown>
}

export interface Manifiesto {
  version: string
  caso_id: string
  generado_en: string
  cadena: EslabonManifiesto[]
  piezas: Array<{ tipo: string; id: string; descripcion: string; sha256: string; bytes?: number }>
  hash_maestro: string
}

/** Reconstruye el manifiesto completo del expediente y calcula el hash maestro. */
export async function construirManifiesto(casoId: string): Promise<Manifiesto> {
  const pg = await db()
  const eventos = await pg.query(
    'SELECT ts, tipo, detalle, hash_previo, hash FROM eventos WHERE caso_id = $1 ORDER BY id ASC',
    [casoId],
  )
  const medias = await pg.query(
    'SELECT id, tipo, guia_id, sha256, bytes FROM medias WHERE caso_id = $1 ORDER BY capturado_en ASC',
    [casoId],
  )
  const testigos = await pg.query('SELECT id, nombre, sha256 FROM testigos WHERE caso_id = $1 ORDER BY creado_en ASC', [
    casoId,
  ])

  const cadena: EslabonManifiesto[] = eventos.rows.map((e, i) => ({
    n: i + 1,
    ts: new Date(e.ts).toISOString(),
    tipo: e.tipo,
    hash_previo: e.hash_previo,
    hash: e.hash,
    detalle: e.detalle,
  }))

  const piezas = [
    ...medias.rows.map((m) => ({
      tipo: m.tipo as string,
      id: m.id as string,
      descripcion: (m.guia_id as string) ?? m.tipo,
      sha256: m.sha256 as string,
      bytes: m.bytes as number,
    })),
    ...testigos.rows.map((t) => ({
      tipo: 'testigo',
      id: t.id as string,
      descripcion: `Declaración de ${t.nombre}`,
      sha256: t.sha256 as string,
    })),
  ]

  const generado_en = new Date().toISOString()
  const cuerpo = { version: '1.0', caso_id: casoId, cadena, piezas }
  const hash_maestro = sha256(canonico(cuerpo))

  return { ...cuerpo, generado_en, hash_maestro }
}

export interface ResultadoVerificacion {
  valido: boolean
  eslabones: number
  piezas: number
  hash_maestro: string
  problemas: string[]
}

/** Recalcula toda la cadena y confirma que ningún eslabón fue alterado. */
export async function verificarCadena(casoId: string): Promise<ResultadoVerificacion> {
  const pg = await db()
  const eventos = await pg.query(
    'SELECT ts, tipo, detalle, hash_previo, hash FROM eventos WHERE caso_id = $1 ORDER BY id ASC',
    [casoId],
  )
  const problemas: string[] = []
  let esperadoPrevio: string | null = null

  eventos.rows.forEach((e, i) => {
    if (e.hash_previo !== esperadoPrevio) {
      problemas.push(`Eslabón ${i + 1} (${e.tipo}): el hash previo no coincide con el eslabón anterior.`)
    }
    const recalculado = hashEvento({
      caso_id: casoId,
      ts: new Date(e.ts).toISOString(),
      tipo: e.tipo,
      detalle: e.detalle,
      hash_previo: e.hash_previo,
    })
    if (recalculado !== e.hash) {
      problemas.push(`Eslabón ${i + 1} (${e.tipo}): el contenido fue alterado después de registrarse.`)
    }
    esperadoPrevio = e.hash
  })

  const manifiesto = await construirManifiesto(casoId)
  return {
    valido: problemas.length === 0,
    eslabones: eventos.rowCount ?? 0,
    piezas: manifiesto.piezas.length,
    hash_maestro: manifiesto.hash_maestro,
    problemas,
  }
}
