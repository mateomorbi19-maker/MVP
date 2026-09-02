import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirAccesoCaso } from '@/lib/posesion'
import { db } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'
import { consultarClima } from '@/lib/clima'
import { direccionDeCoordenadas } from '@/lib/geo'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 30

type Ctx = { params: Promise<{ id: string }> }

/**
 * Registra la ubicación y, con ella, dispara la captura de los datos objetivos:
 * dirección real y condiciones meteorológicas de ese punto y esa hora.
 *
 * Es el momento clave del expediente: a partir de acá existe una referencia externa
 * contra la cual contrastar todo lo que se declare después.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json({ error: 'La actuación ya fue cerrada.' }, { status: 409 })
    }

    const cuerpo = await req.json().catch(() => ({}))
    const lat = Number(cuerpo?.lat)
    const lon = Number(cuerpo?.lon)
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
      return NextResponse.json({ error: 'Coordenadas inválidas.' }, { status: 400 })
    }

    const precision = Number(cuerpo?.precision_m)
    const gps = {
      lat,
      lon,
      precision_m: Number.isFinite(precision) ? precision : null,
      capturado_en: new Date().toISOString(),
    }

    // Ambas consultas son a servicios externos: se piden en paralelo y ninguna es bloqueante.
    const [direccion, clima] = await Promise.all([
      direccionDeCoordenadas(lat, lon),
      consultarClima(lat, lon, new Date()),
    ])

    const pg = await db()
    await pg.query('UPDATE casos SET gps = $2, direccion = $3, clima = $4 WHERE id = $1', [
      id,
      JSON.stringify(gps),
      direccion,
      clima ? JSON.stringify(clima) : null,
    ])

    await registrarEvento(id, 'ubicacion_registrada', {
      gps,
      direccion,
      clima_obtenido: clima !== null,
      clima_resumen: clima
        ? {
            descripcion: clima.descripcion,
            temperatura_c: clima.temperatura_c,
            precipitacion_mm: clima.precipitacion_mm,
            precipitacion_3h_mm: clima.precipitacion_3h_mm,
            es_de_dia: clima.es_de_dia,
            hora_observada: clima.hora_observada,
          }
        : null,
    })

    return NextResponse.json({ ok: true, gps, direccion, clima })
  } catch (err) {
    return errorApi('ubicacion:POST', err, 'No se pudo registrar la ubicación.')
  }
}
