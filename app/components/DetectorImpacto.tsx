'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { analizarImpacto, type Lectura, type Veredicto } from '@/lib/impacto'

/**
 * Modo viaje: escucha el acelerómetro y avisa si detecta un impacto.
 *
 * TRES LÍMITES QUE ESTÁN DICHOS EN PANTALLA, no disimulados:
 *
 * 1. Corre SÓLO con la aplicación abierta y al frente. Cuando pasa a segundo plano el
 *    navegador suspende el hilo de JavaScript y DeviceMotionEvent deja de emitir. Una PWA
 *    no puede detectar un choque con la pantalla bloqueada, ni en iOS ni en Android, y no
 *    hay API que lo cambie.
 * 2. Consume batería: leer a 50 Hz con la pantalla encendida está en el orden del 15 al 25 %
 *    por hora en un teléfono de gama media. Por eso es opt-in y se apaga con un toque.
 * 3. En iOS 13+ el permiso de movimiento se pide con DeviceMotionEvent.requestPermission()
 *    y SÓLO desde un gesto de la persona: no se puede pedir al cargar la página.
 */

const HZ = Number(process.env.NEXT_PUBLIC_IMPACTO_HZ || 50)
const SEGUNDOS_BUFFER = 15
const SEGUNDOS_CONFIRMACION = 45

type Estado = 'apagado' | 'pidiendo' | 'escuchando' | 'no_soportado' | 'denegado'

export function DetectorImpacto() {
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>('apagado')
  const [veredicto, setVeredicto] = useState<Veredicto | null>(null)
  const [restante, setRestante] = useState(SEGUNDOS_CONFIRMACION)
  const [telemetriaId, setTelemetriaId] = useState<string | null>(null)

  /** Buffer circular de los últimos segundos: es lo que se puede anexar como evidencia. */
  const buffer = useRef<Lectura[]>([])
  const inicio = useRef<number>(0)
  const ultimoAviso = useRef<number>(0)

  const detener = useCallback(() => {
    setEstado('apagado')
    buffer.current = []
  }, [])

  const alMovimiento = useCallback((e: DeviceMotionEvent) => {
    const a = e.acceleration
    const aG = e.accelerationIncludingGravity
    if (!a || a.x === null) return

    const ahora = performance.now()
    if (!inicio.current) inicio.current = ahora

    buffer.current.push({
      t: Math.round(ahora - inicio.current),
      ax: a.x ?? 0,
      ay: a.y ?? 0,
      az: a.z ?? 0,
      gTotal: aG
        ? Math.sqrt((aG.x ?? 0) ** 2 + (aG.y ?? 0) ** 2 + (aG.z ?? 0) ** 2) / 9.80665
        : undefined,
      giro: e.rotationRate ? Math.abs(e.rotationRate.alpha ?? 0) : null,
    })

    // Se conservan sólo los últimos segundos.
    const corte = (buffer.current.at(-1)?.t ?? 0) - SEGUNDOS_BUFFER * 1000
    if (buffer.current.length > HZ * SEGUNDOS_BUFFER * 1.5) {
      buffer.current = buffer.current.filter((l) => l.t >= corte)
    }

    // No se re-analiza en cada muestra ni se avisa dos veces por el mismo golpe.
    if (buffer.current.length < HZ || ahora - ultimoAviso.current < 20_000) return
    const v = analizarImpacto(buffer.current)
    if (v.nivel === 'nada') return

    ultimoAviso.current = ahora
    setVeredicto(v)
    setRestante(SEGUNDOS_CONFIRMACION)

    fetch('/api/telemetria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serie: buffer.current, origen: 'navegador' }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setTelemetriaId(c?.id ?? null))
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (estado !== 'escuchando') return
    window.addEventListener('devicemotion', alMovimiento)
    return () => window.removeEventListener('devicemotion', alMovimiento)
  }, [estado, alMovimiento])

  // Cuenta regresiva de la ventana de verificación.
  useEffect(() => {
    if (!veredicto) return
    if (restante <= 0) {
      router.push(`/aviso${telemetriaId ? `?t=${telemetriaId}` : ''}`)
      return
    }
    const t = setTimeout(() => setRestante((r) => r - 1), 1000)
    return () => clearTimeout(t)
  }, [veredicto, restante, router, telemetriaId])

  async function encender() {
    setEstado('pidiendo')
    const DME = window.DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> } | undefined
    if (!DME) {
      setEstado('no_soportado')
      return
    }
    // iOS 13+: hay que pedirlo, y sólo desde un gesto. Por eso esto está en un onClick.
    if (typeof DME.requestPermission === 'function') {
      try {
        if ((await DME.requestPermission()) !== 'granted') {
          setEstado('denegado')
          return
        }
      } catch {
        setEstado('denegado')
        return
      }
    }
    inicio.current = 0
    buffer.current = []
    setEstado('escuchando')
  }

  if (veredicto) {
    return (
      <div className="aviso" data-nivel="alerta">
        <strong>¿Estás bien?</strong>
        <p className="aviso-detalle">
          El teléfono detectó un golpe de {veredicto.picoG.toFixed(1)} g. Si no contestás en {restante} segundos, te
          vamos a mostrar las opciones de ayuda.
        </p>
        {/* Apilados y a ancho completo: en dos columnas a 375px «Necesito ayuda» envuelve, y la
            acción que escala queda debajo de la que descarta el aviso. */}
        <div className="pila">
          <button
            className="boton-primario"
            onClick={() => router.push(`/aviso${telemetriaId ? `?t=${telemetriaId}` : ''}`)}
          >
            Necesito ayuda
          </button>
          <button
            className="boton-secundario boton-ancho"
            onClick={() => {
              if (telemetriaId) {
                fetch(`/api/telemetria/${telemetriaId}/respuesta`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ respuesta: 'estoy_bien' }),
                }).catch(() => undefined)
              }
              setVeredicto(null)
            }}
          >
            Estoy bien
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="tarjeta">
      <h3>Modo viaje</h3>
      <p className="apagado">
        Con la aplicación abierta, el teléfono escucha el acelerómetro y te pregunta si detecta un impacto. Nunca llama
        solo a emergencias.
      </p>

      {/* El límite se lee ANTES de encender, no después: quien enciende creyendo que lo cubre
          con la pantalla bloqueada no vuelve a leer la letra chica del pie. */}
      <div className="aviso" data-nivel="info">
        <strong>Funciona sólo con la aplicación abierta y a la vista.</strong>
        <div className="aviso-detalle">
          Cuando el teléfono se bloquea o pasás a otra aplicación, el navegador suspende la lectura de los sensores: no
          hay forma de evitarlo desde una aplicación web, ni en iPhone ni en Android.
        </div>
        <div className="aviso-detalle">
          Leer los sensores consume batería, así que conviene tener el teléfono enchufado.
        </div>
      </div>

      {estado === 'escuchando' ? (
        <>
          <p className="mini">
            <span className="punto" data-estado="ok" /> Escuchando.
          </p>
          <button className="boton boton-secundario" onClick={detener}>
            Apagar el modo viaje
          </button>
        </>
      ) : (
        <button className="boton boton-secundario" onClick={encender} disabled={estado === 'pidiendo'}>
          {estado === 'pidiendo' ? 'Pidiendo permiso...' : 'Encender el modo viaje'}
        </button>
      )}

      {estado === 'denegado' ? (
        <div className="aviso" data-nivel="atencion">
          El teléfono no dio permiso para leer el movimiento. Se puede habilitar desde los ajustes del navegador.
        </div>
      ) : null}
      {estado === 'no_soportado' ? (
        <div className="aviso" data-nivel="atencion">
          Este navegador no expone el acelerómetro.
        </div>
      ) : null}
    </div>
  )
}
