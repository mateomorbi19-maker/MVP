import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db } from '@/lib/db'
import { registrarEvento } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'
import { exigirAccesoCaso } from '@/lib/posesion'
import { MAPEO, vistaParaAsegurado } from '@/lib/extraccion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string; extraccionId: string }> }

/**
 * Convierte la lectura de la máquina en una declaración de la persona.
 *
 * Lo que la persona manda son VALORES, no acciones: el servidor deriva por su cuenta si
 * cada uno coincide con lo que leyó la máquina o no, comparando contra la lectura
 * guardada. Un cliente modificado podría mandar los valores de la lectura tal cual, así
 * que la garantía de este módulo NO es «la persona tipeó cada campo» —eso no es
 * demostrable desde el servidor— sino «el expediente dice exactamente qué coincidió con la
 * lectura automática y qué no». Conviene que el abogado lo lea así.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id, extraccionId } = await params
  try {
    await exigirAccesoCaso(id)
    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'Actuación inexistente.' }, { status: 404 })
    if (caso.estado === 'cerrado') {
      return NextResponse.json({ error: 'La actuación ya fue cerrada y sellada.' }, { status: 409 })
    }

    const pg = await db()
    const res = await pg.query(
      `SELECT campos, confianza_global, simulado, estado FROM extracciones WHERE id = $1 AND caso_id = $2`,
      [extraccionId, id],
    )
    const fila = res.rows[0]
    if (!fila) return NextResponse.json({ error: 'Esa lectura no existe.' }, { status: 404 })
    if (fila.estado !== 'lista') {
      return NextResponse.json({ error: 'Esa lectura todavía no terminó.' }, { status: 409 })
    }

    const lectura = vistaParaAsegurado({
      campos: (fila.campos ?? []) as never,
      confianza_global: Number(fila.confianza_global ?? 0),
      simulado: Boolean(fila.simulado),
    })

    const cuerpo = await req.json().catch(() => ({}))
    const valores = (cuerpo?.valores ?? {}) as Record<string, unknown>

    const respuestas = { ...caso.respuestas }
    const confirmacion: Array<{ clave: string; valor: string; accion: 'aceptado' | 'corregido' | 'descartado' }> = []

    for (const campo of lectura) {
      const crudo = valores[campo.clave]
      const valor = typeof crudo === 'string' ? crudo.trim() : ''
      if (!valor) {
        confirmacion.push({ clave: campo.clave, valor: '', accion: 'descartado' })
        continue
      }
      confirmacion.push({
        clave: campo.clave,
        valor,
        accion: valor === campo.lectura ? 'aceptado' : 'corregido',
      })

      const m = MAPEO[campo.clave]
      if (!m) continue
      if (m.subclave) {
        const previo = (respuestas[m.pregunta] ?? {}) as Record<string, unknown>
        respuestas[m.pregunta] = { ...previo, [m.subclave]: valor }
      } else {
        respuestas[m.pregunta] = valor
      }
    }

    await pg.query('UPDATE casos SET respuestas = $2 WHERE id = $1', [id, JSON.stringify(respuestas)])
    await pg.query('UPDATE extracciones SET confirmacion = $2, confirmado_en = now() WHERE id = $1', [
      extraccionId,
      JSON.stringify(confirmacion),
    ])

    await registrarEvento(id, 'datos_tercero_confirmados', {
      extraccion_id: extraccionId,
      // Qué dijo la máquina y qué resolvió la persona, por separado y para cada campo.
      campos: confirmacion.map((c) => ({ clave: c.clave, accion: c.accion })),
    })

    return NextResponse.json({ ok: true, respuestas })
  } catch (err) {
    return errorApi('confirmar:POST', err, 'No se pudieron confirmar los datos.')
  }
}
