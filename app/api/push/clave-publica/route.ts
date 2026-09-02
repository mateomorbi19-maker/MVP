import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { clavePublicaVapid, huellaVapid, pushActivo } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * La clave pública para pushManager.subscribe.
 *
 * Responde 200 aun con las notificaciones apagadas, con el motivo: así la pantalla puede
 * explicar por qué no ofrece suscribirse, en vez de fallar en silencio.
 *
 * La huella acompaña a la clave porque la clave pública queda incrustada dentro de cada
 * suscripción guardada en el navegador: si la del servidor cambia, todas las viejas dejan
 * de funcionar con un 403 y nada en la interfaz lo dice. Con la huella se detecta.
 */
export async function GET() {
  try {
    if (!pushActivo()) {
      return NextResponse.json({ activo: false, motivo: 'Las notificaciones están desactivadas en este servidor.' })
    }
    return NextResponse.json({ activo: true, clave: clavePublicaVapid(), huella: huellaVapid() })
  } catch (err) {
    return errorApi('push:clave', err, 'No se pudo leer la clave de notificaciones.')
  }
}
