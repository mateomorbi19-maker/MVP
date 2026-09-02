'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Marca } from './components/Marca'
import { InstalarApp } from './components/InstalarApp'
import { BarraCuenta } from './components/BarraCuenta'
import { BotonesEmergencia } from './components/BotonesEmergencia'
import { actuacionAbierta, recordarActuacion } from '@/lib/local'

/**
 * Inicio.
 *
 * Un solo botón. No se pide nada antes de empezar —ni la póliza, ni la patente—:
 * parado al lado del auto nadie tiene eso a mano, y un formulario en la primera
 * pantalla es exactamente lo que hace que la persona abandone. Los datos del
 * asegurado se piden al final del recorrido, cuando ya está registrado lo que
 * sólo existe en el lugar.
 */
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
          <div style={{ marginTop: 6 }}>{salud.detalle}</div>
        </div>
      ) : null}

      {/* Si el fallo al abrir es el mismo que ya avisa el estado del sistema, no se repite. */}
      {error && error !== salud?.detalle ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

      <div className="inicio-centro">
        <button className="boton-gigante" onClick={iniciar} disabled={enviando}>
          {enviando ? 'Abriendo...' : 'Tuve un accidente'}
          {!enviando ? <span>Tocá acá para empezar</span> : null}
        </button>

        {abierta ? (
          <Link href={`/s/${abierta}`} className="boton boton-secundario" style={{ width: '100%' }}>
            Continuar la actuación que dejaste abierta
          </Link>
        ) : null}
      </div>

      <div className="inicio-pie">
        {/* Marcado estático: es lo último que tiene que seguir andando si falla todo lo demás. */}
        <details className="tarjeta-plana">
          <summary>¿Necesitás ayuda urgente?</summary>
          <BotonesEmergencia />
        </details>

        <InstalarApp />
        <p className="mini centrado" style={{ margin: 0 }}>
          Vamos a pedirte permiso de ubicación, cámara y micrófono para registrar dónde, cuándo y cómo ocurrió.
          Los datos se usan sólo para documentar este siniestro ante tu aseguradora (Ley 25.326).
        </p>
        <BarraCuenta />
      </div>
    </main>
  )
}
