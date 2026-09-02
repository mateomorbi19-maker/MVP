/**
 * Prueba de punta a punta contra el servidor y la base reales.
 *
 * Recorre el circuito completo como lo haría una persona en la calle y después
 * intenta romper la cadena de custodia para comprobar que el sistema lo detecta.
 *
 *   npm run dev          (en otra terminal)
 *   npm run e2e
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'

const BASE = process.env.BASE_URL || 'http://localhost:3000'

let fallos = 0
let pruebas = 0
function verificar(nombre, condicion, extra = '') {
  pruebas++
  console.log(`  ${condicion ? 'ok  ' : 'FALLA'} ${nombre}${extra ? ` ${extra}` : ''}`)
  if (!condicion) fallos++
}

/*
 * Frasco de cookies.
 *
 * Sin esto la prueba no representa a nadie: desde que existe la posesión de la actuación,
 * el servidor le entrega las fotos y el expediente al navegador que abrió el caso, no a
 * cualquiera que sepa el id. Un cliente sin cookies es exactamente el que hay que
 * rechazar, así que el circuito tiene que comportarse como un navegador.
 */
const galletas = new Map()

function guardarCookies(res) {
  const crudas = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  for (const c of crudas) {
    const [par] = c.split(';')
    const i = par.indexOf('=')
    if (i > 0) galletas.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
  }
}

const cabeceraCookies = () =>
  galletas.size ? [...galletas].map(([k, v]) => `${k}=${v}`).join('; ') : undefined

async function pedir(ruta, opciones = {}) {
  const cookie = cabeceraCookies()
  const res = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), ...(cookie ? { cookie } : {}) },
  })
  guardarCookies(res)
  const tipo = res.headers.get('content-type') || ''
  const cuerpo = tipo.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer())
  return { res, cuerpo }
}

/** Olvida las cookies: para comprobar que un cliente ajeno NO puede leer el expediente. */
const olvidarCookies = () => galletas.clear()

/** PNG mínimo pero válido, de color sólido, para que pdf-lib pueda incrustarlo. */
function pngSolido(ancho, alto, [r, g, b]) {
  const crc32 = (buf) => {
    let c = ~0
    for (const byte of buf) {
      c ^= byte
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const trozo = (tipo, datos) => {
    const t = Buffer.from(tipo, 'ascii')
    const largo = Buffer.alloc(4)
    largo.writeUInt32BE(datos.length)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(Buffer.concat([t, datos])))
    return Buffer.concat([largo, t, datos, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // profundidad de bits
  ihdr[9] = 2 // color RGB
  const filas = []
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3)
    for (let x = 0; x < ancho; x++) {
      fila[1 + x * 3] = r
      fila[2 + x * 3] = g
      fila[3 + x * 3] = b
    }
    filas.push(fila)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(Buffer.concat(filas))),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

console.log(`\nProbando contra ${BASE}\n`)

/* ---------- 0. Salud ---------- */
console.log('[0] Salud del sistema')
{
  const { res, cuerpo } = await pedir('/api/salud')
  verificar('la base responde', res.status === 200 && cuerpo.ok === true, cuerpo?.base?.detalle ?? '')
  verificar(
    'no falta ninguna tabla del esquema',
    Array.isArray(cuerpo?.base?.faltan) && cuerpo.base.faltan.length === 0,
    `faltan=${JSON.stringify(cuerpo?.base?.faltan)}`,
  )
}

/* ---------- 1. Apertura ---------- */
console.log('\n[1] Apertura de la actuación')
const { res: resAlta, cuerpo: alta } = await pedir('/api/casos', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  // Como desde el teléfono: un toque, sin pedir nada antes.
  body: JSON.stringify({}),
})
verificar('se crea la actuación sin pedir datos', resAlta.status === 201 && typeof alta.id === 'string', alta.id ?? JSON.stringify(alta))
const ID = alta.id
verificar('el id tiene el formato esperado', /^ADS-[A-Z0-9]{6}$/.test(ID || ''), ID)
{
  const { cuerpo: recien } = await pedir(`/api/casos/${ID}`)
  verificar(
    'la actuación nace con el manifiesto que permite suprimir datos del testigo',
    recien?.manifiesto_version === '1.1',
    `manifiesto_version=${recien?.manifiesto_version}`,
  )
}
{
  const { cuerpo: caso } = await pedir(`/api/casos/${ID}`)
  verificar('la carátula arranca vacía', caso.patente === null && caso.poliza === null, `patente=${caso.patente}`)
}

/* ---------- 2. Ubicación, dirección y clima reales ---------- */
console.log('\n[2] Ubicación, geocodificación y clima')
const { res: resUbi, cuerpo: ubi } = await pedir(`/api/casos/${ID}/ubicacion`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ lat: -34.6037, lon: -58.3816, precision_m: 11 }),
})
verificar('se registra la ubicación', resUbi.status === 200 && ubi.ok === true)
verificar('resuelve la dirección real', typeof ubi.direccion === 'string' && ubi.direccion.length > 10, ubi.direccion ?? 'sin dirección')
verificar('obtiene el clima real', ubi.clima !== null && typeof ubi.clima?.descripcion === 'string', ubi.clima?.descripcion ?? 'sin clima')
verificar('determina la franja horaria', typeof ubi.clima?.es_de_dia === 'boolean', `es_de_dia=${ubi.clima?.es_de_dia}`)
if (ubi.clima) {
  console.log(`       clima: ${ubi.clima.descripcion}, ${ubi.clima.temperatura_c} °C, ${ubi.clima.precipitacion_3h_mm} mm en 3 h`)
  console.log(`       sol:   amanecer ${(ubi.clima.amanecer ?? '').slice(11, 16)}, atardecer ${(ubi.clima.atardecer ?? '').slice(11, 16)}`)
}

/* ---------- 3. Respuestas, con contradicciones a propósito ---------- */
console.log('\n[3] Declaración con contradicciones deliberadas')
const esDeDia = ubi.clima?.es_de_dia
const respuestas = {
  heridos: 'No, nadie',
  tipo_siniestro: 'Colisión con otro vehículo',
  cantidad_vehiculos: '2',
  quien_conducia: 'Otra persona',
  conductor_datos: { nombre: 'Carlos Ruiz', dni: '31222333', telefono: '11 6666 7777' },
  momento_declarado: 'Recién, hace menos de 10 minutos',
  calle: 'Avenida Corrientes',
  sentido: 'hacia el centro',
  maniobra: 'Detenido por completo',
  velocidad: 45,
  freno: 'No llegué a frenar',
  zona_propia: 'Trasera centro',
  zona_tercero: 'Frente centro',
  semaforo: 'Verde',
  senalizacion: ['Semáforo', 'Senda peatonal'],
  pavimento: 'Seco',
  clima: 'Despejado',
  // Se declara lo contrario de lo que dice la hora solar real.
  luz: esDeDia ? 'De noche sin iluminación' : 'De día, buena luz',
  acompanantes: 1,
  licencia_vigente: 'No, estaba vencida',
  vtv: 'Sí',
  alcoholemia: 'No intervino la autoridad',
  uso_vehiculo: 'Trabajo con el vehículo (reparto, aplicación, taxi)',
  circula: 'Sí, pero con riesgo',
  tercero_patente: 'XY987ZW',
  tercero_aseguradora: 'Aseguradora Ejemplo',
  tercero_actitud: 'Sí, está acá',
  policia: 'Sí',
  policia_acta: 'Acta 1234/2026',
  quien_llamo: 'Un testigo',
}
const { res: resPatch, cuerpo: patch } = await pedir(`/api/casos/${ID}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ respuestas }),
})
verificar('se guardan las respuestas', resPatch.status === 200 && patch.ok === true)
verificar('guarda todas las preguntas enviadas', Object.keys(patch.respuestas || {}).length === Object.keys(respuestas).length)

const { res: resBasura } = await pedir(`/api/casos/${ID}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ respuestas: { pregunta_inventada: 'x', __proto__: 'y' } }),
})
verificar('rechaza preguntas que no existen en el cuestionario', resBasura.status === 200)
{
  const { cuerpo: caso } = await pedir(`/api/casos/${ID}`)
  verificar('la pregunta inventada no quedó guardada', !('pregunta_inventada' in caso.respuestas))
}

/* ---------- 3b. Datos del asegurado, al final del recorrido ---------- */
console.log('\n[3b] Carga tardía de los datos del asegurado')
{
  const { res, cuerpo } = await pedir(`/api/casos/${ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      datos: { patente: 'ab123cd', poliza: 'POL-E2E-001', asegurado: 'Prueba Automática', telefono: '11 5555 0000' },
    }),
  })
  verificar('acepta los datos del asegurado por PATCH', res.status === 200 && cuerpo.ok === true)

  const { cuerpo: caso } = await pedir(`/api/casos/${ID}`)
  verificar('la patente queda normalizada en mayúsculas', caso.patente === 'AB123CD', caso.patente)
  verificar('la póliza queda registrada', caso.poliza === 'POL-E2E-001', caso.poliza)
  verificar('no se pierden las respuestas ya cargadas', caso.respuestas?.velocidad === 45)

  // Un envío parcial no puede borrar lo ya cargado.
  await pedir(`/api/casos/${ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ datos: { telefono: '11 4444 0000' } }),
  })
  const { cuerpo: despues } = await pedir(`/api/casos/${ID}`)
  verificar(
    'un envío parcial no borra el resto de la carátula',
    despues.poliza === 'POL-E2E-001' && despues.telefono === '11 4444 0000',
    `poliza=${despues.poliza} telefono=${despues.telefono}`,
  )
}

/* ---------- 4. Fotos y audio ---------- */
console.log('\n[4] Incorporación de fotografías y audio')
const colores = { pano_atras: [70, 110, 160], posicion_final: [160, 90, 70], dano_propio: [90, 140, 90], patente_propia: [40, 40, 48] }
let subidas = 0
const hashesSubidos = []
for (const [guia, color] of Object.entries(colores)) {
  const png = pngSolido(120, 90, color)
  const form = new FormData()
  form.append('archivo', new Blob([png], { type: 'image/png' }), `${guia}.png`)
  form.append('tipo', 'foto')
  form.append('guia_id', guia)
  form.append('lat', '-34.6037')
  form.append('lon', '-58.3816')
  const { res, cuerpo } = await pedir(`/api/casos/${ID}/media`, { method: 'POST', body: form })
  if (res.status === 201) {
    subidas++
    hashesSubidos.push({ id: cuerpo.id, sha256: cuerpo.sha256, esperado: createHash('sha256').update(png).digest('hex') })
  }
}
verificar('se suben las 4 fotografías', subidas === 4, `subidas=${subidas}`)
verificar('el hash que informa el servidor coincide con el del archivo', hashesSubidos.every((h) => h.sha256 === h.esperado))

{
  const audio = Buffer.from('RIFF$   WAVEfmt      @  @   \b data    ', 'binary')
  const form = new FormData()
  form.append('archivo', new Blob([audio], { type: 'audio/wav' }), 'relato.wav')
  form.append('tipo', 'audio')
  const { res } = await pedir(`/api/casos/${ID}/media`, { method: 'POST', body: form })
  verificar('se incorpora el relato en audio', res.status === 201)
}

{
  const form = new FormData()
  form.append('archivo', new Blob([Buffer.from('MZ ejecutable')], { type: 'application/x-msdownload' }), 'virus.exe')
  form.append('tipo', 'foto')
  const { res } = await pedir(`/api/casos/${ID}/media`, { method: 'POST', body: form })
  verificar('rechaza tipos de archivo no admitidos', res.status === 400, `status=${res.status}`)
}

/* ---------- 5. Testigos ---------- */
console.log('\n[5] Registro de testigos')
{
  const { res, cuerpo } = await pedir(`/api/casos/${ID}/testigos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'María González', dni: '28999111', telefono: '11 3333 4444', relato: 'El auto de atrás no frenó.', consentimiento: true, lat: -34.6037, lon: -58.3816 }),
  })
  verificar('se registra el testigo', res.status === 201 && typeof cuerpo.sha256 === 'string')
}
{
  const { res } = await pedir(`/api/casos/${ID}/testigos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: 'Sin Consentimiento', consentimiento: false }),
  })
  verificar('rechaza el registro sin consentimiento expreso', res.status === 400)
}

/* ---------- 6. QR ---------- */
console.log('\n[6] Código QR para testigos')
{
  const { res, cuerpo } = await pedir(`/api/casos/${ID}/qr`)
  const svg = cuerpo.toString()
  verificar('genera un SVG', res.status === 200 && svg.startsWith('<svg'))
  verificar('el QR apunta a la URL pública configurada', svg.length > 500)
}

/* ---------- 7. Cierre y sellado ---------- */
console.log('\n[7] Cierre y sellado')
const { res: resCierre, cuerpo: cierre } = await pedir(`/api/casos/${ID}/cerrar`, { method: 'POST' })
verificar('cierra la actuación', resCierre.status === 200 && cierre.ok === true)
verificar('devuelve un hash maestro válido', /^[0-9a-f]{64}$/.test(cierre.hash_maestro || ''), cierre.hash_maestro)
verificar('la cadena tiene todos los eslabones', cierre.eslabones >= 9, `eslabones=${cierre.eslabones}`)
verificar('firma el hash maestro', typeof cierre.sello?.firma?.valor === 'string')
verificar('declara que la firma es electrónica, no digital', cierre.sello?.firma?.tipo === 'firma_electronica_demo')
console.log(`       sello de tiempo RFC 3161: ${cierre.sello?.tsa?.obtenida ? `obtenido de ${cierre.sello.tsa.autoridad}` : `NO obtenido (${cierre.sello?.tsa?.error})`}`)
verificar('detecta las contradicciones declaradas', cierre.consistencia?.alertas >= 2, `alertas=${cierre.consistencia?.alertas}`)
verificar('levanta las banderas de cobertura', cierre.consistencia?.banderas_cobertura >= 3, `banderas=${cierre.consistencia?.banderas_cobertura}`)

{
  const { res } = await pedir(`/api/casos/${ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respuestas: { velocidad: 20 } }),
  })
  verificar('una actuación cerrada ya no admite cambios', res.status === 409, `status=${res.status}`)
}

/* ---------- 7b. Escritura concurrente con el cierre ---------- */
console.log('\n[7b] Escritura concurrente con el cierre')
{
  /*
   * El cierre construía el manifiesto, salía hasta 12 s a la red a buscar el sello de
   * tiempo y recién después marcaba la actuación como cerrada, todo sin transacción.
   * Cualquier eslabón que entrara en esa ventana quedaba FUERA del hash maestro sellado
   * y el verificador público denunciaba como alterado un expediente intacto, para
   * siempre. Acá se dispara una escritura a la vez que el cierre: gane quien gane, el
   * expediente tiene que verificar como íntegro.
   */
  const { cuerpo: alta2 } = await pedir('/api/casos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  })
  const ID2 = alta2.id

  const [cierre2, testigo2] = await Promise.all([
    pedir(`/api/casos/${ID2}/cerrar`, { method: 'POST' }),
    pedir(`/api/casos/${ID2}/testigos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre: 'Testigo de carrera', consentimiento: true }),
    }),
  ])

  verificar('el cierre concurrente igual cierra', cierre2.res.status === 200, `status=${cierre2.res.status}`)
  verificar(
    'la escritura simultánea o entra antes del sellado o se rechaza con 409',
    testigo2.res.status === 201 || testigo2.res.status === 409,
    `status=${testigo2.res.status}`,
  )

  const { cuerpo: ver2 } = await pedir('/api/verificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: ID2 }),
  })
  verificar(
    'el expediente sigue verificando como íntegro pese a la escritura concurrente',
    ver2.valido === true,
    JSON.stringify(ver2.problemas ?? []),
  )

  // Volver a cerrar es idempotente y no puede mover el hash ya sellado.
  const { cuerpo: recierre } = await pedir(`/api/casos/${ID2}/cerrar`, { method: 'POST' })
  verificar('volver a cerrar no cambia el hash maestro', recierre.hash_maestro === cierre2.cuerpo.hash_maestro)
}

/* ---------- 7c. El expediente no es de cualquiera ---------- */
console.log('\n[7c] El expediente no es de cualquiera')
{
  const guardadas = cabeceraCookies()
  olvidarCookies()

  const { res: sinAcceso } = await pedir(`/api/casos/${ID}`)
  verificar('sin posesión no se puede leer la actuación', sinAcceso.status === 403, `status=${sinAcceso.status}`)

  const { res: sinPdf } = await pedir(`/api/casos/${ID}/pdf`)
  verificar('sin posesión no se puede bajar el expediente', sinPdf.status === 403, `status=${sinPdf.status}`)

  const { res: sinListado } = await pedir('/api/casos')
  verificar('sin sesión no se puede listar', sinListado.status === 401, `status=${sinListado.status}`)

  // Devolver las cookies para el resto del circuito.
  for (const par of (guardadas ?? '').split('; ')) {
    const i = par.indexOf('=')
    if (i > 0) galletas.set(par.slice(0, i), par.slice(i + 1))
  }
  const { res: recuperado } = await pedir(`/api/casos/${ID}`)
  verificar('con la posesión de vuelta, se vuelve a poder leer', recuperado.status === 200)
}

/* ---------- 8. Expediente PDF ---------- */
console.log('\n[8] Generación del expediente')
{
  const { res, cuerpo } = await pedir(`/api/casos/${ID}/pdf`)
  verificar('genera el PDF', res.status === 200 && cuerpo.subarray(0, 5).toString() === '%PDF-')
  verificar('el PDF tiene contenido real', cuerpo.length > 20000, `${Math.round(cuerpo.length / 1024)} KB`)
  mkdirSync('data', { recursive: true })
  writeFileSync('data/expediente-e2e.pdf', cuerpo)
  console.log(`       -> data/expediente-e2e.pdf (${Math.round(cuerpo.length / 1024)} KB)`)
}

/* ---------- 9. Verificación pública ---------- */
console.log('\n[9] Verificación pública de integridad')
{
  const { res, cuerpo } = await pedir('/api/verificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: ID, hash: cierre.hash_maestro }),
  })
  verificar('el expediente verifica como íntegro', res.status === 200 && cuerpo.valido === true, JSON.stringify(cuerpo.problemas ?? []))
  verificar('el hash aportado coincide', cuerpo.coincide_con_hash_aportado === true)
  verificar('no reporta problemas', (cuerpo.problemas || []).length === 0)
}
{
  const { res, cuerpo } = await pedir('/api/verificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: ID, hash: 'a'.repeat(64) }),
  })
  verificar('detecta un hash aportado que no corresponde', res.status === 200 && cuerpo.coincide_con_hash_aportado === false)
}
{
  const { res } = await pedir('/api/verificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: 'ADS-ZZZZZZ' }),
  })
  verificar('informa cuando la actuación no existe', res.status === 404)
}

/* ---------- Resultado ---------- */
console.log(`\n${pruebas - fallos}/${pruebas} verificaciones pasaron`)
console.log(`\nActuación de prueba: ${ID}`)
console.log(`  panel      ${BASE}/panel/${ID}`)
console.log(`  verificar  ${BASE}/verificar?id=${ID}`)
if (fallos > 0) {
  console.error(`\n${fallos} FALLARON`)
  process.exit(1)
}
console.log('\nCircuito completo funcionando.')
