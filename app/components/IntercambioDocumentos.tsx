'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SinSesion } from './SinSesion'

type PolizaElegible = { id: string; numero: string; patente: string | null; marca_modelo: string | null; aseguradora: string }
type ArchivoElegible = { id: string; tipo: string; nombre_original: string | null; poliza_id: string | null; mime: string }
type Disponibles = { polizas: PolizaElegible[]; archivos: ArchivoElegible[]; poliza_id: string | null; cerrada: boolean; compartiendo: boolean; incorporados: { id: string; guia_id: string; mime: string }[] }
type Codigo = { url: string; svg: string; vence_en: string }

const TITULOS: Record<string, string> = { poliza: 'Póliza', cedula: 'Cédula', licencia: 'Licencia', dni: 'DNI' }
const mensaje = (err: unknown) => err instanceof TypeError ? 'No se pudo conectar. Revisá que tengas señal y volvé a intentar.' : err instanceof Error ? err.message : 'Revisá la selección y volvé a intentar.'

export function IntercambioDocumentos({ casoId, alIncorporar, alCambiarEstado, deshabilitado = false }: {
  casoId: string
  alIncorporar?: () => void
  alCambiarEstado?: (ocupado: boolean) => void
  deshabilitado?: boolean
}) {
  const [datos, setDatos] = useState<Disponibles | null>(null)
  const [poliza, setPoliza] = useState('')
  const [elegidos, setElegidos] = useState<string[]>([])
  const [sinSesion, setSinSesion] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [procesando, setOcupado] = useState(false)
  const ocupado = procesando || deshabilitado
  const [confirmacion, setConfirmacion] = useState<string | null>(null)
  const [qr, setQr] = useState<Codigo | null>(null)
  const ruta = `/api/casos/${casoId}/documentacion`

  async function cargar(signal?: AbortSignal) {
    try {
      const r = await fetch(ruta, { cache: 'no-store', signal })
      if (r.status === 401) { setSinSesion(true); return }
      const c = await r.json()
      if (!r.ok) throw new Error(c.error || 'Volvé a abrir la documentación de esta actuación.')
      setDatos(c)
      setPoliza((actual) => actual || c.poliza_id || (c.polizas.length === 1 ? c.polizas[0].id : ''))
    } catch (err) {
      if (signal?.aborted) return
      setError(mensaje(err))
    }
  }
  useEffect(() => {
    const control = new AbortController()
    setDatos(null)
    setPoliza('')
    setElegidos([])
    setSinSesion(false)
    setQr(null)
    setError(null)
    setConfirmacion(null)
    cargar(control.signal)
    return () => control.abort()
  }, [casoId])

  const archivos = (datos?.archivos ?? []).filter((a) => a.tipo === 'licencia' || a.tipo === 'dni' || (poliza && a.poliza_id === poliza))
  const sinAsignar = datos?.archivos.some((a) => !a.poliza_id && (a.tipo === 'poliza' || a.tipo === 'cedula'))

  async function incorporar(compartir: boolean, asociarSolo = false) {
    if (ocupado) return
    setOcupado(true)
    alCambiarEstado?.(true)
    setError(null)
    setConfirmacion(null)
    try {
      const r = await fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poliza_id: poliza, archivos: elegidos, compartir, asociar_solo: asociarSolo }) })
      const c = await r.json()
      if (!r.ok) throw new Error(c.error || 'Elegí el vehículo y sus documentos y volvé a intentar.')
      if (compartir) setQr({ url: c.url, svg: c.svg, vence_en: c.vence_en })
      setConfirmacion(asociarSolo ? 'Se guardaron el vehículo y la póliza elegidos para esta actuación.' : `Se incorporaron ${c.copias.length} copias al expediente. Las copias se conservan aunque cambies o borres los originales de tu cuenta.`)
      await cargar()
      alIncorporar?.()
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setOcupado(false)
      alCambiarEstado?.(false)
    }
  }
  async function revocar() {
    setOcupado(true)
    setError(null)
    try {
      const r = await fetch(ruta, { method: 'DELETE' })
      const c = await r.json()
      if (!r.ok) throw new Error(c.error || 'Volvé a intentar dejar de compartir.')
      setQr(null)
      setConfirmacion('Se revocó el acceso por QR. Las copias del expediente se conservan.')
      await cargar()
    } catch (err) {
      setError(mensaje(err))
    } finally {
      setOcupado(false)
    }
  }

  return <section className="tarjeta">
    <h2 className="titulo-tarjeta">Tu documentación y QR para compartir</h2>
    <p className="mini">Elegí qué documentos incorporar al expediente. El QR permite ver únicamente esas copias durante 24 horas. Quien lo reciba puede guardarlas.</p>
    <p className="mini apagado">Es opcional y no impide seguir con una denuncia urgente.</p>
    {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}
    {confirmacion ? <div className="aviso" data-nivel="ok" role="status">{confirmacion}</div> : null}
    {sinSesion ? <SinSesion volver={`/s/${casoId}`} que="tu documentación guardada" /> : null}
    {!sinSesion && !datos && !error ? <p className="mini apagado">Leyendo tu documentación…</p> : null}
    {datos ? <>
      {datos.cerrada ? <p className="mini">El expediente ya está sellado y conserva las copias incorporadas. Podés revocar un QR existente.</p> : null}
      {datos.polizas.length ? <div className="campo">
        <label htmlFor={`poliza-documentos-${casoId}`}>Vehículo involucrado y póliza</label>
        <select id={`poliza-documentos-${casoId}`} value={poliza} disabled={ocupado || datos.cerrada || datos.incorporados.length > 0} onChange={(e) => { setPoliza(e.target.value); setElegidos([]); setQr(null); setConfirmacion(null) }}>
          <option value="">Elegí el vehículo involucrado</option>
          {datos.polizas.map((p) => <option key={p.id} value={p.id}>{p.patente || 'Sin patente'} · {p.marca_modelo || p.aseguradora} · {p.numero}</option>)}
        </select>
      </div> : <p className="mini">Todavía no tenés una póliza cargada.</p>}
      {datos.polizas.length && !datos.cerrada && !datos.incorporados.length ? <div className="fila-botones">
        <button className="boton boton-secundario" type="button" disabled={ocupado || !poliza || datos.poliza_id === poliza} onClick={() => void incorporar(false, true)}>Guardar vehículo y póliza</button>
      </div> : null}
      {!archivos.length ? <p className="mini">No hay documentos disponibles para este vehículo. Podés cargarlos desde Mi documentación y volver acá.</p> : null}
      {sinAsignar ? <p className="mini">Tenés archivos anteriores sin vehículo asignado. Asignalos desde Mi documentación para poder elegirlos.</p> : null}
      {archivos.map((a) => <div className="documentacion-poliza" key={a.id}>
        <label className="mini">
          <input type="checkbox" checked={elegidos.includes(a.id)} disabled={ocupado || datos.cerrada || (!elegidos.includes(a.id) && elegidos.length >= 20)} onChange={(e) => { setElegidos(e.target.checked ? [...elegidos, a.id] : elegidos.filter((id) => id !== a.id)); setQr(null); setConfirmacion(null) }} />
          {' '}{TITULOS[a.tipo] || 'Documento'} · {a.nombre_original || (a.mime === 'application/pdf' ? 'PDF' : 'Foto')}
        </label>
        {' '}<a className="enlace mini" href={`/api/documentacion/archivos/${a.id}`} target="_blank" rel="noreferrer">Revisar archivo</a>
      </div>)}
      <p className="mini"><Link className="enlace" href="/poliza">Abrir Mi documentación</Link></p>
      {!datos.cerrada ? <div className="fila-botones">
        <button className="boton boton-secundario" type="button" disabled={ocupado || !poliza || !elegidos.length} onClick={() => void incorporar(false)}>{ocupado ? 'Procesando…' : 'Incorporar al expediente'}</button>
        <button className="boton-primario" type="button" disabled={ocupado || !poliza || !elegidos.length} onClick={() => void incorporar(true)}>Incorporar y generar QR</button>
      </div> : null}
      {datos.incorporados.length ? <p className="mini">Copias de documentación previa en este expediente: {datos.incorporados.length}. No se presentan como fotografías tomadas en el lugar.</p> : null}
      {qr ? <div className="centrado">
        <div className="qr qr-imagen" role="img" aria-label="QR para abrir únicamente la documentación seleccionada" dangerouslySetInnerHTML={{ __html: qr.svg }} />
        <p className="mini">Vence el {new Date(qr.vence_en).toLocaleString('es-AR')}.</p>
        <a className="enlace" href={qr.url} target="_blank" rel="noreferrer">Abrir el enlace compartido</a>
      </div> : null}
      {datos.compartiendo ? <div className="adjuntos">
        {!qr ? <p className="mini">Hay un QR vigente con la selección anterior. Para cambiar lo compartido, generá otro QR o revocá el permiso.</p> : null}
        <button className="boton boton-secundario" type="button" disabled={ocupado} onClick={() => void revocar()}>Dejar de compartir por QR</button>
      </div> : null}
    </> : null}
  </section>
}
