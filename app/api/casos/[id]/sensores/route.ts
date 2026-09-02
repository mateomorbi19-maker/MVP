import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { canonico, registrarEvento } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'
import { exigirAccesoCaso } from '@/lib/posesion'
import { ErrorArchivo, guardarSerie } from '@/lib/almacenamiento'
import { analizarImpacto, type Lectura } from '@/lib/impacto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/**
 * Incorpora al expediente el buffer de sensores del impacto.
 *
 * Entra como una pieza más de `medias`, con tipo 'sensores', así que construirManifiesto la
 * toma sin código nuevo: el SELECT de medias no filtra por tipo. El eslabón lleva sólo el
 * hash y tres números —no la serie entera—, para no inflar la tabla de eventos con mil
 * quinientas lecturas.
 *
 * Sólo se guarda si la persona decide incorporarla. La telemetría de un impacto que nadie
 * confirmó queda en su propia tabla y no toca el expediente de nadie.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json({ error: 'La actuación ya fue cerrada y sellada.' }, { status: 409 })
    }

    const cuerpo = await req.json().catch(() => ({}))
    const serie = Array.isArray(cuerpo?.serie) ? (cuerpo.serie as Lectura[]) : []
    if (serie.length === 0) return NextResponse.json({ error: 'La serie llegó vacía.' }, { status: 400 })

    const veredicto = analizarImpacto(serie)
    const mediaId = nuevoId('SEN')
    const guardado = await guardarSerie(id, mediaId, canonico({ serie, veredicto }))

    // La fila y su eslabón en la misma transacción: la serie entra al manifiesto como pieza.
    const pg = await db()
    const cliente = await pg.connect()
    try {
      await cliente.query('BEGIN')
      await cliente.query(
        `INSERT INTO medias (id, caso_id, tipo, guia_id, archivo, mime, bytes, sha256)
         VALUES ($1,$2,'sensores',NULL,$3,$4,$5,$6)`,
        [mediaId, id, guardado.archivo, guardado.mime, guardado.bytes, guardado.sha256],
      )
      await registrarEvento(
        id,
        'sensores_incorporados',
        {
          media_id: mediaId,
          sha256: guardado.sha256,
          muestras: serie.length,
          pico_g: veredicto.picoG,
          nivel: veredicto.nivel,
        },
        { cliente },
      )
      await cliente.query('COMMIT')
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      cliente.release()
    }

    return NextResponse.json({ ok: true, id: mediaId, veredicto }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorArchivo) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('sensores:POST', err, 'No se pudieron incorporar las lecturas.')
  }
}
