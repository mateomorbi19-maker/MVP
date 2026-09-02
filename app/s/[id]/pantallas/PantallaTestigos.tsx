'use client'

import { useEffect, useState } from 'react'
import type { Testigo } from '../tipos'

/* ================= Testigos ================= */

export function PantallaTestigos({
  casoId,
  testigos,
  setTestigos,
  seguir,
}: {
  casoId: string
  testigos: Testigo[]
  setTestigos: (t: Testigo[]) => void
  seguir: () => void
}) {
  const [svg, setSvg] = useState<string | null>(null)
  const enlace = typeof window !== 'undefined' ? `${window.location.origin}/t/${casoId}` : ''

  useEffect(() => {
    fetch(`/api/casos/${casoId}/qr`)
      .then((r) => r.text())
      .then(setSvg)
      .catch(() => setSvg(null))
  }, [casoId])

  // Refresca la lista mientras la pantalla del QR está a la vista.
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/casos/${casoId}`)
        if (!res.ok) return
        const cuerpo = await res.json()
        if (Array.isArray(cuerpo.testigos)) setTestigos(cuerpo.testigos)
      } catch {
        /* sin conexión: se reintenta en el próximo ciclo */
      }
    }, 5000)
    return () => clearInterval(t)
  }, [casoId, setTestigos])

  async function compartir() {
    if (navigator.share) {
      await navigator.share({ title: 'Registrar testigo', url: enlace }).catch(() => {})
    } else {
      await navigator.clipboard.writeText(enlace).catch(() => {})
    }
  }

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">Testigos</div>
        <h1 className="pregunta">¿Alguien vio el choque?</h1>
        <p className="pregunta-ayuda">
          Mostrale esta pantalla. La escanea con <strong>su</strong> teléfono y carga sus datos él mismo: eso vale mucho
          más que un dato anotado por vos.
        </p>

        <div className="tarjeta centrado">
          {svg ? <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} /> : <p className="apagado">Generando el código...</p>}
          <button className="boton-secundario" onClick={compartir} style={{ width: '100%', marginTop: 10 }}>
            Compartir el enlace
          </button>
        </div>

        {testigos.length > 0 ? (
          <div className="tarjeta">
            <h3>Ya cargaron sus datos ({testigos.length})</h3>
            <div className="pila">
              {testigos.map((t) => (
                <div key={t.id} className="faltante" style={{ pointerEvents: 'none' }}>
                  <span className="punto punto-ok" />
                  {t.nombre}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mini centrado">Esta pantalla se actualiza sola cuando alguien carga sus datos.</p>
        )}
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={seguir}>
          Seguir
        </button>
        {testigos.length === 0 ? (
          <button className="omitir" onClick={seguir}>
            No hay testigos
          </button>
        ) : null}
      </div>
    </>
  )
}
