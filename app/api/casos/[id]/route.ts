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
import { limpiarProgreso } from '@/lib/recorrido'

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
      medias: medias.map((m) => ({ id: m.id, idempotencia: m.idempotencia, tipo: m.tipo, guia_id: m.guia_id, mime: m.mime, capturado_en: m.capturado_en })),
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
    const cuerpo = await req.json().catch(() => ({}))
    const entrantes = cuerpo?.respuestas && typeof cuerpo.respuestas === 'object' && !Array.isArray(cuerpo.respuestas)
      ? cuerpo.respuestas as Record<string, unknown> : {}
    const validas: Record<string, unknown> = {}
    for (const [clave, valor] of Object.entries(entrantes)) {
      if (IDS_VALIDOS.has(clave)) validas[clave] = valor
    }
    for (const clave of ['relato_texto', 'transcripcion_original']) {
      if (clave in validas && (typeof validas[clave] !== 'string' || validas[clave].length > 30000)) {
        return NextResponse.json({ error: 'El relato y la transcripción deben ser textos de hasta 30.000 caracteres.' }, { status: 400 })
      }
    }
    if ('contactos_testigos' in validas) {
      const contactos = validas.contactos_testigos
      if (!Array.isArray(contactos) || contactos.length > 20 || contactos.some((contacto) =>
        !contacto || typeof contacto !== 'object' || typeof contacto.telefono !== 'string' ||
        contacto.telefono.trim().length < 3 || contacto.telefono.length > 40 ||
        (contacto.nombre !== undefined && (typeof contacto.nombre !== 'string' || contacto.nombre.length > 120)),
      )) {
        return NextResponse.json({ error: 'Cargá hasta 20 testigos con un teléfono de 3 a 40 caracteres y un nombre de hasta 120.' }, { status: 400 })
      }
      validas.contactos_testigos = contactos.map((contacto) => ({
        ...(contacto.nombre?.trim() ? { nombre: contacto.nombre.trim() } : {}),
        telefono: contacto.telefono.trim(), origen: 'asegurado',
      }))
    }
    const datos = limpiarDatosAsegurado(cuerpo?.datos)
    const cambios = Object.entries(datos).filter(([, valor]) => valor !== null) as Array<[string, string]>
    const pg = await db()
    const cliente = await pg.connect()
    try {
      await cliente.query('BEGIN')
      await cliente.query("SET LOCAL lock_timeout = '8s'")
      const bloqueado = await cliente.query('SELECT estado, respuestas FROM casos WHERE id = $1 FOR UPDATE', [id])
      if (!bloqueado.rows[0]) {
        await cliente.query('ROLLBACK')
        return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
      }
      if (bloqueado.rows[0].estado === 'cerrado') {
        await cliente.query('ROLLBACK')
        return NextResponse.json({ error: 'La actuación ya fue cerrada y sellada: no admite cambios.' }, { status: 409 })
      }
      // El merge se lee bajo el mismo lock que el cierre y el resto de los guardados.
      const respuestas = { ...bloqueado.rows[0].respuestas, ...validas }
      const progreso = cuerpo?.progreso && typeof cuerpo.progreso === 'object'
        ? limpiarProgreso(cuerpo.progreso, respuestas) : null
      if (Object.keys(validas).length > 0) {
        await cliente.query('UPDATE casos SET respuestas = $2 WHERE id = $1', [id, JSON.stringify(respuestas)])
        await registrarEvento(id, 'respuestas_registradas', { preguntas: Object.keys(validas).sort() },
          { reservado: { valores: validas }, cliente })
      }
      if (cambios.length > 0) {
        const asignaciones = cambios.map(([clave], i) => `${clave} = $${i + 2}`).join(', ')
        await cliente.query(`UPDATE casos SET ${asignaciones} WHERE id = $1`, [id, ...cambios.map(([, valor]) => valor)])
        await registrarEvento(id, 'datos_asegurado_registrados', { campos: cambios.map(([clave]) => clave).sort() },
          { reservado: Object.fromEntries(cambios), cliente })
      }
      if (progreso) {
        await cliente.query('UPDATE casos SET progreso = $2 WHERE id = $1', [id, JSON.stringify(progreso)])
        await registrarEvento(id, 'progreso_guardado', { paso: progreso.paso, omitidos: progreso.omitidos }, { cliente })
      }
      await cliente.query('COMMIT')
      return NextResponse.json({ ok: true, respuestas, ...(progreso ? { progreso } : {}) })
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      cliente.release()
    }
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
