'use client'

import { Icono } from '@/app/components/Iconos'

/* ================= Corte: lo urgente ya está ================= */

export function PantallaCorte({
  casoId,
  seguir,
  alGuardar,
}: {
  casoId: string
  seguir: () => void
  alGuardar: () => void
}) {
  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="hito-corte">
          <div className="hito-simbolo">
            <Icono nombre="tilde" />
          </div>
          <h1 className="pregunta hito-titulo">¡Ya tenemos lo más importante!</h1>
          <p className="pregunta-ayuda">
            Podés retirarte del lugar con tranquilidad y brindarnos el relato del siniestro más tarde.
          </p>
        </div>

        <div className="lista-esenciales">
          <button className="acceso acceso-boton" onClick={alGuardar}>
            <span className="acceso-icono acceso-icono-redondo">
              <Icono nombre="reloj" />
            </span>
            <span className="acceso-texto">
              <span className="acceso-titulo">Guardar y relatar el siniestro luego</span>
              <span className="acceso-detalle">Tu progreso queda guardado. Al volver a abrir la app, seguís desde acá.</span>
            </span>
          </button>
          <button className="acceso acceso-boton" onClick={seguir}>
            <span className="acceso-icono acceso-icono-redondo">
              <Icono nombre="lapiz" />
            </span>
            <span className="acceso-texto">
              <span className="acceso-titulo">Seguir con el relato de los hechos</span>
              <span className="acceso-detalle">Continuar ahora, solo te toma 2 minutos.</span>
            </span>
          </button>
        </div>

        {/* El número es cómo se vuelve a encontrar la actuación: no se saca aunque sea chico. */}
        <p className="nota-pie">
          Número de actuación <span className="numero-actuacion">{casoId}</span>
        </p>
      </div>

      <div className="barra-accion">
        <p className="nota-pie">Podés retirarte del lugar de forma segura.</p>
      </div>
    </>
  )
}
