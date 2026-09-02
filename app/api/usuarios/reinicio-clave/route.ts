import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol, cerrarTodasLasSesiones } from '@/lib/sesion'
import { ErrorUsuario, reiniciarClave } from '@/lib/usuarios'
import { anotarEnBitacora } from '@/lib/bitacora'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Reinicio de contraseña por la aseguradora.
 *
 * Es el reemplazo de «olvidé mi contraseña» mientras no haya un canal de entrega propio.
 * Un reinicio automático pedido con sólo el DNI sería una toma de cuenta directa: el DNI
 * es un dato público. Acá hay alguien que confirma quién pide.
 *
 * La clave provisoria se devuelve UNA vez, para dictarla por teléfono, y no queda
 * guardada en ningún lado.
 */
export async function POST(req: Request) {
  try {
    const sesion = await exigirRol('aseguradora')
    const cuerpo = await req.json().catch(() => ({}))
    const usuarioId = typeof cuerpo?.usuario_id === 'string' ? cuerpo.usuario_id : ''
    if (!usuarioId) return NextResponse.json({ error: 'Falta el usuario a reiniciar.' }, { status: 400 })

    const provisoria = await reiniciarClave(usuarioId)
    await cerrarTodasLasSesiones(usuarioId)
    await anotarEnBitacora('reinicio_clave', { por: sesion.usuario_id }, { usuarioId })
    return NextResponse.json({ ok: true, provisoria })
  } catch (err) {
    if (err instanceof ErrorUsuario) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('reinicio:POST', err, 'No se pudo reiniciar la contraseña.')
  }
}
