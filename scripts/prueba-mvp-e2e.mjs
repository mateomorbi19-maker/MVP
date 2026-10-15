import assert from 'node:assert/strict'
import { createHash, randomBytes, randomInt } from 'node:crypto'
import { deflateSync } from 'node:zlib'
import { Pool } from 'pg'
import { PDFDocument } from 'pdf-lib'

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
const marca = `mvp-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
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
const fotoInicial = png([20, 100, 190])
const fotoNueva = png([180, 80, 30])

async function cuenta(nombre) {
  const cliente = navegador()
  const dni = String(randomInt(80000000, 99000000))
  const clave = `Prueba-A7-${marca}`
  const email = `${marca}-${nombre}@example.invalid`
  const alta = await cliente.json('/api/usuarios', 'POST', { dni, clave, nombre: `Prueba MVP ${nombre} ${marca}`, email })
  comprobar(`registro fixture ${nombre}`, alta.res.status === 201)
  const ingreso = await cliente.json('/api/sesion', 'POST', { dni, clave })
  comprobar(`ingreso fixture ${nombre}`, ingreso.res.status === 200)
  return { ...cliente, id: alta.cuerpo.id, dni, clave, email }
}

async function subir(cliente, tipo, polizaId, bytes = fotoInicial, mime = 'image/png') {
  const form = new FormData()
  form.append('tipo', tipo)
  if (polizaId) form.append('poliza_id', polizaId)
  form.append('archivo', new Blob([bytes], { type: mime }), `${marca}-${tipo}.${mime === 'application/pdf' ? 'pdf' : 'png'}`)
  const r = await cliente.pedir('/api/documentacion/archivos', { method: 'POST', body: form })
  comprobar(`subida ${tipo} ${polizaId ? 'por vehículo' : 'personal'}`, r.res.status === 201)
  return r.cuerpo
}

console.log(`Prueba MVP aislada: ${marca}`)
try {
  const anonimo = navegador()
  const salud = await anonimo.pedir('/api/salud')
  comprobar('servidor y esquema aislados disponibles', salud.res.status === 200 && salud.cuerpo.ok)
  const titular = await cuenta('titular')
  const ajeno = await cuenta('ajeno')
  const productor = await cuenta('productor')
  await pg.query("UPDATE usuarios SET rol = 'productor' WHERE id = $1 AND email = $2", [productor.id, productor.email])
  const productorId = `PRD-${randomBytes(8).toString('hex')}`
  await pg.query('INSERT INTO productores (id,nombre,email,aseguradora,usuario_id) VALUES ($1,$2,$3,$4,$5)', [productorId, `Productor prueba ${marca}`, productor.email, 'Aseguradora de prueba', productor.id])
  const reingreso = await productor.json('/api/sesion', 'POST', { dni: productor.dni, clave: productor.clave })
  comprobar('productor fixture tiene rol operativo', reingreso.cuerpo.usuario?.rol === 'productor')
  const datos1 = { numero: `${marca}-1`, aseguradora: 'Aseguradora de prueba', patente: 'AB123CD', marca_modelo: 'Vehículo uno', cobertura: 'Terceros', vigencia_desde: '2026-01-01', vigencia_hasta: '2027-01-01', productor_email: productor.email }
  const p1 = await titular.json('/api/polizas', 'POST', datos1)
  comprobar('primera póliza cargada con productor vinculado', p1.res.status === 201)
  const p2 = await titular.json('/api/polizas', 'POST', { ...datos1, numero: `${marca}-2`, patente: 'XY987ZW', marca_modelo: 'Vehículo dos' })
  comprobar('segunda póliza no colisiona con principal', p2.res.status === 201)
  const poliza1 = p1.cuerpo.id
  const poliza2 = p2.cuerpo.id
  const listado = await titular.pedir('/api/polizas')
  comprobar('una sola principal para dos vehículos', listado.cuerpo.length === 2 && listado.cuerpo.filter((p) => p.principal).length === 1)
  comprobar('productor enlazado a ficha correcta', listado.cuerpo[0].productor?.id === productorId)
  const principal = await titular.json(`/api/polizas/${poliza2}`, 'PATCH', { principal: true })
  comprobar('se cambia vehículo principal', principal.res.status === 200)
  const cambio = await titular.json(`/api/polizas/${poliza1}`, 'PATCH', { ...datos1, cobertura: 'Todo riesgo', vigencia_hasta: '2028-01-01' })
  comprobar('vigencia y cobertura editables', cambio.res.status === 200)
  const datosCuenta = { fecha: '2026-10-15', origen: `Resumen fixture ${marca}`, modalidad: 'Transferencia manual', saldo: 1000, movimientos: [{ fecha: '2026-10-14', concepto: 'Cuota', importe: 1000 }] }
  comprobar('titular carga estado de cuenta manual', (await titular.json(`/api/polizas/${poliza1}/estado-cuenta`, 'PUT', datosCuenta)).res.status === 200)
  comprobar('usuario ajeno no cambia cuenta', (await ajeno.json(`/api/polizas/${poliza1}/estado-cuenta`, 'PUT', datosCuenta)).res.status === 400)
  comprobar('productor asignado carga estado de cuenta', (await productor.json(`/api/polizas/${poliza1}/estado-cuenta`, 'PUT', { ...datosCuenta, saldo: 0, origen: `Productor fixture ${marca}` })).res.status === 200)
  const historial = await titular.pedir(`/api/polizas/${poliza1}`)
  comprobar('historial muestra origen productor y cambios titular', historial.cuerpo.some((c) => c.origen.includes('productor')) && historial.cuerpo.some((c) => c.actual.cobertura === 'Todo riesgo'))
  const sinDocumentos = await titular.json('/api/casos', 'POST', {})
  comprobar('con dos pólizas y sin selección no se atribuye una patente', sinDocumentos.res.status === 201 && (await titular.pedir(`/api/casos/${sinDocumentos.cuerpo.id}`)).cuerpo.patente === null)
  const rutaSinDocumentos = `/api/casos/${sinDocumentos.cuerpo.id}/documentacion`
  const asociar = { poliza_id: poliza2, asociar_solo: true }
  comprobar('se puede elegir vehículo y póliza sin ningún archivo cargado', (await titular.json(rutaSinDocumentos, 'POST', asociar)).res.status === 200)
  const elegidoSinDocumentos = await titular.pedir(`/api/casos/${sinDocumentos.cuerpo.id}`)
  comprobar('asociar sin archivos guarda patente y póliza correctas', elegidoSinDocumentos.cuerpo.patente === 'XY987ZW' && elegidoSinDocumentos.cuerpo.poliza === `${marca}-2`)
  comprobar('reintentar asociación de vehículo no duplica el cambio', (await titular.json(rutaSinDocumentos, 'POST', asociar)).res.status === 200)
  const eventosAsociacion = await pg.query("SELECT count(*)::int AS n FROM eventos WHERE caso_id = $1 AND tipo = 'datos_asegurado_actualizados'", [sinDocumentos.cuerpo.id])
  comprobar('la asociación repetida deja un solo evento de cambio', eventosAsociacion.rows[0].n === 1)
  const pdf = await PDFDocument.create()
  pdf.addPage([100, 100])
  await subir(titular, 'poliza', poliza1, await pdf.save(), 'application/pdf')
  const conPdf = await titular.pedir('/api/documentacion')
  comprobar('un PDF queda complementario y no se presenta como foto', conPdf.cuerpo.archivos.length === 1 && conPdf.cuerpo.archivos[0].mime === 'application/pdf')
  const seguro = await subir(titular, 'poliza', poliza1)
  const cedula = await subir(titular, 'cedula', poliza1)
  const licencia = await subir(titular, 'licencia', null)
  const dni = await subir(titular, 'dni', null)
  const cedula2 = await subir(titular, 'cedula', poliza2)
  await pg.query('UPDATE archivos_usuario SET poliza_id = NULL WHERE id = $1 AND usuario_id = $2', [cedula2.id, titular.id])
  comprobar('archivo legado se puede asignar al vehículo correcto', (await titular.json(`/api/documentacion/archivos/${cedula2.id}`, 'PATCH', { poliza_id: poliza2 })).res.status === 200)
  comprobar('usuario ajeno no puede reasignar un archivo', (await ajeno.json(`/api/documentacion/archivos/${cedula.id}`, 'PATCH', { poliza_id: poliza2 })).res.status === 400)
  const completos = await titular.pedir('/api/documentacion')
  comprobar('hay fotos de las cuatro categorías y documentos personales sin póliza', ['poliza', 'cedula', 'licencia', 'dni'].every((tipo) => completos.cuerpo.archivos.some((a) => a.tipo === tipo && a.mime === 'image/png')) && [licencia.id, dni.id].every((id) => completos.cuerpo.archivos.find((a) => a.id === id)?.poliza_id === null))
  const altaCaso = await titular.json('/api/casos', 'POST', { poliza_id: poliza1 })
  comprobar('caso nace con póliza elegida aunque otra sea principal y FK válida', altaCaso.res.status === 201)
  const casoId = altaCaso.cuerpo.id
  const caso = await titular.pedir(`/api/casos/${casoId}`)
  comprobar('carátula conserva patente y póliza del vehículo elegido', caso.cuerpo.patente === 'AB123CD' && caso.cuerpo.poliza === datos1.numero)
  const ruta = `/api/casos/${casoId}/documentacion`
  comprobar('documentación del caso requiere sesión', (await anonimo.pedir(ruta)).res.status === 401)
  comprobar('otro usuario no accede a la documentación privada del caso', (await ajeno.pedir(ruta)).res.status === 403)
  comprobar('no se mezclan cédulas de otro vehículo', (await titular.json(ruta, 'POST', { poliza_id: poliza1, archivos: [cedula2.id] })).res.status === 400)
  const seleccion = { poliza_id: poliza1, archivos: [seguro.id, cedula.id, dni.id] }
  const copias = await titular.json(ruta, 'POST', seleccion)
  comprobar('incorporación crea únicamente las tres copias elegidas', copias.res.status === 200 && copias.cuerpo.copias.length === 3)
  const repetido = await titular.json(ruta, 'POST', seleccion)
  comprobar('reintento es idempotente y devuelve los mismos ids', repetido.res.status === 200 && JSON.stringify(repetido.cuerpo.copias.map((a) => a.id)) === JSON.stringify(copias.cuerpo.copias.map((a) => a.id)))
  const cantidad = await pg.query("SELECT count(*)::int AS n FROM medias WHERE caso_id = $1 AND origen = 'documentacion_previa'", [casoId])
  comprobar('la base conserva sólo tres copias después del reintento', cantidad.rows[0].n === 3)
  const compartido = await titular.json(ruta, 'POST', { ...seleccion, compartir: true })
  comprobar('genera QR con URL local y vencimiento cercano a 24 horas', compartido.res.status === 200 && compartido.cuerpo.svg?.includes('<svg') && new URL(compartido.cuerpo.url).origin === base.origin && Math.abs(Date.parse(compartido.cuerpo.vence_en) - Date.now() - 86400000) < 60000)
  const token = new URL(compartido.cuerpo.url).pathname.split('/').at(-1)
  const publico = `/api/compartir/${token}`
  const listaPublica = await anonimo.pedir(publico)
  comprobar('token público sólo lista los tres documentos seleccionados', listaPublica.res.status === 200 && listaPublica.cuerpo.archivos.length === 3 && !listaPublica.cuerpo.archivos.some((a) => a.tipo === 'licencia'))
  comprobar('listado público no expone rutas internas y desactiva caché/referentes', listaPublica.cuerpo.archivos.every((a) => !('archivo' in a) && !('usuario_id' in a)) && listaPublica.res.headers.get('cache-control')?.includes('no-store') && listaPublica.res.headers.get('referrer-policy') === 'no-referrer')
  comprobar('token no abre un original ni un archivo no seleccionado', (await anonimo.pedir(`${publico}?archivo=${licencia.id}`)).res.status === 403)
  const copiaSeguro = copias.cuerpo.copias.find((a) => a.tipo === 'poliza')
  const lecturaInicial = await anonimo.pedir(`${publico}?archivo=${copiaSeguro.id}`)
  comprobar('la copia pública tiene los bytes originales', lecturaInicial.res.status === 200 && huella(lecturaInicial.cuerpo) === huella(fotoInicial))
  await subir(titular, 'poliza', poliza1, fotoNueva)
  comprobar('se puede borrar fuente editable sin borrar copia', (await titular.pedir(`/api/documentacion/archivos/${seguro.id}`, { method: 'DELETE' })).res.status === 200)
  const lecturaPosterior = await anonimo.pedir(`${publico}?archivo=${copiaSeguro.id}`)
  comprobar('snapshot conserva hash anterior después de reemplazar y borrar fuente', lecturaPosterior.res.status === 200 && huella(lecturaPosterior.cuerpo) === huella(fotoInicial) && huella(lecturaPosterior.cuerpo) !== huella(fotoNueva))
  comprobar('dueño puede revocar QR', (await titular.pedir(ruta, { method: 'DELETE' })).res.status === 200)
  comprobar('token revocado rechaza listado y archivo', (await anonimo.pedir(publico)).res.status === 403 && (await anonimo.pedir(`${publico}?archivo=${copiaSeguro.id}`)).res.status === 403)
  const nuevo = await titular.json(ruta, 'POST', { poliza_id: poliza1, archivos: [dni.id], compartir: true })
  comprobar('se puede compartir una nueva selección reducida', nuevo.res.status === 200 && nuevo.cuerpo.copias.length === 1)
  const tokenNuevo = new URL(nuevo.cuerpo.url).pathname.split('/').at(-1)
  await pg.query("UPDATE documentos_compartidos SET vence_en = now() - interval '1 second' WHERE token_sha256 = $1 AND usuario_id = $2 AND caso_id = $3", [huella(tokenNuevo), titular.id, casoId])
  comprobar('un token vencido se rechaza con 410', (await anonimo.pedir(`/api/compartir/${tokenNuevo}`)).res.status === 410)
  const pagina = await anonimo.pedir(`/compartir/${tokenNuevo}`)
  comprobar('página pública presenta el vencimiento sin exponer datos privados', pagina.res.status === 200 && pagina.cuerpo.toString().includes('El enlace venció'))
  const panel = await productor.pedir(`/panel/${casoId}`)
  comprobar('formulario de cuenta es accesible al productor desde el panel', panel.res.status === 200 && panel.cuerpo.toString().includes('Estado de cuenta informativo'))
  console.log(`MVP E2E: ${comprobaciones} comprobaciones correctas. Fixtures conservadas: ${marca}, caso ${casoId}.`)
} finally {
  await pg.end()
}
