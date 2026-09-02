import Link from 'next/link'
import { Icono } from './Iconos'

/**
 * El estado «esto necesita una cuenta».
 *
 * No es un error y por eso no va en rojo. Antes las tres pantallas con sesión resolvían el
 * 401 de tres maneras distintas y ninguna servía: /poliza y /historial lo mostraban como
 * una alerta —el mismo tratamiento visual que «no se pudo contactar al servidor»— y sin un
 * enlace a /entrar, así que la persona leía que tenía que iniciar sesión y no tenía dónde;
 * y /perfil ni siquiera miraba el estado de la respuesta, así que dibujaba el formulario
 * vacío como si funcionara y recién fallaba al guardar.
 *
 * `volver` vuelve a esta misma pantalla después de entrar: mandar a todo el mundo a
 * /cuenta obliga a rehacer el camino.
 */
export function SinSesion({ volver, que }: { volver: string; que: string }) {
  return (
    <div className="vacio">
      <span className="vacio-icono">
        <Icono nombre="escudo" />
      </span>
      <h2 className="vacio-titulo">Entrá para ver {que}</h2>
      <p className="vacio-texto">
        Esta parte necesita una cuenta. Registrar un siniestro no: ese botón nunca te va a pedir nada.
      </p>
      <Link href={`/entrar?volver=${encodeURIComponent(volver)}`} className="boton boton-primario">
        Iniciar sesión
      </Link>
      <Link href="/registro" className="enlace">
        Crear una cuenta
      </Link>
    </div>
  )
}
