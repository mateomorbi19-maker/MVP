import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { crearPoliza, ErrorPoliza, listarPolizas } from '@/lib/polizas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Las pólizas de quien está en sesión, con su productor y su documentación. */
export async function GET() {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    return NextResponse.json(await listarPolizas(sesion.usuario_id))
  } catch (err) {
    return errorApi('polizas:GET', err, 'No se pudieron leer las pólizas.')
  }
}

export async function POST(req: Request) {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const id = await crearPoliza(sesion.usuario_id, await req.json().catch(() => ({})))
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorPoliza) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('polizas:POST', err, 'No se pudo guardar la póliza.')
  }
}
