import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { actualizarPoliza, ErrorPoliza, listarCambiosPoliza, marcarPrincipal } from '@/lib/polizas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Designa la póliza principal, que es la que precarga la carátula. */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const cuerpo = await req.json().catch(() => ({}))
    if (cuerpo?.principal === true) await marcarPrincipal(sesion.usuario_id, id)
    else await actualizarPoliza(sesion.usuario_id, id, cuerpo)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ErrorPoliza) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('poliza:PATCH', err, 'No se pudo actualizar la póliza.')
  }
}

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    return NextResponse.json(await listarCambiosPoliza(sesion.usuario_id, id))
  } catch (err) {
    if (err instanceof ErrorPoliza) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('poliza:GET', err, 'No se pudo leer el historial. Volvé a cargar la póliza.')
  }
}
