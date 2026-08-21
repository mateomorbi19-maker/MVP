/**
 * Memoria del teléfono: cuál es la actuación que quedó abierta.
 *
 * Hace falta desde que el recorrido se puede terminar más tarde. El enlace `/s/<id>`
 * es la única forma de volver, y nadie se lo anota parado al lado del auto.
 *
 * Todo va envuelto en try/catch a propósito: en navegación privada de Safari el
 * simple acceso a localStorage tira excepción, y perder el guardado no puede romper
 * la pantalla.
 */

const CLAVE = 'acta:actuacion-abierta'

export function recordarActuacion(id: string): void {
  try {
    window.localStorage.setItem(CLAVE, id)
  } catch {
    /* sin almacenamiento: se pierde la comodidad, no el expediente */
  }
}

export function actuacionAbierta(): string | null {
  try {
    return window.localStorage.getItem(CLAVE)
  } catch {
    return null
  }
}

export function olvidarActuacion(): void {
  try {
    window.localStorage.removeItem(CLAVE)
  } catch {
    /* ídem */
  }
}
