import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { exigirRol } from '@/lib/sesion'
import { ErrorArchivo, guardarDocumento, TAMANO_MAXIMO } from '@/lib/almacenamiento'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/** Adjunta cédula verde, licencia, VTV o la póliza en PDF. */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const pg = await db()
    const duena = await pg.query('SELECT 1 FROM polizas WHERE id = $1 AND usuario_id = $2', [id, sesion.usuario_id])
    if (duena.rowCount === 0) return NextResponse.json({ error: 'Esa póliza no es tuya.' }, { status: 403 })

    const form = await req.formData()
    const archivo = form.get('archivo')
    if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
    if (archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json(
        { error: `El archivo supera el máximo de ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB.` },
        { status: 413 },
      )
    }

    const documentoId = nuevoId('DOC')
    const guardado = await guardarDocumento(id, documentoId, archivo.type, new Uint8Array(await archivo.arrayBuffer()))

    const tipoCrudo = form.get('tipo')
    await pg.query(
      `INSERT INTO documentos_poliza (id, poliza_id, tipo, titulo, archivo, mime, bytes, sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        documentoId,
        id,
        typeof tipoCrudo === 'string' ? tipoCrudo.slice(0, 40) : 'otro',
        typeof form.get('titulo') === 'string' ? String(form.get('titulo')).slice(0, 120) : null,
        guardado.archivo,
        guardado.mime,
        guardado.bytes,
        guardado.sha256,
      ],
    )
    return NextResponse.json({ ok: true, id: documentoId, sha256: guardado.sha256 }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorArchivo) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('documentos:POST', err, 'No se pudo adjuntar el documento.')
  }
}
