import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { obtenerUsuario } from '@/lib/usuarios'
import { listarPolizas } from '@/lib/polizas'
import { actualizarTitular, guardarContacto, obtenerContacto } from '@/lib/perfil'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Titular, póliza principal y contacto de confianza en una sola lectura. */
export async function GET() {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const [usuario, polizas, contacto] = await Promise.all([
      obtenerUsuario(sesion.usuario_id),
      listarPolizas(sesion.usuario_id),
      obtenerContacto(sesion.usuario_id),
    ])
    return NextResponse.json({
      usuario,
      poliza_principal: polizas.find((p) => p.principal) ?? polizas[0] ?? null,
      contacto,
    })
  } catch (err) {
    return errorApi('perfil:GET', err, 'No se pudo leer el perfil.')
  }
}

export async function PATCH(req: Request) {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const cuerpo = await req.json().catch(() => ({}))
    if (cuerpo?.titular) await actualizarTitular(sesion.usuario_id, cuerpo.titular)
    if (cuerpo?.contacto !== undefined) await guardarContacto(sesion.usuario_id, cuerpo.contacto ?? {})
    return NextResponse.json({ ok: true })
  } catch (err) {
    return errorApi('perfil:PATCH', err, 'No se pudo guardar el perfil.')
  }
}
