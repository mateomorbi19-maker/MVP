import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { abrirEntrega, ErrorEntrega } from '@/lib/entregas'
import { anotarPosesion } from '@/lib/posesion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Consume el token de una entrega.
 *
 * El token llega en el CUERPO y no en la URL: así no queda en los registros de acceso del
 * servidor ni en la cabecera Referer. Y se consume por POST y no por GET porque los
 * escáneres de enlaces corporativos —SafeLinks, Proofpoint, el proxy de Gmail— visitan
 * todos los enlaces de un correo antes de que lo abra nadie, y un token de un solo uso
 * consumido así llegaría quemado.
 */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const envioId = typeof cuerpo?.envio === 'string' ? cuerpo.envio : ''
    const token = typeof cuerpo?.token === 'string' ? cuerpo.token : ''
    if (!envioId || !token) return NextResponse.json({ error: 'Enlace incompleto.' }, { status: 400 })

    const casoId = await abrirEntrega(envioId, token)
    // Con el enlace consumido, este navegador pasa a tener acceso a la actuación.
    await anotarPosesion(casoId)
    return NextResponse.json({ ok: true, caso_id: casoId })
  } catch (err) {
    if (err instanceof ErrorEntrega) return NextResponse.json({ error: err.message }, { status: 403 })
    return errorApi('abrir:POST', err, 'No se pudo abrir la entrega.')
  }
}
