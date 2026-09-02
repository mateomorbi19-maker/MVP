import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirAccesoCaso } from '@/lib/posesion'
import { db } from '@/lib/db'
import { registrarEvento, construirManifiesto } from '@/lib/hash'
import { obtenerCaso, calcularConsistencia } from '@/lib/casos'
import { sellar } from '@/lib/sello'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/**
 * Guarda el sello contra el hash maestro ya asentado.
 *
 * Va SEPARADO de la transacción de cierre porque pide un sello de tiempo RFC 3161 por
 * red, con hasta 12 segundos de espera. Mientras esa llamada estaba dentro de la
 * sección crítica, cualquier eslabón que entrara en esos 12 segundos quedaba fuera del
 * manifiesto recién sellado y el verificador público denunciaba como alterado un
 * expediente intacto, de forma permanente.
 *
 * Sacarla afuera no cambia nada probatorio: el sello se calcula SOBRE el hash maestro y
 * no forma parte de él.
 *
 * Si falla —el volumen de la clave sin montar, la TSA caída— la actuación queda cerrada
 * igual, con el sello en null, y el próximo POST lo vuelve a intentar. Es preferible a
 * perder el cierre: el hash maestro ya está asentado y es lo que prueba la integridad.
 */
async function sellarYGuardar(casoId: string, hashMaestro: string) {
  try {
    const sello = await sellar(hashMaestro)
    const pg = await db()
    await pg.query('UPDATE casos SET sello = $2 WHERE id = $1', [casoId, JSON.stringify(sello)])
    return sello
  } catch (err) {
    console.error('[cerrar:sellar] no se pudo sellar', casoId, err)
    return null
  }
}

/**
 * Cierre y sellado de la actuación.
 *
 * Todo lo que toca la cadena de custodia ocurre dentro de UNA transacción con el caso
 * bloqueado, en este orden:
 *   1. Se toma el lock sobre la actuación y se relee su estado.
 *   2. Se calcula el informe de consistencia y se lo registra como un eslabón más
 *      (queda dentro de la cadena, no fuera).
 *   3. Se registra el eslabón de cierre ANTES de construir el manifiesto, para que
 *      quede incluido en él.
 *   4. Se construye el manifiesto con el mismo cliente y se guarda el hash maestro.
 *   5. Se marca la actuación como cerrada: desde acá deja de admitir modificaciones.
 * Recién después, y fuera de la transacción, se pide el sello de tiempo.
 */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })

    // Reintento de un cierre que quedó a medias: el hash ya está, faltaba el sello.
    if (caso.estado === 'cerrado') {
      const sello = caso.sello ?? (caso.hash_maestro ? await sellarYGuardar(id, caso.hash_maestro) : null)
      return NextResponse.json(
        { ok: true, yaCerrada: true, hash_maestro: caso.hash_maestro, sello },
        { status: 200 },
      )
    }

    /*
     * El informe se calcula ANTES de abrir la transacción: son varias lecturas y no
     * necesitan el lock. Nada puede cambiar entremedio de forma que importe, porque
     * dentro de la transacción se vuelve a leer el estado con el caso bloqueado.
     */
    const consistencia = await calcularConsistencia(id)

    const pg = await db()
    const cliente = await pg.connect()
    let hashMaestro: string
    let eslabones: number
    let piezas: number
    try {
      await cliente.query('BEGIN')

      const bloqueado = await cliente.query<{ estado: string }>(
        'SELECT estado FROM casos WHERE id = $1 FOR UPDATE',
        [id],
      )
      if (bloqueado.rowCount === 0) {
        await cliente.query('ROLLBACK')
        return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
      }
      // Otra request pudo cerrarla mientras esperábamos el lock.
      if (bloqueado.rows[0].estado === 'cerrado') {
        await cliente.query('ROLLBACK')
        const actual = await obtenerCaso(id)
        return NextResponse.json(
          { ok: true, yaCerrada: true, hash_maestro: actual?.hash_maestro ?? null, sello: actual?.sello ?? null },
          { status: 200 },
        )
      }

      await cliente.query('UPDATE casos SET consistencia = $2 WHERE id = $1', [
        id,
        consistencia ? JSON.stringify(consistencia) : null,
      ])
      await registrarEvento(
        id,
        'informe_consistencia_generado',
        {
          resumen: consistencia?.resumen ?? null,
          hallazgos: consistencia?.hallazgos.map((h) => ({ nivel: h.nivel, titulo: h.titulo })) ?? [],
        },
        { cliente },
      )

      await registrarEvento(id, 'cierre_actuacion', { cerrado_en: new Date().toISOString() }, { cliente })

      const manifiesto = await construirManifiesto(id, { cliente })
      hashMaestro = manifiesto.hash_maestro
      eslabones = manifiesto.cadena.length
      piezas = manifiesto.piezas.length

      await cliente.query(
        `UPDATE casos SET estado = 'cerrado', cerrado_en = now(), hash_maestro = $2 WHERE id = $1`,
        [id, hashMaestro],
      )

      await cliente.query('COMMIT')
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      cliente.release()
    }

    const sello = await sellarYGuardar(id, hashMaestro)

    return NextResponse.json({
      ok: true,
      hash_maestro: hashMaestro,
      eslabones,
      piezas,
      sello,
      consistencia: consistencia?.resumen ?? null,
    })
  } catch (err) {
    return errorApi('cerrar:POST', err, 'No se pudo cerrar la actuación.')
  }
}
