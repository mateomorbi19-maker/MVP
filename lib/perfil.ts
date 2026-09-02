import { db, nuevoId } from './db'

/**
 * El contacto de confianza.
 *
 * Es un dato personal de alguien que NO está presente para consentir su tratamiento
 * (Ley 25.326): se guarda el mínimo indispensable, se usa sólo para el escalamiento por
 * impacto, y no entra al expediente ni al PDF. La pantalla que lo carga tiene que decirle
 * a la persona que le avise a ese contacto.
 *
 * Y tiene que decir la verdad sobre qué hace el sistema: una aplicación web no puede
 * llamar ni mandar un SMS por su cuenta. Lo que puede es abrir el marcador con el número
 * puesto para que la persona toque una vez. Un aviso automático de verdad necesita un
 * proveedor de SMS, y no está en esta versión.
 */

export interface ContactoConfianza {
  nombre: string
  telefono: string
  relacion: string | null
}

export async function obtenerContacto(usuarioId: string): Promise<ContactoConfianza | null> {
  const pg = await db()
  const res = await pg.query('SELECT nombre, telefono, relacion FROM contactos_confianza WHERE usuario_id = $1', [
    usuarioId,
  ])
  const f = res.rows[0]
  return f ? { nombre: f.nombre, telefono: f.telefono, relacion: f.relacion ?? null } : null
}

/** Guarda o reemplaza el contacto. Con nombre o teléfono vacíos, lo borra. */
export async function guardarContacto(usuarioId: string, entrada: Record<string, unknown>): Promise<void> {
  const limpio = (v: unknown, largo: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, largo) : null
  const nombre = limpio(entrada.nombre, 120)
  const telefono = limpio(entrada.telefono, 40)

  const pg = await db()
  if (!nombre || !telefono) {
    await pg.query('DELETE FROM contactos_confianza WHERE usuario_id = $1', [usuarioId])
    return
  }
  await pg.query(
    `INSERT INTO contactos_confianza (id, usuario_id, nombre, telefono, relacion)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (usuario_id) DO UPDATE
       SET nombre = EXCLUDED.nombre, telefono = EXCLUDED.telefono,
           relacion = EXCLUDED.relacion, actualizado_en = now()`,
    [nuevoId('CTC'), usuarioId, nombre, telefono, limpio(entrada.relacion, 60)],
  )
}

/** Datos del titular que la persona puede editar. */
export async function actualizarTitular(usuarioId: string, entrada: Record<string, unknown>): Promise<void> {
  const limpio = (v: unknown, largo: number) =>
    typeof v === 'string' && v.trim() ? v.trim().slice(0, largo) : null
  const pg = await db()
  await pg.query(
    `UPDATE usuarios SET nombre = COALESCE($2, nombre), telefono = COALESCE($3, telefono),
                         email = COALESCE($4, email) WHERE id = $1`,
    [usuarioId, limpio(entrada.nombre, 120), limpio(entrada.telefono, 40), limpio(entrada.email, 200)],
  )
}
