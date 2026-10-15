import type { Metadata } from 'next'
import { Marca } from '@/app/components/Marca'
import { ErrorIntercambio, leerDocumentacionCompartida } from '@/lib/intercambio'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = {
  title: 'Documentación compartida',
  referrer: 'no-referrer',
  robots: { index: false, follow: false, noarchive: true },
}

export default async function DocumentacionCompartida({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  let documentos: { id: string; titulo: string; mime: string }[] = []
  let vencimiento: string | null = null
  let error: string | null = null
  try {
    const resultado = await leerDocumentacionCompartida(token)
    if ('archivos' in resultado && resultado.archivos) {
      documentos = resultado.archivos
      vencimiento = resultado.vence_en ?? null
    }
  } catch (err) {
    error = err instanceof ErrorIntercambio ? err.message : 'No se pudo leer la documentación. Volvé a abrir el enlace o pedí un QR nuevo.'
  }
  return <main className="envoltura">
    <Marca />
    <header className="encabezado-pagina">
      <h1 className="titulo-pagina">Documentación compartida</h1>
      <p className="bajada-pagina">Sólo se muestran los documentos elegidos expresamente por quien comparte este enlace.</p>
    </header>
    {error ? <div className="aviso" data-nivel="atencion">{error}</div> : <section className="tarjeta">
      <p className="mini">Son copias de documentación cargada previamente. No acreditan por sí solas vigencia, cobertura ni pagos.</p>
      {vencimiento ? <p className="mini">El permiso vence el {new Date(vencimiento).toLocaleString('es-AR')} y puede revocarse antes.</p> : null}
      {documentos.map((d, i) => <div className="documentacion-poliza" key={d.id}>
        <h2 className="documentacion-poliza-titulo">{d.titulo} · archivo {i + 1}</h2>
        <a className="boton boton-secundario" href={`/api/compartir/${encodeURIComponent(token)}?archivo=${encodeURIComponent(d.id)}`} target="_blank" rel="noreferrer">Abrir {d.mime === 'application/pdf' ? 'PDF' : 'foto'}</a>
      </div>)}
    </section>}
  </main>
}
