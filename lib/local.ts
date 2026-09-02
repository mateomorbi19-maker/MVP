/**
 * Memoria del teléfono: cuál es la actuación que quedó abierta, y su secreto.
 *
 * Hace falta desde que el recorrido se puede terminar más tarde. El enlace `/s/<id>` es la
 * única forma de volver, y nadie se lo anota parado al lado del auto.
 *
 * El secreto de apertura se guarda al lado del id porque es la única prueba que después
 * acepta el servidor para vincular esa actuación a una cuenta. El id no alcanza: se dicta
 * por teléfono, se imprime en el expediente y viaja dentro del QR que escanea cualquier
 * testigo.
 *
 * Todo va envuelto en try/catch a propósito: en navegación privada de Safari el simple
 * acceso a localStorage tira excepción, y perder el guardado no puede romper la pantalla.
 */

const CLAVE = 'acta:actuacion-abierta'
const CLAVE_SECRETO = 'acta:secreto'

export function recordarActuacion(id: string, secreto?: string): void {
  try {
    window.localStorage.setItem(CLAVE, id)
    if (secreto) window.localStorage.setItem(CLAVE_SECRETO + ':' + id, secreto)
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

/** El secreto de apertura de una actuación, si este teléfono lo tiene. */
export function secretoDe(id: string): string | null {
  try {
    return window.localStorage.getItem(CLAVE_SECRETO + ':' + id)
  } catch {
    return null
  }
}

export function olvidarActuacion(): void {
  try {
    const id = window.localStorage.getItem(CLAVE)
    window.localStorage.removeItem(CLAVE)
    // El secreto se conserva: sirve para reclamar la actuación desde una cuenta después.
    if (id) window.localStorage.setItem('acta:ultima', id)
  } catch {
    /* ídem */
  }
}

/** La última actuación cerrada en este teléfono, para poder vincularla a una cuenta. */
export function ultimaActuacion(): string | null {
  try {
    return window.localStorage.getItem('acta:ultima')
  } catch {
    return null
  }
}
