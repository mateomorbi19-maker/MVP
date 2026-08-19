import { NextResponse } from 'next/server'
import { estadoBase } from '@/lib/db'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Comprobación de salud. Primer lugar donde mirar cuando algo no funciona:
 * dice si la base está configurada, alcanzable y con el esquema creado.
 *
 *   curl http://localhost:3000/api/salud
 */
export async function GET() {
  const base = await estadoBase()
  return NextResponse.json(
    {
      ok: base.ok,
      base,
      configuracion: {
        DATABASE_URL: process.env.DATABASE_URL ? 'definida' : 'FALTA',
        URL_PUBLICA: process.env.URL_PUBLICA ?? '(sin definir: se deduce del host)',
        DIR_DATOS: process.env.DIR_DATOS ?? './data (por defecto)',
        DATABASE_SSL: process.env.DATABASE_SSL ?? 'false',
        TSA_URL: process.env.TSA_URL ?? 'https://freetsa.org/tsr (por defecto)',
      },
    },
    { status: base.ok ? 200 : 503 },
  )
}
