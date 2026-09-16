import { Escena, unif, KMHS_POR_G } from './base.mts'

export const T0 = 20000
export const DUR = 34000

export function sacudida(f: number, A: number, kmh: number) {
  const e = new Escena(DUR)
  e.velocidadConstante(0, DUR, kmh)
  e.montaje = null
  const gA = A * (2 * Math.PI * f) ** 2 / 9.80665
  const ini = T0 - 1000, fin = T0 + 1500
  const jit: number[] = Array.from({ length: 40 }, () => 1 + 0.15 * (Math.random() * 2 - 1))
  for (let i = ini; i < fin; i++) {
    const tt = (i - ini) / 1000
    const env = Math.min(1, (i - ini) / 200, (fin - i) / 200)
    const ciclo = Math.floor(tt * f)
    const x = gA * env * jit[ciclo % 40] * (Math.sin(2 * Math.PI * f * tt) + 0.15 * Math.sin(4 * Math.PI * f * tt))
    e.ad[0][i] += x
    e.ad[1][i] += 0.3 * x
    e.giro[i] = 150 + 100 * Math.abs(Math.sin(2 * Math.PI * f * tt))
  }
  return e
}

export function caidaSoporte(kmh: number, duro = true) {
  const e = new Escena(DUR)
  e.velocidadConstante(0, DUR, kmh)
  const spin = unif(0, 3)
  for (let i = T0 - 400; i < T0; i++) { e.libre[i] = spin; e.giro[i] = 400 }
  if (duro) e.semiseno(e.ad[2], T0, 10, 15)
  else e.semiseno(e.ad[2], T0, 25, 8)
  e.semiseno(e.ad[0], T0 + 120, 20, 4)
  return e
}

function pozo(e: Escena, t: number, k = 1) {
  e.semiseno(e.av[2], t, 30, -2.5 * k); e.semiseno(e.av[2], t + 30, 35, 4.5 * k)
  e.semiseno(e.av[2], t + 190, 30, -2 * k); e.semiseno(e.av[2], t + 220, 35, 3.5 * k)
}
export function dosPozos(sep: number, kmh = 50, k = 1) {
  const e = new Escena(DUR)
  e.velocidadConstante(0, DUR, kmh)
  e.montaje = { fn: 14, zeta: 0.15 }
  pozo(e, T0, k); pozo(e, T0 + sep, k)
  return e
}

export function lomo(suelto: boolean, kmh = 30) {
  const e = new Escena(DUR)
  e.velocidadConstante(0, DUR, kmh)
  e.montaje = suelto ? { fn: 8, zeta: 0.1 } : { fn: 14, zeta: 0.15 }
  for (const t of [T0, T0 + 330]) { e.semiseno(e.av[2], t, 160, 1.3); e.semiseno(e.av[2], t + 160, 160, -0.9) }
  if (suelto) for (const t of [T0 + 60, T0 + 200, T0 + 390, T0 + 520]) e.semiseno(e.ad[Math.floor(unif(0, 3))], t, 15, unif(4, 6) * (Math.random() < 0.5 ? -1 : 1))
  return e
}

export function portazo(enPuerta: boolean) {
  const e = new Escena(DUR)
  e.montaje = { fn: 25, zeta: 0.1 }
  if (enPuerta) { e.semiseno(e.ad[0], T0, 12, 6); e.semiseno(e.ad[0], T0 + 12, 12, -3) }
  else e.semiseno(e.av[1], T0, 15, 1.2)
  return e
}

export function tirarAlAsiento(duro = false) {
  const e = new Escena(DUR)
  e.montaje = null
  e.semiseno(e.ad[1], T0 - 550, 250, 2)
  const spin = unif(0.5, 3)
  for (let i = T0 - 300; i < T0; i++) { e.libre[i] = spin; e.giro[i] = 700 }
  if (duro) e.semiseno(e.ad[2], T0, 20, 9)
  else e.semiseno(e.ad[2], T0, 60, 5)
  e.semiseno(e.ad[2], T0 + 150, 40, 2)
  return e
}

// choque frontal; urbano = arranca de un semáforo 8 s antes y llega a v0 con 0.25 g
export function choqueFrontal(P: number, v0: number, urbano = false) {
  const e = new Escena(DUR)
  const T = unif(70, 90)
  if (urbano) { const fin = e.cambioVelocidad(T0 - 8000, 0, v0, 0.25); e.velocidadConstante(fin, T0, v0) }
  else e.velocidadConstante(0, T0, v0)
  for (let i = T0; i < T0 + T; i++) { e.v[i] = v0 * (1 - (i - T0) / T); e.enMarcha[i] = 1 }
  e.semiseno(e.av[0], T0, T, -P)
  for (let i = T0; i < T0 + 600; i++) e.giro[i] = 60
  return e
}

export function choqueYDespedido(P: number, v0: number, dt = 1500) {
  const e = choqueFrontal(P, v0)
  for (let i = T0 + dt - 300; i < T0 + dt; i++) e.libre[i] = 1
  e.semiseno(e.ad[2], T0 + dt, 10, 15)
  return e
}

export function caidaLuegoChoque(sep: number, P: number, v0: number) {
  const e = new Escena(DUR)
  const tc = T0 + sep
  e.velocidadConstante(0, tc, v0)
  for (let i = T0 - 400; i < T0; i++) e.libre[i] = 0.5
  e.semiseno(e.ad[2], T0, 10, 15)
  const T = unif(70, 90)
  e.semiseno(e.av[0], tc, T, -P)
  for (let i = tc; i < tc + T; i++) { e.v[i] = v0 * (1 - (i - tc) / T); e.enMarcha[i] = 1 }
  return e
}

export function alcanceTrasero(detenido: boolean) {
  const e = new Escena(DUR)
  if (detenido) {
    e.semiseno(e.av[0], T0, 120, 3)
    for (let i = T0; i < T0 + 120; i++) e.v[i] = 7 * (i - T0) / 120
    e.cambioVelocidad(T0 + 120, 7, 0, 0.5)
  } else {
    e.velocidadConstante(0, T0, 20)
    e.semiseno(e.av[0], T0, 110, -3.5)
    for (let i = T0; i < T0 + 110; i++) e.v[i] = 20 * (1 - (i - T0) / 110)
  }
  return e
}

export function vuelco() {
  const e = new Escena(DUR)
  e.velocidadConstante(0, T0, 70)
  for (let i = T0; i < T0 + 500; i++) { e.av[1][i] += 0.8; e.v[i] = 70 - 15 * (i - T0) / 500; e.enMarcha[i] = 1 }
  e.semiseno(e.av[1], T0 + 500, 60, -8)
  for (let i = T0 + 600; i < T0 + 900; i++) e.libre[i] = 1.2
  e.semiseno(e.av[2], T0 + 1000, 50, 10)
  e.semiseno(e.av[2], T0 + 1600, 50, -7)
  e.semiseno(e.av[1], T0 + 2200, 50, 6)
  e.semiseno(e.av[2], T0 + 2700, 50, 5)
  for (let i = T0 + 500; i < T0 + 2800; i++) { e.v[i] = 55 * (1 - (i - T0 - 500) / 2300); e.enMarcha[i] = 1; e.giro[i] = 350 }
  return e
}

export function frenada(g: number, v0: number, v1: number) {
  const e = new Escena(DUR)
  e.velocidadConstante(0, T0 - 1000, v0)
  const fin = e.cambioVelocidad(T0 - 1000, v0, v1, g)
  if (v1 > 0) e.velocidadConstante(fin, DUR, v1)
  return e
}

export function aceleracion(g: number, v0: number, v1: number) {
  const e = new Escena(DUR)
  e.velocidadConstante(0, T0 - 1000, v0)
  const fin = e.cambioVelocidad(T0 - 1000, v0, v1, g)
  e.velocidadConstante(fin, DUR, v1)
  return e
}

// 60 -> 0 en ~1 s sin golpe (el caso de prueba del borrador para «caída imposible»)
export function paradaSinGolpe(ms = 1000, v0 = 60) {
  const e = new Escena(DUR)
  e.velocidadConstante(0, T0, v0)
  for (let i = T0; i < T0 + ms; i++) { e.v[i] = v0 * (1 - (i - T0) / ms); e.enMarcha[i] = 1; e.av[0][i] -= v0 / (ms / 1000) / KMHS_POR_G * 0.15 }
  return e
}

export function crucero(kmh: number) { const e = new Escena(DUR); e.velocidadConstante(0, DUR, kmh); return e }

// ciudad: arrancar/frenar entre 0.15 y 0.35 g, esperas en semáforos, algún pozo
export function urbano(minutos: number) {
  const ms = minutos * 60000
  const e = new Escena(ms)
  e.montaje = { fn: 14, zeta: 0.15 }
  let t = 2000
  while (t < ms - 60000) {
    const vmax = unif(30, 50)
    t = e.cambioVelocidad(t, 0, vmax, unif(0.15, 0.35))
    const crucero = unif(8000, 40000)
    e.velocidadConstante(t, t + crucero, vmax)
    if (Math.random() < 0.3) pozo(e, Math.floor(t + crucero / 2), unif(0.5, 1))
    t = Math.floor(t + crucero)
    t = e.cambioVelocidad(t, vmax, 0, unif(0.15, 0.35))
    t += Math.floor(unif(5000, 40000))
  }
  return e
}
