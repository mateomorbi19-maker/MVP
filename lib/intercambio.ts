import { rm } from 'node:fs/promises'
import { resolve, sep } from 'node:path'
import { db, nuevoId } from './db'
import { bloquearCasoAbierto } from './casos'
import { registrarEvento, sha256 } from './hash'
import { hashToken, nuevoToken } from './claves'
import { DIR_MEDIA, guardarArchivo, leerDocumento, leerArchivo } from './almacenamiento'
import { esTipoDocumentacion, type TipoDocumentacion } from './documentacion'

const GUIA_DOCUMENTO: Record<TipoDocumentacion, string> = {
  poliza: 'seguro_propio', cedula: 'cedula_propia', licencia: 'licencia_propia', dni: 'dni_propio',
}
const TITULO_DOCUMENTO: Record<TipoDocumentacion, string> = {
  poliza: 'Póliza', cedula: 'Cédula del vehículo', licencia: 'Licencia de conducir', dni: 'DNI',
}

export class ErrorIntercambio extends Error {
  constructor(mensaje: string, readonly estado: 400 | 403 | 410 = 400) {
    super(mensaje)
  }
}

type ArchivoSeleccionable = { id: string; tipo: string; poliza_id: string | null }
export type CopiaDocumentacion = { id: string; titulo: string; tipo: TipoDocumentacion; mime: string }

export function seleccionarArchivosIntercambio<T extends ArchivoSeleccionable>(archivos: T[], seleccion: unknown, polizaId: string): T[] {
  if (!Array.isArray(seleccion) || seleccion.length < 1 || seleccion.length > 20 || seleccion.some((id) => typeof id !== 'string')) {
    throw new ErrorIntercambio('Elegí entre 1 y 20 archivos para incorporar o compartir.')
  }
  if (new Set(seleccion).size !== seleccion.length) throw new ErrorIntercambio('Quitá los archivos repetidos de la selección.')
  return seleccion.map((id) => {
    const archivo = archivos.find((a) => a.id === id)
    if (!archivo || !esTipoDocumentacion(archivo.tipo)) throw new ErrorIntercambio('Elegí únicamente archivos de tu cuenta y volvé a intentar.')
    if ((archivo.tipo === 'poliza' || archivo.tipo === 'cedula') && archivo.poliza_id !== polizaId) {
      throw new ErrorIntercambio('Asigná el archivo al vehículo y la póliza correctos desde Mi documentación antes de elegirlo.')
    }
    return archivo
  })
}

export function estadoPermisoIntercambio(permiso: { revocado_en: unknown; vence_en: string | Date }, ahora = new Date()): 'activo' | 'revocado' | 'vencido' {
  if (permiso.revocado_en) return 'revocado'
  return new Date(permiso.vence_en).getTime() > ahora.getTime() ? 'activo' : 'vencido'
}

export const claveCopiaDocumentacion = (casoId: string, archivoId: string, huella: string) => sha256(`${casoId}:${archivoId}:${huella}`)

/** Se copian bytes, nunca enlaces a la carpeta editable de la persona. */
export async function incorporarDocumentacion(usuarioId: string, casoId: string, entrada: Record<string, unknown>) {
  if (typeof entrada.poliza_id !== 'string' || !entrada.poliza_id) throw new ErrorIntercambio('Elegí el vehículo y su póliza antes de incorporar documentos.')
  const pg = await db()
  const cliente = await pg.connect()
  const guardados: string[] = []
  try {
    await cliente.query('BEGIN')
    const caso = await bloquearCasoAbierto(casoId, cliente)
    if (caso.usuario_id && caso.usuario_id !== usuarioId) throw new ErrorIntercambio('Usá la cuenta titular de esta actuación para incorporar su documentación.', 403)
    const polizas = await cliente.query(`SELECT po.*, pr.usuario_id AS productor_usuario_id
      FROM polizas po LEFT JOIN productores pr ON pr.id = po.productor_id WHERE po.id = $1 AND po.usuario_id = $2 FOR SHARE OF po`, [entrada.poliza_id, usuarioId])
    const poliza = polizas.rows[0]
    if (!poliza) throw new ErrorIntercambio('Elegí una póliza de tu cuenta.')
    if (entrada.asociar_solo === true && entrada.compartir === true) throw new ErrorIntercambio('Elegí al menos un documento antes de generar el QR.')
    const originales = await cliente.query('SELECT * FROM archivos_usuario WHERE usuario_id = $1 FOR SHARE', [usuarioId])
    const elegidos = entrada.asociar_solo === true ? [] : seleccionarArchivosIntercambio(originales.rows as (ArchivoSeleccionable & { archivo: string; sha256: string; mime: string; creado_en: string })[], entrada.archivos, poliza.id)
    const relaciones = await cliente.query('SELECT poliza_id FROM casos WHERE id = $1', [casoId])
    const tieneDocumentos = await cliente.query("SELECT 1 FROM medias WHERE caso_id = $1 AND origen = 'documentacion_previa' LIMIT 1", [casoId])
    if (tieneDocumentos.rows[0] && relaciones.rows[0]?.poliza_id !== poliza.id) {
      throw new ErrorIntercambio('Esta actuación ya tiene documentos de otro vehículo. Conservá la póliza elegida y revisá sus datos antes de continuar.')
    }
    const copias: CopiaDocumentacion[] = []
    for (const original of elegidos) {
      const tipo = original.tipo as TipoDocumentacion
      const idem = claveCopiaDocumentacion(casoId, original.id, original.sha256)
      const existente = await cliente.query('SELECT id, mime FROM medias WHERE caso_id = $1 AND idempotencia = $2', [casoId, idem])
      let mediaId = existente.rows[0]?.id as string | undefined
      if (!mediaId) {
        const bytes = await leerDocumento(original.archivo)
        if (sha256(bytes) !== original.sha256) throw new ErrorIntercambio('El archivo guardado no coincide con su huella. Volvé a cargarlo desde Mi documentación.')
        mediaId = nuevoId('DOC')
        const copia = await guardarArchivo(casoId, mediaId, original.mime, bytes, true)
        guardados.push(copia.archivo)
        await cliente.query(`INSERT INTO medias (id, caso_id, tipo, guia_id, archivo, mime, bytes, sha256, idempotencia, origen)
          VALUES ($1,$2,'documento',$3,$4,$5,$6,$7,$8,'documentacion_previa')`,
        [mediaId, casoId, GUIA_DOCUMENTO[tipo], copia.archivo, copia.mime, copia.bytes, copia.sha256, idem])
        await registrarEvento(casoId, 'documento_incorporado', {
          media_id: mediaId, guia_id: GUIA_DOCUMENTO[tipo], mime: copia.mime, bytes: copia.bytes, sha256: copia.sha256, origen: 'documentacion_previa',
        }, { reservado: { archivo_origen_id: original.id, documento_creado_en: original.creado_en }, cliente })
      }
      copias.push({ id: mediaId, titulo: TITULO_DOCUMENTO[tipo], tipo, mime: original.mime })
    }
    if (caso.poliza !== poliza.numero || caso.patente !== poliza.patente || relaciones.rows[0]?.poliza_id !== poliza.id) {
      await cliente.query('UPDATE casos SET poliza_id = $2, poliza = $3, patente = $4, productor_id = $5 WHERE id = $1',
        [casoId, poliza.id, poliza.numero, poliza.patente, poliza.productor_usuario_id ?? null])
      await registrarEvento(casoId, 'datos_asegurado_actualizados', { campos: ['poliza', 'patente'] },
        { reservado: { poliza: poliza.numero, patente: poliza.patente, poliza_id: poliza.id }, cliente })
    }
    let permiso: { token: string; vence_en: string } | null = null
    if (entrada.compartir === true) {
      const token = nuevoToken()
      const vence = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      // Los permisos se pueden revocar incluso después del sello: quedan fuera de la cadena.
      await cliente.query('UPDATE documentos_compartidos SET revocado_en = now() WHERE caso_id = $1 AND usuario_id = $2 AND revocado_en IS NULL', [casoId, usuarioId])
      await cliente.query('INSERT INTO documentos_compartidos (token_sha256, usuario_id, caso_id, archivos, vence_en) VALUES ($1,$2,$3,$4,$5)',
        [hashToken(token), usuarioId, casoId, JSON.stringify(copias), vence])
      permiso = { token, vence_en: vence }
    }
    await cliente.query('COMMIT')
    return { copias, permiso }
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    await Promise.all(guardados.map(async (archivo) => {
      const destino = resolve(DIR_MEDIA, archivo)
      if (destino.startsWith(resolve(DIR_MEDIA) + sep)) await rm(destino, { force: true }).catch(() => {})
    }))
    throw err
  } finally {
    cliente.release()
  }
}

export async function revocarDocumentacionCompartida(usuarioId: string, casoId: string): Promise<void> {
  const pg = await db()
  await pg.query('UPDATE documentos_compartidos SET revocado_en = now() WHERE usuario_id = $1 AND caso_id = $2 AND revocado_en IS NULL', [usuarioId, casoId])
}

export async function leerDocumentacionCompartida(token: string, archivoId?: string | null) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ErrorIntercambio('El enlace no es válido. Pedí un QR nuevo a quien comparte los documentos.', 403)
  const pg = await db()
  const permisos = await pg.query('SELECT caso_id, archivos, vence_en, revocado_en FROM documentos_compartidos WHERE token_sha256 = $1', [hashToken(token)])
  const permiso = permisos.rows[0]
  if (!permiso) throw new ErrorIntercambio('El enlace no está disponible. Pedí un QR nuevo.', 403)
  const estado = estadoPermisoIntercambio(permiso)
  if (estado === 'revocado') throw new ErrorIntercambio('Se dejó de compartir esta documentación. Pedí un QR nuevo.', 403)
  if (estado === 'vencido') throw new ErrorIntercambio('El enlace venció. Pedí un QR nuevo para ver los documentos.', 410)
  const permitidos = (permiso.archivos as CopiaDocumentacion[]).map((a) => ({ id: a.id, titulo: a.titulo, tipo: a.tipo, mime: a.mime }))
  if (!archivoId) return { archivos: permitidos, vence_en: new Date(permiso.vence_en).toISOString() }
  const permitido = permitidos.find((a) => a.id === archivoId)
  if (!permitido) throw new ErrorIntercambio('Ese archivo no está incluido en el permiso compartido.', 403)
  const medias = await pg.query("SELECT archivo, mime, sha256 FROM medias WHERE id = $1 AND caso_id = $2 AND origen = 'documentacion_previa'", [archivoId, permiso.caso_id])
  const media = medias.rows[0]
  if (!media) throw new ErrorIntercambio('El documento ya no está disponible. Pedí una copia nueva.', 410)
  const bytes = await leerArchivo(media.archivo)
  if (sha256(bytes) !== media.sha256) throw new ErrorIntercambio('La copia no coincide con su huella y no puede mostrarse. Pedí que revisen el expediente.', 410)
  return { bytes, mime: media.mime as string, titulo: permitido.titulo }
}
