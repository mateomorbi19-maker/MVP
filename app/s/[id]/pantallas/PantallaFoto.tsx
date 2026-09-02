'use client'

import { useState } from 'react'
import { Icono } from '@/app/components/Iconos'
import { type Paso } from '@/lib/recorrido'
import type { Media, Subir } from '../tipos'

/* ================= Fotos, una por pantalla ================= */

export function PantallaFoto({
  paso,
  medias,
  subir,
  seguir,
}: {
  paso: Extract<Paso, { tipo: 'foto' }>
  medias: Media[]
  subir: Subir
  seguir: () => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)
  // La última, no la primera: repetir una toma no borra la anterior del expediente
  // —es evidencia, ya está hasheada— pero en pantalla tiene que verse la nueva.
  const tomada = medias.filter((m) => m.tipo === 'foto' && m.guia_id === paso.guia.id).at(-1)

  async function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setSubiendo(true)
    setFallo(null)
    try {
      await subir(archivo, 'foto', paso.guia.id)
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo subir la fotografía.')
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">
          Foto {paso.numero} de {paso.total}
          {paso.guia.obligatoria ? ' · obligatoria' : ''}
        </div>
        <h1 className="pregunta">{paso.guia.titulo}</h1>
        <p className="pregunta-ayuda">{paso.guia.instruccion}</p>

        {fallo ? <div className="aviso" data-nivel="alerta">{fallo}</div> : null}

        {tomada ? (
          <div className="foto-tomada">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="foto-tomada-imagen" src={`/api/media/${tomada.id}`} alt={paso.guia.titulo} />
            <div className="foto-tomada-estado">
              <Icono nombre="tilde" />
              Foto incorporada
            </div>
          </div>
        ) : (
          <label className="foto-guiada">
            <span className="foto-guiada-icono">
              <Icono nombre="camara" />
            </span>
            <span className="foto-guiada-accion">{subiendo ? 'Subiendo...' : 'Sacar la foto'}</span>
            <small className="foto-guiada-nota">La hora y el lugar los pone el sistema, no el archivo</small>
            <input type="file" accept="image/*" capture="environment" className="entrada-oculta" onChange={elegir} disabled={subiendo} />
          </label>
        )}
      </div>

      <div className="barra-accion">
        {tomada ? (
          <>
            <button className="boton-primario" onClick={seguir}>
              Seguir
            </button>
            <label className="boton boton-secundario foto-repetir">
              <Icono nombre="camara" />
              Repetir la foto
              <input type="file" accept="image/*" capture="environment" className="entrada-oculta" onChange={elegir} />
            </label>
          </>
        ) : (
          <button className="omitir" onClick={seguir}>
            {paso.guia.obligatoria ? 'No puedo sacar esta foto' : 'Saltear esta foto'}
          </button>
        )}
      </div>
    </>
  )
}
