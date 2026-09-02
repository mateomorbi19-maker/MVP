/**
 * Prueba de humo de la lógica pura, sin base de datos.
 *
 * Verifica las tres piezas donde un error sería más caro:
 *   1. La serialización canónica y el encadenado de hashes.
 *   2. El motor de consistencia (que es lo que se le muestra a la aseguradora).
 *   3. La generación del PDF de punta a punta.
 *
 *   node --experimental-strip-types scripts/prueba-logica.mjs
 */

import { writeFileSync, mkdirSync } from 'node:fs'
import { canonico, sha256, hashEvento, registrarEvento, VERSION_MANIFIESTO } from '../lib/hash.ts'
import { analizar } from '../lib/consistencia.ts'
import { calleCoincide } from '../lib/geo.ts'
import { generarExpediente } from '../lib/pdf.ts'
import { PLANTILLAS, figurasDelCroquis, limpiarCroquis } from '../lib/croquis.ts'
import { MAPEO, PROVEEDOR_SIMULADO, extraccionActiva, vistaParaAsegurado } from '../lib/extraccion.ts'
import { DECLARACION, construirActa } from '../lib/acta.ts'
import { cifrarCarga, derivarClaves } from '../lib/cifrado.ts'
import { UMBRALES, analizarImpacto, planEscalamiento } from '../lib/impacto.ts'
import { createDecipheriv, createECDH } from 'node:crypto'
import { GUIA_FOTOS, RECORRIDO, SECCIONES, fotosObligatorias, preguntasVisibles, seccionPorId } from '../lib/cuestionario.ts'
import { construirPasos, faltantes, pasoInicial, respondida, vacia } from '../lib/recorrido.ts'
import { CLAVE_INEXISTENTE, hashearClave, hashToken, normalizarDni, nuevoToken, validarClave, verificarClave } from '../lib/claves.ts'

let fallos = 0
let pruebas = 0

function verificar(nombre, condicion, extra = '') {
  pruebas++
  if (condicion) {
    console.log(`  ok   ${nombre}`)
  } else {
    fallos++
    console.log(`  FALLA ${nombre} ${extra}`)
  }
}

/* ---------- 0. Recorrido y visibilidad ---------- */
console.log('\n[0] Recorrido del cuestionario')

const idsDelRecorrido = RECORRIDO.filter((e) => e.tipo === 'seccion').map((e) => e.id)

verificar(
  'toda etapa del recorrido apunta a una sección que existe',
  idsDelRecorrido.every((id) => seccionPorId(id) !== undefined),
  idsDelRecorrido.filter((id) => !seccionPorId(id)).join(', '),
)

// Una sección fuera del recorrido no se le muestra a nadie y nadie se entera.
verificar(
  'toda sección está incluida en el recorrido',
  SECCIONES.every((s) => idsDelRecorrido.includes(s.id)),
  SECCIONES.filter((s) => !idsDelRecorrido.includes(s.id)).map((s) => s.id).join(', '),
)

verificar('la primera pantalla pregunta por los heridos', SECCIONES[0].preguntas[0].id === 'heridos')

verificar(
  'los datos de cobertura quedan para el final',
  SECCIONES.filter((s) => s.bloque === 'despues').every(
    (s) => idsDelRecorrido.indexOf(s.id) > idsDelRecorrido.indexOf('mecanica'),
  ),
)

const contraArbol = { tipo_siniestro: 'Colisión con objeto fijo' }
const contraAuto = { tipo_siniestro: 'Colisión con otro vehículo' }

verificar(
  'sin otro vehículo no se exigen fotos del tercero',
  !fotosObligatorias(contraArbol).some((id) => id.includes('tercero')),
  fotosObligatorias(contraArbol).join(', '),
)

verificar(
  'con otro vehículo sí se exige la patente del tercero',
  fotosObligatorias(contraAuto).includes('patente_tercero'),
)

verificar(
  'todas las tomas siguen estando disponibles para una colisión entre autos',
  fotosObligatorias(contraAuto).length > fotosObligatorias(contraArbol).length,
)

const seccionTerceros = seccionPorId('terceros')
const conFuga = { ...contraAuto, tercero_actitud: 'Se dio a la fuga' }
const idsConFuga = preguntasVisibles(seccionTerceros, conFuga).map((p) => p.id)

verificar('si el tercero se fugó no se le piden sus datos', !idsConFuga.includes('tercero_datos'))
verificar('si el tercero se fugó igual se pregunta la patente', idsConFuga.includes('tercero_patente'))
verificar(
  'si el tercero está presente se le piden los datos',
  preguntasVisibles(seccionTerceros, { ...contraAuto, tercero_actitud: 'Sí, está acá' })
    .map((p) => p.id)
    .includes('tercero_datos'),
)

// Saltear una pregunta no puede hacer desaparecer las que vienen después.
verificar(
  'omitir la pregunta del tercero no esconde el resto',
  preguntasVisibles(seccionTerceros, contraAuto).map((p) => p.id).includes('tercero_datos'),
)

verificar('las guías de foto no tienen ids repetidos', new Set(GUIA_FOTOS.map((g) => g.id)).size === GUIA_FOTOS.length)

verificar(
  'las preguntas no tienen ids repetidos',
  new Set(SECCIONES.flatMap((s) => s.preguntas.map((p) => p.id))).size ===
    SECCIONES.reduce((n, s) => n + s.preguntas.length, 0),
)

/* ---------- 0b. Armado del recorrido ---------- */
console.log('\n[0b] Armado del recorrido')

/*
 * Los textos van escritos a mano, igual que en el motor de consistencia: si alguien
 * cambia la redacción de una respuesta de "heridos", esto tiene que fallar. Es la
 * pantalla que decide si se llama a una ambulancia.
 */
const sinContestar = construirPasos({})
verificar(
  'sin contestar nada, la primera pantalla es la de heridos',
  sinContestar[0]?.clave === 'p:heridos',
  sinContestar[0]?.clave,
)
verificar(
  'sin contestar nada no aparece la pantalla de emergencia',
  !sinContestar.some((p) => p.tipo === 'emergencia'),
)

const conHeridos = construirPasos({ heridos: 'Sí, hay heridos' })
const iHeridos = conHeridos.findIndex((p) => p.clave === 'p:heridos')
verificar(
  'declarar heridos inserta la pantalla de emergencia justo después',
  conHeridos[iHeridos + 1]?.tipo === 'emergencia',
  conHeridos[iHeridos + 1]?.clave,
)
verificar(
  'con heridos confirmados la variante es la imperativa',
  conHeridos[iHeridos + 1]?.variante === 'confirmado',
  conHeridos[iHeridos + 1]?.variante,
)

const conDuda = construirPasos({ heridos: 'No lo sé' })
verificar(
  'no saber si hay heridos también lleva a la pantalla de emergencia',
  conDuda.some((p) => p.tipo === 'emergencia'),
)
verificar(
  'la duda usa la variante que no da una orden',
  conDuda.find((p) => p.tipo === 'emergencia')?.variante === 'dudoso',
)

verificar(
  'responder que no hay heridos no muestra la pantalla de emergencia',
  !construirPasos({ heridos: 'No, nadie' }).some((p) => p.tipo === 'emergencia'),
)

verificar(
  'quien chocó contra un objeto fijo no ve las fotos del otro vehículo',
  !construirPasos({ tipo_siniestro: 'Colisión con objeto fijo' }).some((p) => p.clave === 'f:patente_tercero'),
)
verificar(
  'quien chocó contra otro vehículo sí las ve',
  construirPasos({ tipo_siniestro: 'Colisión con otro vehículo' }).some((p) => p.clave === 'f:patente_tercero'),
)

verificar('el recorrido termina en la pantalla final', sinContestar[sinContestar.length - 1]?.tipo === 'final')

/* Dónde se retoma. */
verificar(
  'sin nada contestado se retoma en la primera pregunta',
  pasoInicial(sinContestar, {}, []) === 'p:heridos',
)

/*
 * Con todo contestado y todas las fotos obligatorias sacadas, se retoma en la revisión.
 * Las respuestas se completan iterando porque contestar hace aparecer preguntas nuevas.
 */
let respuestasCompletas = {}
for (let vuelta = 0; vuelta < 6; vuelta++) {
  for (const paso of construirPasos(respuestasCompletas)) {
    if (paso.tipo !== 'pregunta') continue
    if (!vacia(respuestasCompletas[paso.pregunta.id])) continue
    const p = paso.pregunta
    respuestasCompletas[p.id] =
      p.tipo === 'numero' ? 1 : p.tipo === 'multiple' ? [p.opciones[0]] : p.opciones ? p.opciones[0] : 'algo'
  }
}
const pasosCompletos = construirPasos(respuestasCompletas)
const mediasCompletas = [
  { id: 'AUD-1', tipo: 'audio', guia_id: null },
  ...pasosCompletos
    .filter((p) => p.tipo === 'foto' && p.guia.obligatoria)
    .map((p, i) => ({ id: 'IMG-' + i, tipo: 'foto', guia_id: p.guia.id })),
]
verificar(
  'con todo contestado y las fotos obligatorias sacadas, se retoma en la revisión',
  pasoInicial(pasosCompletos, respuestasCompletas, mediasCompletas) === 'revision',
  pasoInicial(pasosCompletos, respuestasCompletas, mediasCompletas),
)

/* El relato es audio: se comprueba contra los archivos, no contra las respuestas. */
const preguntaRelato = seccionPorId('relato').preguntas[0]
verificar(
  'el relato no cuenta como respondido sin el audio',
  !respondida(preguntaRelato, { relato: 'texto suelto' }, []),
)
verificar(
  'el relato cuenta como respondido cuando existe el audio',
  respondida(preguntaRelato, {}, [{ id: 'AUD-1', tipo: 'audio', guia_id: null }]),
)

/* Lo que falta, que es lo que la revisión final le ofrece completar a la persona. */
verificar(
  'sin nada contestado, faltan las preguntas requeridas y las fotos obligatorias',
  faltantes(sinContestar, {}, []).length > 0,
)
verificar(
  'con todo completo no falta nada',
  faltantes(pasosCompletos, respuestasCompletas, mediasCompletas).length === 0,
  JSON.stringify(faltantes(pasosCompletos, respuestasCompletas, mediasCompletas)),
)
verificar(
  'cada faltante lleva la clave de la pantalla a la que hay que volver',
  faltantes(sinContestar, {}, []).every((f) => typeof f.clave === 'string' && typeof f.texto === 'string'),
)

/* ---------- 1. Serialización canónica y cadena ---------- */
console.log('\n[1] Serialización canónica y encadenado')

verificar(
  'el orden de las claves no cambia el resultado',
  canonico({ b: 1, a: 2 }) === canonico({ a: 2, b: 1 }),
  `${canonico({ b: 1, a: 2 })} vs ${canonico({ a: 2, b: 1 })}`,
)
verificar('ordena también en objetos anidados', canonico({ x: { z: 1, y: 2 } }) === '{"x":{"y":2,"z":1}}')
verificar('respeta el orden de los arrays', canonico([1, 2]) !== canonico([2, 1]))
verificar('null y undefined se serializan igual', canonico(null) === canonico(undefined))

const base = { caso_id: 'ADS-AAAAAA', ts: '2026-08-19T12:00:00.000Z', tipo: 'apertura', detalle: { a: 1 }, hash_previo: null }
const h1 = hashEvento(base)
verificar('el hash es determinista', h1 === hashEvento({ ...base, detalle: { a: 1 } }))
verificar('cambiar el detalle cambia el hash', h1 !== hashEvento({ ...base, detalle: { a: 2 } }))
verificar('cambiar el eslabón previo cambia el hash', h1 !== hashEvento({ ...base, hash_previo: 'x' }))
verificar('cambiar la hora cambia el hash', h1 !== hashEvento({ ...base, ts: '2026-08-19T12:00:01.000Z' }))
verificar('sha256 tiene 64 caracteres hexadecimales', /^[0-9a-f]{64}$/.test(sha256('hola')))

// Simula una cadena de 4 eslabones y luego altera el segundo.
const eventos = [
  { tipo: 'apertura_actuacion', detalle: { poliza: '123' } },
  { tipo: 'ubicacion_registrada', detalle: { lat: -34.6, lon: -58.4 } },
  { tipo: 'respuestas_registradas', detalle: { velocidad: 40 } },
  { tipo: 'cierre_actuacion', detalle: {} },
]
let previo = null
const cadenaReal = eventos.map((e, i) => {
  const ts = new Date(Date.UTC(2026, 7, 19, 12, i)).toISOString()
  const hash_previo = previo
  const hash = hashEvento({ caso_id: 'ADS-AAAAAA', ts, tipo: e.tipo, detalle: e.detalle, hash_previo })
  previo = hash
  return { ...e, ts, hash, hash_previo }
})

function validarCadena(c) {
  let esperado = null
  for (const e of c) {
    if (e.hash_previo !== esperado) return false
    const recalc = hashEvento({ caso_id: 'ADS-AAAAAA', ts: e.ts, tipo: e.tipo, detalle: e.detalle, hash_previo: e.hash_previo })
    if (recalc !== e.hash) return false
    esperado = e.hash
  }
  return true
}

verificar('una cadena intacta valida', validarCadena(cadenaReal))

const alterada = JSON.parse(JSON.stringify(cadenaReal))
alterada[2].detalle.velocidad = 30 // el clásico: bajar la velocidad declarada
verificar('alterar un eslabón rompe la validación', !validarCadena(alterada))

const truncada = cadenaReal.slice(0, 2).concat(cadenaReal.slice(3))
verificar('suprimir un eslabón rompe la validación', !validarCadena(truncada))

/* ---------- 1b. Guardas de la cadena de custodia ---------- */
console.log('\n[1b] Guardas de la cadena de custodia')

verificar(
  'las actuaciones nuevas nacen con el manifiesto que no lleva el nombre del testigo',
  VERSION_MANIFIESTO === '1.1',
  `=${VERSION_MANIFIESTO}`,
)

/*
 * El cuarto parámetro de registrarEvento era un PoolClient suelto y pasó a ser un objeto
 * de opciones. Pasar el viejo escribía el eslabón por FUERA de la transacción de quien
 * llamaba: si esa transacción hacía ROLLBACK quedaba un eslabón encadenado y sellado
 * apuntando a una fila que no existe. Tiene que fallar acá y no dentro de un expediente.
 */
let rechazoLaFirmaVieja = false
try {
  const clienteFalso = { query: async () => ({ rows: [] }) }
  await registrarEvento('ADS-AAAAAA', 'prueba', {}, clienteFalso)
} catch (err) {
  rechazoLaFirmaVieja = String(err?.message ?? '').includes('cambió de firma')
}
verificar('registrarEvento rechaza la firma vieja con un mensaje que dice qué cambiar', rechazoLaFirmaVieja)

/* ---------- 2. Motor de consistencia ---------- */
console.log('\n[2] Motor de consistencia')

const climaLluvioso = {
  fuente: 'test',
  consultado_en: new Date().toISOString(),
  hora_observada: '2026-08-19T03:00',
  temperatura_c: 14,
  precipitacion_mm: 2.4,
  precipitacion_3h_mm: 6.1,
  humedad_pct: 92,
  viento_kmh: 18,
  rafaga_kmh: 30,
  visibilidad_m: 4000,
  codigo_wmo: 63,
  descripcion: 'Lluvia moderada',
  amanecer: '2026-08-19T07:20',
  atardecer: '2026-08-19T18:40',
  es_de_dia: false,
  zona_horaria: 'America/Argentina/Buenos_Aires',
}

/*
 * Los textos de las respuestas van escritos a mano y NO importados de VALOR, a propósito.
 *
 * Si alguien cambia la redacción de una opción, el motor de consistencia pasa a comparar
 * contra el texto nuevo y estas aserciones —que siguen diciendo el viejo— fallan. Eso es
 * lo que queremos: el motor dejó de reconocer los expedientes ya sellados, que guardan el
 * texto anterior en su JSONB, y hay que enterarse acá y no en el informe del liquidador.
 * Importar VALOR haría que los fixtures acompañen el cambio y la prueba pase en verde
 * mientras la aplicación real deja de detectar la contradicción.
 */
const entradaBase = {
  respuestas: {},
  clima: climaLluvioso,
  direccion: 'Avenida Rivadavia 5000, Caballito, Buenos Aires',
  gpsCapturadoEn: new Date().toISOString(),
  fotos: [],
  fotosObligatorias: fotosObligatorias({ tipo_siniestro: 'Colisión con otro vehículo' }),
  tieneAudio: false,
  testigos: 0,
}

const mentiroso = analizar({
  ...entradaBase,
  respuestas: {
    pavimento: 'Seco',
    clima: 'Despejado',
    luz: 'De día, buena luz',
    calle: 'Avenida Rivadavia',
    velocidad: 40,
    maniobra: 'Detenido por completo',
    licencia_vigente: 'No, estaba vencida',
    alcoholemia: 'Sí, dio positivo',
    momento_declarado: 'Recién, hace menos de 10 minutos',
  },
})

const titulos = mentiroso.hallazgos.map((h) => h.titulo)
verificar('detecta pavimento seco con lluvia', titulos.some((t) => t.includes('Pavimento declarado seco')))
verificar('detecta clima despejado bajo lluvia', titulos.some((t) => t.includes('sin lluvia, pero llovía')))
verificar('detecta luz diurna en horario nocturno', titulos.some((t) => t.includes('luz diurna en horario nocturno')))
verificar('detecta contradicción interna detenido/velocidad', titulos.some((t) => t.includes('detenido pero con velocidad')))
verificar('marca licencia vencida como cobertura', titulos.some((t) => t.includes('Licencia de conducir no vigente')))
verificar('marca alcoholemia positiva como cobertura', titulos.some((t) => t.includes('alcoholemia positivo')))
verificar('acumula al menos 4 contradicciones', mentiroso.resumen.alertas >= 4, `alertas=${mentiroso.resumen.alertas}`)
verificar('acumula 2 banderas de cobertura', mentiroso.resumen.banderas_cobertura === 2, `=${mentiroso.resumen.banderas_cobertura}`)
verificar('reconoce ubicación consistente', titulos.some((t) => t === 'Ubicación consistente'))

const coherente = analizar({
  ...entradaBase,
  tieneAudio: true,
  testigos: 2,
  fotos: entradaBase.fotosObligatorias.map((g) => ({ guia_id: g })),
  respuestas: {
    pavimento: 'Mojado',
    clima: 'Lluvia fuerte',
    luz: 'De noche con iluminación',
    calle: 'Rivadavia',
    velocidad: 40,
    maniobra: 'Circulando derecho',
    licencia_vigente: 'Sí, vigente',
    alcoholemia: 'Sí, dio negativo',
    momento_declarado: 'Recién, hace menos de 10 minutos',
  },
})
verificar('una declaración coherente no genera contradicciones', coherente.resumen.alertas === 0, `alertas=${coherente.resumen.alertas}`)
verificar('una declaración coherente no levanta banderas', coherente.resumen.banderas_cobertura === 0)
verificar('una declaración completa no reclama faltantes', !coherente.hallazgos.some((h) => h.titulo.includes('Faltan')))
verificar('registra controles consistentes', coherente.resumen.controles_ok >= 4, `ok=${coherente.resumen.controles_ok}`)

// Regresión: declarar "Despejado" con cielo nublado no es una contradicción, pero
// tampoco se puede informar que "coincide". Antes decía que coincidía.
const nublado = {
  ...climaLluvioso,
  precipitacion_mm: 0,
  precipitacion_3h_mm: 0,
  codigo_wmo: 3,
  descripcion: 'Nublado',
  es_de_dia: true,
}
const nubosidad = analizar({ ...entradaBase, clima: nublado, respuestas: { clima: 'Despejado' } })
const hallazgoClima = nubosidad.hallazgos.find((x) => x.declarado === 'Despejado')
verificar(
  'no afirma que coinciden cuando el clima declarado difiere del real',
  hallazgoClima?.titulo === 'Sin contradicción climática relevante',
  `-> "${hallazgoClima?.titulo}"`,
)
verificar('la diferencia de nubosidad no cuenta como contradicción', nubosidad.resumen.alertas === 0)

const climaExacto = analizar({ ...entradaBase, clima: nublado, respuestas: { clima: 'Nublado' } })
verificar(
  'cuando el clima declarado coincide de verdad, lo informa como consistente',
  climaExacto.hallazgos.some((x) => x.titulo === 'Condición climática consistente'),
)

const viejo = analizar({ ...entradaBase, respuestas: { momento_declarado: 'Ayer o antes' } })
verificar(
  'avisa que la evidencia no corresponde al momento del hecho',
  viejo.hallazgos.some((h) => h.titulo.includes('no corresponde al momento del hecho')),
)

verificar('la comparación de calles tolera acentos y prefijos', calleCoincide('Av. Rivadavia', 'Avenida Rivadavia 5000, Caballito'))
verificar('la comparación de calles detecta una calle distinta', !calleCoincide('Corrientes', 'Avenida Rivadavia 5000, Caballito'))
verificar('la comparación de calles no falla con texto vacío', calleCoincide('', 'Avenida Rivadavia 5000'))

/* ---------- 3. Generación del PDF ---------- */
console.log('\n[3] Generación del expediente en PDF')

const manifiesto = {
  version: '1.0',
  caso_id: 'ADS-PRUEBA',
  generado_en: new Date().toISOString(),
  cadena: cadenaReal.map((e, i) => ({ n: i + 1, ts: e.ts, tipo: e.tipo, hash_previo: e.hash_previo, hash: e.hash, detalle: e.detalle })),
  piezas: [{ tipo: 'testigo', id: 'TST-XXXXXX', descripcion: 'Declaración de María González', sha256: sha256('t') }],
  hash_maestro: sha256('maestro'),
}

const pdf = await generarExpediente({
  caso: {
    id: 'ADS-PRUEBA',
    creado_en: new Date().toISOString(),
    cerrado_en: new Date().toISOString(),
    poliza: 'POL-99887',
    patente: 'AB 123 CD',
    asegurado: 'Juan Pérez',
    telefono: '11 5555 5555',
    respuestas: {
      heridos: 'No, nadie',
      tipo_siniestro: 'Colisión con otro vehículo',
      quien_conducia: 'Yo, el titular de la póliza',
      momento_declarado: 'Recién, hace menos de 10 minutos',
      calle: 'Avenida Rivadavia',
      maniobra: 'Circulando derecho',
      velocidad: 40,
      freno: 'Sí, frené a fondo',
      zona_propia: 'Frente der.',
      semaforo: 'Verde',
      senalizacion: ['Semáforo', 'Senda peatonal'],
      pavimento: 'Seco',
      clima: 'Despejado',
      luz: 'De día, buena luz',
      acompanantes: 1,
      licencia_vigente: 'Sí, vigente',
      circula: 'Sí, pero con riesgo',
      tercero_datos: { nombre: 'Ana López', dni: '30111222', telefono: '11 4444 4444' },
      tercero_patente: 'XY 987 ZW',
      policia: 'Sí',
      policia_acta: 'Acta 4821/2026',
    },
    gps: { lat: -34.6187, lon: -58.4419, precision_m: 12, capturado_en: new Date().toISOString() },
    direccion: 'Avenida Rivadavia 5000, Caballito, Buenos Aires, Argentina',
  },
  croquis: PLANTILLAS[0].croquis,
  clima: climaLluvioso,
  consistencia: mentiroso,
  manifiesto,
  sello: {
    hash_maestro: manifiesto.hash_maestro,
    sellado_en: new Date().toISOString(),
    firma: {
      algoritmo: 'ECDSA-P256-SHA256',
      valor: 'MEUCIQD' + 'x'.repeat(60),
      clave_publica_sha256: sha256('pub'),
      tipo: 'firma_electronica_demo',
      advertencia:
        'Firma electrónica de demostración (art. 5, Ley 25.506). No equivale a firma digital: para las presunciones de los arts. 7 y 8 se requiere certificado de certificador licenciado.',
    },
    tsa: {
      solicitada: true,
      obtenida: false,
      autoridad: 'https://freetsa.org/tsr',
      token_sha256: null,
      token_b64: null,
      error: 'Sin conexión durante la prueba',
    },
  },
  medias: [],
  testigos: [
    {
      id: 'TST-XXXXXX',
      nombre: 'María González',
      dni: '28999111',
      telefono: '11 3333 3333',
      relato: 'El auto blanco cruzó con el semáforo en rojo y frenó recién sobre la senda peatonal.',
      creado_en: new Date().toISOString(),
      sha256: sha256('t'),
    },
  ],
})

verificar('el PDF se genera', pdf.length > 5000, `bytes=${pdf.length}`)
verificar('empieza con la cabecera %PDF', Buffer.from(pdf.slice(0, 5)).toString() === '%PDF-')

mkdirSync('data', { recursive: true })
writeFileSync('data/expediente-de-prueba.pdf', pdf)
console.log(`       -> data/expediente-de-prueba.pdf (${Math.round(pdf.length / 1024)} KB)`)

/* ---------- 4. Identidad ---------- */
console.log('\n[4] Identidad')

{
  const hash = await hashearClave('una clave larga 123')
  verificar('el hash guarda sus parámetros', hash.startsWith('scrypt$32768$8$1$'), hash.slice(0, 30))
  verificar('la clave correcta verifica', await verificarClave('una clave larga 123', hash))
  verificar('una clave distinta no verifica', !(await verificarClave('otra clave larga', hash)))

  const otro = await hashearClave('una clave larga 123')
  verificar('la misma clave da hashes distintos, porque la sal es por usuario', hash !== otro)
  verificar('y las dos verifican igual', await verificarClave('una clave larga 123', otro))

  verificar('un hash corrupto no verifica y no explota', !(await verificarClave('lo que sea', 'basura')))
  verificar('un hash vacío no verifica y no explota', !(await verificarClave('lo que sea', '')))

  /*
   * Verificar contra una clave que no existe tiene que costar lo mismo que contra una
   * real: si el DNI inexistente respondiera al instante, el tiempo de respuesta diría qué
   * DNI está registrado, y el DNI es un dato público.
   */
  verificar(
    'la clave inexistente tiene la misma forma que un hash real',
    CLAVE_INEXISTENTE.startsWith('scrypt$32768$8$1$') && !(await verificarClave('cualquiera', CLAVE_INEXISTENTE)),
  )
}

verificar('el DNI se normaliza sacando puntos', normalizarDni('20.123.456') === '20123456')
verificar('un DNI demasiado corto se rechaza', normalizarDni('123') === null)
verificar('un DNI que no es texto se rechaza', normalizarDni(20123456) === null)

verificar('una clave corta se rechaza', validarClave('corta', '20123456') !== null)
verificar('una clave de sólo números se rechaza', validarClave('123456789', '20123456') !== null)
verificar('una clave que contiene el DNI se rechaza', validarClave('clave20123456', '20123456') !== null)
verificar('una clave razonable se acepta', validarClave('una clave larga 123', '20123456') === null)

{
  const a = nuevoToken()
  const b = nuevoToken()
  verificar('los tokens son largos y distintos', a.length >= 43 && a !== b, a.length + ' caracteres')
  verificar('el hash del token es determinista', hashToken(a) === hashToken(a))
  verificar('dos tokens distintos dan hashes distintos', hashToken(a) !== hashToken(b))
}

/* ---------- 6. Lectura automática ---------- */
console.log('\n[6] Lectura automática')

/*
 * Arranca APAGADA. El proveedor de demostración devuelve nombres y DNI con formato
 * argentino correcto que NO salen de la foto: encendido por omisión, un despliegue que
 * simplemente no define la variable fabricaría prueba de identidad sobre una persona que
 * ni siquiera es usuaria del sistema.
 */
verificar('la lectura automática está apagada por defecto', extraccionActiva() === false)

{
  const antes = process.env.EXTRACCION_SIMULADA
  process.env.EXTRACCION_SIMULADA = 'true'
  verificar('se enciende sólo pidiéndola por su nombre', extraccionActiva() === true)
  process.env.EXTRACCION_DESACTIVADA = 'true'
  verificar('y el interruptor de apagado gana siempre', extraccionActiva() === false)
  delete process.env.EXTRACCION_DESACTIVADA
  if (antes === undefined) delete process.env.EXTRACCION_SIMULADA
  else process.env.EXTRACCION_SIMULADA = antes
}

{
  const bytes = new TextEncoder().encode('una foto cualquiera')
  const a = await PROVEEDOR_SIMULADO.leer(bytes, 'image/jpeg', 'licencia')
  const b = await PROVEEDOR_SIMULADO.leer(bytes, 'image/jpeg', 'licencia')
  verificar('el proveedor simulado es reproducible', JSON.stringify(a) === JSON.stringify(b))
  verificar('se declara simulado', a.simulado === true)

  const otros = await PROVEEDOR_SIMULADO.leer(new TextEncoder().encode('otra foto'), 'image/jpeg', 'licencia')
  verificar('dos fotos distintas dan lecturas distintas', JSON.stringify(a) !== JSON.stringify(otros))

  /*
   * Con el proveedor simulado TODOS los campos llegan a revisar, sin mirar la confianza:
   * la confianza también es inventada, y un campo verificado llega precargado. Un toque
   * en confirmar lo sellaría como declaración del asegurado sobre la identidad de otro.
   */
  const vista = vistaParaAsegurado(a)
  verificar('con el simulado ningún campo llega verificado', vista.every((c) => c.estado === 'revisar'))
  verificar('la vista no lleva la confianza', vista.every((c) => !('confianza' in c)))

  const real = vistaParaAsegurado({ ...a, simulado: false, campos: a.campos.map((c) => ({ ...c, confianza: 0.99 })) })
  verificar('con un proveedor real y confianza alta, sí llega verificado', real.every((c) => c.estado === 'verificado'))

  const dudoso = vistaParaAsegurado({ ...a, simulado: false, campos: a.campos.map((c) => ({ ...c, confianza: 0.2 })) })
  verificar('y con confianza baja, a revisar', dudoso.every((c) => c.estado === 'revisar'))
}

verificar(
  'cada campo mapea a una pregunta que existe',
  Object.values(MAPEO).every((m) => SECCIONES.some((s) => s.preguntas.some((p) => p.id === m.pregunta))),
)

/* ---------- 7. Croquis y relato ---------- */
console.log('\n[7] Croquis y relato')

verificar('hay ocho situaciones típicas', PLANTILLAS.length === 8, String(PLANTILLAS.length))
verificar('cada plantilla es un croquis completo', PLANTILLAS.every((p) => limpiarCroquis(p.croquis) !== null))
verificar(
  'todas las posiciones caen dentro del lienzo',
  PLANTILLAS.every((p) => p.croquis.vehiculos.every((v) => v.x >= 0 && v.x <= 100 && v.y >= 0 && v.y <= 100)),
)

{
  const figuras = figurasDelCroquis(PLANTILLAS[0].croquis)
  verificar('el croquis produce trazos dibujables', figuras.length > 0 && figuras.every((f) => f.d.startsWith('M ')))
  verificar('incluye el punto de impacto', figuras.some((f) => f.tipo === 'impacto'))
  verificar('incluye los dos vehículos', figuras.filter((f) => f.tipo === 'vehiculo').length === 2)
  verificar(
    'el mismo croquis produce siempre los mismos trazos',
    JSON.stringify(figuras) === JSON.stringify(figurasDelCroquis(PLANTILLAS[0].croquis)),
  )
}

verificar('un croquis sin cruce válido se rechaza entero', limpiarCroquis({ vehiculos: [] }) === null)
verificar(
  'un vehículo fuera del plano invalida el croquis, no se recorta',
  limpiarCroquis({ ...PLANTILLAS[0].croquis, vehiculos: [{ rol: 'propio', x: 500, y: 10, rumbo: 0 }] }) === null,
)
verificar(
  'el rumbo se normaliza a un giro',
  limpiarCroquis({ ...PLANTILLAS[0].croquis, vehiculos: [{ rol: 'propio', x: 10, y: 10, rumbo: 450 }] })
    ?.vehiculos[0].rumbo === 90,
)

/* ---------- 8. El acta que se firma ---------- */
console.log('\n[8] El acta que se firma')

{
  const casoBase = {
    id: 'ADS-ACTA00',
    creado_en: '2026-08-19T12:00:00.000Z',
    cerrado_en: null,
    estado: 'abierto',
    poliza: 'POL-1',
    patente: 'AB123CD',
    asegurado: 'Juan Pérez',
    telefono: '11 5555 5555',
    respuestas: { heridos: 'No, nadie', velocidad: 40 },
    gps: { lat: -34.6, lon: -58.4, precision_m: 10, capturado_en: '2026-08-19T12:00:00.000Z' },
    direccion: 'Avenida Rivadavia 5000',
    clima: null,
    consistencia: null,
    hash_maestro: null,
    sello: null,
    manifiesto_version: '1.1',
    usuario_id: null,
    productor_id: null,
    croquis: null,
  }
  const media = (id) => ({
    id,
    caso_id: casoBase.id,
    tipo: 'foto',
    guia_id: 'dano_propio',
    archivo: 'x',
    mime: 'image/jpeg',
    bytes: 10,
    sha256: sha256(id),
    gps: null,
    capturado_en: '2026-08-19T12:01:00.000Z',
    firmante: null,
    hash_firmado: null,
  })
  const medias = [media('IMG-2'), media('IMG-1')]

  const a = construirActa(casoBase, medias, [])
  verificar('el acta es determinista', a.hash === construirActa(casoBase, medias, []).hash)
  verificar(
    'el orden en que llegan las piezas no cambia el acta',
    a.hash === construirActa(casoBase, [...medias].reverse(), []).hash,
  )
  verificar('cambiar una respuesta cambia el acta', a.hash !== construirActa({ ...casoBase, respuestas: { ...casoBase.respuestas, velocidad: 60 } }, medias, []).hash)
  verificar('cambiar la carátula cambia el acta', a.hash !== construirActa({ ...casoBase, patente: 'ZZ999ZZ' }, medias, []).hash)
  verificar('agregar una pieza cambia el acta', a.hash !== construirActa(casoBase, [...medias, media('IMG-3')], []).hash)

  /*
   * El croquis vive en una columna propia: no está en respuestas ni en las piezas. Sin
   * esto, entre la firma y el cierre se podía cambiar entero sin que la firma lo detectara,
   * y el croquis es la reconstrucción de cómo ocurrió el hecho.
   */
  const conCroquis = construirActa({ ...casoBase, croquis: PLANTILLAS[0].croquis }, medias, [])
  verificar('el croquis entra en lo que se firma', a.hash !== conCroquis.hash)
  verificar(
    'y cambiar el croquis cambia el acta',
    conCroquis.hash !== construirActa({ ...casoBase, croquis: PLANTILLAS[1].croquis }, medias, []).hash,
  )

  /*
   * La firma NO entra en el acta que ella misma firma: si entrara, firmar cambiaría el
   * hash de lo firmado y ninguna firma podría verificar nunca.
   */
  const conFirma = [...medias, { ...media('FIR-1'), tipo: 'firma' }]
  verificar('la propia firma queda fuera del acta', a.hash === construirActa(casoBase, conFirma, []).hash)

  verificar('la declaración lleva versión', DECLARACION.version.startsWith('acta-asegurado-'))
  verificar('la declaración dice que es firma electrónica y no digital', DECLARACION.texto.includes('art. 5'))
  verificar('y aclara que no tiene las presunciones de los arts. 7 y 8', DECLARACION.texto.includes('arts. 7 y 8'))
}

/* ---------- 10. Impacto y notificaciones ---------- */
console.log('\n[10] Impacto y notificaciones')

/*
 * El cifrado de Web Push contra el VECTOR DE PRUEBA del RFC 8291 §5.
 *
 * Esta prueba es la razón por la que el cifrado se escribe a mano en vez de traer una
 * biblioteca: el RFC publica un caso completo, así que se puede DEMOSTRAR que está bien.
 * Si alguna vez falla, no se toca lib/cifrado.ts hasta entender por qué.
 */
{
  const b = (x) => Buffer.from(x, 'base64url')
  const uaPriv = b('q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94')
  const uaPub = b('BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4')
  const auth = b('BTBZMqHH6r4Tts7J_aSIgg')
  const asPriv = b('yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw')
  const sal = b('DGv6ra1nlYgDCS1FRnbzlw')
  const esperado = 'When I grow up, I want to be a watermelon'
  const CIFRADO_DEL_RFC = '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ'

  const cuerpo = cifrarCarga(
    { endpoint: '', p256dh: uaPub.toString('base64url'), auth: auth.toString('base64url') },
    esperado,
    sal,
    asPriv,
  )
  verificar('el cifrado produce el texto del vector del RFC 8291', cuerpo.subarray(86).toString('base64url') === CIFRADO_DEL_RFC)

  // Y descifrarlo desde el lado del navegador da el texto original.
  const ecdh = createECDH('prime256v1')
  ecdh.setPrivateKey(uaPriv)
  const compartido = ecdh.computeSecret(cuerpo.subarray(21, 86))
  const { cek, nonce } = derivarClaves(compartido, auth, uaPub, cuerpo.subarray(21, 86), cuerpo.subarray(0, 16))
  const cif = cuerpo.subarray(86)
  const d = createDecipheriv('aes-128-gcm', cek, nonce)
  d.setAuthTag(cif.subarray(cif.length - 16))
  const claro = Buffer.concat([d.update(cif.subarray(0, cif.length - 16)), d.final()])
  verificar('el navegador puede descifrarlo', claro.subarray(0, claro.length - 1).toString('utf8') === esperado)
  verificar('dos cifrados de lo mismo son distintos, porque la sal es al azar',
    cifrarCarga({ endpoint: '', p256dh: uaPub.toString('base64url'), auth: auth.toString('base64url') }, esperado).toString('base64url') !==
    cifrarCarga({ endpoint: '', p256dh: uaPub.toString('base64url'), auth: auth.toString('base64url') }, esperado).toString('base64url'))
}

/* El detector de impacto, contra series sintéticas. */
{
  const serie = (fn, n = 40) => Array.from({ length: n }, (_, i) => fn(i))
  const quieto = serie((i) => ({ t: i * 20, ax: 0.2, ay: 0.1, az: 0.1, gTotal: 1, kmh: 50 }))
  verificar('circular tranquilo no dispara nada', analizarImpacto(quieto).nivel === 'nada')

  // Un choque: pico alto, sostenido, y la velocidad se cae.
  const choque = serie((i) => {
    const enPico = i >= 20 && i <= 24
    const g = enPico ? 12 : i > 24 ? 3 : 0.3
    return { t: i * 20, ax: g * 9.80665, ay: 0, az: 0, gTotal: 1 + g, kmh: i < 20 ? 55 : 2, giro: enPico ? 260 : 5 }
  })
  const v = analizarImpacto(choque)
  verificar('un choque se detecta', v.nivel === 'confirmado', v.motivo)
  verificar('con la caída de velocidad entre las señales', v.señales.caidaDeVelocidad)
  verificar('y NUNCA propone llamar solo a emergencias', v.llamar_emergencias === false)

  // Un pozo: un pico aislado y la velocidad sigue igual.
  const pozo = serie((i) => ({
    t: i * 20,
    ax: i === 20 ? 6 * 9.80665 : 0.2,
    ay: 0, az: 0, gTotal: i === 20 ? 7 : 1, kmh: 50,
  }))
  verificar('un pozo NO se confunde con un choque', analizarImpacto(pozo).nivel === 'nada', analizarImpacto(pozo).motivo)

  // El teléfono que se cae al piso: caída libre antes del golpe.
  const caida = serie((i) => ({
    t: i * 20,
    ax: i >= 20 && i <= 23 ? 20 * 9.80665 : 0.1,
    ay: 0, az: 0,
    gTotal: i >= 16 && i < 20 ? 0.05 : i >= 20 && i <= 23 ? 21 : 1,
    kmh: 0,
  }))
  const vc = analizarImpacto(caida)
  verificar('el teléfono que se cae NO se confunde con un choque', vc.nivel === 'nada', vc.motivo)
  verificar('y el motivo lo dice', vc.descartes.some((d) => d.includes('caída libre')))

  verificar('sin respuesta se escala, pero sin llamar solo', planEscalamiento(v, false).ofrecerEmergencias === true)
  verificar('si la persona contesta, no se escala nada', planEscalamiento(v, true).ofrecerEmergencias === false)
  verificar('los umbrales tienen valores de referencia razonables', UMBRALES.sospechaG >= 3 && UMBRALES.confirmadoG >= UMBRALES.sospechaG)
}

/* ---------- Resultado ---------- */
console.log(`\n${pruebas - fallos}/${pruebas} verificaciones pasaron`)
if (fallos > 0) {
  console.error(`${fallos} FALLARON`)
  process.exit(1)
}
console.log('Todo en orden.')
