import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { crearUsuario, ErrorUsuario } from '@/lib/usuarios'
import { anotarEnBitacora } from '@/lib/bitacora'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Registro de asegurado.
 *
 * Crea siempre rol 'asegurado' y descarta cualquier campo de rol que venga en el cuerpo:
 * el alta de productores y de gente de la aseguradora tiene su propio endpoint, con
 * sesión, justamente para que no haya un solo camino donde un rol mal validado escale.
 *
 * No inicia sesión sola: la persona entra después, y así el ingreso es un solo camino.
 */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const usuario = await crearUsuario({
      dni: cuerpo?.dni,
      clave: cuerpo?.clave,
      nombre: cuerpo?.nombre,
      telefono: cuerpo?.telefono,
      email: cuerpo?.email,
      rol: 'asegurado',
    })
    await anotarEnBitacora('alta_usuario', { rol: 'asegurado' }, { usuarioId: usuario.id })
    return NextResponse.json({ ok: true, id: usuario.id }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorUsuario) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('usuarios:POST', err, 'No se pudo crear la cuenta.')
  }
}
