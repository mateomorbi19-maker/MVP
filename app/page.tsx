'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Marca } from './components/Marca'
import { InstalarApp } from './components/InstalarApp'
import { actuacionAbierta } from '@/lib/local'

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
        <div className="aviso aviso-alerta">
          <strong>El sistema no está operativo.</strong>
          <div style={{ marginTop: 6 }}>{salud.detalle}</div>
        </div>
      ) : null}

      {error ? <div className="aviso aviso-alerta">{error}</div> : null}

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
        <InstalarApp />
        <p className="mini centrado" style={{ margin: 0 }}>
          Vamos a pedirte permiso de ubicación, cámara y micrófono para registrar dónde, cuándo y cómo ocurrió.
          Los datos se usan sólo para documentar este siniestro ante tu aseguradora (Ley 25.326).
        </p>
        <div className="enlaces-pie">
          <Link href="/panel">Panel de siniestros</Link>
          <Link href="/verificar">Verificar expediente</Link>
        </div>
      </div>
    </main>
  )
}
