/**
 * Condiciones meteorológicas objetivas en el punto y hora del siniestro.
 *
 * Fuente: Open-Meteo (open-meteo.com) — gratuita, sin API key, basada en el reanálisis
 * ERA5 y en modelos meteorológicos nacionales. Es la pata objetiva contra la que se
 * contrasta lo que declaró el conductor.
 */

export interface Clima {
  fuente: string
  consultado_en: string
  hora_observada: string
  temperatura_c: number | null
  precipitacion_mm: number | null
  precipitacion_3h_mm: number | null
  humedad_pct: number | null
  viento_kmh: number | null
  rafaga_kmh: number | null
  visibilidad_m: number | null
  codigo_wmo: number | null
  descripcion: string
  amanecer: string | null
  atardecer: string | null
  es_de_dia: boolean | null
  zona_horaria: string | null
}

/** Códigos WMO usados por Open-Meteo. */
const WMO: Record<number, string> = {
  0: 'Despejado',
  1: 'Mayormente despejado',
  2: 'Parcialmente nublado',
  3: 'Nublado',
  45: 'Niebla',
  48: 'Niebla con escarcha',
  51: 'Llovizna leve',
  53: 'Llovizna moderada',
  55: 'Llovizna intensa',
  56: 'Llovizna helada leve',
  57: 'Llovizna helada intensa',
  61: 'Lluvia leve',
  63: 'Lluvia moderada',
  65: 'Lluvia fuerte',
  66: 'Lluvia helada leve',
  67: 'Lluvia helada fuerte',
  71: 'Nevada leve',
  73: 'Nevada moderada',
  75: 'Nevada intensa',
  77: 'Granos de nieve',
  80: 'Chaparrones leves',
  81: 'Chaparrones moderados',
  82: 'Chaparrones violentos',
  85: 'Chaparrones de nieve leves',
  86: 'Chaparrones de nieve intensos',
  95: 'Tormenta eléctrica',
  96: 'Tormenta con granizo leve',
  99: 'Tormenta con granizo intenso',
}

/** Índice de la hora más cercana al momento buscado dentro del array horario. */
function indiceHora(horas: string[], objetivo: Date): number {
  let mejor = 0
  let mejorDist = Infinity
  for (let i = 0; i < horas.length; i++) {
    const d = Math.abs(new Date(horas[i]).getTime() - objetivo.getTime())
    if (d < mejorDist) {
      mejorDist = d
      mejor = i
    }
  }
  return mejor
}

export async function consultarClima(lat: number, lon: number, momento: Date = new Date()): Promise<Clima | null> {
  const params = new URLSearchParams({
    latitude: lat.toFixed(5),
    longitude: lon.toFixed(5),
    hourly: 'temperature_2m,relative_humidity_2m,precipitation,weather_code,visibility,wind_speed_10m,wind_gusts_10m',
    daily: 'sunrise,sunset',
    timezone: 'auto',
    past_days: '2',
    forecast_days: '1',
  })

  try {
    const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'ActaDigitalSiniestro/1.0' },
    })
    if (!res.ok) return null
    const d = await res.json()

    const horas: string[] = d?.hourly?.time ?? []
    if (horas.length === 0) return null
    const i = indiceHora(horas, momento)
    const num = (arr: unknown, idx: number): number | null => {
      const v = Array.isArray(arr) ? arr[idx] : null
      return typeof v === 'number' ? v : null
    }

    const precip = num(d.hourly.precipitation, i)
    const precip3h = [i, i - 1, i - 2]
      .filter((k) => k >= 0)
      .reduce<number>((acc, k) => acc + (num(d.hourly.precipitation, k) ?? 0), 0)

    const codigo = num(d.hourly.weather_code, i)

    // Sol del día correspondiente al momento consultado.
    const dias: string[] = d?.daily?.time ?? []
    const fechaObjetivo = horas[i].slice(0, 10)
    const di = Math.max(0, dias.indexOf(fechaObjetivo))
    const amanecer: string | null = d?.daily?.sunrise?.[di] ?? null
    const atardecer: string | null = d?.daily?.sunset?.[di] ?? null

    let esDeDia: boolean | null = null
    if (amanecer && atardecer) {
      // Todas las marcas vienen en la zona horaria local del punto, sin offset.
      const t = horas[i]
      esDeDia = t >= amanecer && t <= atardecer
    }

    return {
      fuente: 'Open-Meteo (open-meteo.com)',
      consultado_en: new Date().toISOString(),
      hora_observada: horas[i],
      temperatura_c: num(d.hourly.temperature_2m, i),
      precipitacion_mm: precip,
      precipitacion_3h_mm: Number(precip3h.toFixed(2)),
      humedad_pct: num(d.hourly.relative_humidity_2m, i),
      viento_kmh: num(d.hourly.wind_speed_10m, i),
      rafaga_kmh: num(d.hourly.wind_gusts_10m, i),
      visibilidad_m: num(d.hourly.visibility, i),
      codigo_wmo: codigo,
      descripcion: codigo !== null ? (WMO[codigo] ?? `Código WMO ${codigo}`) : 'Sin dato',
      amanecer,
      atardecer,
      es_de_dia: esDeDia,
      zona_horaria: d?.timezone ?? null,
    }
  } catch {
    // El clima es complementario: si la API no responde, el expediente igual se genera.
    return null
  }
}
