'use client'


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
          <div className="hito-simbolo">✓</div>
          <h1 className="pregunta" style={{ marginBottom: 10 }}>
            Ya tenés lo importante
          </h1>
          <p className="pregunta-ayuda">
            Todo lo que sólo existía en el lugar quedó registrado, con su hora y su ubicación. Lo que falta son datos
            tuyos —la póliza, la licencia, la VTV— que podés completar cuando quieras.
          </p>
        </div>

        <div className="tarjeta centrado">
          <h3 style={{ marginBottom: 4 }}>Número de actuación</h3>
          <p className="numero-actuacion" style={{ margin: '4px 0 10px' }}>
            {casoId}
          </p>
          <p className="mini" style={{ margin: 0 }}>
            Podés cerrar la aplicación e irte. Al volver a abrirla, retomás justo acá.
          </p>
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={seguir}>
          Completar el resto ahora
        </button>
        <button className="boton-secundario" onClick={alCierre} style={{ width: '100%' }}>
          Ir directo al cierre
        </button>
      </div>
    </>
  )
}
