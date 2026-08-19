import { Pool } from 'pg'

/**
 * Pool de Postgres. En desarrollo Next.js recarga los módulos en caliente, así que
 * lo cacheamos en globalThis para no abrir una conexión nueva en cada recarga.
 */
const globalForDb = globalThis as unknown as { _pool?: Pool; _schemaLista?: Promise<void> }

/**
 * Error de configuración o de conexión a la base.
 *
 * Se distingue de un fallo cualquiera para poder mostrarle al operador qué tiene que
 * arreglar, en vez de un "algo salió mal" que no orienta a nadie. El mensaje no expone
 * credenciales: sólo dice qué falta.
 */
export class ErrorBaseDeDatos extends Error {
  constructor(
    message: string,
    readonly causa: 'sin_configurar' | 'inalcanzable' | 'autenticacion' | 'desconocida' = 'desconocida',
  ) {
    super(message)
    this.name = 'ErrorBaseDeDatos'
  }
}

/** Traduce los códigos de error de red y de Postgres a algo accionable. */
export function traducirErrorBase(err: unknown): ErrorBaseDeDatos | null {
  if (err instanceof ErrorBaseDeDatos) return err
  const codigo = (err as { code?: string })?.code
  switch (codigo) {
    case 'ECONNREFUSED':
      return new ErrorBaseDeDatos(
        'No hay ningún Postgres escuchando en la dirección de DATABASE_URL. Verificá que la base esté levantada y que el host y el puerto sean correctos.',
        'inalcanzable',
      )
    case 'ENOTFOUND':
    case 'EAI_AGAIN':
      return new ErrorBaseDeDatos(
        'No se pudo resolver el host de DATABASE_URL. Revisá que el nombre del servidor esté bien escrito.',
        'inalcanzable',
      )
    case 'ETIMEDOUT':
    case 'ECONNRESET':
      return new ErrorBaseDeDatos(
        'La conexión con la base se cortó por tiempo de espera. Si es una base en la nube, puede faltar habilitar TLS: probá con DATABASE_SSL=true.',
        'inalcanzable',
      )
    case '28P01':
    case '28000':
      return new ErrorBaseDeDatos('Usuario o contraseña incorrectos en DATABASE_URL.', 'autenticacion')
    case '3D000':
      return new ErrorBaseDeDatos('La base indicada en DATABASE_URL no existe.', 'sin_configurar')
    default:
      return null
  }
}

export function pool(): Pool {
  if (!globalForDb._pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new ErrorBaseDeDatos(
        'Falta la variable DATABASE_URL: no hay ninguna base configurada. En local, copiá .env.example a .env y apuntala a un Postgres. En Easypanel, cargala en las variables de entorno del servicio.',
        'sin_configurar',
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
  try {
    await asegurarEsquema()
    return pool()
  } catch (err) {
    const traducido = traducirErrorBase(err)
    throw traducido ?? err
  }
}

/** Comprobación de salud: ¿está la base configurada, alcanzable y con el esquema creado? */
export async function estadoBase(): Promise<{
  ok: boolean
  detalle: string
  causa?: string
  version?: string
  tablas?: number
}> {
  try {
    const pg = await db()
    const version = await pg.query<{ v: string }>('SELECT version() AS v')
    const tablas = await pg.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name IN ('casos','eventos','medias','testigos')`,
    )
    return {
      ok: true,
      detalle: 'Base conectada y esquema creado.',
      version: version.rows[0]?.v?.split(',')[0] ?? 'desconocida',
      tablas: Number(tablas.rows[0]?.n ?? 0),
    }
  } catch (err) {
    const traducido = traducirErrorBase(err)
    if (traducido) return { ok: false, detalle: traducido.message, causa: traducido.causa }
    return { ok: false, detalle: err instanceof Error ? err.message : 'Error desconocido.', causa: 'desconocida' }
  }
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
