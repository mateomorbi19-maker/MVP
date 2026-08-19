/**
 * Genera los íconos de la aplicación.
 *
 * Se dibujan por código en vez de depender de un diseñador o de una librería de
 * imágenes: son formas simples y así el repositorio queda autocontenido.
 *
 * La marca es un pin de ubicación, que es literalmente lo que hace el sistema:
 * fijar dónde y cuándo pasó algo.
 *
 *   node scripts/generar-iconos.mjs
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'

const ACENTO = [0x14, 0x54, 0x9b]
const BLANCO = [0xff, 0xff, 0xff]

/* ---------- Codificador PNG mínimo (RGB, 8 bits) ---------- */

function crc32(buf) {
  let c = ~0
  for (const byte of buf) {
    c ^= byte
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
  }
  return ~c >>> 0
}

function trozo(tipo, datos) {
  const t = Buffer.from(tipo, 'ascii')
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([t, datos])))
  return Buffer.concat([largo, t, datos, crc])
}

function codificarPng(ancho, alto, pixeles) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8
  ihdr[9] = 2 // RGB
  const filas = []
  for (let y = 0; y < alto; y++) {
    const fila = Buffer.alloc(1 + ancho * 3)
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 3
      fila[1 + x * 3] = pixeles[i]
      fila[2 + x * 3] = pixeles[i + 1]
      fila[3 + x * 3] = pixeles[i + 2]
    }
    filas.push(fila)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(Buffer.concat(filas), { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

/* ---------- Dibujo ---------- */

const mezclar = (a, b, t) => a.map((c, i) => Math.round(c + (b[i] - c) * t))

/**
 * Cobertura del pin en un punto, entre 0 y 1.
 * Se calcula con distancias con signo para poder suavizar los bordes.
 */
function coberturaPin(x, y, cx, cy, r) {
  // Cabeza circular.
  const dCabeza = Math.hypot(x - cx, y - cy) - r

  // Punta: triángulo isósceles que arranca en la cabeza y baja.
  const puntaY = cy + r * 2.35
  const mitad = r * 0.98
  const t = (y - cy) / (puntaY - cy)
  let dPunta = Infinity
  if (t >= 0 && t <= 1) {
    const anchoAqui = mitad * (1 - t)
    dPunta = Math.abs(x - cx) - anchoAqui
    if (y > puntaY) dPunta = Infinity
  }

  const d = Math.min(dCabeza, dPunta)
  return Math.max(0, Math.min(1, 0.5 - d))
}

/** Esquinas redondeadas del fondo. Con relleno completo para íconos maskable. */
function coberturaFondo(x, y, lado, radio) {
  if (radio <= 0) return 1
  const dx = Math.max(radio - x, x - (lado - radio), 0)
  const dy = Math.max(radio - y, y - (lado - radio), 0)
  const d = Math.hypot(dx, dy) - radio
  return Math.max(0, Math.min(1, 0.5 - d))
}

/**
 * @param lado      tamaño en píxeles
 * @param margen    proporción de aire alrededor del pin (los maskable necesitan más)
 * @param redondeo  radio de las esquinas, 0 para cuadrado completo
 */
function dibujarIcono(lado, { margen = 0.16, redondeo = 0.22 } = {}) {
  const px = Buffer.alloc(lado * lado * 3)
  const S = 3 // supermuestreo para suavizar bordes
  const radio = lado * redondeo

  const zona = lado * (1 - margen * 2)
  const r = zona * 0.245
  const cx = lado / 2
  const cy = lado / 2 - zona * 0.13
  const rAgujero = r * 0.4

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      let accFondo = 0
      let accPin = 0
      let accAgujero = 0
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          const px2 = x + (sx + 0.5) / S
          const py2 = y + (sy + 0.5) / S
          accFondo += coberturaFondo(px2, py2, lado, radio)
          accPin += coberturaPin(px2, py2, cx, cy, r)
          accAgujero += Math.max(0, Math.min(1, 0.5 - (Math.hypot(px2 - cx, py2 - cy) - rAgujero)))
        }
      }
      const n = S * S
      const fondo = accFondo / n
      const pin = accPin / n
      const agujero = accAgujero / n

      // Fuera del fondo redondeado queda blanco, para que no se vea un halo oscuro.
      let color = mezclar(BLANCO, ACENTO, fondo)
      color = mezclar(color, BLANCO, pin * fondo)
      color = mezclar(color, ACENTO, agujero * pin * fondo)

      const i = (y * lado + x) * 3
      px[i] = color[0]
      px[i + 1] = color[1]
      px[i + 2] = color[2]
    }
  }
  return codificarPng(lado, lado, px)
}

/* ---------- Salida ---------- */

mkdirSync('public/iconos', { recursive: true })

const salidas = [
  ['public/iconos/icono-192.png', dibujarIcono(192)],
  ['public/iconos/icono-512.png', dibujarIcono(512)],
  // Android recorta los maskable a un círculo: el contenido va más chico y el
  // fondo ocupa todo el cuadrado, sin esquinas redondeadas.
  ['public/iconos/icono-maskable-512.png', dibujarIcono(512, { margen: 0.28, redondeo: 0 })],
  // iOS aplica su propia máscara y no admite transparencia.
  ['public/iconos/apple-touch-icon.png', dibujarIcono(180, { redondeo: 0 })],
]

for (const [ruta, datos] of salidas) {
  writeFileSync(ruta, datos)
  console.log(`  ${ruta} (${Math.round(datos.length / 1024)} KB)`)
}
console.log('\nÍconos generados.')
