import { Pool } from 'pg'

/**
 * Pool de Postgres. En desarrollo Next.js recarga los módulos en caliente, así que
 * lo cacheamos en globalThis para no abrir una conexión nueva en cada recarga.
 */
const globalForDb = globalThis as unknown as { _pool?: Pool; _schemaLista?: Promise<void> }

export function pool(): Pool {
  if (!globalForDb._pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error(
        'Falta la variable DATABASE_URL. En local levantá Postgres con "docker compose up -d db" y copiá .env.example a .env',
      )
    }
    globalForDb._pool = new Pool({
      connectionString,
      // Easypanel expone Postgres dentro de la red interna sin TLS.
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      max: 10,
    })
  }
  return globalForDb._pool
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS casos (
  id              TEXT PRIMARY KEY,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  cerrado_en      TIMESTAMPTZ,
  estado          TEXT NOT NULL DEFAULT 'abierto',
  poliza          TEXT,
  patente         TEXT,
  asegurado       TEXT,
  telefono        TEXT,
  respuestas      JSONB NOT NULL DEFAULT '{}'::jsonb,
  gps             JSONB,
  direccion       TEXT,
  clima           JSONB,
  consistencia    JSONB,
  hash_maestro    TEXT,
  sello           JSONB
);

-- Log append-only. Cada fila encadena con el hash de la anterior del mismo caso.
CREATE TABLE IF NOT EXISTS eventos (
  id          BIGSERIAL PRIMARY KEY,
  caso_id     TEXT NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  ts          TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo        TEXT NOT NULL,
  detalle     JSONB NOT NULL DEFAULT '{}'::jsonb,
  hash_previo TEXT,
  hash        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS eventos_caso_idx ON eventos (caso_id, id);

CREATE TABLE IF NOT EXISTS medias (
  id            TEXT PRIMARY KEY,
  caso_id       TEXT NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  tipo          TEXT NOT NULL,
  guia_id       TEXT,
  archivo       TEXT NOT NULL,
  mime          TEXT NOT NULL,
  bytes         INTEGER NOT NULL,
  sha256        TEXT NOT NULL,
  gps           JSONB,
  capturado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS medias_caso_idx ON medias (caso_id);

CREATE TABLE IF NOT EXISTS testigos (
  id              TEXT PRIMARY KEY,
  caso_id         TEXT NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  nombre          TEXT NOT NULL,
  dni             TEXT,
  telefono        TEXT,
  relato          TEXT,
  consentimiento  BOOLEAN NOT NULL DEFAULT false,
  gps             JSONB,
  creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
  sha256          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS testigos_caso_idx ON testigos (caso_id);

-- Impide reescribir la historia: los eventos no se actualizan ni se borran.
CREATE OR REPLACE FUNCTION eventos_solo_insercion() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'La tabla de eventos es append-only: no admite UPDATE ni DELETE';
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eventos_inmutables ON eventos;
CREATE TRIGGER eventos_inmutables
  BEFORE UPDATE OR DELETE ON eventos
  FOR EACH ROW EXECUTE FUNCTION eventos_solo_insercion();
`

/** Crea el esquema si no existe. Se ejecuta una sola vez por proceso. */
export function asegurarEsquema(): Promise<void> {
  if (!globalForDb._schemaLista) {
    globalForDb._schemaLista = pool()
      .query(SCHEMA)
      .then(() => undefined)
      .catch((err) => {
        // Si falla, permitimos reintentar en la próxima request.
        globalForDb._schemaLista = undefined
        throw err
      })
  }
  return globalForDb._schemaLista
}

export async function db() {
  await asegurarEsquema()
  return pool()
}

/** Identificador corto y legible para dictar por teléfono: ADS-7K2M4Q */
export function nuevoId(prefijo = 'ADS'): string {
  const alfabeto = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ' // sin 0/O/1/I
  let s = ''
  const bytes = new Uint8Array(6)
  crypto.getRandomValues(bytes)
  for (const b of bytes) s += alfabeto[b % alfabeto.length]
  return `${prefijo}-${s}`
}
