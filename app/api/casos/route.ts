import { NextResponse } from 'next/server'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { listarCasos } from '@/lib/casos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Alta de una actuación. Es el primer eslabón de la cadena de custodia. */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const id = nuevoId()
    const pg = await db()

    const limpiar = (v: unknown, max = 120): string | null => {
      if (typeof v !== 'string') return null
      const s = v.trim().slice(0, max)
      return s.length > 0 ? s : null
    }

    await pg.query(
      `INSERT INTO casos (id, poliza, patente, asegurado, telefono)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        id,
        limpiar(cuerpo.poliza),
        limpiar(cuerpo.patente, 15)?.toUpperCase() ?? null,
        limpiar(cuerpo.asegurado),
        limpiar(cuerpo.telefono, 40),
      ],
    )

    await registrarEvento(id, 'apertura_actuacion', {
      poliza: limpiar(cuerpo.poliza),
      patente: limpiar(cuerpo.patente, 15)?.toUpperCase() ?? null,
      user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
    })

    return NextResponse.json({ id }, { status: 201 })
  } catch (err) {
    console.error('[casos:POST]', err)
    return NextResponse.json({ error: 'No se pudo crear la actuación.' }, { status: 500 })
  }
}

/** Listado para el panel de la aseguradora. */
export async function GET() {
  try {
    const casos = await listarCasos()
    return NextResponse.json(
      casos.map((c) => ({
        id: c.id,
        creado_en: c.creado_en,
        cerrado_en: c.cerrado_en,
        estado: c.estado,
        poliza: c.poliza,
        patente: c.patente,
        asegurado: c.asegurado,
        direccion: c.direccion,
        resumen: c.consistencia?.resumen ?? null,
      })),
    )
  } catch (err) {
    console.error('[casos:GET]', err)
    return NextResponse.json({ error: 'No se pudo leer el listado.' }, { status: 500 })
  }
}
