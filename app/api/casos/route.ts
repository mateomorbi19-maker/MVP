import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento, VERSION_MANIFIESTO } from '@/lib/hash'
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
    const pg = await db()

    /*
     * Reintento por colisión de número.
     *
     * nuevoId() son 6 caracteres sobre un alfabeto de 32: unas 1.07e9 combinaciones, que
     * por la paradoja del cumpleaños dan alrededor de 50% de probabilidad de al menos una
     * colisión a las ~33.000 actuaciones. Sin reintento, esa colisión es un 500 genérico
     * justo cuando la persona toca "Tuve un accidente" parada al lado del auto.
     *
     * La versión del manifiesto se escribe acá y no se deja en el DEFAULT de la columna:
     * el DEFAULT es '1.0' para las filas que ya existían, y toda actuación nueva tiene
     * que nacer en la versión vigente. Ver VERSION_MANIFIESTO en lib/hash.ts.
     */
    let id = ''
    for (let intento = 0; intento < 5; intento++) {
      const candidato = nuevoId()
      try {
        await pg.query(
          `INSERT INTO casos (id, poliza, patente, asegurado, telefono, manifiesto_version)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [candidato, datos.poliza, datos.patente, datos.asegurado, datos.telefono, VERSION_MANIFIESTO],
        )
        id = candidato
        break
      } catch (err) {
        // 23505 = unique_violation. Cualquier otra cosa no se resuelve reintentando.
        if ((err as { code?: string })?.code !== '23505') throw err
      }
    }
    if (!id) {
      throw new Error('No se pudo generar un número de actuación libre después de cinco intentos.')
    }

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
