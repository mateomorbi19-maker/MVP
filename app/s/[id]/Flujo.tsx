'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  RECORRIDO,
  ZONAS_IMPACTO,
  fotosVisibles,
  preguntasVisibles,
  seccionPorId,
  type Bloque,
  type GuiaFoto,
  type Pregunta,
  type Seccion,
} from '@/lib/cuestionario'
import { olvidarActuacion, recordarActuacion } from '@/lib/local'

type Respuestas = Record<string, unknown>
/** Motivo por el que no se pudo obtener la ubicación, para poder explicar qué hacer. */
type FalloGps = {
  codigo: number
  motivo: 'denegado' | 'no_disponible' | 'demora' | 'no_soportado' | 'servidor' | 'sin_respuesta'
  detalle?: string
} | null
type Media = { id: string; tipo: string; guia_id: string | null }
type Testigo = { id: string; nombre: string }
type Ubicacion = { lat: number; lon: number; direccion: string | null } | null
type Datos = { poliza: string; patente: string; asegurado: string; telefono: string }
type Subir = (archivo: File, tipo: 'foto' | 'audio', guiaId?: string) => Promise<string>

interface Props {
  casoId: string
  estadoInicial: string
  respuestasIniciales: Respuestas
  datosIniciales: Datos
  hashMaestro: string | null
  mediasIniciales: Media[]
  testigosIniciales: Testigo[]
  ubicacionInicial: Ubicacion
}

/* ================= El recorrido ================= */

type Paso =
  | { clave: string; bloque: Bloque; tipo: 'pregunta'; seccion: Seccion; pregunta: Pregunta }
  | { clave: string; bloque: Bloque; tipo: 'emergencia' }
  | { clave: string; bloque: Bloque; tipo: 'foto'; guia: GuiaFoto; numero: number; total: number }
  | { clave: string; bloque: Bloque; tipo: 'testigos' }
  | { clave: string; bloque: Bloque; tipo: 'corte' }
  | { clave: string; bloque: Bloque; tipo: 'datos' }
  | { clave: string; bloque: Bloque; tipo: 'revision' }
  | { clave: string; bloque: Bloque; tipo: 'final' }

const vacia = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

/** El relato no vive en las respuestas sino en los archivos: se comprueba aparte. */
function respondida(pregunta: Pregunta, respuestas: Respuestas, medias: Media[]): boolean {
  if (pregunta.tipo === 'audio') return medias.some((m) => m.tipo === 'audio')
  return !vacia(respuestas[pregunta.id])
}

/**
 * Arma la lista plana de pantallas a partir de las respuestas actuales.
 *
 * Se recalcula en cada cambio porque las preguntas condicionales aparecen y
 * desaparecen: por eso la navegación va por clave y no por índice.
 */
function construirPasos(respuestas: Respuestas): Paso[] {
  const pasos: Paso[] = []

  for (const etapa of RECORRIDO) {
    if (etapa.tipo === 'seccion') {
      const seccion = seccionPorId(etapa.id)
      if (!seccion) continue
      for (const pregunta of preguntasVisibles(seccion, respuestas)) {
        pasos.push({ clave: `p:${pregunta.id}`, bloque: seccion.bloque, tipo: 'pregunta', seccion, pregunta })
        // La pantalla de llamada va pegada a la respuesta que la dispara.
        const heridos = respuestas.heridos
        if (pregunta.id === 'heridos' && typeof heridos === 'string' && heridos !== 'No, nadie') {
          pasos.push({ clave: 'emergencia', bloque: 'seguridad', tipo: 'emergencia' })
        }
      }
      continue
    }

    if (etapa.tipo === 'fotos') {
      const guias = fotosVisibles(respuestas)
      guias.forEach((guia, i) =>
        pasos.push({
          clave: `f:${guia.id}`,
          bloque: 'lugar',
          tipo: 'foto',
          guia,
          numero: i + 1,
          total: guias.length,
        }),
      )
      continue
    }

    const bloque: Bloque = etapa.tipo === 'testigos' || etapa.tipo === 'corte' ? 'lugar' : 'despues'
    pasos.push({ clave: etapa.tipo, bloque, tipo: etapa.tipo } as Paso)
  }

  return pasos
}

/**
 * Dónde retomar.
 *
 * Desde que el último bloque se puede completar más tarde, volver siempre a la
 * primera pregunta sería inaceptable: la persona ya contestó veinte pantallas.
 * Se retoma en lo primero que quedó sin hacer.
 */
function pasoInicial(pasos: Paso[], respuestas: Respuestas, medias: Media[]): string {
  for (const paso of pasos) {
    if (paso.tipo === 'pregunta' && !respondida(paso.pregunta, respuestas, medias)) return paso.clave
    if (paso.tipo === 'foto' && paso.guia.obligatoria && !medias.some((m) => m.guia_id === paso.guia.id)) {
      return paso.clave
    }
  }
  return 'revision'
}

/* ================= Componente principal ================= */

export function Flujo(props: Props) {
  const [respuestas, setRespuestas] = useState<Respuestas>(props.respuestasIniciales)
  const [datos, setDatos] = useState<Datos>(props.datosIniciales)
  const [medias, setMedias] = useState<Media[]>(props.mediasIniciales)
  const [testigos, setTestigos] = useState<Testigo[]>(props.testigosIniciales)
  const [ubicacion, setUbicacion] = useState<Ubicacion>(props.ubicacionInicial)
  const [estadoGps, setEstadoGps] = useState<'pidiendo' | 'ok' | 'error'>(props.ubicacionInicial ? 'ok' : 'pidiendo')
  const [falloGps, setFalloGps] = useState<FalloGps>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cierre, setCierre] = useState<{ hash_maestro: string } | null>(
    props.hashMaestro ? { hash_maestro: props.hashMaestro } : null,
  )

  const pasos = useMemo(() => construirPasos(respuestas), [respuestas])

  const [clave, setClave] = useState<string>(() =>
    props.estadoInicial === 'cerrado'
      ? 'final'
      : pasoInicial(construirPasos(props.respuestasIniciales), props.respuestasIniciales, props.mediasIniciales),
  )

  /*
   * Navegación por clave.
   *
   * Los índices no sirven: contestar una pregunta puede insertar o quitar pantallas
   * más adelante. Si la pantalla actual desapareció —cambiar el tipo de siniestro
   * saca las preguntas del tercero— se cae al último índice conocido.
   */
  const indiceRef = useRef(0)
  let indice = pasos.findIndex((p) => p.clave === clave)
  if (indice < 0) indice = Math.min(indiceRef.current, pasos.length - 1)
  indiceRef.current = indice
  const actual = pasos[indice]

  const pasosRef = useRef(pasos)
  pasosRef.current = pasos
  const claveRef = useRef(clave)
  claveRef.current = clave

  const pendientes = useRef<{ respuestas: Respuestas; datos: Partial<Datos> }>({ respuestas: {}, datos: {} })
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cola = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    recordarActuacion(props.casoId)
  }, [props.casoId])

  /* ---------- Captura silenciosa de la ubicación ---------- */

  /**
   * Pide la ubicación al navegador y la registra en el servidor.
   *
   * Se guarda el motivo exacto del fallo: sin eso, un permiso denegado, un GPS apagado
   * y una demora se ven todos igual, y la persona no sabe qué hacer para resolverlo.
   * Es reintentable a propósito: parado al lado del auto, quedarse sin ubicación por
   * haber tocado "Bloquear" sin querer arruinaría el expediente entero.
   */
  const pedirUbicacion = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setEstadoGps('error')
      setFalloGps({ codigo: 0, motivo: 'no_soportado' })
      return
    }
    setEstadoGps('pidiendo')
    setFalloGps(null)

    /*
     * Vigilante propio.
     *
     * En iOS hay un defecto conocido: con la aplicación instalada en la pantalla de
     * inicio, a veces el cartel de permiso no aparece y getCurrentPosition no llama
     * a NINGUNA de las dos funciones, ni siquiera a la de tiempo agotado. Sin esto,
     * la pantalla se quedaría colgada en "Registrando la ubicación..." para siempre,
     * que es lo último que querés parado al lado de un auto chocado.
     */
    let resuelto = false
    let vigilante: ReturnType<typeof setTimeout> | undefined
    const marcarResuelto = () => {
      resuelto = true
      if (vigilante) clearTimeout(vigilante)
    }
    vigilante = setTimeout(() => {
      if (resuelto) return
      setEstadoGps('error')
      setFalloGps({ codigo: -2, motivo: 'sin_respuesta' })
    }, 25000)

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        marcarResuelto()
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
          if (!res.ok) throw new Error(cuerpo?.error ?? 'El servidor rechazó la ubicación.')
          setUbicacion({ lat: pos.coords.latitude, lon: pos.coords.longitude, direccion: cuerpo.direccion ?? null })
          setEstadoGps('ok')
        } catch (e) {
          setEstadoGps('error')
          setFalloGps({ codigo: -1, motivo: 'servidor', detalle: e instanceof Error ? e.message : undefined })
        }
      },
      (err) => {
        marcarResuelto()
        setEstadoGps('error')
        setFalloGps({
          codigo: err.code,
          motivo:
            err.code === err.PERMISSION_DENIED
              ? 'denegado'
              : err.code === err.POSITION_UNAVAILABLE
                ? 'no_disponible'
                : 'demora',
          detalle: err.message || undefined,
        })
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    )
  }, [props.casoId])

  useEffect(() => {
    if (props.ubicacionInicial) return
    pedirUbicacion()
  }, [props.ubicacionInicial, pedirUbicacion])

  /* ---------- Guardado automático ---------- */

  const enviarPendientes = useCallback(() => {
    /*
     * Los envíos se encolan en vez de dispararse en paralelo: el servidor combina
     * las respuestas leyendo primero lo guardado, así que dos PATCH simultáneos
     * pueden pisarse. Con auto-avance los toques llegan rápido, así que pasa.
     */
    cola.current = cola.current.then(async () => {
      const lote = pendientes.current
      pendientes.current = { respuestas: {}, datos: {} }
      const hayRespuestas = Object.keys(lote.respuestas).length > 0
      const hayDatos = Object.keys(lote.datos).length > 0
      if (!hayRespuestas && !hayDatos) return

      setGuardando(true)
      try {
        const res = await fetch(`/api/casos/${props.casoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ respuestas: lote.respuestas, datos: lote.datos }),
        })
        if (!res.ok) {
          const cuerpo = await res.json().catch(() => ({}))
          throw new Error(cuerpo?.error ?? 'No se pudo guardar.')
        }
        setError(null)
      } catch (e) {
        // Se devuelven al buffer para reintentar en el próximo guardado.
        pendientes.current = {
          respuestas: { ...lote.respuestas, ...pendientes.current.respuestas },
          datos: { ...lote.datos, ...pendientes.current.datos },
        }
        setError(e instanceof Error ? e.message : 'No se pudo guardar.')
      } finally {
        setGuardando(false)
      }
    })
    return cola.current
  }, [props.casoId])

  const programarGuardado = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(enviarPendientes, 700)
  }, [enviarPendientes])

  const responder = useCallback(
    (id: string, valor: unknown) => {
      setRespuestas((prev) => ({ ...prev, [id]: valor }))
      pendientes.current.respuestas[id] = valor
      programarGuardado()
    },
    [programarGuardado],
  )

  const anotarDato = useCallback(
    (clave: keyof Datos, valor: string) => {
      setDatos((prev) => ({ ...prev, [clave]: valor }))
      pendientes.current.datos[clave] = valor
      programarGuardado()
    },
    [programarGuardado],
  )

  /* ---------- Navegación ---------- */

  /*
   * Cada pantalla es una entrada del historial.
   *
   * Sin esto, el gesto de "atrás" del teléfono —que en Android se usa todo el
   * tiempo— saca a la persona del recorrido entero en vez de volver a la pregunta
   * anterior. Se usa la History API nativa, que Next sincroniza con su router.
   */
  const desdeHistorial = useRef(false)
  const montado = useRef(false)
  /** Cuántas entradas apilamos nosotros. Sirve para no salirnos del sitio al volver. */
  const profundidad = useRef(0)

  // El montaje lo resuelve el efecto de abajo, que corre después de éste.
  useEffect(() => {
    if (!montado.current) return
    if (desdeHistorial.current) {
      desdeHistorial.current = false
      return
    }
    // Se pasa `null` como estado a propósito: el estado del historial es de Next.
    window.history.pushState(null, '', `?paso=${encodeURIComponent(clave)}`)
    profundidad.current += 1
  }, [clave])

  useEffect(() => {
    /*
     * Al montar, manda la dirección: si trae una pantalla válida se retoma ahí.
     *
     * Esto tiene que resolverse acá y no en el efecto de arriba, que corre antes:
     * si aquél reemplazara la dirección en el montaje, borraría el `paso` que vino
     * en el enlace justo antes de que alguien lo leyera. Y la comparación con la
     * clave actual tampoco sobra: si son iguales React descarta el cambio de estado,
     * el efecto de arriba no vuelve a correr y la marca quedaría encendida,
     * comiéndose la siguiente navegación real.
     */
    const enUrl = new URLSearchParams(window.location.search).get('paso')
    if (enUrl && pasosRef.current.some((p) => p.clave === enUrl)) {
      if (enUrl !== claveRef.current) {
        desdeHistorial.current = true
        setClave(enUrl)
      }
    } else {
      // Sin pantalla en la dirección se reemplaza, no se apila: así el "atrás" de
      // la primera pantalla sale al inicio y no a una entrada fantasma.
      window.history.replaceState(null, '', `?paso=${encodeURIComponent(claveRef.current)}`)
    }
    montado.current = true

    const alVolver = () => {
      const destino = new URLSearchParams(window.location.search).get('paso')
      if (!destino) return
      profundidad.current = Math.max(0, profundidad.current - 1)
      desdeHistorial.current = true
      setClave(destino)
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('popstate', alVolver)
    return () => window.removeEventListener('popstate', alVolver)
  }, [])

  const irA = useCallback((destino: string) => {
    if (temporizador.current) clearTimeout(temporizador.current)
    setClave(destino)
    window.scrollTo({ top: 0 })
  }, [])

  const mover = useCallback(
    (delta: number) => {
      if (temporizador.current) clearTimeout(temporizador.current)
      void enviarPendientes()
      const lista = pasosRef.current
      const desde = lista.findIndex((p) => p.clave === claveRef.current)
      const siguiente = lista[Math.max(0, Math.min(lista.length - 1, (desde < 0 ? 0 : desde) + delta))]
      if (siguiente) {
        setClave(siguiente.clave)
        window.scrollTo({ top: 0 })
      }
    },
    [enviarPendientes],
  )

  /**
   * Volver.
   *
   * Si la pantalla anterior es una que apilamos nosotros, se deshace la entrada del
   * historial en vez de apilar otra: de lo contrario el botón "Atrás" de la pantalla
   * y el gesto de atrás del teléfono terminarían peleándose. Si no hay nada apilado
   * —el caso de retomar el enlace más tarde, que arranca a mitad del recorrido— se
   * navega hacia atrás por el recorrido, que sí existe siempre.
   */
  const volver = useCallback(() => {
    if (profundidad.current > 0) {
      if (temporizador.current) clearTimeout(temporizador.current)
      void enviarPendientes()
      window.history.back()
      return
    }
    mover(-1)
  }, [enviarPendientes, mover])

  /**
   * Contestar y avanzar de un solo toque.
   *
   * El retardo no es decorativo: sin él la pantalla cambia antes de que el dedo se
   * levante y no queda ninguna confirmación de qué se eligió. Con 260 ms se ve la
   * opción marcarse y recién ahí avanza.
   */
  const responderYAvanzar = useCallback(
    (id: string, valor: unknown) => {
      responder(id, valor)
      setTimeout(() => mover(1), 260)
    },
    [responder, mover],
  )

  /* ---------- Subida de archivos ---------- */

  const subir = useCallback<Subir>(
    async (archivo, tipo, guiaId) => {
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
      setMedias((prev) => [...prev.filter((m) => !guiaId || m.guia_id !== guiaId), { id: cuerpo.id, tipo, guia_id: guiaId ?? null }])
      return cuerpo.id as string
    },
    [props.casoId, ubicacion],
  )

  /* ---------- Pantalla ---------- */

  const cerrado = cierre !== null
  const porcentaje = pasos.length > 1 ? Math.round((indice / (pasos.length - 1)) * 100) : 0
  // La pantalla de emergencia también lleva encabezado: si alguien tocó "Sí" por
  // error, tiene que poder corregirlo sin depender del gesto de atrás del teléfono.
  const conEncabezado = actual && actual.tipo !== 'final' && !cerrado
  const conUbicacion = actual && actual.bloque !== 'seguridad' && actual.tipo !== 'final'

  return (
    <main className="envoltura-flujo">
      {conEncabezado ? (
        <div className="encabezado-flujo">
          {indice > 0 ? (
            <button className="volver" onClick={volver}>
              ← Atrás
            </button>
          ) : null}
          <div className="progreso-fino" role="progressbar" aria-valuenow={porcentaje} aria-valuemin={0} aria-valuemax={100}>
            <div style={{ width: `${porcentaje}%` }} />
          </div>
          {guardando ? <span className="contador">Guardando</span> : null}
        </div>
      ) : null}

      <div className="pantalla" key={actual?.clave ?? 'vacio'}>
        {conUbicacion ? (
          <ChipUbicacion estado={estadoGps} ubicacion={ubicacion} fallo={falloGps} alReintentar={pedirUbicacion} />
        ) : null}

        {error ? <div className="aviso aviso-alerta">{error}</div> : null}

        {actual?.tipo === 'pregunta' ? (
          <PantallaPregunta
            key={actual.clave}
            paso={actual}
            respuestas={respuestas}
            medias={medias}
            casoId={props.casoId}
            responder={responder}
            responderYAvanzar={responderYAvanzar}
            seguir={() => mover(1)}
            subir={subir}
          />
        ) : null}

        {actual?.tipo === 'emergencia' ? <PantallaEmergencia respuestas={respuestas} seguir={() => mover(1)} /> : null}

        {actual?.tipo === 'foto' ? (
          <PantallaFoto key={actual.clave} paso={actual} medias={medias} subir={subir} seguir={() => mover(1)} />
        ) : null}

        {actual?.tipo === 'testigos' ? (
          <PantallaTestigos
            casoId={props.casoId}
            testigos={testigos}
            setTestigos={setTestigos}
            seguir={() => mover(1)}
          />
        ) : null}

        {actual?.tipo === 'corte' ? (
          <PantallaCorte casoId={props.casoId} seguir={() => mover(1)} alCierre={() => irA('revision')} />
        ) : null}

        {actual?.tipo === 'datos' ? <PantallaDatos datos={datos} anotar={anotarDato} seguir={() => mover(1)} /> : null}

        {actual?.tipo === 'revision' ? (
          <PantallaRevision
            casoId={props.casoId}
            pasos={pasos}
            respuestas={respuestas}
            medias={medias}
            testigos={testigos}
            ubicacion={ubicacion}
            irA={irA}
            alReintentarGps={pedirUbicacion}
            antesDeCerrar={enviarPendientes}
            alCerrar={(r) => {
              setCierre(r)
              olvidarActuacion()
              setClave('final')
              window.scrollTo({ top: 0 })
            }}
          />
        ) : null}

        {actual?.tipo === 'final' ? <PantallaFinal casoId={props.casoId} cierre={cierre} /> : null}
      </div>
    </main>
  )
}

/* ================= Ubicación ================= */

/** Instrucción concreta según por qué falló, para que se pueda resolver en el momento. */
const GUIA_FALLO: Record<string, { titulo: string; comoResolver: string }> = {
  denegado: {
    titulo: 'El acceso a la ubicación está bloqueado',
    comoResolver:
      'En Android: tocá el candado a la izquierda de la dirección web y habilitá "Ubicación". En iPhone: entrá a Ajustes › Safari › Ajustes para sitios web › Ubicación y ponelo en "Permitir"; revisá además que Ajustes › Privacidad › Localización esté activado para Safari. Después volvé acá y reintentá.',
  },
  sin_respuesta: {
    titulo: 'El teléfono no respondió al pedido de ubicación',
    comoResolver:
      'Es un problema conocido de iPhone cuando la aplicación está instalada en la pantalla de inicio: el cartel de permiso a veces aparece en Safari en vez de acá. Abrí Safari, entrá a este mismo sitio, aceptá el permiso de ubicación, y después volvé a la aplicación y reintentá.',
  },
  no_disponible: {
    titulo: 'El dispositivo no pudo determinar dónde está',
    comoResolver:
      'Puede que el GPS esté apagado o que no haya señal. Activá la ubicación del teléfono, salí a cielo abierto si estás bajo techo, y reintentá.',
  },
  demora: {
    titulo: 'La ubicación tardó demasiado',
    comoResolver: 'Suele pasar bajo techo o entre edificios altos. Esperá unos segundos y volvé a intentar.',
  },
  no_soportado: {
    titulo: 'Este navegador no permite obtener la ubicación',
    comoResolver: 'Abrí el enlace desde Chrome o Safari en el teléfono. Es donde mejor funciona.',
  },
  servidor: {
    titulo: 'La ubicación se obtuvo pero no se pudo registrar',
    comoResolver: 'Puede ser un problema momentáneo de conexión. Reintentá en unos segundos.',
  },
}

/**
 * Estado de la ubicación en una línea.
 *
 * Ocupa una línea y no una tarjeta porque aparece en todas las pantallas del
 * recorrido: si fuera un cartel completo, empujaría la pregunta fuera de la vista
 * en cada paso. En rojo y tocable cuando hay algo que resolver.
 */
function ChipUbicacion({
  estado,
  ubicacion,
  fallo,
  alReintentar,
}: {
  estado: 'pidiendo' | 'ok' | 'error'
  ubicacion: Ubicacion
  fallo: FalloGps
  alReintentar: () => void
}) {
  const [abierto, setAbierto] = useState(false)

  if (estado !== 'error') {
    return (
      <div className="chip">
        <span className={`punto ${estado === 'ok' ? 'punto-ok' : 'punto-espera'}`} />
        <span>
          {estado === 'ok'
            ? `Ubicación registrada${ubicacion?.direccion ? ` · ${ubicacion.direccion.split(',').slice(0, 2).join(', ')}` : ''}`
            : 'Registrando la ubicación...'}
        </span>
      </div>
    )
  }

  const guia = GUIA_FALLO[fallo?.motivo ?? 'no_disponible'] ?? GUIA_FALLO.no_disponible

  return (
    <>
      <button className="chip" data-estado="error" onClick={() => setAbierto((a) => !a)}>
        <span className="punto punto-error" />
        <span>Sin ubicación · tocá para resolverlo</span>
        <span className="chip-flecha">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto ? (
        <div className="aviso aviso-atencion">
          <strong>{guia.titulo}</strong>
          <p style={{ margin: '6px 0 10px', fontSize: 13.5 }}>
            Sin ubicación, el expediente pierde el registro objetivo del lugar, la hora solar y el clima. Son
            justamente los datos que después permiten contrastar la declaración.
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 13.5 }}>{guia.comoResolver}</p>
          <button className="boton-secundario" onClick={alReintentar} style={{ width: '100%' }}>
            Reintentar la ubicación
          </button>
        </div>
      ) : null}
    </>
  )
}

/* ================= Una pregunta, una pantalla ================= */

function PantallaPregunta({
  paso,
  respuestas,
  medias,
  casoId,
  responder,
  responderYAvanzar,
  seguir,
  subir,
}: {
  paso: Extract<Paso, { tipo: 'pregunta' }>
  respuestas: Respuestas
  medias: Media[]
  casoId: string
  responder: (id: string, valor: unknown) => void
  responderYAvanzar: (id: string, valor: unknown) => void
  seguir: () => void
  subir: Subir
}) {
  const { pregunta, seccion } = paso
  const valor = respuestas[pregunta.id]
  const yaEsta = respondida(pregunta, respuestas, medias)
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
                  <span />
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
            className="campo-grande"
            type="text"
            autoFocus
            autoCapitalize={pregunta.id.includes('patente') ? 'characters' : 'sentences'}
            value={typeof valor === 'string' ? valor : ''}
            onChange={(e) => responder(pregunta.id, e.target.value)}
          />
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

/* ================= Emergencia ================= */

function PantallaEmergencia({ respuestas, seguir }: { respuestas: Respuestas; seguir: () => void }) {
  const dudoso = respuestas.heridos === 'No lo sé'

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="emergencia">
          <h1>{dudoso ? 'Fijate si alguien está herido' : 'Llamá ahora'}</h1>
          <p style={{ marginBottom: 18 }}>
            {dudoso
              ? 'Ante la duda, llamá. Una ambulancia que llega de más no cuesta nada; una que no llega, sí.'
              : 'Primero la gente. El registro queda guardado y podés volver cuando la situación esté controlada.'}
          </p>
          <div className="pila">
            <a href="tel:107" className="boton boton-llamada">
              107
              <span>Emergencias médicas</span>
            </a>
            <a href="tel:911" className="boton boton-llamada">
              911
              <span>Policía</span>
            </a>
          </div>
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-secundario" onClick={seguir} style={{ width: '100%' }}>
          Ya están siendo asistidos, seguir
        </button>
      </div>
    </>
  )
}

/* ================= Audio ================= */

function GrabadorAudio({ subir, yaGrabado, casoId }: { subir: Subir; yaGrabado: boolean; casoId: string }) {
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

/* ================= Fotos, una por pantalla ================= */

function PantallaFoto({
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

        {fallo ? <div className="aviso aviso-alerta">{fallo}</div> : null}

        {tomada ? (
          <div className="foto-tomada">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/api/media/${tomada.id}`} alt={paso.guia.titulo} />
          </div>
        ) : (
          <label className="foto-guiada">
            {subiendo ? 'Subiendo...' : 'Sacar la foto'}
            <small>La hora y el lugar los pone el sistema, no el archivo</small>
            <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={elegir} disabled={subiendo} />
          </label>
        )}
      </div>

      <div className="barra-accion">
        {tomada ? (
          <>
            <button className="boton-primario" onClick={seguir}>
              Seguir
            </button>
            <label className="boton boton-secundario" style={{ cursor: 'pointer' }}>
              Repetir la foto
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={elegir} />
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

/* ================= Testigos ================= */

function PantallaTestigos({
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

/* ================= Corte: lo urgente ya está ================= */

function PantallaCorte({
  casoId,
  seguir,
  alCierre,
}: {
  casoId: string
  seguir: () => void
  alCierre: () => void
}) {
  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="hito">
          <div className="hito-simbolo">✓</div>
          <h1 className="pregunta" style={{ marginBottom: 10 }}>
            Ya tenés lo importante
          </h1>
          <p className="pregunta-ayuda">
            Todo lo que sólo existía en el lugar quedó registrado, con su hora y su ubicación. Lo que falta son datos
            tuyos —la póliza, la licencia, la VTV— que podés completar cuando quieras.
          </p>
        </div>

        <div className="tarjeta centrado">
          <h3 style={{ marginBottom: 4 }}>Número de actuación</h3>
          <p className="numero-actuacion" style={{ margin: '4px 0 10px' }}>
            {casoId}
          </p>
          <p className="mini" style={{ margin: 0 }}>
            Podés cerrar la aplicación e irte. Al volver a abrirla, retomás justo acá.
          </p>
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={seguir}>
          Completar el resto ahora
        </button>
        <button className="boton-secundario" onClick={alCierre} style={{ width: '100%' }}>
          Ir directo al cierre
        </button>
      </div>
    </>
  )
}

/* ================= Datos del asegurado ================= */

function PantallaDatos({
  datos,
  anotar,
  seguir,
}: {
  datos: Datos
  anotar: (clave: keyof Datos, valor: string) => void
  seguir: () => void
}) {
  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">Tus datos</div>
        <h1 className="pregunta">¿Con qué póliza está asegurado?</h1>
        <p className="pregunta-ayuda">
          Son los datos de la carátula del expediente. Si no los tenés a mano, salteálos: podés volver a cargarlos
          hasta que cierres.
        </p>

        <div className="pila">
          <div className="campo">
            <label htmlFor="patente">Patente de tu vehículo</label>
            <input
              id="patente"
              className="campo-grande"
              type="text"
              placeholder="AB 123 CD"
              autoCapitalize="characters"
              value={datos.patente}
              onChange={(e) => anotar('patente', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="poliza">Número de póliza</label>
            <input
              id="poliza"
              className="campo-grande"
              type="text"
              value={datos.poliza}
              onChange={(e) => anotar('poliza', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="asegurado">Nombre y apellido</label>
            <input
              id="asegurado"
              className="campo-grande"
              type="text"
              placeholder="Como figura en la póliza"
              value={datos.asegurado}
              onChange={(e) => anotar('asegurado', e.target.value)}
            />
          </div>
          <div className="campo">
            <label htmlFor="telefono">Teléfono de contacto</label>
            <input
              id="telefono"
              className="campo-grande"
              type="tel"
              placeholder="11 5555 5555"
              value={datos.telefono}
              onChange={(e) => anotar('telefono', e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={seguir}>
          Seguir
        </button>
      </div>
    </>
  )
}

/* ================= Revisión y cierre ================= */

function PantallaRevision({
  casoId,
  pasos,
  respuestas,
  medias,
  testigos,
  ubicacion,
  irA,
  alReintentarGps,
  antesDeCerrar,
  alCerrar,
}: {
  casoId: string
  pasos: Paso[]
  respuestas: Respuestas
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

  /** Lo que falta, con la pantalla exacta a la que hay que volver para completarlo. */
  const faltantes = useMemo(
    () =>
      pasos.flatMap((paso) => {
        if (paso.tipo === 'pregunta' && paso.pregunta.requerida && !respondida(paso.pregunta, respuestas, medias)) {
          return [{ clave: paso.clave, texto: paso.pregunta.texto }]
        }
        if (paso.tipo === 'foto' && paso.guia.obligatoria && !medias.some((m) => m.guia_id === paso.guia.id)) {
          return [{ clave: paso.clave, texto: `Foto: ${paso.guia.titulo}` }]
        }
        return []
      }),
    [pasos, respuestas, medias],
  )

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
          <div className="aviso aviso-atencion">
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
                  <span className="punto punto-espera" />
                  {f.texto}
                  <span className="faltante-ir">Completar →</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {fallo ? <div className="aviso aviso-alerta">{fallo}</div> : null}
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={cerrar} disabled={cerrando}>
          {cerrando ? 'Sellando el expediente...' : 'Cerrar y sellar el expediente'}
        </button>
      </div>
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

function PantallaFinal({ casoId, cierre }: { casoId: string; cierre: { hash_maestro: string } | null }) {
  return (
    <div className="pantalla-cuerpo">
      <div className="hito">
        <div className="hito-simbolo">✓</div>
        <h1 className="pregunta">Expediente cerrado y sellado</h1>
        <p className="pregunta-ayuda">
          Presentalo en tu aseguradora. El número de actuación alcanza para que lo verifiquen.
        </p>
      </div>

      <div className="tarjeta">
        <h3>Número de actuación</h3>
        <p className="numero-actuacion" style={{ margin: '4px 0 16px' }}>
          {casoId}
        </p>

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
    </div>
  )
}
