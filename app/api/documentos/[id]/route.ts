import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { exigirRol } from '@/lib/sesion'
import { leerDocumento } from '@/lib/almacenamiento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Devuelve un documento adjunto.
 *
 * A diferencia de las fotos del siniestro, esto NUNCA es alcanzable por posesión de un id:
 * son documentos personales del asegurado —licencia, cédula, póliza—, no evidencia del
 * hecho, y nadie más que él, su productor o la aseguradora tiene por qué verlos.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const pg = await db()
    const res = await pg.query(
      `SELECT d.archivo, d.mime, po.usuario_id, pr.usuario_id AS productor_usuario_id
         FROM documentos_poliza d
         JOIN polizas po ON po.id = d.poliza_id
         LEFT JOIN productores pr ON pr.id = po.productor_id
        WHERE d.id = $1`,
      [id],
    )
    const fila = res.rows[0]
    if (!fila) return NextResponse.json({ error: 'Documento inexistente.' }, { status: 404 })

    const puede =
      sesion.rol === 'aseguradora' ||
      fila.usuario_id === sesion.usuario_id ||
      (fila.productor_usuario_id && fila.productor_usuario_id === sesion.usuario_id)
    if (!puede) return NextResponse.json({ error: 'Ese documento no es tuyo.' }, { status: 403 })

    const bytes = await leerDocumento(fila.archivo)
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': fila.mime, 'Content-Length': String(bytes.length), 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    return errorApi('documento:GET', err, 'No se pudo leer el documento.')
  }
}
