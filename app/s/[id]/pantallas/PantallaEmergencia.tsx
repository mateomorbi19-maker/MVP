'use client'

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
          <p style={{ marginBottom: 18 }}>
            {dudoso
              ? 'Ante la duda, llamá. Una ambulancia que llega de más no cuesta nada; una que no llega, sí.'
              : 'Primero la gente. El registro queda guardado y podés volver cuando la situación esté controlada.'}
          </p>
          <div className="pila">
            <a href="tel:107" className="boton boton-llamada">
              107
              <span>Emergencias médicas</span>
            </a>
            <a href="tel:911" className="boton boton-llamada">
              911
              <span>Policía</span>
            </a>
          </div>
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-secundario" onClick={seguir} style={{ width: '100%' }}>
          Ya están siendo asistidos, seguir
        </button>
      </div>
    </>
  )
}
