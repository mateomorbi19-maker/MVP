'use client'

import { useState } from 'react'
import type { EstadoCuenta } from '@/lib/polizas'

const mensajeDe = (e: unknown, generico: string) =>
  e instanceof TypeError
    ? 'No se pudo conectar con el servidor. Revisá que tengas señal o wifi y volvé a intentar.'
    : e instanceof Error
      ? e.message
      : generico

async function guardarJson(url: string, method: string, datos: unknown) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
  const c = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(c.error || 'Revisá los campos y volvé a guardar.')
}

export function CuentaPoliza({ poliza, alCambiar, alFallar }: { poliza: { id: string; estado_cuenta: EstadoCuenta | null }; alCambiar: () => void; alFallar: (m: string | null) => void }) {
  const inicial = () => ({ fecha: poliza.estado_cuenta?.fecha ?? '', origen: poliza.estado_cuenta?.origen ?? '', modalidad: poliza.estado_cuenta?.modalidad ?? '', saldo: String(poliza.estado_cuenta?.saldo ?? ''), movimientos: (poliza.estado_cuenta?.movimientos ?? []).map((m) => ({ ...m, importe: String(m.importe) })) })
  const [valores, setValores] = useState(inicial)
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    alFallar(null)
    try {
      await guardarJson(`/api/polizas/${poliza.id}/estado-cuenta`, 'PUT', valores)
      setEditando(false)
      alCambiar()
    } catch (err) {
      alFallar(mensajeDe(err, 'Revisá la fecha, el origen y los importes y volvé a guardar.'))
    } finally {
      setGuardando(false)
    }
  }
  const cuenta = poliza.estado_cuenta
  return <div className="adjuntos">
    <h3 className="rotulo">Estado de cuenta informativo</h3>
    <p className="mini">Carga manual. No consulta pagos ni bancos. Confirmá deuda, cobertura y pagos con tu productor o aseguradora.</p>
    {cuenta ? <>
      <p className="mini">Fecha: {cuenta.fecha} · Origen: {cuenta.origen} · Modalidad: {cuenta.modalidad}</p>
      <p className="mini">Saldo declarado: {cuenta.saldo === null ? 'Sin informar' : `$ ${cuenta.saldo.toFixed(2)}`}</p>
      {cuenta.movimientos.map((m, i) => <p className="mini" key={i}>{m.fecha} · {m.concepto} · $ {m.importe.toFixed(2)}</p>)}
    </> : <p className="mini apagado">Todavía no cargaste un estado de cuenta.</p>}
    {editando ? <form onSubmit={guardar}>
      {[{ clave: 'fecha', etiqueta: 'Fecha de la información', tipo: 'date' }, { clave: 'origen', etiqueta: 'Origen (por ejemplo, resumen de la aseguradora)', tipo: 'text' }, { clave: 'modalidad', etiqueta: 'Modalidad de pago', tipo: 'text' }, { clave: 'saldo', etiqueta: 'Saldo declarado, en pesos (opcional)', tipo: 'text' }].map((c) => <div className="campo" key={c.clave}>
        <label htmlFor={`cuenta-${c.clave}`}>{c.etiqueta}</label>
        <input id={`cuenta-${c.clave}`} type={c.tipo} required={c.clave !== 'saldo'} value={valores[c.clave as 'fecha' | 'origen' | 'modalidad' | 'saldo']} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} />
      </div>)}
      <p className="mini">Movimientos en pesos. Usá importe negativo para pagos o créditos, y positivo para cargos.</p>
      {valores.movimientos.map((m, i) => <fieldset className="documentacion-poliza" key={i}>
        <legend>Movimiento {i + 1}</legend>
        {(['fecha', 'concepto', 'importe'] as const).map((clave) => <div className="campo" key={clave}>
          <label htmlFor={`movimiento-${i}-${clave}`}>{({ fecha: 'Fecha', concepto: 'Concepto', importe: 'Importe en pesos' })[clave]}</label>
          <input id={`movimiento-${i}-${clave}`} type={clave === 'fecha' ? 'date' : 'text'} required value={m[clave]} onChange={(e) => setValores({ ...valores, movimientos: valores.movimientos.map((v, n) => n === i ? { ...v, [clave]: e.target.value } : v) })} />
        </div>)}
        <button className="boton boton-secundario" type="button" onClick={() => setValores({ ...valores, movimientos: valores.movimientos.filter((_, n) => n !== i) })}>Quitar movimiento</button>
      </fieldset>)}
      <div className="fila-botones">
        <button className="boton boton-secundario" type="button" disabled={valores.movimientos.length >= 100} onClick={() => setValores({ ...valores, movimientos: [...valores.movimientos, { fecha: '', concepto: '', importe: '' }] })}>Agregar movimiento</button>
        <button className="boton boton-secundario" type="button" disabled={guardando} onClick={() => setEditando(false)}>Cancelar</button>
        <button className="boton-primario" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar estado de cuenta'}</button>
      </div>
    </form> : <button className="boton boton-secundario" type="button" onClick={() => { setValores(inicial()); setEditando(true) }}>{cuenta ? 'Actualizar estado de cuenta' : 'Cargar estado de cuenta'}</button>}
  </div>
}

