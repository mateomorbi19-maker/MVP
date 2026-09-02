import Link from 'next/link'
import { Marca } from './components/Marca'
import { Icono } from './components/Iconos'

/**
 * Cualquier dirección que no existe.
 *
 * Sin este archivo, Next sirve su pantalla incorporada: «404 — This page could not be
 * found.», en inglés, con fondo blanco fijo que ignora el tema oscuro, sin la marca y sin
 * un solo enlace. La alcanzan `/panel/[id]` y `/s/[id]` cuando el número no existe, y
 * cualquier dirección mal tipeada. `/v/[id]` tiene la suya, con el texto del número de
 * actuación, porque a esa llega alguien con el acta impresa en la mano.
 */
export default function NoEncontrado() {
  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">No encontramos esa página</h1>
        <p className="bajada-pagina">
          La dirección no existe, o la actuación que buscabas no está en este sistema.
        </p>
      </header>

      <div className="vacio">
        <span className="vacio-icono">
          <Icono nombre="archivo" />
        </span>
        <h2 className="vacio-titulo">Desde acá podés seguir</h2>
        <p className="vacio-texto">
          Si estabas registrando un siniestro y perdiste el enlace, la actuación sigue guardada: se retoma desde el
          mismo teléfono con el que la abriste.
        </p>
        <Link className="boton boton-primario" href="/">
          Ir al inicio
        </Link>
        <Link className="enlace" href="/verificar">
          Verificar un expediente
        </Link>
      </div>
    </main>
  )
}
