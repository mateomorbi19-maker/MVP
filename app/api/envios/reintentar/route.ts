import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { urlPublica } from '@/lib/casos'
import { leerSesion } from '@/lib/sesion'
import { reintentarPendientes } from '@/lib/entregas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

/**
 * Barrido de los envíos que fallaron.
 *
 * El proyecto no tiene planificador y no se le va a agregar uno. Esto es el gancho para un
 * cron externo —en Easypanel, una línea de curl con la cabecera x-token-reintento— o para
 * el botón del panel. Si nadie hace ninguna de las dos cosas, un envío fallido se queda
 * fallido hasta que alguien lo mire, y eso se ve en la pantalla.
 */
export async function POST(req: Request) {
  try {
    const esperado = process.env.ENVIOS_TOKEN_REINTENTO
    const sesion = await leerSesion()
    const autorizado =
      sesion?.rol === 'aseguradora' || (esperado && req.headers.get('x-token-reintento') === esperado)
    if (!autorizado) {
      return NextResponse.json(
        { error: 'Hace falta la sesión de la aseguradora o la cabecera x-token-reintento.' },
        { status: 401 },
      )
    }
    return NextResponse.json({ ok: true, reenviados: await reintentarPendientes(urlPublica(req)) })
  } catch (err) {
    return errorApi('reintentar:POST', err, 'No se pudieron reintentar los envíos.')
  }
}
