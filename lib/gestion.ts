import { db } from './db'
import { canonico, sha256 } from './hash'

/**
 * La tramitación del expediente, después del sellado.
 *
 * Cadena propia, anclada al hash maestro del acta: el primer eslabón encadena contra él.
 * Así la tramitación queda atada al expediente y auditada, pero FUERA de la cadena de
 * custodia del hecho.
 *
 * Esto responde una pregunta que vale la pena dejar escrita: ¿los comentarios del productor
 * entran a la cadena del asegurado? No. Son prueba de un tercero sobre el TRÁMITE, no sobre
 * el hecho, y al asegurado se le prometió que al cerrar el expediente ya no admite cambios.
 * Además, cualquier eslabón posterior al cierre haría que el verificador público informe
 * como alterado un expediente intacto.
 */

export type EstadoGestion = 'sin_enviar' | 'enviada' | 'recibida' | 'en_tramite' | 'resuelta'

export const ETIQUETA_GESTION: Record<EstadoGestion, string> = {
  sin_enviar: 'Sin enviar',
  enviada: 'Enviada al productor',
  recibida: 'Recepción confirmada',
  en_tramite: 'En trámite',
  resuelta: 'Resuelta',
}

/** Qué transiciones tienen sentido. No se vuelve atrás: se registra un movimiento nuevo. */
const SIGUIENTES: Record<EstadoGestion, EstadoGestion[]> = {
  sin_enviar: ['enviada'],
  enviada: ['recibida', 'en_tramite', 'resuelta'],
  recibida: ['en_tramite', 'resuelta'],
  en_tramite: ['resuelta'],
  resuelta: [],
}

export interface Gestion {
  id: number
  ts: string
  tipo: string
  actor: string | null
  detalle: Record<string, unknown>
  hash: string
}

/**
 * Agrega un eslabón a la cadena de tramitación.
 *
 * El primero encadena contra el hash maestro del acta: sin eso, la tramitación sería una
 * lista suelta que cualquiera podría reescribir sin dejar rastro.
 */
export async function registrarGestion(
  casoId: string,
  tipo: string,
  detalle: Record<string, unknown> = {},
  actor: string | null = null,
): Promise<string> {
  const pg = await db()
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    const caso = await cliente.query<{ hash_maestro: string | null }>(
      'SELECT hash_maestro FROM casos WHERE id = $1 FOR UPDATE',
      [casoId],
    )
    if (caso.rowCount === 0) throw new Error(`No existe la actuación ${casoId}.`)

    const previo = await cliente.query<{ hash: string }>(
      'SELECT hash FROM gestiones WHERE caso_id = $1 ORDER BY id DESC LIMIT 1',
      [casoId],
    )
    const ancla = previo.rows[0]?.hash ?? caso.rows[0].hash_maestro ?? 'SIN_SELLAR'
    const ts = new Date().toISOString()
    const hash = sha256([ancla, casoId, ts, tipo, canonico(detalle)].join('|'))

    await cliente.query(
      'INSERT INTO gestiones (caso_id, ts, tipo, actor, detalle, hash_previo, hash) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [casoId, ts, tipo, actor, JSON.stringify(detalle), previo.rows[0]?.hash ?? null, hash],
    )
    await cliente.query('COMMIT')
    return hash
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }
}

export async function listarGestiones(casoId: string): Promise<Gestion[]> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM gestiones WHERE caso_id = $1 ORDER BY id ASC', [casoId])
  return res.rows.map((f) => ({
    id: Number(f.id),
    ts: new Date(f.ts).toISOString(),
    tipo: f.tipo,
    actor: f.actor ?? null,
    detalle: f.detalle ?? {},
    hash: f.hash,
  }))
}

export class ErrorGestion extends Error {}

/** Cambia el estado del trámite, si la transición tiene sentido. */
export async function avanzarGestion(
  casoId: string,
  nuevo: EstadoGestion,
  actor: string | null,
  detalle: Record<string, unknown> = {},
): Promise<void> {
  const pg = await db()
  const res = await pg.query<{ estado_gestion: EstadoGestion }>('SELECT estado_gestion FROM casos WHERE id = $1', [
    casoId,
  ])
  const actual = res.rows[0]?.estado_gestion
  if (!actual) throw new ErrorGestion('No existe esa actuación.')
  if (!SIGUIENTES[actual].includes(nuevo)) {
    throw new ErrorGestion(
      `No se puede pasar de "${ETIQUETA_GESTION[actual]}" a "${ETIQUETA_GESTION[nuevo]}". Estados posibles desde acá: ${SIGUIENTES[actual].map((e) => ETIQUETA_GESTION[e]).join(', ') || 'ninguno'}.`,
    )
  }
  await pg.query('UPDATE casos SET estado_gestion = $2 WHERE id = $1', [casoId, nuevo])
  await registrarGestion(casoId, `estado_${nuevo}`, detalle, actor)
}
