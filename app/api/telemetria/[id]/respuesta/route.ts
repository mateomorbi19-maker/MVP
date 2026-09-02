import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { planEscalamiento, type Veredicto } from '@/lib/impacto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Qué contestó la persona en la ventana de verificación, o que se venció sin respuesta.
 *
 * Devuelve el plan de escalamiento. NUNCA incluye llamar a emergencias por cuenta propia:
 * lo que hace es dejar los botones a un toque y el borrador de la denuncia abierto con la
 * hora y el lugar del impacto. Una llamada automática por un falso positivo satura una
 * línea que alguien más puede necesitar.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const respuesta = ['estoy_bien', 'necesito_ayuda', 'sin_respuesta'].includes(cuerpo?.respuesta)
      ? cuerpo.respuesta
      : null
    if (!respuesta) {
      return NextResponse.json(
        { error: 'Respuesta no válida. Las posibles son: estoy_bien, necesito_ayuda, sin_respuesta.' },
        { status: 400 },
      )
    }

    const pg = await db()
    const res = await pg.query('SELECT veredicto FROM telemetria WHERE id = $1', [id])
    if (res.rowCount === 0) return NextResponse.json({ error: 'No existe esa lectura.' }, { status: 404 })

    await pg.query('UPDATE telemetria SET respuesta = $2, respondido_en = now() WHERE id = $1', [id, respuesta])

    const veredicto = res.rows[0].veredicto as Veredicto
    return NextResponse.json({ ok: true, plan: planEscalamiento(veredicto, respuesta !== 'sin_respuesta') })
  } catch (err) {
    return errorApi('telemetria:respuesta', err, 'No se pudo registrar la respuesta.')
  }
}
