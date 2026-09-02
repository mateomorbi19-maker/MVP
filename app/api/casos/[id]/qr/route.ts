import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { errorApi } from '@/lib/api'
import { exigirAccesoCaso } from '@/lib/posesion'
import { urlPublica } from '@/lib/casos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** QR que el testigo escanea con su propio teléfono para cargar sus datos. */
export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)

    /*
     * Lista blanca de destinos. El valor por omisión es 'testigo' porque es el que usa la
     * pantalla de testigos, que llama sin parámetros.
     */
    const DESTINOS: Record<string, string> = { testigo: 't', tercero: 'c', verificacion: 'v' }
    const pedido = new URL(req.url).searchParams.get('destino') ?? 'testigo'
    const prefijo = DESTINOS[pedido]
    if (!prefijo) {
      return NextResponse.json(
        { error: `Destino desconocido. Los válidos son: ${Object.keys(DESTINOS).join(', ')}.` },
        { status: 400 },
      )
    }
    const destino = `${urlPublica(req)}/${prefijo}/${id}`

    const svg = await QRCode.toString(destino, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 320,
      color: { dark: '#111318', light: '#ffffff' },
    })

    return new NextResponse(svg, {
      headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return errorApi('qr:GET', err, 'No se pudo generar el código para los testigos.')
  }
}
