'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Marca } from '@/app/components/Marca'
import { BotonesEmergencia } from '@/app/components/BotonesEmergencia'
import { recordarActuacion } from '@/lib/local'

/**
 * La pantalla a la que lleva la notificación de impacto.
 *
 * Existe porque las acciones dentro de la notificación NO son una opción universal: en
 * iPhone, Web Push las ignora por completo, y en Android Chrome dibuja como máximo dos. Los
 * tres botones del mockup sólo se pueden garantizar acá, en una pantalla nuestra, que
 * además se puede leer con una sola mano y sin desbloquear nada más.
 *
 * NUNCA se llama sola a emergencias. Los botones están a un toque, y nada más.
 */
function Aviso() {
  const router = useRouter()
  const accion = useSearchParams().get('accion')
  const telemetria = useSearchParams().get('t')
  const [abriendo, setAbriendo] = useState(false)

  useEffect(() => {
    // Si la notificación se venció sin respuesta, queda registrado.
    if (telemetria && accion === null) {
      fetch(`/api/telemetria/${telemetria}/respuesta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta: 'sin_respuesta' }),
      }).catch(() => undefined)
    }
  }, [telemetria, accion])

  async function reportar() {
    setAbriendo(true)
    try {
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo abrir la actuación.')
      recordarActuacion(cuerpo.id, cuerpo.secreto)
      router.push(`/s/${cuerpo.id}`)
    } catch {
      setAbriendo(false)
    }
  }

  return (
    <main className="envoltura">
      <Marca enlace={false} sub="¿Tuviste un accidente?" />

      <div className="emergencia">
        <h1>¿Estás bien?</h1>
        <p>Si necesitás ayuda, llamá. Si estás bien, podés registrar lo que pasó.</p>
        <BotonesEmergencia />
      </div>

      <div className="pila">
        <button className="boton-primario" onClick={reportar} disabled={abriendo}>
          {abriendo ? 'Abriendo...' : 'Registrar el accidente'}
        </button>
        <button
          className="boton boton-secundario"
          onClick={() => {
            if (telemetria) {
              fetch(`/api/telemetria/${telemetria}/respuesta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ respuesta: 'estoy_bien' }),
              }).catch(() => undefined)
            }
            router.push('/')
          }}
        >
          Estoy bien, fue una falsa alarma
        </button>
      </div>

      <p className="mini">
        El teléfono detectó un movimiento compatible con un impacto. Puede equivocarse: un pozo fuerte o un golpe al
        aparato dan lecturas parecidas. Por eso te pregunta en vez de llamar por su cuenta.
      </p>
    </main>
  )
}

export default function PaginaAviso() {
  return (
    <Suspense fallback={null}>
      <Aviso />
    </Suspense>
  )
}
