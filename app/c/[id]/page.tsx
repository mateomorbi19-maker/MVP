'use client'

import { use, useEffect, useState } from 'react'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'

/**
 * Carga del otro conductor, desde su propio teléfono.
 *
 * Calcado de la pantalla de testigos, y por el mismo motivo: es alguien parado al lado de
 * un auto chocado que se quiere ir. Pocos campos, un consentimiento explícito y listo.
 *
 * Dice con todas las letras qué está consintiendo y qué NO: que sus datos entren al
 * expediente, y que eso no significa reconocer responsabilidad ni aceptar la versión del
 * hecho de la otra parte, que ni siquiera se le muestra acá. Y lo dice arriba, antes del
 * formulario: dentro del consentimiento queda en el renglón siete de la letra chica, que
 * es justo donde el desconfiado no llega.
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
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo registrar. Volvé a tocar "Registrar mis datos".')
      setListo(true)
    } catch (e) {
      /*
       * Acá el navegador habla en inglés y quien lee es el otro conductor, parado al lado
       * de su auto: un fetch que no llega a conectar —lo más probable, porque está en la
       * calle— rechaza con un TypeError cuyo mensaje es «Failed to fetch», o «Load failed»
       * en iPhone. Y si contesta un portal cautivo de wifi o un proxy con HTML en vez de
       * JSON, el res.json() de arriba corre antes del chequeo de res.ok y rechaza con un
       * SyntaxError: «Unexpected token '<'». Ninguno de los dos se le muestra crudo, y
       * ninguno se disimula con un .catch() sobre el parseo: eso convertiría el HTML de un
       * portal cautivo en «Datos registrados».
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
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, [clave]: e.target.value }),
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
            Tus datos quedaron incorporados al expediente de este siniestro, con la fecha y la hora exactas. Puede que
            la aseguradora te contacte más adelante.
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
        La marca va sin enlace, a diferencia del resto de las pantallas: quien lee esto no
        es el asegurado ni tiene sesión, y llevarlo al inicio de la aplicación lo saca del
        formulario sin manera de volver.
      */}
      <Marca enlace={false} />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Tus datos, para el registro del siniestro</h1>
        <p className="bajada-pagina">
          Te los pide la otra persona involucrada: el código que escaneaste salió de su teléfono. Con tu nombre
          alcanza; lo demás sumalo si lo tenés a mano. Cada uno carga lo suyo por su lado, y es lo que después
          permite que las aseguradoras se entiendan sin que ustedes tengan que volver a encontrarse.
        </p>
      </header>

      <div className="aviso" data-nivel="info">
        <strong>Dejar tus datos no es reconocer responsabilidad.</strong> Tampoco estás aceptando la versión del hecho
        de la otra parte: acá no se te muestra ni se te pide que la firmes.
      </div>

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
          <input id="patente" type="text" placeholder="AB 123 CD" autoCapitalize="characters" {...campo('patente')} />
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
          className="opcion opcion-consentimiento"
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

        {/*
          Los derechos de acceso, rectificación y supresión van dentro de la tarjeta y
          antes del botón, no al pie de la página: con siete campos arriba, al pie quedan
          casi dos pantallas por debajo de «Registrar mis datos», y así se consiente
          «conforme a la Ley 25.326» sin haber visto nunca qué se puede hacer después.
        */}
        <p className="nota-datos-personales">
          Podés pedir el acceso, la rectificación o la supresión de tus datos en cualquier momento. Al suprimirlos,
          el expediente conserva sólo un código que prueba que tu carga existió, sin permitir reconstruirla. La
          autoridad de control es la Agencia de Acceso a la Información Pública.
        </p>

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

        <button className="boton-primario" onClick={enviar} disabled={enviando}>
          {enviando ? 'Registrando...' : 'Registrar mis datos'}
        </button>
      </div>
    </main>
  )
}
