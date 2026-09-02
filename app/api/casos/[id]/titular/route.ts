import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { exigirRol } from '@/lib/sesion'
import { obtenerCaso } from '@/lib/casos'
import { anotarEnBitacora } from '@/lib/bitacora'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Reasignación manual del titular y del productor.
 *
 * Es la única salida para quien perdió el teléfono o borró los datos del navegador y ya
 * no tiene el secreto de apertura. Queda asentada en la bitácora con quién la hizo:
 * mover la titularidad de un expediente es exactamente el movimiento que después alguien
 * va a querer auditar.
 *
 * Nunca toca la cadena de custodia ni el contenido del expediente.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('aseguradora')
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })

    const cuerpo = await req.json().catch(() => ({}))
    const usuarioId = typeof cuerpo?.usuario_id === 'string' ? cuerpo.usuario_id : null
    const productorId = typeof cuerpo?.productor_id === 'string' ? cuerpo.productor_id : null
    if (!usuarioId && !productorId) {
      return NextResponse.json({ error: 'Indicá el titular, el productor, o los dos.' }, { status: 400 })
    }

    const pg = await db()
    await pg.query(
      'UPDATE casos SET usuario_id = COALESCE($2, usuario_id), productor_id = COALESCE($3, productor_id) WHERE id = $1',
      [id, usuarioId, productorId],
    )
    await anotarEnBitacora(
      'reasignacion',
      { titular_anterior: caso.usuario_id, titular_nuevo: usuarioId, productor_nuevo: productorId, por: sesion.usuario_id },
      { casoId: id, usuarioId: sesion.usuario_id },
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorApi('titular:PATCH', err, 'No se pudo reasignar la actuación.')
  }
}
