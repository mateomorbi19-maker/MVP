/** La clave es exclusiva de esta integración: nunca reutiliza secretos de otras funciones. */
export const MAXIMO_AUDIO_RELATO = 20 * 1024 * 1024

const MIMES_AUDIO = new Set(['audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav'])

export class ErrorTranscripcion extends Error {
  readonly estado: number

  constructor(estado: number, mensaje: string) {
    super(mensaje)
    this.estado = estado
    this.name = 'ErrorTranscripcion'
  }
}

export function validarAudioRelato(archivo: Pick<File, 'size' | 'type'>): string {
  if (!archivo.size) throw new ErrorTranscripcion(400, 'La grabación está vacía. Grabá de nuevo o escribí el relato.')
  if (archivo.size > MAXIMO_AUDIO_RELATO) {
    throw new ErrorTranscripcion(413, 'El audio supera 20 MB. Grabá un relato más corto o escribilo.')
  }
  const mime = archivo.type.split(';')[0].trim().toLowerCase()
  if (!MIMES_AUDIO.has(mime)) {
    throw new ErrorTranscripcion(415, 'Usá una grabación WebM, Ogg, M4A, MP3 o WAV, o escribí el relato.')
  }
  return mime
}

/** Destino fijo: el navegador no puede convertir este servicio en un proxy de URLs. */
export async function transcribirAudio(archivo: File, opciones: {
  clave?: string
  solicitar?: typeof fetch
} = {}): Promise<string> {
  validarAudioRelato(archivo)
  const clave = (opciones.clave ?? process.env.TRANSCRIPCION_ELEVENLABS_API_KEY ?? '').trim()
  if (!clave) {
    throw new ErrorTranscripcion(503, 'Falta configurar la transcripción en el servidor. Podés escribir el relato y conservar tu audio, o reintentar cuando esté disponible.')
  }

  const cuerpo = new FormData()
  cuerpo.append('file', archivo)
  cuerpo.append('model_id', 'scribe_v2')
  cuerpo.append('language_code', 'es')
  cuerpo.append('webhook', 'false')
  cuerpo.append('tag_audio_events', 'false')

  let respuesta: Response
  try {
    respuesta = await (opciones.solicitar ?? fetch)('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': clave },
      body: cuerpo,
      signal: AbortSignal.timeout(45_000),
      redirect: 'error',
      cache: 'no-store',
    })
  } catch (error) {
    if (error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError')) {
      throw new ErrorTranscripcion(504, 'La transcripción tardó demasiado. Conservá el audio y reintentá, o escribí el relato.')
    }
    throw new ErrorTranscripcion(502, 'No se pudo conectar con la transcripción. Reintentá con conexión o escribí el relato.')
  }

  if (respuesta.status === 401 || respuesta.status === 403) {
    throw new ErrorTranscripcion(503, 'Hay que revisar la credencial de transcripción del servidor. Podés seguir escribiendo el relato.')
  }
  if (respuesta.status === 429) {
    throw new ErrorTranscripcion(503, 'La transcripción no tiene capacidad disponible. Reintentá más tarde o escribí el relato.')
  }
  if (!respuesta.ok) throw new ErrorTranscripcion(502, 'El servicio no pudo transcribir este audio. Reintentá o escribí el relato.')

  let datos: unknown
  try {
    datos = await respuesta.json()
  } catch {
    throw new ErrorTranscripcion(502, 'El servicio devolvió una transcripción ilegible. Reintentá o escribí el relato.')
  }
  if (!datos || typeof datos !== 'object' || !('text' in datos) || typeof datos.text !== 'string' || !datos.text.trim() || datos.text.length > 30_000) {
    throw new ErrorTranscripcion(502, 'No se reconoció un relato válido en el audio. Reintentá o escribí lo que pasó.')
  }
  // El original conserva incluso espacios: las correcciones pertenecen a otro campo.
  return datos.text
}
