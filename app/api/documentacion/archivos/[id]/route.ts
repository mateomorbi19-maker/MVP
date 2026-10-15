import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { leerDocumento } from '@/lib/almacenamiento'
import { archivoDelUsuario, asignarArchivoDocumentacion, ErrorDocumentacion, quitarArchivoDocumentacion } from '@/lib/documentacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Sirve el archivo sólo a su dueño. Un archivo ajeno responde 404 y no 403: confirmar que
 * el id existe ya le diría a otro que esa persona tiene cargada su licencia.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const fila = await archivoDelUsuario(sesion.usuario_id, id)
    if (!fila) return NextResponse.json({ error: 'No tenés ningún archivo con ese id. Volvé a cargar Mi documentación.' }, { status: 404 })
    const bytes = await leerDocumento(fila.archivo)
    return new NextResponse(new Uint8Array(bytes), {
      headers: { 'Content-Type': fila.mime, 'Content-Length': String(bytes.length), 'Cache-Control': 'private, no-store' },
    })
  } catch (err) {
    return errorApi('documentacion-archivo:GET', err, 'No se pudo leer el archivo.')
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const borrado = await quitarArchivoDocumentacion(sesion.usuario_id, id)
    if (!borrado) return NextResponse.json({ error: 'No tenés ningún archivo con ese id. Volvé a cargar Mi documentación.' }, { status: 404 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorApi('documentacion-archivo:DELETE', err, 'No se pudo quitar el archivo.')
  }
}

export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const cuerpo = await req.json().catch(() => ({}))
    await asignarArchivoDocumentacion(sesion.usuario_id, id, cuerpo.poliza_id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ErrorDocumentacion) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('documentacion-archivo:PATCH', err, 'No se pudo asignar el archivo. Elegí la póliza y volvé a intentar.')
  }
}
