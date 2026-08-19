import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Acta Digital de Siniestro',
  description:
    'Registro probatorio de siniestros viales con cadena de custodia verificable. Captura la evidencia en el lugar y en el momento del hecho.',
  applicationName: 'Acta Digital',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/iconos/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // Hace que iOS abra desde la pantalla de inicio sin barra de navegador.
  appleWebApp: {
    capable: true,
    title: 'Acta Digital',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  other: {
    // Next emite la forma estandarizada "mobile-web-app-capable". Las versiones de
    // iOS anteriores a la 16.4 sólo entienden la variante con prefijo de Apple, así
    // que se agrega también para que abran a pantalla completa.
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Deja lugar para la barra de estado cuando corre a pantalla completa.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1216' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  )
}
