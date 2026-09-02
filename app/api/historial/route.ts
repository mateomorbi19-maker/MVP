import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { alcanceDe, exigirRol } from '@/lib/sesion'
import { listarCasos } from '@/lib/casos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Las actuaciones de quien está en sesión, para /historial. */
export async function GET() {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const casos = await listarCasos(alcanceDe(sesion))
    return NextResponse.json(
      casos.map((c) => ({
        id: c.id,
        creado_en: c.creado_en,
        cerrado_en: c.cerrado_en,
        estado: c.estado,
        patente: c.patente,
        direccion: c.direccion,
        hash_maestro: c.hash_maestro,
        resumen: c.consistencia?.resumen ?? null,
      })),
    )
  } catch (err) {
    return errorApi('historial:GET', err, 'No se pudo leer el historial.')
  }
}
