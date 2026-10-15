import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { obtenerCaso } from '@/lib/casos'
import { exigirAccesoCaso } from '@/lib/posesion'
import { ErrorTranscripcion, MAXIMO_AUDIO_RELATO, transcribirAudio } from '@/lib/transcripcion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'No existe esa actuación.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json({ error: 'La actuación está sellada. No se puede agregar ni transcribir otro relato.' }, { status: 409 })
    }
    const tamano = Number(req.headers.get('content-length'))
    if (tamano > MAXIMO_AUDIO_RELATO + 64 * 1024) {
      return NextResponse.json({ error: 'El audio supera 20 MB. Grabá un relato más corto o escribilo.' }, { status: 413 })
    }
    if (!req.headers.get('content-type')?.startsWith('multipart/form-data')) {
      return NextResponse.json({ error: 'Enviá la grabación como archivo de audio.' }, { status: 415 })
    }
    let formulario: FormData
    try {
      formulario = await req.formData()
    } catch {
      return NextResponse.json({ error: 'La grabación llegó incompleta. Reintentá enviarla.' }, { status: 400 })
    }
    const audio = formulario.get('archivo')
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'Falta la grabación. Grabá un audio o escribí el relato.' }, { status: 400 })
    }

    // Transformar un borrador no incorpora evidencia ni modifica la cadena del caso.
    const texto = await transcribirAudio(audio)
    return NextResponse.json({ texto, proveedor: 'ElevenLabs', modelo: 'scribe_v2' }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    if (error instanceof ErrorTranscripcion) {
      return NextResponse.json({ error: error.message, tipo: error.estado === 503 ? 'configuracion' : 'transcripcion' }, { status: error.estado })
    }
    return errorApi('transcripcion:POST', error, 'No se pudo transcribir. Conservá la grabación y reintentá, o escribí el relato.')
  }
}
