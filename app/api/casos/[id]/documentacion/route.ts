import { NextResponse } from 'next/server'
import QRCode from 'qrcode'
import { errorApi } from '@/lib/api'
import { exigirRol } from '@/lib/sesion'
import { exigirAccesoCaso } from '@/lib/posesion'
import { db } from '@/lib/db'
import { urlPublica } from '@/lib/casos'
import { listarPolizas } from '@/lib/polizas'
import { leerDocumentacion } from '@/lib/documentacion'
import { ErrorArchivo } from '@/lib/almacenamiento'
import { ErrorIntercambio, incorporarDocumentacion, revocarDocumentacionCompartida } from '@/lib/intercambio'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

type Ctx = { params: Promise<{ id: string }> }
const PRIVADO = { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' }

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    await exigirAccesoCaso(id)
    const pg = await db()
    const [polizas, documentacion, casos, permisos, copias] = await Promise.all([
      listarPolizas(sesion.usuario_id),
      leerDocumentacion(sesion.usuario_id),
      pg.query('SELECT poliza_id, estado, usuario_id FROM casos WHERE id = $1', [id]),
      pg.query('SELECT 1 FROM documentos_compartidos WHERE caso_id = $1 AND usuario_id = $2 AND revocado_en IS NULL AND vence_en > now() LIMIT 1', [id, sesion.usuario_id]),
      pg.query("SELECT id, guia_id, mime FROM medias WHERE caso_id = $1 AND origen = 'documentacion_previa' ORDER BY capturado_en ASC", [id]),
    ])
    const caso = casos.rows[0]
    if (caso?.usuario_id && caso.usuario_id !== sesion.usuario_id) throw new ErrorIntercambio('Entrá con la cuenta titular para elegir su documentación.', 403)
    return NextResponse.json({
      polizas: polizas.map((p) => ({ id: p.id, numero: p.numero, patente: p.patente, marca_modelo: p.marca_modelo, principal: p.principal, aseguradora: p.aseguradora })),
      archivos: documentacion.archivos,
      poliza_id: caso?.poliza_id ?? null,
      cerrada: caso?.estado === 'cerrado',
      compartiendo: permisos.rows.length > 0,
      incorporados: copias.rows,
    }, { headers: PRIVADO })
  } catch (err) {
    if (err instanceof ErrorIntercambio) return NextResponse.json({ error: err.message }, { status: err.estado, headers: PRIVADO })
    return errorApi('documentacion-caso:GET', err, 'No se pudo leer tu documentación. Volvé a abrir el bloque.')
  }
}

export async function POST(req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    await exigirAccesoCaso(id)
    const resultado = await incorporarDocumentacion(sesion.usuario_id, id, await req.json().catch(() => ({})))
    const url = resultado.permiso ? `${urlPublica(req)}/compartir/${resultado.permiso.token}` : null
    const svg = url ? await QRCode.toString(url, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, width: 320 }) : null
    return NextResponse.json({ copias: resultado.copias, url, svg, vence_en: resultado.permiso?.vence_en ?? null }, { headers: PRIVADO })
  } catch (err) {
    if (err instanceof ErrorIntercambio) return NextResponse.json({ error: err.message }, { status: err.estado, headers: PRIVADO })
    if (err instanceof ErrorArchivo) return NextResponse.json({ error: err.message }, { status: 400, headers: PRIVADO })
    return errorApi('documentacion-caso:POST', err, 'No se pudo incorporar la documentación. Revisá la selección y volvé a intentar.')
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  try {
    const { id } = await params
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    await exigirAccesoCaso(id)
    await revocarDocumentacionCompartida(sesion.usuario_id, id)
    return NextResponse.json({ ok: true }, { headers: PRIVADO })
  } catch (err) {
    return errorApi('documentacion-caso:DELETE', err, 'No se pudo revocar el permiso. Volvé a intentar antes de dejar de compartir.')
  }
}
