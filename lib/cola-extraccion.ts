import { db } from './db'
import { leerArchivo } from './almacenamiento'
import { registrarEvento } from './hash'
import { proveedorActivo, type TipoDocumento } from './extraccion'

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

  try {
    const bytes = await leerArchivo(fila.archivo)
    const resultado = await proveedor.leer(new Uint8Array(bytes), fila.mime, fila.tipo_documento as TipoDocumento)

    await pg.query(
      `UPDATE extracciones
          SET estado = 'lista', campos = $2, confianza_global = $3, simulado = $4, procesado_en = now()
        WHERE id = $1`,
      [extraccionId, JSON.stringify(resultado.campos), resultado.confianza_global, resultado.simulado],
    )

    /*
     * El eslabón guarda la confianza y el proveedor. El número no se le muestra al
     * asegurado —la especificación funcional lo pide expresamente— pero sí tiene que
     * quedar en el expediente: es lo que después permite auditar de dónde salió un dato.
     */
    await registrarEvento(fila.caso_id, 'lectura_automatica_registrada', {
      extraccion_id: extraccionId,
      proveedor: proveedor.nombre,
      simulado: resultado.simulado,
      confianza_global: resultado.confianza_global,
      campos: resultado.campos.map((c) => ({ clave: c.clave, confianza: c.confianza })),
    })
  } catch (err) {
    const motivo = err instanceof Error ? err.message : 'Error desconocido'
    await pg.query(`UPDATE extracciones SET estado = 'fallida', error = $2, procesado_en = now() WHERE id = $1`, [
      extraccionId,
      motivo.slice(0, 400),
    ])
    await registrarEvento(fila.caso_id, 'lectura_automatica_fallida', { extraccion_id: extraccionId, error: motivo.slice(0, 200) })
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
  const res = await pg.query<{ id: string }>(
    `SELECT id FROM extracciones WHERE caso_id = $1 AND estado IN ('pendiente', 'fallida')`,
    [casoId],
  )
  for (const f of res.rows) {
    await pg.query(`UPDATE extracciones SET estado = 'pendiente', error = NULL WHERE id = $1`, [f.id])
    encolarLectura(f.id)
  }
  return res.rows.length
}
