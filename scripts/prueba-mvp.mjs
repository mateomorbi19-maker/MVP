import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const raiz = fileURLToPath(new URL('../', import.meta.url))
const suites = [
  ['--import', 'tsx', 'scripts/prueba-logica.mjs'],
  ['--import', 'tsx', 'scripts/prueba-recorrido-mvp.mjs'],
  ['--import', 'tsx', 'scripts/prueba-documentacion.mjs'],
  ['--import', 'tsx', 'scripts/prueba-relato.mjs'],
  ['--experimental-vm-modules', 'scripts/prueba-integridad.mjs'],
  ['--import', 'tsx', '--experimental-vm-modules', 'scripts/prueba-intercambio.mjs'],
  ['scripts/prueba-entorno.mjs'],
]

for (const argumentos of suites) {
  const resultado = spawnSync(process.execPath, argumentos, { cwd: raiz, stdio: 'inherit', windowsHide: true })
  if (resultado.error || resultado.status !== 0) {
    console.error(`Revisá la suite ${argumentos.at(-1)}.`, resultado.error?.message ?? '')
    process.exit(resultado.status || 1)
  }
}
console.log('Todas las suites del MVP terminaron correctamente.')
