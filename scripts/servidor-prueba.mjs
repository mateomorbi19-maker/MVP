import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIRECTORIO = join(RAIZ, 'data', 'pruebas-mvp')

/** Lista positiva: ningún secreto de la sesión del operador pasa a esta aplicación. */
export function construirEntornoPrueba(origen = process.env, claveLocal = '') {
  const sistema = new Set(['path', 'systemroot', 'windir', 'comspec', 'temp', 'tmp', 'userprofile', 'appdata', 'localappdata', 'programfiles', 'programw6432', 'pathext', 'homedrive', 'homepath', 'number_of_processors'])
  const entorno = Object.fromEntries(Object.entries(origen).filter(([nombre]) => sistema.has(nombre.toLowerCase())))
  // Next 16 instalado comprueba esta marca antes de incorporar valores de .env.
  // Además se anulan los nombres del ejemplo: una actualización no vuelve a activar integraciones.
  const ejemplo = readFileSync(join(RAIZ, '.env.example'), 'utf8')
  for (const coincidencia of ejemplo.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)) entorno[coincidencia[1]] = ''
  return {
    ...entorno,
    __NEXT_PROCESSED_ENV: 'true',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: `--require ${JSON.stringify(join(RAIZ, 'scripts', 'red-prueba.cjs').replaceAll('\\', '/'))}`,
    DATABASE_URL: `postgresql://acta_pruebas:${encodeURIComponent(claveLocal)}@127.0.0.1:55432/acta_pruebas`,
    DATABASE_SSL: 'false',
    DIR_DATOS: join(DIRECTORIO, 'archivos'),
    URL_PUBLICA: 'http://127.0.0.1:3100',
    BASE_URL: 'http://127.0.0.1:3100',
    ENTORNO_PRUEBA_AISLADO: '1',
    COOKIE_INSEGURA: 'true',
    TSA_DESACTIVADA: 'true',
    EXTRACCION_DESACTIVADA: 'true',
    EXTRACCION_SIMULADA: 'false',
    PUSH_DESACTIVADO: 'true',
    SMTP_HOST: '',
    SMTP_REMITENTE: '',
    SMTP_USUARIO: '',
    SMTP_CLAVE: '',
    CLAVE_FIRMA_PEM: '',
    VAPID_CLAVE_PEM: '',
    TRANSCRIPCION_ELEVENLABS_API_KEY: '',
  }
}

async function ejecutar() {
  const modo = process.argv[2] || 'dev'
  if (!['dev', 'start', 'build', 'e2e', 'mvp-e2e', 'evidencia-e2e'].includes(modo)) throw new Error('Usá dev, start, build, e2e, mvp-e2e o evidencia-e2e para el entorno aislado.')
  mkdirSync(join(DIRECTORIO, 'archivos'), { recursive: true })
  let clave = ''
  try {
    clave = readFileSync(join(DIRECTORIO, 'clave-postgres.txt'), 'utf8').trim()
  } catch {
    if (modo !== 'build') throw new Error('Prepará primero PostgreSQL local de prueba y su clave en data/pruebas-mvp/clave-postgres.txt.')
  }
  const entorno = construirEntornoPrueba(process.env, clave)
  const pruebas = { e2e: 'prueba-e2e.mjs', 'mvp-e2e': 'prueba-mvp-e2e.mjs', 'evidencia-e2e': 'prueba-evidencia-e2e.mjs' }
  const argumentos = modo in pruebas
    ? [join(RAIZ, 'scripts', pruebas[modo])]
    : [join(RAIZ, 'node_modules', 'next', 'dist', 'bin', 'next'), modo, ...(modo === 'build' ? [] : ['--hostname', '127.0.0.1', '--port', '3100'])]
  const proceso = spawn(process.execPath, argumentos, { cwd: RAIZ, env: entorno, windowsHide: true, stdio: 'inherit' })
  proceso.on('error', (error) => {
    console.error('No se pudo iniciar el proceso aislado:', error.message)
    process.exitCode = 1
  })
  if (modo === 'dev' || modo === 'start') {
    const archivo = join(DIRECTORIO, 'entorno.json')
    let registro = {}
    try { registro = JSON.parse(readFileSync(archivo, 'utf8')) } catch {}
    registro.next = { pid: proceso.pid, supervisor_pid: process.pid, modo, puerto: 3100, direccion: entorno.URL_PUBLICA, archivos: entorno.DIR_DATOS, iniciado_en: new Date().toISOString() }
    writeFileSync(archivo, `${JSON.stringify(registro, null, 2)}\n`)
    console.log('Servidor aislado: http://127.0.0.1:3100 · PostgreSQL local: 55432 · integraciones externas desactivadas.')
  }
  proceso.on('exit', (codigo) => { process.exitCode = codigo ?? 1 })
  for (const senal of ['SIGINT', 'SIGTERM']) process.on(senal, () => proceso.kill(senal))
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  ejecutar().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
