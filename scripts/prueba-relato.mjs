import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ErrorTranscripcion, transcribirAudio, validarAudioRelato } from '../lib/transcripcion.ts'
import { borradorRequiereEleccion } from '../lib/borrador-relato.ts'

const audio = () => new File([new Uint8Array([26, 69, 223, 163, 0, 0, 0, 0])], 'relato.webm', { type: 'audio/webm;codecs=opus' })

test('rechaza audio vacío, excesivo y formatos ajenos sin contactar al proveedor', () => {
  assert.throws(() => validarAudioRelato(new File([], 'vacio.webm', { type: 'audio/webm' })), { estado: 400 })
  assert.throws(() => validarAudioRelato({ size: 20 * 1024 * 1024 + 1, type: 'audio/webm' }), { estado: 413 })
  assert.throws(() => validarAudioRelato(new File(['hola'], 'foto.jpg', { type: 'image/jpeg' })), { estado: 415 })
  assert.equal(validarAudioRelato(audio()), 'audio/webm')
})

test('sin credencial explícita no hay solicitud externa y devuelve salida de configuración', async () => {
  let llamadas = 0
  await assert.rejects(transcribirAudio(audio(), {
    clave: '',
    solicitar: async () => {
      llamadas++
      throw new Error('No debe salir')
    },
  }), (error) => error instanceof ErrorTranscripcion && error.estado === 503 && /configur/i.test(error.message))
  assert.equal(llamadas, 0)
})

test('transcribe bytes por multipart a destino fijo, preservando el texto original', async () => {
  const original = ' A las diez doblé por Belgrano. '
  const texto = await transcribirAudio(audio(), {
    clave: 'credencial-de-prueba',
    solicitar: async (destino, opciones) => {
      assert.equal(destino, 'https://api.elevenlabs.io/v1/speech-to-text')
      assert.equal(opciones.method, 'POST')
      assert.equal(opciones.headers['xi-api-key'], 'credencial-de-prueba')
      assert.equal(opciones.body.get('model_id'), 'scribe_v2')
      assert.equal(opciones.body.get('language_code'), 'es')
      assert.equal(opciones.body.get('webhook'), 'false')
      assert.deepEqual(new Uint8Array(await opciones.body.get('file').arrayBuffer()), new Uint8Array([26, 69, 223, 163, 0, 0, 0, 0]))
      assert.ok(opciones.signal instanceof AbortSignal)
      return Response.json({ language_code: 'es', language_probability: 0.99, text: original, words: [] })
    },
  })
  assert.equal(texto, original)
})

test('rechaza respuestas vacías o malformadas en lugar de inventar una transcripción', async () => {
  for (const respuesta of [{ text: '' }, { text: '   ' }, { text: 22 }, { edited_transcript: 'Texto ajeno' }]) {
    await assert.rejects(transcribirAudio(audio(), { clave: 'prueba', solicitar: async () => Response.json(respuesta) }), { estado: 502 })
  }
  await assert.rejects(transcribirAudio(audio(), { clave: 'prueba', solicitar: async () => new Response('html') }), { estado: 502 })
})

test('no filtra errores ni credenciales del proveedor y distingue rechazo de clave', async () => {
  await assert.rejects(transcribirAudio(audio(), { clave: 'privada', solicitar: async () => new Response('privada: detalle interno', { status: 401 }) }), (error) => error.estado === 503 && !error.message.includes('privada'))
  await assert.rejects(transcribirAudio(audio(), { clave: 'privada', solicitar: async () => new Response('privada: cuota', { status: 429 }) }), (error) => error.estado === 503 && !error.message.includes('privada'))
  await assert.rejects(transcribirAudio(audio(), { clave: 'privada', solicitar: async () => { throw new Error('privada: red') } }), (error) => error.estado === 502 && !error.message.includes('privada'))
  await assert.rejects(transcribirAudio(audio(), { clave: 'prueba', solicitar: async () => { throw new DOMException('plazo', 'TimeoutError') } }), { estado: 504 })
})

test('no restaura automáticamente un borrador creado antes de una confirmación más reciente', () => {
  const borrador = { texto: 'corrección local', textoBase: 'texto anterior', transcripcionBase: 'original anterior' }
  assert.equal(borradorRequiereEleccion(borrador, 'texto más reciente', 'original anterior'), true)
  assert.equal(borradorRequiereEleccion(borrador, 'texto anterior', 'original más reciente'), true)
  assert.equal(borradorRequiereEleccion(borrador, 'texto anterior', 'original anterior'), false)
  assert.equal(borradorRequiereEleccion({ texto: 'borrador antiguo sin base' }, 'texto confirmado', null), true)
  assert.equal(borradorRequiereEleccion({ texto: 'borrador antiguo sin base' }, '', null), false)
})
