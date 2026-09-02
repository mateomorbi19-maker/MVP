import { NextResponse } from 'next/server'
import { ErrorBaseDeDatos, traducirErrorBase } from './db'
import { ErrorActuacionCerrada } from './hash'
import { ErrorAcceso } from './sesion'

/**
 * Respuesta de error uniforme.
 *
 * Los problemas de configuración se devuelven con su mensaje real: sin eso, un
 * DATABASE_URL mal puesto se ve igual que un bug, y no hay forma de saber qué arreglar.
 * Los errores inesperados sí quedan genéricos hacia afuera y con detalle en el log.
 */
export function errorApi(contexto: string, err: unknown, mensajeGenerico: string): NextResponse {
  /*
   * Cada handler comprueba el estado antes de escribir, pero entre esa lectura y la
   * escritura entra el cierre. registrarEvento lo detecta con el caso bloqueado, y eso
   * llega hasta acá: sin esta rama, una carrera perfectamente normal se le muestra al
   * cliente como un error interno y la aplicación reintenta para siempre.
   */
  /*
   * Falta de sesión o de permiso. Va antes que nada: un 401 no es un error del servidor,
   * y devolverlo como 500 hace que el cliente reintente para siempre.
   */
  if (err instanceof ErrorAcceso) {
    return NextResponse.json({ error: err.message, tipo: 'acceso' }, { status: err.estado })
  }

  if (err instanceof ErrorActuacionCerrada) {
    return NextResponse.json({ error: err.message, tipo: 'cerrada' }, { status: 409 })
  }

  const base = err instanceof ErrorBaseDeDatos ? err : traducirErrorBase(err)

  if (base) {
    console.error(`[${contexto}] base de datos (${base.causa}):`, base.message)
    return NextResponse.json(
      {
        error: base.message,
        tipo: 'configuracion',
        causa: base.causa,
        ayuda: 'Revisá el estado del sistema en /api/salud',
      },
      { status: 503 },
    )
  }

  console.error(`[${contexto}]`, err)
  return NextResponse.json({ error: mensajeGenerico, tipo: 'interno' }, { status: 500 })
}
