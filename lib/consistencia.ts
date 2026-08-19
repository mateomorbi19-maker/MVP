/**
 * Motor de consistencia.
 *
 * Contrasta lo que declaró el conductor contra datos objetivos (clima real, hora solar,
 * geolocalización) y contra la coherencia interna de sus propias respuestas.
 *
 * Criterio de diseño deliberado: el motor NO dice quién tuvo la culpa ni acusa de fraude.
 * Marca contradicciones verificables y las deja a criterio del liquidador. Esa distinción
 * importa legalmente: un sistema que "detecta fraude" automáticamente genera
 * responsabilidad propia; uno que señala contradicciones objetivas, no.
 */

import type { Clima } from './clima'
import { calleCoincide } from './geo'

export type Nivel = 'alerta' | 'atencion' | 'cobertura' | 'ok'

export interface Hallazgo {
  nivel: Nivel
  titulo: string
  declarado: string
  objetivo: string
  detalle: string
}

export interface InformeConsistencia {
  generado_en: string
  hallazgos: Hallazgo[]
  resumen: { alertas: number; atenciones: number; banderas_cobertura: number; controles_ok: number }
  completitud: { fotos_obligatorias: number; fotos_presentes: number; tiene_audio: boolean; testigos: number }
}

interface Entrada {
  respuestas: Record<string, unknown>
  clima: Clima | null
  direccion: string | null
  gpsCapturadoEn: string | null
  fotos: Array<{ guia_id: string | null }>
  fotosObligatorias: string[]
  tieneAudio: boolean
  testigos: number
}

const s = (v: unknown): string => (typeof v === 'string' ? v : '')
const n = (v: unknown): number | null => {
  const x = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(x) ? x : null
}

export function analizar(e: Entrada): InformeConsistencia {
  const h: Hallazgo[] = []
  const r = e.respuestas
  const clima = e.clima

  /* --- 1. Pavimento declarado vs precipitación real --- */
  const pavimento = s(r.pavimento)
  if (pavimento && clima?.precipitacion_3h_mm !== null && clima?.precipitacion_3h_mm !== undefined) {
    const llovio = clima.precipitacion_3h_mm > 0.2
    let pavimentoObservado = false
    if (pavimento === 'Seco' && llovio) {
      h.push({
        nivel: 'alerta',
        titulo: 'Pavimento declarado seco con lluvia registrada',
        declarado: 'Pavimento seco',
        objetivo: `${clima.precipitacion_3h_mm} mm de precipitación en las 3 horas previas`,
        detalle:
          'La condición del pavimento incide directamente en la distancia de frenado y en la atribución de responsabilidad. Conviene repreguntar.',
      })
      pavimentoObservado = true
    } else if (pavimento === 'Mojado' && !llovio) {
      h.push({
        nivel: 'atencion',
        titulo: 'Pavimento declarado mojado sin lluvia registrada',
        declarado: 'Pavimento mojado',
        objetivo: 'Sin precipitación registrada en las 3 horas previas',
        detalle: 'Puede deberse a riego, rotura de caño o humedad local, que el modelo meteorológico no capta.',
      })
      pavimentoObservado = true
    }
    if (pavimento === 'Con hielo o escarcha' && clima.temperatura_c !== null && clima.temperatura_c > 5) {
      h.push({
        nivel: 'alerta',
        titulo: 'Hielo declarado con temperatura incompatible',
        declarado: 'Pavimento con hielo o escarcha',
        objetivo: `Temperatura registrada: ${clima.temperatura_c} °C`,
        detalle: 'No se forma hielo en calzada con esa temperatura ambiente.',
      })
      pavimentoObservado = true
    }
    if (!pavimentoObservado) {
      h.push({
        nivel: 'ok',
        titulo: 'Estado del pavimento consistente',
        declarado: pavimento,
        objetivo: `${clima.precipitacion_3h_mm} mm en las 3 horas previas`,
        detalle: 'La declaración coincide con los datos meteorológicos.',
      })
    }
  }

  /* --- 2. Clima declarado vs condición real --- */
  const climaDecl = s(r.clima)
  if (climaDecl && clima) {
    const precip = clima.precipitacion_mm ?? 0
    const secoDeclarado = climaDecl === 'Despejado' || climaDecl === 'Nublado'
    const lluviaDeclarada = climaDecl === 'Lloviznando' || climaDecl === 'Lluvia fuerte'

    /** Categoría real según el código WMO, para comparar contra lo declarado. */
    const categoriaReal = ((codigo: number | null): string | null => {
      if (codigo === null) return null
      if (codigo <= 1) return 'Despejado'
      if (codigo <= 3) return 'Nublado'
      if (codigo === 45 || codigo === 48) return 'Niebla'
      if (codigo >= 51 && codigo <= 57) return 'Lloviznando'
      if (codigo === 61) return 'Lloviznando'
      return 'Lluvia fuerte'
    })(clima.codigo_wmo)

    if (secoDeclarado && precip > 0.5) {
      h.push({
        nivel: 'alerta',
        titulo: 'Clima declarado sin lluvia, pero llovía',
        declarado: climaDecl,
        objetivo: `${clima.descripcion} — ${precip} mm en la hora del hecho`,
        detalle: 'Contradicción directa con el registro meteorológico del punto y la hora.',
      })
    } else if (lluviaDeclarada && precip === 0) {
      h.push({
        nivel: 'atencion',
        titulo: 'Lluvia declarada sin precipitación registrada',
        declarado: climaDecl,
        objetivo: `${clima.descripcion} — sin precipitación en la hora del hecho`,
        detalle: 'Las lluvias muy localizadas pueden no aparecer en el modelo. No es concluyente por sí solo.',
      })
    } else if (climaDecl === 'Niebla' && (clima.visibilidad_m ?? 99999) > 5000) {
      h.push({
        nivel: 'atencion',
        titulo: 'Niebla declarada con buena visibilidad registrada',
        declarado: 'Niebla',
        objetivo: `Visibilidad estimada: ${Math.round((clima.visibilidad_m ?? 0) / 1000)} km`,
        detalle: 'La niebla de banco es muy local y puede no estar reflejada en el modelo.',
      })
    } else if (climaDecl === 'Viento fuerte' && (clima.rafaga_kmh ?? 0) < 30) {
      h.push({
        nivel: 'atencion',
        titulo: 'Viento fuerte declarado sin registro de ráfagas',
        declarado: 'Viento fuerte',
        objetivo: `Ráfagas registradas: ${clima.rafaga_kmh ?? 0} km/h`,
        detalle: 'Las ráfagas registradas no alcanzan valores que afecten la conducción.',
      })
    } else if (categoriaReal !== null && categoriaReal !== climaDecl) {
      // Difieren, pero ambos sin precipitación: la nubosidad es apreciación subjetiva
      // y no incide sobre la responsabilidad. Se deja asentada la diferencia sin
      // presentarla como contradicción, y sobre todo sin afirmar que coinciden.
      h.push({
        nivel: 'ok',
        titulo: 'Sin contradicción climática relevante',
        declarado: climaDecl,
        objetivo: clima.descripcion,
        detalle:
          'Hay una diferencia menor de nubosidad respecto del registro, sin incidencia sobre la visibilidad ni sobre el estado de la calzada. La apreciación de la nubosidad es subjetiva y muy local.',
      })
    } else {
      h.push({
        nivel: 'ok',
        titulo: 'Condición climática consistente',
        declarado: climaDecl,
        objetivo: clima.descripcion,
        detalle: 'La declaración coincide con el registro meteorológico.',
      })
    }
  }

  /* --- 3. Luz declarada vs hora solar real --- */
  const luz = s(r.luz)
  if (luz && clima?.es_de_dia !== null && clima?.es_de_dia !== undefined) {
    const dijoDia = luz === 'De día, buena luz' || luz === 'Sol de frente'
    const dijoNoche = luz === 'De noche con iluminación' || luz === 'De noche sin iluminación'
    const horaSolar = `amanecer ${(clima.amanecer ?? '').slice(11, 16)} / atardecer ${(clima.atardecer ?? '').slice(11, 16)}`

    if (dijoDia && !clima.es_de_dia) {
      h.push({
        nivel: 'alerta',
        titulo: 'Declaró luz diurna en horario nocturno',
        declarado: luz,
        objetivo: `El hecho se registró fuera del horario de luz solar (${horaSolar})`,
        detalle: 'La visibilidad es un factor central en la atribución de responsabilidad.',
      })
    } else if (dijoNoche && clima.es_de_dia) {
      h.push({
        nivel: 'alerta',
        titulo: 'Declaró oscuridad en horario diurno',
        declarado: luz,
        objetivo: `El hecho se registró dentro del horario de luz solar (${horaSolar})`,
        detalle: 'Revisar si la hora declarada del siniestro coincide con la hora de la captura.',
      })
    } else {
      h.push({
        nivel: 'ok',
        titulo: 'Condición de luz consistente',
        declarado: luz,
        objetivo: clima.es_de_dia ? `Horario diurno (${horaSolar})` : `Horario nocturno (${horaSolar})`,
        detalle: 'La declaración coincide con la hora solar del lugar.',
      })
    }
  }

  /* --- 4. Antigüedad declarada del hecho --- */
  const momento = s(r.momento_declarado)
  if (momento) {
    if (momento === 'Ayer o antes' || momento === 'Hace más de 2 horas') {
      h.push({
        nivel: 'alerta',
        titulo: 'La evidencia objetiva no corresponde al momento del hecho',
        declarado: momento,
        objetivo: `Datos de GPS y clima capturados el ${e.gpsCapturadoEn ? new Date(e.gpsCapturadoEn).toLocaleString('es-AR') : 'momento de la carga'}`,
        detalle:
          'La ubicación y las condiciones meteorológicas registradas son las del momento de la carga, no las del siniestro. El valor probatorio del expediente cae sensiblemente y el motor de consistencia no puede contrastar el resto de las respuestas.',
      })
    } else if (momento === 'Recién, hace menos de 10 minutos') {
      h.push({
        nivel: 'ok',
        titulo: 'Captura inmediata al hecho',
        declarado: momento,
        objetivo: 'GPS y clima corresponden al momento del siniestro',
        detalle: 'Es el escenario de máximo valor probatorio: la declaración se toma antes de cualquier elaboración.',
      })
    }
  }

  /* --- 5. Lugar declarado vs geolocalización --- */
  const calle = s(r.calle)
  if (calle && e.direccion) {
    if (!calleCoincide(calle, e.direccion)) {
      h.push({
        nivel: 'atencion',
        titulo: 'La calle declarada no coincide con la ubicación registrada',
        declarado: calle,
        objetivo: e.direccion,
        detalle:
          'Puede ser un error de tipeo, un nombre popular distinto al catastral, o que la carga se haya hecho lejos del lugar del hecho.',
      })
    } else {
      h.push({
        nivel: 'ok',
        titulo: 'Ubicación consistente',
        declarado: calle,
        objetivo: e.direccion,
        detalle: 'La calle declarada coincide con las coordenadas registradas.',
      })
    }
  }

  /* --- 6. Coherencia interna de la mecánica --- */
  const velocidad = n(r.velocidad)
  const maniobra = s(r.maniobra)
  const freno = s(r.freno)

  if (maniobra === 'Detenido por completo' && velocidad !== null && velocidad > 5) {
    h.push({
      nivel: 'alerta',
      titulo: 'Contradicción interna: detenido pero con velocidad declarada',
      declarado: `${maniobra}, a ${velocidad} km/h`,
      objetivo: 'Ambas respuestas son incompatibles entre sí',
      detalle: 'Contradicción dentro de la propia declaración, sin necesidad de contrastar con datos externos.',
    })
  }
  if (freno === 'Sí, frené a fondo' && velocidad !== null && velocidad === 0) {
    h.push({
      nivel: 'atencion',
      titulo: 'Frenada declarada con velocidad cero',
      declarado: `${freno}, a ${velocidad} km/h`,
      objetivo: 'Respuestas de difícil compatibilidad',
      detalle: 'Conviene repreguntar para precisar la mecánica del hecho.',
    })
  }
  if (velocidad !== null && velocidad > 130) {
    h.push({
      nivel: 'atencion',
      titulo: 'Velocidad declarada muy elevada',
      declarado: `${velocidad} km/h`,
      objetivo: 'Supera el máximo legal en cualquier vía del país',
      detalle: 'Puede configurar agravante o causal de exclusión según las condiciones de la póliza.',
    })
  }

  /* --- 7. Banderas de cobertura --- */
  const licencia = s(r.licencia_vigente)
  if (licencia === 'No, estaba vencida' || licencia === 'No tengo licencia') {
    h.push({
      nivel: 'cobertura',
      titulo: 'Licencia de conducir no vigente',
      declarado: licencia,
      objetivo: 'Causal habitual de exclusión de cobertura',
      detalle: 'Verificar contra el registro de licencias y las condiciones particulares de la póliza.',
    })
  }
  if (s(r.alcoholemia) === 'Sí, dio positivo') {
    h.push({
      nivel: 'cobertura',
      titulo: 'Test de alcoholemia positivo',
      declarado: 'Positivo',
      objetivo: 'Causal habitual de exclusión de cobertura',
      detalle: 'Solicitar el acta de la autoridad interviniente con el valor registrado.',
    })
  }
  if (s(r.alcoholemia) === 'Se ofreció y no se realizó') {
    h.push({
      nivel: 'atencion',
      titulo: 'Test de alcoholemia ofrecido y no realizado',
      declarado: 'No se realizó',
      objetivo: 'Sin determinación objetiva de alcoholemia',
      detalle: 'En varias jurisdicciones la negativa tiene el mismo efecto que el resultado positivo.',
    })
  }
  if (s(r.quien_conducia) === 'Otra persona') {
    h.push({
      nivel: 'cobertura',
      titulo: 'Conducía una persona distinta del titular',
      declarado: 'Otra persona al volante',
      objetivo: 'Verificar que esté alcanzada por la póliza',
      detalle: 'Contrastar los datos cargados contra los conductores declarados en la póliza.',
    })
  }
  if (s(r.uso_vehiculo) === 'Trabajo con el vehículo (reparto, aplicación, taxi)') {
    h.push({
      nivel: 'cobertura',
      titulo: 'Uso comercial del vehículo',
      declarado: 'Trabajo con el vehículo',
      objetivo: 'Verificar el destino declarado en la póliza',
      detalle: 'Si la póliza es de uso particular, el uso comercial suele ser causal de exclusión.',
    })
  }
  if (s(r.vtv) === 'No') {
    h.push({
      nivel: 'cobertura',
      titulo: 'Revisión técnica no vigente',
      declarado: 'VTV no vigente',
      objetivo: 'Verificar exigibilidad según jurisdicción y condiciones de póliza',
      detalle: 'Su incidencia sobre la cobertura varía según la jurisdicción y el texto de la póliza.',
    })
  }
  if (s(r.tercero_actitud) === 'Se dio a la fuga') {
    h.push({
      nivel: 'atencion',
      titulo: 'El tercero se dio a la fuga',
      declarado: 'Fuga del tercero',
      objetivo: 'Sin datos del responsable para subrogación',
      detalle:
        'Verificar denuncia policial y reforzar la prueba fotográfica. Es también un patrón que conviene revisar con criterio antifraude.',
    })
  }

  /* --- 8. Completitud probatoria --- */
  const guiasPresentes = new Set(e.fotos.map((f) => f.guia_id).filter(Boolean) as string[])
  const faltantes = e.fotosObligatorias.filter((g) => !guiasPresentes.has(g))
  if (faltantes.length > 0) {
    h.push({
      nivel: 'atencion',
      titulo: `Faltan ${faltantes.length} de ${e.fotosObligatorias.length} fotografías obligatorias`,
      declarado: `${guiasPresentes.size} tomas cargadas`,
      objetivo: `Faltantes: ${faltantes.join(', ')}`,
      detalle: 'Las tomas faltantes debilitan la reconstrucción posterior del hecho.',
    })
  }
  if (!e.tieneAudio) {
    h.push({
      nivel: 'atencion',
      titulo: 'Sin relato en audio',
      declarado: 'No se grabó el relato',
      objetivo: 'Falta la declaración espontánea del conductor',
      detalle: 'El relato tomado en el momento es la pieza de mayor valor probatorio del expediente.',
    })
  }
  if (e.testigos === 0) {
    h.push({
      nivel: 'atencion',
      titulo: 'Sin testigos registrados',
      declarado: 'Ningún testigo cargado',
      objetivo: 'Sin prueba testimonial',
      detalle: 'Los datos de testigos son irrecuperables pasados los primeros minutos.',
    })
  }

  const resumen = {
    alertas: h.filter((x) => x.nivel === 'alerta').length,
    atenciones: h.filter((x) => x.nivel === 'atencion').length,
    banderas_cobertura: h.filter((x) => x.nivel === 'cobertura').length,
    controles_ok: h.filter((x) => x.nivel === 'ok').length,
  }

  return {
    generado_en: new Date().toISOString(),
    hallazgos: h,
    resumen,
    completitud: {
      fotos_obligatorias: e.fotosObligatorias.length,
      fotos_presentes: guiasPresentes.size,
      tiene_audio: e.tieneAudio,
      testigos: e.testigos,
    },
  }
}

export const ETIQUETA_NIVEL: Record<Nivel, string> = {
  alerta: 'CONTRADICCION',
  atencion: 'A REVISAR',
  cobertura: 'COBERTURA',
  ok: 'CONSISTENTE',
}
