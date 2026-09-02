'use client'

import { useEffect, useState } from 'react'
import { drenar, todasLasPendientes } from '@/lib/cola'

/**
 * Bombea la cola de subida.
 *
 * Va montada en el layout y no en el recorrido, a propósito: en iPhone no hay Background
 * Sync, así que la cola sólo avanza mientras la aplicación está abierta. Si la persona
 * reabre la aplicación en el inicio y no en su actuación, esto igual la drena.
 *
 * Se dispara al montar, cuando vuelve la conexión, y cuando la pestaña vuelve a estar
 * visible, que es el momento en que un teléfono suele recuperar señal.
 */
export function BombaCola() {
  const [pendientes, setPendientes] = useState(0)

  useEffect(() => {
    let vivo = true

    const contar = async () => {
      try {
        const p = await todasLasPendientes()
        if (vivo) setPendientes(p.length)
      } catch {
        /* sin IndexedDB: no hay cola que mostrar */
      }
    }

    const bombear = async () => {
      try {
        await drenar()
      } catch {
        /* se reintenta al próximo disparo */
      }
      await contar()
    }

    bombear()
    const alVolver = () => {
      if (document.visibilityState === 'visible') bombear()
    }
    const alMensaje = (e: MessageEvent) => {
      if ((e.data as { tipo?: string })?.tipo === 'drenar-cola') bombear()
    }
    window.addEventListener('online', bombear)
    document.addEventListener('visibilitychange', alVolver)
    navigator.serviceWorker?.addEventListener('message', alMensaje)
    const t = setInterval(bombear, 30_000)

    return () => {
      vivo = false
      window.removeEventListener('online', bombear)
      document.removeEventListener('visibilitychange', alVolver)
      navigator.serviceWorker?.removeEventListener('message', alMensaje)
      clearInterval(t)
    }
  }, [])

  if (pendientes === 0) return null

  return (
    <div className="chip-cola" role="status">
      {pendientes} {pendientes === 1 ? 'pieza' : 'piezas'} sin subir. Se suben solas cuando haya señal.
    </div>
  )
}
