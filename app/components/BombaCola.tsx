'use client'

import { useEffect } from 'react'
import { drenar } from '@/lib/cola'

/**
 * Bombea la cola de subida.
 *
 * Va montada en el layout y no en el recorrido, a propósito: en iPhone no hay Background
 * Sync, así que la cola sólo avanza mientras la aplicación está abierta. Si la persona
 * reabre la aplicación en el inicio y no en su actuación, esto igual la drena.
 *
 * Se dispara al montar, cuando vuelve la conexión, y cuando la pestaña vuelve a estar
 * visible, que es el momento en que un teléfono suele recuperar señal.
 *
 * No dibuja nada. Mostraba un aviso fijo con las piezas sin subir, pero aparecía en medio
 * de la pantalla justo cuando no hay señal y molestaba más de lo que ayudaba: la foto ya se
 * ve incorporada en su toma, y la subida sigue igual aunque nadie la anuncie.
 */
export function BombaCola() {
  useEffect(() => {
    const bombear = async () => {
      try {
        await drenar()
      } catch {
        /* se reintenta al próximo disparo */
      }
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
      window.removeEventListener('online', bombear)
      document.removeEventListener('visibilitychange', alVolver)
      navigator.serviceWorker?.removeEventListener('message', alMensaje)
      clearInterval(t)
    }
  }, [])

  return null
}
