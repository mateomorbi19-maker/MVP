import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { db } from './db'
import { DIR_MEDIA } from './almacenamiento'
import { anotarEnBitacora } from './bitacora'

/**
 * Conservación, anonimización y baja.
 *
 * Hasta acá el sistema no borraba nada nunca: ni fotos, ni actuaciones, ni eslabones. Eso
 * es un problema propio —guardar datos personales sin plazo ni proceso de baja— y además
 * volvía incumplible el derecho de supresión que la aplicación le promete por escrito al
 * testigo y al tercero.
 *
 * Hay dos niveles, y son distintos a propósito:
 *
 *   ANONIMIZAR conserva el expediente y su cadena, y borra los datos personales. Se puede
 *   porque desde el manifiesto '1.1' los datos personales no están dentro del preimagen de
 *   ningún hash: viven en eventos_reservados, y borrarlos no mueve una sola verificación.
 *   Un expediente anonimizado sigue verificando como íntegro, que es exactamente lo que
 *   hace falta si alguien presenta una copia vieja.
 *
 *   EXPURGAR borra la actuación entera. Deja una constancia en `expurgos` con el hash
 *   maestro, para poder contestarle a quien presente un PDF viejo que ese expediente
 *   existió y fue dado de baja.
 *
 * Los plazos concretos los define la aseguradora con su abogado, según los plazos de
 * prescripción que apliquen. El código queda listo; los números van en las variables.
 */

const MESES_PIEZAS = Number(process.env.RETENCION_PIEZAS_MESES || 0)
const MESES_EXPEDIENTE = Number(process.env.RETENCION_EXPEDIENTE_MESES || 0)

export interface Candidato {
  caso_id: string
  cerrado_en: string | null
  meses: number
  accion: 'anonimizar' | 'expurgar'
}

export class ErrorRetencion extends Error {}

/**
 * Borra los datos personales conservando el expediente y su verificabilidad.
 *
 * Qué queda: la cadena entera, los hashes, el sello, el informe de consistencia y el
 * resumen. Lo que se va es el contenido: los reservados, la carátula, el nombre de los
 * testigos y de los terceros, y los archivos del volumen.
 */
export async function anonimizar(casoId: string, motivo: string): Promise<void> {
  const pg = await db()
  const caso = await pg.query<{ estado: string; manifiesto_version: string; bloqueo_legal: boolean }>(
    'SELECT estado, manifiesto_version, bloqueo_legal FROM casos WHERE id = $1',
    [casoId],
  )
  const f = caso.rows[0]
  if (!f) throw new ErrorRetencion('No existe esa actuación.')
  if (f.bloqueo_legal) throw new ErrorRetencion('La actuación tiene bloqueo legal: no se puede anonimizar.')
  if (f.manifiesto_version === '1.0') {
    throw new ErrorRetencion(
      'Esta actuación se selló con el manifiesto 1.0, que lleva el nombre del testigo dentro del hash maestro. Anonimizarla rompería su verificación: la única baja posible es el expurgo total.',
    )
  }

  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    // El contenido reservado se vacía; la fila y su sal quedan, para que el compromiso
    // siga siendo contrastable por quien todavía tenga el dato.
    await cliente.query(
      `UPDATE eventos_reservados SET contenido = '{}'::jsonb, borrado_en = now()
        WHERE evento_id IN (SELECT id FROM eventos WHERE caso_id = $1) AND borrado_en IS NULL`,
      [casoId],
    )
    await cliente.query(
      `UPDATE casos SET poliza = NULL, patente = NULL, asegurado = NULL, telefono = NULL,
              respuestas = '{}'::jsonb, gps = NULL, direccion = NULL, croquis = NULL,
              anonimizado_en = now()
        WHERE id = $1`,
      [casoId],
    )
    await cliente.query(
      `UPDATE testigos SET nombre = 'Testigo suprimido', dni = NULL, telefono = NULL, relato = NULL,
              gps = NULL, anonimizado_en = now()
        WHERE caso_id = $1`,
      [casoId],
    )
    await cliente.query(
      `UPDATE terceros SET nombre = 'Tercero suprimido', dni = NULL, telefono = NULL, domicilio = NULL,
              patente = NULL, aseguradora = NULL, poliza = NULL, licencia = NULL, gps = NULL
        WHERE caso_id = $1`,
      [casoId],
    )
    await cliente.query('UPDATE medias SET purgada_en = now() WHERE caso_id = $1 AND purgada_en IS NULL', [casoId])
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }

  await rm(join(DIR_MEDIA, casoId), { recursive: true, force: true }).catch(() => undefined)
  await anotarEnBitacora('anonimizacion', { motivo }, { casoId })
}

/**
 * Da de baja la actuación entera.
 *
 * La puerta del disparador de inmutabilidad se abre con un set_config DENTRO de esta
 * transacción y se cierra sola al terminarla. Sin eso, el borrado en cascada dispara el
 * control sobre eventos y gestiones y la baja no funciona nunca, con un error que habla de
 * append-only y no de expurgo.
 */
export async function expurgar(casoId: string, motivo: string): Promise<void> {
  const pg = await db()
  const caso = await pg.query<{ hash_maestro: string | null; creado_en: string; cerrado_en: string | null; bloqueo_legal: boolean }>(
    'SELECT hash_maestro, creado_en, cerrado_en, bloqueo_legal FROM casos WHERE id = $1',
    [casoId],
  )
  const f = caso.rows[0]
  if (!f) throw new ErrorRetencion('No existe esa actuación.')
  if (f.bloqueo_legal) throw new ErrorRetencion('La actuación tiene bloqueo legal: no se puede dar de baja.')

  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    await cliente.query('SELECT set_config($1, $2, true)', ['acta.expurgo_caso', casoId])
    await cliente.query(
      `INSERT INTO expurgos (caso_id, hash_maestro, abierta_en, cerrada_en, motivo)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (caso_id) DO NOTHING`,
      [casoId, f.hash_maestro, f.creado_en, f.cerrado_en, motivo],
    )
    await cliente.query('DELETE FROM casos WHERE id = $1', [casoId])
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }

  await rm(join(DIR_MEDIA, casoId), { recursive: true, force: true }).catch(() => undefined)
  await anotarEnBitacora('expurgo', { caso_id: casoId, motivo })
}

/** Qué actuaciones cumplieron su plazo. Sin plazos configurados, ninguna. */
export async function candidatos(): Promise<Candidato[]> {
  if (!MESES_PIEZAS && !MESES_EXPEDIENTE) return []
  const pg = await db()
  const salida: Candidato[] = []

  if (MESES_PIEZAS > 0) {
    const res = await pg.query(
      `SELECT id, cerrado_en FROM casos
        WHERE estado = 'cerrado' AND NOT bloqueo_legal AND anonimizado_en IS NULL
          AND manifiesto_version <> '1.0'
          AND cerrado_en < now() - ($1 || ' months')::interval
        ORDER BY cerrado_en ASC LIMIT 200`,
      [String(MESES_PIEZAS)],
    )
    for (const f of res.rows) {
      salida.push({
        caso_id: f.id,
        cerrado_en: f.cerrado_en ? new Date(f.cerrado_en).toISOString() : null,
        meses: MESES_PIEZAS,
        accion: 'anonimizar',
      })
    }
  }

  if (MESES_EXPEDIENTE > 0) {
    const res = await pg.query(
      `SELECT id, cerrado_en FROM casos
        WHERE estado = 'cerrado' AND NOT bloqueo_legal
          AND cerrado_en < now() - ($1 || ' months')::interval
        ORDER BY cerrado_en ASC LIMIT 200`,
      [String(MESES_EXPEDIENTE)],
    )
    for (const f of res.rows) {
      salida.push({
        caso_id: f.id,
        cerrado_en: f.cerrado_en ? new Date(f.cerrado_en).toISOString() : null,
        meses: MESES_EXPEDIENTE,
        accion: 'expurgar',
      })
    }
  }

  return salida
}

/**
 * Aplica la política.
 *
 * SIMULA por omisión. Un proceso que borra expedientes tiene que decir primero qué va a
 * borrar: ejecutar de una es la clase de cosa que se descubre cuando ya no hay vuelta.
 */
export async function aplicarPolitica(ejecutar: boolean): Promise<{ simulado: boolean; acciones: Candidato[] }> {
  const acciones = await candidatos()
  if (!ejecutar) return { simulado: true, acciones }

  for (const a of acciones) {
    try {
      if (a.accion === 'expurgar') await expurgar(a.caso_id, `Plazo de conservación cumplido (${a.meses} meses)`)
      else await anonimizar(a.caso_id, `Plazo de conservación de las piezas cumplido (${a.meses} meses)`)
    } catch (err) {
      console.error('[retencion] no se pudo aplicar sobre', a.caso_id, err)
    }
  }
  return { simulado: false, acciones }
}
