import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { crearUsuario, ErrorUsuario, listarEquipo } from '@/lib/usuarios'
import { anotarEnBitacora } from '@/lib/bitacora'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Alta de productor o de gente de la aseguradora. Separado del registro público. */
export async function POST(req: Request) {
  try {
    const sesion = await exigirRol('aseguradora')
    const cuerpo = await req.json().catch(() => ({}))
    const rol = cuerpo?.rol === 'aseguradora' ? 'aseguradora' : 'productor'
    const usuario = await crearUsuario({
      dni: cuerpo?.dni,
      clave: cuerpo?.clave,
      nombre: cuerpo?.nombre,
      telefono: cuerpo?.telefono,
      email: cuerpo?.email,
      rol,
    })
    await anotarEnBitacora('alta_usuario', { rol, por: sesion.usuario_id }, { usuarioId: usuario.id })
    return NextResponse.json({ ok: true, usuario }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorUsuario) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('equipo:POST', err, 'No se pudo dar de alta la cuenta.')
  }
}

/** El equipo, para administrarlo. Nunca devuelve el hash de la contraseña. */
export async function GET() {
  try {
    await exigirRol('aseguradora')
    return NextResponse.json(await listarEquipo())
  } catch (err) {
    return errorApi('equipo:GET', err, 'No se pudo leer el equipo.')
  }
}
