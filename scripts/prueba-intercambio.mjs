import assert from 'node:assert/strict'

const intercambio = await import('../lib/intercambio.ts').catch((err) => {
  if (err.code === 'ERR_MODULE_NOT_FOUND') return {}
  throw err
})
assert.equal(typeof intercambio.seleccionarArchivosIntercambio, 'function', 'Tiene que existir selección expresa validada')
const archivos = [
  { id: 'POL1-F', tipo: 'poliza', poliza_id: 'POL1' },
  { id: 'CED1-F', tipo: 'cedula', poliza_id: 'POL1' },
  { id: 'CED2-F', tipo: 'cedula', poliza_id: 'POL2' },
  { id: 'DNI-F', tipo: 'dni', poliza_id: null },
  { id: 'LEGADO', tipo: 'poliza', poliza_id: null },
]
assert.deepEqual(intercambio.seleccionarArchivosIntercambio(archivos, ['DNI-F', 'POL1-F'], 'POL1').map((a) => a.id), ['DNI-F', 'POL1-F'])
assert.throws(() => intercambio.seleccionarArchivosIntercambio(archivos, ['CED2-F'], 'POL1'), /vehículo|póliza/i)
assert.throws(() => intercambio.seleccionarArchivosIntercambio(archivos, ['AJENO'], 'POL1'), /cuenta|archivo/i)
assert.throws(() => intercambio.seleccionarArchivosIntercambio(archivos, ['LEGADO'], 'POL1'), /asign|vehículo|póliza/i)
assert.throws(() => intercambio.seleccionarArchivosIntercambio(archivos, [], 'POL1'), /elegí|seleccion/i)
assert.throws(() => intercambio.seleccionarArchivosIntercambio(archivos, Array(21).fill('DNI-F'), 'POL1'), /20/i)
assert.throws(() => intercambio.seleccionarArchivosIntercambio(archivos, ['DNI-F', 'DNI-F'], 'POL1'), /repet/i)
assert.equal(intercambio.estadoPermisoIntercambio({ revocado_en: null, vence_en: '2026-10-16T00:00:00Z' }, new Date('2026-10-15T00:00:00Z')), 'activo')
assert.equal(intercambio.estadoPermisoIntercambio({ revocado_en: null, vence_en: '2026-10-15T00:00:00Z' }, new Date('2026-10-15T00:00:00Z')), 'vencido')
assert.equal(intercambio.estadoPermisoIntercambio({ revocado_en: '2026-10-14T00:00:00Z', vence_en: '2026-10-16T00:00:00Z' }, new Date('2026-10-15T00:00:00Z')), 'revocado')
assert.notEqual(intercambio.claveCopiaDocumentacion('CASO1', 'ARC1', 'hash'), intercambio.claveCopiaDocumentacion('CASO2', 'ARC1', 'hash'))
assert.notEqual(intercambio.claveCopiaDocumentacion('CASO1', 'ARC1', 'hash'), intercambio.claveCopiaDocumentacion('CASO1', 'ARC1', 'otro-hash'))
// El pool falso evita cualquier conexión; se prueban respuestas reales del handler público.
const poolAnterior = globalThis._pool
const esquemaAnterior = globalThis._schemaLista
let permiso = { caso_id: 'CASO1', revocado_en: null, vence_en: '2999-01-01T00:00:00Z', archivos: [{ id: 'DOC1', titulo: 'DNI', tipo: 'dni', mime: 'image/jpeg', archivo: 'ruta-interna-que-no-debe-salir' }] }
globalThis._schemaLista = Promise.resolve()
globalThis._pool = { query: async (sql) => {
  assert.match(sql, /FROM documentos_compartidos/, 'Nunca se consulta una media que el permiso no incluye')
  return { rows: [permiso] }
} }
try {
  const { GET } = await import('../app/api/compartir/[token]/route.ts')
  const token = 'a'.repeat(43)
  const pedir = (sufijo = '') => GET(new Request(`http://prueba/api/compartir/${token}${sufijo}`), { params: Promise.resolve({ token }) })
  const lista = await pedir()
  assert.equal(lista.status, 200)
  assert.match(lista.headers.get('cache-control'), /no-store/)
  assert.equal(lista.headers.get('referrer-policy'), 'no-referrer')
  assert.deepEqual((await lista.json()).archivos, [{ id: 'DOC1', titulo: 'DNI', tipo: 'dni', mime: 'image/jpeg' }], 'El listado público nunca entrega rutas internas')
  assert.equal((await pedir('?archivo=AJENO')).status, 403)
  permiso = { ...permiso, vence_en: '2000-01-01T00:00:00Z' }
  assert.equal((await pedir()).status, 410)
  permiso = { ...permiso, vence_en: '2999-01-01T00:00:00Z', revocado_en: '2026-10-15T00:00:00Z' }
  assert.equal((await pedir()).status, 403)
} finally {
  globalThis._pool = poolAnterior
  globalThis._schemaLista = esquemaAnterior
}
console.log('Intercambio: 20 comprobaciones correctas')
