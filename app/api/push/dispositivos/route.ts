import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { sha256 } from '@/lib/hash'
import { leerSesion } from '@/lib/sesion'
import { huellaVapid } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Alta o reactivación de una suscripción. Idempotente por endpoint. */
export async function POST(req: Request) {
  try {
    const sesion = await leerSesion()
    const cuerpo = await req.json().catch(() => ({}))
    const endpoint = typeof cuerpo?.endpoint === 'string' ? cuerpo.endpoint : ''
    const p256dh = typeof cuerpo?.p256dh === 'string' ? cuerpo.p256dh : ''
    const auth = typeof cuerpo?.auth === 'string' ? cuerpo.auth : ''
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'La suscripción llegó incompleta.' }, { status: 400 })
    }

    const pg = await db()
    await pg.query(
      `INSERT INTO dispositivos (id, usuario_id, endpoint, endpoint_sha256, p256dh, auth, plataforma, user_agent, huella_vapid, ultimo_uso)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
       ON CONFLICT (endpoint_sha256) DO UPDATE
         SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, activo = true, baja_motivo = NULL,
             usuario_id = COALESCE(EXCLUDED.usuario_id, dispositivos.usuario_id),
             huella_vapid = EXCLUDED.huella_vapid, ultimo_uso = now()`,
      [
        nuevoId('DIS'),
        sesion?.usuario_id ?? null,
        endpoint,
        sha256(endpoint),
        p256dh,
        auth,
        typeof cuerpo?.plataforma === 'string' ? cuerpo.plataforma.slice(0, 40) : null,
        req.headers.get('user-agent')?.slice(0, 200) ?? null,
        huellaVapid(),
      ],
    )
    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (err) {
    return errorApi('dispositivos:POST', err, 'No se pudo registrar el teléfono.')
  }
}

/** Baja lógica. Nunca borra la fila: sirve para auditar por qué dejó de recibir avisos. */
export async function DELETE(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const endpoint = typeof cuerpo?.endpoint === 'string' ? cuerpo.endpoint : ''
    if (!endpoint) return NextResponse.json({ error: 'Falta la suscripción.' }, { status: 400 })
    const pg = await db()
    await pg.query(
      `UPDATE dispositivos SET activo = false, baja_motivo = 'baja pedida por el dispositivo' WHERE endpoint_sha256 = $1`,
      [sha256(endpoint)],
    )
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorApi('dispositivos:DELETE', err, 'No se pudo dar de baja el teléfono.')
  }
}
