'use client'

import { Icono } from '@/app/components/Iconos'

/* ================= Corte: lo urgente ya está ================= */

export function PantallaCorte({
  casoId,
  seguir,
  alCierre,
}: {
  casoId: string
  seguir: () => void
  alCierre: () => void
}) {
  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="hito">
          <div className="hito-simbolo">
            <Icono nombre="tilde" />
          </div>
          <h1 className="pregunta hito-titulo">
            Ya tenés lo importante
          </h1>
          <p className="pregunta-ayuda">
            Todo lo que sólo existía en el lugar quedó registrado, con su hora y su ubicación. Lo que falta son datos
            tuyos —la póliza, la licencia, la VTV— que podés completar cuando quieras.
          </p>
        </div>

        <div className="tarjeta tarjeta-actuacion centrado">
          <h3 className="tarjeta-actuacion-titulo">Número de actuación</h3>
          <p className="numero-actuacion tarjeta-actuacion-numero">
            {casoId}
          </p>
          <p className="mini tarjeta-actuacion-nota">
            Podés cerrar la aplicación e irte. Al volver a abrirla, retomás justo acá.
          </p>
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={seguir}>
          Completar el resto ahora
        </button>
        <button className="boton-secundario boton-ancho" onClick={alCierre}>
          Ir directo al cierre
        </button>
      </div>
    </>
  )
}
