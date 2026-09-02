import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Marca } from '@/app/components/Marca'
import { leerSesion } from '@/lib/sesion'
import { CerrarSesion, CambiarClave } from './Acciones'

export const dynamic = 'force-dynamic'

/**
 * La cuenta: quién sos y cómo salir.
 *
 * El historial de actuaciones NO está acá: vive en /historial, con el estado del trámite
 * de cada una. Acá quedan los datos y la contraseña.
 */
export default async function Cuenta() {
  const sesion = await leerSesion()
  if (!sesion) redirect('/entrar?volver=/cuenta')

  return (
    <main className="envoltura">
      <Marca sub="Mi cuenta" />

      <div className="tarjeta">
        <h1>{sesion.nombre ?? `DNI ${sesion.dni}`}</h1>
        <p className="apagado">
          DNI {sesion.dni} · {sesion.rol}
        </p>
        <div className="pila">
          <Link className="boton boton-secundario" href="/historial">
            Mis actuaciones
          </Link>
          <Link className="boton boton-secundario" href="/poliza">
            Mi póliza y documentación
          </Link>
          {sesion.rol !== 'asegurado' ? (
            <Link className="boton boton-secundario" href="/panel">
              Panel de siniestros
            </Link>
          ) : null}
        </div>
      </div>

      <CambiarClave />
      <CerrarSesion />

      <p className="mini centrado">
        <Link href="/" className="enlace">Volver al inicio</Link>
      </p>
    </main>
  )
}
