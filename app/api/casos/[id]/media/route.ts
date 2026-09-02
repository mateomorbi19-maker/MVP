import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirAccesoCaso } from '@/lib/posesion'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'
import { guardarArchivo, ErrorArchivo, TAMANO_MAXIMO } from '@/lib/almacenamiento'
import { GUIA_FOTOS } from '@/lib/cuestionario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

const GUIAS = new Set(GUIA_FOTOS.map((g) => g.id))

/**
 * Incorpora una foto o un audio.
 *
 * La hora y la posición se toman de acá, del servidor y de la geolocalización en vivo,
 * y NO de los metadatos EXIF del archivo, que cualquiera puede editar antes de subirlo.
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
    if (!(archivo instanceof File)) {
      return NextResponse.json({ error: 'Falta el archivo.' }, { status: 400 })
    }
    if (archivo.size > TAMANO_MAXIMO) {
      return NextResponse.json(
        { error: `El archivo supera el máximo de ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB.` },
        { status: 413 },
      )
    }

    const tipo = form.get('tipo') === 'audio' ? 'audio' : 'foto'
    const guiaCruda = form.get('guia_id')
    const guia = typeof guiaCruda === 'string' && GUIAS.has(guiaCruda) ? guiaCruda : null

    const lat = Number(form.get('lat'))
    const lon = Number(form.get('lon'))
    const gps = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null

    const mediaId = nuevoId(tipo === 'audio' ? 'AUD' : 'IMG')
    const datos = new Uint8Array(await archivo.arrayBuffer())
    const guardado = await guardarArchivo(id, mediaId, archivo.type, datos)

    const pg = await db()
    await pg.query(
      `INSERT INTO medias (id, caso_id, tipo, guia_id, archivo, mime, bytes, sha256, gps)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [mediaId, id, tipo, guia, guardado.archivo, guardado.mime, guardado.bytes, guardado.sha256, gps ? JSON.stringify(gps) : null],
    )

    await registrarEvento(id, tipo === 'audio' ? 'audio_incorporado' : 'fotografia_incorporada', {
      media_id: mediaId,
      guia_id: guia,
      mime: guardado.mime,
      bytes: guardado.bytes,
      sha256: guardado.sha256,
      gps,
    })

    return NextResponse.json({ id: mediaId, sha256: guardado.sha256, bytes: guardado.bytes }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorArchivo) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return errorApi('media:POST', err, 'No se pudo incorporar el archivo.')
  }
}
