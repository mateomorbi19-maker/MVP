/**
 * Los teléfonos de emergencia.
 *
 * Estaban escritos dentro del JSX de la pantalla de emergencia del recorrido. Ahora los
 * usan también el inicio y —cuando exista— la pantalla que abre la notificación de
 * impacto, así que viven en un solo lugar: tres copias del número de una ambulancia es
 * exactamente la clase de dato que después queda desactualizado en dos de ellas.
 *
 * Son los números de Argentina. Si alguna vez hay que regionalizarlos, es este archivo.
 */

export interface Emergencia {
  numero: string
  nombre: string
  detalle: string
}

export const EMERGENCIAS: Emergencia[] = [
  { numero: '107', nombre: 'Ambulancia', detalle: 'Emergencias médicas' },
  { numero: '911', nombre: 'Policía', detalle: 'Emergencias policiales' },
  { numero: '100', nombre: 'Bomberos', detalle: 'Incendio o rescate' },
]

/** En el lugar del hecho primero va la salud. En el inicio, el orden del mockup. */
export const EMERGENCIAS_EN_EL_LUGAR = EMERGENCIAS.filter((e) => e.numero !== '100')
