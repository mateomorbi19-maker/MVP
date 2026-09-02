import { sha256 } from './hash'

/**
 * Lectura automática de la documentación del tercero.
 *
 * La decisión que ordena el módulo: la lectura de la MÁQUINA y la confirmación de la
 * PERSONA son dos hechos distintos, con dos asientos distintos en la cadena de custodia y
 * dos lugares distintos en la base. `extracciones.campos` guarda lo que dijo la máquina y
 * no se toca nunca más; `extracciones.confirmacion` guarda lo que resolvió la persona; y
 * sólo esto último se escribe en `casos.respuestas`. El expediente tiene que poder mostrar
 * las dos cosas por separado: una lectura automática no es una declaración del asegurado.
 *
 * Este archivo es PURO —no toca la base— y es el único que hay que editar para enchufar un
 * proveedor real. Los tres candidatos se llaman con fetch nativo, así que no hace falta
 * ninguna dependencia nueva.
 *
 * ANTES DE ENCHUFAR UN PROVEEDOR EXTRANJERO hay que resolver, en este orden:
 *   a) el consentimiento del TERCERO, que es el titular del dato y por quien el asegurado
 *      no puede consentir (arts. 5 y 11, Ley 25.326). El circuito ya lo pide antes de las
 *      fotos, y la lectura no se dispara sin él;
 *   b) la transferencia internacional (art. 12): cláusulas tipo conforme Disposición AAIP
 *      60-E/2016, o el consentimiento del inciso 2;
 *   c) el contrato de encargado de tratamiento (art. 25), con prohibición expresa de uso
 *      secundario, de entrenamiento de modelos y de retención;
 *   d) la inscripción de la cesión en el registro de la base ante la AAIP;
 *   e) minimización: recortar el documento del resto de la foto y mandar sólo el recorte.
 * La salida sin resolver nada de eso es un proveedor local. PROVEEDOR_EXTRACCION existe
 * justamente para que esa decisión no sea un refactor.
 */

export type TipoDocumento = 'licencia' | 'cedula' | 'patente'

/** Qué guía de foto alimenta qué tipo de documento. */
export const GUIA_A_DOCUMENTO: Record<string, TipoDocumento> = {
  licencia_tercero: 'licencia',
  cedula_tercero: 'cedula',
  patente_tercero: 'patente',
}

export interface CampoLeido {
  /** Nombre interno del campo. Ver MAPEO para saber a qué pregunta va. */
  clave: string
  valor: string
  /** Entre 0 y 1. NUNCA se le muestra al asegurado: ver vistaParaAsegurado. */
  confianza: number
}

export interface ResultadoExtraccion {
  campos: CampoLeido[]
  confianza_global: number
  /** true si los valores los inventó el proveedor de demostración. */
  simulado: boolean
}

export interface ProveedorExtraccion {
  nombre: string
  simulado: boolean
  leer(datos: Uint8Array, mime: string, tipo: TipoDocumento): Promise<ResultadoExtraccion>
}

/**
 * A qué pregunta del cuestionario va cada campo leído.
 *
 * Sólo se mapea a ids que YA existen. Los datos que ningún documento fotografiado trae
 * —la aseguradora y la póliza del tercero: la cédula verde no dice quién asegura el
 * vehículo— siguen siendo manuales, y así queda.
 *
 * `subclave` es para las preguntas de tipo persona, que guardan un objeto.
 */
export const MAPEO: Record<string, { pregunta: string; subclave?: string; etiqueta: string }> = {
  nombre: { pregunta: 'tercero_datos', subclave: 'nombre', etiqueta: 'Nombre del otro conductor' },
  dni: { pregunta: 'tercero_datos', subclave: 'dni', etiqueta: 'DNI del otro conductor' },
  patente: { pregunta: 'tercero_patente', etiqueta: 'Patente del otro vehículo' },
}

/* ================= Proveedor de demostración ================= */

const ALFABETO_PATENTE = 'ABCDEFGHIJKLMNPQRSTUVWXYZ'
const NOMBRES = ['Juan Carlos', 'María Elena', 'Roberto', 'Silvia', 'Diego', 'Laura']
const APELLIDOS = ['Pérez', 'González', 'Rodríguez', 'Fernández', 'López', 'Martínez']

/**
 * Deriva valores del hash del contenido, no del azar.
 *
 * Dos corridas sobre los mismos bytes dan exactamente lo mismo, así que las pruebas son
 * reproducibles y no hace falta Math.random en ninguna parte.
 */
function simulado(datos: Uint8Array, tipo: TipoDocumento): ResultadoExtraccion {
  const h = sha256(datos)
  const n = (i: number, mod: number) => parseInt(h.slice(i * 2, i * 2 + 2), 16) % mod

  if (tipo === 'patente') {
    const p =
      ALFABETO_PATENTE[n(0, 25)] +
      ALFABETO_PATENTE[n(1, 25)] +
      String(100 + n(2, 900)) +
      ALFABETO_PATENTE[n(3, 25)] +
      ALFABETO_PATENTE[n(4, 25)]
    return { campos: [{ clave: 'patente', valor: p, confianza: 0.6 + n(5, 40) / 100 }], confianza_global: 0.8, simulado: true }
  }

  const nombre = `${NOMBRES[n(0, NOMBRES.length)]} ${APELLIDOS[n(1, APELLIDOS.length)]}`
  const dni = String(20_000_000 + n(2, 200) * 100_000 + n(3, 255) * 300 + n(4, 255))
  const campos: CampoLeido[] = [
    { clave: 'nombre', valor: nombre, confianza: 0.6 + n(5, 40) / 100 },
    { clave: 'dni', valor: dni, confianza: 0.6 + n(6, 40) / 100 },
  ]
  if (tipo === 'cedula') {
    campos.push({
      clave: 'patente',
      valor:
        ALFABETO_PATENTE[n(7, 25)] + ALFABETO_PATENTE[n(8, 25)] + String(100 + n(9, 900)) + ALFABETO_PATENTE[n(10, 25)] + ALFABETO_PATENTE[n(11, 25)],
      confianza: 0.6 + n(12, 40) / 100,
    })
  }
  return { campos, confianza_global: 0.8, simulado: true }
}

export const PROVEEDOR_SIMULADO: ProveedorExtraccion = {
  nombre: 'simulado',
  simulado: true,
  leer: async (datos, _mime, tipo) => simulado(datos, tipo),
}

/**
 * El registro de proveedores.
 *
 * Enchufar Claude, Google u OpenAI es agregar acá una implementación de
 * ProveedorExtraccion que llame a su API con fetch, y poner su nombre en
 * PROVEEDOR_EXTRACCION. Es el único archivo que hay que tocar, y también el único para
 * volver atrás.
 */
export const REGISTRO: Record<string, ProveedorExtraccion> = {
  simulado: PROVEEDOR_SIMULADO,
}

/* ================= Interruptores ================= */

/**
 * ¿Está encendida la lectura automática?
 *
 * Arranca APAGADA, y eso es deliberado. El proveedor de demostración devuelve nombres, DNI
 * y patentes con formato argentino correcto que NO salen de la foto. Encendido por
 * omisión, un despliegue que simplemente no define la variable fabricaría prueba de
 * identidad sobre una persona que ni siquiera es usuaria del sistema.
 *
 * Para usar el simulado hay que pedirlo por su nombre, con EXTRACCION_SIMULADA.
 */
export function extraccionActiva(): boolean {
  if (process.env.EXTRACCION_DESACTIVADA === 'true') return false
  const elegido = process.env.PROVEEDOR_EXTRACCION
  if (elegido && elegido !== 'simulado') return Boolean(REGISTRO[elegido])
  return process.env.EXTRACCION_SIMULADA === 'true'
}

export function proveedorActivo(): ProveedorExtraccion | null {
  if (!extraccionActiva()) return null
  const elegido = process.env.PROVEEDOR_EXTRACCION
  if (elegido && elegido !== 'simulado') {
    const p = REGISTRO[elegido]
    if (!p) {
      throw new Error(
        `PROVEEDOR_EXTRACCION vale "${elegido}", que no está en el registro de lib/extraccion.ts. Disponibles: ${Object.keys(REGISTRO).join(', ')}.`,
      )
    }
    return p
  }
  return PROVEEDOR_SIMULADO
}

export function umbral(): number {
  const v = Number(process.env.UMBRAL_EXTRACCION)
  return Number.isFinite(v) && v > 0 && v <= 1 ? v : 0.85
}

/* ================= Lo que ve el asegurado ================= */

export type EstadoCampo = 'verificado' | 'revisar'

export interface CampoParaAsegurado {
  clave: string
  etiqueta: string
  /** Lo que leyó la máquina. Se muestra como pista, no como valor ya puesto. */
  lectura: string
  estado: EstadoCampo
  pregunta: string
  subclave?: string
}

/**
 * Traduce la lectura a lo que se le muestra a la persona.
 *
 * El porcentaje de confianza NO viaja al cliente del asegurado. La especificación
 * funcional lo pide expresamente: un número que la persona no sabe interpretar genera
 * dudas legales sin aportar nada de uso. El número queda en la base, en el eslabón de la
 * cadena y en el panel de la aseguradora, que es donde sirve para soporte.
 *
 * Con el proveedor de demostración TODOS los campos llegan 'revisar', sin mirar la
 * confianza: la confianza también es inventada, y un campo 'verificado' llega precargado.
 */
export function vistaParaAsegurado(resultado: ResultadoExtraccion): CampoParaAsegurado[] {
  const u = umbral()
  return resultado.campos
    .filter((c) => MAPEO[c.clave])
    .map((c) => {
      const m = MAPEO[c.clave]
      return {
        clave: c.clave,
        etiqueta: m.etiqueta,
        lectura: c.valor,
        estado: (resultado.simulado ? 'revisar' : c.confianza >= u ? 'verificado' : 'revisar') as EstadoCampo,
        pregunta: m.pregunta,
        subclave: m.subclave,
      }
    })
}
