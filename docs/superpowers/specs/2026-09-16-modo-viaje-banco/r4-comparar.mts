import { sembrar, sensar, generarGps, motorBorrador, U, GPS_BASE, SENSOR_8G, caidaImposible, maniobrasBorrador, Gps, Sensor, Escena, Veredicto } from './base.mts'
import { motorPropuesta, UP, caidaSinFrenada, maniobrasPropuesta } from './propuesta.mts'
import * as S from './escenas.mts'

const N = Number(process.env.N || 80)
sembrar(99)
const p = (x: number) => `${Math.round(100 * x / N)}%`
const L2 = { lag: 2000, tau: 500 }

function fila(nombre: string, mk: () => Escena, gps: Partial<Gps> = L2, sensor: Sensor = SENSOR_8G, esperado: 'alerta' | 'nada') {
  let b = 0, pr = 0
  const motivosP: Record<string, number> = {}
  for (let k = 0; k < N; k++) {
    const e = mk()
    const acc = sensar(e, sensor)
    const vel = generarGps(e, { ...GPS_BASE, ...gps })
    const vb = motorBorrador(acc, vel, U)
    if (vb.some((v) => v.nivel !== 'nada') || caidaImposible(vel, U).length) b++
    const vp = motorPropuesta(acc, vel, UP)
    const ap = vp.some((v) => v.nivel !== 'nada') || caidaSinFrenada(vel, gps.sinGps ? null : acc, UP).length > 0
    if (ap) pr++
    const m: Veredicto | undefined = vp.find((v) => v.nivel !== 'nada') ?? vp[0]
    const key = m ? `${m.nivel}:${m.motivo}` : (ap ? 'caída sin frenada' : 'sin episodio')
    motivosP[key] = (motivosP[key] ?? 0) + 1
  }
  const top = Object.entries(motivosP).sort((a, c) => c[1] - a[1]).slice(0, 2).map(([m, c]) => `${m} ${p(c)}`).join('; ')
  console.log(`| ${nombre} | ${esperado} | ${p(b)} | ${p(pr)} | ${top} |`)
}

console.log(`N=${N}. GPS por omisión: Android, 1 Hz, lag 2 s (retardo 1.5 s + pasa-bajos 0.5 s), ruido ±3 km/h. Sensor ±8 g, HAL 25 Hz, 60 Hz.`)
console.log('| escenario | esperado | alerta BORRADOR | alerta PROPUESTA | motivo propuesta |')
console.log('|---|---|---|---|---|')
fila('sacudida 4 Hz ±10 cm, estacionado', () => S.sacudida(4, 0.1, 0), L2, SENSOR_8G, 'nada')
fila('sacudida 5 Hz ±5 cm, sin GPS', () => S.sacudida(5, 0.05, 0), { sinGps: true }, SENSOR_8G, 'nada')
fila('sacudida 4 Hz ±10 cm, acompañante a 50', () => S.sacudida(4, 0.1, 50), L2, SENSOR_8G, 'nada')
fila('cae del soporte a 50 (alfombra), sigue', () => S.caidaSoporte(50, false), L2, SENSOR_8G, 'nada')
fila('cae del soporte a 50, sin GPS', () => S.caidaSoporte(50, false), { sinGps: true }, SENSOR_8G, 'nada')
fila('dos pozos 5 s a 50 km/h', () => S.dosPozos(5000), L2, SENSOR_8G, 'nada')
fila('dos pozos 1 s a 50 km/h, lag 3 s', () => S.dosPozos(1000), { lag: 3000, tau: 500 }, SENSOR_8G, 'nada')
fila('pozo x0.7 a 35 km/h', () => S.dosPozos(5000, 35, 0.7), L2, SENSOR_8G, 'nada')
fila('dos pozos 5 s a 50, iOS', () => S.dosPozos(5000), { ...L2, ios: true }, SENSOR_8G, 'nada')
fila('tirar al asiento, estacionado, GPS', () => S.tirarAlAsiento(), L2, SENSOR_8G, 'nada')
fila('tirar al asiento, sin GPS', () => S.tirarAlAsiento(), { sinGps: true }, SENSOR_8G, 'nada')
fila('tirar a la consola (duro), sin GPS', () => S.tirarAlAsiento(true), { sinGps: true }, SENSOR_8G, 'nada')
fila('frenada 0.8 g 60->0 sin golpe', () => S.frenada(0.8, 60, 0), L2, SENSOR_8G, 'nada')
fila('crucero 60, iOS speed=0 espurio 6 s', () => S.crucero(60), { ...L2, speedCeroEn: [[S.T0, S.T0 + 6000]] }, SENSOR_8G, 'nada')
fila('choque 10 g 50->0', () => S.choqueFrontal(10, 50), L2, SENSOR_8G, 'alerta')
fila('choque 5 g 50->0, lag 3 s, sensor ±4 g', () => S.choqueFrontal(5, 50), { lag: 3000, tau: 500 }, { ...SENSOR_8G, rango: 4 }, 'alerta')
fila('choque 6 g 40 km/h, 6 s tras semáforo', () => S.choqueFrontal(6, 40, true), L2, SENSOR_8G, 'alerta')
fila('choque 10 g 40 km/h, 6 s tras semáforo', () => S.choqueFrontal(10, 40, true), L2, SENSOR_8G, 'alerta')
fila('choque 6 g crucero 28 km/h', () => S.choqueFrontal(6, 28), L2, SENSOR_8G, 'alerta')
fila('choque 10 g, soporte 8 Hz ζ 0.08 (resuena)', () => { const e = S.choqueFrontal(10, 50); e.montaje = { fn: 8, zeta: 0.08 }; return e }, L2, SENSOR_8G, 'alerta')
fila('choque 10 g, soporte 6 Hz ζ 0.05, sin GPS', () => { const e = S.choqueFrontal(10, 50); e.montaje = { fn: 6, zeta: 0.05 }; return e }, { sinGps: true }, SENSOR_8G, 'alerta')
fila('choque 10 g 50->0, iOS rho .8', () => S.choqueFrontal(10, 50), { ...L2, ios: true, rho: 0.8 }, SENSOR_8G, 'alerta')
fila('choque 10 g + despedido 1.5 s, sin GPS', () => S.choqueYDespedido(10, 50), { sinGps: true }, SENSOR_8G, 'alerta')
fila('cae del soporte y choque 5 g 3 s después', () => S.caidaLuegoChoque(3000, 5, 50), L2, SENSOR_8G, 'alerta')
fila('vuelco 70 km/h', () => S.vuelco(), L2, SENSOR_8G, 'alerta')
fila('vuelco 70 km/h, sin GPS', () => S.vuelco(), { sinGps: true }, SENSOR_8G, 'alerta')
fila('60->0 en 1 s, teléfono amortiguado (0.26 g)', () => S.paradaSinGolpe(1000), L2, SENSOR_8G, 'alerta')
fila('60->0 en 1 s amortiguado, lag 1 s tau 1 s', () => S.paradaSinGolpe(1000), { lag: 1000, tau: 1000 }, SENSOR_8G, 'alerta')
fila('alcance trasero detenido (3 g)', () => S.alcanceTrasero(true), L2, SENSOR_8G, 'alerta')

console.log('\n## Maniobras: borrador (con acc) vs propuesta (con acc) vs propuesta sólo GPS')
console.log('| caso | esperado | borrador | propuesta | propuesta sólo GPS |')
function man(nombre: string, mk: () => Escena, gps: Partial<Gps>, tipo: 'frenada' | 'aceleracion', esperado: string) {
  let b = 0, pr = 0, g = 0
  for (let k = 0; k < N; k++) {
    const e = mk(); const acc = sensar(e, SENSOR_8G); const vel = generarGps(e, { ...GPS_BASE, ...gps })
    if (maniobrasBorrador(vel, acc).some((m) => m.tipo === tipo)) b++
    if (maniobrasPropuesta(vel, acc).some((m) => m.tipo === tipo)) pr++
    if (maniobrasPropuesta(vel, null).some((m) => m.tipo === tipo)) g++
  }
  console.log(`| ${nombre} | ${esperado} | ${p(b)} | ${p(pr)} | ${p(g)} |`)
}
for (const [nom, gps] of [['lag 1 s', { lag: 1000, tau: 500 }], ['lag 3 s', { lag: 3000, tau: 500 }], ['iOS lag 2 s', { ...L2, ios: true }]] as [string, Partial<Gps>][]) {
  man(`frenada 0.65 g 60->30 (sigue andando), ${nom}`, () => S.frenada(0.65, 60, 30), gps, 'frenada', 'sí')
  man(`frenada 0.5 g 60->30, ${nom}`, () => S.frenada(0.5, 60, 30), gps, 'frenada', 'sí')
  man(`frenada 0.8 g 60->0, ${nom}`, () => S.frenada(0.8, 60, 0), gps, 'frenada', 'sí')
  man(`frenada 0.35 g 50->0, ${nom}`, () => S.frenada(0.35, 50, 0), gps, 'frenada', 'no')
  man(`frenada 0.3 g 50->0 ruido ±5, ${nom}`, () => S.frenada(0.3, 50, 0), { ...gps, ruido: 5 }, 'frenada', 'no')
  man(`aceleración 0.3 g 0->50, ${nom}`, () => S.aceleracion(0.3, 0, 50), gps, 'aceleracion', 'no')
}
{
  const RUNS = 3
  let fb = 0, fp = 0, ab = 0, ap = 0, alb = 0, alp = 0
  for (let r = 0; r < RUNS; r++) {
    const e = S.urbano(20); const acc = sensar(e, SENSOR_8G); const vel = generarGps(e, { ...GPS_BASE, ...L2 })
    const mb = maniobrasBorrador(vel, acc), mp = maniobrasPropuesta(vel, acc)
    fb += mb.filter((m) => m.tipo === 'frenada').length; fp += mp.filter((m) => m.tipo === 'frenada').length
    ab += mb.filter((m) => m.tipo === 'aceleracion').length; ap += mp.filter((m) => m.tipo === 'aceleracion').length
    alb += motorBorrador(acc, vel, U).filter((v) => v.nivel !== 'nada').length + caidaImposible(vel, U).length
    alp += motorPropuesta(acc, vel, UP).filter((v) => v.nivel !== 'nada').length + caidaSinFrenada(vel, acc, UP).length
  }
  const h = RUNS / 3
  console.log(`\nCiudad 1 h (lag 2 s): frenadas falsas/h borrador ${(fb / h).toFixed(0)} propuesta ${(fp / h).toFixed(0)}; aceleraciones falsas/h borrador ${(ab / h).toFixed(0)} propuesta ${(ap / h).toFixed(0)}; ALERTAS de impacto/h borrador ${(alb / h).toFixed(0)} propuesta ${(alp / h).toFixed(0)}`)
}
