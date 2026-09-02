import { cookies } from 'next/headers'
import { db } from './db'
import { hashToken, nuevoToken } from './claves'
import { ErrorAcceso, leerSesion } from './sesion'

/**
 * Posesión del id de la actuación.
 *
 * Es el nivel de acceso más bajo y el que sostiene la decisión central del producto: el
 * botón "Tuve un accidente" no pide nada, y a partir de ahí la persona trabaja sobre
 * /s/[id] sin cuenta. Lo que se agrega no es una barrera nueva sino la constancia de qué
 * navegador tiene ese id, para poder cerrar lo que hoy está abierto de más.
 *
 * Sin esto, cerrar el panel sería puro teatro: GET /api/media/[id] entrega hoy cualquier
 * fotografía del choque —caras, patentes, a veces heridos— a quien adivine un
 * IMG-XXXXXX, que tiene los mismos ~30 bits que un id de actuación y ni siquiera exige
 * conocer la actuación a la que pertenece.
 *
 * La posesión se otorga siempre de forma ADITIVA y no se niega nunca por tener otra
 * actuación: el mismo teléfono puede abrir dos siniestros, alguien puede ayudar a otra
 * persona desde su propio teléfono, y el README promete poder retomar desde el mismo
 * enlace, que se comparte.
 */

export const COOKIE_POSESION = 'acta_posesion'

const INSEGURA = process.env.COOKIE_INSEGURA === 'true'
const ANIOS = 2

/** Lee el token del navegador, o lo crea. Sólo desde un route handler. */
async function tokenDePosesion(crear: boolean): Promise<string | null> {
  const tarro = await cookies()
  const actual = tarro.get(COOKIE_POSESION)?.value
  if (actual) return actual
  if (!crear) return null

  const token = nuevoToken()
  tarro.set(COOKIE_POSESION, token, {
    httpOnly: true,
    secure: !INSEGURA,
    sameSite: 'lax',
    path: '/',
    expires: new Date(Date.now() + ANIOS * 365 * 24 * 60 * 60 * 1000),
  })
  return token
}

/** Anota que este navegador tiene el id de esta actuación. */
export async function anotarPosesion(casoId: string): Promise<void> {
  const token = await tokenDePosesion(true)
  if (!token) return
  const pg = await db()
  await pg.query(
    `INSERT INTO posesiones (caso_id, token_sha256) VALUES ($1, $2)
     ON CONFLICT (caso_id, token_sha256) DO UPDATE SET ultimo_uso = now()`,
    [casoId, hashToken(token)],
  )
}

/** ¿Este navegador tiene anotada la posesión de esta actuación? */
export async function tienePosesion(casoId: string): Promise<boolean> {
  const token = await tokenDePosesion(false)
  if (!token) return false
  const pg = await db()
  const res = await pg.query('SELECT 1 FROM posesiones WHERE caso_id = $1 AND token_sha256 = $2', [
    casoId,
    hashToken(token),
  ])
  return (res.rowCount ?? 0) > 0
}

/**
 * Exige poder acceder a esta actuación, por posesión o por sesión.
 *
 * Regla de arranque: si la actuación está ABIERTA y todavía nadie anotó posesión sobre
 * ella, se otorga. Es el caso normal —la persona acaba de abrirla— y negarlo dejaría a
 * quien retoma desde el enlace compartido sin poder ver sus propias fotos. Desde que
 * alguien la posee, hay que ser ese alguien, o el titular, o la aseguradora.
 */
export async function exigirAccesoCaso(casoId: string): Promise<void> {
  if (await tienePosesion(casoId)) {
    await anotarPosesion(casoId)
    return
  }

  const pg = await db()
  const res = await pg.query<{ estado: string; usuario_id: string | null; productor_id: string | null; n: string }>(
    `SELECT c.estado, c.usuario_id, c.productor_id,
            (SELECT count(*)::text FROM posesiones p WHERE p.caso_id = c.id) AS n
       FROM casos c WHERE c.id = $1`,
    [casoId],
  )
  const caso = res.rows[0]
  if (!caso) throw new ErrorAcceso(403, 'No existe esa actuación, o no tenés acceso.')

  const sesion = await leerSesion()
  if (sesion) {
    if (sesion.rol === 'aseguradora') return
    if (caso.usuario_id && caso.usuario_id === sesion.usuario_id) return
    if (caso.productor_id && caso.productor_id === sesion.usuario_id) return
  }

  if (caso.estado !== 'cerrado' && Number(caso.n) === 0) {
    await anotarPosesion(casoId)
    return
  }

  throw new ErrorAcceso(
    403,
    'Esta actuación pertenece a otro dispositivo o a otra cuenta. Si es tuya, entrá con tu cuenta o abrila desde el teléfono donde la iniciaste.',
  )
}
