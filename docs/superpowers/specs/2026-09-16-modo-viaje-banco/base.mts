// Banco de simulación para el §2 del borrador del modo viaje.
// Señal "continua" a 1 kHz -> recorte del rango del sensor -> pasa-bajos del HAL (Butterworth 25 Hz)
// -> muestreo puntual a 60 Hz con fase aleatoria (como el pump de Chromium / CoreMotion a 60 Hz).
// GPS: velocidad real retrasada + pasa-bajos (lag), 1 Hz, ruido uniforme, huecos, modo iOS (speed null
// a baja velocidad -> velocidad derivada de posiciones con ruido AR(1) + mediana de 3).

export const G = 9.80665
export const KMHS_POR_G = 35.30394 // 1 g en km/h por segundo

let semilla = 12345
export function sembrar(s: number) { semilla = s >>> 0 || 1 }
export function rnd() {
  semilla |= 0; semilla = (semilla + 0x6d2b79f5) | 0
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
export const unif = (a: number, b: number) => a + (b - a) * rnd()
export function gauss() { let u = 0; while (u === 0) u = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd()) }
export const mediana = (xs: number[]) => { if (!xs.length) return NaN; const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }

export interface Lectura { t: number; ax: number; ay: number; az: number; gTotal: number; giro: number; hx?: number; hy?: number; hz?: number }
export interface Vel { t: number; tDisp: number; kmh: number | null; speed: number | null; x: number; y: number }

// ---------------------------------------------------------------- escena continua
export class Escena {
  n: number
  av: Float64Array[] // aceleración del vehículo, marco vehículo (x adelante, y izquierda, z arriba), en g
  ad: Float64Array[] // aceleración extra en marco del teléfono, en g (mano, golpes del teléfono)
  libre: Float64Array // >=0 => caída libre con aceleración centrípeta de esa magnitud (g); -1 => no
  giro: Float64Array // dps
  v: Float64Array // velocidad real km/h
  enMarcha: Float64Array // 1 si hay vibración de ruta
  montaje: { fn: number; zeta: number } | null = { fn: 15, zeta: 0.2 }
  constructor(public ms: number) {
    this.n = ms
    this.av = [0, 1, 2].map(() => new Float64Array(ms))
    this.ad = [0, 1, 2].map(() => new Float64Array(ms))
    this.libre = new Float64Array(ms).fill(-1)
    this.giro = new Float64Array(ms)
    this.v = new Float64Array(ms)
    this.enMarcha = new Float64Array(ms)
  }
  semiseno(arr: Float64Array, t0: number, dur: number, pico: number) {
    for (let i = Math.max(0, Math.floor(t0)); i < Math.min(this.n, t0 + dur); i++) arr[i] += pico * Math.sin(Math.PI * (i - t0) / dur)
  }
  velocidadConstante(desde: number, hasta: number, kmh: number) { for (let i = desde; i < Math.min(hasta, this.n); i++) { this.v[i] = kmh; this.enMarcha[i] = kmh > 1 ? 1 : 0 } }
  // perfil de velocidad con aceleración longitudinal coherente (rampa de tirón 250 ms)
  cambioVelocidad(t0: number, v0: number, v1: number, gMax: number) {
    const signo = v1 > v0 ? 1 : -1
    let v = v0, a = 0, i = t0
    while (i < this.n && (signo > 0 ? v < v1 : v > v1)) {
      const rest = Math.abs(v1 - v)
      const objetivo = rest < gMax * KMHS_POR_G * 0.125 ? gMax * 0.3 : gMax
      a = Math.min(objetivo, a + gMax / 250)
      v += signo * a * KMHS_POR_G / 1000
      this.av[0][i] += signo * a
      this.v[i] = Math.max(0, signo > 0 ? Math.min(v, v1) : Math.max(v, v1))
      this.enMarcha[i] = this.v[i] > 1 ? 1 : 0
      i++
    }
    return i
  }
}

export interface Sensor { rango: number; fcHal: number; hz: number; alfaRespaldo?: number }
export const SENSOR_8G: Sensor = { rango: 8, fcHal: 25, hz: 60 }

function biquadLP(fc: number, fs: number) {
  const w0 = 2 * Math.PI * fc / fs, Q = Math.SQRT1_2, al = Math.sin(w0) / (2 * Q), c = Math.cos(w0), a0 = 1 + al
  return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0, a1: -2 * c / a0, a2: (1 - al) / a0 }
}

// rotación vehículo -> teléfono: soporte vertical mirando al conductor, con perturbación aleatoria
export function rotacionSoporte(pert = 20): number[][] {
  const base = [[0, -1, 0], [0, 0, 1], [-1, 0, 0]]
  const r = (x: number) => x * Math.PI / 180
  const a = r(unif(-pert, pert)), b = r(unif(-pert, pert)), c = r(unif(-pert, pert))
  const Rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]]
  const Ry = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]]
  const Rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]]
  const mul = (A: number[][], B: number[][]) => A.map((f) => B[0].map((_, j) => f.reduce((s, x, k) => s + x * B[k][j], 0)))
  return mul(mul(mul(Rx, Ry), Rz), base)
}
const aplicar = (R: number[][], v: number[]) => R.map((f) => f[0] * v[0] + f[1] * v[1] + f[2] * v[2])

export function sensar(e: Escena, s: Sensor, R = rotacionSoporte()): Lectura[] {
  const n = e.n
  // 1) montaje (transmisibilidad de base) sobre la aceleración del vehículo + vibración de ruta
  const am = [0, 1, 2].map(() => new Float64Array(n))
  const fase = [unif(0, 6.28), unif(0, 6.28)]
  for (let k = 0; k < 3; k++) {
    let z = 0, zd = 0
    const w = e.montaje ? 2 * Math.PI * e.montaje.fn : 0, ze = e.montaje?.zeta ?? 0
    for (let i = 0; i < n; i++) {
      let a = e.av[k][i]
      if (e.enMarcha[i]) a += (k === 2 ? 0.05 * Math.sin(2 * Math.PI * 12 * i / 1000 + fase[0]) + 0.03 * Math.sin(2 * Math.PI * 17 * i / 1000 + fase[1]) : 0) + 0.1 * gauss()
      else a += 0.01 * gauss()
      if (e.montaje) { const zdd = -a * G - 2 * ze * w * zd - w * w * z; zd += zdd / 1000; z += zd / 1000; am[k][i] = a + zdd / G } else am[k][i] = a
    }
  }
  // 2) fuerza específica en marco teléfono, caída libre, recorte, pasa-bajos del HAL
  const gTel = aplicar(R, [0, 0, 1])
  const f = [0, 1, 2].map(() => new Float64Array(n))
  for (let i = 0; i < n; i++) {
    let v = aplicar(R, [am[0][i], am[1][i], am[2][i] + 1])
    if (e.libre[i] >= 0) v = [e.libre[i], 0, 0]
    for (let k = 0; k < 3; k++) f[k][i] = Math.max(-s.rango, Math.min(s.rango, v[k] + e.ad[k][i]))
  }
  const c = biquadLP(s.fcHal, 1000)
  for (let k = 0; k < 3; k++) {
    let x1 = f[k][0], x2 = f[k][0], y1 = f[k][0], y2 = f[k][0]
    for (let i = 0; i < n; i++) { const x = f[k][i]; const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2; x2 = x1; x1 = x; y2 = y1; y1 = y; f[k][i] = y }
  }
  // 3) muestreo a 60 Hz, fase aleatoria
  const dt = 1000 / s.hz, ph = unif(0, dt)
  const out: Lectura[] = []
  let gEst = [...gTel]
  const alfa = s.alfaRespaldo
  let hl = [0, 0, 0]
  const aH = (dt / 1000) / (1 / (2 * Math.PI * 2) + dt / 1000)
  for (let t = ph; t < n; t += dt) {
    const i = Math.floor(t)
    const fi = [f[0][i], f[1][i], f[2][i]]
    let lin: number[]
    if (alfa !== undefined) { gEst = gEst.map((g, k) => alfa * g + (1 - alfa) * fi[k]); lin = fi.map((x, k) => x - gEst[k]) } else lin = fi.map((x, k) => x - gTel[k])
    // horizontal (plano perpendicular a la gravedad real) filtrado < 2 Hz por componente
    const dot = lin[0] * gTel[0] + lin[1] * gTel[1] + lin[2] * gTel[2]
    const h = lin.map((x, k) => x - dot * gTel[k])
    hl = hl.map((x, k) => x + aH * (h[k] - x))
    out.push({ t, ax: lin[0] * G, ay: lin[1] * G, az: lin[2] * G, gTotal: Math.hypot(...fi), giro: e.giro[i] + Math.abs(gauss()) * 3, hx: hl[0], hy: hl[1], hz: hl[2] })
  }
  return out
}

// ---------------------------------------------------------------- GPS
export interface Gps { periodo: number; lag: number; tau: number; ruido: number; ios: boolean; rho: number; sigmaPos: number; huecos: [number, number][]; offset: number; sinGps?: boolean; speedCeroEn?: [number, number][] }
export const GPS_BASE: Gps = { periodo: 1000, lag: 2000, tau: 500, ruido: 3, ios: false, rho: 0.9, sigmaPos: 3, huecos: [], offset: 0 }

export function generarGps(e: Escena, p: Gps): Vel[] {
  if (p.sinGps) return []
  const n = e.n
  const puro = Math.max(0, p.lag - p.tau)
  const yf = new Float64Array(n)
  const s = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const vd = e.v[Math.max(0, i - puro)]
    yf[i] = i === 0 ? vd : p.tau > 0 ? yf[i - 1] + (vd - yf[i - 1]) / p.tau : vd
    s[i] = (i ? s[i - 1] : 0) + e.v[Math.max(0, i - p.lag)] / 3.6 / 1000
  }
  const out: Vel[] = []
  let nx = gauss() * p.sigmaPos, ny = gauss() * p.sigmaPos
  const derivadas: number[] = []
  let previo: { t: number; x: number; y: number } | null = null
  for (let tk = unif(0, p.periodo); tk < n; tk += p.periodo) {
    const i = Math.floor(tk)
    if (p.huecos.some(([a, b]) => tk >= a && tk < b)) continue
    nx = p.rho * nx + Math.sqrt(1 - p.rho * p.rho) * p.sigmaPos * gauss()
    ny = p.rho * ny + Math.sqrt(1 - p.rho * p.rho) * p.sigmaPos * gauss()
    const x = s[i] + nx, y = ny
    let speed: number | null = Math.max(0, yf[i] + unif(-p.ruido, p.ruido))
    if (p.ios && yf[i] < 3) speed = null
    if (p.speedCeroEn?.some(([a, b]) => tk >= a && tk < b)) speed = 0
    let kmh: number | null = speed
    if (previo && tk - previo.t >= 1000) {
      derivadas.push(Math.hypot(x - previo.x, y - previo.y) / ((tk - previo.t) / 1000) * 3.6)
      if (derivadas.length > 3) derivadas.shift()
    }
    if (speed === null) kmh = derivadas.length ? mediana(derivadas) : null
    if (!previo || tk - previo.t >= 1000) previo = { t: tk, x, y }
    out.push({ t: tk + p.offset, tDisp: tk + 150, kmh, speed, x, y })
  }
  return out
}

// ---------------------------------------------------------------- lógica del BORRADOR (§2.2–2.4)
export interface Umbrales { sospechaG: number; confirmadoG: number; msSobreUmbral: number; velocidadPreviaKmh: number; velocidadPosteriorKmh: number; giroDps: number; post: number }
export const U: Umbrales = { sospechaG: 4, confirmadoG: 8, msSobreUmbral: 30, velocidadPreviaKmh: 30, velocidadPosteriorKmh: 8, giroDps: 180, post: 4000 }
export const modG = (l: Lectura) => Math.hypot(l.ax, l.ay, l.az) / G

export function rachaContigua(acc: Lectura[], ip: number, umb: number) {
  let a = ip, b = ip
  for (let i = ip - 1; i >= 0;) { if (modG(acc[i]) >= umb) { a = i; i-- } else if (i - 1 >= 0 && modG(acc[i - 1]) >= umb) { a = i - 1; i -= 2 } else break }
  for (let i = ip + 1; i < acc.length;) { if (modG(acc[i]) >= umb) { b = i; i++ } else if (i + 1 < acc.length && modG(acc[i + 1]) >= umb) { b = i + 1; i += 2 } else break }
  return { ms: acc[b].t - acc[a].t, muestras: b - a + 1 }
}

export function sacudida(w: Lectura[]) {
  if (w.length < 4) return { es: false, inv: 0, f: 0 }
  const ss = [0, 0, 0]
  for (const l of w) { ss[0] += l.ax * l.ax; ss[1] += l.ay * l.ay; ss[2] += l.az * l.az }
  const k = ss.indexOf(Math.max(...ss))
  const val = (l: Lectura) => [l.ax, l.ay, l.az][k] / G
  const lobulos: { signo: number; pico: number; t: number }[] = []
  let actual: { signo: number; pico: number; t: number } | null = null
  for (const l of w) {
    const x = val(l), sg = x >= 0 ? 1 : -1
    if (!actual || actual.signo !== sg) { if (actual) lobulos.push(actual); actual = { signo: sg, pico: Math.abs(x), t: l.t } }
    else if (Math.abs(x) > actual.pico) { actual.pico = Math.abs(x); actual.t = l.t }
  }
  if (actual) lobulos.push(actual)
  const fuertes = lobulos.filter((l) => l.pico >= 2)
  let inv = 0
  const dts: number[] = []
  for (let i = 1; i < fuertes.length; i++) if (fuertes[i].signo !== fuertes[i - 1].signo) { inv++; dts.push(fuertes[i].t - fuertes[i - 1].t) }
  const f = dts.length ? 1000 / (2 * mediana(dts)) : 0
  return { es: inv >= 4 && f >= 2 && f <= 8, inv, f }
}

export interface Veredicto { nivel: 'nada' | 'sospecha' | 'confirmado'; pico: number; tPico: number; motivo: string; s: Record<string, any> }

export function analizarBorrador(acc: Lectura[], vel: Vel[], u: Umbrales): Veredicto {
  let ip = 0
  for (let i = 1; i < acc.length; i++) if (modG(acc[i]) > modG(acc[ip])) ip = i
  const tP = acc[ip].t, pico = modG(acc[ip])
  const r = rachaContigua(acc, ip, u.sospechaG / 2)
  const sostenido = r.ms >= u.msSobreUmbral
  const sac = sacudida(acc.filter((l) => l.t >= tP - 1500 && l.t <= tP + 1500))
  const caidaLibre = acc.some((l) => l.t < tP && l.t >= tP - 150 && l.gTotal < 0.35)
  const conf = vel.filter((v) => v.kmh !== null) as (Vel & { kmh: number })[]
  const previas = conf.filter((v) => v.t >= tP - 10000 && v.t <= tP - 500)
  const post = conf.filter((v) => v.t >= tP && v.t <= tP + u.post)
  const medPrev = previas.length ? mediana(previas.map((v) => v.kmh)) : NaN
  const velocidadDisponible = previas.length >= 2 && post.length >= 2
  const enVehiculo = previas.length > 0 && medPrev >= u.velocidadPreviaKmh
  const bajas = post.filter((v) => v.kmh <= u.velocidadPosteriorKmh).length
  const caidaDeVelocidad = enVehiculo && bajas >= 2
  const s = { pico: +pico.toFixed(1), sostMs: Math.round(r.ms), sostenido, sac: sac.es, inv: sac.inv, caidaLibre, medPrev: +medPrev.toFixed(0), nPrev: previas.length, nPost: post.length, bajas, enVehiculo, caidaDeVelocidad, velocidadDisponible }
  const base = pico >= u.sospechaG && sostenido
  if (!base) return { nivel: 'nada', pico, tPico: tP, motivo: pico < u.sospechaG ? 'bajo umbral' : 'no sostenido', s }
  if (velocidadDisponible) {
    if (sac.es) return { nivel: 'nada', pico, tPico: tP, motivo: 'sacudida', s }
    if (caidaLibre && !caidaDeVelocidad) return { nivel: 'nada', pico, tPico: tP, motivo: 'caida libre', s }
    if (medPrev < 10 && pico < u.confirmadoG) return { nivel: 'nada', pico, tPico: tP, motivo: 'detenido', s }
    if (caidaDeVelocidad || (pico >= u.confirmadoG && enVehiculo)) return { nivel: 'confirmado', pico, tPico: tP, motivo: caidaDeVelocidad ? 'caida vel' : 'pico+enVehiculo', s }
    if (enVehiculo || pico >= u.confirmadoG) return { nivel: 'sospecha', pico, tPico: tP, motivo: enVehiculo ? 'enVehiculo' : 'pico>=conf', s }
    return { nivel: 'nada', pico, tPico: tP, motivo: 'sin contexto', s }
  }
  if (sac.es) return { nivel: 'nada', pico, tPico: tP, motivo: 'sacudida (sin vel)', s }
  if (caidaLibre) return { nivel: 'nada', pico, tPico: tP, motivo: 'caida libre (sin vel)', s }
  return { nivel: pico >= u.confirmadoG ? 'confirmado' : 'sospecha', pico, tPico: tP, motivo: 'sin velocidad', s }
}

// motor por episodios del borrador: abre con la primera muestra >= sospechaG, ventana [tAbre-2 s, tAbre+POST]
export function motorBorrador(acc: Lectura[], vel: Vel[], u: Umbrales, analizar = analizarBorrador) {
  const res: Veredicto[] = []
  let abierto: number | null = null
  let marcadoHasta = -Infinity
  for (const l of acc) {
    if (abierto !== null && l.t >= abierto + u.post) {
      const w = acc.filter((x) => x.t >= abierto! - 2000 && x.t <= abierto! + u.post)
      const v = vel.filter((x) => x.tDisp <= l.t)
      res.push(analizar(w, v, u))
      marcadoHasta = abierto + u.post
      abierto = null
    }
    if (abierto === null && l.t > marcadoHasta && modG(l) >= u.sospechaG) abierto = l.t
  }
  return res
}

export const alerta = (vs: Veredicto[]) => vs.some((v) => v.nivel !== 'nada')

// ---------------------------------------------------------------- conducción (§2.3 caída imposible, §2.4 maniobras)
export function caidaImposible(vel: Vel[], u: Umbrales, gImp = 1.1) {
  const c = vel.filter((v) => v.kmh !== null) as (Vel & { kmh: number })[]
  const eventos: { t: number; g: number }[] = []
  for (let j = 1; j < c.length; j++) {
    if (c[j].kmh > u.velocidadPosteriorKmh) continue
    let i = j - 1
    while (i >= 0 && c[i].kmh < u.velocidadPreviaKmh) { if (c[i].kmh <= u.velocidadPosteriorKmh) break; i-- }
    if (i < 0 || c[i].kmh < u.velocidadPreviaKmh) continue
    const g = (c[i].kmh - c[j].kmh) / ((c[j].t - c[i].t) / 1000) / KMHS_POR_G
    if (g <= gImp) continue
    const despues = c.filter((v) => v.t > c[j].t && v.t <= c[j].t + 5000)
    const ultimo = c[c.length - 1].t
    if (ultimo >= c[j].t + 5000 && despues.every((v) => v.kmh <= u.velocidadPosteriorKmh)) { eventos.push({ t: c[j].t, g }); j += 5 }
  }
  return eventos
}

export interface Maniobra { tipo: 'frenada' | 'aceleracion'; t: number; g: number; corroborada: boolean | null }
export function maniobrasBorrador(vel: Vel[], acc: Lectura[] | null, frenadaG = 0.45, aceleracionG = 0.4, corrobG = 0.3) {
  const c = vel.filter((v) => v.kmh !== null) as (Vel & { kmh: number })[]
  const out: Maniobra[] = []
  const ultimo: Record<string, number> = { frenada: -Infinity, aceleracion: -Infinity }
  for (const tipo of ['frenada', 'aceleracion'] as const) {
    let ini = -1
    for (let k = 1; k <= c.length; k++) {
      const pendiente = k < c.length ? (c[k].kmh - c[k - 1].kmh) / ((c[k].t - c[k - 1].t) / 1000) : 0
      const cumple = k < c.length && (tipo === 'frenada' ? pendiente <= -frenadaG * KMHS_POR_G : pendiente >= aceleracionG * KMHS_POR_G)
      if (cumple) { if (ini < 0) ini = k - 1; continue }
      if (ini >= 0) {
        const fin = k - 1
        const dur = c[fin].t - c[ini].t
        const okVel = tipo === 'aceleracion' || c[ini].kmh >= 20
        if (dur >= 999 && okVel && c[fin].t - ultimo[tipo] >= 10000) {
          let corroborada: boolean | null = null
          if (acc) {
            const w = acc.filter((l) => l.t >= c[ini].t && l.t <= c[fin].t)
            corroborada = w.some((l) => Math.hypot(l.hx!, l.hy!, l.hz!) >= corrobG)
          }
          const g = Math.abs(c[fin].kmh - c[ini].kmh) / (dur / 1000) / KMHS_POR_G
          if (corroborada !== false) { out.push({ tipo, t: c[fin].t, g, corroborada }); ultimo[tipo] = c[fin].t }
        }
        ini = -1
      }
    }
  }
  return out
}
