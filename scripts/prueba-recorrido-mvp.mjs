import assert from 'node:assert/strict'
import { construirPasos, faltantes, pasoInicial, fotosAnteriores } from '../lib/recorrido.ts'
import { GUIA_FOTOS, SECCIONES, VALOR } from '../lib/cuestionario.ts'

const pasos = construirPasos({ cantidad_vehiculos: VALOR.cantidad_vehiculos.N2, policia: VALOR.policia.SI })
const claves = pasos.map((p) => p.clave)
assert.equal(claves[claves.indexOf('corte') + 1], 'relato', 'el relato inicia la segunda etapa')
assert.ok(claves.indexOf('f:libre') < claves.indexOf('corte'), 'extras antes de retirarse')
assert.ok(!claves.includes('croquis'))
assert.ok(!claves.includes('validacion'), 'no se presenta revisión OCR sin lecturas')
assert.ok(construirPasos({}, true).some((p) => p.clave === 'validacion'), 'las lecturas pendientes conservan su revisión antes de firmar')
for (const id of ['tercero_actitud', 'tercero_patente', 'calle', 'sentido', 'maniobra', 'velocidad', 'freno', 'clima', 'luz', 'policia_dependencia', 'quien_conducia', 'acompanantes', 'uso_vehiculo']) {
  assert.ok(!claves.includes(`p:${id}`), `${id} ya no es una pantalla`)
  assert.ok(SECCIONES.some((s) => s.preguntas.some((p) => p.id === id)), `${id} sigue disponible para históricos`)
}
assert.ok(claves.includes('p:ubicacion_vehiculo'))
assert.ok(claves.includes('p:policia_acta'))
assert.ok(GUIA_FOTOS.some((g) => g.id === 'acta_policial' && g.admitePdf))
assert.ok(!construirPasos({ policia: VALOR.policia.NO }).some((p) => p.clave === 'p:policia_acta'))
assert.deepEqual(pasos.find((p) => p.clave === 'p:policia').pregunta.opciones, [VALOR.policia.SI, VALOR.policia.NO])
assert.ok(VALOR.policia.LA_LLAMAMOS_Y_TODAVIA_NO_LLEGO || Object.values(VALOR.policia).length === 3)
assert.ok(!faltantes(pasos, { relato_texto: 'Me chocaron desde atrás.' }, []).some((p) => p.clave === 'relato'))
assert.equal(pasoInicial(pasos, {}, [], { paso: 'relato', omitidos: [] }), 'relato')
assert.ok(!GUIA_FOTOS.filter((g) => !g.oculta && g.grupo === 'lugar').some((g) => g.obligatoria))
console.log('Recorrido MVP: orden, condicionales, históricos, relato escrito y reanudación correctos')
assert.equal(fotosAnteriores([{ id: 'IMG-1', idempotencia: 'captura-1', tipo: 'foto', guia_id: 'danos' }], 'danos', ['captura-1']).length, 0, 'la recepción no duplica una captura de esta pantalla')
assert.equal(fotosAnteriores([{ id: 'captura-1', pendiente: true, tipo: 'foto', guia_id: 'danos' }], 'danos', ['captura-1']).length, 0, 'la cola local tampoco duplica una captura')
assert.equal(fotosAnteriores([{ id: 'IMG-1', idempotencia: 'captura-1', tipo: 'foto', guia_id: 'danos' }], 'danos', []).length, 1, 'recargar recupera la captura anterior')
