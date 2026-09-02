'use client'

import { useEffect, useState } from 'react'
import { Icono } from './Iconos'

type Productor = { id: string; nombre: string; aseguradora: string }

/**
 * Entrega del expediente sellado: compartir, descargar y mandárselo al productor.
 *
 * Compartir usa el share sheet del propio teléfono (navigator.share), no una integración
 * con WhatsApp: no hace falta ninguna API, la persona elige por dónde mandarlo, y funciona
 * igual con Telegram, con el correo o con AirDrop.
 *
 * Cuando el navegador no lo soporta —Firefox de escritorio, Chrome de escritorio sin
 * archivos— el plan B es honesto: se ofrece descargar y copiar el enlace de verificación,
 * que es lo que la persona iba a mandar de todos modos.
 */
export function EntregaExpediente({ casoId }: { casoId: string }) {
  const [productores, setProductores] = useState<Productor[]>([])
  const [elegido, setElegido] = useState('')
  const [aviso, setAviso] = useState<{ nivel: 'ok' | 'alerta' | 'info'; texto: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [puedeCompartir, setPuedeCompartir] = useState(false)

  useEffect(() => {
    setPuedeCompartir(typeof navigator !== 'undefined' && typeof navigator.share === 'function')
    fetch('/api/productores')
      .then((r) => (r.ok ? r.json() : []))
      .then((p) => setProductores(Array.isArray(p) ? p : []))
      .catch(() => setProductores([]))
  }, [])

  async function compartir() {
    const url = `${window.location.origin}/v/${casoId}`
    try {
      const res = await fetch(`/api/casos/${casoId}/pdf?descargar=1`)
      const blob = await res.blob()
      const archivo = new File([blob], `expediente-${casoId}.pdf`, { type: 'application/pdf' })

      // canShare con archivos no está en todos lados: se comprueba antes de intentarlo.
      if (navigator.canShare?.({ files: [archivo] })) {
        await navigator.share({ files: [archivo], title: `Expediente ${casoId}`, text: url })
        return
      }
      await navigator.share({ title: `Expediente ${casoId}`, text: `Expediente de siniestro ${casoId}`, url })
    } catch (e) {
      // Cancelar el share sheet lanza AbortError: no es un error que haya que mostrar.
      if ((e as Error)?.name === 'AbortError') return
      setAviso({ nivel: 'info', texto: 'Tu navegador no puede compartir desde acá. Descargalo y mandalo como quieras.' })
    }
  }

  async function enviar() {
    if (!elegido) return
    setEnviando(true)
    setAviso(null)
    const res = await fetch(`/api/casos/${casoId}/enviar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productor_id: elegido }),
    })
    const c = await res.json().catch(() => ({}))
    setEnviando(false)
    if (!res.ok) {
      setAviso({ nivel: 'alerta', texto: c?.error ?? 'No se pudo entregar el expediente.' })
      return
    }
    const estado = c?.envio?.estado
    setAviso(
      estado === 'enviado'
        ? { nivel: 'ok', texto: 'Se le mandó al productor por correo.' }
        : estado === 'sin_configurar'
          ? { nivel: 'info', texto: 'Quedó disponible en la bandeja del productor. El envío por correo no está configurado en este servidor.' }
          : { nivel: 'alerta', texto: 'El correo no salió. Quedó en la bandeja del productor y se va a reintentar.' },
    )
  }

  return (
    <div className="tarjeta entrega-expediente">
      <div className="entrega-encabezado">
        <span className="entrega-icono">
          <Icono nombre="escudo" />
        </span>
        <div>
          <h3>Entregar el expediente</h3>
          <p className="mini entrega-subtitulo">Compartilo desde este teléfono o mandáselo a tu productor.</p>
        </div>
      </div>

      <div className="pila entrega-acciones">
        {puedeCompartir ? (
          <button className="boton boton-secundario" onClick={compartir}>
            <Icono nombre="compartir" />
            Compartir
          </button>
        ) : null}
      </div>

      {productores.length > 0 ? (
        <div className="campo entrega-productor">
          <label htmlFor="productor">Mandárselo a mi productor</label>
          <select id="productor" value={elegido} onChange={(e) => setElegido(e.target.value)}>
            <option value="">Elegir...</option>
            {productores.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} · {p.aseguradora}
              </option>
            ))}
          </select>
          <button className="boton boton-secundario" onClick={enviar} disabled={!elegido || enviando}>
            <Icono nombre="compartir" />
            {enviando ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      ) : null}

      {aviso ? <div className="aviso" data-nivel={aviso.nivel}>{aviso.texto}</div> : null}
    </div>
  )
}
