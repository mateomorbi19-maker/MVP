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
  const [error, setError] = useState<string | null>(null)

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
    setError(null)
    try {
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      // Un 502 del proxy o un portal cautivo de wifi contestan HTML: sin este resguardo el
      // json() rompe antes de mirar el estado y el motivo del servidor se pierde abajo.
      const cuerpo = await res.json().catch(() => null)
      if (!res.ok) {
        setError(cuerpo?.error ?? 'No se pudo abrir la actuación. Esperá unos segundos y volvé a tocar el botón.')
        setAbriendo(false)
        return
      }
      recordarActuacion(cuerpo.id, cuerpo.secreto)
      router.push(`/s/${cuerpo.id}`)
    } catch {
      // Un botón que vuelve solo a su rótulo se lee como que la aplicación no hizo nada. Acá
      // el pedido no salió del teléfono: el mensaje del navegador viene en inglés y no dice
      // qué hacer, así que se nombra lo único accionable parado en la calle, la señal.
      setError('No se pudo contactar al servidor. Revisá la señal y volvé a tocar el botón.')
      setAbriendo(false)
    }
  }

  return (
    <main className="envoltura">
      <Marca enlace={false} />

      <div className="emergencia">
        <h1>¿Estás bien?</h1>
        <p className="emergencia-descripcion">
          Si necesitás ayuda, llamá. Si estás bien, podés registrar lo que pasó.
        </p>
        <BotonesEmergencia />
      </div>

      {error ? (
        <div className="aviso" data-nivel="alerta">
          {error}
        </div>
      ) : null}

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
