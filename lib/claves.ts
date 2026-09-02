import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { sha256 } from './hash'

/**
 * Contraseñas y tokens.
 *
 * No importa nada de Next a propósito: `scripts/prueba-logica.mjs` carga este archivo
 * directo para probar el hasheo sin levantar un servidor ni una base.
 *
 * Se usa scrypt de node:crypto y no bcrypt ni argon2 porque los dos son módulos nativos
 * que habría que compilar dentro de la imagen de Docker, y Node 22 ya trae esto. scrypt
 * es memory-hard: encarece el ataque por GPU, que es el que importa cuando el nombre de
 * usuario es un DNI y por lo tanto es un dato público que cualquiera conoce.
 */

/**
 * N*r*128 = 32768*8*128 = 32 MiB por verificación, del orden de 100 ms.
 * `maxmem` tiene que ser mayor que eso o scrypt falla con ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
 */
const PARAMETROS = { N: 32768, r: 8, p: 1, keylen: 64 }
const MAXMEM = 96 * 1024 * 1024

function derivar(clave: string, sal: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    // La forma asíncrona corre en el pool de hilos de libuv: no bloquea el event loop.
    scrypt(clave.normalize('NFKC'), sal, keylen, { N, r, p, maxmem: MAXMEM }, (err, derivada) => {
      if (err) rechazar(err)
      else resolver(derivada as Buffer)
    })
  })
}

/**
 * Devuelve 'scrypt$N$r$p$sal$hash'.
 *
 * Los parámetros van DENTRO del string guardado: subirlos el día que haga falta no
 * invalida las contraseñas ya creadas, porque cada hash se verifica con los suyos.
 */
export async function hashearClave(clave: string): Promise<string> {
  const { N, r, p, keylen } = PARAMETROS
  const sal = randomBytes(16)
  const derivada = await derivar(clave, sal, N, r, p, keylen)
  return ['scrypt', N, r, p, sal.toString('base64'), derivada.toString('base64')].join('$')
}

/** Comparación en tiempo constante. Nunca lanza: un hash corrupto es «no coincide». */
export async function verificarClave(clave: string, guardado: string): Promise<boolean> {
  const partes = (guardado ?? '').split('$')
  if (partes.length !== 6 || partes[0] !== 'scrypt') return false

  const N = Number(partes[1])
  const r = Number(partes[2])
  const p = Number(partes[3])
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  if (N < 1024 || r < 1 || p < 1) return false

  const sal = Buffer.from(partes[4], 'base64')
  const esperado = Buffer.from(partes[5], 'base64')
  if (sal.length === 0 || esperado.length === 0) return false

  let derivada: Buffer
  try {
    derivada = await derivar(clave, sal, N, r, p, esperado.length)
  } catch {
    return false
  }

  // timingSafeEqual lanza si los largos difieren, así que se compara antes.
  if (derivada.length !== esperado.length) return false
  return timingSafeEqual(derivada, esperado)
}

/**
 * El hash de una contraseña que no existe.
 *
 * Se verifica contra esto cuando el DNI no está en la base, para que entrar con un DNI
 * inexistente tarde lo mismo que entrar con uno real y la clave equivocada. Sin esto, el
 * tiempo de respuesta dice qué DNI está registrado, y el DNI es un dato público.
 */
export const CLAVE_INEXISTENTE =
  'scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'

/** Devuelve el mensaje de lo que hay que arreglar, o null si la clave sirve. */
export function validarClave(clave: unknown, dni: string): string | null {
  if (typeof clave !== 'string') return 'Falta la contraseña.'
  if (clave.length < 8) return 'La contraseña tiene que tener al menos 8 caracteres.'
  if (clave.length > 200) return 'La contraseña no puede superar los 200 caracteres.'
  if (clave.replace(/[^0-9]/g, '') === clave) {
    return 'La contraseña no puede ser sólo números: agregale al menos una letra.'
  }
  if (dni && clave.includes(dni)) return 'La contraseña no puede contener tu DNI: es un dato que cualquiera conoce.'
  return null
}

/** '20.123.456' -> '20123456'. Devuelve null si no es un DNI plausible. */
export function normalizarDni(valor: unknown): string | null {
  if (typeof valor !== 'string') return null
  const soloDigitos = valor.replace(/[^0-9]/g, '')
  if (soloDigitos.length < 7 || soloDigitos.length > 9) return null
  return soloDigitos
}

/** Token opaco de 32 bytes, para sesiones, posesión y secretos de apertura. */
export function nuevoToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Lo que se guarda en la base. Reusa el sha256 de lib/hash.ts, no duplica el hasheo. */
export function hashToken(token: string): string {
  return sha256(token)
}
