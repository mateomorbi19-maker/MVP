'use client'

import { use, useEffect, useState } from 'react'
import { Marca } from '@/app/components/Marca'

/**
 * Carga del otro conductor, desde su propio teléfono.
 *
 * Calcado de la pantalla de testigos, y por el mismo motivo: es alguien parado al lado de
 * un auto chocado que se quiere ir. Pocos campos, un consentimiento explícito y listo.
 *
 * Dice con todas las letras qué está consintiendo y qué NO: que sus datos entren al
 * expediente, y que eso no significa reconocer responsabilidad ni aceptar la versión del
 * hecho de la otra parte, que ni siquiera se le muestra acá.
 */
export default function PaginaTercero({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [datos, setDatos] = useState({
    nombre: '',
    dni: '',
    telefono: '',
    patente: '',
    marca_modelo: '',
    aseguradora: '',
    poliza: '',
  })
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
      const res = await fetch(`/api/casos/${id}/terceros`, {
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
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, [clave]: e.target.value }),
  })

  if (listo) {
    return (
      <main className="envoltura">
        <Marca enlace={false} />
        <div className="aviso" data-nivel="ok">Datos registrados. Gracias.</div>
        <h1>Listo</h1>
        <p className="apagado">
          Tus datos quedaron incorporados al expediente de este siniestro, con la fecha y la hora exactas. Puede que la
          aseguradora te contacte más adelante.
        </p>
        <p className="mini">Actuación {id}</p>
      </main>
    )
  }

  return (
    <main className="envoltura">
      <Marca enlace={false} sub={`Actuación ${id}`} />

      <h1>Tus datos, para el registro del siniestro</h1>
      <p className="apagado">
        Los carga cada uno por su lado. Que queden tus datos correctos te conviene tanto como al otro: es lo que
        después permite que las aseguradoras se entiendan sin que ustedes tengan que volver a encontrarse.
      </p>

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="nombre">Nombre y apellido</label>
          <input id="nombre" type="text" autoComplete="name" {...campo('nombre')} />
        </div>
        <div className="campo">
          <label htmlFor="dni">DNI</label>
          <input id="dni" type="text" inputMode="numeric" {...campo('dni')} />
        </div>
        <div className="campo">
          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" type="tel" autoComplete="tel" {...campo('telefono')} />
        </div>
        <div className="campo">
          <label htmlFor="patente">Patente de tu vehículo</label>
          <input id="patente" type="text" {...campo('patente')} />
        </div>
        <div className="campo">
          <label htmlFor="marca_modelo">Marca y modelo</label>
          <input id="marca_modelo" type="text" {...campo('marca_modelo')} />
        </div>
        <div className="campo">
          <label htmlFor="aseguradora">Tu aseguradora</label>
          <input id="aseguradora" type="text" {...campo('aseguradora')} />
        </div>
        <div className="campo">
          <label htmlFor="poliza">Número de póliza</label>
          <input id="poliza" type="text" {...campo('poliza')} />
        </div>

        <button
          type="button"
          className="opcion"
          data-elegida={consentimiento}
          onClick={() => setConsentimiento(!consentimiento)}
        >
          <span className="marca-opcion" data-cuadrada="true">
            <span className="marca-opcion-punto" />
          </span>
          <span>
            Presto mi consentimiento libre e informado para que mis datos se incorporen al expediente de este
            siniestro y se usen exclusivamente con ese fin, conforme a la Ley 25.326.{' '}
            <strong>Esto no implica reconocer responsabilidad</strong> ni aceptar la versión del hecho de la otra
            parte, que no se me exhibió.
          </span>
        </button>

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

        <button className="boton-primario" onClick={enviar} disabled={enviando}>
          {enviando ? 'Registrando...' : 'Registrar mis datos'}
        </button>
      </div>

      <p className="mini">
        Podés pedir el acceso, la rectificación o la supresión de tus datos en cualquier momento. Al suprimirlos, el
        expediente conserva sólo un código que prueba que tu carga existió, sin permitir reconstruirla. La autoridad de
        control es la Agencia de Acceso a la Información Pública.
      </p>
    </main>
  )
}
