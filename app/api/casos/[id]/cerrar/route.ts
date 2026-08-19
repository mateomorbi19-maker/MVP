import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { registrarEvento, construirManifiesto } from '@/lib/hash'
import { obtenerCaso, calcularConsistencia } from '@/lib/casos'
import { sellar } from '@/lib/sello'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/**
 * Cierre y sellado de la actuación.
 *
 * Orden deliberado:
 *   1. Se calcula el informe de consistencia y se lo registra como un eslabón más
 *      (queda dentro de la cadena, no fuera).
 *   2. Se construye el manifiesto y se obtiene el hash maestro.
 *   3. Se sella ese hash (firma + sello de tiempo RFC 3161).
 *   4. Se marca la actuación como cerrada: desde acá deja de admitir modificaciones.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json(
        { ok: true, yaCerrada: true, hash_maestro: caso.hash_maestro, sello: caso.sello },
        { status: 200 },
      )
    }

    const consistencia = await calcularConsistencia(id)
    const pg = await db()
    await pg.query('UPDATE casos SET consistencia = $2 WHERE id = $1', [
      id,
      consistencia ? JSON.stringify(consistencia) : null,
    ])
    await registrarEvento(id, 'informe_consistencia_generado', {
      resumen: consistencia?.resumen ?? null,
      hallazgos: consistencia?.hallazgos.map((h) => ({ nivel: h.nivel, titulo: h.titulo })) ?? [],
    })

    // El eslabón de cierre se registra ANTES del manifiesto para que quede incluido en él.
    await registrarEvento(id, 'cierre_actuacion', { cerrado_en: new Date().toISOString() })

    const manifiesto = await construirManifiesto(id)
    const sello = await sellar(manifiesto.hash_maestro)

    await pg.query(
      `UPDATE casos SET estado = 'cerrado', cerrado_en = now(), hash_maestro = $2, sello = $3 WHERE id = $1`,
      [id, manifiesto.hash_maestro, JSON.stringify(sello)],
    )

    return NextResponse.json({
      ok: true,
      hash_maestro: manifiesto.hash_maestro,
      eslabones: manifiesto.cadena.length,
      piezas: manifiesto.piezas.length,
      sello,
      consistencia: consistencia?.resumen ?? null,
    })
  } catch (err) {
    console.error('[cerrar:POST]', err)
    return NextResponse.json({ error: 'No se pudo cerrar la actuación.' }, { status: 500 })
  }
}
