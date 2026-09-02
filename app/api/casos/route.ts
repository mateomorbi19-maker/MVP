import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento, VERSION_MANIFIESTO } from '@/lib/hash'
import { listarCasos, limpiarDatosAsegurado } from '@/lib/casos'
import { hashToken, nuevoToken } from '@/lib/claves'
import { anotarPosesion } from '@/lib/posesion'
import { alcanceDe, exigirRol } from '@/lib/sesion'
import { leerSesion } from '@/lib/sesion'

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
    /*
     * El secreto de apertura se devuelve UNA sola vez, acá, y de la base sólo se guarda su
     * hash. Es la única prueba que después se acepta para reclamar esta actuación desde
     * una cuenta: el id no alcanza, porque se dicta por teléfono, se imprime en el
     * expediente y viaja dentro del QR que escanea cualquier testigo.
     */
    const secreto = nuevoToken()
    const sesion = await leerSesion()

    let id = ''
    for (let intento = 0; intento < 5; intento++) {
      const candidato = nuevoId()
      try {
        await pg.query(
          `INSERT INTO casos (id, poliza, patente, asegurado, telefono, manifiesto_version, secreto_sha256, usuario_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [candidato, datos.poliza, datos.patente, datos.asegurado, datos.telefono, VERSION_MANIFIESTO, hashToken(secreto), sesion?.usuario_id ?? null],
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

    // Anota qué navegador tiene este id: es lo que le habilita las fotos y el expediente.
    await anotarPosesion(id)

    return NextResponse.json({ id, secreto }, { status: 201 })
  } catch (err) {
    return errorApi('casos:POST', err, 'No se pudo crear la actuación.')
  }
}

/**
 * Listado, acotado a quién pregunta.
 *
 * Dejó de ser público. La aseguradora ve todo, el productor ve los suyos, el asegurado
 * los propios. Antes devolvía las doscientas actuaciones más recientes del sistema —con
 * la patente, el nombre y el lugar del hecho— a cualquiera que supiera la ruta.
 */
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
