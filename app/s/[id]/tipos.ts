/**
 * Los tipos que comparten el recorrido y sus pantallas.
 *
 * Están acá y no dentro del componente para que cada pantalla viva en su propio archivo
 * sin arrastrarse las demás. Nada de esto es marcado ni estilo: es el contrato entre la
 * lógica del recorrido y lo que cada pantalla recibe.
 */

import type { MediaMinima } from '@/lib/recorrido'

/** Motivo por el que no se pudo obtener la ubicación, para poder explicar qué hacer. */
export type FalloGps = {
  codigo: number
  motivo: 'denegado' | 'no_disponible' | 'demora' | 'no_soportado' | 'servidor' | 'sin_respuesta'
  detalle?: string
} | null

export type Media = MediaMinima
export type Testigo = { id: string; nombre: string }
export type Ubicacion = { lat: number; lon: number; direccion: string | null } | null
export type Datos = { poliza: string; patente: string; asegurado: string; telefono: string }
export type Subir = (archivo: File, tipo: 'foto' | 'audio', guiaId?: string) => Promise<string>
