/** Handlers reales con transacciones y locks en memoria: no abre conexiones ni lee secretos. */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { stripTypeScriptTypes } from 'node:module'
import { resolve, dirname } from 'node:path'
import { SourceTextModule, SyntheticModule } from 'node:vm'

const modulos = new Map()
const dobles = new Map()
const resultado = (rows = []) => ({ rows, rowCount: rows.length })
let estado
let cola = Promise.resolve()
let escrituras = 0
let fallarEvento = false
let antesDeConectar = () => {}
let piezas = []
let firmasGuardadas = 0
let sesionSimulada = null
let precargaSimulada = null
let polizasSimuladas = []
let proveedorLectura = null
let alLiberar = () => {}

function reiniciar() {
  estado = { id: 'ADS-PRUEBA', creado_en: new Date().toISOString(), estado: 'abierto', respuestas: {}, progreso: {}, eventos: [] }
  escrituras = 0
  fallarEvento = false
  cola = Promise.resolve()
  antesDeConectar = () => {}
  piezas = []
  firmasGuardadas = 0
  sesionSimulada = null
  precargaSimulada = null
  polizasSimuladas = []
  proveedorLectura = null
  alLiberar = () => {}
}

const pool = {
  async query(sql, valores = []) {
    if (sql.startsWith('SELECT * FROM casos')) return resultado([structuredClone(estado)])
    if (sql.startsWith('SELECT * FROM medias')) return resultado(structuredClone(piezas))
    if (sql.startsWith('SELECT * FROM testigos')) return resultado()
    if (sql.includes('pr.usuario_id AS productor_usuario_id')) return resultado(polizasSimuladas.filter((p) => p.id === valores[0] && p.usuario_id === valores[1]))
    if (sql.includes('JOIN medias m ON m.id = e.media_id')) return resultado([{ id: 'EXT-PRUEBA', caso_id: estado.id, tipo_documento: 'licencia', archivo: 'lectura.png', mime: 'image/png', estado: estado.estado }])
    throw new Error(`La lectura salió del cliente bloqueado: ${sql}`)
  },
  async connect() {
    antesDeConectar()
    let liberar
    let copia
    let bloqueado = false
    return {
      get bloqueado() { return bloqueado },
      async query(sql, valores = []) {
        if (sql === 'BEGIN' || sql.startsWith('SET LOCAL')) return resultado()
        if (sql.includes('INSERT INTO casos')) {
          copia = { ...structuredClone(estado), id: valores[0], poliza: valores[1], patente: valores[2], usuario_id: valores[7], poliza_id: valores[8], productor_id: valores[9] }
          bloqueado = true
          liberar = () => {}
          return resultado()
        }
        if (sql.startsWith('SELECT estado FROM extracciones')) {
          assert.ok(bloqueado)
          return resultado([{ estado: copia.extraccion?.estado ?? 'pendiente' }])
        }
        if (sql.includes('FOR UPDATE')) {
          if (!bloqueado) {
            const anterior = cola
            cola = new Promise((resuelta) => { liberar = resuelta })
            await anterior
            bloqueado = true
            copia = structuredClone(estado)
          }
          return resultado([structuredClone(copia)])
        }
        if (sql === 'COMMIT' || sql === 'ROLLBACK') {
          if (sql === 'COMMIT' && copia) estado = copia
          if (bloqueado) liberar()
          bloqueado = false
          return resultado()
        }
        assert.ok(bloqueado, `Operación sin lock: ${sql}`)
        if (sql.startsWith('SELECT * FROM casos')) return resultado([structuredClone(copia)])
        if (sql.startsWith('SELECT * FROM medias') || sql.startsWith('SELECT * FROM testigos')) return resultado()
        if (sql.startsWith('UPDATE casos SET respuestas')) copia.respuestas = JSON.parse(valores[1])
        else if (sql.startsWith('UPDATE casos SET progreso')) copia.progreso = JSON.parse(valores[1])
        else if (sql.startsWith('UPDATE casos SET consistencia')) copia.consistencia = JSON.parse(valores[1])
        else if (sql.startsWith('UPDATE casos SET gps')) {
          copia.gps = JSON.parse(valores[1])
          copia.direccion = valores[2]
          copia.clima = valores[3] ? JSON.parse(valores[3]) : null
        }
        else if (sql.startsWith('UPDATE casos SET croquis')) copia.croquis = JSON.parse(valores[1])
        else if (sql.includes('UPDATE extracciones')) copia.extraccion = { estado: sql.includes("estado = 'lista'") ? 'lista' : 'fallida' }
        else if (sql.includes('INSERT INTO medias')) copia.firma = valores
        else if (sql.startsWith("UPDATE casos SET estado = 'cerrado'")) {
          copia.estado = 'cerrado'
          copia.hash_maestro = valores[1]
        } else throw new Error(`Consulta inesperada: ${sql}`)
        escrituras++
        return resultado()
      },
      anotarEvento(tipo, detalle, reservado) {
        assert.ok(bloqueado, 'Un evento exige el mismo cliente bloqueado')
        if (fallarEvento) throw new Error('Falla de evento simulada')
        copia.eventos.push({ tipo, detalle, reservado })
      },
      release() {
        assert.equal(bloqueado, false, 'No queda un lock después de la request')
        alLiberar()
      },
    }
  },
}

dobles.set('@/lib/posesion', { exigirAccesoCaso: async () => {}, tienePosesion: async () => true, anotarPosesion: async () => {} })
dobles.set('@/lib/sesion', { leerSesion: async () => sesionSimulada, exigirRol: async () => sesionSimulada, alcanceDe: () => ({ tipo: 'todos' }) })
dobles.set('@/lib/polizas', { precargaDe: async () => precargaSimulada })
dobles.set('@/lib/claves', { hashToken: (valor) => `hash:${valor}`, nuevoToken: () => 'secreto-de-prueba' })
dobles.set('@/lib/bitacora', { anotarEnBitacora: async () => {} })
dobles.set('@/lib/retencion', { ErrorRetencion: class extends Error {}, bajaPorAsegurado: () => {}, expurgar: async () => {} })
dobles.set('@/lib/api', { errorApi: (_contexto, error, mensaje) => Response.json({ error: mensaje, causa: error.message }, { status: error.name === 'ErrorActuacionCerrada' ? 409 : 500 }) })
dobles.set('next/server', { NextResponse: { json: (...args) => Response.json(...args) } })
dobles.set(resolve('lib/db.ts'), { db: async () => pool, nuevoId: () => 'FIR-PRUEBA' })
dobles.set(resolve('lib/hash.ts'), {
  VERSION_MANIFIESTO: '1.1',
  ErrorActuacionCerrada: class extends Error { constructor() { super('Cerrada'); this.name = 'ErrorActuacionCerrada' } },
  registrarEvento: async (_id, tipo, detalle, opciones) => opciones.cliente.anotarEvento(tipo, detalle, opciones.reservado),
  construirManifiesto: async (_id, opciones) => {
    if (opciones?.cliente) assert.ok(opciones.cliente.bloqueado)
    return { hash_maestro: 'maestro', cadena: [1, 2], piezas: [] }
  },
  // El acta no se usa en estas pruebas de PATCH/cierre.
  sha256: () => 'hash', canonico: JSON.stringify,
})
dobles.set('@/lib/sello', { sellar: async () => { throw new Error('TSA deshabilitada en esta prueba') } })
dobles.set('@/lib/almacenamiento', {
  ErrorArchivo: class extends Error {}, TAMANO_MAXIMO: 100000,
  guardarArchivo: async () => {
    firmasGuardadas++
    return { archivo: 'firma.png', mime: 'image/png', bytes: 1, sha256: 'trazo' }
  },
})
dobles.set('@/lib/acta', {
  DECLARACION: { version: 'prueba' },
  construirActa: (caso) => ({ hash: JSON.stringify(caso.respuestas) }),
})
dobles.set('@/lib/clima', { consultarClima: async () => null })
dobles.set('@/lib/geo', { direccionDeCoordenadas: async () => 'Dirección de prueba' })
dobles.set(resolve('lib/extraccion.ts'), { proveedorActivo: () => proveedorLectura })
dobles.set(resolve('lib/almacenamiento.ts'), { leerArchivo: async () => Buffer.from('foto') })

async function sintetico(clave, valores) {
  if (!modulos.has(clave)) {
    const modulo = new SyntheticModule(Object.keys(valores), function () {
      for (const [nombre, valor] of Object.entries(valores)) this.setExport(nombre, valor)
    })
    modulos.set(clave, modulo)
    await modulo.link(() => {})
  }
  return modulos.get(clave)
}

async function cargar(archivo) {
  const ruta = resolve(archivo)
  if (modulos.has(ruta)) return modulos.get(ruta)
  if (dobles.has(ruta)) return sintetico(ruta, dobles.get(ruta))
  const fuente = stripTypeScriptTypes(await readFile(ruta, 'utf8'), { mode: 'transform' })
  const modulo = new SourceTextModule(fuente, { identifier: ruta })
  modulos.set(ruta, modulo)
  await modulo.link(async (nombre, origen) => {
    if (dobles.has(nombre)) return sintetico(nombre, dobles.get(nombre))
    if (nombre.startsWith('node:')) return sintetico(nombre, await import(nombre))
    const destino = nombre.startsWith('@/') ? resolve(nombre.slice(2)) : resolve(dirname(origen.identifier), nombre)
    return cargar(`${destino}.ts`)
  })
  return modulo
}

const moduloPatch = await cargar('app/api/casos/[id]/route.ts')
await moduloPatch.evaluate()
const { PATCH } = moduloPatch.namespace
const pedir = (cuerpo) => PATCH(new Request('http://prueba/api/casos/ADS-PRUEBA', {
  method: 'PATCH', body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' },
}), { params: Promise.resolve({ id: 'ADS-PRUEBA' }) })

reiniciar()
const concurrentes = await Promise.all([pedir({ respuestas: { calle: 'Primera' } }), pedir({ respuestas: { relato_texto: 'Frené.' } })])
assert.ok(concurrentes.every((r) => r.status === 200))
assert.deepEqual(estado.respuestas, { calle: 'Primera', relato_texto: 'Frené.' })
assert.equal(estado.eventos.length, 2)
assert.deepEqual(estado.eventos[0].detalle, { preguntas: ['calle'] })
assert.equal(estado.eventos[0].reservado.valores.calle, 'Primera')
console.log('ok: guardados concurrentes conservan respuestas y reservan los valores')

reiniciar()
estado.estado = 'cerrado'
assert.equal((await pedir({ respuestas: { calle: 'Después del sello' } })).status, 409)
assert.equal(escrituras, 0)
assert.equal(estado.eventos.length, 0)
console.log('ok: un caso cerrado rechaza cambios antes de escribir')

reiniciar()
fallarEvento = true
assert.equal((await pedir({ respuestas: { calle: 'No debe persistir' } })).status, 500)
assert.deepEqual(estado.respuestas, {})
assert.equal(estado.eventos.length, 0)
console.log('ok: falla de evento revierte la respuesta')

reiniciar()
assert.equal((await pedir({ respuestas: { contactos_testigos: [{ nombre: 'Ana', telefono: '12345678', origen: 'inventado' }] } })).status, 200)
assert.equal(estado.respuestas.contactos_testigos[0].origen, 'asegurado')
assert.equal((await pedir({ respuestas: { contactos_testigos: [{ telefono: '' }] } })).status, 400)
assert.equal((await pedir({ respuestas: { relato_texto: 'x'.repeat(30001) } })).status, 400)
console.log('ok: contactos normalizados y campos largos acotados')

reiniciar()
const moduloCerrar = await cargar('app/api/casos/[id]/cerrar/route.ts')
await moduloCerrar.evaluate()
const advertencia = console.error
console.error = () => {}
try {
  const respuesta = await moduloCerrar.namespace.POST(new Request('http://prueba', { method: 'POST' }), { params: Promise.resolve({ id: estado.id }) })
  assert.equal(respuesta.status, 200)
  assert.equal(estado.estado, 'cerrado')
  assert.ok(estado.consistencia)
  assert.deepEqual(estado.eventos.map((e) => e.tipo), ['informe_consistencia_generado', 'cierre_actuacion'])
} finally {
  console.error = advertencia
}
console.log('ok: cierre lee caso, piezas e informe en el cliente bloqueado')

const { analizar } = modulos.get(resolve('lib/consistencia.ts')).namespace
const sinComparables = analizar({ respuestas: { relato_texto: 'Me chocaron.' }, clima: null, direccion: null,
  gpsCapturadoEn: null, fotos: [], fotosObligatorias: [], tieneAudio: false, tieneFirma: false, testigos: 0 })
assert.equal(sinComparables.completitud.tiene_relato_escrito, true)
assert.equal(sinComparables.resumen.controles_ok, 0)
assert.ok(sinComparables.controles_no_evaluables.length >= 4)
assert.ok(!sinComparables.hallazgos.some((h) => /espontánea|registrada en el lugar/.test(h.objetivo)))
console.log('ok: relato corto completo no se presenta como contenido verificado')

reiniciar()
const moduloFirma = await cargar('app/api/casos/[id]/firma/route.ts')
await moduloFirma.evaluate()
const firmar = async (hash) => {
  const cuerpo = new FormData()
  cuerpo.set('archivo', new File(['trazo'], 'firma.png', { type: 'image/png' }))
  cuerpo.set('hash', hash)
  return moduloFirma.namespace.POST(new Request('http://prueba', { method: 'POST', body: cuerpo }), {
    params: Promise.resolve({ id: estado.id }),
  })
}
antesDeConectar = () => { estado.respuestas = { relato_texto: 'Corrección concurrente' } }
assert.equal((await firmar('{}')).status, 409)
assert.equal(firmasGuardadas, 0)
assert.equal(estado.eventos.length, 0)
console.log('ok: firma compara el acta releída bajo lock y rechaza contenido cambiado')

reiniciar()
assert.equal((await firmar('{}')).status, 201)
assert.equal(firmasGuardadas, 1)
assert.equal(estado.firma.at(-1), '{}')
assert.equal(estado.eventos[0].tipo, 'acta_firmada_asegurado')
assert.equal(estado.eventos[0].detalle.firmante, undefined)
console.log('ok: firma e identificador de acta se guardan juntos y el nombre queda reservado')

reiniciar()
estado.estado = 'cerrado'
estado.consistencia = sinComparables
piezas = [{ id: 'FIR-UNO', caso_id: estado.id, tipo: 'firma', archivo: 'firma.png', mime: 'image/png',
  capturado_en: new Date(), firmante: 'Persona que firmó', hash_firmado: 'acta-real', sha256: 'imagen',
  tomada_en: new Date(), origen: 'camara' }]
const { datosExpediente } = modulos.get(resolve('lib/casos.ts')).namespace
const expediente = await datosExpediente(estado.id)
assert.equal(expediente.medias[0].firmante, 'Persona que firmó')
assert.equal(expediente.medias[0].hash_firmado, 'acta-real')
assert.equal(expediente.medias[0].origen, 'camara')
assert.ok(expediente.medias[0].tomada_en)
assert.deepEqual(expediente.consistencia, estado.consistencia)
console.log('ok: paquete de PDF conserva datos de firma, hora y origen; informe sellado no se recalcula')

reiniciar()
const moduloUbicacion = await cargar('app/api/casos/[id]/ubicacion/route.ts')
await moduloUbicacion.evaluate()
const ubicar = () => moduloUbicacion.namespace.POST(new Request('http://prueba', { method: 'POST',
  body: JSON.stringify({ lat: -34, lon: -58, precision_m: 10 }), headers: { 'content-type': 'application/json' },
}), { params: Promise.resolve({ id: estado.id }) })
antesDeConectar = () => { estado.estado = 'cerrado' }
assert.equal((await ubicar()).status, 409)
assert.equal(escrituras, 0)
assert.equal(estado.gps, undefined)
console.log('ok: cierre durante geocodificación no permite cambiar GPS, clima ni dirección')

reiniciar()
fallarEvento = true
assert.equal((await ubicar()).status, 500)
assert.equal(estado.gps, undefined)
assert.equal(estado.eventos.length, 0)
console.log('ok: falla del evento de ubicación revierte también GPS y clima')

reiniciar()
const moduloAlta = await cargar('app/api/casos/route.ts')
await moduloAlta.evaluate()
const crear = (cuerpo) => moduloAlta.namespace.POST(new Request('http://prueba', { method: 'POST',
  body: JSON.stringify(cuerpo), headers: { 'content-type': 'application/json' },
}))
sesionSimulada = { usuario_id: 'USR-TITULAR', rol: 'asegurado' }
polizasSimuladas = [{ id: 'POL-ELEGIDA', usuario_id: 'USR-TITULAR', numero: '123', patente: 'AA123BB', productor_id: 'PRO-FICHA', productor_usuario_id: 'USR-PRODUCTOR' }]
assert.equal((await crear({ poliza_id: 'POL-AJENA' })).status, 400)
assert.equal((await crear({ poliza_id: 'POL-ELEGIDA' })).status, 201)
assert.equal(estado.poliza_id, 'POL-ELEGIDA')
assert.equal(estado.productor_id, 'USR-PRODUCTOR')
assert.equal(estado.eventos[0].tipo, 'apertura_actuacion')
console.log('ok: alta autoriza la póliza elegida y relaciona el usuario del productor, no su ficha')

reiniciar()
sesionSimulada = { usuario_id: 'USR-TITULAR', rol: 'asegurado' }
precargaSimulada = { poliza_id: 'POL-PRINCIPAL', poliza: 'Número principal', patente: null, ambigua: true }
assert.equal((await crear({})).status, 201)
assert.equal(estado.poliza_id, null)
assert.equal(estado.poliza, null)
assert.equal(estado.patente, null)
console.log('ok: varias pólizas sin selección no asocian la principal al accidente')

const moduloLectura = await cargar('lib/cola-extraccion.ts')
await moduloLectura.evaluate()
async function leerDocumento(simular) {
  const terminada = new Promise((resolver) => { alLiberar = resolver })
  proveedorLectura = { nombre: 'proveedor-de-prueba', leer: simular }
  moduloLectura.namespace.encolarLectura('EXT-PRUEBA')
  await terminada
  // La cola en proceso termina su finally después de liberar la transacción.
  await new Promise((resolver) => setTimeout(resolver, 0))
}
reiniciar()
await leerDocumento(async () => {
  estado.estado = 'cerrado'
  return { campos: [{ clave: 'nombre', confianza: 0.7 }], confianza_global: 0.7, simulado: false }
})
assert.equal(estado.extraccion, undefined)
assert.equal(estado.eventos.length, 0)
console.log('ok: OCR que termina después del sello no modifica lectura ni cadena')

reiniciar()
fallarEvento = true
const errorEsperado = console.error
console.error = () => {}
try {
  await leerDocumento(async () => ({ campos: [], confianza_global: 0.7, simulado: true }))
} finally {
  console.error = errorEsperado
}
assert.equal(estado.extraccion, undefined)
assert.equal(estado.eventos.length, 0)
console.log('ok: falla de evento OCR revierte su resultado en la misma transacción')

reiniciar()
await leerDocumento(async () => { throw new Error('Proveedor no disponible') })
assert.equal(estado.extraccion.estado, 'fallida')
assert.equal(estado.eventos[0].tipo, 'lectura_automatica_fallida')
assert.equal(estado.eventos[0].detalle.error, undefined)
assert.equal(estado.eventos[0].reservado.motivo, 'Proveedor no disponible')
console.log('ok: error de proveedor OCR se guarda bajo lock y su detalle queda reservado')

reiniciar()
await leerDocumento(async () => ({ campos: [{ clave: 'dni', valor: 'reservado', confianza: 0.8 }], confianza_global: 0.8, simulado: true }))
assert.equal(estado.extraccion.estado, 'lista')
assert.equal(estado.eventos[0].tipo, 'lectura_automatica_registrada')
assert.deepEqual(estado.eventos[0].detalle.campos, [{ clave: 'dni', confianza: 0.8 }])
console.log('ok: resultado OCR y su evento se confirman juntos sin publicar valores personales')

// IndexedDB mínimo con confirmación/aborto de la transacción, sin almacenamiento real.
const almacenLocal = new Map()
let abortarEscritura = false
globalThis.indexedDB = {
  open() {
    const pedido = {}
    queueMicrotask(() => {
      pedido.result = {
        close() {},
        transaction() {
          let pedidosPendientes = 0
          const tx = {
            objectStore() {
              const operar = (accion, valor) => {
                const solicitud = {}
                pedidosPendientes++
                queueMicrotask(() => {
                  solicitud.result = accion === 'getAll' ? [...almacenLocal.values()] : accion === 'get' ? almacenLocal.get(valor) : valor?.id
                  if (accion === 'put' && abortarEscritura) {
                    tx.error = new Error('Almacenamiento local lleno')
                    tx.onabort?.()
                    return
                  }
                  if (accion === 'put') almacenLocal.set(valor.id, structuredClone(valor))
                  if (accion === 'delete') almacenLocal.delete(valor)
                  pedidosPendientes--
                  solicitud.onsuccess?.()
                  queueMicrotask(() => { if (pedidosPendientes === 0) tx.oncomplete?.() })
                })
                return solicitud
              }
              return {
                getAll: () => operar('getAll'), put: (valor) => operar('put', valor),
                get: (id) => operar('get', id),
                delete: (id) => operar('delete', id),
              }
            },
          }
          return tx
        },
      }
      pedido.onsuccess?.()
    })
    return pedido
  },
}
const moduloCola = await cargar('lib/cola.ts')
await moduloCola.evaluate()
const { encolar, pendientesDe, drenar, quitar } = moduloCola.namespace
const captura = { id: 'captura', casoId: 'ADS-COLA', tipo: 'foto', guiaId: null, mime: 'image/png',
  sha256: 'foto', tomadaEn: new Date().toISOString(), lat: null, lon: null, bytes: new Blob(['foto']) }
const fetchOriginal = globalThis.fetch
try {
  abortarEscritura = true
  await assert.rejects(encolar(captura), /lleno/)
  assert.equal(almacenLocal.size, 0)
  abortarEscritura = false
  await encolar(captura)
  for (const codigo of [400, 401, 409, 503]) {
    globalThis.fetch = async () => Response.json({ error: `Rechazo ${codigo}` }, { status: codigo })
    await assert.rejects(drenar('ADS-COLA'), new RegExp(`Rechazo ${codigo}`))
    const [pendiente] = await pendientesDe('ADS-COLA')
    assert.equal(pendiente.estadoHttp, codigo)
    assert.equal(await pendiente.bytes.text(), 'foto')
  }
  globalThis.fetch = async () => { throw new Error('Sin conexión') }
  await assert.rejects(drenar('ADS-COLA'), /Sin conexión/)
  assert.equal((await pendientesDe('ADS-COLA'))[0].intentos, 5)
  console.log('ok: cola conserva bytes ante rechazo, cierre, red y falta de espacio')

  globalThis.fetch = async () => Response.json({ error: 'Otro expediente cerrado' }, { status: 409 })
  await drenar('ADS-OTRO')
  assert.equal((await pendientesDe('ADS-COLA')).length, 1)
  console.log('ok: una pieza rechazada de otro caso no bloquea el caso actual')

  let responderPendiente
  let envioIniciado
  const comenzoEnvio = new Promise((resolver) => { envioIniciado = resolver })
  globalThis.fetch = async () => {
    envioIniciado()
    return new Promise((resolver) => { responderPendiente = resolver })
  }
  const drenajeTardio = drenar('ADS-COLA')
  const rechazoTardio = assert.rejects(drenajeTardio, /Rechazo tardío/)
  await comenzoEnvio
  await quitar(captura.id)
  responderPendiente(Response.json({ error: 'Rechazo tardío' }, { status: 400 }))
  await rechazoTardio
  assert.equal((await pendientesDe('ADS-COLA')).length, 0)
  console.log('ok: un rechazo tardío no recrea un borrador eliminado explícitamente')

  await encolar({ ...captura, id: 'primera' })
  await encolar({ ...captura, id: 'segunda' })
  const enviosTrasRetiro = []
  globalThis.fetch = async (_url, opciones) => {
    const id = opciones.body.get('idempotencia')
    enviosTrasRetiro.push(id)
    if (id === 'primera') await quitar('segunda')
    return Response.json({ id: 'IMG-CONFIRMADA' }, { status: 201 })
  }
  await drenar('ADS-COLA')
  assert.deepEqual(enviosTrasRetiro, ['primera'])
  assert.equal((await pendientesDe('ADS-COLA')).length, 0)
  console.log('ok: una pieza retirada mientras sube otra no se envía desde el snapshot viejo')

  await encolar(captura)

  let envios = 0
  globalThis.fetch = async () => {
    envios++
    await new Promise((resolver) => setTimeout(resolver, 5))
    return Response.json({ id: 'IMG-CONFIRMADA' }, { status: 201 })
  }
  const cantidades = await Promise.all([drenar(), drenar('ADS-COLA')])
  assert.deepEqual(cantidades, [1, 1])
  assert.equal(envios, 1)
  assert.equal((await pendientesDe('ADS-COLA')).length, 0)
  console.log('ok: bomba y recorrido comparten envío y sólo borran tras recepción confirmada')
} finally {
  globalThis.fetch = fetchOriginal
  delete globalThis.indexedDB
}
