/**
 * El croquis del hecho.
 *
 * Un lienzo cuadrado de 100 × 100 unidades, con el origen en la esquina SUPERIOR
 * IZQUIERDA y la Y hacia abajo. Es la convención de SVG y la de los eventos de puntero,
 * así que el arrastre del paso 2 no va a tener que invertir nada. La escala es fija:
 * 1 unidad = 0,20 m, o sea 20 × 20 metros de calle, que es lo que entra en un cruce.
 *
 * La pieza que hace que el MISMO dato se dibuje igual en el navegador y en el expediente
 * es `figurasDelCroquis`: devuelve trazos como cadenas `d` de path de SVG en unidades del
 * lienzo. El visor las mete en un <svg viewBox="0 0 100 100"> y el PDF las pasa tal cual a
 * drawSvgPath de pdf-lib, que interpreta el path con la Y hacia abajo desde el punto que
 * se le da. Cero geometría duplicada y ninguna biblioteca de dibujo nueva.
 *
 * Se guarda en una columna propia de `casos` y NO como una respuesta más del cuestionario:
 * `respuestas` es un mapa plano de id a escalar que tres consumidores genéricos imprimen
 * como texto, y un objeto anidado ahí sale «[object Object]» en el expediente.
 *
 * SOBRE LO QUE ESTO NO ES, y hay que decirlo en las dos vistas y en el PDF: un croquis
 * armado eligiendo una situación típica de una lista es una DECLARACIÓN del conductor, no
 * una reconstrucción. Las posiciones son aproximadas y no salen de ninguna medición.
 */

export const LADO = 100
export const METROS_POR_UNIDAD = 0.2

/** Un vehículo del dibujo. No confundir con el rol de una cuenta: ver lib/sesion.ts. */
export type RolCroquis = 'propio' | 'otro'

export interface VehiculoCroquis {
  rol: RolCroquis
  /** Centro del vehículo, en unidades del lienzo. */
  x: number
  y: number
  /** Grados. 0 apunta hacia arriba del lienzo; crece en el sentido de las agujas. */
  rumbo: number
}

export type TipoCruce = 'esquina' | 'recta' | 'rotonda' | 'estacionamiento'

export interface Croquis {
  version: 1
  /** 'plantilla' en el paso 1; 'arrastre' cuando se pueda mover a dedo. Mismo formato. */
  origen: 'plantilla' | 'arrastre'
  plantilla: string | null
  cruce: TipoCruce
  vehiculos: VehiculoCroquis[]
  impacto: { x: number; y: number }
  /** Aclaración libre del declarante. */
  nota: string | null
}

/* ================= Geometría ================= */

/** Un auto de calle: 4,3 m × 1,8 m, en unidades del lienzo. */
const LARGO_AUTO = 4.3 / METROS_POR_UNIDAD
const ANCHO_AUTO = 1.8 / METROS_POR_UNIDAD

const redondear = (n: number) => Math.round(n * 100) / 100

function rectangioRotado(cx: number, cy: number, ancho: number, largo: number, grados: number): string {
  const rad = (grados * Math.PI) / 180
  const cos = Math.cos(rad)
  const sen = Math.sin(rad)
  const mitadA = ancho / 2
  const mitadL = largo / 2
  // Sin rotar, el vehículo apunta hacia arriba: su largo va sobre la Y.
  const esquinas: Array<[number, number]> = [
    [-mitadA, -mitadL],
    [mitadA, -mitadL],
    [mitadA, mitadL],
    [-mitadA, mitadL],
  ]
  const puntos = esquinas.map(([px, py]) => {
    const x = cx + px * cos - py * sen
    const y = cy + px * sen + py * cos
    return `${redondear(x)} ${redondear(y)}`
  })
  return `M ${puntos[0]} L ${puntos[1]} L ${puntos[2]} L ${puntos[3]} Z`
}

export interface Figura {
  tipo: 'calzada' | 'linea' | 'vehiculo' | 'impacto' | 'flecha'
  /** Path de SVG en unidades del lienzo. */
  d: string
  rol?: RolCroquis
}

/** El dibujo de la calle según el tipo de cruce. */
function figurasDeCalle(cruce: TipoCruce): Figura[] {
  const anchoCalle = 30
  const a = (LADO - anchoCalle) / 2
  const b = a + anchoCalle

  if (cruce === 'recta') {
    return [
      { tipo: 'calzada', d: `M 0 ${a} L ${LADO} ${a} L ${LADO} ${b} L 0 ${b} Z` },
      { tipo: 'linea', d: `M 0 ${LADO / 2} L ${LADO} ${LADO / 2}` },
    ]
  }
  if (cruce === 'rotonda') {
    const r = 18
    const c = LADO / 2
    return [
      { tipo: 'calzada', d: `M 0 ${a} L ${LADO} ${a} L ${LADO} ${b} L 0 ${b} Z` },
      { tipo: 'calzada', d: `M ${a} 0 L ${b} 0 L ${b} ${LADO} L ${a} ${LADO} Z` },
      {
        tipo: 'linea',
        d: `M ${c - r} ${c} A ${r} ${r} 0 1 0 ${c + r} ${c} A ${r} ${r} 0 1 0 ${c - r} ${c}`,
      },
    ]
  }
  if (cruce === 'estacionamiento') {
    return [
      { tipo: 'calzada', d: `M 0 ${a} L ${LADO} ${a} L ${LADO} ${b} L 0 ${b} Z` },
      { tipo: 'linea', d: `M 0 ${b} L ${LADO} ${b}` },
      { tipo: 'linea', d: `M 25 ${b} L 25 ${LADO}` },
      { tipo: 'linea', d: `M 50 ${b} L 50 ${LADO}` },
      { tipo: 'linea', d: `M 75 ${b} L 75 ${LADO}` },
    ]
  }
  // esquina
  return [
    { tipo: 'calzada', d: `M 0 ${a} L ${LADO} ${a} L ${LADO} ${b} L 0 ${b} Z` },
    { tipo: 'calzada', d: `M ${a} 0 L ${b} 0 L ${b} ${LADO} L ${a} ${LADO} Z` },
    { tipo: 'linea', d: `M 0 ${LADO / 2} L ${a} ${LADO / 2}` },
    { tipo: 'linea', d: `M ${b} ${LADO / 2} L ${LADO} ${LADO / 2}` },
  ]
}

/**
 * Los trazos del croquis, en orden de dibujo.
 *
 * Es la única función que sabe geometría. El visor y el generador de PDF la consumen sin
 * calcular nada por su cuenta: si el dibujo del navegador y el del expediente difirieran,
 * el expediente estaría mostrando otra cosa que la que la persona declaró.
 */
export function figurasDelCroquis(croquis: Croquis): Figura[] {
  const figuras = figurasDeCalle(croquis.cruce)

  for (const v of croquis.vehiculos) {
    figuras.push({ tipo: 'vehiculo', rol: v.rol, d: rectangioRotado(v.x, v.y, ANCHO_AUTO, LARGO_AUTO, v.rumbo) })
    // Una marca en el frente, para que se vea hacia dónde apunta.
    const rad = (v.rumbo * Math.PI) / 180
    const fx = v.x + (LARGO_AUTO / 2) * Math.sin(rad)
    const fy = v.y - (LARGO_AUTO / 2) * Math.cos(rad)
    figuras.push({
      tipo: 'flecha',
      rol: v.rol,
      d: `M ${redondear(v.x)} ${redondear(v.y)} L ${redondear(fx)} ${redondear(fy)}`,
    })
  }

  const { x, y } = croquis.impacto
  const r = 4
  figuras.push({
    tipo: 'impacto',
    d: `M ${redondear(x - r)} ${redondear(y - r)} L ${redondear(x + r)} ${redondear(y + r)} M ${redondear(x + r)} ${redondear(y - r)} L ${redondear(x - r)} ${redondear(y + r)}`,
  })

  return figuras
}

/* ================= Plantillas ================= */

export interface Plantilla {
  id: string
  titulo: string
  croquis: Croquis
}

const c = (
  id: string,
  titulo: string,
  cruce: TipoCruce,
  propio: [number, number, number],
  otro: [number, number, number],
  impacto: [number, number],
): Plantilla => ({
  id,
  titulo,
  croquis: {
    version: 1,
    origen: 'plantilla',
    plantilla: id,
    cruce,
    vehiculos: [
      { rol: 'propio', x: propio[0], y: propio[1], rumbo: propio[2] },
      { rol: 'otro', x: otro[0], y: otro[1], rumbo: otro[2] },
    ],
    impacto: { x: impacto[0], y: impacto[1] },
    nota: null,
  },
})

/**
 * Ocho situaciones típicas.
 *
 * Cada una es un `Croquis` completo, del mismo formato que va a producir el arrastre: el
 * paso 2 reemplaza sólo el editor y escribe `origen: 'arrastre'` en la misma columna, sin
 * migrar un solo dato.
 */
export const PLANTILLAS: Plantilla[] = [
  c('cruce_perpendicular', 'En un cruce, uno venía por la calle transversal', 'esquina', [50, 72, 0], [72, 50, 270], [50, 50]),
  c('alcance', 'Me chocaron de atrás', 'recta', [60, 50, 90], [35, 50, 90], [47, 50]),
  c('alcance_propio', 'Choqué al de adelante', 'recta', [35, 50, 90], [62, 50, 90], [49, 50]),
  c('frontal', 'De frente, en sentidos contrarios', 'recta', [35, 58, 90], [65, 42, 270], [50, 50]),
  c('giro_izquierda', 'Uno giraba a la izquierda', 'esquina', [50, 68, 0], [50, 32, 180], [50, 50]),
  c('cambio_carril', 'Cambio de carril', 'recta', [45, 58, 90], [55, 43, 90], [50, 50]),
  c('rotonda', 'En una rotonda', 'rotonda', [50, 72, 0], [70, 50, 270], [56, 60]),
  c('estacionado', 'Estaba estacionado', 'estacionamiento', [50, 78, 0], [40, 50, 90], [48, 62]),
]

/* ================= Validación ================= */

const num = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max) return null
  return redondear(n)
}

/**
 * Normaliza lo que llega del cliente.
 *
 * Devuelve null ante cualquier cosa fuera de rango en vez de recortar: un croquis con un
 * vehículo a medio corregir es peor que no tener croquis, porque igual se imprime en el
 * expediente y ahí se lee como una declaración.
 */
export function limpiarCroquis(entrada: unknown): Croquis | null {
  const e = (entrada && typeof entrada === 'object' ? entrada : {}) as Record<string, unknown>

  const cruces: TipoCruce[] = ['esquina', 'recta', 'rotonda', 'estacionamiento']
  const cruce = cruces.includes(e.cruce as TipoCruce) ? (e.cruce as TipoCruce) : null
  if (!cruce) return null

  const crudos = Array.isArray(e.vehiculos) ? e.vehiculos : []
  if (crudos.length < 1 || crudos.length > 2) return null

  const vehiculos: VehiculoCroquis[] = []
  for (const v of crudos as Array<Record<string, unknown>>) {
    const x = num(v.x, 0, LADO)
    const y = num(v.y, 0, LADO)
    const rumbo = num(v.rumbo, -360, 720)
    if (x === null || y === null || rumbo === null) return null
    vehiculos.push({ rol: v.rol === 'otro' ? 'otro' : 'propio', x, y, rumbo: ((rumbo % 360) + 360) % 360 })
  }

  const impacto = (e.impacto && typeof e.impacto === 'object' ? e.impacto : {}) as Record<string, unknown>
  const ix = num(impacto.x, 0, LADO)
  const iy = num(impacto.y, 0, LADO)
  if (ix === null || iy === null) return null

  const nota = typeof e.nota === 'string' && e.nota.trim() ? e.nota.trim().slice(0, 400) : null

  return {
    version: 1,
    origen: e.origen === 'arrastre' ? 'arrastre' : 'plantilla',
    plantilla: typeof e.plantilla === 'string' ? e.plantilla.slice(0, 60) : null,
    cruce,
    vehiculos,
    impacto: { x: ix, y: iy },
    nota,
  }
}

/** El pie obligatorio. Va igual en la pantalla y en el expediente. */
export const PIE_CROQUIS =
  'Croquis declarativo compuesto por el conductor sobre una situación tipo. Las posiciones son aproximadas y no surgen de mediciones en el lugar. No es un peritaje ni una reconstrucción a escala.'
