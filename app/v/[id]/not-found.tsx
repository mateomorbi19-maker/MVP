import Link from 'next/link'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'

/**
 * Un número de actuación que no existe.
 *
 * Sin este archivo el caso cae en la pantalla incorporada de Next: «404 — This page could
 * not be found.», en inglés, con fondo blanco fijo, sin la marca, sin respetar el tema
 * oscuro y sin una sola salida. La ve alguien con el acta impresa en la mano —un
 * liquidador, un perito, alguien que escaneó mal el QR— y es la única pantalla del
 * recorrido de verificación que no le dice qué hacer.
 *
 * No puede mostrar el número que falló: un not-found.tsx no recibe props ni params.
 */
export default function ActuacionInexistente() {
  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">No encontramos esa actuación</h1>
        <p className="bajada-pagina">
          El número que abriste no corresponde a ningún expediente de este sistema.
        </p>
      </header>

      <div className="vacio">
        <span className="vacio-icono">
          <Icono nombre="verificar" />
        </span>
        <h2 className="vacio-titulo">Revisá el número</h2>
        <p className="vacio-texto">
          Son tres letras, un guion y seis caracteres, como ADS-7K2M4Q. No usa el cero ni la O, ni el uno ni la I,
          justamente para que no se confundan: si leíste alguno de ésos en el papel, es otro carácter. Si el número
          está bien, pedile el expediente a quien te lo mandó.
        </p>
        <Link className="boton boton-primario" href="/verificar">
          Escribir el número a mano
        </Link>
      </div>
    </main>
  )
}
