/**
 * Cuestionario jurídico-procesal — versión ASEGURADORA.
 *
 * Criterio de diseño: la aseguradora necesita (a) hechos objetivos y estructurados,
 * (b) datos que definan cobertura o exclusión, y (c) respuestas contrastables contra
 * datos duros (GPS, hora, clima) para detectar inconsistencias.
 *
 * Cada pregunta marcada con `contrasta` alimenta el motor de consistencia.
 * Las marcadas `criticaCobertura` son causales típicas de rechazo o reserva.
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
  /** Se muestra solo si otra respuesta coincide */
  dependeDe?: { pregunta: string; valores: string[] }
  unidad?: string
}

export interface Seccion {
  id: string
  titulo: string
  descripcion: string
  preguntas: Pregunta[]
}

export const SECCIONES: Seccion[] = [
  {
    id: 'triage',
    titulo: 'Primero lo importante',
    descripcion: 'Antes que nada, necesitamos saber si hay que pedir ayuda.',
    preguntas: [
      {
        id: 'heridos',
        texto: '¿Hay personas heridas?',
        tipo: 'opcion',
        opciones: ['No, nadie', 'Sí, heridas leves', 'Sí, heridas graves', 'No puedo determinarlo'],
        requerida: true,
      },
      {
        id: 'heridos_cantidad',
        texto: '¿Cuántas personas resultaron heridas?',
        tipo: 'numero',
        dependeDe: { pregunta: 'heridos', valores: ['Sí, heridas leves', 'Sí, heridas graves'] },
      },
      {
        id: 'riesgo',
        texto: '¿Hay riesgo en el lugar ahora mismo?',
        ayuda: 'Marcá todo lo que corresponda.',
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
  {
    id: 'identificacion',
    titulo: 'Qué pasó',
    descripcion: 'Datos básicos del siniestro.',
    preguntas: [
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
        texto: '¿Cuántos vehículos participaron en total, contando el tuyo?',
        tipo: 'opcion',
        opciones: ['1', '2', '3', '4 o más'],
        requerida: true,
      },
      {
        id: 'quien_conducia',
        texto: '¿Quién manejaba tu vehículo?',
        ayuda: 'Es importante ser exacto: si manejaba otra persona, la póliza puede requerir que esté declarada.',
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
        id: 'momento_declarado',
        texto: '¿Hace cuánto ocurrió el accidente?',
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
    ],
  },
  {
    id: 'mecanica',
    titulo: 'Cómo ocurrió',
    descripcion: 'Esta es la parte que más pesa. Tomate el tiempo de contestar con precisión.',
    preguntas: [
      {
        id: 'calle',
        texto: '¿Por qué calle o ruta venías circulando?',
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
        texto: '¿A qué velocidad aproximada venías?',
        ayuda: 'Un número aproximado está bien, no hace falta que sea exacto.',
        tipo: 'numero',
        unidad: 'km/h',
        requerida: true,
        contrasta: 'velocidad',
      },
      {
        id: 'freno',
        texto: '¿Llegaste a frenar antes del impacto?',
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
        dependeDe: { pregunta: 'tipo_siniestro', valores: ['Colisión con otro vehículo'] },
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
      {
        id: 'relato',
        texto: 'Contá con tus palabras cómo pasó',
        ayuda: 'Hablá tranquilo, entre 30 y 90 segundos. Es la pieza más valiosa del expediente: tu versión tomada en el momento, no tres días después.',
        tipo: 'audio',
        requerida: true,
      },
    ],
  },
  {
    id: 'contexto',
    titulo: 'Condiciones del lugar',
    descripcion: 'Todo esto se contrasta después contra los datos meteorológicos oficiales.',
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
      {
        id: 'acompanantes',
        texto: '¿Cuántas personas iban con vos en el vehículo?',
        ayuda: 'Sin contarte a vos.',
        tipo: 'numero',
        requerida: true,
      },
    ],
  },
  {
    id: 'cobertura',
    titulo: 'Vehículo y licencia',
    descripcion:
      'La aseguradora necesita esto para procesar el siniestro. Contestá con honestidad: una respuesta falsa acá es lo que después hace caer la cobertura.',
    preguntas: [
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
        texto: '¿La VTV o revisión técnica estaba al día?',
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
      {
        id: 'circula',
        texto: '¿El vehículo puede circular por sus propios medios?',
        tipo: 'opcion',
        opciones: ['Sí, sin problemas', 'Sí, pero con riesgo', 'No, quedó inmovilizado'],
        requerida: true,
      },
    ],
  },
  {
    id: 'terceros',
    titulo: 'El otro vehículo',
    descripcion: 'Estos datos son los que más se pierden si no se toman en el momento.',
    preguntas: [
      {
        id: 'tercero_datos',
        texto: 'Datos del otro conductor',
        tipo: 'persona',
        dependeDe: {
          pregunta: 'tipo_siniestro',
          valores: ['Colisión con otro vehículo', 'Atropello a peatón o ciclista'],
        },
      },
      {
        id: 'tercero_patente',
        texto: 'Patente del otro vehículo',
        tipo: 'texto',
        dependeDe: { pregunta: 'tipo_siniestro', valores: ['Colisión con otro vehículo'] },
      },
      {
        id: 'tercero_aseguradora',
        texto: '¿Qué aseguradora tiene el otro vehículo?',
        tipo: 'texto',
        dependeDe: { pregunta: 'tipo_siniestro', valores: ['Colisión con otro vehículo'] },
      },
      {
        id: 'tercero_poliza',
        texto: 'Número de póliza del otro vehículo',
        tipo: 'texto',
        dependeDe: { pregunta: 'tipo_siniestro', valores: ['Colisión con otro vehículo'] },
      },
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
        criticaCobertura: true,
        dependeDe: {
          pregunta: 'tipo_siniestro',
          valores: ['Colisión con otro vehículo', 'Atropello a peatón o ciclista'],
        },
      },
    ],
  },
  {
    id: 'intervenciones',
    titulo: 'Quién intervino',
    descripcion: 'Cada intervención genera un expediente paralelo que después hay que poder pedir.',
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
        ayuda: 'Si todavía no te lo dieron, dejalo vacío.',
        tipo: 'texto',
        dependeDe: { pregunta: 'policia', valores: ['Sí'] },
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
]

/** Las 12 tomas que el sistema pide una por una, en orden. */
export interface GuiaFoto {
  id: string
  titulo: string
  instruccion: string
  obligatoria: boolean
}

export const GUIA_FOTOS: GuiaFoto[] = [
  {
    id: 'pano_atras',
    titulo: 'Vista general desde atrás',
    instruccion: 'Alejate unos 10 pasos hacia atrás y sacá una foto que muestre los dos vehículos y la calle.',
    obligatoria: true,
  },
  {
    id: 'pano_frente',
    titulo: 'Vista general desde adelante',
    instruccion: 'Ahora lo mismo pero desde el otro lado, para que se vea el cruce completo.',
    obligatoria: true,
  },
  {
    id: 'posicion_final',
    titulo: 'Posición final de los vehículos',
    instruccion: 'Que se vea cómo quedaron ubicados los autos uno respecto del otro. No los muevas antes de esta foto.',
    obligatoria: true,
  },
  {
    id: 'dano_propio',
    titulo: 'Daño de tu vehículo',
    instruccion: 'Acercate al golpe principal de tu auto y sacá la foto a un metro de distancia.',
    obligatoria: true,
  },
  {
    id: 'dano_tercero',
    titulo: 'Daño del otro vehículo',
    instruccion: 'Lo mismo con el daño del otro auto.',
    obligatoria: false,
  },
  { id: 'patente_propia', titulo: 'Tu patente', instruccion: 'Que se lea con claridad.', obligatoria: true },
  {
    id: 'patente_tercero',
    titulo: 'Patente del otro vehículo',
    instruccion: 'Que se lea con claridad. Es la foto que más se olvida y la más difícil de recuperar después.',
    obligatoria: true,
  },
  {
    id: 'cedula_tercero',
    titulo: 'Cédula del otro vehículo',
    instruccion: 'Pedile la cédula verde o azul y sacale una foto.',
    obligatoria: false,
  },
  {
    id: 'licencia_tercero',
    titulo: 'Licencia del otro conductor',
    instruccion: 'Pedile la licencia de conducir y sacale una foto.',
    obligatoria: false,
  },
  {
    id: 'pavimento',
    titulo: 'Estado del pavimento',
    instruccion: 'Apuntá al piso donde ocurrió el impacto. Si hay huellas de frenada, vidrios o restos, que se vean.',
    obligatoria: true,
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

export function preguntasVisibles(seccion: Seccion, respuestas: Record<string, unknown>): Pregunta[] {
  return seccion.preguntas.filter((p) => {
    if (!p.dependeDe) return true
    const valor = respuestas[p.dependeDe.pregunta]
    return typeof valor === 'string' && p.dependeDe.valores.includes(valor)
  })
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
