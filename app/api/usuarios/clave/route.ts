import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol, cerrarTodasLasSesiones } from '@/lib/sesion'
import { cambiarClave, ErrorUsuario } from '@/lib/usuarios'
import { anotarEnBitacora } from '@/lib/bitacora'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Cambio de la propia contraseña.
 *
 * Exige la actual: una sesión robada no alcanza para quedarse con la cuenta. Al cambiarla
 * se cierran todas las demás sesiones, que es lo que la persona espera cuando la cambia
 * porque sospecha que alguien entró.
 */
export async function PATCH(req: Request) {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const cuerpo = await req.json().catch(() => ({}))
    await cambiarClave(sesion.usuario_id, cuerpo?.actual, cuerpo?.nueva)
    await cerrarTodasLasSesiones(sesion.usuario_id)
    await anotarEnBitacora('cambio_clave', {}, { usuarioId: sesion.usuario_id })
    return NextResponse.json({ ok: true, sesionesCerradas: true })
  } catch (err) {
    if (err instanceof ErrorUsuario) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('clave:PATCH', err, 'No se pudo cambiar la contraseña.')
  }
}
