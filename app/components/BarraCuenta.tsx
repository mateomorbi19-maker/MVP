'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { actuacionAbierta, secretoDe, ultimaActuacion } from '@/lib/local'

type Sesion = { usuario_id: string; nombre: string | null; rol: string } | null

/**
 * Los accesos de la cuenta, en el inicio.
 *
 * Se pinta DESPUÉS del botón grande y por su cuenta: la sesión se consulta con fetch y su
 * resultado no participa del render del botón «Tuve un accidente». Si el inicio dependiera
 * de un SELECT de sesión, con la base lenta o caída la persona con adrenalina vería un
 * error en vez del botón, que es exactamente lo que este producto no puede permitirse.
 */
export function BarraCuenta() {
  const [sesion, setSesion] = useState<Sesion>(null)
  const [listo, setListo] = useState(false)
  const [vinculable, setVinculable] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/sesion')
      .then((r) => r.json())
      .then((c) => setSesion(c?.sesion ?? null))
      .catch(() => setSesion(null))
      .finally(() => setListo(true))
  }, [])

  useEffect(() => {
    if (!sesion) return
    const id = actuacionAbierta() ?? ultimaActuacion()
    // Sólo se ofrece si este teléfono tiene el secreto: sin él el servidor lo va a rechazar.
    setVinculable(id && secretoDe(id) ? id : null)
  }, [sesion])

  async function vincular() {
    if (!vinculable) return
    const res = await fetch(`/api/casos/${vinculable}/vincular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secreto: secretoDe(vinculable) }),
    })
    const cuerpo = await res.json()
    setAviso(res.ok ? 'La actuación quedó guardada en tu cuenta.' : (cuerpo?.error ?? 'No se pudo vincular.'))
    if (res.ok) setVinculable(null)
  }

  if (!listo) return null

  if (!sesion) {
    return (
      <div className="enlaces-pie">
        <Link href="/entrar">Entrar a mi cuenta</Link>
        <Link href="/verificar">Verificar expediente</Link>
      </div>
    )
  }

  return (
    <>
      {vinculable ? (
        <div className="aviso" data-nivel="info">
          <strong>Tenés una actuación sin guardar en tu cuenta.</strong>
          <div className="mini">{vinculable}</div>
          <button className="boton boton-secundario" onClick={vincular}>
            Guardarla en mi cuenta
          </button>
        </div>
      ) : null}
      {aviso ? <div className="aviso" data-nivel="ok">{aviso}</div> : null}
      <div className="enlaces-pie">
        <Link href="/historial">Mis actuaciones</Link>
        <Link href="/poliza">Mi póliza</Link>
        {sesion.rol !== 'asegurado' ? <Link href="/panel">Panel</Link> : null}
        <Link href="/cuenta">Mi cuenta</Link>
      </div>
    </>
  )
}
