import { NextResponse } from 'next/server'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento, sha256, canonico } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Carga de un testigo desde SU PROPIO teléfono, tras escanear el QR.
 *
 * Que los datos los ingrese el testigo y no el conductor es lo que le da valor:
 * queda registrado el consentimiento expreso (Ley 25.326) y el acto de carga propio,
 * en lugar de un nombre anotado por la parte interesada.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json({ error: 'La actuación ya fue cerrada y no admite nuevos testigos.' }, { status: 409 })
    }

    const cuerpo = await req.json().catch(() => ({}))
    const limpiar = (v: unknown, max: number): string | null => {
      if (typeof v !== 'string') return null
      const s = v.trim().slice(0, max)
      return s.length > 0 ? s : null
    }

    const nombre = limpiar(cuerpo.nombre, 120)
    if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio.' }, { status: 400 })
    if (cuerpo.consentimiento !== true) {
      return NextResponse.json({ error: 'Sin consentimiento expreso no se registran los datos.' }, { status: 400 })
    }

    const lat = Number(cuerpo?.lat)
    const lon = Number(cuerpo?.lon)
    const gps = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null

    const testigoId = nuevoId('TST')
    const creado_en = new Date().toISOString()
    const registro = {
      id: testigoId,
      caso_id: id,
      nombre,
      dni: limpiar(cuerpo.dni, 20),
      telefono: limpiar(cuerpo.telefono, 40),
      relato: limpiar(cuerpo.relato, 2000),
      consentimiento: true,
      gps,
      creado_en,
    }
    const huella = sha256(canonico(registro))

    const pg = await db()
    await pg.query(
      `INSERT INTO testigos (id, caso_id, nombre, dni, telefono, relato, consentimiento, gps, creado_en, sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        testigoId,
        id,
        registro.nombre,
        registro.dni,
        registro.telefono,
        registro.relato,
        true,
        gps ? JSON.stringify(gps) : null,
        creado_en,
        huella,
      ],
    )

    await registrarEvento(id, 'testigo_registrado', {
      testigo_id: testigoId,
      nombre: registro.nombre,
      sha256: huella,
      consentimiento: true,
      gps,
    })

    return NextResponse.json({ id: testigoId, sha256: huella }, { status: 201 })
  } catch (err) {
    console.error('[testigos:POST]', err)
    return NextResponse.json({ error: 'No se pudo registrar el testigo.' }, { status: 500 })
  }
}
