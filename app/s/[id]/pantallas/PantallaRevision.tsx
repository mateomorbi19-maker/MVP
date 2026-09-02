'use client'

import { useState } from 'react'
import type { Faltante } from '@/lib/recorrido'
import type { Media, Testigo, Ubicacion } from '../tipos'

/* ================= Revisión y cierre ================= */

export function PantallaRevision({
  casoId,
  faltantes,
  medias,
  testigos,
  ubicacion,
  irA,
  alReintentarGps,
  antesDeCerrar,
  alCerrar,
}: {
  casoId: string
  /** Lo que falta, ya calculado por lib/recorrido.ts. */
  faltantes: Faltante[]
  medias: Media[]
  testigos: Testigo[]
  ubicacion: Ubicacion
  irA: (clave: string) => void
  alReintentarGps: () => void
  antesDeCerrar: () => Promise<void>
  alCerrar: (r: { hash_maestro: string }) => void
}) {
  const [cerrando, setCerrando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const fotos = medias.filter((m) => m.tipo === 'foto').length
  const audios = medias.filter((m) => m.tipo === 'audio').length

  async function cerrar() {
    setCerrando(true)
    setFallo(null)
    try {
      // Se vacía el buffer antes de sellar: lo que no llegó a guardarse no se sella.
      await antesDeCerrar()
      const res = await fetch(`/api/casos/${casoId}/cerrar`, { method: 'POST' })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo cerrar la actuación.')
      alCerrar({ hash_maestro: cuerpo.hash_maestro })
    } catch (e) {
      setFallo(e instanceof Error ? e.message : 'Error inesperado.')
      setCerrando(false)
    }
  }

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">Último paso</div>
        <h1 className="pregunta">Antes de cerrar</h1>
        <p className="pregunta-ayuda">
          Al cerrar, el expediente se sella. Cualquier cambio posterior queda en evidencia al verificarlo, y el número
          de actuación permite que lo compruebe cualquiera.
        </p>

        <div className="tarjeta">
          <h3 style={{ marginBottom: 12 }}>Lo que se va a sellar</h3>
          <div className="pila">
            <Linea etiqueta="Ubicación y clima" ok={ubicacion !== null} texto={ubicacion ? 'Registrados' : 'Sin registrar'} />
            <Linea
              etiqueta="Respuestas obligatorias"
              ok={faltantes.length === 0}
              texto={faltantes.length === 0 ? 'Completas' : `Faltan ${faltantes.length}`}
            />
            <Linea etiqueta="Fotografías" ok={fotos > 0} texto={`${fotos} cargadas`} />
            <Linea etiqueta="Relato en audio" ok={audios > 0} texto={audios > 0 ? 'Grabado' : 'Sin grabar'} />
            <Linea etiqueta="Testigos" ok={testigos.length > 0} texto={`${testigos.length} registrados`} />
          </div>
        </div>

        {ubicacion === null ? (
          <div className="aviso" data-nivel="atencion">
            <strong>El expediente va a quedar sin ubicación.</strong>
            <p style={{ margin: '6px 0 10px', fontSize: 13.5 }}>
              Sin ella no hay clima ni hora solar con qué contrastar la declaración. Si todavía estás en el lugar,
              conviene resolverlo ahora.
            </p>
            <button className="boton-secundario" onClick={alReintentarGps} style={{ width: '100%' }}>
              Reintentar la ubicación
            </button>
          </div>
        ) : null}

        {faltantes.length > 0 ? (
          <div className="tarjeta">
            <h3 style={{ marginBottom: 4 }}>Quedó sin completar</h3>
            <p className="mini" style={{ marginBottom: 12 }}>
              Podés cerrar igual, pero cada faltante debilita el expediente y queda asentado como tal. Tocá cualquiera
              para completarlo.
            </p>
            <div className="pila">
              {faltantes.map((f) => (
                <button key={f.clave} className="faltante" onClick={() => irA(f.clave)}>
                  <span className="punto" data-estado="espera" />
                  {f.texto}
                  <span className="faltante-ir">Completar →</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {fallo ? <div className="aviso" data-nivel="alerta">{fallo}</div> : null}
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={cerrar} disabled={cerrando}>
          {cerrando ? 'Sellando el expediente...' : 'Cerrar y sellar el expediente'}
        </button>
      </div>
    </>
  )
}

export function Linea({ etiqueta, ok, texto }: { etiqueta: string; ok: boolean; texto: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span className="punto" data-estado={ok ? 'ok' : 'espera'} />
        {etiqueta}
      </span>
      <span className="mini" style={{ textAlign: 'right' }}>
        {texto}
      </span>
    </div>
  )
}
