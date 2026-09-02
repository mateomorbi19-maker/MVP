import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { exigirRol, leerSesion } from '@/lib/sesion'
import { exigirAccesoCaso } from '@/lib/posesion'
import { avanzarGestion, ErrorGestion, listarGestiones, registrarGestion, type EstadoGestion } from '@/lib/gestion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** La línea de tiempo de la tramitación. No devuelve nada del acta. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const pg = await db()
    const caso = await pg.query('SELECT estado_gestion FROM casos WHERE id = $1', [id])
    return NextResponse.json({
      estado: caso.rows[0]?.estado_gestion ?? 'sin_enviar',
      gestiones: await listarGestiones(id),
    })
  } catch (err) {
    return errorApi('gestion:GET', err, 'No se pudo leer la tramitación.')
  }
}

/** Confirmar recepción, poner en trámite, comentar o marcar resuelta. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('productor', 'aseguradora')
    const cuerpo = await req.json().catch(() => ({}))

    if (typeof cuerpo?.comentario === 'string' && cuerpo.comentario.trim()) {
      await registrarGestion(id, 'comentario_del_productor', { texto: cuerpo.comentario.trim().slice(0, 2000) }, sesion.usuario_id)
      return NextResponse.json({ ok: true })
    }

    const estados: EstadoGestion[] = ['recibida', 'en_tramite', 'resuelta']
    if (!estados.includes(cuerpo?.estado)) {
      return NextResponse.json(
        { error: `Estado no válido. Los que se pueden poner desde acá son: ${estados.join(', ')}.` },
        { status: 400 },
      )
    }
    await avanzarGestion(id, cuerpo.estado, sesion.usuario_id, { nota: cuerpo?.nota ?? null })
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ErrorGestion) return NextResponse.json({ error: err.message }, { status: 409 })
    return errorApi('gestion:POST', err, 'No se pudo registrar el movimiento.')
  }
}
