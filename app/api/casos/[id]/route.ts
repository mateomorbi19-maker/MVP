import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { obtenerCaso, listarMedias, listarTestigos } from '@/lib/casos'
import { SECCIONES } from '@/lib/cuestionario'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

const IDS_VALIDOS = new Set(SECCIONES.flatMap((s) => s.preguntas.map((p) => p.id)))

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  const caso = await obtenerCaso(id)
  if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })

  const [medias, testigos] = await Promise.all([listarMedias(id), listarTestigos(id)])
  return NextResponse.json({
    ...caso,
    medias: medias.map((m) => ({ id: m.id, tipo: m.tipo, guia_id: m.guia_id, mime: m.mime, capturado_en: m.capturado_en })),
    testigos: testigos.map((t) => ({ id: t.id, nombre: t.nombre, creado_en: t.creado_en })),
  })
}

/**
 * Guarda respuestas. Se llama a medida que la persona contesta, no al final:
 * si se cierra el navegador en el medio, no se pierde nada de lo ya declarado.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
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
    if (Object.keys(validas).length === 0) {
      return NextResponse.json({ ok: true, sinCambios: true })
    }

    const combinadas = { ...caso.respuestas, ...validas }
    const pg = await db()
    await pg.query('UPDATE casos SET respuestas = $2 WHERE id = $1', [id, JSON.stringify(combinadas)])

    await registrarEvento(id, 'respuestas_registradas', {
      preguntas: Object.keys(validas).sort(),
      valores: validas,
    })

    return NextResponse.json({ ok: true, respuestas: combinadas })
  } catch (err) {
    return errorApi('caso:PATCH', err, 'No se pudieron guardar las respuestas.')
  }
}
