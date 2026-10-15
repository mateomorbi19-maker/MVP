'use client'

import { useEffect, useRef, useState } from 'react'
import { drenar, pendientesDe, quitar } from '@/lib/cola'
import type { PiezaEnCola } from '@/lib/cola'
import { GUIA_FOTOS } from '@/lib/cuestionario'

const EXTENSIONES: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/heic': 'heic',
  'application/pdf': 'pdf', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav',
}

export function PendientesSubida({ casoId, alCambiar }: { casoId: string; alCambiar: () => void }) {
  const [piezas, ponerPiezas] = useState<PiezaEnCola[]>([])
  const [ocupado, ponerOcupado] = useState(false)
  const [fallo, ponerFallo] = useState('')
  const montado = useRef(false)
  const lectura = useRef(0)
  const casoActual = useRef(casoId)
  const notificar = useRef(alCambiar)
  const firmaAnterior = useRef<string | null>(null)
  const respaldos = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  casoActual.current = casoId
  notificar.current = alCambiar

  async function refrescar() {
    const numero = ++lectura.current
    try {
      const actuales = await pendientesDe(casoId)
      if (!montado.current || casoActual.current !== casoId || numero !== lectura.current) return
      ponerPiezas(actuales.sort((a, b) => a.tomadaEn.localeCompare(b.tomadaEn)))
      const firma = actuales.map((pieza) => pieza.id).sort().join('|')
      const cambio = firmaAnterior.current !== null && firmaAnterior.current !== firma
      firmaAnterior.current = firma
      if (cambio) notificar.current()
    } catch {
      if (montado.current && casoActual.current === casoId) ponerFallo('No se pudo leer la cola local. Habilitá el almacenamiento del navegador y reintentá.')
    }
  }

  useEffect(() => {
    montado.current = true
    firmaAnterior.current = null
    ponerPiezas([])
    ponerFallo('')
    ponerOcupado(false)
    void refrescar()
    const intervalo = setInterval(() => { void refrescar() }, 5000)
    const alVolver = () => { void refrescar() }
    window.addEventListener('online', alVolver)
    const urls = respaldos.current
    return () => {
      montado.current = false
      lectura.current++
      clearInterval(intervalo)
      window.removeEventListener('online', alVolver)
      for (const [url, plazo] of urls) {
        clearTimeout(plazo)
        URL.revokeObjectURL(url)
      }
      urls.clear()
    }
  }, [casoId])

  async function reintentar() {
    ponerOcupado(true)
    ponerFallo('')
    try {
      await drenar(casoId)
    } catch (error) {
      if (montado.current && casoActual.current === casoId) ponerFallo(error instanceof Error ? error.message : 'Revisá la conexión y volvé a intentar. Los archivos siguen guardados en este dispositivo.')
    } finally {
      await refrescar()
      if (montado.current && casoActual.current === casoId) ponerOcupado(false)
    }
  }

  function descargar(pieza: PiezaEnCola) {
    const url = URL.createObjectURL(pieza.bytes)
    // El navegador necesita alcanzar a abrir la descarga antes de liberar los bytes.
    const plazo = setTimeout(() => {
      URL.revokeObjectURL(url)
      respaldos.current.delete(url)
    }, 5000)
    respaldos.current.set(url, plazo)
    const enlace = document.createElement('a')
    enlace.href = url
    const extension = EXTENSIONES[pieza.mime.split(';')[0].trim().toLowerCase()] ?? 'bin'
    enlace.download = `respaldo-${pieza.id}.${extension}`
    try {
      document.body.append(enlace)
      enlace.click()
    } catch {
      ponerFallo('Permití las descargas del navegador y volvé a guardar el respaldo antes de eliminar el borrador.')
    } finally {
      enlace.remove()
    }
  }

  async function eliminar(pieza: PiezaEnCola) {
    if (!window.confirm('¿Eliminar este borrador pendiente sólo de este dispositivo? Guardá una copia de respaldo antes. Esto no retira ni modifica los archivos que el servidor haya recibido.')) return
    ponerOcupado(true)
    ponerFallo('')
    try {
      await quitar(pieza.id)
    } catch {
      if (montado.current && casoActual.current === casoId) ponerFallo('No se pudo eliminar el borrador local. Revisá el almacenamiento del navegador y volvé a intentar.')
    } finally {
      await refrescar()
      if (montado.current && casoActual.current === casoId) ponerOcupado(false)
    }
  }

  if (!piezas.length) return fallo ? <p className="aviso" data-nivel="atencion" role="alert">{fallo}</p> : null

  return (
    <section className="tarjeta" aria-label="Archivos pendientes de este caso">
      <h2 className="titulo-tarjeta">Archivos pendientes de subir</h2>
      <p className="pregunta-ayuda">Estos archivos siguen en este dispositivo. Reintentá con conexión o guardá una copia antes de descartar un borrador. No son archivos confirmados del expediente.</p>
      {fallo ? <p className="aviso" data-nivel="alerta" role="alert">{fallo}</p> : null}
      {piezas.map((pieza) => {
        const fecha = new Date(pieza.tomadaEn)
        const fechaValida = !Number.isNaN(fecha.getTime())
        const titulo = GUIA_FOTOS.find((guia) => guia.id === pieza.guiaId)?.titulo ?? (pieza.tipo === 'audio' ? 'Relato en audio' : pieza.tipo === 'documento' ? 'Documento' : 'Fotografía')
        return (
          <div key={pieza.id} className="tarjeta-plana">
            <h3 className="titulo-tarjeta">{titulo}</h3>
            <p className="pregunta-ayuda">
              <time dateTime={fechaValida ? pieza.tomadaEn : undefined}>{fechaValida ? fecha.toLocaleString('es-AR') : 'Hora de captura no disponible'}</time>
              {' · '}{(pieza.bytes.size / 1024 / 1024).toFixed(2)} MB
            </p>
            <p className="aviso" data-nivel={pieza.error ? 'atencion' : 'info'}>
              {pieza.error ?? 'Esperando confirmación del servidor.'}
            </p>
            <div className="fila-botones">
              <button type="button" className="boton-secundario" onClick={() => descargar(pieza)}>Descargar respaldo</button>
              <button type="button" className="boton-peligro" disabled={ocupado} onClick={() => { void eliminar(pieza) }}>Eliminar borrador local</button>
            </div>
          </div>
        )
      })}
      <button type="button" className="boton-secundario" disabled={ocupado} onClick={() => { void reintentar() }}>{ocupado ? 'Actualizando pendientes...' : 'Reintentar subidas'}</button>
    </section>
  )
}
