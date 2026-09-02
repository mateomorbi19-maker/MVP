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
  | 'parrafo'

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

/**
 * Los valores de las respuestas cerradas.
 *
 * ESTO NO ES COPY: es el dato que se guarda en `casos.respuestas`, que ya está escrito
 * dentro de expedientes sellados, y que el motor de consistencia compara por igualdad
 * literal. Cambiar uno de estos textos no cambia cómo se ve una pantalla: cambia el
 * valor almacenado, deja huérfanos a los expedientes anteriores y apaga en silencio la
 * contradicción que ese valor servía para detectar.
 *
 * Por eso los arrays `opciones` se arman desde acá y no al revés, y por eso
 * `lib/consistencia.ts` importa estas constantes en lugar de repetir los textos.
 * Un cambio de redacción se pide; no se hace.
 */
export const VALOR = {
  heridos: {
    NO_NADIE: 'No, nadie',
    SI_HAY_HERIDOS: 'Sí, hay heridos',
    NO_LO_SE: 'No lo sé',
  },
  heridos_gravedad: {
    LEVES: 'Leves',
    GRAVES: 'Graves',
    NO_PUEDO_DETERMINARLO: 'No puedo determinarlo',
  },
  riesgo: {
    EL_VEHICULO_OBSTRUYE_LA_CIRCULACION: 'El vehículo obstruye la circulación',
    HAY_PERDIDA_DE_COMBUSTIBLE: 'Hay pérdida de combustible',
    RIESGO_DE_INCENDIO: 'Riesgo de incendio',
    ESTAMOS_SOBRE_UNA_AUTOPISTA_O_RUTA: 'Estamos sobre una autopista o ruta',
    NO_HAY_RIESGO_INMEDIATO: 'No hay riesgo inmediato',
  },
  momento_declarado: {
    RECIEN_HACE_MENOS_DE_10_MINUTOS: 'Recién, hace menos de 10 minutos',
    ENTRE_10_Y_30_MINUTOS: 'Entre 10 y 30 minutos',
    ENTRE_30_MINUTOS_Y_2_HORAS: 'Entre 30 minutos y 2 horas',
    HACE_MAS_DE_2_HORAS: 'Hace más de 2 horas',
    AYER_O_ANTES: 'Ayer o antes',
  },
  tipo_siniestro: {
    COLISION_CON_OTRO_VEHICULO: 'Colisión con otro vehículo',
    COLISION_CON_OBJETO_FIJO: 'Colisión con objeto fijo',
    ATROPELLO_A_PEATON_O_CICLISTA: 'Atropello a peatón o ciclista',
    VUELCO_O_DESPISTE_SIN_TERCEROS: 'Vuelco o despiste sin terceros',
    COLISION_CON_ANIMAL: 'Colisión con animal',
    DANO_POR_TERCEROS_CON_EL_AUTO_DETENIDO: 'Daño por terceros con el auto detenido',
  },
  cantidad_vehiculos: {
    N1: '1',
    N2: '2',
    N3: '3',
    N4_O_MAS: '4 o más',
  },
  tercero_actitud: {
    SI_ESTA_ACA: 'Sí, está acá',
    SE_RETIRO_DESPUES_DE_INTERCAMBIAR_DATOS: 'Se retiró después de intercambiar datos',
    SE_DIO_A_LA_FUGA: 'Se dio a la fuga',
    FUE_TRASLADADO_EN_AMBULANCIA: 'Fue trasladado en ambulancia',
  },
  maniobra: {
    CIRCULANDO_DERECHO: 'Circulando derecho',
    GIRANDO_A_LA_IZQUIERDA: 'Girando a la izquierda',
    GIRANDO_A_LA_DERECHA: 'Girando a la derecha',
    CAMBIANDO_DE_CARRIL: 'Cambiando de carril',
    ADELANTANDO_A_OTRO_VEHICULO: 'Adelantando a otro vehículo',
    RETROCEDIENDO: 'Retrocediendo',
    ESTACIONANDO_O_SALIENDO_DE_UN_ESTACIONAMIENTO: 'Estacionando o saliendo de un estacionamiento',
    DETENIDO_POR_COMPLETO: 'Detenido por completo',
  },
  freno: {
    SI_FRENE_A_FONDO: 'Sí, frené a fondo',
    SI_FRENE_PARCIALMENTE: 'Sí, frené parcialmente',
    NO_LLEGUE_A_FRENAR: 'No llegué a frenar',
    NO_RECUERDO: 'No recuerdo',
  },
  semaforo: {
    VERDE: 'Verde',
    AMARILLO: 'Amarillo',
    ROJO: 'Rojo',
    NO_HABIA_SEMAFORO: 'No había semáforo',
    ESTABA_APAGADO_O_INTERMITENTE: 'Estaba apagado o intermitente',
    NO_LO_RECUERDO: 'No lo recuerdo',
  },
  senalizacion: {
    SEMAFORO: 'Semáforo',
    CARTEL_DE_PARE: 'Cartel de PARE',
    CARTEL_DE_CEDA_EL_PASO: 'Cartel de ceda el paso',
    SENDA_PEATONAL: 'Senda peatonal',
    LOMO_DE_BURRO: 'Lomo de burro',
    NINGUNA_SENALIZACION: 'Ninguna señalización',
    NO_LO_RECUERDO: 'No lo recuerdo',
  },
  pavimento: {
    SECO: 'Seco',
    MOJADO: 'Mojado',
    CON_HIELO_O_ESCARCHA: 'Con hielo o escarcha',
    RIPIO_TIERRA_O_BARRO: 'Ripio, tierra o barro',
    EN_OBRA_O_CON_POZOS: 'En obra o con pozos',
  },
  clima: {
    DESPEJADO: 'Despejado',
    NUBLADO: 'Nublado',
    LLOVIZNANDO: 'Lloviznando',
    LLUVIA_FUERTE: 'Lluvia fuerte',
    NIEBLA: 'Niebla',
    VIENTO_FUERTE: 'Viento fuerte',
  },
  luz: {
    DE_DIA_BUENA_LUZ: 'De día, buena luz',
    ATARDECER_O_AMANECER: 'Atardecer o amanecer',
    DE_NOCHE_CON_ILUMINACION: 'De noche con iluminación',
    DE_NOCHE_SIN_ILUMINACION: 'De noche sin iluminación',
    SOL_DE_FRENTE: 'Sol de frente',
  },
  circula: {
    SI_SIN_PROBLEMAS: 'Sí, sin problemas',
    SI_PERO_CON_RIESGO: 'Sí, pero con riesgo',
    NO_QUEDO_INMOVILIZADO: 'No, quedó inmovilizado',
  },
  policia: {
    SI: 'Sí',
    NO: 'No',
    LA_LLAMAMOS_Y_TODAVIA_NO_LLEGO: 'La llamamos y todavía no llegó',
  },
  otras_intervenciones: {
    AMBULANCIA: 'Ambulancia',
    BOMBEROS: 'Bomberos',
    GRUA: 'Grúa',
    TRANSITO_MUNICIPAL: 'Tránsito municipal',
    NADIE_MAS: 'Nadie más',
  },
  quien_llamo: {
    YO: 'Yo',
    EL_OTRO_CONDUCTOR: 'El otro conductor',
    UN_TESTIGO: 'Un testigo',
    ALGUIEN_QUE_PASABA: 'Alguien que pasaba',
    NADIE_LLAMO: 'Nadie llamó',
    NO_SE: 'No sé',
  },
  quien_conducia: {
    YO_EL_TITULAR_DE_LA_POLIZA: 'Yo, el titular de la póliza',
    OTRA_PERSONA: 'Otra persona',
  },
  licencia_vigente: {
    SI_VIGENTE: 'Sí, vigente',
    NO_ESTABA_VENCIDA: 'No, estaba vencida',
    NO_TENGO_LICENCIA: 'No tengo licencia',
    NO_ESTOY_SEGURO: 'No estoy seguro',
  },
  vtv: {
    SI: 'Sí',
    NO: 'No',
    NO_ESTOY_SEGURO: 'No estoy seguro',
    NO_CORRESPONDE: 'No corresponde',
  },
  alcoholemia: {
    SI_DIO_NEGATIVO: 'Sí, dio negativo',
    SI_DIO_POSITIVO: 'Sí, dio positivo',
    SE_OFRECIO_Y_NO_SE_REALIZO: 'Se ofreció y no se realizó',
    NO_INTERVINO_LA_AUTORIDAD: 'No intervino la autoridad',
  },
  uso_vehiculo: {
    USO_PARTICULAR: 'Uso particular',
    IR_O_VOLVER_DEL_TRABAJO: 'Ir o volver del trabajo',
    TRABAJO_CON_EL_VEHICULO_REPARTO_APLICACION_TAXI: 'Trabajo con el vehículo (reparto, aplicación, taxi)',
    VIAJE_DE_PLACER_O_TURISMO: 'Viaje de placer o turismo',
  },
} as const

/* Condiciones reutilizadas. */
const HAY_TERCERO: Condicion = {
  pregunta: 'tipo_siniestro',
  valores: [VALOR.tipo_siniestro.COLISION_CON_OTRO_VEHICULO, VALOR.tipo_siniestro.ATROPELLO_A_PEATON_O_CICLISTA],
}
const HAY_OTRO_VEHICULO: Condicion = {
  pregunta: 'tipo_siniestro',
  valores: [VALOR.tipo_siniestro.COLISION_CON_OTRO_VEHICULO],
}
/** Si se fugó, pedirle los datos al tercero es pedirle algo imposible. */
const TERCERO_AUSENTE: Condicion = { pregunta: 'tercero_actitud', valores: [VALOR.tercero_actitud.SE_DIO_A_LA_FUGA] }

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
        opciones: Object.values(VALOR.heridos),
        requerida: true,
        sinOmitir: true,
      },
      {
        id: 'heridos_gravedad',
        texto: '¿De qué gravedad?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.heridos_gravedad),
        dependeDe: { pregunta: 'heridos', valores: [VALOR.heridos.SI_HAY_HERIDOS] },
      },
      {
        id: 'heridos_cantidad',
        texto: '¿Cuántas personas?',
        tipo: 'numero',
        dependeDe: { pregunta: 'heridos', valores: [VALOR.heridos.SI_HAY_HERIDOS] },
      },
      {
        id: 'riesgo',
        texto: '¿Hay riesgo en el lugar ahora?',
        ayuda: 'Tocá todo lo que corresponda.',
        tipo: 'multiple',
        opciones: Object.values(VALOR.riesgo),
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
        opciones: Object.values(VALOR.momento_declarado),
        requerida: true,
        contrasta: 'hora',
      },
      {
        id: 'tipo_siniestro',
        texto: '¿Qué tipo de siniestro fue?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.tipo_siniestro),
        requerida: true,
      },
      {
        id: 'cantidad_vehiculos',
        texto: '¿Cuántos vehículos participaron, contando el tuyo?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.cantidad_vehiculos),
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
        opciones: Object.values(VALOR.tercero_actitud),
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
      {
        id: 'relato_texto',
        texto: 'Si preferís, contalo por escrito',
        ayuda:
          'Vale igual que el audio. Está acá para quien no puede grabar: por ruido, por vergüenza, o porque el teléfono no le dio permiso al micrófono. Hasta ahora, quien tocaba «Prefiero no grabar» perdía el relato entero.',
        tipo: 'parrafo',
        omitir: 'Ya lo conté por voz',
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
        opciones: Object.values(VALOR.maniobra),
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
        opciones: Object.values(VALOR.freno),
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
        opciones: Object.values(VALOR.semaforo),
        requerida: true,
      },
      {
        id: 'senalizacion',
        texto: '¿Qué señalización había en el cruce?',
        tipo: 'multiple',
        opciones: Object.values(VALOR.senalizacion),
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
        opciones: Object.values(VALOR.pavimento),
        requerida: true,
        contrasta: 'pavimento',
      },
      {
        id: 'clima',
        texto: '¿Cómo estaba el tiempo?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.clima),
        requerida: true,
        contrasta: 'clima',
      },
      {
        id: 'luz',
        texto: '¿Cómo era la visibilidad?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.luz),
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
        opciones: Object.values(VALOR.circula),
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
        opciones: Object.values(VALOR.policia),
        requerida: true,
      },
      {
        id: 'policia_acta',
        texto: 'Número de acta o expediente policial',
        tipo: 'texto',
        dependeDe: { pregunta: 'policia', valores: [VALOR.policia.SI] },
        omitir: 'Todavía no me lo dieron',
      },
      {
        id: 'policia_dependencia',
        texto: '¿Qué dependencia o comisaría intervino?',
        tipo: 'texto',
        dependeDe: { pregunta: 'policia', valores: [VALOR.policia.SI] },
      },
      {
        id: 'otras_intervenciones',
        texto: '¿Intervino alguien más?',
        tipo: 'multiple',
        opciones: Object.values(VALOR.otras_intervenciones),
      },
      {
        id: 'quien_llamo',
        texto: '¿Quién llamó a la policía o la ambulancia?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.quien_llamo),
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
        opciones: Object.values(VALOR.quien_conducia),
        requerida: true,
        criticaCobertura: true,
      },
      {
        id: 'conductor_datos',
        texto: 'Datos de quien manejaba',
        tipo: 'persona',
        dependeDe: { pregunta: 'quien_conducia', valores: [VALOR.quien_conducia.OTRA_PERSONA] },
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
        opciones: Object.values(VALOR.licencia_vigente),
        requerida: true,
        criticaCobertura: true,
      },
      {
        id: 'vtv',
        texto: '¿La VTV estaba al día?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.vtv),
        criticaCobertura: true,
      },
      {
        id: 'alcoholemia',
        texto: '¿Se hizo test de alcoholemia?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.alcoholemia),
        criticaCobertura: true,
      },
      {
        id: 'uso_vehiculo',
        texto: '¿Para qué estabas usando el vehículo?',
        tipo: 'opcion',
        opciones: Object.values(VALOR.uso_vehiculo),
        criticaCobertura: true,
      },
    ],
  },
  {
    id: 'relato_casa',
    titulo: 'El relato completo',
    descripcion: 'Ahora sí, con calma y sin nadie esperando.',
    bloque: 'despues',
    preguntas: [
      {
        id: 'relato_ampliado',
        texto: 'Contá lo que pasó, con todo el detalle que puedas',
        ayuda:
          'Esto es lo que va a leer quien resuelva el siniestro. Lo de abajo es una guía, no un formulario: contalo como te salga.',
        tipo: 'parrafo',
        omitir: 'Con lo que ya conté alcanza',
      },
    ],
  },
]

/* ================= Guía del relato ================= */

/**
 * La estructura sugerida para el relato ampliado.
 *
 * Es una guía y no un formulario a propósito: partir el relato en campos obligatorios
 * produce declaraciones que suenan a formulario y pierden justo lo que un relato aporta,
 * que es el orden en que la persona recuerda las cosas.
 */
export const GUIA_RELATO = [
  'La hora y el lugar aproximados.',
  'Por dónde venías y hacia dónde ibas.',
  'Qué estabas haciendo justo antes.',
  'Cómo fue el contacto entre los vehículos.',
  'Qué pasó inmediatamente después.',
  'Cualquier cosa que te parezca importante y no te haya preguntado nadie.',
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
  | { tipo: 'croquis' }
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
  { tipo: 'seccion', id: 'relato_casa' },
  { tipo: 'croquis' },
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
