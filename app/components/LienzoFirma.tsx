'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * Lienzo de firma.
 *
 * Sin dependencias: son eventos de puntero y canvas.toBlob.
 *
 * LO QUE NO SE PUEDE CAMBIAR, y por qué:
 *
 * - El canvas recibe `width` y `height` en píxeles reales desde JavaScript, no desde CSS.
 *   Con el tamaño puesto por CSS el navegador escala el bitmap y el trazo sale borroso y
 *   corrido respecto del dedo.
 * - `touch-action: none` sobre el canvas. Sin eso, arrastrar el dedo hace scroll de la
 *   página en vez de dibujar.
 * - El canvas se RE-MIDE con un ResizeObserver, no sólo al montar. Si su caja cambia
 *   después —girar el teléfono para firmar más cómodo, que es lo que hace la gente; el
 *   teclado que se cierra al pasar del último campo; un alto en unidades de viewport
 *   dinámicas que cambia cuando el navegador esconde la barra de direcciones— el bitmap
 *   conserva su resolución vieja y la firma sale desplazada del dedo. Y ésta es la pieza
 *   que se ata al hash del acta.
 * - `.lienzo-firma-area` no puede recibir un alto en dvh, svh ni lvh, por lo mismo.
 */
export function LienzoFirma({
  alCambiar,
  refCanvas,
}: {
  alCambiar: (hayTrazo: boolean) => void
  /**
   * El canvas se entrega por referencia y NO se busca por su clase.
   *
   * Un querySelector sobre un nombre de clase convertiría ese nombre en API: hoy no hay
   * ni uno en todo el proyecto, y eso es justamente lo que permite renombrar clases
   * libremente al trabajar el aspecto. Ver docs/CONTRATO-UI.md.
   */
  refCanvas: RefObject<HTMLCanvasElement | null>
}) {
  const canvas = refCanvas
  const contenedor = useRef<HTMLDivElement | null>(null)
  const dibujando = useRef(false)
  /** Los trazos en coordenadas del lienzo, para poder re-dibujarlos al re-medir. */
  const trazos = useRef<Array<Array<[number, number]>>>([])
  const [hayTrazo, setHayTrazo] = useState(false)

  const repintar = useCallback(() => {
    const c = canvas.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#14171c'
    for (const trazo of trazos.current) {
      if (trazo.length < 2) continue
      ctx.beginPath()
      ctx.moveTo(trazo[0][0] * c.width, trazo[0][1] * c.height)
      for (const [x, y] of trazo.slice(1)) ctx.lineTo(x * c.width, y * c.height)
      ctx.stroke()
    }
  }, [])

  useEffect(() => {
    const caja = contenedor.current
    const c = canvas.current
    if (!caja || !c) return

    const medir = () => {
      const r = caja.getBoundingClientRect()
      const escala = window.devicePixelRatio || 1
      const ancho = Math.max(1, Math.round(r.width * escala))
      const alto = Math.max(1, Math.round(r.height * escala))
      if (c.width === ancho && c.height === alto) return
      c.width = ancho
      c.height = alto
      // Los trazos se guardan en proporción, así que sobreviven al cambio de tamaño.
      repintar()
    }

    medir()
    const observador = new ResizeObserver(medir)
    observador.observe(caja)
    return () => observador.disconnect()
  }, [repintar])

  function punto(e: React.PointerEvent<HTMLCanvasElement>): [number, number] {
    const c = canvas.current!
    const r = c.getBoundingClientRect()
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]
  }

  function empezar(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dibujando.current = true
    trazos.current.push([punto(e)])
  }

  function mover(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!dibujando.current) return
    trazos.current[trazos.current.length - 1].push(punto(e))
    repintar()
  }

  function terminar() {
    if (!dibujando.current) return
    dibujando.current = false
    const hay = trazos.current.some((t) => t.length > 3)
    setHayTrazo(hay)
    alCambiar(hay)
  }

  function borrar() {
    trazos.current = []
    repintar()
    setHayTrazo(false)
    alCambiar(false)
  }

  return (
    <div className="firma-digital">
      <div className="lienzo-firma-area" ref={contenedor}>
        <canvas
          ref={canvas}
          className="lienzo-firma"
          aria-label="Área para dibujar la firma"
          onPointerDown={empezar}
          onPointerMove={mover}
          onPointerUp={terminar}
          onPointerCancel={terminar}
        />
      </div>
      <button className="omitir firma-borrar" onClick={borrar} disabled={!hayTrazo}>
        Borrar y firmar de nuevo
      </button>
    </div>
  )
}

/** Extrae el PNG del lienzo que se le pase. Devuelve null si no hay canvas. */
export function pngDelLienzo(c: HTMLCanvasElement | null): Promise<Blob | null> {
  if (!c) return Promise.resolve(null)
  return new Promise((resolver) => c.toBlob((b) => resolver(b), 'image/png'))
}
