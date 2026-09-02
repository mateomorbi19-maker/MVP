'use client'

import { useEffect, useState } from 'react'

/**
 * Instalación en la pantalla de inicio y registro del service worker.
 *
 * Android dispara `beforeinstallprompt` y permite instalar con un botón.
 * iOS no expone ninguna API para esto: hay que explicarle a la persona el gesto
 * manual, así que se detecta Safari en iOS y se muestran los pasos.
 */

interface EventoInstalacion extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export function InstalarApp() {
  const [evento, setEvento] = useState<EventoInstalacion | null>(null)
  const [instalada, setInstalada] = useState(true) // se asume instalada hasta comprobar
  const [esIOS, setEsIOS] = useState(false)
  const [verPasosIOS, setVerPasosIOS] = useState(false)

  useEffect(() => {
    // Registro del service worker: sin él, Android no ofrece instalar.
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Que falle no debe romper nada: el sistema funciona igual, sólo se pierde
        // la instalación. Se deja registrado para poder diagnosticarlo si pasa.
        console.warn('[pwa] no se pudo registrar el service worker:', err)
      })
    }

    const enStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true
    setInstalada(enStandalone)

    const ua = window.navigator.userAgent
    const iOS = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Macintosh') && 'ontouchend' in document)
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    setEsIOS(iOS && safari)

    const alPoderInstalar = (e: Event) => {
      e.preventDefault()
      setEvento(e as EventoInstalacion)
    }
    const alInstalar = () => {
      setInstalada(true)
      setEvento(null)
    }

    window.addEventListener('beforeinstallprompt', alPoderInstalar)
    window.addEventListener('appinstalled', alInstalar)
    return () => {
      window.removeEventListener('beforeinstallprompt', alPoderInstalar)
      window.removeEventListener('appinstalled', alInstalar)
    }
  }, [])

  if (instalada) return null

  async function instalar() {
    if (!evento) return
    await evento.prompt()
    const eleccion = await evento.userChoice
    if (eleccion.outcome === 'accepted') setInstalada(true)
    setEvento(null)
  }

  if (evento) {
    return (
      <div className="tarjeta-plana">
        <h3>Instalá la aplicación</h3>
        <p className="mini instalar-descripcion">
          Queda en la pantalla de inicio, abre a pantalla completa y pide los permisos de ubicación y cámara como
          cualquier otra aplicación del teléfono. Es la forma recomendada de usarla en la calle.
        </p>
        <button className="boton-primario" onClick={instalar}>
          Instalar en el teléfono
        </button>
      </div>
    )
  }

  if (esIOS) {
    return (
      <div className="tarjeta-plana">
        <h3>Instalá la aplicación</h3>
        {!verPasosIOS ? (
          <>
            <p className="mini instalar-descripcion">
              Se puede agregar a la pantalla de inicio para que abra como una aplicación, sin barra de navegador.
            </p>
            <button className="boton-secundario boton-ancho" onClick={() => setVerPasosIOS(true)}>
              Ver cómo se hace
            </button>
          </>
        ) : (
          <ol className="mini instalar-pasos">
            <li>
              Tocá el botón <strong>Compartir</strong> abajo en el centro (el cuadrado con la flecha hacia arriba).
            </li>
            <li>
              Deslizá y elegí <strong>Agregar a inicio</strong>.
            </li>
            <li>
              Confirmá con <strong>Agregar</strong>.
            </li>
            <li>Abrila desde el ícono nuevo, no desde Safari.</li>
          </ol>
        )}
      </div>
    )
  }

  return null
}
