import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { ErrorArchivo, TAMANO_MAXIMO } from '@/lib/almacenamiento'
import { agregarArchivoDocumentacion, ErrorDocumentacion } from '@/lib/documentacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Suma una foto o un PDF a un bloque. Multipart con tipo y archivo. */
export async function POST(req: Request) {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const form = await req.formData().catch(() => null)
    if (!form) return NextResponse.json({ error: 'Mandá el archivo como formulario (multipart), con los campos tipo y archivo.' }, { status: 400 })
    const archivo = form.get('archivo')
    if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta el archivo: elegí una foto o un PDF.' }, { status: 400 })
    // Se corta antes de leerlo entero en memoria: el límite de guardarDocumento llega tarde.
    if (archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json(
        { error: `El archivo supera el máximo de ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB. Probá con una foto más liviana o un PDF más chico.` },
        { status: 413 },
      )
    }
    const creado = await agregarArchivoDocumentacion(
      sesion.usuario_id,
      form.get('tipo'),
      archivo.name || null,
      archivo.type,
      new Uint8Array(await archivo.arrayBuffer()),
    )
    return NextResponse.json(creado, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorDocumentacion || err instanceof ErrorArchivo) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return errorApi('documentacion-archivos:POST', err, 'No se pudo guardar el archivo.')
  }
}
