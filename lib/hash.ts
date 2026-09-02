import { createHash, randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { db } from './db'

/**
 * Cadena de custodia.
 *
 * Cada acción sobre un expediente se registra como un evento cuyo hash incluye el hash
 * del evento anterior. Alterar o borrar cualquier eslabón rompe todos los siguientes,
 * y eso es detectable por cualquiera con el verificador público.
 *
 * IMPORTANTE — límite honesto de esta versión:
 * la firma es una firma ELECTRÓNICA de demostración (clave local del servidor).
 * Para tener firma DIGITAL en los términos de la Ley 25.506 —con presunción de autoría
 * e integridad de los arts. 7 y 8— hay que firmar con un certificado emitido por un
 * certificador licenciado (Encode, Lakaut, Box Custodia o Digilogix). Ver README.
 */

/** ¿Este evento trae datos reservados? Un objeto vacío no cuenta. */
function reservadoDe(opciones: OpcionesEvento): boolean {
  return Boolean(opciones.reservado && Object.keys(opciones.reservado).length > 0)
}

export function sha256(dato: string | Buffer | Uint8Array): string {
  return createHash('sha256').update(dato).digest('hex')
}

/**
 * Serialización canónica: claves ordenadas en todos los niveles.
 * Sin esto, dos objetos idénticos podrían producir hashes distintos según el orden
 * en que se armaron, y la verificación fallaría por un motivo que no es una alteración.
 */
export function canonico(valor: unknown): string {
  if (valor === null || valor === undefined) return 'null'
  if (typeof valor === 'number') return Number.isFinite(valor) ? String(valor) : 'null'
  if (typeof valor === 'boolean' || typeof valor === 'string') return JSON.stringify(valor)
  if (Array.isArray(valor)) return `[${valor.map(canonico).join(',')}]`
  if (typeof valor === 'object') {
    const obj = valor as Record<string, unknown>
    const claves = Object.keys(obj).sort()
    return `{${claves.map((k) => `${JSON.stringify(k)}:${canonico(obj[k])}`).join(',')}}`
  }
  return 'null'
}

export function hashEvento(entrada: {
  caso_id: string
  ts: string
  tipo: string
  detalle: unknown
  hash_previo: string | null
}): string {
  return sha256(
    [entrada.hash_previo ?? 'GENESIS', entrada.caso_id, entrada.ts, entrada.tipo, canonico(entrada.detalle)].join('|'),
  )
}

/**
 * La actuación ya fue sellada y no admite eslabones nuevos.
 *
 * Se distingue de un fallo cualquiera porque los route handlers la traducen a un 409,
 * que es lo que el cliente necesita para dejar de reintentar.
 */
export class ErrorActuacionCerrada extends Error {
  constructor(readonly casoId: string) {
    super('La actuación ya fue cerrada y sellada: no admite cambios.')
    this.name = 'ErrorActuacionCerrada'
  }
}

export interface OpcionesEvento {
  /**
   * Cliente de una transacción ya abierta por quien llama.
   *
   * Es lo que permite que el cierre registre sus dos eslabones y construya el
   * manifiesto dentro de la misma transacción, sin que se cuele nada en el medio.
   */
  cliente?: PoolClient
  /**
   * Datos personales que NO deben quedar dentro del preimagen del hash.
   *
   * Van a `eventos_reservados`, una tabla sin disparador de inmutabilidad, y en el detalle
   * del eslabón queda sólo el compromiso sha256(sal | canonico(reservado)). Así el dato se
   * puede borrar a pedido de su titular —art. 16 de la Ley 25.326— sin mover un solo hash,
   * y el compromiso sigue probando qué decía para quien todavía lo tenga.
   *
   * Regla práctica: nombre, teléfono, DNI, patente, póliza, domicilio, coordenadas exactas
   * y el contenido de las respuestas van reservados. Todo lo demás va en claro.
   */
  reservado?: Record<string, unknown>
}

/**
 * Registra un eslabón nuevo.
 *
 * Toma SELECT ... FOR UPDATE sobre el caso por dos motivos: para que dos requests
 * simultáneas no encadenen sobre el mismo eslabón previo, y para leer el estado dentro
 * del mismo lock. Lo segundo importa más de lo que parece: si la comprobación de
 * "¿está cerrada?" la hace el route handler antes de llamar acá, entre esa lectura y
 * esta escritura entra el cierre, y el eslabón queda fuera del manifiesto sellado. Desde
 * ahí el verificador público denuncia como alterado un expediente intacto, para siempre.
 */
export async function registrarEvento(
  casoId: string,
  tipo: string,
  detalle: Record<string, unknown> = {},
  opciones: OpcionesEvento = {},
): Promise<{ hash: string; id: number }> {
  /*
   * El cuarto parámetro era un PoolClient suelto. Si alguien pasa el viejo, `cliente`
   * queda undefined, se abre una conexión aparte y el eslabón se escribe FUERA de la
   * transacción de quien llama: si esa transacción hace ROLLBACK, queda un eslabón
   * encadenado que referencia algo que no existe. Falla ruidoso y en desarrollo.
   */
  if (opciones && typeof (opciones as { query?: unknown }).query === 'function') {
    throw new Error(
      'registrarEvento cambió de firma: pasá { cliente } como cuarto argumento en vez del PoolClient suelto.',
    )
  }

  const pg = await db()
  const cliente = opciones.cliente ?? (await pg.connect())
  const propio = !opciones.cliente
  try {
    if (propio) await cliente.query('BEGIN')

    /*
     * Un escritor que llega mientras el cierre tiene el caso bloqueado espera acá. Sin
     * tope esperaría indefinidamente, reteniendo una conexión del pool y una del pooler:
     * con varios escritores a la vez —el guardado automático, la cola de fotos, un testigo
     * que escanea el QR— eso agota el límite de conexiones del proyecto y la base empieza a
     * rechazar TODO, no sólo al que esperaba.
     *
     * Con tope, el que no alcanza el lock falla rápido y con un mensaje que se entiende, y
     * el cliente reintenta. Ocho segundos es holgado: el cierre ya no incluye la llamada
     * de red al sello de tiempo.
     */
    await cliente.query("SET LOCAL lock_timeout = '8s'")

    const caso = await cliente.query<{ estado: string }>(
      'SELECT estado FROM casos WHERE id = $1 FOR UPDATE',
      [casoId],
    )
    if (caso.rowCount === 0) throw new Error(`No existe la actuación ${casoId}.`)
    if (caso.rows[0].estado === 'cerrado') throw new ErrorActuacionCerrada(casoId)
    const previo = await cliente.query<{ hash: string }>(
      'SELECT hash FROM eventos WHERE caso_id = $1 ORDER BY id DESC LIMIT 1',
      [casoId],
    )
    const hashPrevio = previo.rows[0]?.hash ?? null
    const ts = new Date().toISOString()

    /*
     * El dato personal no entra al hash: entra su compromiso. La sal es por evento, así que
     * conocer el conjunto de valores posibles no permite adivinar cuál era por fuerza bruta
     * sobre el hash —que es exactamente el problema de comprometer un DNI o una patente,
     * donde el espacio de valores es chico—.
     */
    const sal = reservadoDe(opciones) ? randomBytes(16).toString('base64') : null
    const detalleFinal = sal
      ? { ...detalle, reservado_sha256: sha256(sal + '|' + canonico(opciones.reservado)) }
      : detalle

    const hash = hashEvento({ caso_id: casoId, ts, tipo, detalle: detalleFinal, hash_previo: hashPrevio })
    const res = await cliente.query<{ id: string }>(
      `INSERT INTO eventos (caso_id, ts, tipo, detalle, hash_previo, hash)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [casoId, ts, tipo, JSON.stringify(detalleFinal), hashPrevio, hash],
    )
    if (sal) {
      await cliente.query('INSERT INTO eventos_reservados (evento_id, sal, contenido) VALUES ($1, $2, $3)', [
        res.rows[0].id,
        sal,
        JSON.stringify(opciones.reservado),
      ])
    }
    if (propio) await cliente.query('COMMIT')
    return { hash, id: Number(res.rows[0].id) }
  } catch (err) {
    if (propio) await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    if (propio) cliente.release()
  }
}

export interface EslabonManifiesto {
  n: number
  ts: string
  tipo: string
  hash_previo: string | null
  hash: string
  detalle: Record<string, unknown>
}

export interface Manifiesto {
  version: string
  caso_id: string
  generado_en: string
  cadena: EslabonManifiesto[]
  piezas: Array<{ tipo: string; id: string; descripcion: string; sha256: string; bytes?: number }>
  hash_maestro: string
}

/**
 * Versión del manifiesto que se le asigna a toda actuación nueva.
 *
 * '1.0' describía la pieza del testigo como `Declaración de <nombre>`, y esa cadena entra
 * al preimagen del hash maestro. Con el nombre adentro, suprimir los datos del testigo
 * —que es un derecho suyo, art. 16 de la Ley 25.326, y que la pantalla de carga le
 * promete— hace que el verificador público declare alterado el expediente. Desde '1.1' la
 * descripción es genérica y el nombre vive sólo en la tabla, donde se puede borrar.
 *
 * Las actuaciones viejas conservan su versión y su descripción: cambiarlas les movería el
 * hash maestro que ya está sellado.
 */
export const VERSION_MANIFIESTO = '1.1'

/** Reconstruye el manifiesto completo del expediente y calcula el hash maestro. */
export async function construirManifiesto(
  casoId: string,
  opciones: OpcionesEvento = {},
): Promise<Manifiesto> {
  const pg = opciones.cliente ?? (await db())
  const caso = await pg.query<{ manifiesto_version: string }>(
    'SELECT manifiesto_version FROM casos WHERE id = $1',
    [casoId],
  )
  const version = caso.rows[0]?.manifiesto_version ?? '1.0'

  const eventos = await pg.query(
    'SELECT ts, tipo, detalle, hash_previo, hash FROM eventos WHERE caso_id = $1 ORDER BY id ASC',
    [casoId],
  )
  /*
   * El desempate por id no es decorativo. `piezas` es un array y entra al canonico() del
   * que sale el hash maestro: si dos piezas comparten timestamp, Postgres puede devolver
   * dos órdenes distintos y el mismo expediente intacto produce dos hashes distintos.
   * Los timestamps se escriben desde JS con resolución de milisegundo, así que el empate
   * no es hipotético.
   */
  const medias = await pg.query(
    'SELECT id, tipo, guia_id, sha256, bytes FROM medias WHERE caso_id = $1 ORDER BY capturado_en ASC, id ASC',
    [casoId],
  )
  const testigos = await pg.query(
    'SELECT id, nombre, sha256 FROM testigos WHERE caso_id = $1 ORDER BY creado_en ASC, id ASC',
    [casoId],
  )

  const cadena: EslabonManifiesto[] = eventos.rows.map((e, i) => ({
    n: i + 1,
    ts: new Date(e.ts).toISOString(),
    tipo: e.tipo,
    hash_previo: e.hash_previo,
    hash: e.hash,
    detalle: e.detalle,
  }))

  const piezas = [
    ...medias.rows.map((m) => ({
      tipo: m.tipo as string,
      id: m.id as string,
      descripcion: (m.guia_id as string) ?? m.tipo,
      sha256: m.sha256 as string,
      bytes: m.bytes as number,
    })),
    ...testigos.rows.map((t) => ({
      tipo: 'testigo',
      id: t.id as string,
      // Ver VERSION_MANIFIESTO: desde '1.1' el nombre no entra al hash maestro.
      descripcion: version === '1.0' ? `Declaración de ${t.nombre}` : 'Declaración de testigo',
      sha256: t.sha256 as string,
    })),
  ]

  const generado_en = new Date().toISOString()
  const cuerpo = { version, caso_id: casoId, cadena, piezas }
  const hash_maestro = sha256(canonico(cuerpo))

  return { ...cuerpo, generado_en, hash_maestro }
}

export interface ResultadoVerificacion {
  valido: boolean
  eslabones: number
  piezas: number
  hash_maestro: string
  problemas: string[]
}

/** Recalcula toda la cadena y confirma que ningún eslabón fue alterado. */
export async function verificarCadena(casoId: string): Promise<ResultadoVerificacion> {
  const pg = await db()
  const eventos = await pg.query(
    'SELECT ts, tipo, detalle, hash_previo, hash FROM eventos WHERE caso_id = $1 ORDER BY id ASC',
    [casoId],
  )
  const problemas: string[] = []
  let esperadoPrevio: string | null = null

  eventos.rows.forEach((e, i) => {
    if (e.hash_previo !== esperadoPrevio) {
      problemas.push(`Eslabón ${i + 1} (${e.tipo}): el hash previo no coincide con el eslabón anterior.`)
    }
    const recalculado = hashEvento({
      caso_id: casoId,
      ts: new Date(e.ts).toISOString(),
      tipo: e.tipo,
      detalle: e.detalle,
      hash_previo: e.hash_previo,
    })
    if (recalculado !== e.hash) {
      problemas.push(`Eslabón ${i + 1} (${e.tipo}): el contenido fue alterado después de registrarse.`)
    }
    esperadoPrevio = e.hash
  })

  const manifiesto = await construirManifiesto(casoId)
  return {
    valido: problemas.length === 0,
    eslabones: eventos.rowCount ?? 0,
    piezas: manifiesto.piezas.length,
    hash_maestro: manifiesto.hash_maestro,
    problemas,
  }
}
