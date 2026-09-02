import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { urlPublica } from '@/lib/casos'
import { leerSesion } from '@/lib/sesion'
import { exigirAccesoCaso } from '@/lib/posesion'
import { entregar, ErrorEntrega } from '@/lib/entregas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/**
 * Entrega el expediente sellado a un productor.
 *
 * Sin sesión sólo se acepta un productor_id de la lista, nunca un destinatario de texto
 * libre. Con destinatario libre y sin cuenta, cualquiera que tenga un número de actuación
 * convierte el servidor en un emisor de correo no deseado con nuestro dominio, y quema la
 * reputación del remitente para todos los envíos reales.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const sesion = await leerSesion()
    const cuerpo = await req.json().catch(() => ({}))
    const pg = await db()

    let destinatario: string | null = null
    let productorId: string | null = null

    if (typeof cuerpo?.productor_id === 'string') {
      const res = await pg.query('SELECT id, email FROM productores WHERE id = $1 AND activo', [cuerpo.productor_id])
      if (res.rowCount === 0) return NextResponse.json({ error: 'Ese productor no existe.' }, { status: 400 })
      productorId = res.rows[0].id
      destinatario = res.rows[0].email
    } else if (typeof cuerpo?.destinatario === 'string' && sesion) {
      destinatario = cuerpo.destinatario.trim().slice(0, 200)
    }

    if (!destinatario) {
      return NextResponse.json(
        { error: 'Elegí un productor de la lista. Para mandarlo a otra dirección hay que iniciar sesión.' },
        { status: 400 },
      )
    }

    const envio = await entregar(id, destinatario, productorId, urlPublica(req), sesion?.usuario_id ?? null)
    if (productorId) await pg.query('UPDATE casos SET productor_id = COALESCE(productor_id, NULL) WHERE id = $1', [id])

    return NextResponse.json({ ok: true, envio }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorEntrega) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('enviar:POST', err, 'No se pudo entregar el expediente.')
  }
}
