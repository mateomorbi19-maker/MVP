# F2 — Detección — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el detector distinga un choque de un pozo, de una sacudida y de una frenada: umbrales validados, un único veredicto (`evaluarEpisodio`) que corre igual en el teléfono y en el servidor, todo el procesamiento de señales puro en `lib/conduccion.ts` y un banco de simulación con semilla fija que afirma las tasas de §6.1.

**Architecture:** `lib/impacto.ts` suma los quince umbrales con su validación y reemplaza el veredicto por `evaluarEpisodio` (filas 1–10 de §2.5), dejando `analizarImpacto` como adaptador del detector anterior. `lib/conduccion.ts` (nuevo, sólo importa `./impacto`) estima velocidades con los relojes de §2.1, deriva la fuente de aceleración, arma episodios, sigue el golpe en marcha y detecta maniobras detrás de `crearDetector`. `scripts/banco-impacto.mjs` porta el banco del anexo y pasa cada ensayo por ese mismo detector. El servidor evalúa cada episodio con `evaluarEpisodio` y reconstruye el veredicto del teléfono con `reconstruirVeredicto`; el contrato verifica las importaciones de los tres módulos compartidos.

**Tech Stack:** TypeScript 7 (`tsc --noEmit`), Node ≥ 22 con `tsx` para las pruebas, Next.js 16.3 (sólo `app/api/salud/route.ts`), sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md` (§2 y §6.1; anexo `docs/superpowers/specs/2026-09-16-modo-viaje-banco/`) · índice: `docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md`

## Global Constraints

- Formato del código: sin punto y coma, comillas simples, indentación de 2 espacios.
- Español en todo: identificadores, comentarios, nombres de archivo, columnas (snake_case), clases CSS y copy; voseo; acentos y ñ sólo en textos, nunca en identificadores nuevos (la propiedad existente `señales` de `Veredicto` se conserva tal cual).
- Los comentarios explican por qué; los mensajes de error dicen qué hay que arreglar, nunca «algo salió mal».
- No usar Server Actions: no existe ni un `'use server'` en `app/` ni en `lib/`; toda mutación va por `fetch` a un route handler de `app/api/`.
- No crear una carpeta de migraciones: el esquema es el template string `SCHEMA` de `lib/db.ts`, aplicado de forma idempotente; los cambios se agregan ahí.
- No agregar dependencias: `dependencies` y `devDependencies` de `package.json` no cambian (sólo cambian `scripts`).
- Todo route handler exporta `export const runtime = 'nodejs'` y `export const dynamic = 'force-dynamic'`, y termina su `catch` en `errorApi(contexto, err, mensajeGenerico)`.
- Todo cambio de estado sobre un caso registra su evento con `registrarEvento`; ningún endpoint del modo viaje registra eslabones salvo el alta de la actuación (§5.3).
- Nunca se registra un evento de cadena sobre un expediente sellado: lo posterior al sellado va a una tabla propia (`bitacora` con `anotarEnBitacora`, o las tablas de telemetría).
- No se renombra ningún id de pregunta ni de toma fotográfica (`lib/cuestionario.ts`) y no se cambia el texto de ninguna opción (`VALOR`).
- Ningún nombre se exporta desde dos módulos de `lib/` (`scripts/prueba-contrato.mjs:515-531`): ver «Interfaces › Nombres ocupados».
- Ningún literal entre comillas igual al texto de una opción de `VALOR` dentro de `app/components/*.tsx` ni de `app/s/[id]/pantallas/*.tsx` (`'1'`, `"2"`, `'3'`, `'Sí'`, `'No'`, `'Yo'`, `'Verde'`…): los números de un SVG van como expresión JSX (`r={2}`, nunca `r="2"`).
- Toda clase que usa el marcado existe en `app/globals.css`; un archivo nuevo tiene cupo 0 de `style={{`; un selector cuelga de una clase, no de un tipo de elemento.
- Colores sólo como tokens en `:root` con su valor en el bloque `@media (prefers-color-scheme: dark)`; nunca un color literal fuera de ahí.
- Toda regla `:hover` va dentro de `@media (hover: hover)`.
- Toda animación nueva se neutraliza en el bloque `@media (prefers-reduced-motion: reduce)` del final de `app/globals.css` (hoy líneas 2900–2916).
- `llamar_emergencias` sigue siendo el literal `false`: la aplicación no llama ni le avisa a nadie por su cuenta.
- Ninguna pantalla registra listeners de sensores: todo pasa por el motor (`lib/viaje.ts`).
- Toda respuesta HTTP que contiene una ubicación lleva `Cache-Control: no-store`.
- Desde F1, toda ruta que este plan crea o modifica y que lee un cuerpo lo lee con `leerCuerpoLimitado(req, maxBytes)`; las demás rutas siguen con `req.json()` hasta un plan propio. El cliente manda siempre un string como cuerpo.
- Antes de cada commit de cada tarea: `npm run contrato && npm run tipos && npm run prueba`, las tres en verde.
- Identidad de commit (este entorno no tiene identidad de git configurada): `git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit ...`.
- Mensaje de commit en español con el estilo del repositorio: título en infinitivo que dice qué se hace y por qué importa (por ejemplo «Cerrar el SSRF de la prueba de notificaciones»), cuerpo que explica el motivo, y como última línea `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.
- Los commits van a la rama actual `modo-viaje-global`; ninguna fase hace push ni abre PR.
- Nunca se busca recursivamente dentro de `node_modules` (vive en OneDrive y se cuelga); la documentación de Next está en `node_modules/next/dist/docs/` y se lee antes de usar una API de Next (`after`, route handlers).
- La ruta del repositorio tiene espacios (`C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora`): todo comando la lleva entre comillas.

Plantilla de commit (Git Bash):

```bash
git add "lib/limite.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Limitar las lecturas por teléfono para que un cliente en bucle no tumbe la base

El limitador vive en memoria y se reinicia con cada despliegue: es una primera
barrera y protege contra un cliente propio en bucle, no contra un atacante decidido.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Antes de empezar

**Precondiciones**

1. F1 terminada: `git log --oneline` muestra sus doce commits sobre los de F0 en `modo-viaje-global`. En Git Bash, desde la raíz:

```bash
git branch --show-current
git status --short
grep -c "export function recortarEpisodio" lib/impacto.ts
grep -c "function veredictoBasico" lib/transporte-viaje.ts
grep -c "const veredicto = analizarImpacto(episodio.episodio.serie)" lib/telemetria.ts
grep -c "Resultado ----------" scripts/prueba-viaje.mjs
test -e lib/conduccion.ts; echo $?
```

Esperado: `modo-viaje-global`; ninguna línea de estado salvo `?? docs/superpowers/plans/`; `1` en los cuatro `grep -c`; `1` en la última línea (`lib/conduccion.ts` no existe todavía).

2. Las tres verificaciones en verde: `npm run contrato && npm run tipos && npm run prueba` imprime `El contrato se cumple.`, `tsc` no imprime nada y las dos pruebas terminan en `Todo en orden.`.

**Leer antes de escribir código**

- `AGENTS.md`.
- El índice: «Global Constraints», «F2 — Detección», «Interfaces» (`lib/impacto.ts` entero, `lib/conduccion.ts`, `reconstruirVeredicto` en `lib/transporte-viaje.ts`, `lib/telemetria.ts`), «Nombres ocupados», «Importaciones permitidas», `GET /api/salud`, «Pruebas: convenciones» (arnés de `scripts/prueba-viaje.mjs`, [V2]–[V4], banco) y los riesgos 16, 18 y 39.
- El diseño: §2 entera y §6.1. El anexo del banco (`base.mts`, `escenas.mts`, `propuesta.mts`): este plan lo porta; donde §2 y `propuesta.mts` no coinciden, manda §2 salvo lo que dice «Desvíos».
- Los archivos que esta fase toca: `lib/impacto.ts`, `lib/transporte-viaje.ts`, `lib/telemetria.ts`, `app/api/salud/route.ts`, `.env.example`, `README.md`, `scripts/prueba-logica.mjs`, `scripts/prueba-viaje.mjs`, `scripts/prueba-contrato.mjs` (sección `[5]`, helpers `leer` y `verificar`). Y los que consumen lo que cambia, para no romperlos: `app/components/DetectorImpacto.tsx` (usa `Veredicto.picoG`) y `app/api/casos/[id]/sensores/route.ts` (usa `analizarImpacto`).

**Cómo se corre cada cosa en esta fase**

- Una sección: `SECCION=V2 npx tsx scripts/prueba-viaje.mjs` desde la raíz (PowerShell: `$env:SECCION='V2'; npx tsx scripts/prueba-viaje.mjs`). Con `SECCION` los totales son los de esa sección sola; los de cada paso de este plan son exactos.
- El banco completo: `BANCO_COMPLETO=1 SECCION=V4 npx tsx scripts/prueba-viaje.mjs` (medido en esta máquina: 53 s). Sin la variable, `[V4]` corre 10 ensayos por escena (13 s) e imprime el aviso de «Pruebas: convenciones».
- Las tres verificaciones: `npm run contrato && npm run tipos && npm run prueba`. En `prueba-logica.mjs` se mira que no haya ninguna línea `  FALLA` y que termine en `Todo en orden.`; en `prueba-viaje.mjs`, lo mismo.
- Cada commit agrega sólo los archivos que nombra su paso, con la plantilla de «Global Constraints».
- Las líneas se ubican por contenido: F0 y F1 corrieron los números de línea de todos los archivos que se tocan.

---

### Task 1: Umbrales de 15 campos, `validarUmbrales`, `problemasDeUmbrales`, `/api/salud`, `.env.example` y aviso en el README

**Files:**
- Modify: `lib/impacto.ts` — la interfaz `export interface Umbrales {` y la constante `export const UMBRALES: Umbrales = {` que la sigue (hoy con `ventanaCaidaMs`); dentro de `analizarImpacto`, la línea con `umbrales.ventanaCaidaMs`.
- Modify: `app/api/salud/route.ts` — los imports y el cuerpo de `GET`.
- Modify: `.env.example` — el bloque que empieza en `# Umbrales del detector de impacto. SON DE REFERENCIA` y termina en `IMPACTO_GIRO_DPS=180`.
- Modify: `README.md` — sección «Deploy en Easypanel», después de la tabla de variables.
- Test: `scripts/prueba-viaje.mjs`, sección nueva `[V2] Umbrales y veredicto`.

**Interfaces:**
- Consumes: nada nuevo (el arnés `verificar`/`seccion` de F1).
- Produces (índice, «Interfaces › `lib/impacto.ts`», bloque F2, y su tabla de rangos):
  - `export interface Umbrales` con los 15 campos (`sospechaG`, `confirmadoG`, `msSobreUmbral`, `velocidadPreviaKmh`, `velocidadPreviaCaidaKmh`, `velocidadPosteriorKmh`, `ventanaPostMs`, `topeEpisodioMs`, `giroDps`, `giroManipulacionDps`, `desaceleracionImposibleG`, `frenadaG`, `aceleracionG`, `retrasoMinMs`, `retrasoMaxMs`); desaparece `ventanaCaidaMs`.
  - `export const UMBRALES: Umbrales` calculado al importar desde `IMPACTO_*` y `CONDUCCION_*`.
  - `export interface ProblemaUmbral { campo: keyof Umbrales; recibido: unknown; usado: number; motivo: string }`
  - `export function validarUmbrales(entrada: unknown): { umbrales: Umbrales; problemas: ProblemaUmbral[] }`
  - `export function problemasDeUmbrales(): ProblemaUmbral[]`
  - `GET /api/salud` suma `modo_viaje: { ok, detalle, problemas }` sin cambiar el `ok` general ni el estado HTTP.
  - Los usan: la Tarea 2 (`Veredicto.umbrales`), F1 (`configuracionModoViaje().umbrales` ya lee `UMBRALES`), la Tarea 9 (`reconstruirVeredicto`) y F3 (`validarUmbrales(c.umbrales)` sobre la configuración remota).

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, agregá esta sección inmediatamente antes de `/* ---------- Resultado ---------- */` (después del cierre de `[V1]`, con una línea vacía antes):

```js
await seccion('V2', 'Umbrales y veredicto', async () => {
  const { isDeepStrictEqual } = await import('node:util')
  /* ---- Umbrales: omisiones, rangos, relaciones y entorno ---- */
  {
    const { UMBRALES, validarUmbrales, problemasDeUmbrales } = await import('../lib/impacto.ts')
    const OMISIONES = { sospechaG: 4, confirmadoG: 8, msSobreUmbral: 30, velocidadPreviaKmh: 15, velocidadPreviaCaidaKmh: 30, velocidadPosteriorKmh: 8, ventanaPostMs: 8000, topeEpisodioMs: 15000, giroDps: 180, giroManipulacionDps: 300, desaceleracionImposibleG: 1.4, frenadaG: 0.45, aceleracionG: 0.4, retrasoMinMs: 0, retrasoMaxMs: 3000 }

    verificar('sin variables, UMBRALES son las quince omisiones del diseño', isDeepStrictEqual({ ...UMBRALES }, OMISIONES), JSON.stringify(UMBRALES))
    verificar('sin variables no hay problemas que informar', problemasDeUmbrales().length === 0)
    for (const entrada of [undefined, null, 'x', [], {}]) {
      const r = validarUmbrales(entrada)
      verificar(`validarUmbrales(${JSON.stringify(entrada)}) da las omisiones sin problemas`, isDeepStrictEqual(r.umbrales, OMISIONES) && r.problemas.length === 0)
    }

    const conNaN = validarUmbrales({ sospechaG: NaN })
    verificar(
      'un NaN usa la omisión y dice qué arreglar',
      conNaN.umbrales.sospechaG === 4 && conNaN.problemas.length === 1 && conNaN.problemas[0].campo === 'sospechaG' && conNaN.problemas[0].usado === 4 && conNaN.problemas[0].motivo === 'sospechaG tiene que ser un número entre 2 y 20; vino NaN.',
      JSON.stringify(conNaN.problemas),
    )
    const fuera = validarUmbrales({ sospechaG: 40 })
    verificar('fuera de rango usa la omisión', fuera.umbrales.sospechaG === 4 && fuera.problemas[0]?.recibido === 40 && fuera.problemas[0]?.motivo === 'sospechaG tiene que estar entre 2 y 20; vino 40.', JSON.stringify(fuera.problemas))
    const texto = validarUmbrales({ frenadaG: '0.5' })
    verificar('un número escrito como texto no vale', texto.umbrales.frenadaG === 0.45 && texto.problemas[0]?.motivo === 'frenadaG tiene que ser un número entre 0.2 y 1; vino "0.5".', JSON.stringify(texto.problemas))
    const propios = validarUmbrales({ frenadaG: 0.5, retrasoMaxMs: 2000, velocidadPreviaKmh: 20, extra: 3 })
    verificar('los valores válidos se usan y lo desconocido se ignora', propios.problemas.length === 0 && propios.umbrales.frenadaG === 0.5 && propios.umbrales.retrasoMaxMs === 2000 && propios.umbrales.velocidadPreviaKmh === 20 && !('extra' in propios.umbrales))

    const cruzados = validarUmbrales({ sospechaG: 5, confirmadoG: 3 })
    verificar(
      'una relación rota devuelve los dos campos a su omisión con un problema cada uno',
      cruzados.umbrales.sospechaG === 4 && cruzados.umbrales.confirmadoG === 8 && cruzados.problemas.length === 2 && cruzados.problemas.every((p) => p.motivo === 'confirmadoG tiene que ser mayor o igual que sospechaG; vinieron confirmadoG = 3 y sospechaG = 5.'),
      JSON.stringify(cruzados.problemas),
    )
    const cascada = validarUmbrales({ sospechaG: 20, confirmadoG: 10, desaceleracionImposibleG: 4 })
    verificar(
      'las relaciones se repiten hasta que ninguna falle',
      cascada.umbrales.sospechaG === 4 && cascada.umbrales.confirmadoG === 8 && cascada.umbrales.desaceleracionImposibleG === 1.4 && cascada.problemas.length === 4,
      JSON.stringify(cascada),
    )
    const retrasos = validarUmbrales({ retrasoMinMs: 4000, retrasoMaxMs: 1000 })
    verificar('retrasoMaxMs menor que retrasoMinMs vuelve a 0 y 3000', retrasos.umbrales.retrasoMinMs === 0 && retrasos.umbrales.retrasoMaxMs === 3000 && retrasos.problemas.length === 2)

    // Una instancia nueva del módulo lee el entorno de nuevo (tsx carga otra copia con ?entorno=1).
    const variables = { IMPACTO_UMBRAL_SOSPECHA_G: '40', IMPACTO_VELOCIDAD_PREVIA_KMH: '', CONDUCCION_FRENADA_G: '0.5', IMPACTO_VENTANA_CAIDA_MS: '2000' }
    const antes = {}
    for (const [clave, valor] of Object.entries(variables)) {
      antes[clave] = process.env[clave]
      process.env[clave] = valor
    }
    const avisos = []
    const warnOriginal = console.warn
    console.warn = (...args) => avisos.push(args)
    let entorno
    try {
      entorno = await import('../lib/impacto.ts?entorno=1')
    } finally {
      console.warn = warnOriginal
      for (const [clave, valor] of Object.entries(antes)) {
        if (valor === undefined) delete process.env[clave]
        else process.env[clave] = valor
      }
    }
    verificar('del entorno: un valor válido se usa, uno vacío es la omisión y uno fuera de rango también', entorno.UMBRALES.frenadaG === 0.5 && entorno.UMBRALES.velocidadPreviaKmh === 15 && entorno.UMBRALES.sospechaG === 4, JSON.stringify(entorno.UMBRALES))
    verificar('problemasDeUmbrales informa el de sospechaG', entorno.problemasDeUmbrales().length === 1 && entorno.problemasDeUmbrales()[0].campo === 'sospechaG')
    verificar(
      'IMPACTO_VENTANA_CAIDA_MS cargada escribe una vez que ya no se usa',
      avisos.filter((a) => a[0] === 'IMPACTO_VENTANA_CAIDA_MS ya no se usa: la reemplaza IMPACTO_VENTANA_POST_MS (8000 ms por omisión); borrala de las variables del servicio').length === 1,
      JSON.stringify(avisos),
    )
    verificar('los umbrales fuera de rango se escriben una vez al importar', avisos.filter((a) => a[0] === '[impacto] umbrales fuera de rango: se usan los valores de omisión.').length === 1)
  }
})
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V2 npx tsx scripts/prueba-viaje.mjs`

Expected: código 1 con

```
  FALLA sin variables, UMBRALES son las quince omisiones del diseño {"sospechaG":4,"confirmadoG":8,"msSobreUmbral":30,"velocidadPreviaKmh":30,"velocidadPosteriorKmh":8,"ventanaCaidaMs":2000,"giroDps":180}
  FALLA [V2] terminó sin excepciones TypeError: problemasDeUmbrales is not a function
```

(la segunda sigue con su pila), `0/2 verificaciones pasaron` y `2 FALLARON`.

- [ ] **Step 3: Umbrales, validación y lectura del entorno**

En `lib/impacto.ts`, reemplazá:

```ts
export interface Umbrales {
  sospechaG: number
  confirmadoG: number
  msSobreUmbral: number
  velocidadPreviaKmh: number
  velocidadPosteriorKmh: number
  ventanaCaidaMs: number
  giroDps: number
}

export const UMBRALES: Umbrales = {
  sospechaG: Number(process.env.IMPACTO_UMBRAL_SOSPECHA_G || 4),
  confirmadoG: Number(process.env.IMPACTO_UMBRAL_CONFIRMADO_G || 8),
  msSobreUmbral: Number(process.env.IMPACTO_MS_SOBRE_UMBRAL || 30),
  velocidadPreviaKmh: Number(process.env.IMPACTO_VELOCIDAD_PREVIA_KMH || 30),
  velocidadPosteriorKmh: Number(process.env.IMPACTO_VELOCIDAD_POSTERIOR_KMH || 8),
  ventanaCaidaMs: Number(process.env.IMPACTO_VENTANA_CAIDA_MS || 2000),
  giroDps: Number(process.env.IMPACTO_GIRO_DPS || 180),
}
```

por:

```ts
export interface Umbrales {
  /** g. Una muestra con |a| ≥ esto abre un episodio (disparador a). */
  sospechaG: number
  /** g. Sólo decide la fila 6 (auto casi quieto); confirmado no depende de esto porque muchos Android saturan en 4 g. */
  confirmadoG: number
  /** ms. La racha contigua con |a| ≥ sospechaG/2 que contiene el pico tiene que durar esto para ser sostenida. */
  msSobreUmbral: number
  /** km/h. previa ≥ esto: iba andando. */
  velocidadPreviaKmh: number
  /** km/h. Disparador (b) y caidaSinGolpe: la caída tiene que venir de una previa ≥ esto. */
  velocidadPreviaCaidaKmh: number
  /** km/h. Lecturas ≤ esto cuentan como detención. */
  velocidadPosteriorKmh: number
  /** ms. El episodio cierra esto después de la ÚLTIMA muestra ≥ sospechaG. */
  ventanaPostMs: number
  /** ms. Tope de duración de un episodio desde su primera muestra. */
  topeEpisodioMs: number
  /** °/s. giroBrusco: se guarda como dato, no decide. */
  giroDps: number
  /** °/s. Giro sostenido ANTES del golpe que delata la mano o una caída. */
  giroManipulacionDps: number
  /** g. Media de la ventana densa de 600 ms de la horizontal que ninguna frenada alcanza. */
  desaceleracionImposibleG: number
  /** g. Frenada silenciosa. */
  frenadaG: number
  /** g. Aceleración silenciosa. */
  aceleracionG: number
  /** ms. Retraso mínimo del GPS respecto del acelerómetro. */
  retrasoMinMs: number
  /** ms. Retraso máximo del GPS respecto del acelerómetro. */
  retrasoMaxMs: number
}

/** Los valores medidos en el banco de simulación. Cumplen todas las relaciones de RELACIONES_UMBRALES. */
const OMISIONES_UMBRALES: Umbrales = {
  sospechaG: 4,
  confirmadoG: 8,
  msSobreUmbral: 30,
  velocidadPreviaKmh: 15,
  velocidadPreviaCaidaKmh: 30,
  velocidadPosteriorKmh: 8,
  ventanaPostMs: 8000,
  topeEpisodioMs: 15000,
  giroDps: 180,
  giroManipulacionDps: 300,
  desaceleracionImposibleG: 1.4,
  frenadaG: 0.45,
  aceleracionG: 0.4,
  retrasoMinMs: 0,
  retrasoMaxMs: 3000,
}

const CAMPOS_UMBRALES = Object.keys(OMISIONES_UMBRALES) as Array<keyof Umbrales>

/** Rango válido, cerrado en los dos extremos. Afuera, un valor apaga la detección o la vuelve un ruido. */
const RANGOS_UMBRALES: { [C in keyof Umbrales]: readonly [number, number] } = {
  sospechaG: [2, 20],
  confirmadoG: [2, 50],
  msSobreUmbral: [5, 500],
  velocidadPreviaKmh: [5, 60],
  velocidadPreviaCaidaKmh: [15, 150],
  velocidadPosteriorKmh: [0, 30],
  ventanaPostMs: [3000, 15000],
  topeEpisodioMs: [5000, 60000],
  giroDps: [30, 2000],
  giroManipulacionDps: [100, 2000],
  desaceleracionImposibleG: [1, 4],
  frenadaG: [0.2, 1],
  aceleracionG: [0.2, 1],
  retrasoMinMs: [0, 5000],
  retrasoMaxMs: [0, 10000],
}

const VARIABLES_UMBRALES: { [C in keyof Umbrales]: string } = {
  sospechaG: 'IMPACTO_UMBRAL_SOSPECHA_G',
  confirmadoG: 'IMPACTO_UMBRAL_CONFIRMADO_G',
  msSobreUmbral: 'IMPACTO_MS_SOBRE_UMBRAL',
  velocidadPreviaKmh: 'IMPACTO_VELOCIDAD_PREVIA_KMH',
  velocidadPreviaCaidaKmh: 'IMPACTO_VELOCIDAD_PREVIA_CAIDA_KMH',
  velocidadPosteriorKmh: 'IMPACTO_VELOCIDAD_POSTERIOR_KMH',
  ventanaPostMs: 'IMPACTO_VENTANA_POST_MS',
  topeEpisodioMs: 'IMPACTO_TOPE_EPISODIO_MS',
  giroDps: 'IMPACTO_GIRO_DPS',
  giroManipulacionDps: 'IMPACTO_GIRO_MANIPULACION_DPS',
  desaceleracionImposibleG: 'IMPACTO_DESACELERACION_IMPOSIBLE_G',
  frenadaG: 'CONDUCCION_FRENADA_G',
  aceleracionG: 'CONDUCCION_ACELERACION_G',
  retrasoMinMs: 'CONDUCCION_RETRASO_MIN_MS',
  retrasoMaxMs: 'CONDUCCION_RETRASO_MAX_MS',
}

interface RelacionUmbrales {
  a: keyof Umbrales
  b: keyof Umbrales
  cumple: (u: Umbrales) => boolean
  regla: string
}

const RELACIONES_UMBRALES: readonly RelacionUmbrales[] = [
  { a: 'confirmadoG', b: 'sospechaG', cumple: (u) => u.confirmadoG >= u.sospechaG, regla: 'confirmadoG tiene que ser mayor o igual que sospechaG' },
  { a: 'velocidadPosteriorKmh', b: 'velocidadPreviaKmh', cumple: (u) => u.velocidadPosteriorKmh < u.velocidadPreviaKmh, regla: 'velocidadPosteriorKmh tiene que ser menor que velocidadPreviaKmh' },
  { a: 'topeEpisodioMs', b: 'ventanaPostMs', cumple: (u) => u.topeEpisodioMs >= u.ventanaPostMs, regla: 'topeEpisodioMs tiene que ser mayor o igual que ventanaPostMs' },
  { a: 'desaceleracionImposibleG', b: 'sospechaG', cumple: (u) => u.desaceleracionImposibleG < u.sospechaG, regla: 'desaceleracionImposibleG tiene que ser menor que sospechaG' },
  { a: 'retrasoMaxMs', b: 'retrasoMinMs', cumple: (u) => u.retrasoMaxMs >= u.retrasoMinMs, regla: 'retrasoMaxMs tiene que ser mayor o igual que retrasoMinMs' },
]

export interface ProblemaUmbral {
  campo: keyof Umbrales
  /** Lo que vino, tal cual. */
  recibido: unknown
  /** El valor de omisión que se usa en su lugar. */
  usado: number
  /** Qué hay que arreglar, por ejemplo 'sospechaG tiene que estar entre 2 y 20; vino 40.' */
  motivo: string
}

const mostrarValor = (valor: unknown): string => (typeof valor === 'string' ? JSON.stringify(valor) : String(valor))

/**
 * Acepta cualquier cosa (el JSON de la configuración remota o lo leído del entorno). Por campo: ausente
 * (undefined) → omisión sin problema; no es un número finito o está fuera de rango → omisión con problema.
 * Después las relaciones de la tabla; si una falla, los dos campos vuelven a su omisión con un problema cada
 * uno, y se repite hasta que no falle ninguna. Nunca usa Number() sobre algo que no sea texto.
 */
export function validarUmbrales(entrada: unknown): { umbrales: Umbrales; problemas: ProblemaUmbral[] } {
  const crudo = typeof entrada === 'object' && entrada !== null && !Array.isArray(entrada) ? (entrada as Record<string, unknown>) : {}
  const umbrales: Umbrales = { ...OMISIONES_UMBRALES }
  const problemas: ProblemaUmbral[] = []

  for (const campo of CAMPOS_UMBRALES) {
    const valor = crudo[campo]
    if (valor === undefined) continue
    const [minimo, maximo] = RANGOS_UMBRALES[campo]
    // Un texto con un número tampoco vale: la configuración remota manda números, y el entorno se convierte antes.
    if (typeof valor !== 'number' || !Number.isFinite(valor)) {
      problemas.push({ campo, recibido: valor, usado: OMISIONES_UMBRALES[campo], motivo: `${campo} tiene que ser un número entre ${minimo} y ${maximo}; vino ${mostrarValor(valor)}.` })
    } else if (valor < minimo || valor > maximo) {
      problemas.push({ campo, recibido: valor, usado: OMISIONES_UMBRALES[campo], motivo: `${campo} tiene que estar entre ${minimo} y ${maximo}; vino ${valor}.` })
    } else {
      umbrales[campo] = valor
    }
  }

  // Cada vuelta devuelve a su omisión al menos un campo que no la tenía, y las omisiones cumplen todas las relaciones: termina.
  for (let rota = RELACIONES_UMBRALES.find((r) => !r.cumple(umbrales)); rota; rota = RELACIONES_UMBRALES.find((r) => !r.cumple(umbrales))) {
    const motivo = `${rota.regla}; vinieron ${rota.a} = ${umbrales[rota.a]} y ${rota.b} = ${umbrales[rota.b]}.`
    for (const campo of [rota.a, rota.b]) {
      problemas.push({ campo, recibido: umbrales[campo], usado: OMISIONES_UMBRALES[campo], motivo })
      umbrales[campo] = OMISIONES_UMBRALES[campo]
    }
  }
  return { umbrales, problemas }
}

/*
 * En el navegador no hay process (o Next lo deja vacío): todo queda ausente y coincide con las omisiones.
 * Se lee por nombre y no con process.env.X porque la lista de variables es la de VARIABLES_UMBRALES.
 */
const ENTORNO: Record<string, string | undefined> | undefined = typeof process === 'undefined' ? undefined : process.env

function umbralesDelEntorno(): { umbrales: Umbrales; problemas: ProblemaUmbral[] } {
  const leido: Partial<Record<keyof Umbrales, number>> = {}
  for (const campo of CAMPOS_UMBRALES) {
    const texto = ENTORNO?.[VARIABLES_UMBRALES[campo]]
    if (texto !== undefined && texto.trim() !== '') leido[campo] = Number(texto)
  }
  return validarUmbrales(leido)
}

const UMBRALES_DEL_ENTORNO = umbralesDelEntorno()

// No se usa como respaldo: significaba otra cosa (la ventana de la caída de velocidad) y en silencio cambiaría la detección.
if (ENTORNO?.IMPACTO_VENTANA_CAIDA_MS) {
  console.warn('IMPACTO_VENTANA_CAIDA_MS ya no se usa: la reemplaza IMPACTO_VENTANA_POST_MS (8000 ms por omisión); borrala de las variables del servicio')
}
if (UMBRALES_DEL_ENTORNO.problemas.length > 0) {
  console.warn('[impacto] umbrales fuera de rango: se usan los valores de omisión.', UMBRALES_DEL_ENTORNO.problemas)
}

/**
 * validarUmbrales(<lo leído de IMPACTO_* y CONDUCCION_*>).umbrales, calculado al importar. En el navegador
 * no hay variables: coinciden con las omisiones. Si IMPACTO_VENTANA_CAIDA_MS está cargada, al importar se
 * escribe UNA vez console.warn con el texto servidor.ventana_caida_obsoleta. Si hubo problemas, UNA vez
 * console.warn('[impacto] umbrales fuera de rango: se usan los valores de omisión.', problemas).
 */
export const UMBRALES: Umbrales = UMBRALES_DEL_ENTORNO.umbrales

/** Los problemas del entorno calculados al importar (los informa /api/salud). */
export function problemasDeUmbrales(): ProblemaUmbral[] {
  return UMBRALES_DEL_ENTORNO.problemas.map((p) => ({ ...p }))
}
```

- [ ] **Step 4: El `analizarImpacto` viejo deja de leer el campo que ya no existe**

Sigue vivo hasta la Tarea 2, que lo reemplaza por el adaptador. En `lib/impacto.ts`, reemplazá:

```ts
    const posteriores = conVelocidad.filter((l) => l.t > pico.t && l.t <= pico.t + umbrales.ventanaCaidaMs)
```

por:

```ts
    const posteriores = conVelocidad.filter((l) => l.t > pico.t && l.t <= pico.t + umbrales.ventanaPostMs)
```

- [ ] **Step 5: Correr [V2] y verla pasar**

Run: `SECCION=V2 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras

```
  ok   las relaciones se repiten hasta que ninguna falle
  ok   IMPACTO_VENTANA_CAIDA_MS cargada escribe una vez que ya no se usa
```

y `18/18 verificaciones pasaron`, `Todo en orden.`. (La importación `'../lib/impacto.ts?entorno=1'` carga una instancia nueva del módulo: así la prueba lee el entorno sin tocar la instancia que usan las demás secciones.)

- [ ] **Step 6: `/api/salud` informa los umbrales fuera de rango**

En `app/api/salud/route.ts`, reemplazá:

```ts
import { faltaParaCorreo } from '@/lib/correo'
```

por:

```ts
import { faltaParaCorreo } from '@/lib/correo'
import { problemasDeUmbrales } from '@/lib/impacto'
```

Y reemplazá:

```ts
  const falta = faltaParaCorreo()
  return NextResponse.json(
    {
      ok: base.ok,
      base,
      correo: { ok: falta === null, detalle: falta ?? 'Servidor de correo configurado.' },
```

por:

```ts
  const falta = faltaParaCorreo()
  /*
   * Los umbrales fuera de rango tampoco cambian el ok: la detección sigue con los valores de omisión. Pero quien
   * cargó mal una variable tiene que enterarse acá, y no el día de un choque que no alertó.
   */
  const problemas = problemasDeUmbrales()
  return NextResponse.json(
    {
      ok: base.ok,
      base,
      correo: { ok: falta === null, detalle: falta ?? 'Servidor de correo configurado.' },
      modo_viaje: {
        ok: problemas.length === 0,
        detalle:
          problemas.length === 0
            ? 'Umbrales del detector dentro de rango.'
            : `Hay ${problemas.length} ${problemas.length === 1 ? 'umbral' : 'umbrales'} fuera de rango: se usan los valores de omisión. Revisá las variables IMPACTO_* y CONDUCCION_*.`,
        problemas,
      },
```

- [ ] **Step 7: `.env.example` con el motivo de cada número**

En `.env.example`, reemplazá:

```bash
# Umbrales del detector de impacto. SON DE REFERENCIA: hay que calibrarlos con pruebas de
# campo —frenadas bruscas, pozos, el teléfono en el bolsillo contra el teléfono en el
# soporte— antes de encender cualquier escalamiento en producción.
IMPACTO_UMBRAL_SOSPECHA_G=4
IMPACTO_UMBRAL_CONFIRMADO_G=8
IMPACTO_MS_SOBRE_UMBRAL=30
IMPACTO_VELOCIDAD_PREVIA_KMH=30
IMPACTO_VELOCIDAD_POSTERIOR_KMH=8
IMPACTO_VENTANA_CAIDA_MS=2000
IMPACTO_GIRO_DPS=180
```

por:

```bash
# Umbrales del detector de impacto (lib/impacto.ts). SON DE REFERENCIA: se midieron con el banco de
# simulación (scripts/banco-impacto.mjs) y se calibran con datos de campo. Un valor fuera de rango no
# impide arrancar: se usa el de omisión, se escribe una vez en el log y lo informa /api/salud.
#
# g. Es un disparador, no un veredicto: por debajo, un pozo con soporte resonante abre episodios todo el tiempo. De 2 a 20.
IMPACTO_UMBRAL_SOSPECHA_G=4
# g. Sólo decide con el auto casi quieto; muchos Android saturan en 4 g. De 2 a 50, y no menor que el de sospecha.
IMPACTO_UMBRAL_CONFIRMADO_G=8
# ms. Un pozo da un pico de una o dos muestras; un choque sostiene la sacudida decenas de ms. De 5 a 500.
IMPACTO_MS_SOBRE_UMBRAL=30
# km/h. Con 30 se perdían los choques urbanos saliendo de un semáforo. De 5 a 60.
IMPACTO_VELOCIDAD_PREVIA_KMH=15
# km/h. Detenerse sin golpe desde menos no es imposible para una frenada. De 15 a 150.
IMPACTO_VELOCIDAD_PREVIA_CAIDA_KMH=30
# km/h. El GPS parado oscila ±3–5 km/h. De 0 a 30, y menor que la velocidad previa.
IMPACTO_VELOCIDAD_POSTERIOR_KMH=8
# ms. El GPS llega 1–3 s atrasado y hay que ver la detención. De 3000 a 15000.
# Reemplaza a IMPACTO_VENTANA_CAIDA_MS, que ya no se usa: si quedó cargada, el log lo avisa.
IMPACTO_VENTANA_POST_MS=8000
# ms. Un vuelco entra; más largo, un camino de ripio sería un solo episodio. De 5000 a 60000, y no menor que la ventana posterior.
IMPACTO_TOPE_EPISODIO_MS=15000
# °/s. Dato para calibrar, no decide. De 30 a 2000.
IMPACTO_GIRO_DPS=180
# °/s. La mano gira el teléfono antes del golpe; en un choque gira después. De 100 a 2000.
IMPACTO_GIRO_MANIPULACION_DPS=300
# g. Una frenada con ABS llega a 1.1 g. De 1.0 a 4.0, y menor que el umbral de sospecha.
IMPACTO_DESACELERACION_IMPOSIBLE_G=1.4
# g. Frenada que se registra en silencio: 0.30–0.35 g es manejo normal en ciudad. De 0.2 a 1.0.
CONDUCCION_FRENADA_G=0.45
# g. Arranque brusco que se registra en silencio. De 0.2 a 1.0.
CONDUCCION_ACELERACION_G=0.40
# ms. Retraso mínimo del GPS respecto del acelerómetro, medido en el banco. De 0 a 5000.
CONDUCCION_RETRASO_MIN_MS=0
# ms. Retraso máximo del GPS respecto del acelerómetro, medido en el banco. De 0 a 10000, y no menor que el mínimo.
CONDUCCION_RETRASO_MAX_MS=3000
```

- [ ] **Step 8: Aviso en el README para el despliegue**

En `README.md`, reemplazá:

```markdown
   | `TSA_URL` | `https://freetsa.org/tsr` |

4. **Volumen persistente**
```

por:

```markdown
   | `TSA_URL` | `https://freetsa.org/tsr` |

   Si el servicio ya tenía cargadas las variables `IMPACTO_*` del `.env.example` viejo, revisalas al
   desplegar: `IMPACTO_VELOCIDAD_PREVIA_KMH` pasó de 30 a 15 (con 30 se perdían los choques urbanos
   saliendo de un semáforo, y un 30 copiado pasa la validación) e `IMPACTO_VENTANA_CAIDA_MS` ya no se
   usa. Un valor fuera de rango no impide arrancar: se usa el de omisión y `/api/salud` lo informa en
   `modo_viaje`. La lista completa, con el motivo de cada número, está en `.env.example`.

4. **Volumen persistente**
```

- [ ] **Step 9: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA` y con `Todo en orden.` (el bloque viejo del detector sigue pasando: su choque va de 55 a 2 km/h, y 15 ≤ 55); `prueba-viaje.mjs` con `[V2]` en `ok` y `Todo en orden.`.

Chequeo manual opcional, con la base descartable de F1 levantada: `IMPACTO_UMBRAL_SOSPECHA_G=40 npm run dev` y `curl -s http://localhost:3000/api/salud` → `"modo_viaje":{"ok":false,"detalle":"Hay 1 umbral fuera de rango: se usan los valores de omisión. Revisá las variables IMPACTO_* y CONDUCCION_*.","problemas":[{"campo":"sospechaG","recibido":40,"usado":4,"motivo":"sospechaG tiene que estar entre 2 y 20; vino 40."}]}`, y en la terminal del servidor, una sola vez, `[impacto] umbrales fuera de rango: se usan los valores de omisión.`. Al cortar: `git checkout -- next-env.d.ts`.

- [ ] **Step 10: Commit**

```bash
git add "lib/impacto.ts" "app/api/salud/route.ts" ".env.example" "README.md" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Validar los umbrales del detector para que una variable mal cargada no apague la detección

Los umbrales pasan de 7 a 15 y se leen del entorno con rangos y relaciones: un NaN, un
valor fuera de rango o un par incoherente vuelve a la omisión, se escribe una vez en el log
y lo informa /api/salud, sin cambiar su ok. IMPACTO_VELOCIDAD_PREVIA_KMH pasa de 30 a 15
porque con 30 se perdían los choques urbanos saliendo de un semáforo: un servicio con el 30
copiado del .env.example viejo pasa la validación y hay que revisarlo al desplegar.
IMPACTO_VENTANA_CAIDA_MS deja de usarse y el log lo avisa.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `Veredicto` v2, `evaluarEpisodio` fila por fila y `analizarImpacto` como adaptador

**Files:**
- Modify: `lib/impacto.ts` — desde `export type NivelImpacto = 'nada' | 'sospecha' | 'confirmado'` hasta la llave que cierra `export function analizarImpacto` (el bloque termina justo antes de `/** Respuesta a una alerta. Es también el CHECK telemetria_respuesta_valida_v1. */`). Incluye la interfaz `Veredicto` vieja y `const modulo`.
- Modify: `scripts/prueba-logica.mjs` — el bloque que empieza con `/* El detector de impacto, contra series sintéticas. */` hasta su `}` de cierre (el último bloque antes de `/* ---------- Resultado ---------- */`), y la línea `import { UMBRALES, analizarImpacto, planEscalamiento } from '../lib/impacto.ts'`.
- Test: `scripts/prueba-viaje.mjs`, dentro de `[V2]`.

**Interfaces:**
- Consumes: `Umbrales`, `UMBRALES` (Tarea 1); `Lectura`, `VelocidadEpisodio`, `EpisodioImpacto`, `DisparadorEpisodio`, `FuenteAceleracion`, `GRAVEDAD_MS2`, `recortarEpisodio` (F1).
- Produces (índice, bloque F2 de `lib/impacto.ts`, sin cambios de forma):
  - `export type NivelImpacto`, `export type CaidaSinGolpe = 'alerta' | 'silenciosa'`, `export type EventoSilencioso = 'golpe_en_marcha' | 'caida_silenciosa'`
  - `export interface SenalesSubpico`, `export interface SenalesCaida`, `export interface Veredicto` (con `señales: SenalesSubpico | null`, `subpicos`, `caida`, `silencioso`, `umbrales`, `caidaSinGolpe`, `version`, `llamar_emergencias: false`), `export interface OpcionesEvaluacion`
  - `export function evaluarEpisodio(episodio: EpisodioImpacto, opciones: OpcionesEvaluacion): Veredicto`
  - `export function analizarImpacto(serie: Lectura[], umbrales?: Umbrales): Veredicto`
  - `export const VERSION_DETECCION = 1`, `export const PRECISION_CONFIABLE_M = 50`
  - Los usan: las Tareas 3–6 y 9, F1 (`lib/telemetria.ts` y `lib/transporte-viaje.ts` compilan igual) y F3 (`señales?.previa`, `caida?.previa`, `caida?.densaG`, `silencioso`).

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, dentro de la sección `[V2]`, agregá este bloque al final (antes del `})` que cierra `[V2]`, con una línea vacía antes):

```js
  /* ---- evaluarEpisodio fila por fila y el adaptador analizarImpacto ---- */
  {
    const { UMBRALES, VERSION_DETECCION, PRECISION_CONFIABLE_M, evaluarEpisodio, analizarImpacto } = await import('../lib/impacto.ts')
    const G = 9.80665
    const opciones = { umbrales: UMBRALES, caidaSinGolpe: 'silenciosa' }
    const quieta = (t) => ({ t, ax: 0.05, ay: 0.02, az: 0.03, gTotal: 1, giro: 2, h: 0.01 })
    /** De −2 s a 9 s a 60 Hz; un golpe de `g` sostenido `ms` desde t = 0; `antes(t)` puede cambiar las muestras previas. */
    function serieGolpe({ g = 12, ms = 100, antes = null, giro = 60 } = {}) {
      const serie = []
      for (let i = -120; i <= 540; i++) {
        const t = Math.round((i * 1000) / 60 * 10) / 10 || 0
        if (t >= 0 && t < ms) serie.push({ t, ax: g * G, ay: 0.3, az: 0.2, gTotal: g, giro, h: 0.01 })
        else serie.push((t < 0 && antes?.(t)) || quieta(t))
      }
      return serie
    }
    /** Una lectura por segundo de −10 s a 9 s: `antes` hasta los 2 s (el GPS llega atrasado) y `despues` desde ahí. */
    function velocidades(antes, despues, { precisionM = 5, avanza = null } = {}) {
      const lista = []
      let y = 0
      for (let s = -10; s <= 9; s++) {
        const kmh = s <= 2 ? antes : despues
        lista.push({ t: s * 1000, kmh, precisionM, x: 0, y })
        y += (avanza ?? kmh) / 3.6
      }
      return lista
    }
    const golpe = (velocidadesEpisodio, serie = serieGolpe()) => ({ disparador: 'golpe', fuente: 'confiable', hzMedido: 60, serie, velocidades: velocidadesEpisodio })
    const fila = (v) => `${v.nivel} fila ${v.señales?.fila ?? v.caida?.fila} (${v.motivo})`

    verificar('VERSION_DETECCION es 1 y la precisión confiable 50 m', VERSION_DETECCION === 1 && PRECISION_CONFIABLE_M === 50)

    const f1 = evaluarEpisodio(golpe(velocidades(5, 0)), opciones)
    verificar('fila 1: con el auto quieto un golpe no alerta', f1.nivel === 'nada' && f1.señales.fila === 1 && f1.silencioso === null, fila(f1))

    const f2 = evaluarEpisodio(golpe(velocidades(50, 0)), opciones)
    verificar('fila 2: iba andando, golpe sostenido y quedó detenido: confirmado', f2.nivel === 'confirmado' && f2.señales.fila === 2 && f2.señales.detenido && f2.señales.ibaAndando, fila(f2))
    verificar('el veredicto guarda disparador, fuente, umbrales, versión y msPico', f2.disparador === 'golpe' && f2.fuente === 'confiable' && isDeepStrictEqual(f2.umbrales, { ...UMBRALES }) && f2.version === 1 && f2.msPico >= 0 && f2.msPico < 100 && f2.caida === null)
    verificar('y NUNCA propone llamar solo a emergencias', f2.llamar_emergencias === false)
    verificar('evaluarEpisodio es determinista', isDeepStrictEqual(evaluarEpisodio(golpe(velocidades(50, 0)), opciones), f2))

    const girando = (t) => (t >= -500 && t <= -80 ? { ...quieta(t), giro: 420 } : null)
    const f3 = evaluarEpisodio(golpe(velocidades(50, 0), serieGolpe({ antes: girando })), opciones)
    verificar('fila 3: el teléfono giraba antes del golpe: sospecha, nunca confirmado', f3.nivel === 'sospecha' && f3.señales.fila === 3 && f3.señales.manipulado, fila(f3))

    const f4 = evaluarEpisodio(golpe(velocidades(60, 40)), opciones)
    verificar('fila 4: el auto siguió andando: nada y golpe_en_marcha', f4.nivel === 'nada' && f4.señales.fila === 4 && f4.silencioso === 'golpe_en_marcha' && f4.descartes.length === 1, fila(f4))

    const f5 = evaluarEpisodio(golpe(velocidades(60, 20)), opciones)
    verificar('fila 5: iba andando y no hay detención clara: sospecha', f5.nivel === 'sospecha' && f5.señales.fila === 5, fila(f5))

    const f6 = evaluarEpisodio(golpe(velocidades(12, 0)), opciones)
    verificar('fila 6: auto casi quieto y golpe ≥ confirmadoG: sospecha', f6.nivel === 'sospecha' && f6.señales.fila === 6, fila(f6))
    const f6debil = evaluarEpisodio(golpe(velocidades(12, 0), serieGolpe({ g: 6 })), opciones)
    verificar('auto casi quieto y golpe menor que confirmadoG: nada', f6debil.nivel === 'nada' && f6debil.señales.fila === 10, fila(f6debil))

    const f7 = evaluarEpisodio(golpe([]), opciones)
    verificar('fila 7: sin velocidad, golpe sostenido: sospecha como tope', f7.nivel === 'sospecha' && f7.señales.fila === 7 && !f7.señales.velocidadDisponible, fila(f7))
    const imprecisas = evaluarEpisodio(golpe(velocidades(50, 0, { precisionM: 80 })), opciones)
    verificar('lecturas con precisión peor que 50 m no cuentan como velocidad', imprecisas.señales.fila === 7, fila(imprecisas))

    const sacudiendo = (t) => (t >= -1400 && t <= -150 ? { ...quieta(t), ax: 3 * G * Math.sin((2 * Math.PI * 4 * t) / 1000) } : null)
    const f7sacudida = evaluarEpisodio(golpe([], serieGolpe({ antes: sacudiendo })), opciones)
    verificar('sin velocidad, con sacudidas que venían de antes: nada', f7sacudida.nivel === 'nada' && f7sacudida.señales.sacudida, fila(f7sacudida))
    const enElAire = (t) => (t >= -300 && t <= -30 ? { ...quieta(t), gTotal: 0.1, giro: 20 } : null)
    const cayo = evaluarEpisodio(golpe([], serieGolpe({ antes: enElAire, g: 20 })), opciones)
    verificar('caída libre antes del golpe: manipulado y nada', cayo.nivel === 'nada' && cayo.señales.manipulado && cayo.descartes[0].includes('en el aire'), fila(cayo))
    const sinGiroscopo = serieGolpe({ antes: (t) => (t >= -400 && t <= -30 ? { ...quieta(t), gTotal: 0.7, giro: null } : { ...quieta(t), giro: null }), giro: null })
    const cayoSinGiro = evaluarEpisodio(golpe([], sinGiroscopo), opciones)
    verificar('sin giróscopo, gTotal < 0.8 durante 80 ms también es manipulado', cayoSinGiro.señales.manipulado && cayoSinGiro.nivel === 'nada', fila(cayoSinGiro))
    const pozo = evaluarEpisodio(golpe(velocidades(50, 50), serieGolpe({ ms: 10 })), opciones)
    verificar('un pico de una muestra no es sostenido: nada', pozo.nivel === 'nada' && !pozo.señales.sostenido && pozo.descartes[0].includes('no se sostuvo'), fila(pozo))
    const ceroAndando = evaluarEpisodio(golpe(velocidades(50, 0, { avanza: 50 })), opciones)
    verificar('una velocidad 0 con posiciones que avanzan no es una detención', ceroAndando.nivel === 'sospecha' && !ceroAndando.señales.detenido, fila(ceroAndando))
    const vacio = evaluarEpisodio(golpe([], []), opciones)
    verificar('sin muestras: nada, pico 0 y sin sub-picos', vacio.nivel === 'nada' && vacio.picoG === 0 && vacio.subpicos.length === 0 && vacio.motivo === 'Ninguna muestra llegó a 4 g.', vacio.motivo)

    const dosGolpes = serieGolpe().map((l) => (l.t >= 3000 && l.t < 3100 ? { ...l, ax: 6 * G, gTotal: 6, giro: 60 } : l))
    const dos = evaluarEpisodio(golpe(velocidades(60, 40), dosGolpes), opciones)
    verificar('cada racha separada por más de 300 ms es un sub-pico con su propio tPico', dos.subpicos.length === 2 && dos.subpicos[1].tPico >= 3000)

    /* Disparador (b): caída de velocidad sin golpe. */
    function serieCaida(h) {
      const serie = []
      for (let i = -360; i <= 480; i++) {
        const t = Math.round((i * 1000) / 60 * 10) / 10 || 0
        serie.push({ t, ax: 0.05, ay: 0.02, az: 0.03, gTotal: 1, giro: 2, h: h(t) })
      }
      return serie
    }
    const velocidadesCaida = () => {
      const lista = []
      let y = 0
      for (let s = -10; s <= 8; s++) {
        const kmh = s < 0 ? 50 : 0
        lista.push({ t: s * 1000, kmh, precisionM: 5, x: 0, y })
        y += kmh / 3.6
      }
      return lista
    }
    const caida = (h, fuente = 'confiable') => ({ disparador: 'caida_velocidad', fuente, hzMedido: 60, serie: serieCaida(h), velocidades: velocidadesCaida() })
    const brusca = (t) => (t >= -700 && t <= -100 ? 2 : 0.01)
    const f8alerta = evaluarEpisodio(caida(brusca), { umbrales: UMBRALES, caidaSinGolpe: 'alerta' })
    verificar('fila 8 con alerta: detención imposible para una frenada: sospecha', f8alerta.nivel === 'sospecha' && f8alerta.caida.fila === 8 && f8alerta.caida.densaG >= 1.4 && f8alerta.silencioso === null && f8alerta.señales === null && f8alerta.msPico === null, JSON.stringify(f8alerta.caida))
    const f8silenciosa = evaluarEpisodio(caida(brusca), opciones)
    verificar('fila 8 en silenciosa: nada y caida_silenciosa', f8silenciosa.nivel === 'nada' && f8silenciosa.caida.fila === 8 && f8silenciosa.silencioso === 'caida_silenciosa', fila(f8silenciosa))
    const f9 = evaluarEpisodio(caida(() => null, 'derivada'), { umbrales: UMBRALES, caidaSinGolpe: 'alerta' })
    verificar('fila 9: sin aceleración confiable nunca alerta: caida_silenciosa', f9.nivel === 'nada' && f9.caida.fila === 9 && f9.caida.densaG === null && f9.silencioso === 'caida_silenciosa', fila(f9))
    const abs = evaluarEpisodio(caida((t) => (t >= -2500 && t <= 0 ? 1.1 : 0.01)), { umbrales: UMBRALES, caidaSinGolpe: 'alerta' })
    verificar('una frenada con ABS a 1.1 g no llega a la desaceleración imposible', abs.nivel === 'nada' && abs.caida.fila === 10 && abs.silencioso === null, fila(abs))
    const respetaDisparador = caida(brusca)
    respetaDisparador.serie[400] = { ...respetaDisparador.serie[400], ax: 12 * G }
    const b = evaluarEpisodio(respetaDisparador, opciones)
    verificar('respeta el disparador que recibe: con (b) no evalúa sub-picos', b.disparador === 'caida_velocidad' && b.subpicos.length === 0 && b.caida !== null && b.picoG >= 12)

    /* El adaptador del detector anterior y de /api/casos/[id]/sensores. */
    const serie = (fn, n = 40) => Array.from({ length: n }, (_, i) => fn(i))
    const tranquilo = serie((i) => ({ t: i * 20, ax: 0.2, ay: 0.1, az: 0.1, gTotal: 1, kmh: 50 }))
    verificar('analizarImpacto: circular tranquilo no dispara nada', analizarImpacto(tranquilo).nivel === 'nada')
    const choque = serie((i) => {
      const enPico = i >= 20 && i <= 24
      const g = enPico ? 12 : i > 24 ? 3 : 0.3
      return { t: i * 20, ax: g * G, ay: 0, az: 0, gTotal: 1 + g, kmh: i < 20 ? 55 : 2, giro: enPico ? 260 : 5 }
    })
    const vChoque = analizarImpacto(choque)
    verificar('analizarImpacto: un choque sin velocidades es sospecha por la fila 7', vChoque.nivel === 'sospecha' && vChoque.señales.fila === 7 && vChoque.disparador === 'golpe' && vChoque.caidaSinGolpe === 'silenciosa', fila(vChoque))
    verificar('analizarImpacto: t queda relativo a la primera muestra fuerte', vChoque.msPico === 0 && vChoque.llamar_emergencias === false, String(vChoque.msPico))
    const pozoViejo = serie((i) => ({ t: i * 20, ax: i === 20 ? 6 * G : 0.2, ay: 0, az: 0, gTotal: i === 20 ? 7 : 1, kmh: 50 }))
    verificar('analizarImpacto: un pozo NO se confunde con un choque', analizarImpacto(pozoViejo).nivel === 'nada')
    const caidaVieja = serie((i) => ({ t: i * 20, ax: i >= 20 && i <= 23 ? 20 * G : 0.1, ay: 0, az: 0, gTotal: i >= 12 && i < 20 ? 0.05 : i >= 20 && i <= 23 ? 21 : 1, kmh: 0 }))
    const vCaida = analizarImpacto(caidaVieja)
    verificar('analizarImpacto: el teléfono que se cae NO se confunde con un choque', vCaida.nivel === 'nada' && vCaida.descartes.some((d) => d.includes('en el aire')), vCaida.motivo)
    const larga = serie((i) => ({ t: i * 16.7, ax: i === 1400 ? 12 * G : 0.1, ay: 0, az: 0, gTotal: 1 }), 1500)
    verificar('analizarImpacto recorta a 1000 muestras sin romperse', analizarImpacto(larga).picoG >= 11.9)
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V2 npx tsx scripts/prueba-viaje.mjs`

Expected: las 18 verificaciones de la Tarea 1 en `ok`; después

```
  FALLA VERSION_DETECCION es 1 y la precisión confiable 50 m 
  FALLA [V2] terminó sin excepciones TypeError: evaluarEpisodio is not a function
```

con `18/20 verificaciones pasaron` y `2 FALLARON`.

- [ ] **Step 3: El veredicto nuevo**

En `lib/impacto.ts`, reemplazá el bloque entero que va desde `export type NivelImpacto = 'nada' | 'sospecha' | 'confirmado'` hasta la llave de cierre de `export function analizarImpacto(...)` (inclusive; es el `Veredicto` viejo con `señales: { sobreUmbral, caidaDeVelocidad, giroBrusco, sostenido }`, `const modulo` y el `analizarImpacto` de la caída libre en 150 ms) por:

```ts
export type NivelImpacto = 'nada' | 'sospecha' | 'confirmado'

/** Configuración caida_sin_golpe (fila 8). */
export type CaidaSinGolpe = 'alerta' | 'silenciosa'

/** Evento de conducción que corresponde registrar en silencio a partir de un episodio. */
export type EventoSilencioso = 'golpe_en_marcha' | 'caida_silenciosa'

/** §2.4, por sub-pico. */
export interface SenalesSubpico {
  /** ms relativos al disparo. */
  tPico: number
  /** Máximo de |a| del sub-pico, en g. */
  pico: number
  /** Duración de la racha contigua con |a| ≥ sospechaG/2 que contiene el pico, en ms. */
  msSostenido: number
  sostenido: boolean
  manipulado: boolean
  sacudida: boolean
  /** km/h: máximo de las medianas de 3 lecturas confiables consecutivas en [tPico − 8 s, tPico + 2.5 s]; con menos de 3, la mediana de las que haya; null sin lecturas confiables. */
  previa: number | null
  ibaAndando: boolean
  detenido: boolean
  siguioAndando: boolean
  velocidadDisponible: boolean
  giroBrusco: boolean
  /** Fila de la tabla §2.5 que decidió: 1 a 7, o 10 si ninguna. */
  fila: number
  nivel: NivelImpacto
}

/** §2.4 caidaSinGolpe, sólo con el disparador (b). */
export interface SenalesCaida {
  /** ms del cruce, relativo al disparo (0). */
  tCruce: number
  previa: number | null
  /** Lecturas confiables ≤ velocidadPosteriorKmh después del cruce. */
  bajas: number
  /** ≤ 6 km/h por posiciones durante ≥ 5 s con fixes de accuracy ≤ 30 m. */
  detencionConfirmada: boolean
  /** Media de max(0, h − 0.05) en la ventana de 600 ms más densa de [t − 6 s, t + 1 s], en g; null sin aceleración confiable. */
  densaG: number | null
  manipulado: boolean
  sacudida: boolean
  caidaSinGolpe: boolean
  /** 8, 9 o 10. */
  fila: number
  nivel: NivelImpacto
}

export interface Veredicto {
  nivel: NivelImpacto
  /** Máximo de |a| de todo el episodio, en g (0 sin muestras). */
  picoG: number
  /** tPico del sub-pico que decidió, relativo al disparo; null con el disparador (b) o sin sub-picos. */
  msPico: number | null
  disparador: DisparadorEpisodio
  fuente: FuenteAceleracion
  /** Señales del sub-pico que decidió: el de mayor nivel y, a igual nivel, el de mayor pico. null sin sub-picos. */
  señales: SenalesSubpico | null
  /** Sub-picos en orden de tPico; si hay más de 50, los 50 de mayor pico. */
  subpicos: SenalesSubpico[]
  caida: SenalesCaida | null
  /** 'golpe_en_marcha' si el nivel final es nada y algún sub-pico cayó en la fila 4; 'caida_silenciosa' con la fila 8 en silenciosa o la 9. */
  silencioso: EventoSilencioso | null
  /** Por qué se descartó cada sub-pico, en castellano (máximo 20, de hasta 200 caracteres). */
  descartes: string[]
  /** Una frase que explica el nivel, en castellano (hasta 200 caracteres). */
  motivo: string
  umbrales: Umbrales
  caidaSinGolpe: CaidaSinGolpe
  /** VERSION_DETECCION. */
  version: number
  /**
   * SIEMPRE false, y es un tipo literal a propósito: así el compilador impide que alguien,
   * alguna vez, marque el 107 sin que la persona lo confirme. Una llamada automática a
   * emergencias por un falso positivo satura una línea que alguien más puede necesitar.
   */
  llamar_emergencias: false
}

export interface OpcionesEvaluacion {
  umbrales: Umbrales
  caidaSinGolpe: CaidaSinGolpe
}

/** Versión de las reglas de evaluarEpisodio. Sube con cualquier cambio de reglas. */
export const VERSION_DETECCION = 1

/** m. Una lectura con precisión peor que esto no es confiable; con el último fix así, el GPS está 'impreciso'. */
export const PRECISION_CONFIABLE_M = 50

const modulo = (l: Lectura) => Math.sqrt(l.ax * l.ax + l.ay * l.ay + l.az * l.az) / GRAVEDAD_MS2

/** Un sub-pico es otro si lo separa de la muestra fuerte anterior más que esto (§2.3). */
const MS_ENTRE_SUBPICOS = 300
/** El redondeo del transporte a 0.1 ms puede dejar 49.9 donde el teléfono midió 50: no tiene que cambiar el nivel. */
const TOLERANCIA_MS = 1
/** g. Sin gravedad el teléfono está en el aire (§2.4 manipulado). */
const G_CAIDA_LIBRE = 0.5
/** g. Sin giróscopo no se ve el giro de la mano: se exige una caída libre más larga pero menos profunda. */
const G_CAIDA_SIN_GIRO = 0.8
/** g. Un lóbulo de sacudida (§2.4). */
const G_LOBULO = 2
/** g. Banda muerta de la horizontal: el ruido del sensor y la ruta, que integrado inventaría velocidad. */
const G_BANDA_MUERTA = 0.05
/** km/h. Debajo de esto el auto está quieto (fila 1). */
const KMH_QUIETO = 10
/** km/h. siguioAndando exige al menos esto además de la mitad de la previa. */
const KMH_SIGUIO = 15
/** km/h por posiciones que desmienten una velocidad 0 de CoreLocation. */
const KMH_POSICIONES_ANDANDO = 15
/** km/h por posiciones que confirman una detención. */
const KMH_POSICIONES_DETENIDO = 6
const MAX_SUBPICOS = 50
const MAX_DESCARTES = 20
const MAX_TEXTO = 200

type VelocidadConfiable = VelocidadEpisodio & { kmh: number }

const esVelocidadConfiable = (v: VelocidadEpisodio): v is VelocidadConfiable => v.kmh !== null && v.precisionM <= PRECISION_CONFIABLE_M

const entre = <T extends { t: number }>(lista: readonly T[], desde: number, hasta: number): T[] => lista.filter((x) => x.t >= desde && x.t <= hasta)

function medianaDe(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  const medio = orden.length >> 1
  return orden.length % 2 === 1 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2
}

/** Redondeo para lo que se guarda y se muestra; el cálculo usa siempre los valores sin redondear. */
const aDecimales = (valor: number, decimales: number): number => {
  const factor = 10 ** decimales
  const r = Math.round(valor * factor) / factor
  return r === 0 ? 0 : r
}

const recortarTexto = (texto: string) => texto.slice(0, MAX_TEXTO)

/** Duración en ms de la racha más larga de muestras contiguas que cumplen, de la primera a la última; -1 si ninguna. */
function rachaMasLarga(serie: readonly Lectura[], cumple: (l: Lectura) => boolean): number {
  let desde: number | null = null
  let mayor = -1
  for (const l of serie) {
    if (!cumple(l)) {
      desde = null
      continue
    }
    if (desde === null) desde = l.t
    mayor = Math.max(mayor, l.t - desde)
  }
  return mayor
}

/**
 * La racha alrededor del pico con |a| ≥ umbral. Tolera UNA muestra suelta por debajo: el pasa-bajos del sensor
 * puede dejar caer una en medio de la sacudida de un choque (así se midió en el banco).
 */
function msSobre(serie: readonly Lectura[], modulos: readonly number[], indicePico: number, umbralG: number): number {
  let primero = indicePico
  let ultimo = indicePico
  for (let i = indicePico - 1; i >= 0; ) {
    if (modulos[i] >= umbralG) {
      primero = i
      i--
    } else if (i - 1 >= 0 && modulos[i - 1] >= umbralG) {
      primero = i - 1
      i -= 2
    } else break
  }
  for (let i = indicePico + 1; i < serie.length; ) {
    if (modulos[i] >= umbralG) {
      ultimo = i
      i++
    } else if (i + 1 < serie.length && modulos[i + 1] >= umbralG) {
      ultimo = i + 1
      i += 2
    } else break
  }
  return serie[ultimo].t - serie[primero].t
}

/**
 * El giro o la caída libre ANTES del golpe delatan la mano o un teléfono que se cae: en un choque el teléfono
 * gira después. Las ventanas terminan antes del pico para no ver el golpe mismo.
 */
function manipuladoEn(serie: readonly Lectura[], giroDesde: number, giroHasta: number, caidaDesde: number, caidaHasta: number, u: Umbrales): boolean {
  const paraGiro = entre(serie, giroDesde, giroHasta)
  if (rachaMasLarga(paraGiro, (l) => typeof l.giro === 'number' && l.giro >= u.giroManipulacionDps) >= 50 - TOLERANCIA_MS) return true
  const paraCaida = entre(serie, caidaDesde, caidaHasta)
  if (rachaMasLarga(paraCaida, (l) => typeof l.gTotal === 'number' && l.gTotal < G_CAIDA_LIBRE) >= 50 - TOLERANCIA_MS) return true
  const sinGiroscopo = paraCaida.every((l) => typeof l.giro !== 'number')
  return sinGiroscopo && rachaMasLarga(paraCaida, (l) => typeof l.gTotal === 'number' && l.gTotal < G_CAIDA_SIN_GIRO) >= 80 - TOLERANCIA_MS
}

/** Lóbulos de al menos G_LOBULO en el eje que más se movió: la periodicidad de una mano que sacude. */
function lobulosFuertes(serie: readonly Lectura[], desde: number, hasta: number): number {
  const ventana = entre(serie, desde, hasta)
  if (ventana.length === 0) return 0
  const energia = [0, 0, 0]
  for (const l of ventana) {
    energia[0] += l.ax * l.ax
    energia[1] += l.ay * l.ay
    energia[2] += l.az * l.az
  }
  const eje = energia.indexOf(Math.max(...energia))
  let lobulos = 0
  let signo = 0
  let pico = 0
  for (const l of ventana) {
    const valor = [l.ax, l.ay, l.az][eje] / GRAVEDAD_MS2
    const s = valor >= 0 ? 1 : -1
    if (s !== signo) {
      if (pico >= G_LOBULO) lobulos++
      signo = s
      pico = 0
    }
    pico = Math.max(pico, Math.abs(valor))
  }
  if (pico >= G_LOBULO) lobulos++
  return lobulos
}

/**
 * §2.4 previa: incluye hasta 2.5 s después del pico porque el GPS llega 1 a 3 s atrasado. Con 1.5 s, un choque 4 s
 * después de salir de un semáforo daba una previa de 14 km/h y se perdía (banco de F2).
 */
function velocidadPrevia(confiables: readonly VelocidadConfiable[], t: number): number | null {
  const tramo = entre(confiables, t - 8000, t + 2500)
  if (tramo.length === 0) return null
  if (tramo.length < 3) return medianaDe(tramo.map((v) => v.kmh))
  let mayor = -Infinity
  for (let i = 2; i < tramo.length; i++) mayor = Math.max(mayor, medianaDe([tramo[i - 2].kmh, tramo[i - 1].kmh, tramo[i].kmh]))
  return mayor
}

const kmhPorPosiciones = (a: VelocidadEpisodio, b: VelocidadEpisodio): number => (Math.hypot(b.x - a.x, b.y - a.y) / ((b.t - a.t) / 1000)) * 3.6

/**
 * Media de max(0, h − banda) en la ventana de 600 ms más densa. Se integra en el tiempo (con cada intervalo
 * acotado a 50 ms) para que una frecuencia de muestreo distinta o un hueco no cambien el resultado.
 */
function ventanaDensa(serie: readonly Lectura[], desde: number, hasta: number): number | null {
  const tramo = entre(serie, desde, hasta).filter((l) => typeof l.h === 'number')
  if (tramo.length < 2) return null
  const aporte = tramo.map((l, i) => (i === 0 ? 0 : Math.max(0, (l.h as number) - G_BANDA_MUERTA) * Math.min(l.t - tramo[i - 1].t, 50)))
  let suma = 0
  let mayor = 0
  for (let i = 1, k = 1; i < tramo.length; i++) {
    suma += aporte[i]
    while (tramo[i].t - tramo[k - 1].t > 600) {
      suma -= aporte[k]
      k++
    }
    mayor = Math.max(mayor, suma / 600)
  }
  return mayor
}

function senalesSubpico(
  serie: readonly Lectura[],
  modulos: readonly number[],
  grupo: readonly number[],
  velocidades: readonly VelocidadEpisodio[],
  confiables: readonly VelocidadConfiable[],
  u: Umbrales,
): { senales: SenalesSubpico; descarte: string | null; motivo: string } {
  const indicePico = grupo.reduce((mejor, i) => (modulos[i] > modulos[mejor] ? i : mejor))
  const tPico = serie[indicePico].t
  const pico = modulos[indicePico]
  const msSostenido = msSobre(serie, modulos, indicePico, u.sospechaG / 2)
  const sostenido = msSostenido >= u.msSobreUmbral - TOLERANCIA_MS
  const manipulado = manipuladoEn(serie, tPico - 700, tPico - 80, tPico - 700, tPico - 30, u)
  const sacudida = lobulosFuertes(serie, tPico - 1500, tPico - 100) >= 2
  const previa = velocidadPrevia(confiables, tPico)
  const ibaAndando = previa !== null && previa >= u.velocidadPreviaKmh

  const desdePost = tPico + 2000
  const hastaPost = tPico + u.ventanaPostMs
  const posteriores = entre(confiables, desdePost, hastaPost)
  const bajas = posteriores.filter((v) => v.kmh <= u.velocidadPosteriorKmh)
  // Una velocidad 0 con posiciones que avanzan no es una detención: CoreLocation puede informar 0 andando.
  const bajasCreibles = bajas.length >= 2 && (bajas[bajas.length - 1].t - bajas[0].t < 2000 || kmhPorPosiciones(bajas[0], bajas[bajas.length - 1]) <= KMH_POSICIONES_ANDANDO)
  const precisos = entre(velocidades, desdePost, hastaPost).filter((v) => v.precisionM <= 20)
  const primerPreciso = precisos[0]
  const ultimoPreciso = precisos[precisos.length - 1]
  const quietoPorPosiciones = precisos.length >= 2 && ultimoPreciso.t - primerPreciso.t >= 3000 && kmhPorPosiciones(primerPreciso, ultimoPreciso) <= KMH_POSICIONES_DETENIDO
  const detenido = bajasCreibles || quietoPorPosiciones
  const ultimas = posteriores.slice(-3).map((v) => v.kmh)
  const siguioAndando = !detenido && ultimas.length >= 2 && medianaDe(ultimas) >= Math.max(KMH_SIGUIO, 0.5 * (previa ?? 0))
  const fixesPosteriores = entre(velocidades, desdePost, hastaPost).filter((v) => v.precisionM <= PRECISION_CONFIABLE_M)
  const velocidadDisponible = entre(confiables, tPico - 8000, tPico + 2500).length >= 2 && (posteriores.length >= 2 || fixesPosteriores.length >= 2)
  const giroBrusco = entre(serie, tPico - 1000, tPico + 1000).some((l) => typeof l.giro === 'number' && l.giro >= u.giroDps)

  const g = pico.toFixed(1)
  const kmh = previa === null ? '' : `${Math.round(previa)} km/h`
  let fila = 10
  let nivel: NivelImpacto = 'nada'
  let motivo = ''
  let descarte: string | null = null
  if (velocidadDisponible && (previa as number) < KMH_QUIETO) {
    fila = 1
    descarte = `Golpe de ${g} g con el auto quieto (${kmh}): con el auto detenido no se alerta.`
  } else if (velocidadDisponible && sostenido && !manipulado && ibaAndando && detenido) {
    fila = 2
    nivel = 'confirmado'
    motivo = `Iba a ${kmh}, hubo un golpe sostenido de ${g} g y el auto quedó detenido.`
  } else if (velocidadDisponible && sostenido && manipulado && ibaAndando && detenido) {
    fila = 3
    nivel = 'sospecha'
    motivo = `Iba a ${kmh} y quedó detenido después de un golpe de ${g} g, pero el teléfono se movía antes del golpe.`
  } else if (velocidadDisponible && sostenido && !manipulado && ibaAndando && siguioAndando) {
    fila = 4
    descarte = `Golpe de ${g} g y el auto siguió andando: queda registrado en silencio.`
  } else if (velocidadDisponible && sostenido && !manipulado && ibaAndando) {
    fila = 5
    nivel = 'sospecha'
    motivo = `Iba a ${kmh} y hubo un golpe sostenido de ${g} g, sin una detención clara.`
  } else if (velocidadDisponible && !ibaAndando && pico >= u.confirmadoG && sostenido && !manipulado && !sacudida) {
    fila = 6
    nivel = 'sospecha'
    motivo = `Golpe fuerte de ${g} g con el auto casi quieto (${kmh}).`
  } else if (!velocidadDisponible && sostenido && !manipulado && !sacudida) {
    fila = 7
    nivel = 'sospecha'
    motivo = `Golpe sostenido de ${g} g sin velocidad del GPS para confirmarlo.`
  } else if (!sostenido) {
    descarte = `Pico de ${g} g que no se sostuvo (${Math.round(msSostenido)} ms): se parece más a un pozo que a un choque.`
  } else if (manipulado) {
    descarte = `Pico de ${g} g con el teléfono girando o en el aire antes del golpe: se movió en la mano o se cayó.`
  } else if (sacudida) {
    descarte = `Pico de ${g} g con sacudidas que ya venían de antes: se parece a un teléfono sacudido.`
  } else {
    descarte = `Pico de ${g} g con el auto casi quieto (${kmh}) y por debajo de ${u.confirmadoG} g.`
  }

  return {
    senales: {
      tPico,
      pico: aDecimales(pico, 2),
      msSostenido: aDecimales(msSostenido, 1),
      sostenido,
      manipulado,
      sacudida,
      previa: previa === null ? null : aDecimales(previa, 1),
      ibaAndando,
      detenido,
      siguioAndando,
      velocidadDisponible,
      giroBrusco,
      fila,
      nivel,
    },
    descarte: descarte === null ? null : recortarTexto(descarte),
    motivo: recortarTexto(motivo || (descarte as string)),
  }
}


function evaluarCaida(episodio: EpisodioImpacto, confiables: readonly VelocidadConfiable[], opciones: OpcionesEvaluacion): { caida: SenalesCaida; motivo: string } {
  const u = opciones.umbrales
  const { serie, velocidades } = episodio
  const previa = velocidadPrevia(confiables, 0)
  const bajas = confiables.filter((v) => v.t >= 0 && v.kmh <= u.velocidadPosteriorKmh).length
  const precisos = velocidades.filter((v) => v.t >= 0 && v.precisionM <= 30)
  const desde = precisos[0]
  const hasta = desde === undefined ? undefined : [...precisos].reverse().find((v) => v.t - desde.t >= 5000 && v.t - desde.t <= 8000)
  const detencionConfirmada = desde !== undefined && hasta !== undefined && kmhPorPosiciones(desde, hasta) <= KMH_POSICIONES_DETENIDO
  const densaG = episodio.fuente === 'confiable' ? ventanaDensa(serie, -6000, 1000) : null
  const manipulado = manipuladoEn(serie, -6000, 1000, -6000, 1000, u)
  const sacudida = lobulosFuertes(serie, -6000, 1000) >= 2
  const porVelocidad = previa !== null && previa >= u.velocidadPreviaCaidaKmh && bajas >= 3 && detencionConfirmada
  const caidaSinGolpe = porVelocidad && (densaG === null || (densaG >= u.desaceleracionImposibleG && !manipulado && !sacudida))

  const kmh = previa === null ? 'sin velocidad previa' : `${Math.round(previa)} km/h`
  let fila = 10
  let nivel: NivelImpacto = 'nada'
  let motivo: string
  if (caidaSinGolpe && densaG !== null) {
    fila = 8
    nivel = opciones.caidaSinGolpe === 'alerta' ? 'sospecha' : 'nada'
    motivo =
      nivel === 'sospecha'
        ? `El auto pasó de ${kmh} a detenido con una desaceleración de ${densaG.toFixed(2)} g que ninguna frenada alcanza.`
        : `El auto pasó de ${kmh} a detenido con una desaceleración de ${densaG.toFixed(2)} g: queda registrado en silencio hasta calibrar.`
  } else if (caidaSinGolpe) {
    fila = 9
    motivo = `El auto pasó de ${kmh} a detenido de golpe; sin aceleración confiable queda registrado en silencio.`
  } else if (!porVelocidad) {
    motivo = `La caída de velocidad desde ${kmh} no quedó confirmada como una detención.`
  } else {
    motivo = `El auto se detuvo desde ${kmh} con una desaceleración que puede dar una frenada.`
  }
  return {
    caida: {
      tCruce: 0,
      previa: previa === null ? null : aDecimales(previa, 1),
      bajas,
      detencionConfirmada,
      densaG: densaG === null ? null : aDecimales(densaG, 3),
      manipulado,
      sacudida,
      caidaSinGolpe,
      fila,
      nivel,
    },
    motivo: recortarTexto(motivo),
  }
}

/**
 * El único veredicto (§2.3–§2.5), del detector del teléfono y del servidor. Pura y determinista: el mismo
 * episodio con las mismas opciones da un Veredicto idéntico. Filas 1–7 por sub-pico con el disparador (a);
 * filas 8–9 con el (b). Respeta el disparador que recibe: el detector ya decidió cuál es.
 */
export function evaluarEpisodio(episodio: EpisodioImpacto, opciones: OpcionesEvaluacion): Veredicto {
  const u = opciones.umbrales
  const { serie, velocidades } = episodio
  const modulos = serie.map(modulo)
  const confiables = velocidades.filter(esVelocidadConfiable)
  const base = {
    picoG: aDecimales(modulos.reduce((mayor, m) => Math.max(mayor, m), 0), 2),
    disparador: episodio.disparador,
    fuente: episodio.fuente,
    umbrales: { ...u },
    caidaSinGolpe: opciones.caidaSinGolpe,
    version: VERSION_DETECCION,
    llamar_emergencias: false as const,
  }

  if (episodio.disparador === 'caida_velocidad') {
    const { caida, motivo } = evaluarCaida(episodio, confiables, opciones)
    const silenciosa = caida.fila === 9 || (caida.fila === 8 && caida.nivel === 'nada')
    return {
      ...base,
      nivel: caida.nivel,
      msPico: null,
      señales: null,
      subpicos: [],
      caida,
      silencioso: silenciosa ? 'caida_silenciosa' : null,
      descartes: caida.nivel === 'nada' ? [motivo] : [],
      motivo,
    }
  }

  const grupos: number[][] = []
  modulos.forEach((m, i) => {
    if (m < u.sospechaG) return
    const grupo = grupos[grupos.length - 1]
    if (grupo && serie[i].t - serie[grupo[grupo.length - 1]].t <= MS_ENTRE_SUBPICOS) grupo.push(i)
    else grupos.push([i])
  })
  if (grupos.length === 0) {
    return {
      ...base,
      nivel: 'nada',
      msPico: null,
      señales: null,
      subpicos: [],
      caida: null,
      silencioso: null,
      descartes: [],
      motivo: `Ninguna muestra llegó a ${u.sospechaG} g.`,
    }
  }

  const evaluados = grupos.map((grupo) => senalesSubpico(serie, modulos, grupo, velocidades, confiables, u))
  const decidio = evaluados.reduce((mejor, e) => {
    const diferencia = ORDEN_NIVEL[e.senales.nivel] - ORDEN_NIVEL[mejor.senales.nivel]
    return diferencia > 0 || (diferencia === 0 && e.senales.pico > mejor.senales.pico) ? e : mejor
  })
  const nivel = decidio.senales.nivel
  const subpicos =
    evaluados.length <= MAX_SUBPICOS
      ? evaluados.map((e) => e.senales)
      : [...evaluados]
          .sort((a, b) => b.senales.pico - a.senales.pico)
          .slice(0, MAX_SUBPICOS)
          .map((e) => e.senales)
          .sort((a, b) => a.tPico - b.tPico)
  return {
    ...base,
    nivel,
    msPico: decidio.senales.tPico,
    señales: decidio.senales,
    subpicos,
    caida: null,
    silencioso: nivel === 'nada' && evaluados.some((e) => e.senales.fila === 4) ? 'golpe_en_marcha' : null,
    descartes: evaluados
      .map((e) => e.descarte)
      .filter((d): d is string => d !== null)
      .slice(0, MAX_DESCARTES),
    motivo: decidio.motivo,
  }
}

/**
 * Adaptador del cuerpo del detector anterior y de POST /api/casos/[id]/sensores: arma un episodio 'golpe'
 * con fuente 'confiable', sin velocidades, con t relativo a la primera muestra ≥ sospechaG (o al máximo si no
 * hay), lo recorta con recortarEpisodio y lo evalúa con caidaSinGolpe 'silenciosa'. `umbrales` por omisión: UMBRALES.
 */
export function analizarImpacto(serie: Lectura[], umbrales: Umbrales = UMBRALES): Veredicto {
  const modulos = serie.map(modulo)
  let referencia = modulos.findIndex((m) => m >= umbrales.sospechaG)
  if (referencia === -1) referencia = modulos.reduce((mejor, m, i) => (m > modulos[mejor] ? i : mejor), 0)
  const t0 = serie[referencia]?.t ?? 0
  const duracionS = serie.length >= 2 ? (serie[serie.length - 1].t - serie[0].t) / 1000 : 0
  const episodio: EpisodioImpacto = {
    disparador: 'golpe',
    fuente: 'confiable',
    hzMedido: duracionS > 0 ? aDecimales((serie.length - 1) / duracionS, 1) : 0,
    serie: serie.map((l) => ({ ...l, t: l.t - t0 })),
    velocidades: [],
  }
  return evaluarEpisodio(recortarEpisodio(episodio).episodio, { umbrales, caidaSinGolpe: 'silenciosa' })
}
```

`recortarEpisodio` (F1, más arriba en el archivo) sigue usando `modulo`: queda declarado en este bloque. `ORDEN_NIVEL` es el de `nivelMayor` (F1, más abajo): se usa dentro de una función, así que el orden de declaración no importa.

- [ ] **Step 4: Correr [V2] y verla pasar**

Run: `SECCION=V2 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras

```
  ok   fila 2: iba andando, golpe sostenido y quedó detenido: confirmado
  ok   fila 4: el auto siguió andando: nada y golpe_en_marcha
  ok   fila 8 con alerta: detención imposible para una frenada: sospecha
  ok   analizarImpacto: un choque sin velocidades es sospecha por la fila 7
```

y `49/49 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 5: Ver fallar el bloque viejo de `prueba-logica.mjs`**

Run: `npx tsx scripts/prueba-logica.mjs`

Expected: código 1 con, entre otras, `  FALLA un choque se detecta` y `  FALLA el teléfono que se cae NO se confunde con un choque`: son las afirmaciones del detector anterior (confirmado sin GPS, `señales.caidaDeVelocidad`, caída libre en 150 ms). Las reemplazan las de `[V2]`.

- [ ] **Step 6: Sacar el bloque viejo y su import**

En `scripts/prueba-logica.mjs`, borrá la línea:

```js
import { UMBRALES, analizarImpacto, planEscalamiento } from '../lib/impacto.ts'
```

y borrá el bloque entero que empieza con

```js
/* El detector de impacto, contra series sintéticas. */
{
  const serie = (fn, n = 40) => Array.from({ length: n }, (_, i) => fn(i))
```

y termina con

```js
  verificar('sin respuesta se escala, pero sin llamar solo', planEscalamiento(v, 'sin_respuesta').ofrecerEmergencias === true)
  verificar('si la persona contesta, no se escala nada', planEscalamiento(v, 'estoy_bien').ofrecerEmergencias === false)
  verificar('los umbrales tienen valores de referencia razonables', UMBRALES.sospechaG >= 3 && UMBRALES.confirmadoG >= UMBRALES.sospechaG)
}
```

(incluida esa llave de cierre y la línea vacía que la sigue). El bloque del vector del RFC 8291 y los bloques de push que sumó F0 se quedan. `planEscalamiento` sigue probado en `[V1]`.

Run: `grep -n "analizarImpacto\|planEscalamiento\|UMBRALES" scripts/prueba-logica.mjs`

Expected: ninguna línea.

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida (`DetectorImpacto.tsx` sólo lee `picoG`, `app/api/casos/[id]/sensores/route.ts` sólo llama `analizarImpacto(serie)`, y el `veredictoBasico` de F1 sigue armando un `VeredictoClienteReconstruido`); las dos pruebas sin `  FALLA` y con `Todo en orden.`.

- [ ] **Step 8: Commit**

```bash
git add "lib/impacto.ts" "scripts/prueba-logica.mjs" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Evaluar cada golpe con el contexto del auto para no confundir un pozo con un choque

evaluarEpisodio aplica la tabla de §2.5 a cada sub-pico: iba andando y quedó detenido es
confirmado; el teléfono que giraba o caía antes del golpe nunca pasa de sospecha; si el auto
siguió andando queda un golpe en marcha silencioso; sin velocidad, sospecha como tope. La
caída de velocidad sin golpe sólo alerta si la configuración lo pide. Es pura y determinista,
así que el teléfono y el servidor llegan al mismo veredicto. analizarImpacto queda como
adaptador del detector anterior y de la ruta de sensores.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `lib/conduccion.ts` — `estimarVelocidades` con los relojes de §2.1, `estaDetenido` y `velocidadMedia`

**Files:**
- Create: `lib/conduccion.ts`
- Test: `scripts/prueba-viaje.mjs`, sección nueva `[V3] Velocidad, fuente de aceleración y maniobras`.

**Interfaces:**
- Consumes: de `lib/impacto.ts`, con el import de una línea de abajo (sólo `./impacto`, índice «Importaciones permitidas»): `PRECISION_CONFIABLE_M`, `Umbrales`, `VelocidadEpisodio` en esta tarea; el resto del import lo usan las Tareas 4–6.
- Produces (índice, «Interfaces › `lib/conduccion.ts`»):
  - `export interface MuestraMovimiento { t: number; a: [number, number, number] | null; aIG: [number, number, number] | null; giro: [number, number, number] | null }`
  - `export interface FixGps { lat: number; lon: number; precisionM: number; velocidadMs: number | null; adquiridoPared: number; llegadaMono: number; llegadaPared: number }`
  - `export interface LecturaVelocidad extends VelocidadEpisodio { origen: 'gps' | 'posiciones' | null }`
  - `export function estimarVelocidades(fixes: readonly FixGps[]): LecturaVelocidad[]`
  - `export function estaDetenido(lecturas: readonly LecturaVelocidad[], desdeMono: number, hastaMono: number, umbrales: Umbrales): boolean | null`
  - `export function velocidadMedia(lecturas: readonly LecturaVelocidad[], desdeMono: number, hastaMono: number): number | null`
  - Los usan: `crearDetector` (Tareas 4–6, con el mismo estimador fix por fix) y F3 (`estaDetenido(detector.lecturas(), mono − 10 000, mono, umbrales)`, `velocidadMedia(detector.lecturas(), …)`).

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, agregá esta sección inmediatamente antes de `/* ---------- Resultado ---------- */` (después del cierre de `[V2]`, con una línea vacía antes):

```js
await seccion('V3', 'Velocidad, fuente de aceleración y maniobras', async () => {
  const { UMBRALES } = await import('../lib/impacto.ts')
  const PARED = Date.UTC(2026, 8, 16, 17, 30)
  /** Fixes a 1 Hz hacia el norte a `kmh`, llegando 200 ms después de adquiridos; `cambiar(fix, i)` los altera. */
  function fixes(n, kmh, cambiar = (f) => f) {
    return Array.from({ length: n }, (_, i) =>
      cambiar({ lat: -34.6 + (i * kmh) / 3.6 / 111320, lon: -58.38, precisionM: 5, velocidadMs: kmh / 3.6, adquiridoPared: PARED + i * 1000, llegadaMono: 1000 + i * 1000 + 200, llegadaPared: PARED + i * 1000 + 200 }, i),
    )
  }

  /* ---- estimarVelocidades, estaDetenido y velocidadMedia ---- */
  {
    const { estimarVelocidades, estaDetenido, velocidadMedia } = await import('../lib/conduccion.ts')

    const normales = estimarVelocidades(fixes(5, 36))
    verificar(
      'estimarVelocidades: t en mono menos la edad, kmh del GPS y metros desde el primer fix',
      normales.length === 5 && normales[0].t === 1000 && normales[4].t === 5000 && normales.every((l) => Math.abs(l.kmh - 36) < 1e-9 && l.origen === 'gps') && Math.abs(normales[4].y - 40) < 0.01 && normales[0].x === 0,
      JSON.stringify(normales[4]),
    )
    const gnss = estimarVelocidades(fixes(6, 36, (f) => ({ ...f, adquiridoPared: f.adquiridoPared - 8000 })))
    verificar('hora GNSS corrida 8 s: los dos primeros se descartan y desde el tercero se corrige el sesgo', gnss.length === 4 && gnss[0].t === 3200 && gnss[3].t === 6200, JSON.stringify(gnss.map((l) => l.t)))
    const reloj = estimarVelocidades(fixes(6, 36, (f) => ({ ...f, llegadaPared: f.llegadaPared + 300000 })))
    verificar('reloj del equipo +300 s: mismo resultado', reloj.length === 4 && reloj[0].t === 3200 && reloj[3].t === 6200, JSON.stringify(reloj.map((l) => l.t)))
    const cache = estimarVelocidades(fixes(6, 36, (f, i) => (i === 4 ? { ...f, adquiridoPared: f.llegadaPared - 120000 } : f)))
    verificar('un fix en caché de 2 minutos se descarta y el siguiente entra', cache.length === 5 && !cache.some((l) => l.t === 5000 - 120000 + 200) && cache[4].t === 6000, JSON.stringify(cache.map((l) => l.t)))
    const repetido = estimarVelocidades(fixes(4, 36, (f, i) => (i === 2 ? { ...f, adquiridoPared: PARED + 1000 } : f)))
    verificar('un pos.timestamp que no crece se descarta', repetido.length === 3)
    const ios = estimarVelocidades(fixes(6, 36, (f) => ({ ...f, velocidadMs: null })))
    verificar(
      'sin coords.speed la velocidad sale de posiciones con base de 3 s o más',
      ios.slice(0, 3).every((l) => l.kmh === null && l.origen === null) && Math.abs(ios[3].kmh - 36) < 0.1 && ios[3].origen === 'posiciones',
      JSON.stringify(ios.map((l) => l.kmh)),
    )
    const desacuerdo = estimarVelocidades(fixes(5, 36, (f, i) => (i === 4 ? { ...f, velocidadMs: null, llegadaMono: f.llegadaMono + 2600, llegadaPared: f.llegadaPared + 2600 } : f)))
    verificar('si el Δt de adquisición y el de llegada difieren más de 2 s, no hay velocidad por posiciones', desacuerdo.length === 5 && desacuerdo[4].kmh === null)

    const lectura = (s, kmh, y = 0, precisionM = 5) => ({ t: s * 1000, kmh, precisionM, x: 0, y, origen: 'gps' })
    const quieto = [0, 1, 2, 3, 4, 5].map((s) => lectura(s, 3))
    verificar('estaDetenido: lecturas confiables bajas y posiciones quietas', estaDetenido(quieto, 0, 5000, UMBRALES) === true)
    verificar('estaDetenido: una lectura sobre velocidadPosteriorKmh es false', estaDetenido([...quieto, lectura(6, 20)], 0, 6000, UMBRALES) === false)
    verificar('estaDetenido: sin lecturas suficientes no se sabe (null)', estaDetenido([lectura(0, 2)], 0, 5000, UMBRALES) === null && estaDetenido(quieto.map((l) => ({ ...l, precisionM: 80 })), 0, 5000, UMBRALES) === null)
    verificar('estaDetenido: velocidad 0 con posiciones que avanzan a 60 km/h es false', estaDetenido([0, 1, 2, 3, 4].map((s) => lectura(s, 0, (s * 60) / 3.6)), 0, 4000, UMBRALES) === false)
    verificar('velocidadMedia promedia las confiables del tramo', velocidadMedia([lectura(0, 10), lectura(1, 20), lectura(2, 90, 0, 80)], 0, 2000) === 15 && velocidadMedia([], 0, 1000) === null)
  }
})
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V3 npx tsx scripts/prueba-viaje.mjs`

Expected: código 1 con

```
  FALLA [V3] terminó sin excepciones Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\lib\conduccion.ts' imported from C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\prueba-viaje.mjs
```

`0/1 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: Crear `lib/conduccion.ts`**

```ts
/**
 * Señales del viaje en curso: velocidad, fuente de aceleración, episodios de impacto, seguimiento del golpe
 * en marcha y maniobras silenciosas.
 *
 * Todo lo que decide «alerta sí o no» vive acá y es puro: no toca window, navigator ni relojes globales, y
 * todo tiempo entra por parámetro. Así el banco de simulación (scripts/banco-impacto.mjs) mide exactamente
 * lo que corre en el teléfono, y el motor (lib/viaje.ts) sólo cablea sensores y ciclo de vida.
 *
 * Importa de impacto.ts, nunca al revés: el servidor evalúa episodios sin cargar la detección.
 */
import { evaluarEpisodio, redondearEpisodio, recortarEpisodio, GRAVEDAD_MS2, KMH_POR_S_POR_G, MAX_VELOCIDADES_EPISODIO, PRECISION_CONFIABLE_M, type CaidaSinGolpe, type EpisodioImpacto, type FuenteAceleracion, type Lectura, type Umbrales, type VelocidadEpisodio, type Veredicto } from './impacto'

/* ---------- Velocidad (§2.1) ---------- */

/** Lo que entrega un DeviceMotionEvent, copiado a números. Unidades del navegador. */
export interface MuestraMovimiento {
  /** e.timeStamp en ms, misma base que performance.now() (el motor lo corrige si no lo está). */
  t: number
  /** e.acceleration [x, y, z] en m/s²; null si no viene o algún eje no es número. */
  a: [number, number, number] | null
  /** e.accelerationIncludingGravity [x, y, z] en m/s²; null si no viene o algún eje no es número. */
  aIG: [number, number, number] | null
  /** e.rotationRate [alpha (eje z), beta (eje x), gamma (eje y)] en °/s; null si no viene o sin números. */
  giro: [number, number, number] | null
}

/** Un fix del GPS sellado al llegar (§2.1). */
export interface FixGps {
  lat: number
  lon: number
  /** coords.accuracy, m. */
  precisionM: number
  /** coords.speed en m/s; null si no viene. */
  velocidadMs: number | null
  /** pos.timestamp: hora de pared de adquisición, ms. */
  adquiridoPared: number
  /** reloj.mono() y reloj.pared() leídos juntos al entrar el callback. */
  llegadaMono: number
  llegadaPared: number
}

/** Una lectura de velocidad en la base de reloj.mono(). x, y: metros respecto del primer fix desde el último hueco. */
export interface LecturaVelocidad extends VelocidadEpisodio {
  /** De dónde salió kmh: coords.speed o posiciones con base ≥ 3 s; null si kmh es null. */
  origen: 'gps' | 'posiciones' | null
}

const METROS_POR_GRADO = 111_320
/** Con 3 edades o más, una mediana mayor que esto es un reloj corrido (hora GNSS o reloj manual), no un fix viejo. */
const MS_SESGO_RELOJ = 3000
/** Un fix más viejo que esto (ya corregido el sesgo) es de caché o de un lote de CoreLocation. */
const MS_EDAD_MAXIMA = 5000
/** Base mínima de la velocidad por posiciones: entre fixes de 1 s el ruido de posición domina. */
const MS_BASE_POSICIONES = 3000
/** Si el Δt de adquisición y el de llegada difieren más que esto, uno de los dos relojes saltó. */
const MS_DESACUERDO_RELOJES = 2000

type VelocidadConfiable = LecturaVelocidad & { kmh: number }

const esConfiable = (v: VelocidadEpisodio): v is VelocidadConfiable => v.kmh !== null && v.precisionM <= PRECISION_CONFIABLE_M

function mediana(valores: readonly number[]): number {
  const orden = [...valores].sort((a, b) => a - b)
  const medio = orden.length >> 1
  return orden.length % 2 === 1 ? orden[medio] : (orden[medio - 1] + orden[medio]) / 2
}

interface Estimador {
  agregar(fix: FixGps): LecturaVelocidad | null
}

/** §2.1 fix por fix. estimarVelocidades y el detector usan el mismo, así lo que se prueba es lo que corre. */
function crearEstimador(): Estimador {
  const edades: number[] = []
  const aceptados: Array<{ fix: FixGps; x: number; y: number }> = []
  let origen: { lat: number; lon: number; coseno: number } | null = null
  let ultimaT = -Infinity

  return {
    agregar(fix) {
      const edad = fix.llegadaPared - fix.adquiridoPared
      edades.push(edad)
      if (edades.length > 5) edades.shift()
      const medio = edades.length >= 3 ? mediana(edades) : 0
      const sesgo = Math.abs(medio) > MS_SESGO_RELOJ ? medio : 0
      const edadEfectiva = edad - sesgo
      const anterior = aceptados[aceptados.length - 1]
      if (edadEfectiva > MS_EDAD_MAXIMA) return null
      if (anterior && fix.adquiridoPared <= anterior.fix.adquiridoPared) return null

      if (origen === null) origen = { lat: fix.lat, lon: fix.lon, coseno: Math.cos((fix.lat * Math.PI) / 180) }
      const x = (fix.lon - origen.lon) * METROS_POR_GRADO * origen.coseno
      const y = (fix.lat - origen.lat) * METROS_POR_GRADO
      // Estrictamente creciente: el episodio que va al servidor se rechaza con un t que no crece.
      const t = Math.max(fix.llegadaMono - Math.max(edadEfectiva, 0), ultimaT + 1)
      ultimaT = t

      let kmh: number | null = null
      let de: LecturaVelocidad['origen'] = null
      if (fix.velocidadMs !== null && Number.isFinite(fix.velocidadMs) && fix.velocidadMs >= 0) {
        kmh = fix.velocidadMs * 3.6
        de = 'gps'
      } else {
        let base: { fix: FixGps; x: number; y: number } | undefined
        for (let i = aceptados.length - 1; i >= 0 && base === undefined; i--) {
          if (fix.adquiridoPared - aceptados[i].fix.adquiridoPared >= MS_BASE_POSICIONES) base = aceptados[i]
        }
        if (base) {
          const dtAdquisicion = fix.adquiridoPared - base.fix.adquiridoPared
          const dtLlegada = fix.llegadaPared - base.fix.llegadaPared
          if (Math.abs(dtAdquisicion - dtLlegada) <= MS_DESACUERDO_RELOJES) {
            kmh = (Math.hypot(x - base.x, y - base.y) / (dtAdquisicion / 1000)) * 3.6
            de = 'posiciones'
          }
        }
      }
      aceptados.push({ fix, x, y })
      if (aceptados.length > 10) aceptados.shift()
      return { t, kmh, precisionM: fix.precisionM, x, y, origen: de }
    },
  }
}

/**
 * §2.1 sobre los fixes desde el último hueco, en orden de llegada: sesgo por la mediana de las edades de los
 * últimos 5 (incluidos los descartados) si hay 3 o más y |mediana| > 3000; descarta edadEf > 5000 y
 * pos.timestamp que no crece; t = llegadaMono − max(edadEf, 0); derivada con base ≥ 3 s y par descartado si
 * los Δt de adquisición y de llegada difieren más de 2 s. Devuelve una lectura por fix aceptado.
 */
export function estimarVelocidades(fixes: readonly FixGps[]): LecturaVelocidad[] {
  const estimador = crearEstimador()
  const lecturas: LecturaVelocidad[] = []
  for (const fix of fixes) {
    const lectura = estimador.agregar(fix)
    if (lectura) lecturas.push(lectura)
  }
  return lecturas
}

/**
 * ¿El auto está quieto en [desdeMono, hastaMono]? true: ≥ 2 lecturas confiables, todas ≤ velocidadPosteriorKmh,
 * y las posiciones no avanzan a más de 15 km/h. false: alguna lectura confiable > velocidadPosteriorKmh.
 * null: sin lecturas confiables suficientes (no saber no es estar detenido).
 */
export function estaDetenido(lecturas: readonly LecturaVelocidad[], desdeMono: number, hastaMono: number, umbrales: Umbrales): boolean | null {
  const tramo = lecturas.filter((v) => v.t >= desdeMono && v.t <= hastaMono && esConfiable(v)) as VelocidadConfiable[]
  if (tramo.some((v) => v.kmh > umbrales.velocidadPosteriorKmh)) return false
  if (tramo.length < 2) return null
  const primera = tramo[0]
  const ultima = tramo[tramo.length - 1]
  // CoreLocation puede informar 0 andando: si las posiciones avanzan, no está quieto.
  if (ultima.t - primera.t >= MS_BASE_POSICIONES && (Math.hypot(ultima.x - primera.x, ultima.y - primera.y) / ((ultima.t - primera.t) / 1000)) * 3.6 > 15) return false
  return true
}

/** Media de kmh de las lecturas confiables en [desdeMono, hastaMono]; null si no hay ninguna. */
export function velocidadMedia(lecturas: readonly LecturaVelocidad[], desdeMono: number, hastaMono: number): number | null {
  const tramo = lecturas.filter((v) => v.t >= desdeMono && v.t <= hastaMono && esConfiable(v)) as VelocidadConfiable[]
  if (tramo.length === 0) return null
  return tramo.reduce((suma, v) => suma + v.kmh, 0) / tramo.length
}
```

Con la hora GNSS corrida o el reloj del equipo adelantado, los dos primeros fixes se descartan (todavía no hay tres edades para estimar el sesgo) y desde el tercero la edad efectiva es 0: `t = llegadaMono`. Por eso la prueba espera 3200 y no 3000.

- [ ] **Step 4: Correr [V3] y verla pasar**

Run: `SECCION=V3 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras

```
  ok   hora GNSS corrida 8 s: los dos primeros se descartan y desde el tercero se corrige el sesgo
  ok   un fix en caché de 2 minutos se descarta y el siguiente entra
  ok   estaDetenido: velocidad 0 con posiciones que avanzan a 60 km/h es false
```

y `12/12 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (el archivo nuevo no repite ningún nombre exportado de `lib/`); `tsc --noEmit` sin salida; las dos pruebas con `Todo en orden.`.

- [ ] **Step 6: Commit**

```bash
git add "lib/conduccion.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Fechar cada fix del GPS al llegar para que un reloj corrido no invente velocidades

estimarVelocidades lleva cada fix a la base de performance.now() con su edad, corrige el
sesgo de la hora GNSS o del reloj del equipo con la mediana de las últimas edades, descarta
el fix en caché que llega al reanudar y el pos.timestamp que no crece, y deriva la velocidad
de posiciones sólo con 3 s de base y relojes que coinciden. estaDetenido distingue quieto,
andando y no se sabe: no saber no es estar detenido.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `lib/conduccion.ts` — fuente de aceleración (§2.2) dentro de `crearDetector`

**Files:**
- Modify: `lib/conduccion.ts` — al final del archivo, después de `export function velocidadMedia`.
- Test: `scripts/prueba-viaje.mjs`, dentro de `[V3]`.

**Interfaces:**
- Consumes: `crearEstimador`, `esConfiable` y los tipos de la Tarea 3; `GRAVEDAD_MS2`, `FuenteAceleracion`, `Lectura`, `CaidaSinGolpe`, `EpisodioImpacto`, `Umbrales`, `Veredicto` de `lib/impacto.ts`.
- Produces (índice, sin cambios de forma):
  - `export interface Maniobra`, `export interface MuestraHorizontal` (tipos; la función es de la Tarea 6)
  - `export interface OpcionesDetector { umbrales: Umbrales; caidaSinGolpe: CaidaSinGolpe }`
  - `export type EventoDetector` (las tres variantes: `episodio`, `seguimiento`, `maniobra`)
  - `export interface ResumenDetector`, `export interface Detector`
  - `export function crearDetector(opciones: OpcionesDetector): Detector` — en esta tarea procesa muestras (fuente confiable o derivada, ĝ, convergencia, horizontal filtrada, ω), fixes, huecos y `resumen`; todavía no emite eventos. La Tarea 5 reemplaza la función con los episodios.

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, dentro de la sección `[V3]`, agregá esto al final (antes del `})` que cierra `[V3]`, con una línea vacía antes). Las constantes y funciones del principio (`G`, `quieta`, `golpeada`, `pared`, `manejar`, `trayecto`, `episodios`, `opcionesDetector`) quedan a nivel de la sección porque las usan también los bloques de las Tareas 5 y 6:

```js
  /* ---- Detector: fuente de aceleración (§2.2) ---- */
  const G = 9.80665
  const MUESTRA_MS = 1000 / 60
  const quieta = (t) => ({ t, a: [0.02, 0.01, 0.03], aIG: [0.02, 0.01, G + 0.03], giro: [1, 1, 1] })
  const golpeada = (t, g = 12) => ({ t, a: [g * G, 0.3, 0.2], aIG: [g * G, 0.3, G + 0.2], giro: [60, 5, 5] })
  /** Reloj de pared del detector en las pruebas: la pared es PARED + mono, salvo que se diga otra cosa. */
  const pared = (mono) => PARED + mono
  /**
   * Maneja un detector de `desde` a `hasta` (mono): una muestra cada 1/60 s y, cada segundo, el fix de ese segundo
   * (si `fix` lo da) y avanzar(). Devuelve los eventos.
   */
  function manejar(detector, { desde, hasta, muestra = quieta, fix = () => null }) {
    const eventos = []
    let latido = Math.ceil(desde / 1000) * 1000
    if (latido === desde) latido += 1000
    for (let t = desde; t < hasta; t += MUESTRA_MS) {
      while (latido <= t) {
        const f = fix(latido)
        if (f) eventos.push(...detector.fix(f))
        eventos.push(...detector.avanzar(latido, pared(latido)))
        latido += 1000
      }
      const m = muestra(t)
      if (m) eventos.push(...detector.muestra(m, pared(t)))
    }
    return eventos
  }
  /** Fixes hacia el norte con la velocidad de kmhEn(mono), recorriendo las posiciones de verdad. Llamar en orden. */
  function trayecto(kmhEn) {
    let y = 0
    let anterior = null
    return (mono) => {
      if (anterior !== null) y += ((mono - anterior) / 1000) * (kmhEn(anterior) / 3.6)
      anterior = mono
      return { lat: -34.6 + y / 111320, lon: -58.38, precisionM: 5, velocidadMs: kmhEn(mono) / 3.6, adquiridoPared: pared(mono) - 200, llegadaMono: mono, llegadaPared: pared(mono) }
    }
  }
  const episodios = (eventos) => eventos.filter((e) => e.tipo === 'episodio')
  const opcionesDetector = { umbrales: UMBRALES, caidaSinGolpe: 'silenciosa' }

  {
    const { crearDetector } = await import('../lib/conduccion.ts')

    const confiable = crearDetector(opcionesDetector)
    manejar(confiable, { desde: 1000, hasta: 3000 })
    const r = confiable.resumen(3000)
    verificar('con rotationRate la fuente es confiable y convergida', r.fuente === 'confiable' && r.convergida === true, JSON.stringify(r))
    verificar('resumen mide la frecuencia real y |a| vivo', r.hzMedido > 58 && r.hzMedido < 62 && r.gVivo < 0.1 && r.velocidadKmh === null && r.enMovimiento !== true, JSON.stringify(r))

    // Chrome sin giróscopo: acceleration trae números filtrados que se comen el golpe; la lineal sale de aIG.
    const sinGiro = (t) => ({ t, a: [0.001, 0.001, 0.001], aIG: [0.1, 0.2, G], giro: null })
    const derivada = crearDetector(opcionesDetector)
    manejar(derivada, { desde: 1000, hasta: 1600, muestra: sinGiro })
    const recien = derivada.resumen(1600)
    manejar(derivada, { desde: 1600, hasta: 3000, muestra: sinGiro })
    const despues = derivada.resumen(3000)
    verificar('sin rotationRate la fuente es derivada y ĝ necesita 1 s estable para converger', recien.fuente === 'derivada' && recien.convergida === false && despues.convergida === true, JSON.stringify([recien, despues]))

    const ceros = crearDetector(opcionesDetector)
    manejar(ceros, { desde: 1000, hasta: 2000, muestra: (t) => ({ t, a: [0, 0, 0], aIG: [0.1, 0.2, G], giro: [1, 1, 1] }) })
    verificar('acceleration exactamente (0, 0, 0) con aIG distinto de cero no es confiable', ceros.resumen(2000).fuente === 'derivada')
    const vacia = crearDetector(opcionesDetector)
    manejar(vacia, { desde: 1000, hasta: 2000, muestra: (t) => ({ t, a: null, aIG: null, giro: null }) })
    verificar('una muestra sin aceleración se ignora', vacia.resumen(2000).gVivo === null)
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V3 npx tsx scripts/prueba-viaje.mjs`

Expected: las 12 verificaciones de la Tarea 3 en `ok`; después

```
  FALLA [V3] terminó sin excepciones TypeError: crearDetector is not a function
```

con `12/13 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: Tipos del detector y `crearDetector` con la fuente de aceleración**

En `lib/conduccion.ts`, agregá al final del archivo (después de la llave que cierra `velocidadMedia`, con una línea vacía antes):

```ts
/* ---------- Maniobras silenciosas (§2.7) ---------- */

/** Una frenada o aceleración silenciosa (§2.7). */
export interface Maniobra {
  tipo: 'frenada' | 'aceleracion'
  /** Hora de pared del inicio (tI), ms. */
  ocurridoEn: number
  /** vAntes y vDespués (§2.7.3), km/h. */
  kmhInicial: number
  kmhFinal: number
  /** tF − tI, ms. */
  duracionMs: number
  /** g media del acelerómetro durante la maniobra (por la ruta sólo GPS, la pendiente del GPS), siempre positiva. */
  gEstimada: number
  /** Máximo de aLon en g; null por la ruta sólo GPS. */
  picoG: number | null
  ruta: 'acelerometro' | 'gps'
}

/** Muestra ya procesada para maniobras. */
export interface MuestraHorizontal {
  /** ms, base mono. */
  t: number
  /** |h| filtrada < 2 Hz, en g; null con ĝ inestable, sin giróscopo o sin acelerómetro. */
  h: number | null
  /** ω = rotationRate · ĝ promediado sobre 2 s, en rad/s; null sin giróscopo. */
  omega: number | null
}

/* ---------- Detector (§2.2, §2.3, §2.6) ---------- */

export interface OpcionesDetector {
  umbrales: Umbrales
  caidaSinGolpe: CaidaSinGolpe
}

export type EventoDetector =
  | {
      tipo: 'episodio'
      /** Mono del disparo. */
      disparoMono: number
      /** Pared del primer pico (o del cruce): ocurrido_en = pared − (mono − tPico), con el par capturado al detectarlo. */
      ocurridoEn: number
      /** Ya recortado (recortarEpisodio) y redondeado (redondearEpisodio): es exactamente lo que va al servidor. */
      episodio: EpisodioImpacto
      /** evaluarEpisodio sobre ese mismo episodio con las opciones vigentes. */
      veredicto: Veredicto
    }
  | {
      /** §2.6: el golpe en marcha que se seguía pide abrir la alerta. Como mucho uno por golpe. */
      tipo: 'seguimiento'
      disparoMono: number
      ocurridoEn: number
      episodio: EpisodioImpacto
      veredicto: Veredicto
      motivo: 'detenido' | 'gps' | 'hueco'
    }
  | { tipo: 'maniobra'; maniobra: Maniobra }

export interface ResumenDetector {
  fuente: FuenteAceleracion
  /** false mientras ĝ no convergió con la fuente derivada (no se abren episodios). */
  convergida: boolean
  hzMedido: number | null
  /** |a| de la última muestra, en g. */
  gVivo: number | null
  /** kmh de la última lectura confiable de menos de 5 s; null si no hay. */
  velocidadKmh: number | null
  /** precisionM del último fix de menos de 5 s. */
  precisionM: number | null
  ultimoFixMono: number | null
  /** §4.4: media de 60 s ≥ 5 km/h con GPS; sin GPS, desvío estándar de |a| ≥ 0.04 g en los últimos 10 s. null si no se sabe. */
  enMovimiento: boolean | null
  /** Hay un golpe en marcha dentro de sus 90 s de seguimiento. */
  siguiendoGolpe: boolean
}

export interface Detector {
  /** Una muestra de devicemotion; pared = reloj.pared() al recibirla. Una sola comparación barata por muestra. */
  muestra(m: MuestraMovimiento, pared: number): EventoDetector[]
  /** Un fix sellado al llegar. */
  fix(f: FixGps): EventoDetector[]
  /** Cada 1 s mientras escucha: cierra episodios vencidos, corre maniobras, avanza el seguimiento y detecta huecos por |Δpared − Δmono| > 1 s. */
  avanzar(mono: number, pared: number): EventoDetector[]
  /** Hueco declarado por el motor (visible, pageshow persisted, salida de pausa): vacía buffers, reinicia filtros, medianas y edades, cierra episodios abiertos sin velocidad. */
  hueco(mono: number, pared: number): EventoDetector[]
  /** El GPS pasó a 'buscando' o 'impreciso': cuenta para el seguimiento (§2.6). */
  gpsSinDatos(mono: number, pared: number): EventoDetector[]
  configurar(opciones: OpcionesDetector): void
  /** Descarta episodios abiertos sin evaluar y el seguimiento en curso («Tuve un accidente», apagar). */
  descartarAbiertos(): void
  /** Lecturas de velocidad retenidas (al menos los últimos 60 s). */
  lecturas(): readonly LecturaVelocidad[]
  resumen(mono: number): ResumenDetector
}

type Vector = [number, number, number]

const norma = (v: readonly number[]) => Math.hypot(v[0], v[1], v[2])
const resta = (a: readonly number[], b: readonly number[]): Vector => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const escalar = (v: readonly number[], k: number): Vector => [v[0] * k, v[1] * k, v[2] * k]
const punto = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** §2.2: un buffer por tiempo, no por cantidad. Alcanza para el episodio más largo (2 s antes + 15 s + 8 s). */
const MS_BUFFER_ACELERACION = 30_000
/** Velocidades para la previa de un episodio, el seguimiento y la media de 60 s de la inactividad. */
const MS_BUFFER_VELOCIDAD = 120_000
/** τ del filtro de gravedad con la fuente derivada (§2.2). */
const TAU_GRAVEDAD_S = 1
/** ĝ promediado sobre 2 s para separar lo lateral de lo longitudinal (§2.7). */
const TAU_GRAVEDAD_LENTA_S = 2
/** Pasa-bajos de la horizontal: una frenada vive debajo de 2 Hz y la ruta vibra arriba. */
const TAU_HORIZONTAL_S = 1 / (2 * Math.PI * 2)
/** Dos muestras más juntas que esto redondean al mismo t en el transporte: la segunda se ignora. */
const MS_ENTRE_MUESTRAS = 0.2
const MS_HUECO = 1000
const MS_VIGENCIA = 5000

interface MuestraProcesada {
  lectura: Lectura
  /** |a| lineal en g. */
  g: number
  horizontal: MuestraHorizontal
}

export function crearDetector(opcionesIniciales: OpcionesDetector): Detector {
  let opciones = opcionesIniciales

  let fuente: FuenteAceleracion = 'confiable'
  let gravedadDerivada: Vector | null = null
  let convergidaDesde: number | null = null
  let gravedadLenta: Vector | null = null
  let horizontalFiltrada: Vector = [0, 0, 0]
  let ultimaT: number | null = null
  let muestras: MuestraProcesada[] = []

  let estimador = crearEstimador()
  let velocidades: LecturaVelocidad[] = []
  let ultimoFix: { mono: number; precisionM: number } | null = null
  let latido: { mono: number; pared: number } | null = null

  const convergida = (t: number) => fuente === 'confiable' || (convergidaDesde !== null && t - convergidaDesde >= 1000)

  function reiniciarFiltros() {
    gravedadDerivada = null
    convergidaDesde = null
    gravedadLenta = null
    horizontalFiltrada = [0, 0, 0]
  }

  /** §2.2. null si la muestra no trae con qué calcular la aceleración. */
  function procesar(m: MuestraMovimiento, dt: number): MuestraProcesada | null {
    const cero = m.a !== null && m.a[0] === 0 && m.a[1] === 0 && m.a[2] === 0 && m.aIG !== null && norma(m.aIG) > 0
    const confiable = m.giro !== null && m.a !== null && !cero
    const nueva: FuenteAceleracion = confiable ? 'confiable' : 'derivada'
    if (nueva !== fuente) {
      fuente = nueva
      reiniciarFiltros()
    }

    let lineal: Vector
    let gTotal: number | null = null
    let unitario: Vector | null = null
    if (confiable) {
      lineal = [...(m.a as Vector)]
      if (m.aIG !== null) {
        gTotal = norma(m.aIG) / GRAVEDAD_MS2
        const gravedad = resta(m.aIG, lineal)
        const n = norma(gravedad)
        // aIG − a tiene que medir cerca de 1 g; si no, el navegador mezcló marcos y no es la gravedad.
        if (n > 0.5 * GRAVEDAD_MS2) unitario = escalar(gravedad, 1 / n)
      }
    } else {
      // Chrome sin giróscopo calcula acceleration con τ = 1/60 s y se come el pulso de un choque: se deriva de aIG.
      if (m.aIG === null) return null
      gTotal = norma(m.aIG) / GRAVEDAD_MS2
      const alfa = TAU_GRAVEDAD_S / (TAU_GRAVEDAD_S + dt / 1000)
      if (gravedadDerivada === null) gravedadDerivada = [...m.aIG]
      else if (Math.abs(gTotal - 1) <= 0.15) gravedadDerivada = [0, 1, 2].map((k) => alfa * (gravedadDerivada as Vector)[k] + (1 - alfa) * (m.aIG as Vector)[k]) as Vector
      lineal = resta(m.aIG, gravedadDerivada)
      if (Math.abs(norma(gravedadDerivada) / GRAVEDAD_MS2 - 1) < 0.05) {
        if (convergidaDesde === null) convergidaDesde = m.t
      } else {
        convergidaDesde = null
      }
    }

    let h: number | null = null
    let omega: number | null = null
    if (unitario !== null && m.giro !== null) {
      const horizontal = resta(lineal, escalar(unitario, punto(lineal, unitario)))
      const beta = dt / 1000 / (TAU_HORIZONTAL_S + dt / 1000)
      horizontalFiltrada = [0, 1, 2].map((k) => horizontalFiltrada[k] + beta * (horizontal[k] / GRAVEDAD_MS2 - horizontalFiltrada[k])) as Vector
      h = norma(horizontalFiltrada)
      const gamma = dt / 1000 / (TAU_GRAVEDAD_LENTA_S + dt / 1000)
      const mezcla: Vector = gravedadLenta === null ? unitario : ([0, 1, 2].map((k) => (1 - gamma) * (gravedadLenta as Vector)[k] + gamma * (unitario as Vector)[k]) as Vector)
      gravedadLenta = escalar(mezcla, 1 / norma(mezcla))
      // rotationRate viene como [alpha (z), beta (x), gamma (y)]; el producto con ĝ es el giro alrededor de la vertical.
      const giroXYZ: Vector = [m.giro[1], m.giro[2], m.giro[0]]
      omega = (punto(giroXYZ, gravedadLenta) * Math.PI) / 180
    }

    return {
      lectura: { t: m.t, ax: lineal[0], ay: lineal[1], az: lineal[2], gTotal, giro: m.giro === null ? null : norma(m.giro), h },
      g: norma(lineal) / GRAVEDAD_MS2,
      horizontal: { t: m.t, h, omega },
    }
  }

  function recortarBuffers(mono: number) {
    if (muestras.length > 0 && muestras[0].lectura.t < mono - MS_BUFFER_ACELERACION) {
      const desde = muestras.findIndex((p) => p.lectura.t >= mono - MS_BUFFER_ACELERACION)
      muestras = desde === -1 ? [] : muestras.slice(desde)
    }
    if (velocidades.length > 0 && velocidades[0].t < mono - MS_BUFFER_VELOCIDAD) {
      velocidades = velocidades.filter((v) => v.t >= mono - MS_BUFFER_VELOCIDAD)
    }
  }

  const detector: Detector = {
    muestra(m) {
      if (ultimaT !== null && m.t < ultimaT + MS_ENTRE_MUESTRAS) return []
      const dt = ultimaT === null ? 1000 / 60 : Math.min(m.t - ultimaT, 200)
      ultimaT = m.t
      const procesada = procesar(m, dt)
      if (procesada === null) return []
      muestras.push(procesada)
      if (muestras.length % 600 === 0) recortarBuffers(m.t)
      return []
    },

    fix(f) {
      ultimoFix = { mono: f.llegadaMono, precisionM: f.precisionM }
      const lectura = estimador.agregar(f)
      if (lectura !== null) velocidades.push(lectura)
      return []
    },

    avanzar(mono, pared) {
      const eventos: EventoDetector[] = []
      if (latido !== null && Math.abs(pared - latido.pared - (mono - latido.mono)) > MS_HUECO) {
        eventos.push(...detector.hueco(mono, pared))
      }
      latido = { mono, pared }
      recortarBuffers(mono)
      return eventos
    },

    hueco(mono, pared) {
      muestras = []
      velocidades = []
      estimador = crearEstimador()
      ultimoFix = null
      ultimaT = null
      reiniciarFiltros()
      latido = { mono, pared }
      return []
    },

    gpsSinDatos() {
      return []
    },

    configurar(nuevas) {
      opciones = nuevas
    },

    descartarAbiertos() {},

    lecturas() {
      return velocidades
    },

    resumen(mono) {
      const ultima = muestras[muestras.length - 1]
      const recientes = muestras.filter((p) => p.lectura.t >= mono - 2000)
      const confiables = velocidades.filter((v) => esConfiable(v) && v.t >= mono - 60_000) as VelocidadConfiable[]
      const vigente = [...confiables].reverse().find((v) => v.t >= mono - MS_VIGENCIA)
      let enMovimiento: boolean | null = null
      if (confiables.length > 0) {
        enMovimiento = confiables.reduce((s, v) => s + v.kmh, 0) / confiables.length >= 5
      } else {
        const ultimos = muestras.filter((p) => p.lectura.t >= mono - 10_000)
        if (ultimos.length >= 30) {
          const media = ultimos.reduce((s, p) => s + p.g, 0) / ultimos.length
          const desvio = Math.sqrt(ultimos.reduce((s, p) => s + (p.g - media) ** 2, 0) / ultimos.length)
          enMovimiento = desvio >= 0.04
        }
      }
      return {
        fuente,
        convergida: ultima === undefined ? fuente === 'confiable' : convergida(ultima.lectura.t),
        hzMedido: recientes.length >= 2 ? Math.round(((recientes.length - 1) / ((recientes[recientes.length - 1].lectura.t - recientes[0].lectura.t) / 1000)) * 10) / 10 : null,
        gVivo: ultima === undefined ? null : ultima.g,
        velocidadKmh: vigente === undefined ? null : vigente.kmh,
        precisionM: ultimoFix !== null && ultimoFix.mono >= mono - MS_VIGENCIA ? ultimoFix.precisionM : null,
        ultimoFixMono: ultimoFix === null ? null : ultimoFix.mono,
        enMovimiento,
        siguiendoGolpe: false,
      }
    },
  }
  return detector
}
```

- [ ] **Step 4: Correr [V3] y verla pasar**

Run: `SECCION=V3 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras

```
  ok   sin rotationRate la fuente es derivada y ĝ necesita 1 s estable para converger
  ok   acceleration exactamente (0, 0, 0) con aIG distinto de cero no es confiable
```

y `17/17 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; las dos pruebas con `Todo en orden.`.

- [ ] **Step 6: Commit**

```bash
git add "lib/conduccion.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Derivar la aceleración de la gravedad en los teléfonos sin giróscopo

Chrome sin giróscopo entrega un acceleration filtrado con τ = 1/60 s que se come el pulso de
un choque. Sin rotationRate, o con acceleration en cero exacto, la lineal sale de
accelerationIncludingGravity con un ĝ de τ = 1 s que se congela durante un golpe, y no se
abren episodios hasta que ĝ convergió un segundo. Con giróscopo se calcula además la
horizontal filtrada y el giro alrededor de la vertical, que usan las maniobras.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `lib/conduccion.ts` — episodios, sub-picos, disparador (b), huecos y seguimiento (§2.3, §2.6)

**Files:**
- Modify: `lib/conduccion.ts` — desde la línea `/** §2.2: un buffer por tiempo, no por cantidad. Alcanza para el episodio más largo (2 s antes + 15 s + 8 s). */` hasta el final del archivo.
- Test: `scripts/prueba-viaje.mjs`, dentro de `[V3]`.

**Interfaces:**
- Consumes: `evaluarEpisodio`, `recortarEpisodio`, `redondearEpisodio`, `MAX_VELOCIDADES_EPISODIO` de `lib/impacto.ts`; `estaDetenido`, `mediana`, `esConfiable`, `crearEstimador` y los tipos de las Tareas 3 y 4.
- Produces: `crearDetector` completo salvo maniobras, con el comportamiento de la interfaz `Detector` del índice:
  - `muestra`: una comparación barata (`|a| ≥ sospechaG`) abre un episodio (a) o extiende el abierto hasta el tope.
  - `fix`: abre un episodio (b) cuando una lectura confiable ≤ `velocidadPosteriorKmh` viene de ≥ `velocidadPreviaCaidaKmh` en los 2.5 s anteriores.
  - `avanzar`: huecos por relojes, cierre de episodios vencidos (`ventanaPostMs` después de la última muestra fuerte; con (b), `max(ventanaPostMs, 7 s)`) y seguimiento.
  - `hueco`: cierra el episodio abierto sin velocidades, vacía buffers y reinicia filtros; si se seguía un golpe, pide la alerta con `motivo: 'hueco'`.
  - `gpsSinDatos`: pide la alerta del golpe seguido con `motivo: 'gps'`.
  - `descartarAbiertos`, `resumen(mono).siguiendoGolpe`.
  - Cada `EventoDetector` `episodio` trae el episodio recortado y redondeado y el `evaluarEpisodio` de ese mismo objeto: es lo que F3 manda con `codificarEpisodio`.

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, dentro de `[V3]`, agregá este bloque al final (antes del `})` que cierra `[V3]`, con una línea vacía antes):

```js
  /* ---- Detector: episodios, disparador (b), huecos y seguimiento (§2.3, §2.6) ---- */
  {
    const { crearDetector } = await import('../lib/conduccion.ts')
    /** 3 s quieto desde `desde` y un golpe de `g` sostenido 100 ms. */
    const conGolpe = (tGolpe, g = 12) => (t) => (t >= tGolpe && t < tGolpe + 100 ? golpeada(t, g) : quieta(t))

    const sinGps = crearDetector(opcionesDetector)
    const antesDeCerrar = manejar(sinGps, { desde: 1000, hasta: 11000, muestra: conGolpe(4000) })
    verificar('el episodio sigue abierto hasta ventanaPostMs después de la última muestra fuerte', episodios(antesDeCerrar).length === 0)
    const alCerrar = manejar(sinGps, { desde: 11000, hasta: 14000, muestra: conGolpe(4000) })
    const [golpe, ...sobran] = episodios(alCerrar)
    verificar('un golpe sostenido sin GPS da un episodio sospecha (fila 7)', sobran.length === 0 && golpe?.veredicto.nivel === 'sospecha' && golpe.veredicto.señales.fila === 7, JSON.stringify(golpe?.veredicto.señales))
    verificar(
      'el episodio va recortado y redondeado: desde 2 s antes del disparo, t creciente y relativo',
      golpe.episodio.serie[0].t >= -2000 && golpe.episodio.serie.some((l) => l.t === 0) && golpe.episodio.serie.every((l, i, s) => i === 0 || l.t > s[i - 1].t) && golpe.episodio.serie.every((l) => Number.isInteger(l.t * 10)),
    )
    verificar('ocurridoEn es la pared del pico', Math.abs(golpe.ocurridoEn - (pared(golpe.disparoMono) + golpe.veredicto.msPico)) < 1, `${golpe.ocurridoEn}`)
    const despues = manejar(sinGps, { desde: 14000, hasta: 30000, muestra: conGolpe(4000) })
    verificar('las muestras analizadas no vuelven a abrir un episodio', episodios(despues).length === 0)

    const derivada = crearDetector(opcionesDetector)
    const sinGiro = (t) => ({ t, a: [0.001, 0.001, 0.001], aIG: [0.1 + (t >= 4000 && t < 4080 ? 10 * G : 0), 0.2, G], giro: null })
    const pulsos = manejar(derivada, { desde: 1000, hasta: 1600, muestra: (t) => ({ ...sinGiro(t), aIG: [0.1 + (t >= 1300 && t < 1380 ? 10 * G : 0), 0.2, G] }) })
    pulsos.push(...manejar(derivada, { desde: 1600, hasta: 16000, muestra: sinGiro }))
    const [derivado, ...otrosDerivados] = episodios(pulsos)
    verificar(
      'fuente derivada: un pulso de 10 g y 80 ms se detecta con aIG, y no antes de que ĝ converja',
      otrosDerivados.length === 0 && derivado?.episodio.fuente === 'derivada' && derivado.disparoMono >= 4000 && derivado.veredicto.picoG >= 9 && derivado.veredicto.nivel === 'sospecha',
      JSON.stringify(derivado?.veredicto.señales),
    )

    // 60 km/h hasta el golpe a los 12 s, 35 km/h hasta los 32 s y detenido: golpe en marcha que termina en alerta.
    const conDetencion = crearDetector(opcionesDetector)
    const kmhDetencion = (mono) => (mono < 12000 ? 60 : mono < 32000 ? 35 : 0)
    const eventosDetencion = manejar(conDetencion, { desde: 1000, hasta: 60000, muestra: conGolpe(12000), fix: trayecto(kmhDetencion) })
    const enMarcha = episodios(eventosDetencion)[0]
    const seguimiento = eventosDetencion.find((e) => e.tipo === 'seguimiento')
    verificar('golpe en marcha: nada con golpe_en_marcha (fila 4)', enMarcha?.veredicto.nivel === 'nada' && enMarcha.veredicto.silencioso === 'golpe_en_marcha', JSON.stringify(enMarcha?.veredicto.señales))
    verificar(
      'y al quedar detenido 10 s pide abrir la alerta por seguimiento, con el mismo episodio',
      seguimiento?.motivo === 'detenido' && seguimiento.disparoMono === enMarcha.disparoMono && seguimiento.veredicto === enMarcha.veredicto && eventosDetencion.filter((e) => e.tipo === 'seguimiento').length === 1,
      JSON.stringify(seguimiento?.motivo),
    )
    verificar('después de pedir la alerta ya no sigue el golpe', conDetencion.resumen(60000).siguiendoGolpe === false)

    const sigue = crearDetector(opcionesDetector)
    const eventosSigue = manejar(sigue, { desde: 1000, hasta: 60000, muestra: conGolpe(12000), fix: trayecto((mono) => (mono < 12000 ? 60 : 35)) })
    verificar('golpe en marcha que sigue andando: se lo sigue sin pedir alerta', sigue.resumen(60000).siguiendoGolpe === true && !eventosSigue.some((e) => e.tipo === 'seguimiento'))
    const finSigue = manejar(sigue, { desde: 60000, hasta: 110000, fix: trayecto(() => 35) })
    verificar('con lecturas de 20 km/h o más hasta el final de los 90 s se descarta', !finSigue.some((e) => e.tipo === 'seguimiento') && sigue.resumen(110000).siguiendoGolpe === false)

    const pozo = crearDetector(opcionesDetector)
    manejar(pozo, { desde: 1000, hasta: 30000, muestra: conGolpe(12000), fix: trayecto(() => 60) })
    verificar('un golpe en marcha que no le quitó velocidad al auto (un pozo) no se sigue', pozo.resumen(30000).siguiendoGolpe === false)

    const sinDatos = crearDetector(opcionesDetector)
    manejar(sinDatos, { desde: 1000, hasta: 25000, muestra: conGolpe(12000), fix: trayecto((mono) => (mono < 12000 ? 60 : 35)) })
    const porGps = sinDatos.gpsSinDatos(25000, pared(25000))
    verificar('si el GPS se queda sin datos durante el seguimiento, pide la alerta', porGps.length === 1 && porGps[0].tipo === 'seguimiento' && porGps[0].motivo === 'gps')

    const conHueco = crearDetector(opcionesDetector)
    manejar(conHueco, { desde: 1000, hasta: 13000, muestra: conGolpe(12000), fix: trayecto(() => 50) })
    const alHueco = conHueco.hueco(13000, pared(13000))
    verificar(
      'un hueco cierra el episodio abierto sin velocidades y vacía los buffers',
      alHueco.length === 1 && alHueco[0].tipo === 'episodio' && alHueco[0].episodio.velocidades.length === 0 && conHueco.lecturas().length === 0 && conHueco.resumen(13000).gVivo === null,
      JSON.stringify(alHueco.map((e) => e.tipo)),
    )

    const suspendido = crearDetector(opcionesDetector)
    manejar(suspendido, { desde: 1000, hasta: 5000, muestra: conGolpe(4500) })
    const tras = suspendido.avanzar(6000, pared(6000) + 30000)
    verificar('|Δpared − Δmono| > 1 s entre dos latidos es un hueco', tras.length === 1 && tras[0].tipo === 'episodio' && suspendido.lecturas().length === 0)

    const descartado = crearDetector(opcionesDetector)
    manejar(descartado, { desde: 1000, hasta: 5000, muestra: conGolpe(4500) })
    descartado.descartarAbiertos()
    verificar('descartarAbiertos no deja nada por evaluar', episodios(manejar(descartado, { desde: 5000, hasta: 20000 })).length === 0)

    const brusca = crearDetector(opcionesDetector)
    const eventosBrusca = manejar(brusca, { desde: 1000, hasta: 40000, fix: trayecto((mono) => (mono < 20000 ? 50 : 0)) })
    const caida = episodios(eventosBrusca)[0]
    verificar(
      'disparador (b): una caída de 50 a 0 en un segundo abre un episodio de caída de velocidad',
      caida?.episodio.disparador === 'caida_velocidad' && caida.veredicto.caida.bajas >= 3 && caida.veredicto.caida.detencionConfirmada && caida.veredicto.nivel === 'nada',
      JSON.stringify(caida?.veredicto.caida),
    )
    const normal = crearDetector(opcionesDetector)
    const eventosNormal = manejar(normal, { desde: 1000, hasta: 40000, fix: trayecto((mono) => (mono < 16000 ? 50 : Math.max(0, 50 - ((mono - 16000) / 1000) * 10))) })
    verificar('una detención normal (10 km/h por segundo) no dispara (b)', episodios(eventosNormal).length === 0)

    const andando = crearDetector(opcionesDetector)
    manejar(andando, { desde: 1000, hasta: 20000, fix: trayecto(() => 50) })
    const resumen = andando.resumen(20000)
    verificar('resumen: velocidad y precisión del último fix, y en movimiento', Math.abs(resumen.velocidadKmh - 50) < 1e-9 && resumen.precisionM === 5 && resumen.ultimoFixMono === 19000 && resumen.enMovimiento === true, JSON.stringify(resumen))
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V3 npx tsx scripts/prueba-viaje.mjs`

Expected: las 17 anteriores en `ok`, `  ok   el episodio sigue abierto hasta ventanaPostMs después de la última muestra fuerte` (todavía no se emite ninguno) y después

```
  FALLA un golpe sostenido sin GPS da un episodio sospecha (fila 7) undefined
  FALLA [V3] terminó sin excepciones TypeError: Cannot read properties of undefined (reading 'episodio')
```

con `18/20 verificaciones pasaron` y `2 FALLARON`.

- [ ] **Step 3: Episodios, disparador (b), huecos y seguimiento**

En `lib/conduccion.ts`, reemplazá desde la línea

```ts
/** §2.2: un buffer por tiempo, no por cantidad. Alcanza para el episodio más largo (2 s antes + 15 s + 8 s). */
```

hasta el final del archivo (las constantes, `MuestraProcesada` y el `crearDetector` de la Tarea 4) por:

```ts
/** §2.2: un buffer por tiempo, no por cantidad. Alcanza para el episodio más largo (2 s antes + 15 s + 8 s). */
const MS_BUFFER_ACELERACION = 30_000
/** Velocidades para la previa de un episodio, el seguimiento y la media de 60 s de la inactividad. */
const MS_BUFFER_VELOCIDAD = 120_000
/** τ del filtro de gravedad con la fuente derivada (§2.2). */
const TAU_GRAVEDAD_S = 1
/** ĝ promediado sobre 2 s para separar lo lateral de lo longitudinal (§2.7). */
const TAU_GRAVEDAD_LENTA_S = 2
/** Pasa-bajos de la horizontal: una frenada vive debajo de 2 Hz y la ruta vibra arriba. */
const TAU_HORIZONTAL_S = 1 / (2 * Math.PI * 2)
/** Dos muestras más juntas que esto redondean al mismo t en el transporte: la segunda se ignora. */
const MS_ENTRE_MUESTRAS = 0.2
const MS_ANTES_GOLPE = 2000
const MS_ANTES_CAIDA = 6000
const MS_VELOCIDADES_ANTES = 10_000
/** El disparador (b) exige que la caída desde velocidadPreviaCaidaKmh haya ocurrido en este lapso: una detención normal lleva más. */
const MS_VENTANA_CAIDA = 2500
/** detencionConfirmada necesita fixes durante 5 s después del cruce. */
const MS_DETENCION_CAIDA = 7000
const MS_ENTRE_CAIDAS = 20_000
const MS_SEGUIMIENTO = 90_000
const MS_DETENIDO_SEGUIMIENTO = 10_000
const KMH_SIGUE_ANDANDO = 20
/** km/h que un golpe en marcha tiene que llevarse para seguirlo: un pozo no le quita velocidad al auto. */
const KMH_PERDIDA_SEGUIMIENTO = 10
const MS_HUECO = 1000
const MS_VIGENCIA = 5000

interface MuestraProcesada {
  lectura: Lectura
  /** |a| lineal en g. */
  g: number
  horizontal: MuestraHorizontal
}

interface EpisodioAbierto {
  disparador: 'golpe' | 'caida_velocidad'
  disparoMono: number
  /** Par de relojes capturado al detectarlo: ocurrido_en no depende de cuándo se evalúe. */
  par: { mono: number; pared: number }
  /** Con el golpe, la última muestra ≥ sospechaG dentro del tope; con la caída, el cruce. */
  ultimaFuerteMono: number
}

interface Seguimiento {
  golpeMono: number
  evento: { disparoMono: number; ocurridoEn: number; episodio: EpisodioImpacto; veredicto: Veredicto }
}

export function crearDetector(opcionesIniciales: OpcionesDetector): Detector {
  let opciones = opcionesIniciales

  let fuente: FuenteAceleracion = 'confiable'
  let gravedadDerivada: Vector | null = null
  let convergidaDesde: number | null = null
  let gravedadLenta: Vector | null = null
  let horizontalFiltrada: Vector = [0, 0, 0]
  let ultimaT: number | null = null
  let muestras: MuestraProcesada[] = []

  let estimador = crearEstimador()
  let velocidades: LecturaVelocidad[] = []
  let ultimoFix: { mono: number; precisionM: number } | null = null

  let abierto: EpisodioAbierto | null = null
  let analizadoHasta = -Infinity
  let ultimoCierreGolpe = -Infinity
  let ultimaCaida = -Infinity
  let intervalosGolpe: Array<{ desde: number; hasta: number }> = []

  let seguimiento: Seguimiento | null = null
  let latido: { mono: number; pared: number } | null = null

  const convergida = (t: number) => fuente === 'confiable' || (convergidaDesde !== null && t - convergidaDesde >= 1000)

  function reiniciarFiltros() {
    gravedadDerivada = null
    convergidaDesde = null
    gravedadLenta = null
    horizontalFiltrada = [0, 0, 0]
  }

  /** §2.2. null si la muestra no trae con qué calcular la aceleración. */
  function procesar(m: MuestraMovimiento, dt: number): MuestraProcesada | null {
    const cero = m.a !== null && m.a[0] === 0 && m.a[1] === 0 && m.a[2] === 0 && m.aIG !== null && norma(m.aIG) > 0
    const confiable = m.giro !== null && m.a !== null && !cero
    const nueva: FuenteAceleracion = confiable ? 'confiable' : 'derivada'
    if (nueva !== fuente) {
      fuente = nueva
      reiniciarFiltros()
    }

    let lineal: Vector
    let gTotal: number | null = null
    let unitario: Vector | null = null
    if (confiable) {
      lineal = [...(m.a as Vector)]
      if (m.aIG !== null) {
        gTotal = norma(m.aIG) / GRAVEDAD_MS2
        const gravedad = resta(m.aIG, lineal)
        const n = norma(gravedad)
        // aIG − a tiene que medir cerca de 1 g; si no, el navegador mezcló marcos y no es la gravedad.
        if (n > 0.5 * GRAVEDAD_MS2) unitario = escalar(gravedad, 1 / n)
      }
    } else {
      // Chrome sin giróscopo calcula acceleration con τ = 1/60 s y se come el pulso de un choque: se deriva de aIG.
      if (m.aIG === null) return null
      gTotal = norma(m.aIG) / GRAVEDAD_MS2
      const alfa = TAU_GRAVEDAD_S / (TAU_GRAVEDAD_S + dt / 1000)
      if (gravedadDerivada === null) gravedadDerivada = [...m.aIG]
      else if (Math.abs(gTotal - 1) <= 0.15) gravedadDerivada = [0, 1, 2].map((k) => alfa * (gravedadDerivada as Vector)[k] + (1 - alfa) * (m.aIG as Vector)[k]) as Vector
      lineal = resta(m.aIG, gravedadDerivada)
      if (Math.abs(norma(gravedadDerivada) / GRAVEDAD_MS2 - 1) < 0.05) {
        if (convergidaDesde === null) convergidaDesde = m.t
      } else {
        convergidaDesde = null
      }
    }

    let h: number | null = null
    let omega: number | null = null
    if (unitario !== null && m.giro !== null) {
      const horizontal = resta(lineal, escalar(unitario, punto(lineal, unitario)))
      const beta = dt / 1000 / (TAU_HORIZONTAL_S + dt / 1000)
      horizontalFiltrada = [0, 1, 2].map((k) => horizontalFiltrada[k] + beta * (horizontal[k] / GRAVEDAD_MS2 - horizontalFiltrada[k])) as Vector
      h = norma(horizontalFiltrada)
      const gamma = dt / 1000 / (TAU_GRAVEDAD_LENTA_S + dt / 1000)
      const mezcla: Vector = gravedadLenta === null ? unitario : ([0, 1, 2].map((k) => (1 - gamma) * (gravedadLenta as Vector)[k] + gamma * (unitario as Vector)[k]) as Vector)
      gravedadLenta = escalar(mezcla, 1 / norma(mezcla))
      // rotationRate viene como [alpha (z), beta (x), gamma (y)]; el producto con ĝ es el giro alrededor de la vertical.
      const giroXYZ: Vector = [m.giro[1], m.giro[2], m.giro[0]]
      omega = (punto(giroXYZ, gravedadLenta) * Math.PI) / 180
    }

    return {
      lectura: { t: m.t, ax: lineal[0], ay: lineal[1], az: lineal[2], gTotal, giro: m.giro === null ? null : norma(m.giro), h },
      g: norma(lineal) / GRAVEDAD_MS2,
      horizontal: { t: m.t, h, omega },
    }
  }

  function cerrar(episodio: EpisodioAbierto, conVelocidad: boolean): EventoDetector {
    const u = opciones.umbrales
    const cierre = episodio.disparador === 'golpe' ? episodio.ultimaFuerteMono + u.ventanaPostMs : episodio.disparoMono + Math.max(u.ventanaPostMs, MS_DETENCION_CAIDA)
    const desde = episodio.disparoMono - (episodio.disparador === 'golpe' ? MS_ANTES_GOLPE : MS_ANTES_CAIDA)
    const serie = muestras.filter((p) => p.lectura.t >= desde && p.lectura.t <= cierre).map((p) => ({ ...p.lectura, t: p.lectura.t - episodio.disparoMono }))
    const tramo = conVelocidad
      ? velocidades
          .filter((v) => v.t >= episodio.disparoMono - MS_VELOCIDADES_ANTES && v.t <= cierre)
          .slice(-MAX_VELOCIDADES_EPISODIO)
          .map((v) => ({ t: v.t - episodio.disparoMono, kmh: v.kmh, precisionM: v.precisionM, x: v.x, y: v.y }))
      : []
    const duracionS = serie.length >= 2 ? (serie[serie.length - 1].t - serie[0].t) / 1000 : 0
    const crudo: EpisodioImpacto = {
      disparador: episodio.disparador,
      fuente,
      hzMedido: duracionS > 0 ? Math.round(((serie.length - 1) / duracionS) * 10) / 10 : 0,
      serie,
      velocidades: tramo,
    }
    // El teléfono evalúa exactamente lo que manda: recortado y redondeado como lo va a ver el servidor.
    const listo = redondearEpisodio(recortarEpisodio(crudo).episodio)
    const veredicto = evaluarEpisodio(listo, opciones)
    const tPico = episodio.disparoMono + (veredicto.msPico ?? 0)
    const ocurridoEn = episodio.par.pared - (episodio.par.mono - tPico)

    abierto = null
    if (episodio.disparador === 'golpe') {
      analizadoHasta = Math.max(analizadoHasta, cierre)
      ultimoCierreGolpe = cierre
      intervalosGolpe.push({ desde: episodio.disparoMono, hasta: episodio.ultimaFuerteMono })
      if (veredicto.silencioso === 'golpe_en_marcha' && seguimiento === null && perdioVelocidad(veredicto, tPico)) {
        seguimiento = { golpeMono: tPico, evento: { disparoMono: episodio.disparoMono, ocurridoEn, episodio: listo, veredicto } }
      }
    } else {
      ultimaCaida = episodio.disparoMono
    }
    return { tipo: 'episodio', disparoMono: episodio.disparoMono, ocurridoEn, episodio: listo, veredicto }
  }

  /**
   * Un pozo en marcha también cae en la fila 4, y seguirlo haría sonar la alerta en el próximo semáforo. Sólo se sigue
   * un golpe que se llevó velocidad: la mediana posterior quedó al menos KMH_PERDIDA_SEGUIMIENTO debajo de la previa.
   */
  function perdioVelocidad(veredicto: Veredicto, tPico: number): boolean {
    const previa = veredicto.señales?.previa ?? null
    const posteriores = velocidades.filter((v) => v.t >= tPico + 2000 && v.t <= tPico + opciones.umbrales.ventanaPostMs && esConfiable(v)) as VelocidadConfiable[]
    if (previa === null || posteriores.length < 2) return false
    return mediana(posteriores.slice(-3).map((v) => v.kmh)) <= previa - KMH_PERDIDA_SEGUIMIENTO
  }

  function pedirAlerta(motivo: 'detenido' | 'gps' | 'hueco'): EventoDetector[] {
    if (seguimiento === null) return []
    const { evento } = seguimiento
    seguimiento = null
    return [{ tipo: 'seguimiento', ...evento, motivo }]
  }

  /** §2.6: sólo se descarta con evidencia positiva de que siguió andando hasta el final de la ventana. */
  function avanzarSeguimiento(mono: number): EventoDetector[] {
    if (seguimiento === null) return []
    const u = opciones.umbrales
    if (mono - MS_DETENIDO_SEGUIMIENTO >= seguimiento.golpeMono && estaDetenido(velocidades, mono - MS_DETENIDO_SEGUIMIENTO, mono, u) === true) {
      return pedirAlerta('detenido')
    }
    const fin = seguimiento.golpeMono + MS_SEGUIMIENTO
    if (mono < fin) return []
    const finales = velocidades.filter((v) => v.t >= fin - MS_DETENIDO_SEGUIMIENTO && v.t <= fin && esConfiable(v)) as VelocidadConfiable[]
    const siguio = finales.length > 0 && finales[finales.length - 1].t >= fin - MS_VIGENCIA && finales.every((v) => v.kmh >= KMH_SIGUE_ANDANDO)
    if (siguio) {
      seguimiento = null
      return []
    }
    return pedirAlerta('gps')
  }

  function recortarBuffers(mono: number) {
    if (muestras.length > 0 && muestras[0].lectura.t < mono - MS_BUFFER_ACELERACION) {
      const desde = muestras.findIndex((p) => p.lectura.t >= mono - MS_BUFFER_ACELERACION)
      muestras = desde === -1 ? [] : muestras.slice(desde)
    }
    if (velocidades.length > 0 && velocidades[0].t < mono - MS_BUFFER_VELOCIDAD) {
      velocidades = velocidades.filter((v) => v.t >= mono - MS_BUFFER_VELOCIDAD)
    }
    intervalosGolpe = intervalosGolpe.filter((e) => e.hasta >= mono - MS_BUFFER_ACELERACION)
  }

  const detector: Detector = {
    muestra(m, pared) {
      if (ultimaT !== null && m.t < ultimaT + MS_ENTRE_MUESTRAS) return []
      const dt = ultimaT === null ? 1000 / 60 : Math.min(m.t - ultimaT, 200)
      ultimaT = m.t
      const procesada = procesar(m, dt)
      if (procesada === null) return []
      muestras.push(procesada)
      if (muestras.length % 600 === 0) recortarBuffers(m.t)

      const u = opciones.umbrales
      if (procesada.g < u.sospechaG) return []
      if (abierto?.disparador === 'golpe') {
        if (m.t < abierto.disparoMono + u.topeEpisodioMs) abierto.ultimaFuerteMono = m.t
      } else if (m.t > analizadoHasta && convergida(m.t)) {
        // Un golpe manda sobre una caída de velocidad abierta: el episodio pasa a ser de golpe.
        abierto = { disparador: 'golpe', disparoMono: m.t, par: { mono: m.t, pared }, ultimaFuerteMono: m.t }
      }
      return []
    },

    fix(f) {
      ultimoFix = { mono: f.llegadaMono, precisionM: f.precisionM }
      const lectura = estimador.agregar(f)
      if (lectura === null) return []
      velocidades.push(lectura)
      const u = opciones.umbrales
      if (abierto !== null || !esConfiable(lectura) || lectura.kmh > u.velocidadPosteriorKmh) return []
      if (lectura.t <= ultimoCierreGolpe + u.retrasoMaxMs || lectura.t < ultimaCaida + MS_ENTRE_CAIDAS) return []
      const previas = velocidades.filter((v) => v !== lectura && v.t >= lectura.t - MS_VENTANA_CAIDA && esConfiable(v)) as VelocidadConfiable[]
      const anterior = previas[previas.length - 1]
      if (anterior === undefined || anterior.kmh <= u.velocidadPosteriorKmh) return []
      if (Math.max(...previas.map((v) => v.kmh)) < u.velocidadPreviaCaidaKmh) return []
      abierto = { disparador: 'caida_velocidad', disparoMono: lectura.t, par: { mono: f.llegadaMono, pared: f.llegadaPared }, ultimaFuerteMono: lectura.t }
      return []
    },

    avanzar(mono, pared) {
      const eventos: EventoDetector[] = []
      if (latido !== null && Math.abs(pared - latido.pared - (mono - latido.mono)) > MS_HUECO) {
        eventos.push(...detector.hueco(mono, pared))
      }
      latido = { mono, pared }
      const u = opciones.umbrales
      if (abierto !== null) {
        const cierre = abierto.disparador === 'golpe' ? abierto.ultimaFuerteMono + u.ventanaPostMs : abierto.disparoMono + Math.max(u.ventanaPostMs, MS_DETENCION_CAIDA)
        if (mono >= cierre) eventos.push(cerrar(abierto, true))
      }
      eventos.push(...avanzarSeguimiento(mono))

      recortarBuffers(mono)
      return eventos
    },

    hueco(mono, pared) {
      const eventos = pedirAlerta('hueco')
      if (abierto !== null) eventos.push(cerrar(abierto, false))
      muestras = []
      velocidades = []
      estimador = crearEstimador()
      ultimoFix = null
      ultimaT = null
      reiniciarFiltros()
      analizadoHasta = Math.max(analizadoHasta, mono)
      intervalosGolpe = []
      latido = { mono, pared }
      return eventos
    },

    gpsSinDatos() {
      return pedirAlerta('gps')
    },

    configurar(nuevas) {
      opciones = nuevas
    },

    descartarAbiertos() {
      abierto = null
      seguimiento = null
    },

    lecturas() {
      return velocidades
    },

    resumen(mono) {
      const ultima = muestras[muestras.length - 1]
      const recientes = muestras.filter((p) => p.lectura.t >= mono - 2000)
      const confiables = velocidades.filter((v) => esConfiable(v) && v.t >= mono - 60_000) as VelocidadConfiable[]
      const vigente = [...confiables].reverse().find((v) => v.t >= mono - MS_VIGENCIA)
      let enMovimiento: boolean | null = null
      if (confiables.length > 0) {
        enMovimiento = confiables.reduce((s, v) => s + v.kmh, 0) / confiables.length >= 5
      } else {
        const ultimos = muestras.filter((p) => p.lectura.t >= mono - 10_000)
        if (ultimos.length >= 30) {
          const media = ultimos.reduce((s, p) => s + p.g, 0) / ultimos.length
          const desvio = Math.sqrt(ultimos.reduce((s, p) => s + (p.g - media) ** 2, 0) / ultimos.length)
          enMovimiento = desvio >= 0.04
        }
      }
      return {
        fuente,
        convergida: ultima === undefined ? fuente === 'confiable' : convergida(ultima.lectura.t),
        hzMedido: recientes.length >= 2 ? Math.round(((recientes.length - 1) / ((recientes[recientes.length - 1].lectura.t - recientes[0].lectura.t) / 1000)) * 10) / 10 : null,
        gVivo: ultima === undefined ? null : ultima.g,
        velocidadKmh: vigente === undefined ? null : vigente.kmh,
        precisionM: ultimoFix !== null && ultimoFix.mono >= mono - MS_VIGENCIA ? ultimoFix.precisionM : null,
        ultimoFixMono: ultimoFix === null ? null : ultimoFix.mono,
        enMovimiento,
        siguiendoGolpe: seguimiento !== null,
      }
    },
  }
  return detector
}
```

- [ ] **Step 4: Correr [V3] y verla pasar**

Run: `SECCION=V3 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras

```
  ok   y al quedar detenido 10 s pide abrir la alerta por seguimiento, con el mismo episodio
  ok   un golpe en marcha que no le quitó velocidad al auto (un pozo) no se sigue
  ok   disparador (b): una caída de 50 a 0 en un segundo abre un episodio de caída de velocidad
```

y `36/36 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; las dos pruebas con `Todo en orden.`.

- [ ] **Step 6: Commit**

```bash
git add "lib/conduccion.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Armar episodios que esperen la detención y seguir el golpe en marcha hasta que el auto pare

Un episodio cierra 8 s después de la última muestra fuerte, cuando el GPS atrasado ya pudo
mostrar si el auto quedó detenido, y se evalúa recortado y redondeado: exactamente lo que
recibe el servidor. Una caída de velocidad brusca sin golpe abre su propio episodio. Un hueco
cierra lo abierto sin velocidades y reinicia filtros y edades. Un golpe en marcha que se llevó
velocidad se sigue 90 s y pide la alerta si el auto queda quieto, si el GPS se pierde o si hay
un hueco; un pozo, que no le quita velocidad al auto, no se sigue.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `lib/conduccion.ts` — `detectarManiobras` y absorción (§2.7)

**Files:**
- Modify: `lib/conduccion.ts` — antes de la línea `/* ---------- Detector (§2.2, §2.3, §2.6) ---------- */`; dentro de `crearDetector`: la declaración `let seguimiento: Seguimiento | null = null`, el final de `avanzar` y el reinicio de `hueco`.
- Test: `scripts/prueba-viaje.mjs`, dentro de `[V3]`.

**Interfaces:**
- Consumes: `Maniobra`, `MuestraHorizontal` (Tarea 4), `KMH_POR_S_POR_G` de `lib/impacto.ts`, los intervalos de golpe que ya guarda `cerrar` (Tarea 5).
- Produces (índice):
  - `export interface EntradaManiobras { muestras; lecturas; episodios; ultimoPorTipo; desdeMono; hastaMono; ahora }`
  - `export function detectarManiobras(entrada: EntradaManiobras, umbrales: Umbrales): Maniobra[]`
  - `avanzar` emite `{ tipo: 'maniobra', maniobra }` una sola vez por maniobra, con enfriamiento de 10 s por tipo y absorción por episodios de golpe. F3 las lleva a la cola de conducción.

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, dentro de `[V3]`, agregá este bloque al final (antes del `})` que cierra `[V3]`, con una línea vacía antes):

```js
  /* ---- detectarManiobras (§2.7) ---- */
  {
    const { detectarManiobras, crearDetector } = await import('../lib/conduccion.ts')
    const muestrasCon = (h, omega = () => 0) => Array.from({ length: 1200 }, (_, i) => ({ t: (i * 1000) / 60, h: h((i * 1000) / 60), omega: omega((i * 1000) / 60) }))
    const lecturasCon = (kmh) => Array.from({ length: 21 }, (_, s) => ({ t: s * 1000, kmh: kmh(s * 1000), precisionM: 5, x: 0, y: 0, origen: 'gps' }))
    const entrada = (muestras, lecturas, cambios = {}) => ({ muestras, lecturas, episodios: [], ultimoPorTipo: { frenada: -Infinity, aceleracion: -Infinity }, desdeMono: 0, hastaMono: 20000, ahora: { mono: 20000, pared: PARED + 20000 }, ...cambios })

    const frenando = muestrasCon((t) => (t >= 5000 && t <= 6300 ? 0.65 : 0.02))
    const de60a30 = lecturasCon((t) => (t <= 5000 ? 60 : t >= 6300 ? 30 : 60 - ((t - 5000) / 1300) * 30))
    const [frenada, ...otras] = detectarManiobras(entrada(frenando, de60a30), UMBRALES)
    verificar(
      'frenada de 0.65 g de 60 a 30: el acelerómetro la fecha y el GPS la clasifica',
      otras.length === 0 && frenada?.tipo === 'frenada' && frenada.ruta === 'acelerometro' && frenada.kmhInicial === 60 && frenada.kmhFinal === 30 && Math.abs(frenada.gEstimada - 0.65) < 0.01 && frenada.picoG === 0.65 && Math.abs(frenada.ocurridoEn - (PARED + 5000)) < 20 && Math.abs(frenada.duracionMs - 1300) < 20,
      JSON.stringify(frenada),
    )
    verificar('no se decide antes de tF + retrasoMaxMs + un fix', detectarManiobras(entrada(frenando, de60a30, { hastaMono: 10200 }), UMBRALES).length === 0)
    verificar('no se vuelve a informar una maniobra ya evaluada', detectarManiobras(entrada(frenando, de60a30, { desdeMono: 7000 }), UMBRALES).length === 0)
    verificar('un episodio de impacto cerca la absorbe', detectarManiobras(entrada(frenando, de60a30, { episodios: [{ desde: 5500, hasta: 5600 }] }), UMBRALES).length === 0)
    verificar('enfriamiento de 10 s por tipo', detectarManiobras(entrada(frenando, de60a30, { ultimoPorTipo: { frenada: 0, aceleracion: -Infinity } }), UMBRALES).length === 0)
    const suave = muestrasCon((t) => (t >= 5000 && t <= 9000 ? 0.35 : 0.02))
    verificar('una frenada de 0.35 g no se registra', detectarManiobras(entrada(suave, lecturasCon((t) => (t <= 5000 ? 50 : t >= 9000 ? 0 : 50 - ((t - 5000) / 4000) * 50))), UMBRALES).length === 0)
    const radS = (0.45 * G) / (30 / 3.6)
    const rotonda = detectarManiobras(entrada(muestrasCon((t) => (t >= 5000 && t <= 9000 ? 0.45 : 0.02), (t) => (t >= 5000 && t <= 9000 ? radS : 0)), lecturasCon(() => 30)), UMBRALES)
    verificar('en una rotonda la horizontal es lateral (v · ω) y no es una frenada', rotonda.length === 0, JSON.stringify(rotonda))
    const [acelerando] = detectarManiobras(entrada(muestrasCon((t) => (t >= 5000 && t <= 7000 ? 0.5 : 0.02)), lecturasCon((t) => (t <= 5000 ? 20 : t >= 7000 ? 50 : 20 + ((t - 5000) / 2000) * 30))), UMBRALES)
    verificar('una aceleración de 0.5 g de 20 a 50 se registra', acelerando?.tipo === 'aceleracion' && acelerando.kmhInicial === 20 && acelerando.kmhFinal === 50, JSON.stringify(acelerando))
    const soloGps = detectarManiobras(entrada(muestrasCon(() => null, () => null), lecturasCon((t) => (t <= 5000 ? 60 : t === 6000 ? 35 : t === 7000 ? 10 : 0))), UMBRALES)
    verificar('sin horizontal confiable, una frenada larga se ve sólo por GPS', soloGps.length === 1 && soloGps[0].ruta === 'gps' && soloGps[0].picoG === null && soloGps[0].kmhInicial === 60, JSON.stringify(soloGps))

    // El detector entero: una frenada horizontal de 0.65 g con el teléfono vertical y el GPS de 60 a 30.
    const detector = crearDetector(opcionesDetector)
    const frena = (t) => (t >= 10000 && t < 11300 ? 0.65 * G : 0)
    const eventos = manejar(detector, {
      desde: 1000,
      hasta: 25000,
      muestra: (t) => ({ t, a: [0, frena(t), 0.01], aIG: [0, frena(t), G + 0.01], giro: [0.5, 0.5, 0.5] }),
      fix: trayecto((mono) => (mono < 10000 ? 60 : mono >= 11300 ? 30 : 60 - ((mono - 10000) / 1300) * 30)),
    })
    const maniobras = eventos.filter((e) => e.tipo === 'maniobra')
    verificar('el detector emite la frenada una sola vez', maniobras.length === 1 && maniobras[0].maniobra.tipo === 'frenada', JSON.stringify(maniobras))
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V3 npx tsx scripts/prueba-viaje.mjs`

Expected: las 36 anteriores en `ok` y después

```
  FALLA [V3] terminó sin excepciones TypeError: detectarManiobras is not a function
```

con `36/37 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: `detectarManiobras`**

En `lib/conduccion.ts`, inmediatamente antes de la línea

```ts
/* ---------- Detector (§2.2, §2.3, §2.6) ---------- */
```

agregá (queda después de `export interface MuestraHorizontal`):

```ts
export interface EntradaManiobras {
  muestras: readonly MuestraHorizontal[]
  lecturas: readonly LecturaVelocidad[]
  /** Intervalos [desde, hasta] en mono de episodios de impacto, para la absorción (§2.7.5). */
  episodios: ReadonlyArray<{ desde: number; hasta: number }>
  /** Mono del último evento emitido por tipo (enfriamiento de 10 s); -Infinity si ninguno. */
  ultimoPorTipo: { frenada: number; aceleracion: number }
  /** No se informan maniobras con tF anterior a esto (ya evaluadas). */
  desdeMono: number
  /** Sólo se deciden maniobras con tF + retrasoMaxMs + 1 s ≤ hastaMono (un fix más para no caer entre dos). */
  hastaMono: number
  /** Par de relojes leído junto, para convertir tI a pared. */
  ahora: { mono: number; pared: number }
}

/** Un fix por segundo: la ventana posterior se estira uno para que el retraso máximo no quede entre dos fixes. */
const MS_FIX = 1000
const MS_MANIOBRA_MINIMA = 1000
const MS_ENFRIAMIENTO_MANIOBRA = 10_000
const KMH_MINIMA_FRENADA = 20
/** Sólo GPS: pendiente sobre unos 2 s, con un umbral más alto porque nada la corrobora. */
const G_FRENADA_SOLO_GPS = 0.55

const aDecimales = (valor: number, decimales: number): number => Math.round(valor * 10 ** decimales) / 10 ** decimales

/**
 * El extremo de las lecturas de la ventana: la mayor antes y la menor después. Con la mediana, un GPS con 1 a 3 s de
 * retraso mezcla lecturas de antes y de durante la maniobra y la frenada de 0.65 g se medía en 0.45 (banco de F2).
 */
function extremoEn(confiables: readonly VelocidadConfiable[], desde: number, hasta: number, extremo: (...valores: number[]) => number): number | null {
  const valores = confiables.filter((v) => v.t >= desde && v.t <= hasta).map((v) => v.kmh)
  return valores.length === 0 ? null : extremo(...valores)
}

/**
 * §2.7, puro. El acelerómetro fecha la maniobra y el GPS la clasifica: la horizontal no tiene signo (no se
 * sabe hacia dónde apunta el auto), y el GPS solo llega hasta 3 s tarde. La condición de GPS se exige siempre,
 * así que una rotonda (rumbo acumulado > 30°) queda cubierta sin una regla aparte.
 */
export function detectarManiobras(entrada: EntradaManiobras, umbrales: Umbrales): Maniobra[] {
  const { muestras, episodios, ahora, desdeMono, hastaMono } = entrada
  const confiables = entrada.lecturas.filter(esConfiable) as VelocidadConfiable[]
  const ultimo = { ...entrada.ultimoPorTipo }
  const maniobras: Maniobra[] = []
  const absorbida = (tI: number, tF: number) => episodios.some((e) => e.hasta >= tI - umbrales.retrasoMaxMs - 1000 && e.desde <= tF + umbrales.ventanaPostMs)
  const decidible = (tF: number) => tF >= desdeMono && tF + umbrales.retrasoMaxMs + MS_FIX <= hastaMono
  const aPared = (t: number) => ahora.pared - (ahora.mono - t)
  const emitir = (maniobra: Maniobra, tI: number) => {
    maniobras.push(maniobra)
    ultimo[maniobra.tipo] = tI
  }

  // Ruta del acelerómetro: candidato con aLon ≥ 0.8 · umbral durante ≥ 1 s.
  const umbralCandidato = 0.8 * Math.min(umbrales.frenadaG, umbrales.aceleracionG)
  let inicio = -1
  let integral = 0
  let pico = 0
  let j = 0
  for (let i = 0; i <= muestras.length; i++) {
    const m = muestras[i]
    let aLon: number | null = null
    if (m && m.h !== null) {
      while (j + 1 < confiables.length && confiables[j + 1].t <= m.t) j++
      const v = confiables.length > 0 && confiables[j].t <= m.t ? confiables[j].kmh / 3.6 : null
      // aLat ≈ v · ω: en una curva la horizontal es lateral y no dice nada de frenar.
      const aLat = v !== null && m.omega !== null ? (v * m.omega) / GRAVEDAD_MS2 : 0
      aLon = Math.sqrt(Math.max(0, m.h * m.h - aLat * aLat))
    }
    if (aLon !== null && aLon >= umbralCandidato) {
      if (inicio < 0) {
        inicio = i
        integral = 0
        pico = 0
      } else {
        integral += (aLon * (m.t - muestras[i - 1].t)) / 1000
      }
      pico = Math.max(pico, aLon)
      continue
    }
    if (inicio < 0) continue
    const tI = muestras[inicio].t
    const tF = muestras[i - 1].t
    inicio = -1
    if (tF - tI < MS_MANIOBRA_MINIMA || !decidible(tF) || absorbida(tI, tF)) continue
    const vAntes = extremoEn(confiables, tI - 1000, tI + umbrales.retrasoMaxMs, Math.max)
    const vDespues = extremoEn(confiables, tF + umbrales.retrasoMinMs, tF + umbrales.retrasoMaxMs + MS_FIX, Math.min)
    const minimoAntes = extremoEn(confiables, tI - 1000, tI + umbrales.retrasoMaxMs, Math.min)
    const maximoDespues = extremoEn(confiables, tF + umbrales.retrasoMinMs, tF + umbrales.retrasoMaxMs + MS_FIX, Math.max)
    if (vAntes === null || vDespues === null || minimoAntes === null || maximoDespues === null) continue
    const duracionMs = tF - tI
    // La magnitud es la media del acelerómetro: el GPS con 1 a 3 s de retraso y ±5 km/h de ruido la inventaba.
    const gAcelerometro = integral / (duracionMs / 1000)
    // El GPS decide hacia dónde fue y tiene que ver al menos la mitad del cambio que integró el acelerómetro.
    const cambio = 0.5 * integral * KMH_POR_S_POR_G
    let tipo: Maniobra['tipo'] | null = null
    let kmhInicial = 0
    let kmhFinal = 0
    if (vAntes - vDespues >= cambio && vAntes >= KMH_MINIMA_FRENADA && gAcelerometro >= umbrales.frenadaG) {
      tipo = 'frenada'
      kmhInicial = vAntes
      kmhFinal = vDespues
    } else if (maximoDespues - minimoAntes >= cambio && gAcelerometro >= umbrales.aceleracionG) {
      tipo = 'aceleracion'
      kmhInicial = minimoAntes
      kmhFinal = maximoDespues
    }
    if (tipo === null || tI - ultimo[tipo] < MS_ENFRIAMIENTO_MANIOBRA) continue
    emitir(
      { tipo, ocurridoEn: aPared(tI), kmhInicial: aDecimales(kmhInicial, 1), kmhFinal: aDecimales(kmhFinal, 1), duracionMs: Math.round(duracionMs), gEstimada: aDecimales(gAcelerometro, 3), picoG: aDecimales(pico, 3), ruta: 'acelerometro' },
      tI,
    )
  }

  // Ruta sólo GPS (sin giróscopo, ĝ inestable o sin acelerómetro): se aceptan sólo frenadas largas.
  for (let k = 0; k < confiables.length; k++) {
    const fin = confiables[k]
    let comienzo: VelocidadConfiable | undefined
    for (let i = k - 1; i >= 0 && comienzo === undefined; i--) {
      const dt = fin.t - confiables[i].t
      if (dt > 2600) break
      if (dt >= 1800) comienzo = confiables[i]
    }
    if (comienzo === undefined) continue
    const tI = comienzo.t
    const tF = fin.t
    if (!decidible(tF) || muestras.some((m) => m.h !== null && m.t >= tI && m.t <= tF)) continue
    const pendiente = (fin.kmh - comienzo.kmh) / ((tF - tI) / 1000)
    if (comienzo.kmh < KMH_MINIMA_FRENADA || pendiente > -G_FRENADA_SOLO_GPS * KMH_POR_S_POR_G) continue
    if (absorbida(tI, tF) || tI - ultimo.frenada < MS_ENFRIAMIENTO_MANIOBRA) continue
    emitir(
      { tipo: 'frenada', ocurridoEn: aPared(tI), kmhInicial: aDecimales(comienzo.kmh, 1), kmhFinal: aDecimales(fin.kmh, 1), duracionMs: Math.round(tF - tI), gEstimada: aDecimales(-pendiente / KMH_POR_S_POR_G, 3), picoG: null, ruta: 'gps' },
      tI,
    )
  }
  return maniobras.sort((a, b) => a.ocurridoEn - b.ocurridoEn)
}
```

- [ ] **Step 4: El detector corre las maniobras en cada latido**

En `lib/conduccion.ts`, reemplazá:

```ts
  let seguimiento: Seguimiento | null = null
```

por:

```ts
  let maniobrasDesde = -Infinity
  const ultimoPorTipo = { frenada: -Infinity, aceleracion: -Infinity }

  let seguimiento: Seguimiento | null = null
```

Reemplazá:

```ts
      eventos.push(...avanzarSeguimiento(mono))

      recortarBuffers(mono)
```

por:

```ts
      eventos.push(...avanzarSeguimiento(mono))

      const enCurso = abierto?.disparador === 'golpe' ? [{ desde: abierto.disparoMono, hasta: abierto.ultimaFuerteMono }] : []
      const maniobras = detectarManiobras(
        {
          muestras: muestras.map((p) => p.horizontal),
          lecturas: velocidades,
          episodios: [...intervalosGolpe, ...enCurso],
          ultimoPorTipo: { ...ultimoPorTipo },
          desdeMono: maniobrasDesde,
          hastaMono: mono,
          ahora: { mono, pared },
        },
        u,
      )
      maniobrasDesde = Math.max(maniobrasDesde, mono - u.retrasoMaxMs - MS_FIX)
      for (const maniobra of maniobras) {
        ultimoPorTipo[maniobra.tipo] = maniobra.ocurridoEn - pared + mono
        eventos.push({ tipo: 'maniobra', maniobra })
      }
      recortarBuffers(mono)
```

Y reemplazá:

```ts
      analizadoHasta = Math.max(analizadoHasta, mono)
```

por:

```ts
      analizadoHasta = Math.max(analizadoHasta, mono)
      maniobrasDesde = mono
```

- [ ] **Step 5: Correr [V3] y verla pasar**

Run: `SECCION=V3 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras

```
  ok   frenada de 0.65 g de 60 a 30: el acelerómetro la fecha y el GPS la clasifica
  ok   en una rotonda la horizontal es lateral (v · ω) y no es una frenada
  ok   el detector emite la frenada una sola vez
```

y `46/46 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 6: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; las dos pruebas con `Todo en orden.`.

- [ ] **Step 7: Commit**

```bash
git add "lib/conduccion.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Registrar frenadas y arranques bruscos sin confundirlos con una curva ni con un choque

El acelerómetro fecha la maniobra con la horizontal filtrada, quitándole lo lateral (v · ω)
para que una rotonda no cuente, y el GPS decide hacia dónde fue mirando la mayor velocidad
antes y la menor después, con margen para su retraso. La magnitud es la media del
acelerómetro: con la mediana del GPS una frenada de 0.65 g se medía en 0.45. Sin giróscopo
sólo se ven frenadas largas por GPS. Una maniobra dentro de un episodio de golpe se absorbe.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `scripts/banco-impacto.mjs` portado del anexo con PRNG de semilla fija

**Files:**
- Create: `scripts/banco-impacto.mjs`
- Test: `scripts/prueba-viaje.mjs`, sección nueva `[V4] Banco de simulación`.

**Interfaces:**
- Consumes: `crearDetector` (Tareas 4–6) importado como `'../lib/conduccion.ts'`; `UMBRALES` de `'../lib/impacto.ts'`.
- Produces (índice, «Banco de simulación»), módulo sin efectos al importarse:
  - `export function sembrar(semilla)`, `export function aleatorio()` (mulberry32 de `base.mts`; los tres `Math.random()` de `escenas.mts` pasan a `aleatorio()`)
  - `export const SENSORES`, `export const GPS_BASE`, `export const T0 = 20000`
  - `export const escenas = { sacudida, dosPozos, lomo, caidaSoporte, tironAcompanante, portazo, tirarAlAsiento, golpeConsola, crucero, urbano, choqueFrontal, choqueYDespedido, caidaLuegoChoque, trompo, vuelco, choqueQueRueda, rocePatina, choqueYFrenaSuave, choqueYSigue, alcanceTrasero, detencionBlanda, frenada, aceleracion, frenadaYDetencionBlanda, rotondaYParada, pulso }` con las firmas del índice
  - `export function sensar(escena, sensor, opciones)` → `MuestraMovimiento[]`; `export function generarGps(escena, gps)` → `FixGps[]`
  - `export function simular(escena, opciones)` → los `EventoDetector` de un ensayo (lo usa `correr` y la paridad de la Tarea 9)
  - `export function correr(fabricar, n, opciones)` → `{ n, conAlerta, tasaAlerta, golpesEnMarcha, caidasSilenciosas, frenadas, tasaFrenada, aceleraciones, tasaAceleracion, motivos }`

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, agregá esta sección inmediatamente antes de `/* ---------- Resultado ---------- */` (después del cierre de `[V3]`, con una línea vacía antes):

```js
await seccion('V4', 'Banco de simulación', async () => {
  const { isDeepStrictEqual } = await import('node:util')
  const banco = await import('./banco-impacto.mjs')
  const { sembrar, aleatorio, sensar, generarGps, simular, correr, escenas, SENSORES, GPS_BASE, T0 } = banco

  /* ---- El banco: semilla, sensor, GPS y un ensayo ---- */
  {
    sembrar(99)
    const primeros = [aleatorio(), aleatorio(), aleatorio()]
    sembrar(99)
    verificar('sembrar(99) repite la misma secuencia en [0, 1)', primeros.every((x) => x >= 0 && x < 1) && primeros.every((x) => x === aleatorio()))
    verificar('SENSORES y GPS_BASE son los del índice', SENSORES.g8.rango === 8 && SENSORES.g4.rango === 4 && SENSORES.g8.hz === 60 && GPS_BASE.lag === 2000 && GPS_BASE.periodo === 1000 && GPS_BASE.sinGps === false && T0 === 20000)

    sembrar(99)
    const escena = escenas.choqueFrontal(12, 55)
    const muestras = sensar(escena, SENSORES.g8)
    verificar(
      'sensar entrega DeviceMotionEvent a 60 Hz desde inicioMono',
      Math.abs(muestras.length - 34 * 60) <= 1 && muestras[0].t >= 1000 && muestras[0].t < 1017 && muestras.every((m) => m.a.length === 3 && m.aIG.length === 3 && m.giro.length === 3),
    )
    verificar('con derivada, rotationRate es null', sensar(escena, SENSORES.g8, { derivada: true }).every((m) => m.giro === null))
    const fixes = generarGps(escena, {})
    verificar('generarGps entrega un fix por segundo con la llegada 150 ms después', Math.abs(fixes.length - 34) <= 1 && fixes.every((f) => f.llegadaPared - f.adquiridoPared === 150 && f.llegadaMono >= 1000))
    const ios = generarGps(escenas.crucero(0), { ios: true })
    verificar('en modo iOS, quieto, coords.speed es null', ios.every((f) => f.velocidadMs === null))
    verificar('sin GPS no hay fixes', generarGps(escena, { sinGps: true }).length === 0)

    sembrar(99)
    const eventos = simular(escenas.choqueFrontal(12, 55))
    const choque = eventos.find((e) => e.tipo === 'episodio')
    verificar('simular: un choque de 12 g a 55 km/h pasa por el detector real y es confirmado', choque?.veredicto.nivel === 'confirmado', choque?.veredicto.motivo)

    sembrar(99)
    const a = correr(() => escenas.dosPozos(5000, 50), 3)
    sembrar(99)
    const b = correr(() => escenas.dosPozos(5000, 50), 3)
    verificar('correr con la misma semilla da el mismo resultado', JSON.stringify(a) === JSON.stringify(b) && a.n === 3 && typeof a.tasaAlerta === 'number', JSON.stringify(a))
  }
})
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V4 npx tsx scripts/prueba-viaje.mjs`

Expected: código 1 con

```
  FALLA [V4] terminó sin excepciones Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\banco-impacto.mjs' imported from C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\prueba-viaje.mjs
```

`0/1 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: Crear `scripts/banco-impacto.mjs`**

```js
/**
 * Banco de simulación del modo viaje, portado de docs/superpowers/specs/2026-09-16-modo-viaje-banco/.
 *
 * Señal continua a 1 kHz → soporte resonante → recorte del rango del sensor → pasa-bajos del HAL (25 Hz)
 * → muestreo a 60 Hz con fase al azar, como lo entrega DeviceMotionEvent. GPS a 1 Hz con retraso,
 * pasa-bajos, ruido, huecos y modo iOS. Todo pasa por el detector real (crearDetector de lib/conduccion.ts).
 *
 * Es un módulo: exporta y no corre nada. Lo usa scripts/prueba-viaje.mjs en [V2] (paridad) y [V4]. Las cifras sirven
 * para comparar reglas y mostrar mecanismos: los modelos de soporte, pozo y retraso del GPS son supuestos,
 * no mediciones de campo.
 */
import { crearDetector } from '../lib/conduccion.ts'
import { UMBRALES } from '../lib/impacto.ts'

const G = 9.80665
const KMH_POR_S_POR_G = 35.30394
/** Instante del evento de cada escena, en ms desde su comienzo. */
export const T0 = 20000
const DURACION = 34000
const LAT0 = -34.6037
const LON0 = -58.3816
const METROS_POR_GRADO = 111320

/* ---------- Azar con semilla ---------- */

let semilla = 12345

/** PRNG mulberry32 con semilla (el de base.mts). Cada escena de [V4] siembra antes de correr: sembrar(99). */
export function sembrar(valor) {
  semilla = valor >>> 0 || 1
}

/** [0, 1). */
export function aleatorio() {
  semilla |= 0
  semilla = (semilla + 0x6d2b79f5) | 0
  let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

const uniforme = (a, b) => a + (b - a) * aleatorio()

function gauss() {
  let u = 0
  while (u === 0) u = aleatorio()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * aleatorio())
}

/* ---------- Escena continua ---------- */

class Escena {
  constructor(ms) {
    this.n = ms
    /** Aceleración del vehículo en su marco (x adelante, y izquierda, z arriba), en g. */
    this.av = [0, 1, 2].map(() => new Float64Array(ms))
    /** Aceleración extra en el marco del teléfono (la mano, golpes del teléfono), en g. */
    this.ad = [0, 1, 2].map(() => new Float64Array(ms))
    /** ≥ 0: caída libre con esa aceleración centrípeta en g; -1: no. */
    this.libre = new Float64Array(ms).fill(-1)
    /** Giro alrededor de la vertical del vehículo, °/s. */
    this.giro = new Float64Array(ms)
    /** Velocidad real, km/h. */
    this.v = new Float64Array(ms)
    this.enMarcha = new Float64Array(ms)
    this.montaje = { fn: 15, zeta: 0.2 }
  }

  semiseno(arreglo, t0, duracion, pico) {
    for (let i = Math.max(0, Math.floor(t0)); i < Math.min(this.n, t0 + duracion); i++) arreglo[i] += pico * Math.sin((Math.PI * (i - t0)) / duracion)
  }

  velocidadConstante(desde, hasta, kmh) {
    for (let i = Math.max(0, desde); i < Math.min(hasta, this.n); i++) {
      this.v[i] = kmh
      this.enMarcha[i] = kmh > 1 ? 1 : 0
    }
  }

  /** Perfil de velocidad con aceleración longitudinal coherente (rampa de 250 ms). Devuelve el ms en que termina. */
  cambioVelocidad(t0, v0, v1, gMax, hasta = this.n) {
    const signo = v1 > v0 ? 1 : -1
    let v = v0
    let a = 0
    let i = t0
    while (i < Math.min(this.n, hasta) && (signo > 0 ? v < v1 : v > v1)) {
      const resto = Math.abs(v1 - v)
      const objetivo = resto < gMax * KMH_POR_S_POR_G * 0.125 ? gMax * 0.3 : gMax
      a = Math.min(objetivo, a + gMax / 250)
      v += (signo * a * KMH_POR_S_POR_G) / 1000
      this.av[0][i] += signo * a
      this.v[i] = Math.max(0, signo > 0 ? Math.min(v, v1) : Math.max(v, v1))
      this.enMarcha[i] = this.v[i] > 1 ? 1 : 0
      i++
    }
    return i
  }
}

/* ---------- Sensor ---------- */

/** Rango del sensor en g, pasa-bajos del HAL en Hz y frecuencia de muestreo. */
export const SENSORES = { g8: { rango: 8, fcHal: 25, hz: 60 }, g4: { rango: 4, fcHal: 25, hz: 60 } }

function biquadPasaBajos(fc, fs) {
  const w0 = (2 * Math.PI * fc) / fs
  const q = Math.SQRT1_2
  const alfa = Math.sin(w0) / (2 * q)
  const c = Math.cos(w0)
  const a0 = 1 + alfa
  return { b0: (1 - c) / 2 / a0, b1: (1 - c) / a0, b2: (1 - c) / 2 / a0, a1: (-2 * c) / a0, a2: (1 - alfa) / a0 }
}

/** Vehículo → teléfono: soporte vertical mirando al conductor, con una perturbación al azar de ±20°. */
function rotacionSoporte(perturbacion = 20) {
  const base = [[0, -1, 0], [0, 0, 1], [-1, 0, 0]]
  const r = (x) => (x * Math.PI) / 180
  const a = r(uniforme(-perturbacion, perturbacion))
  const b = r(uniforme(-perturbacion, perturbacion))
  const c = r(uniforme(-perturbacion, perturbacion))
  const rx = [[1, 0, 0], [0, Math.cos(a), -Math.sin(a)], [0, Math.sin(a), Math.cos(a)]]
  const ry = [[Math.cos(b), 0, Math.sin(b)], [0, 1, 0], [-Math.sin(b), 0, Math.cos(b)]]
  const rz = [[Math.cos(c), -Math.sin(c), 0], [Math.sin(c), Math.cos(c), 0], [0, 0, 1]]
  const por = (m1, m2) => m1.map((fila) => m2[0].map((_, j) => fila.reduce((s, x, k) => s + x * m2[k][j], 0)))
  return por(por(por(rx, ry), rz), base)
}

const aplicar = (m, v) => m.map((fila) => fila[0] * v[0] + fila[1] * v[1] + fila[2] * v[2])

/**
 * Muestras como las entrega DeviceMotionEvent (MuestraMovimiento de lib/conduccion.ts), con t en ms desde el
 * comienzo de la escena más opciones.inicioMono (1000 por omisión). opciones.derivada: rotationRate null y
 * acceleration calculada con la fusión de Chromium (pasa-altos con τ = 1/60 s) desde accelerationIncludingGravity.
 */
export function sensar(escena, sensor, opciones = {}) {
  const { derivada = false, inicioMono = 1000 } = opciones
  const n = escena.n
  const rotacion = rotacionSoporte()

  // 1) Montaje (transmisibilidad de base) sobre la aceleración del vehículo, más la vibración de la ruta.
  const montada = [0, 1, 2].map(() => new Float64Array(n))
  const fases = [uniforme(0, 6.28), uniforme(0, 6.28)]
  for (let k = 0; k < 3; k++) {
    let z = 0
    let zp = 0
    const w = escena.montaje ? 2 * Math.PI * escena.montaje.fn : 0
    const zeta = escena.montaje?.zeta ?? 0
    for (let i = 0; i < n; i++) {
      let a = escena.av[k][i]
      if (escena.enMarcha[i]) {
        a += (k === 2 ? 0.05 * Math.sin((2 * Math.PI * 12 * i) / 1000 + fases[0]) + 0.03 * Math.sin((2 * Math.PI * 17 * i) / 1000 + fases[1]) : 0) + 0.1 * gauss()
      } else {
        a += 0.01 * gauss()
      }
      if (escena.montaje) {
        const zpp = -a * G - 2 * zeta * w * zp - w * w * z
        zp += zpp / 1000
        z += zp / 1000
        montada[k][i] = a + zpp / G
      } else {
        montada[k][i] = a
      }
    }
  }

  // 2) Fuerza específica en el marco del teléfono, caída libre, recorte del rango y pasa-bajos del HAL.
  const gravedadTelefono = aplicar(rotacion, [0, 0, 1])
  const fuerza = [0, 1, 2].map(() => new Float64Array(n))
  for (let i = 0; i < n; i++) {
    let v = aplicar(rotacion, [montada[0][i], montada[1][i], montada[2][i] + 1])
    if (escena.libre[i] >= 0) v = [escena.libre[i], 0, 0]
    for (let k = 0; k < 3; k++) fuerza[k][i] = Math.max(-sensor.rango, Math.min(sensor.rango, v[k] + escena.ad[k][i]))
  }
  const c = biquadPasaBajos(sensor.fcHal, 1000)
  for (let k = 0; k < 3; k++) {
    let x1 = fuerza[k][0]
    let x2 = fuerza[k][0]
    let y1 = fuerza[k][0]
    let y2 = fuerza[k][0]
    for (let i = 0; i < n; i++) {
      const x = fuerza[k][i]
      const y = c.b0 * x + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
      x2 = x1
      x1 = x
      y2 = y1
      y1 = y
      fuerza[k][i] = y
    }
  }

  // 3) Muestreo con fase al azar.
  const dt = 1000 / sensor.hz
  const fase = uniforme(0, dt)
  const alfaChromium = 1 / 60 / (1 / 60 + dt / 1000)
  let gravedadChromium = [...gravedadTelefono]
  const muestras = []
  for (let t = fase; t < n; t += dt) {
    const i = Math.floor(t)
    const f = [fuerza[0][i], fuerza[1][i], fuerza[2][i]]
    const aIG = f.map((x) => x * G)
    let a
    if (derivada) {
      gravedadChromium = gravedadChromium.map((g, k) => alfaChromium * g + (1 - alfaChromium) * f[k])
      a = f.map((x, k) => (x - gravedadChromium[k]) * G)
    } else {
      a = f.map((x, k) => (x - gravedadTelefono[k]) * G)
    }
    let giro = null
    if (!derivada) {
      // El giro de la escena es alrededor de la vertical del vehículo: en el teléfono apunta como la gravedad.
      const dps = escena.giro[i] + Math.abs(gauss()) * 3
      const w = gravedadTelefono.map((x) => x * dps)
      giro = [w[2], w[0], w[1]]
    }
    muestras.push({ t: inicioMono + t, a, aIG, giro })
  }
  return muestras
}

/* ---------- GPS ---------- */

/** GPS de 1 Hz con fase aleatoria. lag y tau en ms, ruido en ± km/h, huecos y velocidadCeroEn como [desdeMs, hastaMs][]. */
export const GPS_BASE = { periodo: 1000, lag: 2000, tau: 500, ruido: 3, ios: false, rho: 0.9, sigmaPos: 3, huecos: [], velocidadCeroEn: [], desfaseRelojMs: 0, horaGnssCorridaMs: 0, sinGps: false }

/**
 * Fixes (FixGps de lib/conduccion.ts). llegadaMono con la misma base que sensar; llegadaPared = opciones.inicioPared
 * (Date.UTC(2026, 8, 16, 17, 30) por omisión) + t; adquiridoPared con el retraso, desfaseRelojMs y horaGnssCorridaMs.
 * En modo ios, velocidadMs null por debajo de 3 km/h y posiciones con ruido AR(1).
 */
export function generarGps(escena, gps) {
  const p = { ...GPS_BASE, ...gps }
  if (p.sinGps) return []
  const inicioMono = p.inicioMono ?? 1000
  const inicioPared = p.inicioPared ?? Date.UTC(2026, 8, 16, 17, 30)
  const n = escena.n
  const puro = Math.max(0, p.lag - p.tau)
  const filtrada = new Float64Array(n)
  const recorrido = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const vd = escena.v[Math.max(0, i - puro)]
    filtrada[i] = i === 0 ? vd : p.tau > 0 ? filtrada[i - 1] + (vd - filtrada[i - 1]) / p.tau : vd
    recorrido[i] = (i ? recorrido[i - 1] : 0) + escena.v[Math.max(0, i - p.lag)] / 3.6 / 1000
  }
  const coseno = Math.cos((LAT0 * Math.PI) / 180)
  const fixes = []
  let nx = gauss() * p.sigmaPos
  let ny = gauss() * p.sigmaPos
  for (let tk = uniforme(0, p.periodo); tk < n; tk += p.periodo) {
    const i = Math.floor(tk)
    if (p.huecos.some(([a, b]) => tk >= a && tk < b)) continue
    nx = p.rho * nx + Math.sqrt(1 - p.rho * p.rho) * p.sigmaPos * gauss()
    ny = p.rho * ny + Math.sqrt(1 - p.rho * p.rho) * p.sigmaPos * gauss()
    const x = recorrido[i] + nx
    const y = ny
    let kmh = Math.max(0, filtrada[i] + uniforme(-p.ruido, p.ruido))
    if (p.ios && filtrada[i] < 3) kmh = null
    if (p.velocidadCeroEn.some(([a, b]) => tk >= a && tk < b)) kmh = 0
    const llegada = tk + 150
    fixes.push({
      lat: LAT0 + y / METROS_POR_GRADO,
      lon: LON0 + x / (METROS_POR_GRADO * coseno),
      precisionM: uniforme(4, 10),
      velocidadMs: kmh === null ? null : kmh / 3.6,
      adquiridoPared: inicioPared + tk - p.horaGnssCorridaMs,
      llegadaMono: inicioMono + llegada,
      llegadaPared: inicioPared + p.desfaseRelojMs + llegada,
    })
  }
  return fixes
}

/* ---------- Escenas ---------- */

function pozo(e, t, factor = 1) {
  e.semiseno(e.av[2], t, 30, -2.5 * factor)
  e.semiseno(e.av[2], t + 30, 35, 4.5 * factor)
  e.semiseno(e.av[2], t + 190, 30, -2 * factor)
  e.semiseno(e.av[2], t + 220, 35, 3.5 * factor)
}

/** Choque frontal desde v0 a 0 en 70–90 ms (la velocidad al chocar es la que traía la escena). */
function choque(e, t, pico, hastaKmh = 0) {
  const duracion = uniforme(70, 90)
  const v0 = e.v[Math.max(0, t - 1)]
  for (let i = t; i < Math.min(e.n, t + duracion); i++) {
    e.v[i] = v0 + (hastaKmh - v0) * ((i - t) / duracion)
    e.enMarcha[i] = 1
  }
  e.semiseno(e.av[0], t, duracion, -pico)
  for (let i = t; i < Math.min(e.n, t + 600); i++) e.giro[i] = 60
  return Math.ceil(t + duracion)
}

const nueva = (opciones = {}) => {
  const e = new Escena(opciones.duracionMs ?? DURACION)
  return e
}

/** Todas devuelven una Escena. El evento ocurre en T0 = 20000 ms. `opciones.duracionMs` alarga la escena (34000 por omisión). */
export const escenas = {
  // falsos positivos
  sacudida(frecuenciaHz, amplitudM, kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, e.n, kmh)
    e.montaje = null
    const gA = (amplitudM * (2 * Math.PI * frecuenciaHz) ** 2) / G
    const inicio = T0 - 1000
    const fin = T0 + 1500
    const irregular = Array.from({ length: 40 }, () => 1 + 0.15 * (aleatorio() * 2 - 1))
    for (let i = inicio; i < fin; i++) {
      const tt = (i - inicio) / 1000
      const envolvente = Math.min(1, (i - inicio) / 200, (fin - i) / 200)
      const ciclo = Math.floor(tt * frecuenciaHz)
      const x = gA * envolvente * irregular[ciclo % 40] * (Math.sin(2 * Math.PI * frecuenciaHz * tt) + 0.15 * Math.sin(4 * Math.PI * frecuenciaHz * tt))
      e.ad[0][i] += x
      e.ad[1][i] += 0.3 * x
      e.giro[i] = 150 + 100 * Math.abs(Math.sin(2 * Math.PI * frecuenciaHz * tt))
    }
    return e
  },
  dosPozos(separacionMs, kmh, factor = 1, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, e.n, kmh)
    e.montaje = { fn: 14, zeta: 0.15 }
    pozo(e, T0, factor)
    pozo(e, T0 + separacionMs, factor)
    return e
  },
  lomo(sueltoElSoporte, kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, e.n, kmh)
    e.montaje = sueltoElSoporte ? { fn: 8, zeta: 0.1 } : { fn: 14, zeta: 0.15 }
    for (const t of [T0, T0 + 330]) {
      e.semiseno(e.av[2], t, 160, 1.3)
      e.semiseno(e.av[2], t + 160, 160, -0.9)
    }
    if (sueltoElSoporte) {
      for (const t of [T0 + 60, T0 + 200, T0 + 390, T0 + 520]) e.semiseno(e.ad[Math.floor(uniforme(0, 3))], t, 15, uniforme(4, 6) * (aleatorio() < 0.5 ? -1 : 1))
    }
    return e
  },
  caidaSoporte(kmh, contraAlgoDuro, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, e.n, kmh)
    const centripeta = uniforme(0, 3)
    for (let i = T0 - 400; i < T0; i++) {
      e.libre[i] = centripeta
      e.giro[i] = 400
    }
    if (contraAlgoDuro) e.semiseno(e.ad[2], T0, 10, 15)
    else e.semiseno(e.ad[2], T0, 25, 8)
    e.semiseno(e.ad[0], T0 + 120, 20, 4)
    return e
  },
  /** El acompañante tira del teléfono: lo gira al agarrarlo y la sacudida decae. */
  tironAcompanante(kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, e.n, kmh)
    for (let i = T0 - 300; i < T0 + 600; i++) e.giro[i] = 420 * Math.exp(-Math.max(0, i - T0) / 300)
    for (let i = T0; i < T0 + 1500; i++) {
      const tt = (i - T0) / 1000
      e.ad[1][i] += 6 * Math.exp(-tt / 0.25) * Math.sin(2 * Math.PI * 4 * tt)
    }
    return e
  },
  portazo(enLaPuerta, opciones) {
    const e = nueva(opciones)
    e.montaje = { fn: 25, zeta: 0.1 }
    if (enLaPuerta) {
      e.semiseno(e.ad[0], T0, 12, 6)
      e.semiseno(e.ad[0], T0 + 12, 12, -3)
    } else {
      e.semiseno(e.av[1], T0, 15, 1.2)
    }
    return e
  },
  /** 5 g: al asiento; 12 g: a la consola. */
  tirarAlAsiento(picoG, opciones) {
    const e = nueva(opciones)
    e.montaje = null
    e.semiseno(e.ad[1], T0 - 550, 250, 2)
    const centripeta = uniforme(0.5, 3)
    for (let i = T0 - 300; i < T0; i++) {
      e.libre[i] = centripeta
      e.giro[i] = 700
    }
    e.semiseno(e.ad[2], T0, picoG >= 9 ? 20 : 60, picoG)
    e.semiseno(e.ad[2], T0 + 150, 40, 2)
    return e
  },
  /** La mano agarra el teléfono del soporte y lo golpea contra la consola. */
  golpeConsola(kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, e.n, kmh)
    for (let i = T0 - 400; i < T0; i++) e.giro[i] = 350
    e.semiseno(e.ad[1], T0 - 350, 250, 1.5)
    e.semiseno(e.ad[2], T0, 15, 10)
    return e
  },
  crucero(kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, e.n, kmh)
    return e
  },
  /** Ciudad: arrancar y frenar entre 0.15 y 0.35 g, esperas en semáforos y algún pozo. */
  urbano(minutos, opciones) {
    const ms = minutos * 60000
    const e = new Escena(ms)
    e.montaje = { fn: 14, zeta: 0.15 }
    let t = 2000
    while (t < ms - 60000) {
      const vmax = uniforme(30, 50)
      t = e.cambioVelocidad(t, 0, vmax, uniforme(0.15, 0.35))
      const tramo = uniforme(8000, 40000)
      e.velocidadConstante(t, t + tramo, vmax)
      if (aleatorio() < 0.3) pozo(e, Math.floor(t + tramo / 2), uniforme(0.5, 1))
      t = Math.floor(t + tramo)
      t = e.cambioVelocidad(t, vmax, 0, uniforme(0.15, 0.35))
      t += Math.floor(uniforme(5000, 40000))
    }
    return e
  },

  // choques
  /** opciones.msDesdeSemaforo (4000, 6000, 8000): arranca de 0 con 0.25 g ese tiempo antes. opciones.montaje { fn, zeta }. */
  choqueFrontal(picoG, kmh, opciones = {}) {
    const e = nueva(opciones)
    if (opciones.msDesdeSemaforo) {
      const fin = e.cambioVelocidad(T0 - opciones.msDesdeSemaforo, 0, kmh, 0.25, T0)
      e.velocidadConstante(fin, T0, kmh)
    } else {
      e.velocidadConstante(0, T0, kmh)
    }
    if (opciones.montaje) e.montaje = opciones.montaje
    choque(e, T0, picoG)
    return e
  },
  choqueYDespedido(picoG, kmh, msDespues, opciones) {
    const e = escenas.choqueFrontal(picoG, kmh, opciones)
    for (let i = T0 + msDespues - 300; i < T0 + msDespues; i++) e.libre[i] = 1
    e.semiseno(e.ad[2], T0 + msDespues, 10, 15)
    return e
  },
  caidaLuegoChoque(msSeparacion, picoG, kmh, opciones) {
    const e = nueva(opciones)
    const tc = T0 + msSeparacion
    e.velocidadConstante(0, tc, kmh)
    for (let i = T0 - 400; i < T0; i++) e.libre[i] = 0.5
    e.semiseno(e.ad[2], T0, 10, 15)
    choque(e, tc, picoG)
    return e
  },
  /** El auto patina girando y golpea de costado contra el cordón. */
  trompo(dps, kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0 - 1500, kmh)
    for (let i = T0 - 1500; i < T0; i++) {
      e.v[i] = kmh - (kmh * 0.4 * (i - T0 + 1500)) / 1500
      e.enMarcha[i] = 1
      e.giro[i] = dps
      e.av[1][i] += 0.6
    }
    e.semiseno(e.av[1], T0, 80, -6)
    const v0 = e.v[T0 - 1]
    for (let i = T0; i < T0 + 80; i++) e.v[i] = v0 * (1 - (i - T0) / 80)
    for (let i = T0; i < T0 + 800; i++) e.giro[i] = dps * (1 - (i - T0) / 800)
    return e
  },
  vuelco(opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0, 70)
    for (let i = T0; i < T0 + 500; i++) {
      e.av[1][i] += 0.8
      e.v[i] = 70 - (15 * (i - T0)) / 500
      e.enMarcha[i] = 1
    }
    e.semiseno(e.av[1], T0 + 500, 60, -8)
    for (let i = T0 + 600; i < T0 + 900; i++) e.libre[i] = 1.2
    e.semiseno(e.av[2], T0 + 1000, 50, 10)
    e.semiseno(e.av[2], T0 + 1600, 50, -7)
    e.semiseno(e.av[1], T0 + 2200, 50, 6)
    e.semiseno(e.av[2], T0 + 2700, 50, 5)
    for (let i = T0 + 500; i < T0 + 2800; i++) {
      e.v[i] = 55 * (1 - (i - T0 - 500) / 2300)
      e.enMarcha[i] = 1
      e.giro[i] = 350
    }
    return e
  },
  choqueQueRueda(picoG, kmh, kmhRodando, msRodando, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0, kmh)
    const fin = choque(e, T0, picoG, kmhRodando)
    e.velocidadConstante(fin, fin + msRodando, kmhRodando)
    e.cambioVelocidad(fin + msRodando, kmhRodando, 0, 0.3)
    return e
  },
  /** Roce de costado y el auto patina hasta detenerse. */
  rocePatina(kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0, kmh)
    e.semiseno(e.av[1], T0, 150, 6)
    for (let i = T0; i < T0 + 150; i++) e.enMarcha[i] = 1
    e.velocidadConstante(T0, T0 + 150, kmh)
    e.cambioVelocidad(T0 + 150, kmh, 0, 0.7)
    for (let i = T0; i < T0 + 1500; i++) e.giro[i] = 90
    return e
  },
  /** 60→35 en el choque y después rueda frenando a gRodado hasta quedar quieto: alerta por seguimiento. */
  choqueYFrenaSuave(picoG, kmhAntes, kmhDespues, gRodado, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0, kmhAntes)
    const fin = choque(e, T0, picoG, kmhDespues)
    e.cambioVelocidad(fin, kmhDespues, 0, gRodado)
    return e
  },
  /** 60→35 en el choque y sigue a 35: golpe_en_marcha; opciones.detenerseEnMs para el motor. */
  choqueYSigue(picoG, kmhAntes, kmhDespues, opciones = {}) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0, kmhAntes)
    const fin = choque(e, T0, picoG, kmhDespues)
    const hasta = opciones.detenerseEnMs ?? e.n
    e.velocidadConstante(fin, hasta, kmhDespues)
    if (hasta < e.n) e.cambioVelocidad(hasta, kmhDespues, 0, 0.3)
    return e
  },
  alcanceTrasero(conElAutoDetenido, opciones) {
    const e = nueva(opciones)
    if (conElAutoDetenido) {
      e.semiseno(e.av[0], T0, 120, 3)
      for (let i = T0; i < T0 + 120; i++) e.v[i] = (7 * (i - T0)) / 120
      e.cambioVelocidad(T0 + 120, 7, 0, 0.5)
    } else {
      e.velocidadConstante(0, T0, 20)
      e.semiseno(e.av[0], T0, 110, -3.5)
      for (let i = T0; i < T0 + 110; i++) e.v[i] = 20 * (1 - (i - T0) / 110)
    }
    return e
  },

  // caída sin golpe y maniobras
  /** El auto se detiene a g sin golpe que dispare (lo frena algo blando). */
  detencionBlanda(g, kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0, kmh)
    e.cambioVelocidad(T0, kmh, 0, g)
    return e
  },
  frenada(g, kmhAntes, kmhDespues, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0 - 1000, kmhAntes)
    const fin = e.cambioVelocidad(T0 - 1000, kmhAntes, kmhDespues, g)
    if (kmhDespues > 0) e.velocidadConstante(fin, e.n, kmhDespues)
    return e
  },
  aceleracion(g, kmhAntes, kmhDespues, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0 - 1000, kmhAntes)
    const fin = e.cambioVelocidad(T0 - 1000, kmhAntes, kmhDespues, g)
    e.velocidadConstante(fin, e.n, kmhDespues)
    return e
  },
  frenadaYDetencionBlanda(gFrenada, gDetencion, kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0 - 3000, kmh)
    const fin = e.cambioVelocidad(T0 - 3000, kmh, kmh / 2, gFrenada)
    e.velocidadConstante(fin, T0, kmh / 2)
    e.cambioVelocidad(T0, kmh / 2, 0, gDetencion)
    return e
  },
  /** Rotonda con aceleración lateral gLateral durante 4 s y después una detención normal a 0.25 g. */
  rotondaYParada(gLateral, kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, e.n, kmh)
    const dps = ((gLateral * G) / (kmh / 3.6)) * (180 / Math.PI)
    for (let i = T0 - 4000; i < T0; i++) {
      const rampa = Math.min(1, (i - T0 + 4000) / 300, (T0 - i) / 300)
      e.av[1][i] += gLateral * rampa
      e.giro[i] = dps * rampa
    }
    e.velocidadConstante(T0 + 1000, e.n, 0)
    e.cambioVelocidad(T0 + 1000, kmh, 0, 0.25)
    return e
  },

  // fuente derivada
  /** Un pulso de picoG que dura ms y deja el auto quieto: con correr({ derivada: true }) prueba la fuente derivada. */
  pulso(picoG, ms, kmh, opciones) {
    const e = nueva(opciones)
    e.velocidadConstante(0, T0, kmh)
    e.semiseno(e.av[0], T0, ms, -picoG)
    for (let i = T0; i < T0 + ms; i++) {
      e.v[i] = kmh * (1 - (i - T0) / ms)
      e.enMarcha[i] = 1
    }
    return e
  },
}

/**
 * Un ensayo sobre una escena ya fabricada, con las mismas opciones que correr: devuelve los EventoDetector en orden.
 * Lo usan correr y las pruebas que necesitan mirar un episodio (la paridad con el servidor).
 */
export function simular(escena, opciones = {}) {
  const { sensor = SENSORES.g8, gps = {}, derivada = false, umbrales = UMBRALES, caidaSinGolpe = 'silenciosa', suspensiones = [], fixEnCacheMs = null } = opciones
  const inicioMono = 1000
  const inicioPared = Date.UTC(2026, 8, 16, 17, 30)
  const salto = (mono) => suspensiones.reduce((suma, s) => (mono - inicioMono >= s.enMs ? suma + s.ms : suma), 0)
  const muestras = sensar(escena, sensor, { derivada, inicioMono })
  const fixes = generarGps(escena, { ...gps, inicioMono, inicioPared })
  for (const f of fixes) {
    const s = salto(f.llegadaMono)
    f.adquiridoPared += s
    f.llegadaPared += s
  }
  if (fixEnCacheMs !== null && suspensiones.length > 0) {
    const regreso = inicioMono + suspensiones[0].enMs
    const indice = fixes.findIndex((f) => f.llegadaMono >= regreso)
    const modelo = fixes[Math.max(0, indice - 1)]
    if (modelo) {
      const llegadaPared = inicioPared + (regreso + 1 - inicioMono) + salto(regreso + 1)
      fixes.splice(Math.max(0, indice), 0, { ...modelo, adquiridoPared: llegadaPared - fixEnCacheMs, llegadaMono: regreso + 1, llegadaPared })
    }
  }

  const detector = crearDetector({ umbrales, caidaSinGolpe })
  const eventos = []
  const fin = inicioMono + escena.n + 10000
  let i = 0
  let j = 0
  for (let latido = inicioMono + 1000; latido <= fin; latido += 1000) {
    while (true) {
      const tm = i < muestras.length ? muestras[i].t : Infinity
      const tf = j < fixes.length ? fixes[j].llegadaMono : Infinity
      if (Math.min(tm, tf) > latido) break
      if (tm <= tf) {
        eventos.push(...detector.muestra(muestras[i], inicioPared + (tm - inicioMono) + salto(tm)))
        i++
      } else {
        eventos.push(...detector.fix(fixes[j]))
        j++
      }
    }
    eventos.push(...detector.avanzar(latido, inicioPared + (latido - inicioMono) + salto(latido)))
  }
  return eventos
}

/**
 * n ensayos: fabricar(), sensar, generarGps, y todo al detector en orden de tiempo, con avanzar(mono, pared) cada
 * 1000 ms. opciones: { sensor = SENSORES.g8, gps = {}, derivada = false, umbrales = UMBRALES, caidaSinGolpe = 'silenciosa',
 * suspensiones = [] ({ enMs, ms }: mono no avanza y pared sí, sin muestras ni fixes), fixEnCacheMs = null (al salir de
 * la primera suspensión llega un fix con adquiridoPared de hace fixEnCacheMs) }.
 * Un ensayo tiene alerta si el detector emitió un 'episodio' con nivel distinto de 'nada' o un 'seguimiento'.
 *
 * → { n, conAlerta, tasaAlerta, golpesEnMarcha, caidasSilenciosas, frenadas, tasaFrenada, aceleraciones, tasaAceleracion, motivos }
 *   golpesEnMarcha y caidasSilenciosas: fracción de ensayos con ese evento silencioso. frenadas y aceleraciones: cantidad
 *   total de eventos; tasaFrenada y tasaAceleracion: fracción de ensayos con al menos uno.
 *   motivos: { '<nivel>:<motivo>': cantidad } del primer episodio de cada ensayo ('sin episodio' si no hubo).
 */
export function correr(fabricar, n, opciones = {}) {
  const { sensor = SENSORES.g8, gps = {}, derivada = false, umbrales = UMBRALES, caidaSinGolpe = 'silenciosa', suspensiones = [], fixEnCacheMs = null } = opciones
  const resultado = { n, conAlerta: 0, tasaAlerta: 0, golpesEnMarcha: 0, caidasSilenciosas: 0, frenadas: 0, tasaFrenada: 0, aceleraciones: 0, tasaAceleracion: 0, motivos: {} }
  let conGolpe = 0
  let conCaida = 0
  let conFrenada = 0
  let conAceleracion = 0

  for (let ensayo = 0; ensayo < n; ensayo++) {
    const escena = fabricar()
    const eventos = simular(escena, { sensor, gps, derivada, umbrales, caidaSinGolpe, suspensiones, fixEnCacheMs })

    const episodios = eventos.filter((e) => e.tipo === 'episodio')
    if (eventos.some((e) => (e.tipo === 'episodio' && e.veredicto.nivel !== 'nada') || e.tipo === 'seguimiento')) resultado.conAlerta++
    if (episodios.some((e) => e.veredicto.silencioso === 'golpe_en_marcha')) conGolpe++
    if (episodios.some((e) => e.veredicto.silencioso === 'caida_silenciosa')) conCaida++
    const frenadas = eventos.filter((e) => e.tipo === 'maniobra' && e.maniobra.tipo === 'frenada').length
    const aceleraciones = eventos.filter((e) => e.tipo === 'maniobra' && e.maniobra.tipo === 'aceleracion').length
    resultado.frenadas += frenadas
    resultado.aceleraciones += aceleraciones
    if (frenadas > 0) conFrenada++
    if (aceleraciones > 0) conAceleracion++
    const clave = episodios.length === 0 ? 'sin episodio' : `${episodios[0].veredicto.nivel}:${episodios[0].veredicto.motivo}`
    resultado.motivos[clave] = (resultado.motivos[clave] ?? 0) + 1
  }

  resultado.tasaAlerta = resultado.conAlerta / n
  resultado.golpesEnMarcha = conGolpe / n
  resultado.caidasSilenciosas = conCaida / n
  resultado.tasaFrenada = conFrenada / n
  resultado.tasaAceleracion = conAceleracion / n
  return resultado
}
```

- [ ] **Step 4: Correr [V4] y verla pasar**

Run: `SECCION=V4 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras

```
  ok   sembrar(99) repite la misma secuencia en [0, 1)
  ok   simular: un choque de 12 g a 55 km/h pasa por el detector real y es confirmado
```

y `9/9 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida (el banco es `.mjs`: `tsc` no lo mira); las dos pruebas con `Todo en orden.`.

- [ ] **Step 6: Commit**

```bash
git add "scripts/banco-impacto.mjs" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Portar el banco de simulación para medir el detector que corre en el teléfono

El banco del anexo pasa a scripts/banco-impacto.mjs, sin dependencias y con semilla fija: la
misma corrida da los mismos números. Genera la señal a 1 kHz con el soporte resonante, el
rango y el pasa-bajos del sensor, la muestrea como DeviceMotionEvent y arma el GPS con
retraso, ruido, huecos, modo iOS, relojes corridos y suspensiones. Cada ensayo pasa por
crearDetector, no por una copia de la lógica. Los modelos de soporte, pozo y retraso son
supuestos: las cifras sirven para comparar reglas, no son tasas de campo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: [V4] escenas obligatorias y tasas (§6.1)

**Files:**
- Test: `scripts/prueba-viaje.mjs`, dentro de `[V4]`.

**Interfaces:**
- Consumes: `sembrar`, `correr`, `escenas`, `SENSORES`, `T0` (Tarea 7); el detector completo (Tareas 2–6).
- Produces: las afirmaciones de tasas de «Pruebas: convenciones › Banco de simulación», con `N = Number(process.env.BANCO_N ?? (process.env.BANCO_COMPLETO === '1' ? 50 : 10))` y los mínimos medidos que explica «Desvíos».

Esta tarea no agrega código de producto: las reglas de las Tareas 2–6 ya se calibraron contra estas escenas mientras se escribía este plan (tabla abajo). Por eso el paso 2 pasa sin una falla previa. Si alguna fila falla, el problema está en el detector o en el banco, no en la prueba: no se afloja un mínimo para que pase.

- [ ] **Step 1: Escribir las escenas y sus tasas**

En `scripts/prueba-viaje.mjs`, dentro de `[V4]`, agregá este bloque al final (antes del `})` que cierra `[V4]`, con una línea vacía antes):

```js
  /* ---- Escenas obligatorias y tasas (§6.1) ---- */
  {
    const N = Number(process.env.BANCO_N ?? (process.env.BANCO_COMPLETO === '1' ? 50 : 10))
    if (N < 50) console.log(`  aviso BANCO_N=${N} es menor que 50: las tasas no valen como prueba`)
    const g4 = { sensor: SENSORES.g4 }
    const sinGps = { gps: { sinGps: true } }
    const conAlerta = { caidaSinGolpe: 'alerta' }
    const porcentaje = (x) => `${Math.round(x * 100)} %`
    const resumen = (r) => `alerta ${porcentaje(r.tasaAlerta)}; ${Object.entries(r.motivos).sort((x, y) => y[1] - x[1]).slice(0, 2).map(([m, c]) => `${m} ×${c}`).join(' | ')}`
    function tasa(nombre, fabricar, opciones, cumple, detalle = resumen) {
      sembrar(99)
      const r = correr(fabricar, N, opciones)
      verificar(nombre, cumple(r), detalle(r))
      return r
    }

    // Falsos positivos: alerta ≤ 2 % por escena.
    const falsos = [
      ['sacudida con la mano 4 Hz ±10 cm, estacionado, con GPS', () => escenas.sacudida(4, 0.1, 0), {}],
      ['dos pozos con soporte resonante a 35 km/h', () => escenas.dosPozos(5000, 35), {}],
      ['dos pozos con soporte resonante a 50 km/h, 1 s de separación', () => escenas.dosPozos(1000, 50), {}],
      ['lomo de burro con el soporte flojo', () => escenas.lomo(true, 30), {}],
      ['el teléfono se cae del soporte a 27 km/h', () => escenas.caidaSoporte(27, true), {}],
      ['el teléfono se cae del soporte a 50 km/h', () => escenas.caidaSoporte(50, false), {}],
      ['tirón del acompañante que decae', () => escenas.tironAcompanante(40), {}],
      ['portazo estacionado, teléfono en la puerta', () => escenas.portazo(true), {}],
      ['portazo estacionado', () => escenas.portazo(false), {}],
      ['tiro al asiento (5 g) con GPS', () => escenas.tirarAlAsiento(5), {}],
      ['tiro al asiento (5 g) sin GPS', () => escenas.tirarAlAsiento(5), sinGps],
      ['tiro a la consola (12 g) con GPS', () => escenas.tirarAlAsiento(12), {}],
      ['tiro a la consola (12 g) sin GPS', () => escenas.tirarAlAsiento(12), sinGps],
      ['golpe contra la consola a 27 km/h', () => escenas.golpeConsola(27), {}],
      ['velocidad 0 espuria 6 s a 60 km/h', () => escenas.crucero(60), { gps: { velocidadCeroEn: [[T0, T0 + 6000]] } }],
      ['los fixes dejan de llegar a 60 km/h', () => escenas.crucero(60), { gps: { huecos: [[T0, T0 + 10000]] } }],
      ['frenada con ABS de 1.0 g (caída sin golpe en alerta)', () => escenas.detencionBlanda(1.0, 60), conAlerta],
      ['frenada con ABS de 1.1 g (caída sin golpe en alerta)', () => escenas.detencionBlanda(1.1, 60), conAlerta],
    ]
    for (const [nombre, fabricar, opciones] of falsos) tasa(`falso positivo ≤ 2 %: ${nombre}`, fabricar, opciones, (r) => r.tasaAlerta <= 0.02)
    // Sin GPS la única defensa contra la mano es la periodicidad previa al pico (límite medido, ver el plan de F2).
    tasa('sacudida con la mano 5 Hz ±5 cm sin GPS ≤ 15 %', () => escenas.sacudida(5, 0.05, 0), sinGps, (r) => r.tasaAlerta <= 0.15)
    tasa('sacudida con la mano 4 Hz ±10 cm sin GPS ≤ 10 %', () => escenas.sacudida(4, 0.1, 0), sinGps, (r) => r.tasaAlerta <= 0.1)

    // Choques: alerta ≥ 95 % por escena.
    const choques = [
      ['12 g, 55 → 0', () => escenas.choqueFrontal(12, 55), {}],
      ['6 g, 55 → 0', () => escenas.choqueFrontal(6, 55), {}],
      ['crucero a 20 km/h', () => escenas.choqueFrontal(6, 20), {}],
      ['crucero a 25 km/h', () => escenas.choqueFrontal(6, 25), {}],
      ['50 → 0 con retraso de 3 s y τ 1.5 s', () => escenas.choqueFrontal(12, 50), { gps: { lag: 3000, tau: 1500 } }],
      ['iOS con ρ 0.8', () => escenas.choqueFrontal(12, 55), { gps: { ios: true, rho: 0.8 } }],
      ['sensor de ±4 g', () => escenas.choqueFrontal(6, 55), g4],
      ['soporte de 6 Hz ζ 0.05 con GPS', () => escenas.choqueFrontal(12, 55, { montaje: { fn: 6, zeta: 0.05 } }), {}],
      ['teléfono despedido por el choque', () => escenas.choqueYDespedido(12, 55, 1500), {}],
      ['cae del soporte y choca 2 s después', () => escenas.caidaLuegoChoque(2000, 6, 50), {}],
      ['cae del soporte y choca 4 s después', () => escenas.caidaLuegoChoque(4000, 6, 50), {}],
      ['cae del soporte y choca 6 s después', () => escenas.caidaLuegoChoque(6000, 6, 50), {}],
      ['trompo de 350 °/s con 60 → 0', () => escenas.trompo(350, 60), {}],
      ['vuelco', () => escenas.vuelco(), {}],
      ['vuelco sin GPS', () => escenas.vuelco(), sinGps],
      ['sigue rodando 3 s a 12 km/h', () => escenas.choqueQueRueda(12, 55, 12, 3000), {}],
      ['roce a 100 km/h que patina a 0', () => escenas.rocePatina(100), {}],
      ['60 → 35 que rueda a 0.05 g hasta detenerse', () => escenas.choqueYFrenaSuave(8, 60, 35, 0.05, { duracionMs: 70000 }), {}],
      ['60 → 35 que sigue y se detiene a los 40 s (seguimiento)', () => escenas.choqueYSigue(8, 60, 35, { detenerseEnMs: T0 + 40000, duracionMs: 80000 }), {}],
      ['pulso de 10 g y 80 ms con la fuente derivada', () => escenas.pulso(10, 80, 50), { derivada: true }],
      ['detención blanda de 1.6 g (caída sin golpe en alerta)', () => escenas.detencionBlanda(1.6, 50), conAlerta],
      ['detención blanda de 2.5 g (caída sin golpe en alerta)', () => escenas.detencionBlanda(2.5, 50), conAlerta],
      ['frenada de 0.7 g seguida de detención blanda (caída sin golpe en alerta)', () => escenas.frenadaYDetencionBlanda(0.7, 2, 80), conAlerta],
    ]
    for (const [nombre, fabricar, opciones] of choques) tasa(`choque con alerta ≥ 95 %: ${nombre}`, fabricar, opciones, (r) => r.tasaAlerta >= 0.95)
    for (const [ms, lag, minimo] of [[4000, 0, 0.9], [4000, 1000, 0.9], [4000, 2000, 0.9], [6000, 0, 0.95], [6000, 1000, 0.95], [6000, 2000, 0.95], [8000, 0, 0.95], [8000, 1000, 0.95], [8000, 2000, 0.95]]) {
      tasa(`choque de 6 g a 40 km/h ${ms / 1000} s después del semáforo, retraso ${lag / 1000} s: alerta ≥ ${porcentaje(minimo)}`, () => escenas.choqueFrontal(6, 40, { msDesdeSemaforo: ms }), { gps: { lag, tau: lag === 0 ? 0 : 500 } }, (r) => r.tasaAlerta >= minimo)
    }
    tasa('choque con soporte de 6 Hz ζ 0.05 sin GPS: alerta ≥ 90 %', () => escenas.choqueFrontal(12, 55, { montaje: { fn: 6, zeta: 0.05 } }), sinGps, (r) => r.tasaAlerta >= 0.9)

    tasa('60 → 35 que sigue a 35: golpe_en_marcha ≥ 95 % y alerta ≤ 5 %', () => escenas.choqueYSigue(8, 60, 35), {}, (r) => r.golpesEnMarcha >= 0.95 && r.tasaAlerta <= 0.05)
    tasa('detención blanda de 2 g en silenciosa: caida_silenciosa y sin alerta', () => escenas.detencionBlanda(2, 50), {}, (r) => r.caidasSilenciosas >= 0.95 && r.tasaAlerta === 0)
    tasa('límite declarado: alcance trasero de 3 g con el auto detenido no alerta', () => escenas.alcanceTrasero(true), {}, (r) => r.tasaAlerta === 0)

    // Relojes: el mismo choque da el mismo resultado con el equipo suspendido o los relojes corridos.
    const niveles = (r) => Object.entries(r.motivos).reduce((cuenta, [motivo, n]) => ({ ...cuenta, [motivo.split(':')[0]]: (cuenta[motivo.split(':')[0]] ?? 0) + n }), {})
    const base = tasa('relojes: el choque de referencia alerta', () => escenas.choqueFrontal(12, 55), {}, (r) => r.tasaAlerta >= 0.95)
    for (const [nombre, opciones] of [
      ['suspensión de 25 s antes del choque', { suspensiones: [{ enMs: 5000, ms: 25000 }] }],
      ['suspensión de 60 s antes del choque', { suspensiones: [{ enMs: 5000, ms: 60000 }] }],
      ['suspensión de 120 s antes del choque', { suspensiones: [{ enMs: 5000, ms: 120000 }] }],
      ['hora GNSS corrida 8 s', { gps: { horaGnssCorridaMs: 8000 } }],
      ['reloj del equipo +300 s', { gps: { desfaseRelojMs: 300000 } }],
      ['fix en caché de 2 min al reanudar', { suspensiones: [{ enMs: 5000, ms: 60000 }], fixEnCacheMs: 120000 }],
    ]) {
      tasa(`relojes: ${nombre} da los mismos niveles`, () => escenas.choqueFrontal(12, 55), opciones, (r) => isDeepStrictEqual(niveles(r), niveles(base)), (r) => JSON.stringify(niveles(r)))
    }

    // Maniobras.
    const frenadas = [
      ['0.65 g 60 → 30 que sigue andando, retraso 0 s', () => escenas.frenada(0.65, 60, 30), { gps: { lag: 0, tau: 0 } }],
      ['0.65 g 60 → 30, retraso 1 s', () => escenas.frenada(0.65, 60, 30), { gps: { lag: 1000, tau: 500 } }],
      ['0.65 g 60 → 30, retraso 2 s', () => escenas.frenada(0.65, 60, 30), {}],
      ['0.65 g 60 → 30, retraso 3 s', () => escenas.frenada(0.65, 60, 30), { gps: { lag: 3000, tau: 500 } }],
      ['0.65 g 60 → 30, reloj del equipo +1 s', () => escenas.frenada(0.65, 60, 30), { gps: { desfaseRelojMs: 1000 } }],
      ['0.65 g 60 → 30, reloj del equipo −1 s', () => escenas.frenada(0.65, 60, 30), { gps: { desfaseRelojMs: -1000 } }],
      ['0.5 g 60 → 30', () => escenas.frenada(0.5, 60, 30), {}],
      ['0.8 g 60 → 0', () => escenas.frenada(0.8, 60, 0), {}],
      ['0.8 g 60 → 0 sin giróscopo (ruta sólo GPS)', () => escenas.frenada(0.8, 60, 0), { derivada: true }],
    ]
    for (const [nombre, fabricar, opciones] of frenadas) tasa(`frenada detectada ≥ 95 %: ${nombre}`, fabricar, opciones, (r) => r.tasaFrenada >= 0.95, (r) => `frenadas ${porcentaje(r.tasaFrenada)}`)
    for (const [nombre, fabricar, opciones] of [
      ['0.35 g 50 → 0 con ruido ±3', () => escenas.frenada(0.35, 50, 0), { gps: { ruido: 3 } }],
      ['0.35 g 50 → 0 con ruido ±5', () => escenas.frenada(0.35, 50, 0), { gps: { ruido: 5 } }],
      ['0.30 g 50 → 0 con ruido ±5', () => escenas.frenada(0.3, 50, 0), { gps: { ruido: 5 } }],
      ['0.40 g 50 → 0 con ruido ±5', () => escenas.frenada(0.4, 50, 0), { gps: { ruido: 5 } }],
      ['rotonda a 0.45 g lateral seguida de parada', () => escenas.rotondaYParada(0.45, 30), {}],
    ]) {
      tasa(`frenada registrada ≤ 5 %: ${nombre}`, fabricar, opciones, (r) => r.tasaFrenada <= 0.05, (r) => `frenadas ${porcentaje(r.tasaFrenada)}`)
    }
    tasa('choque 50 → 0: la frenada queda absorbida por el episodio', () => escenas.choqueFrontal(12, 50), {}, (r) => r.frenadas === 0 && r.tasaAlerta >= 0.95, (r) => `frenadas ${r.frenadas}`)

    // Una hora de ciudad: tres ensayos de 20 minutos, siempre, sin importar BANCO_N.
    sembrar(99)
    const ciudad = correr(() => escenas.urbano(20), 3)
    verificar('una hora de ciudad: cero alertas', ciudad.conAlerta === 0, resumen(ciudad))
  }
```

- [ ] **Step 2: Correr [V4] con 10 ensayos**

Run: `SECCION=V4 npx tsx scripts/prueba-viaje.mjs`

Expected: la línea `  aviso BANCO_N=10 es menor que 50: las tasas no valen como prueba`, ninguna `  FALLA`, `88/88 verificaciones pasaron` y `Todo en orden.`, en unos 13 s.

- [ ] **Step 3: Correr [V4] con 50 ensayos**

Run: `BANCO_COMPLETO=1 SECCION=V4 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:BANCO_COMPLETO='1'; $env:SECCION='V4'; npx tsx scripts/prueba-viaje.mjs`)

Expected: sin la línea de aviso, ninguna `  FALLA`, `88/88 verificaciones pasaron` y `Todo en orden.`, en menos de 60 s (53 s medido). Las tasas medidas con `sembrar(99)` y N = 50 mientras se escribía este plan:

| Escena | Medido |
|---|---|
| Falsos positivos con GPS o sin GPS salvo la mano (16 escenas, incluidas ABS de 1.0 y 1.1 g con la caída sin golpe en `alerta`) | 0 % de alertas en todas |
| Sacudida con la mano sin GPS: 5 Hz ±5 cm / 4 Hz ±10 cm | 12 % / 8 % de alertas (3 Hz ±10 cm: 48 %, no se afirma) |
| Choques con GPS (23 escenas, incluidos vuelco, trompo, despedido, cae y choca, roce que patina, detenciones blandas con `alerta` y pulso derivado) | 100 % |
| Choque 6 g a 40 km/h 4 s después del semáforo, retraso 0 / 1 / 2 s | 98 % / 94 % / 96 % |
| Choque 6 g a 40 km/h 6 y 8 s después del semáforo, cualquier retraso | 100 % |
| Choque con soporte de 6 Hz ζ 0.05 sin GPS | 92 % |
| 60 → 35 que sigue a 35 | `golpe_en_marcha` 100 %, alertas 0 % |
| Relojes: suspensión de 25, 60 y 120 s, hora GNSS +8 s, reloj +300 s, fix en caché de 2 min | 50/50 confirmado en todas, igual que sin nada |
| Frenadas de 0.5 a 0.8 g (retraso 0–3 s, reloj ±1 s, iOS) y 0.8 g sin giróscopo | 100 % |
| Frenadas de 0.30 a 0.40 g con ruido ±3 y ±5; rotonda a 0.45 g | 0 % |
| Choque 50 → 0 | 0 frenadas (absorbida) |
| Una hora de ciudad (3 × 20 min) | 0 alertas, 0 frenadas y 0 aceleraciones registradas, 3 golpes en marcha silenciosos (pozos) |

- [ ] **Step 4: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` con `Todo en orden.`; `prueba-viaje.mjs` con el aviso de `BANCO_N=10`, sin `  FALLA` y `Todo en orden.`.

- [ ] **Step 5: Commit**

```bash
git add "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Afirmar las tasas del detector sobre las escenas obligatorias del diseño

[V4] corre cada escena de §6.1 con semilla fija y afirma choques con alerta, falsos
positivos sin alerta, una hora de ciudad sin alertas, frenadas detectadas y no detectadas,
absorción y relojes. npm run prueba corre 10 ensayos por escena y avisa que así las tasas no
valen como prueba; BANCO_COMPLETO=1 corre los 50 (53 s en esta máquina). Tres mínimos quedan
en lo medido y no en lo que pedía el diseño: la sacudida con la mano sin GPS, el choque con
soporte de 6 Hz sin GPS y el choque 4 s después de un semáforo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: `reconstruirVeredicto`, el servidor pasa a `evaluarEpisodio` y paridad teléfono–servidor

**Files:**
- Modify: `lib/transporte-viaje.ts` — la línea de `import … from './impacto'`; la función `veredictoBasico` con su comentario (`/**` · `* F1 guarda del veredicto del teléfono sólo nivel, pico y motivo.` … hasta su llave de cierre); la llamada `const veredictoCliente = veredictoBasico(crudo.veredicto_cliente)` dentro de `decodificarEpisodio`.
- Modify: `lib/telemetria.ts` — la línea de `import … from './impacto'` y la línea `const veredicto = analizarImpacto(episodio.episodio.serie)` dentro de `guardarTelemetria`.
- Test: `scripts/prueba-viaje.mjs`, dentro de `[V2]`.

**Interfaces:**
- Consumes: `validarUmbrales` (Tarea 1); `Veredicto`, `SenalesSubpico`, `SenalesCaida`, `CaidaSinGolpe`, `EventoSilencioso`, `evaluarEpisodio` (Tarea 2); `simular`, `sembrar`, `escenas` (Tarea 7); de F1: `codificarEpisodio`, `decodificarEpisodio`, `esObjeto`, `NIVELES`, `DISPARADORES`, `FUENTES` (`lib/transporte-viaje.ts`) y `configuracionModoViaje` (`lib/telemetria.ts`).
- Produces:
  - `export function reconstruirVeredicto(crudo: unknown): Veredicto | null` (índice, `lib/transporte-viaje.ts`): lista cerrada de claves; un campo ilegible toma un valor neutro; `null` sólo si `nivel` no es un `NivelImpacto`; `llamar_emergencias` siempre `false`; `umbrales` pasa por `validarUmbrales`.
  - `EpisodioDecodificado.veredictoCliente` pasa a ser un `Veredicto` completo (el tipo `VeredictoClienteReconstruido` no cambia).
  - `guardarTelemetria` guarda en `telemetria_episodios.veredicto` el `evaluarEpisodio(episodio, { umbrales: UMBRALES, caidaSinGolpe: configuracionModoViaje().caida_sin_golpe })`. `guardarTelemetriaLegada` sigue con `analizarImpacto` (índice, decisión 8).

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, dentro de la sección `[V2]`, agregá este bloque al final (antes del `})` que cierra `[V2]`, que ahora está justo antes de `await seccion('V3'`, con una línea vacía antes):

```js
  /* ---- reconstruirVeredicto y paridad teléfono–servidor ---- */
  {
    const { UMBRALES, evaluarEpisodio } = await import('../lib/impacto.ts')
    const { codificarEpisodio, decodificarEpisodio, reconstruirVeredicto } = await import('../lib/transporte-viaje.ts')
    const banco = await import('./banco-impacto.mjs')

    verificar('reconstruirVeredicto: sin nivel válido da null', reconstruirVeredicto({ nivel: 'catastrofe' }) === null && reconstruirVeredicto(null) === null && reconstruirVeredicto([]) === null)
    const minimo = reconstruirVeredicto({ nivel: 'sospecha', picoG: 5, motivo: 'm', anidado: { hondo: [1, { mas: true }] }, llamar_emergencias: true })
    verificar(
      'reconstruirVeredicto completa lo que falta con valores neutros y descarta lo desconocido',
      minimo !== null && minimo.nivel === 'sospecha' && minimo.picoG === 5 && minimo.motivo === 'm' && minimo.disparador === 'golpe' && minimo.señales === null && minimo.subpicos.length === 0 && isDeepStrictEqual(minimo.umbrales, { ...UMBRALES }) && !('anidado' in minimo),
      JSON.stringify(minimo),
    )
    verificar('reconstruirVeredicto nunca deja llamar_emergencias en true', minimo?.llamar_emergencias === false)
    const raro = reconstruirVeredicto({ nivel: 'nada', picoG: 'mucho', subpicos: [{ nivel: 'x' }, { nivel: 'nada', pico: 4.2, sostenido: 'sí', extra: 1 }], descartes: ['a'.repeat(300), 7], umbrales: { sospechaG: 99 } })
    verificar(
      'reconstruirVeredicto filtra sub-picos, descartes y umbrales ilegibles',
      raro.picoG === 0 && raro.subpicos.length === 1 && raro.subpicos[0].sostenido === false && !('extra' in raro.subpicos[0]) && raro.descartes.length === 1 && raro.descartes[0].length === 200 && raro.umbrales.sospechaG === 4,
      JSON.stringify(raro),
    )

    /** El episodio del detector del teléfono → cuerpo JSON → lo que decodifica el servidor → evaluarEpisodio otra vez. */
    function paridad(nombre, escena, opciones) {
      banco.sembrar(99)
      const eventos = banco.simular(escena(), opciones)
      const evento = eventos.find((e) => e.tipo === 'episodio' && (e.veredicto.nivel !== 'nada' || e.veredicto.silencioso !== null))
      if (!evento) {
        verificar(`paridad ${nombre}: el detector emitió un episodio`, false, JSON.stringify(eventos.map((e) => e.tipo)))
        return
      }
      const cuerpo = JSON.parse(JSON.stringify(codificarEpisodio(1, evento.ocurridoEn, evento.episodio, evento.veredicto)))
      const decodificado = decodificarEpisodio(cuerpo)
      const enServidor = evaluarEpisodio(decodificado.episodio, { umbrales: UMBRALES, caidaSinGolpe: opciones.caidaSinGolpe ?? 'silenciosa' })
      verificar(`paridad ${nombre}: el servidor recibe exactamente el episodio que evaluó el teléfono`, isDeepStrictEqual(decodificado.episodio, evento.episodio))
      verificar(`paridad ${nombre}: el servidor llega al mismo veredicto (${evento.veredicto.nivel})`, isDeepStrictEqual(enServidor, evento.veredicto), `${enServidor.nivel} ${enServidor.motivo}`)
      verificar(`paridad ${nombre}: el veredicto del teléfono se reconstruye entero`, isDeepStrictEqual(decodificado.veredictoCliente, evento.veredicto))
    }
    const { readFileSync } = await import('node:fs')
    const servidor = readFileSync(new URL('../lib/telemetria.ts', import.meta.url), 'utf8')
    verificar(
      'el servidor evalúa cada episodio con evaluarEpisodio y la configuración vigente, no con el adaptador del detector anterior',
      servidor.includes('evaluarEpisodio(episodio.episodio, { umbrales: UMBRALES, caidaSinGolpe: configuracionModoViaje().caida_sin_golpe })') && !servidor.includes('analizarImpacto(episodio.episodio.serie)'),
    )

    paridad('choque confirmado', () => banco.escenas.choqueFrontal(12, 55), {})
    paridad('golpe en marcha', () => banco.escenas.choqueYSigue(8, 60, 35), {})
    paridad('caída sin golpe con alerta', () => banco.escenas.detencionBlanda(2, 50), { caidaSinGolpe: 'alerta' })
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V2 npx tsx scripts/prueba-viaje.mjs`

Expected: las 49 de las Tareas 1 y 2 en `ok` y después

```
  FALLA [V2] terminó sin excepciones TypeError: reconstruirVeredicto is not a function
```

con `49/50 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: `reconstruirVeredicto` en `lib/transporte-viaje.ts`**

Reemplazá la línea:

```ts
import { UMBRALES, GRAVEDAD_MS2, MAX_MUESTRAS_EPISODIO, MAX_VELOCIDADES_EPISODIO, recortarEpisodio, redondearEpisodio, type DisparadorEpisodio, type EpisodioImpacto, type FuenteAceleracion, type Lectura, type NivelImpacto, type RespuestaAlerta, type Umbrales, type Veredicto } from './impacto'
```

por:

```ts
import { UMBRALES, GRAVEDAD_MS2, MAX_MUESTRAS_EPISODIO, MAX_VELOCIDADES_EPISODIO, recortarEpisodio, redondearEpisodio, validarUmbrales, type CaidaSinGolpe, type DisparadorEpisodio, type EpisodioImpacto, type EventoSilencioso, type FuenteAceleracion, type Lectura, type NivelImpacto, type RespuestaAlerta, type SenalesCaida, type SenalesSubpico, type Umbrales, type Veredicto } from './impacto'
```

Reemplazá:

```ts
/**
 * F1 guarda del veredicto del teléfono sólo nivel, pico y motivo. Un veredicto ilegible no
 * rechaza el episodio: la serie sigue sirviendo para que el servidor repita el cálculo.
 */
function veredictoBasico(crudo: unknown): VeredictoClienteReconstruido | null {
  if (!esObjeto(crudo)) return null
  const { nivel, picoG, motivo } = crudo
  if (typeof nivel !== 'string' || !(NIVELES as readonly string[]).includes(nivel)) return null
  if (typeof picoG !== 'number' || !Number.isFinite(picoG) || picoG < 0) return null
  if (typeof motivo !== 'string') return null
  return { nivel: nivel as NivelImpacto, picoG, motivo: motivo.slice(0, 200) }
}
```

por:

```ts
const CAIDAS_SIN_GOLPE: readonly CaidaSinGolpe[] = ['alerta', 'silenciosa']
const SILENCIOSOS: readonly EventoSilencioso[] = ['golpe_en_marcha', 'caida_silenciosa']

/*
 * Lectores tolerantes para el veredicto del teléfono: un campo ilegible toma un valor neutro en vez de rechazar
 * el episodio, porque la serie sigue sirviendo para que el servidor repita el cálculo.
 */
const finitoO = (valor: unknown, omision: number): number => (typeof valor === 'number' && Number.isFinite(valor) ? valor : omision)
const finitoONulo = (valor: unknown): number | null => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null)
const siEsTrue = (valor: unknown): boolean => valor === true
const enteroO = (valor: unknown, omision: number): number => (typeof valor === 'number' && Number.isInteger(valor) ? valor : omision)
const deListaO = <T extends string>(valor: unknown, lista: readonly T[], omision: T): T => (typeof valor === 'string' && (lista as readonly string[]).includes(valor) ? (valor as T) : omision)
const esNivel = (valor: unknown): valor is NivelImpacto => typeof valor === 'string' && (NIVELES as readonly string[]).includes(valor)

function reconstruirSubpico(crudo: unknown): SenalesSubpico | null {
  if (!esObjeto(crudo) || !esNivel(crudo.nivel)) return null
  return {
    tPico: finitoO(crudo.tPico, 0),
    pico: Math.max(0, finitoO(crudo.pico, 0)),
    msSostenido: Math.max(0, finitoO(crudo.msSostenido, 0)),
    sostenido: siEsTrue(crudo.sostenido),
    manipulado: siEsTrue(crudo.manipulado),
    sacudida: siEsTrue(crudo.sacudida),
    previa: finitoONulo(crudo.previa),
    ibaAndando: siEsTrue(crudo.ibaAndando),
    detenido: siEsTrue(crudo.detenido),
    siguioAndando: siEsTrue(crudo.siguioAndando),
    velocidadDisponible: siEsTrue(crudo.velocidadDisponible),
    giroBrusco: siEsTrue(crudo.giroBrusco),
    fila: enteroO(crudo.fila, 10),
    nivel: crudo.nivel,
  }
}

function reconstruirCaida(crudo: unknown): SenalesCaida | null {
  if (!esObjeto(crudo) || !esNivel(crudo.nivel)) return null
  return {
    tCruce: finitoO(crudo.tCruce, 0),
    previa: finitoONulo(crudo.previa),
    bajas: Math.max(0, enteroO(crudo.bajas, 0)),
    detencionConfirmada: siEsTrue(crudo.detencionConfirmada),
    densaG: finitoONulo(crudo.densaG),
    manipulado: siEsTrue(crudo.manipulado),
    sacudida: siEsTrue(crudo.sacudida),
    caidaSinGolpe: siEsTrue(crudo.caidaSinGolpe),
    fila: enteroO(crudo.fila, 10),
    nivel: crudo.nivel,
  }
}

/** F2. Reconstruye un Veredicto desde la lista cerrada de sus campos (y de SenalesSubpico, SenalesCaida y Umbrales). Descarta cualquier otra clave; null si nivel no es un NivelImpacto. */
export function reconstruirVeredicto(crudo: unknown): Veredicto | null {
  if (!esObjeto(crudo) || !esNivel(crudo.nivel)) return null
  const subpicos = Array.isArray(crudo.subpicos) ? crudo.subpicos.slice(0, 50).map(reconstruirSubpico) : []
  const descartes = Array.isArray(crudo.descartes) ? crudo.descartes.filter((d): d is string => typeof d === 'string') : []
  return {
    nivel: crudo.nivel,
    picoG: Math.max(0, finitoO(crudo.picoG, 0)),
    msPico: finitoONulo(crudo.msPico),
    disparador: deListaO(crudo.disparador, DISPARADORES, 'golpe'),
    fuente: deListaO(crudo.fuente, FUENTES, 'confiable'),
    señales: reconstruirSubpico(crudo.señales),
    subpicos: subpicos.filter((s): s is SenalesSubpico => s !== null),
    caida: reconstruirCaida(crudo.caida),
    silencioso: SILENCIOSOS.find((s) => s === crudo.silencioso) ?? null,
    descartes: descartes.slice(0, 20).map((d) => d.slice(0, 200)),
    motivo: typeof crudo.motivo === 'string' ? crudo.motivo.slice(0, 200) : '',
    // validarUmbrales sólo lee sus quince claves: lo demás del objeto que llegó no pasa.
    umbrales: validarUmbrales(crudo.umbrales).umbrales,
    caidaSinGolpe: deListaO(crudo.caidaSinGolpe, CAIDAS_SIN_GOLPE, 'silenciosa'),
    version: enteroO(crudo.version, 0),
    llamar_emergencias: false,
  }
}
```

Y dentro de `decodificarEpisodio`, reemplazá:

```ts
  const veredictoCliente = veredictoBasico(crudo.veredicto_cliente)
```

por:

```ts
  const veredictoCliente = reconstruirVeredicto(crudo.veredicto_cliente)
```

- [ ] **Step 4: El servidor evalúa con `evaluarEpisodio`**

En `lib/telemetria.ts`, reemplazá:

```ts
import { UMBRALES, analizarImpacto, nivelMayor, planEscalamiento, type NivelImpacto, type PlanEscalamiento, type RespuestaAlerta, type Umbrales, type Veredicto } from './impacto'
```

por:

```ts
import { UMBRALES, analizarImpacto, evaluarEpisodio, nivelMayor, planEscalamiento, type NivelImpacto, type PlanEscalamiento, type RespuestaAlerta, type Umbrales, type Veredicto } from './impacto'
```

Y reemplazá:

```ts
      const veredicto = analizarImpacto(episodio.episodio.serie)
```

por:

```ts
      // El mismo cálculo que hizo el teléfono sobre el mismo episodio, con los umbrales y la configuración de este servidor.
      const veredicto = evaluarEpisodio(episodio.episodio, { umbrales: UMBRALES, caidaSinGolpe: configuracionModoViaje().caida_sin_golpe })
```

- [ ] **Step 5: Correr [V2] y [V1] y verlas pasar**

Run: `SECCION=V2 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras

```
  ok   paridad choque confirmado: el servidor llega al mismo veredicto (confirmado)
  ok   paridad golpe en marcha: el servidor llega al mismo veredicto (nada)
  ok   paridad caída sin golpe con alerta: el servidor llega al mismo veredicto (sospecha)
  ok   paridad caída sin golpe con alerta: el veredicto del teléfono se reconstruye entero
```

y `63/63 verificaciones pasaron`, `Todo en orden.`.

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: sin `  FALLA` (las verificaciones de F1 sobre `veredictoCliente` —nivel, pico y motivo; las claves de más que no llegan; el veredicto ilegible que no rechaza el episodio— siguen valiendo con la reconstrucción completa) y `Todo en orden.`.

- [ ] **Step 6: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; las dos pruebas con `Todo en orden.`.

Con la base descartable de F1 (ver su «Antes de empezar»), el e2e: `E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e` con `[10a]`–`[10g]` en `ok` y `Circuito completo funcionando.`. Sin base descartable, el informe de la tarea dice «e2e no corrido: sin base descartable».

- [ ] **Step 7: Commit**

```bash
git add "lib/transporte-viaje.ts" "lib/telemetria.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Recalcular en el servidor el mismo veredicto que dio el teléfono

guardarTelemetria evalúa cada episodio con evaluarEpisodio y los umbrales del servidor, en vez
del análisis provisorio de F1 sobre la serie sola. El veredicto del teléfono se reconstruye
entero desde una lista cerrada de claves: lo ilegible toma un valor neutro, nada más entra a
la base y llamar_emergencias queda en false aunque venga otra cosa. La prueba de paridad manda
episodios reales del detector por el transporte, incluida la caída sin golpe, y exige el mismo
veredicto de los dos lados.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `IMPORTS_PERMITIDOS` para `lib/impacto.ts`, `lib/conduccion.ts` y `lib/transporte-viaje.ts`

**Files:**
- Modify (temporal, se revierte en esta misma tarea): `lib/conduccion.ts` — su línea de `import`.
- Modify: `scripts/prueba-contrato.mjs` — sección `[5] Lo que el expediente no perdona`, inmediatamente antes de `/* ---------- 6. La documentación sigue el paso ---------- */`.
- Test: `npm run contrato`.

**Interfaces:**
- Consumes: `leer` y `verificar` de `scripts/prueba-contrato.mjs`.
- Produces: el objeto `IMPORTS_PERMITIDOS` (archivo → lista de módulos permitidos) y una sola comprobación, `los módulos compartidos por el teléfono y el servidor sólo importan lo permitido`, que cuenta `import`, `import type`, `export … from` e `import '…'`, y da falla ante cualquier `import()`. F3 suma `'lib/cola-viaje.ts'` y `'lib/viaje.ts'` con esta misma forma.

- [ ] **Step 1: Escribir la prueba que falla: una importación prohibida que el contrato todavía no ve**

En `lib/conduccion.ts`, reemplazá la línea que empieza con `import { evaluarEpisodio, redondearEpisodio, recortarEpisodio,` por esa misma línea con esta otra delante:

```ts
import { pool } from './db'
```

- [ ] **Step 2: Correr el contrato y ver que no lo detecta**

Run: `npm run contrato`

Expected: `El contrato se cumple.` Ésa es la falla: `pg` entraría al paquete del teléfono y nada lo frena.

- [ ] **Step 3: La comprobación**

En `scripts/prueba-contrato.mjs`, inmediatamente antes de

```js
/* ---------- 6. La documentación sigue el paso ---------- */
```

agregá (con una línea vacía después):

```js
{
  /*
   * Estos módulos corren en el teléfono y en el servidor. Una importación de más mete pg o node:crypto en el
   * paquete del cliente, o ata la regla del servidor a la detección. Se leen sin comentarios; se cuentan import,
   * import type, export … from e import '…', y un import() dinámico es falla siempre (el contrato no lo puede seguir).
   */
  const IMPORTS_PERMITIDOS = {
    'lib/impacto.ts': [],
    'lib/conduccion.ts': ['./impacto'],
    'lib/transporte-viaje.ts': ['./impacto'],
  }
  const ajenos = []
  for (const [ruta, permitidos] of Object.entries(IMPORTS_PERMITIDOS)) {
    const codigo = leer(ruta).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const modulos = [
      ...codigo.matchAll(/^\s*(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/gm),
      ...codigo.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gm),
    ].map((m) => m[1])
    for (const modulo of modulos) if (!permitidos.includes(modulo)) ajenos.push(`${ruta} importa ${modulo}`)
    if (/\bimport\s*\(/.test(codigo)) ajenos.push(`${ruta} tiene un import() dinámico`)
  }
  verificar(
    'los módulos compartidos por el teléfono y el servidor sólo importan lo permitido',
    ajenos.length === 0,
    ajenos.join('\n         ') + '\n         Cada archivo puede importar sólo lo que dice IMPORTS_PERMITIDOS (índice del modo viaje, «Importaciones permitidas»).',
  )
}
```

- [ ] **Step 4: Correr el contrato y verlo fallar**

Run: `npm run contrato`

Expected: código 1 con

```
  FALLA los módulos compartidos por el teléfono y el servidor sólo importan lo permitido
         lib/conduccion.ts importa ./db
         Cada archivo puede importar sólo lo que dice IMPORTS_PERMITIDOS (índice del modo viaje, «Importaciones permitidas»).
```

y al final `1 FALLARON. El contrato está en docs/CONTRATO-UI.md.`

- [ ] **Step 5: Sacar la importación de prueba**

En `lib/conduccion.ts`, borrá la línea `import { pool } from './db'`.

Run: `npm run contrato`

Expected: `  ok   los módulos compartidos por el teléfono y el servidor sólo importan lo permitido` y `El contrato se cumple.`

- [ ] **Step 6: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; las dos pruebas con `Todo en orden.`.

- [ ] **Step 7: Commit**

```bash
git add "scripts/prueba-contrato.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Impedir que la lógica compartida con el teléfono importe módulos del servidor

lib/impacto.ts, lib/conduccion.ts y lib/transporte-viaje.ts corren en el navegador y en el
servidor. El contrato ahora lee sus importaciones: impacto no importa nada, conduccion y
transporte-viaje sólo importan ./impacto, y un import() dinámico es falla. Así pg o
node:crypto no pueden colarse en el paquete del cliente sin que la prueba lo diga.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

`git status --short` después del commit: ninguna línea salvo `?? docs/superpowers/plans/` (`lib/conduccion.ts` quedó igual que en el commit de la Tarea 6).

---

## Verificación de la fase

**Comandos**

1. `git log --oneline -11` muestra los diez commits de esta fase, de la Tarea 10 (arriba) a la Tarea 1, y debajo el último de F1.
2. `git status --short` no muestra cambios salvo `?? docs/superpowers/plans/` (si `next-env.d.ts` aparece modificado, `git checkout -- next-env.d.ts`).
3. `npm run contrato && npm run tipos && npm run prueba`: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA` y con `Todo en orden.`; `prueba-viaje.mjs` con `[V1]` a `[V4]`, la línea de aviso de `BANCO_N=10`, sin `  FALLA`, y `Todo en orden.` como última línea. Los totales de las secciones de F2: `[V2]` 63, `[V3]` 46, `[V4]` 88.
4. `BANCO_COMPLETO=1 SECCION=V4 npx tsx scripts/prueba-viaje.mjs`: `88/88 verificaciones pasaron` y `Todo en orden.` en menos de 60 s.
5. Precondiciones de F3: `grep -c "export function crearDetector" lib/conduccion.ts`, `grep -c "export function validarUmbrales" lib/impacto.ts` y `grep -c "export function reconstruirVeredicto" lib/transporte-viaje.ts` dan `1`; `grep -c "IMPORTS_PERMITIDOS" scripts/prueba-contrato.mjs` da más que `0`.

**Chequeos manuales** (la matriz de §6.5 empieza en F4; esto es lo que el índice pide que se pueda probar al terminar F2)

| # | Procedimiento | Esperado |
|---|---|---|
| F2-a | `curl -s http://localhost:3000/api/salud` con el servidor de desarrollo sobre la base descartable | `"modo_viaje":{"ok":true,"detalle":"Umbrales del detector dentro de rango.","problemas":[]}` y el `ok` general sin cambios |
| F2-b | Lo mismo con `IMPACTO_UMBRAL_SOSPECHA_G=40 IMPACTO_VENTANA_CAIDA_MS=2000 npm run dev` | `modo_viaje.ok` en `false` con un problema de `sospechaG`; en la terminal, una vez cada uno, `IMPACTO_VENTANA_CAIDA_MS ya no se usa: …` y `[impacto] umbrales fuera de rango: …`; el `ok` general y el estado HTTP no cambian |
| F2-c | `curl -s http://localhost:3000/api/telemetria/configuracion` | `umbrales` con los 15 campos de la tabla del índice y `velocidadPreviaKmh: 15` |
| F2-d | En `/perfil`, el detector anterior (sigue hasta F4): simular un golpe como en F1-a | `POST /api/telemetria` → 201 con `veredicto.version` 1, `veredicto.disparador` `golpe` y `veredicto.señales.fila` 7 (sin velocidades) |

Al cortar el servidor: `git checkout -- next-env.d.ts`.

## Desvíos respecto del índice

Los tres primeros cambian una regla que el índice o §2 escriben de otra forma; se midieron con el banco y el índice gana en todo lo demás. Ningún nombre, tipo exportado ni texto de «Textos exactos» cambia.

1. **`previa` mira hasta `tPico + 2.5 s`, no `+ 1.5 s`** (`velocidadPrevia` y `velocidadDisponible` en `lib/impacto.ts`; el comentario de `SenalesSubpico.previa` lo dice). Con 1.5 s, el choque de 6 g a 40 km/h 4 s después de salir de un semáforo con el GPS 2 s atrasado daba alerta en el 78 % de los ensayos: la mediana de 3 todavía mostraba la velocidad de 2 s antes (14 km/h, debajo de `velocidadPreviaKmh`). Con 2.5 s, 96 %. Nada de lo demás cambió de tasa.
2. **Maniobras: la magnitud es la media del acelerómetro y el GPS decide el sentido con extremos, no con medianas** (`detectarManiobras`). Con `g = (mediana antes − mediana después) / dur / 35.3` y `|Δv| ≥ 0.6 · ∫aLon`, las frenadas de 0.65 g se detectaban en el 0–45 % de los ensayos (según el retraso) y las de 0.5 g en el 20 %; con máximo antes y mínimo después, las de 0.35 g se registraban en el 40 %. Queda: frenada si `máx(antes) − mín(después) ≥ 0.5 · ∫aLon · 35.3`, `vAntes ≥ 20` y la media de `aLon` ≥ `frenadaG`; aceleración con el simétrico. La ventana posterior se estira un fix (`tF + retrasoMaxMs + 1 s`) y una maniobra se decide cuando `tF + retrasoMaxMs + 1 s ≤ hastaMono`: con el retraso de 3 s, el fix que cierra la ventana a veces caía afuera (85 % → 100 %). `Maniobra.gEstimada` y `EntradaManiobras.hastaMono` conservan nombre y tipo; sus comentarios dicen la regla nueva. La regla del rumbo > 30° no se implementa aparte: la condición de GPS se exige siempre, y la rotonda a 0.45 g da 0 %.
3. **El seguimiento de §2.6 sólo arranca si el golpe se llevó velocidad** (mediana posterior ≤ previa − 10 km/h, `perdioVelocidad` en `crearDetector`). Un pozo a 30–50 km/h con soporte resonante cae en la fila 4 igual que un choque que sigue andando; siguiéndolo, la hora de ciudad daba 3 alertas (una por pozo, en el semáforo siguiente). Con la condición, 0. El `golpe_en_marcha` silencioso se registra igual en los dos casos, y las pruebas de F3 (60 → 35) no cambian.
4. **Mínimos que quedan en lo medido** (`[V4]`): sacudida con la mano sin GPS ≤ 15 % (5 Hz ±5 cm, medido 12 %) y ≤ 10 % (4 Hz ±10 cm, medido 8 %) en vez de ≤ 2 %; choque con soporte de 6 Hz ζ 0.05 sin GPS ≥ 90 % (medido 92 %); choque 4 s después del semáforo ≥ 90 % con cada retraso (medido 94–98 %). La sacudida de 3 Hz ±10 cm sin GPS da 48 % y no se afirma. Causa común: sin velocidad (fila 7) la única defensa contra la mano es la periodicidad **previa** al pico; un sub-pico temprano de la sacudida no tiene historia, y uno tardío del soporte que resuena sí. Mirar también después del pico haría perder choques con soportes que resuenan (§2.5 lo descarta). Límite a declarar en F6.
5. **`[V4]` corre 10 ensayos por omisión** (`N = BANCO_N ?? (BANCO_COMPLETO === '1' ? 50 : 10)`), la alternativa que el índice prevé: con 50, 53 s de los 60 del presupuesto y se corre en cada commit.
6. **Disparador (b)**: §2.3 no fija en cuánto tiempo tiene que caer la velocidad. Se exige que la lectura previa confiable esté sobre `velocidadPosteriorKmh` y que alguna de los 2.5 s anteriores llegue a `velocidadPreviaCaidaKmh`, con un episodio (b) cada 20 s como máximo y ninguno hasta `retrasoMaxMs` después de cerrar un golpe. Una detención normal a 10 km/h por segundo no lo dispara. Sin aceleración confiable (fila 9) una detención de ciudad brusca sí puede quedar como `caida_silenciosa`: es silenciosa, y se calibra en campo.
7. **Banco**: exporta además `T0` y `simular` (la paridad de la Tarea 9 necesita los eventos de un ensayo); `golpesEnMarcha` y `caidasSilenciosas` son fracciones de ensayos (el índice pide compararlas con 0.95). Las escenas que el anexo no tenía se modelaron en este plan: `tironAcompanante` (la mano gira el teléfono antes del tirón), `golpeConsola`, `trompo` (patina girando y golpea el cordón), `choqueQueRueda`, `rocePatina`, `choqueYFrenaSuave`, `choqueYSigue`, `detencionBlanda`, `frenadaYDetencionBlanda`, `rotondaYParada` y `pulso`. El giro de cada escena es alrededor de la vertical del vehículo.
8. **Detalles de implementación que el índice no fijaba**: la racha de `msSostenido` tolera una muestra suelta por debajo (así la midió el anexo) y todas las duraciones «sostenido ≥ X ms» comparan con 1 ms de tolerancia (el transporte redondea t a 0.1 ms); la fila 6 usa `previa < velocidadPreviaKmh` en vez del 15 literal; `reconstruirVeredicto` pasa `umbrales` por `validarUmbrales`; `/api/salud` dice «Hay 1 umbral fuera de rango» en singular; los `import` de `lib/conduccion.ts` y `lib/transporte-viaje.ts` suman nombres de `./impacto` que el fragmento del índice no listaba (`type Lectura`, `MAX_VELOCIDADES_EPISODIO`, `validarUmbrales` y los tipos del veredicto), dentro de lo que permite `IMPORTS_PERMITIDOS`.
