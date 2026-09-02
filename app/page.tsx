'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Marca } from './components/Marca'
import { InstalarApp } from './components/InstalarApp'
import { BarraCuenta } from './components/BarraCuenta'
import { BotonesEmergencia } from './components/BotonesEmergencia'
import { Icono } from './components/Iconos'
import { actuacionAbierta, recordarActuacion } from '@/lib/local'

/**
 * Inicio.
 *
 * No se pide nada antes de empezar —ni la póliza, ni la patente—: parado al lado del auto
 * nadie tiene eso a mano, y un formulario en la primera pantalla es exactamente lo que hace
 * que la persona abandone. Los datos del asegurado se piden al final del recorrido, cuando
 * ya está registrado lo que sólo existe en el lugar.
 *
 * Es un Client Component a propósito y el botón no depende de ninguna consulta: si el
 * inicio se resolviera en el servidor, con la base lenta o caída la persona con adrenalina
 * vería un error en vez del botón. El aviso de sistema no operativo aparece encima, pero
 * nunca lo tapa.
 *
 * Las emergencias van desplegadas y no dentro de un desplegable: en el momento en que hacen
 * falta, un acordeón es un toque de más.
 */

/** Lo que el recorrido va a pedir, dicho antes de empezar. */
const QUE_SE_REGISTRA = [
  { icono: 'camara', titulo: 'Fotografías', detalle: 'del lugar y los vehículos' },
  { icono: 'personas', titulo: 'Datos', detalle: 'del tercero y los testigos' },
  { icono: 'ubicacion', titulo: 'Ubicación', detalle: 'hora y condiciones reales' },
  { icono: 'microfono', titulo: 'Tu relato', detalle: 'con tus palabras' },
] as const

export default function Inicio() {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [salud, setSalud] = useState<{ ok: boolean; detalle: string } | null>(null)
  const [abierta, setAbierta] = useState<string | null>(null)

  useEffect(() => {
    setAbierta(actuacionAbierta())

    // Avisa del problema antes de que la persona cargue datos, no después.
    fetch('/api/salud')
      .then((r) => r.json())
      .then((c) => setSalud({ ok: Boolean(c?.ok), detalle: c?.base?.detalle ?? 'Sin detalle.' }))
      .catch(() => setSalud({ ok: false, detalle: 'No se pudo contactar al servidor.' }))
  }, [])

  async function iniciar() {
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo iniciar la actuación.')
      // El secreto se devuelve una sola vez: si no se guarda ahora, se perdió.
      recordarActuacion(cuerpo.id, cuerpo.secreto)
      router.push(`/s/${cuerpo.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setEnviando(false)
    }
  }

  return (
    <main className="inicio">
      <h1 className="solo-lectores">Acta Digital de Siniestro</h1>
      <Marca enlace={false} sub="Registro probatorio de siniestros viales" />

      {salud && !salud.ok ? (
        <div className="aviso" data-nivel="alerta">
          <strong>El sistema no está operativo.</strong>
          <div className="aviso-detalle">{salud.detalle}</div>
        </div>
      ) : null}

      {/* Si el fallo al abrir es el mismo que ya avisa el estado del sistema, no se repite. */}
      {error && error !== salud?.detalle ? (
        <div className="aviso" data-nivel="alerta">
          {error}
        </div>
      ) : null}

      <section className="denuncia">
        <h2 className="denuncia-titulo">¿Tuviste un siniestro?</h2>
        <p className="denuncia-bajada">
          Registralo ahora. Reunir la información y las fotos en el momento del hecho es lo que más pesa después.
        </p>

        <ul className="denuncia-pasos">
          {QUE_SE_REGISTRA.map((p) => (
            <li className="denuncia-paso" key={p.titulo}>
              <span className="denuncia-paso-icono">
                <Icono nombre={p.icono} />
              </span>
              <span className="denuncia-paso-titulo">{p.titulo}</span>
              <span className="denuncia-paso-detalle">{p.detalle}</span>
            </li>
          ))}
        </ul>

        <button className="boton-gigante" onClick={iniciar} disabled={enviando}>
          {enviando ? 'Abriendo...' : 'Tuve un accidente'}
          {!enviando ? <span>Tocá acá para empezar</span> : null}
        </button>

        <p className="denuncia-resguardo">
          <Icono nombre="escudo" />
          Tu información está protegida.
        </p>
      </section>

      {abierta ? (
        <Link href={`/s/${abierta}`} className="boton boton-secundario boton-ancho">
          Continuar la actuación que dejaste abierta
        </Link>
      ) : null}

      <section className="bloque-inicio">
        <h2 className="bloque-titulo">¿Necesitás ayuda urgente?</h2>
        <p className="bloque-bajada">Llamá a los servicios de emergencia.</p>
        <BotonesEmergencia />
      </section>

      <Link href="/poliza" className="acceso">
        <span className="acceso-icono">
          <Icono nombre="archivo" />
        </span>
        <span className="acceso-texto">
          <span className="acceso-titulo">Mi póliza y documentación</span>
          <span className="acceso-detalle">Tu cobertura, la documentación del vehículo y el productor asignado.</span>
        </span>
        <span className="acceso-flecha" aria-hidden="true">
          →
        </span>
      </Link>

      <div className="aviso" data-nivel="info">
        <strong>Un consejo</strong>
        <div className="aviso-detalle">
          Reuní toda la información posible en el lugar: fotos, datos del tercero, testigos y documentación. Es lo que
          después hace la diferencia.
        </div>
      </div>

      <div className="inicio-pie">
        <InstalarApp />
        <p className="mini centrado">
          Vamos a pedirte permiso de ubicación, cámara y micrófono para registrar dónde, cuándo y cómo ocurrió. Los
          datos se usan sólo para documentar este siniestro ante tu aseguradora (Ley 25.326).
        </p>
        <BarraCuenta />
      </div>
    </main>
  )
}
