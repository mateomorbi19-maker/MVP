'use client'

import { useEffect, useState } from 'react'

/**
 * El QR para que el otro conductor cargue sus datos desde su propio teléfono.
 *
 * Va antes de las fotos porque dos de las tomas son su licencia y su cédula, y la lectura
 * automática se dispara al subirlas: leer el documento de identidad de alguien que todavía
 * no consintió nada es tratar el dato de un titular que no es el asegurado.
 *
 * Se puede saltear siempre. Si el tercero no quiere, eso es un derecho suyo y no una
 * anomalía del expediente: las fotos se sacan igual, sólo que no se leen solas.
 */
export function PantallaConsentimiento({
  casoId,
  yaCargado,
  seguir,
}: {
  casoId: string
  yaCargado: boolean
  seguir: () => void
}) {
  const [svg, setSvg] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/casos/${casoId}/qr?destino=tercero`)
      .then((r) => (r.ok ? r.text() : null))
      .then(setSvg)
      .catch(() => setSvg(null))
  }, [casoId])

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">El otro conductor</div>
        <h1 className="pregunta">Pedile que cargue sus datos</h1>
        <p className="pregunta-ayuda">
          Que escanee este código con su teléfono. Carga su nombre, su patente y su seguro, y presta el consentimiento
          para que entren al expediente. Le lleva menos de un minuto.
        </p>

        {yaCargado ? (
          <div className="aviso" data-nivel="ok">
            El otro conductor ya cargó sus datos.
          </div>
        ) : null}

        <div className="tarjeta tarjeta-qr centrado">
          {svg ? (
            <div className="qr qr-imagen" dangerouslySetInnerHTML={{ __html: svg }} />
          ) : (
            <div className="qr-esperando">Generando el código...</div>
          )}
        </div>

        <div className="aviso" data-nivel="info">
          Si no quiere o no puede, seguí igual. Las fotos de sus documentos se sacan lo mismo: lo único que cambia es
          que el sistema no las va a leer solo.
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={seguir}>
          Seguir
        </button>
        <button className="omitir" onClick={seguir}>
          No quiso, o no está
        </button>
      </div>
    </>
  )
}
