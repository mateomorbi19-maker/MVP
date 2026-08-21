/**
 * Cuestionario jurídico-procesal — versión ASEGURADORA.
 *
 * Criterio de diseño: la aseguradora necesita (a) hechos objetivos y estructurados,
 * (b) datos que definan cobertura o exclusión, y (c) respuestas contrastables contra
 * datos duros (GPS, hora, clima) para detectar inconsistencias.
 *
 * EL ORDEN NO ES JURÍDICO, ES DE URGENCIA. Esto se contesta parado al lado del auto,
 * con adrenalina y una sola mano. Primero va lo que deja de existir cuando la persona
 * se va del lugar —la patente del tercero, cómo quedaron los vehículos, los testigos,
 * el relato en caliente— y al final lo que se puede completar sentado en casa —la
 * póliza, la licencia, la VTV—. Eso es lo que marca `bloque` en cada sección, y el
 * recorrido concreto de pantallas está en `RECORRIDO`.
 *
 * Cada pregunta marcada con `contrasta` alimenta el motor de consistencia.
 * Las marcadas `criticaCobertura` son causales típicas de rechazo o reserva.
 *
 * Los ids de las preguntas son API: los usan el motor de consistencia, el PDF y la
 * validación del PATCH. Se pueden reordenar; no se pueden renombrar.
 *
 * PENDIENTE: revisar con el abogado de tránsito. Ver README, sección "Cuestionario".
 */

export type TipoPregunta =
  | 'opcion'
  | 'multiple'
  | 'texto'
  | 'numero'
  | 'audio'
  | 'zonaImpacto'
  | 'persona'

/**
 * Momento del recorrido al que pertenece la sección.
 *
 * `seguridad`  se contesta antes que nada: define si hay que pedir una ambulancia.
 * `lugar`      sólo se puede contestar en el lugar del hecho. Es lo que se pierde.
 * `despues`    se puede completar más tarde, desde el mismo enlace.
 */
export type Bloque = 'seguridad' | 'lugar' | 'despues'

/** Condición sobre la respuesta de otra pregunta. */
export interface Condicion {
  pregunta: string
  valores: string[]
}

export interface Pregunta {
  id: string
  texto: string
  ayuda?: string
  tipo: TipoPregunta
  opciones?: string[]
  requerida?: boolean
  /** Se contrasta contra datos objetivos en el informe de consistencia */
  contrasta?: 'velocidad' | 'clima' | 'luz' | 'pavimento' | 'hora' | 'lugar' | 'frenada'
  /** Define cobertura: su respuesta puede habilitar rechazo o reserva */
  criticaCobertura?: boolean
  /** Se muestra sólo si TODAS estas condiciones se cumplen */
  dependeDe?: Condicion | Condicion[]
  /**
   * Se oculta si ALGUNA de estas condiciones se cumple.
   *
   * Es distinto de `dependeDe` a propósito: como ninguna pregunta bloquea el avance,
   * una que dependa de otra sin contestar desaparecería. `ocultarSi` sólo esconde ante
   * una respuesta explícita, así que saltear una pregunta nunca hace desaparecer las
   * que vienen después.
   */
  ocultarSi?: Condicion | Condicion[]
  unidad?: string
  /** Texto del botón para saltearla. Si no se define, se usa uno genérico. */
  omitir?: string
  /** La única que no se puede saltear: define si hay que pedir una ambulancia. */
  sinOmitir?: boolean
}

export interface Seccion {
  id: string
  titulo: string
  descripcion: string
  bloque: Bloque
  preguntas: Pregunta[]
}

/* Condiciones reutilizadas. */
const HAY_TERCERO: Condicion = {
  pregunta: 'tipo_siniestro',
  valores: ['Colisión con otro vehículo', 'Atropello a peatón o ciclista'],
}
const HAY_OTRO_VEHICULO: Condicion = {
  pregunta: 'tipo_siniestro',
  valores: ['Colisión con otro vehículo'],
}
/** Si se fugó, pedirle los datos al tercero es pedirle algo imposible. */
const TERCERO_AUSENTE: Condicion = { pregunta: 'tercero_actitud', valores: ['Se dio a la fuga'] }

export const SECCIONES: Seccion[] = [
  /* ---------------- Bloque 0: seguridad ---------------- */
  {
    id: 'triage',
    titulo: 'Seguridad',
    descripcion: 'Antes que nada, saber si hay que pedir ayuda.',
    bloque: 'seguridad',
    preguntas: [
      {
        id: 'heridos',
        texto: '¿Hay alguien herido?',
        tipo: 'opcion',
        opciones: ['No, nadie', 'Sí, hay heridos', 'No lo sé'],
        requerida: true,
        sinOmitir: true,
      },
      {
        id: 'heridos_gravedad',
        texto: '¿De qué gravedad?',
        tipo: 'opcion',
        opciones: ['Leves', 'Graves', 'No puedo determinarlo'],
        dependeDe: { pregunta: 'heridos', valores: ['Sí, hay heridos'] },
      },
      {
        id: 'heridos_cantidad',
        texto: '¿Cuántas personas?',
        tipo: 'numero',
        dependeDe: { pregunta: 'heridos', valores: ['Sí, hay heridos'] },
      },
      {
        id: 'riesgo',
        texto: '¿Hay riesgo en el lugar ahora?',
        ayuda: 'Tocá todo lo que corresponda.',
        tipo: 'multiple',
        opciones: [
          'El vehículo obstruye la circulación',
          'Hay pérdida de combustible',
          'Riesgo de incendio',
          'Estamos sobre una autopista o ruta',
          'No hay riesgo inmediato',
        ],
      },
    ],
  },

  /* ---------------- Bloque 1: sólo se puede contestar en el lugar ---------------- */
  {
    id: 'identificacion',
    titulo: 'Qué pasó',
    descripcion: 'Tres datos para saber cómo seguir.',
    bloque: 'lugar',
    preguntas: [
      {
        id: 'momento_declarado',
        texto: '¿Hace cuánto pasó?',
        ayuda: 'Cuanto antes se registre, más valor probatorio tiene.',
        tipo: 'opcion',
        opciones: [
          'Recién, hace menos de 10 minutos',
          'Entre 10 y 30 minutos',
          'Entre 30 minutos y 2 horas',
          'Hace más de 2 horas',
          'Ayer o antes',
        ],
        requerida: true,
        contrasta: 'hora',
      },
      {
        id: 'tipo_siniestro',
        texto: '¿Qué tipo de siniestro fue?',
        tipo: 'opcion',
        opciones: [
          'Colisión con otro vehículo',
          'Colisión con objeto fijo',
          'Atropello a peatón o ciclista',
          'Vuelco o despiste sin terceros',
          'Colisión con animal',
          'Daño por terceros con el auto detenido',
        ],
        requerida: true,
      },
      {
        id: 'cantidad_vehiculos',
        texto: '¿Cuántos vehículos participaron, contando el tuyo?',
        tipo: 'opcion',
        opciones: ['1', '2', '3', '4 o más'],
        requerida: true,
      },
    ],
  },
  {
    id: 'terceros',
    titulo: 'El otro vehículo',
    descripcion: 'Estos datos son los que más se pierden si no se toman en el momento.',
    bloque: 'lugar',
    preguntas: [
      {
        id: 'tercero_actitud',
        texto: '¿El otro conductor sigue en el lugar?',
        tipo: 'opcion',
        opciones: [
          'Sí, está acá',
          'Se retiró después de intercambiar datos',
          'Se dio a la fuga',
          'Fue trasladado en ambulancia',
        ],
        requerida: true,
        criticaCobertura: true,
        dependeDe: HAY_TERCERO,
      },
      {
        id: 'tercero_patente',
        texto: 'Patente del otro vehículo',
        ayuda: 'Es el dato más difícil de recuperar después. Si lo tenés, cargalo ahora.',
        tipo: 'texto',
        dependeDe: HAY_OTRO_VEHICULO,
        omitir: 'No la pude ver',
      },
      {
        id: 'tercero_datos',
        texto: 'Datos del otro conductor',
        tipo: 'persona',
        dependeDe: HAY_TERCERO,
        ocultarSi: TERCERO_AUSENTE,
        omitir: 'No me los quiso dar',
      },
      {
        id: 'tercero_aseguradora',
        texto: '¿Qué aseguradora tiene el otro vehículo?',
        tipo: 'texto',
        dependeDe: HAY_OTRO_VEHICULO,
        ocultarSi: TERCERO_AUSENTE,
      },
      {
        id: 'tercero_poliza',
        texto: 'Número de póliza del otro vehículo',
        tipo: 'texto',
        dependeDe: HAY_OTRO_VEHICULO,
        ocultarSi: TERCERO_AUSENTE,
      },
    ],
  },
  {
    id: 'relato',
    titulo: 'Tu relato',
    descripcion: 'Tu versión tomada en el momento, no tres días después.',
    bloque: 'lugar',
    preguntas: [
      {
        id: 'relato',
        texto: 'Contá con tus palabras cómo pasó',
        ayuda:
          'Hablá tranquilo, entre 30 y 90 segundos. Va antes de las preguntas a propósito: así contás lo que viste sin que ninguna pregunta te sugiera la respuesta.',
        tipo: 'audio',
        requerida: true,
        omitir: 'Prefiero no grabar',
      },
    ],
  },
  {
    id: 'mecanica',
    titulo: 'Cómo ocurrió',
    descripcion: 'Esta es la parte que más pesa.',
    bloque: 'lugar',
    preguntas: [
      {
        id: 'calle',
        texto: '¿Por qué calle o ruta venías?',
        tipo: 'texto',
        requerida: true,
        contrasta: 'lugar',
      },
      {
        id: 'sentido',
        texto: '¿Hacia dónde ibas?',
        ayuda: 'Por ejemplo: "hacia el centro", "sentido norte", "hacia Av. Mitre".',
        tipo: 'texto',
      },
      {
        id: 'maniobra',
        texto: '¿Qué estabas haciendo justo antes del impacto?',
        tipo: 'opcion',
        opciones: [
          'Circulando derecho',
          'Girando a la izquierda',
          'Girando a la derecha',
          'Cambiando de carril',
          'Adelantando a otro vehículo',
          'Retrocediendo',
          'Estacionando o saliendo de un estacionamiento',
          'Detenido por completo',
        ],
        requerida: true,
      },
      {
        id: 'velocidad',
        texto: '¿A qué velocidad venías?',
        ayuda: 'Un número aproximado está bien.',
        tipo: 'numero',
        unidad: 'km/h',
        requerida: true,
        contrasta: 'velocidad',
      },
      {
        id: 'freno',
        texto: '¿Llegaste a frenar?',
        tipo: 'opcion',
        opciones: ['Sí, frené a fondo', 'Sí, frené parcialmente', 'No llegué a frenar', 'No recuerdo'],
        requerida: true,
        contrasta: 'frenada',
      },
      {
        id: 'zona_propia',
        texto: '¿Dónde golpeó tu vehículo?',
        ayuda: 'Tocá la zona del primer contacto.',
        tipo: 'zonaImpacto',
        requerida: true,
      },
      {
        id: 'zona_tercero',
        texto: '¿Y dónde golpeó el otro vehículo?',
        tipo: 'zonaImpacto',
        dependeDe: HAY_OTRO_VEHICULO,
      },
      {
        id: 'semaforo',
        texto: '¿Cómo estaba el semáforo para vos?',
        tipo: 'opcion',
        opciones: ['Verde', 'Amarillo', 'Rojo', 'No había semáforo', 'Estaba apagado o intermitente', 'No lo recuerdo'],
        requerida: true,
      },
      {
        id: 'senalizacion',
        texto: '¿Qué señalización había en el cruce?',
        tipo: 'multiple',
        opciones: [
          'Semáforo',
          'Cartel de PARE',
          'Cartel de ceda el paso',
          'Senda peatonal',
          'Lomo de burro',
          'Ninguna señalización',
          'No lo recuerdo',
        ],
      },
    ],
  },
  {
    id: 'contexto',
    titulo: 'Condiciones del lugar',
    descripcion: 'Todo esto se contrasta después contra los datos meteorológicos oficiales.',
    bloque: 'lugar',
    preguntas: [
      {
        id: 'pavimento',
        texto: '¿Cómo estaba el pavimento?',
        tipo: 'opcion',
        opciones: ['Seco', 'Mojado', 'Con hielo o escarcha', 'Ripio, tierra o barro', 'En obra o con pozos'],
        requerida: true,
        contrasta: 'pavimento',
      },
      {
        id: 'clima',
        texto: '¿Cómo estaba el tiempo?',
        tipo: 'opcion',
        opciones: ['Despejado', 'Nublado', 'Lloviznando', 'Lluvia fuerte', 'Niebla', 'Viento fuerte'],
        requerida: true,
        contrasta: 'clima',
      },
      {
        id: 'luz',
        texto: '¿Cómo era la visibilidad?',
        tipo: 'opcion',
        opciones: [
          'De día, buena luz',
          'Atardecer o amanecer',
          'De noche con iluminación',
          'De noche sin iluminación',
          'Sol de frente',
        ],
        requerida: true,
        contrasta: 'luz',
      },
    ],
  },
  {
    id: 'estado',
    titulo: 'Estado del vehículo',
    descripcion: 'Define si hace falta una grúa antes de irte del lugar.',
    bloque: 'lugar',
    preguntas: [
      {
        id: 'circula',
        texto: '¿El auto puede circular por sus propios medios?',
        tipo: 'opcion',
        opciones: ['Sí, sin problemas', 'Sí, pero con riesgo', 'No, quedó inmovilizado'],
        requerida: true,
      },
    ],
  },
  {
    id: 'intervenciones',
    titulo: 'Quién intervino',
    descripcion: 'Cada intervención genera un expediente paralelo que después hay que poder pedir.',
    bloque: 'lugar',
    preguntas: [
      {
        id: 'policia',
        texto: '¿Intervino la policía?',
        tipo: 'opcion',
        opciones: ['Sí', 'No', 'La llamamos y todavía no llegó'],
        requerida: true,
      },
      {
        id: 'policia_acta',
        texto: 'Número de acta o expediente policial',
        tipo: 'texto',
        dependeDe: { pregunta: 'policia', valores: ['Sí'] },
        omitir: 'Todavía no me lo dieron',
      },
      {
        id: 'policia_dependencia',
        texto: '¿Qué dependencia o comisaría intervino?',
        tipo: 'texto',
        dependeDe: { pregunta: 'policia', valores: ['Sí'] },
      },
      {
        id: 'otras_intervenciones',
        texto: '¿Intervino alguien más?',
        tipo: 'multiple',
        opciones: ['Ambulancia', 'Bomberos', 'Grúa', 'Tránsito municipal', 'Nadie más'],
      },
      {
        id: 'quien_llamo',
        texto: '¿Quién llamó a la policía o la ambulancia?',
        tipo: 'opcion',
        opciones: ['Yo', 'El otro conductor', 'Un testigo', 'Alguien que pasaba', 'Nadie llamó', 'No sé'],
      },
    ],
  },

  /* ---------------- Bloque 2: se puede completar después ---------------- */
  {
    id: 'cobertura',
    titulo: 'Vehículo y licencia',
    descripcion: 'Contestá con honestidad: una respuesta falsa acá es lo que después hace caer la cobertura.',
    bloque: 'despues',
    preguntas: [
      {
        id: 'quien_conducia',
        texto: '¿Quién manejaba tu vehículo?',
        ayuda: 'Si manejaba otra persona, la póliza puede requerir que esté declarada.',
        tipo: 'opcion',
        opciones: ['Yo, el titular de la póliza', 'Otra persona'],
        requerida: true,
        criticaCobertura: true,
      },
      {
        id: 'conductor_datos',
        texto: 'Datos de quien manejaba',
        tipo: 'persona',
        dependeDe: { pregunta: 'quien_conducia', valores: ['Otra persona'] },
        criticaCobertura: true,
      },
      {
        id: 'acompanantes',
        texto: '¿Cuántas personas iban con vos?',
        ayuda: 'Sin contarte a vos.',
        tipo: 'numero',
        requerida: true,
      },
      {
        id: 'licencia_vigente',
        texto: '¿La licencia de conducir estaba vigente?',
        tipo: 'opcion',
        opciones: ['Sí, vigente', 'No, estaba vencida', 'No tengo licencia', 'No estoy seguro'],
        requerida: true,
        criticaCobertura: true,
      },
      {
        id: 'vtv',
        texto: '¿La VTV estaba al día?',
        tipo: 'opcion',
        opciones: ['Sí', 'No', 'No estoy seguro', 'No corresponde'],
        criticaCobertura: true,
      },
      {
        id: 'alcoholemia',
        texto: '¿Se hizo test de alcoholemia?',
        tipo: 'opcion',
        opciones: ['Sí, dio negativo', 'Sí, dio positivo', 'Se ofreció y no se realizó', 'No intervino la autoridad'],
        criticaCobertura: true,
      },
      {
        id: 'uso_vehiculo',
        texto: '¿Para qué estabas usando el vehículo?',
        tipo: 'opcion',
        opciones: [
          'Uso particular',
          'Ir o volver del trabajo',
          'Trabajo con el vehículo (reparto, aplicación, taxi)',
          'Viaje de placer o turismo',
        ],
        criticaCobertura: true,
      },
    ],
  },
]

/* ================= Fotografías ================= */

/** Las tomas que el sistema pide una por una, en orden de urgencia. */
export interface GuiaFoto {
  id: string
  titulo: string
  instruccion: string
  obligatoria: boolean
  dependeDe?: Condicion | Condicion[]
}

export const GUIA_FOTOS: GuiaFoto[] = [
  {
    id: 'posicion_final',
    titulo: 'Cómo quedaron los autos',
    instruccion: 'No los muevas todavía. Que se vea cómo quedó cada uno respecto del otro.',
    obligatoria: true,
  },
  {
    id: 'patente_tercero',
    titulo: 'Patente del otro vehículo',
    instruccion: 'Que se lea con claridad. Es la foto que más se olvida y la más difícil de recuperar después.',
    obligatoria: true,
    dependeDe: HAY_OTRO_VEHICULO,
  },
  {
    id: 'dano_tercero',
    titulo: 'Daño del otro vehículo',
    instruccion: 'Acercate al golpe del otro auto y sacá la foto a un metro de distancia.',
    obligatoria: false,
    dependeDe: HAY_OTRO_VEHICULO,
  },
  {
    id: 'pano_atras',
    titulo: 'Vista general desde atrás',
    instruccion: 'Alejate unos 10 pasos hacia atrás. Que se vean los vehículos y la calle.',
    obligatoria: true,
  },
  {
    id: 'pano_frente',
    titulo: 'Vista general desde adelante',
    instruccion: 'Lo mismo pero desde el otro lado, para que se vea el cruce completo.',
    obligatoria: true,
  },
  {
    id: 'dano_propio',
    titulo: 'Daño de tu vehículo',
    instruccion: 'Acercate al golpe principal de tu auto y sacá la foto a un metro de distancia.',
    obligatoria: true,
  },
  { id: 'patente_propia', titulo: 'Tu patente', instruccion: 'Que se lea con claridad.', obligatoria: true },
  {
    id: 'pavimento',
    titulo: 'Estado del pavimento',
    instruccion: 'Apuntá al piso donde ocurrió el impacto. Si hay huellas de frenada, vidrios o restos, que se vean.',
    obligatoria: true,
  },
  {
    id: 'cedula_tercero',
    titulo: 'Cédula del otro vehículo',
    instruccion: 'Pedile la cédula verde o azul y sacale una foto.',
    obligatoria: false,
    dependeDe: HAY_OTRO_VEHICULO,
  },
  {
    id: 'licencia_tercero',
    titulo: 'Licencia del otro conductor',
    instruccion: 'Pedile la licencia de conducir y sacale una foto.',
    obligatoria: false,
    dependeDe: HAY_TERCERO,
  },
  {
    id: 'senalizacion',
    titulo: 'Señalización del lugar',
    instruccion: 'Sacá el semáforo, el cartel o la señal que corresponda al cruce.',
    obligatoria: false,
  },
  {
    id: 'libre',
    titulo: 'Lo que quieras agregar',
    instruccion: 'Cualquier cosa que te parezca importante y no esté en las fotos anteriores.',
    obligatoria: false,
  },
]

/* ================= Recorrido ================= */

/**
 * Las etapas del flujo, en orden.
 *
 * Las secciones se intercalan con las pantallas propias (fotos, testigos, corte)
 * porque el orden de urgencia no coincide con el agrupamiento temático: el relato en
 * audio va antes que las preguntas de mecánica a propósito, para que la persona cuente
 * lo que pasó sin que ninguna pregunta se lo sugiera antes.
 */
export type Etapa =
  | { tipo: 'seccion'; id: string }
  | { tipo: 'fotos' }
  | { tipo: 'testigos' }
  | { tipo: 'corte' }
  | { tipo: 'datos' }
  | { tipo: 'revision' }
  | { tipo: 'final' }

export const RECORRIDO: Etapa[] = [
  { tipo: 'seccion', id: 'triage' },
  { tipo: 'seccion', id: 'identificacion' },
  { tipo: 'seccion', id: 'terceros' },
  { tipo: 'fotos' },
  { tipo: 'seccion', id: 'relato' },
  { tipo: 'testigos' },
  { tipo: 'seccion', id: 'mecanica' },
  { tipo: 'seccion', id: 'contexto' },
  { tipo: 'seccion', id: 'estado' },
  { tipo: 'seccion', id: 'intervenciones' },
  { tipo: 'corte' },
  { tipo: 'seccion', id: 'cobertura' },
  { tipo: 'datos' },
  { tipo: 'revision' },
  { tipo: 'final' },
]

/* ================= Visibilidad ================= */

const comoLista = (c: Condicion | Condicion[] | undefined): Condicion[] =>
  c === undefined ? [] : Array.isArray(c) ? c : [c]

const cumple = (c: Condicion, respuestas: Record<string, unknown>): boolean => {
  const valor = respuestas[c.pregunta]
  return typeof valor === 'string' && c.valores.includes(valor)
}

function visible(
  reglas: { dependeDe?: Condicion | Condicion[]; ocultarSi?: Condicion | Condicion[] },
  respuestas: Record<string, unknown>,
): boolean {
  if (comoLista(reglas.ocultarSi).some((c) => cumple(c, respuestas))) return false
  return comoLista(reglas.dependeDe).every((c) => cumple(c, respuestas))
}

export function preguntasVisibles(seccion: Seccion, respuestas: Record<string, unknown>): Pregunta[] {
  return seccion.preguntas.filter((p) => visible(p, respuestas))
}

/** Las tomas que corresponden a este siniestro: sin tercero no se piden fotos del tercero. */
export function fotosVisibles(respuestas: Record<string, unknown>): GuiaFoto[] {
  return GUIA_FOTOS.filter((g) => visible(g, respuestas))
}

/**
 * Ids de las tomas obligatorias que corresponden a este siniestro.
 *
 * Se calcula sobre las visibles y no sobre la lista completa: exigirle la patente del
 * tercero a quien chocó contra un árbol marcaba el expediente como incompleto para
 * siempre, sin que hubiera nada que la persona pudiera hacer al respecto.
 */
export function fotosObligatorias(respuestas: Record<string, unknown>): string[] {
  return fotosVisibles(respuestas)
    .filter((g) => g.obligatoria)
    .map((g) => g.id)
}

export function seccionPorId(id: string): Seccion | undefined {
  return SECCIONES.find((s) => s.id === id)
}

export const ZONAS_IMPACTO = [
  'Frente izq.',
  'Frente centro',
  'Frente der.',
  'Lateral izq. del.',
  'Techo',
  'Lateral der. del.',
  'Lateral izq. tras.',
  'Bajos',
  'Lateral der. tras.',
  'Trasera izq.',
  'Trasera centro',
  'Trasera der.',
]

export const TOTAL_PREGUNTAS = SECCIONES.reduce((n, s) => n + s.preguntas.length, 0)
