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
import { canonico, sha256, hashEvento } from '../lib/hash.ts'
import { analizar } from '../lib/consistencia.ts'
import { calleCoincide } from '../lib/geo.ts'
import { generarExpediente } from '../lib/pdf.ts'
import { GUIA_FOTOS } from '../lib/cuestionario.ts'

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

const entradaBase = {
  respuestas: {},
  clima: climaLluvioso,
  direccion: 'Avenida Rivadavia 5000, Caballito, Buenos Aires',
  gpsCapturadoEn: new Date().toISOString(),
  fotos: [],
  fotosObligatorias: GUIA_FOTOS.filter((g) => g.obligatoria).map((g) => g.id),
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

/* ---------- Resultado ---------- */
console.log(`\n${pruebas - fallos}/${pruebas} verificaciones pasaron`)
if (fallos > 0) {
  console.error(`${fallos} FALLARON`)
  process.exit(1)
}
console.log('Todo en orden.')
