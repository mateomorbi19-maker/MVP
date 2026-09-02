import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { canonico, registrarEvento, sha256 } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * El tercero se identifica desde su propio teléfono, con consentimiento expreso.
 *
 * Público a propósito, igual que el alta de testigos: el tercero es alguien que está
 * parado al lado de un auto chocado y se quiere ir. Pedirle una cuenta es garantizar que
 * no cargue nada.
 *
 * Lo que consiente es que sus datos entren al expediente. NO reconoce responsabilidad ni
 * acepta la versión del hecho de la otra parte, que ni siquiera se le muestra, y el texto
 * de la pantalla lo dice con todas las letras.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json({ error: 'La actuación ya fue cerrada y sellada.' }, { status: 409 })
    }

    const cuerpo = await req.json().catch(() => ({}))
    const limpio = (v: unknown, largo: number) =>
      typeof v === 'string' && v.trim() ? v.trim().slice(0, largo) : null

    const nombre = limpio(cuerpo?.nombre, 120)
    if (!nombre) return NextResponse.json({ error: 'Necesitamos al menos el nombre.' }, { status: 400 })
    if (cuerpo?.consentimiento !== true) {
      return NextResponse.json({ error: 'Sin el consentimiento no podemos registrar los datos.' }, { status: 400 })
    }

    const lat = Number(cuerpo?.lat)
    const lon = Number(cuerpo?.lon)
    const gps = Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null

    const registro = {
      caso_id: id,
      nombre,
      dni: limpio(cuerpo?.dni, 20),
      telefono: limpio(cuerpo?.telefono, 40),
      domicilio: limpio(cuerpo?.domicilio, 200),
      patente: limpio(cuerpo?.patente, 15),
      marca_modelo: limpio(cuerpo?.marca_modelo, 120),
      aseguradora: limpio(cuerpo?.aseguradora, 120),
      poliza: limpio(cuerpo?.poliza, 120),
      licencia: limpio(cuerpo?.licencia, 40),
      consentimiento: true,
      // Queda asentado si lo cargó él o si se usó el teléfono del asegurado: el sistema
      // registra el acto de carga, no la identidad de quien cargó, y hay que decirlo.
      dispositivo: cuerpo?.dispositivo === 'del_asegurado' ? 'del_asegurado' : 'del_tercero',
      gps,
    }
    const huella = sha256(canonico(registro))
    const terceroId = nuevoId('TRC')

    const pg = await db()
    await pg.query(
      `INSERT INTO terceros (id, caso_id, nombre, dni, telefono, domicilio, patente, marca_modelo,
                             aseguradora, poliza, licencia, consentimiento, dispositivo, gps, sha256)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14)`,
      [
        terceroId,
        id,
        registro.nombre,
        registro.dni,
        registro.telefono,
        registro.domicilio,
        registro.patente,
        registro.marca_modelo,
        registro.aseguradora,
        registro.poliza,
        registro.licencia,
        registro.dispositivo,
        gps ? JSON.stringify(gps) : null,
        huella,
      ],
    )

    await registrarEvento(
      id,
      'tercero_identificado',
      { tercero_id: terceroId, dispositivo: registro.dispositivo, consentimiento: true, sha256: huella },
      { reservado: { nombre: registro.nombre, dni: registro.dni, patente: registro.patente, gps } },
    )

    return NextResponse.json({ ok: true, id: terceroId, sha256: huella }, { status: 201 })
  } catch (err) {
    return errorApi('terceros:POST', err, 'No se pudieron registrar los datos del otro conductor.')
  }
}
