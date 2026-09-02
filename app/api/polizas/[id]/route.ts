import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { ErrorPoliza, marcarPrincipal } from '@/lib/polizas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Designa la póliza principal, que es la que precarga la carátula. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const cuerpo = await req.json().catch(() => ({}))
    if (cuerpo?.principal !== true) {
      return NextResponse.json({ error: 'Sólo se puede designar la póliza principal.' }, { status: 400 })
    }
    await marcarPrincipal(sesion.usuario_id, id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ErrorPoliza) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('poliza:PATCH', err, 'No se pudo actualizar la póliza.')
  }
}
