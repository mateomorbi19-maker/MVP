'use client'

import { useState } from 'react'
import { CroquisVisor } from '@/app/components/CroquisVisor'
import { PIE_CROQUIS, PLANTILLAS, type Croquis } from '@/lib/croquis'

/**
 * El croquis, en su primer paso: elegir una situación típica y mover el punto de impacto.
 *
 * El arrastrar-y-soltar del mockup queda para después, y es una decisión de alcance
 * explícita de la especificación funcional. Lo importante es que el modelo de datos ya es
 * el definitivo: el paso 2 reemplaza sólo el editor y escribe en la misma columna, sin
 * migrar nada.
 */
export function PantallaCroquis({
  casoId,
  inicial,
  masDeDos,
  seguir,
}: {
  casoId: string
  inicial: Croquis | null
  /** Ya resuelto por lib/recorrido.ts: la pantalla no ve el texto de las respuestas. */
  masDeDos: boolean
  seguir: () => void
}) {
  const [croquis, setCroquis] = useState<Croquis | null>(inicial)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    if (!croquis) return seguir()
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch(`/api/casos/${casoId}/croquis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ croquis }),
      })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo guardar el croquis.')
      seguir()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">Cómo ocurrió</div>
        <h1 className="pregunta">Elegí el dibujo que más se parece</h1>
        <p className="pregunta-ayuda">
          Después tocá el plano para marcar dónde fue el choque. Es un esquema, no un plano a escala.
        </p>

        {masDeDos ? (
          <div className="aviso" data-nivel="atencion">
            Declaraste tres vehículos o más. El croquis muestra dos: en el expediente va a quedar aclarado que el
            dibujo no representa a todos los que participaron.
          </div>
        ) : null}

        <div className="opciones">
          {PLANTILLAS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="opcion"
              data-elegida={croquis?.plantilla === p.id}
              onClick={() => setCroquis({ ...p.croquis })}
            >
              <span className="marca-opcion">
                <span className="marca-opcion-punto" />
              </span>
              <span>{p.titulo}</span>
            </button>
          ))}
        </div>

        {croquis ? (
          <div className="croquis-lienzo">
            <CroquisVisor
              croquis={croquis}
              alTocar={(x, y) => setCroquis({ ...croquis, origen: croquis.origen, impacto: { x, y } })}
            />
            <p className="mini">{PIE_CROQUIS}</p>
          </div>
        ) : null}

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando...' : croquis ? 'Guardar el croquis' : 'Seguir'}
        </button>
        <button className="omitir" onClick={seguir}>
          Prefiero no dibujarlo
        </button>
      </div>
    </>
  )
}
