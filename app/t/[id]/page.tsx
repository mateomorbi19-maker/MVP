'use client'

import { useEffect, useState } from 'react'
import { use } from 'react'
import { Marca } from '@/app/components/Marca'

/**
 * Carga de testigo desde su propio teléfono.
 *
 * Pantalla deliberadamente corta: el testigo es alguien que se detuvo un minuto y se
 * quiere ir. Tres campos, un consentimiento explícito y listo.
 */
export default function PaginaTestigo({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [datos, setDatos] = useState({ nombre: '', dni: '', telefono: '', relato: '' })
  const [consentimiento, setConsentimiento] = useState(false)
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [listo, setListo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (p) => setCoords({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setCoords(null),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  }, [])

  async function enviar() {
    if (!datos.nombre.trim()) {
      setError('Necesitamos al menos tu nombre.')
      return
    }
    if (!consentimiento) {
      setError('Sin tu consentimiento no podemos registrar los datos.')
      return
    }
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch(`/api/casos/${id}/testigos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...datos, consentimiento: true, ...(coords ?? {}) }),
      })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo registrar.')
      setListo(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
    } finally {
      setEnviando(false)
    }
  }

  const campo = (clave: keyof typeof datos) => ({
    value: datos[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDatos({ ...datos, [clave]: e.target.value }),
  })

  if (listo) {
    return (
      <main className="envoltura">
        <Marca enlace={false} />
        <div className="aviso" data-nivel="ok">Datos registrados. Gracias.</div>
        <h1>Listo</h1>
        <p className="apagado">
          Tu declaración quedó incorporada al expediente del siniestro, con la fecha y la hora exactas. Puede que la
          aseguradora o un juzgado te contacten más adelante.
        </p>
        <p className="mini">Actuación {id}</p>
      </main>
    )
  }

  return (
    <main className="envoltura">
      <Marca enlace={false} sub={`Actuación ${id}`} />

      <h1>¿Viste lo que pasó?</h1>
      <p className="apagado">
        Tus datos quedan asociados al expediente de este accidente. Lleva menos de un minuto y puede ser decisivo para
        que se resuelva con justicia.
      </p>

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="nombre">Nombre y apellido</label>
          <input id="nombre" type="text" {...campo('nombre')} />
        </div>
        <div className="campo">
          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" type="tel" placeholder="Para que puedan contactarte" {...campo('telefono')} />
        </div>
        <div className="campo">
          <label htmlFor="dni">DNI</label>
          <input id="dni" type="text" placeholder="Opcional" {...campo('dni')} />
        </div>
        <div className="campo">
          <label htmlFor="relato">¿Qué viste?</label>
          <textarea id="relato" placeholder="Contá brevemente lo que presenciaste. Opcional." {...campo('relato')} />
        </div>

        <button
          type="button"
          className="opcion"
          data-elegida={consentimiento}
          onClick={() => setConsentimiento(!consentimiento)}
          style={{ marginBottom: 14, alignItems: 'flex-start' }}
        >
          <span className="marca-opcion" data-cuadrada="true" style={{ marginTop: 2 }}>
            <span className="marca-opcion-punto" />
          </span>
          <span style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.45 }}>
            Presto mi consentimiento libre e informado para que mis datos se incorporen al expediente de este siniestro
            y se usen exclusivamente con ese fin, conforme a la Ley 25.326.
          </span>
        </button>

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

        <button className="boton-primario" onClick={enviar} disabled={enviando}>
          {enviando ? 'Registrando...' : 'Registrar mis datos'}
        </button>
      </div>

      <p className="mini">
        Podés pedir el acceso, la rectificación o la supresión de tus datos en cualquier momento. Al suprimirlos, el
        expediente conserva sólo un código que prueba que tu declaración existió, sin permitir reconstruirla. La
        autoridad de control es la Agencia de Acceso a la Información Pública.
      </p>
    </main>
  )
}
