import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { crearSesion, cerrarSesion, leerSesion } from '@/lib/sesion'
import { verificarIngreso } from '@/lib/usuarios'
import { anotarEnBitacora } from '@/lib/bitacora'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Ingreso con DNI y contraseña. */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const resultado = await verificarIngreso(cuerpo?.dni, cuerpo?.clave)
    if (!resultado.ok) {
      // 401 y no 400: es una credencial rechazada, no un pedido mal armado.
      return NextResponse.json({ error: resultado.motivo }, { status: 401 })
    }
    await crearSesion(resultado.usuario.id, req.headers.get('user-agent'))
    await anotarEnBitacora('ingreso', { rol: resultado.usuario.rol }, { usuarioId: resultado.usuario.id })
    return NextResponse.json({
      ok: true,
      usuario: { id: resultado.usuario.id, nombre: resultado.usuario.nombre, rol: resultado.usuario.rol },
    })
  } catch (err) {
    return errorApi('sesion:POST', err, 'No se pudo iniciar sesión.')
  }
}

/** Cierre de sesión. No falla si ya no había ninguna. */
export async function DELETE() {
  try {
    await cerrarSesion()
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorApi('sesion:DELETE', err, 'No se pudo cerrar la sesión.')
  }
}

/**
 * Quién soy.
 *
 * Público a propósito: devuelve null cuando no hay sesión. Lo consumen componentes de
 * cliente que no pueden leer la cookie, y el inicio, que tiene que pintar el botón grande
 * antes de saber si hay alguien identificado.
 */
export async function GET() {
  try {
    return NextResponse.json({ sesion: await leerSesion() })
  } catch (err) {
    return errorApi('sesion:GET', err, 'No se pudo leer la sesión.')
  }
}
