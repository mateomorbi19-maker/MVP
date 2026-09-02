import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { anotarPosesion, exigirAccesoCaso } from '@/lib/posesion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Anota que este navegador tiene el id de esta actuación.
 *
 * Lo llama el recorrido al montar. No sube nada ni cambia el expediente: es lo que
 * después habilita las fotos, el audio, el expediente en PDF y el QR de testigos sin
 * pedir una cuenta, que es la decisión central del producto.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    await anotarPosesion(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorApi('posesion:POST', err, 'No se pudo registrar el acceso a la actuación.')
  }
}
