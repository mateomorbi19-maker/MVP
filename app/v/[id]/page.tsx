import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Marca } from '@/app/components/Marca'
import { obtenerCaso } from '@/lib/casos'
import { construirManifiesto, verificarCadena } from '@/lib/hash'

export const dynamic = 'force-dynamic'

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'long', timeStyle: 'short' }) : '-'

/**
 * Verificación pública, la que abre el código impreso en el expediente.
 *
 * PÚBLICA A PROPÓSITO y SIN DATOS PERSONALES. Es la página que abre cualquiera que reciba
 * el expediente por WhatsApp o lo tenga impreso, así que muestra sólo lo mínimo para
 * comprobar que el documento es auténtico: número, fechas, hash e integridad. Ni el
 * nombre, ni el teléfono, ni la dirección del hecho, ni una sola respuesta.
 *
 * Para ver el contenido hace falta la actuación, la cuenta o el enlace de entrega.
 */
export default async function VerificacionPublica({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const caso = await obtenerCaso(id)
  if (!caso) notFound()

  const resultado = await verificarCadena(id)
  const manifiesto = await construirManifiesto(id)

  const problemas = [...resultado.problemas]
  if (caso.estado === 'cerrado' && caso.hash_maestro && caso.hash_maestro !== manifiesto.hash_maestro) {
    problemas.push('El expediente fue modificado después de cerrarse.')
  }
  const valido = problemas.length === 0

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Verificación de un expediente</h1>
        <p className="bajada-pagina">
          Esta página no muestra el contenido del expediente: sólo si sigue siendo el mismo que se selló.
        </p>
      </header>

      <div className="aviso" data-nivel={valido ? 'ok' : 'alerta'}>
        <strong>
          {valido
            ? caso.estado === 'cerrado'
              ? 'El expediente está íntegro.'
              : 'La actuación existe, pero todavía no fue sellada.'
            : 'El expediente no verifica.'}
        </strong>
      </div>

      <div className="tarjeta">
        <div className="numero-actuacion">{id}</div>
        <p className="mini">Abierta el {fecha(caso.creado_en)}</p>
        {caso.cerrado_en ? <p className="mini">Sellada el {fecha(caso.cerrado_en)}</p> : null}
        <p className="mini">
          {resultado.eslabones} registros encadenados · {resultado.piezas} piezas
        </p>
        <p className="mono mini">{manifiesto.hash_maestro}</p>
        {caso.sello?.tsa?.obtenida ? (
          <p className="mini">Sello de tiempo de {caso.sello.tsa.autoridad}.</p>
        ) : (
          <p className="mini">Sin sello de tiempo de una autoridad externa.</p>
        )}
      </div>

      {problemas.length > 0 ? (
        <div className="tarjeta">
          <h3>Qué no verifica</h3>
          {problemas.map((p) => (
            <p className="mini" key={p}>
              {p}
            </p>
          ))}
        </div>
      ) : null}

      <p className="mini">
        Esta página comprueba la integridad del expediente y nada más. No muestra su contenido: lleva datos personales
        del asegurado y de terceros. Para verlo hace falta la propia actuación, una cuenta con acceso, o el enlace de
        entrega que se le mandó al productor.
      </p>
      <p className="mini">
        La firma que respalda este expediente es una firma <strong>electrónica</strong> (art. 5, Ley 25.506). No cuenta
        con las presunciones de autoría e integridad de los arts. 7 y 8, que requieren un certificado emitido por un
        certificador licenciado.
      </p>
      <p className="mini centrado">
        <Link href="/verificar" className="enlace">Verificar otro expediente</Link>
      </p>
    </main>
  )
}
