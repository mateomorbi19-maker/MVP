'use client'

import { useEffect, useRef, useState } from 'react'
import { LienzoFirma, pngDelLienzo } from '@/app/components/LienzoFirma'

type Acta = {
  hash: string
  declaracion: string
  resumen: { fotos: number; audios: number; testigos: number; conCroquis: boolean; respuestas: number }
  firmada: boolean
}

/**
 * La firma del asegurado.
 *
 * Etapa propia, entre la revisión y el cierre, y no dentro de la revisión: esa pantalla ya
 * es la más cargada del recorrido —el listado de lo que se sella, los faltantes, el aviso
 * de ubicación y el botón de cerrar— y meter el lienzo ahí empuja a firmar sin leer.
 * Firmar tiene que ser un acto separado.
 *
 * «Cerrar sin firmar» NUNCA desaparece. La firma no es obligatoria y el expediente vale
 * igual: lo que cambia es qué presunciones tiene. Y no genera un hallazgo de «a revisar»
 * en el informe, porque reprocharle a alguien haber usado una salida que el propio
 * producto le ofrece convierte el motor de contradicciones en un calificador de conducta.
 */
export function PantallaFirma({
  casoId,
  nombreSugerido,
  seguir,
}: {
  casoId: string
  nombreSugerido: string
  seguir: () => void
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const [acta, setActa] = useState<Acta | null>(null)
  const [firmante, setFirmante] = useState(nombreSugerido)
  const [hayTrazo, setHayTrazo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pedirActa = () =>
    fetch(`/api/casos/${casoId}/acta`)
      .then(async (r) => {
        const c = await r.json()
        if (!r.ok) throw new Error(c?.error ?? 'No se pudo preparar el acta.')
        setActa(c)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error inesperado.'))

  useEffect(() => {
    pedirActa()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId])

  async function firmar() {
    if (!acta) return
    setEnviando(true)
    setError(null)
    try {
      const png = await pngDelLienzo(canvas.current)
      if (!png) throw new Error('No pudimos leer la firma. Probá de nuevo.')

      const cuerpo = new FormData()
      cuerpo.append('archivo', new File([png], `firma-${casoId}.png`, { type: 'image/png' }))
      cuerpo.append('hash', acta.hash)
      cuerpo.append('firmante', firmante)

      const res = await fetch(`/api/casos/${casoId}/firma`, { method: 'POST', body: cuerpo })
      const c = await res.json()
      if (!res.ok) {
        // 409: el expediente cambió entre que se mostró el acta y se firmó. Se vuelve a pedir.
        if (res.status === 409) await pedirActa()
        throw new Error(c?.error ?? 'No se pudo registrar la firma.')
      }
      seguir()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setEnviando(false)
    }
  }

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">Tu firma</div>
        <h1 className="pregunta">Firmá lo que declaraste</h1>

        {acta ? (
          <div className="tarjeta tarjeta-declaracion">
            <p className="pregunta-ayuda">{acta.declaracion}</p>
            <p className="mini">
              La firma cubre la carátula, tus {acta.resumen.respuestas} respuestas, {acta.resumen.fotos} fotografías,{' '}
              {acta.resumen.audios} audio{acta.resumen.audios === 1 ? '' : 's'}, {acta.resumen.testigos} testigo
              {acta.resumen.testigos === 1 ? '' : 's'}
              {acta.resumen.conCroquis ? ' y el croquis' : ''}.
            </p>
            <p className="mini">
              No cubre el informe de consistencia ni el sellado, porque los dos se generan después de que firmes: a
              nadie se le puede hacer firmar un informe automático sobre sí mismo.
            </p>
            <p className="mono mini">Acta {acta.hash.slice(0, 16)}…</p>
          </div>
        ) : null}

        <div className="campo campo-firmante">
          <label htmlFor="firmante">Aclaración</label>
          <input id="firmante" type="text" value={firmante} onChange={(e) => setFirmante(e.target.value)} />
        </div>

        <LienzoFirma refCanvas={canvas} alCambiar={setHayTrazo} />

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={firmar} disabled={!hayTrazo || enviando || !acta}>
          {enviando ? 'Registrando la firma...' : 'Firmar'}
        </button>
        <button className="omitir" onClick={seguir}>
          Cerrar sin firmar
        </button>
      </div>
    </>
  )
}
