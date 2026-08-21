import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { listarCasos, limpiarDatosAsegurado } from '@/lib/casos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Alta de una actuación. Es el primer eslabón de la cadena de custodia.
 *
 * El cuerpo puede venir vacío, y es el caso normal: desde el teléfono la actuación se
 * abre con un solo toque, sin pedir nada. Los datos del asegurado se cargan después,
 * por PATCH. Se siguen aceptando acá para las altas hechas desde otro sistema.
 */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const datos = limpiarDatosAsegurado(cuerpo)
    const id = nuevoId()
    const pg = await db()

    await pg.query(
      `INSERT INTO casos (id, poliza, patente, asegurado, telefono)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, datos.poliza, datos.patente, datos.asegurado, datos.telefono],
    )

    await registrarEvento(id, 'apertura_actuacion', {
      poliza: datos.poliza,
      patente: datos.patente,
      user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    return errorApi('casos:POST', err, 'No se pudo crear la actuación.')
  }
}

/** Listado para el panel de la aseguradora. */
export async function GET() {
  try {
    const casos = await listarCasos()
    return NextResponse.json(
      casos.map((c) => ({
        id: c.id,
        creado_en: c.creado_en,
        cerrado_en: c.cerrado_en,
        estado: c.estado,
        poliza: c.poliza,
        patente: c.patente,
        asegurado: c.asegurado,
        direccion: c.direccion,
        resumen: c.consistencia?.resumen ?? null,
      })),
    )
  } catch (err) {
    return errorApi('casos:GET', err, 'No se pudo leer el listado.')
  }
}
