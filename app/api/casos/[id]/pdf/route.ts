import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { datosExpediente } from '@/lib/casos'
import { generarExpediente } from '@/lib/pdf'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type Ctx = { params: Promise<{ id: string }> }

/** Genera el expediente en PDF. Se regenera en cada pedido a partir de la base. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const datos = await datosExpediente(id)
    if (!datos) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })

    const pdf = await generarExpediente(datos)
    const descargar = new URL(req.url).searchParams.get('descargar') === '1'

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Length': String(pdf.length),
        'Content-Disposition': `${descargar ? 'attachment' : 'inline'}; filename="expediente-${id}.pdf"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (err) {
    return errorApi('pdf:GET', err, 'No se pudo generar el expediente.')
  }
}
