import { createCipheriv, createECDH, hkdfSync, randomBytes } from 'node:crypto'

/**
 * Cifrado de la carga de un Web Push, RFC 8291 (aes128gcm).
 *
 * Se hace a mano y no con la biblioteca `web-push` por dos motivos. Uno: ese paquete
 * arrastra entre cinco y ocho dependencias transitivas a un proyecto que tiene seis en
 * total, y las dos partes difíciles ya vienen resueltas en Node 22 sin escribir un solo
 * primitivo criptográfico —hkdfSync hace el extract y el expand, createCipheriv hace el
 * AES-GCM—. Dos, y es el que decide: el RFC 8291 §5 publica un vector de prueba completo,
 * o sea que esto se puede DEMOSTRAR correcto en `npm run prueba`. Casi ninguna
 * criptografía escrita a mano se puede demostrar, y por eso casi ninguna debería
 * escribirse a mano.
 *
 * La prueba con el vector del RFC está en scripts/prueba-logica.mjs. Si alguna vez falla,
 * no se toca este archivo hasta entender por qué: significa que el cifrado cambió.
 */

const TAM_REGISTRO = 4096

export interface Suscripcion {
  endpoint: string
  /** Clave pública del navegador, 65 bytes sin comprimir, en base64url. */
  p256dh: string
  /** Secreto de autenticación, 16 bytes, en base64url. */
  auth: string
}

const desdeB64Url = (s: string): Buffer => Buffer.from(s, 'base64url')

/**
 * Deriva la clave y el nonce del registro.
 *
 * Se expone aparte para poder contrastarla contra el vector del RFC sin tener que generar
 * una clave efímera al azar.
 */
export function derivarClaves(
  secretoCompartido: Buffer,
  auth: Buffer,
  publicaNavegador: Buffer,
  publicaServidor: Buffer,
  sal: Buffer,
): { cek: Buffer; nonce: Buffer } {
  // IKM = HKDF(salt = auth, ikm = ECDH, info = "WebPush: info" || 0 || ua || as)
  const info = Buffer.concat([
    Buffer.from('WebPush: info\0', 'utf8'),
    publicaNavegador,
    publicaServidor,
  ])
  const ikm = Buffer.from(hkdfSync('sha256', secretoCompartido, auth, info, 32))

  const cek = Buffer.from(hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16))
  const nonce = Buffer.from(hkdfSync('sha256', ikm, sal, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12))
  return { cek, nonce }
}

/**
 * Cifra la carga para una suscripción.
 *
 * Devuelve el cuerpo completo tal como va en el POST:
 *   sal(16) || tamaño de registro(4) || largo de la clave(1) || clave del servidor(65) || cifrado
 */
export function cifrarCarga(suscripcion: Suscripcion, carga: string, salFija?: Buffer, efimeraFija?: Buffer): Buffer {
  const publicaNavegador = desdeB64Url(suscripcion.p256dh)
  const auth = desdeB64Url(suscripcion.auth)

  const ecdh = createECDH('prime256v1')
  if (efimeraFija) ecdh.setPrivateKey(efimeraFija)
  else ecdh.generateKeys()
  const publicaServidor = ecdh.getPublicKey()
  const secretoCompartido = ecdh.computeSecret(publicaNavegador)

  const sal = salFija ?? randomBytes(16)
  const { cek, nonce } = derivarClaves(secretoCompartido, auth, publicaNavegador, publicaServidor, sal)

  // El 0x02 es el delimitador de relleno del último registro (RFC 8188).
  const claro = Buffer.concat([Buffer.from(carga, 'utf8'), Buffer.from([0x02])])
  const cifrador = createCipheriv('aes-128-gcm', cek, nonce)
  const cifrado = Buffer.concat([cifrador.update(claro), cifrador.final(), cifrador.getAuthTag()])

  const cabecera = Buffer.alloc(5)
  cabecera.writeUInt32BE(TAM_REGISTRO, 0)
  cabecera.writeUInt8(publicaServidor.length, 4)

  return Buffer.concat([sal, cabecera, publicaServidor, cifrado])
}
