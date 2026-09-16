import { Lectura, Vel, Umbrales, Veredicto, modG, rachaContigua, sacudida, mediana, KMHS_POR_G, G } from './base.mts'

export interface UmbralesP extends Umbrales { previaKmh: number; giroManipulacionDps: number; topeEpisodio: number }
export const UP: UmbralesP = { sospechaG: 4, confirmadoG: 8, msSobreUmbral: 30, velocidadPreviaKmh: 30, velocidadPosteriorKmh: 8, giroDps: 180, post: 8000, previaKmh: 25, giroManipulacionDps: 300, topeEpisodio: 15000 }

type Conf = Vel & { kmh: number }
const rango: Record<string, number> = { nada: 0, sospecha: 1, confirmado: 2 }

export function contextoVelocidad(vel: Vel[], tP: number, u: UmbralesP) {
  const c = vel.filter((v) => v.kmh !== null) as Conf[]
  const previas = c.filter((v) => v.t >= tP - 8000 && v.t <= tP + 1500)
  let previa = NaN
  if (previas.length) {
    const meds = previas.length >= 3 ? previas.slice(2).map((_, i) => mediana([previas[i].kmh, previas[i + 1].kmh, previas[i + 2].kmh])) : [mediana(previas.map((v) => v.kmh))]
    previa = Math.max(...meds)
  }
  const post = c.filter((v) => v.t >= tP + 2000 && v.t <= tP + u.post)
  const bajas = post.filter((v) => v.kmh <= u.velocidadPosteriorKmh).length
  let desplazKmh = NaN
  const fixes = vel.filter((v) => v.t >= tP + 2000 && v.t <= tP + u.post)
  if (fixes.length >= 2 && fixes[fixes.length - 1].t - fixes[0].t >= 3000) {
    const a = fixes[0], b = fixes[fixes.length - 1]
    desplazKmh = Math.hypot(b.x - a.x, b.y - a.y) / ((b.t - a.t) / 1000) * 3.6
  }
  const detenido = bajas >= 2 || desplazKmh <= 6
  const ult = post.slice(-3).map((v) => v.kmh)
  const sigueAndando = !detenido && ult.length >= 2 && mediana(ult) >= Math.max(15, 0.5 * (previa || 0))
  const disponible = previas.length >= 2 && (post.length >= 2 || fixes.length >= 2)
  return { previa, enVehiculo: previa >= u.previaKmh, detenido, sigueAndando, disponible, bajas, desplazKmh }
}

export function analizarPropuesta(acc: Lectura[], vel: Vel[], u: UmbralesP): Veredicto {
  // sub-picos: cada racha de muestras >= sospechaG separada > 500 ms se evalúa por su cuenta
  const fuertes = acc.map((l, i) => [i, modG(l)] as const).filter(([, m]) => m >= u.sospechaG)
  const grupos: number[][] = []
  for (const [i] of fuertes) { const g = grupos[grupos.length - 1]; if (g && acc[i].t - acc[g[g.length - 1]].t <= 300) g.push(i); else grupos.push([i]) }
  let mejor: Veredicto = { nivel: 'nada', pico: 0, tPico: acc[0]?.t ?? 0, motivo: 'bajo umbral', s: {} }
  for (const g of grupos) {
    const ip = g.reduce((a, b) => (modG(acc[b]) > modG(acc[a]) ? b : a))
    const tP = acc[ip].t, pico = modG(acc[ip])
    const r = rachaContigua(acc, ip, u.sospechaG / 2)
    const sost = r.ms >= u.msSobreUmbral
    const sacAll = sacudida(acc.filter((l) => l.t >= tP - 1500 && l.t <= tP + 1500))
    // periodicidad que YA estaba antes del pico: la mano sacude antes y después; el soporte sólo resuena después
    const lobPrev = (() => { let n = 0, sg = 0, pk = 0; for (const l of acc.filter((l) => l.t >= tP - 1500 && l.t <= tP - 100)) { const x = Math.max(Math.abs(l.ax), Math.abs(l.ay), Math.abs(l.az)) / G; const s2 = Math.sign([l.ax, l.ay, l.az].reduce((a, b) => (Math.abs(b) > Math.abs(a) ? b : a))); if (s2 !== sg) { if (pk >= 2) n++; sg = s2; pk = 0 } pk = Math.max(pk, x) } if (pk >= 2) n++; return n })()
    const sacPrev = sacAll.es && lobPrev >= 2
    const pre = acc.filter((l) => l.t >= tP - 700 && l.t <= tP - 80)
    const giroPrevio = pre.reduce((m, l) => Math.max(m, l.giro), 0)
    let racha = 0, maxRacha = 0
    for (const l of acc.filter((l) => l.t >= tP - 700 && l.t <= tP - 30)) { racha = l.gTotal < 0.5 ? racha + 1 : 0; maxRacha = Math.max(maxRacha, racha) }
    const manipulado = giroPrevio >= u.giroManipulacionDps || maxRacha >= 4
    const cv = contextoVelocidad(vel, tP, u)
    const s = { pico: +pico.toFixed(1), sostMs: Math.round(r.ms), sacPrev, giroPrevio: Math.round(giroPrevio), caidaLibreMs: Math.round(maxRacha * 16.7), ...cv }
    let v: Veredicto
    const mk = (nivel: Veredicto['nivel'], motivo: string): Veredicto => ({ nivel, pico, tPico: tP, motivo, s })
    if (!(pico >= u.sospechaG && sost)) v = mk('nada', 'no sostenido')
    else if (cv.disponible) {
      if (cv.sigueAndando) v = mk('nada', 'siguió andando')
      else if (cv.enVehiculo && cv.detenido) v = mk('confirmado', 'andaba y quedó detenido')
      else if (sacPrev || manipulado) v = mk('nada', sacPrev ? 'sacudida previa' : 'manipulado/caída')
      else if (cv.enVehiculo) v = mk('sospecha', 'andaba, sin detención clara')
      else if (pico >= u.confirmadoG && r.ms >= 50) v = mk('sospecha', 'golpe fuerte detenido')
      else v = mk('nada', 'detenido')
    } else {
      if (sacPrev || manipulado) v = mk('nada', 'sin vel: manipulado/sacudida')
      else v = mk(pico >= u.confirmadoG ? 'confirmado' : 'sospecha', 'sin velocidad')
    }
    if (rango[v.nivel] > rango[mejor.nivel] || (v.nivel === mejor.nivel && pico > mejor.pico)) mejor = v
  }
  return mejor
}

// episodio que se extiende mientras haya golpes, y cierra POST después del ÚLTIMO (con tope)
export function motorPropuesta(acc: Lectura[], vel: Vel[], u: UmbralesP) {
  const res: Veredicto[] = []
  let abre: number | null = null, ultimo = 0, marcado = -Infinity
  for (const l of acc) {
    const m = modG(l)
    if (abre !== null) {
      if (m >= u.sospechaG && l.t < abre + u.topeEpisodio) ultimo = l.t
      if (l.t >= Math.min(ultimo + u.post, abre + u.topeEpisodio + u.post)) {
        const w = acc.filter((x) => x.t >= abre! - 2000 && x.t <= l.t)
        res.push(analizarPropuesta(w, vel.filter((x) => x.tDisp <= l.t), u))
        marcado = l.t; abre = null
      }
    }
    if (abre === null && l.t > marcado && m >= u.sospechaG) { abre = l.t; ultimo = l.t }
  }
  return res
}

// caída de velocidad sin golpe: GPS + posición confirman detención, y el acelerómetro NO muestra una frenada
export function caidaSinFrenada(vel: Vel[], acc: Lectura[] | null, u: UmbralesP) {
  if (!acc) return []
  const c = vel.filter((v) => v.kmh !== null) as Conf[]
  const out: { t: number }[] = []
  let ultimo = -Infinity
  for (let j = 0; j < c.length; j++) {
    if (c[j].kmh > u.velocidadPosteriorKmh || c[j].t < ultimo + 20000) continue
    const antes = c.filter((v) => v.t >= c[j].t - 6000 && v.t < c[j].t)
    if (antes.length < 3) continue
    const meds = antes.slice(2).map((_, i) => mediana([antes[i].kmh, antes[i + 1].kmh, antes[i + 2].kmh]))
    if (Math.max(...meds) < 30) continue
    const despues = vel.filter((v) => v.t >= c[j].t && v.t <= c[j].t + 6000)
    if (!despues.length || despues[despues.length - 1].t - c[j].t < 5000) continue
    const a = despues[0], b = despues[despues.length - 1]
    const kmhPos = Math.hypot(b.x - a.x, b.y - a.y) / ((b.t - a.t) / 1000) * 3.6
    const bajas = despues.filter((v) => v.kmh !== null && v.kmh <= u.velocidadPosteriorKmh).length
    if (kmhPos > 6 || bajas < 3) continue
    // ¿la bajada la explica una frenada? integral de la horizontal < 2 Hz (con banda muerta) en los 10 s previos,
    // SIN la ventana de 600 ms más densa (un golpe concentra su Δv ahí; una frenada lo reparte en segundos)
    const w = acc.filter((l) => l.t >= c[j].t - 10000 && l.t <= c[j].t + 1500)
    const inc = w.map((l, i) => (i ? Math.max(0, Math.hypot(l.hx!, l.hy!, l.hz!) - 0.05) * (l.t - w[i - 1].t) / 1000 * KMHS_POR_G : 0))
    const total = inc.reduce((a, b) => a + b, 0)
    let densa = 0
    for (let i = 0, k = 0, acum = 0; i < w.length; i++) { acum += inc[i]; while (w[i].t - w[k].t > 600) { acum -= inc[k]; k++ } densa = Math.max(densa, acum) }
    const dv = Math.max(...meds) - c[j].kmh
    if (total - densa >= 0.4 * dv) continue
    out.push({ t: c[j].t }); ultimo = c[j].t
  }
  return out
}

// maniobras: el acelerómetro detecta y fecha (sin retraso); el GPS clasifica con ventana tolerante al retraso
export function maniobrasPropuesta(vel: Vel[], acc: Lectura[] | null, frenadaG = 0.45, aceleracionG = 0.4) {
  const c = vel.filter((v) => v.kmh !== null) as Conf[]
  const out: { tipo: 'frenada' | 'aceleracion'; t: number; g: number }[] = []
  if (!acc) {
    // sólo GPS: pendiente sobre 2 s (dos intervalos) y umbral más alto
    let ult = -Infinity
    for (let k = 2; k < c.length; k++) {
      const dt = (c[k].t - c[k - 2].t) / 1000
      if (dt < 1.8 || dt > 2.6) continue
      const pend = (c[k].kmh - c[k - 2].kmh) / dt
      if (c[k - 2].kmh >= 20 && pend <= -0.55 * KMHS_POR_G && c[k].t - ult >= 10000) { out.push({ tipo: 'frenada', t: c[k].t, g: -pend / KMHS_POR_G }); ult = c[k].t }
    }
    return out
  }
  const umbral = Math.min(frenadaG, aceleracionG) * 0.8
  let ini = -1, suma = 0, ult = -Infinity
  for (let i = 1; i <= acc.length; i++) {
    const h = i < acc.length ? Math.hypot(acc[i].hx!, acc[i].hy!, acc[i].hz!) : 0
    if (h >= umbral) { if (ini < 0) { ini = i; suma = 0 } suma += h * (acc[i].t - acc[i - 1].t) / 1000; continue }
    if (ini < 0) continue
    const tI = acc[ini].t, tF = acc[i - 1].t, dur = tF - tI
    ini = -1
    if (dur < 1000 || tF - ult < 10000) continue
    const gMedia = suma / (dur / 1000)
    const antes = c.filter((v) => v.t >= tI - 1000 && v.t <= tI + 2500).map((v) => v.kmh)
    const despues = c.filter((v) => v.t >= tF && v.t <= tF + 4500).map((v) => v.kmh)
    if (!antes.length || !despues.length) continue
    const vA = Math.max(...antes), vD = Math.min(...despues), vD2 = Math.max(...despues)
    const dvAcc = suma * KMHS_POR_G
    if (vD - vA <= -0.5 * dvAcc && vA >= 20 && gMedia >= frenadaG) { out.push({ tipo: 'frenada', t: tF, g: gMedia }); ult = tF }
    else if (vD2 - Math.min(...antes) >= 0.5 * dvAcc && gMedia >= aceleracionG) { out.push({ tipo: 'aceleracion', t: tF, g: gMedia }); ult = tF }
  }
  return out
}
