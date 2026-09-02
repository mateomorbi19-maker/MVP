import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { exigirAccesoCaso } from '@/lib/posesion'
import { vistaParaAsegurado } from '@/lib/extraccion'
import { reencolarPendientes } from '@/lib/cola-extraccion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Las lecturas del caso, traducidas a lo que ve el asegurado.
 *
 * El porcentaje de confianza NO viaja acá: cada campo llega como «verificado» o «revisar».
 * La especificación funcional lo pide expresamente, y el motivo es bueno: un número que la
 * persona no sabe interpretar genera dudas legales sin aportar nada de uso. El número
 * queda en la base, en el eslabón de la cadena y en el panel de la aseguradora.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const pg = await db()
    const res = await pg.query(
      `SELECT id, guia_id, tipo_documento, estado, simulado, campos, confianza_global, error, confirmacion, creado_en
         FROM extracciones WHERE caso_id = $1 ORDER BY creado_en ASC`,
      [id],
    )

    // Si se repitió una toma hay dos lecturas de la misma guía: gana la última, el mismo
    // criterio que ya usa la pantalla de fotos.
    const porGuia = new Map<string, Record<string, unknown>>()
    for (const f of res.rows) porGuia.set(f.guia_id ?? f.id, f)

    return NextResponse.json(
      [...porGuia.values()].map((f) => ({
        id: f.id,
        guia_id: f.guia_id,
        tipo_documento: f.tipo_documento,
        estado: f.estado,
        simulado: Boolean(f.simulado),
        error: f.error ?? null,
        confirmada: Boolean(f.confirmacion),
        creado_en: new Date(f.creado_en as string).toISOString(),
        campos:
          f.estado === 'lista'
            ? vistaParaAsegurado({
                campos: (f.campos ?? []) as never,
                confianza_global: Number(f.confianza_global ?? 0),
                simulado: Boolean(f.simulado),
              })
            : [],
      })),
    )
  } catch (err) {
    return errorApi('extracciones:GET', err, 'No se pudieron leer los datos detectados.')
  }
}

/** Reencola lo que quedó pendiente o falló. Sin cuerpo. */
export async function POST(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    return NextResponse.json({ ok: true, reencoladas: await reencolarPendientes(id) })
  } catch (err) {
    return errorApi('extracciones:POST', err, 'No se pudo reintentar la lectura.')
  }
}
