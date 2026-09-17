import { evaluarEpisodio, frenadaBrusca, type MuestraViaje, type NivelViaje, type VelocidadViaje, type VeredictoViaje } from './impacto'

/**
 * Motor del modo viaje: sensores, GPS, pantalla encendida y alerta.
 *
 * Vive fuera de React y es uno solo por pestaña. Si viviera en un componente, cambiar de
 * pantalla desmontaría los sensores en medio de un viaje; y dos instancias pedirían dos
 * veces el GPS y sonarían dos veces.
 *
 * El estado se reemplaza entero sólo cuando cambia algo que se ve: useSyncExternalStore
 * compara por identidad, y un objeto nuevo por cada muestra del acelerómetro repintaría la
 * aplicación 60 veces por segundo.
 *
 * LÍMITE: todo esto corre sólo con la aplicación abierta y la pantalla encendida. No llama
 * ni le avisa a nadie por su cuenta.
 */

type Fase =
  | 'desconocido'
  | 'apagado'
  | 'pidiendo'
  | 'activo'
  | 'en_pausa'
  | 'reanudar_con_toque'
  | 'sin_permiso'
  | 'sin_lecturas'
  | 'no_soportado'

type MotivoApagado = 'inactividad' | 'accidente'

export interface EstadoModoViaje {
  fase: Fase
  motivo: string | null
  gps: 'ok' | 'buscando' | 'sin_permiso'
  pantalla: 'retenida' | 'sin_retener' | 'no_soportada'
  sonidoListo: boolean
  velocidadKmh: number | null
  minutosActivo: number
  frenadas: number
  inactividad: boolean
  alerta: null | {
    estado: 'pregunta' | 'hubo_choque' | 'ayuda'
    restanteS: number
    ocurridoEn: number
    origenAyuda: 'necesito_ayuda' | 'sin_respuesta' | null
    nivel: NivelViaje
  }
  apagadoPor: null | MotivoApagado
}

export interface MotorViaje {
  suscribir(fn: () => void): () => void
  estado(): EstadoModoViaje
  encender(): void
  apagar(motivo?: MotivoApagado): void
  reanudar(): void
  cambiarRuta(pathname: string): void
  responder(respuesta: 'estoy_bien' | 'necesito_ayuda'): void
  huboChoque(hubo: boolean): void
  probarAlerta(): void
  tocar(): void
  destruir(): void
}

export const ESTADO_SERVIDOR: EstadoModoViaje = Object.freeze({
  fase: 'desconocido',
  motivo: null,
  gps: 'buscando',
  pantalla: 'sin_retener',
  sonidoListo: false,
  velocidadKmh: null,
  minutosActivo: 0,
  frenadas: 0,
  inactividad: false,
  alerta: null,
  apagadoPor: null,
})

const CLAVE_INTENCION = 'acta:viaje'
const G = 9.80665
const PLAZO_ALERTA_MS = 30_000
const MINUTO = 60_000

type Permiso = 'granted' | 'denied'
type ConPermiso = { requestPermission?: () => Promise<Permiso> }
type ConSesionAudio = { audioSession?: { type: string } }

function leerIntencion(): { encendidoEn: number; ultimoLatido: number } | null {
  try {
    const crudo = localStorage.getItem(CLAVE_INTENCION)
    if (!crudo) return null
    const i = JSON.parse(crudo)
    return typeof i?.encendidoEn === 'number' && typeof i?.ultimoLatido === 'number' ? i : null
  } catch {
    return null
  }
}

function borrarIntencion() {
  try {
    localStorage.removeItem(CLAVE_INTENCION)
  } catch {}
}

function distanciaM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function sesionAudio(tipo: string) {
  try {
    const nav = navigator as Navigator & ConSesionAudio
    if (nav.audioSession) nav.audioSession.type = tipo
  } catch {}
}

class Motor implements MotorViaje {
  private est: EstadoModoViaje = Object.freeze({ ...ESTADO_SERVIDOR, fase: 'apagado' as Fase })
  private oyentes = new Set<() => void>()
  private muestras: MuestraViaje[] = []
  private velocidades: VelocidadViaje[] = []
  private gravedad: [number, number, number] | null = null
  private ultimoTMov = 0
  private hayLectura = false
  private escuchando = false
  private watchId: number | null = null
  private centinela: WakeLockSentinel | null = null
  private pedidoLock: Promise<boolean> | null = null
  private ctx: AudioContext | null = null
  private desbloqueoInstalado = false
  private episodio: { inicio: number; ultimoFuerte: number } | null = null
  private analizadoHasta = -Infinity
  private fixPrevio: { t: number; lat: number; lon: number } | null = null
  private ultimaPos: { lat: number; lon: number } | null = null
  private ultimaVelPublicada = 0
  private encendidoEn = 0
  private ultimoLatido = 0
  private ultimoMovimiento = 0
  private inactivoDesde: number | null = null
  private huboVelocidad = false
  private ultimaFrenada = -Infinity
  private enRecorrido = false
  private plazo = 0
  private telemetriaId: string | null = null
  private respuestaPendiente: string | null = null
  private tono: { osc: OscillatorNode; ganancia: GainNode; pulso: number } | null = null
  private vibracion: number | null = null
  private cierreAuto: number | null = null
  private tick: number

  constructor() {
    this.tick = window.setInterval(this.alTick, 1000)
    document.addEventListener('visibilitychange', this.alVisibilidad)
    const intencion = leerIntencion()
    if (intencion && Date.now() - intencion.ultimoLatido < 30 * MINUTO) {
      this.encendidoEn = intencion.encendidoEn
      // El constructor corre dentro del getSnapshot de un render: cambiar estado ahí rompe React.
      window.setTimeout(() => this.reanudarInterno(false), 0)
    } else if (intencion) borrarIntencion()
  }

  suscribir = (fn: () => void) => {
    this.oyentes.add(fn)
    return () => {
      this.oyentes.delete(fn)
    }
  }

  estado = () => this.est

  private set(parcial: Partial<EstadoModoViaje>) {
    const claves = Object.keys(parcial) as (keyof EstadoModoViaje)[]
    if (claves.every((k) => this.est[k] === parcial[k])) return
    this.est = Object.freeze({ ...this.est, ...parcial })
    for (const fn of this.oyentes) fn()
  }

  private ligado() {
    return ['activo', 'en_pausa', 'pidiendo', 'reanudar_con_toque'].includes(this.est.fase)
  }

  /* ---------- Encendido ---------- */

  encender() {
    if (this.est.fase === 'activo' || this.est.fase === 'pidiendo') return
    this.encendidoEn = Date.now()
    this.set({ frenadas: 0, apagadoPor: null })
    this.arrancarDesdeToque(true)
  }

  reanudar() {
    if (this.est.fase === 'activo' || this.est.fase === 'pidiendo') return
    this.reanudarInterno(true)
  }

  private reanudarInterno(conGesto: boolean) {
    if (!this.encendidoEn) this.encendidoEn = Date.now()
    this.arrancarDesdeToque(conGesto)
  }

  /**
   * Lo que Safari sólo concede dentro del gesto va ANTES de cualquier await: después del
   * primer await el navegador ya no lo considera un toque y rechaza la pantalla, el sonido
   * y el permiso de movimiento.
   */
  private arrancarDesdeToque(conGesto: boolean) {
    if (!window.isSecureContext || typeof DeviceMotionEvent === 'undefined') {
      this.set({ fase: 'no_soportado', motivo: 'Abrí la aplicación desde su dirección https' })
      return
    }
    this.set({ fase: 'pidiendo', motivo: null })
    const lock = this.pedirLock()
    if (conGesto) this.desbloquearAudio()
    const pedir = (DeviceMotionEvent as unknown as ConPermiso).requestPermission
    let permiso: Promise<Permiso>
    try {
      permiso = pedir ? pedir.call(DeviceMotionEvent) : Promise.resolve('granted')
    } catch (e) {
      permiso = Promise.reject(e)
    }
    void this.arrancar(permiso, lock, conGesto)
  }

  private async arrancar(permiso: Promise<Permiso>, lock: Promise<boolean>, conGesto: boolean) {
    let respuesta: Permiso
    try {
      respuesta = await permiso
    } catch {
      // Sin gesto, iPhone rechaza el pedido: hace falta que la persona toque.
      this.set({ fase: 'reanudar_con_toque' })
      return
    }
    if (respuesta !== 'granted') {
      this.soltarLock()
      borrarIntencion()
      this.set({ fase: 'sin_permiso' })
      return
    }
    await lock
    this.hayLectura = false
    this.escuchar()
    void this.iniciarGps(conGesto)
    const inicio = Date.now()
    while (!this.hayLectura && Date.now() - inicio < 3000) {
      await new Promise((r) => setTimeout(r, 100))
    }
    if (this.est.fase !== 'pidiendo') return
    if (!this.hayLectura) {
      this.detenerSensores()
      this.soltarLock()
      borrarIntencion()
      this.set({ fase: 'sin_lecturas' })
      return
    }
    this.ultimoMovimiento = Date.now()
    this.guardarIntencion()
    this.set({ fase: 'activo', minutosActivo: Math.floor((Date.now() - this.encendidoEn) / MINUTO) })
    this.instalarDesbloqueo()
    if (this.enRecorrido) this.pausar()
  }

  apagar(motivo?: MotivoApagado) {
    const estabaLigado = this.ligado()
    this.detenerSensores()
    this.soltarLock()
    this.cerrarAlerta()
    this.quitarDesbloqueo()
    borrarIntencion()
    this.episodio = null
    this.muestras = []
    this.velocidades = []
    this.encendidoEn = 0
    this.inactivoDesde = null
    this.set({
      fase: 'apagado',
      motivo: null,
      velocidadKmh: null,
      inactividad: false,
      minutosActivo: 0,
      // «Se apagó al registrar el accidente» sólo tiene sentido si estaba encendido.
      apagadoPor: estabaLigado ? (motivo ?? null) : this.est.apagadoPor,
    })
  }

  cambiarRuta(pathname: string) {
    this.enRecorrido = pathname.startsWith('/s/')
    if (this.enRecorrido && this.est.fase === 'activo') this.pausar()
    else if (!this.enRecorrido && this.est.fase === 'en_pausa') {
      this.limpiarBuffers()
      this.set({ fase: 'activo' })
      void this.pedirLock()
      this.escuchar()
      void this.iniciarGps(false)
      this.instalarDesbloqueo()
    }
  }

  /* El recorrido usa cámara y micrófono y mueve el teléfono en la mano: detectar ahí sólo da falsas alarmas. */
  private pausar() {
    this.set({ fase: 'en_pausa', velocidadKmh: null })
    this.detenerSensores()
    this.soltarLock()
    this.episodio = null
  }

  tocar() {
    this.ultimoMovimiento = Date.now()
    this.inactivoDesde = null
    this.set({ inactividad: false })
  }

  destruir() {
    this.detenerSensores()
    this.soltarLock()
    this.detenerTono()
    this.quitarDesbloqueo()
    window.clearInterval(this.tick)
    document.removeEventListener('visibilitychange', this.alVisibilidad)
    this.oyentes.clear()
    void this.ctx?.close().catch(() => undefined)
  }

  /* ---------- Pantalla y sonido ---------- */

  private pedirLock(): Promise<boolean> {
    if (this.centinela && !this.centinela.released) return Promise.resolve(true)
    if (this.pedidoLock) return this.pedidoLock
    if (!('wakeLock' in navigator)) {
      this.set({ pantalla: 'no_soportada' })
      return Promise.resolve(false)
    }
    this.pedidoLock = navigator.wakeLock
      .request('screen')
      .then((s) => {
        if (!['activo', 'pidiendo'].includes(this.est.fase)) {
          void s.release().catch(() => undefined)
          return false
        }
        this.centinela = s
        s.addEventListener('release', () => {
          if (this.centinela === s) this.centinela = null
          if (this.est.fase === 'activo') {
            this.set({ pantalla: 'sin_retener' })
            this.instalarDesbloqueo()
          }
        })
        this.set({ pantalla: 'retenida' })
        this.revisarDesbloqueo()
        return true
      })
      .catch(() => {
        this.set({ pantalla: 'sin_retener' })
        return false
      })
      .finally(() => {
        this.pedidoLock = null
      })
    return this.pedidoLock
  }

  private soltarLock() {
    const c = this.centinela
    this.centinela = null
    if (c) void c.release().catch(() => undefined)
  }

  /** iPhone deja sonar un AudioContext sólo si se lo arrancó dentro de un toque. */
  private desbloquearAudio() {
    try {
      if (!this.ctx) {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        this.ctx = new Ctor()
      }
      const ctx = this.ctx
      const buffer = ctx.createBuffer(1, 1, 22050)
      const fuente = ctx.createBufferSource()
      fuente.buffer = buffer
      fuente.connect(ctx.destination)
      fuente.start(0)
      void ctx
        .resume()
        .then(() => {
          this.set({ sonidoListo: true })
          this.revisarDesbloqueo()
          // Suspendido no gasta batería ni se roba el audio de la radio del auto.
          window.setTimeout(() => {
            if (!this.tono) void ctx.suspend().catch(() => undefined)
          }, 300)
        })
        .catch(() => undefined)
    } catch {}
  }

  /*
   * pointerup y click, nunca pointerdown: Safari sólo cuenta como activación del usuario el
   * final del toque, y un pedido hecho en pointerdown se rechaza igual que sin gesto.
   */
  private alDesbloquear = () => {
    if (!['activo', 'en_pausa'].includes(this.est.fase)) return
    if (this.est.fase === 'activo' && this.est.pantalla !== 'retenida') void this.pedirLock()
    if (!this.est.sonidoListo) this.desbloquearAudio()
  }

  private instalarDesbloqueo() {
    if (this.desbloqueoInstalado) return
    if (this.est.pantalla === 'retenida' && this.est.sonidoListo) return
    for (const tipo of ['pointerup', 'click', 'keydown']) {
      window.addEventListener(tipo, this.alDesbloquear, { capture: true, passive: true })
    }
    this.desbloqueoInstalado = true
  }

  private quitarDesbloqueo() {
    if (!this.desbloqueoInstalado) return
    for (const tipo of ['pointerup', 'click', 'keydown']) {
      window.removeEventListener(tipo, this.alDesbloquear, { capture: true })
    }
    this.desbloqueoInstalado = false
  }

  private revisarDesbloqueo() {
    if (this.est.pantalla !== 'sin_retener' && this.est.sonidoListo) this.quitarDesbloqueo()
  }

  private alVisibilidad = () => {
    if (document.visibilityState !== 'visible') return
    // En segundo plano los relojes del GPS y del acelerómetro se desfasan: lo viejo no sirve.
    this.limpiarBuffers()
    if (this.est.fase === 'activo') {
      void this.pedirLock()
      this.guardarIntencion()
    }
  }

  private limpiarBuffers() {
    this.muestras = []
    this.velocidades = []
    this.episodio = null
    this.gravedad = null
    this.fixPrevio = null
    this.ultimoTMov = 0
  }

  private guardarIntencion() {
    this.ultimoLatido = Date.now()
    try {
      localStorage.setItem(
        CLAVE_INTENCION,
        JSON.stringify({ encendidoEn: this.encendidoEn, ultimoLatido: this.ultimoLatido }),
      )
    } catch {}
  }

  /* ---------- Sensores ---------- */

  private escuchar() {
    if (this.escuchando) return
    window.addEventListener('devicemotion', this.alMovimiento)
    this.escuchando = true
  }

  private detenerSensores() {
    if (this.escuchando) window.removeEventListener('devicemotion', this.alMovimiento)
    this.escuchando = false
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId)
    this.watchId = null
  }

  private async iniciarGps(conGesto: boolean) {
    if (this.watchId !== null || !('geolocation' in navigator)) return
    if (!conGesto) {
      // Sin toque no se abre un cartel de permiso: sólo se retoma si ya estaba concedido.
      try {
        const p = await navigator.permissions.query({ name: 'geolocation' })
        if (p.state !== 'granted') return
      } catch {
        return
      }
    }
    if (this.watchId !== null || !this.escuchando) return
    this.set({ gps: 'buscando' })
    this.watchId = navigator.geolocation.watchPosition(this.alPosicion, this.alErrorGps, {
      enableHighAccuracy: true,
      maximumAge: 0,
    })
  }

  private alErrorGps = (e: GeolocationPositionError) => {
    if (e.code !== 1) return
    if (this.watchId !== null) navigator.geolocation.clearWatch(this.watchId)
    this.watchId = null
    this.set({ gps: 'sin_permiso', velocidadKmh: null })
  }

  private alMovimiento = (e: DeviceMotionEvent) => {
    const ahora = performance.now()
    const t = Math.abs(e.timeStamp - ahora) < 10_000 ? e.timeStamp : ahora
    const r = e.rotationRate
    const tieneGiro = !!r && [r.alpha, r.beta, r.gamma].some((v) => typeof v === 'number')
    const conG = e.accelerationIncludingGravity
    const lineal = e.acceleration
    const hayConG = !!conG && typeof conG.x === 'number'
    let ax: number
    let ay: number
    let az: number
    if (tieneGiro && lineal && typeof lineal.x === 'number') {
      ax = lineal.x
      ay = lineal.y ?? 0
      az = lineal.z ?? 0
    } else if (hayConG) {
      // Sin aceleración lineal se estima la gravedad con un pasabajos de 1 s y se resta.
      const x = conG.x ?? 0
      const y = conG.y ?? 0
      const z = conG.z ?? 0
      const dt = this.ultimoTMov ? Math.max(0, (t - this.ultimoTMov) / 1000) : 0
      const alfa = 1 / (1 + dt)
      const g = this.gravedad
      this.gravedad = g ? [alfa * g[0] + (1 - alfa) * x, alfa * g[1] + (1 - alfa) * y, alfa * g[2] + (1 - alfa) * z] : [x, y, z]
      ax = x - this.gravedad[0]
      ay = y - this.gravedad[1]
      az = z - this.gravedad[2]
    } else return
    if (![ax, ay, az].every(Number.isFinite)) return
    this.ultimoTMov = t
    this.hayLectura = true

    const gTotal = hayConG ? Math.hypot(conG.x ?? 0, conG.y ?? 0, conG.z ?? 0) / G : 1
    const giro = tieneGiro && r ? Math.hypot(r.alpha ?? 0, r.beta ?? 0, r.gamma ?? 0) : null
    this.muestras.push({ t, ax, ay, az, gTotal, giro })
    if (this.muestras.length % 60 === 0) {
      const desde = this.muestras.findIndex((m) => m.t >= t - 25_000)
      if (desde > 0) this.muestras.splice(0, desde)
    }

    if (this.est.fase !== 'activo') return
    if (Math.hypot(ax, ay, az) / G >= 4 && t > this.analizadoHasta) {
      if (!this.episodio) this.episodio = { inicio: t, ultimoFuerte: t }
      else this.episodio.ultimoFuerte = t
    }
    this.revisarEpisodio(t)
  }

  private alPosicion = (pos: GeolocationPosition) => {
    const edad = Date.now() - pos.timestamp
    if (edad > 5000) return
    const t = performance.now() - Math.min(3000, Math.max(0, edad))
    const { latitude: lat, longitude: lon, speed, accuracy } = pos.coords
    this.ultimaPos = { lat, lon }
    let kmh: number | null = null
    if (speed !== null && Number.isFinite(speed)) kmh = Math.max(0, speed * 3.6)
    else if (accuracy <= 30) {
      const previo = this.fixPrevio
      if (!previo) this.fixPrevio = { t, lat, lon }
      else if (t - previo.t >= 3000) {
        kmh = (distanciaM(previo.lat, previo.lon, lat, lon) / ((t - previo.t) / 1000)) * 3.6
        this.fixPrevio = { t, lat, lon }
      }
    }
    this.set({ gps: 'ok' })
    if (kmh === null) return

    this.velocidades.push({ t, kmh })
    while (this.velocidades.length && this.velocidades[0].t < t - 60_000) this.velocidades.shift()
    this.huboVelocidad = true
    if (kmh >= 5) this.ultimoMovimiento = Date.now()
    if (kmh >= 15 && this.est.inactividad) this.tocar()
    if (Date.now() - this.ultimaVelPublicada >= 1000) {
      this.ultimaVelPublicada = Date.now()
      this.set({ velocidadKmh: Math.round(kmh) })
    }
  }

  /* ---------- Episodios ---------- */

  private revisarEpisodio(ahora: number) {
    const ep = this.episodio
    if (!ep) return
    if (ahora - ep.ultimoFuerte < 8000 && ahora - ep.inicio < 15_000) return
    this.episodio = null
    this.analizadoHasta = ahora
    const serie = this.muestras.filter((m) => m.t >= ep.inicio - 2000 && m.t <= ahora)
    const veredicto = evaluarEpisodio(serie, this.velocidades)
    if (veredicto.nivel !== 'nada' && !this.est.alerta) this.abrirAlerta(veredicto, serie)
  }

  private alTick = () => {
    const ahora = performance.now()
    const fase = this.est.fase
    if (fase === 'activo') {
      this.revisarEpisodio(ahora)
      if (frenadaBrusca(this.velocidades, ahora) && ahora - this.ultimaFrenada > 10_000) {
        this.ultimaFrenada = ahora
        this.set({ frenadas: this.est.frenadas + 1 })
      }
      if (this.huboVelocidad && Date.now() - this.ultimoMovimiento >= 15 * MINUTO && !this.est.inactividad) {
        this.inactivoDesde = Date.now()
        this.set({ inactividad: true })
      }
      if (this.est.inactividad && this.inactivoDesde && Date.now() - this.inactivoDesde >= 10 * MINUTO) {
        this.apagar('inactividad')
        return
      }
    }
    if ((fase === 'activo' || fase === 'en_pausa') && document.visibilityState === 'visible') {
      this.set({ minutosActivo: Math.floor((Date.now() - this.encendidoEn) / MINUTO) })
      if (Date.now() - this.ultimoLatido >= 30_000) this.guardarIntencion()
    }

    const alerta = this.est.alerta
    if (alerta?.estado === 'pregunta') {
      const restanteS = Math.max(0, Math.ceil((this.plazo - Date.now()) / 1000))
      if (restanteS === 0) this.pasarAAyuda('sin_respuesta')
      else this.set({ alerta: { ...alerta, restanteS } })
    }
  }

  /* ---------- Alerta ---------- */

  private abrirAlerta(v: VeredictoViaje, serie: MuestraViaje[]) {
    this.plazo = Date.now() + PLAZO_ALERTA_MS
    this.telemetriaId = null
    this.respuestaPendiente = null
    this.set({
      alerta: {
        estado: 'pregunta',
        restanteS: PLAZO_ALERTA_MS / 1000,
        ocurridoEn: Date.now() - (performance.now() - v.tPico),
        origenAyuda: null,
        nivel: v.nivel,
      },
    })
    this.iniciarTono(null)

    const centro = Math.max(0, serie.findIndex((m) => m.t >= v.tPico))
    const recorte = serie.slice(Math.max(0, centro - 700), Math.max(0, centro - 700) + 1400)
    const t0 = recorte[0]?.t ?? 0
    fetch('/api/telemetria', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serie: recorte.map((m) => ({ t: Math.round(m.t - t0), ax: m.ax, ay: m.ay, az: m.az, gTotal: m.gTotal, giro: m.giro })),
        origen: 'navegador',
        lat: this.ultimaPos?.lat,
        lon: this.ultimaPos?.lon,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => {
        if (typeof c?.id !== 'string') return
        this.telemetriaId = c.id
        if (this.respuestaPendiente) this.enviarRespuesta(this.respuestaPendiente)
      })
      .catch(() => undefined)
  }

  private enviarRespuesta(respuesta: string) {
    if (!this.telemetriaId) {
      this.respuestaPendiente = respuesta
      return
    }
    this.respuestaPendiente = null
    fetch(`/api/telemetria/${this.telemetriaId}/respuesta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuesta }),
    }).catch(() => undefined)
  }

  responder(respuesta: 'estoy_bien' | 'necesito_ayuda') {
    const alerta = this.est.alerta
    if (!alerta) return
    if (respuesta === 'necesito_ayuda') {
      this.pasarAAyuda('necesito_ayuda')
      return
    }
    this.detenerTono()
    this.enviarRespuesta('estoy_bien')
    const ultima = this.velocidades[this.velocidades.length - 1]
    // Estar bien no quita que haya habido un choque: si el auto quedó quieto, se pregunta.
    if (!ultima || ultima.kmh <= 8) {
      this.set({ alerta: { ...alerta, estado: 'hubo_choque' } })
      this.cierreAuto = window.setTimeout(() => this.cerrarAlerta(), 60_000)
    } else this.cerrarAlerta()
  }

  huboChoque(hubo: boolean) {
    if (this.cierreAuto !== null) window.clearTimeout(this.cierreAuto)
    this.cierreAuto = null
    if (!hubo) this.cerrarAlerta()
  }

  private pasarAAyuda(origen: 'necesito_ayuda' | 'sin_respuesta') {
    const alerta = this.est.alerta
    if (!alerta) return
    this.detenerTono()
    this.enviarRespuesta(origen)
    this.set({ alerta: { ...alerta, estado: 'ayuda', origenAyuda: origen, restanteS: 0 } })
  }

  private cerrarAlerta() {
    this.detenerTono()
    if (this.cierreAuto !== null) window.clearTimeout(this.cierreAuto)
    this.cierreAuto = null
    this.analizadoHasta = performance.now()
    this.set({ alerta: null })
  }

  probarAlerta() {
    this.desbloquearAudio()
    if (this.est.alerta) return
    this.iniciarTono(0.6)
    window.setTimeout(() => {
      if (!this.est.alerta) this.detenerTono()
    }, 1000)
  }

  /** volumenFijo null: sube durante los últimos 15 segundos del plazo. */
  private iniciarTono(volumenFijo: number | null) {
    this.detenerTono()
    sesionAudio('playback')
    const ctx = this.ctx
    if (ctx) {
      try {
        void ctx.resume().catch(() => undefined)
        const osc = ctx.createOscillator()
        const ganancia = ctx.createGain()
        osc.frequency.value = 880
        ganancia.gain.value = 0
        osc.connect(ganancia).connect(ctx.destination)
        osc.start()
        const pulsar = () => {
          const restante = (this.plazo - Date.now()) / 1000
          const volumen = volumenFijo ?? (restante > 15 ? 0.25 : 0.25 + 0.75 * (1 - Math.max(0, restante) / 15))
          const ahora = ctx.currentTime
          ganancia.gain.setValueAtTime(volumen, ahora)
          ganancia.gain.setValueAtTime(0, ahora + 0.2)
        }
        pulsar()
        this.tono = { osc, ganancia, pulso: window.setInterval(pulsar, 600) }
      } catch {}
    }
    const vibrar = () => {
      try {
        navigator.vibrate?.([400, 200, 400])
      } catch {}
    }
    vibrar()
    this.vibracion = window.setInterval(vibrar, 2000)
  }

  private detenerTono() {
    if (this.tono) {
      window.clearInterval(this.tono.pulso)
      try {
        this.tono.osc.stop()
        this.tono.osc.disconnect()
      } catch {}
      this.tono = null
      void this.ctx?.suspend().catch(() => undefined)
    }
    if (this.vibracion !== null) {
      window.clearInterval(this.vibracion)
      this.vibracion = null
      try {
        navigator.vibrate?.(0)
      } catch {}
    }
    sesionAudio('auto')
  }
}

let motor: Motor | null = null

/** El motor de esta pestaña, o null en el servidor. */
export function motorDelNavegador(): MotorViaje | null {
  if (typeof window === 'undefined') return null
  if (!motor) {
    const global = globalThis as { __actaMotorViaje?: MotorViaje }
    // Con Fast Refresh el módulo se reevalúa: el motor viejo seguiría escuchando sensores.
    global.__actaMotorViaje?.destruir()
    motor = new Motor()
    global.__actaMotorViaje = motor
  }
  return motor
}
