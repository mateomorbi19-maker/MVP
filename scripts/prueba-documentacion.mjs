import assert from 'node:assert/strict'
import * as documentacion from '../lib/documentacion.ts'
import * as polizas from '../lib/polizas.ts'

assert.equal(documentacion.esTipoDocumentacion('dni'), true, 'DNI tiene que ser una categoría válida')
assert.equal(typeof documentacion.completitudDocumentacion, 'function')
const fotos = ['poliza', 'cedula', 'licencia', 'dni'].map((tipo) => ({ tipo, mime: 'image/jpeg', poliza_id: tipo === 'poliza' || tipo === 'cedula' ? 'POL1' : null }))
assert.equal(documentacion.completitudDocumentacion(fotos, 'POL1').completa, true)
assert.equal(documentacion.completitudDocumentacion(fotos, 'POL2').completa, false, 'No se mezclan vehículos')
assert.equal(documentacion.completitudDocumentacion(fotos.map((a) => ({ ...a, mime: 'application/pdf' })), 'POL1').completa, false, 'PDF complementa las fotos')
assert.equal(typeof polizas.limpiarDatosPoliza, 'function')
assert.throws(() => polizas.limpiarDatosPoliza({ numero: '1', aseguradora: 'A', vigencia_desde: '2026-02-31' }), /fecha/i)
assert.throws(() => polizas.limpiarDatosPoliza({ numero: '1', aseguradora: 'A', vigencia_desde: '2026-05-01', vigencia_hasta: '2026-04-01' }), /vigencia/i)
assert.equal(polizas.limpiarDatosPoliza({ numero: '1', aseguradora: 'A', patente: 'ab 123-cd', anio: '' }).patente, 'AB123CD')
assert.equal(polizas.limpiarDatosPoliza({ numero: '1', aseguradora: 'A', anio: '' }).anio, null)
assert.throws(() => polizas.limpiarEstadoCuenta({ fecha: '2026-10-15', origen: '', modalidad: 'Débito', movimientos: [] }), /origen/i)
assert.throws(() => polizas.limpiarEstadoCuenta({ fecha: '2026-10-15', origen: 'Carga propia', modalidad: 'Débito', movimientos: [{ fecha: '2026-10-15', concepto: 'Cuota', importe: 'no' }] }), /importe/i)
assert.equal(polizas.limpiarEstadoCuenta({ fecha: '2026-10-15', origen: 'Resumen', modalidad: 'Manual', movimientos: [{ fecha: '2026-10-14', concepto: 'Pago', importe: '-20.50' }] }).movimientos[0].importe, -20.5)
assert.equal(typeof polizas.puedeGestionarPoliza, 'function')
const cliente = { usuario_id: 'CLI1', productor_usuario_id: 'PR1', productor_activo: true }
assert.equal(polizas.puedeGestionarPoliza({ usuario_id: 'PR1', rol: 'productor' }, cliente), true)
assert.equal(polizas.puedeGestionarPoliza({ usuario_id: 'PR2', rol: 'productor' }, cliente), false, 'Un productor ajeno no modifica el estado de cuenta')
assert.equal(polizas.puedeGestionarPoliza({ usuario_id: 'PR1', rol: 'productor' }, { ...cliente, productor_activo: false }), false)
assert.equal(polizas.puedeGestionarPoliza({ usuario_id: 'CLI1', rol: 'asegurado' }, cliente), true)
assert.equal(polizas.puedeGestionarPoliza({ usuario_id: 'OTRO', rol: 'asegurado' }, cliente), false)
console.log('Documentación: 19 comprobaciones correctas')
