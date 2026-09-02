import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { sha256 } from '@/lib/hash'
import { enviarPush } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Manda un aviso de prueba a una suscripción.
 *
 * Sin esto, un push que no llega no se distingue de un permiso denegado, de una clave
 * VAPID cambiada, de un endpoint caducado o de un navegador que no lo soporta. Con esto,
 * la respuesta dice cuál de las cinco cosas pasó.
 */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const endpoint = typeof cuerpo?.endpoint === 'string' ? cuerpo.endpoint : ''
    if (!endpoint) return NextResponse.json({ error: 'Falta la suscripción.' }, { status: 400 })

    const pg = await db()
    const res = await pg.query('SELECT endpoint, p256dh, auth FROM dispositivos WHERE endpoint_sha256 = $1 AND activo', [
      sha256(endpoint),
    ])
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Este teléfono no está suscripto en el servidor.' }, { status: 404 })
    }

    const resultado = await enviarPush(res.rows[0], {
      titulo: 'Acta Digital',
      cuerpo: 'Las notificaciones funcionan en este teléfono.',
      url: '/',
    })
    if (resultado.caducada) {
      await pg.query(`UPDATE dispositivos SET activo = false, baja_motivo = 'suscripción caducada' WHERE endpoint_sha256 = $1`, [
        sha256(endpoint),
      ])
    }
    return NextResponse.json(resultado, { status: resultado.ok ? 200 : 502 })
  } catch (err) {
    return errorApi('push:prueba', err, 'No se pudo mandar el aviso de prueba.')
  }
}
