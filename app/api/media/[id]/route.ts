import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { leerArchivo } from '@/lib/almacenamiento'
import { exigirAccesoCaso } from '@/lib/posesion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Sirve una foto o audio del volumen. La ruta se resuelve por id, nunca desde la URL.
 *
 * El acceso se comprueba contra la ACTUACIÓN a la que pertenece la pieza, no contra el id
 * del archivo. Antes alcanzaba con adivinar un IMG-XXXXXX —los mismos ~30 bits que un id
 * de actuación, y sin necesidad de conocer la actuación— para recibir cualquier fotografía
 * del choque: caras, patentes, a veces heridos. Era el dato más sensible del sistema y el
 * más fácil de sacar.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const pg = await db()
    const res = await pg.query('SELECT caso_id, archivo, mime FROM medias WHERE id = $1', [id])
    const fila = res.rows[0]
    if (!fila) return NextResponse.json({ error: 'Archivo inexistente.' }, { status: 404 })
    await exigirAccesoCaso(fila.caso_id)

    const bytes = await leerArchivo(fila.archivo)
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        'Content-Type': fila.mime,
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, max-age=3600',
      },
    })
  } catch (err) {
    return errorApi('media:GET', err, 'No se pudo leer el archivo.')
  }
}
