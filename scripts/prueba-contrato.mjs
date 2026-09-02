/**
 * Contrato de interfaz: qué puede cambiar un agente visual y qué no.
 *
 * El trabajo de este proyecto está partido en dos: la funcionalidad y el backend por un
 * lado, y la parte visual y estética por el otro, hecha después por otro agente. Este
 * script existe para que un cambio puramente visual que rompa la funcionalidad falle acá,
 * ruidoso, y no dentro de un expediente sellado que ya está en manos de un liquidador.
 *
 * No reemplaza mirar la aplicación: un contraste malo, un texto que desborda o un botón
 * que quedó abajo del pliegue pasan todo esto en verde. Eso lo revisa una persona, con un
 * teléfono, parada al sol.
 *
 *   npm run contrato
 *
 * El documento que esto verifica es docs/CONTRATO-UI.md.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { SECCIONES, GUIA_FOTOS, VALOR } from '../lib/cuestionario.ts'

let fallos = 0
let pruebas = 0

function verificar(nombre, condicion, extra = '') {
  pruebas++
  if (condicion) {
    console.log(`  ok   ${nombre}`)
  } else {
    fallos++
    console.log(`  FALLA ${nombre}`)
    if (extra) console.log(`         ${extra}`)
  }
}

function archivos(dir, filtro) {
  const salida = []
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre)
    if (statSync(ruta).isDirectory()) salida.push(...archivos(ruta, filtro))
    else if (filtro(nombre)) salida.push(ruta)
  }
  return salida
}

const leer = (ruta) => readFileSync(ruta, 'utf8')
const normalizar = (ruta) => ruta.split('\\').join('/')

const css = leer('app/globals.css')
/** Sin comentarios: si no, un comentario que menciona :hover cuenta como si fuera regla. */
const cssSinComentarios = css.replace(/\/\*[\s\S]*?\*\//g, '')
const todosTsx = archivos('app', (n) => n.endsWith('.tsx'))
const pantallas = archivos('app/s/[id]/pantallas', (n) => n.endsWith('.tsx'))

/* ================= Lo congelado ================= */

/*
 * Estos tres bloques son el contrato duro. No se actualizan para que la prueba pase: se
 * actualizan cuando alguien decidió, a sabiendas, cambiar un dato que ya está escrito
 * dentro de expedientes sellados, y resolvió qué se hace con los anteriores.
 */

const VALORES_CONGELADOS = {
  heridos: { NO_NADIE: 'No, nadie', SI_HAY_HERIDOS: 'Sí, hay heridos', NO_LO_SE: 'No lo sé' },
  heridos_gravedad: { LEVES: 'Leves', GRAVES: 'Graves', NO_PUEDO_DETERMINARLO: 'No puedo determinarlo' },
  riesgo: { EL_VEHICULO_OBSTRUYE_LA_CIRCULACION: 'El vehículo obstruye la circulación', HAY_PERDIDA_DE_COMBUSTIBLE: 'Hay pérdida de combustible', RIESGO_DE_INCENDIO: 'Riesgo de incendio', ESTAMOS_SOBRE_UNA_AUTOPISTA_O_RUTA: 'Estamos sobre una autopista o ruta', NO_HAY_RIESGO_INMEDIATO: 'No hay riesgo inmediato' },
  momento_declarado: { RECIEN_HACE_MENOS_DE_10_MINUTOS: 'Recién, hace menos de 10 minutos', ENTRE_10_Y_30_MINUTOS: 'Entre 10 y 30 minutos', ENTRE_30_MINUTOS_Y_2_HORAS: 'Entre 30 minutos y 2 horas', HACE_MAS_DE_2_HORAS: 'Hace más de 2 horas', AYER_O_ANTES: 'Ayer o antes' },
  tipo_siniestro: { COLISION_CON_OTRO_VEHICULO: 'Colisión con otro vehículo', COLISION_CON_OBJETO_FIJO: 'Colisión con objeto fijo', ATROPELLO_A_PEATON_O_CICLISTA: 'Atropello a peatón o ciclista', VUELCO_O_DESPISTE_SIN_TERCEROS: 'Vuelco o despiste sin terceros', COLISION_CON_ANIMAL: 'Colisión con animal', DANO_POR_TERCEROS_CON_EL_AUTO_DETENIDO: 'Daño por terceros con el auto detenido' },
  cantidad_vehiculos: { N1: '1', N2: '2', N3: '3', N4_O_MAS: '4 o más' },
  tercero_actitud: { SI_ESTA_ACA: 'Sí, está acá', SE_RETIRO_DESPUES_DE_INTERCAMBIAR_DATOS: 'Se retiró después de intercambiar datos', SE_DIO_A_LA_FUGA: 'Se dio a la fuga', FUE_TRASLADADO_EN_AMBULANCIA: 'Fue trasladado en ambulancia' },
  maniobra: { CIRCULANDO_DERECHO: 'Circulando derecho', GIRANDO_A_LA_IZQUIERDA: 'Girando a la izquierda', GIRANDO_A_LA_DERECHA: 'Girando a la derecha', CAMBIANDO_DE_CARRIL: 'Cambiando de carril', ADELANTANDO_A_OTRO_VEHICULO: 'Adelantando a otro vehículo', RETROCEDIENDO: 'Retrocediendo', ESTACIONANDO_O_SALIENDO_DE_UN_ESTACIONAMIENTO: 'Estacionando o saliendo de un estacionamiento', DETENIDO_POR_COMPLETO: 'Detenido por completo' },
  freno: { SI_FRENE_A_FONDO: 'Sí, frené a fondo', SI_FRENE_PARCIALMENTE: 'Sí, frené parcialmente', NO_LLEGUE_A_FRENAR: 'No llegué a frenar', NO_RECUERDO: 'No recuerdo' },
  semaforo: { VERDE: 'Verde', AMARILLO: 'Amarillo', ROJO: 'Rojo', NO_HABIA_SEMAFORO: 'No había semáforo', ESTABA_APAGADO_O_INTERMITENTE: 'Estaba apagado o intermitente', NO_LO_RECUERDO: 'No lo recuerdo' },
  senalizacion: { SEMAFORO: 'Semáforo', CARTEL_DE_PARE: 'Cartel de PARE', CARTEL_DE_CEDA_EL_PASO: 'Cartel de ceda el paso', SENDA_PEATONAL: 'Senda peatonal', LOMO_DE_BURRO: 'Lomo de burro', NINGUNA_SENALIZACION: 'Ninguna señalización', NO_LO_RECUERDO: 'No lo recuerdo' },
  pavimento: { SECO: 'Seco', MOJADO: 'Mojado', CON_HIELO_O_ESCARCHA: 'Con hielo o escarcha', RIPIO_TIERRA_O_BARRO: 'Ripio, tierra o barro', EN_OBRA_O_CON_POZOS: 'En obra o con pozos' },
  clima: { DESPEJADO: 'Despejado', NUBLADO: 'Nublado', LLOVIZNANDO: 'Lloviznando', LLUVIA_FUERTE: 'Lluvia fuerte', NIEBLA: 'Niebla', VIENTO_FUERTE: 'Viento fuerte' },
  luz: { DE_DIA_BUENA_LUZ: 'De día, buena luz', ATARDECER_O_AMANECER: 'Atardecer o amanecer', DE_NOCHE_CON_ILUMINACION: 'De noche con iluminación', DE_NOCHE_SIN_ILUMINACION: 'De noche sin iluminación', SOL_DE_FRENTE: 'Sol de frente' },
  circula: { SI_SIN_PROBLEMAS: 'Sí, sin problemas', SI_PERO_CON_RIESGO: 'Sí, pero con riesgo', NO_QUEDO_INMOVILIZADO: 'No, quedó inmovilizado' },
  policia: { SI: 'Sí', NO: 'No', LA_LLAMAMOS_Y_TODAVIA_NO_LLEGO: 'La llamamos y todavía no llegó' },
  otras_intervenciones: { AMBULANCIA: 'Ambulancia', BOMBEROS: 'Bomberos', GRUA: 'Grúa', TRANSITO_MUNICIPAL: 'Tránsito municipal', NADIE_MAS: 'Nadie más' },
  quien_llamo: { YO: 'Yo', EL_OTRO_CONDUCTOR: 'El otro conductor', UN_TESTIGO: 'Un testigo', ALGUIEN_QUE_PASABA: 'Alguien que pasaba', NADIE_LLAMO: 'Nadie llamó', NO_SE: 'No sé' },
  quien_conducia: { YO_EL_TITULAR_DE_LA_POLIZA: 'Yo, el titular de la póliza', OTRA_PERSONA: 'Otra persona' },
  licencia_vigente: { SI_VIGENTE: 'Sí, vigente', NO_ESTABA_VENCIDA: 'No, estaba vencida', NO_TENGO_LICENCIA: 'No tengo licencia', NO_ESTOY_SEGURO: 'No estoy seguro' },
  vtv: { SI: 'Sí', NO: 'No', NO_ESTOY_SEGURO: 'No estoy seguro', NO_CORRESPONDE: 'No corresponde' },
  alcoholemia: { SI_DIO_NEGATIVO: 'Sí, dio negativo', SI_DIO_POSITIVO: 'Sí, dio positivo', SE_OFRECIO_Y_NO_SE_REALIZO: 'Se ofreció y no se realizó', NO_INTERVINO_LA_AUTORIDAD: 'No intervino la autoridad' },
  uso_vehiculo: { USO_PARTICULAR: 'Uso particular', IR_O_VOLVER_DEL_TRABAJO: 'Ir o volver del trabajo', TRABAJO_CON_EL_VEHICULO_REPARTO_APLICACION_TAXI: 'Trabajo con el vehículo (reparto, aplicación, taxi)', VIAJE_DE_PLACER_O_TURISMO: 'Viaje de placer o turismo' },
}

const IDS_CONGELADOS = [
  'heridos', 'heridos_gravedad', 'heridos_cantidad', 'riesgo', 'momento_declarado', 'tipo_siniestro',
  'cantidad_vehiculos', 'tercero_actitud', 'tercero_patente', 'tercero_datos', 'tercero_aseguradora', 'tercero_poliza',
  'relato', 'relato_texto', 'calle', 'sentido', 'maniobra', 'velocidad', 'freno',
  'zona_propia', 'zona_tercero', 'semaforo', 'senalizacion', 'pavimento', 'clima',
  'luz', 'circula', 'policia', 'policia_acta', 'policia_dependencia', 'otras_intervenciones',
  'quien_llamo', 'quien_conducia', 'conductor_datos', 'acompanantes', 'licencia_vigente', 'vtv',
  'alcoholemia', 'uso_vehiculo', 'relato_ampliado',
]

const GUIAS_CONGELADAS = [
  'posicion_final', 'patente_tercero', 'dano_tercero', 'pano_atras', 'pano_frente',
  'dano_propio', 'patente_propia', 'pavimento', 'cedula_tercero', 'licencia_tercero',
  'senalizacion', 'libre',
]

/*
 * Cupo de estilos en línea, con mínimo y máximo.
 *
 * El máximo sólo puede bajar: cada estilo que se mueve a una clase es una decisión de
 * aspecto que sale de un archivo de lógica. Un archivo que no figura acá tiene cupo cero,
 * así que todo lo que se cree nace limpio.
 *
 * El mínimo existe porque hay estilos en línea que NO se pueden mover: los que transportan
 * un valor calculado en tiempo de ejecución. Esos van como propiedad personalizada
 * —style={{ '--avance': `${porcentaje}%` }}— y el aspecto sigue viviendo en la hoja. Sin
 * el mínimo, el trinquete empuja a cero y la forma obvia de cumplir es borrar el valor,
 * que deja la barra de progreso clavada en 0% para siempre y sin ningún error.
 */
const CUPO_INLINE = {
  'app/panel/[id]/page.tsx': [0, 35],
  'app/verificar/page.tsx': [0, 15],
  'app/panel/page.tsx': [0, 8],
  'app/s/[id]/pantallas/PantallaRevision.tsx': [0, 8],
  'app/s/[id]/pantallas/PantallaCorte.tsx': [0, 5],
  'app/components/InstalarApp.tsx': [0, 4],
  'app/t/[id]/page.tsx': [0, 3],
  'app/page.tsx': [0, 3],
  'app/s/[id]/pantallas/GrabadorAudio.tsx': [0, 3],
  'app/s/[id]/pantallas/ChipUbicacion.tsx': [0, 3],
  'app/s/[id]/pantallas/PantallaTestigos.tsx': [0, 2],
  'app/s/[id]/pantallas/PantallaPregunta.tsx': [0, 2],
  'app/s/[id]/pantallas/PantallaFinal.tsx': [0, 2],
  'app/s/[id]/pantallas/PantallaEmergencia.tsx': [0, 2],
  'app/s/[id]/pantallas/PantallaFoto.tsx': [0, 1],
  'app/components/Marca.tsx': [0, 1],
  // El único que tiene mínimo: transporta el avance del progreso, que es un dato.
  'app/s/[id]/Flujo.tsx': [1, 1],
}

/*
 * Selectores de elemento desnudo admitidos, con el motivo.
 *
 * La regla general es que un selector cuelgue de una clase: si cuelga de un tipo de
 * elemento, reordenar el marcado lo desconecta sin que nada falle. Estos cuatro se
 * admiten porque el elemento es parte inseparable del componente o viene inyectado.
 */
/*
 * Rutas que no llaman a errorApi, con el motivo.
 *
 * La regla es que todo route handler traduzca sus errores, para que un problema de
 * configuración no se vea igual que un bug. Ésta es la excepción legítima.
 */
const RUTAS_SIN_ERROR_API = {
  'app/api/salud/route.ts':
    'es el endpoint de diagnóstico: estadoBase() ya atrapa todo y devuelve el detalle accionable con su propio 503. Envolverlo en errorApi cambiaría ese mensaje por uno genérico, que es justo lo contrario de para qué existe.',
}

const ELEMENTOS_ADMITIDOS = {
  '.qr-imagen svg': 'el SVG lo inyecta la biblioteca de códigos QR, no lo escribe nadie acá',
  '.boton-gigante span': 'el subtítulo del botón de inicio',
  '.boton-llamada span': 'la aclaración debajo del número de emergencia',
  '.enlaces-pie a': 'los enlaces del pie',
  '.emergencia p': 'el párrafo de la pantalla de emergencia',
}

/* ---------- 1. Los valores de las respuestas son datos, no copy ---------- */
console.log('\n[1] Valores del cuestionario')

const idsActuales = SECCIONES.flatMap((s) => s.preguntas.map((p) => p.id))
verificar(
  'ninguna pregunta cambió de id',
  IDS_CONGELADOS.length === idsActuales.length && IDS_CONGELADOS.every((id, i) => id === idsActuales[i]),
  'los ids de pregunta los usan el motor de consistencia, el PDF y la validación del PATCH, y están escritos dentro de expedientes ya sellados. Se pueden reordenar; no se pueden renombrar.',
)

verificar(
  'ninguna toma fotográfica cambió de id',
  GUIAS_CONGELADAS.length === GUIA_FOTOS.length && GUIAS_CONGELADAS.every((id, i) => id === GUIA_FOTOS[i].id),
  'el id de la guía queda guardado en cada fotografía incorporada: renombrarlo desvincula la foto de su consigna en los expedientes anteriores.',
)

{
  const problemas = []
  for (const [pregunta, congelados] of Object.entries(VALORES_CONGELADOS)) {
    const vigentes = VALOR[pregunta]
    if (!vigentes) {
      problemas.push(`desapareció la pregunta ${pregunta}`)
      continue
    }
    for (const [clave, texto] of Object.entries(congelados)) {
      if (vigentes[clave] !== texto) {
        problemas.push(`${pregunta}.${clave}: era ${JSON.stringify(texto)}, ahora ${JSON.stringify(vigentes[clave])}`)
      }
    }
  }
  verificar(
    'ninguna opción cambió de texto',
    problemas.length === 0,
    problemas.join('\n         ') +
      '\n         El texto de una opción NO es copy: es el valor que se guarda en casos.respuestas, ya escrito dentro de expedientes sellados, y el que el motor de consistencia compara por igualdad literal. Cambiarlo deja huérfanos los expedientes anteriores y apaga la contradicción que ese valor detectaba.',
  )
}

{
  const textosConLogica = Object.values(VALOR).flatMap((m) => Object.values(m))
  const infractores = []
  for (const ruta of [...pantallas, ...archivos('app/components', (n) => n.endsWith('.tsx'))]) {
    const cuerpo = leer(ruta)
    for (const t of textosConLogica) {
      if (cuerpo.includes(`'${t}'`) || cuerpo.includes(`"${t}"`)) infractores.push(`${normalizar(ruta)}: ${t}`)
    }
  }
  verificar(
    'ninguna pantalla compara contra el texto de una respuesta',
    infractores.length === 0,
    infractores.join('\n         ') +
      '\n         Una pantalla recibe valores ya resueltos, nunca una comparación contra el texto de una respuesta. Si no, mejorar una redacción cambia lo que la pantalla hace.',
  )
}

/* ---------- 2. El estilo vive en la hoja de estilos ---------- */
console.log('\n[2] Estilo fuera de los archivos de lógica')

{
  const fuera = []
  for (const ruta of todosTsx) {
    const clave = normalizar(ruta)
    const n = (leer(ruta).match(/style=\{\{/g) || []).length
    const cupo = CUPO_INLINE[clave] ?? [0, 0]
    if (n > cupo[1]) fuera.push(`${clave}: ${n} estilos en línea, el cupo es ${cupo[1]}. Movelos a una clase.`)
    if (n < cupo[0]) {
      fuera.push(
        `${clave}: ${n} estilos en línea, el mínimo es ${cupo[0]}. Alguno de los que sacaste transportaba un valor calculado y tiene que volver, como propiedad personalizada.`,
      )
    }
  }
  verificar('los estilos en línea respetan su cupo', fuera.length === 0, fuera.join('\n         '))
}

{
  const sinTokens = cssSinComentarios
    .replace(/:root\s*\{[\s\S]*?\n\}/g, '')
    .replace(/@media \(prefers-color-scheme: dark\)[\s\S]*?\n\}\n/g, '')
  const literales = sinTokens.match(/#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d[^)]*\)/g) || []
  verificar(
    'ningún color literal fuera de los tokens',
    literales.length === 0,
    literales.join(', ') +
      '\n         Un color nuevo se declara como token en :root, con su valor de modo oscuro, y se usa con var(). Si no, la aplicación deja de ser coherente en modo oscuro sin que nadie lo note.',
  )
}

/* ---------- 3. Reglas que dependen de que sea un teléfono ---------- */
console.log('\n[3] Reglas que dependen de que sea un teléfono')

{
  const sinEnvoltorio = []
  const lineas = cssSinComentarios.split('\n')
  let profundidad = 0
  let envoltorio = -1
  for (let i = 0; i < lineas.length; i++) {
    const l = lineas[i]
    if (/^@media \(hover: hover\)/.test(l)) envoltorio = profundidad
    if (l.includes(':hover') && envoltorio < 0) sinEnvoltorio.push(`línea ${i + 1}: ${l.trim()}`)
    profundidad += (l.match(/\{/g) || []).length - (l.match(/\}/g) || []).length
    if (envoltorio >= 0 && profundidad <= envoltorio) envoltorio = -1
  }
  verificar(
    'ninguna regla :hover fuera de @media (hover: hover)',
    sinEnvoltorio.length === 0,
    sinEnvoltorio.join('\n         ') +
      '\n         En una pantalla táctil el :hover queda pegado en lo último que se tocó y se confunde con la selección. Ver el comentario en app/globals.css.',
  )
}

{
  const TOPE_MS = 180
  const largas = []
  for (const m of cssSinComentarios.matchAll(/\.(opcion|zona|marca-opcion|faltante)[^{]*\{([^}]*)\}/g)) {
    for (const t of m[2].matchAll(/transition[^:]*:[^;]*?([\d.]+)(ms|s)/g)) {
      const ms = t[2] === 's' ? Number(t[1]) * 1000 : Number(t[1])
      if (ms > TOPE_MS) largas.push(`.${m[1]}: ${t[0].trim()}`)
    }
  }
  verificar(
    `ninguna transición de opción supera ${TOPE_MS} ms`,
    largas.length === 0,
    largas.join('\n         ') +
      '\n         El auto-avance está fijado en 260 ms en responderYAvanzar, para que quede una confirmación de qué se eligió. Una transición más larga la borra. Si un diseño necesita más tiempo hay que mover ese número, y eso es una edición de lógica: se pide, no se hace.',
  )
}

verificar(
  'el recorrido no fija una altura, sólo una altura mínima',
  !/\.(envoltura-flujo|pantalla)\s*\{[^}]*[^-\w]height:/.test(cssSinComentarios),
  'con height fijo, el contenido más alto que la pantalla desborda hacia arriba y el encabezado queda fuera del alcance del scroll. Pasa en la revisión, en los testigos y con el teclado abierto, y no se ve nunca en un monitor.',
)

{
  const desnudos = []
  for (const m of cssSinComentarios.matchAll(/^(\.[a-z-]+(?: > )? (?:span|div|svg|p|a|button|input|label))\s*\{/gm)) {
    if (!ELEMENTOS_ADMITIDOS[m[1]]) desnudos.push(m[1])
  }
  verificar(
    'ningún selector cuelga de un tipo de elemento sin motivo',
    desnudos.length === 0,
    desnudos.join(', ') +
      '\n         Un selector que cuelga de un tipo de elemento se desconecta al reordenar el marcado, sin que nada falle. Poné una clase, o agregalo a ELEMENTOS_ADMITIDOS con el motivo.',
  )
}

/* ---------- 4. Marcado del que depende la funcionalidad ---------- */
console.log('\n[4] Marcado del que depende la funcionalidad')

{
  const malos = []
  for (const ruta of todosTsx) {
    const cuerpo = leer(ruta)
    for (const m of cuerpo.matchAll(/<input[^>]*type="file"[^>]*>/g)) {
      if (!m[0].includes('capture=')) malos.push(`${normalizar(ruta)}: entrada de archivo sin capture`)
    }
    if (/<input[^>]*type="file"/.test(cuerpo) && !/<label/.test(cuerpo)) {
      malos.push(`${normalizar(ruta)}: la entrada de archivo no está dentro de un <label>`)
    }
  }
  verificar(
    'la cámara sigue siendo cámara y no galería',
    malos.length === 0,
    malos.join('\n         ') +
      '\n         El disparador es un <label> que envuelve el <input type="file" capture>. Un <button> no abre el selector de archivos, y sin capture se abre la galería: la evidencia deja de ser una toma del lugar.',
  )
}

{
  const conRespuestas = pantallas.filter((r) => /\brespuestas\b\s*[,:}]/.test(leer(r))).map(normalizar)
  verificar(
    'ninguna pantalla del recorrido recibe el objeto de respuestas',
    conRespuestas.length === 0,
    conRespuestas.join('\n         ') +
      '\n         Una pantalla recibe valores ya resueltos. La variante de la pantalla de emergencia la calcula lib/recorrido.ts justamente por esto.',
  )
}

{
  const sinPareja = pantallas
    .filter((r) => {
      const c = leer(r)
      return c.includes('barra-accion') && !c.includes('pantalla-cuerpo')
    })
    .map(normalizar)
  verificar(
    'cada pantalla mantiene su cuerpo y su barra de acción',
    sinPareja.length === 0,
    sinPareja.join('\n         ') +
      '\n         Una pantalla devuelve dos hermanos, .pantalla-cuerpo y .barra-accion, hijos directos de .pantalla. Envolverlos rompe el anclaje al pie —flex y margin-top:auto son relación padre-hijo— y el botón principal deja de estar al alcance del pulgar en TODO el recorrido, sin que se note en un monitor.',
  )
}

/* ---------- 5. Lo que el expediente no perdona ---------- */
console.log('\n[5] Lo que el expediente no perdona')

{
  /* La misma normalización que hace lib/pdf.ts antes de dibujar. */
  const comoEnElPdf = (t) =>
    (t ?? '')
      .replace(/[‘’‛]/g, "'")
      .replace(/[“”]/g, '"')
      .replace(/[–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/\u00a0/g, ' ')
      .replace(/[^\u0020-\u00ff]/g, '')

  const perdidos = []
  const revisar = (donde, texto) => {
    if (typeof texto !== 'string') return
    if (comoEnElPdf(texto) !== texto) perdidos.push(`${donde}: ${JSON.stringify(texto)}`)
  }
  for (const s of SECCIONES) {
    revisar(`sección ${s.id} · título`, s.titulo)
    revisar(`sección ${s.id} · descripción`, s.descripcion)
    for (const p of s.preguntas) {
      revisar(`${p.id} · texto`, p.texto)
      revisar(`${p.id} · ayuda`, p.ayuda)
      revisar(`${p.id} · omitir`, p.omitir)
      for (const o of p.opciones ?? []) revisar(`${p.id} · opción`, o)
    }
  }
  for (const g of GUIA_FOTOS) {
    revisar(`guía ${g.id} · título`, g.titulo)
    revisar(`guía ${g.id} · instrucción`, g.instruccion)
  }
  verificar(
    'ningún texto del cuestionario desaparece del expediente en PDF',
    perdidos.length === 0,
    perdidos.join('\n         ') +
      '\n         Las fuentes estándar de PDF usan WinAnsi: una viñeta, una flecha o un tilde tipográfico se borran sin aviso al generar el expediente. En pantalla se ve perfecto; en el documento que va al liquidador, no está.',
  )
}

{
  const incompletas = []
  for (const ruta of archivos('app/api', (n) => n === 'route.ts')) {
    const c = leer(ruta)
    if (!c.includes("export const runtime = 'nodejs'")) incompletas.push(`${normalizar(ruta)}: falta runtime`)
    if (!c.includes("export const dynamic = 'force-dynamic'")) incompletas.push(`${normalizar(ruta)}: falta dynamic`)
    if (!c.includes('errorApi(') && !RUTAS_SIN_ERROR_API[normalizar(ruta)]) {
      incompletas.push(`${normalizar(ruta)}: no usa errorApi`)
    }
  }
  verificar(
    'todas las rutas declaran su entorno y traducen sus errores',
    incompletas.length === 0,
    incompletas.join('\n         ') +
      '\n         Sin runtime la ruta queda a merced del valor por omisión, sin dynamic un listado por sesión puede quedar cacheado, y sin errorApi un problema de configuración se ve igual que un bug.',
  )
}

{
  const exportados = new Map()
  const repetidos = []
  for (const ruta of archivos('lib', (n) => n.endsWith('.ts'))) {
    for (const m of leer(ruta).matchAll(/^export (?:async function|function|const|class|interface|type) (\w+)/gm)) {
      const previo = exportados.get(m[1])
      if (previo && previo !== ruta) repetidos.push(`${m[1]}: en ${normalizar(previo)} y en ${normalizar(ruta)}`)
      else exportados.set(m[1], ruta)
    }
  }
  verificar(
    'ningún nombre se exporta desde dos módulos de lib/',
    repetidos.length === 0,
    repetidos.join('\n         ') +
      '\n         Dos tipos con el mismo nombre y distinta forma compilan sin quejarse: el primer import equivocado hace algo distinto de lo que dice.',
  )
}

/* ---------- 6. La documentación sigue el paso ---------- */
console.log('\n[6] La documentación sigue el paso')

{
  const mapa = leer('docs/MAPA-PANTALLAS.md')
  const sinDocumentar = pantallas
    .map((r) => normalizar(r).split('/').pop().replace('.tsx', ''))
    .filter((n) => !mapa.includes(n))
  verificar(
    'toda pantalla del recorrido figura en el mapa',
    sinDocumentar.length === 0,
    sinDocumentar.join(', ') +
      '\n         Un mapa desactualizado es peor que ninguno: manda al archivo equivocado. Si creaste una pantalla, agregala a docs/MAPA-PANTALLAS.md.',
  )
}

/* ---------- Resultado ---------- */
console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones pasaron`)
if (fallos > 0) {
  console.error(`\n${fallos} FALLARON. El contrato está en docs/CONTRATO-UI.md.`)
  process.exit(1)
}
console.log('El contrato se cumple.')
