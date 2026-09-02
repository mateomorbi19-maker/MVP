import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { leerSesion } from '@/lib/sesion'
import { aplicarPolitica, ErrorRetencion } from '@/lib/retencion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Aplica la política de conservación.
 *
 * SIMULA por omisión: hay que pedir `ejecutar: true` expresamente. Un proceso que borra
 * expedientes tiene que decir primero qué va a borrar.
 *
 * Pensado para un cron diario con la cabecera x-clave-mantenimiento, o para que lo dispare
 * a mano la aseguradora. Sin CLAVE_MANTENIMIENTO definida sólo funciona con sesión.
 */
export async function POST(req: Request) {
  try {
    const esperada = process.env.CLAVE_MANTENIMIENTO
    const sesion = await leerSesion()
    const autorizado =
      sesion?.rol === 'aseguradora' || (esperada && req.headers.get('x-clave-mantenimiento') === esperada)
    if (!autorizado) {
      return NextResponse.json(
        { error: 'Hace falta la sesión de la aseguradora o la cabecera x-clave-mantenimiento.' },
        { status: 401 },
      )
    }

    const cuerpo = await req.json().catch(() => ({}))
    const resultado = await aplicarPolitica(cuerpo?.ejecutar === true)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (err) {
    if (err instanceof ErrorRetencion) return NextResponse.json({ error: err.message }, { status: 409 })
    return errorApi('expurgo:POST', err, 'No se pudo aplicar la política de conservación.')
  }
}
