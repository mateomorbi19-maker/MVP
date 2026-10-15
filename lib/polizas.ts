import { db, nuevoId } from './db'
import type { Sesion } from './sesion'

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
  contactos: ContactosPoliza
  estado_cuenta: EstadoCuenta | null
}

export interface ContactosPoliza {
  productor_nombre: string | null
  productor_email: string | null
  productor_telefono: string | null
  aseguradora_email: string | null
  aseguradora_telefono: string | null
}

export interface EstadoCuenta {
  fecha: string
  origen: string
  modalidad: string
  saldo: number | null
  movimientos: { fecha: string; concepto: string; importe: number }[]
}

export class ErrorPoliza extends Error {}

export function puedeGestionarPoliza(
  sesion: Pick<Sesion, 'usuario_id' | 'rol'>,
  poliza: { usuario_id: string; productor_usuario_id?: string | null; productor_activo?: boolean },
) {
  return poliza.usuario_id === sesion.usuario_id || sesion.rol === 'aseguradora' ||
    (sesion.rol === 'productor' && poliza.productor_activo === true && poliza.productor_usuario_id === sesion.usuario_id)
}

export async function leerCuentaPolizaGestion(sesion: Pick<Sesion, 'usuario_id' | 'rol'>, casoId: string): Promise<{ id: string; numero: string; aseguradora: string; estado_cuenta: EstadoCuenta | null } | null> {
  const pg = await db()
  const res = await pg.query(`SELECT po.*, pr.usuario_id AS productor_usuario_id, pr.activo AS productor_activo
    FROM polizas po LEFT JOIN productores pr ON pr.id = po.productor_id
    JOIN casos c ON c.poliza_id = po.id WHERE c.id = $1`, [casoId])
  const p = res.rows[0]
  if (!p || !puedeGestionarPoliza(sesion, p)) return null
  return { id: p.id, numero: p.numero, aseguradora: p.aseguradora, estado_cuenta: p.estado_cuenta ?? null }
}

const texto = (v: unknown, largo: number): string | null => {
  if (typeof v !== 'string') return null
  const s = v.trim().slice(0, largo)
  return s.length ? s : null
}

const fecha = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v) {
    throw new ErrorPoliza('Ingresá una fecha completa y válida, como 2026-10-15.')
  }
  return v
}

export function limpiarDatosPoliza(entrada: Record<string, unknown>) {
  const numero = texto(entrada.numero, 120)
  const aseguradora = texto(entrada.aseguradora, 120)
  if (!numero) throw new ErrorPoliza('Falta el número de póliza.')
  if (!aseguradora) throw new ErrorPoliza('Falta la aseguradora.')
  const desde = fecha(entrada.vigencia_desde)
  const hasta = fecha(entrada.vigencia_hasta)
  if (desde && hasta && hasta < desde) throw new ErrorPoliza('La vigencia final tiene que ser igual o posterior a la inicial.')
  const anio = entrada.anio === '' || entrada.anio === null || entrada.anio === undefined ? null : Number(entrada.anio)
  if (anio !== null && (!Number.isInteger(anio) || anio < 1900 || anio > new Date().getFullYear() + 2)) throw new ErrorPoliza('Ingresá un año del vehículo entre 1900 y los próximos dos años.')
  const contactos = Object.fromEntries(['productor_nombre', 'productor_email', 'productor_telefono', 'aseguradora_email', 'aseguradora_telefono'].map((clave) => [clave, texto(entrada[clave], 200)])) as unknown as ContactosPoliza
  for (const email of [contactos.productor_email, contactos.aseguradora_email]) {
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ErrorPoliza('Revisá el email del productor o de la aseguradora.')
  }
  return { numero, aseguradora, patente: texto(entrada.patente, 15)?.replace(/[\s-]/g, '').toUpperCase() ?? null, marca_modelo: texto(entrada.marca_modelo, 120), anio, cobertura: texto(entrada.cobertura, 120), vigencia_desde: desde, vigencia_hasta: hasta, contactos }
}

export function limpiarEstadoCuenta(entrada: Record<string, unknown>): EstadoCuenta {
  const dia = fecha(entrada.fecha)
  const origen = texto(entrada.origen, 200)
  const modalidad = texto(entrada.modalidad, 120)
  if (!dia || !origen || !modalidad) throw new ErrorPoliza('Completá la fecha del estado de cuenta, el origen de los datos y la modalidad de pago.')
  const importe = (v: unknown): number => {
    if ((typeof v !== 'number' && typeof v !== 'string') || String(v).trim() === '' || !Number.isFinite(Number(v)) || Math.abs(Number(v)) > 1e12) throw new ErrorPoliza('Ingresá un importe numérico válido, con punto para los centavos.')
    return Math.round(Number(v) * 100) / 100
  }
  if (!Array.isArray(entrada.movimientos) || entrada.movimientos.length > 100) throw new ErrorPoliza('Cargá como máximo 100 movimientos por estado de cuenta.')
  const movimientos = entrada.movimientos.map((v: unknown) => {
    const m = v && typeof v === 'object' ? v as Record<string, unknown> : {}
    const fechaMovimiento = fecha(m.fecha)
    const concepto = texto(m.concepto, 200)
    if (!fechaMovimiento || !concepto) throw new ErrorPoliza('Cada movimiento necesita fecha y concepto.')
    return { fecha: fechaMovimiento, concepto, importe: importe(m.importe) }
  })
  return { fecha: dia, origen, modalidad, saldo: entrada.saldo === '' || entrada.saldo === null || entrada.saldo === undefined ? null : importe(entrada.saldo), movimientos }
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
    contactos: f.contactos ?? {},
    estado_cuenta: f.estado_cuenta ?? null,
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
  const datos = limpiarDatosPoliza(entrada)
  const pg = await db()
  const cliente = await pg.connect()
  const id = nuevoId('POL')
  try {
    await cliente.query('BEGIN')
    // Serializa altas de una misma persona para mantener una sola principal.
    await cliente.query('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [usuarioId])
    const cuantas = await cliente.query('SELECT count(*)::int AS n FROM polizas WHERE usuario_id = $1', [usuarioId])
    const pr = datos.contactos.productor_email ? await cliente.query('SELECT id FROM productores WHERE lower(email) = lower($1)', [datos.contactos.productor_email]) : null
    await cliente.query(
      `INSERT INTO polizas (id, usuario_id, numero, aseguradora, patente, marca_modelo, anio, cobertura,
                            vigencia_desde, vigencia_hasta, productor_id, principal, contactos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [id, usuarioId, datos.numero, datos.aseguradora, datos.patente, datos.marca_modelo, datos.anio,
        datos.cobertura, datos.vigencia_desde, datos.vigencia_hasta, pr?.rows[0]?.id ?? null, cuantas.rows[0].n === 0, JSON.stringify(datos.contactos)],
    )
    await cliente.query('INSERT INTO cambios_poliza (id, poliza_id, usuario_id, origen, anterior, actual) VALUES ($1,$2,$3,$4,$5,$6)', [nuevoId('CAM'), id, usuarioId, 'Alta manual del titular', '{}', JSON.stringify(datos)])
    await cliente.query('COMMIT')
    return id
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    if ((err as { code?: string })?.code === '23505') throw new ErrorPoliza('Ya cargaste una póliza con ese número.')
    throw err
  } finally {
    cliente.release()
  }
}

/** Los cambios declarados quedan fuera de cualquier expediente ya sellado. */
export async function actualizarPoliza(usuarioId: string, polizaId: string, entrada: Record<string, unknown>, cuenta = false, actor?: Pick<Sesion, 'usuario_id' | 'rol'>): Promise<void> {
  const pg = await db()
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    const res = await cliente.query(`SELECT po.*, pr.usuario_id AS productor_usuario_id, pr.activo AS productor_activo
      FROM polizas po LEFT JOIN productores pr ON pr.id = po.productor_id
      WHERE po.id = $1 AND (po.usuario_id = $2 OR $3) FOR UPDATE OF po`, [polizaId, usuarioId, cuenta && Boolean(actor)])
    const anterior = res.rows[0]
    if (!anterior || (cuenta && actor && !puedeGestionarPoliza(actor, anterior))) throw new ErrorPoliza('Elegí una póliza de tu cuenta o asignada a tu productor.')
    let actual: unknown
    if (cuenta) {
      actual = limpiarEstadoCuenta(entrada)
      await cliente.query('UPDATE polizas SET estado_cuenta = $1, actualizado_en = now() WHERE id = $2', [JSON.stringify(actual), polizaId])
    } else {
      const d = limpiarDatosPoliza(entrada)
      actual = d
      // Al editar el correo se actualiza su asociación con la ficha del productor.
      const productor = d.contactos.productor_email ? await cliente.query('SELECT id FROM productores WHERE lower(email) = lower($1)', [d.contactos.productor_email]) : null
      await cliente.query(`UPDATE polizas SET numero=$1, aseguradora=$2, patente=$3, marca_modelo=$4, anio=$5,
        cobertura=$6, vigencia_desde=$7, vigencia_hasta=$8, contactos=$9, productor_id=$10, actualizado_en=now() WHERE id=$11`,
      [d.numero, d.aseguradora, d.patente, d.marca_modelo, d.anio, d.cobertura, d.vigencia_desde, d.vigencia_hasta, JSON.stringify(d.contactos), productor?.rows[0]?.id ?? null, polizaId])
    }
    await cliente.query('INSERT INTO cambios_poliza (id, poliza_id, usuario_id, origen, anterior, actual) VALUES ($1,$2,$3,$4,$5,$6)',
      [nuevoId('CAM'), polizaId, actor?.usuario_id ?? usuarioId, cuenta ? `Estado de cuenta manual: ${actor?.rol ?? 'asegurado'}` : 'Edición manual del titular', JSON.stringify(cuenta ? anterior.estado_cuenta ?? {} : anterior), JSON.stringify(actual)])
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    if ((err as { code?: string })?.code === '23505') throw new ErrorPoliza('Ya cargaste una póliza con ese número.')
    throw err
  } finally {
    cliente.release()
  }
}

export async function listarCambiosPoliza(usuarioId: string, polizaId: string) {
  const pg = await db()
  const propia = await pg.query('SELECT id FROM polizas WHERE id = $1 AND usuario_id = $2', [polizaId, usuarioId])
  if (!propia.rows[0]) throw new ErrorPoliza('Elegí una póliza de tu cuenta.')
  const res = await pg.query('SELECT id, origen, anterior, actual, creado_en FROM cambios_poliza WHERE poliza_id = $1 ORDER BY creado_en DESC LIMIT 100', [polizaId])
  return res.rows
}

/** Marca una póliza como principal y baja la anterior, en una sola transacción. */
export async function marcarPrincipal(usuarioId: string, polizaId: string): Promise<void> {
  const pg = await db()
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    await cliente.query('SELECT id FROM usuarios WHERE id = $1 FOR UPDATE', [usuarioId])
    const propia = await cliente.query('SELECT principal FROM polizas WHERE id = $1 AND usuario_id = $2 FOR UPDATE', [polizaId, usuarioId])
    if (!propia.rows[0]) throw new ErrorPoliza('Elegí una póliza de tu cuenta.')
    if (propia.rows[0].principal) {
      await cliente.query('COMMIT')
      return
    }
    const anteriores = await cliente.query('SELECT id FROM polizas WHERE usuario_id = $1 AND principal = true', [usuarioId])
    await cliente.query('UPDATE polizas SET principal = false WHERE usuario_id = $1', [usuarioId])
    const res = await cliente.query('UPDATE polizas SET principal = true, actualizado_en = now() WHERE id = $1 AND usuario_id = $2', [
      polizaId,
      usuarioId,
    ])
    if (res.rowCount === 0) throw new ErrorPoliza('Esa póliza no es tuya.')
    for (const [id, anterior, actual] of [[polizaId, false, true], ...anteriores.rows.map((f) => [f.id, true, false])] as [string, boolean, boolean][]) {
      await cliente.query('INSERT INTO cambios_poliza (id, poliza_id, usuario_id, origen, anterior, actual) VALUES ($1,$2,$3,$4,$5,$6)',
        [nuevoId('CAM'), id, usuarioId, 'Selección manual de póliza principal', JSON.stringify({ principal: anterior }), JSON.stringify({ principal: actual })])
    }
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
