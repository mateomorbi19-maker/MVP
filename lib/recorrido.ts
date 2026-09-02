/**
 * El armado del recorrido: qué pantallas hay y en cuál se retoma.
 *
 * Vive fuera del componente por dos motivos. Uno, se puede probar sin navegador ni base:
 * es la pieza que decide si alguien parado al lado del auto ve o no la pantalla de
 * llamar a la ambulancia, y hasta ahora no tenía una sola prueba. Dos, deja el
 * componente del recorrido como marcado y nada más, para que un cambio visual no pueda
 * tocar la lógica sin querer.
 *
 * Nada de acá puede importar React: `scripts/prueba-logica.mjs` lo carga directo.
 */

import {
  RECORRIDO,
  VALOR,
  fotosVisibles,
  preguntasVisibles,
  seccionPorId,
  type Bloque,
  type GuiaFoto,
  type Pregunta,
  type Seccion,
} from './cuestionario'

export type Respuestas = Record<string, unknown>

/**
 * Lo mínimo que el recorrido necesita saber de una pieza ya incorporada.
 *
 * Se llama así y no `Media` porque `lib/casos.ts` ya exporta una `Media` completa, con
 * la ruta del archivo y su hash: dos tipos con el mismo nombre y distinta forma compilan
 * sin quejarse y el primer import equivocado hace algo distinto de lo que dice.
 */
export interface MediaMinima {
  id: string
  tipo: string
  guia_id: string | null
}

export type Paso =
  | { clave: string; bloque: Bloque; tipo: 'pregunta'; seccion: Seccion; pregunta: Pregunta }
  /**
   * `variante` viaja resuelta y la pantalla no recibe las respuestas.
   *
   * Antes la pantalla de emergencia decidía su propio titular comparando
   * `respuestas.heridos === 'No lo sé'`. Con la pantalla en un archivo que un agente
   * visual puede editar, mejorar esa redacción a «No estoy seguro» —que es lo que dice
   * el mismo cuestionario en otras dos preguntas— cambiaba en silencio el texto que ve
   * alguien que no sabe si hay heridos, en la pantalla más crítica del producto.
   */
  | { clave: string; bloque: Bloque; tipo: 'emergencia'; variante: 'confirmado' | 'dudoso' }
  | { clave: string; bloque: Bloque; tipo: 'foto'; guia: GuiaFoto; numero: number; total: number }
  | { clave: string; bloque: Bloque; tipo: 'testigos' }
  | { clave: string; bloque: Bloque; tipo: 'corte' }
  /**
   * `masDeDosVehiculos` viaja resuelto: la pantalla no puede comparar contra el texto de
   * una opción del cuestionario, porque ese texto es el dato y mejorar su redacción
   * cambiaría en silencio lo que la pantalla hace.
   */
  | { clave: string; bloque: Bloque; tipo: 'croquis'; masDeDosVehiculos: boolean }
  | { clave: string; bloque: Bloque; tipo: 'datos' }
  | { clave: string; bloque: Bloque; tipo: 'revision' }
  | { clave: string; bloque: Bloque; tipo: 'final' }

export const vacia = (v: unknown): boolean =>
  v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)

/** El relato no vive en las respuestas sino en los archivos: se comprueba aparte. */
export function respondida(pregunta: Pregunta, respuestas: Respuestas, medias: MediaMinima[]): boolean {
  if (pregunta.tipo === 'audio') return medias.some((m) => m.tipo === 'audio')
  return !vacia(respuestas[pregunta.id])
}

/**
 * Arma la lista plana de pantallas a partir de las respuestas actuales.
 *
 * Se recalcula en cada cambio porque las preguntas condicionales aparecen y
 * desaparecen: por eso la navegación va por clave y no por índice.
 */
export function construirPasos(respuestas: Respuestas): Paso[] {
  const pasos: Paso[] = []

  for (const etapa of RECORRIDO) {
    if (etapa.tipo === 'seccion') {
      const seccion = seccionPorId(etapa.id)
      if (!seccion) continue
      for (const pregunta of preguntasVisibles(seccion, respuestas)) {
        pasos.push({ clave: `p:${pregunta.id}`, bloque: seccion.bloque, tipo: 'pregunta', seccion, pregunta })
        // La pantalla de llamada va pegada a la respuesta que la dispara.
        const heridos = respuestas.heridos
        if (pregunta.id === 'heridos' && typeof heridos === 'string' && heridos !== VALOR.heridos.NO_NADIE) {
          pasos.push({
            clave: 'emergencia',
            bloque: 'seguridad',
            tipo: 'emergencia',
            variante: heridos === VALOR.heridos.NO_LO_SE ? 'dudoso' : 'confirmado',
          })
        }
      }
      continue
    }

    if (etapa.tipo === 'fotos') {
      const guias = fotosVisibles(respuestas)
      guias.forEach((guia, i) =>
        pasos.push({
          clave: `f:${guia.id}`,
          bloque: 'lugar',
          tipo: 'foto',
          guia,
          numero: i + 1,
          total: guias.length,
        }),
      )
      continue
    }

    const bloque: Bloque = etapa.tipo === 'testigos' || etapa.tipo === 'corte' ? 'lugar' : 'despues'
    if (etapa.tipo === 'croquis') {
      const cuantos = respuestas.cantidad_vehiculos
      pasos.push({
        clave: 'croquis',
        bloque,
        tipo: 'croquis',
        masDeDosVehiculos:
          cuantos === VALOR.cantidad_vehiculos.N3 || cuantos === VALOR.cantidad_vehiculos.N4_O_MAS,
      })
      continue
    }
    pasos.push({ clave: etapa.tipo, bloque, tipo: etapa.tipo } as Paso)
  }

  return pasos
}

/**
 * Dónde retomar.
 *
 * Desde que el último bloque se puede completar más tarde, volver siempre a la
 * primera pregunta sería inaceptable: la persona ya contestó veinte pantallas.
 * Se retoma en lo primero que quedó sin hacer.
 */
export function pasoInicial(pasos: Paso[], respuestas: Respuestas, medias: MediaMinima[]): string {
  for (const paso of pasos) {
    if (paso.tipo === 'pregunta' && !respondida(paso.pregunta, respuestas, medias)) return paso.clave
    if (paso.tipo === 'foto' && paso.guia.obligatoria && !medias.some((m) => m.guia_id === paso.guia.id)) {
      return paso.clave
    }
  }
  return 'revision'
}

/** Lo que falta, con la pantalla exacta a la que hay que volver para completarlo. */
export interface Faltante {
  clave: string
  texto: string
}

/**
 * Qué quedó sin completar.
 *
 * Vive acá y no en la pantalla de revisión porque decide qué se le muestra al liquidador
 * como ausencia, y porque compara contra `requerida` y `obligatoria`, que son datos del
 * cuestionario. Nada de esto es aspecto.
 *
 * Ojo con lo que NO hace: no bloquea nada. Cada faltante es un botón que lleva a su
 * pregunta, y el expediente se cierra igual. Un expediente incompleto vale más que uno
 * abandonado en la tercera pantalla.
 */
export function faltantes(pasos: Paso[], respuestas: Respuestas, medias: MediaMinima[]): Faltante[] {
  return pasos.flatMap((paso) => {
    if (paso.tipo === 'pregunta' && paso.pregunta.requerida && !respondida(paso.pregunta, respuestas, medias)) {
      return [{ clave: paso.clave, texto: paso.pregunta.texto }]
    }
    if (paso.tipo === 'foto' && paso.guia.obligatoria && !medias.some((m) => m.guia_id === paso.guia.id)) {
      return [{ clave: paso.clave, texto: `Foto: ${paso.guia.titulo}` }]
    }
    return []
  })
}
