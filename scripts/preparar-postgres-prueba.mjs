import { randomBytes } from 'node:crypto'
import { spawn } from 'node:child_process'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { construirEntornoPrueba } from './servidor-prueba.mjs'

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const directorio = join(raiz, 'data', 'pruebas-mvp')
const datos = join(directorio, 'postgres')
const binarios = join(tmpdir(), 'acta-mvp-postgresql-17.11', 'pgsql', 'bin')
const archivoClave = join(directorio, 'clave-postgres.txt')

async function existe(archivo) {
  try {
    await access(archivo)
    return true
  } catch {
    return false
  }
}

async function ejecutar(nombre, argumentos, entorno) {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(join(binarios, `${nombre}.exe`), argumentos, { cwd: raiz, env: entorno, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })
    let salida = ''
    proceso.stdout.on('data', (datos) => { salida += datos })
    proceso.stderr.on('data', (datos) => { salida += datos })
    proceso.on('error', rechazar)
    proceso.on('exit', (codigo) => {
      // pg_ctl deja al servidor vivo: sus handles heredados no deben retener este preparador.
      proceso.stdout.destroy()
      proceso.stderr.destroy()
      if (codigo === 0) resolver(salida.trim())
      else rechazar(new Error(`${nombre}: ${salida.trim()}`))
    })
  })
}

try {
  await access(join(binarios, 'postgres.exe'))
  await mkdir(directorio, { recursive: true })
  // Se prueba disponibilidad sin conectarse a un posible servidor que pertenezca al usuario.
  await new Promise((resolver, rechazar) => {
    const pruebaPuerto = createServer()
    pruebaPuerto.on('error', () => rechazar(new Error('El puerto 55432 está ocupado. No se conecta a esa base: detené el entorno de prueba anterior o liberá el puerto.')))
    pruebaPuerto.listen(55432, '127.0.0.1', () => pruebaPuerto.close(resolver))
  })
  let clave
  if (await existe(archivoClave)) clave = (await readFile(archivoClave, 'utf8')).trim()
  else {
    clave = randomBytes(32).toString('hex')
    await writeFile(archivoClave, clave, { mode: 0o600, flag: 'wx' })
  }
  if (!clave) throw new Error('La clave local está vacía. Revisá data/pruebas-mvp/clave-postgres.txt antes de continuar.')
  const entorno = { ...construirEntornoPrueba(process.env, clave), PGPASSWORD: clave }
  if (!(await existe(join(datos, 'PG_VERSION')))) {
    const salida = await ejecutar('initdb', ['-D', datos, '-U', 'acta_pruebas', '--pwfile', archivoClave, '--auth-host=scram-sha-256', '--auth-local=trust', '--encoding=UTF8', '--locale=C'], entorno)
    await writeFile(join(directorio, 'initdb.log'), salida)
  }
  await ejecutar('pg_ctl', ['-D', datos, '-l', join(directorio, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55432', '-w', 'start'], entorno)
  const comunes = ['-h', '127.0.0.1', '-p', '55432', '-U', 'acta_pruebas', '-d', 'postgres', '-tAc']
  const baseExiste = await ejecutar('psql', [...comunes, "SELECT 1 FROM pg_database WHERE datname = 'acta_pruebas'"], entorno)
  if (baseExiste !== '1') await ejecutar('createdb', ['-h', '127.0.0.1', '-p', '55432', '-U', 'acta_pruebas', 'acta_pruebas'], entorno)
  const identificacion = await ejecutar('psql', [...comunes, "SELECT current_user || ' | ' || inet_server_addr() || ':' || inet_server_port()"], entorno)
  const pid = Number((await readFile(join(datos, 'postmaster.pid'), 'utf8')).split('\n')[0])
  const registro = { postgres: { pid, puerto: 55432, direccion: '127.0.0.1', datos, binarios, usuario: 'acta_pruebas', base: 'acta_pruebas', archivo_clave: archivoClave, iniciado_en: new Date().toISOString() } }
  await writeFile(join(directorio, 'entorno.json'), `${JSON.stringify(registro, null, 2)}\n`)
  console.log(`PostgreSQL de prueba iniciado: ${identificacion} · PID ${pid}`)
  console.log('Registro: data/pruebas-mvp/entorno.json. La clave local no se imprime ni se incorpora al repositorio.')
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
