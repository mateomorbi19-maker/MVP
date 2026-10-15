'use client'

import { useState } from 'react'
import type { Media, Subir } from '@/app/s/[id]/tipos'

export function AdjuntoActa({ medias, subir }: { medias: Media[]; subir: Subir }) {
  const [ocupado, setOcupado] = useState(false)
  const [error, setError] = useState('')
  const cantidad = medias.filter((m) => m.guia_id === 'acta_policial').length
  async function cargar(archivo?: File) {
    if (!archivo) return
    setOcupado(true)
    setError('')
    try { await subir(archivo, archivo.type === 'application/pdf' ? 'documento' : 'foto', 'acta_policial') }
    catch (e) { setError(e instanceof Error ? e.message : 'Volvé a cargar el acta policial.') }
    finally { setOcupado(false) }
  }
  return (
    <div className="pila">
      <p className="pregunta-ayuda">También podés adjuntar el acta. Que se lean el número y la dependencia.</p>
      <label className="boton-secundario">
        {ocupado ? 'Guardando acta…' : 'Fotografiar el acta'}
        <input className="entrada-oculta" type="file" accept="image/*" capture="environment" disabled={ocupado || cantidad >= 5}
          onChange={(e) => { void cargar(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      <label className="boton-secundario">
        Cargar acta en PDF
        <input className="entrada-oculta" type="file" accept="application/pdf" disabled={ocupado || cantidad >= 5}
          onChange={(e) => { void cargar(e.target.files?.[0]); e.target.value = '' }} />
      </label>
      <small className="nota-pie">La hora y el lugar los pone el sistema, no el archivo.</small>
      {cantidad > 0 ? <p className="aviso" data-nivel="ok">{cantidad} archivo(s) del acta guardado(s).</p> : null}
      {error ? <p className="aviso" data-nivel="alerta">{error}</p> : null}
    </div>
  )
}
