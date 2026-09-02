'use client'

import { useRef } from 'react'
import { LADO, figurasDelCroquis, type Croquis } from '@/lib/croquis'

/**
 * Dibuja el croquis y, si se le pasa `alTocar`, deja mover el punto de impacto.
 *
 * TRES COSAS QUE NO SE PUEDEN CAMBIAR, y el motivo de cada una:
 *
 * 1. El viewBox es 0 0 100 100 y `.croquis` declara aspect-ratio: 1. Si el SVG recibe una
 *    caja no cuadrada —width 100% con height fijo, o una tarjeta 16/9— el dibujo se
 *    apaisa dentro de la caja y aparece letterboxing.
 * 2. El toque se convierte con createSVGPoint y getScreenCTM, NO con
 *    getBoundingClientRect. Con el rectángulo, cualquier letterboxing desplaza el punto de
 *    impacto respecto de donde la persona apoyó el dedo: se guarda desplazado, se sella
 *    con su hash y se imprime así para siempre. No falla nada; dibuja mal.
 * 3. Los trazos salen de figurasDelCroquis y no se calculan acá: el expediente en PDF usa
 *    exactamente los mismos. Si divergieran, el documento mostraría otra cosa que la que
 *    la persona declaró.
 */
export function CroquisVisor({
  croquis,
  alTocar,
}: {
  croquis: Croquis
  alTocar?: (x: number, y: number) => void
}) {
  const svg = useRef<SVGSVGElement | null>(null)
  const figuras = figurasDelCroquis(croquis)

  function tocar(e: React.PointerEvent<SVGSVGElement>) {
    if (!alTocar || !svg.current) return
    const punto = svg.current.createSVGPoint()
    punto.x = e.clientX
    punto.y = e.clientY
    const matriz = svg.current.getScreenCTM()
    if (!matriz) return
    const enLienzo = punto.matrixTransform(matriz.inverse())
    alTocar(
      Math.min(LADO, Math.max(0, Math.round(enLienzo.x * 100) / 100)),
      Math.min(LADO, Math.max(0, Math.round(enLienzo.y * 100) / 100)),
    )
  }

  return (
    <svg
      ref={svg}
      className="croquis"
      viewBox={`0 0 ${LADO} ${LADO}`}
      role="img"
      aria-label="Croquis del hecho"
      onPointerDown={alTocar ? tocar : undefined}
      data-editable={Boolean(alTocar)}
    >
      {figuras.map((f, i) => (
        <path key={i} d={f.d} className={`croquis-${f.tipo}`} data-rol={f.rol} />
      ))}
    </svg>
  )
}
