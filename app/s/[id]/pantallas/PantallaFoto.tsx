'use client'

import { useEffect, useRef, useState } from 'react'
import { Icono } from '@/app/components/Iconos'
import { MAXIMO_FOTOS_POR_GUIA, fotosDeGuia, type Paso } from '@/lib/recorrido'
import type { Media, Subir } from '../tipos'

/* ================= Fotos de una toma, hasta cinco por pantalla ================= */

type Captura = {
  clave: string
  archivo: File
  url: string
  estado: 'subiendo' | 'guardada' | 'fallo'
  mediaId: string | null
}

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
  const [capturas, setCapturas] = useState<Captura[]>([])
  const [fallo, setFallo] = useState<string | null>(null)
  // Las URL de objeto retienen el archivo en memoria hasta que se liberan: con cinco fotos
  // de cámara por toma, no soltarlas al salir de la pantalla se nota en un teléfono modesto.
  const urls = useRef<string[]>([])
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), [])

  // Las de una sesión anterior (recarga, retomar) se ven desde el servidor; las de ahora,
  // desde el archivo local, porque su id todavía puede no existir allá.
  const propias = new Set(capturas.map((c) => c.mediaId).filter(Boolean))
  const anteriores = fotosDeGuia(medias, paso.guia.id).filter((m) => !propias.has(m.id))
  const vigentes = capturas.filter((c) => c.estado !== 'fallo')
  const cantidad = anteriores.length + vigentes.length
  const guardadas = anteriores.length + capturas.filter((c) => c.estado === 'guardada').length
  const lleno = cantidad >= MAXIMO_FOTOS_POR_GUIA

  function actualizar(clave: string, cambios: Partial<Captura>) {
    setCapturas((prev) => prev.map((c) => (c.clave === clave ? { ...c, ...cambios } : c)))
  }

  async function enviar(captura: Captura) {
    actualizar(captura.clave, { estado: 'subiendo' })
    setFallo(null)
    try {
      const mediaId = await subir(captura.archivo, 'foto', paso.guia.id)
      actualizar(captura.clave, { estado: 'guardada', mediaId })
    } catch (err) {
      actualizar(captura.clave, { estado: 'fallo' })
      setFallo(err instanceof Error ? err.message : 'No se pudo guardar la foto: tocala para volver a intentar.')
    }
  }

  function elegir(e: React.ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo || lleno) return
    const url = URL.createObjectURL(archivo)
    urls.current.push(url)
    const captura: Captura = { clave: crypto.randomUUID(), archivo, url, estado: 'subiendo', mediaId: null }
    setCapturas((prev) => [...prev, captura])
    void enviar(captura)
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

        {anteriores.length + capturas.length > 0 ? (
          <div className="foto-grilla">
            {anteriores.map((m) => (
              <div key={m.id} className="miniatura">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`/api/media/${m.id}`} alt={paso.guia.titulo} />
                <span className="insignia miniatura-estado" data-nivel="ok">Guardada</span>
              </div>
            ))}
            {capturas.map((c) =>
              c.estado === 'fallo' ? (
                <button key={c.clave} className="miniatura miniatura-reintentar" onClick={() => void enviar(c)} disabled={lleno}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt={paso.guia.titulo} />
                  <span className="insignia miniatura-estado" data-nivel="alerta">Reintentar</span>
                </button>
              ) : (
                <div key={c.clave} className="miniatura">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.url} alt={paso.guia.titulo} />
                  <span className="insignia miniatura-estado" data-nivel={c.estado === 'guardada' ? 'ok' : 'neutra'}>
                    {c.estado === 'guardada' ? 'Guardada' : 'Subiendo'}
                  </span>
                </div>
              ),
            )}
          </div>
        ) : null}

        {lleno ? null : (
          <label className={cantidad > 0 ? 'foto-guiada foto-guiada-compacta' : 'foto-guiada'}>
            <span className="foto-guiada-icono">
              <Icono nombre="camara" />
            </span>
            <span className="foto-guiada-accion">
              {cantidad > 0 ? `Agregar otra foto (${cantidad + 1} de ${MAXIMO_FOTOS_POR_GUIA})` : 'Sacar foto'}
            </span>
            <small className="foto-guiada-nota">La hora y el lugar los pone el sistema, no el archivo</small>
            <input type="file" accept="image/*" capture="environment" className="entrada-oculta" onChange={elegir} />
          </label>
        )}
      </div>

      <div className="barra-accion">
        {guardadas > 0 ? (
          <button className="boton-primario" onClick={seguir}>
            Seguir
          </button>
        ) : (
          <button className="omitir" onClick={seguir}>
            {paso.guia.obligatoria ? 'No puedo sacar esta foto' : 'Saltear esta foto'}
          </button>
        )}
      </div>
    </>
  )
}
