'use client'

import { useEffect, useState } from 'react'

type Gestion = { id: number; ts: string; tipo: string; actor: string | null; detalle: Record<string, unknown> }

const ETIQUETA: Record<string, string> = {
  sin_enviar: 'Sin enviar',
  enviada: 'Enviada al productor',
  recibida: 'Recepción confirmada',
  en_tramite: 'En trámite',
  resuelta: 'Resuelta',
}

const fecha = (iso: string) => new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

/**
 * La tramitación, para el productor y la aseguradora.
 *
 * Todo esto vive en su propia cadena, anclada al hash maestro del acta pero FUERA de la
 * cadena de custodia del hecho. Un comentario del productor es prueba de un tercero sobre
 * el trámite, no sobre el siniestro, y al asegurado se le prometió que al cerrar el
 * expediente ya no admite cambios.
 */
export function AccionesGestion({ casoId }: { casoId: string }) {
  const [estado, setEstado] = useState<string>('sin_enviar')
  const [gestiones, setGestiones] = useState<Gestion[]>([])
  const [comentario, setComentario] = useState('')
  const [error, setError] = useState<string | null>(null)

  const cargar = () =>
    fetch(`/api/casos/${casoId}/gestion`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (!c) return
        setEstado(c.estado)
        setGestiones(c.gestiones ?? [])
      })
      .catch(() => undefined)

  useEffect(() => {
    cargar()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [casoId])

  async function mandar(cuerpo: Record<string, unknown>) {
    setError(null)
    const res = await fetch(`/api/casos/${casoId}/gestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpo),
    })
    if (!res.ok) {
      const c = await res.json().catch(() => ({}))
      setError(c?.error ?? 'No se pudo registrar el movimiento.')
      return
    }
    setComentario('')
    cargar()
  }

  return (
    <div className="tarjeta">
      <h3>Tramitación</h3>
      <span className="insignia" data-nivel={estado === 'resuelta' ? 'ok' : 'neutra'}>
        {ETIQUETA[estado] ?? estado}
      </span>

      <div className="fila-botones">
        {estado === 'enviada' ? (
          <button className="boton boton-secundario" onClick={() => mandar({ estado: 'recibida' })}>
            Confirmar recepción
          </button>
        ) : null}
        {estado === 'enviada' || estado === 'recibida' ? (
          <button className="boton boton-secundario" onClick={() => mandar({ estado: 'en_tramite' })}>
            Poner en trámite
          </button>
        ) : null}
        {estado !== 'resuelta' && estado !== 'sin_enviar' ? (
          <button className="boton boton-secundario" onClick={() => mandar({ estado: 'resuelta' })}>
            Marcar resuelta
          </button>
        ) : null}
      </div>

      <div className="campo">
        <label htmlFor="comentario">Comentario</label>
        <textarea id="comentario" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} />
        <button
          className="boton boton-secundario"
          onClick={() => mandar({ comentario })}
          disabled={!comentario.trim()}
        >
          Agregar comentario
        </button>
      </div>

      {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

      {gestiones.length > 0 ? (
        <>
          <h4>Movimientos</h4>
          {gestiones.map((g) => (
            <p className="mini" key={g.id}>
              {fecha(g.ts)} · {g.tipo}
              {typeof g.detalle?.texto === 'string' ? `: ${g.detalle.texto}` : ''}
            </p>
          ))}
        </>
      ) : null}

      <p className="mini">
        Estos movimientos quedan en una cadena propia, anclada al hash del acta pero fuera de ella: el expediente
        sellado no cambia, y el trámite queda igualmente auditado.
      </p>
    </div>
  )
}
