import assert from 'node:assert/strict'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { Pool } from 'pg'
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib'

const BASE = process.env.BASE_URL || ''
const interpretarDireccion = (valor, nombre) => {
  try { return new URL(valor) } catch { throw new Error(`Configurá ${nombre} con el runner de pruebas aisladas.`) }
}
const base = interpretarDireccion(BASE, 'BASE_URL')
assert.ok(['127.0.0.1', 'localhost'].includes(base.hostname) && base.port === '3100' && base.protocol === 'http:' && base.pathname === '/' && !base.username && !base.password, 'Esta prueba sólo admite el servidor local aislado del puerto 3100.')
const direccionBase = interpretarDireccion(process.env.DATABASE_URL || '', 'DATABASE_URL')
assert.ok(['127.0.0.1', 'localhost'].includes(direccionBase.hostname) && direccionBase.port === '55432' && direccionBase.pathname === '/acta_pruebas' && direccionBase.username === 'acta_pruebas', 'La conexión SQL sólo admite acta_pruebas local del puerto 55432.')
assert.equal(process.env.TSA_DESACTIVADA, 'true', 'Usá el runner aislado con integraciones desactivadas.')
const pg = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 2 })
const marca = `evidencia-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
const huella = (bytes) => createHash('sha256').update(bytes).digest('hex')
let comprobaciones = 0
function comprobar(nombre, condicion) {
  assert.ok(condicion, nombre)
  comprobaciones++
  console.log(`  ok ${nombre}`)
}

function navegador() {
  const cookies = new Map()
  return {
    async pedir(ruta, opciones = {}) {
      assert.ok(ruta.startsWith('/') && !ruta.startsWith('//'), 'Las solicitudes usan sólo rutas del servidor local.')
      const cookie = [...cookies].map(([clave, valor]) => `${clave}=${valor}`).join('; ')
      const res = await fetch(`${BASE}${ruta}`, { ...opciones, redirect: 'error', headers: { ...opciones.headers, ...(cookie ? { cookie } : {}) } })
      for (const cruda of res.headers.getSetCookie()) {
        const par = cruda.split(';')[0]
        const corte = par.indexOf('=')
        cookies.set(par.slice(0, corte), par.slice(corte + 1))
      }
      const cuerpo = res.headers.get('content-type')?.includes('application/json') ? await res.json() : Buffer.from(await res.arrayBuffer())
      return { res, cuerpo }
    },
    json(ruta, method, cuerpo) {
      return this.pedir(ruta, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })
    },
  }
}

function png([r, g, b]) {
  const crc = (bytes) => {
    let c = ~0
    for (const byte of bytes) {
      c ^= byte
      for (let n = 0; n < 8; n++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return ~c >>> 0
  }
  const trozo = (tipo, datos) => {
    const texto = Buffer.from(tipo)
    const largo = Buffer.alloc(4)
    largo.writeUInt32BE(datos.length)
    const suma = Buffer.alloc(4)
    suma.writeUInt32BE(crc(Buffer.concat([texto, datos])))
    return Buffer.concat([largo, texto, datos, suma])
  }
  const cabecera = Buffer.alloc(13)
  cabecera.writeUInt32BE(2, 0)
  cabecera.writeUInt32BE(2, 4)
  cabecera[8] = 8
  cabecera[9] = 2
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), trozo('IHDR', cabecera), trozo('IDAT', deflateSync(Buffer.from([0, r, g, b, r, g, b, 0, r, g, b, r, g, b]))), trozo('IEND', Buffer.alloc(0))])
}
const imagen = png([40, 80, 120])
// WAV PCM real y breve: alcanza para validar transporte sin requerir proveedor remoto.
const audioFixture = Buffer.alloc(44 + 160)
audioFixture.write('RIFF', 0)
audioFixture.writeUInt32LE(audioFixture.length - 8, 4)
audioFixture.write('WAVEfmt ', 8)
audioFixture.writeUInt32LE(16, 16)
audioFixture.writeUInt16LE(1, 20)
audioFixture.writeUInt16LE(1, 22)
audioFixture.writeUInt32LE(8000, 24)
audioFixture.writeUInt32LE(16000, 28)
audioFixture.writeUInt16LE(2, 32)
audioFixture.writeUInt16LE(16, 34)
audioFixture.write('data', 36)
audioFixture.writeUInt32LE(160, 40)
const cliente = navegador()
const casos = []

async function abrir() {
  const alta = await cliente.json('/api/casos', 'POST', {})
  comprobar('fixture de actuación abierta', alta.res.status === 201)
  casos.push(alta.cuerpo.id)
  return alta.cuerpo.id
}

async function subir(caso, clave, coordenadas = {}, guia = 'libre') {
  const cuerpo = new FormData()
  cuerpo.set('archivo', new Blob([imagen], { type: 'image/png' }), `${marca}.png`)
  cuerpo.set('tipo', 'foto')
  cuerpo.set('guia_id', guia)
  cuerpo.set('idempotencia', clave)
  cuerpo.set('sha256_cliente', huella(imagen))
  cuerpo.set('tomada_en', new Date().toISOString())
  for (const [campo, valor] of Object.entries(coordenadas)) cuerpo.set(campo, String(valor))
  return cliente.pedir(`/api/casos/${caso}/media`, { method: 'POST', body: cuerpo })
}

async function firmar(caso, hash) {
  const cuerpo = new FormData()
  cuerpo.set('archivo', new Blob([imagen], { type: 'image/png' }), 'firma.png')
  cuerpo.set('hash', hash)
  cuerpo.set('firmante', `Firmante ${marca}`)
  return cliente.pedir(`/api/casos/${caso}/firma`, { method: 'POST', body: cuerpo })
}

async function transcribir(caso, bytes) {
  const cuerpo = new FormData()
  cuerpo.set('archivo', new Blob([bytes], { type: 'audio/wav' }), 'relato.wav')
  return cliente.pedir(`/api/casos/${caso}/transcripcion`, { method: 'POST', body: cuerpo })
}

async function textosPdf(bytes) {
  const documento = await PDFDocument.load(bytes)
  const textos = []
  for (const [, objeto] of documento.context.enumerateIndirectObjects()) {
    if (!(objeto instanceof PDFRawStream)) continue
    const contenido = Buffer.from(decodePDFRawStream(objeto).decode()).toString('latin1')
    for (const coincidencia of contenido.matchAll(/<([0-9a-f]+)>\s*Tj/gi)) {
      textos.push(Buffer.from(coincidencia[1], 'hex').toString('latin1'))
    }
  }
  return textos.join(' ')
}

console.log(`Evidencia E2E aislada: ${marca}`)
try {
  const caso = await abrir()
  const antesDelBorrador = await pg.query(`SELECT respuestas,
    (SELECT count(*)::int FROM medias WHERE caso_id = $1) AS piezas,
    (SELECT count(*)::int FROM eventos WHERE caso_id = $1) AS eslabones FROM casos WHERE id = $1`, [caso])
  const noConfigurada = await transcribir(caso, audioFixture)
  comprobar('sin credencial de transcripción devuelve 503 y salida para escribir', noConfigurada.res.status === 503 && /configur|escrib/i.test(noConfigurada.cuerpo.error))
  comprobar('transcripción rechaza grabación vacía con 400', (await transcribir(caso, Buffer.alloc(0))).res.status === 400)
  comprobar('transcripción rechaza audio mayor a 20 MB con 413', (await transcribir(caso, Buffer.alloc(20 * 1024 * 1024 + 1))).res.status === 413)
  const despuesDelBorrador = await pg.query(`SELECT respuestas,
    (SELECT count(*)::int FROM medias WHERE caso_id = $1) AS piezas,
    (SELECT count(*)::int FROM eventos WHERE caso_id = $1) AS eslabones FROM casos WHERE id = $1`, [caso])
  comprobar('transcribir borradores no modifica respuestas, medias ni cadena', JSON.stringify(antesDelBorrador.rows) === JSON.stringify(despuesDelBorrador.rows))
  const sinGps = await subir(caso, `${marca}-sin-gps`)
  comprobar('foto sin campos GPS se incorpora', sinGps.res.status === 201)
  const filaSinGps = await pg.query('SELECT gps FROM medias WHERE id = $1 AND caso_id = $2', [sinGps.cuerpo.id, caso])
  comprobar('GPS ausente persiste null y no inventa 0,0', filaSinGps.rows[0].gps === null)
  const origen = await subir(caso, `${marca}-origen`, { lat: 0, lon: 0 })
  comprobar('coordenadas 0,0 explícitas son válidas', origen.res.status === 201)
  const filaOrigen = await pg.query('SELECT gps FROM medias WHERE id = $1 AND caso_id = $2', [origen.cuerpo.id, caso])
  comprobar('0,0 explícitas persisten como coordenadas', filaOrigen.rows[0].gps?.lat === 0 && filaOrigen.rows[0].gps?.lon === 0)
  const incompleta = await subir(caso, `${marca}-incompleta`, { lat: -34 })
  comprobar('una sola coordenada no completa un GPS ficticio', incompleta.res.status === 201 && (await pg.query('SELECT gps FROM medias WHERE id = $1', [incompleta.cuerpo.id])).rows[0].gps === null)

  const otro = await abrir()
  const repetidaOtra = await subir(otro, `${marca}-sin-gps`)
  comprobar('misma clave en otro caso crea una pieza propia', repetidaOtra.res.status === 201 && repetidaOtra.cuerpo.id !== sinGps.cuerpo.id)
  const pertenencia = await pg.query('SELECT caso_id FROM medias WHERE id = $1', [repetidaOtra.cuerpo.id])
  comprobar('la idempotencia no devuelve una pieza de otro caso', pertenencia.rows[0].caso_id === otro)
  const ajeno = navegador()
  comprobar('un navegador ajeno no obtiene medias por repetir una clave', (await ajeno.pedir(`/api/casos/${caso}/media`, { method: 'POST', body: new FormData() })).res.status === 403)

  const limite = await abrir()
  let quinta
  for (let i = 0; i < 5; i++) {
    quinta = await subir(limite, `${marca}-limite-${i}`)
    comprobar(`toma admite foto ${i + 1}`, quinta.res.status === 201)
  }
  const reintento = await subir(limite, `${marca}-limite-4`)
  comprobar('reintento de la quinta devuelve la pieza existente', reintento.res.status === 200 && reintento.cuerpo.id === quinta.cuerpo.id && reintento.cuerpo.repetido === true)
  comprobar('una sexta captura nueva se rechaza', (await subir(limite, `${marca}-limite-5`)).res.status === 400)
  comprobar('rechazo y reintento conservan exactamente cinco piezas', (await pg.query('SELECT count(*)::int AS n FROM medias WHERE caso_id = $1', [limite])).rows[0].n === 5)

  const concurrencia = await abrir()
  for (let i = 0; i < 4; i++) assert.equal((await subir(concurrencia, `${marca}-concurrencia-${i}`)).res.status, 201)
  const competidoras = await Promise.all([subir(concurrencia, `${marca}-concurrencia-A`), subir(concurrencia, `${marca}-concurrencia-B`)])
  comprobar('dos capturas concurrentes compiten por el quinto lugar', competidoras.filter((r) => r.res.status === 201).length === 1 && competidoras.filter((r) => r.res.status === 400).length === 1)
  comprobar('el lock mantiene el límite de cinco ante concurrencia', (await pg.query('SELECT count(*)::int AS n FROM medias WHERE caso_id = $1', [concurrencia])).rows[0].n === 5)

  const idem = await abrir()
  const simultaneas = await Promise.all([subir(idem, `${marca}-simultanea`), subir(idem, `${marca}-simultanea`)])
  comprobar('dos reintentos simultáneos devuelven la misma pieza sin error', simultaneas.every((r) => [200, 201].includes(r.res.status)) && simultaneas[0].cuerpo.id === simultaneas[1].cuerpo.id)
  comprobar('la idempotencia concurrente guarda una sola fila y evento', (await pg.query('SELECT count(*)::int AS n FROM medias WHERE caso_id = $1', [idem])).rows[0].n === 1 && (await pg.query("SELECT count(*)::int AS n FROM eventos WHERE caso_id = $1 AND tipo = 'fotografia_incorporada'", [idem])).rows[0].n === 1)

  const actaAnterior = await cliente.pedir(`/api/casos/${caso}/acta`)
  const contacto = { nombre: `Contacto ${marca}`, telefono: '+541155551234', origen: 'asegurado' }
  comprobar('contactos manuales y relato se guardan como declaración', (await cliente.json(`/api/casos/${caso}`, 'PATCH', { respuestas: { relato_texto: 'Frené y recibí un impacto.', contactos_testigos: [contacto] } })).res.status === 200)
  const stale = await firmar(caso, actaAnterior.cuerpo.hash)
  comprobar('firma de contenido anterior recibe 409', stale.res.status === 409 && stale.cuerpo.hash_actual !== actaAnterior.cuerpo.hash)
  comprobar('firma rechazada no deja pieza', (await pg.query("SELECT count(*)::int AS n FROM medias WHERE caso_id = $1 AND tipo = 'firma'", [caso])).rows[0].n === 0)
  const actual = await cliente.pedir(`/api/casos/${caso}/acta`)
  const firma = await firmar(caso, actual.cuerpo.hash)
  comprobar('firma actual se incorpora atada al hash mostrado', firma.res.status === 201 && firma.cuerpo.hash_acta === actual.cuerpo.hash)
  const registroFirma = await pg.query('SELECT firmante, hash_firmado FROM medias WHERE id = $1 AND caso_id = $2', [firma.cuerpo.id, caso])
  comprobar('metadatos de firma persistidos con aclaración y hash', registroFirma.rows[0].firmante === `Firmante ${marca}` && registroFirma.rows[0].hash_firmado === actual.cuerpo.hash)
  comprobar('incorporar firma no altera el acta que firma', (await cliente.pedir(`/api/casos/${caso}/acta`)).cuerpo.hash === actual.cuerpo.hash)
  comprobar('contacto anotado no crea testigo con consentimiento', (await pg.query('SELECT count(*)::int AS n FROM testigos WHERE caso_id = $1', [caso])).rows[0].n === 0)

  const cierre = await cliente.pedir(`/api/casos/${caso}/cerrar`, { method: 'POST' })
  comprobar('cierre produce hash maestro', cierre.res.status === 200 && /^[a-f0-9]{64}$/.test(cierre.cuerpo.hash_maestro))
  const cerrado = await pg.query('SELECT respuestas, consistencia FROM casos WHERE id = $1', [caso])
  comprobar('informe sellado distingue contacto manual de testimonio', cerrado.rows[0].respuestas.contactos_testigos.length === 1 && cerrado.rows[0].consistencia.completitud.testigos === 0)
  const pdf = await cliente.pedir(`/api/casos/${caso}/pdf`)
  comprobar('PDF se genera con la firma y contactos manuales', pdf.res.status === 200 && pdf.cuerpo.subarray(0, 4).toString() === '%PDF')
  const impreso = await textosPdf(pdf.cuerpo)
  comprobar('PDF imprime aclaración y hash del acta firmada', impreso.includes(`Firmante ${marca}`) && impreso.includes(actual.cuerpo.hash))
  comprobar('PDF etiqueta los contactos como aportados por el asegurado', impreso.includes(contacto.telefono) && impreso.includes('aportado por el asegurado'))
  comprobar('caso sellado rechaza nuevas capturas', (await subir(caso, `${marca}-posterior`)).res.status === 409)
  comprobar('caso sellado rechaza transcripción con 409 antes del proveedor', (await transcribir(caso, audioFixture)).res.status === 409)
  const verificacion = await navegador().json('/api/verificar', 'POST', { id: caso, hash: cierre.cuerpo.hash_maestro })
  comprobar('cadena pública sigue íntegra después de firma, cierre y rechazo', verificacion.res.status === 200 && verificacion.cuerpo.valido === true && verificacion.cuerpo.coincide_con_hash_aportado === true)
  console.log(`Evidencia E2E: ${comprobaciones} comprobaciones correctas. Fixtures conservadas: ${marca}; casos ${casos.join(', ')}.`)
} finally {
  await pg.end()
}
