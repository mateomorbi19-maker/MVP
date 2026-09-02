import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { sha256 } from './hash'

/**
 * Guardado de fotos y audios en el volumen persistente.
 *
 * En Easypanel hay que montar un volumen sobre DIR_DATOS; si no, cada redeploy
 * borra los archivos. La base de datos guarda sólo la ruta relativa y el hash.
 */

// El comentario evita que el empaquetador intente rastrear esta ruta en tiempo de
// compilación: como sale de una variable de entorno, sin él arrastra todo el proyecto
// al bundle de producción.
export const DIR_DATOS = resolve(/* turbopackIgnore: true */ process.env.DIR_DATOS || './data')
export const DIR_MEDIA = join(DIR_DATOS, 'media')
/** Documentación de la póliza. Carpeta aparte: no es evidencia del hecho. */
export const DIR_DOCUMENTOS = join(DIR_DATOS, 'documentos')
/** Series de sensores. Carpeta y validación propias: no son una fotografía. */
export const DIR_SERIES = join(DIR_DATOS, 'series')

const MIMES_PERMITIDOS = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'audio/webm',
  'audio/ogg',
  'audio/mp4',
  'audio/mpeg',
  'audio/wav',
])

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'audio/webm': 'webm',
  'audio/ogg': 'ogg',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
}

export const TAMANO_MAXIMO = Number(process.env.TAMANO_MAXIMO_BYTES || 20 * 1024 * 1024)

export class ErrorArchivo extends Error {}

export interface ArchivoGuardado {
  archivo: string
  sha256: string
  bytes: number
  mime: string
}

/** El mime llega del navegador: se normaliza y se valida contra la lista permitida. */
export function validarMime(mime: string): string {
  const limpio = (mime || '').split(';')[0].trim().toLowerCase()
  if (!MIMES_PERMITIDOS.has(limpio)) {
    throw new ErrorArchivo(`Tipo de archivo no admitido: ${limpio || 'desconocido'}`)
  }
  return limpio
}

export async function guardarArchivo(
  casoId: string,
  mediaId: string,
  mime: string,
  datos: Uint8Array,
): Promise<ArchivoGuardado> {
  const mimeValido = validarMime(mime)
  if (datos.length === 0) throw new ErrorArchivo('El archivo llegó vacío.')
  if (datos.length > TAMANO_MAXIMO) {
    throw new ErrorArchivo(`El archivo supera el máximo de ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB.`)
  }

  // casoId y mediaId son generados por el servidor, nunca vienen del cliente.
  const carpeta = join(DIR_MEDIA, casoId)
  await mkdir(carpeta, { recursive: true })

  const nombre = `${mediaId}.${EXTENSIONES[mimeValido]}`
  await writeFile(join(carpeta, nombre), datos)

  return {
    archivo: `${casoId}/${nombre}`,
    sha256: sha256(datos),
    bytes: datos.length,
    mime: mimeValido,
  }
}

/** Lee un archivo del volumen, impidiendo salirse del directorio de media. */
export async function leerArchivo(rutaRelativa: string): Promise<Buffer> {
  const destino = resolve(DIR_MEDIA, rutaRelativa)
  if (!destino.startsWith(resolve(DIR_MEDIA))) {
    throw new ErrorArchivo('Ruta de archivo inválida.')
  }
  return readFile(destino)
}

/* ================= Documentación de la póliza ================= */

/*
 * Lista blanca y carpeta SEPARADAS de las del siniestro, a propósito.
 *
 * MIMES_PERMITIDOS es la lista de las fotos y audios del hecho, y la usa el POST de media
 * del recorrido. Sumarle application/pdf para poder adjuntar la póliza permitiría subir un
 * PDF como «fotografía del siniestro», y ese PDF entraría al manifiesto como pieza
 * fotográfica del expediente sellado.
 */
const MIMES_DOCUMENTOS = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'])

const EXTENSIONES_DOCUMENTOS: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
}

export async function guardarDocumento(
  polizaId: string,
  documentoId: string,
  mime: string,
  datos: Uint8Array,
): Promise<ArchivoGuardado> {
  const limpio = (mime || '').split(';')[0].trim().toLowerCase()
  if (!MIMES_DOCUMENTOS.has(limpio)) {
    throw new ErrorArchivo(`Tipo de archivo no admitido para documentación: ${limpio || 'desconocido'}`)
  }
  if (datos.length === 0) throw new ErrorArchivo('El archivo llegó vacío.')
  if (datos.length > TAMANO_MAXIMO) {
    throw new ErrorArchivo(`El archivo supera el máximo de ${Math.round(TAMANO_MAXIMO / 1024 / 1024)} MB.`)
  }

  // polizaId y documentoId los genera el servidor, nunca vienen del cliente.
  const carpeta = join(DIR_DOCUMENTOS, polizaId)
  await mkdir(carpeta, { recursive: true })
  const nombre = `${documentoId}.${EXTENSIONES_DOCUMENTOS[limpio]}`
  await writeFile(join(carpeta, nombre), datos)

  return { archivo: `${polizaId}/${nombre}`, sha256: sha256(datos), bytes: datos.length, mime: limpio }
}

/** Lee un documento, con la misma guarda contra salirse del directorio que las medias. */
export async function leerDocumento(rutaRelativa: string): Promise<Buffer> {
  const destino = resolve(DIR_DOCUMENTOS, rutaRelativa)
  if (!destino.startsWith(resolve(DIR_DOCUMENTOS))) {
    throw new ErrorArchivo('Ruta de archivo inválida.')
  }
  return readFile(destino)
}

/* ================= Series de sensores ================= */

/**
 * Guarda una serie de lecturas como archivo JSON.
 *
 * NO pasa por guardarArchivo ni se le agrega application/json a MIMES_PERMITIDOS: esa lista
 * la usa el POST de media del recorrido, y sumarle JSON permitiría subir un archivo
 * arbitrario como «fotografía del siniestro», que entraría al manifiesto como pieza
 * fotográfica del expediente sellado.
 */
export async function guardarSerie(casoId: string, mediaId: string, contenido: string): Promise<ArchivoGuardado> {
  const datos = new TextEncoder().encode(contenido)
  if (datos.length === 0) throw new ErrorArchivo('La serie llegó vacía.')
  if (datos.length > TAMANO_MAXIMO) throw new ErrorArchivo('La serie de sensores es demasiado grande.')

  const carpeta = join(DIR_SERIES, casoId)
  await mkdir(carpeta, { recursive: true })
  const nombre = `${mediaId}.json`
  await writeFile(join(carpeta, nombre), datos)

  return { archivo: `${casoId}/${nombre}`, sha256: sha256(datos), bytes: datos.length, mime: 'application/json' }
}

/** Lee una serie, con la misma guarda contra salirse del directorio. */
export async function leerSerie(rutaRelativa: string): Promise<Buffer> {
  const destino = resolve(DIR_SERIES, rutaRelativa)
  if (!destino.startsWith(resolve(DIR_SERIES))) throw new ErrorArchivo('Ruta de archivo inválida.')
  return readFile(destino)
}
