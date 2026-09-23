import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirAccesoCaso, tienePosesion } from '@/lib/posesion'
import { leerSesion } from '@/lib/sesion'
import { anotarEnBitacora } from '@/lib/bitacora'
import { ErrorRetencion, bajaPorAsegurado, expurgar } from '@/lib/retencion'
import { db } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { obtenerCaso, listarMedias, listarTestigos, limpiarDatosAsegurado } from '@/lib/casos'
import { SECCIONES } from '@/lib/cuestionario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const IDS_VALIDOS = new Set(SECCIONES.flatMap((s) => s.preguntas.map((p) => p.id)))

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })

    const [medias, testigos] = await Promise.all([listarMedias(id), listarTestigos(id)])
    return NextResponse.json({
      ...caso,
      medias: medias.map((m) => ({ id: m.id, tipo: m.tipo, guia_id: m.guia_id, mime: m.mime, capturado_en: m.capturado_en })),
      testigos: testigos.map((t) => ({ id: t.id, nombre: t.nombre, creado_en: t.creado_en })),
    })
  } catch (err) {
    return errorApi('caso:GET', err, 'No se pudo leer la actuación.')
  }
}

/**
 * Guarda respuestas y datos del asegurado.
 *
 * Se llama a medida que la persona contesta, no al final: si se cierra el navegador en
 * el medio, no se pierde nada de lo ya declarado. Todo lo que entra queda además
 * asentado como evento en la cadena de custodia, con su hora.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json({ error: 'La actuación ya fue cerrada y sellada: no admite cambios.' }, { status: 409 })
    }

    const cuerpo = await req.json().catch(() => ({}))
    const entrantes = (cuerpo?.respuestas ?? {}) as Record<string, unknown>

    // Sólo se aceptan ids de preguntas definidos en el cuestionario.
    const validas: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(entrantes)) {
      if (IDS_VALIDOS.has(k)) validas[k] = v
    }

    /*
     * Los cuatro campos de la carátula llegan por separado porque son columnas, no
     * respuestas: los usan el panel, el PDF y el listado. Sólo se pisa lo que viene
     * con contenido, para que un envío parcial no borre lo ya cargado.
     */
    const datos = limpiarDatosAsegurado(cuerpo?.datos)
    const cambios = Object.entries(datos).filter(([, v]) => v !== null) as Array<[string, string]>

    if (Object.keys(validas).length === 0 && cambios.length === 0) {
      return NextResponse.json({ ok: true, sinCambios: true })
    }

    const pg = await db()

    if (Object.keys(validas).length > 0) {
      const combinadas = { ...caso.respuestas, ...validas }
      await pg.query('UPDATE casos SET respuestas = $2 WHERE id = $1', [id, JSON.stringify(combinadas)])
      /*
       * Los nombres de las preguntas quedan en claro; sus valores, reservados. El detalle
       * de un eslabón entra al preimagen del hash, y el contenido de una respuesta puede
       * ser el nombre del otro conductor, su DNI o su patente.
       */
      await registrarEvento(
        id,
        'respuestas_registradas',
        { preguntas: Object.keys(validas).sort() },
        { reservado: { valores: validas } },
      )
    }

    if (cambios.length > 0) {
      // Las claves vienen de DatosAsegurado, no del cuerpo: son siempre esas cuatro.
      const asignaciones = cambios.map(([clave], i) => `${clave} = $${i + 2}`).join(', ')
      await pg.query(
        `UPDATE casos SET ${asignaciones} WHERE id = $1`,
        [id, ...cambios.map(([, valor]) => valor)],
      )
      await registrarEvento(
        id,
        'datos_asegurado_registrados',
        { campos: cambios.map(([clave]) => clave).sort() },
        { reservado: Object.fromEntries(cambios) },
      )
    }

    const actualizado = await obtenerCaso(id)
    return NextResponse.json({ ok: true, respuestas: actualizado?.respuestas ?? caso.respuestas })
  } catch (err) {
    return errorApi('caso:PATCH', err, 'No se pudieron guardar las respuestas.')
  }
}

const NO_ES_TUYA = 'No encontramos esa actuación en tu cuenta ni en este teléfono.'

/**
 * La persona elimina una actuación suya.
 *
 * Abierta, se borra entera por el mismo camino que el expurgo de retención, que es el
 * único que sabe pasar el disparador append-only y deja constancia de la baja. Sellada,
 * sólo se quita de su lista: el expediente ya puede estar presentado, y la aseguradora y
 * el verificador público lo siguen necesitando. Ocultar no toca la cadena.
 *
 * No alcanza con exigirAccesoCaso: ese acceso lo tienen también el productor y la
 * aseguradora, y ellos no pueden borrar una actuación del asegurado. Inexistente y ajena
 * contestan lo mismo, para no confirmar que un id existe.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: NO_ES_TUYA }, { status: 404 })

    const sesion = await leerSesion()
    const titular = Boolean(sesion && caso.usuario_id && caso.usuario_id === sesion.usuario_id)
    const gestor = sesion?.rol === 'productor' || sesion?.rol === 'aseguradora'
    const poseedor = !gestor && (await tienePosesion(id))
    if (!titular && !poseedor) return NextResponse.json({ error: NO_ES_TUYA }, { status: 404 })

    const accion = bajaPorAsegurado(caso.estado)
    if (accion === 'oculta') {
      const pg = await db()
      await pg.query('UPDATE casos SET oculta_por_asegurado = true WHERE id = $1', [id])
      await anotarEnBitacora('oculta_por_asegurado', {}, { casoId: id, usuarioId: sesion?.usuario_id ?? null })
    } else {
      try {
        await expurgar(id, 'Eliminada por el asegurado antes de cerrarla', { soloAbierta: true })
      } catch (err) {
        // Bloqueo legal o una baja simultánea: no es una falla, y el mensaje dice qué pasa.
        if (err instanceof ErrorRetencion) return NextResponse.json({ error: err.message }, { status: 409 })
        throw err
      }
    }
    return NextResponse.json({ ok: true, accion })
  } catch (err) {
    return errorApi('caso:DELETE', err, 'No se pudo eliminar la actuación. Probá de nuevo en un minuto.')
  }
}
