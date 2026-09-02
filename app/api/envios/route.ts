import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { exigirAccesoCaso } from '@/lib/posesion'
import { listarEnvios } from '@/lib/entregas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Qué se mandó de una actuación, a quién, cuándo, y si falló. */
export async function GET(req: Request) {
  try {
    const caso = new URL(req.url).searchParams.get('caso')
    if (!caso) return NextResponse.json({ error: 'Falta el número de actuación.' }, { status: 400 })
    await exigirAccesoCaso(caso)
    return NextResponse.json(await listarEnvios(caso))
  } catch (err) {
    return errorApi('envios:GET', err, 'No se pudieron leer los envíos.')
  }
}
