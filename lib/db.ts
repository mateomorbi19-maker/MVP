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
      return new ErrorBaseDeDatos(
        'Usuario o contraseña incorrectos en DATABASE_URL. Las dos causas más frecuentes son una contraseña con caracteres que la URL se come si no van codificados (#, ?, / y @), y —en Supabase con el pooler— haber puesto el usuario "postgres" en lugar de "postgres.<referencia-del-proyecto>". El log del servidor dice a qué usuario y host se está intentando conectar.',
        'autenticacion',
      )
    case '3D000':
      return new ErrorBaseDeDatos('La base indicada en DATABASE_URL no existe.', 'sin_configurar')
    default:
      return null
  }
}

/**
 * A qué usuario y host apunta DATABASE_URL, sin la contraseña.
 *
 * Va únicamente al log del servidor. En la respuesta de /api/salud, que es pública,
 * esto le estaría diciendo a cualquiera dónde vive la base y con qué usuario entrar.
 *
 * Avisa aparte si la contraseña trae caracteres sin codificar: la URL se corta en el
 * primer '#', '?' o '/', así que la contraseña llega incompleta y Postgres responde
 * exactamente lo mismo que si estuviera equivocada. Es la causa más común y la más
 * difícil de ver, porque en el panel de Easypanel la variable se ve entera y correcta.
 */
export function destinoBase(): string {
  const url = process.env.DATABASE_URL
  if (!url) return 'sin DATABASE_URL'

  const inicio = url.indexOf('://')
  const fin = url.lastIndexOf('@')
  if (inicio < 0 || fin < inicio) return 'DATABASE_URL ilegible: no tiene la forma postgres://usuario:clave@host:puerto/base'

  const credenciales = url.slice(inicio + 3, fin)
  const usuario = credenciales.split(':')[0]
  const clave = credenciales.slice(usuario.length + 1)
  const sinCodificar = [...new Set(clave.match(/[#?/@]/g) ?? [])]

  const aviso = sinCodificar.length
    ? `  <-- la contraseña contiene ${sinCodificar.map((c) => `"${c}"`).join(' y ')} sin codificar: la URL se corta ahí y la clave llega incompleta`
    : ''
  return `${usuario}@${url.slice(fin + 1)}${aviso}`
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

-- Con qué formato de manifiesto se selló esta actuación. Ver VERSION_MANIFIESTO en
-- lib/hash.ts: sólo desde '1.1' el nombre del testigo queda fuera del hash maestro y
-- por lo tanto se puede suprimir sin romper la verificación. El DEFAULT '1.0' es para
-- las filas que ya existían; las nuevas lo escriben explícitamente en el alta.
ALTER TABLE casos ADD COLUMN IF NOT EXISTS manifiesto_version TEXT NOT NULL DEFAULT '1.0';

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

/**
 * Las tablas que el esquema tiene que haber creado.
 *
 * Es una lista y no un número a propósito: con un total, agregar una tabla obliga a
 * acordarse de subir el contador en dos archivos, y si alguien no lo hace /api/salud
 * informa "esquema creado" aunque la tabla nueva haya fallado —que es exactamente el
 * escenario que ese endpoint existe para detectar—.
 */
export const TABLAS = ['casos', 'eventos', 'medias', 'testigos'] as const

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
  faltan?: string[]
}> {
  try {
    const pg = await db()
    const version = await pg.query<{ v: string }>('SELECT version() AS v')
    const presentes = await pg.query<{ table_name: string }>(
      // table_name es un dominio sobre `name`, no text: el casteo explícito evita
      // depender de una coerción implícita que varía entre versiones de Postgres.
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name::text = ANY($1::text[])`,
      [[...TABLAS]],
    )
    const hay = new Set(presentes.rows.map((r) => r.table_name))
    const faltan = TABLAS.filter((t) => !hay.has(t))
    return {
      ok: faltan.length === 0,
      detalle:
        faltan.length === 0
          ? 'Base conectada y esquema creado.'
          : `La base responde pero le faltan tablas: ${faltan.join(', ')}. Reiniciá el servicio para que el esquema se vuelva a aplicar y mirá el log del arranque.`,
      causa: faltan.length === 0 ? undefined : 'sin_configurar',
      version: version.rows[0]?.v?.split(',')[0] ?? 'desconocida',
      tablas: hay.size,
      faltan,
    }
  } catch (err) {
    const traducido = traducirErrorBase(err)
    if (traducido) {
      if (traducido.causa === 'autenticacion') {
        console.error('[salud] la base rechazó las credenciales. Se intentó conectar como:', destinoBase())
      }
      return { ok: false, detalle: traducido.message, causa: traducido.causa }
    }
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
