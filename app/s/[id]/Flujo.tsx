'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { construirPasos, faltantes, pasoInicial, respondida, type Respuestas } from '@/lib/recorrido'
import { olvidarActuacion, recordarActuacion } from '@/lib/local'
import { drenar, encolar, huellaDe, pendientesDe } from '@/lib/cola'
import { leerBorradorActuacion, guardarBorradorActuacion, quitarBorradorActuacion } from '@/lib/borrador'
import { limpiarProgreso, type ProgresoRecorrido } from '@/lib/recorrido'
import { relatoCompleto } from '@/lib/relato'
import { PantallaRelato } from './pantallas/PantallaRelato'
import { AdjuntoActa } from '@/app/components/AdjuntoActa'
import { PendientesSubida } from '@/app/components/PendientesSubida'
import type { ContactoAnotado } from '@/app/components/ContactosTestigos'

import type { Croquis } from '@/lib/croquis'
import type { Datos, FalloGps, Media, Subir, Testigo, Ubicacion } from './tipos'
import { ChipUbicacion } from './pantallas/ChipUbicacion'
import { PantallaPregunta } from './pantallas/PantallaPregunta'
import { PantallaFoto } from './pantallas/PantallaFoto'
import { PantallaTestigos } from './pantallas/PantallaTestigos'
import { PantallaCorte } from './pantallas/PantallaCorte'
import { PantallaResumen } from './pantallas/PantallaResumen'
import { PantallaCroquis } from './pantallas/PantallaCroquis'
import { PantallaValidacion } from './pantallas/PantallaValidacion'
import { PantallaFirma } from './pantallas/PantallaFirma'
import { PantallaRevision } from './pantallas/PantallaRevision'
import { PantallaFinal } from './pantallas/PantallaFinal'

interface Props {
  casoId: string
  estadoInicial: string
  respuestasIniciales: Respuestas
  progresoInicial?: ProgresoRecorrido
  datosIniciales: Datos
  hashMaestro: string | null
  mediasIniciales: Media[]
  testigosIniciales: Testigo[]
  ubicacionInicial: Ubicacion
  croquisInicial: Croquis | null
}

/* ================= Componente principal ================= */

export function Flujo(props: Props) {
  const router = useRouter()
  const [respuestas, setRespuestas] = useState<Respuestas>(props.respuestasIniciales)
  const [medias, setMedias] = useState<Media[]>(props.mediasIniciales)
  const [testigos, setTestigos] = useState<Testigo[]>(props.testigosIniciales)
  const [ubicacion, setUbicacion] = useState<Ubicacion>(props.ubicacionInicial)
  const [estadoGps, setEstadoGps] = useState<'pidiendo' | 'ok' | 'error'>(props.ubicacionInicial ? 'ok' : 'pidiendo')
  const [falloGps, setFalloGps] = useState<FalloGps>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sinCopiaLocal, setSinCopiaLocal] = useState(false)
  const [validacionPendiente, setValidacionPendiente] = useState(false)
  const [cierre, setCierre] = useState<{ hash_maestro: string } | null>(
    props.hashMaestro ? { hash_maestro: props.hashMaestro } : null,
  )

  const pasos = useMemo(() => construirPasos(respuestas, validacionPendiente), [respuestas, validacionPendiente])

  const [clave, setClave] = useState<string>(() =>
    props.estadoInicial === 'cerrado'
      ? 'final'
      : pasoInicial(construirPasos(props.respuestasIniciales), props.respuestasIniciales, props.mediasIniciales, props.progresoInicial),
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

  const pendientes = useRef<{ respuestas: Respuestas }>({ respuestas: {} })
  const enVuelo = useRef<Respuestas>({})
  const progreso = useRef<ProgresoRecorrido>(props.progresoInicial ?? {})
  const respuestasRef = useRef(respuestas)
  respuestasRef.current = respuestas
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cola = useRef<Promise<void>>(Promise.resolve())
  const persistir = useCallback(() => {
    const guardado = guardarBorradorActuacion(props.casoId, {
      pendientes: { ...enVuelo.current, ...pendientes.current.respuestas },
      progreso: progreso.current,
    })
    setSinCopiaLocal(!guardado)
    return guardado
  }, [props.casoId])

  useEffect(() => {
    if (props.estadoInicial === 'cerrado') {
      quitarBorradorActuacion(props.casoId)
      return
    }
    const local = leerBorradorActuacion(props.casoId)
    if (local) {
      const combinadas = { ...props.respuestasIniciales, ...local.pendientes }
      pendientes.current.respuestas = local.pendientes
      respuestasRef.current = combinadas
      setRespuestas(combinadas)
      progreso.current = limpiarProgreso(local.progreso, combinadas)
      if (progreso.current.paso) setClave(progreso.current.paso)
    }
  }, [props.casoId, props.estadoInicial, props.respuestasIniciales])

  /*
   * Anota que este navegador tiene el id de la actuación. Es lo que después le habilita
   * las fotos, el audio y el expediente sin pedirle una cuenta.
   */
  useEffect(() => {
    fetch(`/api/casos/${props.casoId}/posesion`, { method: 'POST' }).catch(() => {})
  }, [props.casoId])

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
    if (props.estadoInicial === 'cerrado') return
    const guardado = leerBorradorActuacion(props.casoId)?.progreso?.paso ?? props.progresoInicial?.paso
    const destino = new URLSearchParams(window.location.search).get('paso') ?? guardado ?? claveRef.current
    const lista = pasosRef.current
    if (lista.findIndex((p) => p.clave === destino) > lista.findIndex((p) => p.tipo === 'corte')) {
      setEstadoGps('error')
      setFalloGps({ codigo: 0, motivo: 'no_solicitada' })
      return
    }
    pedirUbicacion()
  }, [props.ubicacionInicial, props.estadoInicial, props.casoId, props.progresoInicial, pedirUbicacion])

  /* ---------- Guardado automático ---------- */

  const enviarPendientes = useCallback(() => {
    /*
     * Los envíos se encolan en vez de dispararse en paralelo: el servidor combina
     * las respuestas leyendo primero lo guardado, así que dos PATCH simultáneos
     * pueden pisarse. Con auto-avance los toques llegan rápido, así que pasa.
     */
    cola.current = cola.current.catch(() => {}).then(async () => {
      const lote = pendientes.current
      pendientes.current = { respuestas: {} }
      enVuelo.current = lote.respuestas
      persistir()

      setGuardando(true)
      try {
        const res = await fetch(`/api/casos/${props.casoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ respuestas: lote.respuestas, progreso: progreso.current }),
        })
        if (!res.ok) {
          const cuerpo = await res.json().catch(() => ({}))
          throw new Error(cuerpo?.error ?? 'No se pudo guardar.')
        }
        setError(null)
        enVuelo.current = {}
        persistir()
      } catch (e) {
        // Se devuelven al buffer para reintentar en el próximo guardado.
        pendientes.current = { respuestas: { ...lote.respuestas, ...pendientes.current.respuestas } }
        setError(e instanceof Error ? e.message : 'No se pudo guardar.')
        enVuelo.current = {}
        persistir()
        throw e
      } finally {
        setGuardando(false)
      }
    })
    return cola.current
  }, [props.casoId, persistir])

  const programarGuardado = useCallback(() => {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = setTimeout(() => { void enviarPendientes().catch(() => {}) }, 700)
  }, [enviarPendientes])

  const responder = useCallback(
    (id: string, valor: unknown) => {
      setRespuestas((prev) => ({ ...prev, [id]: valor }))
      pendientes.current.respuestas[id] = valor
      respuestasRef.current = { ...respuestasRef.current, [id]: valor }
      persistir()
      programarGuardado()
    },
    [programarGuardado, persistir],
  )

  const sincronizarMedias = useCallback(async () => {
    const locales = await pendientesDe(props.casoId).catch(() => [])
    const res = await fetch(`/api/casos/${props.casoId}`)
    if (!res.ok) throw new Error('No se pudo confirmar la subida. Revisá la conexión y reintentá.')
    const cuerpo = await res.json()
    const recibidas: Media[] = cuerpo.medias ?? []
    setMedias([...recibidas, ...locales.filter((p) => !recibidas.some((m) => m.idempotencia === p.id))
      .map((p) => ({ id: p.id, idempotencia: p.id, tipo: p.tipo, guia_id: p.guiaId, pendiente: true }))])
    setTestigos(cuerpo.testigos ?? [])
    const extracciones = await fetch(`/api/casos/${props.casoId}/extracciones`).catch(() => null)
    if (extracciones?.ok) {
      const lecturas: Array<{ confirmada: boolean; estado: string }> = await extracciones.json()
      setValidacionPendiente(lecturas.some((l) => !l.confirmada && (l.estado === 'lista' || l.estado === 'pendiente')))
    }
  }, [props.casoId])

  const prepararCierre = useCallback(async () => {
    await enviarPendientes()
    await drenar(props.casoId)
    const pendientesArchivo = await pendientesDe(props.casoId)
    if (pendientesArchivo.length) throw new Error('Todavía hay archivos guardados sólo en este teléfono. Recuperá la conexión y esperá a que terminen de subir antes de firmar o cerrar.')
    await sincronizarMedias()
  }, [enviarPendientes, props.casoId, sincronizarMedias])

  useEffect(() => {
    if (props.estadoInicial === 'cerrado') return
    const recuperar = () => {
      void enviarPendientes().catch(() => {})
      void drenar(props.casoId).then(sincronizarMedias).catch(() => {})
    }
    const alSalir = () => { persistir() }
    window.addEventListener('online', recuperar)
    window.addEventListener('pagehide', alSalir)
    void sincronizarMedias().catch(() => {})
    return () => {
      window.removeEventListener('online', recuperar)
      window.removeEventListener('pagehide', alSalir)
      if (temporizador.current) clearTimeout(temporizador.current)
    }
  }, [props.estadoInicial, enviarPendientes, sincronizarMedias, persistir])

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
    if (clave !== 'final') {
      progreso.current = { ...progreso.current, paso: clave }
      persistir()
      programarGuardado()
    }
    if (desdeHistorial.current) {
      desdeHistorial.current = false
      return
    }
    // Se pasa `null` como estado a propósito: el estado del historial es de Next.
    window.history.pushState(null, '', `?paso=${encodeURIComponent(clave)}`)
    profundidad.current += 1
  }, [clave, persistir, programarGuardado])

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
      const lista = pasosRef.current
      const desde = lista.findIndex((p) => p.clave === claveRef.current)
      const siguiente = lista[Math.max(0, Math.min(lista.length - 1, (desde < 0 ? 0 : desde) + delta))]
      if (siguiente) {
        const avanzar = async () => {
          if (siguiente.tipo === 'firma') await prepararCierre()
          progreso.current = { ...progreso.current, paso: siguiente.clave }
          persistir()
          setClave(siguiente.clave)
          window.scrollTo({ top: 0 })
          void enviarPendientes().catch(() => {})
        }
        void avanzar().catch((e) => setError(e instanceof Error ? e.message : 'Reintentá guardar antes de continuar.'))
      }
    },
    [enviarPendientes, prepararCierre, persistir],
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
      void enviarPendientes().catch(() => {})
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

  /**
   * Incorpora una pieza.
   *
   * Primero se guarda en el teléfono y recién después se intenta subir. Sin eso, sacar una
   * foto sin señal la perdía: es la pieza más difícil de recuperar y la que más falta hace.
   *
   * El sha256 se calcula acá, sobre los bytes que salieron de la cámara, y el servidor lo
   * revalida. El identificador de idempotencia se genera por CAPTURA y nunca se reutiliza:
   * generado por guía, la segunda foto de una toma devolvería la primera.
   */
  const subir = useCallback<Subir>(
    async (archivo, tipo, guiaId) => {
      // Un rechazo por tamaño no se resuelve reintentando: no debe entrar en la cola durable.
      if (!archivo.size || archivo.size > 20 * 1024 * 1024) {
        throw new Error('El archivo debe tener contenido y pesar como máximo 20 MB. Elegí uno más pequeño o volvé a grabar.')
      }
      const sha256 = await huellaDe(archivo)
      const lista = pasosRef.current
      const enLugar = lista.findIndex((p) => p.clave === claveRef.current) <= lista.findIndex((p) => p.tipo === 'corte')
      // Confirmar nuevamente el mismo audio reutiliza su pieza aunque fallara el texto.
      const id = tipo === 'audio' ? `${props.casoId}-audio-${sha256.slice(0, 40)}` : crypto.randomUUID()
      const pieza = {
        id, casoId: props.casoId, tipo, guiaId: guiaId ?? null,
        mime: archivo.type, sha256, tomadaEn: new Date().toISOString(),
        // El relato y el acta pueden cargarse desde casa: no heredan el GPS anterior.
        lat: enLugar ? ubicacion?.lat ?? null : null, lon: enLugar ? ubicacion?.lon ?? null : null, bytes: archivo,
      }
      try {
        await encolar(pieza)
      } catch {
        const cuerpo = new FormData()
        cuerpo.append('archivo', archivo)
        cuerpo.append('tipo', tipo)
        cuerpo.append('idempotencia', id)
        cuerpo.append('sha256_cliente', sha256)
        cuerpo.append('tomada_en', pieza.tomadaEn)
        if (guiaId) cuerpo.append('guia_id', guiaId)
        if (pieza.lat !== null && pieza.lon !== null) {
          cuerpo.append('lat', String(pieza.lat))
          cuerpo.append('lon', String(pieza.lon))
        }
        const res = await fetch(`/api/casos/${props.casoId}/media`, { method: 'POST', body: cuerpo })
        const resultado = await res.json()
        if (!res.ok) throw new Error(resultado.error ?? 'No se guardó el archivo. Revisá la conexión y volvé a cargarlo.')
        await sincronizarMedias()
        return resultado.id
      }
      setMedias((prev) => [...prev.filter((m) => m.id !== id), { id, idempotencia: id, tipo, guia_id: guiaId ?? null, pendiente: true }])
      await drenar(props.casoId).catch(() => undefined)
      await sincronizarMedias().catch(() => undefined)
      return id
    },
    [props.casoId, ubicacion, sincronizarMedias],
  )

  /* ---------- Pantalla ---------- */

  const cerrado = cierre !== null
  const porcentaje = pasos.length > 1 ? Math.round((indice / (pasos.length - 1)) * 100) : 0
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
        {sinCopiaLocal ? <div className="aviso" data-nivel="atencion">Este navegador no permite guardar una copia local. Mantené la conexión y esperá a que termine el guardado antes de salir.</div> : null}
        {actual && ['corte', 'firma', 'revision', 'final'].includes(actual.tipo) ? (
          <PendientesSubida casoId={props.casoId} alCambiar={() => { void sincronizarMedias().catch(() => {}) }} />
        ) : null}

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
            adjunto={actual.pregunta.id === 'policia_acta' ? <AdjuntoActa medias={medias} subir={subir} /> : undefined}
          />
        ) : null}

        {actual?.tipo === 'relato' ? (
          <PantallaRelato
            casoId={props.casoId}
            textoInicial={String(respuestas.relato_texto ?? respuestas.relato_ampliado ?? '')}
            transcripcionInicial={String(respuestas.transcripcion_original ?? '')}
            hayAudio={medias.some((m) => m.tipo === 'audio')}
            audioId={[...medias].reverse().find((m) => m.tipo === 'audio' && m.id.startsWith('AUD-'))?.id}
            alConfirmar={async (texto, audio, original) => {
              if (audio) await subir(audio, 'audio')
              responder('relato_texto', texto)
              responder('transcripcion_original', original ?? '')
              await enviarPendientes()
            }}
            seguir={() => mover(1)}
          />
        ) : null}

        {actual?.tipo === 'resumen'  ? <PantallaResumen seguir={() => mover(1)} /> : null}

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
          <PantallaCorte
            casoId={props.casoId}
            contactos={Array.isArray(respuestas.contactos_testigos) ? respuestas.contactos_testigos as ContactoAnotado[] : []}
            alCambiarContactos={(contactos) => responder('contactos_testigos', contactos)}
            testigos={testigos}
            alRecibirTestigos={setTestigos}
            alIncorporar={() => { void sincronizarMedias().catch(() => {}) }}
            esencialesCompletos={faltantes(pasos.slice(0, pasos.findIndex((p) => p.tipo === 'corte')), respuestas, medias).length === 0}
            seguir={() => mover(1)}
            alGuardar={async () => {
              // La actuación queda abierta a propósito: el inicio la ofrece para retomarla.
              progreso.current = { ...progreso.current, paso: 'relato' }
              persistir()
              try { await enviarPendientes() } catch {
                if (!persistir()) {
                  setError('No pudimos guardar en el servidor ni en este teléfono. Mantené la página abierta y recuperá la conexión antes de salir.')
                  return
                }
              }
              router.push('/')
            }}
          />
        ) : null}

        {actual?.tipo === 'validacion' ? <PantallaValidacion casoId={props.casoId} seguir={() => mover(1)} /> : null}

        {actual?.tipo === 'croquis' ? (
          <PantallaCroquis
            casoId={props.casoId}
            inicial={props.croquisInicial}
            masDeDos={actual.masDeDosVehiculos}
            seguir={() => mover(1)}
          />
        ) : null}

        {actual?.tipo === 'firma' ? (
          <PantallaFirma casoId={props.casoId} nombreSugerido={props.datosIniciales.asegurado} antesDePreparar={prepararCierre} seguir={() => mover(1)} />
        ) : null}

        {actual?.tipo === 'revision' ? (
          <PantallaRevision
            casoId={props.casoId}
            faltantes={faltantes(pasos, respuestas, medias)}
            medias={medias}
            testigos={testigos}
            ubicacion={ubicacion}
            irA={irA}
            alReintentarGps={pedirUbicacion}
            antesDeCerrar={prepararCierre}
            tieneRelato={relatoCompleto(respuestas, medias)}
            contactosManuales={Array.isArray(respuestas.contactos_testigos) ? respuestas.contactos_testigos.length : 0}
            alCerrar={(r) => {
              if (temporizador.current) clearTimeout(temporizador.current)
              setCierre(r)
              olvidarActuacion()
              quitarBorradorActuacion(props.casoId)
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
