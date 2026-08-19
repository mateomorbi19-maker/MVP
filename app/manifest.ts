import type { MetadataRoute } from 'next'

/**
 * Manifiesto de la aplicación instalable.
 *
 * Con esto el sistema se puede agregar a la pantalla de inicio y abre a pantalla
 * completa, sin barra de navegador. En Android queda registrada como una aplicación
 * más: aparece en los ajustes del sistema y los permisos de ubicación y cámara se
 * le otorgan a ella, no al navegador.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Acta Digital de Siniestro',
    short_name: 'Acta Digital',
    description:
      'Registro probatorio de siniestros viales. Captura la evidencia en el lugar y en el momento del hecho.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f6f7f9',
    theme_color: '#14549b',
    lang: 'es-AR',
    dir: 'ltr',
    categories: ['utilities', 'business'],
    icons: [
      { src: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/iconos/icono-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      {
        name: 'Registrar un siniestro',
        short_name: 'Nuevo siniestro',
        description: 'Abrir el flujo de captura',
        url: '/',
      },
      {
        name: 'Verificar un expediente',
        short_name: 'Verificar',
        description: 'Comprobar la integridad de un expediente',
        url: '/verificar',
      },
    ],
  }
}
