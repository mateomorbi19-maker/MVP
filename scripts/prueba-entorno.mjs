import assert from 'node:assert/strict'
import { test } from 'node:test'
import { construirEntornoPrueba } from './servidor-prueba.mjs'
import { createServer } from 'node:http'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import './red-prueba.cjs'

test('el servidor de prueba sólo usa PostgreSQL y archivos locales aunque herede configuración productiva', () => {
  const entorno = construirEntornoPrueba({
    DATABASE_URL: 'postgresql://secreto@servidor-externo/produccion',
    DIR_DATOS: 'C:/datos-reales',
    SMTP_HOST: 'correo-real',
    TRANSCRIPCION_ELEVENLABS_API_KEY: 'clave-real',
    CLAVE_FIRMA_PEM: 'firma-real',
    NODE_OPTIONS: '--require archivo-externo',
    Path: 'C:/Windows',
    SystemRoot: 'C:/Windows',
  }, 'clave-local-ficticia')
  const base = new URL(entorno.DATABASE_URL)
  assert.equal(base.hostname, '127.0.0.1')
  assert.equal(base.port, '55432')
  assert.equal(base.pathname, '/acta_pruebas')
  assert.equal(base.password, 'clave-local-ficticia')
  assert.match(entorno.DIR_DATOS.replaceAll('\\', '/'), /\/data\/pruebas-mvp\/archivos$/)
  assert.equal(entorno.SMTP_HOST, '')
  assert.equal(entorno.TRANSCRIPCION_ELEVENLABS_API_KEY, '')
  assert.equal(entorno.CLAVE_FIRMA_PEM, '')
  assert.equal(entorno.TSA_DESACTIVADA, 'true')
  assert.equal(entorno.EXTRACCION_DESACTIVADA, 'true')
  assert.equal(entorno.PUSH_DESACTIVADO, 'true')
  assert.equal(entorno.__NEXT_PROCESSED_ENV, 'true')
  assert.match(entorno.NODE_OPTIONS, /^--require /)
  assert.ok(!entorno.NODE_OPTIONS.includes('archivo-externo'))
  assert.equal(entorno.Path, 'C:/Windows')
  assert.equal(entorno.URL_PUBLICA, 'http://127.0.0.1:3100')
  assert.equal(entorno.COOKIE_INSEGURA, 'true')
  assert.equal(entorno.ENTORNO_PRUEBA_AISLADO, '1')
})

test('la red de prueba permite loopback y rechaza servicios remotos antes de enviar datos', async () => {
  const servidor = createServer((_pedido, respuesta) => { respuesta.end('sólo local') })
  await new Promise((resolver) => servidor.listen(0, '127.0.0.1', resolver))
  try {
    assert.equal(await (await fetch(`http://127.0.0.1:${servidor.address().port}`)).text(), 'sólo local')
    await assert.rejects(fetch('https://example.com'), /remota desactivada/)
  } finally {
    servidor.closeAllConnections()
    await new Promise((resolver) => servidor.close(resolver))
  }
})

test('el cargador Next instalado no incorpora siquiera claves desconocidas de archivos .env', () => {
  const directorio = mkdtempSync(join(tmpdir(), 'acta-prueba-env-'))
  writeFileSync(join(directorio, '.env'), 'SECRETO_AJENO_NUEVO=no-debe-cargarse\nDATABASE_URL=postgresql://externo/produccion\n')
  const codigo = `require('@next/env').loadEnvConfig(process.argv[1])
console.log(JSON.stringify({ ajeno: process.env.SECRETO_AJENO_NUEVO ?? null, local: new URL(process.env.DATABASE_URL).hostname }))`
  const resultado = execFileSync(process.execPath, ['-e', codigo, directorio], { env: construirEntornoPrueba(process.env, 'clave-ficticia'), encoding: 'utf8', windowsHide: true })
  assert.deepEqual(JSON.parse(resultado.trim()), { ajeno: null, local: '127.0.0.1' })
})
