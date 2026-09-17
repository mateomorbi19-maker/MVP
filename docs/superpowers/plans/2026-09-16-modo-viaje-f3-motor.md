# F3 — Motor — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el motor del modo viaje fuera de React (`lib/viaje.ts`) y su cola persistente (`lib/cola-viaje.ts`), probados en Node con fuentes falsas y reloj falso (`scripts/fuentes-falsas.mjs`), para que la capa de F4 sólo dibuje un estado inmutable y llame acciones.

**Architecture:** `lib/cola-viaje.ts` tiene la política de la cola (tope, descarte, orden, retroceso y rechazos) pura sobre un almacén inyectado, con un adaptador fino de IndexedDB. `lib/viaje.ts` cablea las fuentes del navegador (reloj, sensores, GPS, wake lock, audio, almacenamiento, candados y red) con el detector puro de F2 (`crearDetector`) y con la cola: ciclo de vida, gesto, reanudación, rutas, alertas, respuestas, golpe pendiente, inactividad y configuración remota, y publica una instantánea congelada que cambia de referencia sólo cuando algo cambió. Todo tiempo entra por `reloj.mono()` y `reloj.pared()` y todo temporizador por `reloj.programar`: las pruebas avanzan el reloj a mano y terminan con cero temporizadores y cero escuchas.

**Tech Stack:** TypeScript 7 (`tsc --noEmit`), Node 24 con `tsx` (pruebas; `?instancia=N` para evaluar dos veces un módulo), APIs del navegador detrás de `FuentesMotor` (DeviceMotionEvent, Geolocation, Permissions, Screen Wake Lock, Web Audio, Vibration, Web Locks, IndexedDB, localStorage, `crypto.randomUUID`), `structuredClone` y `Response` de Node en las fuentes falsas.

**Spec:** `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md` (§1.1, §2.1, §2.6, §2.9, §3.3–§3.6, §4, §5.4, §5.6, §6.2) · Índice: `docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md` («Fases › F3»; «Interfaces › `lib/cola-viaje.ts`» y «`lib/viaje.ts`», con los tipos sin exportar y las reglas del motor; «`lib/conduccion.ts`» y «`lib/transporte-viaje.ts`», que se consumen; «Almacenamiento del cliente»; «Pruebas: convenciones», con el arnés y las fuentes falsas; riesgos 17 a 25, 29, 39 y 40)

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

1. F2 terminada: `git log --oneline` muestra sus commits sobre los de F1 en `modo-viaje-global`, y existen las piezas que este plan consume. En Git Bash, desde la raíz:

```bash
git branch --show-current
git status --short
grep -c "export function crearDetector" lib/conduccion.ts
grep -c "export function validarUmbrales" lib/impacto.ts
grep -c "export function reconstruirVeredicto" lib/transporte-viaje.ts
grep -c "export const AVISOS_DATOS_CONOCIDOS" lib/telemetria.ts
grep -c "IMPORTS_PERMITIDOS" scripts/prueba-contrato.mjs
grep -c "Resultado ----------" scripts/prueba-viaje.mjs
```

Esperado: `modo-viaje-global`; ninguna línea de estado salvo `?? docs/superpowers/plans/`; `1` en los cuatro `grep -c` de `lib/`; un número mayor que `0` para `IMPORTS_PERMITIDOS`; `1` para la línea del resultado de `scripts/prueba-viaje.mjs`. Si falta algo, F2 no está terminada y no se empieza F3.

2. Las tres verificaciones en verde: `npm run contrato && npm run tipos && npm run prueba` imprime `El contrato se cumple.`, `tsc` no imprime nada y las dos pruebas terminan en `Todo en orden.`.
3. `lib/viaje.ts`, `lib/cola-viaje.ts` y `scripts/fuentes-falsas.mjs` no existen todavía.

**Leer antes de escribir código**

- `AGENTS.md`.
- El índice entero, y con atención: «Interfaces › `lib/cola-viaje.ts`» y «`lib/viaje.ts`» (exportados, tipos sin exportar, «Reglas del motor que F4 y F5 dan por hechas»), «`lib/conduccion.ts`» (`Detector`, `EventoDetector`, `ResumenDetector`), «`lib/transporte-viaje.ts`» (`CamposAlerta`, `EpisodioTransportado`, `LoteConduccion`, `FilaEventoConduccion`, `codificarEpisodio`, rangos de validación), «Almacenamiento del cliente» (las cinco claves del motor y sus formas exactas), «Pruebas: convenciones» (arnés de `scripts/prueba-viaje.mjs` y «Fuentes falsas») y los riesgos 17 a 25, 29, 39 y 40.
- El diseño: §1.1, §2.1, §2.6, §2.9, §3.3 a §3.6, §4 entero, §5.4 y §6.2.
- Del repositorio: `lib/local.ts` (lo que `fuentes.local` envuelve), `lib/cola.ts` (el patrón de IndexedDB de la cola de evidencia, que la cola nueva no comparte: base y almacén propios), `lib/conduccion.ts` y `lib/impacto.ts` (F2), `lib/transporte-viaje.ts` (F1 y F2), `lib/telemetria.ts` (`AVISOS_DATOS_CONOCIDOS`), `scripts/prueba-viaje.mjs` (el arnés y las secciones de F1 y F2), `scripts/prueba-contrato.mjs` (sección `[5]`: la comprobación de `IMPORTS_PERMITIDOS` de F2 y «ningún nombre se exporta desde dos módulos de lib/») y `app/components/DetectorImpacto.tsx` (lo que el motor reemplaza; lo borra F4).

**Cómo se corre cada cosa en esta fase**

- Una sección: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` desde la raíz (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`). Con `SECCION` corre sólo esa sección, así que los totales `N/N verificaciones pasaron` que citan los pasos son exactos.
- Las tres verificaciones: `npm run contrato && npm run tipos && npm run prueba`. Los totales de `scripts/prueba-logica.mjs` y de `scripts/prueba-viaje.mjs` completo dependen de F0, F1 y F2: se mira que no haya ninguna línea `  FALLA` y que las dos terminen en `Todo en orden.`.
- `lib/viaje.ts` se construye por partes. Cada paso de implementación da reemplazos exactos: el bloque «antes» aparece una sola vez en el archivo tal como lo dejó el paso anterior, y el número de línea que acompaña a cada uno es orientativo (es el del archivo con los reemplazos anteriores ya hechos).
- Las pruebas nuevas se agregan siempre al final: una sección nueva reemplaza la línea `/* ---------- Resultado ---------- */`, y un bloque dentro de la última sección reemplaza su cierre `})` junto con esa línea.
- Cada commit agrega sólo los archivos que nombra su paso, con la plantilla de «Global Constraints».

**Cómo se validó este plan**

Se aplicó tarea por tarea sobre una copia con `lib/impacto.ts`, `lib/conduccion.ts`, `lib/transporte-viaje.ts` y `lib/telemetria.ts` de reemplazo que siguen las firmas del índice (el detector de reemplazo implementa las filas 2, 4, 5 y 7 de §2.5 y el seguimiento de §2.6). En cada tarea: `tsc` sin errores; la sección falla con exactamente las líneas `FALLA` que cita el paso antes de implementar y pasa con los totales que cita después; y ninguna prueba deja temporizadores, escuchas, vigilancias ni centinelas colgados. Con el detector real de F2 las salidas tienen que ser las mismas: las escenas se eligieron con margen sobre las reglas, no sobre la calibración. Si una verificación que depende de una detección no da lo citado con F2 en verde, no se cambia la escena para que pase: se revisa si el motor la cablea mal o si F2 no sigue una regla del índice.

Las pruebas no ejercitan `almacenIndexedDb` ni `fuentesDelNavegador` (en Node no hay IndexedDB ni `window`): los ejercita un teléfono desde F4.

---

### Task 1: `lib/cola-viaje.ts`: la cola del modo viaje con almacén inyectado y adaptador de IndexedDB; [V5]

**Files:**
- Create: `lib/cola-viaje.ts`
- Modify: `scripts/prueba-viaje.mjs` — la línea `/* ---------- Resultado ---------- */` (única en el archivo; hoy va después de la sección `[V4]` de F2)
- Test: `scripts/prueba-viaje.mjs`, sección `[V5] Cola de viaje`

**Interfaces:**
- Consumes:
  - De `lib/transporte-viaje.ts` (F1), sólo tipos y con `import type`: `CamposAlerta`, `EpisodioTransportado`, `LoteConduccion`. Es lo único que `IMPORTS_PERMITIDOS` le va a permitir a este archivo (Tarea 13).
- Produces:
  - Exactamente lo de «Interfaces › `lib/cola-viaje.ts`» del índice: `interface EntradaAlertaViaje`, `interface EntradaEpisodioViaje`, `interface EntradaConduccionViaje`, `type EntradaColaViaje`, `interface AlmacenColaViaje { todas(): Promise<EntradaColaViaje[]>; poner(entrada: EntradaColaViaje): Promise<void>; sacar(clave: string): Promise<void>; vaciar(): Promise<void> }`, `interface RespuestaEnvioViaje { status: number; cuerpo: unknown; reintentarEnS: number | null }`, `type EnviarViaje = (ruta: '/api/telemetria' | '/api/conduccion', cuerpo: string) => Promise<RespuestaEnvioViaje>`, `interface ResultadoDrenadoViaje { subidas: number; pendientes: number; sinRed: boolean }`, `interface ColaViaje`, `function crearColaViaje(almacen: AlmacenColaViaje): ColaViaje` y `function almacenIndexedDb(): AlmacenColaViaje`.
  - `ColaViaje`: `guardarAlerta(idCliente: string, campos: CamposAlerta, ahora: number): Promise<void>`, `guardarEpisodio(idCliente: string, episodio: EpisodioTransportado, ahora: number): Promise<void>`, `guardarConduccion(lote: LoteConduccion, ahora: number): Promise<void>`, `idServidor(idCliente: string): Promise<string | null>`, `drenar(enviar: EnviarViaje, ahora: number, soloAlerta?: string): Promise<ResultadoDrenadoViaje>`, `pendientes(): Promise<number>`, `vaciar(): Promise<void>`. Claves del almacén: `alerta:<idCliente>`, `episodio:<idCliente>:<n>` y `conduccion:<id del primer evento del lote>`.
  - La usan las fuentes falsas (Tarea 2) y el motor (Tareas 3, 7, 9 y 12).

**Decisiones de esta tarea:**

- Todas las lecturas y escrituras del almacén van en una fila (`exclusivo`), y el resultado de un envío se aplica sobre la entrada fresca: si el motor guardó una respuesta nueva mientras el pedido viajaba, no se pisa con la entrada vieja. La espera de la red queda fuera de la fila, para que guardar una alerta nueva no espere al servidor.
- Un solo drenado a la vez (`drenado`): dos en paralelo mandarían dos veces el mismo episodio.
- Un 429 sin `Retry-After` espera 60 s (el limitador del servidor cuenta por minuto). Un drenado hace como mucho 200 pedidos, como freno de seguridad.
- Al pasarse del tope, lo primero que se descarta es un episodio huérfano (sin su alerta), antes de los tres grupos del índice.
- Una alerta con `sin_respuesta` o `necesito_ayuda` queda protegida mientras le quede algo por subir: sus campos o cualquiera de sus episodios, aunque los campos ya hayan subido. No está en el tercer grupo del índice («sin respuesta o con estoy_bien»), y sus episodios son la lectura del golpe de quien no pudo contestar.
- `almacenIndexedDb` resuelve cada operación en el `oncomplete` de la transacción, no en el `onsuccess` del pedido: recién ahí está escrito.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá la sección `[V5]` antes del resultado. El almacén en memoria copia al entrar y al salir, como IndexedDB, para que ninguna prueba pase por modificar una entrada guardada por referencia.

En `scripts/prueba-viaje.mjs`, reemplazá la línea del resultado:

```js
/* ---------- Resultado ---------- */
```

por:

```js
await seccion('V5', 'Cola de viaje', async () => {
  const { crearColaViaje } = await import('../lib/cola-viaje.ts')

  const AHORA = Date.UTC(2026, 8, 16, 17, 30)
  const ISO = new Date(AHORA).toISOString()
  const UN_DIA = 24 * 60 * 60 * 1000

  /** Copia al entrar y al salir, como IndexedDB: nadie modifica una entrada guardada por referencia. */
  function almacenEnMemoria() {
    const mapa = new Map()
    return {
      mapa,
      todas: async () => [...mapa.values()].map((e) => structuredClone(e)),
      poner: async (e) => {
        mapa.set(e.clave, structuredClone(e))
      },
      sacar: async (clave) => {
        mapa.delete(clave)
      },
      vaciar: async () => {
        mapa.clear()
      },
    }
  }

  function campos(id, respuestas = []) {
    return {
      id_cliente: id, aviso_version: '2026-09-16', version_motor: 1, plataforma: 'android', standalone: false,
      ocurrido_en_telefono: ISO, enviado_en: ISO, apertura: 'episodio', nivel_cliente: 'sospecha', alerta_mostrada: true,
      sonido: true, respuestas: respuestas.map((respuesta) => ({ respuesta, en_telefono: ISO })), hubo_choque: null,
      ms_hasta_respuesta: null, hz_medido: 60, aceleracion_derivada: false, gps: null, umbrales_cliente: { sospechaG: 4 },
    }
  }

  function episodio(n, filas = 3) {
    return {
      n, ocurrido_en_telefono: ISO, disparador: 'golpe', fuente: 'confiable', hz_medido: 60,
      veredicto_cliente: { nivel: 'sospecha', picoG: 6, motivo: 'prueba' },
      serie: Array.from({ length: filas }, (_, i) => [i * 16.7, 0.123, 0.456, 0.789, 1.001, 2.5, 0.012]),
      velocidades: [],
    }
  }

  function lote(id) {
    return { aviso_version: '2026-09-16', version_motor: 1, plataforma: 'android', enviado_en: ISO, eventos: [[id, 'frenada', ISO, 58.4, 30.2, 1800, 0.52, 0.61]] }
  }

  /** decidir(ruta, cuerpo, número de pedido) → una RespuestaEnvioViaje o 'sin_red'. */
  function enviador(decidir = () => ({ status: 201, cuerpo: { id: 'TEL-AAAAAA' }, reintentarEnS: null })) {
    const pedidos = []
    const enviar = async (ruta, cuerpo) => {
      const leido = JSON.parse(cuerpo)
      pedidos.push({ ruta, cuerpo: leido })
      const r = decidir(ruta, leido, pedidos.length)
      if (r === 'sin_red') throw new TypeError('Failed to fetch')
      return r
    }
    return { pedidos, enviar }
  }

  const avisos = []
  const warnOriginal = console.warn
  console.warn = (...args) => avisos.push(args.join(' '))
  try {
    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('alerta-0001', campos('alerta-0001'), AHORA)
      verificar('la alerta queda guardada antes de cualquier envío', almacen.mapa.has('alerta:alerta-0001'))
      await cola.guardarEpisodio('alerta-0001', episodio(2), AHORA)
      await cola.guardarEpisodio('alerta-0001', episodio(1), AHORA)
      await cola.guardarConduccion(lote('0b8f2d9e-6c4a-4a1b-8e3f-2d1c0b9a8e7f'), AHORA - 1000)
      verificar('pendientes cuenta la alerta, los dos episodios y el lote', (await cola.pendientes()) === 4)
      const e = enviador()
      const r = await cola.drenar(e.enviar, AHORA + 500)
      verificar('drena de a un pedido: dos episodios y el lote', e.pedidos.length === 3, JSON.stringify(e.pedidos.map((p) => p.ruta)))
      verificar('cada pedido de telemetría lleva los campos de la alerta', e.pedidos.slice(0, 2).every((p) => p.ruta === '/api/telemetria' && p.cuerpo.campos.id_cliente === 'alerta-0001'))
      verificar('los episodios suben en orden de n, uno por pedido', e.pedidos[0].cuerpo.episodio?.n === 1 && e.pedidos[1].cuerpo.episodio?.n === 2)
      verificar('enviado_en se sella al enviar', e.pedidos[0].cuerpo.campos.enviado_en === new Date(AHORA + 500).toISOString())
      verificar('los lotes de conducción suben después de las alertas', e.pedidos[2].ruta === '/api/conduccion')
      verificar('el resultado cuenta las subidas y no quedan pendientes', r.subidas === 3 && r.pendientes === 0 && r.sinRed === false, JSON.stringify(r))
      verificar('guarda el id del servidor', (await cola.idServidor('alerta-0001')) === 'TEL-AAAAAA')
      verificar('la alerta subida se conserva para tener su id', almacen.mapa.has('alerta:alerta-0001'))

      await cola.guardarAlerta('alerta-0001', campos('alerta-0001', ['estoy_bien']), AHORA + 1000)
      verificar('una versión nueva de la alerta vuelve a quedar pendiente', (await cola.pendientes()) === 1)
      const e2 = enviador()
      await cola.drenar(e2.enviar, AHORA + 1000)
      verificar('la alerta sin episodios pendientes sube con episodio null', e2.pedidos.length === 1 && e2.pedidos[0].cuerpo.episodio === null && e2.pedidos[0].cuerpo.campos.respuestas[0]?.respuesta === 'estoy_bien')

      const e3 = enviador()
      await cola.drenar(e3.enviar, AHORA + UN_DIA)
      verificar('las alertas subidas se borran a las 24 horas', !almacen.mapa.has('alerta:alerta-0001') && e3.pedidos.length === 0)
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('alerta-0002', campos('alerta-0002', ['sin_respuesta']), AHORA)
      const sinRed = enviador(() => 'sin_red')
      const r = await cola.drenar(sinRed.enviar, AHORA)
      verificar('sin red: sinRed true y la alerta sigue pendiente', r.sinRed === true && r.pendientes === 1 && r.subidas === 0)
      verificar('sin red: intentos + 1 y retroceso de 5000 · 2^intentos', almacen.mapa.get('alerta:alerta-0002').intentos === 1 && almacen.mapa.get('alerta:alerta-0002').proximoIntentoEn === AHORA + 10_000)
      const antes = enviador()
      await cola.drenar(antes.enviar, AHORA + 9_999)
      verificar('no se reintenta antes del retroceso', antes.pedidos.length === 0)
      const despues = enviador(() => ({ status: 503, cuerpo: { error: 'base caída' }, reintentarEnS: null }))
      await cola.drenar(despues.enviar, AHORA + 10_000)
      verificar('5xx: se reintenta al vencer y duplica la espera', despues.pedidos.length === 1 && almacen.mapa.get('alerta:alerta-0002').proximoIntentoEn === AHORA + 10_000 + 20_000)
      const solo = enviador()
      await cola.drenar(solo.enviar, AHORA + 10_001, 'alerta-0002')
      verificar('con soloAlerta sube esa alerta sin esperar el retroceso', solo.pedidos.length === 1 && (await cola.idServidor('alerta-0002')) === 'TEL-AAAAAA')
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('alerta-0003', campos('alerta-0003'), AHORA)
      await cola.guardarAlerta('alerta-0004', campos('alerta-0004'), AHORA + 1)
      await cola.guardarConduccion(lote('5a1e3c7b-9d2f-4b6a-8c0e-1f2a3b4c5d6e'), AHORA + 2)
      const e = enviador((ruta, cuerpo) => (cuerpo.campos?.id_cliente === 'alerta-0004' ? { status: 201, cuerpo: { id: 'TEL-BBBBBB' }, reintentarEnS: null } : ruta === '/api/conduccion' ? { status: 201, cuerpo: { ok: true }, reintentarEnS: null } : { status: 201, cuerpo: { id: 'TEL-CCCCCC' }, reintentarEnS: null }))
      await cola.drenar(e.enviar, AHORA + 5, 'alerta-0004')
      verificar('con soloAlerta no sube otras alertas ni lotes', e.pedidos.length === 1 && e.pedidos[0].cuerpo.campos.id_cliente === 'alerta-0004')
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('alerta-0005', campos('alerta-0005'), AHORA)
      const e = enviador(() => ({ status: 429, cuerpo: { error: 'Esperá 37 segundos.', tipo: 'limite', reintentar_en_s: 37 }, reintentarEnS: 37 }))
      await cola.drenar(e.enviar, AHORA)
      const antes = enviador()
      await cola.drenar(antes.enviar, AHORA + 36_999)
      const despues = enviador()
      await cola.drenar(despues.enviar, AHORA + 37_000)
      verificar('429: espera exactamente Retry-After', e.pedidos.length === 1 && antes.pedidos.length === 0 && despues.pedidos.length === 1)
    }

    for (const [nombre, respuesta] of [
      ['400 transporte en serie[12].t', { status: 400, cuerpo: { error: 'serie[12].t no crece respecto de la muestra anterior', tipo: 'transporte', campo: 'serie[12].t' }, reintentarEnS: null }],
      ['413', { status: 413, cuerpo: { error: 'El pedido supera los 128 KB que acepta esta ruta: mandá menos datos por envío.', tipo: 'cuerpo' }, reintentarEnS: null }],
    ]) {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('alerta-0006', campos('alerta-0006', ['necesito_ayuda']), AHORA)
      await cola.guardarEpisodio('alerta-0006', episodio(1), AHORA)
      const e = enviador((ruta, cuerpo) => (cuerpo.episodio ? respuesta : { status: 201, cuerpo: { id: 'TEL-DDDDDD' }, reintentarEnS: null }))
      const r = await cola.drenar(e.enviar, AHORA)
      verificar(`${nombre} sobre un pedido con episodio: se borra el episodio`, !almacen.mapa.has('episodio:alerta-0006:1'))
      verificar(`${nombre}: la alerta sube con episodio null en el mismo drenado`, e.pedidos.length === 2 && e.pedidos[1].cuerpo.episodio === null && r.pendientes === 0)
      verificar(`${nombre}: la alerta no queda rechazada`, almacen.mapa.get('alerta:alerta-0006').rechazada === false && (await cola.idServidor('alerta-0006')) === 'TEL-DDDDDD')
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('alerta-0007', campos('alerta-0007'), AHORA)
      await cola.guardarEpisodio('alerta-0007', episodio(1), AHORA)
      avisos.length = 0
      const e = enviador(() => ({ status: 400, cuerpo: { error: 'campos.plataforma tiene que ser uno de: ios, android, otro', tipo: 'transporte', campo: 'campos.plataforma' }, reintentarEnS: null }))
      await cola.drenar(e.enviar, AHORA)
      verificar('400 sobre campos.plataforma: la alerta queda rechazada', almacen.mapa.get('alerta:alerta-0007').rechazada === true && e.pedidos.length === 1)
      verificar('y se avisa en la consola', avisos.some((a) => a.includes('[cola-viaje] rechazado') && a.includes('400')))
      const otra = enviador()
      await cola.drenar(otra.enviar, AHORA + 600_000)
      verificar('una alerta rechazada no se reintenta', otra.pedidos.length === 0 && (await cola.pendientes()) === 0)
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarConduccion(lote('0b8f2d9e-6c4a-4a1b-8e3f-2d1c0b9a8e70'), AHORA)
      await cola.guardarConduccion(lote('0b8f2d9e-6c4a-4a1b-8e3f-2d1c0b9a8e71'), AHORA + 1)
      const e = enviador((ruta, cuerpo) => (cuerpo.eventos[0][0].endsWith('70') ? { status: 400, cuerpo: { error: 'eventos[0].kmh_inicial está fuera de rango (0 a 300)', tipo: 'transporte', campo: 'eventos[0].kmh_inicial' }, reintentarEnS: null } : { status: 500, cuerpo: null, reintentarEnS: null }))
      await cola.drenar(e.enviar, AHORA + 2)
      verificar('un lote con 4xx se borra', !almacen.mapa.has('conduccion:0b8f2d9e-6c4a-4a1b-8e3f-2d1c0b9a8e70'))
      verificar('un lote con 5xx queda con retroceso', almacen.mapa.get('conduccion:0b8f2d9e-6c4a-4a1b-8e3f-2d1c0b9a8e71')?.proximoIntentoEn === AHORA + 2 + 10_000)
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('subida-01', campos('subida-01'), AHORA)
      await cola.drenar(enviador().enviar, AHORA)
      for (let i = 0; i < 3; i++) await cola.guardarConduccion(lote(`0b8f2d9e-6c4a-4a1b-8e3f-00000000000${i}`), AHORA + 10 + i)
      for (let i = 0; i < 8; i++) await cola.guardarAlerta(`ayuda-0${i}`, campos(`ayuda-0${i}`, ['necesito_ayuda']), AHORA + 20 + i)
      for (let i = 0; i < 4; i++) await cola.guardarAlerta(`bien-000${i}`, campos(`bien-000${i}`, ['estoy_bien']), AHORA + 40 + i)
      for (let i = 0; i < 4; i++) await cola.guardarAlerta(`nueva-00${i}`, campos(`nueva-00${i}`), AHORA + 60 + i)
      verificar('con 20 entradas no se descarta nada', almacen.mapa.size === 20)
      await cola.guardarAlerta('ayuda-99', campos('ayuda-99', ['sin_respuesta']), AHORA + 80)
      verificar('al pasarse descarta primero la alerta ya subida', almacen.mapa.size === 20 && !almacen.mapa.has('alerta:subida-01'))
      await cola.guardarAlerta('ayuda-98', campos('ayuda-98', ['sin_respuesta']), AHORA + 81)
      verificar('después, el lote de conducción más viejo', almacen.mapa.size === 20 && !almacen.mapa.has('conduccion:0b8f2d9e-6c4a-4a1b-8e3f-000000000000') && almacen.mapa.has('conduccion:0b8f2d9e-6c4a-4a1b-8e3f-000000000001'))
      await cola.guardarAlerta('ayuda-97', campos('ayuda-97', ['sin_respuesta']), AHORA + 82)
      await cola.guardarAlerta('ayuda-96', campos('ayuda-96', ['sin_respuesta']), AHORA + 83)
      await cola.guardarEpisodio('bien-0000', episodio(1), AHORA + 84)
      verificar('después, la alerta pendiente más vieja con estoy_bien, con sus episodios', !almacen.mapa.has('alerta:bien-0000') && !almacen.mapa.has('episodio:bien-0000:1') && almacen.mapa.has('alerta:bien-0001'))
      for (let i = 0; i < 12; i++) await cola.guardarAlerta(`ayuda-8${i}`, campos(`ayuda-8${i}`, ['necesito_ayuda']), AHORA + 100 + i)
      const quedan = [...almacen.mapa.values()]
      verificar('nunca descarta una alerta con sin_respuesta o necesito_ayuda pendiente: acepta pasarse del tope', quedan.length > 20 && quedan.every((e) => e.tipo === 'alerta' && e.campos.respuestas.some((r) => r.respuesta !== 'estoy_bien')), String(quedan.length))
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('ayuda-subida', campos('ayuda-subida', ['necesito_ayuda']), AHORA)
      await cola.drenar(enviador().enviar, AHORA)
      await cola.guardarEpisodio('ayuda-subida', episodio(2), AHORA + 1)
      for (let i = 0; i < 18; i++) await cola.guardarAlerta(`nueva-1${String(i).padStart(2, '0')}`, campos(`nueva-1${String(i).padStart(2, '0')}`), AHORA + 10 + i)
      await cola.guardarAlerta('nueva-199', campos('nueva-199'), AHORA + 50)
      verificar('una alerta con necesito_ayuda ya subida no se descarta mientras le quede un episodio por subir', almacen.mapa.size === 20 && almacen.mapa.has('alerta:ayuda-subida') && almacen.mapa.has('episodio:ayuda-subida:2') && !almacen.mapa.has('alerta:nueva-100'), JSON.stringify([...almacen.mapa.keys()]))
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('grande-01', campos('grande-01'), AHORA)
      await cola.guardarEpisodio('grande-01', episodio(1, 24_000), AHORA)
      await cola.guardarAlerta('grande-02', campos('grande-02', ['necesito_ayuda']), AHORA + 1)
      await cola.guardarEpisodio('grande-02', episodio(1, 24_000), AHORA + 1)
      const bytes = [...almacen.mapa.values()].reduce((s, e) => s + e.bytes, 0)
      verificar('el tope de 2 MB cuenta los bytes de cada entrada', !almacen.mapa.has('alerta:grande-01') && almacen.mapa.has('episodio:grande-02:1') && bytes <= 2 * 1024 * 1024, String(bytes))
    }

    {
      const almacen = almacenEnMemoria()
      const cola = crearColaViaje(almacen)
      await cola.guardarAlerta('borrar-01', campos('borrar-01'), AHORA)
      await cola.vaciar()
      verificar('vaciar borra todo', almacen.mapa.size === 0 && (await cola.pendientes()) === 0)
    }
  } finally {
    console.warn = warnOriginal
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V5 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V5'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. El archivo de la cola todavía no existe. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA [V5] terminó sin excepciones Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\lib\cola-viaje.ts' imported from C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\prueba-viaje.mjs
```

y al final:

```text
0/1 verificaciones pasaron
1 FALLARON
```

- [ ] **Step 3: Crear `lib/cola-viaje.ts`**

Creá `lib/cola-viaje.ts` con este contenido completo:

```ts
/**
 * Cola del modo viaje, en el teléfono: alertas, episodios y lotes de conducción.
 *
 * Se escribe ANTES de cualquier envío. Una alerta que se abre sin señal —en una ruta, en un
 * sótano, con el teléfono en modo avión durante la cuenta— tiene que llegar al servidor
 * cuando vuelva la señal, con la respuesta que dio la persona, aunque la aplicación se haya
 * cerrado en el medio. Por eso nada viaja directo: todo pasa por acá.
 *
 * La política (tope, descarte, orden y retroceso) es pura sobre un almacén inyectado, para
 * probarla en Node con un Map. El adaptador de IndexedDB es fino a propósito: en Node no hay
 * IndexedDB y no se suman dependencias para simularlo.
 *
 * Está separada de `acta-cola` (lib/cola.ts): aquella guarda la evidencia de una actuación y
 * ésta la telemetría del modo viaje. Mezclarlas haría que el tope de una descarte la otra.
 */

import type { CamposAlerta, EpisodioTransportado, LoteConduccion } from './transporte-viaje'

interface BaseEntrada {
  /** 'alerta:<idCliente>' · 'episodio:<idCliente>:<n>' · 'conduccion:<uuid>'. keyPath del almacén. */
  clave: string
  /** Pared ms. */
  creadaEn: number
  intentos: number
  /** Pared ms antes del cual no se reintenta. */
  proximoIntentoEn: number
  /** JSON.stringify(entrada).length, para el tope de 2 MB. */
  bytes: number
}

export interface EntradaAlertaViaje extends BaseEntrada {
  tipo: 'alerta'
  idCliente: string
  campos: CamposAlerta
  /** Sube con cada guardarAlerta; la alerta queda pendiente mientras la versión subida sea menor. */
  version: number
  versionSubida: number
  /** TEL-XXXXXX cuando el servidor respondió 2xx. */
  idServidor: string | null
  /** true si el servidor la rechazó con un 4xx distinto de 429 que no se explica por el episodio (ver drenar): no se reintenta. */
  rechazada: boolean
}

export interface EntradaEpisodioViaje extends BaseEntrada {
  tipo: 'episodio'
  idCliente: string
  n: number
  episodio: EpisodioTransportado
}

export interface EntradaConduccionViaje extends BaseEntrada {
  tipo: 'conduccion'
  lote: LoteConduccion
}

export type EntradaColaViaje = EntradaAlertaViaje | EntradaEpisodioViaje | EntradaConduccionViaje

/** Dónde viven las entradas: IndexedDB en el navegador, un Map en las pruebas. */
export interface AlmacenColaViaje {
  todas(): Promise<EntradaColaViaje[]>
  poner(entrada: EntradaColaViaje): Promise<void>
  sacar(clave: string): Promise<void>
  vaciar(): Promise<void>
}

export interface RespuestaEnvioViaje {
  status: number
  /** El JSON de la respuesta, o null si no se pudo leer. */
  cuerpo: unknown
  /** Retry-After en segundos si vino; null si no. */
  reintentarEnS: number | null
}

/** Manda un cuerpo (string) por POST. Rechaza (throw) sólo si no hubo red. */
export type EnviarViaje = (ruta: '/api/telemetria' | '/api/conduccion', cuerpo: string) => Promise<RespuestaEnvioViaje>

export interface ResultadoDrenadoViaje {
  subidas: number
  pendientes: number
  /** true si algún envío rechazó por falta de red. */
  sinRed: boolean
}

export interface ColaViaje {
  /** Crea o reemplaza los campos de la alerta y sube su versión. Se escribe ANTES de cualquier envío. */
  guardarAlerta(idCliente: string, campos: CamposAlerta, ahora: number): Promise<void>
  guardarEpisodio(idCliente: string, episodio: EpisodioTransportado, ahora: number): Promise<void>
  guardarConduccion(lote: LoteConduccion, ahora: number): Promise<void>
  /** El id del servidor de esa alerta, si ya subió. */
  idServidor(idCliente: string): Promise<string | null>
  /**
   * De a un pedido por vez. Cada POST /api/telemetria lleva los campos vigentes (con enviado_en = ahora en ISO)
   * y, si hay, UN episodio pendiente de esa alerta (el de menor n): así ningún episodio sube antes que su alerta.
   * Una alerta sin episodios pendientes pero con versión nueva sube con episodio null. Después, los lotes de
   * conducción. 2xx: guarda idServidor y versionSubida, borra el episodio o el lote. 429: proximoIntentoEn =
   * ahora + reintentarEnS·1000. Si el pedido llevaba un episodio y la respuesta es 413, o 400 con tipo 'transporte'
   * y un campo que no empieza con 'campos.': se borra ese episodio (console.warn('[cola-viaje] episodio rechazado',
   * status, clave)) y la alerta se reintenta enseguida en el mismo drenado con episodio null, así un episodio malo
   * nunca deja sin subir una alerta con necesito_ayuda o sin_respuesta. Sólo un 4xx sobre 'campos.*' (o cualquier
   * otro 4xx de un pedido sin episodio) marca la alerta como rechazada; un lote con 4xx se borra. En los dos casos,
   * console.warn('[cola-viaje] rechazado', status, clave). 5xx o sin red: intentos + 1 y proximoIntentoEn =
   * ahora + min(300 000, 5000 · 2^intentos). Con `soloAlerta`, sube sólo esa alerta y sus episodios, sin
   * esperar el retroceso.
   */
  drenar(enviar: EnviarViaje, ahora: number, soloAlerta?: string): Promise<ResultadoDrenadoViaje>
  /** Entradas que todavía tienen algo para subir. */
  pendientes(): Promise<number>
  /** Borra todo («Borrar mis registros del modo viaje»). */
  vaciar(): Promise<void>
}

const TOPE_ENTRADAS = 20
const TOPE_BYTES = 2 * 1024 * 1024
/** Las alertas subidas se guardan un día: es lo que dura la posesión por huella sin sesión (§5.1). */
const CONSERVAR_SUBIDA_MS = 24 * 60 * 60 * 1000
const RETROCESO_BASE_MS = 5000
const RETROCESO_MAX_MS = 300_000
/** Un 429 sin Retry-After espera un minuto: el limitador del servidor cuenta por minuto. */
const ESPERA_429_S = 60
/** Freno de seguridad: ningún drenado razonable hace tantos pedidos seguidos. */
const MAX_PEDIDOS_POR_DRENADO = 200

const claveAlerta = (idCliente: string) => `alerta:${idCliente}`
const claveEpisodio = (idCliente: string, n: number) => `episodio:${idCliente}:${n}`

function conBytes<T extends EntradaColaViaje>(entrada: T): T {
  const sinBytes = { ...entrada, bytes: 0 }
  return { ...entrada, bytes: JSON.stringify(sinBytes).length }
}

function esAlerta(e: EntradaColaViaje): e is EntradaAlertaViaje {
  return e.tipo === 'alerta'
}

function esEpisodio(e: EntradaColaViaje): e is EntradaEpisodioViaje {
  return e.tipo === 'episodio'
}

function esLote(e: EntradaColaViaje): e is EntradaConduccionViaje {
  return e.tipo === 'conduccion'
}

const porAntiguedad = (a: EntradaColaViaje, b: EntradaColaViaje) => a.creadaEn - b.creadaEn || (a.clave < b.clave ? -1 : 1)

function episodiosDe(todas: readonly EntradaColaViaje[], idCliente: string): EntradaEpisodioViaje[] {
  return todas.filter(esEpisodio).filter((e) => e.idCliente === idCliente).sort((a, b) => a.n - b.n)
}

/**
 * Una alerta que pide ayuda (o no respondió) no se descarta nunca, ni sus episodios, mientras le quede algo
 * por subir: sus campos o cualquiera de sus episodios. Los episodios son la lectura del golpe de quien no pudo
 * contestar, lo último que conviene perder.
 */
function protegida(alerta: EntradaAlertaViaje, todas: readonly EntradaColaViaje[]): boolean {
  if (alerta.rechazada) return false
  if (!alerta.campos.respuestas.some((r) => r.respuesta === 'sin_respuesta' || r.respuesta === 'necesito_ayuda')) return false
  return alerta.version > alerta.versionSubida || episodiosDe(todas, alerta.idCliente).length > 0
}

function retroceso(intentos: number): number {
  return Math.min(RETROCESO_MAX_MS, RETROCESO_BASE_MS * 2 ** intentos)
}

function textoDe(cuerpo: unknown, clave: string): string | null {
  if (typeof cuerpo !== 'object' || cuerpo === null) return null
  const valor = (cuerpo as Record<string, unknown>)[clave]
  return typeof valor === 'string' ? valor : null
}

type Pedido =
  | { tipo: 'alerta'; alerta: EntradaAlertaViaje; episodio: EntradaEpisodioViaje | null }
  | { tipo: 'conduccion'; lote: EntradaConduccionViaje }

export function crearColaViaje(almacen: AlmacenColaViaje): ColaViaje {
  /*
   * Las lecturas y escrituras van en fila. drenar lee una entrada, espera la red y escribe el
   * resultado: si en el medio el motor guardó una respuesta nueva, escribir la entrada vieja la
   * borraría. Por eso el resultado se aplica sobre la entrada fresca, dentro de esta fila, y la
   * espera de la red queda afuera (una alerta nueva no puede esperar a que responda el servidor).
   */
  let fila: Promise<unknown> = Promise.resolve()
  function exclusivo<T>(fn: () => Promise<T>): Promise<T> {
    const turno = fila.then(fn, fn)
    fila = turno.catch(() => undefined)
    return turno
  }

  /** Un solo drenado a la vez: dos en paralelo mandarían dos veces el mismo episodio. */
  let drenado: Promise<unknown> = Promise.resolve()

  async function aplicarTope(): Promise<void> {
    const todas = await almacen.todas()
    const vivas = new Map(todas.map((e) => [e.clave, e]))
    const total = () => [...vivas.values()].reduce((s, e) => s + e.bytes, 0)
    const sacar = async (clave: string) => {
      vivas.delete(clave)
      await almacen.sacar(clave)
    }
    while (vivas.size > TOPE_ENTRADAS || total() > TOPE_BYTES) {
      const actuales = [...vivas.values()].sort(porAntiguedad)
      const alertas = actuales.filter(esAlerta)
      const conAlerta = new Set(alertas.map((a) => a.idCliente))
      const huerfano = actuales.filter(esEpisodio).find((e) => !conAlerta.has(e.idCliente))
      if (huerfano) {
        await sacar(huerfano.clave)
        continue
      }
      const sinPendientes = (a: EntradaAlertaViaje) => episodiosDe(actuales, a.idCliente).length === 0
      const subida = alertas.find((a) => a.rechazada || (a.version === a.versionSubida && sinPendientes(a)))
      const lote = actuales.find(esLote)
      const descartable = alertas.find((a) => !protegida(a, actuales))
      const alerta = subida ?? (lote ? null : descartable)
      if (!alerta && lote) {
        await sacar(lote.clave)
        continue
      }
      if (!alerta) return
      for (const e of episodiosDe(actuales, alerta.idCliente)) await sacar(e.clave)
      await sacar(alerta.clave)
    }
  }

  async function limpiarVencidas(ahora: number): Promise<void> {
    const todas = await almacen.todas()
    for (const a of todas.filter(esAlerta)) {
      if (ahora - a.creadaEn < CONSERVAR_SUBIDA_MS) continue
      const episodios = episodiosDe(todas, a.idCliente)
      if (a.rechazada || (a.version === a.versionSubida && episodios.length === 0)) {
        for (const e of episodios) await almacen.sacar(e.clave)
        await almacen.sacar(a.clave)
      }
    }
  }

  function elegir(todas: readonly EntradaColaViaje[], ahora: number, soloAlerta: string | undefined, soloCampos: ReadonlySet<string>): Pedido | null {
    const alertas = todas.filter(esAlerta).filter((a) => !a.rechazada).sort(porAntiguedad)
    for (const alerta of alertas) {
      if (soloAlerta !== undefined ? alerta.idCliente !== soloAlerta : alerta.proximoIntentoEn > ahora) continue
      const episodio = soloCampos.has(alerta.idCliente) ? null : (episodiosDe(todas, alerta.idCliente)[0] ?? null)
      if (episodio || alerta.version > alerta.versionSubida) return { tipo: 'alerta', alerta, episodio }
    }
    if (soloAlerta !== undefined) return null
    const lote = todas.filter(esLote).filter((l) => l.proximoIntentoEn <= ahora).sort(porAntiguedad)[0]
    return lote ? { tipo: 'conduccion', lote } : null
  }

  async function fresca<T extends EntradaColaViaje>(clave: string): Promise<T | null> {
    return ((await almacen.todas()).find((e) => e.clave === clave) as T | undefined) ?? null
  }

  async function posponer(clave: string, ahora: number, esperaMs: number | null): Promise<void> {
    const entrada = await fresca<EntradaColaViaje>(clave)
    if (!entrada) return
    const intentos = esperaMs === null ? entrada.intentos + 1 : entrada.intentos
    const espera = esperaMs ?? retroceso(intentos)
    await almacen.poner(conBytes({ ...entrada, intentos, proximoIntentoEn: ahora + espera }))
  }

  async function drenarAhora(enviar: EnviarViaje, ahora: number, soloAlerta?: string): Promise<ResultadoDrenadoViaje> {
    let subidas = 0
    let sinRed = false
    const soloCampos = new Set<string>()
    await exclusivo(() => limpiarVencidas(ahora))
    for (let vuelta = 0; vuelta < MAX_PEDIDOS_POR_DRENADO; vuelta++) {
      const pedido = await exclusivo(async () => elegir(await almacen.todas(), ahora, soloAlerta, soloCampos))
      if (!pedido) break

      if (pedido.tipo === 'conduccion') {
        const clave = pedido.lote.clave
        let res: RespuestaEnvioViaje
        try {
          res = await enviar('/api/conduccion', JSON.stringify({ ...pedido.lote.lote, enviado_en: new Date(ahora).toISOString() }))
        } catch {
          sinRed = true
          await exclusivo(() => posponer(clave, ahora, null))
          break
        }
        if (res.status >= 200 && res.status < 300) {
          await exclusivo(() => almacen.sacar(clave))
          subidas++
        } else if (res.status === 429) {
          await exclusivo(() => posponer(clave, ahora, (res.reintentarEnS ?? ESPERA_429_S) * 1000))
          break
        } else if (res.status >= 400 && res.status < 500) {
          console.warn('[cola-viaje] rechazado', res.status, clave)
          await exclusivo(() => almacen.sacar(clave))
        } else {
          await exclusivo(() => posponer(clave, ahora, null))
        }
        continue
      }

      const { alerta, episodio } = pedido
      const versionEnviada = alerta.version
      const cuerpo = JSON.stringify({
        campos: { ...alerta.campos, enviado_en: new Date(ahora).toISOString() },
        episodio: episodio ? episodio.episodio : null,
      })
      let res: RespuestaEnvioViaje
      try {
        res = await enviar('/api/telemetria', cuerpo)
      } catch {
        sinRed = true
        await exclusivo(() => posponer(alerta.clave, ahora, null))
        break
      }

      if (res.status >= 200 && res.status < 300) {
        const id = textoDe(res.cuerpo, 'id')
        await exclusivo(async () => {
          const actual = await fresca<EntradaAlertaViaje>(alerta.clave)
          if (actual) {
            await almacen.poner(
              conBytes({
                ...actual,
                idServidor: id ?? actual.idServidor,
                versionSubida: Math.max(actual.versionSubida, versionEnviada),
                intentos: 0,
                proximoIntentoEn: ahora,
              }),
            )
          }
          if (episodio) await almacen.sacar(episodio.clave)
        })
        soloCampos.delete(alerta.idCliente)
        subidas++
        continue
      }

      if (res.status === 429) {
        await exclusivo(() => posponer(alerta.clave, ahora, (res.reintentarEnS ?? ESPERA_429_S) * 1000))
        break
      }

      if (res.status >= 400 && res.status < 500) {
        const campo = textoDe(res.cuerpo, 'campo')
        const culpaDeCampos = campo !== null && campo.startsWith('campos.')
        if (episodio && !culpaDeCampos) {
          console.warn('[cola-viaje] episodio rechazado', res.status, episodio.clave)
          await exclusivo(() => almacen.sacar(episodio.clave))
          if (alerta.version > alerta.versionSubida) soloCampos.add(alerta.idCliente)
          continue
        }
        console.warn('[cola-viaje] rechazado', res.status, alerta.clave)
        await exclusivo(async () => {
          const actual = await fresca<EntradaAlertaViaje>(alerta.clave)
          if (actual) await almacen.poner(conBytes({ ...actual, rechazada: true }))
        })
        continue
      }

      await exclusivo(() => posponer(alerta.clave, ahora, null))
      if (soloAlerta !== undefined) break
    }
    return { subidas, pendientes: await contarPendientes(), sinRed }
  }

  async function contarPendientes(): Promise<number> {
    return exclusivo(async () => {
      const todas = await almacen.todas()
      const rechazadas = new Set(todas.filter(esAlerta).filter((a) => a.rechazada).map((a) => a.idCliente))
      return todas.filter((e) => {
        if (esAlerta(e)) return !e.rechazada && e.version > e.versionSubida
        if (esEpisodio(e)) return !rechazadas.has(e.idCliente)
        return true
      }).length
    })
  }

  return {
    guardarAlerta(idCliente, campos, ahora) {
      return exclusivo(async () => {
        const previa = await fresca<EntradaAlertaViaje>(claveAlerta(idCliente))
        const entrada: EntradaAlertaViaje = previa
          ? {
              ...previa,
              campos,
              version: previa.version + 1,
              // Una versión nueva (una respuesta, hubo_choque) merece otro intento aunque la anterior
              // se haya rechazado o esté esperando: puede ser justo la que pide ayuda.
              rechazada: false,
              proximoIntentoEn: ahora,
            }
          : {
              tipo: 'alerta',
              clave: claveAlerta(idCliente),
              creadaEn: ahora,
              intentos: 0,
              proximoIntentoEn: ahora,
              bytes: 0,
              idCliente,
              campos,
              version: 1,
              versionSubida: 0,
              idServidor: null,
              rechazada: false,
            }
        await almacen.poner(conBytes(entrada))
        await aplicarTope()
      })
    },

    guardarEpisodio(idCliente, episodio, ahora) {
      return exclusivo(async () => {
        const entrada: EntradaEpisodioViaje = {
          tipo: 'episodio',
          clave: claveEpisodio(idCliente, episodio.n),
          creadaEn: ahora,
          intentos: 0,
          proximoIntentoEn: ahora,
          bytes: 0,
          idCliente,
          n: episodio.n,
          episodio,
        }
        await almacen.poner(conBytes(entrada))
        await aplicarTope()
      })
    },

    guardarConduccion(lote, ahora) {
      return exclusivo(async () => {
        // El id del primer evento ya es un UUID único: sirve de clave sin generar otro.
        const primero = lote.eventos[0]?.[0] ?? String(ahora)
        const entrada: EntradaConduccionViaje = {
          tipo: 'conduccion',
          clave: `conduccion:${primero}`,
          creadaEn: ahora,
          intentos: 0,
          proximoIntentoEn: ahora,
          bytes: 0,
          lote,
        }
        await almacen.poner(conBytes(entrada))
        await aplicarTope()
      })
    },

    idServidor(idCliente) {
      return exclusivo(async () => (await fresca<EntradaAlertaViaje>(claveAlerta(idCliente)))?.idServidor ?? null)
    },

    drenar(enviar, ahora, soloAlerta) {
      const turno = drenado.then(
        () => drenarAhora(enviar, ahora, soloAlerta),
        () => drenarAhora(enviar, ahora, soloAlerta),
      )
      drenado = turno.catch(() => undefined)
      return turno
    },

    pendientes: contarPendientes,

    vaciar() {
      return exclusivo(() => almacen.vaciar())
    },
  }
}

const BASE = 'acta-viaje'
const ALMACEN = 'entradas'
const SIN_INDEXEDDB = 'Este navegador no tiene IndexedDB: la cola del modo viaje no puede guardar nada.'

/** IndexedDB: base 'acta-viaje', versión 1, almacén 'entradas' con keyPath 'clave', sin índices. Usa window.indexedDB recién al llamarse; sin IndexedDB, cada método rechaza con Error('Este navegador no tiene IndexedDB: la cola del modo viaje no puede guardar nada.'). */
export function almacenIndexedDb(): AlmacenColaViaje {
  function abrir(): Promise<IDBDatabase> {
    const idb = typeof window === 'undefined' ? undefined : window.indexedDB
    if (!idb) return Promise.reject(new Error(SIN_INDEXEDDB))
    return new Promise((resolver, rechazar) => {
      const pedido = idb.open(BASE, 1)
      pedido.onupgradeneeded = () => {
        const db = pedido.result
        if (!db.objectStoreNames.contains(ALMACEN)) db.createObjectStore(ALMACEN, { keyPath: 'clave' })
      }
      pedido.onsuccess = () => resolver(pedido.result)
      pedido.onerror = () => rechazar(pedido.error ?? new Error('No se pudo abrir la cola del modo viaje: revisá que el navegador no esté en navegación privada.'))
    })
  }

  /** Resuelve al completarse la transacción, no al terminar el pedido: recién ahí está escrito. */
  function operar<T>(modo: IDBTransactionMode, fn: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
    return abrir().then(
      (db) =>
        new Promise<T>((resolver, rechazar) => {
          const tx = db.transaction(ALMACEN, modo)
          const pedido = fn(tx.objectStore(ALMACEN))
          tx.oncomplete = () => {
            db.close()
            resolver(pedido.result)
          }
          tx.onerror = () => {
            db.close()
            rechazar(tx.error ?? new Error('Falló la cola del modo viaje al escribir en el teléfono.'))
          }
          tx.onabort = () => {
            db.close()
            rechazar(tx.error ?? new Error('Falló la cola del modo viaje al escribir en el teléfono.'))
          }
        }),
    )
  }

  return {
    todas: () => operar('readonly', (a) => a.getAll() as IDBRequest<EntradaColaViaje[]>),
    poner: (entrada) => operar('readwrite', (a) => a.put(entrada)).then(() => undefined),
    sacar: (clave) => operar('readwrite', (a) => a.delete(clave)).then(() => undefined),
    vaciar: () => operar('readwrite', (a) => a.clear()).then(() => undefined),
  }
}
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `SECCION=V5 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V5'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   la alerta queda guardada antes de cualquier envío
  ok   pendientes cuenta la alerta, los dos episodios y el lote
  ok   drena de a un pedido: dos episodios y el lote
  ok   cada pedido de telemetría lleva los campos de la alerta
  ok   los episodios suben en orden de n, uno por pedido
  ok   enviado_en se sella al enviar
  ok   los lotes de conducción suben después de las alertas
  ok   el resultado cuenta las subidas y no quedan pendientes
  ok   guarda el id del servidor
  ok   la alerta subida se conserva para tener su id
  ok   una versión nueva de la alerta vuelve a quedar pendiente
  ok   la alerta sin episodios pendientes sube con episodio null
  ok   las alertas subidas se borran a las 24 horas
  ok   sin red: sinRed true y la alerta sigue pendiente
  ok   sin red: intentos + 1 y retroceso de 5000 · 2^intentos
  ok   no se reintenta antes del retroceso
  ok   5xx: se reintenta al vencer y duplica la espera
  ok   con soloAlerta sube esa alerta sin esperar el retroceso
  ok   con soloAlerta no sube otras alertas ni lotes
  ok   429: espera exactamente Retry-After
  ok   400 transporte en serie[12].t sobre un pedido con episodio: se borra el episodio
  ok   400 transporte en serie[12].t: la alerta sube con episodio null en el mismo drenado
  ok   400 transporte en serie[12].t: la alerta no queda rechazada
  ok   413 sobre un pedido con episodio: se borra el episodio
  ok   413: la alerta sube con episodio null en el mismo drenado
  ok   413: la alerta no queda rechazada
  ok   400 sobre campos.plataforma: la alerta queda rechazada
  ok   y se avisa en la consola
  ok   una alerta rechazada no se reintenta
  ok   un lote con 4xx se borra
  ok   un lote con 5xx queda con retroceso
  ok   con 20 entradas no se descarta nada
  ok   al pasarse descarta primero la alerta ya subida
  ok   después, el lote de conducción más viejo
  ok   después, la alerta pendiente más vieja con estoy_bien, con sus episodios
  ok   nunca descarta una alerta con sin_respuesta o necesito_ayuda pendiente: acepta pasarse del tope
  ok   una alerta con necesito_ayuda ya subida no se descarta mientras le quede un episodio por subir
  ok   el tope de 2 MB cuenta los bytes de cada entrada
  ok   vaciar borra todo
```

y al final:

```text
39/39 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 6: Commit**

```bash
git add "lib/cola-viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Guardar las alertas del modo viaje en el teléfono antes de mandarlas

Una alerta que se abre sin señal tiene que llegar al servidor cuando vuelva, con la
respuesta que dio la persona, aunque la aplicación se cierre en el medio. La cola escribe
antes de cualquier envío, sube de a un pedido con la alerta antes que sus episodios,
reintenta con retroceso y respeta el Retry-After. Un episodio que el servidor rechaza se
descarta sin arrastrar a su alerta, y al pasarse del tope nunca se descarta una alerta
con necesito_ayuda o sin_respuesta pendiente.

La política es pura sobre un almacén inyectado y se prueba en Node con un Map; el
adaptador de IndexedDB es fino a propósito.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `scripts/fuentes-falsas.mjs`: navegador, reloj y servidor falsos para probar el motor en Node

**Files:**
- Create: `scripts/fuentes-falsas.mjs`
- Modify: `scripts/prueba-viaje.mjs` — la línea `/* ---------- Resultado ---------- */` (queda después de la sección `[V5]` de la Tarea 1)
- Test: `scripts/prueba-viaje.mjs`, sección `[V6] Motor: encendido, gesto, reanudación, rutas y ventanas` (su primer bloque prueba las fuentes falsas mismas)

**Interfaces:**
- Consumes:
  - `crearColaViaje(almacen: AlmacenColaViaje): ColaViaje` (Tarea 1), sobre un almacén en memoria.
- Produces:
  - `crearRegistroCandados()` → `{ ocupados: Set<string> }`.
  - `crearServidorFalso(opciones?: { configuracion?, perfil? })` → `{ fetch(ruta, init): Promise<Response>, enLinea: boolean, alertas: Map<id_cliente, { id, campos, episodios: Map<n, episodio>, respuesta, respuestas, hubo_choque }>, lotesConduccion, casos: Array<{ id, secreto, cuerpo }>, configuracion, perfil, forzarEstado(ruta, status): void, pedidos: Array<{ ruta, metodo, cuerpo }> }`. Atiende `GET /api/telemetria/configuracion`, `POST /api/telemetria` (201 la primera vez, 200 después, con `id` `TEL-…`), `POST /api/telemetria/<id>/respuesta`, `DELETE /api/telemetria/mias`, `POST /api/conduccion`, `POST /api/casos` (con `vinculo_telemetria` sólo si vino `telemetria_id`) y `GET /api/perfil` (401 con `perfil: null`). Con `enLinea = false` rechaza con `TypeError('Failed to fetch')`. `forzarEstado` responde una sola vez `{ error: 'Respuesta forzada por la prueba.' }` con ese estado (con `Retry-After: 1` si es 429).
  - `crearFuentesFalsas(opciones?)` con las opciones y el retorno del índice («Pruebas: convenciones › Fuentes falsas»): `fuentes`, `reloj { mono, pared, avanzar(ms), saltarPared(ms), pendientes }`, `servidor`, `gesto(tipo = 'click')`, `ventana { despachar(tipo, datos), escuchas(tipo?) }`, `documento { ponerVisible(visible) }`, `movimiento { pedidos, emitir(muestra) }`, `geo { vigilancias, pedidos, emitirFix, emitirError }`, `wakeLock { pedidos, activos, autorizadoAntes, liberarPorSistema }`, `audio { destrabes, despertares, tonos, sonando, sesionTipo }`, `vibracion { patrones }`, `almacenamiento { mapa, cambiarDesdeOtraVentana }`, `reproducir(muestras, fixes)`, `limpio()` y `crearVentana()`.
  - `audio` suma dos campos que leen las pruebas de las Tareas 8 y 10: `pulsos` (cuántos `pulso()`) y `estadoContexto` (el `AudioContext.state` simulado: `suspended`, `running` o `closed`).

**Decisiones de esta tarea:**

- `reproducir(muestras, fixes)` recibe `MuestraMovimiento` y `FixGps` (los tipos de `lib/conduccion.ts`) y corre todos los tiempos para que el primer evento ocurra en el `mono()` actual: conserva los intervalos y la edad de cada fix (`llegadaPared − adquiridoPared`). Así una prueba arma una escena con tiempos desde 0 y la reproduce en cualquier momento.
- La cola de las fuentes es la real (`crearColaViaje`) sobre un `Map` que vive dentro de `almacenamiento.mapa`, bajo la clave `indexeddb:acta-viaje/entradas`, que el motor nunca lee. Pasar ese `Map` a otro juego de fuentes simula una recarga con todo lo guardado: `localStorage` e IndexedDB.
- El `EventTarget` falso registra una sola vez el mismo `(tipo, función, captura)`, como el real: si el motor agrega dos veces la misma escucha, `limpio()` no lo esconde.
- Wake lock: se concede si pasaron 5 s o menos desde el último gesto (`pointerup`, `touchend`, `click` o `keydown`; nunca `pointerdown`) o si este documento ya lo obtuvo (`autorizadoAntes`). Permiso de movimiento con `'NotAllowedError'`: rechaza sin un gesto reciente y concede con uno.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá la sección `[V6]` antes del resultado. Los ayudantes del comienzo (`quieta`, `terminar`, `encendido`, `intencionGuardada`, `INICIO_PARED` y las dos UA de iPhone) son de toda la sección: los usan los bloques que suman las Tareas 3 a 6 dentro de ella. En esta tarea se usan `crearFuentesFalsas`, `crearRegistroCandados` y `limpio`.

En `scripts/prueba-viaje.mjs`, reemplazá la línea del resultado:

```js
/* ---------- Resultado ---------- */
```

por:

```js
await seccion('V6', 'Motor: encendido, gesto, reanudación, rutas y ventanas', async () => {
  const { crearFuentesFalsas, crearRegistroCandados } = await import('./fuentes-falsas.mjs')

  const G = 9.80665
  /** Una muestra quieta: el teléfono en el soporte con el motor en marcha. */
  const quieta = (t) => ({ t, a: [0.02, 0.01, 0.03], aIG: [0.02, 0.01, G + 0.03], giro: [1, 1, 1] })
  const limpio = (falsas) => {
    const l = falsas.limpio()
    return l.temporizadores === 0 && l.escuchas === 0 && l.vigilancias === 0 && l.centinelas === 0
  }
  /** Destruye el motor y verifica que no quedó nada colgado: cada prueba termina así. */
  function terminar(nombre, motor, falsas) {
    motor.destruir()
    verificar(`${nombre}: sin temporizadores, escuchas, vigilancias ni centinelas al terminar`, limpio(falsas), JSON.stringify(falsas.limpio()))
  }
  /** Enciende con un toque y entrega la primera lectura: deja el motor activo en '/'. */
  async function encendido(opciones = {}) {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const falsas = crearFuentesFalsas(opciones)
    const motor = crearMotorViaje(falsas.fuentes)
    motor.cambiarRuta('/')
    falsas.gesto()
    const listo = motor.encender()
    await falsas.reloj.avanzar(0)
    falsas.movimiento.emitir(quieta(falsas.reloj.mono()))
    await listo
    await falsas.reloj.avanzar(0)
    return { falsas, motor }
  }
  /** Una intención guardada hace `hace` ms, como la deja un documento anterior. */
  function intencionGuardada(mapa, pared, hace) {
    mapa.set('acta:viaje', JSON.stringify({ encendidoEn: pared - hace - 60_000, ultimoLatido: pared - hace, ultimoMovimiento: pared - hace, documentoId: '3c1e2b7a-5d4f-4e6a-9b8c-7d6e5f4a3b2c' }))
  }
  const INICIO_PARED = Date.UTC(2026, 8, 16, 17, 30)
  const IPHONE_17 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
  const IPHONE_18_4 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.4 Mobile/15E148 Safari/604.1'

  /* Fuentes falsas: se comportan como el navegador donde el motor se equivoca */
  {
    const falsas = crearFuentesFalsas({ movimiento: 'granted', demoraPermisoMs: 8000 })
    const orden = []
    falsas.fuentes.reloj.programar(() => orden.push('b'), 200)
    falsas.fuentes.reloj.programar(() => orden.push('a'), 100)
    await falsas.reloj.avanzar(150)
    verificar('reloj falso: avanzar dispara sólo lo vencido', orden.join() === 'a' && falsas.reloj.pendientes() === 1)
    await falsas.reloj.avanzar(100)
    verificar('reloj falso: y lo siguiente al llegar su hora, en orden', orden.join() === 'a,b' && falsas.reloj.pendientes() === 0)
    const mono = falsas.reloj.mono()
    const pared = falsas.reloj.pared()
    falsas.reloj.saltarPared(60_000)
    verificar('reloj falso: saltarPared mueve sólo la pared', falsas.reloj.mono() === mono && falsas.reloj.pared() === pared + 60_000)

    let permiso = null
    void falsas.fuentes.movimiento.requestPermission().then((r) => {
      permiso = r
    })
    await falsas.reloj.avanzar(7999)
    verificar('el permiso de movimiento tarda lo que tarda el diálogo', permiso === null && falsas.movimiento.pedidos === 1)
    await falsas.reloj.avanzar(1)
    verificar('y resuelve al cerrarse', permiso === 'granted')

    let rechazo = null
    await falsas.fuentes.navegador.wakeLock.request('screen').catch((e) => {
      rechazo = e
    })
    verificar('wake lock sin activación transitoria: NotAllowedError', rechazo?.name === 'NotAllowedError')
    falsas.ventana.despachar('pointerdown')
    rechazo = null
    await falsas.fuentes.navegador.wakeLock.request('screen').catch((e) => {
      rechazo = e
    })
    verificar('pointerdown no da activación', rechazo?.name === 'NotAllowedError')
    falsas.gesto('pointerup')
    await falsas.reloj.avanzar(5000)
    const centinela = await falsas.fuentes.navegador.wakeLock.request('screen')
    verificar('dentro de los 5 s de un gesto se concede', centinela.released === false && falsas.wakeLock.activos === 1 && falsas.wakeLock.autorizadoAntes)
    await falsas.reloj.avanzar(60_000)
    const otro = await falsas.fuentes.navegador.wakeLock.request('screen')
    verificar('ya autorizado en este documento, se concede sin gesto', falsas.wakeLock.activos === 2)
    let soltados = 0
    const alSoltar = () => soltados++
    centinela.addEventListener('release', alSoltar)
    falsas.wakeLock.liberarPorSistema()
    centinela.removeEventListener('release', alSoltar)
    verificar('liberarPorSistema suelta los centinelas y avisa release', soltados === 1 && falsas.wakeLock.activos === 0 && otro.released)

    const recarga = crearFuentesFalsas({ almacenamiento: falsas.almacenamiento.mapa, movimiento: 'NotAllowedError' })
    rechazo = null
    await recarga.fuentes.navegador.wakeLock.request('screen').catch((e) => {
      rechazo = e
    })
    verificar('un documento nuevo empieza sin autorización previa', rechazo?.name === 'NotAllowedError')
    rechazo = null
    await recarga.fuentes.movimiento.requestPermission().catch((e) => {
      rechazo = e
    })
    verificar('NotAllowedError: sin gesto el permiso de movimiento rechaza', rechazo?.name === 'NotAllowedError')
    recarga.gesto('click')
    verificar('y con un gesto reciente se concede', (await recarga.fuentes.movimiento.requestPermission()) === 'granted')

    let evento = null
    const alCambiar = (e) => {
      evento = e
    }
    recarga.fuentes.ventana.addEventListener('storage', alCambiar)
    recarga.almacenamiento.cambiarDesdeOtraVentana('acta:viaje', null)
    recarga.fuentes.ventana.removeEventListener('storage', alCambiar)
    verificar('el evento storage llega con la clave y el valor nuevo', evento?.key === 'acta:viaje' && evento?.newValue === null)

    const registro = crearRegistroCandados()
    const a = crearFuentesFalsas({ candados: registro })
    const b = crearFuentesFalsas({ candados: registro })
    let soltarA = () => undefined
    let obtuvoA = null
    let obtuvoB = 'sin llamar'
    void a.fuentes.navegador.locks.request('acta-modo-viaje', { ifAvailable: true }, (c) => {
      obtuvoA = c
      return new Promise((r) => {
        soltarA = r
      })
    })
    await a.reloj.avanzar(0)
    await b.fuentes.navegador.locks.request('acta-modo-viaje', { ifAvailable: true }, async (c) => {
      obtuvoB = c
    })
    verificar('candados compartidos: la segunda ventana recibe null', obtuvoA !== null && obtuvoB === null)
    soltarA()
    await a.reloj.avanzar(0)
    verificar('al soltarlo el candado queda libre', !registro.ocupados.has('acta-modo-viaje'))
    verificar('un juego de fuentes sin motor queda limpio', limpio(falsas) && limpio(recarga) && limpio(a) && limpio(b), JSON.stringify(falsas.limpio()))
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. El archivo de las fuentes falsas todavía no existe. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA [V6] terminó sin excepciones Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\fuentes-falsas.mjs' imported from C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\prueba-viaje.mjs
```

y al final:

```text
0/1 verificaciones pasaron
1 FALLARON
```

- [ ] **Step 3: Crear `scripts/fuentes-falsas.mjs`**

Creá `scripts/fuentes-falsas.mjs` con este contenido completo:

```js
/**
 * Fuentes falsas del motor del modo viaje, para probarlo en Node.
 *
 * Imitan las APIs del navegador que usa FuentesMotor (lib/viaje.ts), con contadores para
 * afirmar. Lo que importa no es que existan sino que se comporten como las reales en los
 * lugares donde el motor se equivoca: el wake lock que se niega fuera de la activación
 * transitoria, el permiso de movimiento que tarda lo que tarda el diálogo, el evento storage
 * que sólo llega desde otra ventana, el reloj de pared que sigue mientras el equipo duerme.
 *
 * La cola es la real (lib/cola-viaje.ts) sobre un almacén en memoria: así las pruebas miden lo
 * que de verdad sube al servidor falso. El almacén vive dentro del mismo Map que localStorage,
 * bajo una clave que el motor nunca lee, para que pasar ese Map a otro juego simule una recarga
 * con TODO lo guardado (localStorage e IndexedDB).
 */

import { crearColaViaje } from '../lib/cola-viaje.ts'

const CLAVE_INDEXEDDB = 'indexeddb:acta-viaje/entradas'

const CONFIGURACION_OMISION = {
  version: '9f2c4a1b7e3d5c60',
  umbrales: { sospechaG: 4, confirmadoG: 8, msSobreUmbral: 30, velocidadPreviaKmh: 15, velocidadPreviaCaidaKmh: 30, velocidadPosteriorKmh: 8, ventanaPostMs: 8000, topeEpisodioMs: 15000, giroDps: 180, giroManipulacionDps: 300, desaceleracionImposibleG: 1.4, frenadaG: 0.45, aceleracionG: 0.4, retrasoMinMs: 0, retrasoMaxMs: 3000 },
  alerta: 'normal',
  caida_sin_golpe: 'silenciosa',
  motor_minimo: 1,
  dias_conservacion: 90,
}

/** Varias vueltas del bucle de eventos: las cadenas de promesas de la cola y de Response terminan acá. */
async function vaciarMicrotareas() {
  for (let i = 0; i < 4; i++) await new Promise((r) => setImmediate(r))
}

/** EventTarget mínimo con la regla del real: el mismo (tipo, función, captura) se registra una sola vez. */
function crearObjetivo() {
  const escuchas = []
  const captura = (opciones) => (typeof opciones === 'boolean' ? opciones : Boolean(opciones?.capture))
  return {
    addEventListener(tipo, fn, opciones) {
      const c = captura(opciones)
      if (escuchas.some((e) => e.tipo === tipo && e.fn === fn && e.captura === c)) return
      escuchas.push({ tipo, fn, captura: c })
    },
    removeEventListener(tipo, fn, opciones) {
      const c = captura(opciones)
      const i = escuchas.findIndex((e) => e.tipo === tipo && e.fn === fn && e.captura === c)
      if (i >= 0) escuchas.splice(i, 1)
    },
    despachar(tipo, evento) {
      for (const e of escuchas.filter((x) => x.tipo === tipo)) e.fn(evento)
    },
    escuchas(tipo) {
      return tipo === undefined ? escuchas.length : escuchas.filter((e) => e.tipo === tipo).length
    },
  }
}

/** Candados compartidos entre dos juegos de fuentes, para simular dos ventanas. */
export function crearRegistroCandados() {
  return { ocupados: new Set() }
}

/**
 * Servidor en memoria con las rutas que usa el motor y la misma fusión de respuestas que el real
 * (humana siempre; sin_respuesta sólo sin respuesta previa; hubo_choque si viene).
 */
export function crearServidorFalso(opciones = {}) {
  const forzados = new Map()
  let secuencia = 0
  const nuevoCodigo = (prefijo) => `${prefijo}-${String(++secuencia).padStart(6, '0')}`

  function fusionar(alerta, respuestas, huboChoque) {
    for (const r of respuestas) {
      const humana = r.respuesta === 'estoy_bien' || r.respuesta === 'necesito_ayuda'
      if (humana || alerta.respuesta === null) alerta.respuesta = r.respuesta
      if (!alerta.respuestas.some((x) => x.respuesta === r.respuesta && x.en_telefono === r.en_telefono)) alerta.respuestas.push(r)
    }
    if (huboChoque !== null && huboChoque !== undefined) alerta.hubo_choque = huboChoque
  }

  function responder(status, cuerpo, cabeceras = {}) {
    return new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json', ...cabeceras } })
  }

  const servidor = {
    enLinea: true,
    alertas: new Map(),
    lotesConduccion: [],
    casos: [],
    configuracion: opciones.configuracion ?? structuredClone(CONFIGURACION_OMISION),
    perfil: opciones.perfil === undefined ? { contacto: null } : opciones.perfil,
    pedidos: [],
    forzarEstado(ruta, status) {
      forzados.set(ruta, status)
    },
    async fetch(ruta, init = {}) {
      if (!servidor.enLinea) throw new TypeError('Failed to fetch')
      const metodo = init.method ?? 'GET'
      const cuerpo = typeof init.body === 'string' && init.body.length > 0 ? JSON.parse(init.body) : null
      servidor.pedidos.push({ ruta, metodo, cuerpo })
      if (forzados.has(ruta)) {
        const status = forzados.get(ruta)
        forzados.delete(ruta)
        return responder(status, { error: 'Respuesta forzada por la prueba.' }, status === 429 ? { 'Retry-After': '1' } : {})
      }
      if (metodo === 'GET' && ruta === '/api/telemetria/configuracion') return responder(200, servidor.configuracion)
      if (metodo === 'POST' && ruta === '/api/telemetria') {
        const { campos, episodio } = cuerpo
        let alerta = servidor.alertas.get(campos.id_cliente)
        const nueva = !alerta
        if (!alerta) {
          alerta = { id: nuevoCodigo('TEL'), campos, episodios: new Map(), respuesta: null, respuestas: [], hubo_choque: null }
          servidor.alertas.set(campos.id_cliente, alerta)
        }
        alerta.campos = campos
        fusionar(alerta, campos.respuestas, campos.hubo_choque)
        if (episodio) alerta.episodios.set(episodio.n, episodio)
        return responder(nueva ? 201 : 200, { id: alerta.id, nivel: campos.nivel_cliente, plan: {} })
      }
      const respuesta = /^\/api\/telemetria\/([^/]+)\/respuesta$/.exec(ruta)
      if (metodo === 'POST' && respuesta) {
        const alerta = [...servidor.alertas.values()].find((a) => a.id === respuesta[1])
        if (!alerta) return responder(404, { error: 'No encontramos esa detección en este teléfono.' })
        fusionar(alerta, [{ respuesta: cuerpo.respuesta, en_telefono: cuerpo.en_telefono ?? new Date(0).toISOString() }], cuerpo.hubo_choque)
        return responder(200, { ok: true, id: alerta.id, plan: {} })
      }
      if (metodo === 'DELETE' && ruta === '/api/telemetria/mias') {
        const alertas = servidor.alertas.size
        const eventos = servidor.lotesConduccion.reduce((s, l) => s + l.eventos.length, 0)
        servidor.alertas.clear()
        servidor.lotesConduccion.length = 0
        return responder(200, { ok: true, alertas, eventos_conduccion: eventos })
      }
      if (metodo === 'POST' && ruta === '/api/conduccion') {
        servidor.lotesConduccion.push(cuerpo)
        return responder(200, { ok: true, guardados: cuerpo.eventos.length })
      }
      if (metodo === 'POST' && ruta === '/api/casos') {
        const id = nuevoCodigo('ADS')
        const secreto = `secreto-${id}`
        servidor.casos.push({ id, secreto, cuerpo })
        const salida = { id, secreto, precarga_ambigua: false }
        if (typeof cuerpo?.telemetria_id === 'string') {
          salida.vinculo_telemetria = [...servidor.alertas.values()].some((a) => a.id === cuerpo.telemetria_id) ? 'ok' : 'rechazado'
        }
        return responder(201, salida)
      }
      if (metodo === 'GET' && ruta === '/api/perfil') {
        if (servidor.perfil === null) return responder(401, { error: 'Tenés que entrar con tu cuenta.' })
        return responder(200, { usuario: {}, poliza_principal: null, contacto: servidor.perfil.contacto })
      }
      return responder(404, { error: `La ruta ${metodo} ${ruta} no existe en el servidor falso.` })
    },
  }
  return servidor
}

export function crearFuentesFalsas(opciones = {}) {
  const {
    seguro = true,
    standalone = false,
    userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
    movimiento: modoMovimiento = 'sin_funcion',
    demoraPermisoMs = 0,
    geolocalizacion = 'granted',
    wakeLock: conWakeLock = true,
    vibracion: conVibracion = true,
    audio: conAudio = true,
    sesionDeAudio = false,
    candados = crearRegistroCandados(),
    almacenamiento: mapa = new Map(),
    servidor = crearServidorFalso(),
    inicioMono = 1000,
    inicioPared = Date.UTC(2026, 8, 16, 17, 30),
  } = opciones

  /* ---------- Reloj ---------- */
  let mono = inicioMono
  let saltoPared = 0
  let siguienteId = 1
  const temporizadores = new Map()

  const relojMotor = {
    mono: () => mono,
    pared: () => inicioPared + (mono - inicioMono) + saltoPared,
    programar(fn, ms) {
      const id = siguienteId++
      temporizadores.set(id, { fn, vence: mono + Math.max(0, Number(ms) || 0) })
      return id
    },
    cancelar(id) {
      temporizadores.delete(id)
    },
  }

  const reloj = {
    mono: relojMotor.mono,
    pared: relojMotor.pared,
    /** Dispara en orden los temporizadores vencidos y, entre cada uno y al final, vacía microtareas. */
    async avanzar(ms) {
      const destino = mono + ms
      for (;;) {
        let proximo = null
        for (const [id, t] of temporizadores) {
          if (t.vence <= destino && (proximo === null || t.vence < proximo.t.vence || (t.vence === proximo.t.vence && id < proximo.id))) proximo = { id, t }
        }
        if (proximo === null) break
        mono = Math.max(mono, proximo.t.vence)
        temporizadores.delete(proximo.id)
        proximo.t.fn()
        await vaciarMicrotareas()
      }
      mono = destino
      await vaciarMicrotareas()
    },
    /** Mueve sólo la pared: el equipo suspendido o el reloj cambiado a mano. No dispara nada. */
    saltarPared(ms) {
      saltoPared += ms
    },
    pendientes: () => temporizadores.size,
  }

  /* ---------- Ventana, documento y gesto ---------- */
  const objetivoVentana = crearObjetivo()
  let ultimoGesto = -Infinity
  const ACTIVAN = new Set(['pointerup', 'touchend', 'click', 'keydown'])

  const ventana = {
    despachar(tipo, datos = {}) {
      if (ACTIVAN.has(tipo)) ultimoGesto = mono
      objetivoVentana.despachar(tipo, { type: tipo, timeStamp: mono, ...datos })
    },
    escuchas: (tipo) => objetivoVentana.escuchas(tipo),
  }

  const objetivoDocumento = crearObjetivo()
  let visibilidad = 'visible'
  const documentoMotor = {
    get visibilityState() {
      return visibilidad
    },
    addEventListener: objetivoDocumento.addEventListener,
    removeEventListener: objetivoDocumento.removeEventListener,
  }
  const documento = {
    ponerVisible(visible) {
      visibilidad = visible ? 'visible' : 'hidden'
      objetivoDocumento.despachar('visibilitychange', { type: 'visibilitychange' })
    },
  }

  /* ---------- Movimiento ---------- */
  const movimiento = {
    pedidos: 0,
    emitir(muestra) {
      const eje = (v) => (v ? { x: v[0], y: v[1], z: v[2] } : null)
      objetivoVentana.despachar('devicemotion', {
        type: 'devicemotion',
        timeStamp: muestra.t,
        acceleration: eje(muestra.a),
        accelerationIncludingGravity: eje(muestra.aIG),
        rotationRate: muestra.giro ? { alpha: muestra.giro[0], beta: muestra.giro[1], gamma: muestra.giro[2] } : null,
        interval: 16,
      })
    },
  }

  function resolverPermiso() {
    movimiento.pedidos++
    const gestoAlPedir = ultimoGesto
    const decidir = (resolver, rechazar) => {
      // Como WebKit: sin activación transitoria rechaza con NotAllowedError; con un gesto reciente, concede.
      if (modoMovimiento === 'NotAllowedError' && mono - gestoAlPedir > 5000) {
        rechazar(Object.assign(new Error('Requesting device orientation or motion access requires a user gesture to prompt'), { name: 'NotAllowedError' }))
      } else {
        resolver(modoMovimiento === 'denied' ? 'denied' : 'granted')
      }
    }
    return new Promise((resolver, rechazar) => {
      if (demoraPermisoMs > 0) relojMotor.programar(() => decidir(resolver, rechazar), demoraPermisoMs)
      else decidir(resolver, rechazar)
    })
  }

  const movimientoMotor =
    modoMovimiento === 'ausente' ? null : modoMovimiento === 'sin_funcion' ? {} : { requestPermission: resolverPermiso }

  /* ---------- Geolocalización ---------- */
  const vigilanciasActivas = new Map()
  let siguienteVigilancia = 1
  const geo = {
    vigilancias: 0,
    pedidos: 0,
    emitirFix({ lat, lon, precisionM, velocidadMs = null, adquiridoPared }) {
      const pos = {
        coords: { latitude: lat, longitude: lon, accuracy: precisionM, speed: velocidadMs },
        timestamp: adquiridoPared ?? relojMotor.pared(),
      }
      for (const v of [...vigilanciasActivas.values()]) v.ok(pos)
    },
    emitirError(codigo) {
      for (const v of [...vigilanciasActivas.values()]) v.error({ code: codigo })
    },
  }
  const geolocalizacionMotor = {
    watchPosition(ok, error) {
      const id = siguienteVigilancia++
      vigilanciasActivas.set(id, { ok, error })
      geo.vigilancias++
      geo.pedidos++
      if (geolocalizacion === 'denied') queueMicrotask(() => vigilanciasActivas.get(id)?.error({ code: 1 }))
      return id
    },
    clearWatch(id) {
      if (vigilanciasActivas.delete(id)) geo.vigilancias--
    },
  }

  /* ---------- Wake lock ---------- */
  const centinelasActivos = new Set()
  const objetivosCentinelas = []
  const wakeLock = {
    pedidos: 0,
    activos: 0,
    autorizadoAntes: false,
    liberarPorSistema() {
      for (const c of [...centinelasActivos]) c.soltar()
    },
  }
  const wakeLockMotor = {
    request() {
      wakeLock.pedidos++
      if (mono - ultimoGesto > 5000 && !wakeLock.autorizadoAntes) {
        return Promise.reject(Object.assign(new Error('The request is not allowed by the user agent.'), { name: 'NotAllowedError' }))
      }
      wakeLock.autorizadoAntes = true
      const objetivo = crearObjetivo()
      objetivosCentinelas.push(objetivo)
      const centinela = {
        released: false,
        addEventListener: objetivo.addEventListener,
        removeEventListener: objetivo.removeEventListener,
        soltar() {
          if (centinela.released) return
          centinela.released = true
          centinelasActivos.delete(centinela)
          wakeLock.activos--
          objetivo.despachar('release', { type: 'release' })
        },
        release() {
          centinela.soltar()
          return Promise.resolve()
        },
      }
      centinelasActivos.add(centinela)
      wakeLock.activos++
      return Promise.resolve(centinela)
    },
  }

  /* ---------- Audio y vibración ---------- */
  const escuchasAudio = new Set()
  let destrabado = false
  const audio = {
    destrabes: 0,
    despertares: 0,
    tonos: 0,
    pulsos: 0,
    sonando: false,
    estadoContexto: 'suspended',
    get sesionTipo() {
      return navegador.audioSession?.type ?? ''
    },
  }
  const cambiarEstadoAudio = (estado) => {
    if (audio.estadoContexto === estado) return
    audio.estadoContexto = estado
    for (const fn of [...escuchasAudio]) fn()
  }
  const crearAudio = () => ({
    estado: () => audio.estadoContexto,
    destrabar() {
      audio.destrabes++
      destrabado = true
    },
    despertar() {
      audio.despertares++
      if (mono - ultimoGesto <= 5000) destrabado = true
      if (destrabado && audio.estadoContexto !== 'closed') cambiarEstadoAudio('running')
      return Promise.resolve(audio.estadoContexto === 'running')
    },
    tono() {
      audio.tonos++
      audio.sonando = true
      return () => {
        audio.sonando = false
      }
    },
    pulso() {
      audio.pulsos++
    },
    suspender() {
      if (audio.estadoContexto !== 'closed') cambiarEstadoAudio('suspended')
    },
    cerrar() {
      cambiarEstadoAudio('closed')
    },
    alCambiar(fn) {
      escuchasAudio.add(fn)
      return () => escuchasAudio.delete(fn)
    },
  })
  const vibracion = { patrones: [] }

  /* ---------- Almacenamiento ---------- */
  const almacenamientoMotor = {
    getItem: (clave) => (typeof mapa.get(clave) === 'string' ? mapa.get(clave) : null),
    setItem: (clave, valor) => {
      mapa.set(clave, String(valor))
    },
    removeItem: (clave) => {
      mapa.delete(clave)
    },
  }
  const almacenamiento = {
    mapa,
    /** Otra ventana escribe o borra: acá llega el evento storage, como en el navegador. */
    cambiarDesdeOtraVentana(clave, valor) {
      const anterior = almacenamientoMotor.getItem(clave)
      if (valor === null) mapa.delete(clave)
      else mapa.set(clave, valor)
      objetivoVentana.despachar('storage', { type: 'storage', key: clave, oldValue: anterior, newValue: valor })
    },
  }
  if (!(mapa.get(CLAVE_INDEXEDDB) instanceof Map)) mapa.set(CLAVE_INDEXEDDB, new Map())
  const entradas = mapa.get(CLAVE_INDEXEDDB)
  const cola = crearColaViaje({
    todas: async () => [...entradas.values()].map((e) => structuredClone(e)),
    poner: async (e) => {
      entradas.set(e.clave, structuredClone(e))
    },
    sacar: async (clave) => {
      entradas.delete(clave)
    },
    vaciar: async () => {
      entradas.clear()
    },
  })

  /* ---------- Navegador ---------- */
  const navegador = { userAgent }
  if (geolocalizacion !== 'ausente') navegador.geolocation = geolocalizacionMotor
  navegador.permissions = {
    query: () => Promise.resolve({ state: geolocalizacion === 'ausente' ? 'denied' : geolocalizacion }),
  }
  if (conWakeLock) navegador.wakeLock = wakeLockMotor
  if (conVibracion) {
    navegador.vibrate = (patron) => {
      vibracion.patrones.push(patron)
      return true
    }
  }
  if (sesionDeAudio) navegador.audioSession = { type: 'auto' }
  if (candados !== null) {
    navegador.locks = {
      request(nombre, _opciones, cb) {
        if (candados.ocupados.has(nombre)) return Promise.resolve().then(() => cb(null))
        candados.ocupados.add(nombre)
        return Promise.resolve()
          .then(() => cb({ name: nombre }))
          .finally(() => candados.ocupados.delete(nombre))
      },
    }
  }

  const local = {
    recordarActuacion(id, secreto) {
      mapa.set('acta:actuacion-abierta', id)
      if (secreto) mapa.set(`acta:secreto:${id}`, secreto)
    },
    actuacionAbierta: () => almacenamientoMotor.getItem('acta:actuacion-abierta'),
  }

  const fuentes = {
    reloj: relojMotor,
    ventana: { addEventListener: objetivoVentana.addEventListener, removeEventListener: objetivoVentana.removeEventListener },
    documento: documentoMotor,
    navegador,
    movimiento: movimientoMotor,
    almacenamiento: almacenamientoMotor,
    local,
    cola,
    fetch: (ruta, init) => servidor.fetch(ruta, init),
    crearAudio: conAudio ? crearAudio : null,
    seguro,
    standalone,
    nuevoId: () => crypto.randomUUID(),
  }

  return {
    fuentes,
    reloj,
    servidor,
    gesto(tipo = 'click') {
      ventana.despachar(tipo)
    },
    ventana,
    documento,
    movimiento,
    geo,
    wakeLock,
    audio,
    vibracion,
    almacenamiento,
    /**
     * Intercala muestras (MuestraMovimiento) y fixes (FixGps) por tiempo avanzando el reloj. Los tiempos
     * se corren para que el primero ocurra ahora; se conservan los intervalos y la edad de cada fix.
     */
    async reproducir(muestras = [], fixes = []) {
      const eventos = [
        ...muestras.map((m) => ({ t: m.t, muestra: m, fix: null })),
        ...fixes.map((f) => ({ t: f.llegadaMono, muestra: null, fix: f })),
      ].sort((a, b) => a.t - b.t)
      if (eventos.length === 0) return
      const corrimiento = mono - eventos[0].t
      for (const e of eventos) {
        const cuando = e.t + corrimiento
        if (cuando > mono) await reloj.avanzar(cuando - mono)
        if (e.muestra) {
          movimiento.emitir({ ...e.muestra, t: cuando })
        } else {
          geo.emitirFix({
            lat: e.fix.lat,
            lon: e.fix.lon,
            precisionM: e.fix.precisionM,
            velocidadMs: e.fix.velocidadMs,
            adquiridoPared: relojMotor.pared() - (e.fix.llegadaPared - e.fix.adquiridoPared),
          })
        }
      }
      await vaciarMicrotareas()
    },
    limpio() {
      return {
        temporizadores: temporizadores.size,
        escuchas: objetivoVentana.escuchas() + objetivoDocumento.escuchas() + objetivosCentinelas.reduce((s, o) => s + o.escuchas(), 0) + escuchasAudio.size,
        vigilancias: geo.vigilancias,
        centinelas: wakeLock.activos,
      }
    },
    /** Ventana falsa completa para globalThis.window y motorDelNavegador. */
    crearVentana() {
      const salida = {
        addEventListener: objetivoVentana.addEventListener,
        removeEventListener: objetivoVentana.removeEventListener,
        document: documentoMotor,
        navigator: navegador,
        localStorage: almacenamientoMotor,
        performance: { now: relojMotor.mono },
        setTimeout: (fn, ms) => relojMotor.programar(fn, ms),
        clearTimeout: (id) => relojMotor.cancelar(id),
        isSecureContext: seguro,
        matchMedia: (consulta) => ({ matches: consulta === '(display-mode: standalone)' ? standalone : false }),
        fetch: (ruta, init) => servidor.fetch(ruta, init),
        crypto: globalThis.crypto,
      }
      if (movimientoMotor !== null) salida.DeviceMotionEvent = movimientoMotor
      return salida
    },
  }
}
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   reloj falso: avanzar dispara sólo lo vencido
  ok   reloj falso: y lo siguiente al llegar su hora, en orden
  ok   reloj falso: saltarPared mueve sólo la pared
  ok   el permiso de movimiento tarda lo que tarda el diálogo
  ok   y resuelve al cerrarse
  ok   wake lock sin activación transitoria: NotAllowedError
  ok   pointerdown no da activación
  ok   dentro de los 5 s de un gesto se concede
  ok   ya autorizado en este documento, se concede sin gesto
  ok   liberarPorSistema suelta los centinelas y avisa release
  ok   un documento nuevo empieza sin autorización previa
  ok   NotAllowedError: sin gesto el permiso de movimiento rechaza
  ok   y con un gesto reciente se concede
  ok   el evento storage llega con la clave y el valor nuevo
  ok   candados compartidos: la segunda ventana recibe null
  ok   al soltarlo el candado queda libre
  ok   un juego de fuentes sin motor queda limpio
```

y al final:

```text
17/17 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 6: Commit**

```bash
git add "scripts/fuentes-falsas.mjs" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Simular el navegador en Node para probar el modo viaje sin un teléfono

El motor se equivoca en lugares que sólo existen en un teléfono: el wake lock que se niega
fuera de los 5 s de un gesto, el permiso de movimiento que tarda lo que tarda el diálogo,
el evento storage que sólo llega desde otra ventana, el reloj de pared que sigue mientras el
equipo duerme. Las fuentes falsas imitan eso con contadores para afirmar, un reloj que avanza
a mano y un servidor en memoria con la misma fusión de respuestas que el real.

La cola de las fuentes es la real sobre un Map: las pruebas miden lo que de verdad sube.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `lib/viaje.ts`: constantes, `ESTADO_SERVIDOR`, instantánea inmutable, `suscribir`, reloj inyectado y `motorDelNavegador`

**Files:**
- Create: `lib/viaje.ts`
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V6]`: el `})` que queda justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V6]`

**Interfaces:**
- Consumes:
  - `lib/impacto.ts` (F1 y F2): `UMBRALES`, `PRECISION_CONFIABLE_M`, `nivelMayor(a, b)`, `validarUmbrales(entrada): { umbrales, problemas }` y los tipos `NivelImpacto`, `RespuestaAlerta`, `Umbrales`.
  - `lib/conduccion.ts` (F2): `crearDetector(opciones: OpcionesDetector): Detector`, `estaDetenido(lecturas, desdeMono, hastaMono, umbrales): boolean | null`, `velocidadMedia(lecturas, desdeMono, hastaMono): number | null` y los tipos `EventoDetector`, `FixGps`, `MuestraMovimiento`.
  - `lib/transporte-viaje.ts` (F1): `MAX_EVENTOS_LOTE`, `codificarEpisodio(n, ocurridoEnTelefono, episodio, veredictoCliente): EpisodioTransportado` y los tipos `CamposAlerta`, `EpisodioTransportado`, `FilaEventoConduccion`, `GpsTransportado`, `LoteConduccion`, `RespuestaTransportada`.
  - `lib/cola-viaje.ts` (Tarea 1): `crearColaViaje`, `almacenIndexedDb` y los tipos `ColaViaje`, `EnviarViaje`. `lib/local.ts`: `recordarActuacion(id, secreto?)` y `actuacionAbierta()`.
  - Sólo en la prueba: `AVISOS_DATOS_CONOCIDOS` de `lib/telemetria.ts` (F1) y `crearFuentesFalsas`, `crearVentana()` (Tarea 2).
- Produces:
  - Exportados (y nada más): `VERSION_MOTOR = 1`, `AVISO_DATOS_VERSION = '2026-09-16'`, `RUTAS_EN_PAUSA`, `RUTAS_SIN_PILDORA`, `interface EstadoModoViaje`, `ESTADO_SERVIDOR: EstadoModoViaje` (congelado en profundidad, con una copia congelada de `UMBRALES`), `crearMotorViaje(fuentes: FuentesMotor): MotorViaje` y `motorDelNavegador(): MotorViaje | null`.
  - Sin exportar, tal como los fija el índice: `RelojMotor`, `EscuchaMotor`, `ObjetivoEventosMotor`, `DocumentoMotor`, `CentinelaMotor`, `PosicionMotor`, `NavegadorMotor`, `AudioMotor`, `AlmacenamientoMotor`, `LocalMotor`, `FuentesMotor`, `ResultadoRegistro`, `ResultadoBorrado` y `MotorViaje`. F4 los obtiene con `NonNullable<ReturnType<typeof motorDelNavegador>>`.
  - Comportamiento de esta tarea: un motor nuevo arranca `apagado`; `estado()` devuelve la misma referencia hasta que algo cambia; `suscribir(fn)` devuelve la función que desuscribe; `cambiarRuta(ruta)` publica `ruta: { actual, enPausa, conPildora }`; `destruir()` cancela todos los temporizadores y deja de avisar. Los métodos que llegan en las Tareas 4 a 12 son, en este commit, funciones que no hacen nada (`encender`, `reanudar` y `drenarCola` resuelven enseguida; `registrarAccidente` y `borrarRegistros` resuelven `{ tipo: 'error', mensaje }`): así `MotorViaje` compila desde el primer commit y cada tarea reemplaza su línea del objeto que devuelve `crearMotorViaje`.
  - Internas que usan las tareas siguientes: `programar(fn, ms)` y `cancelar(id)` (todo temporizador pasa por ahí), `publicar()`, `armarEstado()`, `congelar(valor)`, `leerJson`, `escribirJson`, `borrarClave`, `leerIntencion`, `escribirIntencion`, `borrarIntencion`, `coincide(ruta, patrones)`, `plataformaDe(userAgent, documento)`, y las constantes de claves (`acta:viaje`, `acta:golpe-pendiente`, `acta:viaje:alerta`, `acta:viaje:sin-sensores`, `acta:viaje:configuracion`, `acta:diagnostico`), candados y tiempos del índice.

**Decisiones de esta tarea:**

- `publicar()` arma la instantánea de nuevo y la compara por `JSON.stringify` con la anterior: sólo si cambió la congela, la reemplaza y avisa. Así `estado()` conserva la referencia mientras nada cambie (riesgo 19) sin llevar a mano la cuenta de qué campo cambió.
- Cada temporizador pasa por `programar`, que lo anota en un `Set`, y el temporizador se borra de ahí al dispararse: `destruir()` cancela lo que quede y las pruebas terminan con `limpio()` en cero.
- `fuentesDelNavegador()` lee siempre de `window` (riesgo 17), es el único lugar que usa `lib/local.ts` y arma el UUID con `crypto.getRandomValues` cuando no hay `randomUUID` (riesgo 23). El `AudioContext` se envuelve en `audioWeb`, que agenda los pulsos del tono en la línea de tiempo del contexto.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V6]` el bloque de constantes, instantánea e instancia única. `?instancia=1` y `?instancia=2` cargan dos evaluaciones distintas del módulo con `tsx`, como Fast Refresh; al terminar se borran `globalThis.window` y `globalThis.__actaMotorViaje` (riesgo 40).

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V6]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Constantes, instantánea inmutable y una sola instancia por ventana */
  {
    const viaje = await import('../lib/viaje.ts')
    const { AVISOS_DATOS_CONOCIDOS } = await import('../lib/telemetria.ts')
    const { UMBRALES } = await import('../lib/impacto.ts')
    verificar('AVISOS_DATOS_CONOCIDOS del servidor incluye AVISO_DATOS_VERSION', AVISOS_DATOS_CONOCIDOS.includes(viaje.AVISO_DATOS_VERSION))
    verificar('VERSION_MOTOR es un entero de 1 a 1000', Number.isInteger(viaje.VERSION_MOTOR) && viaje.VERSION_MOTOR >= 1 && viaje.VERSION_MOTOR <= 1000)
    verificar('RUTAS_EN_PAUSA y RUTAS_SIN_PILDORA son las de §3.2 y §3.6', JSON.stringify(viaje.RUTAS_EN_PAUSA) === '["/s/*"]' && JSON.stringify(viaje.RUTAS_SIN_PILDORA) === '["/","/s/*","/t/*","/c/*","/e/*","/v/*","/verificar","/panel*","/entrar","/registro"]')
    const s = viaje.ESTADO_SERVIDOR
    verificar('ESTADO_SERVIDOR arranca desconocido y sin nada vivo', s.fase === 'desconocido' && s.alerta === null && s.golpePendiente === null && s.gps === 'no_aplica' && s.pantalla === 'no_soportada' && s.configuracion.caidaSinGolpe === 'silenciosa')
    verificar('ESTADO_SERVIDOR está congelado en profundidad', Object.isFrozen(s) && Object.isFrozen(s.avisos) && Object.isFrozen(s.deteccion.huecos) && Object.isFrozen(s.configuracion) && Object.isFrozen(s.configuracion.umbrales) && Object.isFrozen(s.ruta))
    verificar('UMBRALES de lib/impacto.ts no se congela', !Object.isFrozen(UMBRALES) && s.configuracion.umbrales !== UMBRALES)
    verificar('sin window no hay motor, aunque Node tenga navigator', typeof globalThis.navigator === 'object' && viaje.motorDelNavegador() === null)

    const falsas = crearFuentesFalsas()
    const motor = viaje.crearMotorViaje(falsas.fuentes)
    const inicial = motor.estado()
    verificar('un motor nuevo sin intención arranca apagado', inicial.fase === 'apagado' && inicial.alerta === null && inicial.apagadoPor === null && inicial.plataforma === 'android')
    verificar('estado() devuelve la misma referencia mientras nada cambia', motor.estado() === inicial)
    let avisos = 0
    const desuscribir = motor.suscribir(() => avisos++)
    motor.cambiarRuta('/perfil')
    const conRuta = motor.estado()
    verificar('al cambiar algo la instantánea se reemplaza entera y avisa', conRuta !== inicial && avisos === 1 && conRuta.ruta.actual === '/perfil')
    verificar('la instantánea nueva también está congelada', Object.isFrozen(conRuta) && Object.isFrozen(conRuta.ruta) && Object.isFrozen(conRuta.configuracion.umbrales))
    motor.cambiarRuta('/perfil')
    verificar('lo que no cambia nada no reemplaza ni avisa', motor.estado() === conRuta && avisos === 1)
    desuscribir()
    motor.cambiarRuta('/historial')
    verificar('desuscribir deja de avisar', avisos === 1 && motor.estado().ruta.actual === '/historial')
    verificar('crear el motor no toca ni el reloj ni los sensores', falsas.reloj.pendientes() === 0 && falsas.ventana.escuchas('devicemotion') === 0 && falsas.movimiento.pedidos === 0 && falsas.wakeLock.pedidos === 0)
    terminar('motor nuevo', motor, falsas)
    verificar('un motor destruido sigue devolviendo su última instantánea', motor.estado().ruta.actual === '/historial')

    const unica = crearFuentesFalsas()
    globalThis.window = unica.crearVentana()
    try {
      const a = await import('../lib/viaje.ts?instancia=1')
      const primero = a.motorDelNavegador()
      verificar('motorDelNavegador crea la instancia con window y la reutiliza', primero !== null && a.motorDelNavegador() === primero && globalThis.__actaMotorViaje === primero)
      const escuchasPrimera = unica.ventana.escuchas()
      const b = await import('../lib/viaje.ts?instancia=2')
      const segundo = b.motorDelNavegador()
      verificar('otra evaluación del módulo destruye la instancia previa antes de crear la suya', segundo !== null && segundo !== primero && globalThis.__actaMotorViaje === segundo && unica.ventana.escuchas() === escuchasPrimera)
      segundo.destruir()
      verificar('motorDelNavegador: sin temporizadores ni escuchas al terminar', limpio(unica), JSON.stringify(unica.limpio()))
    } finally {
      delete globalThis.window
      delete globalThis.__actaMotorViaje
    }
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. El motor todavía no existe: el bloque de las fuentes falsas pasa y el nuevo corta con la excepción. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA [V6] terminó sin excepciones Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\lib\viaje.ts' imported from C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\prueba-viaje.mjs
```

y al final:

```text
17/18 verificaciones pasaron
1 FALLARON
```

- [ ] **Step 3: Crear `lib/viaje.ts`**

Creá `lib/viaje.ts` con este contenido completo:

```ts
/**
 * El motor del modo viaje: ciclo de vida, permisos, sensores, alertas, respuestas y estado.
 *
 * Vive fuera de React a propósito. La alerta tiene que sobrevivir a un cambio de pantalla, a
 * una recarga y al cierre de la aplicación durante una llamada, y una pantalla que se desmonta
 * no puede llevarse puesta la cuenta regresiva (eso pasaba con DetectorImpacto.tsx).
 *
 * Todo lo del navegador entra por FuentesMotor: el reloj, los sensores, el GPS, el wake lock,
 * el audio, el almacenamiento, la cola y la red. Así se prueba en Node con fuentes falsas y un
 * reloj que avanza a mano (scripts/fuentes-falsas.mjs). El motor no usa setTimeout, Date.now
 * ni performance.now globales.
 *
 * Sin efectos al importarse: el layout importa ModoViaje.tsx, que importa esto, durante el
 * render del servidor. Nada toca window, document, navigator, localStorage ni indexedDB fuera
 * de una función.
 */

import { UMBRALES, PRECISION_CONFIABLE_M, nivelMayor, validarUmbrales, type NivelImpacto, type RespuestaAlerta, type Umbrales } from './impacto'
import { crearDetector, estaDetenido, velocidadMedia, type EventoDetector, type FixGps, type MuestraMovimiento } from './conduccion'
import { MAX_EVENTOS_LOTE, codificarEpisodio, type CamposAlerta, type EpisodioTransportado, type FilaEventoConduccion, type GpsTransportado, type LoteConduccion, type RespuestaTransportada } from './transporte-viaje'
import { almacenIndexedDb, crearColaViaje, type ColaViaje, type EnviarViaje } from './cola-viaje'
// Sólo lo usa fuentesDelNavegador para armar fuentes.local: el motor nunca llama a lib/local directo, porque
// lib/local escribe en window.localStorage y en Node (fuentes falsas) no guardaría nada, en silencio.
import { recordarActuacion, actuacionAbierta } from './local'

/** Sube cuando cambia el motor; el servidor puede exigir un mínimo (motor_minimo). */
export const VERSION_MOTOR = 1

/** Versión del aviso de datos (§5.6) que ve la persona; viaja en cada alta y el servidor la valida. */
export const AVISO_DATOS_VERSION = '2026-09-16'

/** Rutas donde el motor se pone en pausa (§3.6). Un patrón que termina en * es prefijo (sin el *); si no, ruta exacta. */
export const RUTAS_EN_PAUSA: readonly string[] = ['/s/*']

/** Rutas sin píldora (§3.2), con la misma notación. En '/' la píldora tiene su regla propia. */
export const RUTAS_SIN_PILDORA: readonly string[] = ['/', '/s/*', '/t/*', '/c/*', '/e/*', '/v/*', '/verificar', '/panel*', '/entrar', '/registro']

/** §4.2. Instantánea inmutable: misma referencia hasta que algo cambia; al cambiar se reemplaza entera. */
export interface EstadoModoViaje {
  fase: 'desconocido' | 'reanudando' | 'apagado' | 'pidiendo' | 'activo' | 'en_pausa' | 'reanudar_con_toque' | 'sin_permiso' | 'sin_lecturas' | 'no_soportado' | 'otra_ventana'
  /** Sólo con fase no_soportado: sin https, o sin DeviceMotionEvent. */
  motivoNoSoportado: 'inseguro' | 'sin_sensores' | null
  gps: 'ok' | 'buscando' | 'impreciso' | 'sin_permiso' | 'requiere_toque' | 'no_aplica'
  pantalla: 'retenida' | 'sin_retener' | 'no_garantizada' | 'no_soportada'
  /** true si el sistema soltó el wake lock con la página visible y no se pudo recuperar (texto de ahorro de batería). */
  pantallaLiberada: boolean
  avisos: {
    sonido: 'listo' | 'requiere_toque'
    vibracion: 'listo' | 'requiere_toque' | 'no_soportada'
  }
  /** navigator.audioSession existe: con el teléfono en silencio igual puede sonar. */
  sesionDeAudio: boolean
  fuente: 'confiable' | 'derivada'
  plataforma: 'ios' | 'android' | 'otro'
  standalone: boolean
  alerta: null | {
    estado: 'pregunta' | 'hubo_choque' | 'ayuda'
    /** UUID del motor: id_cliente de la telemetría. */
    idCliente: string
    /** TEL-XXXXXX cuando el servidor respondió. */
    idServidor: string | null
    /** Pared ms en que vence la pregunta (30 s) o hubo_choque (60 s); null en ayuda. */
    plazo: number | null
    /** Segundos que faltan para plazo, redondeados hacia arriba; se actualiza a 1 Hz; null en ayuda. En hubo_choque no se muestra (§3.3: sin tono ni cuenta). */
    restanteS: number | null
    /** Pared ms del primer pico. */
    ocurridoEn: number
    /** Pared ms en que se abrió la alerta. */
    abiertaEn: number
    apertura: 'episodio' | 'seguimiento'
    origenAyuda: 'necesito_ayuda' | 'sin_respuesta' | null
    respuestas: ReadonlyArray<{ respuesta: 'estoy_bien' | 'necesito_ayuda' | 'sin_respuesta'; enTelefono: number }>
    /** Hubo al menos una respuesta humana (estoy_bien o necesito_ayuda). */
    respondida: boolean
    /** Pasaron 600 ms desde que se abrió: recién ahí los botones reciben toques (data-armada). */
    armada: boolean
    /** Último fix válido al abrir o al entrar en ayuda, para «Compartir mi ubicación». */
    ubicacion: { lat: number; lon: number } | null
  }
  inactividad: null | { preguntandoDesde: number; vence: number }
  golpePendiente: null | { telemetriaIdCliente: string; telemetriaId: string | null; ocurridoEn: number }
  apagadoPor: null | { motivo: 'usuario' | 'inactividad' | 'accidente_registrado' | 'configuracion'; hora: number }
  /** Pared ms. huecos: los últimos 10, más viejos primero. */
  deteccion: { activaMs: number; totalMs: number; huecos: ReadonlyArray<{ inicio: number; ms: number }> }
  configuracion: {
    version: string | null
    alerta: 'normal' | 'silenciosa' | 'apagada'
    caidaSinGolpe: 'alerta' | 'silenciosa'
    umbrales: Umbrales
    /** VERSION_MOTOR < motor_minimo. */
    desactualizado: boolean
  }
  ruta: { actual: string; enPausa: boolean; conPildora: boolean }
  /** Redondeada, 1 Hz como máximo; null sin lectura confiable de menos de 5 s. */
  velocidadKmh: number | null
  precisionM: number | null
  /** Pared ms en que la pregunta de inactividad se cerró porque el auto volvió a moverse. */
  siguioPorMovimientoEn: number | null
  /** Sólo con localStorage['acta:diagnostico'] presente; 1 Hz como máximo. */
  diagnostico: null | {
    gVivo: number | null
    hz: number | null
    episodios: ReadonlyArray<{ en: number; nivel: NivelImpacto; picoG: number; motivo: string }>
  }
}

/** Congela en profundidad: una instantánea que alguien modifica por referencia rompe useSyncExternalStore sin avisar. */
function congelar<T>(valor: T): T {
  if (valor !== null && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.freeze(valor)
    for (const hijo of Object.values(valor)) congelar(hijo)
  }
  return valor
}

/** Congelado en profundidad (Object.freeze en cada nivel). Es el getServerSnapshot del proveedor. Se congela una copia de los umbrales: UMBRALES de lib/impacto.ts no se congela. */
export const ESTADO_SERVIDOR: EstadoModoViaje = congelar({
  fase: 'desconocido',
  motivoNoSoportado: null,
  gps: 'no_aplica',
  pantalla: 'no_soportada',
  pantallaLiberada: false,
  avisos: { sonido: 'requiere_toque', vibracion: 'no_soportada' },
  sesionDeAudio: false,
  fuente: 'confiable',
  plataforma: 'otro',
  standalone: false,
  alerta: null,
  inactividad: null,
  golpePendiente: null,
  apagadoPor: null,
  deteccion: { activaMs: 0, totalMs: 0, huecos: [] },
  configuracion: { version: null, alerta: 'normal', caidaSinGolpe: 'silenciosa', umbrales: { ...UMBRALES }, desactualizado: false },
  ruta: { actual: '', enPausa: false, conPildora: false },
  velocidadKmh: null,
  precisionM: null,
  siguioPorMovimientoEn: null,
  diagnostico: null,
})

/** Relojes inyectados. El motor no usa setTimeout, setInterval, Date.now ni performance.now globales. */
interface RelojMotor {
  /** performance.now(): no avanza con el equipo suspendido; misma base que DeviceMotionEvent.timeStamp. */
  mono(): number
  /** Date.now(). */
  pared(): number
  /** setTimeout. */
  programar(fn: () => void, ms: number): number
  /** clearTimeout. */
  cancelar(id: number): void
}

type EscuchaMotor = (evento: Event) => void

interface ObjetivoEventosMotor {
  addEventListener(tipo: string, fn: EscuchaMotor, opciones?: AddEventListenerOptions | boolean): void
  removeEventListener(tipo: string, fn: EscuchaMotor, opciones?: EventListenerOptions | boolean): void
}

interface DocumentoMotor extends ObjetivoEventosMotor {
  readonly visibilityState: DocumentVisibilityState
}

/** WakeLockSentinel: evento 'release'. */
interface CentinelaMotor extends ObjetivoEventosMotor {
  readonly released: boolean
  release(): Promise<void>
}

interface PosicionMotor {
  readonly coords: { readonly latitude: number; readonly longitude: number; readonly accuracy: number; readonly speed: number | null }
  readonly timestamp: number
}

/** Lo que el motor usa de navigator. Se pasa window.navigator entero (los métodos se llaman como métodos). */
interface NavegadorMotor {
  readonly userAgent: string
  readonly standalone?: boolean
  readonly geolocation?: {
    watchPosition(ok: (pos: PosicionMotor) => void, error: (err: { readonly code: number }) => void, opciones: PositionOptions): number
    clearWatch(id: number): void
  }
  readonly permissions?: { query(descriptor: { name: 'geolocation' }): Promise<{ readonly state: 'granted' | 'denied' | 'prompt' }> }
  readonly wakeLock?: { request(tipo: 'screen'): Promise<CentinelaMotor> }
  vibrate?(patron: number | number[]): boolean
  audioSession?: { type: string }
  readonly locks?: { request(nombre: string, opciones: { ifAvailable: true }, cb: (candado: unknown) => Promise<void>): Promise<void> }
}

/** Envoltorio del AudioContext (lo arma fuentesDelNavegador con Web Audio). */
interface AudioMotor {
  /** AudioContext.state: 'running' · 'suspended' · 'closed' · 'interrupted'. */
  estado(): string
  /** Dentro del gesto y sin await antes: resume(), un búfer silencioso de una muestra, suspend(). Destraba sin retener la sesión de audio. */
  destrabar(): void
  /** Al abrir la alerta: resume() sin esperar un toque; resuelve true si a los 500 ms quedó 'running'. */
  despertar(): Promise<boolean>
  /** Pulsos que suben de volumen en los últimos 15 s de duracionMs. Devuelve la función que los corta. */
  tono(duracionMs: number): () => void
  /** Pulso corto (pregunta de inactividad). */
  pulso(): void
  suspender(): void
  cerrar(): void
  /** statechange del contexto; devuelve la función que quita la escucha. */
  alCambiar(fn: () => void): () => void
}

interface AlmacenamientoMotor {
  getItem(clave: string): string | null
  setItem(clave: string, valor: string): void
  removeItem(clave: string): void
}

/** lib/local.ts detrás de una fuente: escribe acta:actuacion-abierta y acta:secreto:<id>. */
interface LocalMotor {
  recordarActuacion(id: string, secreto: string): void
  actuacionAbierta(): string | null
}

interface FuentesMotor {
  reloj: RelojMotor
  /** window: devicemotion, pointerup, touchend, click, keydown, pageshow, storage. */
  ventana: ObjetivoEventosMotor
  /** document: visibilitychange y visibilityState. */
  documento: DocumentoMotor
  navegador: NavegadorMotor
  /** window.DeviceMotionEvent, o null si typeof DeviceMotionEvent === 'undefined'. */
  movimiento: { requestPermission?: () => Promise<'granted' | 'denied'> } | null
  /** window.localStorage, o null si acceder tira. Todo uso va en try/catch. */
  almacenamiento: AlmacenamientoMotor | null
  /** En el navegador, recordarActuacion y actuacionAbierta de lib/local; en las fuentes falsas, sobre el mismo Map de almacenamiento y con las mismas claves. */
  local: LocalMotor
  cola: ColaViaje
  /** window.fetch. */
  fetch: (ruta: string, init?: RequestInit) => Promise<Response>
  /** null si no hay AudioContext ni webkitAudioContext. */
  crearAudio: (() => AudioMotor) | null
  /** window.isSecureContext. */
  seguro: boolean
  /** matchMedia('(display-mode: standalone)').matches || navigator.standalone === true. */
  standalone: boolean
  /** crypto.randomUUID(); fuera de contexto seguro, un UUID v4 armado con crypto.getRandomValues. */
  nuevoId: () => string
}

type ResultadoRegistro =
  | { tipo: 'creada'; id: string; vinculo: 'ok' | 'rechazado' | 'sin_dato' }
  | { tipo: 'sin_red' }
  | { tipo: 'error'; mensaje: string }

type ResultadoBorrado =
  | { tipo: 'ok'; alertas: number; eventos_conduccion: number }
  | { tipo: 'sin_red' }
  | { tipo: 'error'; mensaje: string }

interface MotorViaje {
  /** Para useSyncExternalStore; devuelve la función que desuscribe. Desuscribir nunca apaga. */
  suscribir(fn: () => void): () => void
  estado(): EstadoModoViaje
  /** onClick del interruptor. Lo sincrónico de §4.1 va antes del primer await. Idempotente. Resuelve cuando la fase se asienta. */
  encender(): Promise<void>
  /** Toque en «Tocá para reanudar»: mismo orden sincrónico que encender (incluye requestPermission y después watchPosition). Idempotente. */
  reanudar(): Promise<void>
  /** Borra la intención, suelta sensores, GPS, wake lock y candado, descarta episodios abiertos. No cierra una alerta abierta ni borra el golpe pendiente. Idempotente. */
  apagar(motivo: 'usuario' | 'inactividad' | 'accidente_registrado' | 'configuracion'): void
  /** Toque explícito que destraba pantalla y audio (lo mismo que hace el destrabador global). */
  tocar(): void
  /** Dentro de un gesto: watchPosition cuando gps es 'requiere_toque'. */
  activarGps(): void
  /** El proveedor avisa cada cambio de usePathname(). */
  cambiarRuta(ruta: string): void
  /** pregunta: estoy_bien → hubo_choque (detenido o sin velocidad confiable) o cerrada con golpe pendiente (en movimiento); necesito_ayuda → ayuda. En ayuda o hubo_choque, necesito_ayuda sólo se registra si todavía no hubo respuesta humana (tocar un tel:). Sincrónico. */
  responder(respuesta: 'estoy_bien' | 'necesito_ayuda'): void
  /** En hubo_choque: true marca hubo_choque (el botón sigue con registrarAccidente); false marca hubo_choque = false y cierra. */
  marcarHuboChoque(hubo: boolean): void
  /** «Estoy bien, fue una falsa alarma» en la ayuda: estoy_bien + hubo_choque = false, cierra y borra el golpe pendiente. */
  falsaAlarma(): void
  /** «Seguir» de la pregunta de inactividad. */
  seguirViaje(): void
  /** «Probar la alerta»: suena y vibra 1 s por el mismo camino que la alerta real, dentro del gesto. */
  probarAlerta(): void
  /**
   * §3.4 sin navegar: idCliente = el pasado, o el de la alerta, o el del golpe pendiente; si hay, drena esa alerta
   * (con await), marca hubo_choque = true y toma su idServidor (o el pasado, o el del golpe pendiente). POST /api/casos
   * con { telemetria_id } si hay id, o {} si no. 2xx: fuentes.local.recordarActuacion(id, secreto), cierra la alerta, borra el golpe
   * pendiente, apagar('accidente_registrado'). fetch que rechaza → sin_red. Otro estado → error con cuerpo.error o
   * el texto ayuda.error_registro.
   */
  registrarAccidente(telemetria?: { idCliente?: string | null; idServidor?: string | null }): Promise<ResultadoRegistro>
  /** «No, fue una falsa alarma» sobre el golpe pendiente: hubo_choque = false en su alerta y lo borra. */
  descartarGolpePendiente(): void
  /** «Borrar mis registros del modo viaje»: vacía la cola local y hace DELETE /api/telemetria/mias. */
  borrarRegistros(): Promise<ResultadoBorrado>
  /** Drena la cola (con navigator.locks 'acta-viaje-drenado' e ifAvailable donde exista). Nunca rechaza. */
  drenarCola(): Promise<void>
  /** Quita listeners, clearWatch, libera sentinel y candado, cierra el audio, cancela temporizadores. */
  destruir(): void
}

type FaseMotor = EstadoModoViaje['fase']
type AlertaVisible = NonNullable<EstadoModoViaje['alerta']>
type MotivoApagado = NonNullable<EstadoModoViaje['apagadoPor']>['motivo']

/** La alerta viva con lo que no se publica: sus campos para la cola y cuántos episodios lleva. */
interface AlertaInterna {
  estado: AlertaVisible['estado']
  idCliente: string
  idServidor: string | null
  plazo: number | null
  restanteS: number | null
  ocurridoEn: number
  abiertaEn: number
  ayudaDesde: number | null
  apertura: AlertaVisible['apertura']
  origenAyuda: AlertaVisible['origenAyuda']
  respuestas: Array<{ respuesta: RespuestaAlerta; enTelefono: number }>
  huboChoque: boolean | null
  armada: boolean
  ubicacion: { lat: number; lon: number } | null
  campos: CamposAlerta
  episodios: number
  /** Restaurada tras una recarga: no se sabe cuántos episodios tenía ni si sonó, así que no se agregan ni se pisa el sonido. */
  restaurada: boolean
}

interface IntencionGuardada {
  encendidoEn: number
  ultimoLatido: number
  ultimoMovimiento: number
  documentoId: string
}

const CLAVE_INTENCION = 'acta:viaje'
const CLAVE_GOLPE = 'acta:golpe-pendiente'
const CLAVE_ALERTA = 'acta:viaje:alerta'
const CLAVE_SIN_SENSORES = 'acta:viaje:sin-sensores'
const CLAVE_CONFIGURACION = 'acta:viaje:configuracion'
const CLAVE_DIAGNOSTICO = 'acta:diagnostico'
const CANDADO_VENTANA = 'acta-modo-viaje'
const CANDADO_DRENADO = 'acta-viaje-drenado'

const MINUTO = 60_000
const MS_TIC = 1000
const MS_LATIDO = 30_000
const MS_INTENCION_VIGENTE = 30 * MINUTO
const MS_PREGUNTA = 30_000
const MS_HUBO_CHOQUE = 60_000
const MS_ARMADO = 600
const MS_VIBRACION = 2000
const PATRON_VIBRACION = [400, 200, 400]
const MS_GPS_BUSCANDO = 5000
const MS_CONFIGURACION = 10 * MINUTO
const MS_CONFIGURACION_VIGENTE = 24 * 60 * MINUTO
const MS_ESPERA_LECTURAS = 3000
const MS_SIN_SENSORES_VIGENTE = 24 * 60 * MINUTO
const MS_GOLPE_VIGENTE = 30 * MINUTO
const MS_AYUDA_VIGENTE = 30 * MINUTO
const MS_INACTIVIDAD = 15 * MINUTO
const MS_PREGUNTA_INACTIVIDAD = 10 * MINUTO
const MS_LOTE_CONDUCCION = 5 * MINUTO
const EVENTOS_POR_LOTE = 10
const MAX_HUECOS = 10
const MAX_EPISODIOS_DIAGNOSTICO = 20
const MAX_EPISODIOS_ALERTA = 50
const MAX_RESPUESTAS_TRANSPORTE = 5
const MS_DESVIO_TIMESTAMP = 10_000
const MS_MEDIA_SIGUIO = 30_000
const KMH_SIGUIO = 15
const MS_DETENIDO = 10_000
const MS_HISTORIAL_FIXES = 120_000
const MS_PRUEBA_ALERTA = 1000
const MS_MAX_RESPUESTA = 86_400_000
const TIPOS_GESTO = ['pointerup', 'touchend', 'click', 'keydown'] as const
const OPCIONES_DESTRABADOR: AddEventListenerOptions = { capture: true, passive: true }
const TEXTO_ERROR_REGISTRO = 'No se pudo abrir la actuación. Esperá unos segundos y volvé a tocar el botón.'
const TEXTO_ERROR_BORRADO = 'No se pudieron borrar los registros del servidor. Esperá unos segundos y volvé a tocar el botón.'

const esNumero = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)
const esTexto = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const esObjeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const redondear = (v: number, decimales: number) => Math.round(v * 10 ** decimales) / 10 ** decimales
const iso = (ms: number) => new Date(ms).toISOString()
const humana = (r: { respuesta: RespuestaAlerta }) => r.respuesta === 'estoy_bien' || r.respuesta === 'necesito_ayuda'

function coincide(ruta: string, patrones: readonly string[]): boolean {
  return patrones.some((p) => (p.endsWith('*') ? ruta.startsWith(p.slice(0, -1)) : ruta === p))
}

function plataformaDe(userAgent: string, documento: object): EstadoModoViaje['plataforma'] {
  if (/iPhone|iPad|iPod/.test(userAgent) || (/Macintosh/.test(userAgent) && 'ontouchend' in documento)) return 'ios'
  if (/Android/.test(userAgent)) return 'android'
  return 'otro'
}

export function crearMotorViaje(fuentes: FuentesMotor): MotorViaje {
  const { reloj, navegador } = fuentes
  const plataforma = plataformaDe(navegador.userAgent ?? '', fuentes.documento)

  /* ---------- Estado interno ---------- */
  let destruido = false
  /** Sube con cada encendido, reanudación o apagado: una continuación async vieja se reconoce y no pisa nada. */
  let intento = 0
  let fase: FaseMotor = 'apagado'
  let motivoNoSoportado: EstadoModoViaje['motivoNoSoportado'] = null
  let gps: EstadoModoViaje['gps'] = 'no_aplica'
  let pantallaLiberada = false
  let huboGesto = false
  let fuente: EstadoModoViaje['fuente'] = 'confiable'
  let alerta: AlertaInterna | null = null
  let inactividad: EstadoModoViaje['inactividad'] = null
  let golpePendiente: EstadoModoViaje['golpePendiente'] = null
  let apagadoPor: EstadoModoViaje['apagadoPor'] = null
  let ruta: EstadoModoViaje['ruta'] = { actual: '', enPausa: false, conPildora: false }
  let velocidadKmh: number | null = null
  let precisionM: number | null = null
  let siguioPorMovimientoEn: number | null = null
  let diagnosticoActivo = false
  let gVivo: number | null = null
  let hzVivo: number | null = null
  const episodiosRecientes: Array<{ en: number; nivel: NivelImpacto; picoG: number; motivo: string }> = []
  let configuracion: EstadoModoViaje['configuracion'] = { version: null, alerta: 'normal', caidaSinGolpe: 'silenciosa', umbrales: { ...UMBRALES }, desactualizado: false }
  let intencion: IntencionGuardada | null = null
  let documentoId: string | null = null
  let ultimoMovimiento = reloj.pared()

  const detector = crearDetector({ umbrales: configuracion.umbrales, caidaSinGolpe: configuracion.caidaSinGolpe })

  /* ---------- Temporizadores ---------- */
  const temporizadores = new Set<number>()
  function programar(fn: () => void, ms: number): number {
    const id = reloj.programar(() => {
      temporizadores.delete(id)
      if (!destruido) fn()
    }, Math.max(0, ms))
    temporizadores.add(id)
    return id
  }
  function cancelar(id: number | null): null {
    if (id !== null) {
      reloj.cancelar(id)
      temporizadores.delete(id)
    }
    return null
  }

  /* ---------- Instantánea ---------- */
  const suscriptores = new Set<() => void>()
  let actual: EstadoModoViaje | null = null
  let actualJson = ''

  function armarEstado(): EstadoModoViaje {
    return {
      fase,
      motivoNoSoportado,
      gps,
      pantalla: pantallaActual(),
      pantallaLiberada,
      avisos: { sonido: sonidoListo() ? 'listo' : 'requiere_toque', vibracion: vibracionActual() },
      sesionDeAudio: navegador.audioSession !== undefined,
      fuente,
      plataforma,
      standalone: fuentes.standalone,
      alerta: alerta
        ? {
            estado: alerta.estado,
            idCliente: alerta.idCliente,
            idServidor: alerta.idServidor,
            plazo: alerta.plazo,
            restanteS: alerta.restanteS,
            ocurridoEn: alerta.ocurridoEn,
            abiertaEn: alerta.abiertaEn,
            apertura: alerta.apertura,
            origenAyuda: alerta.origenAyuda,
            respuestas: alerta.respuestas.map((r) => ({ respuesta: r.respuesta, enTelefono: r.enTelefono })),
            respondida: alerta.respuestas.some(humana),
            armada: alerta.armada,
            ubicacion: alerta.ubicacion ? { ...alerta.ubicacion } : null,
          }
        : null,
      inactividad: inactividad ? { ...inactividad } : null,
      golpePendiente: golpePendiente ? { ...golpePendiente } : null,
      apagadoPor: apagadoPor ? { ...apagadoPor } : null,
      deteccion: { activaMs: Math.round(activaMs), totalMs: Math.round(totalMs), huecos: huecos.map((h) => ({ ...h })) },
      configuracion: { ...configuracion, umbrales: { ...configuracion.umbrales } },
      ruta: { ...ruta },
      velocidadKmh,
      precisionM,
      siguioPorMovimientoEn,
      diagnostico: diagnosticoActivo ? { gVivo, hz: hzVivo, episodios: episodiosRecientes.map((e) => ({ ...e })) } : null,
    }
  }

  /** Reemplaza la instantánea sólo si algo cambió: getSnapshot devuelve la misma referencia mientras tanto. */
  function publicar(): void {
    if (destruido || actual === null) return
    const nuevo = armarEstado()
    const json = JSON.stringify(nuevo)
    if (json === actualJson) return
    actual = congelar(nuevo)
    actualJson = json
    for (const fn of [...suscriptores]) fn()
  }

  /* ---------- Almacenamiento ---------- */
  function leerJson(clave: string): unknown {
    try {
      const texto = fuentes.almacenamiento?.getItem(clave)
      return typeof texto === 'string' ? JSON.parse(texto) : null
    } catch {
      return null
    }
  }
  function escribirJson(clave: string, valor: unknown): void {
    try {
      fuentes.almacenamiento?.setItem(clave, JSON.stringify(valor))
    } catch {
      /* sin almacenamiento: se pierde la reanudación, no la detección */
    }
  }
  function borrarClave(clave: string): void {
    try {
      fuentes.almacenamiento?.removeItem(clave)
    } catch {
      /* ídem */
    }
  }
  function leerDiagnostico(): boolean {
    try {
      return (fuentes.almacenamiento?.getItem(CLAVE_DIAGNOSTICO) ?? null) !== null
    } catch {
      return false
    }
  }

  /** Una intención vigente o null. No borra nada: eso lo decide quien la lee. */
  function leerIntencion(): IntencionGuardada | null {
    const v = leerJson(CLAVE_INTENCION)
    if (!esObjeto(v) || !esNumero(v.encendidoEn) || !esNumero(v.ultimoLatido)) return null
    return {
      encendidoEn: v.encendidoEn,
      ultimoLatido: v.ultimoLatido,
      ultimoMovimiento: esNumero(v.ultimoMovimiento) ? v.ultimoMovimiento : v.ultimoLatido,
      documentoId: esTexto(v.documentoId) ? v.documentoId : '',
    }
  }
  function escribirIntencion(): void {
    const pared = reloj.pared()
    documentoId ??= fuentes.nuevoId()
    intencion = {
      encendidoEn: intencion?.encendidoEn ?? pared,
      ultimoLatido: pared,
      ultimoMovimiento,
      documentoId,
    }
    escribirJson(CLAVE_INTENCION, intencion)
  }
  function borrarIntencion(): void {
    intencion = null
    borrarClave(CLAVE_INTENCION)
  }

  /* ---------- Rutas ---------- */
  function cambiarRuta(nueva: string): void {
    if (destruido) return
    ruta = { actual: nueva, enPausa: coincide(nueva, RUTAS_EN_PAUSA), conPildora: !coincide(nueva, RUTAS_SIN_PILDORA) }
    publicar()
  }

  /* ---------- Pantalla ---------- */
  let centinela: CentinelaMotor | null = null
  function pantallaActual(): EstadoModoViaje['pantalla'] {
    if (!navegador.wakeLock) return 'no_soportada'
    return centinela && !centinela.released ? 'retenida' : 'sin_retener'
  }

  /* ---------- Audio y vibración ---------- */
  let audio: AudioMotor | null = null
  let audioDestrabado = false
  function sonidoListo(): boolean {
    if (!audio || !audioDestrabado) return false
    const e = audio.estado()
    return e !== 'closed' && e !== 'interrupted'
  }
  function vibracionActual(): EstadoModoViaje['avisos']['vibracion'] {
    if (typeof navegador.vibrate !== 'function') return 'no_soportada'
    return huboGesto ? 'listo' : 'requiere_toque'
  }

  /* ---------- Movimiento y detección ---------- */
  let activaMs = 0
  let totalMs = 0
  let huecos: Array<{ inicio: number; ms: number }> = []

  function destruir(): void {
    if (destruido) return
    intento++
    for (const id of temporizadores) reloj.cancelar(id)
    temporizadores.clear()
    suscriptores.clear()
    destruido = true
  }

  /* ---------- Arranque ---------- */
  diagnosticoActivo = leerDiagnostico()
  actual = congelar(armarEstado())
  actualJson = JSON.stringify(actual)

  return {
    suscribir(fn) {
      suscriptores.add(fn)
      return () => {
        suscriptores.delete(fn)
      }
    },
    estado: () => actual ?? ESTADO_SERVIDOR,
    encender: () => Promise.resolve(),
    reanudar: () => Promise.resolve(),
    apagar: () => undefined,
    tocar: () => undefined,
    activarGps: () => undefined,
    cambiarRuta,
    responder: () => undefined,
    marcarHuboChoque: () => undefined,
    falsaAlarma: () => undefined,
    seguirViaje: () => undefined,
    probarAlerta: () => undefined,
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente: () => undefined,
    borrarRegistros: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_BORRADO }),
    drenarCola: () => Promise.resolve(),
    destruir,
  }
}

/* ================= Fuentes del navegador ================= */

/** UUID v4. Fuera de contexto seguro no hay randomUUID, y el motor se crea igual para decir no_soportado. */
function nuevoUuid(cripto: Crypto | undefined): string {
  if (cripto && typeof cripto.randomUUID === 'function') {
    try {
      return cripto.randomUUID()
    } catch {
      /* se arma a mano abajo */
    }
  }
  const b = new Uint8Array(16)
  if (cripto && typeof cripto.getRandomValues === 'function') cripto.getRandomValues(b)
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256)
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** El AudioContext envuelto. Los pulsos se agendan en la línea de tiempo del contexto: no dependen de temporizadores. */
function audioWeb(contexto: AudioContext, esperar: (fn: () => void, ms: number) => void): AudioMotor {
  const pitido = (inicio: number, duracion: number, volumen: number): OscillatorNode => {
    const oscilador = contexto.createOscillator()
    const ganancia = contexto.createGain()
    oscilador.frequency.value = 880
    ganancia.gain.setValueAtTime(0, inicio)
    ganancia.gain.linearRampToValueAtTime(volumen, inicio + 0.02)
    ganancia.gain.setValueAtTime(volumen, inicio + Math.max(0.03, duracion - 0.03))
    ganancia.gain.linearRampToValueAtTime(0, inicio + duracion)
    oscilador.connect(ganancia).connect(contexto.destination)
    oscilador.start(inicio)
    oscilador.stop(inicio + duracion)
    return oscilador
  }
  return {
    estado: () => contexto.state,
    destrabar() {
      const reanudado = contexto.resume()
      try {
        const fuente = contexto.createBufferSource()
        fuente.buffer = contexto.createBuffer(1, 1, contexto.sampleRate)
        fuente.connect(contexto.destination)
        fuente.start(0)
      } catch {
        /* el resume dentro del gesto alcanza en los navegadores nuevos */
      }
      // Queda destrabado sin retener la sesión de audio: la música de la persona sigue sonando.
      void reanudado.then(() => contexto.suspend()).catch(() => undefined)
    },
    despertar() {
      return new Promise<boolean>((resolver) => {
        void contexto.resume().catch(() => undefined)
        esperar(() => resolver(contexto.state === 'running'), 500)
      })
    },
    tono(duracionMs) {
      const total = Math.max(1, duracionMs / 1000)
      const inicio = contexto.currentTime + 0.05
      const pitidos: OscillatorNode[] = []
      for (let s = 0; s < total; s++) {
        const faltan = total - s
        // Sube de volumen en los últimos 15 s: quien no respondió al principio tiene que oírlo al final.
        const volumen = faltan <= 15 ? 0.35 + 0.65 * (1 - faltan / 15) : 0.35
        pitidos.push(pitido(inicio + s, Math.min(0.4, Math.max(0.1, faltan)), volumen))
      }
      return () => {
        for (const p of pitidos) {
          try {
            p.stop()
          } catch {
            /* ya había terminado */
          }
          p.disconnect()
        }
      }
    },
    pulso() {
      void contexto
        .resume()
        .then(() => {
          pitido(contexto.currentTime + 0.02, 0.2, 0.5)
        })
        .catch(() => undefined)
    },
    suspender() {
      void contexto.suspend().catch(() => undefined)
    },
    cerrar() {
      void contexto.close().catch(() => undefined)
    },
    alCambiar(fn) {
      contexto.addEventListener('statechange', fn)
      return () => contexto.removeEventListener('statechange', fn)
    },
  }
}

/**
 * Lee SIEMPRE de window: Node 24 tiene navigator y performance globales, y un motor armado con ellos en el
 * servidor diría que hay sensores. Tolera que falte cualquier API salvo addEventListener, document y userAgent.
 */
function fuentesDelNavegador(): FuentesMotor {
  const w = window
  let almacenamiento: AlmacenamientoMotor | null
  try {
    almacenamiento = w.localStorage
  } catch {
    almacenamiento = null
  }
  const conAudio = w as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }
  const Contexto = conAudio.AudioContext ?? conAudio.webkitAudioContext
  const conMovimiento = w as unknown as { DeviceMotionEvent?: { requestPermission?: () => Promise<'granted' | 'denied'> } }
  let standalone = false
  try {
    standalone = w.matchMedia?.('(display-mode: standalone)').matches === true || (w.navigator as unknown as { standalone?: boolean }).standalone === true
  } catch {
    standalone = false
  }
  return {
    reloj: {
      mono: () => (w.performance ? w.performance.now() : Date.now()),
      pared: () => Date.now(),
      programar: (fn, ms) => w.setTimeout(fn, ms),
      cancelar: (id) => w.clearTimeout(id),
    },
    ventana: w,
    documento: w.document,
    navegador: w.navigator as unknown as NavegadorMotor,
    movimiento: typeof conMovimiento.DeviceMotionEvent === 'undefined' ? null : conMovimiento.DeviceMotionEvent,
    almacenamiento,
    local: {
      recordarActuacion: (id, secreto) => recordarActuacion(id, secreto),
      actuacionAbierta: () => actuacionAbierta(),
    },
    cola: crearColaViaje(almacenIndexedDb()),
    fetch: (ruta, init) => w.fetch(ruta, init),
    crearAudio: Contexto ? () => audioWeb(new Contexto(), (fn, ms) => w.setTimeout(fn, ms)) : null,
    seguro: w.isSecureContext === true,
    standalone,
    nuevoId: () => nuevoUuid(w.crypto),
  }
}

let instancia: MotorViaje | null = null

/**
 * null si typeof window === 'undefined' (typeof navigator no sirve: Node ≥ 21 lo define). Si no, devuelve la
 * instancia de este módulo o la crea con las fuentes del navegador; antes de crearla, si encuentra una previa en
 * globalThis.__actaMotorViaje (Fast Refresh o otra evaluación del módulo), llama previa.destruir(). Guarda la
 * nueva ahí. La nueva arranca por el camino normal de reanudación desde lo guardado.
 */
export function motorDelNavegador(): MotorViaje | null {
  if (typeof window === 'undefined') return null
  if (instancia) return instancia
  const global = globalThis as typeof globalThis & { __actaMotorViaje?: MotorViaje }
  const previa = global.__actaMotorViaje
  if (previa) {
    try {
      previa.destruir()
    } catch {
      /* una instancia rota no impide crear la nueva */
    }
  }
  instancia = crearMotorViaje(fuentesDelNavegador())
  global.__actaMotorViaje = instancia
  return instancia
}
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   AVISOS_DATOS_CONOCIDOS del servidor incluye AVISO_DATOS_VERSION
  ok   VERSION_MOTOR es un entero de 1 a 1000
  ok   RUTAS_EN_PAUSA y RUTAS_SIN_PILDORA son las de §3.2 y §3.6
  ok   ESTADO_SERVIDOR arranca desconocido y sin nada vivo
  ok   ESTADO_SERVIDOR está congelado en profundidad
  ok   UMBRALES de lib/impacto.ts no se congela
  ok   sin window no hay motor, aunque Node tenga navigator
  ok   un motor nuevo sin intención arranca apagado
  ok   estado() devuelve la misma referencia mientras nada cambia
  ok   al cambiar algo la instantánea se reemplaza entera y avisa
  ok   la instantánea nueva también está congelada
  ok   lo que no cambia nada no reemplaza ni avisa
  ok   desuscribir deja de avisar
  ok   crear el motor no toca ni el reloj ni los sensores
  ok   motor nuevo: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   un motor destruido sigue devolviendo su última instantánea
  ok   motorDelNavegador crea la instancia con window y la reutiliza
  ok   otra evaluación del módulo destruye la instancia previa antes de crear la suya
  ok   motorDelNavegador: sin temporizadores ni escuchas al terminar
```

y al final:

```text
36/36 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 6: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Crear el motor del modo viaje fuera de React con un estado inmutable

La alerta tiene que sobrevivir a un cambio de pantalla y a una recarga: vivía en
DetectorImpacto.tsx y se perdía al desmontarse. El motor vive en lib/viaje.ts, recibe el
navegador por fuentes inyectadas y publica una instantánea congelada que cambia de
referencia sólo cuando algo cambió, que es lo que useSyncExternalStore necesita.
motorDelNavegador devuelve null sin window y destruye la instancia previa que deja Fast
Refresh.

No toca window, document ni navigator al importarse: el layout lo va a importar durante el
render del servidor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Encendido (§4.1) y gesto; `sin_lecturas`

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido (los números de línea son los de hoy)
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V6]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V6]`

**Interfaces:**
- Consumes:
  - De la Tarea 3: `programar`, `cancelar`, `publicar`, `leerJson`, `escribirJson`, `borrarClave`, `escribirIntencion`, `borrarIntencion`, `plataformaDe` y el `detector` creado con `crearDetector`.
  - Del detector (F2): `muestra(m: MuestraMovimiento, pared): EventoDetector[]`, `fix(f: FixGps): EventoDetector[]`, `avanzar(mono, pared): EventoDetector[]`, `gpsSinDatos(mono, pared): EventoDetector[]`, `descartarAbiertos(): void` y `resumen(mono): ResumenDetector` (`fuente`, `hzMedido`, `gVivo`, `velocidadKmh`, `precisionM`, `enMovimiento`).
- Produces:
  - `encender(): Promise<void>`: lo sincrónico de §4.1 antes de cualquier `await` y en este orden: `navigator.wakeLock.request('screen')`, destrabe del audio (`crearAudio()` + `destrabar()`), `DeviceMotionEvent.requestPermission?.()`. Resuelve cuando la fase se asienta; llamado otra vez mientras pide devuelve la misma promesa y no pide nada.
  - `apagar(motivo)`: idempotente; suelta `devicemotion`, GPS y wake lock, descarta los episodios abiertos del detector, borra `acta:viaje` y deja `apagadoPor: { motivo, hora }`, `gps: 'no_aplica'` y la detección en cero.
  - Fases: `pidiendo`; `activo` con la primera lectura válida (y recién ahí escribe `acta:viaje`); `sin_permiso` con `'denied'`; `reanudar_con_toque` con el rechazo; `sin_lecturas` si a los 3 s del permiso no hubo lecturas (borra la intención y escribe `acta:viaje:sin-sensores` `{ en }`, que al crearse otro motor dentro de las 24 h lo deja en `sin_lecturas`); `no_soportado` con `motivoNoSoportado` `inseguro` o `sin_sensores`.
  - `gps`: `buscando` al vigilar y a los 5 s sin fix, `ok` o `impreciso` según `PRECISION_CONFIABLE_M`, `sin_permiso` con el error 1. `pantalla`: `retenida`, `sin_retener` o `no_soportada` (`no_garantizada` llega con la Tarea 5). `avisos.sonido` y `avisos.vibracion`. Tic del detector cada 1 s que actualiza `fuente`, `velocidadKmh`, `precisionM`, `deteccion.activaMs` y `totalMs`, y `diagnostico` si existe `acta:diagnostico`.
  - Internas que usan las tareas siguientes: `procesar(eventos)` (en esta tarea descarta; la Tarea 7 la reemplaza), `actualizarDestrabador()` (vacía; la Tarea 5 la reemplaza), `asegurarPantalla(): Promise<boolean>`, `soltarPantalla()`, `alSoltarPantalla()`, `asegurarAudio()`, `destrabarAudio()`, `alCambiarAudio()`, `estaEncendido()`, `vigilarGps()`, `soltarGps()`, `alFix(pos)`, `escuchar()`, `dejarDeEscuchar()`, `tic()`, `contarDeteccion(mono, pared)`, `anotarHueco(inicio, ms)`, `nuevoAsentamiento()`, `asentar()`, `soltarTodo()`, `arrancarConGesto()`, `continuarArranque(mio, permiso, pantalla, conGesto)`, `terminarArranque()`, `lecturasRecibidas()`, `sinLecturas(mio)` y `apagarCon(motivo, borrar)`.

**Decisiones de esta tarea:**

- «Lecturas válidas» (§4.1, paso 7) es un `devicemotion` con `acceleration` o `accelerationIncludingGravity` con los tres ejes numéricos. La primera pasa a `activo` enseguida: no hace esperar 3 s a quien tiene sensores. No se mira `isTrusted`: F4 y F6 prueban en escritorio con eventos sintéticos.
- `intento` sube con cada encendido, reanudación, apagado y destrucción: la continuación de un `await` viejo se reconoce (`mio !== intento`) y no pisa el estado nuevo.
- Un `e.timeStamp` a más de 10 s de `mono()` se reemplaza por `mono()` al recibir la muestra (riesgo 24).
- Los errores 2 y 3 del GPS son pasajeros: sigue vigilando y el temporizador de 5 s dice `buscando`. Sólo el 1 suelta la vigilancia y deja `sin_permiso`.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V6]` los bloques de encendido. La primera verificación mira los contadores de las fuentes falsas inmediatamente después de llamar a `encender()`, sin ningún `await` en el medio: es la regla del gesto (riesgo 20).

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V6]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Encendido (§4.1): lo sincrónico dentro del gesto, la intención recién con lecturas */
  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const falsas = crearFuentesFalsas({ movimiento: 'granted', demoraPermisoMs: 8000 })
    const motor = crearMotorViaje(falsas.fuentes)
    motor.cambiarRuta('/')
    falsas.gesto()
    const listo = motor.encender()
    verificar('encender pide el wake lock, destraba el audio y pide el permiso antes de cualquier await', falsas.wakeLock.pedidos === 1 && falsas.audio.destrabes === 1 && falsas.movimiento.pedidos === 1)
    verificar('mientras el diálogo está abierto la fase es pidiendo', motor.estado().fase === 'pidiendo')
    verificar('encender otra vez devuelve lo mismo y no pide nada más', motor.encender() === listo && falsas.wakeLock.pedidos === 1 && falsas.movimiento.pedidos === 1)
    verificar('el GPS no se pide mientras está el diálogo del movimiento', falsas.geo.pedidos === 0)
    await falsas.reloj.avanzar(8000)
    verificar('el pedido sincrónico obtuvo el wake lock aunque el diálogo tardó 8 s', motor.estado().pantalla === 'retenida' && falsas.wakeLock.activos === 1)
    verificar('recién con el permiso se vigila el GPS, de a uno', falsas.geo.pedidos === 1 && falsas.geo.vigilancias === 1 && motor.estado().gps === 'buscando')
    verificar('sin lecturas todavía no hay intención guardada', !falsas.almacenamiento.mapa.has('acta:viaje') && motor.estado().fase === 'pidiendo')
    falsas.movimiento.emitir({ t: falsas.reloj.mono(), a: null, aIG: null, giro: null })
    verificar('un devicemotion sin números no cuenta como lectura', motor.estado().fase === 'pidiendo')
    falsas.movimiento.emitir(quieta(falsas.reloj.mono()))
    await listo
    const activo = motor.estado()
    verificar('con la primera lectura válida pasa a activo', activo.fase === 'activo' && falsas.ventana.escuchas('devicemotion') === 1)
    const intencion = JSON.parse(falsas.almacenamiento.mapa.get('acta:viaje') ?? 'null')
    verificar('y recién ahí guarda la intención', intencion !== null && intencion.ultimoLatido === falsas.reloj.pared() && intencion.encendidoEn === falsas.reloj.pared() && /^[A-Za-z0-9-]{8,64}$/.test(intencion.documentoId))
    verificar('con el gesto del encendido, sonido y vibración quedan listos', activo.avisos.sonido === 'listo' && activo.avisos.vibracion === 'listo')
    await falsas.reloj.avanzar(3000)
    verificar('pasados los 3 s con lecturas no se declara sin_lecturas', motor.estado().fase === 'activo')
    motor.apagar('usuario')
    const apagado = motor.estado()
    verificar('apagar suelta devicemotion, GPS y wake lock y borra la intención', falsas.ventana.escuchas('devicemotion') === 0 && falsas.geo.vigilancias === 0 && falsas.wakeLock.activos === 0 && !falsas.almacenamiento.mapa.has('acta:viaje'))
    verificar('apagar deja el motivo y la hora', apagado.fase === 'apagado' && apagado.apagadoPor?.motivo === 'usuario' && apagado.apagadoPor.hora === falsas.reloj.pared() && apagado.gps === 'no_aplica')
    motor.apagar('inactividad')
    verificar('apagar otra vez no cambia nada', motor.estado() === apagado)
    terminar('encendido', motor, falsas)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const falsas = crearFuentesFalsas()
    const motor = crearMotorViaje(falsas.fuentes)
    falsas.gesto()
    const listo = motor.encender()
    await falsas.reloj.avanzar(2999)
    verificar('sin lecturas: a los 2,999 s todavía espera', motor.estado().fase === 'pidiendo')
    await falsas.reloj.avanzar(1)
    await listo
    const e = motor.estado()
    verificar('sin lecturas en 3 s desde el permiso: sin_lecturas', e.fase === 'sin_lecturas')
    verificar('sin_lecturas no deja intención y suelta todo', !falsas.almacenamiento.mapa.has('acta:viaje') && falsas.ventana.escuchas('devicemotion') === 0 && falsas.geo.vigilancias === 0 && falsas.wakeLock.activos === 0)
    const marca = JSON.parse(falsas.almacenamiento.mapa.get('acta:viaje:sin-sensores') ?? 'null')
    verificar('y lo recuerda 24 h para decirlo sin volver a pedir permiso', marca?.en === falsas.reloj.pared())
    terminar('sin lecturas', motor, falsas)
    const otra = crearFuentesFalsas({ almacenamiento: falsas.almacenamiento.mapa, inicioPared: falsas.reloj.pared() + 60_000 })
    const motorOtra = crearMotorViaje(otra.fuentes)
    verificar('al recargar dentro de las 24 h arranca en sin_lecturas', motorOtra.estado().fase === 'sin_lecturas' && otra.movimiento.pedidos === 0)
    terminar('sin lecturas recargado', motorOtra, otra)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const negado = crearFuentesFalsas({ movimiento: 'denied' })
    const motorNegado = crearMotorViaje(negado.fuentes)
    negado.gesto()
    await motorNegado.encender()
    await negado.reloj.avanzar(0)
    verificar("'denied' al encender: sin_permiso y suelta el wake lock", motorNegado.estado().fase === 'sin_permiso' && negado.wakeLock.activos === 0 && negado.geo.pedidos === 0)
    terminar('permiso negado', motorNegado, negado)

    const sinPermiso = crearFuentesFalsas({ movimiento: 'NotAllowedError' })
    const motorSinPermiso = crearMotorViaje(sinPermiso.fuentes)
    await motorSinPermiso.encender()
    await sinPermiso.reloj.avanzar(0)
    verificar('NotAllowedError al encender sin activación: reanudar_con_toque', motorSinPermiso.estado().fase === 'reanudar_con_toque' && sinPermiso.wakeLock.activos === 0)
    terminar('NotAllowedError al encender', motorSinPermiso, sinPermiso)

    const inseguro = crearFuentesFalsas({ seguro: false })
    const motorInseguro = crearMotorViaje(inseguro.fuentes)
    inseguro.gesto()
    await motorInseguro.encender()
    verificar('sin https: no_soportado por inseguro y encender no pide nada', motorInseguro.estado().fase === 'no_soportado' && motorInseguro.estado().motivoNoSoportado === 'inseguro' && inseguro.wakeLock.pedidos === 0 && inseguro.movimiento.pedidos === 0)
    terminar('inseguro', motorInseguro, inseguro)

    const sinSensores = crearFuentesFalsas({ movimiento: 'ausente' })
    const motorSinSensores = crearMotorViaje(sinSensores.fuentes)
    verificar('sin DeviceMotionEvent: no_soportado por sin_sensores', motorSinSensores.estado().fase === 'no_soportado' && motorSinSensores.estado().motivoNoSoportado === 'sin_sensores')
    terminar('sin sensores', motorSinSensores, sinSensores)

    const iphone = crearFuentesFalsas({ userAgent: IPHONE_18_4, vibracion: false, sesionDeAudio: true })
    const motorIphone = crearMotorViaje(iphone.fuentes)
    const e = motorIphone.estado()
    verificar('iPhone: plataforma ios; sin vibrate la vibración es no_soportada y con audioSession se informa', e.plataforma === 'ios' && e.avisos.vibracion === 'no_soportada' && e.sesionDeAudio)
    terminar('iPhone', motorIphone, iphone)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Con los métodos vacíos de la Tarea 3 fallan las verificaciones que esperan un encendido; las que ya se cumplen con un motor que nunca enciende (lo que suelta `apagar`, la plataforma y los avisos del iPhone, la limpieza al terminar) pasan. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA encender pide el wake lock, destraba el audio y pide el permiso antes de cualquier await 
  FALLA mientras el diálogo está abierto la fase es pidiendo 
  FALLA encender otra vez devuelve lo mismo y no pide nada más 
  FALLA el pedido sincrónico obtuvo el wake lock aunque el diálogo tardó 8 s 
  FALLA recién con el permiso se vigila el GPS, de a uno 
  FALLA sin lecturas todavía no hay intención guardada 
  FALLA un devicemotion sin números no cuenta como lectura 
  FALLA con la primera lectura válida pasa a activo 
  FALLA y recién ahí guarda la intención 
  FALLA con el gesto del encendido, sonido y vibración quedan listos 
  FALLA pasados los 3 s con lecturas no se declara sin_lecturas 
  FALLA apagar deja el motivo y la hora 
  FALLA sin lecturas: a los 2,999 s todavía espera 
  FALLA sin lecturas en 3 s desde el permiso: sin_lecturas 
  FALLA y lo recuerda 24 h para decirlo sin volver a pedir permiso 
  FALLA al recargar dentro de las 24 h arranca en sin_lecturas 
  FALLA 'denied' al encender: sin_permiso y suelta el wake lock 
  FALLA NotAllowedError al encender sin activación: reanudar_con_toque 
  FALLA sin https: no_soportado por inseguro y encender no pide nada 
  FALLA sin DeviceMotionEvent: no_soportado por sin_sensores 
```

y al final:

```text
49/69 verificaciones pasaron
20 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 3): los tipos, junto a `MotorViaje`; `vector`, `muestraDe`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 297):

```ts
  destruir(): void
}

type FaseMotor = EstadoModoViaje['fase']
type AlertaVisible = NonNullable<EstadoModoViaje['alerta']>
type MotivoApagado = NonNullable<EstadoModoViaje['apagadoPor']>['motivo']
```

por:

```ts
  destruir(): void
}

/** Un devicemotion tal como llega; el navegador puede mandar null en cualquier eje. */
interface EventoMovimiento {
  readonly timeStamp: number
  readonly acceleration: { readonly x: number | null; readonly y: number | null; readonly z: number | null } | null
  readonly accelerationIncludingGravity: { readonly x: number | null; readonly y: number | null; readonly z: number | null } | null
  readonly rotationRate: { readonly alpha: number | null; readonly beta: number | null; readonly gamma: number | null } | null
}

type FaseMotor = EstadoModoViaje['fase']
type AlertaVisible = NonNullable<EstadoModoViaje['alerta']>
type MotivoApagado = NonNullable<EstadoModoViaje['apagadoPor']>['motivo']
```

Reemplazá (cerca de la línea 400):

```ts
  return 'otro'
}

export function crearMotorViaje(fuentes: FuentesMotor): MotorViaje {
  const { reloj, navegador } = fuentes
  const plataforma = plataformaDe(navegador.userAgent ?? '', fuentes.documento)
```

por:

```ts
  return 'otro'
}

function vector(v: EventoMovimiento['acceleration']): [number, number, number] | null {
  if (!v) return null
  const { x, y, z } = v
  return esNumero(x) && esNumero(y) && esNumero(z) ? [x, y, z] : null
}

function muestraDe(e: EventoMovimiento, mono: number): MuestraMovimiento | null {
  const a = vector(e.acceleration)
  const aIG = vector(e.accelerationIncludingGravity)
  if (a === null && aIG === null) return null
  const r = e.rotationRate
  const giro: [number, number, number] | null = r && esNumero(r.alpha) && esNumero(r.beta) && esNumero(r.gamma) ? [r.alpha, r.beta, r.gamma] : null
  // Hay navegadores viejos cuyo timeStamp no está en la base de performance.now(): ahí vale la hora de llegada.
  const t = esNumero(e.timeStamp) && Math.abs(e.timeStamp - mono) <= MS_DESVIO_TIMESTAMP ? e.timeStamp : mono
  return { t, a, aIG, giro }
}

export function crearMotorViaje(fuentes: FuentesMotor): MotorViaje {
  const { reloj, navegador } = fuentes
  const plataforma = plataformaDe(navegador.userAgent ?? '', fuentes.documento)
```

- [ ] **Step 4: `lib/viaje.ts` (2 de 3): secciones «Destrabador global», «GPS», «Episodios y alertas» y «Ciclo de vida» (33 funciones)**

Reemplazá (cerca de la línea 594):

```ts
  /* ---------- Pantalla ---------- */
  let centinela: CentinelaMotor | null = null
  function pantallaActual(): EstadoModoViaje['pantalla'] {
    if (!navegador.wakeLock) return 'no_soportada'
    return centinela && !centinela.released ? 'retenida' : 'sin_retener'
  }

  /* ---------- Audio y vibración ---------- */
  let audio: AudioMotor | null = null
  let audioDestrabado = false
  function sonidoListo(): boolean {
    if (!audio || !audioDestrabado) return false
    const e = audio.estado()
    return e !== 'closed' && e !== 'interrupted'
  }
  function vibracionActual(): EstadoModoViaje['avisos']['vibracion'] {
    if (typeof navegador.vibrate !== 'function') return 'no_soportada'
    return huboGesto ? 'listo' : 'requiere_toque'
  }

  /* ---------- Movimiento y detección ---------- */
  let activaMs = 0
  let totalMs = 0
  let huecos: Array<{ inicio: number; ms: number }> = []

  function destruir(): void {
    if (destruido) return
    intento++
    for (const id of temporizadores) reloj.cancelar(id)
    temporizadores.clear()
    suscriptores.clear()
    destruido = true
  }

  /* ---------- Arranque ---------- */
  diagnosticoActivo = leerDiagnostico()
  actual = congelar(armarEstado())
  actualJson = JSON.stringify(actual)

  return {
    suscribir(fn) {
```

por:

```ts
  /* ---------- Pantalla ---------- */
  let centinela: CentinelaMotor | null = null
  let pantallaEnCurso: Promise<boolean> | null = null

  function quiereRetenerPantalla(): boolean {
    return !destruido && (fase === 'pidiendo' || fase === 'reanudando' || fase === 'activo')
  }
  function pantallaActual(): EstadoModoViaje['pantalla'] {
    if (!navegador.wakeLock) return 'no_soportada'
    return centinela && !centinela.released ? 'retenida' : 'sin_retener'
  }

  /** Un solo sentinel: si ya hay uno o hay un pedido en curso, no se pide otro. */
  function asegurarPantalla(): Promise<boolean> {
    if (centinela && !centinela.released) return Promise.resolve(true)
    if (pantallaEnCurso) return pantallaEnCurso
    const wakeLock = navegador.wakeLock
    if (!wakeLock) return Promise.resolve(false)
    let pedido: Promise<CentinelaMotor>
    try {
      pedido = wakeLock.request('screen')
    } catch (err) {
      pedido = Promise.reject(err)
    }
    const enCurso = pedido.then(
      (nuevo) => {
        pantallaEnCurso = null
        if (!quiereRetenerPantalla() || (centinela && !centinela.released)) {
          void nuevo.release().catch(() => undefined)
          return centinela !== null
        }
        centinela = nuevo
        nuevo.addEventListener('release', alSoltarPantalla)
        pantallaLiberada = false
        actualizarDestrabador()
        publicar()
        return true
      },
      () => {
        pantallaEnCurso = null
        actualizarDestrabador()
        publicar()
        return false
      },
    )
    pantallaEnCurso = enCurso
    return enCurso
  }

  function soltarPantalla(): void {
    const c = centinela
    centinela = null
    if (!c) return
    // Se quita la escucha antes de soltarlo: el 'release' propio no es el sistema apagando la pantalla.
    c.removeEventListener('release', alSoltarPantalla)
    if (!c.released) void c.release().catch(() => undefined)
  }

  function alSoltarPantalla(): void {
    const c = centinela
    if (c) c.removeEventListener('release', alSoltarPantalla)
    centinela = null
    publicar()
  }

  /* ---------- Audio y vibración ---------- */
  let audio: AudioMotor | null = null
  let audioDestrabado = false
  let quitarEscuchaAudio: (() => void) | null = null

  function asegurarAudio(): AudioMotor | null {
    if (audio === null && fuentes.crearAudio) {
      try {
        audio = fuentes.crearAudio()
        quitarEscuchaAudio = audio.alCambiar(alCambiarAudio)
      } catch {
        audio = null
      }
    }
    return audio
  }
  function destrabarAudio(): void {
    const a = asegurarAudio()
    if (!a) return
    try {
      a.destrabar()
      audioDestrabado = true
    } catch {
      /* se vuelve a intentar con el próximo toque */
    }
  }
  function sonidoListo(): boolean {
    if (!audio || !audioDestrabado) return false
    const e = audio.estado()
    return e !== 'closed' && e !== 'interrupted'
  }
  function alCambiarAudio(): void {
    if (destruido || !audio) return
    const e = audio.estado()
    // Una llamada entrante interrumpe el contexto en iPhone: al volver, hace falta otro toque.
    if (e === 'interrupted' || e === 'closed') audioDestrabado = false
    actualizarDestrabador()
    publicar()
  }
  function vibracionActual(): EstadoModoViaje['avisos']['vibracion'] {
    if (typeof navegador.vibrate !== 'function') return 'no_soportada'
    return huboGesto ? 'listo' : 'requiere_toque'
  }

  /* ---------- Destrabador global ---------- */
  function estaEncendido(): boolean {
    return fase === 'pidiendo' || fase === 'reanudando' || fase === 'activo' || fase === 'en_pausa' || fase === 'reanudar_con_toque' || fase === 'otra_ventana'
  }
  /** El destrabador global llega con la reanudación (§4.3): hasta entonces no hay nada que poner ni quitar. */
  function actualizarDestrabador(): void {}

  /* ---------- GPS ---------- */
  let vigilancia: number | null = null
  let temporizadorGps: number | null = null
  let ultimoFix: { lat: number; lon: number } | null = null
  const historialFixes: Array<{ lat: number; lon: number; precisionM: number; pared: number }> = []

  function vigilarGps(): void {
    const geo = navegador.geolocation
    if (!geo) {
      gps = 'no_aplica'
      return
    }
    if (vigilancia !== null) return
    try {
      vigilancia = geo.watchPosition(alFix, alErrorGps, { enableHighAccuracy: true, maximumAge: 0 })
    } catch {
      vigilancia = null
      gps = 'sin_permiso'
      return
    }
    if (gps !== 'ok' && gps !== 'impreciso') gps = 'buscando'
    reprogramarGps()
  }
  function soltarGps(): void {
    if (vigilancia !== null) {
      try {
        navegador.geolocation?.clearWatch(vigilancia)
      } catch {
        /* el navegador ya la soltó */
      }
      vigilancia = null
    }
    temporizadorGps = cancelar(temporizadorGps)
  }
  /** Sin fix por más de 5 s: buscando. Ninguna velocidad de más de 5 s se muestra como actual. */
  function reprogramarGps(): void {
    temporizadorGps = cancelar(temporizadorGps)
    temporizadorGps = programar(() => {
      temporizadorGps = null
      if (vigilancia === null) return
      gps = 'buscando'
      procesar(detector.gpsSinDatos(reloj.mono(), reloj.pared()))
      publicar()
    }, MS_GPS_BUSCANDO)
  }
  function alFix(pos: PosicionMotor): void {
    if (destruido || vigilancia === null) return
    const c = pos.coords
    if (!esNumero(c.latitude) || !esNumero(c.longitude) || !esNumero(c.accuracy)) return
    const fix: FixGps = {
      lat: c.latitude,
      lon: c.longitude,
      precisionM: c.accuracy,
      velocidadMs: esNumero(c.speed) ? c.speed : null,
      adquiridoPared: esNumero(pos.timestamp) ? pos.timestamp : reloj.pared(),
      llegadaMono: reloj.mono(),
      llegadaPared: reloj.pared(),
    }
    ultimoFix = { lat: fix.lat, lon: fix.lon }
    historialFixes.push({ lat: fix.lat, lon: fix.lon, precisionM: fix.precisionM, pared: fix.llegadaPared })
    while (historialFixes.length > 0 && historialFixes[0].pared < fix.llegadaPared - MS_HISTORIAL_FIXES) historialFixes.shift()
    const antes = gps
    gps = fix.precisionM <= PRECISION_CONFIABLE_M ? 'ok' : 'impreciso'
    reprogramarGps()
    const eventos = detector.fix(fix)
    if (gps === 'impreciso' && antes !== 'impreciso') eventos.push(...detector.gpsSinDatos(fix.llegadaMono, fix.llegadaPared))
    procesar(eventos)
    if (gps !== antes) publicar()
  }
  function alErrorGps(err: { readonly code: number }): void {
    if (destruido) return
    // Los códigos 2 y 3 son pasajeros: el GPS sigue vigilando y el temporizador dice buscando.
    if (err.code !== 1) return
    soltarGps()
    gps = 'sin_permiso'
    publicar()
  }

  /* ---------- Movimiento y detección ---------- */
  let activaMs = 0
  let totalMs = 0
  let huecos: Array<{ inicio: number; ms: number }> = []
  let escuchandoMovimiento = false
  let esperandoLecturas = false
  let temporizadorLecturas: number | null = null
  let temporizadorTic: number | null = null
  let marcaDeteccion: { mono: number; pared: number } | null = null
  let inicioDeteccion: number | null = null

  function alMovimiento(evento: Event): void {
    if (destruido) return
    const muestra = muestraDe(evento as unknown as EventoMovimiento, reloj.mono())
    if (muestra === null) return
    if (esperandoLecturas) lecturasRecibidas()
    procesar(detector.muestra(muestra, reloj.pared()))
  }
  function escuchar(): void {
    if (!escuchandoMovimiento) {
      fuentes.ventana.addEventListener('devicemotion', alMovimiento)
      escuchandoMovimiento = true
    }
    if (temporizadorTic === null) programarTic()
  }
  function dejarDeEscuchar(): void {
    if (escuchandoMovimiento) {
      fuentes.ventana.removeEventListener('devicemotion', alMovimiento)
      escuchandoMovimiento = false
    }
    temporizadorTic = cancelar(temporizadorTic)
    temporizadorLecturas = cancelar(temporizadorLecturas)
    esperandoLecturas = false
  }
  function programarTic(): void {
    temporizadorTic = programar(() => {
      temporizadorTic = null
      tic()
      if (escuchandoMovimiento) programarTic()
    }, MS_TIC)
  }
  function anotarHueco(inicio: number, ms: number): void {
    if (ms < MS_TIC) return
    huecos.push({ inicio, ms: Math.round(ms) })
    if (huecos.length > MAX_HUECOS) huecos = huecos.slice(-MAX_HUECOS)
  }
  /** Detección activa por pared; un salto de la pared sin mono es el equipo suspendido y cuenta como hueco. */
  function contarDeteccion(mono: number, pared: number): void {
    if (marcaDeteccion) {
      const dMono = mono - marcaDeteccion.mono
      const dPared = pared - marcaDeteccion.pared
      activaMs += Math.max(0, Math.min(dMono, dPared))
      if (dPared - dMono > MS_TIC) anotarHueco(marcaDeteccion.pared, dPared - dMono)
    }
    marcaDeteccion = { mono, pared }
    totalMs = inicioDeteccion === null ? 0 : pared - inicioDeteccion
  }
  function tic(): void {
    const mono = reloj.mono()
    const pared = reloj.pared()
    if (fase === 'activo' && fuentes.documento.visibilityState === 'visible') contarDeteccion(mono, pared)
    procesar(detector.avanzar(mono, pared))
    const r = detector.resumen(mono)
    fuente = r.fuente
    gVivo = r.gVivo === null ? null : redondear(r.gVivo, 2)
    hzVivo = r.hzMedido === null ? null : Math.round(r.hzMedido)
    velocidadKmh = r.velocidadKmh === null ? null : Math.round(r.velocidadKmh)
    precisionM = r.precisionM === null ? null : Math.round(r.precisionM)
    if (r.enMovimiento === true) ultimoMovimiento = pared
    diagnosticoActivo = leerDiagnostico()
    publicar()
  }

  /* ---------- Episodios y alertas ---------- */
  /** Todavía sin alertas: los eventos del detector se descartan. */
  function procesar(_eventos: EventoDetector[]): void {}

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null

  function nuevoAsentamiento(): Promise<void> {
    asentar()
    asentamiento = new Promise<void>((resolver) => {
      resolverAsentamiento = resolver
    })
    return asentamiento
  }
  function asentar(): void {
    const resolver = resolverAsentamiento
    resolverAsentamiento = null
    asentamiento = null
    resolver?.()
  }

  function soltarTodo(): void {
    if (marcaDeteccion && fase === 'activo') contarDeteccion(reloj.mono(), reloj.pared())
    marcaDeteccion = null
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
  }

  function encender(): Promise<void> {
    if (destruido || fase === 'no_soportado') return Promise.resolve()
    if (fase === 'pidiendo' || fase === 'reanudando') return asentamiento ?? Promise.resolve()
    if (fase === 'activo' || fase === 'en_pausa' || fase === 'otra_ventana') return Promise.resolve()
    return arrancarConGesto()
  }

  /**
   * Lo sincrónico va antes de cualquier await y en este orden (§4.1): el wake lock y el audio necesitan la
   * activación transitoria, que en WebKit dura 5 s, y el diálogo del permiso de movimiento la consume.
   */
  function arrancarConGesto(): Promise<void> {
    const mio = ++intento
    huboGesto = true
    fase = 'pidiendo'
    apagadoPor = null
    const pantalla = asegurarPantalla()
    destrabarAudio()
    let permiso: Promise<'granted' | 'denied'> | null
    try {
      permiso = fuentes.movimiento?.requestPermission?.() ?? null
    } catch (err) {
      permiso = Promise.reject(err)
    }
    const promesa = nuevoAsentamiento()
    actualizarDestrabador()
    publicar()
    void continuarArranque(mio, permiso, pantalla, true)
    return promesa
  }

  async function continuarArranque(mio: number, permiso: Promise<'granted' | 'denied'> | null, pantalla: Promise<boolean>, conGesto: boolean): Promise<void> {
    let resultado: 'granted' | 'denied' | 'rechazado' = 'granted'
    if (permiso) {
      try {
        resultado = (await permiso) === 'denied' ? 'denied' : 'granted'
      } catch {
        resultado = 'rechazado'
      }
    }
    if (mio !== intento || destruido) return
    const monoPermiso = reloj.mono()
    if (resultado === 'denied') {
      // WebKit resuelve 'denied' (no rechaza) cuando la negativa quedó en memoria: pedirlo otra vez no sirve.
      soltarPantalla()
      borrarIntencion()
      fase = 'sin_permiso'
      terminarArranque()
      return
    }
    if (resultado === 'rechazado') {
      soltarPantalla()
      fase = 'reanudar_con_toque'
      terminarArranque()
      return
    }
    await pantalla
    if (mio !== intento || destruido) return
    escuchar()
    esperandoLecturas = true
    temporizadorLecturas = cancelar(temporizadorLecturas)
    temporizadorLecturas = programar(() => sinLecturas(mio), monoPermiso + MS_ESPERA_LECTURAS - reloj.mono())
    vigilarGps()
    publicar()
  }

  function terminarArranque(): void {
    asentar()
    actualizarDestrabador()
    publicar()
  }

  function lecturasRecibidas(): void {
    esperandoLecturas = false
    temporizadorLecturas = cancelar(temporizadorLecturas)
    borrarClave(CLAVE_SIN_SENSORES)
    const mono = reloj.mono()
    const pared = reloj.pared()
    fase = 'activo'
    inicioDeteccion ??= pared
    marcaDeteccion = { mono, pared }
    if (intencion === null) ultimoMovimiento = pared
    escribirIntencion()
    terminarArranque()
  }

  function sinLecturas(mio: number): void {
    temporizadorLecturas = null
    if (mio !== intento || !esperandoLecturas) return
    soltarTodo()
    borrarIntencion()
    escribirJson(CLAVE_SIN_SENSORES, { en: reloj.pared() })
    fase = 'sin_lecturas'
    gps = 'no_aplica'
    terminarArranque()
  }

  function apagar(motivo: MotivoApagado): void {
    apagarCon(motivo, true)
  }

  /** borrar = false cuando otra ventana ya borró la intención: se apaga sin volver a escribirla. */
  function apagarCon(motivo: MotivoApagado, borrar: boolean): void {
    if (destruido || !estaEncendido()) return
    intento++
    soltarTodo()
    detector.descartarAbiertos()
    if (borrar) borrarIntencion()
    else intencion = null
    fase = 'apagado'
    apagadoPor = { motivo, hora: reloj.pared() }
    inactividad = null
    gps = 'no_aplica'
    velocidadKmh = null
    precisionM = null
    inicioDeteccion = null
    activaMs = 0
    totalMs = 0
    huecos = []
    terminarArranque()
  }

  function destruir(): void {
    if (destruido) return
    intento++
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
    quitarEscuchaAudio?.()
    quitarEscuchaAudio = null
    try {
      audio?.cerrar()
    } catch {
      /* ya estaba cerrado */
    }
    audio = null
    for (const id of temporizadores) reloj.cancelar(id)
    temporizadores.clear()
    asentar()
    suscriptores.clear()
    destruido = true
  }

  /* ---------- Arranque ---------- */
  if (!fuentes.seguro) {
    fase = 'no_soportado'
    motivoNoSoportado = 'inseguro'
  } else if (fuentes.movimiento === null) {
    fase = 'no_soportado'
    motivoNoSoportado = 'sin_sensores'
  }
  diagnosticoActivo = leerDiagnostico()
  if (fase !== 'no_soportado') {
    const sinSensores = leerJson(CLAVE_SIN_SENSORES)
    if (esObjeto(sinSensores) && esNumero(sinSensores.en) && reloj.pared() - sinSensores.en < MS_SIN_SENSORES_VIGENTE) fase = 'sin_lecturas'
  }
  actual = congelar(armarEstado())
  actualJson = JSON.stringify(actual)
  actualizarDestrabador()

  return {
    suscribir(fn) {
```

- [ ] **Step 5: `lib/viaje.ts` (3 de 3): el objeto que devuelve `crearMotorViaje`**

Reemplazá (cerca de la línea 1056):

```ts
      }
    },
    estado: () => actual ?? ESTADO_SERVIDOR,
    encender: () => Promise.resolve(),
    reanudar: () => Promise.resolve(),
    apagar: () => undefined,
    tocar: () => undefined,
    activarGps: () => undefined,
    cambiarRuta,
```

por:

```ts
      }
    },
    estado: () => actual ?? ESTADO_SERVIDOR,
    encender,
    reanudar: () => Promise.resolve(),
    apagar,
    tocar: () => undefined,
    activarGps: () => undefined,
    cambiarRuta,
```

- [ ] **Step 6: Correr la prueba y verla pasar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   encender pide el wake lock, destraba el audio y pide el permiso antes de cualquier await
  ok   mientras el diálogo está abierto la fase es pidiendo
  ok   encender otra vez devuelve lo mismo y no pide nada más
  ok   el GPS no se pide mientras está el diálogo del movimiento
  ok   el pedido sincrónico obtuvo el wake lock aunque el diálogo tardó 8 s
  ok   recién con el permiso se vigila el GPS, de a uno
  ok   sin lecturas todavía no hay intención guardada
  ok   un devicemotion sin números no cuenta como lectura
  ok   con la primera lectura válida pasa a activo
  ok   y recién ahí guarda la intención
  ok   con el gesto del encendido, sonido y vibración quedan listos
  ok   pasados los 3 s con lecturas no se declara sin_lecturas
  ok   apagar suelta devicemotion, GPS y wake lock y borra la intención
  ok   apagar deja el motivo y la hora
  ok   apagar otra vez no cambia nada
  ok   encendido: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   sin lecturas: a los 2,999 s todavía espera
  ok   sin lecturas en 3 s desde el permiso: sin_lecturas
  ok   sin_lecturas no deja intención y suelta todo
  ok   y lo recuerda 24 h para decirlo sin volver a pedir permiso
  ok   sin lecturas: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   al recargar dentro de las 24 h arranca en sin_lecturas
  ok   sin lecturas recargado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   'denied' al encender: sin_permiso y suelta el wake lock
  ok   permiso negado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   NotAllowedError al encender sin activación: reanudar_con_toque
  ok   NotAllowedError al encender: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   sin https: no_soportado por inseguro y encender no pide nada
  ok   inseguro: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   sin DeviceMotionEvent: no_soportado por sin_sensores
  ok   sin sensores: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   iPhone: plataforma ios; sin vibrate la vibración es no_soportada y con audioSession se informa
  ok   iPhone: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
69/69 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 8: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Encender el modo viaje dentro del gesto para que el iPhone no niegue la pantalla

En WebKit el wake lock sólo se concede con la activación transitoria de un toque, que dura
5 s y que el diálogo del permiso de movimiento consume. encender pide la pantalla, destraba
el audio y pide el permiso de forma sincrónica, antes de cualquier await; el GPS se pide
recién con el permiso resuelto, para no apilar dos diálogos. La intención se guarda con la
primera lectura: un equipo que no entrega lecturas en 3 s queda en sin_lecturas y no se
reanuda solo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Reanudación (§4.3): destrabador, visibilidad, candados, evento `storage` e iOS < 18.4

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V6]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V6]`

**Interfaces:**
- Consumes:
  - De la Tarea 4: `asegurarPantalla`, `soltarPantalla`, `destrabarAudio`, `sonidoListo`, `estaEncendido`, `vigilarGps`, `contarDeteccion`, `anotarHueco`, `nuevoAsentamiento`, `continuarArranque`, `terminarArranque`, `soltarTodo`, `apagarCon`. Del detector: `hueco(mono, pared): EventoDetector[]`.
  - De las fuentes: `navegador.locks.request(nombre, { ifAvailable: true }, cb)`, `navegador.permissions.query({ name: 'geolocation' })`, `documento.visibilityState` y los eventos `visibilitychange`, `pageshow` y `storage`.
- Produces:
  - `reanudar(): Promise<void>`: sólo desde `reanudar_con_toque`, con el mismo orden sincrónico que `encender` (incluye `requestPermission` y después `watchPosition`); idempotente mientras pide. `tocar(): void`: lo mismo que el destrabador global.
  - Al crearse con `acta:viaje` de menos de 30 min (`ultimoLatido`): fase `reanudando` antes de cualquier `await`, `requestPermission` sin gesto (`NotAllowedError` → `reanudar_con_toque` conservando la intención; `'denied'` → `sin_permiso` borrándola), wake lock intentado, GPS sólo si `permissions.query` da `granted` (si no, `gps: 'requiere_toque'`), audio y vibración en `requiere_toque`. Con la intención vieja la borra y queda `apagado`.
  - Destrabador global en `pointerup`, `touchend`, `click` y `keydown` con `{ capture: true, passive: true }`: pide el wake lock si falta y destraba el audio; nunca `requestPermission` ni `watchPosition`; se quita cuando pantalla, audio y vibración están listos y vuelve con el `release` del sentinel o si el audio se interrumpe.
  - iOS instalada anterior a 18.4 (§4.3): `pantalla: 'no_garantizada'` cuando `plataforma` es `ios`, `fuentes.standalone` es `true` y la UA dice `OS 17_5` o cualquier versión menor que 18.4 (`/OS (\d+)_(\d+)/`), porque ahí WebKit no respeta el wake lock. En Safari sin instalar o desde 18.4, la pantalla se trata como en cualquier otro navegador.
  - Latido de 30 s que reescribe `acta:viaje` sólo con el documento visible y fase `activo` o `en_pausa`. Candado `acta-modo-viaje`: sin candado, fase `otra_ventana` (sin sensores ni pantalla) y reintento al volver visible y en cada latido. `storage` con `key === 'acta:viaje'` y `newValue === null`: se apaga sin reescribir. `visibilitychange` a visible y `pageshow` con `persisted`: hueco, wake lock otra vez y audio revisado. `release` del sentinel con la página visible que no se recupera: `pantallaLiberada: true`.
  - Internas: `alSoltarPantalla` (reemplazada), `actualizarDestrabador` (reemplazada), `necesitaDestrabe`, `quitarDestrabador`, `alGesto`, `tomarCandado(): Promise<boolean>`, `soltarCandado`, `consultarPermisoGps()`, `programarLatido`, `latido`, `reanudarSinGesto`, `reintentarCandado`, `alCambiarVisibilidad`, `alVolverVisible(ocultaDesde)`, `alMostrarPagina(evento)`, `alCambiarAlmacenamiento(evento)` e `iosViejoInstalado(userAgent, plataforma, standalone)`.

**Decisiones de esta tarea:**

- Si `navigator.locks.request` falla, el motor sigue sin esa protección: es mejor detectar en dos ventanas que no detectar en ninguna.
- Una ventana en `otra_ventana` que en su latido ya no encuentra la intención se apaga con `apagarCon('usuario', false)`: la apagó la otra.
- El destrabador también queda puesto mientras la vibración espera un toque (`navigator.vibrate` existe y todavía no hubo gesto en este documento).
- Sin gesto, `permissions.query({ name: 'geolocation' })` se consulta antes de escuchar `devicemotion`: si la primera lectura llegara durante la consulta con la ruta ya en pausa (la aplicación abierta directo en `/s/…`), el GPS arrancaría después de entrar en pausa y quedaría prendido durante el recorrido.
- La prueba de la pantalla que el sistema no devuelve pone `falsas.wakeLock.autorizadoAntes = false` y deja pasar 6 s: es lo que hace el ahorro de batería, que suelta el wake lock y no lo vuelve a dar sin un toque.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V6]` los bloques de reanudación. `intencionGuardada(mapa, pared, hace)` escribe `acta:viaje` como la deja un documento anterior, y pasar ese `Map` a `crearFuentesFalsas` simula la recarga.

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V6]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Reanudación (§4.3): sin gesto, destrabador global, visibilidad, latido, candados y storage */
  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const viejo = new Map()
    intencionGuardada(viejo, INICIO_PARED, 31 * 60_000)
    const falsasViejo = crearFuentesFalsas({ almacenamiento: viejo, movimiento: 'granted' })
    const motorViejo = crearMotorViaje(falsasViejo.fuentes)
    verificar('un latido de más de 30 minutos descarta la intención', motorViejo.estado().fase === 'apagado' && !viejo.has('acta:viaje') && falsasViejo.movimiento.pedidos === 0)
    terminar('latido viejo', motorViejo, falsasViejo)

    const negado = new Map()
    intencionGuardada(negado, INICIO_PARED, 60_000)
    const falsasNegado = crearFuentesFalsas({ almacenamiento: negado, movimiento: 'denied' })
    const motorNegado = crearMotorViaje(falsasNegado.fuentes)
    await falsasNegado.reloj.avanzar(0)
    verificar("reanudar con 'denied': sin_permiso y borra la intención", motorNegado.estado().fase === 'sin_permiso' && !negado.has('acta:viaje'))
    terminar('reanudar negado', motorNegado, falsasNegado)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const mapa = new Map()
    intencionGuardada(mapa, INICIO_PARED, 60_000)
    const falsas = crearFuentesFalsas({ almacenamiento: mapa, movimiento: 'granted' })
    const motor = crearMotorViaje(falsas.fuentes)
    verificar('con una intención vigente arranca en reanudando, antes de cualquier await', motor.estado().fase === 'reanudando' && falsas.movimiento.pedidos === 1 && falsas.wakeLock.pedidos === 1)
    motor.cambiarRuta('/perfil')
    await falsas.reloj.avanzar(0)
    falsas.movimiento.emitir(quieta(falsas.reloj.mono()))
    await falsas.reloj.avanzar(0)
    const e = motor.estado()
    verificar('recarga con permiso: activo sin gesto', e.fase === 'activo')
    verificar('recarga con el wake lock rechazado: pantalla sin_retener', e.pantalla === 'sin_retener' && falsas.wakeLock.activos === 0)
    verificar('audio y vibración esperan un toque', e.avisos.sonido === 'requiere_toque' && e.avisos.vibracion === 'requiere_toque' && falsas.audio.destrabes === 0)
    verificar('con la geolocalización ya concedida vigila el GPS sin gesto', falsas.geo.pedidos === 1)
    verificar('conserva cuándo se encendió y reescribe el latido', JSON.parse(mapa.get('acta:viaje')).encendidoEn === INICIO_PARED - 120_000 && JSON.parse(mapa.get('acta:viaje')).ultimoLatido === falsas.reloj.pared())
    verificar('el destrabador escucha pointerup, touchend, click y keydown, nunca pointerdown', falsas.ventana.escuchas('pointerup') === 1 && falsas.ventana.escuchas('touchend') === 1 && falsas.ventana.escuchas('click') === 1 && falsas.ventana.escuchas('keydown') === 1 && falsas.ventana.escuchas('pointerdown') === 0)
    const permisos = falsas.movimiento.pedidos
    const gpsPedidos = falsas.geo.pedidos
    falsas.ventana.despachar('pointerdown')
    await falsas.reloj.avanzar(0)
    verificar('pointerdown no llama a nada', falsas.wakeLock.pedidos === 1 && falsas.audio.destrabes === 0)
    falsas.ventana.despachar('pointerup')
    await falsas.reloj.avanzar(0)
    verificar('pointerup pide el wake lock y destraba el audio', falsas.wakeLock.pedidos === 2 && falsas.wakeLock.activos === 1 && falsas.audio.destrabes === 1)
    verificar('el destrabador nunca pide el permiso de movimiento ni el GPS', falsas.movimiento.pedidos === permisos && falsas.geo.pedidos === gpsPedidos)
    const listo = motor.estado()
    verificar('con pantalla y audio listos el destrabador se quita', listo.pantalla === 'retenida' && listo.avisos.sonido === 'listo' && falsas.ventana.escuchas('pointerup') === 0 && falsas.ventana.escuchas('click') === 0)

    await falsas.reloj.avanzar(30_000)
    verificar('el latido reescribe la intención cada 30 s desde el documento visible', JSON.parse(mapa.get('acta:viaje')).ultimoLatido === falsas.reloj.pared())
    falsas.documento.ponerVisible(false)
    falsas.wakeLock.liberarPorSistema()
    const latidoOculto = JSON.parse(mapa.get('acta:viaje')).ultimoLatido
    await falsas.reloj.avanzar(60_000)
    verificar('oculto no escribe el latido ni marca la pantalla como liberada', JSON.parse(mapa.get('acta:viaje')).ultimoLatido === latidoOculto && !motor.estado().pantallaLiberada)
    falsas.documento.ponerVisible(true)
    await falsas.reloj.avanzar(0)
    const visible = motor.estado()
    verificar('al volver visible, el wake lock vuelve sin gesto (ya autorizado en este documento)', falsas.wakeLock.activos === 1 && visible.pantalla === 'retenida')
    verificar('el tiempo oculto queda como hueco de detección', visible.deteccion.huecos.some((h) => h.ms >= 60_000))
    falsas.wakeLock.liberarPorSistema()
    await falsas.reloj.avanzar(0)
    verificar('si el sistema suelta el wake lock con la página visible, se recupera', falsas.wakeLock.activos === 1 && !motor.estado().pantallaLiberada)
    terminar('reanudación con permiso', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    falsas.documento.ponerVisible(false)
    falsas.reloj.saltarPared(90_000)
    falsas.ventana.despachar('pageshow', { persisted: true })
    await falsas.reloj.avanzar(0)
    verificar('pageshow con persisted (la página vuelve de la caché del navegador) declara el hueco', motor.estado().deteccion.huecos.filter((h) => h.ms >= 90_000).length === 1)
    falsas.documento.ponerVisible(true)
    await falsas.reloj.avanzar(0)
    verificar('y el visibilitychange que llega después no lo cuenta dos veces', motor.estado().deteccion.huecos.filter((h) => h.ms >= 90_000).length === 1)
    terminar('pageshow persisted', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    verificar('encendido con gesto: pantalla retenida y destrabador quitado', motor.estado().pantalla === 'retenida' && falsas.ventana.escuchas('pointerup') === 0)
    // El ahorro de batería suelta el wake lock y el navegador ya no lo vuelve a dar sin un toque.
    falsas.wakeLock.autorizadoAntes = false
    await falsas.reloj.avanzar(6000)
    falsas.wakeLock.liberarPorSistema()
    await falsas.reloj.avanzar(0)
    const liberada = motor.estado()
    verificar('si el sistema suelta el wake lock con la página visible y no se recupera: sin_retener y pantallaLiberada', liberada.pantalla === 'sin_retener' && liberada.pantallaLiberada === true && falsas.wakeLock.activos === 0)
    verificar('y el destrabador vuelve a escuchar para recuperarla con el próximo toque', falsas.ventana.escuchas('pointerup') === 1)
    falsas.gesto('pointerup')
    await falsas.reloj.avanzar(0)
    verificar('con el toque se recupera y deja de decir que la pantalla se libera sola', motor.estado().pantalla === 'retenida' && !motor.estado().pantallaLiberada && falsas.ventana.escuchas('pointerup') === 0)
    terminar('pantalla liberada', motor, falsas)
  }

  /* iOS instalada anterior a 18.4 (§4.3): la pantalla no se puede garantizar */
  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const viejo = crearFuentesFalsas({ userAgent: IPHONE_17, standalone: true })
    const motorViejo = crearMotorViaje(viejo.fuentes)
    const e = motorViejo.estado()
    verificar('iPhone instalada con iOS 17.5: pantalla no_garantizada', e.plataforma === 'ios' && e.standalone && e.pantalla === 'no_garantizada')
    terminar('iPhone viejo instalado', motorViejo, viejo)
    const safari = crearFuentesFalsas({ userAgent: IPHONE_17 })
    const motorSafari = crearMotorViaje(safari.fuentes)
    verificar('el mismo iPhone en Safari, sin instalar: la pantalla se puede retener', motorSafari.estado().pantalla === 'sin_retener')
    terminar('iPhone viejo en Safari', motorSafari, safari)
    const nuevo = crearFuentesFalsas({ userAgent: IPHONE_18_4, standalone: true })
    const motorNuevo = crearMotorViaje(nuevo.fuentes)
    verificar('iPhone instalada con iOS 18.4: la pantalla se puede retener', motorNuevo.estado().pantalla === 'sin_retener')
    terminar('iPhone nuevo instalado', motorNuevo, nuevo)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const mapa = new Map()
    intencionGuardada(mapa, INICIO_PARED, 60_000)
    const recarga = crearFuentesFalsas({ almacenamiento: mapa })
    const motorRecarga = crearMotorViaje(recarga.fuentes)
    await recarga.reloj.avanzar(0)
    recarga.movimiento.emitir(quieta(recarga.reloj.mono()))
    await recarga.reloj.avanzar(0)
    verificar('recarga: el wake lock sin gesto se rechaza', motorRecarga.estado().pantalla === 'sin_retener' && recarga.wakeLock.activos === 0)
    recarga.gesto('click')
    await recarga.reloj.avanzar(0)
    verificar('recarga: con un click se concede', motorRecarga.estado().pantalla === 'retenida' && recarga.wakeLock.activos === 1)
    terminar('recarga y click', motorRecarga, recarga)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const mapa = new Map()
    intencionGuardada(mapa, INICIO_PARED, 60_000)
    const falsas = crearFuentesFalsas({ almacenamiento: mapa, movimiento: 'NotAllowedError', userAgent: IPHONE_18_4 })
    const motor = crearMotorViaje(falsas.fuentes)
    motor.cambiarRuta('/')
    await falsas.reloj.avanzar(0)
    verificar('reanudar sin gesto con NotAllowedError: reanudar_con_toque', motor.estado().fase === 'reanudar_con_toque' && falsas.geo.pedidos === 0)
    verificar('reanudar_con_toque conserva la intención', mapa.has('acta:viaje'))
    falsas.gesto()
    const primero = motor.reanudar()
    const segundo = motor.reanudar()
    verificar('reanudar pide wake lock y permiso sincrónicos, una sola vez', falsas.movimiento.pedidos === 2 && falsas.wakeLock.pedidos === 2 && segundo === primero)
    await falsas.reloj.avanzar(0)
    falsas.movimiento.emitir(quieta(falsas.reloj.mono()))
    await primero
    await falsas.reloj.avanzar(0)
    verificar('reanudar dos veces: activo con un watchPosition y un sentinel', motor.estado().fase === 'activo' && falsas.geo.pedidos === 1 && falsas.geo.vigilancias === 1 && falsas.wakeLock.activos === 1)
    falsas.documento.ponerVisible(true)
    motor.cambiarRuta('/perfil')
    void motor.reanudar()
    void motor.encender()
    await falsas.reloj.avanzar(0)
    verificar('montaje + visible + cambio de ruta + reanudar y encender otra vez: un watchPosition y un sentinel', falsas.geo.pedidos === 1 && falsas.geo.vigilancias === 1 && falsas.wakeLock.activos === 1 && falsas.wakeLock.pedidos === 2)
    motor.apagar('usuario')
    await falsas.reloj.avanzar(0)
    verificar('tras apagar(): cero vigilancias, cero centinelas, cero devicemotion', falsas.geo.vigilancias === 0 && falsas.wakeLock.activos === 0 && falsas.ventana.escuchas('devicemotion') === 0)
    terminar('reanudar con toque', motor, falsas)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const registro = crearRegistroCandados()
    const mapa = new Map()
    const a = crearFuentesFalsas({ candados: registro, almacenamiento: mapa })
    const motorA = crearMotorViaje(a.fuentes)
    a.gesto()
    const listoA = motorA.encender()
    await a.reloj.avanzar(0)
    a.movimiento.emitir(quieta(a.reloj.mono()))
    await listoA
    verificar('la primera ventana toma el candado acta-modo-viaje', motorA.estado().fase === 'activo' && registro.ocupados.has('acta-modo-viaje'))
    const b = crearFuentesFalsas({ candados: registro, almacenamiento: mapa })
    const motorB = crearMotorViaje(b.fuentes)
    await b.reloj.avanzar(0)
    verificar('segunda instancia sin candado: otra_ventana', motorB.estado().fase === 'otra_ventana')
    verificar('la otra ventana no escucha sensores ni retiene la pantalla', b.ventana.escuchas('devicemotion') === 0 && b.geo.vigilancias === 0 && b.wakeLock.activos === 0)
    b.almacenamiento.cambiarDesdeOtraVentana('acta:viaje', null)
    verificar('el evento storage que borra la intención apaga sin reescribirla', motorB.estado().fase === 'apagado' && !mapa.has('acta:viaje'))
    a.almacenamiento.cambiarDesdeOtraVentana('acta:viaje', null)
    await a.reloj.avanzar(0)
    verificar('la ventana que detectaba también se apaga y suelta el candado', motorA.estado().fase === 'apagado' && !registro.ocupados.has('acta-modo-viaje') && !mapa.has('acta:viaje'))
    terminar('otra ventana A', motorA, a)
    terminar('otra ventana B', motorB, b)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Sin reanudación el motor arranca `apagado` aunque haya intención, no pone el destrabador ni toma el candado, no trata `pageshow`, no reintenta la pantalla que suelta el sistema y no conoce iOS instalada anterior a 18.4. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA un latido de más de 30 minutos descarta la intención 
  FALLA reanudar con 'denied': sin_permiso y borra la intención 
  FALLA con una intención vigente arranca en reanudando, antes de cualquier await 
  FALLA recarga con permiso: activo sin gesto 
  FALLA con la geolocalización ya concedida vigila el GPS sin gesto 
  FALLA conserva cuándo se encendió y reescribe el latido 
  FALLA el destrabador escucha pointerup, touchend, click y keydown, nunca pointerdown 
  FALLA pointerdown no llama a nada 
  FALLA pointerup pide el wake lock y destraba el audio 
  FALLA con pantalla y audio listos el destrabador se quita 
  FALLA el latido reescribe la intención cada 30 s desde el documento visible 
  FALLA al volver visible, el wake lock vuelve sin gesto (ya autorizado en este documento) 
  FALLA el tiempo oculto queda como hueco de detección 
  FALLA si el sistema suelta el wake lock con la página visible, se recupera 
  FALLA pageshow con persisted (la página vuelve de la caché del navegador) declara el hueco 
  FALLA y el visibilitychange que llega después no lo cuenta dos veces 
  FALLA si el sistema suelta el wake lock con la página visible y no se recupera: sin_retener y pantallaLiberada 
  FALLA y el destrabador vuelve a escuchar para recuperarla con el próximo toque 
  FALLA con el toque se recupera y deja de decir que la pantalla se libera sola 
  FALLA iPhone instalada con iOS 17.5: pantalla no_garantizada 
  FALLA recarga: con un click se concede 
  FALLA reanudar sin gesto con NotAllowedError: reanudar_con_toque 
  FALLA reanudar pide wake lock y permiso sincrónicos, una sola vez 
  FALLA reanudar dos veces: activo con un watchPosition y un sentinel 
  FALLA montaje + visible + cambio de ruta + reanudar y encender otra vez: un watchPosition y un sentinel 
  FALLA la primera ventana toma el candado acta-modo-viaje 
  FALLA segunda instancia sin candado: otra_ventana 
  FALLA la ventana que detectaba también se apaga y suelta el candado 
```

y al final:

```text
93/121 verificaciones pasaron
28 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 6): `iosViejoInstalado`; al comienzo de `crearMotorViaje`; dentro de `pantallaActual`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 400):

```ts
  return 'otro'
}

function vector(v: EventoMovimiento['acceleration']): [number, number, number] | null {
  if (!v) return null
  const { x, y, z } = v
```

por:

```ts
  return 'otro'
}

/** iOS instalada anterior a 18.4: WebKit no respeta el wake lock en la aplicación instalada (§4.3). */
function iosViejoInstalado(userAgent: string, plataforma: EstadoModoViaje['plataforma'], standalone: boolean): boolean {
  if (plataforma !== 'ios' || !standalone) return false
  const m = /OS (\d+)_(\d+)/.exec(userAgent)
  if (!m) return false
  const mayor = Number(m[1])
  const menor = Number(m[2])
  return mayor < 18 || (mayor === 18 && menor < 4)
}

function vector(v: EventoMovimiento['acceleration']): [number, number, number] | null {
  if (!v) return null
  const { x, y, z } = v
```

Reemplazá (cerca de la línea 430):

```ts
export function crearMotorViaje(fuentes: FuentesMotor): MotorViaje {
  const { reloj, navegador } = fuentes
  const plataforma = plataformaDe(navegador.userAgent ?? '', fuentes.documento)

  /* ---------- Estado interno ---------- */
  let destruido = false
```

por:

```ts
export function crearMotorViaje(fuentes: FuentesMotor): MotorViaje {
  const { reloj, navegador } = fuentes
  const plataforma = plataformaDe(navegador.userAgent ?? '', fuentes.documento)
  const pantallaNoGarantizada = iosViejoInstalado(navegador.userAgent ?? '', plataforma, fuentes.standalone)

  /* ---------- Estado interno ---------- */
  let destruido = false
```

Reemplazá (cerca de la línea 610):

```ts
    return !destruido && (fase === 'pidiendo' || fase === 'reanudando' || fase === 'activo')
  }
  function pantallaActual(): EstadoModoViaje['pantalla'] {
    if (!navegador.wakeLock) return 'no_soportada'
    return centinela && !centinela.released ? 'retenida' : 'sin_retener'
  }
```

por:

```ts
    return !destruido && (fase === 'pidiendo' || fase === 'reanudando' || fase === 'activo')
  }
  function pantallaActual(): EstadoModoViaje['pantalla'] {
    if (pantallaNoGarantizada) return 'no_garantizada'
    if (!navegador.wakeLock) return 'no_soportada'
    return centinela && !centinela.released ? 'retenida' : 'sin_retener'
  }
```

- [ ] **Step 4: `lib/viaje.ts` (2 de 6): dentro de `alSoltarPantalla`; sección «Candado de ventana» (7 funciones); `consultarPermisoGps`**

Reemplazá (cerca de la línea 665):

```ts
    const c = centinela
    if (c) c.removeEventListener('release', alSoltarPantalla)
    centinela = null
    publicar()
  }
```

por:

```ts
    const c = centinela
    if (c) c.removeEventListener('release', alSoltarPantalla)
    centinela = null
    if (destruido) return
    if (quiereRetenerPantalla() && fuentes.documento.visibilityState === 'visible') {
      void asegurarPantalla().then((recuperada) => {
        if (!recuperada && quiereRetenerPantalla()) {
          pantallaLiberada = true
          publicar()
        }
      })
    }
    actualizarDestrabador()
    publicar()
  }
```

Reemplazá (cerca de la línea 726):

```ts
  function estaEncendido(): boolean {
    return fase === 'pidiendo' || fase === 'reanudando' || fase === 'activo' || fase === 'en_pausa' || fase === 'reanudar_con_toque' || fase === 'otra_ventana'
  }
  /** El destrabador global llega con la reanudación (§4.3): hasta entonces no hay nada que poner ni quitar. */
  function actualizarDestrabador(): void {}

  /* ---------- GPS ---------- */
  let vigilancia: number | null = null
```

por:

```ts
  function estaEncendido(): boolean {
    return fase === 'pidiendo' || fase === 'reanudando' || fase === 'activo' || fase === 'en_pausa' || fase === 'reanudar_con_toque' || fase === 'otra_ventana'
  }
  let destrabadorPuesto = false

  function necesitaDestrabe(): boolean {
    if (destruido) return false
    const conIntencion = fase === 'activo' || fase === 'en_pausa' || fase === 'reanudando' || fase === 'reanudar_con_toque'
    if (!conIntencion && alerta === null) return false
    const faltaPantalla = quiereRetenerPantalla() && navegador.wakeLock !== undefined && !(centinela && !centinela.released)
    const faltaAudio = fuentes.crearAudio !== null && !sonidoListo()
    const faltaVibracion = typeof navegador.vibrate === 'function' && !huboGesto
    return faltaPantalla || faltaAudio || faltaVibracion
  }
  function actualizarDestrabador(): void {
    const falta = necesitaDestrabe()
    if (falta && !destrabadorPuesto) {
      for (const tipo of TIPOS_GESTO) fuentes.ventana.addEventListener(tipo, alGesto, OPCIONES_DESTRABADOR)
      destrabadorPuesto = true
    } else if (!falta && destrabadorPuesto) {
      quitarDestrabador()
    }
  }
  function quitarDestrabador(): void {
    if (!destrabadorPuesto) return
    for (const tipo of TIPOS_GESTO) fuentes.ventana.removeEventListener(tipo, alGesto, OPCIONES_DESTRABADOR)
    destrabadorPuesto = false
  }
  /** Nunca pointerdown (con el dedo no da activación) y nunca requestPermission ni watchPosition desde acá. */
  function alGesto(): void {
    tocar()
  }
  function tocar(): void {
    if (destruido) return
    huboGesto = true
    if (quiereRetenerPantalla()) void asegurarPantalla()
    if (!sonidoListo()) destrabarAudio()
    actualizarDestrabador()
    publicar()
  }

  /* ---------- Candado de ventana ---------- */
  let candado: { soltar: () => void } | null = null
  let candadoEnCurso: Promise<boolean> | null = null

  /** Una sola ventana detecta: dos motores a la vez abrirían dos alertas por el mismo golpe. */
  function tomarCandado(): Promise<boolean> {
    if (candado) return Promise.resolve(true)
    if (candadoEnCurso) return candadoEnCurso
    const locks = navegador.locks
    if (!locks) return Promise.resolve(true)
    const pedido = new Promise<boolean>((resolver) => {
      let soltar: () => void = () => undefined
      const retenido = new Promise<void>((r) => {
        soltar = r
      })
      locks
        .request(CANDADO_VENTANA, { ifAvailable: true }, (obtenido) => {
          if (obtenido === null || destruido) {
            resolver(false)
            return Promise.resolve()
          }
          candado = { soltar }
          resolver(true)
          return retenido
        })
        // Si el navegador no deja pedir candados, se sigue sin esa protección antes que no detectar.
        .catch(() => resolver(true))
    })
    candadoEnCurso = pedido
    void pedido.then(() => {
      if (candadoEnCurso === pedido) candadoEnCurso = null
    })
    return pedido
  }
  function soltarCandado(): void {
    const c = candado
    candado = null
    c?.soltar()
  }

  /* ---------- GPS ---------- */
  let vigilancia: number | null = null
```

Reemplazá (cerca de la línea 881):

```ts
    gps = 'sin_permiso'
    publicar()
  }

  /* ---------- Movimiento y detección ---------- */
  let activaMs = 0
```

por:

```ts
    gps = 'sin_permiso'
    publicar()
  }
  async function consultarPermisoGps(): Promise<'granted' | 'denied' | 'prompt'> {
    try {
      const r = await navegador.permissions?.query({ name: 'geolocation' })
      return r?.state ?? 'prompt'
    } catch {
      return 'prompt'
    }
  }

  /* ---------- Movimiento y detección ---------- */
  let activaMs = 0
```

- [ ] **Step 5: `lib/viaje.ts` (3 de 6): `ocultoDesde`; `temporizadorLatido`; `programarLatido`, `latido`**

Reemplazá (cerca de la línea 900):

```ts
  let temporizadorTic: number | null = null
  let marcaDeteccion: { mono: number; pared: number } | null = null
  let inicioDeteccion: number | null = null

  function alMovimiento(evento: Event): void {
    if (destruido) return
```

por:

```ts
  let temporizadorTic: number | null = null
  let marcaDeteccion: { mono: number; pared: number } | null = null
  let inicioDeteccion: number | null = null
  let ocultoDesde: number | null = null

  function alMovimiento(evento: Event): void {
    if (destruido) return
```

Reemplazá (cerca de la línea 971):

```ts
  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null

  function nuevoAsentamiento(): Promise<void> {
    asentar()
```

por:

```ts
  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null
  let temporizadorLatido: number | null = null

  function nuevoAsentamiento(): Promise<void> {
    asentar()
```

Reemplazá (cerca de la línea 987):

```ts
    resolver?.()
  }

  function soltarTodo(): void {
    if (marcaDeteccion && fase === 'activo') contarDeteccion(reloj.mono(), reloj.pared())
    marcaDeteccion = null
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
  }

  function encender(): Promise<void> {
```

por:

```ts
    resolver?.()
  }

  function programarLatido(): void {
    temporizadorLatido = cancelar(temporizadorLatido)
    temporizadorLatido = programar(() => {
      temporizadorLatido = null
      latido()
      if (estaEncendido()) programarLatido()
    }, MS_LATIDO)
  }
  /** Sólo el documento visible y encendido escribe el latido: una pestaña olvidada no mantiene viva la intención. */
  function latido(): void {
    const pared = reloj.pared()
    const visible = fuentes.documento.visibilityState === 'visible'
    if (visible && fase === 'otra_ventana') reintentarCandado()
    if (visible && (fase === 'activo' || fase === 'en_pausa')) escribirIntencion()
  }

  function soltarTodo(): void {
    if (marcaDeteccion && fase === 'activo') contarDeteccion(reloj.mono(), reloj.pared())
    marcaDeteccion = null
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
    soltarCandado()
    temporizadorLatido = cancelar(temporizadorLatido)
  }

  function encender(): Promise<void> {
```

- [ ] **Step 6: `lib/viaje.ts` (4 de 6): `reanudar`; `reanudarSinGesto`; dentro de `continuarArranque`**

Reemplazá (cerca de la línea 1019):

```ts
    if (fase === 'activo' || fase === 'en_pausa' || fase === 'otra_ventana') return Promise.resolve()
    return arrancarConGesto()
  }

  /**
   * Lo sincrónico va antes de cualquier await y en este orden (§4.1): el wake lock y el audio necesitan la
```

por:

```ts
    if (fase === 'activo' || fase === 'en_pausa' || fase === 'otra_ventana') return Promise.resolve()
    return arrancarConGesto()
  }
  function reanudar(): Promise<void> {
    if (destruido) return Promise.resolve()
    if (fase === 'pidiendo' || fase === 'reanudando') return asentamiento ?? Promise.resolve()
    if (fase !== 'reanudar_con_toque') return Promise.resolve()
    return arrancarConGesto()
  }

  /**
   * Lo sincrónico va antes de cualquier await y en este orden (§4.1): el wake lock y el audio necesitan la
```

Reemplazá (cerca de la línea 1050):

```ts
    return promesa
  }

  async function continuarArranque(mio: number, permiso: Promise<'granted' | 'denied'> | null, pantalla: Promise<boolean>, conGesto: boolean): Promise<void> {
    let resultado: 'granted' | 'denied' | 'rechazado' = 'granted'
    if (permiso) {
```

por:

```ts
    return promesa
  }

  /** Al crearse con una intención vigente: sin gesto, GPS sólo con el permiso ya dado, audio y vibración a la espera de un toque. */
  function reanudarSinGesto(): void {
    const mio = ++intento
    fase = 'reanudando'
    const pantalla = asegurarPantalla()
    let permiso: Promise<'granted' | 'denied'> | null
    try {
      permiso = fuentes.movimiento?.requestPermission?.() ?? null
    } catch (err) {
      permiso = Promise.reject(err)
    }
    nuevoAsentamiento()
    actualizarDestrabador()
    publicar()
    void continuarArranque(mio, permiso, pantalla, false)
  }

  async function continuarArranque(mio: number, permiso: Promise<'granted' | 'denied'> | null, pantalla: Promise<boolean>, conGesto: boolean): Promise<void> {
    let resultado: 'granted' | 'denied' | 'rechazado' = 'granted'
    if (permiso) {
```

Reemplazá (cerca de la línea 1092):

```ts
      terminarArranque()
      return
    }
    await pantalla
    if (mio !== intento || destruido) return
    escuchar()
    esperandoLecturas = true
    temporizadorLecturas = cancelar(temporizadorLecturas)
    temporizadorLecturas = programar(() => sinLecturas(mio), monoPermiso + MS_ESPERA_LECTURAS - reloj.mono())
    vigilarGps()
    publicar()
  }
```

por:

```ts
      terminarArranque()
      return
    }
    const tomado = await tomarCandado()
    if (mio !== intento || destruido) {
      if (tomado && !estaEncendido()) soltarCandado()
      return
    }
    if (!tomado) {
      soltarPantalla()
      fase = 'otra_ventana'
      programarLatido()
      terminarArranque()
      return
    }
    await pantalla
    if (mio !== intento || destruido) return
    // Sin gesto, el permiso del GPS se consulta antes de escuchar: si la primera lectura llegara mientras
    // tanto en una ruta en pausa, el GPS arrancaría después de la pausa y quedaría prendido en el recorrido.
    const estadoGps = conGesto ? 'granted' : await consultarPermisoGps()
    if (mio !== intento || destruido) return
    escuchar()
    esperandoLecturas = true
    temporizadorLecturas = cancelar(temporizadorLecturas)
    temporizadorLecturas = programar(() => sinLecturas(mio), monoPermiso + MS_ESPERA_LECTURAS - reloj.mono())
    if (estadoGps === 'granted') vigilarGps()
    else gps = navegador.geolocation ? 'requiere_toque' : 'no_aplica'
    publicar()
  }
```

- [ ] **Step 7: `lib/viaje.ts` (5 de 6): dentro de `lecturasRecibidas`; sección «Visibilidad, recarga y otras ventanas»: `reintentarCandado`, `alCambiarVisibilidad`, `alVolverVisible`, `alMostrarPagina`, `alCambiarAlmacenamiento`; sección «Arranque»**

Reemplazá (cerca de la línea 1136):

```ts
    marcaDeteccion = { mono, pared }
    if (intencion === null) ultimoMovimiento = pared
    escribirIntencion()
    terminarArranque()
  }
```

por:

```ts
    marcaDeteccion = { mono, pared }
    if (intencion === null) ultimoMovimiento = pared
    escribirIntencion()
    programarLatido()
    terminarArranque()
  }
```

Reemplazá (cerca de la línea 1176):

```ts
    terminarArranque()
  }

  function destruir(): void {
    if (destruido) return
    intento++
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
    quitarEscuchaAudio?.()
    quitarEscuchaAudio = null
    try {
```

por:

```ts
    terminarArranque()
  }

  function reintentarCandado(): void {
    if (fase !== 'otra_ventana' || candadoEnCurso) return
    if (leerIntencion() === null) {
      apagarCon('usuario', false)
      return
    }
    const mio = intento
    void tomarCandado().then((tomado) => {
      if (!tomado) return
      if (mio !== intento || destruido || fase !== 'otra_ventana') {
        if (!estaEncendido()) soltarCandado()
        return
      }
      temporizadorLatido = cancelar(temporizadorLatido)
      reanudarSinGesto()
    })
  }

  /* ---------- Visibilidad, recarga y otras ventanas ---------- */
  function alCambiarVisibilidad(): void {
    if (destruido) return
    const pared = reloj.pared()
    if (fuentes.documento.visibilityState !== 'visible') {
      if (marcaDeteccion && fase === 'activo') contarDeteccion(reloj.mono(), pared)
      marcaDeteccion = null
      ocultoDesde = pared
      return
    }
    const desde = ocultoDesde
    ocultoDesde = null
    alVolverVisible(desde)
  }

  /** §4.3: al volver se pide otra vez el wake lock, se revisa el audio, se trata el hueco y se pide la configuración. */
  function alVolverVisible(ocultaDesde: number | null): void {
    const mono = reloj.mono()
    const pared = reloj.pared()
    if (fase === 'activo') {
      if (ocultaDesde !== null) {
        anotarHueco(ocultaDesde, pared - ocultaDesde)
        procesar(detector.hueco(mono, pared))
      }
      marcaDeteccion = { mono, pared }
      void asegurarPantalla()
    }
    if (fase === 'otra_ventana') reintentarCandado()
    alCambiarAudio()
    actualizarDestrabador()
    publicar()
  }

  function alMostrarPagina(evento: Event): void {
    if (destruido || !(evento as unknown as { persisted?: boolean }).persisted) return
    alVolverVisible(ocultoDesde)
    ocultoDesde = null
  }

  /** El evento storage sólo llega desde otra ventana: si ésa borró la intención, ésta se apaga sin reescribirla. */
  function alCambiarAlmacenamiento(evento: Event): void {
    if (destruido) return
    const e = evento as unknown as { key: string | null; newValue: string | null }
    if ((e.key === CLAVE_INTENCION || e.key === null) && e.newValue === null && estaEncendido()) apagarCon('usuario', false)
  }

  function destruir(): void {
    if (destruido) return
    intento++
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
    soltarCandado()
    quitarDestrabador()
    fuentes.ventana.removeEventListener('storage', alCambiarAlmacenamiento)
    fuentes.ventana.removeEventListener('pageshow', alMostrarPagina)
    fuentes.documento.removeEventListener('visibilitychange', alCambiarVisibilidad)
    quitarEscuchaAudio?.()
    quitarEscuchaAudio = null
    try {
```

Reemplazá (cerca de la línea 1267):

```ts
  }

  /* ---------- Arranque ---------- */
  if (!fuentes.seguro) {
    fase = 'no_soportado'
    motivoNoSoportado = 'inseguro'
```

por:

```ts
  }

  /* ---------- Arranque ---------- */
  fuentes.ventana.addEventListener('storage', alCambiarAlmacenamiento)
  fuentes.ventana.addEventListener('pageshow', alMostrarPagina)
  fuentes.documento.addEventListener('visibilitychange', alCambiarVisibilidad)

  if (!fuentes.seguro) {
    fase = 'no_soportado'
    motivoNoSoportado = 'inseguro'
```

- [ ] **Step 8: `lib/viaje.ts` (6 de 6): sección «Arranque»; el objeto que devuelve `crearMotorViaje`**

Reemplazá (cerca de la línea 1280):

```ts
  }
  diagnosticoActivo = leerDiagnostico()
  if (fase !== 'no_soportado') {
    const sinSensores = leerJson(CLAVE_SIN_SENSORES)
    if (esObjeto(sinSensores) && esNumero(sinSensores.en) && reloj.pared() - sinSensores.en < MS_SIN_SENSORES_VIGENTE) fase = 'sin_lecturas'
  }
  actual = congelar(armarEstado())
  actualJson = JSON.stringify(actual)
```

por:

```ts
  }
  diagnosticoActivo = leerDiagnostico()
  if (fase !== 'no_soportado') {
    const guardada = leerIntencion()
    if (guardada && reloj.pared() - guardada.ultimoLatido < MS_INTENCION_VIGENTE) {
      intencion = guardada
      ultimoMovimiento = guardada.ultimoMovimiento
      reanudarSinGesto()
    } else {
      if (guardada) borrarClave(CLAVE_INTENCION)
      const sinSensores = leerJson(CLAVE_SIN_SENSORES)
      if (esObjeto(sinSensores) && esNumero(sinSensores.en) && reloj.pared() - sinSensores.en < MS_SIN_SENSORES_VIGENTE) fase = 'sin_lecturas'
    }
  }
  actual = congelar(armarEstado())
  actualJson = JSON.stringify(actual)
```

Reemplazá (cerca de la línea 1304):

```ts
    },
    estado: () => actual ?? ESTADO_SERVIDOR,
    encender,
    reanudar: () => Promise.resolve(),
    apagar,
    tocar: () => undefined,
    activarGps: () => undefined,
    cambiarRuta,
    responder: () => undefined,
```

por:

```ts
    },
    estado: () => actual ?? ESTADO_SERVIDOR,
    encender,
    reanudar,
    apagar,
    tocar,
    activarGps: () => undefined,
    cambiarRuta,
    responder: () => undefined,
```

- [ ] **Step 9: Correr la prueba y verla pasar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   un latido de más de 30 minutos descarta la intención
  ok   latido viejo: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   reanudar con 'denied': sin_permiso y borra la intención
  ok   reanudar negado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   con una intención vigente arranca en reanudando, antes de cualquier await
  ok   recarga con permiso: activo sin gesto
  ok   recarga con el wake lock rechazado: pantalla sin_retener
  ok   audio y vibración esperan un toque
  ok   con la geolocalización ya concedida vigila el GPS sin gesto
  ok   conserva cuándo se encendió y reescribe el latido
  ok   el destrabador escucha pointerup, touchend, click y keydown, nunca pointerdown
  ok   pointerdown no llama a nada
  ok   pointerup pide el wake lock y destraba el audio
  ok   el destrabador nunca pide el permiso de movimiento ni el GPS
  ok   con pantalla y audio listos el destrabador se quita
  ok   el latido reescribe la intención cada 30 s desde el documento visible
  ok   oculto no escribe el latido ni marca la pantalla como liberada
  ok   al volver visible, el wake lock vuelve sin gesto (ya autorizado en este documento)
  ok   el tiempo oculto queda como hueco de detección
  ok   si el sistema suelta el wake lock con la página visible, se recupera
  ok   reanudación con permiso: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   pageshow con persisted (la página vuelve de la caché del navegador) declara el hueco
  ok   y el visibilitychange que llega después no lo cuenta dos veces
  ok   pageshow persisted: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   encendido con gesto: pantalla retenida y destrabador quitado
  ok   si el sistema suelta el wake lock con la página visible y no se recupera: sin_retener y pantallaLiberada
  ok   y el destrabador vuelve a escuchar para recuperarla con el próximo toque
  ok   con el toque se recupera y deja de decir que la pantalla se libera sola
  ok   pantalla liberada: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   iPhone instalada con iOS 17.5: pantalla no_garantizada
  ok   iPhone viejo instalado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   el mismo iPhone en Safari, sin instalar: la pantalla se puede retener
  ok   iPhone viejo en Safari: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   iPhone instalada con iOS 18.4: la pantalla se puede retener
  ok   iPhone nuevo instalado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   recarga: el wake lock sin gesto se rechaza
  ok   recarga: con un click se concede
  ok   recarga y click: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   reanudar sin gesto con NotAllowedError: reanudar_con_toque
  ok   reanudar_con_toque conserva la intención
  ok   reanudar pide wake lock y permiso sincrónicos, una sola vez
  ok   reanudar dos veces: activo con un watchPosition y un sentinel
  ok   montaje + visible + cambio de ruta + reanudar y encender otra vez: un watchPosition y un sentinel
  ok   tras apagar(): cero vigilancias, cero centinelas, cero devicemotion
  ok   reanudar con toque: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   la primera ventana toma el candado acta-modo-viaje
  ok   segunda instancia sin candado: otra_ventana
  ok   la otra ventana no escucha sensores ni retiene la pantalla
  ok   el evento storage que borra la intención apaga sin reescribirla
  ok   la ventana que detectaba también se apaga y suelta el candado
  ok   otra ventana A: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   otra ventana B: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
121/121 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 10: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 11: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Reanudar el modo viaje al reabrir y recuperar la pantalla con el primer toque

Al reabrir la aplicación con el modo encendido hace menos de 30 minutos, el motor retoma
sin esperar un toque: pide el permiso de movimiento (en iPhone rechaza sin gesto y la
tarjeta pide tocar), el GPS sólo si ya estaba concedido y la pantalla por si el navegador
la da. Un destrabador escucha pointerup, touchend, click y keydown —nunca pointerdown, que
con el dedo no activa— y con el primer toque recupera la pantalla y el audio, sin pedir
permisos.

Un candado de Web Locks deja detectar a una sola ventana, y si otra borra la intención ésta
se apaga sin volver a escribirla.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Rutas (§3.6) y huecos de detección

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V6]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V6]`

**Interfaces:**
- Consumes:
  - De las Tareas 4 y 5: `dejarDeEscuchar`, `escuchar`, `soltarGps`, `vigilarGps`, `soltarPantalla`, `asegurarPantalla`, `consultarPermisoGps`, `contarDeteccion`, `anotarHueco`, `actualizarDestrabador`, `programarLatido`, `continuarArranque`, `lecturasRecibidas`, `apagarCon`. Del detector: `hueco(mono, pared)`.
- Produces:
  - `cambiarRuta(ruta)` (reemplazada): con fase `activo` y una ruta de `RUTAS_EN_PAUSA` pasa a `en_pausa` (quita `devicemotion`, suelta el GPS y el wake lock, conserva la intención y el latido); al salir vuelve a `activo`, escucha, vigila el GPS si lo tenía (o consulta el permiso si nunca lo hizo), pide la pantalla y declara el hueco al detector.
  - La pausa se anota en `deteccion.huecos` con su duración; `deteccion.activaMs` no la cuenta y `deteccion.totalMs` sí. Una reanudación sin gesto que arranca en una ruta en pausa queda `en_pausa` sin escuchar; un encendido con gesto en esa ruta escucha hasta la primera lectura y recién ahí entra en pausa.
  - Internas: `entrarEnPausa()`, `salirDePausa()` y `pausaDesde`.

**Decisiones de esta tarea:**

- Un salto de la pared sin `mono` entre dos tics (equipo suspendido o reloj cambiado) ya cuenta como hueco desde la Tarea 4 (`contarDeteccion`); la prueba de esta tarea lo confirma junto con la pausa.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V6]` los bloques de rutas y pausa.

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V6]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Rutas (§3.6): pausa en /s/*, píldora por ruta, y la pausa cuenta como hueco */
  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const falsas = crearFuentesFalsas()
    const motor = crearMotorViaje(falsas.fuentes)
    const casos = [
      ['/', false, false],
      ['/perfil', true, false],
      ['/historial', true, false],
      ['/s/ADS-7K2M4Q', false, true],
      ['/t/abc', false, false],
      ['/panel', false, false],
      ['/panel/casos', false, false],
      ['/verificar', false, false],
      ['/verificar/ADS-7K2M4Q', true, false],
      ['/entrar', false, false],
    ]
    const mal = casos.filter(([ruta, conPildora, enPausa]) => {
      motor.cambiarRuta(ruta)
      const r = motor.estado().ruta
      return r.actual !== ruta || r.conPildora !== conPildora || r.enPausa !== enPausa
    })
    verificar('conPildora y enPausa siguen los patrones: * es prefijo, sin * es exacta', mal.length === 0, JSON.stringify(mal))
    terminar('rutas', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    const mapa = falsas.almacenamiento.mapa
    await falsas.reloj.avanzar(5000)
    motor.cambiarRuta('/s/ADS-7K2M4Q')
    const enPausa = motor.estado()
    verificar('ruta en pausa: sin devicemotion, sin GPS y sin wake lock', enPausa.fase === 'en_pausa' && falsas.ventana.escuchas('devicemotion') === 0 && falsas.geo.vigilancias === 0 && falsas.wakeLock.activos === 0)
    verificar('en pausa conserva la intención', mapa.has('acta:viaje'))
    await falsas.reloj.avanzar(25_000)
    verificar('en pausa el latido sigue', JSON.parse(mapa.get('acta:viaje')).ultimoLatido === falsas.reloj.pared())
    motor.cambiarRuta('/s/ADS-7K2M4Q')
    verificar('cambiar a otra ruta en pausa no despierta nada', falsas.ventana.escuchas('devicemotion') === 0)
    motor.cambiarRuta('/perfil')
    await falsas.reloj.avanzar(0)
    const vuelta = motor.estado()
    verificar('al salir de la pausa vuelve a escuchar, a vigilar el GPS y a retener la pantalla', vuelta.fase === 'activo' && falsas.ventana.escuchas('devicemotion') === 1 && falsas.geo.vigilancias === 1 && falsas.wakeLock.activos === 1)
    verificar('la pausa queda como hueco de detección', vuelta.deteccion.huecos.length === 1 && vuelta.deteccion.huecos[0].ms === 25_000)
    await falsas.reloj.avanzar(10_000)
    const d = motor.estado().deteccion
    verificar('la detección activa no cuenta la pausa y el total sí', d.activaMs === 15_000 && d.totalMs === 40_000, JSON.stringify(d))
    falsas.reloj.saltarPared(20_000)
    await falsas.reloj.avanzar(1000)
    verificar('un salto de la pared sin mono (equipo suspendido) también es hueco', motor.estado().deteccion.huecos.some((h) => h.ms === 20_000))
    terminar('pausa por ruta', motor, falsas)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Sin pausa, el motor sigue escuchando en `/s/…` y la detección cuenta ese tiempo como activa. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA ruta en pausa: sin devicemotion, sin GPS y sin wake lock 
  FALLA cambiar a otra ruta en pausa no despierta nada 
  FALLA la pausa queda como hueco de detección 
  FALLA la detección activa no cuenta la pausa y el total sí {"activaMs":40000,"totalMs":40000,"huecos":[]}
```

y al final:

```text
128/132 verificaciones pasaron
4 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 2): dentro de `cambiarRuta`; `pausaDesde`; dentro de `continuarArranque`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 599):

```ts
  function cambiarRuta(nueva: string): void {
    if (destruido) return
    ruta = { actual: nueva, enPausa: coincide(nueva, RUTAS_EN_PAUSA), conPildora: !coincide(nueva, RUTAS_SIN_PILDORA) }
    publicar()
  }
```

por:

```ts
  function cambiarRuta(nueva: string): void {
    if (destruido) return
    ruta = { actual: nueva, enPausa: coincide(nueva, RUTAS_EN_PAUSA), conPildora: !coincide(nueva, RUTAS_SIN_PILDORA) }
    if (fase === 'activo' && ruta.enPausa) entrarEnPausa()
    else if (fase === 'en_pausa' && !ruta.enPausa) salirDePausa()
    publicar()
  }
```

Reemplazá (cerca de la línea 902):

```ts
  let temporizadorTic: number | null = null
  let marcaDeteccion: { mono: number; pared: number } | null = null
  let inicioDeteccion: number | null = null
  let ocultoDesde: number | null = null

  function alMovimiento(evento: Event): void {
```

por:

```ts
  let temporizadorTic: number | null = null
  let marcaDeteccion: { mono: number; pared: number } | null = null
  let inicioDeteccion: number | null = null
  let pausaDesde: number | null = null
  let ocultoDesde: number | null = null

  function alMovimiento(evento: Event): void {
```

Reemplazá (cerca de la línea 1109):

```ts
    }
    await pantalla
    if (mio !== intento || destruido) return
    // Sin gesto, el permiso del GPS se consulta antes de escuchar: si la primera lectura llegara mientras
    // tanto en una ruta en pausa, el GPS arrancaría después de la pausa y quedaría prendido en el recorrido.
    const estadoGps = conGesto ? 'granted' : await consultarPermisoGps()
```

por:

```ts
    }
    await pantalla
    if (mio !== intento || destruido) return
    if (ruta.enPausa && !conGesto) {
      soltarPantalla()
      fase = 'en_pausa'
      pausaDesde = reloj.pared()
      programarLatido()
      terminarArranque()
      return
    }
    // Sin gesto, el permiso del GPS se consulta antes de escuchar: si la primera lectura llegara mientras
    // tanto en una ruta en pausa, el GPS arrancaría después de la pausa y quedaría prendido en el recorrido.
    const estadoGps = conGesto ? 'granted' : await consultarPermisoGps()
```

- [ ] **Step 4: `lib/viaje.ts` (2 de 2): dentro de `lecturasRecibidas`; `entrarEnPausa`, `salirDePausa`; dentro de `apagarCon`**

Reemplazá (cerca de la línea 1148):

```ts
    if (intencion === null) ultimoMovimiento = pared
    escribirIntencion()
    programarLatido()
    terminarArranque()
  }
```

por:

```ts
    if (intencion === null) ultimoMovimiento = pared
    escribirIntencion()
    programarLatido()
    if (ruta.enPausa) entrarEnPausa()
    terminarArranque()
  }
```

Reemplazá (cerca de la línea 1163):

```ts
    terminarArranque()
  }

  function apagar(motivo: MotivoApagado): void {
    apagarCon(motivo, true)
  }
```

por:

```ts
    terminarArranque()
  }

  function entrarEnPausa(): void {
    const mono = reloj.mono()
    const pared = reloj.pared()
    if (marcaDeteccion && fuentes.documento.visibilityState === 'visible') contarDeteccion(mono, pared)
    marcaDeteccion = null
    pausaDesde = pared
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
    fase = 'en_pausa'
    actualizarDestrabador()
  }

  function salirDePausa(): void {
    const mono = reloj.mono()
    const pared = reloj.pared()
    fase = 'activo'
    if (pausaDesde !== null) anotarHueco(pausaDesde, pared - pausaDesde)
    pausaDesde = null
    inicioDeteccion ??= pared
    marcaDeteccion = { mono, pared }
    escuchar()
    procesar(detector.hueco(mono, pared))
    if (gps === 'ok' || gps === 'buscando' || gps === 'impreciso') {
      vigilarGps()
    } else if (gps === 'no_aplica') {
      // Reanudó directo en pausa y nunca consultó el permiso: sin gesto, el GPS sólo arranca si ya estaba dado.
      const mio = intento
      void consultarPermisoGps().then((estadoGps) => {
        if (mio !== intento || destruido || fase !== 'activo' || gps !== 'no_aplica') return
        if (estadoGps === 'granted') vigilarGps()
        else gps = navegador.geolocation ? 'requiere_toque' : 'no_aplica'
        publicar()
      })
    }
    void asegurarPantalla()
    actualizarDestrabador()
  }

  function apagar(motivo: MotivoApagado): void {
    apagarCon(motivo, true)
  }
```

Reemplazá (cerca de la línea 1224):

```ts
    activaMs = 0
    totalMs = 0
    huecos = []
    terminarArranque()
  }
```

por:

```ts
    activaMs = 0
    totalMs = 0
    huecos = []
    pausaDesde = null
    terminarArranque()
  }
```

- [ ] **Step 5: Correr la prueba y verla pasar**

Run: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V6'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   conPildora y enPausa siguen los patrones: * es prefijo, sin * es exacta
  ok   rutas: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   ruta en pausa: sin devicemotion, sin GPS y sin wake lock
  ok   en pausa conserva la intención
  ok   en pausa el latido sigue
  ok   cambiar a otra ruta en pausa no despierta nada
  ok   al salir de la pausa vuelve a escuchar, a vigilar el GPS y a retener la pantalla
  ok   la pausa queda como hueco de detección
  ok   la detección activa no cuenta la pausa y el total sí
  ok   un salto de la pared sin mono (equipo suspendido) también es hueco
  ok   pausa por ruta: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
132/132 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 6: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 7: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Pausar el modo viaje dentro del recorrido y contar la pausa como hueco

Mientras la persona registra un accidente, el recorrido usa la cámara y el micrófono y el
teléfono se mueve en la mano: seguir escuchando el acelerómetro ahí sólo daría golpes
falsos. En /s/* el motor suelta los sensores, el GPS y la pantalla, conserva la intención y
el latido, y al salir vuelve a escuchar declarando un hueco. La hoja va a mostrar la
detección activa contra el total, para que se vea cuánto tiempo no hubo detección.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Detector → episodios → alertas: agregación, vencimiento por pared, seguimiento, silenciosos y maniobras a la cola

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido
- Modify: `scripts/prueba-viaje.mjs` — la línea `/* ---------- Resultado ---------- */` (sección nueva, después de `[V6]`)
- Test: `scripts/prueba-viaje.mjs`, sección `[V7] Motor: episodios, alerta, respuestas, inactividad y configuración`

**Interfaces:**
- Consumes:
  - `EventoDetector` (F2): `{ tipo: 'episodio', disparoMono, ocurridoEn, episodio, veredicto }`, `{ tipo: 'seguimiento', …, motivo }` y `{ tipo: 'maniobra', maniobra }`; del `Veredicto`: `nivel`, `picoG`, `motivo`, `silencioso`, `señales?.previa`, `caida?.previa` y `caida?.densaG`. `resumen(mono).hzMedido` y `.fuente`.
  - `codificarEpisodio(n, ocurridoEnTelefono, episodio, veredictoCliente)` (F1), `nivelMayor(a, b)` (F1), `MAX_EVENTOS_LOTE` (F1).
  - `ColaViaje` (Tarea 1): `guardarAlerta`, `guardarEpisodio`, `guardarConduccion`, `drenar(enviar, ahora, soloAlerta?)` e `idServidor(idCliente)`.
  - De las Tareas 4 y 5: `tic()`, `latido()`, `alCambiarVisibilidad()`, `alVolverVisible()`, `apagarCon()`, `actualizarDestrabador()`, `alFix` (que llena `historialFixes` y `ultimoFix`).
- Produces:
  - `drenarCola(): Promise<void>`: nunca rechaza; espera las escrituras pendientes de la cola y drena; si la llaman mientras drena, hace una vuelta más al terminar.
  - `estado().alerta` en `pregunta` ante un episodio `sospecha` o `confirmado` o un evento `seguimiento`: `idCliente` de `fuentes.nuevoId()`, `plazo = abiertaEn + 30 000`, `restanteS` a 1 Hz contra la pared (vence en el primer tic después del plazo aunque no haya habido tics), `armada` a los 600 ms y `ubicacion` del último fix. Al vencer: respuesta `sin_respuesta` con `enTelefono = plazo`, estado `ayuda` con `origenAyuda: 'sin_respuesta'`, sin plazo.
  - Otro episodio durante `pregunta` se agrega a esa alerta (`n + 1`, `nivel_cliente` = el mayor) sin tocar el plazo. Con `ayuda` abierta, configuración distinta de `normal` o motor desactualizado, se registra una alerta aparte con `alerta_mostrada: false` y no se muestra. Una alerta abierta sigue igual si el motor pasa a `en_pausa` por la ruta: su cuenta no depende del tic del detector.
  - `CamposAlerta` completos (`aviso_version`, `version_motor`, `plataforma`, `standalone`, `ocurrido_en_telefono`, `apertura`, `nivel_cliente`, `alerta_mostrada`, `sonido: null`, `respuestas`, `hubo_choque`, `ms_hasta_respuesta`, `hz_medido`, `aceleracion_derivada`, `gps` del fix más cercano al pico y `umbrales_cliente`), escritos en la cola antes que sus episodios y antes de drenar.
  - Filas `FilaEventoConduccion` con los valores acotados a los rangos del transporte: de cada `maniobra`, de cada episodio con `silencioso === 'golpe_en_marcha'` y de cada uno con `'caida_silenciosa'`, como fija el índice. Se encolan en lotes de hasta `MAX_EVENTOS_LOTE` al juntar 10, a los 5 min del primero pendiente, al ocultarse el documento y al apagar. `diagnostico.episodios` guarda los últimos 20 episodios.
  - Internas que usan las tareas siguientes: `procesar(eventos)` (reemplazada), `alertaPorDeteccion(e)`, `camposNuevos(idCliente, e, apertura, mostrada)`, `subirAlerta(idCliente, campos, episodios)`, `registrarAlertaSilenciosa`, `abrirAlerta`, `agregarEpisodio`, `armar()`, `programarCuenta()`, `revisarPlazo()`, `anotarRespuesta(a, respuesta, enTelefono)`, `vencerPregunta()`, `pasarAAyuda(a, origen)`, `camposConocidos`, `anotarConduccion(fila)`, `revisarLoteConduccion(pared)`, `cerrarLoteConduccion()`, `encadenar(fn)`, `enviar: EnviarViaje`, `drenarAhora(soloAlerta?)` y `tomarIdsDelServidor()`. Tipos internos `AlertaInterna` y `EventoDeAlerta`; ayudantes `transportarRespuestas`, `msHastaRespuesta`, `acotar` y `gpsCercano`.

**Decisiones de esta tarea:**

- Las pruebas usan el detector real de F2 con dos escenas elegidas con margen sobre las reglas, no sobre la calibración: `golpeSinGps` (12 g durante 117 ms con el teléfono quieto antes y sin ninguna velocidad) es la fila 7 de §2.5 (`sospecha`); `golpeEnMarcha` (60 km/h, el golpe, 35 km/h) es la fila 4 (`golpe_en_marcha`, porque 35 ≥ max(15, 0,5 · 60)), y 15 s a 0 km/h a los 40 s disparan el seguimiento (§2.6).
- Los valores de las filas de conducción se acotan a los rangos de `validarLoteConduccion` (`kmh` de 0 a 300, `duracion_ms` entero hasta 600 000, `g_estimada` hasta 5, `pico_g` hasta 50): el servidor rechaza el lote entero por un solo valor fuera de rango y la cola borra ese lote, así un salto del GPS perdería los otros nueve eventos.
- Una fila de maniobra entra por el mismo camino (`anotarConduccion`) que la del golpe en marcha, que prueba [V7]; que el detector emita maniobras lo prueba [V4] de F2.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá la sección `[V7]` antes del resultado. `golpeSinGps`, `chocar`, `trayecto` y `golpeEnMarcha` arman escenas con tiempos desde el `mono()` de la prueba y las pasan a `reproducir`; las usan también los bloques que suman las Tareas 8 a 13.

En `scripts/prueba-viaje.mjs`, reemplazá la línea del resultado:

```js
/* ---------- Resultado ---------- */
```

por:

```js
await seccion('V7', 'Motor: episodios, alerta, respuestas, inactividad y configuración', async () => {
  const { crearFuentesFalsas, crearServidorFalso } = await import('./fuentes-falsas.mjs')

  const G = 9.80665
  const MUESTRA_MS = 1000 / 60
  const quieta = (t) => ({ t, a: [0.02, 0.01, 0.03], aIG: [0.02, 0.01, G + 0.03], giro: [1, 1, 1] })
  const limpio = (falsas) => {
    const l = falsas.limpio()
    return l.temporizadores === 0 && l.escuchas === 0 && l.vigilancias === 0 && l.centinelas === 0
  }
  function terminar(nombre, motor, falsas) {
    motor.destruir()
    verificar(`${nombre}: sin temporizadores, escuchas, vigilancias ni centinelas al terminar`, limpio(falsas), JSON.stringify(falsas.limpio()))
  }
  async function encendido(opciones = {}) {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const falsas = crearFuentesFalsas(opciones)
    const motor = crearMotorViaje(falsas.fuentes)
    motor.cambiarRuta('/')
    falsas.gesto()
    const listo = motor.encender()
    await falsas.reloj.avanzar(0)
    falsas.movimiento.emitir(quieta(falsas.reloj.mono()))
    await listo
    await falsas.reloj.avanzar(0)
    return { falsas, motor }
  }
  /**
   * 3 s quieto, un golpe de `g` sostenido 100 ms y 1 s quieto, sin GPS. Sin velocidad disponible es la fila 7
   * de §2.5: sospecha. No depende de la calibración del banco, sólo de las reglas.
   */
  function golpeSinGps(desde, g = 12) {
    const muestras = []
    let t = desde
    for (let i = 0; i < 180; i++, t += MUESTRA_MS) muestras.push(quieta(t))
    for (let i = 0; i < 7; i++, t += MUESTRA_MS) muestras.push({ t, a: [g * G, 0.3, 0.2], aIG: [g * G, 0.3, G + 0.2], giro: [60, 5, 5] })
    for (let i = 0; i < 60; i++, t += MUESTRA_MS) muestras.push(quieta(t))
    return muestras
  }
  /** El golpe entero y los 9 s hasta que el episodio cierra (ventanaPostMs = 8 s después de la última muestra fuerte). */
  async function chocar(falsas) {
    await falsas.reproducir(golpeSinGps(falsas.reloj.mono()), [])
    await falsas.reloj.avanzar(9000)
  }
  /** Fixes a 1 Hz hacia el norte con posiciones coherentes con la velocidad: tramos [[segundos, kmh], …]. */
  function trayecto(tramos, desdeMono, desdePared) {
    const fixes = []
    let lat = -34.6037
    let i = 0
    for (const [segundos, kmh] of tramos) {
      for (let s = 0; s < segundos; s++, i++) {
        fixes.push({ lat, lon: -58.3816, precisionM: 5, velocidadMs: kmh / 3.6, adquiridoPared: desdePared + i * 1000, llegadaMono: desdeMono + i * 1000, llegadaPared: desdePared + i * 1000 })
        lat += kmh / 3.6 / 111_320
      }
    }
    return fixes
  }
  /** 12 s a 60 km/h, el golpe a los 12 s y después los tramos que se pasen: la fila 4 de §2.5 si sigue andando. */
  async function golpeEnMarcha(falsas, despues) {
    const mono = falsas.reloj.mono()
    const pared = falsas.reloj.pared()
    await falsas.reproducir(golpeSinGps(mono + 9000), trayecto([[12, 60], ...despues], mono, pared))
  }
  const alertasDe = (servidor) => [...servidor.alertas.values()]

  /* Episodios → alertas: una alerta, agregación sin reiniciar la cuenta, ayuda, cuenta por pared */
  {
    const { AVISO_DATOS_VERSION, VERSION_MOTOR } = await import('../lib/viaje.ts')
    const { falsas, motor } = await encendido()
    const vistas = []
    const desuscribir = motor.suscribir(() => vistas.push(motor.estado()))
    await chocar(falsas)
    desuscribir()
    const abierta = vistas.find((e) => e.alerta !== null)?.alerta ?? null
    verificar('un episodio sospecha abre una alerta en pregunta', abierta?.estado === 'pregunta' && abierta.apertura === 'episodio' && abierta.respuestas.length === 0)
    verificar('la cuenta es de 30 s contra un plazo de pared', abierta?.plazo === abierta?.abiertaEn + 30_000 && abierta?.restanteS === 30)
    verificar('los botones no están armados al abrir', abierta?.armada === false)
    const armada = vistas.find((e) => e.alerta?.armada === true)?.alerta ?? null
    verificar('a los 600 ms se arman', armada !== null && vistas.some((e) => e.alerta?.restanteS === 29))
    await falsas.reloj.avanzar(abierta.abiertaEn + 10_000 - falsas.reloj.pared())
    await chocar(falsas)
    const agregada = motor.estado().alerta
    verificar('un segundo episodio durante la pregunta se agrega a la misma alerta sin reiniciar la cuenta', agregada?.idCliente === abierta?.idCliente && agregada?.plazo === abierta?.plazo && agregada?.estado === 'pregunta')
    await motor.drenarCola()
    const enServidor = falsas.servidor.alertas.get(abierta.idCliente)
    verificar('los dos episodios suben a la misma alerta, n = 1 y n = 2', enServidor?.episodios.size === 2 && enServidor.episodios.has(1) && enServidor.episodios.has(2))
    verificar('la alerta viaja con el aviso de datos, la versión del motor y el nivel del teléfono', enServidor?.campos.aviso_version === AVISO_DATOS_VERSION && enServidor.campos.version_motor === VERSION_MOTOR && enServidor.campos.nivel_cliente === 'sospecha' && enServidor.campos.alerta_mostrada === true && enServidor.campos.apertura === 'episodio')
    await falsas.reloj.avanzar(10_000)
    const vencida = motor.estado().alerta
    verificar('al vencer la cuenta: sin_respuesta y ayuda', vencida?.estado === 'ayuda' && vencida.origenAyuda === 'sin_respuesta' && vencida.plazo === null && vencida.respuestas.at(-1)?.respuesta === 'sin_respuesta')
    await chocar(falsas)
    await motor.drenarCola()
    const aparte = alertasDe(falsas.servidor).filter((a) => a.campos.id_cliente !== abierta.idCliente)
    verificar('con la ayuda abierta, un episodio nuevo se registra como alerta aparte sin mostrarse', motor.estado().alerta?.idCliente === abierta.idCliente && aparte.length === 1 && aparte[0].campos.alerta_mostrada === false)
    terminar('episodios y alertas', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await chocar(falsas)
    falsas.reloj.saltarPared(31_000)
    verificar('con el equipo suspendido no hay tics: la alerta sigue en pregunta', motor.estado().alerta?.estado === 'pregunta')
    await falsas.reloj.avanzar(1000)
    verificar('la cuenta vence por reloj de pared al primer tic, sin esperar 30 tics', motor.estado().alerta?.estado === 'ayuda')
    terminar('cuenta por pared', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await chocar(falsas)
    const abierta = motor.estado().alerta
    motor.cambiarRuta('/s/ADS-7K2M4Q')
    const enPausa = motor.estado()
    verificar('con la alerta abierta, entrar a /s/… pausa los sensores y la alerta sigue', abierta?.estado === 'pregunta' && enPausa.fase === 'en_pausa' && enPausa.alerta?.idCliente === abierta.idCliente && enPausa.alerta.estado === 'pregunta' && falsas.ventana.escuchas('devicemotion') === 0)
    await falsas.reloj.avanzar(31_000)
    verificar('y la cuenta vence igual en la ruta en pausa', motor.estado().alerta?.estado === 'ayuda')
    terminar('alerta y ruta en pausa', motor, falsas)
  }

  /* Seguimiento del golpe en marcha (§2.6) y eventos silenciosos a la cola */
  {
    const { falsas, motor } = await encendido()
    await golpeEnMarcha(falsas, [[40, 35], [15, 0]])
    const abierta = motor.estado().alerta
    verificar('golpe en marcha y detención a los 40 s: se abre la alerta por seguimiento', abierta?.estado === 'pregunta' && abierta.apertura === 'seguimiento')
    terminar('seguimiento con detención', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await golpeEnMarcha(falsas, [[95, 35]])
    verificar('golpe en marcha que sigue a 35 km/h: sin alerta', motor.estado().alerta === null && falsas.servidor.alertas.size === 0)
    motor.apagar('usuario')
    await motor.drenarCola()
    const eventos = falsas.servidor.lotesConduccion.flatMap((l) => l.eventos)
    const golpe = eventos.find((e) => e[1] === 'golpe_en_marcha')
    verificar('el golpe en marcha se registra en silencio y el lote sube al apagar', golpe !== undefined && golpe[3] >= 50 && golpe[4] === null && golpe[7] >= 10, JSON.stringify(eventos))
    verificar('el lote viaja con el aviso de datos y sin ubicación', falsas.servidor.lotesConduccion.every((l) => l.aviso_version === '2026-09-16' && !('gps' in l) && l.eventos.every((e) => e.length === 8)))
    terminar('golpe en marcha que sigue', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await golpeEnMarcha(falsas, [[95, 35]])
    verificar('mientras el documento está a la vista el golpe en marcha espera en memoria', falsas.servidor.lotesConduccion.length === 0)
    falsas.documento.ponerVisible(false)
    await motor.drenarCola()
    const eventos = falsas.servidor.lotesConduccion.flatMap((l) => l.eventos)
    verificar('al ocultarse el documento el lote se encola y sube: una pestaña que se cierra no avisa', eventos.some((e) => e[1] === 'golpe_en_marcha'), JSON.stringify(eventos))
    terminar('lote al ocultarse', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await golpeEnMarcha(falsas, [[100, 35]])
    await falsas.reloj.avanzar(3 * 60_000)
    await motor.drenarCola()
    verificar('antes de los 5 minutos del primer evento el lote no se arma', falsas.servidor.lotesConduccion.length === 0)
    await falsas.reloj.avanzar(60_000)
    await motor.drenarCola()
    verificar('a los 5 minutos del primer evento pendiente el lote sube solo, con la alerta cerrada', falsas.servidor.lotesConduccion.length === 1 && falsas.servidor.lotesConduccion[0].eventos.some((e) => e[1] === 'golpe_en_marcha') && motor.estado().alerta === null)
    terminar('lote a los 5 minutos', motor, falsas)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Con el `procesar` vacío de la Tarea 4 ningún episodio abre una alerta: fallan las cuatro primeras verificaciones y la quinta corta con la excepción. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA un episodio sospecha abre una alerta en pregunta 
  FALLA la cuenta es de 30 s contra un plazo de pared 
  FALLA los botones no están armados al abrir 
  FALLA a los 600 ms se arman 
  FALLA [V7] terminó sin excepciones TypeError: Cannot read properties of null (reading 'abiertaEn')
```

y al final:

```text
0/5 verificaciones pasaron
5 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 4): los tipos, junto a `MotivoApagado`; `transportarRespuestas`, `msHastaRespuesta`, `acotar`; `gpsCercano`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 308):

```ts
type FaseMotor = EstadoModoViaje['fase']
type AlertaVisible = NonNullable<EstadoModoViaje['alerta']>
type MotivoApagado = NonNullable<EstadoModoViaje['apagadoPor']>['motivo']

/** La alerta viva con lo que no se publica: sus campos para la cola y cuántos episodios lleva. */
interface AlertaInterna {
```

por:

```ts
type FaseMotor = EstadoModoViaje['fase']
type AlertaVisible = NonNullable<EstadoModoViaje['alerta']>
type MotivoApagado = NonNullable<EstadoModoViaje['apagadoPor']>['motivo']
type EventoDeAlerta = Extract<EventoDetector, { tipo: 'episodio' | 'seguimiento' }>

/** La alerta viva con lo que no se publica: sus campos para la cola y cuántos episodios lleva. */
interface AlertaInterna {
```

Reemplazá (cerca de la línea 428):

```ts
  return { t, a, aIG, giro }
}

export function crearMotorViaje(fuentes: FuentesMotor): MotorViaje {
  const { reloj, navegador } = fuentes
  const plataforma = plataformaDe(navegador.userAgent ?? '', fuentes.documento)
```

por:

```ts
  return { t, a, aIG, giro }
}

function transportarRespuestas(respuestas: ReadonlyArray<{ respuesta: RespuestaAlerta; enTelefono: number }>): RespuestaTransportada[] {
  return respuestas.slice(-MAX_RESPUESTAS_TRANSPORTE).map((r) => ({ respuesta: r.respuesta, en_telefono: iso(r.enTelefono) }))
}

function msHastaRespuesta(abiertaEn: number, respuestas: ReadonlyArray<{ respuesta: RespuestaAlerta; enTelefono: number }>): number | null {
  const primera = respuestas.find(humana)
  if (!primera) return null
  return Math.min(MS_MAX_RESPUESTA, Math.max(0, Math.round(primera.enTelefono - abiertaEn)))
}

/** El servidor rechaza el lote entero por un solo valor fuera de rango: un salto del GPS se acota en vez de perder los otros eventos. */
function acotar(valor: number | null, minimo: number, maximo: number, decimales: number): number | null {
  if (valor === null || !Number.isFinite(valor)) return null
  return redondear(Math.min(maximo, Math.max(minimo, valor)), decimales)
}

export function crearMotorViaje(fuentes: FuentesMotor): MotorViaje {
  const { reloj, navegador } = fuentes
  const plataforma = plataformaDe(navegador.userAgent ?? '', fuentes.documento)
```

Reemplazá (cerca de la línea 908):

```ts
      return 'prompt'
    }
  }

  /* ---------- Movimiento y detección ---------- */
  let activaMs = 0
```

por:

```ts
      return 'prompt'
    }
  }
  function gpsCercano(ocurridoEn: number): GpsTransportado | null {
    let mejor: (typeof historialFixes)[number] | null = null
    for (const f of historialFixes) {
      if (mejor === null || Math.abs(f.pared - ocurridoEn) < Math.abs(mejor.pared - ocurridoEn)) mejor = f
    }
    if (!mejor) return null
    return { lat: redondear(mejor.lat, 6), lon: redondear(mejor.lon, 6), precision_m: redondear(Math.min(mejor.precisionM, 10_000), 1) }
  }

  /* ---------- Movimiento y detección ---------- */
  let activaMs = 0
```

- [ ] **Step 4: `lib/viaje.ts` (2 de 4): secciones «Eventos de conducción» y «Cola y red» (20 funciones)**

Reemplazá (cerca de la línea 989):

```ts
    precisionM = r.precisionM === null ? null : Math.round(r.precisionM)
    if (r.enMovimiento === true) ultimoMovimiento = pared
    diagnosticoActivo = leerDiagnostico()
    publicar()
  }

  /* ---------- Episodios y alertas ---------- */
  /** Todavía sin alertas: los eventos del detector se descartan. */
  function procesar(_eventos: EventoDetector[]): void {}

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
```

por:

```ts
    precisionM = r.precisionM === null ? null : Math.round(r.precisionM)
    if (r.enMovimiento === true) ultimoMovimiento = pared
    diagnosticoActivo = leerDiagnostico()
    revisarLoteConduccion(pared)
    publicar()
  }

  /* ---------- Eventos de conducción ---------- */
  let pendientesConduccion: FilaEventoConduccion[] = []
  let primerPendienteEn: number | null = null

  function anotarConduccion(fila: FilaEventoConduccion): void {
    pendientesConduccion.push(fila)
    primerPendienteEn ??= reloj.pared()
    if (pendientesConduccion.length >= EVENTOS_POR_LOTE) cerrarLoteConduccion()
  }
  function revisarLoteConduccion(pared: number): void {
    if (primerPendienteEn !== null && pared - primerPendienteEn >= MS_LOTE_CONDUCCION) cerrarLoteConduccion()
  }
  /** Al juntar 10, a los 5 minutos del primero, al pasar a oculto y al apagar: una pestaña cerrada no avisa. */
  function cerrarLoteConduccion(): void {
    if (pendientesConduccion.length === 0) return
    const pared = reloj.pared()
    while (pendientesConduccion.length > 0) {
      const eventos = pendientesConduccion.splice(0, MAX_EVENTOS_LOTE)
      const lote: LoteConduccion = { aviso_version: AVISO_DATOS_VERSION, version_motor: VERSION_MOTOR, plataforma, enviado_en: iso(pared), eventos }
      encadenar(() => fuentes.cola.guardarConduccion(lote, pared))
    }
    primerPendienteEn = null
    void drenarCola()
  }

  /* ---------- Cola y red ---------- */
  /** Las escrituras van en fila: una alerta se guarda antes que sus episodios y todo antes de drenar. */
  let escrituras: Promise<void> = Promise.resolve()
  function encadenar(fn: () => Promise<void>): void {
    escrituras = escrituras.then(fn).catch((err: unknown) => {
      console.warn('[viaje] no se pudo guardar en la cola del teléfono', err)
    })
  }

  const enviar: EnviarViaje = async (ruta, cuerpo) => {
    const res = await fuentes.fetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: cuerpo })
    let json: unknown = null
    try {
      json = await res.json()
    } catch {
      json = null
    }
    const espera = Number(res.headers.get('Retry-After'))
    return { status: res.status, cuerpo: json, reintentarEnS: res.headers.get('Retry-After') !== null && Number.isFinite(espera) && espera >= 0 ? espera : null }
  }

  async function drenarAhora(soloAlerta?: string): Promise<void> {
    await escrituras
    await fuentes.cola.drenar(enviar, reloj.pared(), soloAlerta)
    await tomarIdsDelServidor()
  }

  async function tomarIdsDelServidor(): Promise<void> {
    const ids = new Set<string>()
    if (alerta && alerta.idServidor === null) ids.add(alerta.idCliente)
    for (const id of ids) {
      const deServidor = await fuentes.cola.idServidor(id)
      if (!deServidor || destruido) continue
      if (alerta && alerta.idCliente === id && alerta.idServidor === null) {
        alerta.idServidor = deServidor
      }
    }
    publicar()
  }

  let drenando: Promise<void> | null = null
  let otraVuelta = false
  function drenarCola(): Promise<void> {
    if (destruido) return Promise.resolve()
    if (drenando) {
      otraVuelta = true
      return drenando
    }
    const tarea = (async () => {
      do {
        otraVuelta = false
        try {
          await drenarAhora()
        } catch (err) {
          console.warn('[viaje] no se pudo drenar la cola', err)
        }
      } while (otraVuelta && !destruido)
    })()
    drenando = tarea
    void tarea.then(() => {
      if (drenando === tarea) drenando = null
    })
    return tarea
  }

  /* ---------- Episodios y alertas ---------- */
  /** Campos de las alertas que ya no están a la vista (cerradas o silenciosas), para actualizarlas después. */
  const camposConocidos = new Map<string, CamposAlerta>()
  let temporizadorCuenta: number | null = null
  let temporizadorArmado: number | null = null

  function procesar(eventos: EventoDetector[]): void {
    for (const e of eventos) {
      if (destruido) return
      if (e.tipo === 'maniobra') {
        const m = e.maniobra
        anotarConduccion([fuentes.nuevoId(), m.tipo, iso(m.ocurridoEn), acotar(m.kmhInicial, 0, 300, 1), acotar(m.kmhFinal, 0, 300, 1), acotar(m.duracionMs, 0, 600_000, 0), acotar(m.gEstimada, 0, 5, 3), acotar(m.picoG, 0, 50, 3)])
        continue
      }
      const v = e.veredicto
      if (e.tipo === 'episodio') {
        episodiosRecientes.push({ en: e.ocurridoEn, nivel: v.nivel, picoG: redondear(v.picoG, 2), motivo: v.motivo })
        if (episodiosRecientes.length > MAX_EPISODIOS_DIAGNOSTICO) episodiosRecientes.shift()
        if (v.silencioso === 'golpe_en_marcha') {
          anotarConduccion([fuentes.nuevoId(), 'golpe_en_marcha', iso(e.ocurridoEn), acotar(v.señales?.previa ?? null, 0, 300, 1), null, null, null, acotar(v.picoG, 0, 50, 3)])
        } else if (v.silencioso === 'caida_silenciosa') {
          anotarConduccion([fuentes.nuevoId(), 'caida_silenciosa', iso(e.ocurridoEn), acotar(v.caida?.previa ?? null, 0, 300, 1), null, null, acotar(v.caida?.densaG ?? null, 0, 5, 3), acotar(v.picoG, 0, 50, 3)])
        }
        if (v.nivel === 'nada') continue
      }
      alertaPorDeteccion(e)
    }
  }

  function alertaPorDeteccion(e: EventoDeAlerta): void {
    const apertura = e.tipo === 'seguimiento' ? 'seguimiento' : 'episodio'
    const mostrar = configuracion.alerta === 'normal' && !configuracion.desactualizado
    if (!mostrar || alerta?.estado === 'ayuda') {
      registrarAlertaSilenciosa(e, apertura)
      return
    }
    if (alerta?.estado === 'pregunta') {
      agregarEpisodio(alerta, e)
      return
    }
    abrirAlerta(e, apertura)
  }

  function camposNuevos(idCliente: string, e: EventoDeAlerta, apertura: AlertaVisible['apertura'], mostrada: boolean): CamposAlerta {
    const pared = reloj.pared()
    const r = detector.resumen(reloj.mono())
    return {
      id_cliente: idCliente,
      aviso_version: AVISO_DATOS_VERSION,
      version_motor: VERSION_MOTOR,
      plataforma,
      standalone: fuentes.standalone,
      ocurrido_en_telefono: iso(e.ocurridoEn),
      enviado_en: iso(pared),
      apertura,
      nivel_cliente: e.veredicto.nivel,
      alerta_mostrada: mostrada,
      sonido: null,
      respuestas: [],
      hubo_choque: null,
      ms_hasta_respuesta: null,
      hz_medido: r.hzMedido === null ? null : redondear(Math.min(1000, Math.max(0, r.hzMedido)), 1),
      aceleracion_derivada: r.fuente === 'derivada',
      gps: gpsCercano(e.ocurridoEn),
      umbrales_cliente: { ...configuracion.umbrales },
    }
  }

  /** La alerta se escribe en la cola antes que sus episodios, y los dos antes de cualquier envío. */
  function subirAlerta(idCliente: string, campos: CamposAlerta, episodios: EpisodioTransportado[]): void {
    const pared = reloj.pared()
    encadenar(async () => {
      await fuentes.cola.guardarAlerta(idCliente, campos, pared)
      for (const episodio of episodios) await fuentes.cola.guardarEpisodio(idCliente, episodio, pared)
    })
    void drenarCola()
  }

  function registrarAlertaSilenciosa(e: EventoDeAlerta, apertura: AlertaVisible['apertura']): void {
    const idCliente = fuentes.nuevoId()
    const campos = camposNuevos(idCliente, e, apertura, false)
    camposConocidos.set(idCliente, campos)
    subirAlerta(idCliente, campos, [codificarEpisodio(1, e.ocurridoEn, e.episodio, e.veredicto)])
  }

  function abrirAlerta(e: EventoDeAlerta, apertura: AlertaVisible['apertura']): void {
    const pared = reloj.pared()
    const idCliente = fuentes.nuevoId()
    const campos = camposNuevos(idCliente, e, apertura, true)
    alerta = {
      estado: 'pregunta',
      idCliente,
      idServidor: null,
      plazo: pared + MS_PREGUNTA,
      restanteS: Math.ceil(MS_PREGUNTA / 1000),
      ocurridoEn: e.ocurridoEn,
      abiertaEn: pared,
      ayudaDesde: null,
      apertura,
      origenAyuda: null,
      respuestas: [],
      huboChoque: null,
      armada: false,
      ubicacion: ultimoFix ? { ...ultimoFix } : null,
      campos,
      episodios: 1,
      restaurada: false,
    }
    // Con una alerta en pantalla la pregunta de inactividad no se muestra, y el viaje cuenta desde acá.
    inactividad = null
    ultimoMovimiento = pared
    subirAlerta(idCliente, campos, [codificarEpisodio(1, e.ocurridoEn, e.episodio, e.veredicto)])
    armar()
    programarCuenta()
    actualizarDestrabador()
    publicar()
  }

  function agregarEpisodio(a: AlertaInterna, e: EventoDeAlerta): void {
    if (a.episodios >= MAX_EPISODIOS_ALERTA) return
    a.episodios++
    a.campos = { ...a.campos, nivel_cliente: nivelMayor(a.campos.nivel_cliente, e.veredicto.nivel) }
    subirAlerta(a.idCliente, a.campos, [codificarEpisodio(a.episodios, e.ocurridoEn, e.episodio, e.veredicto)])
  }

  function armar(): void {
    temporizadorArmado = cancelar(temporizadorArmado)
    temporizadorArmado = programar(() => {
      temporizadorArmado = null
      if (!alerta) return
      alerta.armada = true
      publicar()
    }, MS_ARMADO)
  }

  /** La cuenta se calcula contra un plazo de pared: si el equipo se suspende, vence igual al despertar. */
  function programarCuenta(): void {
    temporizadorCuenta = cancelar(temporizadorCuenta)
    if (!alerta || alerta.plazo === null) return
    temporizadorCuenta = programar(() => {
      temporizadorCuenta = null
      revisarPlazo()
      programarCuenta()
    }, MS_TIC)
  }
  function revisarPlazo(): void {
    if (!alerta || alerta.plazo === null) return
    const pared = reloj.pared()
    if (pared >= alerta.plazo) {
      if (alerta.estado === 'pregunta') vencerPregunta()
      return
    }
    const restante = Math.ceil((alerta.plazo - pared) / 1000)
    if (restante !== alerta.restanteS) {
      alerta.restanteS = restante
      publicar()
    }
  }

  function anotarRespuesta(a: AlertaInterna, respuesta: RespuestaAlerta, enTelefono: number): void {
    a.respuestas.push({ respuesta, enTelefono })
    a.campos = { ...a.campos, respuestas: transportarRespuestas(a.respuestas), ms_hasta_respuesta: msHastaRespuesta(a.abiertaEn, a.respuestas) }
  }

  function vencerPregunta(): void {
    const a = alerta
    if (!a || a.estado !== 'pregunta') return
    anotarRespuesta(a, 'sin_respuesta', a.plazo ?? reloj.pared())
    pasarAAyuda(a, 'sin_respuesta')
  }

  function pasarAAyuda(a: AlertaInterna, origen: 'necesito_ayuda' | 'sin_respuesta'): void {
    a.estado = 'ayuda'
    a.origenAyuda = origen
    a.plazo = null
    a.restanteS = null
    a.ayudaDesde = reloj.pared()
    if (ultimoFix) a.ubicacion = { ...ultimoFix }
    temporizadorCuenta = cancelar(temporizadorCuenta)
    subirAlerta(a.idCliente, a.campos, [])
    publicar()
  }

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
```

- [ ] **Step 5: `lib/viaje.ts` (3 de 4): dentro de `latido`; dentro de `apagarCon`; dentro de `alCambiarVisibilidad`**

Reemplazá (cerca de la línea 1299):

```ts
    const visible = fuentes.documento.visibilityState === 'visible'
    if (visible && fase === 'otra_ventana') reintentarCandado()
    if (visible && (fase === 'activo' || fase === 'en_pausa')) escribirIntencion()
  }

  function soltarTodo(): void {
```

por:

```ts
    const visible = fuentes.documento.visibilityState === 'visible'
    if (visible && fase === 'otra_ventana') reintentarCandado()
    if (visible && (fase === 'activo' || fase === 'en_pausa')) escribirIntencion()
    revisarLoteConduccion(pared)
  }

  function soltarTodo(): void {
```

Reemplazá (cerca de la línea 1506):

```ts
  function apagarCon(motivo: MotivoApagado, borrar: boolean): void {
    if (destruido || !estaEncendido()) return
    intento++
    soltarTodo()
    detector.descartarAbiertos()
    if (borrar) borrarIntencion()
```

por:

```ts
  function apagarCon(motivo: MotivoApagado, borrar: boolean): void {
    if (destruido || !estaEncendido()) return
    intento++
    cerrarLoteConduccion()
    soltarTodo()
    detector.descartarAbiertos()
    if (borrar) borrarIntencion()
```

Reemplazá (cerca de la línea 1551):

```ts
      if (marcaDeteccion && fase === 'activo') contarDeteccion(reloj.mono(), pared)
      marcaDeteccion = null
      ocultoDesde = pared
      return
    }
    const desde = ocultoDesde
```

por:

```ts
      if (marcaDeteccion && fase === 'activo') contarDeteccion(reloj.mono(), pared)
      marcaDeteccion = null
      ocultoDesde = pared
      cerrarLoteConduccion()
      return
    }
    const desde = ocultoDesde
```

- [ ] **Step 6: `lib/viaje.ts` (4 de 4): dentro de `alVolverVisible`; el objeto que devuelve `crearMotorViaje`**

Reemplazá (cerca de la línea 1572):

```ts
      void asegurarPantalla()
    }
    if (fase === 'otra_ventana') reintentarCandado()
    alCambiarAudio()
    actualizarDestrabador()
    publicar()
```

por:

```ts
      void asegurarPantalla()
    }
    if (fase === 'otra_ventana') reintentarCandado()
    revisarPlazo()
    alCambiarAudio()
    actualizarDestrabador()
    publicar()
```

Reemplazá (cerca de la línea 1668):

```ts
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente: () => undefined,
    borrarRegistros: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_BORRADO }),
    drenarCola: () => Promise.resolve(),
    destruir,
  }
}
```

por:

```ts
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente: () => undefined,
    borrarRegistros: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_BORRADO }),
    drenarCola,
    destruir,
  }
}
```

- [ ] **Step 7: Correr la prueba y verla pasar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   un episodio sospecha abre una alerta en pregunta
  ok   la cuenta es de 30 s contra un plazo de pared
  ok   los botones no están armados al abrir
  ok   a los 600 ms se arman
  ok   un segundo episodio durante la pregunta se agrega a la misma alerta sin reiniciar la cuenta
  ok   los dos episodios suben a la misma alerta, n = 1 y n = 2
  ok   la alerta viaja con el aviso de datos, la versión del motor y el nivel del teléfono
  ok   al vencer la cuenta: sin_respuesta y ayuda
  ok   con la ayuda abierta, un episodio nuevo se registra como alerta aparte sin mostrarse
  ok   episodios y alertas: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   con el equipo suspendido no hay tics: la alerta sigue en pregunta
  ok   la cuenta vence por reloj de pared al primer tic, sin esperar 30 tics
  ok   cuenta por pared: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   con la alerta abierta, entrar a /s/… pausa los sensores y la alerta sigue
  ok   y la cuenta vence igual en la ruta en pausa
  ok   alerta y ruta en pausa: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   golpe en marcha y detención a los 40 s: se abre la alerta por seguimiento
  ok   seguimiento con detención: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   golpe en marcha que sigue a 35 km/h: sin alerta
  ok   el golpe en marcha se registra en silencio y el lote sube al apagar
  ok   el lote viaja con el aviso de datos y sin ubicación
  ok   golpe en marcha que sigue: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   mientras el documento está a la vista el golpe en marcha espera en memoria
  ok   al ocultarse el documento el lote se encola y sube: una pestaña que se cierra no avisa
  ok   lote al ocultarse: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   antes de los 5 minutos del primer evento el lote no se arma
  ok   a los 5 minutos del primer evento pendiente el lote sube solo, con la alerta cerrada
  ok   lote a los 5 minutos: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
28/28 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 8: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 9: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Abrir la alerta del modo viaje desde los episodios del detector

Un episodio sospecha o confirmado abre la alerta con una cuenta de 30 segundos contra un
plazo de pared: si el equipo se suspende, vence igual al despertar. Otro episodio durante la
pregunta se suma a la misma alerta sin reiniciar la cuenta; con la ayuda abierta, la
configuración silenciosa o el motor desactualizado, se registra aparte sin mostrarse. Un
golpe en marcha no abre nada hasta que el seguimiento lo pide.

Todo va a la cola antes de mandarse, la alerta antes que sus episodios. Frenadas, golpes en
marcha y caídas silenciosas viajan en lotes sin ubicación y sin cuenta.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Aviso físico (audio, vibración, `audioSession`) y `probarAlerta`

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V7]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V7]`

**Interfaces:**
- Consumes:
  - `AudioMotor` (Tarea 3): `despertar(): Promise<boolean>`, `tono(duracionMs): () => void`, `suspender()`; `navegador.audioSession?.type`; `navegador.vibrate?(patron)`.
  - De la Tarea 7: `abrirAlerta`, `vencerPregunta`, `subirAlerta`, `alerta.campos.sonido`.
- Produces:
  - Al abrir una alerta en `pregunta`: `audioSession.type = 'playback'` si existe, `despertar()` sin esperar un toque, `tono(ms que faltan hasta el plazo)` y `vibrate([400, 200, 400])` cada 2 s mientras pregunta. `campos.sonido` pasa a `true` si el contexto quedó `running` y a `false` si no o si no hay audio (una sola vez por alerta, y nunca en una restaurada).
  - Al responder, vencer o cerrar: corta el tono, `vibrate(0)`, `audioSession.type = 'auto'` y `suspender()`.
  - `probarAlerta(): void`: dentro del gesto, `playback`, `despertar()`, `tono(1000)` y `vibrate([400, 200, 400])`; a 1 s corta todo (salvo que en el medio se haya abierto una alerta de verdad) y deja el audio destrabado.
  - Internas: `vibrar(patron)`, `iniciarAvisoFisico()`, `programarVibracion()`, `detenerAvisoFisico()`, `marcarSonido(idCliente, suena)` y los temporizadores `temporizadorVibracion` y `temporizadorPrueba`.

**Decisiones de esta tarea:**

- `vibrate` devuelve `false` sin activación y en iPhone no existe: no se mira el resultado y la llamada va en `try/catch` (riesgo 25).

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V7]` los bloques del aviso físico.

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V7]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Aviso físico (§3.3): sesión de audio, tono, vibración repetida, sonido informado y «Probar la alerta» */
  {
    const { falsas, motor } = await encendido({ sesionDeAudio: true })
    await chocar(falsas)
    verificar('al abrir la alerta: audioSession en playback, despierta el audio sin toque y suena el tono', falsas.audio.sesionTipo === 'playback' && falsas.audio.despertares === 1 && falsas.audio.tonos === 1 && falsas.audio.sonando)
    verificar('vibra con el patrón de la alerta', JSON.stringify(falsas.vibracion.patrones.at(-1)) === '[400,200,400]')
    const vibraciones = falsas.vibracion.patrones.length
    await falsas.reloj.avanzar(4000)
    verificar('y repite la vibración cada 2 s mientras pregunta', falsas.vibracion.patrones.length === vibraciones + 2)
    await motor.drenarCola()
    verificar('con el audio destrabado por el encendido, la telemetría dice que sonó', alertasDe(falsas.servidor)[0]?.campos.sonido === true)
    await falsas.reloj.avanzar(30_000)
    verificar('al vencer la cuenta se corta el tono, vibrate(0) y la sesión vuelve a auto', !falsas.audio.sonando && falsas.vibracion.patrones.at(-1) === 0 && falsas.audio.sesionTipo === 'auto' && falsas.audio.estadoContexto === 'suspended')
    const patrones = falsas.vibracion.patrones.length
    await falsas.reloj.avanzar(4000)
    verificar('en ayuda ya no vibra', falsas.vibracion.patrones.length === patrones)
    terminar('aviso físico', motor, falsas)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const mapa = new Map()
    mapa.set('acta:viaje', JSON.stringify({ encendidoEn: Date.UTC(2026, 8, 16, 17, 0), ultimoLatido: Date.UTC(2026, 8, 16, 17, 29), ultimoMovimiento: Date.UTC(2026, 8, 16, 17, 29), documentoId: '3c1e2b7a-5d4f-4e6a-9b8c-7d6e5f4a3b2c' }))
    const falsas = crearFuentesFalsas({ almacenamiento: mapa })
    const motor = crearMotorViaje(falsas.fuentes)
    motor.cambiarRuta('/')
    await falsas.reloj.avanzar(0)
    falsas.movimiento.emitir(quieta(falsas.reloj.mono()))
    await falsas.reloj.avanzar(0)
    await chocar(falsas)
    await falsas.reloj.avanzar(600)
    await motor.drenarCola()
    verificar('reanudado sin toque, el audio no suena y la telemetría lo dice', motor.estado().alerta?.estado === 'pregunta' && alertasDe(falsas.servidor)[0]?.campos.sonido === false)
    terminar('alerta sin audio destrabado', motor, falsas)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const falsas = crearFuentesFalsas({ sesionDeAudio: true })
    const motor = crearMotorViaje(falsas.fuentes)
    falsas.gesto()
    motor.probarAlerta()
    verificar('probar la alerta suena y vibra dentro del gesto, por el mismo camino que la alerta', falsas.audio.tonos === 1 && falsas.audio.despertares === 1 && falsas.audio.sonando && falsas.audio.sesionTipo === 'playback' && JSON.stringify(falsas.vibracion.patrones.at(-1)) === '[400,200,400]')
    await falsas.reloj.avanzar(999)
    verificar('sigue sonando antes del segundo', falsas.audio.sonando)
    await falsas.reloj.avanzar(1)
    verificar('a 1 s se corta todo', !falsas.audio.sonando && falsas.vibracion.patrones.at(-1) === 0 && falsas.audio.sesionTipo === 'auto')
    verificar('y deja el audio destrabado', motor.estado().avisos.sonido === 'listo' && motor.estado().avisos.vibracion === 'listo')
    terminar('probar la alerta', motor, falsas)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Sin aviso físico la alerta se abre en silencio y `probarAlerta` no hace nada; las verificaciones que no dependen del sonido pasan. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA al abrir la alerta: audioSession en playback, despierta el audio sin toque y suena el tono 
  FALLA vibra con el patrón de la alerta 
  FALLA y repite la vibración cada 2 s mientras pregunta 
  FALLA con el audio destrabado por el encendido, la telemetría dice que sonó 
  FALLA al vencer la cuenta se corta el tono, vibrate(0) y la sesión vuelve a auto 
  FALLA reanudado sin toque, el audio no suena y la telemetría lo dice 
  FALLA probar la alerta suena y vibra dentro del gesto, por el mismo camino que la alerta 
  FALLA sigue sonando antes del segundo 
  FALLA a 1 s se corta todo 
  FALLA y deja el audio destrabado 
```

y al final:

```text
32/42 verificaciones pasaron
10 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 3): `vibrar`; `temporizadorVibracion`, `cortarTono`; dentro de `abrirAlerta`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 740):

```ts
    if (typeof navegador.vibrate !== 'function') return 'no_soportada'
    return huboGesto ? 'listo' : 'requiere_toque'
  }

  /* ---------- Destrabador global ---------- */
  function estaEncendido(): boolean {
```

por:

```ts
    if (typeof navegador.vibrate !== 'function') return 'no_soportada'
    return huboGesto ? 'listo' : 'requiere_toque'
  }
  function vibrar(patron: number | number[]): void {
    try {
      // vibrate devuelve false sin activación y en iPhone no existe: no hay nada que hacer con ese false.
      navegador.vibrate?.(patron)
    } catch {
      /* ídem */
    }
  }

  /* ---------- Destrabador global ---------- */
  function estaEncendido(): boolean {
```

Reemplazá (cerca de la línea 1096):

```ts
  const camposConocidos = new Map<string, CamposAlerta>()
  let temporizadorCuenta: number | null = null
  let temporizadorArmado: number | null = null

  function procesar(eventos: EventoDetector[]): void {
    for (const e of eventos) {
```

por:

```ts
  const camposConocidos = new Map<string, CamposAlerta>()
  let temporizadorCuenta: number | null = null
  let temporizadorArmado: number | null = null
  let temporizadorVibracion: number | null = null
  let cortarTono: (() => void) | null = null

  function procesar(eventos: EventoDetector[]): void {
    for (const e of eventos) {
```

Reemplazá (cerca de la línea 1207):

```ts
    subirAlerta(idCliente, campos, [codificarEpisodio(1, e.ocurridoEn, e.episodio, e.veredicto)])
    armar()
    programarCuenta()
    actualizarDestrabador()
    publicar()
  }
```

por:

```ts
    subirAlerta(idCliente, campos, [codificarEpisodio(1, e.ocurridoEn, e.episodio, e.veredicto)])
    armar()
    programarCuenta()
    iniciarAvisoFisico()
    actualizarDestrabador()
    publicar()
  }
```

- [ ] **Step 4: `lib/viaje.ts` (2 de 3): `iniciarAvisoFisico`, `programarVibracion`, `detenerAvisoFisico`, `marcarSonido`; dentro de `vencerPregunta`; sección «Acciones de la persona»: `probarAlerta`**

Reemplazá (cerca de la línea 1253):

```ts
    }
  }

  function anotarRespuesta(a: AlertaInterna, respuesta: RespuestaAlerta, enTelefono: number): void {
    a.respuestas.push({ respuesta, enTelefono })
    a.campos = { ...a.campos, respuestas: transportarRespuestas(a.respuestas), ms_hasta_respuesta: msHastaRespuesta(a.abiertaEn, a.respuestas) }
```

por:

```ts
    }
  }

  function iniciarAvisoFisico(): void {
    const a = alerta
    if (!a || a.estado !== 'pregunta') return
    try {
      // La sesión 'auto' de un AudioContext queda en ambient y la llave de silencio la enmudece.
      if (navegador.audioSession) navegador.audioSession.type = 'playback'
    } catch {
      /* sin audioSession el tono depende del modo silencio */
    }
    const au = audio
    const idCliente = a.idCliente
    if (au) {
      void au.despertar().then(
        (suena) => marcarSonido(idCliente, suena),
        () => marcarSonido(idCliente, false),
      )
      try {
        cortarTono = au.tono(Math.max(0, (a.plazo ?? reloj.pared()) - reloj.pared()))
      } catch {
        cortarTono = null
      }
    } else {
      marcarSonido(idCliente, false)
    }
    programarVibracion()
  }
  function programarVibracion(): void {
    temporizadorVibracion = cancelar(temporizadorVibracion)
    if (!alerta || alerta.estado !== 'pregunta' || typeof navegador.vibrate !== 'function') return
    vibrar(PATRON_VIBRACION)
    temporizadorVibracion = programar(() => {
      temporizadorVibracion = null
      programarVibracion()
    }, MS_VIBRACION)
  }
  function detenerAvisoFisico(): void {
    const sonaba = cortarTono !== null || temporizadorVibracion !== null
    cortarTono?.()
    cortarTono = null
    temporizadorVibracion = cancelar(temporizadorVibracion)
    if (!sonaba) return
    if (typeof navegador.vibrate === 'function') vibrar(0)
    try {
      if (navegador.audioSession) navegador.audioSession.type = 'auto'
    } catch {
      /* ídem */
    }
    try {
      audio?.suspender()
    } catch {
      /* ídem */
    }
  }
  function marcarSonido(idCliente: string, suena: boolean): void {
    if (destruido || !alerta || alerta.idCliente !== idCliente || alerta.restaurada || alerta.campos.sonido !== null) return
    alerta.campos = { ...alerta.campos, sonido: suena }
    subirAlerta(idCliente, alerta.campos, [])
  }

  function anotarRespuesta(a: AlertaInterna, respuesta: RespuestaAlerta, enTelefono: number): void {
    a.respuestas.push({ respuesta, enTelefono })
    a.campos = { ...a.campos, respuestas: transportarRespuestas(a.respuestas), ms_hasta_respuesta: msHastaRespuesta(a.abiertaEn, a.respuestas) }
```

Reemplazá (cerca de la línea 1320):

```ts
  function vencerPregunta(): void {
    const a = alerta
    if (!a || a.estado !== 'pregunta') return
    anotarRespuesta(a, 'sin_respuesta', a.plazo ?? reloj.pared())
    pasarAAyuda(a, 'sin_respuesta')
  }
```

por:

```ts
  function vencerPregunta(): void {
    const a = alerta
    if (!a || a.estado !== 'pregunta') return
    detenerAvisoFisico()
    anotarRespuesta(a, 'sin_respuesta', a.plazo ?? reloj.pared())
    pasarAAyuda(a, 'sin_respuesta')
  }
```

Reemplazá (cerca de la línea 1662):

```ts
    if ((e.key === CLAVE_INTENCION || e.key === null) && e.newValue === null && estaEncendido()) apagarCon('usuario', false)
  }

  function destruir(): void {
    if (destruido) return
    intento++
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
```

por:

```ts
    if ((e.key === CLAVE_INTENCION || e.key === null) && e.newValue === null && estaEncendido()) apagarCon('usuario', false)
  }

  /* ---------- Acciones de la persona ---------- */
  let temporizadorPrueba: number | null = null

  /** Mismo camino que la alerta real y dentro del gesto: resume y el tono sincrónicos destraban el audio. */
  function probarAlerta(): void {
    if (destruido) return
    huboGesto = true
    const a = asegurarAudio()
    try {
      if (navegador.audioSession) navegador.audioSession.type = 'playback'
    } catch {
      /* ídem */
    }
    let cortar: (() => void) | null = null
    if (a) {
      try {
        void a.despertar().catch(() => false)
        cortar = a.tono(MS_PRUEBA_ALERTA)
        audioDestrabado = true
      } catch {
        cortar = null
      }
    }
    vibrar(PATRON_VIBRACION)
    temporizadorPrueba = cancelar(temporizadorPrueba)
    temporizadorPrueba = programar(() => {
      temporizadorPrueba = null
      cortar?.()
      // Si en el medio se abrió una alerta de verdad, su aviso sigue.
      if (alerta?.estado === 'pregunta') return
      vibrar(0)
      try {
        if (navegador.audioSession) navegador.audioSession.type = 'auto'
        audio?.suspender()
      } catch {
        /* ídem */
      }
    }, MS_PRUEBA_ALERTA)
    actualizarDestrabador()
    publicar()
  }

  function destruir(): void {
    if (destruido) return
    intento++
    detenerAvisoFisico()
    dejarDeEscuchar()
    soltarGps()
    soltarPantalla()
```

- [ ] **Step 5: `lib/viaje.ts` (3 de 3): el objeto que devuelve `crearMotorViaje`**

Reemplazá (cerca de la línea 1778):

```ts
    marcarHuboChoque: () => undefined,
    falsaAlarma: () => undefined,
    seguirViaje: () => undefined,
    probarAlerta: () => undefined,
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente: () => undefined,
    borrarRegistros: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_BORRADO }),
```

por:

```ts
    marcarHuboChoque: () => undefined,
    falsaAlarma: () => undefined,
    seguirViaje: () => undefined,
    probarAlerta,
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente: () => undefined,
    borrarRegistros: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_BORRADO }),
```

- [ ] **Step 6: Correr la prueba y verla pasar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   al abrir la alerta: audioSession en playback, despierta el audio sin toque y suena el tono
  ok   vibra con el patrón de la alerta
  ok   y repite la vibración cada 2 s mientras pregunta
  ok   con el audio destrabado por el encendido, la telemetría dice que sonó
  ok   al vencer la cuenta se corta el tono, vibrate(0) y la sesión vuelve a auto
  ok   en ayuda ya no vibra
  ok   aviso físico: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   reanudado sin toque, el audio no suena y la telemetría lo dice
  ok   alerta sin audio destrabado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   probar la alerta suena y vibra dentro del gesto, por el mismo camino que la alerta
  ok   sigue sonando antes del segundo
  ok   a 1 s se corta todo
  ok   y deja el audio destrabado
  ok   probar la alerta: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
42/42 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 8: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Hacer sonar y vibrar la alerta del modo viaje aunque el teléfono esté en silencio

Una alerta que no se nota no sirve. Al abrirse, la sesión de audio pasa a playback (la
sesión automática de un AudioContext queda en ambient y la llave de silencio la enmudece),
el contexto se reanuda sin esperar un toque, suena un tono que sube de volumen al final y el
teléfono vibra cada 2 s mientras pregunta. Si a los 500 ms el audio no quedó andando, la
telemetría guarda sonido: false para calibrar. «Probar la alerta» usa el mismo camino dentro
del gesto, y de paso destraba el audio.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Respuestas, `hubo_choque`, `ayuda`, golpe pendiente, persistencia y restauración tras recarga

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V7]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V7]`

**Interfaces:**
- Consumes:
  - `estaDetenido(lecturas, desdeMono, hastaMono, umbrales)` y `velocidadMedia(lecturas, desdeMono, hastaMono)` (F2), con `detector.lecturas()`.
  - De las Tareas 7 y 8: `alertaPorDeteccion`, `abrirAlerta`, `anotarRespuesta`, `pasarAAyuda`, `subirAlerta`, `camposConocidos`, `revisarPlazo`, `programarCuenta`, `armar`, `iniciarAvisoFisico`, `detenerAvisoFisico`, `tomarIdsDelServidor`. De la Tarea 5: `alCambiarAlmacenamiento`, `alVolverVisible`.
- Produces:
  - `responder(respuesta)`: en `pregunta`, `estoy_bien` → `hubo_choque` con `plazo = ahora + 60 000` si `estaDetenido(lecturas, ahora − 10 000, ahora, umbrales) !== false`, o cierra dejando golpe pendiente si el auto anda; `necesito_ayuda` → `ayuda` con `origenAyuda: 'necesito_ayuda'` y la ubicación del último fix. En `ayuda` o `hubo_choque`, `necesito_ayuda` sólo se registra si todavía no hubo respuesta humana. Sincrónico.
  - `marcarHuboChoque(hubo)`: sólo en `hubo_choque`; `true` deja la alerta abierta con `hubo_choque = true`, `false` la cierra sin golpe pendiente. `falsaAlarma()`: `estoy_bien` + `hubo_choque = false`, cierra y borra el golpe pendiente. `descartarGolpePendiente()`: `hubo_choque = false` (y `estoy_bien` si no había respuesta humana) en su alerta y lo borra.
  - `estado().golpePendiente` y `acta:golpe-pendiente` `{ telemetriaIdCliente, telemetriaId?, ocurridoEn }`: se crea al cerrar con golpe (estoy bien en movimiento, `hubo_choque` vencido, alerta en `hubo_choque` reemplazada por otra, ayuda reducida porque el auto anda a 15 km/h o más de media en 30 s); `telemetriaId` se completa al drenar; vence a los 30 min de `ocurridoEn` (revisado cada minuto y al volver visible); otra ventana que lo borra lo saca de ésta.
  - `acta:viaje:alerta` en los tres estados, y restauración al crearse el motor con las reglas del índice: `pregunta` en plazo vuelve con la misma cuenta y su aviso físico; vencida pasa a `sin_respuesta` (con `enTelefono = plazo`) y `ayuda`; `hubo_choque` en plazo vuelve y fuera de plazo deja golpe pendiente; `ayuda` vuelve si pasaron menos de 30 min desde `ayudaDesde` y no hay `estoy_bien`; en cualquier otro caso se borra.
  - Internas: `cerrarAlerta(conGolpe)`, `autoDetenidoOSinVelocidad()`, `revisarAyudaEnMovimiento(mono)`, `guardarAlertaViva()`, `crearGolpePendiente(idCliente, idServidor, ocurridoEn)`, `guardarGolpe()`, `borrarGolpePendiente()`, `programarVencimientoGolpe()`, `restaurarGolpe()`, `respuestasGuardadas(v)`, `camposRestaurados(a)` y `restaurarAlerta()`.

**Decisiones de esta tarea:**

- Tras una recarga el motor no tiene los `CamposAlerta` que ya viajaron: `camposRestaurados` los rearma con lo guardado (`nivel_cliente: 'nada'`, `sonido: null`, `gps: null`, `hz_medido: null`) y el servidor conserva lo que ya tenía, porque su fusión toma el nivel mayor, el sonido y el GPS no nulos y la primera respuesta.
- Una alerta restaurada en `pregunta` no absorbe episodios nuevos: se registran aparte (ver «Desvíos respecto del índice»).
- `descartarGolpePendiente` sobre un golpe cuya alerta ya no está en memoria (recarga) responde por `POST /api/telemetria/<telemetriaId>/respuesta` con `{ respuesta: 'estoy_bien', hubo_choque: false, en_telefono }`; sin `telemetriaId` sólo lo borra del teléfono.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V7]` los bloques de respuestas, golpe pendiente, ayuda, sin red y recargas.

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V7]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Respuestas (§3.3–§3.5): hubo_choque, golpe pendiente, ayuda, persistencia y restauración */
  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const { falsas, motor } = await encendido()
    const mapa = falsas.almacenamiento.mapa
    await chocar(falsas)
    await falsas.reloj.avanzar(600)
    const id = motor.estado().alerta.idCliente
    motor.responder('estoy_bien')
    const pregunta = motor.estado().alerta
    verificar('«Estoy bien» sin velocidad confiable pasa a «¿Hubo un choque?» con 60 s', pregunta?.estado === 'hubo_choque' && pregunta.plazo === falsas.reloj.pared() + 60_000 && pregunta.respondida)
    verificar('en hubo_choque no suena ni vibra', !falsas.audio.sonando && falsas.vibracion.patrones.at(-1) === 0)
    motor.responder('necesito_ayuda')
    verificar('en hubo_choque, necesito_ayuda no se registra si ya hubo respuesta humana', motor.estado().alerta.respuestas.length === 1 && motor.estado().alerta.estado === 'hubo_choque')
    verificar('la alerta viva se guarda en sus tres estados', JSON.parse(mapa.get('acta:viaje:alerta')).estado === 'hubo_choque')
    await falsas.reloj.avanzar(60_000)
    const cerrada = motor.estado()
    verificar('sin respuesta en 60 s se cierra y queda golpe pendiente', cerrada.alerta === null && cerrada.golpePendiente?.telemetriaIdCliente === id && !mapa.has('acta:viaje:alerta'))
    verificar('el golpe pendiente se guarda con su hora', JSON.parse(mapa.get('acta:golpe-pendiente')).ocurridoEn === cerrada.golpePendiente.ocurridoEn)
    await motor.drenarCola()
    verificar('al subir la alerta el golpe pendiente toma el id del servidor', /^TEL-/.test(motor.estado().golpePendiente?.telemetriaId ?? '') && JSON.parse(mapa.get('acta:golpe-pendiente')).telemetriaId === motor.estado().golpePendiente.telemetriaId)
    terminar('hubo choque sin respuesta', motor, falsas)

    const recarga = crearFuentesFalsas({ almacenamiento: mapa, servidor: falsas.servidor, inicioPared: falsas.reloj.pared() + 5000 })
    const motorRecarga = crearMotorViaje(recarga.fuentes)
    verificar('el golpe pendiente sobrevive a la recarga', motorRecarga.estado().golpePendiente?.telemetriaIdCliente === id)
    motorRecarga.cambiarRuta('/')
    await recarga.reloj.avanzar(0)
    recarga.movimiento.emitir(quieta(recarga.reloj.mono()))
    await recarga.reloj.avanzar(0)
    motorRecarga.apagar('usuario')
    verificar('y al apagado', motorRecarga.estado().fase === 'apagado' && motorRecarga.estado().golpePendiente?.telemetriaIdCliente === id)
    motorRecarga.descartarGolpePendiente()
    await recarga.reloj.avanzar(0)
    verificar('«No, fue una falsa alarma» lo borra y marca hubo_choque = false en su alerta', motorRecarga.estado().golpePendiente === null && !mapa.has('acta:golpe-pendiente') && falsas.servidor.alertas.get(id)?.hubo_choque === false)
    terminar('golpe pendiente recargado', motorRecarga, recarga)
  }

  {
    const { falsas, motor } = await encendido()
    await chocar(falsas)
    await falsas.reloj.avanzar(600)
    const id = motor.estado().alerta.idCliente
    const desde = falsas.reloj.mono()
    await falsas.reproducir([], trayecto([[11, 40]], desde, falsas.reloj.pared()))
    motor.responder('estoy_bien')
    const e = motor.estado()
    verificar('«Estoy bien» en movimiento: se cierra y queda golpe pendiente', e.alerta === null && e.golpePendiente?.telemetriaIdCliente === id)
    motor.descartarGolpePendiente()
    await motor.drenarCola()
    const enServidor = falsas.servidor.alertas.get(id)
    verificar('descartar el golpe pendiente sube hubo_choque = false con la respuesta', enServidor?.hubo_choque === false && enServidor.respuesta === 'estoy_bien')
    terminar('estoy bien en movimiento', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await chocar(falsas)
    await falsas.reloj.avanzar(600)
    await falsas.reproducir([], trayecto([[11, 0]], falsas.reloj.mono(), falsas.reloj.pared()))
    motor.responder('estoy_bien')
    verificar('«Estoy bien» con el auto detenido (GPS a 0 km/h) también pregunta «¿Hubo un choque?»', motor.estado().alerta?.estado === 'hubo_choque' && motor.estado().golpePendiente === null)
    terminar('estoy bien detenido', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await chocar(falsas)
    await falsas.reloj.avanzar(600)
    const primera = motor.estado().alerta.idCliente
    motor.responder('estoy_bien')
    await chocar(falsas)
    const e = motor.estado()
    verificar('un choque nuevo con «¿Hubo un choque?» abierto la cierra con golpe pendiente y abre otra pregunta', e.alerta?.estado === 'pregunta' && e.alerta.idCliente !== primera && e.golpePendiente?.telemetriaIdCliente === primera)
    terminar('hubo choque reemplazada', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await falsas.reproducir([], trayecto([[3, 0]], falsas.reloj.mono(), falsas.reloj.pared()))
    await chocar(falsas)
    await falsas.reloj.avanzar(600)
    motor.responder('necesito_ayuda')
    const ayuda = motor.estado().alerta
    verificar('«Necesito ayuda» pasa a ayuda sin plazo, con la ubicación del último fix', ayuda?.estado === 'ayuda' && ayuda.origenAyuda === 'necesito_ayuda' && ayuda.plazo === null && ayuda.restanteS === null && ayuda.ubicacion?.lat === -34.6037)
    motor.responder('necesito_ayuda')
    verificar('tocar un tel: con respuesta humana previa no agrega otra', motor.estado().alerta.respuestas.length === 1)
    await falsas.reproducir([], trayecto([[31, 40]], falsas.reloj.mono(), falsas.reloj.pared()))
    const reducida = motor.estado()
    verificar('con la ayuda abierta y 30 s a más de 15 km/h, la capa se reduce a golpe pendiente', reducida.alerta === null && reducida.golpePendiente?.telemetriaIdCliente === ayuda.idCliente)
    terminar('ayuda que vuelve a andar', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await chocar(falsas)
    await falsas.reloj.avanzar(31_000)
    const id = motor.estado().alerta.idCliente
    motor.responder('necesito_ayuda')
    verificar('en ayuda por sin_respuesta, tocar un tel: registra necesito_ayuda una vez', motor.estado().alerta.respuestas.map((r) => r.respuesta).join() === 'sin_respuesta,necesito_ayuda' && motor.estado().alerta.origenAyuda === 'sin_respuesta')
    await motor.drenarCola()
    const enServidor = falsas.servidor.alertas.get(id)
    verificar('las dos respuestas viajan en orden y gana la humana', enServidor?.respuesta === 'necesito_ayuda' && enServidor.respuestas.length === 2)
    motor.falsaAlarma()
    await motor.drenarCola()
    verificar('«Estoy bien, fue una falsa alarma»: estoy_bien, hubo_choque = false, cierra y no deja golpe pendiente', motor.estado().alerta === null && motor.estado().golpePendiente === null && enServidor.respuesta === 'estoy_bien' && enServidor.hubo_choque === false)
    terminar('falsa alarma', motor, falsas)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const servidor = crearServidorFalso()
    const { falsas, motor } = await encendido({ servidor })
    const mapa = falsas.almacenamiento.mapa
    servidor.enLinea = false
    await chocar(falsas)
    const id = motor.estado().alerta.idCliente
    await falsas.reloj.avanzar(31_000)
    verificar('sin red y vence la cuenta: ayuda, sin errores', motor.estado().alerta?.estado === 'ayuda' && motor.estado().alerta.origenAyuda === 'sin_respuesta')
    verificar('la ayuda queda guardada para una recarga', JSON.parse(mapa.get('acta:viaje:alerta')).estado === 'ayuda')
    terminar('sin red', motor, falsas)
    const recarga = crearFuentesFalsas({ almacenamiento: mapa, servidor, inicioPared: falsas.reloj.pared() + 10_000 })
    const motorRecarga = crearMotorViaje(recarga.fuentes)
    verificar('recarga: vuelve la ayuda', motorRecarga.estado().alerta?.estado === 'ayuda' && motorRecarga.estado().alerta.idCliente === id)
    servidor.enLinea = true
    await recarga.reloj.avanzar(301_000)
    await motorRecarga.drenarCola()
    const subidas = alertasDe(servidor)
    verificar('vuelve la red: una sola alerta en el servidor, con la respuesta', subidas.length === 1 && subidas[0].campos.id_cliente === id && subidas[0].respuesta === 'sin_respuesta')
    terminar('sin red recargado', motorRecarga, recarga)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const { falsas, motor } = await encendido()
    const mapa = falsas.almacenamiento.mapa
    await chocar(falsas)
    const alerta = motor.estado().alerta
    terminar('pregunta antes de recargar', motor, falsas)
    const dentro = crearFuentesFalsas({ almacenamiento: new Map(mapa), inicioPared: alerta.abiertaEn + 10_000 })
    const motorDentro = crearMotorViaje(dentro.fuentes)
    verificar('recarga con la pregunta en plazo: vuelve la pregunta con la misma cuenta', motorDentro.estado().alerta?.estado === 'pregunta' && motorDentro.estado().alerta.plazo === alerta.plazo && motorDentro.estado().alerta.restanteS === 20)
    terminar('pregunta recargada', motorDentro, dentro)
    const fuera = crearFuentesFalsas({ almacenamiento: new Map(mapa), inicioPared: alerta.abiertaEn + 40_000 })
    const motorFuera = crearMotorViaje(fuera.fuentes)
    verificar('recarga con la pregunta vencida: sin_respuesta y ayuda', motorFuera.estado().alerta?.estado === 'ayuda' && motorFuera.estado().alerta.respuestas.at(-1)?.respuesta === 'sin_respuesta' && motorFuera.estado().alerta.respuestas.at(-1)?.enTelefono === alerta.plazo)
    terminar('pregunta vencida recargada', motorFuera, fuera)
    const vieja = new Map(mapa)
    vieja.set('acta:viaje:alerta', JSON.stringify({ ...JSON.parse(mapa.get('acta:viaje:alerta')), estado: 'ayuda', plazo: null, ayudaDesde: alerta.abiertaEn, origenAyuda: 'sin_respuesta' }))
    const tarde = crearFuentesFalsas({ almacenamiento: vieja, inicioPared: alerta.abiertaEn + 31 * 60_000 })
    const motorTarde = crearMotorViaje(tarde.fuentes)
    verificar('una ayuda de más de 30 minutos no vuelve', motorTarde.estado().alerta === null && !vieja.has('acta:viaje:alerta'))
    terminar('ayuda vieja', motorTarde, tarde)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Con los métodos vacíos de la Tarea 3, «Estoy bien» no cambia nada y la alerta nunca se guarda: la primera excepción corta la sección al leer `acta:viaje:alerta`. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA «Estoy bien» sin velocidad confiable pasa a «¿Hubo un choque?» con 60 s 
  FALLA en hubo_choque no suena ni vibra 
  FALLA en hubo_choque, necesito_ayuda no se registra si ya hubo respuesta humana 
  FALLA [V7] terminó sin excepciones SyntaxError: "undefined" is not valid JSON
```

y al final:

```text
42/46 verificaciones pasaron
4 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 5): dentro de `tic`; dentro de `tomarIdsDelServidor`; dentro de `alertaPorDeteccion`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 997):

```ts
    precisionM = r.precisionM === null ? null : Math.round(r.precisionM)
    if (r.enMovimiento === true) ultimoMovimiento = pared
    diagnosticoActivo = leerDiagnostico()
    revisarLoteConduccion(pared)
    publicar()
  }
```

por:

```ts
    precisionM = r.precisionM === null ? null : Math.round(r.precisionM)
    if (r.enMovimiento === true) ultimoMovimiento = pared
    diagnosticoActivo = leerDiagnostico()
    revisarAyudaEnMovimiento(mono)
    revisarLoteConduccion(pared)
    publicar()
  }
```

Reemplazá (cerca de la línea 1057):

```ts
  async function tomarIdsDelServidor(): Promise<void> {
    const ids = new Set<string>()
    if (alerta && alerta.idServidor === null) ids.add(alerta.idCliente)
    for (const id of ids) {
      const deServidor = await fuentes.cola.idServidor(id)
      if (!deServidor || destruido) continue
      if (alerta && alerta.idCliente === id && alerta.idServidor === null) {
        alerta.idServidor = deServidor
      }
    }
    publicar()
```

por:

```ts
  async function tomarIdsDelServidor(): Promise<void> {
    const ids = new Set<string>()
    if (alerta && alerta.idServidor === null) ids.add(alerta.idCliente)
    if (golpePendiente && golpePendiente.telemetriaId === null) ids.add(golpePendiente.telemetriaIdCliente)
    for (const id of ids) {
      const deServidor = await fuentes.cola.idServidor(id)
      if (!deServidor || destruido) continue
      if (alerta && alerta.idCliente === id && alerta.idServidor === null) {
        alerta.idServidor = deServidor
        guardarAlertaViva()
      }
      if (golpePendiente && golpePendiente.telemetriaIdCliente === id && golpePendiente.telemetriaId === null) {
        golpePendiente = { ...golpePendiente, telemetriaId: deServidor }
        guardarGolpe()
      }
    }
    publicar()
```

Reemplazá (cerca de la línea 1132):

```ts
  function alertaPorDeteccion(e: EventoDeAlerta): void {
    const apertura = e.tipo === 'seguimiento' ? 'seguimiento' : 'episodio'
    const mostrar = configuracion.alerta === 'normal' && !configuracion.desactualizado
    if (!mostrar || alerta?.estado === 'ayuda') {
      registrarAlertaSilenciosa(e, apertura)
      return
    }
```

por:

```ts
  function alertaPorDeteccion(e: EventoDeAlerta): void {
    const apertura = e.tipo === 'seguimiento' ? 'seguimiento' : 'episodio'
    const mostrar = configuracion.alerta === 'normal' && !configuracion.desactualizado
    if (!mostrar || alerta?.estado === 'ayuda' || (alerta?.estado === 'pregunta' && alerta.restaurada)) {
      registrarAlertaSilenciosa(e, apertura)
      return
    }
```

- [ ] **Step 4: `lib/viaje.ts` (2 de 5): dentro de `alertaPorDeteccion`; dentro de `abrirAlerta`; dentro de `revisarPlazo`**

Reemplazá (cerca de la línea 1140):

```ts
      agregarEpisodio(alerta, e)
      return
    }
    abrirAlerta(e, apertura)
  }
```

por:

```ts
      agregarEpisodio(alerta, e)
      return
    }
    if (alerta?.estado === 'hubo_choque') cerrarAlerta(true)
    abrirAlerta(e, apertura)
  }
```

Reemplazá (cerca de la línea 1212):

```ts
    // Con una alerta en pantalla la pregunta de inactividad no se muestra, y el viaje cuenta desde acá.
    inactividad = null
    ultimoMovimiento = pared
    subirAlerta(idCliente, campos, [codificarEpisodio(1, e.ocurridoEn, e.episodio, e.veredicto)])
    armar()
    programarCuenta()
```

por:

```ts
    // Con una alerta en pantalla la pregunta de inactividad no se muestra, y el viaje cuenta desde acá.
    inactividad = null
    ultimoMovimiento = pared
    guardarAlertaViva()
    subirAlerta(idCliente, campos, [codificarEpisodio(1, e.ocurridoEn, e.episodio, e.veredicto)])
    armar()
    programarCuenta()
```

Reemplazá (cerca de la línea 1253):

```ts
    const pared = reloj.pared()
    if (pared >= alerta.plazo) {
      if (alerta.estado === 'pregunta') vencerPregunta()
      return
    }
    const restante = Math.ceil((alerta.plazo - pared) / 1000)
```

por:

```ts
    const pared = reloj.pared()
    if (pared >= alerta.plazo) {
      if (alerta.estado === 'pregunta') vencerPregunta()
      else if (alerta.estado === 'hubo_choque') cerrarAlerta(true)
      return
    }
    const restante = Math.ceil((alerta.plazo - pared) / 1000)
```

- [ ] **Step 5: `lib/viaje.ts` (3 de 5): sección «Golpe pendiente» (12 funciones)**

Reemplazá (cerca de la línea 1343):

```ts
    a.ayudaDesde = reloj.pared()
    if (ultimoFix) a.ubicacion = { ...ultimoFix }
    temporizadorCuenta = cancelar(temporizadorCuenta)
    subirAlerta(a.idCliente, a.campos, [])
    publicar()
  }

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null
```

por:

```ts
    a.ayudaDesde = reloj.pared()
    if (ultimoFix) a.ubicacion = { ...ultimoFix }
    temporizadorCuenta = cancelar(temporizadorCuenta)
    guardarAlertaViva()
    subirAlerta(a.idCliente, a.campos, [])
    publicar()
  }

  /** Con golpe: el golpe queda pendiente para registrarlo después (§3.5). */
  function cerrarAlerta(conGolpe: boolean): void {
    const a = alerta
    if (!a) return
    detenerAvisoFisico()
    temporizadorCuenta = cancelar(temporizadorCuenta)
    temporizadorArmado = cancelar(temporizadorArmado)
    camposConocidos.set(a.idCliente, a.campos)
    alerta = null
    borrarClave(CLAVE_ALERTA)
    ultimoMovimiento = reloj.pared()
    if (conGolpe) crearGolpePendiente(a.idCliente, a.idServidor, a.ocurridoEn)
    actualizarDestrabador()
    publicar()
  }

  function autoDetenidoOSinVelocidad(): boolean {
    const mono = reloj.mono()
    return estaDetenido(detector.lecturas(), mono - MS_DETENIDO, mono, configuracion.umbrales) !== false
  }

  function responder(respuesta: 'estoy_bien' | 'necesito_ayuda'): void {
    const a = alerta
    if (destruido || !a) return
    const pared = reloj.pared()
    if (a.estado === 'pregunta') {
      detenerAvisoFisico()
      anotarRespuesta(a, respuesta, pared)
      if (respuesta === 'necesito_ayuda') {
        pasarAAyuda(a, 'necesito_ayuda')
        return
      }
      if (!autoDetenidoOSinVelocidad()) {
        subirAlerta(a.idCliente, a.campos, [])
        cerrarAlerta(true)
        return
      }
      a.estado = 'hubo_choque'
      a.plazo = pared + MS_HUBO_CHOQUE
      a.restanteS = Math.ceil(MS_HUBO_CHOQUE / 1000)
      guardarAlertaViva()
      subirAlerta(a.idCliente, a.campos, [])
      programarCuenta()
      publicar()
      return
    }
    // Tocar un tel: en la ayuda es una respuesta humana, pero no pisa la que ya hubo.
    if (respuesta === 'necesito_ayuda' && !a.respuestas.some(humana)) {
      anotarRespuesta(a, 'necesito_ayuda', pared)
      guardarAlertaViva()
      subirAlerta(a.idCliente, a.campos, [])
      publicar()
    }
  }

  function marcarHuboChoque(hubo: boolean): void {
    const a = alerta
    if (destruido || !a || a.estado !== 'hubo_choque') return
    a.huboChoque = hubo
    a.campos = { ...a.campos, hubo_choque: hubo }
    subirAlerta(a.idCliente, a.campos, [])
    if (!hubo) {
      cerrarAlerta(false)
      return
    }
    guardarAlertaViva()
    publicar()
  }

  function falsaAlarma(): void {
    const a = alerta
    if (destruido || !a) return
    anotarRespuesta(a, 'estoy_bien', reloj.pared())
    a.huboChoque = false
    a.campos = { ...a.campos, hubo_choque: false }
    subirAlerta(a.idCliente, a.campos, [])
    cerrarAlerta(false)
    borrarGolpePendiente()
  }

  /** §3.4: si el auto vuelve a andar con la ayuda abierta, no se le tapa la pantalla a quien maneja. */
  function revisarAyudaEnMovimiento(mono: number): void {
    if (!alerta || alerta.estado !== 'ayuda') return
    const media = velocidadMedia(detector.lecturas(), mono - MS_MEDIA_SIGUIO, mono)
    if (media !== null && media >= KMH_SIGUIO) cerrarAlerta(true)
  }

  function guardarAlertaViva(): void {
    const a = alerta
    if (!a) {
      borrarClave(CLAVE_ALERTA)
      return
    }
    escribirJson(CLAVE_ALERTA, {
      estado: a.estado,
      idCliente: a.idCliente,
      idServidor: a.idServidor,
      plazo: a.plazo,
      ocurridoEn: a.ocurridoEn,
      abiertaEn: a.abiertaEn,
      ayudaDesde: a.ayudaDesde,
      apertura: a.apertura,
      origenAyuda: a.origenAyuda,
      respuestas: a.respuestas,
      huboChoque: a.huboChoque,
      ubicacion: a.ubicacion,
    })
  }

  /* ---------- Golpe pendiente ---------- */
  let temporizadorGolpe: number | null = null

  function crearGolpePendiente(idCliente: string, idServidor: string | null, ocurridoEn: number): void {
    if (reloj.pared() - ocurridoEn >= MS_GOLPE_VIGENTE) return
    golpePendiente = { telemetriaIdCliente: idCliente, telemetriaId: idServidor, ocurridoEn }
    inactividad = null
    guardarGolpe()
    programarVencimientoGolpe()
    publicar()
  }
  function guardarGolpe(): void {
    const g = golpePendiente
    if (!g) {
      borrarClave(CLAVE_GOLPE)
      return
    }
    escribirJson(CLAVE_GOLPE, g.telemetriaId === null ? { telemetriaIdCliente: g.telemetriaIdCliente, ocurridoEn: g.ocurridoEn } : g)
  }
  function borrarGolpePendiente(): void {
    temporizadorGolpe = cancelar(temporizadorGolpe)
    if (!golpePendiente) return
    golpePendiente = null
    borrarClave(CLAVE_GOLPE)
    publicar()
  }
  /** Vence por pared a los 30 minutos: se revisa cada minuto porque el equipo pudo haber dormido. */
  function programarVencimientoGolpe(): void {
    temporizadorGolpe = cancelar(temporizadorGolpe)
    if (!golpePendiente) return
    const falta = golpePendiente.ocurridoEn + MS_GOLPE_VIGENTE - reloj.pared()
    if (falta <= 0) {
      borrarGolpePendiente()
      return
    }
    temporizadorGolpe = programar(() => {
      temporizadorGolpe = null
      programarVencimientoGolpe()
    }, Math.min(falta, MINUTO))
  }

  function descartarGolpePendiente(): void {
    const g = golpePendiente
    if (destruido || !g) return
    const pared = reloj.pared()
    const campos = camposConocidos.get(g.telemetriaIdCliente)
    if (campos) {
      const respuestas = campos.respuestas.some(humana) ? campos.respuestas : [...campos.respuestas, { respuesta: 'estoy_bien' as const, en_telefono: iso(pared) }].slice(-MAX_RESPUESTAS_TRANSPORTE)
      const actualizados: CamposAlerta = { ...campos, respuestas, hubo_choque: false }
      camposConocidos.set(g.telemetriaIdCliente, actualizados)
      subirAlerta(g.telemetriaIdCliente, actualizados, [])
    } else if (g.telemetriaId !== null) {
      // Tras una recarga el motor ya no tiene los campos: la respuesta va directo por el id del servidor.
      void fuentes
        .fetch(`/api/telemetria/${encodeURIComponent(g.telemetriaId)}/respuesta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ respuesta: 'estoy_bien', hubo_choque: false, en_telefono: iso(pared) }),
        })
        .catch(() => undefined)
    }
    borrarGolpePendiente()
  }

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null
```

- [ ] **Step 6: `lib/viaje.ts` (4 de 5): dentro de `alVolverVisible`; sección «Restauración»: `restaurarGolpe`, `respuestasGuardadas`, `camposRestaurados`, `restaurarAlerta`; sección «Arranque»**

Reemplazá (cerca de la línea 1828):

```ts
    }
    if (fase === 'otra_ventana') reintentarCandado()
    revisarPlazo()
    alCambiarAudio()
    actualizarDestrabador()
    publicar()
```

por:

```ts
    }
    if (fase === 'otra_ventana') reintentarCandado()
    revisarPlazo()
    programarVencimientoGolpe()
    alCambiarAudio()
    actualizarDestrabador()
    publicar()
```

Reemplazá (cerca de la línea 1845):

```ts
    if (destruido) return
    const e = evento as unknown as { key: string | null; newValue: string | null }
    if ((e.key === CLAVE_INTENCION || e.key === null) && e.newValue === null && estaEncendido()) apagarCon('usuario', false)
  }

  /* ---------- Acciones de la persona ---------- */
```

por:

```ts
    if (destruido) return
    const e = evento as unknown as { key: string | null; newValue: string | null }
    if ((e.key === CLAVE_INTENCION || e.key === null) && e.newValue === null && estaEncendido()) apagarCon('usuario', false)
    if ((e.key === CLAVE_GOLPE || e.key === null) && e.newValue === null && golpePendiente) {
      temporizadorGolpe = cancelar(temporizadorGolpe)
      golpePendiente = null
      publicar()
    }
  }

  /* ---------- Restauración ---------- */
  function restaurarGolpe(): void {
    const g = leerJson(CLAVE_GOLPE)
    if (!esObjeto(g) || !esTexto(g.telemetriaIdCliente) || !esNumero(g.ocurridoEn) || reloj.pared() - g.ocurridoEn >= MS_GOLPE_VIGENTE) {
      borrarClave(CLAVE_GOLPE)
      return
    }
    golpePendiente = { telemetriaIdCliente: g.telemetriaIdCliente, telemetriaId: esTexto(g.telemetriaId) ? g.telemetriaId : null, ocurridoEn: g.ocurridoEn }
    programarVencimientoGolpe()
  }

  function respuestasGuardadas(v: unknown): Array<{ respuesta: RespuestaAlerta; enTelefono: number }> {
    if (!Array.isArray(v)) return []
    return v.flatMap((r: unknown) =>
      esObjeto(r) && (r.respuesta === 'estoy_bien' || r.respuesta === 'necesito_ayuda' || r.respuesta === 'sin_respuesta') && esNumero(r.enTelefono)
        ? [{ respuesta: r.respuesta, enTelefono: r.enTelefono }]
        : [],
    )
  }

  /**
   * Tras una recarga el motor no tiene los campos que ya viajaron: los rearma con lo guardado. El servidor
   * conserva lo que ya tenía (nivel mayor, sonido y gps no nulos, primera respuesta); Hz y fuente quedan sin dato.
   */
  function camposRestaurados(a: Omit<AlertaInterna, 'campos' | 'episodios' | 'restaurada'>): CamposAlerta {
    return {
      id_cliente: a.idCliente,
      aviso_version: AVISO_DATOS_VERSION,
      version_motor: VERSION_MOTOR,
      plataforma,
      standalone: fuentes.standalone,
      ocurrido_en_telefono: iso(a.ocurridoEn),
      enviado_en: iso(reloj.pared()),
      apertura: a.apertura,
      nivel_cliente: 'nada',
      alerta_mostrada: true,
      sonido: null,
      respuestas: transportarRespuestas(a.respuestas),
      hubo_choque: a.huboChoque,
      ms_hasta_respuesta: msHastaRespuesta(a.abiertaEn, a.respuestas),
      hz_medido: null,
      aceleracion_derivada: false,
      gps: null,
      umbrales_cliente: { ...configuracion.umbrales },
    }
  }

  function restaurarAlerta(): void {
    const g = leerJson(CLAVE_ALERTA)
    const estados = ['pregunta', 'hubo_choque', 'ayuda']
    if (
      !esObjeto(g) ||
      !estados.includes(String(g.estado)) ||
      !esTexto(g.idCliente) ||
      !esNumero(g.ocurridoEn) ||
      !esNumero(g.abiertaEn) ||
      (g.apertura !== 'episodio' && g.apertura !== 'seguimiento')
    ) {
      borrarClave(CLAVE_ALERTA)
      return
    }
    const pared = reloj.pared()
    const ubicacion = esObjeto(g.ubicacion) && esNumero(g.ubicacion.lat) && esNumero(g.ubicacion.lon) ? { lat: g.ubicacion.lat, lon: g.ubicacion.lon } : null
    const base: Omit<AlertaInterna, 'campos' | 'episodios' | 'restaurada'> = {
      estado: g.estado as AlertaInterna['estado'],
      idCliente: g.idCliente,
      idServidor: esTexto(g.idServidor) ? g.idServidor : null,
      plazo: esNumero(g.plazo) ? g.plazo : null,
      restanteS: null,
      ocurridoEn: g.ocurridoEn,
      abiertaEn: g.abiertaEn,
      ayudaDesde: esNumero(g.ayudaDesde) ? g.ayudaDesde : null,
      apertura: g.apertura as AlertaInterna['apertura'],
      origenAyuda: g.origenAyuda === 'necesito_ayuda' || g.origenAyuda === 'sin_respuesta' ? g.origenAyuda : null,
      respuestas: respuestasGuardadas(g.respuestas),
      huboChoque: typeof g.huboChoque === 'boolean' ? g.huboChoque : null,
      armada: false,
      ubicacion,
    }
    const a: AlertaInterna = { ...base, campos: camposRestaurados(base), episodios: 0, restaurada: true }

    if (a.estado === 'pregunta' && a.plazo !== null) {
      alerta = a
      if (pared >= a.plazo) {
        anotarRespuesta(a, 'sin_respuesta', a.plazo)
        pasarAAyuda(a, 'sin_respuesta')
      } else {
        a.restanteS = Math.ceil((a.plazo - pared) / 1000)
        programarCuenta()
        iniciarAvisoFisico()
      }
      armar()
      return
    }
    if (a.estado === 'hubo_choque' && a.plazo !== null) {
      if (pared < a.plazo) {
        alerta = a
        a.restanteS = Math.ceil((a.plazo - pared) / 1000)
        programarCuenta()
        armar()
        return
      }
      borrarClave(CLAVE_ALERTA)
      crearGolpePendiente(a.idCliente, a.idServidor, a.ocurridoEn)
      return
    }
    if (a.estado === 'ayuda' && a.ayudaDesde !== null && pared - a.ayudaDesde < MS_AYUDA_VIGENTE && !a.respuestas.some((r) => r.respuesta === 'estoy_bien')) {
      alerta = a
      armar()
      return
    }
    borrarClave(CLAVE_ALERTA)
  }

  /* ---------- Acciones de la persona ---------- */
```

Reemplazá (cerca de la línea 2048):

```ts
    motivoNoSoportado = 'sin_sensores'
  }
  diagnosticoActivo = leerDiagnostico()
  if (fase !== 'no_soportado') {
    const guardada = leerIntencion()
    if (guardada && reloj.pared() - guardada.ultimoLatido < MS_INTENCION_VIGENTE) {
```

por:

```ts
    motivoNoSoportado = 'sin_sensores'
  }
  diagnosticoActivo = leerDiagnostico()
  restaurarGolpe()
  restaurarAlerta()
  if (fase !== 'no_soportado') {
    const guardada = leerIntencion()
    if (guardada && reloj.pared() - guardada.ultimoLatido < MS_INTENCION_VIGENTE) {
```

- [ ] **Step 7: `lib/viaje.ts` (5 de 5): el objeto que devuelve `crearMotorViaje`**

Reemplazá (cerca de la línea 2080):

```ts
    tocar,
    activarGps: () => undefined,
    cambiarRuta,
    responder: () => undefined,
    marcarHuboChoque: () => undefined,
    falsaAlarma: () => undefined,
    seguirViaje: () => undefined,
    probarAlerta,
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente: () => undefined,
    borrarRegistros: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_BORRADO }),
    drenarCola,
    destruir,
```

por:

```ts
    tocar,
    activarGps: () => undefined,
    cambiarRuta,
    responder,
    marcarHuboChoque,
    falsaAlarma,
    seguirViaje: () => undefined,
    probarAlerta,
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente,
    borrarRegistros: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_BORRADO }),
    drenarCola,
    destruir,
```

- [ ] **Step 8: Correr la prueba y verla pasar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   «Estoy bien» sin velocidad confiable pasa a «¿Hubo un choque?» con 60 s
  ok   en hubo_choque no suena ni vibra
  ok   en hubo_choque, necesito_ayuda no se registra si ya hubo respuesta humana
  ok   la alerta viva se guarda en sus tres estados
  ok   sin respuesta en 60 s se cierra y queda golpe pendiente
  ok   el golpe pendiente se guarda con su hora
  ok   al subir la alerta el golpe pendiente toma el id del servidor
  ok   hubo choque sin respuesta: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   el golpe pendiente sobrevive a la recarga
  ok   y al apagado
  ok   «No, fue una falsa alarma» lo borra y marca hubo_choque = false en su alerta
  ok   golpe pendiente recargado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   «Estoy bien» en movimiento: se cierra y queda golpe pendiente
  ok   descartar el golpe pendiente sube hubo_choque = false con la respuesta
  ok   estoy bien en movimiento: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   «Estoy bien» con el auto detenido (GPS a 0 km/h) también pregunta «¿Hubo un choque?»
  ok   estoy bien detenido: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   un choque nuevo con «¿Hubo un choque?» abierto la cierra con golpe pendiente y abre otra pregunta
  ok   hubo choque reemplazada: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   «Necesito ayuda» pasa a ayuda sin plazo, con la ubicación del último fix
  ok   tocar un tel: con respuesta humana previa no agrega otra
  ok   con la ayuda abierta y 30 s a más de 15 km/h, la capa se reduce a golpe pendiente
  ok   ayuda que vuelve a andar: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   en ayuda por sin_respuesta, tocar un tel: registra necesito_ayuda una vez
  ok   las dos respuestas viajan en orden y gana la humana
  ok   «Estoy bien, fue una falsa alarma»: estoy_bien, hubo_choque = false, cierra y no deja golpe pendiente
  ok   falsa alarma: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   sin red y vence la cuenta: ayuda, sin errores
  ok   la ayuda queda guardada para una recarga
  ok   sin red: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   recarga: vuelve la ayuda
  ok   vuelve la red: una sola alerta en el servidor, con la respuesta
  ok   sin red recargado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   pregunta antes de recargar: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   recarga con la pregunta en plazo: vuelve la pregunta con la misma cuenta
  ok   pregunta recargada: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   recarga con la pregunta vencida: sin_respuesta y ayuda
  ok   pregunta vencida recargada: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   una ayuda de más de 30 minutos no vuelve
  ok   ayuda vieja: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
82/82 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 9: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 10: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Registrar las respuestas a la alerta y dejar el golpe pendiente para después

«Estoy bien» con el auto detenido o sin velocidad confiable pregunta si hubo un choque; en
movimiento cierra y deja el golpe pendiente, igual que no contestar esa segunda pregunta en
60 segundos. «Necesito ayuda» o la cuenta vencida pasan a la ayuda sin navegar, y tocar un
teléfono ahí cuenta como respuesta si todavía no había una. Si el auto vuelve a andar con la
ayuda abierta, la capa se reduce al golpe pendiente: no se le tapa la pantalla a quien maneja.

La alerta viva y el golpe pendiente se guardan en el teléfono: una recarga o el cierre de la
aplicación durante una llamada no los pierden.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Inactividad (§4.4)

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V7]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V7]`

**Interfaces:**
- Consumes:
  - `resumen(mono).enMovimiento` (F2; ya actualiza `ultimoMovimiento` desde la Tarea 4) y `velocidadMedia` (F2). `AudioMotor.pulso()` (Tarea 3). De las Tareas 4, 7 y 9: `tic()`, `sonidoListo()`, `escribirIntencion()`, `apagar()`, `alerta`, `golpePendiente`.
- Produces:
  - `estado().inactividad = { preguntandoDesde, vence }` con `vence = preguntandoDesde + 10 min`, a los 15 min de pared sin movimiento, con fase `activo`, en `/` o en una ruta con píldora, sin alerta y sin golpe pendiente; con el audio listo suena `pulso()`. Al vencer: `apagar('inactividad')`.
  - Una media de 30 s ≥ 15 km/h con la pregunta abierta la cierra y deja `siguioPorMovimientoEn`. `seguirViaje(): void` la cierra, vuelve a contar desde ahora y reescribe la intención.
  - `ultimoMovimiento` viaja en `acta:viaje`: al reanudar después de más de 15 min detenido, la pregunta aparece en el primer tic.
  - Interna: `revisarInactividad(mono, pared)`, llamada desde `tic()`.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V7]` los bloques de inactividad. El piquete reproduce 120 s a 50 km/h, 25 min a 0 y 40 s a 50 km/h con fixes cada segundo.

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V7]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Inactividad (§4.4): pregunta a los 15 min sin movimiento, 10 min de plazo, seguir y apagar */
  {
    const { falsas, motor } = await encendido()
    await falsas.reproducir([], trayecto([[120, 50], [25 * 60, 0], [40, 50]], falsas.reloj.mono(), falsas.reloj.pared()))
    const e = motor.estado()
    verificar('piquete de 25 min seguido de 50 km/h: no se apaga', e.fase === 'activo' && e.apagadoPor === null)
    verificar('la pregunta se cerró porque el auto volvió a moverse', e.inactividad === null && e.siguioPorMovimientoEn !== null)
    terminar('piquete', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    const vistas = []
    motor.suscribir(() => vistas.push(motor.estado()))
    const inicio = falsas.reloj.pared()
    await falsas.reloj.avanzar(15 * 60_000 + 1000)
    const pregunta = motor.estado().inactividad
    verificar('a los 15 min sin movimiento pregunta si terminó el viaje, con 10 min de plazo', pregunta !== null && pregunta.preguntandoDesde - inicio <= 15 * 60_000 + 1000 && pregunta.vence === pregunta.preguntandoDesde + 10 * 60_000)
    verificar('con el audio listo suena un pulso corto', falsas.audio.pulsos === 1)
    await falsas.reloj.avanzar(15 * 60_000)
    const e = motor.estado()
    verificar('estacionado 30 min: apagado con motivo inactividad', e.fase === 'apagado' && e.apagadoPor?.motivo === 'inactividad' && e.inactividad === null)
    verificar('antes de apagarse se vio la pregunta', vistas.some((v) => v.inactividad !== null && v.fase === 'activo'))
    terminar('estacionado', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await falsas.reloj.avanzar(15 * 60_000 + 1000)
    verificar('pregunta de inactividad abierta', motor.estado().inactividad !== null)
    motor.seguirViaje()
    verificar('«Seguir» cierra la pregunta y vuelve a contar', motor.estado().inactividad === null && motor.estado().fase === 'activo')
    await falsas.reloj.avanzar(14 * 60_000)
    verificar('y no vuelve a preguntar antes de otros 15 min', motor.estado().inactividad === null)
    await falsas.reloj.avanzar(61_000)
    verificar('pasados otros 15 min vuelve a preguntar', motor.estado().inactividad !== null)
    await chocar(falsas)
    const e = motor.estado()
    verificar('un choque durante la pregunta abre la alerta y la pregunta se va', e.alerta?.estado === 'pregunta' && e.inactividad === null)
    motor.responder('estoy_bien')
    motor.marcarHuboChoque(false)
    await falsas.reloj.avanzar(15 * 60_000 + 1000)
    verificar('con la alerta cerrada sin golpe, la inactividad vuelve a contar desde el cierre', motor.estado().inactividad !== null)
    terminar('seguir y choque durante la pregunta', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    await chocar(falsas)
    motor.responder('estoy_bien')
    await falsas.reloj.avanzar(60_000)
    verificar('queda un golpe pendiente', motor.estado().golpePendiente !== null)
    await falsas.reloj.avanzar(20 * 60_000)
    verificar('con un golpe pendiente la inactividad no empieza', motor.estado().inactividad === null && motor.estado().fase === 'activo')
    await falsas.reloj.avanzar(10 * 60_000)
    verificar('el golpe pendiente vence a los 30 min de ocurrido', motor.estado().golpePendiente === null && !falsas.almacenamiento.mapa.has('acta:golpe-pendiente'))
    terminar('golpe pendiente e inactividad', motor, falsas)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Sin la revisión de inactividad nunca hay pregunta ni apagado; las verificaciones que sólo miran que no se haya apagado pasan. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA la pregunta se cerró porque el auto volvió a moverse 
  FALLA a los 15 min sin movimiento pregunta si terminó el viaje, con 10 min de plazo 
  FALLA con el audio listo suena un pulso corto 
  FALLA estacionado 30 min: apagado con motivo inactividad 
  FALLA antes de apagarse se vio la pregunta 
  FALLA pregunta de inactividad abierta 
  FALLA pasados otros 15 min vuelve a preguntar 
  FALLA con la alerta cerrada sin golpe, la inactividad vuelve a contar desde el cierre 
```

y al final:

```text
93/101 verificaciones pasaron
8 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 1): dentro de `tic`; sección «Inactividad»: `revisarInactividad`, `seguirViaje`; el objeto que devuelve `crearMotorViaje`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 998):

```ts
    if (r.enMovimiento === true) ultimoMovimiento = pared
    diagnosticoActivo = leerDiagnostico()
    revisarAyudaEnMovimiento(mono)
    revisarLoteConduccion(pared)
    publicar()
  }
```

por:

```ts
    if (r.enMovimiento === true) ultimoMovimiento = pared
    diagnosticoActivo = leerDiagnostico()
    revisarAyudaEnMovimiento(mono)
    revisarInactividad(mono, pared)
    revisarLoteConduccion(pared)
    publicar()
  }
```

Reemplazá (cerca de la línea 1522):

```ts
    borrarGolpePendiente()
  }

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null
```

por:

```ts
    borrarGolpePendiente()
  }

  /* ---------- Inactividad ---------- */
  function revisarInactividad(mono: number, pared: number): void {
    if (fase !== 'activo') return
    if (inactividad) {
      const media = velocidadMedia(detector.lecturas(), mono - MS_MEDIA_SIGUIO, mono)
      if (media !== null && media >= KMH_SIGUIO) {
        inactividad = null
        siguioPorMovimientoEn = pared
        ultimoMovimiento = pared
        return
      }
      if (pared >= inactividad.vence) apagar('inactividad')
      return
    }
    // Nunca se apaga solo con una alerta abierta ni sin haber mostrado antes el golpe pendiente.
    if (alerta !== null || golpePendiente !== null) return
    if (!ruta.conPildora && ruta.actual !== '/') return
    if (pared - ultimoMovimiento < MS_INACTIVIDAD) return
    inactividad = { preguntandoDesde: pared, vence: pared + MS_PREGUNTA_INACTIVIDAD }
    if (sonidoListo()) {
      try {
        audio?.pulso()
      } catch {
        /* la pregunta se ve igual */
      }
    }
  }

  function seguirViaje(): void {
    if (destruido || !inactividad) return
    inactividad = null
    ultimoMovimiento = reloj.pared()
    if (fase === 'activo') escribirIntencion()
    publicar()
  }

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null
```

Reemplazá (cerca de la línea 2120):

```ts
    responder,
    marcarHuboChoque,
    falsaAlarma,
    seguirViaje: () => undefined,
    probarAlerta,
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente,
```

por:

```ts
    responder,
    marcarHuboChoque,
    falsaAlarma,
    seguirViaje,
    probarAlerta,
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente,
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   piquete de 25 min seguido de 50 km/h: no se apaga
  ok   la pregunta se cerró porque el auto volvió a moverse
  ok   piquete: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   a los 15 min sin movimiento pregunta si terminó el viaje, con 10 min de plazo
  ok   con el audio listo suena un pulso corto
  ok   estacionado 30 min: apagado con motivo inactividad
  ok   antes de apagarse se vio la pregunta
  ok   estacionado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   pregunta de inactividad abierta
  ok   «Seguir» cierra la pregunta y vuelve a contar
  ok   y no vuelve a preguntar antes de otros 15 min
  ok   pasados otros 15 min vuelve a preguntar
  ok   un choque durante la pregunta abre la alerta y la pregunta se va
  ok   con la alerta cerrada sin golpe, la inactividad vuelve a contar desde el cierre
  ok   seguir y choque durante la pregunta: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   queda un golpe pendiente
  ok   con un golpe pendiente la inactividad no empieza
  ok   el golpe pendiente vence a los 30 min de ocurrido
  ok   golpe pendiente e inactividad: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
101/101 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 6: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Apagar solo el modo viaje cuando el auto quedó estacionado

Un modo viaje olvidado encendido gasta batería y deja la pantalla prendida. A los 15 minutos
sin movimiento pregunta si terminó el viaje, con un pulso corto si el audio está destrabado,
y a los 10 minutos sin respuesta se apaga dejando la hora. Un piquete no lo apaga: si el auto
vuelve a andar a 15 km/h de media, la pregunta se cierra sola. Nunca pregunta con una alerta
abierta ni con un golpe pendiente sin decidir.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Configuración remota (§2.9)

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V7]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V7]`

**Interfaces:**
- Consumes:
  - `GET /api/telemetria/configuracion` (F1) → `{ version, umbrales, alerta, caida_sin_golpe, motor_minimo, dias_conservacion }`. `validarUmbrales(entrada)` (F2). `detector.configurar({ umbrales, caidaSinGolpe })` (F2).
  - De las Tareas 4 a 6: `continuarArranque`, `lecturasRecibidas`, `soltarTodo`, `alVolverVisible`, `estaEncendido`, `apagar`.
- Produces:
  - El motor pide la configuración con `fuentes.fetch('/api/telemetria/configuracion', { method: 'GET', cache: 'no-store' })` al encender, al reanudar (también si arranca en pausa), al volver visible con el modo encendido y cada 10 min mientras está `activo` o `en_pausa`; un pedido en curso no se repite.
  - Con 2xx guarda `acta:viaje:configuracion` `{ guardadaEn, configuracion }` con el JSON tal como vino. Sin red o con error usa la guardada de menos de 24 h y, si no hay, los valores del código. Al crearse el motor aplica la guardada vigente sin pedir nada.
  - `estado().configuracion = { version, alerta, caidaSinGolpe, umbrales, desactualizado }`: `umbrales` siempre de `validarUmbrales`; `alerta` distinta de `silenciosa` y `apagada` vale `normal`; `caida_sin_golpe` distinta de `alerta` vale `silenciosa`; `desactualizado = VERSION_MOTOR < motor_minimo` (entero ≥ 1; si no, 1). Con `alerta: 'apagada'`, un motor encendido hace `apagar('configuracion')`.
  - Internas: `aplicarConfiguracion(crudo)`, `usarConfiguracionGuardada()`, `pedirConfiguracion()` y `programarConfiguracion()`.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V7]` los bloques de configuración remota. `servidor.configuracion` se cambia entre pasos para simular un cambio en el servidor.

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V7]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Configuración remota (§2.9): silenciosa, apagada, motor desactualizado, umbrales validados y sin red */
  {
    const servidor = crearServidorFalso()
    servidor.configuracion.alerta = 'silenciosa'
    const { falsas, motor } = await encendido({ servidor })
    await chocar(falsas)
    await motor.drenarCola()
    const registradas = alertasDe(servidor)
    verificar('silenciosa: detecta y registra sin abrir la alerta', motor.estado().alerta === null && registradas.length === 1 && registradas[0].campos.alerta_mostrada === false && registradas[0].episodios.size === 1)
    verificar('pide la configuración al encender', servidor.pedidos.some((p) => p.ruta === '/api/telemetria/configuracion' && p.metodo === 'GET'))
    const configuraciones = servidor.pedidos.filter((p) => p.ruta === '/api/telemetria/configuracion').length
    falsas.documento.ponerVisible(false)
    falsas.documento.ponerVisible(true)
    await falsas.reloj.avanzar(0)
    verificar('y otra vez al volver visible', servidor.pedidos.filter((p) => p.ruta === '/api/telemetria/configuracion').length === configuraciones + 1)
    verificar('la configuración vigente queda en el estado', motor.estado().configuracion.alerta === 'silenciosa' && motor.estado().configuracion.version === servidor.configuracion.version)
    const guardada = JSON.parse(falsas.almacenamiento.mapa.get('acta:viaje:configuracion'))
    verificar('la configuración se guarda con su hora para usarla sin red', guardada.guardadaEn <= falsas.reloj.pared() && guardada.configuracion.alerta === 'silenciosa')
    servidor.configuracion.alerta = 'apagada'
    await falsas.reloj.avanzar(10 * 60_000)
    const e = motor.estado()
    verificar('apagada: a los 10 min el motor encendido se apaga con motivo configuracion', e.fase === 'apagado' && e.apagadoPor?.motivo === 'configuracion' && e.configuracion.alerta === 'apagada')
    terminar('configuración silenciosa y apagada', motor, falsas)
  }

  {
    const servidor = crearServidorFalso()
    servidor.configuracion.motor_minimo = 2
    servidor.configuracion.umbrales = { ...servidor.configuracion.umbrales, sospechaG: 40 }
    servidor.configuracion.caida_sin_golpe = 'alerta'
    const { falsas, motor } = await encendido({ servidor })
    const c = motor.estado().configuracion
    verificar('motor_minimo mayor que VERSION_MOTOR: desactualizado', c.desactualizado === true)
    verificar('un umbral fuera de rango vuelve a su omisión', c.umbrales.sospechaG === 4 && c.caidaSinGolpe === 'alerta')
    await chocar(falsas)
    await motor.drenarCola()
    verificar('desactualizado: registra sin mostrar la alerta', motor.estado().alerta === null && alertasDe(servidor)[0]?.campos.alerta_mostrada === false)
    terminar('motor desactualizado', motor, falsas)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const pared = Date.UTC(2026, 8, 16, 17, 30)
    const reciente = new Map([['acta:viaje:configuracion', JSON.stringify({ guardadaEn: pared - 60 * 60_000, configuracion: { version: 'abc123abc123abc1', umbrales: { sospechaG: 5 }, alerta: 'silenciosa', caida_sin_golpe: 'silenciosa', motor_minimo: 1, dias_conservacion: 90 } })]])
    const servidor = crearServidorFalso()
    servidor.enLinea = false
    const conGuardada = crearFuentesFalsas({ almacenamiento: reciente, servidor })
    const motorGuardada = crearMotorViaje(conGuardada.fuentes)
    conGuardada.gesto()
    const listo = motorGuardada.encender()
    await conGuardada.reloj.avanzar(0)
    conGuardada.movimiento.emitir(quieta(conGuardada.reloj.mono()))
    await listo
    await conGuardada.reloj.avanzar(0)
    const c = motorGuardada.estado().configuracion
    verificar('sin red usa la configuración guardada de menos de 24 h, validada', c.alerta === 'silenciosa' && c.umbrales.sospechaG === 5 && c.version === 'abc123abc123abc1')
    terminar('configuración guardada', motorGuardada, conGuardada)

    const vieja = new Map([['acta:viaje:configuracion', JSON.stringify({ guardadaEn: pared - 25 * 60 * 60_000, configuracion: { alerta: 'silenciosa', umbrales: { sospechaG: 5 } } })]])
    const conVieja = crearFuentesFalsas({ almacenamiento: vieja, servidor })
    const motorVieja = crearMotorViaje(conVieja.fuentes)
    verificar('con la guardada de más de 24 h usa los valores del código', motorVieja.estado().configuracion.alerta === 'normal' && motorVieja.estado().configuracion.umbrales.sospechaG === 4)
    terminar('configuración vieja', motorVieja, conVieja)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Sin configuración remota el motor nunca pide `/api/telemetria/configuracion`, alerta siempre y la clave guardada no existe: la excepción corta al leerla. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA silenciosa: detecta y registra sin abrir la alerta 
  FALLA pide la configuración al encender 
  FALLA y otra vez al volver visible 
  FALLA la configuración vigente queda en el estado 
  FALLA [V7] terminó sin excepciones SyntaxError: "undefined" is not valid JSON
```

y al final:

```text
101/106 verificaciones pasaron
5 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 3): sección «Configuración remota»: `aplicarConfiguracion`, `usarConfiguracionGuardada`, `pedirConfiguracion`, `programarConfiguracion`; dentro de `soltarTodo`; dentro de `continuarArranque`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 1558):

```ts
    publicar()
  }

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null
```

por:

```ts
    publicar()
  }

  /* ---------- Configuración remota ---------- */
  let configuracionEnCurso = false
  let temporizadorConfiguracion: number | null = null

  function aplicarConfiguracion(crudo: unknown): void {
    const c = esObjeto(crudo) ? crudo : {}
    const umbrales = validarUmbrales(c.umbrales).umbrales
    const alertaCfg = c.alerta === 'silenciosa' || c.alerta === 'apagada' ? c.alerta : 'normal'
    const caidaSinGolpe = c.caida_sin_golpe === 'alerta' ? 'alerta' : 'silenciosa'
    const minimo = esNumero(c.motor_minimo) && Number.isInteger(c.motor_minimo) && c.motor_minimo >= 1 ? c.motor_minimo : 1
    configuracion = { version: esTexto(c.version) ? c.version : null, alerta: alertaCfg, caidaSinGolpe, umbrales, desactualizado: VERSION_MOTOR < minimo }
    detector.configurar({ umbrales, caidaSinGolpe })
  }
  /** Sin red: la guardada si tiene menos de 24 h; si no, los valores del código. */
  function usarConfiguracionGuardada(): void {
    const g = leerJson(CLAVE_CONFIGURACION)
    const vigente = esObjeto(g) && esNumero(g.guardadaEn) && reloj.pared() - g.guardadaEn < MS_CONFIGURACION_VIGENTE
    aplicarConfiguracion(vigente ? g.configuracion : null)
  }
  function pedirConfiguracion(): void {
    if (destruido || configuracionEnCurso) return
    configuracionEnCurso = true
    void (async () => {
      try {
        const res = await fuentes.fetch('/api/telemetria/configuracion', { method: 'GET', cache: 'no-store' })
        if (!res.ok) throw new Error(`La configuración del modo viaje respondió ${res.status}.`)
        const json: unknown = await res.json()
        if (destruido) return
        escribirJson(CLAVE_CONFIGURACION, { guardadaEn: reloj.pared(), configuracion: json })
        aplicarConfiguracion(json)
      } catch {
        if (destruido) return
        usarConfiguracionGuardada()
      } finally {
        configuracionEnCurso = false
      }
      if (configuracion.alerta === 'apagada' && estaEncendido()) apagar('configuracion')
      publicar()
    })()
  }
  function programarConfiguracion(): void {
    temporizadorConfiguracion = cancelar(temporizadorConfiguracion)
    temporizadorConfiguracion = programar(() => {
      temporizadorConfiguracion = null
      pedirConfiguracion()
      if (fase === 'activo' || fase === 'en_pausa') programarConfiguracion()
    }, MS_CONFIGURACION)
  }

  /* ---------- Ciclo de vida ---------- */
  let asentamiento: Promise<void> | null = null
  let resolverAsentamiento: (() => void) | null = null
```

Reemplazá (cerca de la línea 1651):

```ts
    soltarPantalla()
    soltarCandado()
    temporizadorLatido = cancelar(temporizadorLatido)
  }

  function encender(): Promise<void> {
```

por:

```ts
    soltarPantalla()
    soltarCandado()
    temporizadorLatido = cancelar(temporizadorLatido)
    temporizadorConfiguracion = cancelar(temporizadorConfiguracion)
  }

  function encender(): Promise<void> {
```

Reemplazá (cerca de la línea 1752):

```ts
      fase = 'en_pausa'
      pausaDesde = reloj.pared()
      programarLatido()
      terminarArranque()
      return
    }
```

por:

```ts
      fase = 'en_pausa'
      pausaDesde = reloj.pared()
      programarLatido()
      programarConfiguracion()
      pedirConfiguracion()
      terminarArranque()
      return
    }
```

- [ ] **Step 4: `lib/viaje.ts` (2 de 3): dentro de `continuarArranque`; dentro de `lecturasRecibidas`; dentro de `alVolverVisible`**

Reemplazá (cerca de la línea 1767):

```ts
    temporizadorLecturas = programar(() => sinLecturas(mio), monoPermiso + MS_ESPERA_LECTURAS - reloj.mono())
    if (estadoGps === 'granted') vigilarGps()
    else gps = navegador.geolocation ? 'requiere_toque' : 'no_aplica'
    publicar()
  }
```

por:

```ts
    temporizadorLecturas = programar(() => sinLecturas(mio), monoPermiso + MS_ESPERA_LECTURAS - reloj.mono())
    if (estadoGps === 'granted') vigilarGps()
    else gps = navegador.geolocation ? 'requiere_toque' : 'no_aplica'
    pedirConfiguracion()
    publicar()
  }
```

Reemplazá (cerca de la línea 1789):

```ts
    if (intencion === null) ultimoMovimiento = pared
    escribirIntencion()
    programarLatido()
    if (ruta.enPausa) entrarEnPausa()
    terminarArranque()
  }
```

por:

```ts
    if (intencion === null) ultimoMovimiento = pared
    escribirIntencion()
    programarLatido()
    programarConfiguracion()
    if (ruta.enPausa) entrarEnPausa()
    terminarArranque()
  }
```

Reemplazá (cerca de la línea 1918):

```ts
      void asegurarPantalla()
    }
    if (fase === 'otra_ventana') reintentarCandado()
    revisarPlazo()
    programarVencimientoGolpe()
    alCambiarAudio()
```

por:

```ts
      void asegurarPantalla()
    }
    if (fase === 'otra_ventana') reintentarCandado()
    if (estaEncendido()) pedirConfiguracion()
    revisarPlazo()
    programarVencimientoGolpe()
    alCambiarAudio()
```

- [ ] **Step 5: `lib/viaje.ts` (3 de 3): sección «Arranque»**

Reemplazá (cerca de la línea 2139):

```ts
    fase = 'no_soportado'
    motivoNoSoportado = 'sin_sensores'
  }
  diagnosticoActivo = leerDiagnostico()
  restaurarGolpe()
  restaurarAlerta()
```

por:

```ts
    fase = 'no_soportado'
    motivoNoSoportado = 'sin_sensores'
  }
  usarConfiguracionGuardada()
  diagnosticoActivo = leerDiagnostico()
  restaurarGolpe()
  restaurarAlerta()
```

- [ ] **Step 6: Correr la prueba y verla pasar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   silenciosa: detecta y registra sin abrir la alerta
  ok   pide la configuración al encender
  ok   y otra vez al volver visible
  ok   la configuración vigente queda en el estado
  ok   la configuración se guarda con su hora para usarla sin red
  ok   apagada: a los 10 min el motor encendido se apaga con motivo configuracion
  ok   configuración silenciosa y apagada: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   motor_minimo mayor que VERSION_MOTOR: desactualizado
  ok   un umbral fuera de rango vuelve a su omisión
  ok   desactualizado: registra sin mostrar la alerta
  ok   motor desactualizado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   sin red usa la configuración guardada de menos de 24 h, validada
  ok   configuración guardada: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   con la guardada de más de 24 h usa los valores del código
  ok   configuración vieja: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
116/116 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 8: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Leer la configuración del modo viaje del servidor para poder apagarlo sin publicar otra versión

Si el detector da falsos positivos en la calle, hay que poder silenciar las alertas o apagar
el modo en todos los teléfonos sin esperar a que cada uno actualice la aplicación. El motor
pide la configuración al encender, al reanudar, al volver visible y cada 10 minutos:
silenciosa detecta y registra sin mostrar la alerta, apagada apaga los motores encendidos y
un motor más viejo que motor_minimo no alerta. Sin red usa la última configuración de menos
de 24 horas, y los umbrales pasan siempre por validarUmbrales.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `drenarCola` con candado, `registrarAccidente`, `borrarRegistros` y `activarGps`

**Files:**
- Modify: `lib/viaje.ts` — los lugares que citan los pasos de implementación, buscados por contenido
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V7]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `scripts/prueba-viaje.mjs`, sección `[V7]`

**Interfaces:**
- Consumes:
  - `POST /api/casos` (F1; el vínculo con `telemetria_id` lo agrega F5) → 201 `{ id, secreto, precarga_ambigua, vinculo_telemetria? }`; `DELETE /api/telemetria/mias` (F1) → 200 `{ ok, alertas, eventos_conduccion }`.
  - `fuentes.local.recordarActuacion(id, secreto)` (Tarea 3), `ColaViaje.vaciar()` e `idServidor()` (Tarea 1). De las Tareas 7 y 9: `drenarAhora(soloAlerta?)`, `subirAlerta`, `camposConocidos`, `cerrarAlerta`, `borrarGolpePendiente`, `escrituras`, `pendientesConduccion`. De las Tareas 4 y 5: `vigilarGps`, `actualizarDestrabador`, `apagar`.
- Produces:
  - `drenarCola()` (reemplazada): toma `navigator.locks.request('acta-viaje-drenado', { ifAvailable: true }, …)` donde exista; sin candado no drena, porque otra ventana ya lo está haciendo.
  - `registrarAccidente(telemetria?)` → `ResultadoRegistro`: `idCliente` = el pasado, el de la alerta o el del golpe pendiente; si hay, marca `hubo_choque = true` en esa alerta, la drena sola (`soloAlerta`, sin esperar el retroceso) y toma su `idServidor` (o el pasado, o el del golpe pendiente, o el de la alerta). `POST /api/casos` con `{ telemetria_id }` si hay id y `{}` si no. Con 2xx y `id` y `secreto`: `fuentes.local.recordarActuacion(id, secreto)`, cierra la alerta, borra el golpe pendiente, `apagar('accidente_registrado')` y resuelve `{ tipo: 'creada', id, vinculo }` con `vinculo` = `vinculo_telemetria` o `'sin_dato'`. `fetch` que rechaza → `{ tipo: 'sin_red' }`. Otro estado → `{ tipo: 'error', mensaje }` con `cuerpo.error` o «No se pudo abrir la actuación. Esperá unos segundos y volvé a tocar el botón.».
  - `borrarRegistros()` → `ResultadoBorrado`: descarta los eventos de conducción sin encolar, vacía la cola y hace `DELETE /api/telemetria/mias`; 2xx → `{ tipo: 'ok', alertas, eventos_conduccion }`; sin red → `{ tipo: 'sin_red' }`; otro estado → `{ tipo: 'error', mensaje }` con `cuerpo.error` o «No se pudieron borrar los registros del servidor. Esperá unos segundos y volvé a tocar el botón.».
  - `activarGps()`: dentro del gesto, `watchPosition` cuando `gps === 'requiere_toque'` y la fase es `activo`; otra llamada con la vigilancia puesta no pide otra.
  - Interna: `marcarChoque(idCliente)`.

**Decisiones de esta tarea:**

- `hubo_choque = true` se marca antes de drenar, no después: así viaja en el mismo pedido que sube la alerta y el servidor lo tiene aunque la actuación no se llegue a abrir.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección `[V7]` los bloques de registro del accidente, drenado con candado, borrado y GPS con toque.

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V7]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Cola, registro del accidente, borrado y GPS con toque */
  {
    const { falsas, motor } = await encendido()
    await chocar(falsas)
    await falsas.reloj.avanzar(600)
    motor.responder('necesito_ayuda')
    const id = motor.estado().alerta.idCliente
    falsas.servidor.enLinea = false
    const sinRed = await motor.registrarAccidente()
    verificar('registrarAccidente sin red: sin_red y la ayuda sigue', sinRed.tipo === 'sin_red' && motor.estado().alerta?.estado === 'ayuda')
    falsas.servidor.enLinea = true
    falsas.servidor.forzarEstado('/api/casos', 503)
    const conError = await motor.registrarAccidente()
    verificar('registrarAccidente con un 503: error con el mensaje del servidor', conError.tipo === 'error' && conError.mensaje === 'Respuesta forzada por la prueba.' && motor.estado().alerta !== null)
    const r = await motor.registrarAccidente()
    const enServidor = falsas.servidor.alertas.get(id)
    const caso = falsas.servidor.casos.at(-1)
    verificar('registrarAccidente sube la alerta y abre la actuación con su telemetria_id', r.tipo === 'creada' && caso?.cuerpo.telemetria_id === enServidor?.id && r.id === caso.id)
    verificar('marca hubo_choque en la alerta', enServidor?.hubo_choque === true)
    verificar('el vínculo informado por el servidor llega al resultado', r.vinculo === 'ok')
    const mapa = falsas.almacenamiento.mapa
    verificar('recuerda la actuación y su secreto en el teléfono (fuentes.local)', mapa.get('acta:actuacion-abierta') === caso.id && mapa.get(`acta:secreto:${caso.id}`) === caso.secreto)
    const e = motor.estado()
    verificar('cierra la alerta, no deja golpe pendiente y apaga con motivo accidente_registrado', e.alerta === null && e.golpePendiente === null && e.fase === 'apagado' && e.apagadoPor?.motivo === 'accidente_registrado' && !mapa.has('acta:viaje:alerta'))
    terminar('registrar accidente', motor, falsas)
  }

  {
    const { falsas, motor } = await encendido()
    const r = await motor.registrarAccidente()
    verificar('registrarAccidente sin alerta ni golpe pendiente manda {} y el vínculo queda sin_dato', r.tipo === 'creada' && r.vinculo === 'sin_dato' && JSON.stringify(falsas.servidor.casos[0].cuerpo) === '{}')
    terminar('registrar sin alerta', motor, falsas)
  }

  {
    const { crearRegistroCandados } = await import('./fuentes-falsas.mjs')
    const registro = crearRegistroCandados()
    const { falsas, motor } = await encendido({ candados: registro })
    registro.ocupados.add('acta-viaje-drenado')
    await chocar(falsas)
    await motor.drenarCola()
    verificar('con el candado de drenado tomado por otra ventana no se drena', falsas.servidor.alertas.size === 0)
    registro.ocupados.delete('acta-viaje-drenado')
    await motor.drenarCola()
    verificar('libre el candado, drena de a un pedido y sube la alerta', falsas.servidor.alertas.size === 1)
    const borrado = await motor.borrarRegistros()
    verificar('borrarRegistros vacía la cola y hace DELETE /api/telemetria/mias', borrado.tipo === 'ok' && borrado.alertas === 1 && falsas.servidor.alertas.size === 0 && falsas.servidor.pedidos.at(-1)?.metodo === 'DELETE')
    falsas.servidor.enLinea = false
    verificar('borrarRegistros sin red: sin_red', (await motor.borrarRegistros()).tipo === 'sin_red')
    falsas.servidor.enLinea = true
    await motor.drenarCola()
    verificar('después de borrar no queda nada para subir', falsas.servidor.alertas.size === 0)
    terminar('drenado y borrado', motor, falsas)
  }

  {
    const { crearMotorViaje } = await import('../lib/viaje.ts')
    const mapa = new Map()
    mapa.set('acta:viaje', JSON.stringify({ encendidoEn: Date.UTC(2026, 8, 16, 17, 0), ultimoLatido: Date.UTC(2026, 8, 16, 17, 29), ultimoMovimiento: Date.UTC(2026, 8, 16, 17, 29), documentoId: '3c1e2b7a-5d4f-4e6a-9b8c-7d6e5f4a3b2c' }))
    const falsas = crearFuentesFalsas({ almacenamiento: mapa, geolocalizacion: 'prompt' })
    const motor = crearMotorViaje(falsas.fuentes)
    await falsas.reloj.avanzar(0)
    falsas.movimiento.emitir(quieta(falsas.reloj.mono()))
    await falsas.reloj.avanzar(0)
    verificar('geolocalización en prompt al reanudar: sin watchPosition y gps requiere_toque', motor.estado().fase === 'activo' && falsas.geo.pedidos === 0 && motor.estado().gps === 'requiere_toque')
    falsas.gesto()
    motor.activarGps()
    verificar('activarGps dentro del gesto vigila el GPS', falsas.geo.pedidos === 1 && falsas.geo.vigilancias === 1 && motor.estado().gps === 'buscando')
    motor.activarGps()
    verificar('activarGps otra vez no pide otro', falsas.geo.pedidos === 1)
    falsas.geo.emitirError(1)
    await falsas.reloj.avanzar(0)
    verificar('error 1 del GPS: clearWatch y sin_permiso', falsas.geo.vigilancias === 0 && motor.estado().gps === 'sin_permiso')
    terminar('GPS con toque', motor, falsas)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 1. Con los métodos vacíos de la Tarea 3, `registrarAccidente` siempre da `error` y no hay actuación: la excepción corta al leer el caso creado. Las líneas `FALLA` son exactamente éstas (la de una excepción sigue con su pila, que no se copia acá):

```text
  FALLA registrarAccidente sin red: sin_red y la ayuda sigue 
  FALLA registrarAccidente con un 503: error con el mensaje del servidor 
  FALLA registrarAccidente sube la alerta y abre la actuación con su telemetria_id 
  FALLA marca hubo_choque en la alerta 
  FALLA el vínculo informado por el servidor llega al resultado 
  FALLA [V7] terminó sin excepciones TypeError: Cannot read properties of undefined (reading 'id')
```

y al final:

```text
116/122 verificaciones pasaron
6 FALLARON
```

- [ ] **Step 3: `lib/viaje.ts` (1 de 2): dentro de `drenarCola`; `activarGps`; `marcarChoque`, `registrarAccidente`, `borrarRegistros`**

Los reemplazos de esta tarea van en orden; cada bloque «antes» aparece una sola vez en `lib/viaje.ts` tal como lo dejó el reemplazo anterior.

Reemplazá (cerca de la línea 1086):

```ts
      do {
        otraVuelta = false
        try {
          await drenarAhora()
        } catch (err) {
          console.warn('[viaje] no se pudo drenar la cola', err)
        }
```

por:

```ts
      do {
        otraVuelta = false
        try {
          const locks = navegador.locks
          if (locks) {
            await locks.request(CANDADO_DRENADO, { ifAvailable: true }, async (obtenido) => {
              // Sin candado, otra ventana ya está drenando la misma cola: no hace falta pisarla.
              if (obtenido !== null) await drenarAhora()
            })
          } else {
            await drenarAhora()
          }
        } catch (err) {
          console.warn('[viaje] no se pudo drenar la cola', err)
        }
```

Reemplazá (cerca de la línea 2067):

```ts
  }

  /* ---------- Acciones de la persona ---------- */
  let temporizadorPrueba: number | null = null

  /** Mismo camino que la alerta real y dentro del gesto: resume y el tono sincrónicos destraban el audio. */
```

por:

```ts
  }

  /* ---------- Acciones de la persona ---------- */
  function activarGps(): void {
    if (destruido) return
    huboGesto = true
    if (gps === 'requiere_toque' && fase === 'activo') vigilarGps()
    actualizarDestrabador()
    publicar()
  }

  let temporizadorPrueba: number | null = null

  /** Mismo camino que la alerta real y dentro del gesto: resume y el tono sincrónicos destraban el audio. */
```

Reemplazá (cerca de la línea 2116):

```ts
    publicar()
  }

  function destruir(): void {
    if (destruido) return
    intento++
```

por:

```ts
    publicar()
  }

  function marcarChoque(idCliente: string): void {
    if (alerta && alerta.idCliente === idCliente) {
      alerta.huboChoque = true
      alerta.campos = { ...alerta.campos, hubo_choque: true }
      subirAlerta(idCliente, alerta.campos, [])
      return
    }
    const campos = camposConocidos.get(idCliente)
    if (!campos) return
    const actualizados = { ...campos, hubo_choque: true }
    camposConocidos.set(idCliente, actualizados)
    subirAlerta(idCliente, actualizados, [])
  }

  async function registrarAccidente(telemetria?: { idCliente?: string | null; idServidor?: string | null }): Promise<ResultadoRegistro> {
    const idCliente = telemetria?.idCliente ?? alerta?.idCliente ?? golpePendiente?.telemetriaIdCliente ?? null
    let idServidor: string | null = null
    if (idCliente) {
      // hubo_choque se marca antes de drenar para que viaje en el mismo pedido que sube la alerta.
      marcarChoque(idCliente)
      try {
        await drenarAhora(idCliente)
        idServidor = await fuentes.cola.idServidor(idCliente)
      } catch {
        idServidor = null
      }
    }
    idServidor ??= telemetria?.idServidor ?? (golpePendiente?.telemetriaIdCliente === idCliente ? golpePendiente?.telemetriaId : null) ?? (alerta?.idCliente === idCliente ? alerta?.idServidor : null) ?? null
    let res: Response
    try {
      res = await fuentes.fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(idServidor ? { telemetria_id: idServidor } : {}),
      })
    } catch {
      return { tipo: 'sin_red' }
    }
    let cuerpo: unknown = null
    try {
      cuerpo = await res.json()
    } catch {
      cuerpo = null
    }
    const c = esObjeto(cuerpo) ? cuerpo : {}
    if (res.ok && esTexto(c.id) && esTexto(c.secreto)) {
      fuentes.local.recordarActuacion(c.id, c.secreto)
      if (alerta) cerrarAlerta(false)
      borrarGolpePendiente()
      apagar('accidente_registrado')
      const vinculo = c.vinculo_telemetria === 'ok' || c.vinculo_telemetria === 'rechazado' ? c.vinculo_telemetria : 'sin_dato'
      return { tipo: 'creada', id: c.id, vinculo }
    }
    return { tipo: 'error', mensaje: esTexto(c.error) ? c.error : TEXTO_ERROR_REGISTRO }
  }

  async function borrarRegistros(): Promise<ResultadoBorrado> {
    pendientesConduccion = []
    primerPendienteEn = null
    for (const id of [...camposConocidos.keys()]) camposConocidos.delete(id)
    try {
      await escrituras
      await fuentes.cola.vaciar()
    } catch {
      /* sin cola local igual se borra lo del servidor */
    }
    let res: Response
    try {
      res = await fuentes.fetch('/api/telemetria/mias', { method: 'DELETE' })
    } catch {
      return { tipo: 'sin_red' }
    }
    let cuerpo: unknown = null
    try {
      cuerpo = await res.json()
    } catch {
      cuerpo = null
    }
    const c = esObjeto(cuerpo) ? cuerpo : {}
    if (res.ok) {
      return { tipo: 'ok', alertas: esNumero(c.alertas) ? c.alertas : 0, eventos_conduccion: esNumero(c.eventos_conduccion) ? c.eventos_conduccion : 0 }
    }
    return { tipo: 'error', mensaje: esTexto(c.error) ? c.error : TEXTO_ERROR_BORRADO }
  }

  function destruir(): void {
    if (destruido) return
    intento++
```

- [ ] **Step 4: `lib/viaje.ts` (2 de 2): el objeto que devuelve `crearMotorViaje`**

Reemplazá (cerca de la línea 2272):

```ts
    reanudar,
    apagar,
    tocar,
    activarGps: () => undefined,
    cambiarRuta,
    responder,
    marcarHuboChoque,
    falsaAlarma,
    seguirViaje,
    probarAlerta,
    registrarAccidente: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_REGISTRO }),
    descartarGolpePendiente,
    borrarRegistros: async () => ({ tipo: 'error', mensaje: TEXTO_ERROR_BORRADO }),
    drenarCola,
    destruir,
  }
```

por:

```ts
    reanudar,
    apagar,
    tocar,
    activarGps,
    cambiarRuta,
    responder,
    marcarHuboChoque,
    falsaAlarma,
    seguirViaje,
    probarAlerta,
    registrarAccidente,
    descartarGolpePendiente,
    borrarRegistros,
    drenarCola,
    destruir,
  }
```

- [ ] **Step 5: Correr la prueba y verla pasar**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Expected: código de salida 0 y ninguna línea `  FALLA`. Las verificaciones que suma esta tarea son:

```text
  ok   registrarAccidente sin red: sin_red y la ayuda sigue
  ok   registrarAccidente con un 503: error con el mensaje del servidor
  ok   registrarAccidente sube la alerta y abre la actuación con su telemetria_id
  ok   marca hubo_choque en la alerta
  ok   el vínculo informado por el servidor llega al resultado
  ok   recuerda la actuación y su secreto en el teléfono (fuentes.local)
  ok   cierra la alerta, no deja golpe pendiente y apaga con motivo accidente_registrado
  ok   registrar accidente: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   registrarAccidente sin alerta ni golpe pendiente manda {} y el vínculo queda sin_dato
  ok   registrar sin alerta: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   con el candado de drenado tomado por otra ventana no se drena
  ok   libre el candado, drena de a un pedido y sube la alerta
  ok   borrarRegistros vacía la cola y hace DELETE /api/telemetria/mias
  ok   borrarRegistros sin red: sin_red
  ok   después de borrar no queda nada para subir
  ok   drenado y borrado: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   geolocalización en prompt al reanudar: sin watchPosition y gps requiere_toque
  ok   activarGps dentro del gesto vigila el GPS
  ok   activarGps otra vez no pide otro
  ok   error 1 del GPS: clearWatch y sin_permiso
  ok   GPS con toque: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
137/137 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 6: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (con `  ok   ningún nombre se exporta desde dos módulos de lib/`); `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 7: Commit**

```bash
git add "lib/viaje.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Registrar el accidente desde la alerta sin navegar y aunque la alerta no haya subido

Después de un golpe, «Registrar el accidente» tiene que abrir la actuación vinculada a esa
detección aunque la alerta todavía esté en la cola. El motor marca hubo_choque, sube esa
alerta sola sin esperar el retroceso, abre la actuación con su telemetria_id, recuerda el
secreto en el teléfono y apaga el modo viaje. Sin red devuelve sin_red y la ayuda sigue a mano.

El drenado toma un candado de Web Locks para que dos ventanas no suban lo mismo, y «Borrar mis
registros del modo viaje» vacía la cola del teléfono antes de pedir el borrado al servidor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: `IMPORTS_PERMITIDOS` suma `lib/viaje.ts` y `lib/cola-viaje.ts`; [V6] y [V7] completas

**Files:**
- Modify: `scripts/prueba-contrato.mjs` — el objeto `IMPORTS_PERMITIDOS` que agregó F2 en la sección `[5] Lo que el expediente no perdona` (se busca por contenido: F2 lo ubicó y los números de línea cambiaron)
- Modify (temporal, se revierte en esta misma tarea): `lib/viaje.ts` y `lib/cola-viaje.ts` — su primera línea de `import`
- Modify: `scripts/prueba-viaje.mjs` — el cierre de la sección `[V7]`, justo antes de `/* ---------- Resultado ---------- */`
- Test: `npm run contrato` y `scripts/prueba-viaje.mjs`, sección `[V7]`

**Interfaces:**
- Consumes: la comprobación de importaciones de F2 en `scripts/prueba-contrato.mjs`, que recorre las entradas de `IMPORTS_PERMITIDOS`, cuenta `import`, `import type` y `export … from` y da falla ante cualquier `import()` dinámico (índice, «Importaciones permitidas»).
- Produces: el contrato falla si `lib/cola-viaje.ts` importa de algo distinto de `./transporte-viaje`, o si `lib/viaje.ts` importa de algo distinto de `./impacto`, `./conduccion`, `./transporte-viaje`, `./local` y `./cola-viaje`. `[V6]` (132 verificaciones) y `[V7]` (141) quedan con todas las filas de §6.2.

- [ ] **Step 1: Escribir la prueba que falla: una importación prohibida que el contrato todavía no ve**

En `lib/viaje.ts`, reemplazá:

```ts
import { UMBRALES, PRECISION_CONFIABLE_M, nivelMayor, validarUmbrales, type NivelImpacto, type RespuestaAlerta, type Umbrales } from './impacto'
```

por:

```ts
import { pool } from './db'
import { UMBRALES, PRECISION_CONFIABLE_M, nivelMayor, validarUmbrales, type NivelImpacto, type RespuestaAlerta, type Umbrales } from './impacto'
```

Y en `lib/cola-viaje.ts`, reemplazá:

```ts
import type { CamposAlerta, EpisodioTransportado, LoteConduccion } from './transporte-viaje'
```

por:

```ts
import { sha256 } from './hash'
import type { CamposAlerta, EpisodioTransportado, LoteConduccion } from './transporte-viaje'
```

- [ ] **Step 2: Correr el contrato y ver que no lo detecta**

Run: `npm run contrato`

Expected: termina con `El contrato se cumple.` y ninguna línea `  FALLA` nombra `lib/viaje.ts` ni `lib/cola-viaje.ts`. Ésa es la falla: las dos importaciones meterían `pg` y `node:crypto` en el paquete del teléfono y el contrato no las ve.

- [ ] **Step 3: Sumar los dos archivos a `IMPORTS_PERMITIDOS`**

En `scripts/prueba-contrato.mjs`, dentro del objeto `IMPORTS_PERMITIDOS`, agregá después de la entrada de `'lib/transporte-viaje.ts'` estas dos entradas. Con la forma del índice (archivo → lista de módulos permitidos) son exactamente:

```js
  'lib/cola-viaje.ts': ['./transporte-viaje'],
  'lib/viaje.ts': ['./impacto', './conduccion', './transporte-viaje', './local', './cola-viaje'],
```

Si F2 escribió cada entrada como un objeto con más claves (por ejemplo `{ permitidos: [...], motivo: '...' }`), las dos entradas nuevas llevan esas mismas claves, con estas mismas listas y, como motivo, los de la tabla «Importaciones permitidas» del índice: `Cliente` para `lib/cola-viaje.ts` y `§1.1 más el transporte` para `lib/viaje.ts`. No se cambia nada más de la comprobación de F2.

- [ ] **Step 4: Correr el contrato y verlo fallar**

Run: `npm run contrato`

Expected: código de salida 1; una línea `  FALLA` de la comprobación de importaciones permitidas cuyo detalle (la línea siguiente, con nueve espacios) nombra `lib/viaje.ts` con `./db` y `lib/cola-viaje.ts` con `./hash`; al final, `N FALLARON. El contrato está en docs/CONTRATO-UI.md.` con N igual a la cantidad de comprobaciones de importaciones que armó F2 (1 si es una sola para todos los archivos).

- [ ] **Step 5: Sacar las importaciones de prueba**

En `lib/viaje.ts`, reemplazá:

```ts
import { pool } from './db'
import { UMBRALES, PRECISION_CONFIABLE_M, nivelMayor, validarUmbrales, type NivelImpacto, type RespuestaAlerta, type Umbrales } from './impacto'
```

por:

```ts
import { UMBRALES, PRECISION_CONFIABLE_M, nivelMayor, validarUmbrales, type NivelImpacto, type RespuestaAlerta, type Umbrales } from './impacto'
```

Y en `lib/cola-viaje.ts`, reemplazá:

```ts
import { sha256 } from './hash'
import type { CamposAlerta, EpisodioTransportado, LoteConduccion } from './transporte-viaje'
```

por:

```ts
import type { CamposAlerta, EpisodioTransportado, LoteConduccion } from './transporte-viaje'
```

- [ ] **Step 6: Correr el contrato y verlo pasar**

Run: `npm run contrato && git diff --stat -- lib/viaje.ts lib/cola-viaje.ts`

Expected: `El contrato se cumple.` y después nada: los dos archivos quedaron como los dejó la Tarea 12.

- [ ] **Step 7: Cerrar `[V7]` con la suspensión de §6.2**

Agregá al final de la sección `[V7]` el bloque de la suspensión:

En `scripts/prueba-viaje.mjs`, reemplazá el cierre de la sección `[V7]`, que es lo último antes del resultado:

```js
  }
})

/* ---------- Resultado ---------- */
```

por:

```js
  }

  /* Suspensión (§2.1): 60 s con el equipo dormido no cambian el veredicto */
  {
    const sinDormir = await encendido()
    await chocar(sinDormir.falsas)
    await sinDormir.motor.drenarCola()
    const nivelDespierto = alertasDe(sinDormir.falsas.servidor)[0]?.campos.nivel_cliente
    terminar('choque sin suspensión', sinDormir.motor, sinDormir.falsas)

    const dormido = await encendido()
    dormido.falsas.documento.ponerVisible(false)
    dormido.falsas.reloj.saltarPared(60_000)
    dormido.falsas.documento.ponerVisible(true)
    await dormido.falsas.reloj.avanzar(1000)
    await chocar(dormido.falsas)
    await dormido.motor.drenarCola()
    const nivelDormido = alertasDe(dormido.falsas.servidor)[0]?.campos.nivel_cliente
    verificar('suspensión de 60 s antes del choque: mismo veredicto', nivelDespierto !== undefined && nivelDespierto !== 'nada' && nivelDormido === nivelDespierto, `${nivelDespierto} / ${nivelDormido}`)
    verificar('y la suspensión queda como hueco de detección', dormido.motor.estado().deteccion.huecos.some((h) => h.ms >= 60_000))
    terminar('choque después de una suspensión', dormido.motor, dormido.falsas)
  }
})

/* ---------- Resultado ---------- */
```

- [ ] **Step 8: Correr `[V7]`**

Run: `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` (PowerShell: `$env:SECCION='V7'; npx tsx scripts/prueba-viaje.mjs`)

Esta fila no pide código nuevo, así que pasa sin una falla previa: el hueco por visibilidad (Tarea 5) y el reinicio del detector (`detector.hueco`, F2) ya la cumplen. Se agrega para que `[V7]` tenga todas las filas de §6.2. Si fallara, el problema está en `alVolverVisible` o en `detector.hueco`, no en la prueba.

Expected: código de salida 0 y ninguna línea `  FALLA`; las verificaciones nuevas son:

```text
  ok   choque sin suspensión: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
  ok   suspensión de 60 s antes del choque: mismo veredicto
  ok   y la suspensión queda como hueco de detección
  ok   choque después de una suspensión: sin temporizadores, escuchas, vigilancias ni centinelas al terminar
```

y al final:

```text
141/141 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 9: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `npm run tipos` sin salida y con código 0; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y los dos con `Todo en orden.` al final.

- [ ] **Step 10: Commit**

```bash
git add "scripts/prueba-contrato.mjs" "scripts/prueba-viaje.mjs"
git status --short
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Impedir que el motor del modo viaje importe algo del servidor

lib/viaje.ts y lib/cola-viaje.ts corren en el teléfono: una importación de ./db o de
./hash metería pg y node:crypto en el paquete del cliente, y una dinámica se escaparía
de la revisión. El contrato ahora les exige la lista cerrada que el diseño fija para el
motor y para su cola.

[V7] suma la última fila de §6.2: una suspensión de 60 s antes del choque da el mismo
veredicto y queda como hueco de detección.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

Expected antes del commit: `git status --short` muestra `M  scripts/prueba-contrato.mjs` y `M  scripts/prueba-viaje.mjs`, y nada de `lib/`.

---

## Verificación de la fase

**Comandos** (Git Bash, desde la raíz)

1. `git log --oneline -13` muestra los trece commits de esta fase, de arriba abajo: «Impedir que el motor del modo viaje importe algo del servidor», «Registrar el accidente desde la alerta sin navegar y aunque la alerta no haya subido», «Leer la configuración del modo viaje del servidor para poder apagarlo sin publicar otra versión», «Apagar solo el modo viaje cuando el auto quedó estacionado», «Registrar las respuestas a la alerta y dejar el golpe pendiente para después», «Hacer sonar y vibrar la alerta del modo viaje aunque el teléfono esté en silencio», «Abrir la alerta del modo viaje desde los episodios del detector», «Pausar el modo viaje dentro del recorrido y contar la pausa como hueco», «Reanudar el modo viaje al reabrir y recuperar la pantalla con el primer toque», «Encender el modo viaje dentro del gesto para que el iPhone no niegue la pantalla», «Crear el motor del modo viaje fuera de React con un estado inmutable», «Simular el navegador en Node para probar el modo viaje sin un teléfono» y «Guardar las alertas del modo viaje en el teléfono antes de mandarlas».
2. `git status --short` no muestra cambios salvo `?? docs/superpowers/plans/`.
3. `npm run contrato && npm run tipos && npm run prueba`: `El contrato se cumple.`; `tsc --noEmit` sin salida; `scripts/prueba-logica.mjs` y `scripts/prueba-viaje.mjs` sin ninguna línea `  FALLA` y con `Todo en orden.`.
4. Las tres secciones de esta fase, cada una sola:

```bash
SECCION=V5 npx tsx scripts/prueba-viaje.mjs
SECCION=V6 npx tsx scripts/prueba-viaje.mjs
SECCION=V7 npx tsx scripts/prueba-viaje.mjs
```

Esperado, en ese orden, sólo líneas `  ok   ` bajo su encabezado y los totales:

```text
39/39 verificaciones pasaron
Todo en orden.
```

```text
132/132 verificaciones pasaron
Todo en orden.
```

```text
141/141 verificaciones pasaron
Todo en orden.
```

5. Importar el motor en Node no tiene efectos ni crea un motor (riesgos 17 y 18):

```bash
npx tsx -e "import('./lib/viaje.ts').then((m) => console.log(m.motorDelNavegador(), m.ESTADO_SERVIDOR.fase, Object.isFrozen(m.ESTADO_SERVIDOR.configuracion.umbrales)))"
```

Esperado: la última línea es exactamente `null desconocido true` (antes sólo puede aparecer el aviso `[impacto]` de F2 si la consola tiene variables `IMPACTO_*` o `CONDUCCION_*` fuera de rango).

6. Las importaciones de los dos archivos nuevos de `lib/` son las permitidas:

```bash
grep -n "from '" lib/viaje.ts lib/cola-viaje.ts
```

Esperado: `lib/viaje.ts` importa sólo de `'./impacto'`, `'./conduccion'`, `'./transporte-viaje'`, `'./cola-viaje'` y `'./local'`, y `lib/cola-viaje.ts` sólo de `'./transporte-viaje'`; ningún `import(`.

**Chequeos manuales**

La matriz de §6.5 no tiene filas para F3: empieza en F4, que es la primera fase con algo que tocar en un teléfono. Lo que el índice pide que se pueda probar al terminar esta fase son [V5]–[V7] con fuentes falsas y reloj falso (comandos 3 y 4). El adaptador de IndexedDB (`almacenIndexedDb`) y las fuentes del navegador (`fuentesDelNavegador`, `audioWeb`) se ejercitan por primera vez en un navegador con las filas 1 a 9 y 11 a 16 de la matriz (F4) y con la fila 10 (F5: modo avión durante la cuenta, una sola alerta al volver la red).

## Desvíos respecto del índice

1. **Una alerta restaurada en `pregunta` no absorbe episodios nuevos: se registran aparte, con `alerta_mostrada: false` (Tarea 9, `alertaPorDeteccion`).** El índice dice que un episodio durante `pregunta` «se agrega a esa alerta (n + 1, sin reiniciar la cuenta)» (`docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md:1360`), pero la forma de `acta:viaje:alerta` que fija el mismo índice no guarda cuántos episodios lleva la alerta (`…-00-indice.md:2153-2168`). Después de una recarga el motor no puede saber el próximo `n`, y el servidor hace el upsert del episodio por `(telemetria_id, n)` pisando todas las columnas (`…-00-indice.md:2107-2109`): agregar el episodio con `n = 1` borraría la serie del episodio que abrió la alerta. Arreglo mínimo, sin cambiar ningún formato: sólo en ese caso (la alerta restaurada), el episodio nuevo va como alerta aparte, igual que con la ayuda abierta. Sin recarga, la agregación es la del índice.
