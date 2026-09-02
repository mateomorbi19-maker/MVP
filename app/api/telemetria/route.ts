import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { leerSesion } from '@/lib/sesion'
import { analizarImpacto, type Lectura } from '@/lib/impacto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX = Number(process.env.TELEMETRIA_MAX_MUESTRAS || 1500)

/**
 * Ingesta de una serie de sensores, agnóstica del origen.
 *
 * Hoy la escribe el navegador; mañana puede escribirla un envoltorio nativo sin que el
 * servidor cambie una línea. Por eso `origen` es un campo más y no hay ninguna suposición
 * sobre de dónde vino.
 *
 * El veredicto se vuelve a calcular ACÁ, con los umbrales del servidor. El del cliente se
 * ignora: un cliente puede estar desactualizado, o modificado.
 */
export async function POST(req: Request) {
  try {
    const sesion = await leerSesion()
    const cuerpo = await req.json().catch(() => ({}))
    const serie = Array.isArray(cuerpo?.serie) ? (cuerpo.serie.slice(0, MAX) as Lectura[]) : []
    if (serie.length === 0) return NextResponse.json({ error: 'La serie llegó vacía.' }, { status: 400 })

    const veredicto = analizarImpacto(serie)
    const id = nuevoId('TEL')
    const lat = Number(cuerpo?.lat)
    const lon = Number(cuerpo?.lon)

    const pg = await db()
    await pg.query(
      `INSERT INTO telemetria (id, usuario_id, ts, origen, nivel, pico_g, veredicto, gps)
       VALUES ($1,$2, now(), $3,$4,$5,$6,$7)`,
      [
        id,
        sesion?.usuario_id ?? null,
        typeof cuerpo?.origen === 'string' ? cuerpo.origen.slice(0, 40) : 'navegador',
        veredicto.nivel,
        veredicto.picoG,
        JSON.stringify(veredicto),
        Number.isFinite(lat) && Number.isFinite(lon) ? JSON.stringify({ lat, lon }) : null,
      ],
    )

    return NextResponse.json({ ok: true, id, veredicto }, { status: 201 })
  } catch (err) {
    return errorApi('telemetria:POST', err, 'No se pudo registrar la lectura de los sensores.')
  }
}
