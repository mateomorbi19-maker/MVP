import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { ErrorIntercambio, leerDocumentacionCompartida } from '@/lib/intercambio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const PRIVACIDAD = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
}

export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await params
    const archivo = new URL(req.url).searchParams.get('archivo')
    const resultado = await leerDocumentacionCompartida(token, archivo)
    if ('bytes' in resultado && resultado.bytes) {
      const extension = resultado.mime === 'application/pdf' ? 'pdf' : resultado.mime.split('/')[1]?.replace(/[^a-z0-9]/g, '') || 'bin'
      return new NextResponse(new Uint8Array(resultado.bytes), { headers: {
        ...PRIVACIDAD,
        'Content-Type': resultado.mime,
        'Content-Length': String(resultado.bytes.length),
        'Content-Disposition': `inline; filename="documento.${extension}"`,
        'Content-Security-Policy': "sandbox; default-src 'none'",
      } })
    }
    return NextResponse.json(resultado, { headers: PRIVACIDAD })
  } catch (err) {
    if (err instanceof ErrorIntercambio) return NextResponse.json({ error: err.message }, { status: err.estado, headers: PRIVACIDAD })
    const respuesta = errorApi('documentacion-compartida:GET', err, 'No se pudo abrir el documento. Pedí un enlace nuevo o volvé a intentar.')
    for (const [clave, valor] of Object.entries(PRIVACIDAD)) respuesta.headers.set(clave, valor)
    return respuesta
  }
}
