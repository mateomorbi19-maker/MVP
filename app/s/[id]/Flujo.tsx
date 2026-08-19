'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { SECCIONES, GUIA_FOTOS, ZONAS_IMPACTO, preguntasVisibles, type Pregunta } from '@/lib/cuestionario'
import { Marca } from '@/app/components/Marca'

type Respuestas = Record<string, unknown>
type Media = { id: string; tipo: string; guia_id: string | null }
type Testigo = { id: string; nombre: string }
type Ubicacion = { lat: number; lon: number; direccion: string | null } | null

interface Props {
  casoId: string
  estadoInicial: string
  respuestasIniciales: Respuestas
  hashMaestro: string | null
  mediasIniciales: Media[]
  testigosIniciales: Testigo[]
  ubicacionInicial: Ubicacion
}

type Paso =
  | { tipo: 'seccion'; indice: number }
  | { tipo: 'fotos' }
  | { tipo: 'testigos' }
  | { tipo: 'revision' }
  | { tipo: 'final' }

const PASOS: Paso[] = [
  ...SECCIONES.map((_, indice) => ({ tipo: 'seccion' as const, indice })),
  { tipo: 'fotos' },
  { tipo: 'testigos' },
  { tipo: 'revision' },
  { tipo: 'final' },
]

export function Flujo(props: Props) {
  const [paso, setPaso] = useState(props.estadoInicial === 'cerrado' ? PASOS.length - 1 : 0)
  const [respuestas, setRespuestas] = useState<Respuestas>(props.respuestasIniciales)
  const [medias, setMedias] = useState<Media[]>(props.mediasIniciales)
  const [testigos, setTestigos] = useState<Testigo[]>(props.testigosIniciales)
  const [ubicacion, setUbicacion] = useState<Ubicacion>(props.ubicacionInicial)
  const [estadoGps, setEstadoGps] = useState<'pidiendo' | 'ok' | 'error'>(
    props.ubicacionInicial ? 'ok' : 'pidiendo',
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cierre, setCierre] = useState<{ hash_maestro: string } | null>(
    props.hashMaestro ? { hash_maestro: props.hashMaestro } : null,
  )

  const pendientes = useRef<Respuestas>({})
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const arriba = useRef<HTMLDivElement>(null)

  /* ---------- Captura silenciosa de la ubicación ---------- */

  useEffect(() => {
    if (props.ubicacionInicial) return
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setEstadoGps('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(`/api/casos/${props.casoId}/ubicacion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
              precision_m: pos.coords.accuracy,
            }),
          })
          const cuerpo = await res.json()
          if (!res.ok) throw new Error(cuerpo?.error)
          setUbicacion({ lat: pos.coords.latitude, lon: pos.coords.longitude, direccion: cuerpo.direccion ?? null })
          setEstadoGps('ok')
        } catch {
          setEstadoGps('error')
        }
      },
      () => setEstadoGps('error'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }, [props.casoId, props.ubicacionInicial])

  /* ---------- Guardado automático ---------- */

  const enviarPendientes = useCallback(async () => {
    const lote = pendientes.current
    pendientes.current = {}
    if (Object.keys(lote).length === 0) return
    setGuardando(true)
    try {
      const res = await fetch(`/api/casos/${props.casoId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuestas: lote }),
      })
      if (!res.ok) {
        const cuerpo = await res.json().catch(() => ({}))
        throw new Error(cuerpo?.error ?? 'No se pudo guardar.')
      }
      setError(null)
    } catch (e) {
      // Se devuelven al buffer para reintentar en el próximo guardado.
      pendientes.current = { ...lote, ...pendientes.current }
      setError(e instanceof Error ? e.message : 'No se pudo guardar.')
    } finally {
      setGuardando(false)
    }
  }, [props.casoId])

  const responder = useCallback(
    (id: string, valor: unknown) => {
      setRespuestas((prev) => ({ ...prev, [id]: valor }))
      pendientes.current[id] = valor
      if (temporizador.current) clearTimeout(temporizador.current)
      temporizador.current = setTimeout(enviarPendientes, 700)
    },
    [enviarPendientes],
  )

  const avanzar = useCallback(
    async (delta: number) => {
      if (temporizador.current) clearTimeout(temporizador.current)
      await enviarPendientes()
      setPaso((p) => Math.max(0, Math.min(PASOS.length - 1, p + delta)))
      arriba.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    },
    [enviarPendientes],
  )

  /* ---------- Subida de archivos ---------- */

  const subir = useCallback(
    async (archivo: File, tipo: 'foto' | 'audio', guiaId?: string) => {
      const form = new FormData()
      form.append('archivo', archivo)
      form.append('tipo', tipo)
      if (guiaId) form.append('guia_id', guiaId)
      if (ubicacion) {
        form.append('lat', String(ubicacion.lat))
        form.append('lon', String(ubicacion.lon))
      }
      const res = await fetch(`/api/casos/${props.casoId}/media`, { method: 'POST', body: form })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo subir el archivo.')
      setMedias((prev) => [...prev, { id: cuerpo.id, tipo, guia_id: guiaId ?? null }])
      return cuerpo.id as string
    },
    [props.casoId, ubicacion],
  )

  /* ---------- Progreso ---------- */

  const totalContestables = useMemo(
    () => SECCIONES.reduce((n, s) => n + preguntasVisibles(s, respuestas).length, 0),
    [respuestas],
  )
  const contestadas = useMemo(
    () =>
      SECCIONES.reduce(
        (n, s) =>
          n +
          preguntasVisibles(s, respuestas).filter((p) => {
            const v = respuestas[p.id]
            return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
          }).length,
        0,
      ),
    [respuestas],
  )
  const porcentaje = Math.round((paso / (PASOS.length - 1)) * 100)

  const actual = PASOS[paso]
  const cerrado = cierre !== null

  return (
    <main className="envoltura">
      <div ref={arriba} />
      <Marca sub={`Actuación ${props.casoId}`} />

      {!cerrado ? (
        <div className="progreso">
          <div className="progreso-barra">
            <div className="progreso-relleno" style={{ width: `${porcentaje}%` }} />
          </div>
          <div className="progreso-texto">
            <span>
              Paso {paso + 1} de {PASOS.length - 1}
            </span>
            <span>{guardando ? 'Guardando...' : `${contestadas} de ${totalContestables} respuestas`}</span>
          </div>
        </div>
      ) : null}

      <EstadoUbicacion estado={estadoGps} ubicacion={ubicacion} />

      {error ? <div className="aviso aviso-alerta">{error}</div> : null}

      {actual.tipo === 'seccion' ? (
        <PasoSeccion
          indice={actual.indice}
          respuestas={respuestas}
          responder={responder}
          subir={subir}
          medias={medias}
          casoId={props.casoId}
        />
      ) : null}

      {actual.tipo === 'fotos' ? <PasoFotos medias={medias} subir={subir} /> : null}

      {actual.tipo === 'testigos' ? (
        <PasoTestigos casoId={props.casoId} testigos={testigos} setTestigos={setTestigos} />
      ) : null}

      {actual.tipo === 'revision' ? (
        <PasoRevision
          casoId={props.casoId}
          respuestas={respuestas}
          medias={medias}
          testigos={testigos}
          ubicacion={ubicacion}
          alCerrar={(r) => {
            setCierre(r)
            setPaso(PASOS.length - 1)
            arriba.current?.scrollIntoView({ behavior: 'smooth' })
          }}
        />
      ) : null}

      {actual.tipo === 'final' ? <PasoFinal casoId={props.casoId} cierre={cierre} /> : null}

      {actual.tipo !== 'final' && actual.tipo !== 'revision' ? (
        <div className="fila-botones">
          {paso > 0 ? (
            <button className="boton-secundario" onClick={() => avanzar(-1)} style={{ flex: '0 0 34%' }}>
              Atrás
            </button>
          ) : null}
          <button className="boton-primario" onClick={() => avanzar(1)}>
            Continuar
          </button>
        </div>
      ) : null}
    </main>
  )
}

/* ================= Ubicación ================= */

function EstadoUbicacion({ estado, ubicacion }: { estado: 'pidiendo' | 'ok' | 'error'; ubicacion: Ubicacion }) {
  if (estado === 'pidiendo') {
    return (
      <div className="captura">
        <span className="punto punto-espera" />
        <span>Registrando la ubicación y las condiciones del lugar...</span>
      </div>
    )
  }
  if (estado === 'error') {
    return (
      <div className="captura">
        <span className="punto punto-error" />
        <span>
          Sin acceso a la ubicación. El expediente se genera igual, pero pierde el registro objetivo del lugar y del
          clima.
        </span>
      </div>
    )
  }
  return (
    <div className="captura">
      <span className="punto punto-ok" />
      <span>
        Ubicación registrada
        {ubicacion?.direccion ? ` · ${ubicacion.direccion.split(',').slice(0, 3).join(', ')}` : ''}
      </span>
    </div>
  )
}

/* ================= Secciones del cuestionario ================= */

function PasoSeccion({
  indice,
  respuestas,
  responder,
  subir,
  medias,
  casoId,
}: {
  indice: number
  respuestas: Respuestas
  responder: (id: string, valor: unknown) => void
  subir: (a: File, t: 'foto' | 'audio', g?: string) => Promise<string>
  medias: Media[]
  casoId: string
}) {
  const seccion = SECCIONES[indice]
  const visibles = preguntasVisibles(seccion, respuestas)
  const esTriage = seccion.id === 'triage'
  const heridos = String(respuestas.heridos ?? '')
  const hayHeridos = heridos.startsWith('Sí')

  return (
    <>
      <h1>{seccion.titulo}</h1>
      <p className="apagado">{seccion.descripcion}</p>

      {esTriage ? (
        <div className="tarjeta">
          <h3 style={{ marginBottom: 10 }}>Si hay heridos, llamá ahora</h3>
          <div className="pila">
            <a href="tel:107" className="boton boton-emergencia">
              Llamar al 107 · Emergencias médicas
            </a>
            <a href="tel:911" className="boton boton-secundario">
              Llamar al 911 · Policía
            </a>
          </div>
          <p className="mini" style={{ marginTop: 12, marginBottom: 0 }}>
            El registro queda guardado. Podés volver cuando la situación esté controlada.
          </p>
        </div>
      ) : null}

      {esTriage && hayHeridos ? (
        <div className="aviso aviso-alerta">
          Declaraste que hay personas heridas. Asegurate de que estén siendo asistidas antes de seguir con el registro.
        </div>
      ) : null}

      {visibles.map((p) => (
        <CampoPregunta
          key={p.id}
          pregunta={p}
          valor={respuestas[p.id]}
          responder={responder}
          subir={subir}
          medias={medias}
          casoId={casoId}
        />
      ))}
    </>
  )
}

function CampoPregunta({
  pregunta,
  valor,
  responder,
  subir,
  medias,
  casoId,
}: {
  pregunta: Pregunta
  valor: unknown
  responder: (id: string, valor: unknown) => void
  subir: (a: File, t: 'foto' | 'audio', g?: string) => Promise<string>
  medias: Media[]
  casoId: string
}) {
  return (
    <div className="tarjeta">
      <label htmlFor={pregunta.id}>{pregunta.texto}</label>
      {pregunta.ayuda ? <p className="ayuda">{pregunta.ayuda}</p> : null}

      {pregunta.tipo === 'opcion' ? (
        <div className="opciones">
          {pregunta.opciones?.map((o) => (
            <button
              key={o}
              type="button"
              className="opcion"
              data-elegida={valor === o}
              onClick={() => responder(pregunta.id, o)}
            >
              <span className="marca-opcion">
                <span />
              </span>
              {o}
            </button>
          ))}
        </div>
      ) : null}

      {pregunta.tipo === 'multiple' ? (
        <div className="opciones">
          {pregunta.opciones?.map((o) => {
            const actuales = Array.isArray(valor) ? (valor as string[]) : []
            const elegida = actuales.includes(o)
            return (
              <button
                key={o}
                type="button"
                className="opcion"
                data-elegida={elegida}
                onClick={() =>
                  responder(pregunta.id, elegida ? actuales.filter((x) => x !== o) : [...actuales, o])
                }
              >
                <span className="marca-opcion" data-cuadrada="true">
                  <span />
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
          type="text"
          value={typeof valor === 'string' ? valor : ''}
          onChange={(e) => responder(pregunta.id, e.target.value)}
        />
      ) : null}

      {pregunta.tipo === 'numero' ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id={pregunta.id}
            type="number"
            inputMode="numeric"
            value={typeof valor === 'number' || typeof valor === 'string' ? String(valor) : ''}
            onChange={(e) => responder(pregunta.id, e.target.value === '' ? '' : Number(e.target.value))}
          />
          {pregunta.unidad ? <span className="apagado">{pregunta.unidad}</span> : null}
        </div>
      ) : null}

      {pregunta.tipo === 'zonaImpacto' ? (
        <div className="zonas">
          {ZONAS_IMPACTO.map((z) => (
            <button
              key={z}
              type="button"
              className="zona"
              data-elegida={valor === z}
              onClick={() => responder(pregunta.id, z)}
            >
              {z}
            </button>
          ))}
        </div>
      ) : null}

      {pregunta.tipo === 'persona' ? <CamposPersona id={pregunta.id} valor={valor} responder={responder} /> : null}

      {pregunta.tipo === 'audio' ? (
        <GrabadorAudio subir={subir} yaGrabado={medias.some((m) => m.tipo === 'audio')} casoId={casoId} />
      ) : null}
    </div>
  )
}

function CamposPersona({
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
      <input type="text" placeholder="Nombre y apellido" value={actual.nombre ?? ''} onChange={(e) => set('nombre', e.target.value)} />
      <input type="text" placeholder="DNI" value={actual.dni ?? ''} onChange={(e) => set('dni', e.target.value)} />
      <input type="tel" placeholder="Teléfono" value={actual.telefono ?? ''} onChange={(e) => set('telefono', e.target.value)} />
    </div>
  )
}

/* ================= Audio ================= */

function GrabadorAudio({
  subir,
  yaGrabado,
  casoId,
}: {
  subir: (a: File, t: 'foto' | 'audio', g?: string) => Promise<string>
  yaGrabado: boolean
  casoId: string
}) {
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
      {listo ? (
        <div className="aviso aviso-ok" style={{ marginBottom: 10 }}>
          Relato grabado e incorporado al expediente.
        </div>
      ) : null}
      {fallo ? <div className="aviso aviso-alerta">{fallo}</div> : null}

      {!grabando ? (
        <button className="boton-secundario" onClick={empezar} disabled={subiendo} style={{ width: '100%' }}>
          {subiendo ? 'Incorporando el audio...' : listo ? 'Grabar otra vez' : 'Empezar a grabar'}
        </button>
      ) : (
        <button className="boton-emergencia" onClick={frenar}>
          <span className="grabando" />
          Detener grabación · {mmss}
        </button>
      )}
    </div>
  )
}

/* ================= Fotos ================= */

function PasoFotos({
  medias,
  subir,
}: {
  medias: Media[]
  subir: (a: File, t: 'foto' | 'audio', g?: string) => Promise<string>
}) {
  const [subiendo, setSubiendo] = useState<string | null>(null)
  const [fallo, setFallo] = useState<string | null>(null)
  const porGuia = new Map(medias.filter((m) => m.tipo === 'foto' && m.guia_id).map((m) => [m.guia_id as string, m.id]))
  const hechas = GUIA_FOTOS.filter((g) => porGuia.has(g.id)).length
  const obligatoriasFaltantes = GUIA_FOTOS.filter((g) => g.obligatoria && !porGuia.has(g.id))

  async function elegir(e: React.ChangeEvent<HTMLInputElement>, guiaId: string) {
    const archivo = e.target.files?.[0]
    e.target.value = ''
    if (!archivo) return
    setSubiendo(guiaId)
    setFallo(null)
    try {
      await subir(archivo, 'foto', guiaId)
    } catch (err) {
      setFallo(err instanceof Error ? err.message : 'No se pudo subir la fotografía.')
    } finally {
      setSubiendo(null)
    }
  }

  return (
    <>
      <h1>Fotografías del lugar</h1>
      <p className="apagado">
        Te vamos a pedir {GUIA_FOTOS.length} tomas, una por una. La ubicación y la hora las pone el sistema, no el
        archivo: por eso no se pueden falsificar después.
      </p>

      <div className="captura">
        <span className={`punto ${obligatoriasFaltantes.length === 0 ? 'punto-ok' : 'punto-espera'}`} />
        <span>
          {hechas} de {GUIA_FOTOS.length} tomas cargadas
          {obligatoriasFaltantes.length > 0 ? ` · faltan ${obligatoriasFaltantes.length} obligatorias` : ' · completas'}
        </span>
      </div>

      {fallo ? <div className="aviso aviso-alerta">{fallo}</div> : null}

      {GUIA_FOTOS.map((g) => {
        const mediaId = porGuia.get(g.id)
        return (
          <div className="tarjeta" key={g.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <h3>{g.titulo}</h3>
                <p className="ayuda" style={{ marginBottom: 10 }}>
                  {g.instruccion}
                </p>
              </div>
              <span className={`insignia ${g.obligatoria ? 'insignia-atencion' : 'insignia-neutra'}`}>
                {g.obligatoria ? 'Obligatoria' : 'Opcional'}
              </span>
            </div>

            {mediaId ? (
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <div className="miniatura" style={{ width: 84, flexShrink: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/media/${mediaId}`} alt={g.titulo} />
                  <span className="tilde">✓</span>
                </div>
                <label className="boton boton-secundario" style={{ flex: 1, cursor: 'pointer' }}>
                  Reemplazar
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={(e) => elegir(e, g.id)}
                  />
                </label>
              </div>
            ) : (
              <label className="boton boton-primario" style={{ cursor: 'pointer' }}>
                {subiendo === g.id ? 'Subiendo...' : 'Sacar la foto'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  style={{ display: 'none' }}
                  onChange={(e) => elegir(e, g.id)}
                  disabled={subiendo !== null}
                />
              </label>
            )}
          </div>
        )
      })}
    </>
  )
}

/* ================= Testigos ================= */

function PasoTestigos({
  casoId,
  testigos,
  setTestigos,
}: {
  casoId: string
  testigos: Testigo[]
  setTestigos: (t: Testigo[]) => void
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
      <h1>Testigos</h1>
      <p className="apagado">
        Mostrale esta pantalla a quien haya visto el accidente. Lo escanea con <strong>su</strong> teléfono y carga sus
        datos él mismo. Un dato cargado por el testigo vale mucho más que uno anotado por vos.
      </p>

      <div className="tarjeta centrado">
        {svg ? (
          <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
        ) : (
          <p className="apagado">Generando el código...</p>
        )}
        <p className="mini" style={{ marginTop: 12, marginBottom: 10 }}>
          {enlace}
        </p>
        <button className="boton-secundario" onClick={compartir} style={{ width: '100%' }}>
          Compartir el enlace
        </button>
      </div>

      <div className="tarjeta">
        <h3>Testigos registrados ({testigos.length})</h3>
        {testigos.length === 0 ? (
          <p className="apagado" style={{ marginBottom: 0 }}>
            Todavía no cargó nadie. Esta pantalla se actualiza sola.
          </p>
        ) : (
          <div className="pila">
            {testigos.map((t) => (
              <div key={t.id} className="tarjeta-plana" style={{ marginBottom: 0 }}>
                <strong>{t.nombre}</strong>
                <div className="mini">{t.id}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="mini">
        Si no hay testigos, seguí adelante. El expediente lo va a dejar asentado expresamente.
      </p>
    </>
  )
}

/* ================= Revisión y cierre ================= */

function PasoRevision({
  casoId,
  respuestas,
  medias,
  testigos,
  ubicacion,
  alCerrar,
}: {
  casoId: string
  respuestas: Respuestas
  medias: Media[]
  testigos: Testigo[]
  ubicacion: Ubicacion
  alCerrar: (r: { hash_maestro: string }) => void
}) {
  const [cerrando, setCerrando] = useState(false)
  const [fallo, setFallo] = useState<string | null>(null)

  const fotos = medias.filter((m) => m.tipo === 'foto').length
  const audios = medias.filter((m) => m.tipo === 'audio').length
  const obligatoriasFaltantes = GUIA_FOTOS.filter(
    (g) => g.obligatoria && !medias.some((m) => m.guia_id === g.id),
  ).length
  const sinResponder = SECCIONES.flatMap((s) =>
    preguntasVisibles(s, respuestas).filter((p) => {
      if (!p.requerida) return false
      const v = respuestas[p.id]
      return v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)
    }),
  )

  async function cerrar() {
    setCerrando(true)
    setFallo(null)
    try {
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
      <h1>Antes de cerrar</h1>
      <p className="apagado">
        Al cerrar, el expediente se sella y ya no admite cambios. Es lo que le da valor: nadie puede modificarlo
        después, ni vos.
      </p>

      <div className="tarjeta">
        <h3 style={{ marginBottom: 12 }}>Lo que se va a sellar</h3>
        <div className="pila">
          <Linea etiqueta="Ubicación y clima" ok={ubicacion !== null} texto={ubicacion ? 'Registrados' : 'Sin registrar'} />
          <Linea
            etiqueta="Respuestas obligatorias"
            ok={sinResponder.length === 0}
            texto={sinResponder.length === 0 ? 'Completas' : `Faltan ${sinResponder.length}`}
          />
          <Linea
            etiqueta="Fotografías"
            ok={obligatoriasFaltantes === 0}
            texto={`${fotos} cargadas${obligatoriasFaltantes > 0 ? ` · faltan ${obligatoriasFaltantes} obligatorias` : ''}`}
          />
          <Linea etiqueta="Relato en audio" ok={audios > 0} texto={audios > 0 ? 'Grabado' : 'Sin grabar'} />
          <Linea etiqueta="Testigos" ok={testigos.length > 0} texto={`${testigos.length} registrados`} />
        </div>
      </div>

      {sinResponder.length > 0 ? (
        <div className="aviso aviso-atencion">
          Quedaron {sinResponder.length} preguntas obligatorias sin responder. Podés cerrar igual, pero cada faltante
          debilita el expediente y queda asentado como tal.
        </div>
      ) : null}

      {fallo ? <div className="aviso aviso-alerta">{fallo}</div> : null}

      <button className="boton-primario" onClick={cerrar} disabled={cerrando}>
        {cerrando ? 'Sellando el expediente...' : 'Cerrar y sellar el expediente'}
      </button>
    </>
  )
}

function Linea({ etiqueta, ok, texto }: { etiqueta: string; ok: boolean; texto: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <span className={`punto ${ok ? 'punto-ok' : 'punto-espera'}`} />
        {etiqueta}
      </span>
      <span className="mini" style={{ textAlign: 'right' }}>
        {texto}
      </span>
    </div>
  )
}

/* ================= Final ================= */

function PasoFinal({ casoId, cierre }: { casoId: string; cierre: { hash_maestro: string } | null }) {
  return (
    <>
      <div className="aviso aviso-ok">Expediente cerrado y sellado.</div>
      <h1>Listo</h1>
      <p className="apagado">
        El expediente quedó registrado con su cadena de custodia. Presentalo en tu aseguradora; el número de actuación
        alcanza para que lo verifiquen.
      </p>

      <div className="tarjeta">
        <h3>Número de actuación</h3>
        <p style={{ fontSize: 24, fontWeight: 700, letterSpacing: '0.02em', margin: '4px 0 14px' }}>{casoId}</p>

        {cierre ? (
          <>
            <h3>Hash maestro</h3>
            <p className="mono" style={{ marginBottom: 16 }}>
              {cierre.hash_maestro}
            </p>
          </>
        ) : null}

        <div className="pila">
          <a className="boton boton-primario" href={`/api/casos/${casoId}/pdf?descargar=1`}>
            Descargar el expediente en PDF
          </a>
          <a className="boton boton-secundario" href={`/api/casos/${casoId}/pdf`} target="_blank" rel="noreferrer">
            Verlo en pantalla
          </a>
          <Link className="boton boton-secundario" href={`/verificar?id=${casoId}`}>
            Verificar la integridad
          </Link>
        </div>
      </div>

      <p className="mini">
        Guardá el número de actuación. Cualquiera puede comprobar con él que el expediente no fue modificado, sin
        necesidad de acceder a su contenido.
      </p>
    </>
  )
}
