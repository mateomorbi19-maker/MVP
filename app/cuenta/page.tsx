import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'
import { leerSesion } from '@/lib/sesion'
import { CerrarSesion, CambiarClave } from './Acciones'

export const dynamic = 'force-dynamic'

/**
 * La cuenta: quién sos y cómo salir.
 *
 * El historial de actuaciones NO está acá: vive en /historial, con el estado del trámite
 * de cada una. Acá quedan los datos y la contraseña.
 */
/**
 * Los accesos de la cuenta.
 *
 * Van como tarjetas con detalle y no como botones apilados: «Mis datos y contacto de
 * confianza» dentro de un botón no dice qué es un contacto de confianza, y esa es
 * justamente la sección que nadie completa por no saber para qué sirve.
 */
const SECCIONES = [
  {
    href: '/historial',
    icono: 'archivo',
    titulo: 'Mis actuaciones',
    detalle: 'Los siniestros que registraste y en qué estado está cada trámite.',
    soloEquipo: false,
  },
  {
    href: '/poliza',
    icono: 'escudo',
    titulo: 'Mi póliza y documentación',
    detalle: 'Tu cobertura, la cédula, la licencia y el productor asignado.',
    soloEquipo: false,
  },
  {
    href: '/perfil',
    icono: 'personas',
    titulo: 'Mis datos y contacto de confianza',
    detalle: 'A quién avisar si el teléfono detecta un impacto y no respondés.',
    soloEquipo: false,
  },
  {
    href: '/panel',
    icono: 'verificar',
    titulo: 'Panel de siniestros',
    detalle: 'Las actuaciones que te llegaron para gestionar.',
    soloEquipo: true,
  },
] as const

export default async function Cuenta() {
  const sesion = await leerSesion()
  if (!sesion) redirect('/entrar?volver=/cuenta')

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">{sesion.nombre ?? `DNI ${sesion.dni}`}</h1>
        <p className="bajada-pagina">
          DNI {sesion.dni} · {sesion.rol}
        </p>
      </header>

      {SECCIONES.filter((s) => !s.soloEquipo || sesion.rol !== 'asegurado').map((s) => (
        <Link className="acceso" href={s.href} key={s.href}>
          <span className="acceso-icono">
            <Icono nombre={s.icono} />
          </span>
          <span className="acceso-texto">
            <span className="acceso-titulo">{s.titulo}</span>
            <span className="acceso-detalle">{s.detalle}</span>
          </span>
          <span className="acceso-flecha" aria-hidden="true">
            →
          </span>
        </Link>
      ))}

      <div className="separacion-bloque" />

      {/* Sin .pila los dos son inline-flex sueltos: a 375px envuelven pegados y a 393px
          entran en la misma linea, sin un pixel entre uno y otro. */}
      <div className="pila">
        <CambiarClave />
        <CerrarSesion />
      </div>

      <p className="centrado">
        <Link href="/" className="boton boton-fantasma">
          Volver al inicio
        </Link>
      </p>
    </main>
  )
}
