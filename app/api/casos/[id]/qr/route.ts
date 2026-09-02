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
    const destino = `${urlPublica(req)}/t/${id}`

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
