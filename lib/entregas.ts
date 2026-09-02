import { db, nuevoId } from './db'
import { hashToken, nuevoToken } from './claves'
import { enviarCorreo, ErrorCorreo, faltaParaCorreo } from './correo'
import { avanzarGestion, registrarGestion } from './gestion'

/**
 * Entrega del expediente sellado al productor.
 *
 * Dos decisiones que conviene tener presentes:
 *
 * 1. El correo NO lleva el expediente adjunto. Lleva el número de actuación y un enlace
 *    que vence. Un PDF con el nombre, el teléfono, el relato y las fotografías del
 *    siniestro —incluida la documentación de un tercero— circulando por el correo, sin
 *    control de a dónde se reenvía, es exactamente lo que la Ley 25.326 pide no hacer.
 *
 * 2. El token viaja en el FRAGMENTO de la URL, después del #, y se consume por POST. Los
 *    escáneres de enlaces corporativos —SafeLinks de Outlook, Proofpoint, el proxy de
 *    imágenes de Gmail— hacen GET a todos los enlaces de un correo antes de que lo abra
 *    nadie: un token de un solo uso consumido por GET llega quemado. El fragmento no viaja
 *    al servidor, así que ningún escáner puede gastarlo.
 */

const HORAS = Number(process.env.ENTREGA_HORAS_VALIDEZ || 72)

export type EstadoEnvio = 'pendiente' | 'enviado' | 'fallido' | 'sin_configurar' | 'cancelado'

export interface Envio {
  id: string
  destinatario: string
  canal: string
  estado: EstadoEnvio
  intentos: number
  error: string | null
  creado_en: string
  enviado_en: string | null
  abierto_en: string | null
}

export class ErrorEntrega extends Error {}

function cuerpoDelAviso(casoId: string, url: string, vence: Date): string {
  return [
    'Recibiste un expediente de siniestro para tramitar.',
    '',
    `Actuación: ${casoId}`,
    '',
    'Para verlo, abrí este enlace y confirmá:',
    url,
    '',
    `El enlace vence el ${vence.toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}.`,
    '',
    'El expediente no viaja en este correo: lleva datos personales del asegurado y de un',
    'tercero, y no corresponde que circulen por mail sin control de a dónde se reenvían.',
    '',
    '--',
    'Acta Digital de Siniestro',
  ].join('\n')
}

/**
 * Crea el envío y lo despacha.
 *
 * Si no hay SMTP configurado, la fila queda en 'sin_configurar' y el expediente igual queda
 * disponible en la bandeja del productor. El sistema arranca y funciona sin correo: lo que
 * no hace es fingir que lo mandó.
 */
export async function entregar(
  casoId: string,
  destinatario: string,
  productorId: string | null,
  urlBase: string,
  actor: string | null,
): Promise<Envio> {
  const pg = await db()

  const caso = await pg.query<{ estado: string }>('SELECT estado FROM casos WHERE id = $1', [casoId])
  if (caso.rowCount === 0) throw new ErrorEntrega('No existe esa actuación.')
  if (caso.rows[0].estado !== 'cerrado') {
    throw new ErrorEntrega('Sólo se entrega el expediente sellado. Cerrá la actuación primero.')
  }

  const token = nuevoToken()
  const vence = new Date(Date.now() + HORAS * 3600_000)
  const envioId = nuevoId('ENV')

  await pg.query(
    `INSERT INTO envios (id, caso_id, destinatario, productor_id, canal, estado, token_sha256, expira_en, proximo_intento_en)
     VALUES ($1,$2,$3,$4,'email','pendiente',$5,$6, now())`,
    [envioId, casoId, destinatario, productorId, hashToken(token), vence.toISOString()],
  )

  const falta = faltaParaCorreo()
  if (falta) {
    await pg.query(`UPDATE envios SET estado = 'sin_configurar', error = $2 WHERE id = $1`, [envioId, falta])
    await registrarGestion(casoId, 'entrega_sin_correo', { envio_id: envioId, destinatario, motivo: falta }, actor)
    await avanzarGestion(casoId, 'enviada', actor, { envio_id: envioId, canal: 'panel' }).catch(() => undefined)
    return await obtenerEnvio(envioId)
  }

  try {
    await enviarCorreo({
      para: destinatario,
      asunto: `Expediente de siniestro ${casoId}`,
      cuerpo: cuerpoDelAviso(casoId, `${urlBase}/e/${envioId}#${token}`, vence),
    })
    await pg.query(`UPDATE envios SET estado = 'enviado', enviado_en = now(), intentos = intentos + 1 WHERE id = $1`, [
      envioId,
    ])
    await registrarGestion(casoId, 'expediente_entregado', { envio_id: envioId, destinatario, canal: 'email' }, actor)
    await avanzarGestion(casoId, 'enviada', actor, { envio_id: envioId, canal: 'email' }).catch(() => undefined)
  } catch (err) {
    const motivo = err instanceof ErrorCorreo ? err.message : 'No se pudo entregar el correo.'
    await pg.query(
      `UPDATE envios SET estado = 'fallido', error = $2, intentos = intentos + 1,
              proximo_intento_en = now() + interval '10 minutes' WHERE id = $1`,
      [envioId, motivo.slice(0, 400)],
    )
    await registrarGestion(casoId, 'entrega_fallida', { envio_id: envioId, destinatario, error: motivo }, actor)
  }

  return await obtenerEnvio(envioId)
}

export async function obtenerEnvio(id: string): Promise<Envio> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM envios WHERE id = $1', [id])
  const f = res.rows[0]
  if (!f) throw new ErrorEntrega('No existe ese envío.')
  return {
    id: f.id,
    destinatario: f.destinatario,
    canal: f.canal,
    estado: f.estado,
    intentos: f.intentos,
    error: f.error ?? null,
    creado_en: new Date(f.creado_en).toISOString(),
    enviado_en: f.enviado_en ? new Date(f.enviado_en).toISOString() : null,
    abierto_en: f.abierto_en ? new Date(f.abierto_en).toISOString() : null,
  }
}

export async function listarEnvios(casoId: string): Promise<Envio[]> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM envios WHERE caso_id = $1 ORDER BY creado_en DESC', [casoId])
  return res.rows.map((f) => ({
    id: f.id,
    destinatario: f.destinatario,
    canal: f.canal,
    estado: f.estado,
    intentos: f.intentos,
    error: f.error ?? null,
    creado_en: new Date(f.creado_en).toISOString(),
    enviado_en: f.enviado_en ? new Date(f.enviado_en).toISOString() : null,
    abierto_en: f.abierto_en ? new Date(f.abierto_en).toISOString() : null,
  }))
}

/**
 * Consume el token de un envío y devuelve el caso al que da acceso.
 *
 * Un solo uso: al abrirlo se marca y deja de servir.
 */
export async function abrirEntrega(envioId: string, token: string): Promise<string> {
  const pg = await db()
  const res = await pg.query(
    `SELECT caso_id, token_sha256, expira_en, abierto_en FROM envios WHERE id = $1`,
    [envioId],
  )
  const f = res.rows[0]
  if (!f || !f.token_sha256 || hashToken(token) !== f.token_sha256) {
    throw new ErrorEntrega('El enlace no es válido. Pedile a quien te lo mandó que te lo vuelva a enviar.')
  }
  if (f.expira_en && new Date(f.expira_en) < new Date()) {
    throw new ErrorEntrega('El enlace venció. Pedile a quien te lo mandó que te lo vuelva a enviar.')
  }
  if (!f.abierto_en) {
    await pg.query('UPDATE envios SET abierto_en = now() WHERE id = $1', [envioId])
    await registrarGestion(f.caso_id, 'entrega_abierta', { envio_id: envioId })
  }
  return f.caso_id
}

/**
 * Reintenta los envíos vencidos.
 *
 * No hay planificador en el proyecto y no se va a agregar uno: esto se dispara desde un
 * cron externo (una línea de curl con la cabecera del token) o desde el botón del panel.
 * Si nadie hace ninguna de las dos cosas, un envío fallido se queda fallido hasta que
 * alguien lo mire. Está documentado y es visible en la pantalla.
 */
export async function reintentarPendientes(urlBase: string): Promise<number> {
  const pg = await db()
  const res = await pg.query<{ id: string; caso_id: string; destinatario: string; productor_id: string | null }>(
    `SELECT id, caso_id, destinatario, productor_id FROM envios
      WHERE estado = 'fallido' AND intentos < 5 AND proximo_intento_en < now() LIMIT 20`,
  )
  let hechos = 0
  for (const f of res.rows) {
    try {
      await entregar(f.caso_id, f.destinatario, f.productor_id, urlBase, null)
      await pg.query(`UPDATE envios SET estado = 'cancelado' WHERE id = $1`, [f.id])
      hechos++
    } catch {
      // Retroceso exponencial simple: cada intento espera el doble.
      await pg.query(
        `UPDATE envios SET intentos = intentos + 1,
                proximo_intento_en = now() + (interval '10 minutes' * power(2, intentos)) WHERE id = $1`,
        [f.id],
      )
    }
  }
  return hechos
}
