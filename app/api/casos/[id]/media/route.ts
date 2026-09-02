import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirAccesoCaso } from '@/lib/posesion'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'
import { guardarArchivo, ErrorArchivo, TAMANO_MAXIMO } from '@/lib/almacenamiento'
import { GUIA_FOTOS } from '@/lib/cuestionario'
import { GUIA_A_DOCUMENTO, extraccionActiva, proveedorActivo } from '@/lib/extraccion'
import { encolarLectura } from '@/lib/cola-extraccion'

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

    const pg = await db()

    /*
     * Idempotencia.
     *
     * Con subida diferida, un reintento puede llegar después de que el primero haya
     * entrado: sin esto, la misma toma quedaría dos veces en el expediente. El
     * identificador lo genera el teléfono por CAPTURA, nunca por guía.
     */
    const idem = typeof form.get('idempotencia') === 'string' ? String(form.get('idempotencia')).slice(0, 64) : null
    if (idem) {
      const yaEsta = await pg.query('SELECT id, sha256 FROM medias WHERE idempotencia = $1', [idem])
      if ((yaEsta.rowCount ?? 0) > 0) {
        return NextResponse.json({ id: yaEsta.rows[0].id, sha256: yaEsta.rows[0].sha256, repetido: true }, { status: 200 })
      }
    }

    const mediaId = nuevoId(tipo === 'audio' ? 'AUD' : 'IMG')
    const datos = new Uint8Array(await archivo.arrayBuffer())
    const guardado = await guardarArchivo(id, mediaId, archivo.type, datos)

    /*
     * El hash que declaró el teléfono se REVALIDA acá. Si no coincide, el archivo cambió
     * entre la captura y la subida: se guarda igual —la evidencia manda— pero se marca.
     */
    const shaCliente = typeof form.get('sha256_cliente') === 'string' ? String(form.get('sha256_cliente')) : null
    const coincideHash = !shaCliente || shaCliente === guardado.sha256

    /*
     * Cuándo se sacó, contra cuándo llegó.
     *
     * `tomada_en` viene del reloj del teléfono y por eso es declarativo; `capturado_en` es
     * la hora del servidor al recibirla. La diferencia entre las dos es lo que hay que
     * imprimir: con subida diferida pueden separarse por horas, y decir que la hora la puso
     * el sistema en el momento de la captura pasaría a ser falso.
     *
     * El origen se clasifica con lo que se puede saber de verdad. `capture` es una
     * SUGERENCIA que el navegador puede ignorar y no hay forma cierta de distinguir una
     * toma en vivo de una foto de la galería, así que el valor normal es
     * «no_verificable» y NO genera ningún hallazgo: las fotos de iPhone llegan sin
     * metadatos útiles y serían la mayoría. Sólo se marca «incoherente» ante una señal
     * positiva: una hora anterior a la apertura de la actuación.
     */
    const tomadaCruda = typeof form.get('tomada_en') === 'string' ? String(form.get('tomada_en')) : null
    const tomadaEn = tomadaCruda && !Number.isNaN(Date.parse(tomadaCruda)) ? new Date(tomadaCruda) : null
    const ahora = new Date()
    const desfase = tomadaEn ? ahora.getTime() - tomadaEn.getTime() : null
    const anteriorALaApertura = tomadaEn ? tomadaEn < new Date(caso.creado_en) : false
    const origen = !coincideHash ? 'incoherente' : anteriorALaApertura ? 'incoherente' : 'no_verificable'

    /*
    * La fila y su eslabón van en LA MISMA transacción. La fila entra al manifiesto como
    * pieza: insertándola aparte, una subida que llega mientras se cierra la actuación deja
    * la fila escrita y el eslabón rechazado, y el verificador público informa como alterado
    * un expediente que nadie tocó.
    */
    const cliente = await pg.connect()
    try {
      await cliente.query('BEGIN')
      await cliente.query(
        `INSERT INTO medias (id, caso_id, tipo, guia_id, archivo, mime, bytes, sha256, gps,
                             idempotencia, tomada_en, desfase_reloj_ms, origen)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
        [
          mediaId, id, tipo, guia, guardado.archivo, guardado.mime, guardado.bytes, guardado.sha256,
          gps ? JSON.stringify(gps) : null,
          idem, tomadaEn ? tomadaEn.toISOString() : null, desfase, origen,
        ],
      )

      await registrarEvento(id, tipo === 'audio' ? 'audio_incorporado' : 'fotografia_incorporada', {
        media_id: mediaId,
        guia_id: guia,
        mime: guardado.mime,
        bytes: guardado.bytes,
        sha256: guardado.sha256,
        origen,
        desfase_reloj_ms: desfase,
        coincide_hash_del_telefono: coincideHash,
      }, { reservado: { gps }, cliente })
      await cliente.query('COMMIT')
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      cliente.release()
    }

    /*
     * Lectura automática del documento del tercero.
     *
     * Se dispara SÓLO si el tercero ya prestó su consentimiento: el titular del dato es él,
     * y el asegurado no puede consentir por él (arts. 5 y 11, Ley 25.326). Sin
     * consentimiento la foto se guarda igual —la evidencia manda— pero no se lee.
     *
     * Va en su propio try/catch: si esto falla, la fotografía queda incorporada lo mismo.
     * Es el endpoint que se usa parado al lado del auto.
     */
    const tipoDocumento = guia ? GUIA_A_DOCUMENTO[guia] : undefined
    if (tipoDocumento && extraccionActiva()) {
      try {
        const consintio = await pg.query(
          'SELECT 1 FROM terceros WHERE caso_id = $1 AND consentimiento = true LIMIT 1',
          [id],
        )
        if ((consintio.rowCount ?? 0) > 0) {
          const proveedor = proveedorActivo()
          const extraccionId = nuevoId('EXT')
          await pg.query(
            `INSERT INTO extracciones (id, caso_id, media_id, guia_id, tipo_documento, proveedor)
             VALUES ($1,$2,$3,$4,$5,$6)`,
            [extraccionId, id, mediaId, guia, tipoDocumento, proveedor?.nombre ?? 'desconocido'],
          )
          await registrarEvento(id, 'extraccion_solicitada', {
            extraccion_id: extraccionId,
            media_id: mediaId,
            guia_id: guia,
            proveedor: proveedor?.nombre ?? null,
          })
          // Sin await: la respuesta sale sin haber contactado a ningún proveedor.
          encolarLectura(extraccionId)
        }
      } catch (err) {
        console.error('[media] no se pudo encolar la lectura automática', err)
      }
    }

    return NextResponse.json({ id: mediaId, sha256: guardado.sha256, bytes: guardado.bytes }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorArchivo) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }
    return errorApi('media:POST', err, 'No se pudo incorporar el archivo.')
  }
}
