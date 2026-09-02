'use client'

import { useEffect, useRef, useState } from 'react'
import type { Subir } from '../tipos'

/* ================= Audio ================= */

export function GrabadorAudio({ subir, yaGrabado, casoId }: { subir: Subir; yaGrabado: boolean; casoId: string }) {
  const [grabando, setGrabando] = useState(false)
  const [segundos, setSegundos] = useState(0)
  const [listo, setListo] = useState(yaGrabado)
  const [fallo, setFallo] = useState<string | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const grabador = useRef<MediaRecorder | null>(null)
  const trozos = useRef<Blob[]>([])
  const reloj = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    return () => {
      if (reloj.current) clearInterval(reloj.current)
      grabador.current?.stream.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function empezar() {
    setFallo(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      trozos.current = []
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) trozos.current.push(e.data)
      }
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(trozos.current, { type: mr.mimeType || 'audio/webm' })
        setSubiendo(true)
        try {
          const extension = (mr.mimeType || 'audio/webm').includes('mp4') ? 'm4a' : 'webm'
          await subir(new File([blob], `relato-${casoId}.${extension}`, { type: blob.type }), 'audio')
          setListo(true)
        } catch (e) {
          setFallo(e instanceof Error ? e.message : 'No se pudo subir el audio.')
        } finally {
          setSubiendo(false)
        }
      }
      mr.start()
      grabador.current = mr
      setGrabando(true)
      setSegundos(0)
      reloj.current = setInterval(() => setSegundos((s) => s + 1), 1000)
    } catch {
      setFallo('No se pudo acceder al micrófono. Revisá los permisos del navegador.')
    }
  }

  function frenar() {
    grabador.current?.stop()
    setGrabando(false)
    if (reloj.current) clearInterval(reloj.current)
  }

  const mmss = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`

  return (
    <div>
      {listo ? <div className="aviso aviso-ok" style={{ marginBottom: 12 }}>Relato incorporado al expediente.</div> : null}
      {fallo ? <div className="aviso aviso-alerta">{fallo}</div> : null}

      {!grabando ? (
        <button
          className={listo ? 'boton-secundario' : 'boton-primario'}
          onClick={empezar}
          disabled={subiendo}
          style={{ width: '100%', minHeight: 72, fontSize: 18 }}
        >
          {subiendo ? 'Incorporando el audio...' : listo ? 'Grabar otra vez' : 'Empezar a grabar'}
        </button>
      ) : (
        <button className="boton-emergencia" onClick={frenar} style={{ minHeight: 72, fontSize: 18 }}>
          <span className="grabando" />
          Detener · {mmss}
        </button>
      )}
    </div>
  )
}
