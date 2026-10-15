'use client'

import { useEffect, useRef, useState } from 'react'
import { Icono } from '@/app/components/Iconos'
import { borradorRequiereEleccion, borrarBorradorRelato, guardarBorradorRelato, leerBorradorRelato } from '@/lib/borrador-relato'
import type { BorradorRelato } from '@/lib/borrador-relato'

const MAXIMO_AUDIO = 20 * 1024 * 1024

const GUIA = [
  'Fecha, hora aproximada y calles donde ocurrió.',
  'Por dónde circulaba cada vehículo y en qué sentido.',
  'Qué maniobra hizo cada uno y a qué velocidad aproximada.',
  'En qué zonas de los vehículos fueron los impactos.',
  'Cómo estaban el clima, la luz y la visibilidad.',
  'Quién conducía y quiénes lo acompañaban.',
  'Quién pidió ayuda y a quién llamó.',
  'Qué pasó después del impacto.',
]

export function PantallaRelato({
  casoId,
  textoInicial,
  transcripcionInicial,
  hayAudio,
  audioId,
  alConfirmar,
  seguir,
}: {
  casoId: string
  textoInicial: string
  transcripcionInicial?: string
  hayAudio: boolean
  audioId?: string
  alConfirmar: (texto: string, audio: File | null, transcripcionOriginal: string | null) => Promise<void>
  seguir: () => void
}) {
  const [texto, ponerTexto] = useState(textoInicial)
  const [original, ponerOriginal] = useState<string | null>(transcripcionInicial ?? null)
  const [audio, ponerAudio] = useState<Blob | null>(null)
  const [nombreAudio, ponerNombreAudio] = useState<string | null>(null)
  const [modo, ponerModo] = useState<'audio' | 'texto'>(textoInicial ? 'texto' : 'audio')
  const [listo, ponerListo] = useState(false)
  const [grabando, ponerGrabando] = useState(false)
  const [pidiendoMicrofono, ponerPidiendoMicrofono] = useState(false)
  const [segundos, ponerSegundos] = useState(0)
  const [transcribiendo, ponerTranscribiendo] = useState(false)
  const [confirmando, ponerConfirmando] = useState(false)
  const [urlAudio, ponerUrlAudio] = useState<string | null>(null)
  const [fallo, ponerFallo] = useState<string | null>(null)
  const [falloLocal, ponerFalloLocal] = useState<string | null>(null)
  const [estadoLocal, ponerEstadoLocal] = useState('')
  const [pendiente, ponerPendiente] = useState<BorradorRelato | null>(null)
  const grabador = useRef<MediaRecorder | null>(null)
  const peticion = useRef<AbortController | null>(null)
  const montada = useRef(true)
  const trozos = useRef<Blob[]>([])
  const colaLocal = useRef<Promise<void>>(Promise.resolve())
  const guardadoConfirmado = useRef(false)
  const inicialesActuales = useRef({ texto: textoInicial, original: transcripcionInicial ?? null })
  inicialesActuales.current = { texto: textoInicial, original: transcripcionInicial ?? null }
  const borrador = useRef<BorradorRelato>({ casoId, texto: textoInicial, transcripcionOriginal: transcripcionInicial ?? null, audio: null, nombreAudio: null, modo: textoInicial ? 'texto' : 'audio', actualizadoEn: new Date().toISOString() })

  function persistir(actual: BorradorRelato) {
    colaLocal.current = colaLocal.current.catch(() => {}).then(() => guardarBorradorRelato(actual))
    colaLocal.current.then(() => {
      if (montada.current) {
        ponerFalloLocal(null)
        ponerEstadoLocal('Borrador guardado en este dispositivo.')
      }
    }).catch(() => {
      if (montada.current) {
        ponerFalloLocal('No se pudo conservar el borrador en el navegador. Liberá espacio y mantené esta pantalla abierta hasta confirmar.')
        ponerEstadoLocal('')
      }
    })
  }

  useEffect(() => {
    montada.current = true
    let vigente = true
    leerBorradorRelato(casoId).then((guardado) => {
      if (!vigente) return
      const actuales = inicialesActuales.current
      if (!guardado) {
        ponerTexto(actuales.texto)
        ponerOriginal(actuales.original)
        return
      }
      if (borradorRequiereEleccion(guardado, actuales.texto, actuales.original)) {
        ponerTexto(actuales.texto)
        ponerOriginal(actuales.original)
        ponerPendiente(guardado)
        return
      }
      ponerTexto(guardado.texto)
      ponerOriginal(guardado.transcripcionOriginal)
      ponerAudio(guardado.audio)
      ponerNombreAudio(guardado.nombreAudio)
      ponerModo(guardado.modo)
      borrador.current = guardado
    }).catch(() => {
      if (vigente) ponerFalloLocal('Habilitá el almacenamiento del navegador para conservar tu borrador al salir de esta pantalla.')
    }).finally(() => {
      if (vigente) ponerListo(true)
    })
    return () => {
      vigente = false
      montada.current = false
      peticion.current?.abort()
      const actual = grabador.current
      if (actual?.state === 'recording') actual.stop()
      actual?.stream.getTracks().forEach((pista) => pista.stop())
    }
  }, [casoId])

  useEffect(() => {
    if (!listo || pendiente || guardadoConfirmado.current) return
    const actual: BorradorRelato = { casoId, texto, transcripcionOriginal: original, audio, nombreAudio, modo, textoBase: inicialesActuales.current.texto, transcripcionBase: inicialesActuales.current.original, actualizadoEn: new Date().toISOString() }
    borrador.current = actual
    persistir(actual)
  }, [casoId, texto, original, audio, nombreAudio, modo, listo, pendiente])

  useEffect(() => {
    if (!audio || grabando) {
      ponerUrlAudio(null)
      return
    }
    const url = URL.createObjectURL(audio)
    ponerUrlAudio(url)
    return () => URL.revokeObjectURL(url)
  }, [audio, grabando])

  useEffect(() => {
    if (!grabando) return
    const reloj = setInterval(() => ponerSegundos((actual) => actual + 1), 1000)
    return () => clearInterval(reloj)
  }, [grabando])

  async function empezar() {
    ponerFallo(null)
    ponerPidiendoMicrofono(true)
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
        throw new Error('Tu navegador no permite grabar audio. Abrí la aplicación con HTTPS o elegí «Prefiero escribir».')
      }
      const flujo = await navigator.mediaDevices.getUserMedia({ audio: true })
      if (!montada.current) {
        flujo.getTracks().forEach((pista) => pista.stop())
        return
      }
      let nuevo: MediaRecorder
      try {
        nuevo = new MediaRecorder(flujo)
      } catch {
        flujo.getTracks().forEach((pista) => pista.stop())
        throw new Error('No se pudo iniciar la grabación. Probá con otro navegador o escribí el relato.')
      }
      const extension = nuevo.mimeType.includes('mp4') ? 'm4a' : nuevo.mimeType.includes('ogg') ? 'ogg' : 'webm'
      const nombre = `relato-${casoId}-${crypto.randomUUID()}.${extension}`
      trozos.current = []
      ponerAudio(null)
      ponerNombreAudio(nombre)
      if (original && texto === original) ponerTexto('')
      ponerOriginal(null)
      ponerModo('audio')
      ponerSegundos(0)
      nuevo.ondataavailable = (evento) => {
        if (!evento.data.size) return
        trozos.current.push(evento.data)
        const parcial = new Blob(trozos.current, { type: nuevo.mimeType || 'audio/webm' })
        const actual = { ...borrador.current, audio: parcial, nombreAudio: nombre, transcripcionOriginal: null, actualizadoEn: new Date().toISOString() }
        borrador.current = actual
        persistir(actual)
        if (parcial.size >= MAXIMO_AUDIO && nuevo.state === 'recording') {
          nuevo.stop()
          if (montada.current) ponerFallo('El audio alcanzó el límite de 20 MB. Grabá un relato más corto o escribilo.')
        }
      }
      nuevo.onstop = () => {
        flujo.getTracks().forEach((pista) => pista.stop())
        const final = new Blob(trozos.current, { type: nuevo.mimeType || 'audio/webm' })
        if (montada.current) {
          ponerAudio(final.size ? final : null)
          ponerGrabando(false)
          if (!final.size) ponerFallo('No se registró sonido. Revisá el micrófono y grabá otra vez, o escribí el relato.')
          else if (final.size <= MAXIMO_AUDIO) void transcribir(final, nombre)
        }
      }
      nuevo.onerror = () => {
        if (nuevo.state !== 'inactive') nuevo.stop()
        flujo.getTracks().forEach((pista) => pista.stop())
        if (montada.current) ponerFallo('Se interrumpió la grabación. Escuchá lo recuperado y regrabá si hace falta.')
      }
      grabador.current = nuevo
      try {
        nuevo.start(1000)
      } catch {
        flujo.getTracks().forEach((pista) => pista.stop())
        throw new Error('No se pudo iniciar la grabación. Revisá el micrófono o escribí el relato.')
      }
      ponerGrabando(true)
    } catch (error) {
      ponerFallo(error instanceof DOMException && error.name === 'NotAllowedError'
        ? 'Habilitá el permiso del micrófono en el navegador o elegí «Prefiero escribir».'
        : error instanceof Error ? error.message : 'Revisá el micrófono o escribí el relato.')
    } finally {
      if (montada.current) ponerPidiendoMicrofono(false)
    }
  }

  function eliminarAudio() {
    peticion.current?.abort()
    ponerAudio(null)
    ponerNombreAudio(null)
    ponerOriginal(transcripcionInicial ?? null)
    ponerFallo(null)
    ponerEstadoLocal('')
    // El texto corregido puede contener trabajo propio: descartar el audio no lo borra.
    ponerModo('texto')
  }

  async function transcribir(pieza = audio, nombre = nombreAudio) {
    if (!pieza) return
    ponerFallo(null)
    ponerTranscribiendo(true)
    const control = new AbortController()
    peticion.current = control
    const plazo = setTimeout(() => control.abort(), 55_000)
    try {
      const formulario = new FormData()
      formulario.append('archivo', new File([pieza], nombre ?? 'relato.webm', { type: pieza.type }))
      const respuesta = await fetch(`/api/casos/${casoId}/transcripcion`, { method: 'POST', body: formulario, signal: control.signal })
      const datos = await respuesta.json()
      if (!respuesta.ok) throw new Error(datos.error ?? 'Reintentá la transcripción o escribí el relato.')
      if (typeof datos.texto !== 'string' || !datos.texto.trim()) throw new Error('No se reconoció texto. Reintentá o escribí el relato.')
      if (!montada.current || control.signal.aborted) return
      ponerOriginal(datos.texto)
      // La transcripción nunca pisa correcciones escritas mientras esperaba la conexión.
      ponerTexto((actual) => actual.trim() ? actual : datos.texto)
      ponerModo('texto')
    } catch (error) {
      if (montada.current) ponerFallo(control.signal.aborted
        ? 'Se interrumpió la transcripción. Tu audio sigue guardado: reintentá o escribí el relato.'
        : error instanceof Error ? error.message : 'Revisá la conexión y reintentá, o escribí el relato.')
    } finally {
      clearTimeout(plazo)
      if (montada.current) ponerTranscribiendo(false)
      if (peticion.current === control) peticion.current = null
    }
  }

  async function confirmar() {
    if (audio && (audio.size === 0 || audio.size > MAXIMO_AUDIO)) {
      ponerFallo('El audio supera los 20 MB o está vacío. Descartalo con la X y grabá uno más corto, o conservá el relato por escrito.')
      return
    }
    if (!texto.trim() && !audio && !hayAudio) {
      ponerFallo('Escribí lo que pasó o grabá el relato antes de confirmar.')
      return
    }
    ponerConfirmando(true)
    ponerFallo(null)
    try {
      const archivo = audio ? new File([audio], nombreAudio ?? 'relato.webm', { type: audio.type }) : null
      await alConfirmar(texto.trim(), archivo, original)
      guardadoConfirmado.current = true
      await colaLocal.current.catch(() => {})
      await borrarBorradorRelato(casoId).catch(() => {})
      seguir()
    } catch (error) {
      ponerFallo(error instanceof Error ? error.message : 'Revisá la conexión y volvé a confirmar. El borrador se conserva.')
    } finally {
      if (montada.current) ponerConfirmando(false)
    }
  }

  const ocupado = !listo || !!pendiente || confirmando || pidiendoMicrofono
  const mmss = `${String(Math.floor(segundos / 60)).padStart(2, '0')}:${String(segundos % 60).padStart(2, '0')}`

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">Tu relato</div>
        <h1 className="pregunta">Contá qué pasó</h1>
        <p className="pregunta-ayuda">Podés grabarlo o escribirlo. Al detener la grabación se transcribe para que puedas corregirla antes de confirmar.</p>
        <div className="tarjeta">
          <p className="rotulo">Guía para recordar</p>
          <ul className="guia-relato">{GUIA.map((punto) => <li key={punto}>{punto}</li>)}</ul>
          <small>Contá lo que recordás. Si no sabés un dato, aclaralo.</small>
        </div>
        {fallo ? <div className="aviso" data-nivel="alerta" role="alert">{fallo}</div> : null}
        {falloLocal ? <div className="aviso" data-nivel="atencion" role="status">{falloLocal}</div> : null}
        {pendiente ? (
          <div className="aviso" data-nivel="atencion">
            <p>Tenés un borrador local distinto del relato confirmado. Elegí con cuál seguir.</p>
            <div className="fila-botones">
              <button type="button" className="boton-secundario" onClick={() => {
                ponerTexto(pendiente.texto)
                ponerOriginal(pendiente.transcripcionOriginal)
                ponerAudio(pendiente.audio)
                ponerNombreAudio(pendiente.nombreAudio)
                ponerModo(pendiente.modo)
                ponerPendiente(null)
              }}>Recuperar borrador</button>
              <button type="button" className="boton-secundario" onClick={() => ponerPendiente(null)}>Usar relato confirmado</button>
            </div>
          </div>
        ) : null}
        {hayAudio ? <div className="aviso" data-nivel="ok">Ya hay un audio confirmado en el expediente. Los nuevos borradores se agregan sólo cuando confirmás.</div> : null}
        {audioId ? <audio className="pieza-audio-reproductor" aria-label="Audio confirmado del relato" controls preload="metadata" src={`/api/media/${audioId}`} /> : null}
        <div className="fila-botones">
          {grabando ? (
            <button type="button" className="boton-emergencia" onClick={() => grabador.current?.stop()}>
              <span className="grabando" /> Detener · {mmss}
            </button>
          ) : (
            <button type="button" className="boton-primario" disabled={ocupado || transcribiendo} onClick={empezar}>
              <Icono nombre="microfono" /> {pidiendoMicrofono ? 'Habilitá el micrófono...' : audio ? 'Regrabar' : 'Grabar'}
            </button>
          )}
          <button type="button" className="boton-secundario" disabled={ocupado || grabando} onClick={() => ponerModo('texto')}>Prefiero escribir</button>
        </div>
        {grabando ? <p className="pregunta-ayuda" role="status">Grabando · {mmss}. Mantené la aplicación abierta.</p> : null}
        {audio && !grabando ? (
          <div className="tarjeta relato-borrador">
            <button type="button" className="relato-descartar" disabled={ocupado} onClick={eliminarAudio} aria-label="Eliminar el audio en borrador">×</button>
            <div className="rotulo">Audio en borrador</div>
            {urlAudio ? <audio className="pieza-audio-reproductor" aria-label="Escuchá tu borrador" controls src={urlAudio} /> : null}
            <div className="fila-botones">
              <button type="button" className="boton-secundario" disabled={ocupado || transcribiendo} onClick={() => void transcribir()}>{transcribiendo ? 'Transcribiendo...' : original ? 'Reintentar transcripción' : 'Transcribir audio'}</button>
            </div>
            <small>El audio se envía a ElevenLabs para transcribirlo. Se incorpora al expediente cuando confirmás. Si la transcripción falla, podés conservar el audio y continuar.</small>
          </div>
        ) : null}
        {modo === 'texto' || texto || original ? (
          <div className="campo">
            <label htmlFor="relato-confirmado">Tu relato para el expediente</label>
            <textarea id="relato-confirmado" rows={9} maxLength={30_000} value={texto} disabled={ocupado || grabando} onChange={(evento) => ponerTexto(evento.target.value)} placeholder="Contá cómo ocurrió el accidente..." />
            <small>Corregí nombres, calles y cualquier palabra que no coincida con lo que dijiste.</small>
          </div>
        ) : null}
        {original ? (
          <details className="tarjeta">
            <summary>Ver transcripción original</summary>
            <p className="pregunta-ayuda">{original}</p>
            <small>El original se conserva por separado del texto que confirmás.</small>
          </details>
        ) : null}
        <p className="pregunta-ayuda" role="status">{!listo ? 'Recuperando tu borrador...' : transcribiendo ? 'Podés escribir mientras esperás la transcripción.' : estadoLocal}</p>
      </div>
      <div className="barra-accion">
        <button type="button" className="boton-primario" disabled={ocupado || grabando || transcribiendo || (!texto.trim() && !audio && !hayAudio)} onClick={confirmar}>{confirmando ? 'Confirmando...' : 'Confirmar relato y seguir'}</button>
      </div>
    </>
  )
}
