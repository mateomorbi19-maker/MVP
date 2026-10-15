import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { actualizarPoliza, ErrorPoliza } from '@/lib/polizas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    await actualizarPoliza(sesion.usuario_id, id, await req.json().catch(() => ({})), true, sesion)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ErrorPoliza) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('estado-cuenta:PUT', err, 'No se pudo guardar el estado de cuenta. Revisá los datos y volvé a intentar.')
  }
}
