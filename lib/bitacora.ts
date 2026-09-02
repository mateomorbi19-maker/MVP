import { db } from './db'

/**
 * Bitácora administrativa. NO es la cadena de custodia.
 *
 * Todo lo que ocurre DESPUÉS del sellado se asienta acá y no en la tabla de eventos. El
 * motivo es concreto: el verificador público recalcula el manifiesto sobre TODOS los
 * eventos de la actuación y lo compara contra el hash que se selló. Un eslabón nuevo
 * posterior al cierre —vincular la actuación a una cuenta, reasignar el titular, avisarle
 * al productor— haría que el verificador informe «el expediente fue modificado después de
 * cerrarse» sobre un expediente perfectamente íntegro, y de forma irreparable.
 *
 * Se consideró y se descartó cortar el manifiesto en el eslabón de cierre: sería
 * retrocompatible, pero rompe una propiedad hoy limpia —que CUALQUIER fila agregada a
 * eventos rompe la verificación—, y con el corte alguien con escritura en la base podría
 * apilar filas con pinta de eventos del acta sin que la verificación lo note.
 */
export async function anotarEnBitacora(
  tipo: string,
  detalle: Record<string, unknown> = {},
  refs: { casoId?: string | null; usuarioId?: string | null } = {},
): Promise<void> {
  const pg = await db()
  await pg.query('INSERT INTO bitacora (tipo, caso_id, usuario_id, detalle) VALUES ($1, $2, $3, $4)', [
    tipo,
    refs.casoId ?? null,
    refs.usuarioId ?? null,
    JSON.stringify(detalle),
  ])
}

export interface AnotacionBitacora {
  id: number
  ts: string
  tipo: string
  usuario_id: string | null
  detalle: Record<string, unknown>
}

export async function listarBitacora(casoId: string): Promise<AnotacionBitacora[]> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM bitacora WHERE caso_id = $1 ORDER BY id ASC', [casoId])
  return res.rows.map((f) => ({
    id: Number(f.id),
    ts: new Date(f.ts).toISOString(),
    tipo: f.tipo,
    usuario_id: f.usuario_id,
    detalle: f.detalle ?? {},
  }))
}
