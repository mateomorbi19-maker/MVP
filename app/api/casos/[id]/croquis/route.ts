import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { canonico, registrarEvento, sha256 } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'
import { exigirAccesoCaso } from '@/lib/posesion'
import { limpiarCroquis } from '@/lib/croquis'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Guarda o reemplaza entero el croquis del hecho.
 *
 * Reemplazo total y nunca parcial: un dibujo no se parchea campo por campo, y un croquis a
 * medio corregir se imprime igual en el expediente, donde se lee como una declaración.
 *
 * El eslabón guarda el sha256 del croquis canonicalizado. La columna, como respuestas o
 * gps, no está protegida por el disparador de inmutabilidad —eso protege la tabla de
 * eventos—, así que ese hash es lo que permite demostrar después que el dibujo que se
 * imprime es el que se declaró.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json({ error: 'La actuación ya fue cerrada y sellada.' }, { status: 409 })
    }

    const cuerpo = await req.json().catch(() => ({}))
    const croquis = limpiarCroquis(cuerpo?.croquis)
    if (!croquis) {
      return NextResponse.json(
        { error: 'El croquis llegó incompleto o con posiciones fuera del plano. Volvé a armarlo.' },
        { status: 400 },
      )
    }

    const pg = await db()
    await pg.query('UPDATE casos SET croquis = $2 WHERE id = $1', [id, JSON.stringify(croquis)])
    await registrarEvento(id, 'croquis_registrado', {
      origen: croquis.origen,
      plantilla: croquis.plantilla,
      cruce: croquis.cruce,
      sha256: sha256(canonico(croquis)),
    })

    return NextResponse.json({ ok: true, croquis })
  } catch (err) {
    return errorApi('croquis:POST', err, 'No se pudo guardar el croquis.')
  }
}
