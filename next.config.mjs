import { fileURLToPath } from 'node:url'
import { dirname } from 'node:path'

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Genera un bundle autocontenido: la imagen de Docker queda chica y arranca rápido.
  output: 'standalone',
  // Fija la raíz del proyecto. Sin esto, si hay un package-lock.json suelto en el
  // directorio del usuario, el empaquetador lo toma como raíz y arma mal el standalone.
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  serverExternalPackages: ['pdf-lib'],
}

export default nextConfig
