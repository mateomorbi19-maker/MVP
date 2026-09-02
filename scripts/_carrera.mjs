import { readFileSync } from 'node:fs'
import { Pool } from 'pg'

const env = readFileSync('.env', 'utf8')
const connectionString = env.split('\n').find((l) => l.trim().startsWith('DATABASE_URL='))?.trim().slice(13)
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false }, max: 10 })

// Un caso de juguete
const id = 'ADS-CARRER'
await pool.query(`INSERT INTO casos (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [id])

const a = await pool.connect()
await a.query('BEGIN')
await a.query('SELECT estado FROM casos WHERE id = $1 FOR UPDATE', [id])
console.log('cliente A tiene el lock')

// El segundo intenta lo mismo mientras A lo tiene tomado
const inicio = Date.now()
try {
  const b = await pool.connect()
  console.log('cliente B obtuvo conexion del pool en', Date.now() - inicio, 'ms')
  await b.query('BEGIN')
  await b.query('SELECT estado FROM casos WHERE id = $1 FOR UPDATE', [id])
  console.log('cliente B tomo el lock (no deberia, A lo tiene)')
  await b.query('ROLLBACK')
  b.release()
} catch (e) {
  console.log('CLIENTE B FALLA tras', Date.now() - inicio, 'ms')
  console.log('  code:', e.code, '| severity:', e.severity, '| routine:', e.routine)
  console.log('  message:', e.message)
}

await a.query('ROLLBACK')
a.release()
await pool.query('DELETE FROM casos WHERE id = $1', [id]).catch((e) => console.log('limpieza:', e.code, e.message))
await pool.end()
