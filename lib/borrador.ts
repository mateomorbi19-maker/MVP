import type { ProgresoRecorrido, Respuestas } from './recorrido'

export interface BorradorActuacion {
  pendientes: Respuestas
  progreso: ProgresoRecorrido
}

/** Sólo persiste lo aún no confirmado por el servidor, para no pisar datos de otro dispositivo. */
export function leerBorradorActuacion(id: string): BorradorActuacion | null {
  try {
    const texto = localStorage.getItem(`acta:borrador:${id}`)
    if (!texto) return null
    const valor = JSON.parse(texto)
    return valor && typeof valor.pendientes === 'object' && valor.progreso ? valor : null
  } catch {
    return null
  }
}

export function guardarBorradorActuacion(id: string, borrador: BorradorActuacion): boolean {
  try {
    localStorage.setItem(`acta:borrador:${id}`, JSON.stringify(borrador))
    return true
  } catch {
    return false
  }
}

export function quitarBorradorActuacion(id: string): void {
  try { localStorage.removeItem(`acta:borrador:${id}`) } catch { /* El servidor conserva lo confirmado. */ }
}
