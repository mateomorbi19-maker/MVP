'use client'

import { BotonesEmergencia } from '@/app/components/BotonesEmergencia'

import { type Paso } from '@/lib/recorrido'

/* ================= Emergencia ================= */

/**
 * No recibe `respuestas` a propósito: ver el comentario de `Paso` en lib/recorrido.ts.
 * La variante se decide con los valores del cuestionario, fuera de esta pantalla.
 */
export function PantallaEmergencia({ variante, seguir }: { variante: 'confirmado' | 'dudoso'; seguir: () => void }) {
  const dudoso = variante === 'dudoso'

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="emergencia">
          <h1>{dudoso ? 'Fijate si alguien está herido' : 'Llamá ahora'}</h1>
          <p className="emergencia-descripcion">
            {dudoso
              ? 'Ante la duda, llamá. Una ambulancia que llega de más no cuesta nada; una que no llega, sí.'
              : 'Primero la gente. El registro queda guardado y podés volver cuando la situación esté controlada.'}
          </p>
          <BotonesEmergencia soloLugar />
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-secundario boton-ancho" onClick={seguir}>
          Ya están siendo asistidos, seguir
        </button>
      </div>
    </>
  )
}
