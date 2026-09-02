'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { construirPasos, faltantes, pasoInicial, respondida, type Respuestas } from '@/lib/recorrido'
import { olvidarActuacion, recordarActuacion } from '@/lib/local'

import type { Datos, FalloGps, Media, Subir, Testigo, Ubicacion } from './tipos'
import { ChipUbicacion } from './pantallas/ChipUbicacion'
import { PantallaPregunta } from './pantallas/PantallaPregunta'
import { PantallaEmergencia } from './pantallas/PantallaEmergencia'
import { PantallaFoto } from './pantallas/PantallaFoto'
import { PantallaTestigos } from './pantallas/PantallaTestigos'
import { PantallaCorte } from './pantallas/PantallaCorte'
import { PantallaDatos } from './pantallas/PantallaDatos'
import { PantallaRevision } from './pantallas/PantallaRevision'
import { PantallaFinal } from './pantallas/PantallaFinal'

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
            <div className="progreso-fino-relleno" style={{ ['--avance']: `${porcentaje}%` } as React.CSSProperties} />
          </div>
          {guardando ? <span className="contador">Guardando</span> : null}
        </div>
      ) : null}

      <div className="pantalla" data-paso={actual?.tipo ?? 'vacio'} data-bloque={actual?.bloque ?? 'vacio'} key={actual?.clave ?? 'vacio'}>
        {conUbicacion ? (
          <ChipUbicacion estado={estadoGps} ubicacion={ubicacion} fallo={falloGps} alReintentar={pedirUbicacion} />
        ) : null}

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

        {actual?.tipo === 'pregunta' ? (
          <PantallaPregunta
            key={actual.clave}
            paso={actual}
            valor={respuestas[actual.pregunta.id]}
            yaEsta={respondida(actual.pregunta, respuestas, medias)}
            medias={medias}
            casoId={props.casoId}
            responder={responder}
            responderYAvanzar={responderYAvanzar}
            seguir={() => mover(1)}
            subir={subir}
          />
        ) : null}

        {actual?.tipo === 'emergencia' ? <PantallaEmergencia variante={actual.variante} seguir={() => mover(1)} /> : null}

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
            faltantes={faltantes(pasos, respuestas, medias)}
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
