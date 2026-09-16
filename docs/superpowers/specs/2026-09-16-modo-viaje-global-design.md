# Modo viaje global y detección que funcione — diseño

**Fecha:** 2026-09-16 · **Estado:** aprobado por el dueño del producto · **Alcance:** etapas 1 y 2
**Anexo:** `2026-09-16-modo-viaje-banco/` (banco de simulación con el que se midieron las reglas de la §2)

Este documento es el contrato de lo que se construye. Las reglas de `AGENTS.md`,
`docs/CONTRATO-UI.md` y `docs/MAPA-PANTALLAS.md` siguen valiendo y mandan sobre cualquier
detalle de acá que las contradiga sin decirlo.

---

## 0. Problema, objetivo y decisiones

### 0.1 Qué pasa hoy

- El modo viaje vive en `app/components/DetectorImpacto.tsx`, montado sólo al pie de
  `app/perfil/page.tsx`. Se llega en tres pantallas y un scroll, y sólo con sesión.
- El estado es local del componente: al salir de «Mis datos» se desmonta y deja de escuchar,
  incluso con una alerta en cuenta regresiva.
- Sacudir el teléfono dispara la alerta. `sostenido` (`lib/impacto.ts:135`) mide el lapso entre
  la primera y la última muestra fuerte de todo el buffer, no un golpe continuo, y no se exige
  que el teléfono vaya en un vehículo.
- El «cambio brusco de velocidad» no existe: el detector nunca pide el GPS, y el análisis corta
  antes de mirar la velocidad si el pico no llega a 4 g.
- Sin Wake Lock la pantalla se apaga sola y la detección muere con la tarjeta diciendo
  «Escuchando». La cuenta regresiva cuenta ticks y se congela.
- «Necesito ayuda» queda registrado como `sin_respuesta`, el plan de escalamiento no lo usa nadie,
  el contacto de confianza no se ofrece, la serie se pierde y el impacto no se vincula a la
  actuación que se abre desde `/aviso`.
- La telemetría es anónima, sin tope de cuerpo, sin limitador y sin control de dueño.

### 0.2 Objetivo

Que el modo viaje sea uno de los ejes del producto: se enciende con un toque desde el inicio,
funciona en toda la aplicación, distingue un choque de un pozo, de una sacudida y de una
frenada, avisa de forma que se note, y después del golpe deja a la persona a un toque de la
ayuda y del registro del accidente, con o sin señal.

### 0.3 Decisiones del dueño del producto

1. **Sigue siendo PWA.** Con la pantalla bloqueada o la app en segundo plano no hay sensores ni
   GPS, en iPhone ni en Android. Se dice en pantalla antes de encender.
2. **Alcance:** etapa 1 (global, de un toque) y etapa 2 (detección corregida, GPS, frenadas).
3. **Distinguir choque de frenada.** La alerta sale sólo ante señales de choque. Una frenada o
   aceleración brusca en la que se sigue andando se registra en silencio.
4. **Acceso:** tarjeta con interruptor en el inicio, debajo de la sección del accidente; con el
   modo encendido, una píldora en las demás pantallas que abre una hoja de opciones.
5. **Alerta:** pantalla completa desde cualquier pantalla, vibración (Android) y tono que sube en
   los últimos 15 segundos.
6. **Ciclo:** se reanuda solo al reabrir; si el auto está detenido 15 minutos, pregunta si terminó
   el viaje y, sin respuesta, se apaga.
7. **Arquitectura:** motor fuera de React en `lib/` y una capa fina en el layout.
8. **Registrar un accidente desde un golpe sólo vincula** (origen, hora y nivel). Las lecturas del
   teléfono no entran al expediente en esta etapa.
9. **Derivadas de la revisión crítica, aceptadas:**
   - Un golpe con el auto que sigue andando no abre la alerta: se registra en silencio y, si el
     auto se detiene en los 90 segundos siguientes, recién ahí se abre.
   - «Estoy bien» con el auto detenido abre una segunda pregunta: «¿Hubo un choque?».
   - La ayuda se muestra dentro de la alerta, sin navegar, y funciona sin señal.
   - Registrar un accidente apaga el modo viaje.
   - Las frenadas, aceleraciones y golpes en marcha se guardan sin cuenta y sin ubicación: en
     esta etapa sólo sirven para calibrar el detector.

### 0.4 Fuera de alcance

- Etapa 3: viajes como dato, historial del asegurado, vista del productor, push si el viaje se
  corta, puntaje, consentimiento telemático completo, incorporar las lecturas al expediente
  (incluye rehacer `POST /api/casos/[id]/sensores`, que hoy acepta JSON arbitrario y no tiene
  llamadores), `notificationclick` con `postMessage` en `public/sw.js`.
- **Se arregla aparte y antes:** el SSRF de `/api/push/prueba`; el tope de tamaño del `PATCH`
  de `/api/casos/[id]` y un limitador en las altas anónimas.

### 0.5 Límites que se declaran (README, hoja de opciones)

- Sólo con la aplicación abierta, a la vista y la pantalla encendida.
- No detecta golpes leves ni choques con el auto detenido.
- No llama ni le avisa a nadie por su cuenta.
- En iPhone no vibra; con el iPhone en silencio el tono depende de `navigator.audioSession`.
- En iOS instalada anterior a 18.4 la pantalla se puede apagar sola.

---

## 1. Piezas

| Pieza | Tipo | Responsabilidad |
|---|---|---|
| `lib/impacto.ts` | lógica pura, cliente y servidor | `evaluarEpisodio`: el único veredicto, usado por el motor y por el servidor. `Umbrales`/`UMBRALES` ampliados (no se crea un segundo conjunto). `validarUmbrales`. `planEscalamiento(veredicto, respuesta)`. |
| `lib/conduccion.ts` (nuevo) | lógica pura | Velocidad (`estimarVelocidades`, `estaDetenido`), maniobras (`detectarManiobras`), tipos `LecturaVelocidad` y `FixGps`. Importa de `impacto.ts`, nunca al revés. |
| `lib/viaje.ts` (nuevo) | cliente, sin React | El motor. Ver §1.1. |
| `lib/cola-viaje.ts` (nuevo) | cliente | Cola persistente en IndexedDB para alertas, episodios, respuestas y eventos de conducción. |
| `lib/limite.ts` (nuevo) | servidor | Limitador en memoria por clave. |
| `lib/api.ts` | servidor | Suma `leerCuerpoLimitado(req, maxBytes)`. |
| `lib/posesion.ts` | servidor | Suma `huellaDispositivo(proposito, crear)`. |
| `lib/hash.ts` | servidor | Suma `aJsonPuro` y lo usa en `hashEvento`, `registrarEvento` y `registrarGestion`. |
| `lib/retencion.ts` | servidor | Suma `purgarTelemetria(ejecutar)`; anonimizar y expurgar borran la telemetría vinculada. |
| `app/components/ModoViaje.tsx` (nuevo) | cliente | Proveedor que envuelve `{children}` en el layout y dibuja la capa (alerta, píldora, hoja). Exporta `ModoViaje` y `useModoViaje`. |
| `app/components/AyudaImpacto.tsx` (nuevo) | cliente | Contenido de ayuda. Lo usan la alerta y `/aviso`, por eso se exporta. |
| `app/page.tsx` | pantalla | Tarjeta del modo viaje (componente no exportado dentro del archivo). |
| `app/aviso/page.tsx` | pantalla | Destino de notificaciones (etapa 3) y respaldo: dibuja `AyudaImpacto`. No escribe al montar. |
| `app/components/DetectorImpacto.tsx` | se borra | En el mismo commit en que entra el proveedor. Se saca de `app/perfil/page.tsx`. |
| Route handlers | servidor | Ver §5.3. |

Ninguna pantalla registra listeners de sensores: todo pasa por el motor.

### 1.1 El motor (`lib/viaje.ts`)

- **Sin efectos al importarse.** Ningún acceso a `window`, `document`, `navigator`,
  `localStorage` fuera de funciones. `typeof navigator` no sirve de guarda (Node ≥ 21 lo
  define): se usa `typeof window`.
- **Exporta sólo:** `crearMotorViaje(fuentes)`, `motorDelNavegador()`, `ESTADO_SERVIDOR`,
  `VERSION_MOTOR`, `AVISO_DATOS_VERSION`, `RUTAS_EN_PAUSA`, `RUTAS_SIN_PILDORA` y el tipo
  `EstadoModoViaje`. Los nombres no pueden repetir exportaciones de otros módulos de `lib/`
  (`scripts/prueba-contrato.mjs:515-531`): ya existen `Lectura`, `Umbrales`, `UMBRALES`,
  `Ubicacion`, `encolar`, `quitar`, `drenar`, `umbral`, `analizar`, `Nivel`, `Aviso`.
- **Importa sólo** de `./impacto`, `./conduccion`, `./local` y `./cola-viaje`. Nunca de
  `./db` ni `./hash` (meterían `pg` y `node:crypto` en el cliente). Ids locales con
  `crypto.randomUUID()`.
- **Fuentes inyectadas** (para probarlo en Node con fuentes falsas): sensores de movimiento,
  permiso de movimiento, geolocalización, permisos, wake lock, audio (contexto y
  `audioSession`), vibración, almacenamiento, cola, red (`fetch`), visibilidad, candados
  (`navigator.locks`), eventos de activación, y un reloj
  `{ mono(), pared(), programar(fn, ms), cancelar(id) }`. El motor no usa `setTimeout`,
  `setInterval`, `Date.now` ni `performance.now` globales.
- **Singleton:** `motorDelNavegador()` devuelve `null` si `typeof window === 'undefined'`. Si no,
  guarda la instancia en `globalThis.__actaMotorViaje` (precedente: `globalForDb` en
  `lib/db.ts`). Si encuentra una previa (Fast Refresh), llama `previa.destruir()`: quita
  listeners, `clearWatch`, libera el sentinel, cierra el contexto de audio, cancela
  temporizadores. La nueva arranca por el camino normal de reanudación desde lo guardado.
- **Instantánea inmutable:** `estado()` devuelve siempre la misma referencia hasta que algo
  cambia; al cambiar se reemplaza entera. La velocidad visible se redondea y se actualiza a
  1 Hz como máximo.
- **Idempotencia:** `encender`, `reanudar`, `pausar`, `continuar` y `apagar` no hacen nada si
  ya están en ese estado. Hay un solo `watchId` y un solo sentinel: antes de pedir otro se
  libera el anterior.

### 1.2 El proveedor (`app/components/ModoViaje.tsx`)

- En `app/layout.tsx`: `<body><ModoViaje>{children}</ModoViaje><BombaCola /></body>`. El layout
  sigue siendo Server Component (exporta `metadata` y `viewport`).
- Dibuja `<div className="raiz-app" inert={capaBloqueante || undefined}>{children}</div>` y
  después la capa. `.raiz-app` lleva `display: contents` para no alterar el maquetado.
  «Tuve un accidente» sigue siendo lo primero interactivo del DOM. Verificar en la
  implementación que ningún selector de `globals.css` dependa de `body > main`.
- `useSyncExternalStore(suscribir, obtener, () => ESTADO_SERVIDOR)`. El motor se crea dentro de
  `suscribir`/`obtener`, que sólo corren en el cliente. La limpieza del efecto sólo desuscribe:
  nunca apaga.
- La capa va dentro de un error boundary de clase que devuelve `null` ante un error (no existe
  `app/global-error.tsx`: un error en el layout tumbaría todas las pantallas). `{children}`
  queda fuera del boundary.
- Decide con `usePathname()` (no `useSearchParams`). Avisa al motor de cada cambio de ruta.
- Drena la cola de viaje al montar, en `online`, al volver visible y cada 30 s, **con el modo
  encendido o apagado** (mismo patrón que `BombaCola`).
- Al encender y con sesión, lee el contacto de confianza (`GET /api/perfil`) y lo guarda en
  memoria y en localStorage para mostrarlo sin red.

---

## 2. Detección

Las reglas de esta sección se midieron con el banco del anexo. Los números son de referencia y
se calibran en campo (§2.9).

### 2.1 Relojes

- **Una sola base para correlacionar:** `mono()` = `performance.now()`. El acelerómetro usa
  `e.timeStamp`, que está en la misma base. `performance.now()` no avanza con el equipo
  suspendido y `pos.timestamp` es hora de pared: nunca se mezclan con `performance.timeOrigin`.
- **Cada fix del GPS se sella al llegar:**
  - `edad = Date.now() − pos.timestamp` (dos lecturas de pared tomadas juntas).
  - Se guardan las edades de los últimos 5 fixes, incluidos los descartados. Con 3 o más,
    `sesgo = mediana(edades)` si `|mediana| > 3000`; si no, `sesgo = 0` (cubre la hora GNSS
    corrida y el reloj manual).
  - `edadEf = edad − sesgo`. Si `edadEf > 5000`, o si `pos.timestamp` no crece respecto del fix
    anterior, el fix no se usa (fix en caché al reanudar, lotes de CoreLocation).
  - `t = mono() − max(edadEf, 0)`.
- **Velocidad derivada:** el Δt entre fixes usa `pos.timestamp`. Se descarta el par si el Δt de
  adquisición y el de llegada difieren en más de 2 s. Base mínima de 3 s, no entre fixes
  consecutivos de 1 s.
- **Huecos:** `visibilitychange → visible`, `pageshow` con `persisted`, salida de una pausa, o
  |Δpared − Δmono| > 1 s entre dos latidos o lotes de muestras. En un hueco se vacían los
  buffers, se reinician los filtros y las medianas, se reinicia el historial de edades y se
  cierran los episodios abiertos sin velocidad.
- **Hora de un evento:** al detectar el pico se captura el par `{ pared, mono }` y
  `ocurrido_en = pared − (mono − tPico)`.
- **Duraciones que ve la persona o que deciden el ciclo** (inactividad, detección activa,
  latido, cuenta regresiva, golpe pendiente) usan `pared()`.

### 2.2 Fuente de aceleración

- **Confiable** si `rotationRate` trae números (hay giróscopo; cubre iOS con CMDeviceMotion y
  Android con `TYPE_LINEAR_ACCELERATION`, que lo exige):
  - aceleración lineal = `acceleration`;
  - gravedad `ĝ = normalizar(accelerationIncludingGravity − acceleration)`;
  - `giro` = norma de `rotationRate` (√(α² + β² + γ²)).
- **No confiable** si `rotationRate` es null o sin números, si `acceleration` es null, o si es
  exactamente (0,0,0) con `accelerationIncludingGravity` distinto de cero. Chrome en Android sin
  giróscopo entrega un `acceleration` con números calculado con τ = 1/60 s que se come el pulso
  de un choque. En ese caso:
  - se ignora `acceleration` y se deriva de `accelerationIncludingGravity`:
    `ĝ ← α·ĝ + (1 − α)·aIG`, con `α = τ/(τ + dt)`, `τ = 1 s` y `dt` medido entre muestras;
  - `ĝ` se congela mientras `|gTotal − 1| > 0.15`;
  - no se abren episodios hasta que `ĝ` converge (`|‖ĝ‖ − 1 g| < 0.05` durante 1 s después de
    encender o de un cambio de orientación);
  - `giro` no disponible; la horizontal se marca no confiable (maniobras sólo por GPS);
  - la hoja muestra «Sensor sin giróscopo: detección menos precisa».
- Buffers por tiempo, no por cantidad: aceleración ≥ 25 s, velocidades ≥ 60 s. Se mide la
  frecuencia real (`hz_medido`); no se asume `HZ`.

### 2.3 Episodios

- **Disparadores:**
  - (a) una muestra con |a| ≥ `sospechaG`;
  - (b) una caída de velocidad: una lectura confiable cruza `velocidadPosteriorKmh` bajando
    desde una previa ≥ `velocidadPreviaCaidaKmh`. `tPico` es el instante del cruce.
- Por cada muestra se hace sólo una comparación barata; `evaluarEpisodio` corre una vez por
  episodio.
- El episodio queda abierto mientras lleguen muestras ≥ `sospechaG` y **cierra `ventanaPostMs`
  (8 s) después de la ÚLTIMA**, con un tope de 15 s. El disparador (b) cierra a
  `max(ventanaPostMs, 5 s de detención)`.
- **Sub-picos:** cada racha de muestras ≥ `sospechaG` separada de la anterior por más de 300 ms
  se evalúa por su cuenta, con su propio `tPico` y sus propias ventanas. El episodio toma el
  nivel más alto. Todas sus muestras quedan marcadas como analizadas: un golpe no se vuelve a
  detectar al terminar un enfriamiento.
- Mientras una alerta está en `pregunta`, un episodio nuevo se agrega a esa alerta (otro
  episodio de la misma telemetría) y no reinicia la cuenta. Una alerta respondida o vencida no
  absorbe episodios posteriores: uno nuevo abre otra alerta.
- La ventana de datos que se guarda por episodio: aceleración [tPico − 2 s, cierre] y
  velocidades [tPico − 10 s, cierre], lo necesario para que el servidor repita el cálculo.

### 2.4 Señales por sub-pico

| Señal | Definición |
|---|---|
| `pico` | Máximo de |a| en g del sub-pico. |
| `sostenido` | La racha contigua con |a| ≥ `sospechaG/2` que contiene el pico dura ≥ `msSobreUmbral`. |
| `manipulado` | (reemplaza la caída libre) Norma del giro ≥ 300 dps sostenida ≥ 50 ms en [tPico − 700, tPico − 80] ms; **o** `gTotal` < 0.5 sostenido ≥ 50 ms en [tPico − 700, tPico − 30] ms; **o**, sin giróscopo, `gTotal` < 0.8 sostenido ≥ 80 ms en esa ventana. El giro ANTES del golpe delata la mano o una caída; en un choque el teléfono gira después. |
| `sacudida` | Al menos 2 lóbulos ≥ 2 g en [tPico − 1.5 s, tPico − 100 ms]: la periodicidad ya estaba antes del pico. Un soporte que resuena después del golpe no cuenta. |
| `previa` | Máximo de las medianas de 3 lecturas consecutivas en [tPico − 8 s, tPico + 1.5 s]. Incluye el tramo posterior porque el GPS llega atrasado. |
| `ibaAndando` | `previa ≥ velocidadPreviaKmh` (15 km/h). |
| `detenido` | En [tPico + 2 s, tPico + `ventanaPostMs`]: ≥ 2 lecturas ≤ `velocidadPosteriorKmh` (8 km/h) cuyas posiciones no contradicen la detención; **o** desplazamiento neto entre el primer y el último fix ≤ 6 km/h, con ≥ 3 s de base y ambos fixes con `accuracy` ≤ 20 m. Una velocidad 0 con posiciones que avanzan a más de 15 km/h no cuenta (CoreLocation puede informar 0 en movimiento). |
| `siguioAndando` | No `detenido` y la mediana de las últimas 3 lecturas del tramo ≥ max(15, 0.5 · `previa`). |
| `velocidadDisponible` | ≥ 2 lecturas confiables antes y ≥ 2 después. Un hueco de más de 3 s sin fixes no cuenta como 0. |
| `giroBrusco` | Norma del giro ≥ `giroDps`. Se guarda como dato; no decide el nivel. |
| `caidaSinGolpe` | Sólo con el disparador (b): `previa` ≥ `velocidadPreviaCaidaKmh` (30 km/h); ≥ 3 lecturas ≤ 8 km/h; detención confirmada por posiciones (≤ 6 km/h durante ≥ 5 s con fixes de `accuracy` ≤ 30 m); y, con aceleración confiable, la ventana de 600 ms más densa de la horizontal con pasa-bajos < 2 Hz (banda muerta 0.05 g) en [t − 6 s, t + 1 s] da una media ≥ `desaceleracionImposibleG` (1.4 g), sin `manipulado` ni `sacudida`. Una frenada, aun con ABS a 1.1 g, no llega. |

### 2.5 Niveles

Se evalúan en este orden y gana la primera fila que aplica. Las filas 1–7 se aplican a cada
sub-pico de un episodio abierto por el disparador (a); las filas 8–9, al episodio abierto por el
disparador (b). `sacudida` sólo descarta donde la tabla la nombra (sin velocidad, o con el auto
casi quieto): con `ibaAndando` y velocidad disponible, el contexto del vehículo decide, porque la
regla simétrica haría perder choques con soportes que resuenan.

| # | Velocidad | Condición | Nivel |
|---|---|---|---|
| 1 | disponible | `previa` < 10 (auto quieto) | `nada` (límite declarado) |
| 2 | disponible | `sostenido` ∧ ¬`manipulado` ∧ `ibaAndando` ∧ `detenido` | `confirmado` |
| 3 | disponible | `sostenido` ∧ `manipulado` ∧ `ibaAndando` ∧ `detenido` | `sospecha` (nunca confirmado) |
| 4 | disponible | `sostenido` ∧ ¬`manipulado` ∧ `ibaAndando` ∧ `siguioAndando` | `nada` + evento silencioso `golpe_en_marcha` |
| 5 | disponible | `sostenido` ∧ ¬`manipulado` ∧ `ibaAndando` | `sospecha` |
| 6 | disponible | 10 ≤ `previa` < 15 ∧ `pico` ≥ `confirmadoG` ∧ `sostenido` ∧ ¬`manipulado` ∧ ¬`sacudida` | `sospecha` |
| 7 | no disponible | `sostenido` ∧ ¬`manipulado` ∧ ¬`sacudida` | `sospecha` (tope sin velocidad) |
| 8 | cualquiera | `caidaSinGolpe` con aceleración confiable | `sospecha` si la configuración `caida_sin_golpe` es `alerta`; si es `silenciosa` (valor por omisión hasta calibrar), `nada` + evento `caida_silenciosa` |
| 9 | cualquiera | `caidaSinGolpe` sin aceleración confiable | `nada` + evento `caida_silenciosa` |
| 10 | — | ninguna | `nada` |

- `confirmado` no depende de `confirmadoG`: muchos teléfonos Android sólo miden hasta 4 g
  (CDD 7.3.1) y saturan.
- `llamar_emergencias` sigue siendo el literal `false`.
- El veredicto guarda todas las señales, los descartes, `motivo`, los umbrales usados y la
  versión del motor.

### 2.6 Seguimiento del golpe en marcha

Después de un `golpe_en_marcha` (fila 4), durante 90 s:

- Si el auto queda ≤ 8 km/h durante ≥ 10 s, o el GPS pasa a `buscando`/`impreciso`, o hay un
  hueco: se abre la alerta con «Detectamos un golpe hace N segundos».
- Sólo se descarta con evidencia positiva: lecturas confiables ≥ 20 km/h hasta el final de la
  ventana. No saber si el auto anda no cuenta como que siguió andando.
- Un episodio nuevo durante el seguimiento se evalúa por su cuenta.

### 2.7 Maniobras silenciosas (`detectarManiobras`)

El acelerómetro fecha el evento; el GPS lo clasifica.

1. **Longitudinal:** `ĝ` promediado sobre 2 s; `ω = rotationRate · ĝ` (rad/s);
   `aLat ≈ vGPS · ω`; `aLon = √max(0, |h|² − aLat²)` con `h` la horizontal
   (`h = a − (a·ĝ)ĝ`), pasa-bajos de 2 Hz por componente.
2. **Candidato:** `aLon ≥ 0.8 · umbral` durante ≥ 1 s. Si el rumbo acumulado (∫ω) supera 30°,
   se exige además la condición de GPS del punto 3 (rotondas y giros).
3. **Magnitud por GPS dentro de la duración del acelerómetro:**
   `g = (vAntes − vDespués) / dur / 35.3`, con `vAntes` = mediana en
   [tI − 1 s, tI + `retrasoMaxMs`] y `vDespués` = mediana en
   [tF + `retrasoMinMs`, tF + `retrasoMaxMs`]. Frenada si `g ≥ frenadaG` (0.45); aceleración si
   `−g ≥ aceleracionG` (0.40). Además `|Δv_GPS| ≥ 0.6 · ∫aLon` y `vAntes ≥ 20 km/h`.
4. **Sin giróscopo, `ĝ` inestable o sin acelerómetro:** sólo GPS, pendiente sobre 2 s
   ≤ −0.55 g con `vAntes ≥ 20`. Se acepta ver sólo frenadas largas; nunca se descarta por «no
   corrobora».
5. **Absorción:** si hay un episodio de impacto en [tI − `retrasoMaxMs` − 1 s, tF + `ventanaPostMs`],
   la maniobra se absorbe y no se registra.
6. Enfriamiento de 10 s por tipo. `retrasoMinMs`/`retrasoMaxMs` configurables (0 y 3000).

### 2.8 Umbrales

`Umbrales` en `lib/impacto.ts` pasa a tener: `sospechaG` (4), `confirmadoG` (8),
`msSobreUmbral` (30), `velocidadPreviaKmh` (15), `velocidadPreviaCaidaKmh` (30),
`velocidadPosteriorKmh` (8),
`ventanaPostMs` (8000), `topeEpisodioMs` (15000), `giroDps` (180),
`giroManipulacionDps` (300), `desaceleracionImposibleG` (1.4), `frenadaG` (0.45),
`aceleracionG` (0.40), `retrasoMinMs` (0), `retrasoMaxMs` (3000).

- Variables de entorno `IMPACTO_*` y `CONDUCCION_*` en `.env.example`, con el motivo de cada
  número. `IMPACTO_VENTANA_CAIDA_MS` deja de usarse: si está cargada, se escribe una vez en el
  log «IMPACTO_VENTANA_CAIDA_MS ya no se usa: la reemplaza IMPACTO_VENTANA_POST_MS (8000 ms por
  omisión); borrala de las variables del servicio». No se usa como respaldo.
- `validarUmbrales(u)` con rangos (por ejemplo `sospechaG` 2–20, `confirmadoG ≥ sospechaG`,
  `frenadaG` 0.2–1.0). Un valor fuera de rango o `NaN` se reemplaza por el de omisión, se
  loguea al arrancar y lo informa `/api/salud`.

### 2.9 Configuración remota y apagado de emergencia

`GET /api/telemetria/configuracion` devuelve:

```json
{
  "version": "<hash canónico de umbrales + alerta>",
  "umbrales": { },
  "alerta": "normal | silenciosa | apagada",
  "caida_sin_golpe": "alerta | silenciosa",
  "motor_minimo": 1,
  "dias_conservacion": 90
}
```

- Variables: `MODO_VIAJE_ALERTA` (`normal`), `MODO_VIAJE_CAIDA_SIN_GOLPE` (`silenciosa`),
  `MODO_VIAJE_MOTOR_MINIMO` (1), `TELEMETRIA_DIAS_CONSERVACION` (90).
- El motor la pide al encender, al reanudar, al volver visible y cada 10 minutos. Sin red usa la
  guardada si tiene menos de 24 h; si no, los valores del código. Siempre pasa por
  `validarUmbrales`.
- `silenciosa`: detecta y registra, pero no abre alertas. `apagada`: la tarjeta dice «El modo
  viaje no está disponible por ahora» y los motores encendidos se apagan.
  `VERSION_MOTOR < motor_minimo`: «Cerrá y volvé a abrir la aplicación para actualizarla» y no
  alerta.

---

## 3. Experiencia

### 3.1 Tarjeta del inicio

- **Posición:** hijo directo de `main.inicio`, después del enlace condicional «Continuar la
  actuación que dejaste abierta» y antes de `section.bloque-inicio`. Cuando no hay actuación
  abierta queda inmediatamente debajo de la sección del accidente. No depende de ninguna
  consulta.
- **Orden, en el DOM y en lo visual:**
  1. ícono de auto (nuevo en `Iconos.tsx`; números como expresión JSX, `r={2}`, nunca `r="2"`,
     por la trampa de literales de `VALOR`) y «Modo viaje»;
  2. «Funciona sólo con la aplicación abierta y la pantalla encendida.» (conserva el texto
     obligatorio de CONTRATO-UI §12);
  3. «No llama ni le avisa a nadie por su cuenta.»;
  4. aviso de datos corto: «Si detecta un posible choque, manda a tu aseguradora la hora, los
     sensores y la ubicación. Las frenadas bruscas se guardan sin ubicación y sin tu cuenta.
     Es optativo.» con el enlace «Qué datos guarda» (abre la hoja en esa sección);
  5. al final, el interruptor `button role="switch" aria-checked`, abajo a la derecha. Nunca en
     la fila del título.
- **Alto fijo** (`min-height`) en todos los estados, para que la hidratación y los cambios de
  estado no muevan «Continuar la actuación» ni los botones de emergencia. `desconocido` y
  `reanudando` se dibujan con el interruptor deshabilitado.
- **Una línea de estado y una acción.** Textos:

| Estado | Texto | Acción |
|---|---|---|
| apagado | — | interruptor |
| activo | «Activo · detección 12 min» | interruptor |
| activo, `pantalla: sin_retener` | «Tocá la pantalla para que no se apague» | tocar |
| activo, `avisos` requiere toque | «Tocá la pantalla para activar el sonido y la vibración del aviso» | tocar |
| `reanudar_con_toque` | «Tocá para reanudar (el iPhone te vuelve a pedir permiso)» | tocar |
| `sin_permiso` | «Sin permiso de movimiento» | «Cómo habilitarlo» (hoja) |
| `sin_lecturas` | «Este equipo no entrega lecturas de movimiento: el modo viaje funciona en el teléfono» | — |
| `no_soportado` (inseguro) | «Abrí la aplicación desde su dirección https» | — |
| `otra_ventana` | «El modo viaje está abierto en otra ventana» | — |
| apagado por inactividad | «Se apagó solo a las 18:42 porque el auto estuvo detenido» | interruptor |
| apagado por accidente | «Se apagó al registrar el accidente» | interruptor |
| configuración `apagada` | «El modo viaje no está disponible por ahora» | — |
| golpe pendiente (§3.5) | «Golpe detectado 14:32 · Registrar este choque» | registrar |

- Sin `'vibrate' in navigator`, antes de encender: «En este teléfono la alerta no vibra y, en
  silencio, puede no sonar». Con `navigator.audioSession` no se agrega «puede no sonar».
- Siempre, antes de encender: «Con la pantalla encendida y el GPS gasta batería: conviene tenerlo
  enchufado.»
- Las instrucciones para habilitar permisos van en la hoja, no en la tarjeta.

### 3.2 Píldora y hoja de opciones

- **Píldora:** `<button aria-haspopup="dialog" aria-expanded>`, fija abajo al centro respetando
  `env(safe-area-inset-bottom)`. Nombre estable según el estado, escrito en texto (no sólo el
  color del punto): «Modo viaje activo», «Modo viaje en pausa», «Modo viaje: tocá para
  reanudar», «Tocá para activar el sonido del aviso», «¿Terminaste el viaje? Tocá para seguir»,
  «Golpe detectado 14:32». **No muestra la velocidad.** No es `role="status"`.
- Una región `.solo-lectores` con `role="status"` aparte anuncia sólo cambios de estado (pausa,
  reanudación, sin GPS, aviso sin sonido), nunca números.
- **Dónde:** con el modo encendido, en todas las rutas salvo `/`, `/s/*`, `/t/*`, `/c/*`, `/e/*`,
  `/v/*`, `/verificar`, `/panel*`, `/entrar` y `/registro` (`RUTAS_SIN_PILDORA`). En `/` aparece
  sólo si el estado pide una acción y un `IntersectionObserver` indica que la tarjeta no está a la
  vista; nunca se superpone con `.boton-gigante`. El golpe pendiente la muestra aunque el modo
  esté apagado.
- Se oculta mientras un `input`, `textarea` o `select` tiene el foco. Mientras está visible,
  `body` lleva un `data-*` nuevo (sumarlo a la tabla de CONTRATO-UI §3) y `.envoltura` reserva
  `calc(96px + env(safe-area-inset-bottom))` abajo. `.chip-cola` no se toca.
- **Hoja:** `<dialog>` con `showModal()` (la abre un toque; que el atrás la cierre está bien),
  `aria-labelledby`, foco devuelto a la píldora al cerrar. Contenido:
  - estado, velocidad actual, precisión del GPS;
  - «Detección activa 38 de 40 min» y los huecos («Sin detección 2 min: pantalla bloqueada u otra
    aplicación»). La palabra «cobertura» queda reservada para la póliza;
  - permisos, con instrucciones por plataforma:
    - iPhone instalada, movimiento denegado: «Cerrá Acta Digital deslizándola hacia arriba en el
      selector de apps, volvé a abrirla y, al encender, tocá Permitir.»;
    - iPhone en Safari: lo mismo, cerrando Safari por completo;
    - Android, `sin_permiso` o `sin_lecturas`: «Tocá el candado o ⋮ › Configuración del sitio ›
      Sensores de movimiento › Permitir.»;
    - ubicación denegada, por plataforma;
  - límites (§0.5);
  - «Probar la alerta»: suena y vibra 1 s por el mismo camino que la alerta real, dentro del
    gesto (también destraba el audio);
  - «Qué datos guarda» (§5.6);
  - «Borrar mis registros del modo viaje» (`DELETE /api/telemetria/mias`);
  - «Apagar el modo viaje»;
  - «Diagnóstico», visible sólo si `localStorage['acta:diagnostico']` existe: g en vivo, Hz,
    velocidad, precisión, fuente de aceleración, estado de pantalla y audio, últimos 20
    episodios con su motivo.
- Antes de abrir una alerta, el motor cierra la hoja.

### 3.3 Alerta

- **Elemento:** `div role="alertdialog" aria-modal="true"` en la capa del proveedor. **No
  `<dialog>` ni popover:** la abre un sensor, sin activación, y el atrás de Android la cerraría
  sin respuesta. El resto de la app queda `inert`. Escape y atrás no la cierran; un cambio de
  ruta tampoco: la alerta vive en el motor, no en la URL.
- **Estados:** `pregunta` → `hubo_choque` o cerrada; `pregunta` → `ayuda`.
- **`pregunta`:**
  - título «¿Estás bien?» con `tabIndex={-1}`, que recibe el foco al abrir;
  - «Detectamos un posible choque a las 14:32.» (o «Detectamos un golpe hace N segundos.» desde
    el seguimiento §2.6);
  - «La aplicación no llama sola a emergencias. Si no respondés, al llegar a cero te mostramos
    los teléfonos para llamar.»;
  - cuenta de 30 s calculada contra un plazo de pared, en la clase nueva `.alerta-viaje-cuenta`
    (`.contador` ya existe y lo usa el recorrido). El número no es región viva; una región
    `.solo-lectores aria-live="assertive" aria-atomic="true"` anuncia sólo en 20, 10 y 5;
  - `aria-labelledby` al título y `aria-describedby` a una frase fija sin la cuenta;
  - botones apilados de al menos 60 px de alto: «Estoy bien» arriba, «Necesito ayuda» abajo;
  - durante los primeros 600 ms los botones no reciben toques
    (`.alerta-viaje:not([data-armada]) .boton { pointer-events: none }`); `data-armada` se suma
    a la tabla de CONTRATO-UI §3.
- **Aviso físico al abrir:**
  1. si existe, `navigator.audioSession.type = 'playback'` (la sesión `auto` de un AudioContext
     queda en `ambient` y la llave de silencio la enmudece);
  2. `ctx.resume()` sin esperar un toque (WebKit ya quitó la restricción en ese documento; Chrome
     acepta la activación sticky);
  3. tono de pulsos que sube de volumen en los últimos 15 s;
  4. `navigator.vibrate(patrón)` repetido; se ignora el `false`;
  5. si tras `resume()` el contexto no está `running` en 500 ms, se guarda `sonido: false` en la
     telemetría;
  6. refuerzo visual sin superar 3 destellos por segundo; con `prefers-reduced-motion`, color
     fijo. La animación se suma al bloque de reduced-motion de `globals.css`.
- **Al responder, vencer o cerrar:** detener el tono, `navigator.vibrate(0)`,
  `audioSession.type = 'auto'`, `ctx.suspend()`. La alerta pasa de estado de forma sincrónica,
  antes de cualquier navegación.
- **«Estoy bien»** → respuesta `estoy_bien`. Después:
  - auto detenido o sin velocidad confiable → estado `hubo_choque`: «¿Hubo un choque?» con
    [Sí, registrar el accidente] y [No, fue una falsa alarma], y `BotonesEmergencia` chicos
    debajo. Sin tono ni cuenta. Sin respuesta en 60 s se cierra y queda golpe pendiente (§3.5);
  - auto en movimiento → se cierra y queda golpe pendiente.
- **«Necesito ayuda»** → `necesito_ayuda` → estado `ayuda`. **Vence la cuenta** → `sin_respuesta`
  → estado `ayuda`. No se navega.
- **Apaisado:** `overflow-y: auto; overscroll-behavior: contain`; con
  `@media (max-height: 480px)`, dos columnas (título y cuenta a un lado, botones al otro) y
  `env(safe-area-inset-left/right)`.
- Mientras hay alerta, la pregunta de inactividad no se muestra.

### 3.4 Ayuda (`AyudaImpacto`)

La usan la alerta en estado `ayuda` y `/aviso`.

- Título según el origen: «Pediste ayuda» o «No respondiste». Nunca repite «¿Estás bien?».
- `BotonesEmergencia`. Tocar un `tel:` registra `necesito_ayuda` si todavía no había una respuesta
  humana, antes de dejar seguir el enlace.
- **Contacto de confianza** (si se leyó con sesión): «Llamar a <nombre>» (`tel:`) y, al lado, el
  texto obligatorio «La aplicación no llama ni manda mensajes por su cuenta». Sin contacto
  cargado, no se muestra.
- **«Compartir mi ubicación»:** el enlace `https://www.google.com/maps/search/?api=1&query=LAT,LON`
  se arma ANTES del toque con el último fix. En el `onClick`, sin nada con `await` antes,
  `navigator.share({ text, url })`. `AbortError` no hace nada; el portapapeles se usa sólo si no
  hay `share` o `navigator.canShare?.(datos) === false`. Sin ubicación, el botón no aparece y se
  dice «No hay ubicación: el GPS estaba apagado».
- **«Registrar el accidente»:**
  - si hay una actuación abierta en el teléfono (`actuacionAbierta()`), el botón dice «Continuar
    la actuación abierta» y navega a ella;
  - si no: sube lo pendiente de la cola de esa alerta (con `await`) y hace
    `POST /api/casos { telemetria_id }` con el id del servidor; `recordarActuacion(id, secreto)`;
    apaga el modo viaje con motivo `accidente_registrado`; navega a `/s/<id>`;
  - sin red: «Sin señal: la lectura queda guardada en el teléfono. Llamá desde los botones de
    arriba y registralo cuando vuelva la señal.»;
  - `vinculo_telemetria: 'rechazado'` no bloquea: la actuación se abrió igual.
- **«Estoy bien, fue una falsa alarma»** → `estoy_bien` + `hubo_choque = false`; cierra.
- **Persistencia:** el estado `ayuda` se guarda en localStorage. Si el sistema cierra la PWA
  durante una llamada, al reabrir vuelve a mostrarse si pasaron menos de 30 minutos y no hay
  `estoy_bien`.
- Si el auto vuelve a andar (media de 30 s ≥ 15 km/h) con la ayuda abierta, la capa se reduce a
  golpe pendiente en la píldora: no se tapa la pantalla a alguien que maneja.
- Mientras la ayuda está abierta no se abren alertas nuevas.
- **`/aviso`:** no escribe nada al montar. Toma la alerta del motor (o la guardada) si coincide con
  `?t=`; si no, `GET /api/telemetria/[id]`. «Estoy bien, fue una falsa alarma» vuelve con
  `router.back()` si el motor hizo el `push` a `/aviso` en este documento, o con
  `router.replace('/')` si no. Nunca `push('/')`.

### 3.5 Golpe pendiente

- `acta:golpe-pendiente { telemetriaIdCliente, telemetriaId?, ocurridoEn }` en localStorage,
  vigente 30 minutos. Sobrevive a la recarga y al apagado del modo.
- Lo muestran la tarjeta (aunque el modo esté apagado) y la píldora: «Golpe detectado 14:32 ·
  Registrar este choque», que abre la actuación vinculada como en §3.4.
- Se borra con «No, fue una falsa alarma», al vincularse o al vencer.
- La pregunta de inactividad no apaga el modo sin haber mostrado antes un golpe pendiente.

### 3.6 Rutas

- **Pausa** (`RUTAS_EN_PAUSA`): `/s/*`. Se quita `devicemotion`, no se abren episodios, se sueltan
  el GPS y el wake lock, se conserva la intención y el latido sigue. La pausa cuenta como hueco de
  detección. Una alerta ya abierta sigue.
- **En el resto** el motor escucha si hay intención, y la alerta puede aparecer en cualquier
  ruta. Una pantalla nueva nace cubierta.
- «Tuve un accidente» del inicio no cambia (cuerpo vacío, sin preguntas) pero apaga el modo viaje
  con motivo `accidente_registrado` antes del `fetch`, descartando los episodios abiertos.

### 3.7 Textos que cambian fuera del modo viaje

- `app/page.tsx:159-160`: hoy dice «Los datos se usan sólo para documentar este siniestro ante tu
  aseguradora». Pasa a acotarse a la denuncia («Si registrás un accidente, vamos a pedirte permiso
  de ubicación, cámara y micrófono…») y a remitir al aviso del modo viaje para esa función.
- `app/perfil/page.tsx:143-145`: «A quién vas a poder llamar con un toque desde la pantalla de
  ayuda si el teléfono detecta un golpe.» (se quita «y no respondés», que contradice el aviso de
  §12 que está debajo).
- CONTRATO-UI §12 suma: «No llama ni le avisa a nadie por su cuenta» (tarjeta), «La aplicación no
  llama sola a emergencias» (alerta), el aviso de datos del modo viaje (tarjeta y hoja), y registra
  que «La aplicación no llama ni manda mensajes por su cuenta» también está en la ayuda.
- CONTRATO-UI: íconos pasan de once a doce.

---

## 4. Ciclo de vida

### 4.1 Encender (`onClick`, nunca `pointerdown`)

1. **Antes del toque, al dibujar:** si `!window.isSecureContext` o
   `typeof DeviceMotionEvent === 'undefined'`, `no_soportado` con motivo y sin interruptor.
2. **Sincrónico, en este orden y sin ningún `await` antes** (ni `import()` dinámico, ni `fetch`,
   ni almacenamiento asíncrono): en WebKit el wake lock sólo se concede con activación transitoria
   (5 s) o si ese documento ya lo obtuvo, y los diálogos del sistema consumen ese margen.
   1. `const lock = navigator.wakeLock?.request('screen')`;
   2. crear el `AudioContext`, `resume()`, reproducir un búfer silencioso de una muestra y después
      `suspend()`: queda destrabado sin retener la sesión de audio (la música sigue);
   3. `const mov = DeviceMotionEvent.requestPermission?.()`.
3. `await mov`:
   - `'granted'` o sin función → sigue;
   - `'denied'` (WebKit lo resuelve, no lo rechaza, cuando la negativa quedó en memoria) →
     `sin_permiso`, se libera el sentinel obtenido;
   - rechazo `NotAllowedError` → `reanudar_con_toque`.
4. `await lock` → `pantalla: retenida`, o `sin_retener` si rechazó. No condiciona `activo`.
5. `watchPosition({ enableHighAccuracy: true, maximumAge: 0 })` recién ahora (la geolocalización
   no exige gesto y así no se apilan dos diálogos). Error 1 → `clearWatch`, `gps: sin_permiso`.
   Sin fix por más de 5 s → `gps: buscando`; no se muestra ninguna velocidad de más de 5 s.
6. Pedir la configuración (§2.9) sin bloquear.
7. Esperar lecturas válidas durante 3 s contados desde que resolvió el permiso. Sin lecturas →
   `sin_lecturas`, se borra la intención y se guarda `acta:viaje:sin-sensores`.
8. Con lecturas válidas: `activo` y recién ahí se guarda la intención.

### 4.2 Estado

```
fase: desconocido | reanudando | apagado | pidiendo | activo | en_pausa
      | reanudar_con_toque | sin_permiso | sin_lecturas | no_soportado | otra_ventana
gps: ok | buscando | impreciso | sin_permiso | requiere_toque | no_aplica
pantalla: retenida | sin_retener | no_garantizada | no_soportada
avisos: { sonido: listo | requiere_toque, vibracion: listo | requiere_toque | no_soportada }
fuente: confiable | derivada
alerta: null | { estado: pregunta | hubo_choque | ayuda, idCliente, idServidor?, plazo,
                 ocurridoEn, origenAyuda?, respuestas }
inactividad: null | { preguntandoDesde }
golpePendiente: null | { … }
apagadoPor: null | { motivo: usuario | inactividad | accidente_registrado | configuracion, hora }
deteccion: { activaMs, totalMs, huecos }
configuracion: { version, alerta, caidaSinGolpe, umbrales }
```

- `ESTADO_SERVIDOR` = `{ fase: 'desconocido', … }` congelado.
- Al crearse en el cliente, el motor lee la intención de forma sincrónica y arranca en
  `reanudando` si hay una vigente.

### 4.3 Reanudar

- **Intención guardada** (`acta:viaje`): `{ encendidoEn, ultimoLatido, ultimoMovimiento,
  documentoId }`. El latido se escribe cada 30 s sólo desde el documento visible y activo o en
  pausa por ruta.
- `ultimoLatido` de menos de 30 minutos → reanudar; más viejo → se descarta la intención.
- **Sin gesto:**
  - `requestPermission()`: `granted` sigue; `NotAllowedError` → `reanudar_con_toque`; `'denied'`
    → `sin_permiso` y se borra la intención;
  - GPS sólo si `navigator.permissions.query({ name: 'geolocation' })` da `granted`; si no,
    `gps: requiere_toque` y se detecta con el acelerómetro;
  - wake lock: se intenta; en iPhone se espera el rechazo → `pantalla: sin_retener`;
  - audio y vibración quedan `requiere_toque` hasta el primer toque.
- **Destrabador global:** listeners en `pointerup`, `touchend`, `click` y `keydown`, en captura
  y `passive`, sobre `window`. Nunca `pointerdown` (con el dedo no activa). Dentro del handler,
  sin `await` antes: `wakeLock.request` si falta el sentinel y el destrabe del audio. Nunca llama
  a `requestPermission` ni a `watchPosition`. Se quitan cuando pantalla y audio están listos; se
  vuelven a poner con el `release` del sentinel o si el audio deja de estar listo.
- **`reanudar_con_toque`:** el toque en la tarjeta o la píldora ejecuta `reanudar()` con el mismo
  orden sincrónico que §4.1 (incluye `requestPermission` y después `watchPosition`).
- **`visibilitychange → visible`:** volver a pedir el wake lock, revisar el audio, tratar el
  hueco (§2.1), pedir la configuración.
- **`release` del sentinel con la página visible** y sin poder recuperarlo: `pantalla:
  sin_retener` y «La pantalla se puede apagar sola (ahorro de batería). Enchufalo o desactivá el
  ahorro.».
- **iOS instalada anterior a 18.4** (standalone por `matchMedia('(display-mode: standalone)')` o
  `navigator.standalone`, y versión de la UA `iPhone OS 1x_y` < 18.4): `pantalla:
  no_garantizada` y «En esta versión de iOS la pantalla se apaga sola: actualizá o poné Bloqueo
  automático en Nunca mientras manejás.».
- **Varias ventanas:** `navigator.locks.request('acta-modo-viaje', { ifAvailable: true })`; sin
  candado → `otra_ventana`. El evento `storage` sobre `acta:viaje`: si otra ventana borra la
  intención, el motor se apaga sin volver a escribirla.

### 4.4 Inactividad

- Movimiento confiable: media móvil de 60 s ≥ 5 km/h con GPS; sin GPS, varianza del
  acelerómetro por encima de un umbral. `ultimoMovimiento` por reloj de pared, persistido.
- A los 15 minutos sin movimiento, en una ruta donde se ve la tarjeta o la píldora, y sin alerta
  ni golpe pendiente sin mostrar: estado `inactividad` («¿Terminaste el viaje? Tocá para
  seguir») y un pulso corto de sonido si el audio está listo. El motor sigue detectando.
- Plazo de 10 minutos. Cuenta como «seguir»: tocar la píldora o la tarjeta, o que la media de
  30 s llegue a ≥ 15 km/h («Seguimos: el auto volvió a moverse»).
- Al vencer sin respuesta ni movimiento: apagar con `apagadoPor: inactividad`.
- Al reanudar tras una pausa larga, si ya pasaron más de 15 minutos desde `ultimoMovimiento`,
  la pregunta aparece enseguida.

---

## 5. Servidor y datos

### 5.1 Posesión

- `huellaDispositivo(proposito: 'telemetria' | 'conduccion', crear: boolean)` en
  `lib/posesion.ts`: `hashToken(proposito + ':' + token)` sobre la cookie `acta_posesion` que ya
  existe (httpOnly, 2 años). Con `crear`, emite la cookie si falta. No hay token en localStorage
  ni cabecera propia. La separación por propósito evita cruzar en la base las posesiones de
  actuaciones con el historial de conducción.
- Reglas de acceso a una telemetría:
  - fila sin `usuario_id`: la misma huella;
  - fila con `usuario_id`: la misma huella dentro de las 24 h desde `recibido_en`, o la sesión
    de ese usuario;
  - productor y aseguradora no leen telemetría ni eventos de conducción en esta etapa.
- «No existe» y «no es tuya» responden el mismo 404: «No encontramos esa detección en este
  teléfono. Si ya no la tenés, abrí la actuación con "Tuve un accidente".».
- `Cache-Control: no-store` en toda respuesta con ubicación.
- Iniciar sesión no reasigna filas anónimas. Cerrar sesión no apaga el modo; las próximas
  lecturas quedan sin cuenta.
- `usuario_id` de la telemetría se anota si hay sesión. Los eventos de conducción nunca llevan
  `usuario_id`.

### 5.2 Esquema (en `SCHEMA` de `lib/db.ts`)

**Regla para constraints sobre tablas existentes** (anotarla como comentario en `SCHEMA`):
nombre versionado dentro de un bloque `DO` con guarda, `NOT VALID` y
`EXCEPTION WHEN duplicate_object`. Nunca `ADD CHECK` sin nombre (se duplica en cada arranque)
ni un CHECK dentro de `ADD COLUMN IF NOT EXISTS` sobre una columna existente (se ignora).
`SCHEMA` corre como una sola consulta: un error revierte todo y deja caída la app. Para cambiar
la lista: `_v2` y `DROP CONSTRAINT IF EXISTS … _v1` en el mismo bloque.

```sql
DO $c$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'telemetria_respuesta_valida_v1'
                   AND conrelid = 'telemetria'::regclass) THEN
    ALTER TABLE telemetria ADD CONSTRAINT telemetria_respuesta_valida_v1
      CHECK (respuesta IN ('estoy_bien','necesito_ayuda','sin_respuesta')) NOT VALID;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $c$;
```

**`telemetria` es la alerta.** Columnas nuevas (`ADD COLUMN IF NOT EXISTS`):

| Columna | Tipo | Notas |
|---|---|---|
| `id_cliente` | TEXT | UUID generado por el motor al abrir la alerta |
| `dispositivo_sha256` | TEXT | huella de propósito `telemetria` |
| `ocurrido_en_telefono` | TIMESTAMPTZ | hora del primer pico según el teléfono |
| `enviado_en` | TIMESTAMPTZ | sellado en cada intento de envío |
| `recibido_en` | TIMESTAMPTZ DEFAULT now() | hora del servidor; cuenta la retención |
| `desfase_reloj_ms` | BIGINT | `recibido_en − enviado_en` |
| `nivel_cliente` | TEXT | nivel que decidió el teléfono |
| `veredicto_cliente` | JSONB | |
| `umbrales` | JSONB | los del servidor al recalcular |
| `umbrales_cliente` | JSONB | |
| `respuestas` | JSONB NOT NULL DEFAULT '[]' | historial `{ respuesta, en_telefono, recibido_en }` |
| `hubo_choque` | BOOLEAN | aparte de la respuesta de salud |
| `ms_hasta_respuesta` | INTEGER | |
| `sonido` | BOOLEAN | si el tono llegó a sonar |
| `alerta_mostrada` | BOOLEAN | `false` con la configuración `silenciosa` |
| `version_motor` | INTEGER | |
| `plataforma` | TEXT | `ios` · `android` · `otro` |
| `standalone` | BOOLEAN | |
| `hz_medido` | REAL | |
| `aceleracion_derivada` | BOOLEAN | |
| `gps_precision_m` | REAL | |
| `aviso_version` | TEXT | versión del aviso de datos que vio la persona |

Índices: `CREATE UNIQUE INDEX IF NOT EXISTS telemetria_cliente_uidx ON telemetria
(dispositivo_sha256, id_cliente) WHERE id_cliente IS NOT NULL`; `telemetria_caso_idx
(caso_id)`; `telemetria_purga_idx (ts) WHERE caso_id IS NULL`.

`nivel` y `pico_g` pasan a ser el máximo de los episodios. `gps` guarda
`{ lat, lon, precision_m }` del fix más cercano al primer pico.

**Nueva `telemetria_episodios`:**

```sql
CREATE TABLE IF NOT EXISTS telemetria_episodios (
  id                    TEXT PRIMARY KEY,
  telemetria_id         TEXT NOT NULL REFERENCES telemetria(id) ON DELETE CASCADE,
  n                     INTEGER NOT NULL,
  ocurrido_en_telefono  TIMESTAMPTZ,
  recibido_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  serie                 JSONB,
  velocidades           JSONB,
  veredicto             JSONB NOT NULL,
  veredicto_cliente     JSONB,
  recortada             BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS telemetria_episodios_n_uidx ON telemetria_episodios (telemetria_id, n);
```

`serie` y `velocidades` se guardan sólo si el veredicto del servidor o el del cliente es
`sospecha` o `confirmado`.

**Nueva `eventos_conduccion`** (sin `usuario_id` ni `gps`):

```sql
CREATE TABLE IF NOT EXISTS eventos_conduccion (
  id                    TEXT PRIMARY KEY,
  id_cliente            TEXT NOT NULL,
  dispositivo_sha256    TEXT NOT NULL,
  tipo                  TEXT NOT NULL,
  ocurrido_en_telefono  TIMESTAMPTZ,
  recibido_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
  kmh_inicial           REAL,
  kmh_final             REAL,
  duracion_ms           INTEGER,
  g_estimada            REAL,
  pico_g                REAL,
  version_motor         INTEGER,
  plataforma            TEXT,
  aviso_version         TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS eventos_conduccion_cliente_uidx ON eventos_conduccion (dispositivo_sha256, id_cliente);
CREATE INDEX IF NOT EXISTS eventos_conduccion_purga_idx ON eventos_conduccion (recibido_en);
```

Con su constraint en bloque `DO`: `eventos_conduccion_tipo_valido_v1`, `tipo IN ('frenada',
'aceleracion','golpe_en_marcha','caida_silenciosa')`.

`TABLAS` suma `telemetria_episodios` y `eventos_conduccion`.

**Filas viejas:** hora = `coalesce(ocurrido_en_telefono, ts)`; `gps.precision_m` opcional; una
fila sin `dispositivo_sha256` sólo se lee o vincula con la sesión de su `usuario_id`; sin dueño,
404.

### 5.3 Endpoints

Todos exportan `runtime` y `dynamic`, terminan su `catch` en `errorApi`, leen el cuerpo con
`leerCuerpoLimitado`, y sus errores dicen qué arreglar. Ninguno registra eslabones de la cadena
salvo el alta de la actuación. Sin Server Actions.

**`leerCuerpoLimitado(req, maxBytes)`** (`lib/api.ts`): 413 si `Content-Length` ya supera el
máximo; si no, `req.body.getReader()` sumando bytes, `cancel()` y 413 apenas se pasa;
`TextDecoder('utf-8', { fatal: true })`; `JSON.parse`; 400 si no es JSON. El 413 dice el máximo.
El cliente manda siempre un string como cuerpo, para que haya `Content-Length`.

**`lib/limite.ts`:** ventana deslizante en memoria por clave. IP desde `x-forwarded-for`
contando `PROXY_SALTOS_CONFIABLES` (1 por omisión) desde el final; si no se puede determinar,
no limita por IP. Topes por minuto y por hora, por IP y por huella. 429 con `Retry-After` y
«Se mandaron demasiadas lecturas desde este teléfono. Esperá N segundos.». Documentado: se
reinicia con cada despliegue y no frena a un atacante decidido; es una primera barrera y protege
contra un cliente propio en bucle.

| Método y ruta | Cuerpo máx. | Qué hace |
|---|---|---|
| `GET /api/telemetria/configuracion` | — | §2.9. Crea la cookie de posesión si falta (así los pedidos siguientes no compiten por crearla). |
| `POST /api/telemetria` | 128 KB | Upsert de la alerta y, opcionalmente, UN episodio. Ver abajo. |
| `GET /api/telemetria/[id]` | — | Para `/aviso`: `ocurrido_en`, `nivel`, `gps`, `respuesta`, `hubo_choque`. Posesión, `no-store`. |
| `POST /api/telemetria/[id]/respuesta` | 2 KB | Respuesta por id del servidor (usada por `/aviso`). Posesión. Misma fusión que el upsert. Devuelve `plan`. |
| `DELETE /api/telemetria/mias` | — | Borra la telemetría sin `caso_id` de esta huella (o de la sesión) y los eventos de conducción de esta huella. Devuelve cuántas filas. |
| `POST /api/conduccion` | 8 KB | Lote de hasta 50 eventos; idempotente por `(dispositivo_sha256, id_cliente)`. |
| `POST /api/casos` | (existente) | Acepta `telemetria_id` opcional. Ver abajo. |

**`POST /api/telemetria`:**

- Transporte compacto: `{ campos, serie: [[t, ax, ay, az, gTotal, giro], …] }` con 3 decimales,
  y velocidades `[[t, kmh|null, precision_m, x, y], …]`. El servidor lo expande a `Lectura[]`.
- Validación que **reconstruye** desde una lista cerrada de campos: `typeof v === 'number' &&
  Number.isFinite(v)` (nunca `Number()`: `Number(null)` da 0), `|a| ≤ 50 g`, `0 ≤ kmh ≤ 300`,
  `0 ≤ precision_m ≤ 10000`, `t` creciente, ≤ 1000 muestras, lat/lon en rango. 400 con campo y
  posición: «serie[37].ax no es un número». Sólo se guarda lo reconstruido (evita anidamiento
  profundo y claves extra).
- Recorte: nada de `slice(0, MAX)` ni `slice(-MAX)`. El cliente recorta alrededor del pico. Si
  igual llega más de lo permitido, el servidor recorta simétrico alrededor del pico y marca
  `recortada: true`, con log.
- Hora: `ocurrido_en_telefono` se acepta si, corregida por el desfase, cae entre 24 h antes y
  5 minutos después del servidor; si no, se guarda null y se loguea.
- Upsert por `(dispositivo_sha256, id_cliente)`. Fusión de respuestas en una sola sentencia:
  - una respuesta humana (`estoy_bien`, `necesito_ayuda`) se escribe siempre y se agrega a
    `respuestas`;
  - `sin_respuesta` sólo si `respuesta IS NULL`;
  - `hubo_choque` se escribe si viene.
- Episodio: upsert por `(telemetria_id, n)`. `evaluarEpisodio` con los umbrales del servidor; se
  guardan los dos veredictos. `nivel` y `pico_g` de la alerta = máximo de sus episodios.
- Responde `{ id, nivel, plan }`.
- Después de responder, dentro de `after()` (`next/server`), la purga oportunista (§5.5) como
  mucho una vez por hora por proceso, en try/catch que sólo loguea.

**`planEscalamiento(veredicto, respuesta)`:** `respuesta: 'estoy_bien' | 'necesito_ayuda' |
'sin_respuesta' | null`, con `switch` exhaustivo que lanza ante un valor desconocido (así un
`planEscalamiento(v, true)` viejo en el `.mjs` falla fuerte).

- `necesito_ayuda` → escala siempre, con cualquier nivel;
- `estoy_bien` → no escala;
- `sin_respuesta` → escala según el nivel más alto entre servidor y cliente; `nada` con alerta
  mostrada escala igual;
- `null` → no escala todavía.
- El campo `avisarContactoDeConfianza` se renombra `ofrecerContactoDeConfianza`: la aplicación
  ofrece llamar, no avisa.

**`POST /api/casos` con `telemetria_id`** (función en `lib/casos.ts`,
`abrirActuacionDesdeImpacto(cliente, …)`):

1. `BEGIN`.
2. `SELECT … FROM telemetria WHERE id = $1 FOR UPDATE`, y comprobar la posesión (§5.1). El lock
   hace que dos pedidos simultáneos vayan en fila.
3. Si no existe o no hay posesión: se sigue sin vínculo (pasos 4 y 6 sin datos del impacto) y la
   respuesta lleva `vinculo_telemetria: 'rechazado'`. Mismo resultado para los dos casos. Nunca
   403 ni 500 por el vínculo.
4. Si ya tiene `caso_id`: camino repetido. Rotar `casos.secreto_sha256` con un secreto nuevo (no
   escribe eslabón), `COMMIT`, `anotarPosesion(caso_id)`, 200
   `{ id, secreto, ya_registrada: true }`.
5. Número: `INSERT INTO casos (…, origen) VALUES (…, 'impacto') ON CONFLICT (id) DO NOTHING
   RETURNING id` en el bucle de 5 intentos. Sin `SAVEPOINT`: `ON CONFLICT` no aborta la
   transacción (un 23505 dentro de `BEGIN` dejaría 25P02 en el reintento).
6. `UPDATE telemetria SET caso_id = $1 WHERE id = $2 AND caso_id IS NULL`; comprobar que afectó
   1 fila.
7. `registrarEvento(id, 'apertura_actuacion', { user_agent, origen: 'impacto', telemetria_id,
   nivel, pico_g, ocurrido_en_telefono: <ISO string o null>, desfase_reloj_ms: <número o null> },
   { cliente, reservado: { poliza, patente } })`. **Sólo primitivas**: un `Date` o un `undefined`
   en el detalle rompen la verificación para siempre (`canonico` convierte un Date en `{}` y
   `JSON.stringify` en texto). Sin ubicación ni velocidades en el detalle.
8. `COMMIT`. Después, `anotarPosesion(id)` (usa otra conexión; la clave foránea necesita la fila
   confirmada). 201 `{ id, secreto, vinculo_telemetria: 'ok' }`.

- No se escribe `casos.gps` con el punto del impacto: si existe, `Flujo.tsx` no pide la
  ubicación y se pierden la dirección, el clima y el eslabón `ubicacion_registrada`.
- Una respuesta a una telemetría ya vinculada nunca registra eslabones (regla 6); a lo sumo
  `anotarEnBitacora`.

**`aJsonPuro(v)`** en `lib/hash.ts`: `v === undefined ? null : JSON.parse(JSON.stringify(v))`.
Se aplica al detalle dentro de `hashEvento` y en `registrarEvento` antes del hash y del INSERT
(también al `reservado`), y en `registrarGestion`. No cambia ningún hash existente.

### 5.4 Cola de viaje (`lib/cola-viaje.ts`)

- IndexedDB, base `acta-viaje`, separada de `acta-cola`. Se escribe ANTES del envío.
- Entradas: alerta (metadatos + respuestas + `hubo_choque`), episodio (`idCliente`, `n`, datos
  compactos), lote de eventos de conducción.
- Tope: 20 entradas o 2 MB. Se descarta primero lo ya subido y los eventos de conducción; nunca
  una alerta con `sin_respuesta` o `necesito_ayuda` pendiente.
- Drenado de a un pedido por vez, la alerta antes que sus episodios. Reintento con retroceso;
  un 4xx distinto de 429 no se reintenta y se loguea. Toma
  `navigator.locks.request('acta-viaje-drenado', { ifAvailable: true })` donde exista.
- La drena el proveedor (§1.2), con el modo encendido o apagado.

### 5.5 Retención

- `purgarTelemetria(ejecutar)` en `lib/retencion.ts`, separada de `candidatos()` (que devuelve
  `[]` con la configuración por omisión):
  - `aplicarPolitica` la llama siempre, después de expurgos y anonimizaciones, y devuelve
    `telemetria: { alertas, eventos_conduccion }` también en simulación (con `COUNT`);
  - borra por lotes con SQL válido: `DELETE FROM telemetria WHERE id IN (SELECT id FROM
    telemetria WHERE caso_id IS NULL AND ts < now() - make_interval(days => $1) ORDER BY ts
    LIMIT 500)`; lo mismo para `eventos_conduccion` por `recibido_en`. Nunca por la hora del
    teléfono;
  - `TELEMETRIA_DIAS_CONSERVACION` (90), documentado en `.env.example` como provisional: no es
    evidencia de ningún expediente.
- Purga oportunista desde `POST /api/telemetria` y `POST /api/conduccion` (§5.3), porque no hay
  planificador propio.
- Con `hubo_choque = false`: `gps` en NULL y `serie`/`velocidades` de sus episodios en NULL.
- `anonimizar` y `expurgar`: `DELETE FROM telemetria WHERE caso_id = $1` en la misma
  transacción (en `expurgar`, antes del `DELETE` de `casos`). La fila no está en ninguna preimagen
  de hash, así que borrarla no altera la verificación.
- **Preguntas para el abogado** (no bloquean): plazo de las alertas `sin_respuesta` y
  `necesito_ayuda` sin vincular; identidad y domicilio del responsable para el aviso.

### 5.6 Aviso de datos (Ley 25.326, art. 6)

- **En la tarjeta, antes de encender** (§3.1): qué se manda, a quién, que es optativo.
- **«Qué datos guarda»** en la hoja:
  - finalidad: avisarte y documentar un siniestro; las frenadas y golpes en marcha, sólo para
    ajustar el detector;
  - destinatario y responsable: la aseguradora (texto del responsable a completar con el abogado);
  - que es optativo y se apaga con un toque;
  - consecuencias: las frenadas no se asocian a tu cuenta ni a tu póliza;
  - conservación: los días de `dias_conservacion`, salvo el golpe con el que registres un
    accidente;
  - derechos de acceso, rectificación y supresión, y cómo ejercerlos: «Borrar mis registros del
    modo viaje» en este teléfono, o el canal de la aseguradora si se borraron los datos del
    navegador.
- `AVISO_DATOS_VERSION` en `lib/viaje.ts`; viaja en cada alta; el servidor la valida contra las
  versiones conocidas y responde 400 si no la reconoce.

---

## 6. Pruebas

Antes de terminar cada fase: `npm run contrato && npm run tipos && npm run prueba`.

### 6.1 Lógica pura (`scripts/prueba-logica.mjs`)

- **Banco de simulación** portado del anexo a `scripts/banco-impacto.mjs`, sin dependencias y
  con PRNG de semilla fija (reemplazar los `Math.random()` de `escenas.mts`):
  - sensor: recorte ±4 g y ±8 g, pasa-bajos del HAL, 60 Hz con fase aleatoria, soporte
    resonante;
  - GPS: 1 Hz con fase aleatoria, retraso 1–3 s y pasa-bajos, ruido ±3–5 km/h, modo iOS
    (velocidad null y posiciones AR(1)), huecos, velocidad 0 espuria, desfase de reloj,
    suspensión.
- ≥ 50 ensayos por escena. Afirma tasas: choques ≥ 95 % con alerta; falsos positivos ≤ 2 %;
  ciudad 0 alertas por hora; frenadas de 0.5–0.8 g detectadas ≥ 95 %; frenadas de 0.30–0.35 g
  registradas ≤ 5 %.
- **Escenas obligatorias:**
  - falsos positivos: sacudida con la mano (3–5 Hz, ±5–10 cm) con y sin GPS; dos pozos con
    soporte resonante a 35 y 50 km/h; lomo de burro con soporte flojo; caída del soporte con el
    auto a 27 y 50 km/h; tirón de acompañante que decae; portazo estacionado; tiro al asiento y
    a la consola con y sin GPS (5 g y 12 g); golpe contra la consola a 27 km/h; velocidad 0
    espuria 6 s a 60 km/h; fixes que dejan de llegar a 60 km/h; 1 h de ciudad;
  - choques: 12 g y 6 g con 55→0; 6 g a 40 km/h 4, 6 y 8 s después de salir de un semáforo con
    retraso de 0, 1 y 2 s; crucero a 20 y 25 km/h; 50→0 con retraso de 3 s y τ 1.5 s; iOS con
    ρ 0.8; sensor de ±4 g; soporte de 6 Hz ζ 0.05 con y sin GPS; teléfono despedido por el
    choque; cae del soporte y choca 2, 4 y 6 s después; trompo de 350 dps con 60→0; vuelco;
    choque que sigue rodando 3 s a 12 km/h; roce a 100 km/h que patina a 0; 60→35 que rueda a
    0.05 g (alerta); 60→35 que sigue a 35 (sin alerta, `golpe_en_marcha`);
  - relojes: suspensión de 25, 60 y 120 s antes del choque (mismo veredicto); hora GNSS corrida
    8 s y reloj del equipo +300 s; fix en caché de 2 min al reanudar (se descarta);
  - caída sin golpe: detenciones blandas de 1.6–2.5 g (sospecha con `alerta`); frenadas con ABS
    de 1.0 y 1.1 g (nada); frenada de 0.7 g seguida de detención blanda;
  - maniobras: 0.65 g 60→30 que sigue andando (detectada); 0.35–0.4 g con ruido ±3 y ±5 (no);
    rotonda a 0.45 g lateral seguida de parada (no); sin giróscopo (ruta sólo GPS); choque 50→0
    (absorbido, sin frenada); barrido de retraso 0–3 s y desfase ±1 s;
  - fuente derivada: pulso de 10 g y 80 ms pasado por la fusión de Chromium con `rotationRate`
    null (se detecta con aIG).
- **Límites declarados como prueba:** alcance trasero de 3 g con el auto detenido → `nada`.
- `evaluarEpisodio` da el mismo nivel en el motor y sobre el cuerpo exacto que el motor manda al
  servidor, incluida la caída sin golpe.
- `planEscalamiento` con cada respuesta; actualizar a mano `scripts/prueba-logica.mjs:812-813`.
- `validarUmbrales` con `NaN` y fuera de rango.
- `hashEvento(detalle con Date y undefined) === hashEvento(aJsonPuro(detalle))`, y hashes de
  detalles JSON puros existentes sin cambio (valor fijo).
- Validación del transporte: `null`, anidamiento profundo, campos extra, rangos, `t` no creciente.

### 6.2 Motor (`scripts/prueba-logica.mjs`, fuentes falsas y reloj falso con `avanzar(ms)`)

- Gesto: wake lock falso que modela la ventana de activación de 5 s y la bandera
  `autorizadoAntes`: pedido tras 8 s de diálogo → rechazo; pedido sincrónico → concedido;
  `visible` tras concedido → concedido sin gesto; recarga → rechazo, `click` → concedido.
- Destrabador: `pointerup` llama a `wakeLock.request` y al audio; `pointerdown` no llama a nada;
  nunca llama a `requestPermission` ni a `watchPosition`.
- Reanudación: latido viejo descarta; `NotAllowedError` → `reanudar_con_toque`; `'denied'` →
  `sin_permiso` y borra la intención; recarga con permiso y wake lock rechazado → `activo` con
  `pantalla: sin_retener`; geolocalización en `prompt` → sin `watchPosition`.
- Idempotencia: `reanudar()` dos veces, y montaje + `visible` + cambio de ruta → un
  `watchPosition` y un sentinel; tras `apagar()`, cero. `motorDelNavegador` dos veces con el
  mismo global falso → la primera instancia destruida.
- Sin lecturas en 3 s → `sin_lecturas` y sin intención.
- Un episodio → una alerta; un segundo episodio durante `pregunta` se agrega sin reiniciar la
  cuenta; tras vencer, uno nuevo abre otra alerta.
- La cuenta vence por reloj de pared aunque no haya ticks.
- Alerta abierta + cambio a `/s/x` → sigue; ruta en pausa → sin `devicemotion`.
- `golpe_en_marcha` + detención a los 40 s → alerta; + 20 km/h sostenidos → sin alerta.
- «Estoy bien» detenido → `hubo_choque`; en movimiento → cerrada con golpe pendiente; golpe
  pendiente sobrevive a recarga y apagado.
- Sin red y vence la cuenta → estado `ayuda`, sin navegación; recarga → vuelve `ayuda`; vuelve la
  red → una sola alerta en el servidor, con la respuesta.
- Inactividad: piquete de 25 min seguido de 50 km/h → no se apaga; estacionado 30 min → apagado
  con motivo; choque durante la pregunta → alerta sin pregunta.
- Segunda instancia sin candado → `otra_ventana`; evento `storage` que borra la intención → apaga.
- Suspensión de 60 s → mismo veredicto.
- Configuración `apagada` → apaga; `silenciosa` → registra sin alerta; `motor_minimo` mayor → no
  alerta.
- Al terminar cada prueba: cero temporizadores y cero listeners pendientes.

### 6.3 Contrato (`scripts/prueba-contrato.mjs`)

- Textos de CONTRATO-UI §12 presentes por archivo: «Funciona sólo con la aplicación abierta» y
  «No llama ni le avisa a nadie por su cuenta» en `app/page.tsx`; «La aplicación no llama sola a
  emergencias» en `app/components/ModoViaje.tsx`; «no llama ni manda mensajes por su cuenta» en
  `app/components/AyudaImpacto.tsx` y `app/perfil/page.tsx`.
- En `app/layout.tsx`, `{children}` dentro de `<ModoViaje>` y antes de `<BombaCola`.
- `lib/viaje.ts` y `lib/conduccion.ts` sólo importan de los módulos permitidos (§1.1).
- El control de datos personales en eslabones recorre también `lib/**/*.ts` (excluido
  `lib/hash.ts`) y `PROHIBIDAS` suma `lat`, `lon`, `ubicacion`, `kmh`.
- Literales de `data-estado` y `data-nivel` en los `.tsx` dentro de la tabla; ningún
  `'use server'` en `app/` ni `lib/`.

### 6.4 E2E (`scripts/prueba-e2e.mjs`, sección [10] Impacto)

- `SCHEMA` aplicado dos veces seguidas en una transacción con `ROLLBACK` (salta si falta
  `DATABASE_URL`). Nunca contra la base compartida del `.env`.
- Upsert idempotente por `id_cliente`; lectura con otra huella → 404; `sin_respuesta` no pisa
  `estoy_bien`; `necesito_ayuda` escala; cuerpo de 500 KB → 413 con el máximo; ráfaga → 429.
- `POST /api/casos` con `telemetria_id` → `origen = 'impacto'` y detalle de apertura →
  cerrar → `/api/verificar` íntegro; reintento del alta → `ya_registrada` con secreto nuevo;
  `telemetria_id` ajeno → actuación sin vínculo; responder tras el cierre no agrega eslabones.
- `DELETE /api/telemetria/mias`; purga simulada con conteo; anonimizar borra la telemetría
  vinculada y sigue verificando íntegro.

### 6.5 Prueba en dispositivo

Entorno de staging con `IMPACTO_UMBRAL_SOSPECHA_G` bajo para provocar la alerta sin chocar.
Siempre por https con certificado de confianza (por `http://192.168.x.x` los sensores no existen).
Matriz con procedimiento y resultado esperado: iPhone ≥ 18.4 instalada, iPhone < 18.4 instalada,
iPhone en Safari, Android Chrome instalada, iPad Wi-Fi, escritorio.

| # | Procedimiento | Esperado |
|---|---|---|
| 1 | Primer encendido esperando 8 s antes de «Permitir» | La pantalla sigue encendida a los 2 min, o la tarjeta pide un toque |
| 2 | Navegar por todas las pantallas del asegurado | Sigue activo; la píldora aparece donde corresponde |
| 3 | Recargar con la app abierta y esperar el bloqueo automático sin tocar | La píldora pedía el toque antes de apagarse |
| 4 | Cerrar desde el selector y reabrir | «Tocá para reanudar»; en iPhone vuelve el diálogo |
| 5 | Denegar movimiento y seguir la instrucción | Se recupera |
| 6 | Llave de silencio + música por Bluetooth + «Probar la alerta» | Se oye; la música se pausa y la persona lo sabe |
| 7 | Android en silencio | No vibra y la tarjeta lo dice |
| 8 | Llamada entrante durante el viaje y volver | El sonido sigue destrabado o se pide un toque |
| 9 | Bloquear 3 min, desbloquear y frenar fuerte en un playón | La frenada se registra |
| 10 | Modo avión durante la cuenta | Estado `ayuda` sin error; al volver la red, una sola alerta |
| 11 | Dos ventanas (PWA y pestaña) | Una queda en `otra_ventana` |
| 12 | Apaisado en el soporte | La alerta entra entera |
| 13 | VoiceOver / TalkBack con doble toque en la alerta | No descarta sin haber oído el título |
| 14 | Gesto atrás con la alerta abierta | La alerta sigue |
| 15 | Sacudir, dejar caer al asiento, golpear la consola | Sin alerta |
| 16 | Acceso por http | «Abrí la aplicación desde su dirección https» |
| 17 | 60 min de manejo real | Batería, temperatura, huecos y eventos anotados |

### 6.6 Documentación

- `docs/MAPA-PANTALLAS.md`: modo viaje global; tarjeta del inicio; `/aviso`; fila de «Mis datos»;
  quitar `DetectorImpacto.tsx`; corregir «Cupo de estilos en línea: 3» del inicio (el real es 0);
  medidas de la tarjeta y de «Ambulancia» en 375×667 y 390×797.
- `docs/CONTRATO-UI.md`: §3 (`data-armada` y el de la píldora), §12, íconos.
- `README.md`: lo que el detector hace de verdad (corregir que «cruza con el giróscopo»), los
  límites de §0.5, las variables, las tres consultas SQL de calibración (tasa de `estoy_bien` y
  de `hubo_choque = false` por versión y plataforma; distribución de `pico_g`; alertas sin GPS y
  sin sonido), el procedimiento de staging.
- `.env.example`: variables nuevas con su motivo; `IMPACTO_VENTANA_CAIDA_MS` fuera;
  `PROXY_SALTOS_CONFIABLES`.
- Comentario de `lib/local.ts` sobre navegación privada (desactualizado) y de `lib/posesion.ts`
  (la cookie también identifica el dispositivo para la telemetría).
- Comentario junto a los futuros encabezados de seguridad: `accelerometer`, `gyroscope`,
  `geolocation`, `screen-wake-lock` y `microphone` (lo necesita `audioSession`) tienen que quedar
  habilitados para `self`.

---

## 7. Orden de implementación

Cada fase termina con las tres verificaciones en verde y algo que se puede probar.

| Fase | Contenido | Se puede probar |
|---|---|---|
| F0 | (Aparte, antes.) SSRF de `/api/push/prueba`. | — |
| F1 | Servidor compatible: `leerCuerpoLimitado`, `lib/limite.ts`, `huellaDispositivo`, `aJsonPuro`, esquema, `POST /api/telemetria` upsert (durante la transición acepta también el cuerpo del detector actual: `{ serie: Lectura[], origen }` en formato objeto y sin `id_cliente`; el servidor genera el id y lo trata como una alerta de un solo episodio), respuesta con historial y guarda, `planEscalamiento` nuevo, configuración, `GET /api/telemetria/[id]`, `DELETE /api/telemetria/mias`, `POST /api/conduccion`, `/aviso` sin escritura al montar, e2e [10] parte 1. | El detector actual sigue funcionando contra el servidor nuevo. |
| F2 | Lógica pura: `evaluarEpisodio`, `lib/conduccion.ts`, `validarUmbrales`, banco de simulación y sus tasas. El servidor pasa a usar `evaluarEpisodio`. | `npm run prueba` con las tasas. |
| F3 | Motor `lib/viaje.ts` y `lib/cola-viaje.ts`, con fuentes falsas. | Pruebas del motor. |
| F4 | Capa global: proveedor, tarjeta, píldora, hoja, alerta (estados `pregunta` y `hubo_choque`), textos, contrato, docs. Se borra `DetectorImpacto.tsx` **en el mismo commit**. Con `MODO_VIAJE_ALERTA` para encender de a poco. | Matriz 1–9, 11–16. |
| F5 | Ayuda en el lugar, golpe pendiente, alta vinculada, retención, e2e [10] parte 2. | Matriz 10; e2e completo. |
| F6 | Calibración en campo: diagnóstico, staging, matriz 17, README con las consultas. | Datos de campo. |
