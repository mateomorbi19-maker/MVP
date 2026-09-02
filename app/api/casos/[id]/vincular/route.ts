import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { hashToken } from '@/lib/claves'
import { exigirRol } from '@/lib/sesion'
import { registrarEvento } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'
import { anotarEnBitacora } from '@/lib/bitacora'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Vincula a una cuenta una actuación que se abrió sin identificarse.
 *
 * Exige sesión Y el secreto de apertura. La posesión del id NO alcanza, y el motivo es
 * concreto: el id de la actuación se dicta por teléfono, se imprime en el expediente y
 * viaja dentro del QR que escanea cualquier testigo que pase. Si bastara con el id,
 * cualquiera que haya visto una hoja del expediente podría apropiarse de la titularidad.
 *
 * El secreto se devuelve una sola vez, en el alta, y vive en el teléfono junto al id.
 *
 * Si la actuación ya está sellada, la vinculación se asienta en la bitácora y NO en la
 * cadena de custodia: un eslabón posterior al cierre haría que el verificador público
 * informe como alterado un expediente intacto.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })

    if (caso.usuario_id && caso.usuario_id !== sesion.usuario_id) {
      return NextResponse.json({ error: 'Esa actuación ya está vinculada a otra cuenta.' }, { status: 409 })
    }
    if (caso.usuario_id === sesion.usuario_id) return NextResponse.json({ ok: true, yaVinculada: true })

    const cuerpo = await req.json().catch(() => ({}))
    const secreto = typeof cuerpo?.secreto === 'string' ? cuerpo.secreto : ''

    /*
     * El hash del secreto se lee acá y no viaja dentro del tipo Caso, para que no pueda
     * colarse en la respuesta de GET /api/casos/[id], que devuelve el caso entero.
     */
    const pgLectura = await db()
    const guardado = await pgLectura.query<{ secreto_sha256: string | null }>(
      'SELECT secreto_sha256 FROM casos WHERE id = $1',
      [id],
    )
    const esperado = guardado.rows[0]?.secreto_sha256 ?? null

    if (!esperado || !secreto || hashToken(secreto) !== esperado) {
      return NextResponse.json(
        {
          error:
            'No pudimos comprobar que esta actuación sea tuya. Abrila desde el teléfono donde la iniciaste, o pedile a tu aseguradora que te la asigne.',
        },
        { status: 403 },
      )
    }

    const pg = await db()
    await pg.query('UPDATE casos SET usuario_id = $2 WHERE id = $1', [id, sesion.usuario_id])

    if (caso.estado === 'cerrado') {
      await anotarEnBitacora('vinculacion_post_cierre', {}, { casoId: id, usuarioId: sesion.usuario_id })
    } else {
      await registrarEvento(id, 'caso_vinculado_a_cuenta', { usuario_id: sesion.usuario_id })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorApi('vincular:POST', err, 'No se pudo vincular la actuación a la cuenta.')
  }
}
