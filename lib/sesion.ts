import { cookies } from 'next/headers'
import { db } from './db'
import { hashToken, nuevoToken } from './claves'

/**
 * Sesiones de cuenta y control de acceso.
 *
 * Hay tres niveles de acceso y se mantienen separados a propósito, porque mezclarlos
 * rompería la decisión central del producto:
 *
 *   1. Posesión del id de la actuación (lib/posesion.ts). Es lo que sostiene el circuito
 *      anónimo: el botón "Tuve un accidente" no pide nada y /s/[id] sigue abierto.
 *   2. Secreto de apertura. Se devuelve UNA vez, en el alta, y es la única prueba que se
 *      acepta para reclamar una actuación anónima desde una cuenta.
 *   3. Sesión. Habilita el panel, el listado, el historial y la entrega al productor.
 *
 * La autorización se resuelve acá, en la capa de datos, y NO en proxy.ts. Los docs de
 * Next 16 lo dicen explícitamente: el proxy corre antes de renderizar y está pensado para
 * redirecciones y reescrituras, no como solución de autorización. El proxy sólo evita
 * pintar una pantalla privada cuando ni siquiera hay cookie.
 */

export type Rol = 'asegurado' | 'productor' | 'aseguradora'
export const ROLES: readonly Rol[] = ['asegurado', 'productor', 'aseguradora']

export const COOKIE_SESION = 'acta_sesion'

const DIAS = Number(process.env.DIAS_SESION || 30)

/**
 * En producción la cookie va Secure, y sin TLS el navegador la descarta en silencio: el
 * proxy no la ve nunca y manda a /entrar en un bucle, sin error en pantalla ni en el log.
 * Es el modo de falla más difícil de diagnosticar del módulo, y esta variable es la
 * válvula para una prueba sobre http.
 */
const INSEGURA = process.env.COOKIE_INSEGURA === 'true'

export interface Sesion {
  usuario_id: string
  dni: string
  nombre: string | null
  rol: Rol
  expira_en: string
}

/** Falta iniciar sesión, o la sesión no alcanza para esto. */
export class ErrorAcceso extends Error {
  constructor(
    readonly estado: 401 | 403,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorAcceso'
  }
}

/** Abre la sesión y deja la cookie. Sólo se puede llamar desde un route handler. */
export async function crearSesion(usuarioId: string, userAgent: string | null): Promise<void> {
  const token = nuevoToken()
  const expira = new Date(Date.now() + DIAS * 24 * 60 * 60 * 1000)
  const pg = await db()
  await pg.query(
    'INSERT INTO sesiones (token_sha256, usuario_id, expira_en, user_agent) VALUES ($1, $2, $3, $4)',
    [hashToken(token), usuarioId, expira.toISOString(), userAgent?.slice(0, 200) ?? null],
  )
  const tarro = await cookies()
  tarro.set(COOKIE_SESION, token, {
    httpOnly: true,
    secure: !INSEGURA,
    sameSite: 'lax',
    path: '/',
    expires: expira,
  })
}

/**
 * La sesión vigente, o null.
 *
 * Sirve tanto en Server Components como en route handlers. Es un SELECT por clave
 * primaria; si alguna vez aparece en un profiling se envuelve con cache() de React.
 */
export async function leerSesion(): Promise<Sesion | null> {
  const tarro = await cookies()
  const token = tarro.get(COOKIE_SESION)?.value
  if (!token) return null

  const pg = await db()
  const res = await pg.query(
    `SELECT u.id, u.dni, u.nombre, u.rol, s.expira_en
       FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
      WHERE s.token_sha256 = $1 AND s.expira_en > now()`,
    [hashToken(token)],
  )
  const fila = res.rows[0]
  if (!fila) return null
  return {
    usuario_id: fila.id,
    dni: fila.dni,
    nombre: fila.nombre ?? null,
    rol: fila.rol as Rol,
    expira_en: new Date(fila.expira_en).toISOString(),
  }
}

/** Cierra la sesión actual. No falla si ya no había ninguna. */
export async function cerrarSesion(): Promise<void> {
  const tarro = await cookies()
  const token = tarro.get(COOKIE_SESION)?.value
  if (token) {
    const pg = await db()
    await pg.query('DELETE FROM sesiones WHERE token_sha256 = $1', [hashToken(token)])
  }
  tarro.delete(COOKIE_SESION)
}

/** Borra todas las sesiones de un usuario. Se usa al cambiar o reiniciar la contraseña. */
export async function cerrarTodasLasSesiones(usuarioId: string, salvoToken?: string): Promise<void> {
  const pg = await db()
  if (salvoToken) {
    await pg.query('DELETE FROM sesiones WHERE usuario_id = $1 AND token_sha256 <> $2', [
      usuarioId,
      hashToken(salvoToken),
    ])
  } else {
    await pg.query('DELETE FROM sesiones WHERE usuario_id = $1', [usuarioId])
  }
}

/** Exige sesión con alguno de estos roles. Lanza ErrorAcceso, que errorApi traduce. */
export async function exigirRol(...roles: Rol[]): Promise<Sesion> {
  const sesion = await leerSesion()
  if (!sesion) throw new ErrorAcceso(401, 'Hay que iniciar sesión para ver esto.')
  if (roles.length > 0 && !roles.includes(sesion.rol)) {
    throw new ErrorAcceso(403, 'Tu cuenta no tiene permiso para ver esto.')
  }
  return sesion
}

/**
 * Qué actuaciones puede ver quien está en sesión.
 *
 * `listarCasos` no tiene valor por defecto a propósito: con uno, cualquier llamador nuevo
 * listaría la base entera sin darse cuenta, y en esta base hay datos personales de
 * terceros que ni siquiera son usuarios del sistema.
 */
export type AlcanceCasos =
  | { tipo: 'todos' }
  | { tipo: 'de_productor'; productorId: string }
  | { tipo: 'de_usuario'; usuarioId: string }

export function alcanceDe(sesion: Sesion): AlcanceCasos {
  if (sesion.rol === 'aseguradora') return { tipo: 'todos' }
  if (sesion.rol === 'productor') return { tipo: 'de_productor', productorId: sesion.usuario_id }
  return { tipo: 'de_usuario', usuarioId: sesion.usuario_id }
}
