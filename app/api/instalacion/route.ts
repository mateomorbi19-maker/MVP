import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { crearUsuario, ErrorUsuario, hayAseguradora } from '@/lib/usuarios'
import { anotarEnBitacora } from '@/lib/bitacora'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Crea el primer usuario de la aseguradora.
 *
 * Hace falta porque con output 'standalone' ni scripts/ ni tsx viajan a la imagen de
 * producción: no hay forma de correr un script de instalación contra el servicio
 * desplegado. Sin esto, la primera cuenta habría que crearla entrando a la base a mano.
 *
 * Se auto-deshabilita apenas existe una cuenta de aseguradora, y exige CLAVE_INSTALACION
 * mientras tanto: sin esa variable el endpoint no funciona ni una sola vez.
 */
export async function POST(req: Request) {
  try {
    const esperada = process.env.CLAVE_INSTALACION
    if (!esperada) {
      return NextResponse.json(
        { error: 'Falta la variable CLAVE_INSTALACION. Definila en el servicio y reintentá.' },
        { status: 503 },
      )
    }
    if (await hayAseguradora()) {
      return NextResponse.json(
        { error: 'La instalación ya se hizo: creá las cuentas nuevas desde el panel.' },
        { status: 409 },
      )
    }

    const cuerpo = await req.json().catch(() => ({}))
    if (cuerpo?.clave_instalacion !== esperada) {
      return NextResponse.json({ error: 'La clave de instalación no es correcta.' }, { status: 401 })
    }

    const usuario = await crearUsuario({
      dni: cuerpo?.dni,
      clave: cuerpo?.clave,
      nombre: cuerpo?.nombre,
      email: cuerpo?.email,
      rol: 'aseguradora',
    })
    await anotarEnBitacora('instalacion', {}, { usuarioId: usuario.id })
    return NextResponse.json({ ok: true, id: usuario.id }, { status: 201 })
  } catch (err) {
    if (err instanceof ErrorUsuario) return NextResponse.json({ error: err.message }, { status: 400 })
    return errorApi('instalacion:POST', err, 'No se pudo completar la instalación.')
  }
}
