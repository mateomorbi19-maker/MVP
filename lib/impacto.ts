/**
 * Detección de impacto a partir de los sensores del teléfono.
 *
 * Lógica PURA: recibe una serie de lecturas y devuelve un veredicto. Sin base, sin red y
 * sin navegador, así que se puede probar con series sintéticas —un choque, un pozo, el
 * teléfono que se cae al piso— que es la única forma de calibrar esto sin chocar autos.
 *
 * LÍMITE QUE NO SE PUEDE DISIMULAR: esto corre SÓLO con la aplicación abierta y al frente.
 * Cuando pasa a segundo plano el navegador suspende el hilo de JavaScript, DeviceMotionEvent
 * deja de emitir, y el service worker sólo se despierta cuando llega un push DESDE EL
 * SERVIDOR: nunca por su cuenta, nunca por un sensor, nunca por un temporizador. No hay API
 * que cambie eso, ni en iOS ni en Android. Una PWA no puede detectar un choque con la
 * pantalla bloqueada, y prometerlo sería vender algo que no funciona el día que hace falta.
 *
 * Los umbrales son de referencia de la industria y hay que CALIBRARLOS con pruebas de campo
 * —frenadas bruscas, pozos, el teléfono en el bolsillo contra el teléfono en el soporte—
 * antes de encender cualquier escalamiento automático.
 */

export interface Lectura {
  /** Milisegundos desde el comienzo de la serie. */
  t: number
  /** Aceleración lineal, sin gravedad, en m/s². */
  ax: number
  ay: number
  az: number
  /** Módulo CON gravedad, en g. Sirve para detectar caída libre. */
  gTotal?: number
  /** Velocidad del GPS en km/h, cuando la hay. */
  kmh?: number | null
  /** Giro en grados por segundo, cuando lo hay. */
  giro?: number | null
}

export interface Umbrales {
  sospechaG: number
  confirmadoG: number
  msSobreUmbral: number
  velocidadPreviaKmh: number
  velocidadPosteriorKmh: number
  ventanaCaidaMs: number
  giroDps: number
}

export const UMBRALES: Umbrales = {
  sospechaG: Number(process.env.IMPACTO_UMBRAL_SOSPECHA_G || 4),
  confirmadoG: Number(process.env.IMPACTO_UMBRAL_CONFIRMADO_G || 8),
  msSobreUmbral: Number(process.env.IMPACTO_MS_SOBRE_UMBRAL || 30),
  velocidadPreviaKmh: Number(process.env.IMPACTO_VELOCIDAD_PREVIA_KMH || 30),
  velocidadPosteriorKmh: Number(process.env.IMPACTO_VELOCIDAD_POSTERIOR_KMH || 8),
  ventanaCaidaMs: Number(process.env.IMPACTO_VENTANA_CAIDA_MS || 2000),
  giroDps: Number(process.env.IMPACTO_GIRO_DPS || 180),
}

export type NivelImpacto = 'nada' | 'sospecha' | 'confirmado'

export interface Veredicto {
  nivel: NivelImpacto
  picoG: number
  msPico: number | null
  señales: {
    sobreUmbral: boolean
    caidaDeVelocidad: boolean
    giroBrusco: boolean
    sostenido: boolean
  }
  descartes: string[]
  motivo: string
  /**
   * SIEMPRE false, y es un tipo literal a propósito: así el compilador impide que alguien,
   * alguna vez, marque el 107 sin que la persona lo confirme. Una llamada automática a
   * emergencias por un falso positivo satura una línea que alguien más puede necesitar.
   */
  llamar_emergencias: false
}

const G = 9.80665
const modulo = (l: Lectura) => Math.sqrt(l.ax * l.ax + l.ay * l.ay + l.az * l.az) / G

/**
 * Analiza una serie.
 *
 * Dos descartes explícitos, que son los que evitan que la función se vuelva inservible por
 * falsos positivos:
 *
 *   CAÍDA LIBRE PREVIA. Un teléfono que se cae del soporte al piso da entre 10 y 30 g, más
 *   que muchos choques reales. Pero antes del golpe estuvo en caída libre, o sea con el
 *   módulo CON gravedad cerca de cero. Si eso pasó en los 150 ms previos al pico, es el
 *   teléfono cayéndose y no el auto chocando.
 *
 *   PICO AISLADO. Un pozo o un apoyo fuerte contra la butaca dan un pico de un par de
 *   muestras y nada más. Un impacto real deja el acelerómetro sacudido varios milisegundos.
 */
export function analizarImpacto(serie: Lectura[], umbrales: Umbrales = UMBRALES): Veredicto {
  const nada: Veredicto = {
    nivel: 'nada',
    picoG: 0,
    msPico: null,
    señales: { sobreUmbral: false, caidaDeVelocidad: false, giroBrusco: false, sostenido: false },
    descartes: [],
    motivo: 'La serie no tiene lecturas suficientes.',
    llamar_emergencias: false,
  }
  if (serie.length < 3) return nada

  let picoG = 0
  let iPico = 0
  serie.forEach((l, i) => {
    const m = modulo(l)
    if (m > picoG) {
      picoG = m
      iPico = i
    }
  })

  const pico = serie[iPico]
  const sobreUmbral = picoG >= umbrales.sospechaG
  const descartes: string[] = []

  if (!sobreUmbral) {
    return {
      ...nada,
      picoG,
      msPico: pico.t,
      motivo: `El pico fue de ${picoG.toFixed(1)} g, por debajo del umbral de ${umbrales.sospechaG} g.`,
    }
  }

  // Caída libre en los 150 ms previos al pico.
  const antes = serie.filter((l) => l.t < pico.t && l.t >= pico.t - 150)
  const huboCaidaLibre = antes.some((l) => typeof l.gTotal === 'number' && l.gTotal < 0.35)
  if (huboCaidaLibre) descartes.push('El teléfono estuvo en caída libre justo antes del golpe: se cayó, no chocó.')

  // Cuánto tiempo se mantuvo por encima de la mitad del umbral.
  const msSostenido = serie
    .filter((l) => modulo(l) >= umbrales.sospechaG / 2)
    .reduce((max, l, _i, todas) => Math.max(max, todas[todas.length - 1].t - todas[0].t), 0)
  const sostenido = msSostenido >= umbrales.msSobreUmbral
  if (!sostenido) descartes.push('El pico fue aislado, de un instante: se parece más a un pozo que a un impacto.')

  // Caída abrupta de la velocidad del GPS.
  const conVelocidad = serie.filter((l) => typeof l.kmh === 'number') as Array<Lectura & { kmh: number }>
  const previas = conVelocidad.filter((l) => l.t < pico.t)
  const posteriores = conVelocidad.filter((l) => l.t > pico.t && l.t <= pico.t + umbrales.ventanaCaidaMs)
  const caidaDeVelocidad =
    previas.length > 0 &&
    posteriores.length > 0 &&
    Math.max(...previas.map((l) => l.kmh)) >= umbrales.velocidadPreviaKmh &&
    Math.min(...posteriores.map((l) => l.kmh)) <= umbrales.velocidadPosteriorKmh

  const giroBrusco = serie.some((l) => typeof l.giro === 'number' && Math.abs(l.giro) >= umbrales.giroDps)

  const señales = { sobreUmbral, caidaDeVelocidad, giroBrusco, sostenido }

  if (descartes.length > 0) {
    return {
      nivel: 'nada',
      picoG,
      msPico: pico.t,
      señales,
      descartes,
      motivo: descartes[0],
      llamar_emergencias: false,
    }
  }

  const confirmado = picoG >= umbrales.confirmadoG || caidaDeVelocidad
  return {
    nivel: confirmado ? 'confirmado' : 'sospecha',
    picoG,
    msPico: pico.t,
    señales,
    descartes,
    motivo: confirmado
      ? `Pico de ${picoG.toFixed(1)} g${caidaDeVelocidad ? ' con caída abrupta de la velocidad' : ''}.`
      : `Pico de ${picoG.toFixed(1)} g, sostenido, pero sin confirmación del GPS.`,
    llamar_emergencias: false,
  }
}

export interface PlanEscalamiento {
  ofrecerEmergencias: boolean
  avisarContactoDeConfianza: boolean
  precargarDenuncia: boolean
  texto: string
}

/**
 * Qué hacer cuando se venció la ventana de verificación sin respuesta.
 *
 * NUNCA se llama a emergencias solo. Lo que se hace es dejar los tres botones a un toque y
 * el borrador de la denuncia ya abierto con la hora y el lugar del impacto, para que si la
 * persona retoma el teléfono no tenga que empezar de cero.
 *
 * Y el aviso al contacto de confianza tiene su propio límite honesto: desde un navegador no
 * se puede llamar ni mandar un SMS por cuenta propia. Lo que se puede es abrir el marcador
 * con el número puesto. Un aviso automático de verdad necesita un proveedor de SMS.
 */
export function planEscalamiento(veredicto: Veredicto, respondio: boolean): PlanEscalamiento {
  if (respondio || veredicto.nivel === 'nada') {
    return {
      ofrecerEmergencias: false,
      avisarContactoDeConfianza: false,
      precargarDenuncia: false,
      texto: 'Sin novedad.',
    }
  }
  return {
    ofrecerEmergencias: true,
    avisarContactoDeConfianza: veredicto.nivel === 'confirmado',
    precargarDenuncia: true,
    texto:
      veredicto.nivel === 'confirmado'
        ? 'No hubo respuesta y el impacto está confirmado por más de una señal. Se ofrecen las llamadas de emergencia y el aviso al contacto de confianza, y queda abierto el borrador de la denuncia con la hora y el lugar.'
        : 'No hubo respuesta. Se ofrecen las llamadas de emergencia y queda abierto el borrador de la denuncia.',
  }
}

/* ---------- Modo viaje: un episodio con muestras y velocidades por separado ---------- */

/*
 * El detector de arriba recibe una serie con la velocidad pegada a cada lectura, que es lo
 * que sirve para la ingesta. En el auto no llegan así: el acelerómetro da 60 muestras por
 * segundo y el GPS una, con relojes que no coinciden. Por eso el modo viaje evalúa las dos
 * series por separado, sobre un reloj monótono común.
 */

const G_VIAJE = 9.80665

export interface MuestraViaje {
  /** Milisegundos, reloj monótono. */
  t: number
  /** Aceleración sin gravedad, en m/s². */
  ax: number
  ay: number
  az: number
  /** Módulo con gravedad, en g. */
  gTotal: number
  /** Norma del giro en grados por segundo, cuando el equipo la da. */
  giro: number | null
}

export interface VelocidadViaje {
  t: number
  kmh: number
}

export type NivelViaje = 'nada' | 'sospecha' | 'confirmado'

export interface VeredictoViaje {
  nivel: NivelViaje
  picoG: number
  tPico: number
  motivo: string
  siguioAndando: boolean
  detenido: boolean
  velocidadDisponible: boolean
}

const RANGO_NIVEL: Record<NivelViaje, number> = { nada: 0, sospecha: 1, confirmado: 2 }

const moduloG = (m: MuestraViaje) => Math.hypot(m.ax, m.ay, m.az) / G_VIAJE

function medianaViaje(v: number[]): number {
  const o = [...v].sort((a, b) => a - b)
  return o[Math.floor(o.length / 2)]
}

/** Recorre desde el pico mientras la aceleración siga alta, perdonando una muestra suelta. */
function msSostenido(muestras: MuestraViaje[], iPico: number): number {
  let inicio = iPico
  let fin = iPico
  let faltas = 0
  for (let i = iPico - 1; i >= 0; i--) {
    if (moduloG(muestras[i]) >= 2) {
      inicio = i
      faltas = 0
    } else if (++faltas > 1) break
  }
  faltas = 0
  for (let i = iPico + 1; i < muestras.length; i++) {
    if (moduloG(muestras[i]) >= 2) {
      fin = i
      faltas = 0
    } else if (++faltas > 1) break
  }
  return muestras[fin].t - muestras[inicio].t
}

/** Giro brusco o caída libre justo antes del pico: el teléfono se movió solo, no el auto. */
function fueManipulado(muestras: MuestraViaje[], tPico: number): boolean {
  let desdeCaida: number | null = null
  for (const m of muestras) {
    if (m.giro !== null && m.giro >= 300 && m.t >= tPico - 700 && m.t <= tPico - 80) return true
    if (m.t < tPico - 700 || m.t > tPico - 30) continue
    if (m.gTotal < 0.5) {
      if (desdeCaida === null) desdeCaida = m.t
      if (m.t - desdeCaida >= 50) return true
    } else desdeCaida = null
  }
  return false
}

/** Una mano que sacude empieza a ir y venir antes del pico; un choque llega de golpe. */
function fueSacudida(muestras: MuestraViaje[], pico: MuestraViaje): boolean {
  const ejes = [Math.abs(pico.ax), Math.abs(pico.ay), Math.abs(pico.az)]
  const eje = ejes.indexOf(Math.max(...ejes))
  let lobulos = 0
  let signo = 0
  for (const m of muestras) {
    if (m.t < pico.t - 1500 || m.t > pico.t - 100) continue
    const valor = eje === 0 ? m.ax : eje === 1 ? m.ay : m.az
    if (Math.abs(valor) < 2 * G_VIAJE) continue
    const s = Math.sign(valor)
    if (s !== signo) {
      lobulos++
      signo = s
    }
  }
  return lobulos >= 2
}

function evaluarPico(muestras: MuestraViaje[], iPico: number, velocidades: VelocidadViaje[]): VeredictoViaje {
  const pico = muestras[iPico]
  const tPico = pico.t
  const picoG = Math.round(moduloG(pico) * 10) / 10
  const sostenido = msSostenido(muestras, iPico) >= 30
  const manipulado = fueManipulado(muestras, tPico)
  const sacudida = fueSacudida(muestras, pico)

  const cercanas = velocidades.filter((v) => v.t >= tPico - 8000 && v.t <= tPico + 2500)
  let previa = 0
  for (let i = 0; i + 2 < cercanas.length; i++) {
    previa = Math.max(previa, medianaViaje([cercanas[i].kmh, cercanas[i + 1].kmh, cercanas[i + 2].kmh]))
  }
  const ibaAndando = previa >= 15
  const despues = velocidades.filter((v) => v.t >= tPico + 2000 && v.t <= tPico + 8000)
  const detenido = despues.filter((v) => v.kmh <= 8).length >= 2
  const ultimas = despues.slice(-3).map((v) => v.kmh)
  const siguioAndando = !detenido && ultimas.length > 0 && medianaViaje(ultimas) >= Math.max(15, 0.5 * previa)
  const velocidadDisponible =
    velocidades.filter((v) => v.t >= tPico - 8000 && v.t <= tPico).length >= 2 &&
    velocidades.filter((v) => v.t > tPico).length >= 2

  const base = { picoG, tPico, siguioAndando, detenido, velocidadDisponible }
  const con = (nivel: NivelViaje, motivo: string): VeredictoViaje => ({ ...base, nivel, motivo })

  if (!sostenido) return con('nada', 'pico aislado, sin la duración de un choque')
  if (velocidadDisponible) {
    if (previa < 10) return con('nada', 'el auto no venía andando')
    if (!ibaAndando) return con('nada', 'velocidad previa demasiado baja para un choque')
    if (!manipulado && detenido) return con('confirmado', 'golpe sostenido y el auto se detuvo')
    if (manipulado && detenido) return con('sospecha', 'el auto se detuvo, pero el teléfono se movió antes del golpe')
    if (manipulado) return con('nada', 'el teléfono se cayó o lo movieron y el auto siguió')
    if (siguioAndando) return con('nada', 'golpe con el auto en marcha')
    return con('sospecha', 'golpe sostenido sin saber todavía si el auto se detuvo')
  }
  if (manipulado) return con('nada', 'el teléfono se cayó o lo movieron antes del golpe')
  if (sacudida) return con('nada', 'movimiento de vaivén, como una mano que sacude el teléfono')
  return con('sospecha', 'golpe sostenido sin velocidad para confirmarlo')
}

export interface OpcionesEpisodio {
  /**
   * Para mostrar el modo viaje sin chocar un auto: cualquier golpe de 2,5 g alerta. Saltea
   * a propósito los descartes (caída libre, pico aislado, vaivén, velocidad), porque la
   * demostración típica es justamente tirar el teléfono a la cama.
   */
  demo?: boolean
}

const UMBRAL_EPISODIO_G = 4
const UMBRAL_DEMO_G = 2.5

/** Evalúa un episodio completo: cada subpico por separado, y gana el nivel más alto. */
export function evaluarEpisodio(
  muestras: MuestraViaje[],
  velocidades: VelocidadViaje[],
  opciones: OpcionesEpisodio = {},
): VeredictoViaje {
  const umbral = opciones.demo ? UMBRAL_DEMO_G : UMBRAL_EPISODIO_G
  const grupos: number[][] = []
  let ultimoT = -Infinity
  muestras.forEach((m, i) => {
    if (moduloG(m) < umbral) return
    if (m.t - ultimoT > 300 || grupos.length === 0) grupos.push([])
    grupos[grupos.length - 1].push(i)
    ultimoT = m.t
  })

  let mejor: VeredictoViaje = {
    nivel: 'nada',
    picoG: 0,
    tPico: muestras[0]?.t ?? 0,
    motivo: `ninguna lectura llegó a ${umbral} g`,
    siguioAndando: false,
    detenido: false,
    velocidadDisponible: false,
  }
  for (const grupo of grupos) {
    const iPico = grupo.reduce((a, b) => (moduloG(muestras[b]) > moduloG(muestras[a]) ? b : a))
    const v = opciones.demo
      ? {
          nivel: 'sospecha' as NivelViaje,
          picoG: Math.round(moduloG(muestras[iPico]) * 10) / 10,
          tPico: muestras[iPico].t,
          motivo: 'Golpe detectado en modo demostración',
          siguioAndando: false,
          detenido: false,
          velocidadDisponible: false,
        }
      : evaluarPico(muestras, iPico, velocidades)
    if (RANGO_NIVEL[v.nivel] > RANGO_NIVEL[mejor.nivel] || (v.nivel === mejor.nivel && v.picoG > mejor.picoG)) mejor = v
  }
  return mejor
}

/** Una desaceleración de 0,45 g sostenida 1,5 s en los últimos 3 s, sin llegar a detenerse. */
export function frenadaBrusca(velocidades: VelocidadViaje[], ahora: number): boolean {
  const recientes = velocidades.filter((v) => v.t >= ahora - 3000 && v.t <= ahora)
  if (recientes.length < 2 || recientes[recientes.length - 1].kmh <= 8) return false
  const tasa = 0.45 * 35.3
  for (let i = 0; i < recientes.length; i++) {
    if (recientes[i].kmh < 20) continue
    for (let j = i + 1; j < recientes.length; j++) {
      const dt = (recientes[j].t - recientes[i].t) / 1000
      if (dt >= 1.5 && (recientes[i].kmh - recientes[j].kmh) / dt >= tasa && recientes[j].kmh > 8) return true
    }
  }
  return false
}
