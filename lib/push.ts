import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { createPrivateKey, createPublicKey, createSign, generateKeyPairSync } from 'node:crypto'
import { DIR_DATOS } from './almacenamiento'
import { cifrarCarga, type Suscripcion } from './cifrado'
import { sha256 } from './hash'

/**
 * Envío de notificaciones push, con VAPID y sin SDK.
 *
 * La clave sigue el mismo patrón que la de firma de lib/sello.ts: se genera sola la primera
 * vez y persiste en el volumen.
 *
 * LA CLAVE VAPID ES UN PUNTO ÚNICO DE FALLA SILENCIOSO, y conviene saberlo antes de
 * desplegar: la clave PÚBLICA queda incrustada dentro de cada suscripción que el navegador
 * guardó. Si se pierde o se regenera —el volumen sin montar en Easypanel, el volumen
 * recreado, un redeploy sin persistencia— todos los envíos empiezan a fallar con 403 y NADA
 * en la interfaz lo dice: la persona ve una aplicación que anda y no recibe avisos. Por eso
 * /api/push/clave-publica devuelve también la huella de la clave, y las suscripciones
 * guardan contra qué huella se crearon.
 */

const RUTA_CLAVE = join(DIR_DATOS, 'claves', 'vapid.pem')

export class ErrorPush extends Error {}

function clavePrivada(): string {
  const desdeEnv = process.env.VAPID_CLAVE_PEM
  if (desdeEnv) return desdeEnv.replace(/\\n/g, '\n')
  if (existsSync(RUTA_CLAVE)) return readFileSync(RUTA_CLAVE, 'utf8')

  const { privateKey } = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  })
  mkdirSync(dirname(RUTA_CLAVE), { recursive: true })
  writeFileSync(RUTA_CLAVE, privateKey, { mode: 0o600 })
  return privateKey
}

/** La clave pública en el formato que espera pushManager.subscribe: 65 bytes crudos. */
export function clavePublicaVapid(): string {
  const spki = createPublicKey(clavePrivada()).export({ type: 'spki', format: 'der' }) as Buffer
  // Los últimos 65 bytes de un SPKI de P-256 son el punto sin comprimir (0x04 || X || Y).
  return spki.subarray(spki.length - 65).toString('base64url')
}

export function huellaVapid(): string {
  return sha256(clavePublicaVapid()).slice(0, 16)
}

export function pushActivo(): boolean {
  return process.env.PUSH_DESACTIVADO !== 'true'
}

/**
 * Arma el encabezado de autorización VAPID.
 *
 * El JWT va firmado con ES256, que en Node es ECDSA sobre P-256 con la firma en formato
 * crudo r||s: eso es `dsaEncoding: 'ieee-p1363'`. Con el DER por omisión el servicio de
 * push rechaza el token y el error no dice por qué.
 */
function autorizacion(endpoint: string): string {
  const origen = new URL(endpoint).origin
  const sujeto = process.env.VAPID_SUJETO || 'mailto:soporte@example.org'

  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o), 'utf8').toString('base64url')
  const cabecera = b64({ typ: 'JWT', alg: 'ES256' })
  const carga = b64({ aud: origen, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: sujeto })
  const porFirmar = `${cabecera}.${carga}`

  const firmador = createSign('SHA256')
  firmador.update(porFirmar)
  firmador.end()
  const firma = firmador.sign({ key: createPrivateKey(clavePrivada()), dsaEncoding: 'ieee-p1363' })

  return `vapid t=${porFirmar}.${firma.toString('base64url')}, k=${clavePublicaVapid()}`
}

export interface Aviso {
  titulo: string
  cuerpo: string
  /** A dónde lleva el toque. */
  url: string
  /**
   * Acciones de la notificación.
   *
   * EN iPHONE NO EXISTEN: Web Push en iOS ignora este arreglo por completo. En Android,
   * Chrome dibuja como máximo DOS (Notification.maxActions) y la tercera desaparece sin
   * error. Se mandan igual, ordenadas por importancia, y la pantalla a la que lleva el
   * toque tiene los mismos botones en grande — que es lo único que funciona en los dos
   * lados. La maqueta de esa notificación va rotulada «sólo Android».
   */
  acciones?: Array<{ action: string; title: string }>
  etiqueta?: string
}

export interface ResultadoEnvio {
  ok: boolean
  estado: number
  motivo: string | null
  /** true si el servicio de push dice que esta suscripción ya no existe. */
  caducada: boolean
}

/** Manda un aviso a un dispositivo. No lanza: devuelve por qué falló. */
export async function enviarPush(suscripcion: Suscripcion, aviso: Aviso): Promise<ResultadoEnvio> {
  if (!pushActivo()) return { ok: false, estado: 0, motivo: 'Las notificaciones están desactivadas.', caducada: false }

  try {
    const carga = cifrarCarga(suscripcion, JSON.stringify(aviso))
    const res = await fetch(suscripcion.endpoint, {
      method: 'POST',
      headers: {
        Authorization: autorizacion(suscripcion.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '900',
        Urgency: 'high',
      },
      body: new Uint8Array(carga),
      signal: AbortSignal.timeout(10_000),
    })

    // 404 y 410 significan que el navegador dio de baja la suscripción.
    const caducada = res.status === 404 || res.status === 410
    if (res.ok) return { ok: true, estado: res.status, motivo: null, caducada: false }

    const detalle = await res.text().catch(() => '')
    return {
      ok: false,
      estado: res.status,
      motivo:
        res.status === 403
          ? 'El servicio de push rechazó la clave VAPID. Suele pasar cuando la clave del servidor cambió: las suscripciones viejas quedaron atadas a la anterior y hay que volver a suscribir los teléfonos.'
          : `El servicio de push respondió ${res.status}. ${detalle.slice(0, 200)}`,
      caducada,
    }
  } catch (err) {
    return {
      ok: false,
      estado: 0,
      motivo: err instanceof Error ? err.message : 'Error desconocido al enviar el aviso.',
      caducada: false,
    }
  }
}
