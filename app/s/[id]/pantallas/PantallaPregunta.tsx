'use client'

import { GUIA_RELATO, ZONAS_IMPACTO } from '@/lib/cuestionario'
import type { Paso } from '@/lib/recorrido'
import type { Media, Subir } from '../tipos'
import { GrabadorAudio } from './GrabadorAudio'

/* ================= Una pregunta, una pantalla ================= */

export function PantallaPregunta({
  paso,
  valor,
  yaEsta,
  medias,
  casoId,
  responder,
  responderYAvanzar,
  seguir,
  subir,
}: {
  paso: Extract<Paso, { tipo: 'pregunta' }>
  /** El valor ya contestado para ESTA pregunta. La pantalla no ve las demás. */
  valor: unknown
  yaEsta: boolean
  medias: Media[]
  casoId: string
  responder: (id: string, valor: unknown) => void
  responderYAvanzar: (id: string, valor: unknown) => void
  seguir: () => void
  subir: Subir
}) {
  const { pregunta, seccion } = paso
  // Con un toque alcanza: elegir ya es avanzar. El resto necesita confirmación.
  const autoAvanza = pregunta.tipo === 'opcion' || pregunta.tipo === 'zonaImpacto'

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">{seccion.titulo}</div>
        <h1 className="pregunta">{pregunta.texto}</h1>
        {pregunta.ayuda ? <p className="pregunta-ayuda">{pregunta.ayuda}</p> : null}

        {pregunta.tipo === 'opcion' ? (
          <div className="opciones opciones-grandes">
            {pregunta.opciones?.map((o) => (
              <button
                key={o}
                type="button"
                className="opcion"
                data-elegida={valor === o}
                onClick={() => responderYAvanzar(pregunta.id, o)}
              >
                <span className="marca-opcion">
                  <span className="marca-opcion-punto" />
                </span>
                {o}
              </button>
            ))}
          </div>
        ) : null}

        {pregunta.tipo === 'multiple' ? (
          <div className="opciones opciones-grandes">
            {pregunta.opciones?.map((o) => {
              const actuales = Array.isArray(valor) ? (valor as string[]) : []
              const elegida = actuales.includes(o)
              return (
                <button
                  key={o}
                  type="button"
                  className="opcion"
                  data-elegida={elegida}
                  onClick={() => responder(pregunta.id, elegida ? actuales.filter((x) => x !== o) : [...actuales, o])}
                >
                  <span className="marca-opcion" data-cuadrada="true">
                    <span className="marca-opcion-punto" />
                  </span>
                  {o}
                </button>
              )
            })}
          </div>
        ) : null}

        {pregunta.tipo === 'texto' ? (
          <input
            id={pregunta.id}
            className="campo-grande"
            type="text"
            autoFocus
            autoCapitalize={pregunta.id.includes('patente') ? 'characters' : 'sentences'}
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => responder(pregunta.id, e.target.value)}
          />
        ) : null}

        {pregunta.tipo === 'parrafo' ? (
          <>
            {pregunta.id === 'relato_ampliado' ? (
              <ul className="ayuda">
                {GUIA_RELATO.map((linea) => (
                  <li key={linea}>{linea}</li>
                ))}
              </ul>
            ) : null}
            <textarea
              id={pregunta.id}
              className="campo-grande"
              rows={8}
              value={typeof valor === 'string' ? valor : ''}
              onChange={(e) => responder(pregunta.id, e.target.value)}
            />
          </>
        ) : null}

        {pregunta.tipo === 'numero' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              id={pregunta.id}
              className="campo-grande"
              type="number"
              inputMode="numeric"
              autoFocus
              value={typeof valor === 'number' || typeof valor === 'string' ? String(valor) : ''}
              onChange={(e) => responder(pregunta.id, e.target.value === '' ? '' : Number(e.target.value))}
            />
            {pregunta.unidad ? <span className="apagado" style={{ fontSize: 17 }}>{pregunta.unidad}</span> : null}
          </div>
        ) : null}

        {pregunta.tipo === 'zonaImpacto' ? (
          <div className="zonas zonas-grandes">
            {ZONAS_IMPACTO.map((z) => (
              <button
                key={z}
                type="button"
                className="zona"
                data-elegida={valor === z}
                onClick={() => responderYAvanzar(pregunta.id, z)}
              >
                {z}
              </button>
            ))}
          </div>
        ) : null}

        {pregunta.tipo === 'persona' ? <CamposPersona id={pregunta.id} valor={valor} responder={responder} /> : null}

        {pregunta.tipo === 'audio' ? (
          <GrabadorAudio subir={subir} yaGrabado={yaEsta} casoId={casoId} />
        ) : null}
      </div>

      <div className="barra-accion">
        {!autoAvanza || yaEsta ? (
          <button className="boton-primario" onClick={seguir}>
            Seguir
          </button>
        ) : null}
        {!pregunta.sinOmitir && !yaEsta ? (
          <button className="omitir" onClick={seguir}>
            {pregunta.omitir ?? 'Saltear por ahora'}
          </button>
        ) : null}
      </div>
    </>
  )
}

export function CamposPersona({
  id,
  valor,
  responder,
}: {
  id: string
  valor: unknown
  responder: (id: string, valor: unknown) => void
}) {
  const actual = (valor && typeof valor === 'object' ? valor : {}) as Record<string, string>
  const set = (clave: string, v: string) => responder(id, { ...actual, [clave]: v })

  return (
    <div className="pila">
      <input
        className="campo-grande"
        type="text"
        placeholder="Nombre y apellido"
        autoFocus
        value={actual.nombre ?? ''}
        onChange={(e) => set('nombre', e.target.value)}
      />
      <input
        className="campo-grande"
        type="text"
        placeholder="DNI"
        inputMode="numeric"
        value={actual.dni ?? ''}
        onChange={(e) => set('dni', e.target.value)}
      />
      <input
        className="campo-grande"
        type="tel"
        placeholder="Teléfono"
        value={actual.telefono ?? ''}
        onChange={(e) => set('telefono', e.target.value)}
      />
    </div>
  )
}
