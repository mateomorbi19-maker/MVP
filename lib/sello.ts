import { createSign, generateKeyPairSync, createPublicKey } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { sha256 } from './hash'
import { DIR_DATOS } from './almacenamiento'

/**
 * Sellado del expediente al cierre.
 *
 * Hace dos cosas:
 *   1. Pide un sello de tiempo RFC 3161 a una TSA pública (por defecto FreeTSA).
 *      Ese token acredita ante terceros que el hash maestro existía en ese instante.
 *   2. Firma el hash maestro con la clave del servidor.
 *
 * LIMITE EXPLICITO DE ESTA VERSION
 * --------------------------------
 * El punto 2 es una FIRMA ELECTRONICA (art. 5, Ley 25.506), no una firma digital.
 * No goza de las presunciones de autoría e integridad de los arts. 7 y 8.
 * Para obtenerlas hay que reemplazar la clave autogenerada por un certificado de
 * certificador licenciado (Encode, Lakaut, Box Custodia o Digilogix) y firmar el PDF
 * en formato PAdES. Está aislado acá justamente para que ese cambio toque un solo archivo.
 */

export interface Sello {
  hash_maestro: string
  sellado_en: string
  firma: {
    algoritmo: string
    valor: string
    clave_publica_sha256: string
    tipo: 'firma_electronica_demo' | 'firma_digital_certificador_licenciado'
    advertencia?: string
  }
  tsa: {
    solicitada: boolean
    obtenida: boolean
    autoridad: string | null
    token_sha256: string | null
    token_b64: string | null
    error: string | null
  }
}

const RUTA_CLAVE = join(DIR_DATOS, 'claves', 'servidor.pem')

/** Clave del servidor. Se genera sola la primera vez y persiste en el volumen. */
function clavePrivada(): string {
  const desdeEnv = process.env.CLAVE_FIRMA_PEM
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

export function huellaClavePublica(): string {
  const pub = createPublicKey(clavePrivada()).export({ type: 'spki', format: 'der' })
  return sha256(pub as Buffer)
}

function firmar(hashMaestro: string): Sello['firma'] {
  const firmador = createSign('SHA256')
  firmador.update(hashMaestro)
  firmador.end()
  return {
    algoritmo: 'ECDSA-P256-SHA256',
    valor: firmador.sign(clavePrivada(), 'base64'),
    clave_publica_sha256: huellaClavePublica(),
    tipo: 'firma_electronica_demo',
    advertencia:
      'Firma electrónica de demostración (art. 5, Ley 25.506). No equivale a firma digital: para las presunciones de los arts. 7 y 8 se requiere certificado de certificador licenciado.',
  }
}

/* ---------- RFC 3161 ---------- */

/** Longitud DER en forma corta o larga. */
function der(tag: number, contenido: Uint8Array): Uint8Array {
  const len = contenido.length
  let cabecera: number[]
  if (len < 0x80) {
    cabecera = [tag, len]
  } else {
    const bytes: number[] = []
    let n = len
    while (n > 0) {
      bytes.unshift(n & 0xff)
      n >>= 8
    }
    cabecera = [tag, 0x80 | bytes.length, ...bytes]
  }
  return Uint8Array.from([...cabecera, ...contenido])
}

const SEQ = (c: Uint8Array) => der(0x30, c)
const INT = (n: number) => der(0x02, Uint8Array.from([n]))
const OCTET = (c: Uint8Array) => der(0x04, c)
const NULL = Uint8Array.from([0x05, 0x00])
const BOOL_TRUE = Uint8Array.from([0x01, 0x01, 0xff])
/** OID 2.16.840.1.101.3.4.2.1 = sha256 */
const OID_SHA256 = Uint8Array.from([0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01])

const concat = (...partes: Uint8Array[]) => {
  const total = partes.reduce((n, p) => n + p.length, 0)
  const out = new Uint8Array(total)
  let o = 0
  for (const p of partes) {
    out.set(p, o)
    o += p.length
  }
  return out
}

/**
 * Construye un TimeStampReq (RFC 3161, sección 2.4.1):
 *   TimeStampReq ::= SEQUENCE { version INTEGER(1), messageImprint MessageImprint,
 *                               certReq BOOLEAN DEFAULT FALSE }
 *   MessageImprint ::= SEQUENCE { hashAlgorithm AlgorithmIdentifier, hashedMessage OCTET STRING }
 */
function construirSolicitudTSA(hashHex: string): Uint8Array {
  const digest = Uint8Array.from(Buffer.from(hashHex, 'hex'))
  const algoritmo = SEQ(concat(OID_SHA256, NULL))
  const messageImprint = SEQ(concat(algoritmo, OCTET(digest)))
  return SEQ(concat(INT(1), messageImprint, BOOL_TRUE))
}

async function pedirSelloTiempo(hashMaestro: string): Promise<Sello['tsa']> {
  const url = process.env.TSA_URL || 'https://freetsa.org/tsr'
  const base: Sello['tsa'] = {
    solicitada: true,
    obtenida: false,
    autoridad: url,
    token_sha256: null,
    token_b64: null,
    error: null,
  }

  if (process.env.TSA_DESACTIVADA === 'true') {
    return { ...base, solicitada: false, autoridad: null, error: 'Sellado de tiempo desactivado por configuración.' }
  }

  try {
    const cuerpo = construirSolicitudTSA(hashMaestro)
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/timestamp-query', 'User-Agent': 'ActaDigitalSiniestro/1.0' },
      body: Buffer.from(cuerpo),
      signal: AbortSignal.timeout(12000),
    })
    if (!res.ok) return { ...base, error: `La TSA respondió ${res.status}` }

    const token = Buffer.from(await res.arrayBuffer())
    if (token.length < 32) return { ...base, error: 'La TSA devolvió una respuesta vacía o inválida.' }

    return {
      ...base,
      obtenida: true,
      token_sha256: sha256(token),
      token_b64: token.toString('base64'),
      error: null,
    }
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : 'Error desconocido al contactar la TSA' }
  }
}

export async function sellar(hashMaestro: string): Promise<Sello> {
  const tsa = await pedirSelloTiempo(hashMaestro)
  return {
    hash_maestro: hashMaestro,
    sellado_en: new Date().toISOString(),
    firma: firmar(hashMaestro),
    tsa,
  }
}
