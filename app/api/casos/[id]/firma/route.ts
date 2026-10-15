import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { listarMedias, listarTestigos, obtenerCaso } from '@/lib/casos'
import { exigirAccesoCaso } from '@/lib/posesion'
import { guardarArchivo, ErrorArchivo, TAMANO_MAXIMO } from '@/lib/almacenamiento'
import { construirActa, DECLARACION } from '@/lib/acta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

/**
 * Recibe la firma del asegurado y la ata al contenido exacto que firmó.
 *
 * El servidor RECALCULA el acta y compara contra el hash que el cliente dice haber visto.
 * Si no coincide, 409: es imposible mostrarle una cosa a la persona y guardar otra.
 *
 * Un 409 no significa que alguien hizo algo mal: puede ser que un guardado automático haya
 * entrado entre que se pidió el acta y se firmó. Por eso el mensaje dice qué hacer.
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

    const form = await req.formData()
    const archivo = form.get('archivo')
    if (!(archivo instanceof File)) return NextResponse.json({ error: 'Falta la firma.' }, { status: 400 })
    if (archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json({ error: 'La firma es demasiado grande.' }, { status: 413 })
    }

    const hashVisto = form.get('hash')
    const mediaId = nuevoId('FIR')
    const contenido = new Uint8Array(await archivo.arrayBuffer())

    // La fila y su eslabón en la misma transacción: la firma entra al manifiesto como pieza.
    const pg = await db()
    const cliente = await pg.connect()
    let hashActa: string
    try {
      await cliente.query('BEGIN')
      await cliente.query("SET LOCAL lock_timeout = '8s'")
      const bloqueado = await cliente.query('SELECT estado FROM casos WHERE id = $1 FOR UPDATE', [id])
      if (!bloqueado.rows[0] || bloqueado.rows[0].estado === 'cerrado') {
        await cliente.query('ROLLBACK')
        return NextResponse.json({ error: 'La actuación ya fue cerrada y sellada o no está disponible.' }, { status: 409 })
      }
      const actual = await obtenerCaso(id, { cliente })
      if (!actual) throw new Error('No se pudo releer la actuación para firmar. Volvé a abrirla.')
      const medias = await listarMedias(id, { cliente })
      const testigos = await listarTestigos(id, { cliente })
      const acta = construirActa(actual, medias, testigos)
      if (typeof hashVisto !== 'string' || hashVisto !== acta.hash) {
        await cliente.query('ROLLBACK')
        return NextResponse.json({
          error: 'El expediente cambió desde que viste el acta. Volvé a la pantalla anterior y firmá de nuevo para confirmar el contenido actualizado.',
          hash_actual: acta.hash,
        }, { status: 409 })
      }
      hashActa = acta.hash
      const firmante = typeof form.get('firmante') === 'string'
        ? String(form.get('firmante')).trim().slice(0, 120) || actual.asegurado : actual.asegurado
      const guardado = await guardarArchivo(id, mediaId, archivo.type, contenido)
      await cliente.query(
        `INSERT INTO medias (id, caso_id, tipo, guia_id, archivo, mime, bytes, sha256, gps, firmante, hash_firmado)
         VALUES ($1,$2,'firma',NULL,$3,$4,$5,$6,NULL,$7,$8)`,
        [mediaId, id, guardado.archivo, guardado.mime, guardado.bytes, guardado.sha256, firmante, acta.hash],
      )
      await registrarEvento(
        id,
        'acta_firmada_asegurado',
        {
          media_id: mediaId,
          hash_acta: acta.hash,
          version_declaracion: DECLARACION.version,
          sha256: guardado.sha256,
        },
        { reservado: { firmante }, cliente },
      )
      await cliente.query('COMMIT')
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      cliente.release()
    }

    return NextResponse.json({ ok: true, id: mediaId, hash_acta: hashActa }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorArchivo) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('firma:POST', err, 'No se pudo registrar la firma.')
  }
}
