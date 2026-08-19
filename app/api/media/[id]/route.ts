import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { leerArchivo } from '@/lib/almacenamiento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Sirve una foto o audio del volumen. La ruta se resuelve por id, nunca desde la URL. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const pg = await db()
    const res = await pg.query('SELECT archivo, mime FROM medias WHERE id = $1', [id])
    const fila = res.rows[0]
    if (!fila) return NextResponse.json({ error: 'Archivo inexistente.' }, { status: 404 })

    const bytes = await leerArchivo(fila.archivo)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': fila.mime,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    console.error('[media:GET]', err)
    return NextResponse.json({ error: 'No se pudo leer el archivo.' }, { status: 500 })
  }
}
