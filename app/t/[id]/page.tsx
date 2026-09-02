'use client'

import { use, useEffect, useState } from 'react'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'

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
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo registrar. Volvé a tocar "Registrar mis datos".')
      setListo(true)
    } catch (e) {
      /*
       * Acá el navegador habla en inglés y quien lee no es usuario del sistema: es alguien
       * que se detuvo un minuto y se quiere ir. Un fetch que no llega a conectar —lo más
       * probable, porque está parado en la calle— rechaza con un TypeError cuyo mensaje es
       * «Failed to fetch», o «Load failed» en iPhone. Y si contesta un portal cautivo de
       * wifi o un proxy con HTML en vez de JSON, el res.json() de arriba corre antes del
       * chequeo de res.ok y rechaza con un SyntaxError: «Unexpected token '<'». Ninguno de
       * los dos se le muestra crudo, y ninguno se disimula con un .catch() sobre el
       * parseo: eso convertiría el HTML de un portal cautivo en «Datos registrados».
       */
      setError(
        e instanceof TypeError
          ? 'No hay señal para enviarlo. Movete unos metros, o pasá a datos móviles, y volvé a tocar "Registrar mis datos".'
          : e instanceof SyntaxError || !(e instanceof Error)
            ? 'No se pudo registrar: el servidor no contestó lo esperado. Esperá unos segundos y volvé a tocar "Registrar mis datos".'
            : e.message,
      )
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

        <div className="hito">
          <div className="hito-simbolo">
            <Icono nombre="tilde" />
          </div>
          <h1 className="titulo-pagina hito-titulo">Quedó registrado</h1>
          <p className="bajada-pagina">
            Tu declaración quedó incorporada al expediente del siniestro, con la fecha y la hora exactas. Puede que la
            aseguradora o un juzgado te contacten más adelante.
          </p>
        </div>

        <div className="tarjeta tarjeta-actuacion centrado">
          <h3 className="tarjeta-actuacion-titulo">Número de actuación</h3>
          <p className="numero-actuacion tarjeta-actuacion-numero">{id}</p>
          <p className="mini tarjeta-actuacion-nota">
            Anotalo: es con lo que podés pedir después el acceso o la supresión de tus datos.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="envoltura">
      {/*
        La marca va sin enlace: el testigo está en su propio teléfono y no es usuario del
        sistema, así que el logo no tiene por qué llevarlo a «Tuve un accidente».
      */}
      <Marca enlace={false} />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">¿Viste lo que pasó?</h1>
        <p className="bajada-pagina">
          Quien tuvo el accidente te pide que dejes tus datos como testigo. Quedan asociados al expediente de este
          siniestro. Con el nombre alcanza; lleva menos de un minuto y puede ser decisivo para que se resuelva con
          justicia.
        </p>
      </header>

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="nombre">Nombre y apellido</label>
          <input id="nombre" type="text" autoComplete="name" {...campo('nombre')} />
        </div>
        <div className="campo">
          <label htmlFor="telefono">Teléfono</label>
          <input
            id="telefono"
            type="tel"
            autoComplete="tel"
            placeholder="Para que puedan contactarte"
            {...campo('telefono')}
          />
        </div>
        {/*
          «Opcional» va en el rótulo y no en el marcador de posición: el marcador
          desaparece apenas el dedo toca el campo, y quedaba mirando un campo vacío sin
          saber si lo podía saltear.
        */}
        <div className="campo">
          <label htmlFor="dni">DNI (opcional)</label>
          <input id="dni" type="text" inputMode="numeric" {...campo('dni')} />
        </div>
        <div className="campo">
          <label htmlFor="relato">¿Qué viste? (opcional)</label>
          <textarea id="relato" placeholder="Contá brevemente lo que presenciaste." {...campo('relato')} />
        </div>

        <button
          type="button"
          className="opcion opcion-consentimiento"
          data-elegida={consentimiento}
          onClick={() => setConsentimiento(!consentimiento)}
        >
          <span className="marca-opcion" data-cuadrada="true">
            <span className="marca-opcion-punto" />
          </span>
          <span>
            Presto mi consentimiento libre e informado para que mis datos se incorporen al expediente de este siniestro
            y se usen exclusivamente con ese fin, conforme a la Ley 25.326.
          </span>
        </button>

        {/*
          Los derechos de acceso, rectificación y supresión van dentro de la tarjeta y
          antes del botón, no al pie de la página: al pie se toca «Registrar mis datos»
          sin haberlos visto nunca, que es lo contrario de un consentimiento informado.
        */}
        <p className="nota-datos-personales">
          Podés pedir el acceso, la rectificación o la supresión de tus datos en cualquier momento. Al suprimirlos,
          el expediente conserva sólo un código que prueba que tu declaración existió, sin permitir reconstruirla.
          La autoridad de control es la Agencia de Acceso a la Información Pública.
        </p>

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

        <button className="boton-primario" onClick={enviar} disabled={enviando}>
          {enviando ? 'Registrando...' : 'Registrar mis datos'}
        </button>
      </div>
    </main>
  )
}
