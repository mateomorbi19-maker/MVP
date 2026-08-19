/**
 * Geocodificación inversa y mapa del lugar.
 *
 * Nominatim (OpenStreetMap) para pasar de coordenadas a dirección, y los tiles de OSM
 * para el mapa que se incrusta en el PDF. Ambos gratuitos.
 *
 * Nota de uso responsable: la política de Nominatim y de los tiles de OSM pide un
 * User-Agent identificable y volumen bajo. Para producción con volumen real hay que
 * pasar a un proveedor propio o a un servidor de tiles autohospedado.
 */

const UA = 'ActaDigitalSiniestro/1.0 (MVP siniestros viales)'

export interface Ubicacion {
  lat: number
  lon: number
  precision_m: number | null
  capturado_en: string
}

export async function direccionDeCoordenadas(lat: number, lon: number): Promise<string | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'jsonv2',
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'es',
  })
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': UA },
    })
    if (!res.ok) return null
    const d = await res.json()
    if (typeof d?.display_name === 'string') return d.display_name
    return null
  } catch {
    return null
  }
}

/* ---------- Mapa del lugar para el PDF ---------- */

const TAM_TILE = 256

function lonATileX(lon: number, z: number): number {
  return ((lon + 180) / 360) * Math.pow(2, z)
}

function latATileY(lat: number, z: number): number {
  const rad = (lat * Math.PI) / 180
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * Math.pow(2, z)
}

export interface TileMapa {
  bytes: Uint8Array
  /** Posición del tile dentro de la grilla, en píxeles desde la esquina superior izquierda. */
  x: number
  y: number
}

export interface MapaLugar {
  tiles: TileMapa[]
  ancho: number
  alto: number
  /** Posición del punto exacto del siniestro dentro de la imagen compuesta. */
  marcador: { x: number; y: number }
  zoom: number
  atribucion: string
}

/**
 * Descarga una grilla de 3x3 tiles alrededor del punto. No se componen en una sola
 * imagen: se dibujan uno al lado del otro en el PDF, que es más simple y evita
 * depender de una librería de procesamiento de imágenes.
 */
export async function mapaDelLugar(lat: number, lon: number, zoom = 17): Promise<MapaLugar | null> {
  try {
    const fx = lonATileX(lon, zoom)
    const fy = latATileY(lat, zoom)
    const cx = Math.floor(fx)
    const cy = Math.floor(fy)

    const pedidos: Array<Promise<TileMapa | null>> = []
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const tx = cx + dx
        const ty = cy + dy
        const url = `https://tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`
        pedidos.push(
          fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': UA } })
            .then(async (r) => {
              if (!r.ok) return null
              const buf = new Uint8Array(await r.arrayBuffer())
              return { bytes: buf, x: (dx + 1) * TAM_TILE, y: (dy + 1) * TAM_TILE }
            })
            .catch(() => null),
        )
      }
    }

    const tiles = (await Promise.all(pedidos)).filter((t): t is TileMapa => t !== null)
    if (tiles.length === 0) return null

    // Desplazamiento del punto exacto dentro del tile central.
    const offX = (fx - cx) * TAM_TILE
    const offY = (fy - cy) * TAM_TILE

    return {
      tiles,
      ancho: TAM_TILE * 3,
      alto: TAM_TILE * 3,
      marcador: { x: TAM_TILE + offX, y: TAM_TILE + offY },
      zoom,
      atribucion: 'Mapa: OpenStreetMap contributors (ODbL)',
    }
  } catch {
    return null
  }
}

/** Compara la calle declarada contra la dirección real, tolerando errores de tipeo. */
export function calleCoincide(declarada: string, real: string): boolean {
  const normalizar = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')

  const vacias = new Set([
    'av', 'avda', 'avenida', 'calle', 'ruta', 'pasaje', 'diagonal', 'boulevard', 'bv',
    'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e', 'san', 'santa', 'dr', 'gral',
    'argentina', 'buenos', 'aires', 'provincia', 'partido', 'altura', 'esquina', 'esq',
  ])

  const tokens = (s: string) =>
    new Set(
      normalizar(s)
        .split(/\s+/)
        .filter((t) => t.length >= 4 && !vacias.has(t)),
    )

  const a = tokens(declarada)
  const b = tokens(real)
  if (a.size === 0) return true // nada significativo que contrastar
  for (const t of a) if (b.has(t)) return true
  return false
}
