'use client'

import { Icono } from '@/app/components/Iconos'

/* ================= Resumen: qué se pide antes de poder irse ================= */

/*
 * Se muestra antes de la primera foto para que la persona sepa que son tres tandas y
 * nada más. Sin esto, alguien nervioso al costado de la ruta no sabe cuánto le falta y
 * abandona en la segunda toma.
 */
const ESENCIALES = [
  { titulo: 'Fotos de mi vehículo', detalle: 'Tu auto, daños y patente', icono: 'auto' },
  { titulo: 'Fotos del vehículo del tercero', detalle: 'El otro auto y su patente', icono: 'auto' },
  { titulo: 'Fotos de documentación propia y del tercero', detalle: 'Licencia, cédula y seguro', icono: 'archivo' },
] as const

export function PantallaResumen({ seguir }: { seguir: () => void }) {
  return (
    <>
      <div className="pantalla-cuerpo">
        <h1 className="pregunta">Documentá el siniestro</h1>
        <p className="pregunta-ayuda">Seguí el orden. Te guiaremos paso a paso.</p>

        <div className="aviso" data-nivel="info">
          Esto es lo más importante. Luego te pediremos el relato del siniestro. Con esto ya podés retirarte del lugar.
        </div>

        <div className="lista-esenciales">
          {ESENCIALES.map((e) => (
            <div className="acceso" key={e.titulo}>
              <span className="acceso-icono acceso-icono-redondo">
                <Icono nombre={e.icono} />
              </span>
              <span className="acceso-texto">
                <span className="acceso-titulo">{e.titulo}</span>
                <span className="acceso-detalle">{e.detalle}</span>
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={seguir}>
          Continuar
        </button>
        <p className="nota-pie">Podés volver a cada paso después.</p>
      </div>
    </>
  )
}
