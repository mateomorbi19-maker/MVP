/**
 * Los teléfonos de emergencia.
 *
 * Los usan el inicio, el modo viaje y la pantalla que abre la notificación de impacto,
 * así que viven en un solo lugar: tres copias del número de una ambulancia es exactamente
 * la clase de dato que después queda desactualizado en dos de ellas.
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
