import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { crearProductor, ErrorPoliza, listarProductores } from '@/lib/polizas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Los productores.
 *
 * El asegurado también los lee, porque necesita elegir a quién mandarle el acta, y para
 * eso alcanza con nombre y aseguradora: el email y el teléfono sólo los ve la aseguradora.
 */
export async function GET() {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const todos = await listarProductores()
    if (sesion.rol === 'aseguradora') return NextResponse.json(todos)
    return NextResponse.json(
      todos
        .filter((p) => p.activo)
        .map((p) => ({ id: p.id, nombre: p.nombre, aseguradora: p.aseguradora })),
    )
  } catch (err) {
    return errorApi('productores:GET', err, 'No se pudieron leer los productores.')
  }
}

export async function POST(req: Request) {
  try {
    await exigirRol('aseguradora')
    const id = await crearProductor(await req.json().catch(() => ({})))
    return NextResponse.json({ ok: true, id }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorPoliza) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('productores:POST', err, 'No se pudo dar de alta el productor.')
  }
}
