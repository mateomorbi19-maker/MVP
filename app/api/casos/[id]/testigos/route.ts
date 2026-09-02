import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
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

    /*
     * La fila y su eslabón van en LA MISMA transacción, y no es prolijidad.
     *
     * La fila del testigo entra al manifiesto como una pieza. Insertándola aparte, una
     * carga que llega justo mientras se cierra la actuación deja la fila escrita y el
     * eslabón rechazado: la pieza aparece en el manifiesto recalculado pero no estaba
     * cuando se selló, y el verificador público informa como ALTERADO un expediente que
     * nadie tocó. Con la transacción, si el eslabón no entra, la fila tampoco.
     */
    const pg = await db()
    const cliente = await pg.connect()
    try {
      await cliente.query('BEGIN')
      await cliente.query(
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

      /*
       * El nombre del testigo y sus coordenadas van reservados. Es lo que hace cumplible la
       * supresión que la propia pantalla de carga le promete: con el nombre dentro del hash,
       * borrarlo rompía la verificación del expediente entero.
       */
      await registrarEvento(
        id,
        'testigo_registrado',
        { testigo_id: testigoId, sha256: huella, consentimiento: true },
        { reservado: { nombre: registro.nombre, gps }, cliente },
      )
      await cliente.query('COMMIT')
    } catch (err) {
      await cliente.query('ROLLBACK').catch(() => {})
      throw err
    } finally {
      cliente.release()
    }

    return NextResponse.json({ id: testigoId, sha256: huella }, { status: 201 })
  } catch (err) {
    return errorApi('testigos:POST', err, 'No se pudo registrar el testigo.')
  }
}
