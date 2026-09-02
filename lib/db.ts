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

-- La firma entra como una media más para que la cadena de custodia y el manifiesto la
-- incorporen sin código nuevo. Lo que 'tipo' no alcanza a decir es QUIÉN firmó y SOBRE QUÉ
-- contenido exacto: sin el hash del acta, la firma es un dibujo suelto.
ALTER TABLE medias ADD COLUMN IF NOT EXISTS firmante     TEXT;
ALTER TABLE medias ADD COLUMN IF NOT EXISTS hash_firmado TEXT;

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

-- ===================== Identidad =====================
--
-- El circuito anónimo NO pasa por acá: /s/[id] sigue funcionando por posesión del id, y
-- el botón "Tuve un accidente" no pide nada. Estas tablas habilitan la mitad
-- identificada del producto —panel, historial, póliza, entrega al productor— y cierran
-- lo que hoy está abierto.

CREATE TABLE IF NOT EXISTS usuarios (
  id             TEXT PRIMARY KEY,
  dni            TEXT NOT NULL,
  clave_hash     TEXT NOT NULL,
  nombre         TEXT,
  telefono       TEXT,
  email          TEXT,
  rol            TEXT NOT NULL DEFAULT 'asegurado',
  intentos       SMALLINT NOT NULL DEFAULT 0,
  bloqueado_hasta TIMESTAMPTZ,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_acceso  TIMESTAMPTZ,
  CONSTRAINT usuarios_rol_valido CHECK (rol IN ('asegurado', 'productor', 'aseguradora'))
);
CREATE UNIQUE INDEX IF NOT EXISTS usuarios_dni_uidx ON usuarios (dni);

-- Se guarda el HASH del token, no el token. Si alguien lee la tabla no puede hacerse
-- pasar por nadie: es la misma razón por la que no se guardan contraseñas en claro.
CREATE TABLE IF NOT EXISTS sesiones (
  token_sha256 TEXT PRIMARY KEY,
  usuario_id   TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_en    TIMESTAMPTZ NOT NULL,
  user_agent   TEXT
);
CREATE INDEX IF NOT EXISTS sesiones_usuario_idx ON sesiones (usuario_id);
CREATE INDEX IF NOT EXISTS sesiones_expira_idx ON sesiones (expira_en);

-- Qué navegador tiene el id de qué actuación.
--
-- Es el nivel de acceso más bajo y el que sostiene el circuito anónimo: sin esto,
-- cerrar el panel sería puro teatro, porque GET /api/media/[id] entrega cualquier
-- fotografía del choque a quien adivine un IMG-XXXXXX.
--
-- La clave primaria es compuesta a propósito: un mismo teléfono puede tener abiertas
-- dos actuaciones, y el enlace de una actuación se puede abrir desde otro dispositivo
-- —el README promete retomar desde el mismo enlace—.
CREATE TABLE IF NOT EXISTS posesiones (
  caso_id      TEXT NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  token_sha256 TEXT NOT NULL,
  creado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultimo_uso   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (caso_id, token_sha256)
);

-- Bitácora administrativa. NO es la cadena de custodia.
--
-- Todo lo que ocurre DESPUÉS del sellado va acá y no a eventos: un eslabón nuevo
-- cambiaría el hash maestro que recalcula el verificador público, y un expediente
-- intacto pasaría a informarse como alterado, para siempre.
CREATE TABLE IF NOT EXISTS bitacora (
  id         BIGSERIAL PRIMARY KEY,
  ts         TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo       TEXT NOT NULL,
  caso_id    TEXT REFERENCES casos(id) ON DELETE SET NULL,
  usuario_id TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  detalle    JSONB NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS bitacora_caso_idx ON bitacora (caso_id, id);

-- Enganche de la actuación con la cuenta.
--
-- El secreto de apertura se devuelve UNA sola vez, en el alta, y es la única prueba que
-- se acepta para reclamar una actuación anónima. El id no alcanza: se dicta por
-- teléfono, se imprime en el expediente y viaja dentro del QR que escanea un testigo.
ALTER TABLE casos ADD COLUMN IF NOT EXISTS usuario_id     TEXT REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE casos ADD COLUMN IF NOT EXISTS productor_id   TEXT REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE casos ADD COLUMN IF NOT EXISTS secreto_sha256 TEXT;
CREATE INDEX IF NOT EXISTS casos_usuario_idx   ON casos (usuario_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS casos_productor_idx ON casos (productor_id, creado_en DESC);

-- ===================== Póliza y productor =====================

-- El productor existe como destinatario ANTES de tener cuenta: la aseguradora carga su
-- ficha para poder asignarlo, y recién cuando se le abre el acceso al panel se le crea el
-- usuario y se lo enlaza acá. Por eso es una tabla propia con usuario_id opcional, y no
-- un usuario con rol 'productor' a secas.
CREATE TABLE IF NOT EXISTS productores (
  id          TEXT PRIMARY KEY,
  nombre      TEXT NOT NULL,
  email       TEXT NOT NULL,
  telefono    TEXT,
  aseguradora TEXT NOT NULL,
  usuario_id  TEXT REFERENCES usuarios(id) ON DELETE SET NULL,
  activo      BOOLEAN NOT NULL DEFAULT true,
  creado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS productores_email_uidx   ON productores (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS productores_usuario_uidx ON productores (usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS polizas (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  numero         TEXT NOT NULL,
  aseguradora    TEXT NOT NULL,
  patente        TEXT,
  marca_modelo   TEXT,
  anio           SMALLINT,
  cobertura      TEXT,
  vigencia_desde DATE,
  vigencia_hasta DATE,
  productor_id   TEXT REFERENCES productores(id) ON DELETE SET NULL,
  principal      BOOLEAN NOT NULL DEFAULT false,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS polizas_usuario_idx   ON polizas (usuario_id);
CREATE INDEX IF NOT EXISTS polizas_productor_idx ON polizas (productor_id);
-- La unicidad NO es global: dos personas pueden ser titular y cónyuge de la misma póliza.
CREATE UNIQUE INDEX IF NOT EXISTS polizas_numero_uidx    ON polizas (usuario_id, upper(numero));
-- Una sola principal por persona: es la que precarga la carátula de una actuación nueva.
CREATE UNIQUE INDEX IF NOT EXISTS polizas_principal_uidx ON polizas (usuario_id) WHERE principal;

-- Cédula verde, licencia, VTV, la póliza en PDF. Van con carpeta y lista blanca propias:
-- sumarle application/pdf a la lista de las fotos del siniestro permitiría subir un PDF
-- como 'fotografía del hecho', y entraría al manifiesto como pieza fotográfica.
CREATE TABLE IF NOT EXISTS documentos_poliza (
  id        TEXT PRIMARY KEY,
  poliza_id TEXT NOT NULL REFERENCES polizas(id) ON DELETE CASCADE,
  tipo      TEXT NOT NULL,
  titulo    TEXT,
  archivo   TEXT NOT NULL,
  mime      TEXT NOT NULL,
  bytes     INTEGER NOT NULL,
  sha256    TEXT NOT NULL,
  vence_el  DATE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS documentos_poliza_idx ON documentos_poliza (poliza_id, creado_en DESC);

-- Contacto de confianza para el escalamiento por impacto.
-- Es un dato personal de alguien que NO está presente para consentir su tratamiento: se
-- guarda el mínimo, se usa sólo para eso, y no entra al expediente ni al PDF.
CREATE TABLE IF NOT EXISTS contactos_confianza (
  id             TEXT PRIMARY KEY,
  usuario_id     TEXT NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  telefono       TEXT NOT NULL,
  relacion       TEXT,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Uno por persona en esta versión. Es un índice y no una clave primaria: el día que haga
-- falta un segundo contacto se borra el índice y no se migra nada.
CREATE UNIQUE INDEX IF NOT EXISTS contactos_confianza_usuario_uidx ON contactos_confianza (usuario_id);

ALTER TABLE casos ADD COLUMN IF NOT EXISTS poliza_id TEXT REFERENCES polizas(id) ON DELETE SET NULL;

-- El croquis del hecho. Columna propia y no una respuesta más del cuestionario: respuestas
-- es un mapa plano de id a escalar que el PDF, el panel y el motor de consistencia
-- imprimen como texto, y un objeto anidado ahí sale como [object Object] en el expediente.
ALTER TABLE casos ADD COLUMN IF NOT EXISTS croquis JSONB;

-- ===================== El tercero =====================
--
-- El tercero NO es un testigo y no comparte tabla con él: es la contraparte del hecho.
-- Contarlo entre los testigos apagaría el hallazgo «Sin testigos registrados» —justamente
-- con la persona con la que se chocó— y lo imprimiría bajo «Testigos registrados» en el
-- expediente, que es materialmente falso.
--
-- Estos datos los carga el TERCERO desde su propio teléfono y son distintos de
-- tercero_datos, tercero_patente y tercero_aseguradora, que los declara el asegurado.
CREATE TABLE IF NOT EXISTS terceros (
  id             TEXT PRIMARY KEY,
  caso_id        TEXT NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  nombre         TEXT NOT NULL,
  dni            TEXT,
  telefono       TEXT,
  domicilio      TEXT,
  patente        TEXT,
  marca_modelo   TEXT,
  aseguradora    TEXT,
  poliza         TEXT,
  licencia       TEXT,
  -- Consentimiento expreso y separado, art. 5 de la Ley 25.326. Sin esto no se le lee
  -- ningún documento con la lectura automática: el titular del dato es él, y el asegurado
  -- no puede consentir por él.
  consentimiento BOOLEAN NOT NULL DEFAULT false,
  -- 'del_tercero' cuando lo cargó él; 'del_asegurado' cuando se usó el teléfono del otro.
  dispositivo    TEXT NOT NULL DEFAULT 'del_tercero',
  gps            JSONB,
  creado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
  sha256         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS terceros_caso_idx ON terceros (caso_id, creado_en);

-- ===================== Lectura automática =====================
--
-- campos es la afirmación de la MÁQUINA y no se reescribe nunca. confirmacion es lo
-- que resolvió la persona, campo por campo. Sólo lo segundo se copia a casos.respuestas.
-- La distinción no es prolijidad: una lectura automática no es una declaración del
-- asegurado, y el expediente tiene que poder mostrar las dos cosas por separado.
CREATE TABLE IF NOT EXISTS extracciones (
  id               TEXT PRIMARY KEY,
  caso_id          TEXT NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  media_id         TEXT NOT NULL REFERENCES medias(id) ON DELETE CASCADE,
  guia_id          TEXT,
  tipo_documento   TEXT NOT NULL,
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  proveedor        TEXT NOT NULL,
  simulado         BOOLEAN NOT NULL DEFAULT false,
  campos           JSONB NOT NULL DEFAULT '[]'::jsonb,
  confianza_global REAL,
  error            TEXT,
  confirmacion     JSONB,
  creado_en        TIMESTAMPTZ NOT NULL DEFAULT now(),
  procesado_en     TIMESTAMPTZ,
  confirmado_en    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS extracciones_caso_idx ON extracciones (caso_id, creado_en);
-- Una foto se lee una sola vez. Repetir la toma crea otra media y otra lectura, y en
-- pantalla gana la última: el mismo criterio que ya usa la pantalla de fotos.
CREATE UNIQUE INDEX IF NOT EXISTS extracciones_media_idx ON extracciones (media_id);

-- ===================== Entrega y tramitación =====================
--
-- NINGÚN registro de entrega ni de gestión entra en la tabla de eventos, y la razón es
-- concreta: el verificador público recalcula el manifiesto sobre TODOS los eventos del
-- caso y lo compara contra el hash sellado. Un solo eslabón posterior al cierre convertiría
-- "expediente íntegro" en "el expediente fue modificado después de cerrarse" en TODA
-- actuación entregada o comentada.
--
-- Se consideró y se descartó cortar el manifiesto en el eslabón de cierre: sería
-- retrocompatible, pero rompe una propiedad hoy limpia —que cualquier fila agregada a
-- eventos rompe la verificación— y con el corte alguien con escritura en la base podría
-- apilar filas con pinta de eventos del acta sin que la verificación lo note.

CREATE TABLE IF NOT EXISTS envios (
  id                 TEXT PRIMARY KEY,
  caso_id            TEXT NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  destinatario       TEXT NOT NULL,
  productor_id       TEXT REFERENCES productores(id) ON DELETE SET NULL,
  canal              TEXT NOT NULL DEFAULT 'email',
  estado             TEXT NOT NULL DEFAULT 'pendiente',
  intentos           SMALLINT NOT NULL DEFAULT 0,
  error              TEXT,
  token_sha256       TEXT,
  expira_en          TIMESTAMPTZ,
  abierto_en         TIMESTAMPTZ,
  creado_en          TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_en         TIMESTAMPTZ,
  proximo_intento_en TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS envios_caso_idx      ON envios (caso_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS envios_pendientes_idx ON envios (proximo_intento_en) WHERE estado = 'pendiente';

-- La tramitación, con cadena propia anclada al hash maestro del acta.
-- Queda auditada y atada al expediente, pero FUERA de él. Los comentarios del productor
-- son prueba de un tercero sobre el trámite, no del hecho, y al asegurado se le prometió
-- que el expediente ya no admite cambios.
CREATE TABLE IF NOT EXISTS gestiones (
  id           BIGSERIAL PRIMARY KEY,
  caso_id      TEXT NOT NULL REFERENCES casos(id) ON DELETE CASCADE,
  ts           TIMESTAMPTZ NOT NULL DEFAULT now(),
  tipo         TEXT NOT NULL,
  actor        TEXT,
  detalle      JSONB NOT NULL DEFAULT '{}'::jsonb,
  hash_previo  TEXT,
  hash         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS gestiones_caso_idx ON gestiones (caso_id, id);

ALTER TABLE casos ADD COLUMN IF NOT EXISTS estado_gestion TEXT NOT NULL DEFAULT 'sin_enviar';
CREATE INDEX IF NOT EXISTS casos_gestion_idx ON casos (estado_gestion);

-- Los expedientes sellados antes de que existiera la columna arrancan como no enviados.
-- El WHERE lo hace idempotente: en el segundo arranque no toca ninguna fila.
UPDATE casos SET estado_gestion = 'sin_enviar'
 WHERE estado = 'cerrado' AND estado_gestion IS DISTINCT FROM 'sin_enviar' AND estado_gestion = '';

-- Impide reescribir la historia: los eventos no se actualizan ni se borran.
-- UNA sola definición, que sirve a las dos tablas append-only. Con una función por tabla,
-- cualquiera que la redefiniera después en este mismo string ganaría en silencio: SCHEMA
-- se ejecuta como una sola consulta multi-sentencia y Postgres se queda con la última.
CREATE OR REPLACE FUNCTION eventos_solo_insercion() RETURNS trigger AS $fn$
BEGIN
  RAISE EXCEPTION 'La tabla % es append-only: no admite UPDATE ni DELETE. Para corregir algo, registrá una entrada nueva.', TG_TABLE_NAME;
END;
$fn$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eventos_inmutables ON eventos;
CREATE TRIGGER eventos_inmutables
  BEFORE UPDATE OR DELETE ON eventos
  FOR EACH ROW EXECUTE FUNCTION eventos_solo_insercion();

DROP TRIGGER IF EXISTS gestiones_inmutables ON gestiones;
CREATE TRIGGER gestiones_inmutables
  BEFORE UPDATE OR DELETE ON gestiones
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
export const TABLAS = ['casos', 'eventos', 'medias', 'testigos', 'usuarios', 'sesiones', 'posesiones', 'bitacora', 'productores', 'polizas', 'documentos_poliza', 'contactos_confianza', 'terceros', 'extracciones', 'envios', 'gestiones'] as const

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
