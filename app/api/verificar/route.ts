import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { verificarCadena, construirManifiesto } from '@/lib/hash'
import { obtenerCaso } from '@/lib/casos'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Verificación pública e independiente.
 *
 * Recalcula toda la cadena desde cero y la compara con lo almacenado. No requiere
 * credenciales: cualquiera con el número de actuación —un perito, un juez, la
 * aseguradora contraria— puede comprobar por su cuenta que el expediente no fue alterado.
 *
 * Devuelve sólo datos de integridad, nunca el contenido del expediente.
 */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const id = typeof cuerpo?.id === 'string' ? cuerpo.id.trim().toUpperCase() : ''
    const hashEsperado = typeof cuerpo?.hash === 'string' ? cuerpo.hash.trim().toLowerCase() : null

    if (!/^[A-Z]{3}-[A-Z0-9]{6}$/.test(id)) {
      return NextResponse.json({ error: 'Número de actuación con formato inválido. Ejemplo: ADS-7K2M4Q' }, { status: 400 })
    }

    const caso = await obtenerCaso(id)
    if (!caso) return NextResponse.json({ error: 'No existe una actuación con ese número.' }, { status: 404 })

    const resultado = await verificarCadena(id)
    const manifiesto = await construirManifiesto(id)

    // Si el caso está cerrado, el hash maestro no puede haber cambiado desde el sellado.
    const problemas = [...resultado.problemas]
    if (caso.estado === 'cerrado' && caso.hash_maestro && caso.hash_maestro !== manifiesto.hash_maestro) {
      problemas.push(
        'El hash maestro recalculado no coincide con el registrado al momento del sellado: el expediente fue modificado después de cerrarse.',
      )
    }

    const coincideConAportado =
      hashEsperado === null ? null : hashEsperado === manifiesto.hash_maestro.toLowerCase()
    if (coincideConAportado === false) {
      problemas.push('El hash informado no coincide con el del expediente registrado en el sistema.')
    }

    return NextResponse.json({
      id,
      estado: caso.estado,
      valido: problemas.length === 0,
      hash_maestro: manifiesto.hash_maestro,
      hash_al_sellar: caso.hash_maestro,
      coincide_con_hash_aportado: coincideConAportado,
      eslabones: resultado.eslabones,
      piezas: resultado.piezas,
      abierta_en: caso.creado_en,
      cerrada_en: caso.cerrado_en,
      sello: caso.sello
        ? {
            sellado_en: caso.sello.sellado_en,
            algoritmo: caso.sello.firma.algoritmo,
            tipo_firma: caso.sello.firma.tipo,
            advertencia: caso.sello.firma.advertencia ?? null,
            clave_publica_sha256: caso.sello.firma.clave_publica_sha256,
            tsa_obtenida: caso.sello.tsa.obtenida,
            tsa_autoridad: caso.sello.tsa.autoridad,
            tsa_token_sha256: caso.sello.tsa.token_sha256,
            tsa_error: caso.sello.tsa.error,
          }
        : null,
      cadena: manifiesto.cadena.map((e) => ({ n: e.n, ts: e.ts, tipo: e.tipo, hash: e.hash })),
      problemas,
    })
  } catch (err) {
    return errorApi('verificar:POST', err, 'No se pudo completar la verificación.')
  }
}
