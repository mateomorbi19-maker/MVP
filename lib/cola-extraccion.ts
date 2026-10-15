import { db } from './db'
import { leerArchivo } from './almacenamiento'
import { registrarEvento, ErrorActuacionCerrada } from './hash'
import { bloquearCasoAbierto } from './casos'
import { proveedorActivo, type TipoDocumento, type ResultadoExtraccion } from './extraccion'

/**
 * Cola de lectura automática, en proceso.
 *
 * Corre después de responder la subida de la foto: la evidencia manda, y la persona no
 * tiene por qué esperar a que un proveedor conteste parada al lado del auto.
 *
 * NO hay reintento automático de fondo, y es deliberado: un setInterval a nivel de módulo
 * en Next se duplica con la recarga en caliente y es una fuente de errores peor que el
 * problema que resuelve. Lo que hay es un endpoint para reencolar, que la pantalla de
 * validación llama sola cuando ve una lectura pendiente de hace más de medio minuto.
 */

let corriendo = false
const pendientes: string[] = []

async function procesar(extraccionId: string): Promise<void> {
  const pg = await db()
  const res = await pg.query(
    `SELECT e.id, e.caso_id, e.tipo_documento, m.archivo, m.mime, c.estado
       FROM extracciones e
       JOIN medias m ON m.id = e.media_id
       JOIN casos c ON c.id = e.caso_id
      WHERE e.id = $1 AND e.estado = 'pendiente'`,
    [extraccionId],
  )
  const fila = res.rows[0]
  if (!fila) return
  // Si la actuación se cerró mientras esperaba, no se toca más.
  if (fila.estado === 'cerrado') return

  const proveedor = proveedorActivo()
  if (!proveedor) return

  let resultado: ResultadoExtraccion | null = null
  let motivo: string | null = null
  try {
    const bytes = await leerArchivo(fila.archivo)
    resultado = await proveedor.leer(new Uint8Array(bytes), fila.mime, fila.tipo_documento as TipoDocumento)
  } catch (err) {
    motivo = (err instanceof Error ? err.message : 'No se pudo completar la lectura').slice(0, 400)
  }

  // El proveedor puede terminar cuando el expediente ya se cerró: se relee bajo lock.
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    await bloquearCasoAbierto(fila.caso_id, cliente)
    const actual = await cliente.query('SELECT estado FROM extracciones WHERE id = $1 AND caso_id = $2 FOR UPDATE', [extraccionId, fila.caso_id])
    if (actual.rows[0]?.estado !== 'pendiente') {
      await cliente.query('ROLLBACK')
      return
    }
    if (resultado) {
      await cliente.query(
        `UPDATE extracciones
            SET estado = 'lista', campos = $2, confianza_global = $3, simulado = $4, procesado_en = now(), error = NULL
          WHERE id = $1`,
        [extraccionId, JSON.stringify(resultado.campos), resultado.confianza_global, resultado.simulado],
      )
      await registrarEvento(fila.caso_id, 'lectura_automatica_registrada', {
        extraccion_id: extraccionId,
        proveedor: proveedor.nombre,
        simulado: resultado.simulado,
        confianza_global: resultado.confianza_global,
        campos: resultado.campos.map((c) => ({ clave: c.clave, confianza: c.confianza })),
      }, { cliente })
    } else {
      await cliente.query(`UPDATE extracciones SET estado = 'fallida', error = $2, procesado_en = now() WHERE id = $1`, [extraccionId, motivo])
      await registrarEvento(fila.caso_id, 'lectura_automatica_fallida', { extraccion_id: extraccionId },
        { reservado: { motivo }, cliente })
    }
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    if (err instanceof ErrorActuacionCerrada) return
    throw err
  } finally {
    cliente.release()
  }
}

async function drenar(): Promise<void> {
  if (corriendo) return
  corriendo = true
  try {
    while (pendientes.length > 0) {
      const id = pendientes.shift()
      if (id) await procesar(id).catch((err) => console.error('[extraccion] falló', id, err))
    }
  } finally {
    corriendo = false
  }
}

/** Encola una lectura sin esperar. Quien llama sigue y responde. */
export function encolarLectura(extraccionId: string): void {
  pendientes.push(extraccionId)
  void drenar()
}

/**
 * Reencola las que quedaron colgadas.
 *
 * Un redeploy con trabajos en vuelo deja filas en 'pendiente' para siempre, porque la cola
 * vive en el proceso. Esto es la salida, y la dispara la propia pantalla de validación.
 */
export async function reencolarPendientes(casoId: string): Promise<number> {
  const pg = await db()
  const cliente = await pg.connect()
  let ids: string[] = []
  try {
    await cliente.query('BEGIN')
    await bloquearCasoAbierto(casoId, cliente)
    const res = await cliente.query<{ id: string }>(
      `UPDATE extracciones SET estado = 'pendiente', error = NULL
        WHERE caso_id = $1 AND estado IN ('pendiente', 'fallida') RETURNING id`, [casoId],
    )
    ids = res.rows.map((fila) => fila.id)
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }
  for (const id of ids) encolarLectura(id)
  return ids.length
}
