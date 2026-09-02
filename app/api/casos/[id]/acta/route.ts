import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { listarMedias, listarTestigos, obtenerCaso } from '@/lib/casos'
import { exigirAccesoCaso } from '@/lib/posesion'
import { construirActa, DECLARACION } from '@/lib/acta'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/** Devuelve el acta que se va a firmar: su hash, el texto exacto y qué cubre. */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })

    const [medias, testigos] = await Promise.all([listarMedias(id), listarTestigos(id)])
    const acta = construirActa(caso, medias, testigos)
    const firma = medias.find((m) => m.tipo === 'firma')

    return NextResponse.json({
      hash: acta.hash,
      declaracion: DECLARACION.texto,
      version: DECLARACION.version,
      resumen: acta.resumen,
      firmada: Boolean(firma),
      firmada_en: firma?.capturado_en ?? null,
    })
  } catch (err) {
    return errorApi('acta:GET', err, 'No se pudo preparar el acta.')
  }
}
