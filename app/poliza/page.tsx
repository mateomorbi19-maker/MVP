'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'

type Documento = { id: string; tipo: string; titulo: string | null; sha256: string; creado_en: string }
type Poliza = {
  id: string
  numero: string
  aseguradora: string
  patente: string | null
  marca_modelo: string | null
  anio: number | null
  cobertura: string | null
  vigencia_hasta: string | null
  principal: boolean
  productor: { nombre: string; aseguradora: string } | null
  documentos: Documento[]
}

const TIPOS = ['Cédula verde', 'Licencia de conducir', 'VTV', 'Póliza', 'Otro']

/** Mi póliza y documentación. Lo que la persona tiene siempre y no se pierde en el lugar. */
export default function MiPoliza() {
  const [polizas, setPolizas] = useState<Poliza[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [alta, setAlta] = useState(false)
  const [nueva, setNueva] = useState({ numero: '', aseguradora: '', patente: '', marca_modelo: '', anio: '' })

  const cargar = () =>
    fetch('/api/polizas')
      .then(async (r) => {
        const c = await r.json()
        if (!r.ok) throw new Error(c?.error ?? 'No se pudieron leer las pólizas.')
        setPolizas(c)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error inesperado.'))

  useEffect(() => {
    cargar()
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const res = await fetch('/api/polizas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nueva),
    })
    const c = await res.json()
    if (!res.ok) {
      setError(c?.error ?? 'No se pudo guardar la póliza.')
      return
    }
    setAlta(false)
    setNueva({ numero: '', aseguradora: '', patente: '', marca_modelo: '', anio: '' })
    cargar()
  }

  async function adjuntar(polizaId: string, archivo: File, tipo: string) {
    const cuerpo = new FormData()
    cuerpo.append('archivo', archivo)
    cuerpo.append('tipo', tipo)
    const res = await fetch(`/api/polizas/${polizaId}/documentos`, { method: 'POST', body: cuerpo })
    if (!res.ok) {
      const c = await res.json().catch(() => ({}))
      setError(c?.error ?? 'No se pudo adjuntar el documento.')
      return
    }
    cargar()
  }

  const campo = (clave: keyof typeof nueva) => ({
    value: nueva[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNueva({ ...nueva, [clave]: e.target.value }),
  })

  return (
    <main className="envoltura">
      <Marca sub="Mi póliza y documentación" />

      {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

      {(polizas ?? []).map((p) => (
        <div className="tarjeta" key={p.id}>
          <h3>
            {p.aseguradora} · {p.numero}
          </h3>
          {p.principal ? <span className="insignia" data-nivel="ok">Principal</span> : null}
          <p className="mini">
            {[p.marca_modelo, p.anio, p.patente, p.cobertura].filter(Boolean).join(' · ') || 'Sin datos del vehículo'}
            {p.vigencia_hasta ? ` · vence ${p.vigencia_hasta}` : ''}
          </p>
          {p.productor ? <p className="mini">Productor: {p.productor.nombre}</p> : null}

          <h4>Documentación</h4>
          {p.documentos.length === 0 ? <p className="apagado mini">Todavía no adjuntaste nada.</p> : null}
          {p.documentos.map((d) => (
            <p className="mini" key={d.id}>
              <a className="enlace" href={`/api/documentos/${d.id}`} target="_blank" rel="noreferrer">
                {d.titulo || d.tipo}
              </a>{' '}
              <span className="mono">{d.sha256.slice(0, 12)}…</span>
            </p>
          ))}

          <label className="boton boton-secundario">
            Adjuntar un documento
            <input
              type="file"
              accept="application/pdf,image/*"
              capture="environment"
              className="entrada-oculta"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) adjuntar(p.id, f, TIPOS[0])
              }}
            />
          </label>
        </div>
      ))}

      {alta ? (
        <form className="tarjeta" onSubmit={guardar}>
          <h3>Agregar una póliza</h3>
          <div className="campo">
            <label htmlFor="numero">Número de póliza</label>
            <input id="numero" type="text" {...campo('numero')} />
          </div>
          <div className="campo">
            <label htmlFor="aseguradora">Aseguradora</label>
            <input id="aseguradora" type="text" {...campo('aseguradora')} />
          </div>
          <div className="campo">
            <label htmlFor="patente">Patente</label>
            <input id="patente" type="text" {...campo('patente')} />
          </div>
          <div className="campo">
            <label htmlFor="marca_modelo">Marca y modelo</label>
            <input id="marca_modelo" type="text" {...campo('marca_modelo')} />
          </div>
          <div className="campo">
            <label htmlFor="anio">Año</label>
            <input id="anio" type="text" inputMode="numeric" {...campo('anio')} />
          </div>
          <button className="boton-primario" type="submit">
            Guardar
          </button>
        </form>
      ) : (
        <button className="boton boton-secundario" onClick={() => setAlta(true)}>
          Agregar una póliza
        </button>
      )}

      <p className="mini centrado">
        <Link href="/cuenta" className="enlace">Volver a mi cuenta</Link>
      </p>
    </main>
  )
}
