import { db, nuevoId } from './db'

/**
 * Pólizas, productores y documentación del asegurado.
 *
 * Nada de esto toca la cadena de custodia: son los datos que la persona tiene siempre y
 * que no se pierden por irse del lugar del hecho. Su valor está en no tener que
 * escribirlos parado al lado del auto.
 */

export interface Productor {
  id: string
  nombre: string
  email: string
  telefono: string | null
  aseguradora: string
  usuario_id: string | null
  activo: boolean
}

export interface DocumentoPoliza {
  id: string
  tipo: string
  titulo: string | null
  mime: string
  bytes: number
  sha256: string
  vence_el: string | null
  creado_en: string
}

export interface Poliza {
  id: string
  usuario_id: string
  numero: string
  aseguradora: string
  patente: string | null
  marca_modelo: string | null
  anio: number | null
  cobertura: string | null
  vigencia_desde: string | null
  vigencia_hasta: string | null
  principal: boolean
  productor: Productor | null
  documentos: DocumentoPoliza[]
}

export class ErrorPoliza extends Error {}

const texto = (v: unknown, largo: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, largo)
  return s.length ? s : null
}

const fecha = (v: unknown): string | null => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null
  return v
}

const soloFecha = (v: unknown): string | null => (v ? new Date(v as string).toISOString().slice(0, 10) : null)

function mapearProductor(f: Record<string, unknown> | undefined): Productor | null {
  if (!f || !f.p_id) return null
  return {
    id: f.p_id as string,
    nombre: f.p_nombre as string,
    email: f.p_email as string,
    telefono: (f.p_telefono as string) ?? null,
    aseguradora: f.p_aseguradora as string,
    usuario_id: (f.p_usuario_id as string) ?? null,
    activo: Boolean(f.p_activo),
  }
}

export async function listarPolizas(usuarioId: string): Promise<Poliza[]> {
  const pg = await db()
  const res = await pg.query(
    `SELECT po.*,
            pr.id AS p_id, pr.nombre AS p_nombre, pr.email AS p_email, pr.telefono AS p_telefono,
            pr.aseguradora AS p_aseguradora, pr.usuario_id AS p_usuario_id, pr.activo AS p_activo
       FROM polizas po LEFT JOIN productores pr ON pr.id = po.productor_id
      WHERE po.usuario_id = $1
      ORDER BY po.principal DESC, po.creado_en ASC`,
    [usuarioId],
  )
  if (res.rows.length === 0) return []

  const docs = await pg.query(
    'SELECT * FROM documentos_poliza WHERE poliza_id = ANY($1) ORDER BY creado_en DESC',
    [res.rows.map((f) => f.id)],
  )

  return res.rows.map((f) => ({
    id: f.id,
    usuario_id: f.usuario_id,
    numero: f.numero,
    aseguradora: f.aseguradora,
    patente: f.patente ?? null,
    marca_modelo: f.marca_modelo ?? null,
    anio: f.anio ?? null,
    cobertura: f.cobertura ?? null,
    vigencia_desde: soloFecha(f.vigencia_desde),
    vigencia_hasta: soloFecha(f.vigencia_hasta),
    principal: Boolean(f.principal),
    productor: mapearProductor(f),
    documentos: docs.rows
      .filter((d) => d.poliza_id === f.id)
      .map((d) => ({
        id: d.id,
        tipo: d.tipo,
        titulo: d.titulo ?? null,
        mime: d.mime,
        bytes: d.bytes,
        sha256: d.sha256,
        vence_el: soloFecha(d.vence_el),
        creado_en: new Date(d.creado_en).toISOString(),
      })),
  }))
}

/**
 * Alta de póliza.
 *
 * `principal` la decide esta función y no el cliente: es true sólo si es la primera del
 * usuario. Con un DEFAULT true y el índice único parcial, la segunda póliza de una misma
 * persona chocaba contra el índice y devolvía un error de base — y tener dos pólizas es
 * un caso esperado, no una rareza.
 */
export async function crearPoliza(usuarioId: string, entrada: Record<string, unknown>): Promise<string> {
  const numero = texto(entrada.numero, 120)
  const aseguradora = texto(entrada.aseguradora, 120)
  if (!numero) throw new ErrorPoliza('Falta el número de póliza.')
  if (!aseguradora) throw new ErrorPoliza('Falta la aseguradora.')

  const pg = await db()
  const cuantas = await pg.query('SELECT count(*)::int AS n FROM polizas WHERE usuario_id = $1', [usuarioId])
  const esLaPrimera = (cuantas.rows[0]?.n ?? 0) === 0

  // El productor se enlaza sólo si ya existe: no se crean fichas desde acá, para no
  // llenar la tabla de datos de contacto sin confirmar.
  let productorId: string | null = null
  const email = texto(entrada.productor_email, 200)
  if (email) {
    const pr = await pg.query('SELECT id FROM productores WHERE lower(email) = lower($1)', [email])
    productorId = pr.rows[0]?.id ?? null
  }

  const patente = texto(entrada.patente, 15)
  const id = nuevoId('POL')
  try {
    await pg.query(
      `INSERT INTO polizas (id, usuario_id, numero, aseguradora, patente, marca_modelo, anio, cobertura,
                            vigencia_desde, vigencia_hasta, productor_id, principal)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
      [
        id,
        usuarioId,
        numero,
        aseguradora,
        patente ? patente.toUpperCase() : null,
        texto(entrada.marca_modelo, 120),
        Number.isInteger(Number(entrada.anio)) ? Number(entrada.anio) : null,
        texto(entrada.cobertura, 120),
        fecha(entrada.vigencia_desde),
        fecha(entrada.vigencia_hasta),
        productorId,
        esLaPrimera,
      ],
    )
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') {
      throw new ErrorPoliza('Ya cargaste una póliza con ese número.')
    }
    throw err
  }
  return id
}

/** Marca una póliza como principal y baja la anterior, en una sola transacción. */
export async function marcarPrincipal(usuarioId: string, polizaId: string): Promise<void> {
  const pg = await db()
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    await cliente.query('UPDATE polizas SET principal = false WHERE usuario_id = $1', [usuarioId])
    const res = await cliente.query('UPDATE polizas SET principal = true WHERE id = $1 AND usuario_id = $2', [
      polizaId,
      usuarioId,
    ])
    if (res.rowCount === 0) throw new ErrorPoliza('Esa póliza no es tuya.')
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }
}

export interface Precarga {
  poliza_id: string | null
  poliza: string | null
  patente: string | null
  asegurado: string | null
  telefono: string | null
  /** Hay más de una póliza y la persona no eligió: la patente NO se precarga. */
  ambigua: boolean
}

/**
 * Qué se puede precargar en la carátula de una actuación nueva.
 *
 * Con más de una póliza se precarga todo MENOS la patente. Precargar la del auto
 * principal cuando la persona chocó con el otro mete un dato falso en la carátula, y la
 * carátula termina dentro del expediente sellado y del informe de consistencia.
 */
export async function precargaDe(usuarioId: string): Promise<Precarga | null> {
  const pg = await db()
  const res = await pg.query(
    `SELECT po.id, po.numero, po.patente, po.principal, u.nombre, u.telefono
       FROM polizas po JOIN usuarios u ON u.id = po.usuario_id
      WHERE po.usuario_id = $1 ORDER BY po.principal DESC, po.creado_en ASC`,
    [usuarioId],
  )
  if (res.rows.length === 0) return null

  const elegida = res.rows[0]
  const ambigua = res.rows.length > 1
  return {
    poliza_id: elegida.id,
    poliza: elegida.numero,
    patente: ambigua ? null : (elegida.patente ?? null),
    asegurado: elegida.nombre ?? null,
    telefono: elegida.telefono ?? null,
    ambigua,
  }
}

export async function listarProductores(): Promise<Productor[]> {
  const pg = await db()
  const res = await pg.query('SELECT * FROM productores ORDER BY nombre ASC')
  return res.rows.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    email: f.email,
    telefono: f.telefono ?? null,
    aseguradora: f.aseguradora,
    usuario_id: f.usuario_id ?? null,
    activo: Boolean(f.activo),
  }))
}

export async function crearProductor(entrada: Record<string, unknown>): Promise<string> {
  const nombre = texto(entrada.nombre, 120)
  const email = texto(entrada.email, 200)
  const aseguradora = texto(entrada.aseguradora, 120)
  if (!nombre || !email || !aseguradora) throw new ErrorPoliza('Faltan el nombre, el email o la aseguradora.')

  const pg = await db()
  const id = nuevoId('PRD')
  try {
    await pg.query(
      'INSERT INTO productores (id, nombre, email, telefono, aseguradora, usuario_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, nombre, email, texto(entrada.telefono, 40), aseguradora, texto(entrada.usuario_id, 40)],
    )
  } catch (err) {
    if ((err as { code?: string })?.code === '23505') throw new ErrorPoliza('Ya hay un productor con ese email.')
    throw err
  }
  return id
}
