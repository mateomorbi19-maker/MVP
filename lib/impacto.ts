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
