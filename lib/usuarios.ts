import { db, nuevoId } from './db'
import { CLAVE_INEXISTENTE, hashearClave, normalizarDni, validarClave, verificarClave } from './claves'
import type { Rol } from './sesion'

/**
 * Altas y verificación de cuentas.
 *
 * El nombre de usuario es el DNI, que es un dato público: cualquiera puede intentar
 * entrar con el DNI de otro. De ahí las dos defensas de este archivo —el bloqueo por
 * intentos y la verificación contra una clave inexistente— y de ahí también que la
 * recuperación de contraseña NO exista todavía: sin un canal de entrega, un reinicio
 * pedido con sólo el DNI es una toma de cuenta directa. Mientras tanto la reinicia la
 * aseguradora, que sí puede confirmar quién pide.
 */

const INTENTOS_MAXIMOS = 5
const MINUTOS_BLOQUEO = 15

export interface Usuario {
  id: string
  dni: string
  nombre: string | null
  telefono: string | null
  email: string | null
  rol: Rol
  creado_en: string
  ultimo_acceso: string | null
}

export class ErrorUsuario extends Error {}

const texto = (v: unknown, largo: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, largo)
  return s.length ? s : null
}

function mapear(f: Record<string, unknown>): Usuario {
  return {
    id: f.id as string,
    dni: f.dni as string,
    nombre: (f.nombre as string) ?? null,
    telefono: (f.telefono as string) ?? null,
    email: (f.email as string) ?? null,
    rol: f.rol as Rol,
    creado_en: new Date(f.creado_en as string).toISOString(),
    ultimo_acceso: f.ultimo_acceso ? new Date(f.ultimo_acceso as string).toISOString() : null,
  }
}

export async function crearUsuario(entrada: {
  dni: unknown
  clave: unknown
  nombre?: unknown
  telefono?: unknown
  email?: unknown
  rol?: Rol
}): Promise<Usuario> {
  const dni = normalizarDni(entrada.dni)
  if (!dni) throw new ErrorUsuario('El DNI tiene que tener entre 7 y 9 dígitos.')

  const problema = validarClave(entrada.clave, dni)
  if (problema) throw new ErrorUsuario(problema)

  const hash = await hashearClave(entrada.clave as string)
  const pg = await db()
  try {
    const res = await pg.query(
      `INSERT INTO usuarios (id, dni, clave_hash, nombre, telefono, email, rol)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        nuevoId('USR'),
        dni,
        hash,
        texto(entrada.nombre, 120),
        texto(entrada.telefono, 40),
        texto(entrada.email, 200),
        entrada.rol ?? 'asegurado',
      ],
    )
    return mapear(res.rows[0])
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      throw new ErrorUsuario('Ya hay una cuenta con ese DNI. Si es tuya, entrá; si no, avisale a tu aseguradora.')
    }
    throw err
  }
}

/**
 * Verifica DNI y contraseña.
 *
 * Cuando el DNI no existe se verifica igual, contra una clave que nadie tiene, para que
 * la respuesta tarde lo mismo. Sin eso, el tiempo dice qué DNI está registrado.
 */
export async function verificarIngreso(
  dniCrudo: unknown,
  clave: unknown,
): Promise<{ ok: true; usuario: Usuario } | { ok: false; motivo: string }> {
  const dni = normalizarDni(dniCrudo)
  if (!dni || typeof clave !== 'string') {
    await verificarClave('irrelevante', CLAVE_INEXISTENTE)
    return { ok: false, motivo: 'Revisá el DNI y la contraseña.' }
  }

  const pg = await db()
  const res = await pg.query('SELECT * FROM usuarios WHERE dni = $1', [dni])
  const fila = res.rows[0]

  if (fila?.bloqueado_hasta && new Date(fila.bloqueado_hasta) > new Date()) {
    return {
      ok: false,
      motivo: `Demasiados intentos fallidos. Probá de nuevo en ${MINUTOS_BLOQUEO} minutos, o pedile a tu aseguradora que te reinicie la contraseña.`,
    }
  }

  const coincide = await verificarClave(clave, fila?.clave_hash ?? CLAVE_INEXISTENTE)
  if (!fila || !coincide) {
    if (fila) {
      const intentos = (fila.intentos as number) + 1
      const bloquear = intentos >= INTENTOS_MAXIMOS
      await pg.query(
        `UPDATE usuarios SET intentos = $2, bloqueado_hasta = $3 WHERE id = $1`,
        [
          fila.id,
          bloquear ? 0 : intentos,
          bloquear ? new Date(Date.now() + MINUTOS_BLOQUEO * 60_000).toISOString() : null,
        ],
      )
    }
    return { ok: false, motivo: 'Revisá el DNI y la contraseña.' }
  }

  await pg.query('UPDATE usuarios SET intentos = 0, bloqueado_hasta = NULL, ultimo_acceso = now() WHERE id = $1', [
    fila.id,
  ])
  return { ok: true, usuario: mapear(fila) }
}

export async function obtenerUsuario(id: string): Promise<Usuario | null> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM usuarios WHERE id = $1', [id])
  return res.rows[0] ? mapear(res.rows[0]) : null
}

export async function listarEquipo(): Promise<Usuario[]> {
  const pg = await db()
  const res = await pg.query("SELECT * FROM usuarios WHERE rol <> 'asegurado' ORDER BY creado_en ASC")
  return res.rows.map(mapear)
}

/** Cambia la contraseña propia. Exige la actual: una sesión robada no alcanza. */
export async function cambiarClave(usuarioId: string, actual: unknown, nueva: unknown): Promise<void> {
  const pg = await db()
  const res = await pg.query('SELECT dni, clave_hash FROM usuarios WHERE id = $1', [usuarioId])
  const fila = res.rows[0]
  if (!fila) throw new ErrorUsuario('No existe la cuenta.')

  if (typeof actual !== 'string' || !(await verificarClave(actual, fila.clave_hash))) {
    throw new ErrorUsuario('La contraseña actual no es correcta.')
  }
  const problema = validarClave(nueva, fila.dni)
  if (problema) throw new ErrorUsuario(problema)

  await pg.query('UPDATE usuarios SET clave_hash = $2 WHERE id = $1', [usuarioId, await hashearClave(nueva as string)])
}

/** Reinicio por la aseguradora. Devuelve la clave provisoria, que se dicta una sola vez. */
export async function reiniciarClave(usuarioId: string): Promise<string> {
  const pg = await db()
  const res = await pg.query('SELECT dni FROM usuarios WHERE id = $1', [usuarioId])
  if (!res.rows[0]) throw new ErrorUsuario('No existe la cuenta.')

  // Legible por teléfono: sin caracteres que se confundan al dictar.
  const alfabeto = 'abcdefghjkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  const provisoria = 'ac-' + [...bytes].map((b) => alfabeto[b % alfabeto.length]).join('')

  await pg.query('UPDATE usuarios SET clave_hash = $2, intentos = 0, bloqueado_hasta = NULL WHERE id = $1', [
    usuarioId,
    await hashearClave(provisoria),
  ])
  return provisoria
}

/** ¿Ya existe alguien de la aseguradora? Es lo que cierra el alta de instalación. */
export async function hayAseguradora(): Promise<boolean> {
  const pg = await db()
  const res = await pg.query("SELECT 1 FROM usuarios WHERE rol = 'aseguradora' LIMIT 1")
  return (res.rowCount ?? 0) > 0
}
