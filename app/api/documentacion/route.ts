import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { ErrorDocumentacion, guardarDatosDocumentacion, leerDocumentacion } from '@/lib/documentacion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** La licencia y la cédula cargadas a mano, y los archivos de los tres bloques. */
export async function GET() {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    return NextResponse.json(await leerDocumentacion(sesion.usuario_id))
  } catch (err) {
    return errorApi('documentacion:GET', err, 'No se pudo leer tu documentación.')
  }
}

/** Guarda los datos a mano de un bloque: { tipo: 'licencia' | 'cedula', datos: {...} }. */
export async function PUT(req: Request) {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const cuerpo = await req.json().catch(() => ({}))
    await guardarDatosDocumentacion(sesion.usuario_id, cuerpo?.tipo, cuerpo?.datos)
    return NextResponse.json({ ok: true })
  } catch (err) {
    if (err instanceof ErrorDocumentacion) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('documentacion:PUT', err, 'No se pudieron guardar los datos.')
  }
}
