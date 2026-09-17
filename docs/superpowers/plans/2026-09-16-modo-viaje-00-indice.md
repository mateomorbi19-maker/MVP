# Modo viaje global — Plan de implementación (índice)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar el modo viaje a toda la aplicación con un toque desde el inicio, con una detección que distinga un choque de un pozo, de una sacudida y de una frenada, una alerta que se note desde cualquier pantalla y la ayuda a un toque aun sin señal.

**Architecture:** Lógica pura compartida por el teléfono y el servidor (`lib/impacto.ts`, `lib/conduccion.ts`, `lib/transporte-viaje.ts`), un motor sin React con fuentes inyectadas (`lib/viaje.ts` + `lib/cola-viaje.ts`) y una capa fina en el layout (`app/components/ModoViaje.tsx`). El servidor recalcula el veredicto con sus umbrales, guarda la alerta por posesión del dispositivo (`lib/telemetria.ts`) y sólo escribe un eslabón de la cadena al abrir la actuación vinculada. Este índice fija nombres, tipos, formatos, esquema y textos; cada fase (F0–F6) tiene su propio plan y lo obedece.

**Tech Stack:** Next.js 16.3 (app router, route handlers, `after()`), React 19.2 (`useSyncExternalStore`, `inert`), TypeScript 7 (`tsc --noEmit`), Postgres con `pg`, Node ≥ 22 (en esta máquina 24.19), `tsx` para los scripts, APIs del navegador (DeviceMotionEvent, Geolocation, Screen Wake Lock, Web Audio, Vibration, Web Locks, IndexedDB, Web Share).

**Spec:** `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md` (anexo con el banco de simulación: `docs/superpowers/specs/2026-09-16-modo-viaje-banco/`)

Cómo leer este índice: lo que el diseño deja a la implementación se decide acá y se marca **Decisión**. Si un plan de fase necesita algo que no está acá, lo resuelve dentro de su propia fase sin cambiar ningún nombre, tipo, formato ni texto de este documento.

---

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

## Fases y archivos de plan

Los planes de fase se escriben en paralelo; **se ejecutan en orden estricto F0 → F6**. Cada fase arranca con las tres verificaciones en verde de la anterior y termina con algo que se puede probar.

| Fase | Plan | Depende de | Contenido | Se puede probar |
|---|---|---|---|---|
| F0 | `docs/superpowers/plans/2026-09-16-modo-viaje-f0-ssrf.md` | — | SSRF de `/api/push/prueba` y autorización mínima de las rutas de push (§0.4) | `npm run prueba` con los casos de `endpointPushValido`; `POST /api/push/dispositivos` con `http://169.254.169.254/` → 400 |
| F1 | `docs/superpowers/plans/2026-09-16-modo-viaje-f1-servidor.md` | F0 | `aJsonPuro`, `leerCuerpoLimitado`, `lib/limite.ts`, `huellaDispositivo`, esquema, `lib/transporte-viaje.ts`, `lib/telemetria.ts`, `planEscalamiento` nuevo, las seis rutas de §5.3 salvo el vínculo de `POST /api/casos`, `/aviso` sin escritura al montar, tope del `PATCH` y límite de altas anónimas (§0.4), e2e [10a]–[10g] | e2e [10a]–[10g]; `DetectorImpacto.tsx` sigue registrando y respondiendo contra el servidor nuevo |
| F2 | `docs/superpowers/plans/2026-09-16-modo-viaje-f2-deteccion.md` | F1 | Umbrales ampliados, `validarUmbrales`, `evaluarEpisodio` y `Veredicto` v2, `lib/conduccion.ts` completo (velocidad, fuente, detector, seguimiento, maniobras), `scripts/banco-impacto.mjs`, tasas, el servidor pasa a `evaluarEpisodio`, `/api/salud` informa umbrales | `npm run prueba` con [V2]–[V4] y las tasas del banco |
| F3 | `docs/superpowers/plans/2026-09-16-modo-viaje-f3-motor.md` | F2 | `lib/cola-viaje.ts`, `lib/viaje.ts` (ciclo de vida, gesto, reanudación, rutas, alertas, respuestas, golpe pendiente, inactividad, configuración remota, registro del accidente del lado del teléfono), `scripts/fuentes-falsas.mjs` | [V5]–[V7] con fuentes falsas y reloj falso |
| F4 | `docs/superpowers/plans/2026-09-16-modo-viaje-f4-capa-global.md` | F3 | Proveedor en el layout, tarjeta del inicio, píldora, hoja, alerta (`pregunta` y `hubo_choque`; `ayuda` provisoria), ícono, textos de §3.7, contrato y docs; `DetectorImpacto.tsx` se borra en el mismo commit en que entra el proveedor | Matriz 1–9 y 11–16 de §6.5 |
| F5 | `docs/superpowers/plans/2026-09-16-modo-viaje-f5-ayuda-vinculo-retencion.md` | F4 | `AyudaImpacto.tsx`, `/aviso` nuevo, golpe pendiente en tarjeta, píldora y hoja, `POST /api/casos` con `telemetria_id` y `abrirActuacionDesdeImpacto`, retención (`purgarTelemetria`, purga oportunista, anonimizar y expurgar), contrato de datos personales en `lib/`, e2e [10h]–[10m] | Matriz 10; e2e completo |
| F6 | `docs/superpowers/plans/2026-09-16-modo-viaje-f6-calibracion.md` | F5 | Sección «Diagnóstico» de la hoja, procedimiento de staging, matriz 17, README (qué hace de verdad el detector, límites, variables, tres consultas SQL de calibración), comentarios de `lib/local.ts` y `next.config.mjs` | Datos de campo |

### F0 — SSRF de `/api/push/prueba` (§0.4)

Hoy `POST /api/push/dispositivos` acepta cualquier URL como `endpoint`, sin sesión, y `POST /api/push/prueba` hace que el servidor le haga un `POST` a esa URL y devuelve hasta 200 caracteres del cuerpo de la respuesta (`lib/push.ts:137`): una lectura de la red interna desde afuera.

1. `lib/push.ts` suma `endpointPushValido(endpoint)` (firma en «Interfaces»). Es válido sólo si: `new URL()` no tira; `protocol === 'https:'`; `username` y `password` vacíos; `port` vacío o `'443'`; y `hostname` (en minúsculas) es exactamente `fcm.googleapis.com`, `android.googleapis.com`, `updates.push.services.mozilla.com` o `web.push.apple.com`, o termina en `.push.apple.com` o en `.notify.windows.com` (con el punto: `evilnotify.windows.com` no pasa).
2. `enviarPush` comprueba `endpointPushValido` **antes** de armar la autorización y el `fetch` (hay filas viejas que pueden tener cualquier cosa): si no vale devuelve `{ ok: false, estado: 0, motivo: 'La suscripción no apunta a un servicio de notificaciones conocido: no se le mandó nada.', caducada: false }` sin hacer ningún pedido. El `fetch` lleva `redirect: 'manual'`; un 3xx devuelve `{ ok: false, estado: <3xx>, motivo: 'El servicio de notificaciones respondió con una redirección, que no se sigue.', caducada: false }`. El `motivo` **nunca** incluye el cuerpo de la respuesta: el caso genérico pasa a `` `El servicio de notificaciones respondió ${res.status}.` `` (se borra la lectura de `res.text()`); el de 403 conserva su texto actual.
3. `POST /api/push/dispositivos`: 400 si el endpoint no es válido (texto `push.endpoint_invalido`); 400 si `p256dh` no decodifica en base64url a 65 bytes o `auth` a 16 bytes (texto `push.claves_invalidas`); el resto igual.
4. `POST /api/push/prueba`: 400 si el endpoint no es válido; busca la fila activa como hoy (404 igual); **si la fila tiene `usuario_id`, exige `leerSesion()` de ese usuario** y si no lanza `new ErrorAcceso(403, <texto push.suscripcion_ajena>)`, que `errorApi` traduce; la respuesta sigue siendo `{ ok, estado, motivo, caducada }`.
5. **Decisión de autorización mínima:** `POST` y `DELETE /api/push/dispositivos` siguen sin exigir sesión. Una suscripción sólo le permite al servidor mandar avisos cifrados a ese navegador, y la etapa 3 los necesita para teléfonos sin cuenta; con el destino restringido a servicios de push, exigir sesión no agrega protección y rompe el circuito anónimo. Conocer un endpoint es una capacidad (la URL trae un token largo que genera el servicio). `POST /api/push/prueba` exige la sesión sólo si la suscripción es de una cuenta: el texto del aviso es fijo, el destino ya está restringido y el cuerpo del servicio no se devuelve, así que lo único que queda es molestar a un endpoint conocido, y eso se cierra para las cuentas.
6. Pruebas en `scripts/prueba-logica.mjs`, en el bloque bajo el comentario `/* ---------- 10. Impacto y notificaciones ---------- */` (después del bloque del vector del RFC 8291). Al comienzo de estas pruebas se hace `delete process.env.PUSH_DESACTIVADO` (con `PUSH_DESACTIVADO=true`, `enviarPush` devuelve antes del `fetch` y las afirmaciones pasarían sin probar nada). Tabla de `endpointPushValido` (válidos: `https://fcm.googleapis.com/fcm/send/abc`, `https://updates.push.services.mozilla.com/wpush/v2/abc`, `https://web.push.apple.com/QGx`, `https://wns2-par02p.notify.windows.com/w/?token=abc`; inválidos: `http://fcm.googleapis.com/fcm/send/abc`, `https://169.254.169.254/latest/meta-data`, `https://fcm.googleapis.com.evil.com/x`, `https://usuario:clave@fcm.googleapis.com/x`, `https://fcm.googleapis.com:8443/x`, `https://evilnotify.windows.com/x`, `'no es una url'`, `42`); `enviarPush` con endpoint inválido no llama a `globalThis.fetch` (se reemplaza por uno que marca la prueba como fallida y se restaura al final); con un `fetch` falso que responde `302` → el `fetch` falso anota que fue llamado y que recibió `init.redirect === 'manual'`, y el resultado tiene `ok === false`, `estado === 302` y `motivo === 'El servicio de notificaciones respondió con una redirección, que no se sigue.'`; con un `fetch` falso que responde `500` con cuerpo `'secreto-interno'` → el `fetch` falso anota que fue llamado con `init.redirect === 'manual'`, y el resultado tiene `ok === false`, `estado === 500`, `motivo === 'El servicio de notificaciones respondió 500.'` y `motivo` no contiene `secreto-interno`. Para las dos últimas, la suscripción usa las claves del vector del RFC ya presentes en la sección.

### F1 — Servidor compatible

Tareas en este orden (cada una con su prueba primero):

1. `aJsonPuro` en `lib/hash.ts` y su uso en `hashEvento`, `registrarEvento` (detalle y reservado, antes del hash y del INSERT) y `registrarGestion`; pruebas en `prueba-logica.mjs`, en el bloque bajo `/* ---------- 1. Serialización canónica y cadena ---------- */`.
2. `ErrorCuerpo` y `leerCuerpoLimitado` en `lib/api.ts`; ramas nuevas de `errorApi`; crea `scripts/prueba-viaje.mjs` con [V1] y cambia el script `prueba` de `package.json`.
3. `lib/limite.ts`; rama 429 de `errorApi`.
4. `huellaDispositivo` en `lib/posesion.ts` y comentario de la cookie.
5. Esquema (`SCHEMA` exportado, bloque del modo viaje, `TABLAS`); cambia el script `e2e` de `package.json` a `tsx`, refactoriza el arnés del e2e (`crearFrasco`, `saltar`) y suma [10a].
6. `lib/impacto.ts`: agregados de F1 (tipos de episodio, `RespuestaAlerta`, `planEscalamiento` nuevo, `nivelMayor`, redondeo y recorte); actualizar a mano las dos verificaciones de `scripts/prueba-logica.mjs` que llaman `planEscalamiento(v, false)` y `planEscalamiento(v, true)` (hoy líneas 812–813; F0 las corre hacia abajo, así que se buscan por contenido).
7. `lib/transporte-viaje.ts` (sin `reconstruirVeredicto`).
8. `lib/telemetria.ts` con el veredicto provisorio de F1 (`analizarImpacto` sobre la serie).
9. Rutas: `GET /api/telemetria/configuracion`, `POST /api/telemetria` (nuevo y del detector anterior), `GET /api/telemetria/[id]`, `POST /api/telemetria/[id]/respuesta`, `DELETE /api/telemetria/mias`, `POST /api/conduccion`; e2e [10b]–[10f].
10. `/aviso` deja de escribir al montar (borrar `app/aviso/page.tsx:26-35`).
11. `PATCH /api/casos/[id]` con tope de 64 KB y `POST /api/casos` con tope de 8 KB y límite de altas anónimas; e2e [10g].
12. `.env.example`: variables `MODO_VIAJE_*`, `TELEMETRIA_DIAS_CONSERVACION`, `PROXY_SALTOS_CONFIABLES`; se borra `TELEMETRIA_MAX_MUESTRAS`.

### F2 — Detección

1. `Umbrales` de 15 campos, `UMBRALES` desde el entorno, `validarUmbrales`, `problemasDeUmbrales`, log de `IMPACTO_VENTANA_CAIDA_MS`, `.env.example`, `/api/salud`, aviso en `README.md` de que `IMPACTO_VELOCIDAD_PREVIA_KMH` pasa de 30 a 15.
2. `Veredicto` v2 y `evaluarEpisodio` fila por fila (§2.4–§2.5), `analizarImpacto` como adaptador; en `prueba-logica.mjs` se borra el bloque que empieza con el comentario `/* El detector de impacto, contra series sintéticas. */` hasta su `}` de cierre (hoy líneas 775–815) y se quita `import { UMBRALES, analizarImpacto, planEscalamiento } from '../lib/impacto.ts'` (hoy línea 21); el bloque del RFC 8291 y lo que sumó F0 se quedan. Las líneas se buscan por contenido: F0 y F1 las corren.
3. `lib/conduccion.ts`: `estimarVelocidades` con los relojes de §2.1, `estaDetenido`, `velocidadMedia`.
4. `lib/conduccion.ts`: fuente de aceleración (§2.2) dentro de `crearDetector`.
5. `lib/conduccion.ts`: episodios, sub-picos, disparador (b), huecos y seguimiento (§2.3, §2.6).
6. `lib/conduccion.ts`: `detectarManiobras` y absorción (§2.7).
7. `scripts/banco-impacto.mjs` portado del anexo con PRNG de semilla fija.
8. [V4]: escenas obligatorias y tasas (§6.1).
9. `reconstruirVeredicto` en `lib/transporte-viaje.ts`; `lib/telemetria.ts` pasa a `evaluarEpisodio`; prueba de paridad teléfono–servidor.
10. `scripts/prueba-contrato.mjs`: `IMPORTS_PERMITIDOS` para `lib/impacto.ts`, `lib/conduccion.ts` y `lib/transporte-viaje.ts`.

### F3 — Motor

1. `lib/cola-viaje.ts` con almacén inyectado y adaptador IndexedDB; [V5].
2. `scripts/fuentes-falsas.mjs`.
3. `lib/viaje.ts`: constantes, `ESTADO_SERVIDOR`, instantánea inmutable, `suscribir`, reloj inyectado, `motorDelNavegador` con destrucción de la instancia previa.
4. Encendido (§4.1) y gesto; `sin_lecturas`.
5. Reanudación (§4.3): destrabador, visibilidad, candados, evento `storage`, iOS < 18.4.
6. Rutas (§3.6) y huecos de detección.
7. Detector → episodios → alertas (agregación, vencimiento por pared, seguimiento, silenciosos, maniobras a la cola).
8. Aviso físico (audio, vibración, `audioSession`) y `probarAlerta`.
9. Respuestas, `hubo_choque`, `ayuda`, golpe pendiente, persistencia y restauración tras recarga.
10. Inactividad (§4.4).
11. Configuración remota (§2.9).
12. `drenarCola`, `registrarAccidente`, `borrarRegistros`, `activarGps`.
13. `IMPORTS_PERMITIDOS` suma `lib/viaje.ts` y `lib/cola-viaje.ts`; [V6] y [V7] completas.

### F4 — Capa global

1. `Iconos.tsx` suma `auto`; `BotonesEmergencia` suma `chicos` y `alLlamar`.
2. `app/globals.css`: clases de «Interfaz», `@keyframes destello-viaje`, reserva de la píldora, bloque de reduced-motion.
3. `ModoViaje.tsx` + `app/layout.tsx` + quitar `DetectorImpacto` de `app/perfil/page.tsx` + borrar `app/components/DetectorImpacto.tsx`: **un solo commit**.
4. Tarjeta en `app/page.tsx`, textos de §3.7 en `app/page.tsx` y `app/perfil/page.tsx`, «Tuve un accidente» apaga el modo.
5. Píldora, región de estado y hoja.
6. Alerta: `pregunta`, `hubo_choque` y `ayuda` provisoria.
7. Contrato: textos obligatorios por archivo, orden del layout, literales de `data-estado`/`data-nivel`, ningún `'use server'`.
8. `docs/CONTRATO-UI.md` (§3, §12, doce íconos) y `docs/MAPA-PANTALLAS.md`.
9. Despliegue sugerido con `MODO_VIAJE_ALERTA=silenciosa` y después `normal`; matriz 1–9 y 11–16.

### F5 — Ayuda, vínculo y retención

1. `AyudaImpacto.tsx`; la alerta en estado `ayuda` la usa; `/aviso` la usa.
2. Golpe pendiente en tarjeta, píldora y hoja.
3. `lib/casos.ts`: `origen` en `Caso`, `detalleAperturaImpacto`, `abrirActuacionDesdeImpacto`; `POST /api/casos` con `telemetria_id`; contrato de datos personales extendido a `lib/`; [V8]; e2e [10h]–[10k].
4. `lib/retencion.ts`: `purgarTelemetria`, `purgarTelemetriaSiToca`, `aplicarPolitica`, anonimizar y expurgar; `after()` en `POST /api/telemetria` y `POST /api/conduccion`; e2e [10l]–[10m].
5. Docs: `/aviso` en el mapa; §12 registra el texto de la ayuda; matriz 10.

### F6 — Calibración

1. «Diagnóstico» en la hoja (datos que ya publica `estado().diagnostico` desde F3).
2. README: lo que el detector hace de verdad (se corrige «cruza con el giróscopo»), límites de §0.5, variables, las tres consultas SQL (tasa de `estoy_bien` y de `hubo_choque = false` por `version_motor` y `plataforma`; distribución de `pico_g` por `nivel`; alertas sin GPS y sin sonido), procedimiento de staging y matriz de §6.5 con la fila 17.
3. Comentario de `lib/local.ts` sobre navegación privada; comentario en `next.config.mjs` sobre los futuros encabezados: `accelerometer`, `gyroscope`, `geolocation`, `screen-wake-lock` y `microphone` habilitados para `self`.

---

## Mapa de archivos

| Archivo | Acción | Fase | Responsabilidad única |
|---|---|---|---|
| `lib/push.ts` | modificar | F0 | Decidir si un endpoint es de un servicio de push y mandar sin seguir redirecciones ni devolver el cuerpo del servicio |
| `app/api/push/dispositivos/route.ts` | modificar | F0 | Rechazar suscripciones que no son de Web Push |
| `app/api/push/prueba/route.ts` | modificar | F0 | Mandar el aviso de prueba sólo a un servicio conocido y, si la suscripción es de una cuenta, sólo con esa sesión |
| `scripts/prueba-logica.mjs` | modificar | F0, F1, F2 | F0: casos de push en el bloque `/* ---------- 10. Impacto y notificaciones ---------- */`. F1: `aJsonPuro` en el bloque `/* ---------- 1. Serialización canónica y cadena ---------- */` y las dos llamadas viejas a `planEscalamiento`. F2: se borra el bloque viejo de `analizarImpacto` y su import (ubicarlos por contenido, no por número de línea) |
| `lib/hash.ts` | modificar | F1 | `aJsonPuro`; `hashEvento` y `registrarEvento` trabajan sobre JSON puro |
| `lib/gestion.ts` | modificar | F1 | `registrarGestion` hashea y guarda `aJsonPuro(detalle)` (sin cambio de firma) |
| `lib/api.ts` | modificar | F1 | Leer cuerpos con tope y traducir `ErrorCuerpo`, `ErrorLimite` y `ErrorTransporte` |
| `lib/limite.ts` | crear | F1 | Limitador en memoria por ámbito, IP y huella |
| `lib/posesion.ts` | modificar | F1 | `huellaDispositivo` sobre la cookie `acta_posesion`; comentario: la cookie también identifica el dispositivo para la telemetría |
| `lib/db.ts` | modificar | F1 | `SCHEMA` exportado, bloque del modo viaje al final, `TABLAS` con las dos tablas nuevas |
| `lib/impacto.ts` | modificar | F1, F2 | Reglas puras del impacto (teléfono y servidor). F1: tipos de episodio, respuesta, plan, redondeo y recorte. F2: umbrales, `evaluarEpisodio`, `Veredicto` v2, adaptador `analizarImpacto` |
| `lib/transporte-viaje.ts` | crear | F1, F2 | Formato compacto y validación que reconstruye, compartidos por el motor y el servidor. F2 suma `reconstruirVeredicto` |
| `lib/telemetria.ts` | crear | F1, F2 | Servidor de la telemetría: configuración, acceso por posesión, upsert con fusión, lectura, respuesta, borrado propio, eventos de conducción. F2 cambia el veredicto a `evaluarEpisodio` |
| `app/api/telemetria/configuracion/route.ts` | crear | F1 | `GET` de la configuración remota; crea la cookie de posesión |
| `app/api/telemetria/route.ts` | modificar | F1, F5 | `POST` upsert de alerta y episodio (y cuerpo del detector anterior). F5: purga oportunista en `after()` |
| `app/api/telemetria/[id]/route.ts` | crear | F1 | `GET` de una alerta propia para `/aviso` |
| `app/api/telemetria/[id]/respuesta/route.ts` | modificar | F1 | `POST` de respuesta por id del servidor, con la misma fusión y posesión |
| `app/api/telemetria/mias/route.ts` | crear | F1 | `DELETE` de la telemetría no vinculada y de los eventos de conducción de este teléfono |
| `app/api/conduccion/route.ts` | crear | F1, F5 | `POST` de un lote de eventos de conducción. F5: purga oportunista en `after()` |
| `app/api/casos/route.ts` | modificar | F1, F5 | F1: tope de 8 KB y límite de altas anónimas. F5: alta vinculada con `telemetria_id` |
| `app/api/casos/[id]/route.ts` | modificar | F1 | Tope de 64 KB del `PATCH` |
| `app/api/casos/[id]/sensores/route.ts` | sin cambios | — | Sigue compilando con el adaptador `analizarImpacto` (rehacerla es etapa 3, §0.4) |
| `app/api/mantenimiento/expurgo/route.ts` | sin cambios | — | Ya devuelve `...resultado`: desde F5 incluye `telemetria` |
| `app/aviso/page.tsx` | modificar | F1, F5 | F1: no escribe al montar. F5: respaldo de la ayuda con `AyudaImpacto` |
| `.env.example` | modificar | F1, F2 | F1: `MODO_VIAJE_*`, `TELEMETRIA_DIAS_CONSERVACION`, `PROXY_SALTOS_CONFIABLES`, fuera `TELEMETRIA_MAX_MUESTRAS`. F2: `IMPACTO_*` y `CONDUCCION_*` con su motivo, fuera `IMPACTO_VENTANA_CAIDA_MS` |
| `package.json` | modificar | F1 | `"prueba": "tsx scripts/prueba-logica.mjs && tsx scripts/prueba-viaje.mjs"` y `"e2e": "tsx scripts/prueba-e2e.mjs"` |
| `scripts/prueba-viaje.mjs` | crear | F1, F2, F3, F5 | Pruebas del modo viaje en secciones [V1]–[V8] |
| `scripts/prueba-e2e.mjs` | modificar | F1, F5 | Frascos de cookies, `saltar()`, sección [10] (F1: [10a]–[10g]; F5: [10h]–[10m]) |
| `lib/conduccion.ts` | crear | F2 | Señales del viaje en curso: velocidad, fuente de aceleración, detector de episodios, seguimiento y maniobras |
| `scripts/banco-impacto.mjs` | crear | F2 | Banco de simulación con semilla fija portado del anexo |
| `app/api/salud/route.ts` | modificar | F2 | Informa los umbrales fuera de rango (no cambia `ok`) |
| `scripts/prueba-contrato.mjs` | modificar | F2, F3, F4, F5 | F2/F3: `IMPORTS_PERMITIDOS`. F4: textos obligatorios, orden del layout, literales de `data-*`, `'use server'`. F5: datos personales en `lib/**`, `PROHIBIDAS` y texto de la ayuda |
| `lib/cola-viaje.ts` | crear | F3 | Cola persistente de alertas, episodios y lotes de conducción, con tope y drenado de a un pedido |
| `lib/viaje.ts` | crear | F3 | El motor: ciclo de vida, permisos, sensores, alertas, respuestas y estado publicado |
| `scripts/fuentes-falsas.mjs` | crear | F3 | Fuentes falsas, reloj falso, servidor falso y ventana falsa para probar el motor en Node |
| `app/components/ModoViaje.tsx` | crear | F4, F5, F6 | Proveedor y capa: raíz inerte, píldora, hoja, alerta. F5: ayuda y golpe pendiente. F6: diagnóstico |
| `app/layout.tsx` | modificar | F4 | `<body><ModoViaje>{children}</ModoViaje><BombaCola /></body>` |
| `app/page.tsx` | modificar | F4, F5 | F4: tarjeta del modo viaje, texto del pie (§3.7), «Tuve un accidente» apaga el modo. F5: golpe pendiente en la tarjeta |
| `app/perfil/page.tsx` | modificar | F4 | Sin `DetectorImpacto`; texto del contacto de confianza (§3.7) |
| `app/components/DetectorImpacto.tsx` | borrar | F4 | En el mismo commit en que entra el proveedor |
| `app/components/Iconos.tsx` | modificar | F4 | Ícono `auto` |
| `app/components/BotonesEmergencia.tsx` | modificar | F4 | Props `chicos` y `alLlamar` |
| `app/globals.css` | modificar | F4, F5, F6 | Clases, animación y reservas del modo viaje |
| `docs/CONTRATO-UI.md` | modificar | F4, F5 | §3 (`data-armada`, `data-pildora-viaje`), §12, doce íconos. F5: texto de la ayuda en §12 |
| `docs/MAPA-PANTALLAS.md` | modificar | F4, F5 | Modo viaje global, tarjeta, fila de «Mis datos», sin `DetectorImpacto.tsx`, cupo real del inicio (0), medidas en 375×667 y 390×797. F5: `/aviso` |
| `app/components/AyudaImpacto.tsx` | crear | F5 | Contenido de la ayuda: llamadas, contacto, ubicación, registro y falsa alarma |
| `lib/casos.ts` | modificar | F5 | `origen` en `Caso`; `detalleAperturaImpacto`; `abrirActuacionDesdeImpacto` |
| `lib/retencion.ts` | modificar | F5 | Purga de telemetría y borrado de la telemetría vinculada al anonimizar y expurgar |
| `README.md` | modificar | F2, F6 | F2: aviso de que `IMPACTO_VELOCIDAD_PREVIA_KMH` pasa de 30 a 15 y hay que revisar las variables del servicio al desplegar. F6: detector, límites, variables, consultas de calibración, staging y matriz |
| `lib/local.ts` | modificar | F6 | Sólo el comentario sobre navegación privada |
| `next.config.mjs` | modificar | F6 | Sólo el comentario sobre `Permissions-Policy` |
| `public/sw.js` | sin cambios | — | `notificationclick` con `postMessage` es etapa 3 |

---

## Interfaces

Firmas exactas de todo lo nuevo o cambiado. Lo que acá no figura como exportado no se exporta. Cada bloque dice qué fase lo escribe; las fases siguientes lo consumen tal cual.

### Nombres ocupados y chequeo de choques

Exportados hoy desde `lib/` (regex de `scripts/prueba-contrato.mjs:519`). Ningún módulo nuevo puede repetirlos. Los más tentadores: `Aviso` (push), `Nivel` y `analizar` (consistencia), `Ubicacion` (geo), `umbral` (extraccion), `encolar`, `quitar`, `drenar`, `huellaDe`, `pendientesDe`, `todasLasPendientes` y `PiezaEnCola` (cola), `Respuestas`, `Paso` y `Faltante` (recorrido), `Media`, `Testigo` y `Caso` (casos), `Sesion` y `Rol` (sesion), `Mensaje` (correo), `Candidato` (retencion), `Emergencia` (emergencias), `Suscripcion` (cifrado).

Lista completa al 2026-09-16: acta `DECLARACION CuerpoActa ActaParaFirmar construirActa` · almacenamiento `DIR_DATOS DIR_MEDIA DIR_DOCUMENTOS DIR_SERIES TAMANO_MAXIMO ErrorArchivo ArchivoGuardado validarMime guardarArchivo leerArchivo guardarDocumento leerDocumento guardarSerie leerSerie` · api `errorApi` · bitacora `anotarEnBitacora AnotacionBitacora listarBitacora` · casos `Caso obtenerCaso listarCasos Media listarMedias Testigo listarTestigos calcularConsistencia datosExpediente urlPublica DatosAsegurado limpiarDatosAsegurado contarTerceros` · cifrado `Suscripcion derivarClaves cifrarCarga` · claves `hashearClave verificarClave CLAVE_INEXISTENTE validarClave normalizarDni nuevoToken hashToken` · clima `Clima consultarClima` · cola-extraccion `encolarLectura reencolarPendientes` · cola `PiezaEnCola huellaDe encolar pendientesDe todasLasPendientes quitar drenar` · consistencia `Nivel Hallazgo InformeConsistencia analizar ETIQUETA_NIVEL` · correo `ErrorCorreo ConfiguracionCorreo configuracionCorreo faltaParaCorreo Mensaje enviarCorreo` · croquis `LADO METROS_POR_UNIDAD RolCroquis VehiculoCroquis TipoCruce Croquis Figura figurasDelCroquis Plantilla PLANTILLAS limpiarCroquis PIE_CROQUIS` · cuestionario `TipoPregunta Bloque Condicion Pregunta Seccion VALOR SECCIONES GUIA_RELATO GuiaFoto GUIA_FOTOS Etapa RECORRIDO preguntasVisibles fotosVisibles fotosObligatorias seccionPorId ZONAS_IMPACTO TOTAL_PREGUNTAS` · db `ErrorBaseDeDatos traducirErrorBase destinoBase pool TABLAS asegurarEsquema db estadoBase nuevoId` · emergencias `Emergencia EMERGENCIAS EMERGENCIAS_EN_EL_LUGAR` · entregas `EstadoEnvio Envio ErrorEntrega entregar obtenerEnvio listarEnvios abrirEntrega reintentarPendientes` · extraccion `TipoDocumento GUIA_A_DOCUMENTO CampoLeido ResultadoExtraccion ProveedorExtraccion MAPEO PROVEEDOR_SIMULADO REGISTRO extraccionActiva proveedorActivo umbral EstadoCampo CampoParaAsegurado vistaParaAsegurado` · geo `Ubicacion direccionDeCoordenadas TileMapa MapaLugar mapaDelLugar calleCoincide` · gestion `EstadoGestion ETIQUETA_GESTION Gestion registrarGestion listarGestiones ErrorGestion avanzarGestion` · hash `sha256 canonico hashEvento ErrorActuacionCerrada OpcionesEvento registrarEvento EslabonManifiesto Manifiesto VERSION_MANIFIESTO construirManifiesto ResultadoVerificacion verificarCadena` · impacto `Lectura Umbrales UMBRALES NivelImpacto Veredicto analizarImpacto PlanEscalamiento planEscalamiento` · local `recordarActuacion actuacionAbierta secretoDe olvidarActuacion ultimaActuacion` · pdf `DatosExpediente generarExpediente` · perfil `ContactoConfianza obtenerContacto guardarContacto actualizarTitular` · polizas `Productor DocumentoPoliza Poliza ErrorPoliza listarPolizas crearPoliza marcarPrincipal Precarga precargaDe listarProductores crearProductor` · posesion `COOKIE_POSESION anotarPosesion tienePosesion exigirAccesoCaso` · push `ErrorPush clavePublicaVapid huellaVapid pushActivo Aviso ResultadoEnvio enviarPush` · recorrido `Respuestas MediaMinima Paso vacia respondida construirPasos pasoInicial Faltante faltantes` · retencion `Candidato ErrorRetencion anonimizar expurgar candidatos aplicarPolitica` · sello `Sello huellaClavePublica sellar` · sesion `Rol ROLES COOKIE_SESION Sesion ErrorAcceso crearSesion leerSesion cerrarSesion cerrarTodasLasSesiones exigirRol AlcanceCasos alcanceDe` · usuarios `Usuario ErrorUsuario crearUsuario verificarIngreso obtenerUsuario listarEquipo cambiarClave reiniciarClave hayAseguradora`.

Nombres nuevos, verificados contra la lista de arriba y entre sí (ningún choque):

- `lib/impacto.ts`: `RespuestaAlerta ImpactoParaPlan nivelMayor VelocidadEpisodio DisparadorEpisodio FuenteAceleracion CaidaSinGolpe EventoSilencioso EpisodioImpacto SenalesSubpico SenalesCaida OpcionesEvaluacion evaluarEpisodio ProblemaUmbral validarUmbrales problemasDeUmbrales VERSION_DETECCION PRECISION_CONFIABLE_M GRAVEDAD_MS2 KMH_POR_S_POR_G MAX_MUESTRAS_EPISODIO MAX_VELOCIDADES_EPISODIO redondearEpisodio recortarEpisodio`
- `lib/transporte-viaje.ts`: `Plataforma AperturaAlerta TipoEventoConduccion FilaSerie FilaVelocidad FilaEventoConduccion RespuestaTransportada GpsTransportado CamposAlerta EpisodioTransportado CuerpoTelemetria CuerpoTelemetriaLegado CuerpoRespuesta LoteConduccion VeredictoClienteReconstruido EpisodioDecodificado BYTES_MAX_TELEMETRIA BYTES_MAX_RESPUESTA BYTES_MAX_CONDUCCION MAX_EVENTOS_LOTE ErrorTransporte codificarEpisodio decodificarEpisodio validarCuerpoTelemetria esCuerpoLegado decodificarCuerpoLegado validarCuerpoRespuesta validarLoteConduccion reconstruirVeredicto`
- `lib/conduccion.ts`: `MuestraMovimiento FixGps LecturaVelocidad estimarVelocidades estaDetenido velocidadMedia Maniobra MuestraHorizontal EntradaManiobras detectarManiobras OpcionesDetector EventoDetector ResumenDetector Detector crearDetector`
- `lib/viaje.ts`: `crearMotorViaje motorDelNavegador ESTADO_SERVIDOR VERSION_MOTOR AVISO_DATOS_VERSION RUTAS_EN_PAUSA RUTAS_SIN_PILDORA EstadoModoViaje`
- `lib/cola-viaje.ts`: `EntradaAlertaViaje EntradaEpisodioViaje EntradaConduccionViaje EntradaColaViaje AlmacenColaViaje RespuestaEnvioViaje EnviarViaje ResultadoDrenadoViaje ColaViaje crearColaViaje almacenIndexedDb`
- `lib/limite.ts`: `AmbitoLimite TopeLimite TOPES_LIMITE ErrorLimite ipDelCliente limitar reiniciarLimites`
- `lib/api.ts`: `ErrorCuerpo leerCuerpoLimitado` · `lib/posesion.ts`: `PropositoHuella huellaDispositivo` · `lib/hash.ts`: `aJsonPuro` · `lib/db.ts`: `SCHEMA` · `lib/push.ts`: `endpointPushValido`
- `lib/telemetria.ts`: `AVISOS_DATOS_CONOCIDOS MENSAJE_TELEMETRIA_AJENA ConfiguracionModoViaje configuracionModoViaje QuienPide DuenioTelemetria accesoTelemetria horaTelefonoAceptable ResultadoTelemetria guardarTelemetria guardarTelemetriaLegada LecturaTelemetria leerTelemetriaPropia responderTelemetria borrarTelemetriaPropia guardarEventosConduccion`
- `lib/retencion.ts`: `ResultadoPurgaTelemetria purgarTelemetria purgarTelemetriaSiToca` · `lib/casos.ts`: `DetalleAperturaImpacto detalleAperturaImpacto AltaDesdeImpacto ResultadoAltaImpacto abrirActuacionDesdeImpacto`

### Importaciones permitidas (las verifica `IMPORTS_PERMITIDOS` en el contrato)

| Archivo | Sólo puede importar de | Motivo |
|---|---|---|
| `lib/impacto.ts` | nada | Corre en el teléfono y en el servidor, sin `pg` ni `node:crypto` |
| `lib/conduccion.ts` | `./impacto` | «Importa de impacto.ts, nunca al revés» (§1) |
| `lib/transporte-viaje.ts` | `./impacto` | Compartido por el motor y el servidor; nunca `pg` en el cliente |
| `lib/cola-viaje.ts` | `./transporte-viaje` | Cliente |
| `lib/viaje.ts` | `./impacto`, `./conduccion`, `./transporte-viaje`, `./local`, `./cola-viaje` | §1.1 más el transporte |

**Decisión:** el formato compacto y su validación viven en un módulo propio, `lib/transporte-viaje.ts`, y la lista de §1.1 suma `./transporte-viaje`. Así `lib/impacto.ts` queda con las reglas, el servidor valida sin cargar la detección y el cliente nunca importa `pg`. El contrato cuenta `import`, `import type` y `export … from`; cualquier `import()` dinámico en estos cinco archivos es falla.

### `lib/impacto.ts`

**F1** agrega (compatible: `DetectorImpacto.tsx`, `app/api/telemetria/route.ts` y `app/api/casos/[id]/sensores/route.ts` siguen compilando):

```ts
/** Una muestra del acelerómetro tal como la evalúa evaluarEpisodio. F1 amplía gTotal y suma h. */
export interface Lectura {
  /**
   * Milisegundos. Dentro de un EpisodioImpacto, relativos al disparo (t = 0 en la muestra que
   * abrió el episodio o en el cruce de velocidad; negativos antes). En el cuerpo del detector
   * anterior, desde el comienzo de la serie.
   */
  t: number
  /** Aceleración lineal, sin gravedad, en m/s², ejes del teléfono. */
  ax: number
  ay: number
  az: number
  /** Módulo CON gravedad, en g. null o ausente si el equipo no lo entrega. */
  gTotal?: number | null
  /** Norma de rotationRate, √(α² + β² + γ²), en °/s. null sin giróscopo. */
  giro?: number | null
  /**
   * Norma de la horizontal h = a − (a·ĝ)ĝ con pasa-bajos de 2 Hz por componente, en g, SIN banda
   * muerta (la banda de 0.05 g la aplica evaluarEpisodio). null con fuente derivada o sin ĝ convergido.
   */
  h?: number | null
  /** Sólo en el cuerpo del detector anterior: velocidad del GPS en km/h. evaluarEpisodio no la lee. */
  kmh?: number | null
}

/** Una lectura de velocidad. Confiable: kmh !== null && precisionM <= PRECISION_CONFIABLE_M. */
export interface VelocidadEpisodio {
  /** ms, misma base que Lectura.t (relativos al disparo dentro de un episodio). */
  t: number
  /** km/h: coords.speed o derivada de posiciones con base ≥ 3 s; null si no hay. */
  kmh: number | null
  /** coords.accuracy del fix, en m. */
  precisionM: number
  /** Metros al este (x) y al norte (y), proyección equirectangular; dentro del episodio, relativos a su primera lectura. */
  x: number
  y: number
}

/** (a) una muestra con |a| ≥ sospechaG; (b) una caída de velocidad (§2.3). */
export type DisparadorEpisodio = 'golpe' | 'caida_velocidad'

/** §2.2: 'confiable' si rotationRate trae números; 'derivada' si la lineal sale de accelerationIncludingGravity. */
export type FuenteAceleracion = 'confiable' | 'derivada'

/** Lo que evaluarEpisodio necesita para repetir el cálculo, en el teléfono y en el servidor. */
export interface EpisodioImpacto {
  disparador: DisparadorEpisodio
  fuente: FuenteAceleracion
  /** Frecuencia real del acelerómetro en la ventana, en Hz; 0 sin muestras. */
  hzMedido: number
  /**
   * Aceleración en [disparo − 2 s, cierre] con el disparador (a) y en [disparo − 6 s, cierre] con el (b),
   * estrictamente creciente en t. Puede estar vacía sólo con el disparador (b).
   */
  serie: Lectura[]
  /** Velocidades en [disparo − 10 s, cierre], estrictamente creciente en t. */
  velocidades: VelocidadEpisodio[]
}

/** 1 g en m/s². */
export const GRAVEDAD_MS2 = 9.80665
/** 1 g expresado en km/h por segundo. */
export const KMH_POR_S_POR_G = 35.30394
/** Tope de muestras por episodio: el teléfono recorta antes de evaluar; el servidor recorta de 1001 a 3000 y rechaza más. */
export const MAX_MUESTRAS_EPISODIO = 1000
/** Tope de lecturas de velocidad por episodio: más es 400. */
export const MAX_VELOCIDADES_EPISODIO = 120

/**
 * Redondea como el transporte y nada más: t con 1 decimal; ax, ay, az con 3; gTotal y h con 3; giro con 1;
 * en velocidades, t, kmh, precisionM, x e y con 1. x e y quedan relativos a la primera lectura. Idempotente:
 * decodificarEpisodio(codificarEpisodio(...)).episodio es igual a redondearEpisodio(episodio).
 */
export function redondearEpisodio(episodio: EpisodioImpacto): EpisodioImpacto

/**
 * Recorta la serie a `max` (MAX_MUESTRAS_EPISODIO por omisión) alrededor del pico: centro en la muestra de
 * mayor |a| con el disparador (a) y en la más cercana a t = 0 con el (b); igual cantidad a cada lado cuando
 * alcanza y, si no, corre la ventana para llenar `max`. Nunca slice(0, max) ni slice(-max). No toca velocidades.
 */
export function recortarEpisodio(episodio: EpisodioImpacto, max?: number): { episodio: EpisodioImpacto; recortada: boolean }

/** Respuesta a una alerta. Es también el CHECK telemetria_respuesta_valida_v1. */
export type RespuestaAlerta = 'estoy_bien' | 'necesito_ayuda' | 'sin_respuesta'

/** Lo que planEscalamiento necesita del impacto. Un Veredicto sirve tal cual. */
export interface ImpactoParaPlan {
  /** El mayor entre el nivel del servidor y el del teléfono (nivelMayor). */
  nivel: NivelImpacto
  /** false sólo si la alerta no se mostró (configuración silenciosa o motor desactualizado). Ausente cuenta como true. */
  alertaMostrada?: boolean
}

export interface PlanEscalamiento {
  ofrecerEmergencias: boolean
  /** Antes avisarContactoDeConfianza: la aplicación ofrece llamar, no avisa. */
  ofrecerContactoDeConfianza: boolean
  precargarDenuncia: boolean
  texto: string
}

/**
 * switch exhaustivo sobre `respuesta`. Cualquier otro valor (por ejemplo el `true` de la firma vieja) lanza
 * Error(`planEscalamiento recibió la respuesta ${String(respuesta)}: las posibles son estoy_bien, necesito_ayuda, sin_respuesta o null.`).
 *   necesito_ayuda → escala siempre, con cualquier nivel.
 *   estoy_bien     → no escala.
 *   sin_respuesta  → escala si el nivel es sospecha o confirmado, o si es nada y alertaMostrada !== false.
 *   null           → no escala todavía.
 * Cuando escala, los tres booleanos van en true; si no, los tres en false.
 */
export function planEscalamiento(veredicto: ImpactoParaPlan, respuesta: RespuestaAlerta | null): PlanEscalamiento

/** El mayor de dos niveles con nada < sospecha < confirmado; b null o undefined no cuenta. */
export function nivelMayor(a: NivelImpacto, b: NivelImpacto | null | undefined): NivelImpacto
```

Textos exactos de `PlanEscalamiento.texto`:

| Caso | `texto` |
|---|---|
| `necesito_ayuda` | La persona pidió ayuda. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente. |
| `sin_respuesta` con `confirmado` | No hubo respuesta y el impacto está confirmado. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente. |
| `sin_respuesta` con `sospecha` | No hubo respuesta a un posible impacto. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente. |
| `sin_respuesta` con `nada` y alerta mostrada | No hubo respuesta a la alerta. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente. |
| `sin_respuesta` con `nada` y alerta no mostrada | Sin novedad: la alerta no se mostró. |
| `estoy_bien` | La persona respondió que está bien. |
| `null` | Todavía no hay respuesta. |

**Decisión:** `ofrecerContactoDeConfianza` es `true` siempre que escala. La ayuda muestra el contacto cuando está cargado, con cualquier origen (§3.4), y la interfaz nunca decide qué dibujar a partir de `plan` (tiene que funcionar sin red).

**F2** reemplaza `Umbrales`, `UMBRALES` y `Veredicto`, y suma el resto (el campo `ventanaCaidaMs` desaparece):

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

/**
 * validarUmbrales(<lo leído de IMPACTO_* y CONDUCCION_*>).umbrales, calculado al importar. En el navegador
 * no hay variables: coinciden con las omisiones. Si IMPACTO_VENTANA_CAIDA_MS está cargada, al importar se
 * escribe UNA vez console.warn con el texto servidor.ventana_caida_obsoleta. Si hubo problemas, UNA vez
 * console.warn('[impacto] umbrales fuera de rango: se usan los valores de omisión.', problemas).
 */
export const UMBRALES: Umbrales

export interface ProblemaUmbral {
  campo: keyof Umbrales
  /** Lo que vino, tal cual. */
  recibido: unknown
  /** El valor de omisión que se usa en su lugar. */
  usado: number
  /** Qué hay que arreglar, por ejemplo 'sospechaG tiene que estar entre 2 y 20; vino 40.' */
  motivo: string
}

/**
 * Acepta cualquier cosa (el JSON de la configuración remota o lo leído del entorno). Por campo: ausente
 * (undefined) → omisión sin problema; no es un número finito o está fuera de rango → omisión con problema.
 * Después las relaciones de la tabla; si una falla, los dos campos vuelven a su omisión con un problema cada
 * uno, y se repite hasta que no falle ninguna. Nunca usa Number() sobre algo que no sea texto.
 */
export function validarUmbrales(entrada: unknown): { umbrales: Umbrales; problemas: ProblemaUmbral[] }

/** Los problemas del entorno calculados al importar (los informa /api/salud). */
export function problemasDeUmbrales(): ProblemaUmbral[]

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
  /** km/h: máximo de las medianas de 3 lecturas confiables consecutivas en [tPico − 8 s, tPico + 1.5 s]; con menos de 3, la mediana de las que haya; null sin lecturas confiables. */
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
  /** SIEMPRE false: el compilador impide que alguien marque el 107 sin que la persona lo confirme. */
  llamar_emergencias: false
}

export interface OpcionesEvaluacion {
  umbrales: Umbrales
  caidaSinGolpe: CaidaSinGolpe
}

/**
 * El único veredicto (§2.3–§2.5), del detector del teléfono y del servidor. Pura y determinista: el mismo
 * episodio con las mismas opciones da un Veredicto idéntico. Filas 1–7 por sub-pico con el disparador (a);
 * filas 8–9 con el (b). Respeta el disparador que recibe: el detector ya decidió cuál es.
 */
export function evaluarEpisodio(episodio: EpisodioImpacto, opciones: OpcionesEvaluacion): Veredicto

/**
 * Adaptador del cuerpo del detector anterior y de POST /api/casos/[id]/sensores: arma un episodio 'golpe'
 * con fuente 'confiable', sin velocidades, con t relativo a la primera muestra ≥ sospechaG (o al máximo si no
 * hay), lo recorta con recortarEpisodio y lo evalúa con caidaSinGolpe 'silenciosa'. `umbrales` por omisión: UMBRALES.
 */
export function analizarImpacto(serie: Lectura[], umbrales?: Umbrales): Veredicto

/** Versión de las reglas de evaluarEpisodio. Sube con cualquier cambio de reglas. */
export const VERSION_DETECCION = 1

/** m. Una lectura con precisión peor que esto no es confiable; con el último fix así, el GPS está 'impreciso'. */
export const PRECISION_CONFIABLE_M = 50
```

Rangos, omisiones y variables de `Umbrales` (F2; el motivo se copia a `.env.example`):

| Campo | Omisión | Variable | Rango válido | Motivo |
|---|---|---|---|---|
| `sospechaG` | 4 | `IMPACTO_UMBRAL_SOSPECHA_G` | 2 a 20 | Es un disparador, no un veredicto: por debajo, un pozo con soporte resonante abre episodios todo el tiempo |
| `confirmadoG` | 8 | `IMPACTO_UMBRAL_CONFIRMADO_G` | 2 a 50, y ≥ `sospechaG` | Sólo decide con el auto casi quieto; muchos Android saturan en 4 g |
| `msSobreUmbral` | 30 | `IMPACTO_MS_SOBRE_UMBRAL` | 5 a 500 | Un pozo da un pico de una o dos muestras; un choque sostiene la sacudida decenas de ms |
| `velocidadPreviaKmh` | 15 | `IMPACTO_VELOCIDAD_PREVIA_KMH` | 5 a 60 | Con 30 se perdían los choques urbanos saliendo de un semáforo |
| `velocidadPreviaCaidaKmh` | 30 | `IMPACTO_VELOCIDAD_PREVIA_CAIDA_KMH` | 15 a 150 | Detenerse sin golpe desde menos no es imposible para una frenada |
| `velocidadPosteriorKmh` | 8 | `IMPACTO_VELOCIDAD_POSTERIOR_KMH` | 0 a 30, y < `velocidadPreviaKmh` | El GPS parado oscila ±3–5 km/h |
| `ventanaPostMs` | 8000 | `IMPACTO_VENTANA_POST_MS` | 3000 a 15000 | El GPS llega 1–3 s atrasado y hay que ver la detención |
| `topeEpisodioMs` | 15000 | `IMPACTO_TOPE_EPISODIO_MS` | 5000 a 60000, y ≥ `ventanaPostMs` | Un vuelco entra; más largo, un camino de ripio sería un solo episodio |
| `giroDps` | 180 | `IMPACTO_GIRO_DPS` | 30 a 2000 | Dato para calibrar, no decide |
| `giroManipulacionDps` | 300 | `IMPACTO_GIRO_MANIPULACION_DPS` | 100 a 2000 | La mano gira el teléfono antes del golpe; en un choque gira después |
| `desaceleracionImposibleG` | 1.4 | `IMPACTO_DESACELERACION_IMPOSIBLE_G` | 1.0 a 4.0, y < `sospechaG` | Una frenada con ABS llega a 1.1 g |
| `frenadaG` | 0.45 | `CONDUCCION_FRENADA_G` | 0.2 a 1.0 | 0.30–0.35 g es manejo normal en ciudad |
| `aceleracionG` | 0.40 | `CONDUCCION_ACELERACION_G` | 0.2 a 1.0 | Arranque brusco |
| `retrasoMinMs` | 0 | `CONDUCCION_RETRASO_MIN_MS` | 0 a 5000 | Retraso del GPS medido en el banco |
| `retrasoMaxMs` | 3000 | `CONDUCCION_RETRASO_MAX_MS` | 0 a 10000, y ≥ `retrasoMinMs` | Retraso del GPS medido en el banco |

Lectura del entorno: variable ausente o vacía → `undefined` (omisión sin problema); si no, `Number(texto)`, y un `NaN` es problema. En `.env.example`, `IMPACTO_VELOCIDAD_PREVIA_KMH` pasa de 30 a 15.

### `lib/transporte-viaje.ts` (F1; F2 suma `reconstruirVeredicto`)

```ts
import { UMBRALES, GRAVEDAD_MS2, MAX_MUESTRAS_EPISODIO, MAX_VELOCIDADES_EPISODIO, recortarEpisodio, redondearEpisodio, type DisparadorEpisodio, type EpisodioImpacto, type FuenteAceleracion, type Lectura, type NivelImpacto, type RespuestaAlerta, type Umbrales, type Veredicto } from './impacto'

export type Plataforma = 'ios' | 'android' | 'otro'

/** 'episodio': la abrió un episodio sospecha o confirmado. 'seguimiento': la abrió el seguimiento de un golpe en marcha (§2.6). */
export type AperturaAlerta = 'episodio' | 'seguimiento'

export type TipoEventoConduccion = 'frenada' | 'aceleracion' | 'golpe_en_marcha' | 'caida_silenciosa'

/** Una muestra: [t, ax, ay, az, gTotal, giro, h] con las unidades y decimales de redondearEpisodio; null donde no hay dato. */
export type FilaSerie = [number, number, number, number, number | null, number | null, number | null]

/** Una velocidad: [t, kmh, precision_m, x, y]. */
export type FilaVelocidad = [number, number | null, number, number, number]

/** Un evento: [id_cliente, tipo, ocurrido_en_telefono (ISO), kmh_inicial, kmh_final, duracion_ms, g_estimada, pico_g]. */
export type FilaEventoConduccion = [string, TipoEventoConduccion, string, number | null, number | null, number | null, number | null, number | null]

export interface RespuestaTransportada {
  /** Mismo nombre que en CuerpoRespuesta y en la columna respuestas: un solo nombre para el mismo dato. */
  respuesta: RespuestaAlerta
  /** ISO de la hora del teléfono en que se respondió (o venció la cuenta). */
  en_telefono: string
}

export interface GpsTransportado {
  lat: number
  lon: number
  precision_m: number
}

/** Los metadatos de la alerta. Viajan completos en cada pedido: el upsert es idempotente. */
export interface CamposAlerta {
  /** crypto.randomUUID() del motor: /^[A-Za-z0-9-]{8,64}$/. */
  id_cliente: string
  /** AVISO_DATOS_VERSION que vio la persona; el servidor la valida contra AVISOS_DATOS_CONOCIDOS. */
  aviso_version: string
  /** VERSION_MOTOR, entero de 1 a 1000. */
  version_motor: number
  plataforma: Plataforma
  standalone: boolean
  /** ISO del primer pico según el teléfono. */
  ocurrido_en_telefono: string
  /** ISO sellado por la cola en CADA intento de envío. */
  enviado_en: string
  apertura: AperturaAlerta
  /** El mayor nivel entre los veredictos del teléfono de sus episodios. */
  nivel_cliente: NivelImpacto
  alerta_mostrada: boolean
  /** Si el tono llegó a sonar; null si no se sabe todavía o no se mostró. */
  sonido: boolean | null
  /**
   * Todas las respuestas de la alerta en orden (de 0 a 5; el motor manda las últimas 5 de alerta.respuestas, con
   * enTelefono pasado a ISO). No sólo la última: si vence la cuenta y después se toca un tel:, el servidor tiene que
   * ver el sin_respuesta y el necesito_ayuda (§5.4: «metadatos + respuestas + hubo_choque»).
   */
  respuestas: RespuestaTransportada[]
  hubo_choque: boolean | null
  /** ms entre que se abrió la alerta y la primera respuesta humana; null si no hubo. Entero de 0 a 86 400 000. */
  ms_hasta_respuesta: number | null
  /** Hz medidos al abrir la alerta; null sin muestras. */
  hz_medido: number | null
  aceleracion_derivada: boolean
  /** Fix más cercano al primer pico; null sin GPS. */
  gps: GpsTransportado | null
  umbrales_cliente: Umbrales
}

/** Un episodio en formato compacto. */
export interface EpisodioTransportado {
  /** 1, 2, 3… dentro de la alerta; entero de 1 a 50. */
  n: number
  ocurrido_en_telefono: string
  disparador: DisparadorEpisodio
  fuente: FuenteAceleracion
  hz_medido: number
  /** El Veredicto del teléfono completo; el servidor lo reconstruye desde una lista cerrada. */
  veredicto_cliente: Veredicto
  /** Hasta MAX_MUESTRAS_EPISODIO filas (el servidor recorta de 1001 a 3000 y rechaza más). */
  serie: FilaSerie[]
  /** Hasta MAX_VELOCIDADES_EPISODIO filas. */
  velocidades: FilaVelocidad[]
}

/** Cuerpo de POST /api/telemetria. */
export interface CuerpoTelemetria {
  campos: CamposAlerta
  episodio: EpisodioTransportado | null
}

/** El cuerpo del detector anterior, ya reconstruido: { serie: Lectura[], origen } y opcionalmente lat y lon. */
export interface CuerpoTelemetriaLegado {
  /** Hasta MAX_MUESTRAS_EPISODIO, recortada alrededor del pico. */
  serie: Lectura[]
  /** Texto de hasta 40 caracteres; 'navegador' si no vino. */
  origen: string
  gps: { lat: number; lon: number } | null
  recortada: boolean
}

/** Cuerpo de POST /api/telemetria/[id]/respuesta. */
export interface CuerpoRespuesta {
  respuesta: RespuestaAlerta
  hubo_choque: boolean | null
  /** ISO; null si no vino (el servidor usa su hora). */
  en_telefono: string | null
}

/** Cuerpo de POST /api/conduccion. */
export interface LoteConduccion {
  aviso_version: string
  version_motor: number
  plataforma: Plataforma
  enviado_en: string
  /** De 1 a MAX_EVENTOS_LOTE. */
  eventos: FilaEventoConduccion[]
}

/**
 * El veredicto del teléfono tal como lo reconstruye el servidor. No es Record<string, unknown>: un Veredicto es
 * una interface y no se le asignaría (riesgo 3).
 */
export type VeredictoClienteReconstruido = Pick<Veredicto, 'nivel' | 'picoG' | 'motivo'> & Partial<Veredicto>

export interface EpisodioDecodificado {
  n: number
  /** ISO tal como vino: el servidor decide si la acepta con horaTelefonoAceptable. */
  ocurridoEnTelefono: string
  /** Reconstruido desde la lista cerrada, con t, x e y tal como vinieron. */
  episodio: EpisodioImpacto
  /**
   * Mismo tipo en F1 y en F2. F1 guarda { nivel, picoG, motivo } reconstruidos; F2 guarda reconstruirVeredicto(),
   * un Veredicto, que se asigna a este tipo sin conversión. null si no se puede reconstruir (no rechaza el episodio).
   */
  veredictoCliente: VeredictoClienteReconstruido | null
  /** true si el servidor recortó la serie. */
  recortada: boolean
  /** Filas reconstruidas (y recortadas), listas para telemetria_episodios.serie y .velocidades. */
  serie: FilaSerie[]
  velocidades: FilaVelocidad[]
}

/** 128 KB. */
export const BYTES_MAX_TELEMETRIA = 131_072
/** 2 KB. */
export const BYTES_MAX_RESPUESTA = 2_048
/** 8 KB. */
export const BYTES_MAX_CONDUCCION = 8_192
export const MAX_EVENTOS_LOTE = 50

/** Un campo que no pasa la validación. errorApi lo traduce a 400 { error: message, tipo: 'transporte', campo }. */
export class ErrorTransporte extends Error {
  constructor(readonly campo: string, mensaje: string)
}

/** Lo que manda el motor. Redondea con redondearEpisodio y arma filas; no valida. `ocurridoEnTelefono` en ms de pared. */
export function codificarEpisodio(n: number, ocurridoEnTelefono: number, episodio: EpisodioImpacto, veredictoCliente: Veredicto): EpisodioTransportado

/** Reconstruye y valida un episodio (reglas abajo). Lanza ErrorTransporte con la ruta del campo relativa al episodio: 'serie[37].ax'. */
export function decodificarEpisodio(crudo: unknown): EpisodioDecodificado

/** Valida el cuerpo nuevo entero. Rutas: 'campos.<campo>' y, para el episodio, las de decodificarEpisodio. No valida aviso_version contra la lista (eso es del servidor). */
export function validarCuerpoTelemetria(crudo: unknown): { campos: CamposAlerta; episodio: EpisodioDecodificado | null }

/** true si es un objeto con `serie` arreglo y sin `campos`: el cuerpo de DetectorImpacto.tsx. */
export function esCuerpoLegado(crudo: unknown): boolean

/**
 * Reconstruye { serie: Lectura[], origen, lat?, lon? } (hasta 3000 muestras; recorta a 1000 alrededor del pico). Lanza ErrorTransporte.
 * No aplica |t| ≤ 120000: DetectorImpacto.tsx mide t desde que se encendió y pasa de 120000 a los 2 minutos de viaje.
 * Acepta t finito ≥ 0 y estrictamente creciente y, antes de recortar, le resta a cada t el de la primera muestra
 * (la serie queda relativa a su comienzo, como espera analizarImpacto).
 */
export function decodificarCuerpoLegado(crudo: unknown): CuerpoTelemetriaLegado

/** Lanza ErrorTransporte('respuesta', <texto servidor.respuesta_invalida>) si respuesta no es una de las tres. */
export function validarCuerpoRespuesta(crudo: unknown): CuerpoRespuesta

/** Reconstruye y valida el lote. Rutas: 'eventos[3].kmh_inicial'. */
export function validarLoteConduccion(crudo: unknown): LoteConduccion

/** F2. Reconstruye un Veredicto desde la lista cerrada de sus campos (y de SenalesSubpico, SenalesCaida y Umbrales). Descarta cualquier otra clave; null si nivel no es un NivelImpacto. */
export function reconstruirVeredicto(crudo: unknown): Veredicto | null
```

Reglas de validación (todas reconstruyen; nunca se guarda el objeto que llegó):

- Número: `typeof v === 'number' && Number.isFinite(v)`. Nunca `Number(v)` (`Number(null)` da 0). Entero cuando se dice entero: `Number.isInteger(v)`.
- Texto: `typeof v === 'string'` con largo máximo. Fecha: texto de hasta 40 caracteres con `Number.isFinite(Date.parse(v))`.
- Fila: `Array.isArray(fila) && fila.length === <n>`; si no, `serie[12] tiene que ser una lista de 7 valores`.
- `serie` (del cuerpo nuevo; el del detector anterior sigue las reglas de `decodificarCuerpoLegado`): t estrictamente creciente, `|t| ≤ 120000`; `ax`, `ay`, `az` con `|v| ≤ 50 · GRAVEDAD_MS2`; `gTotal` y `h` null o de 0 a 50; `giro` null o de 0 a 5000. Hasta 1000 filas; de 1001 a 3000 se recortan con `recortarEpisodio` (`recortada: true` y `console.warn('[telemetria] serie recortada', …)`); más de 3000 → `serie tiene 3200 muestras: el máximo es 1000`. Con disparador `golpe`, al menos una fila.
- `velocidades`: t estrictamente creciente, `|t| ≤ 120000`; `kmh` null o de 0 a 300; `precision_m` de 0 a 10000; `x`, `y` con `|v| ≤ 100000`; hasta 120 filas.
- `campos.respuestas`: arreglo de 0 a 5 elementos (más → `campos.respuestas tiene 6 elementos: el máximo es 5`); cada uno con `respuesta` en la lista de `RespuestaAlerta` y `en_telefono` fecha (rutas `campos.respuestas[1].respuesta`).
- `campos.gps`: `lat` de −90 a 90, `lon` de −180 a 180, `precision_m` de 0 a 10000. `campos.hz_medido` y `episodio.hz_medido`: 0 a 1000. `campos.umbrales_cliente`: sólo las claves de `Object.keys(UMBRALES)` con número finito; las demás se descartan.
- Lote: `id_cliente` con `/^[A-Za-z0-9-]{8,64}$/`; `tipo` en la lista; `kmh_inicial` y `kmh_final` null o 0–300; `duracion_ms` null o entero 0–600000; `g_estimada` null o 0–5; `pico_g` null o 0–50.

Formato de los mensajes (la ruta del campo primero, siempre en castellano):

| Problema | Mensaje |
|---|---|
| no es número | `serie[37].ax no es un número` |
| fuera de rango | `velocidades[3].kmh está fuera de rango (0 a 300)` |
| falta | `falta campos.id_cliente` |
| texto inválido | `campos.id_cliente tiene que ser un texto de hasta 64 caracteres` |
| valor fuera de la lista | `campos.plataforma tiene que ser uno de: ios, android, otro` |
| t no crece | `serie[12].t no crece respecto de la muestra anterior` |
| demasiados | `serie tiene 3200 muestras: el máximo es 1000` |
| booleano | `campos.standalone tiene que ser true o false` |
| fecha | `campos.enviado_en no es una fecha ISO 8601` |
| fila | `serie[12] tiene que ser una lista de 7 valores` |
| cuerpo no objeto | `el cuerpo tiene que ser un objeto JSON con campos y episodio` |

### `lib/conduccion.ts` (F2)

**Decisión:** todo el procesamiento que decide «alerta sí o no» es puro y vive acá (fuente de aceleración, velocidades, episodios, sub-picos, disparador b, huecos, seguimiento y maniobras), detrás de `crearDetector`. Así el banco de F2 mide exactamente lo que va a correr en el teléfono, y el motor de F3 sólo cablea sensores, ciclo de vida y alertas. No importa nada salvo `./impacto`, ni toca `window`, `navigator` ni relojes globales: todo tiempo entra por parámetro.

```ts
import { evaluarEpisodio, redondearEpisodio, recortarEpisodio, GRAVEDAD_MS2, KMH_POR_S_POR_G, PRECISION_CONFIABLE_M, type CaidaSinGolpe, type EpisodioImpacto, type FuenteAceleracion, type Umbrales, type VelocidadEpisodio, type Veredicto } from './impacto'

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

/**
 * §2.1 sobre los fixes desde el último hueco, en orden de llegada: sesgo por la mediana de las edades de los
 * últimos 5 (incluidos los descartados) si hay 3 o más y |mediana| > 3000; descarta edadEf > 5000 y
 * pos.timestamp que no crece; t = llegadaMono − max(edadEf, 0); derivada con base ≥ 3 s y par descartado si
 * los Δt de adquisición y de llegada difieren más de 2 s. Devuelve una lectura por fix aceptado.
 */
export function estimarVelocidades(fixes: readonly FixGps[]): LecturaVelocidad[]

/**
 * ¿El auto está quieto en [desdeMono, hastaMono]? true: ≥ 2 lecturas confiables, todas ≤ velocidadPosteriorKmh,
 * y las posiciones no avanzan a más de 15 km/h. false: alguna lectura confiable > velocidadPosteriorKmh.
 * null: sin lecturas confiables suficientes (no saber no es estar detenido).
 */
export function estaDetenido(lecturas: readonly LecturaVelocidad[], desdeMono: number, hastaMono: number, umbrales: Umbrales): boolean | null

/** Media de kmh de las lecturas confiables en [desdeMono, hastaMono]; null si no hay ninguna. */
export function velocidadMedia(lecturas: readonly LecturaVelocidad[], desdeMono: number, hastaMono: number): number | null

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
  /** g por GPS dentro de la duración del acelerómetro, siempre positiva. */
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

export interface EntradaManiobras {
  muestras: readonly MuestraHorizontal[]
  lecturas: readonly LecturaVelocidad[]
  /** Intervalos [desde, hasta] en mono de episodios de impacto, para la absorción (§2.7.5). */
  episodios: ReadonlyArray<{ desde: number; hasta: number }>
  /** Mono del último evento emitido por tipo (enfriamiento de 10 s); -Infinity si ninguno. */
  ultimoPorTipo: { frenada: number; aceleracion: number }
  /** No se informan maniobras con tF anterior a esto (ya evaluadas). */
  desdeMono: number
  /** Sólo se deciden maniobras con tF + retrasoMaxMs ≤ hastaMono. */
  hastaMono: number
  /** Par de relojes leído junto, para convertir tI a pared. */
  ahora: { mono: number; pared: number }
}

/** §2.7, puro. */
export function detectarManiobras(entrada: EntradaManiobras, umbrales: Umbrales): Maniobra[]

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

export function crearDetector(opciones: OpcionesDetector): Detector
```

### `lib/cola-viaje.ts` (F3)

**Decisión:** la política de la cola (tope, descarte, orden, retroceso) es pura sobre un almacén inyectado, para probarla en Node con un `Map`; el adaptador de IndexedDB es fino y no se prueba en Node (no hay IndexedDB y no se suman dependencias).

```ts
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

/**
 * Tope: 20 entradas o 2 MB (suma de bytes). Al pasarse, descarta en este orden y de la más vieja a la más
 * nueva: 1) alertas ya subidas y sin versión pendiente; 2) lotes de conducción; 3) alertas pendientes sin
 * respuesta o con estoy_bien, con sus episodios. NUNCA una alerta con respuesta sin_respuesta o necesito_ayuda
 * pendiente, ni sus episodios: si sólo quedan ésas, se acepta pasarse del tope. Las alertas subidas se
 * conservan hasta 24 h para tener su idServidor y después se borran.
 */
export function crearColaViaje(almacen: AlmacenColaViaje): ColaViaje

/** IndexedDB: base 'acta-viaje', versión 1, almacén 'entradas' con keyPath 'clave', sin índices. Usa window.indexedDB recién al llamarse; sin IndexedDB, cada método rechaza con Error('Este navegador no tiene IndexedDB: la cola del modo viaje no puede guardar nada.'). */
export function almacenIndexedDb(): AlmacenColaViaje
```

### `lib/viaje.ts` (F3)

Exporta **sólo** lo de este primer bloque (§1.1). Los tipos del segundo bloque se declaran en el archivo **sin exportar**; los consumidores los obtienen con `NonNullable<ReturnType<typeof motorDelNavegador>>` o con accesos indexados como `EstadoModoViaje['alerta']`. Sin efectos al importarse: ningún acceso a `window`, `document`, `navigator`, `localStorage` ni `indexedDB` fuera de funciones.

```ts
import { UMBRALES, type NivelImpacto, type Umbrales } from './impacto'
import type { ColaViaje } from './cola-viaje'
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

/** Congelado en profundidad (Object.freeze en cada nivel). Es el getServerSnapshot del proveedor. Se congela una copia de los umbrales: UMBRALES de lib/impacto.ts no se congela. */
export const ESTADO_SERVIDOR: EstadoModoViaje
// = { fase: 'desconocido', motivoNoSoportado: null, gps: 'no_aplica', pantalla: 'no_soportada', pantallaLiberada: false,
//     avisos: { sonido: 'requiere_toque', vibracion: 'no_soportada' }, sesionDeAudio: false, fuente: 'confiable',
//     plataforma: 'otro', standalone: false, alerta: null, inactividad: null, golpePendiente: null, apagadoPor: null,
//     deteccion: { activaMs: 0, totalMs: 0, huecos: [] },
//     configuracion: { version: null, alerta: 'normal', caidaSinGolpe: 'silenciosa', umbrales: Object.freeze({ ...UMBRALES }), desactualizado: false },
//     ruta: { actual: '', enPausa: false, conPildora: false }, velocidadKmh: null, precisionM: null,
//     siguioPorMovimientoEn: null, diagnostico: null }

export function crearMotorViaje(fuentes: FuentesMotor): MotorViaje

/**
 * null si typeof window === 'undefined' (typeof navigator no sirve: Node ≥ 21 lo define). Si no, devuelve la
 * instancia de este módulo o la crea con las fuentes del navegador; antes de crearla, si encuentra una previa en
 * globalThis.__actaMotorViaje (Fast Refresh o otra evaluación del módulo), llama previa.destruir(). Guarda la
 * nueva ahí. La nueva arranca por el camino normal de reanudación desde lo guardado.
 */
export function motorDelNavegador(): MotorViaje | null
```

Tipos sin exportar (contrato de F3 con F4, F5 y las pruebas):

```ts
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
```

Reglas del motor que F4 y F5 dan por hechas:

- `fuentesDelNavegador()` (sin exportar) lee **siempre** `window.navigator`, `window.document`, `window.localStorage`, `window.performance`, `window.setTimeout`, nunca los globales sueltos (Node 24 tiene `navigator` y `performance` globales). Arma `local` con `recordarActuacion` y `actuacionAbierta` de `lib/local.ts`; es el único lugar de `lib/viaje.ts` que los usa. Tolera que falte cualquier API salvo `window.addEventListener`, `window.document` y `window.navigator.userAgent`.
- Plataforma por UA: `/iPhone|iPad|iPod/` o (`Macintosh` y `'ontouchend' in document`) → `ios`; `/Android/` → `android`; si no, `otro`. Versión de iOS: `/OS (\d+)_(\d+)/`.
- `ruta.conPildora` = la ruta actual no coincide con ningún patrón de `RUTAS_SIN_PILDORA`; `ruta.enPausa` = coincide con `RUTAS_EN_PAUSA`.
- Alerta nueva ante un episodio `sospecha` o `confirmado`, o un evento `seguimiento`: si hay una en `pregunta`, el episodio se agrega a esa alerta (n + 1, sin reiniciar la cuenta); si hay una en `hubo_choque`, ésa se cierra dejando golpe pendiente y se abre la nueva; si hay una en `ayuda`, se registra como alerta aparte con `alerta_mostrada: false`; con configuración `silenciosa` o `desactualizado`, se registra con `alerta_mostrada: false` y no se muestra.
- La inactividad no empieza mientras exista un golpe pendiente ni una alerta.
- «Auto detenido o sin velocidad confiable» (§3.3) es `estaDetenido(detector.lecturas(), ahora − 10 000, ahora, umbrales) !== false` con mono.
- Eventos de conducción desde el detector, como `FilaEventoConduccion` con `id_cliente = nuevoId()` y `ocurrido_en_telefono` en ISO: `maniobra` → `[id, tipo, ocurridoEn, kmhInicial, kmhFinal, duracionMs, gEstimada, picoG]`; episodio con `veredicto.silencioso === 'golpe_en_marcha'` → `[id, 'golpe_en_marcha', ocurridoEn, veredicto.señales?.previa ?? null, null, null, null, veredicto.picoG]`; con `'caida_silenciosa'` → `[id, 'caida_silenciosa', ocurridoEn, veredicto.caida?.previa ?? null, null, null, veredicto.caida?.densaG ?? null, veredicto.picoG]`.
- Con la ayuda abierta y `velocidadMedia` de 30 s ≥ 15 km/h, la alerta se cierra y queda golpe pendiente.
- Lotes de conducción: se encola un `LoteConduccion` al juntar 10 eventos, a los 5 minutos del primero pendiente, al pasar a oculto y al apagar; como mucho 50 por lote.
- Candados: `navigator.locks.request('acta-modo-viaje', { ifAvailable: true }, …)` para la ventana que detecta (sin candado → `otra_ventana`; se reintenta al volver visible y en cada latido) y `'acta-viaje-drenado'` para drenar la cola.
- Temporizadores (todos con `reloj.programar`): tic del detector 1 s mientras escucha; latido de la intención 30 s; cuenta de la alerta 1 Hz; vibración cada 2 s con el patrón `[400, 200, 400]` durante la pregunta; armado 600 ms; GPS buscando a los 5 s sin fix; configuración cada 10 min; comprobación de lecturas a los 3 s del permiso.

### `lib/limite.ts` (F1)

```ts
/** telemetria: POST /api/telemetria y POST /api/telemetria/[id]/respuesta. conduccion: POST /api/conduccion. altas: POST /api/casos sin sesión. */
export type AmbitoLimite = 'telemetria' | 'conduccion' | 'altas'

export interface TopeLimite {
  porMinuto: number
  porHora: number
}

export const TOPES_LIMITE: Readonly<Record<AmbitoLimite, { huella: TopeLimite; ip: TopeLimite }>> = {
  telemetria: { huella: { porMinuto: 30, porHora: 300 }, ip: { porMinuto: 120, porHora: 2000 } },
  conduccion: { huella: { porMinuto: 10, porHora: 120 }, ip: { porMinuto: 60, porHora: 1000 } },
  altas: { huella: { porMinuto: 10, porHora: 60 }, ip: { porMinuto: 30, porHora: 300 } },
}

/**
 * Se pasó un tope. El mensaje es el texto servidor.limite_lecturas (telemetria, conduccion) o
 * servidor.limite_altas (altas) con N = reintentarEnS. errorApi lo traduce a 429 con Retry-After.
 */
export class ErrorLimite extends Error {
  constructor(readonly ambito: AmbitoLimite, readonly reintentarEnS: number)
}

/**
 * IP del cliente desde x-forwarded-for, contando `saltosConfiables` desde el final: entradas separadas por coma,
 * sin espacios, ip = entradas[largo − saltos]. null si saltos < 1, si hay menos entradas que saltos o si la ip no
 * cumple /^[0-9A-Fa-f:.]{2,45}$/. Por omisión, saltos = PROXY_SALTOS_CONFIABLES (entero ≥ 0; 1 si falta o es inválido).
 * Next completa x-forwarded-for con la IP del socket si no vino, así que en local también se limita por IP (::1).
 */
export function ipDelCliente(cabeceras: Headers, saltosConfiables?: number): string | null

/**
 * Ventana deslizante en memoria por clave `${ambito}:ip:${ip}` y `${ambito}:huella:${huella}` (una clave null no
 * limita). Registra el pedido y, si cualquiera de las dos claves pasa su tope por minuto o por hora, lanza
 * ErrorLimite con reintentarEnS = segundos hasta que salga de la ventana la marca más vieja que hace falta
 * (entero ≥ 1). Poda las claves sin marcas de la última hora. Se reinicia con cada despliegue: es una primera
 * barrera y protege contra un cliente propio en bucle, no contra un atacante decidido.
 */
export function limitar(ambito: AmbitoLimite, claves: { ip: string | null; huella: string | null }, ahoraMs?: number): void

/** Vacía todas las ventanas. Sólo para las pruebas. */
export function reiniciarLimites(): void
```

### `lib/api.ts` (F1)

```ts
/** El cuerpo no se puede leer. errorApi lo traduce a { error: message, tipo: 'cuerpo' } con este estado. */
export class ErrorCuerpo extends Error {
  constructor(readonly estado: 400 | 413, mensaje: string)
}

/**
 * 413 si Content-Length ya supera maxBytes. Si no, lee req.body con getReader() sumando bytes y, apenas se pasa,
 * reader.cancel() y 413. Decodifica con new TextDecoder('utf-8', { fatal: true }) (400 si no es UTF-8) y
 * JSON.parse (400 si no es JSON). Cuerpo ausente o de 0 bytes → devuelve {} (compatibilidad con altas sin cuerpo).
 * Textos: servidor.cuerpo_grande con KB = Math.round(maxBytes / 1024), servidor.cuerpo_no_utf8, servidor.cuerpo_no_json.
 */
export async function leerCuerpoLimitado(req: Request, maxBytes: number): Promise<unknown>

// errorApi(contexto, err, mensajeGenerico): misma firma. Ramas nuevas, en este orden, después de ErrorAcceso y
// ErrorActuacionCerrada y antes de la base:
//   ErrorCuerpo      → NextResponse.json({ error, tipo: 'cuerpo' }, { status: err.estado })
//   ErrorLimite      → NextResponse.json({ error, tipo: 'limite', reintentar_en_s }, { status: 429, headers: { 'Retry-After': String(reintentarEnS) } })
//   ErrorTransporte  → NextResponse.json({ error, tipo: 'transporte', campo }, { status: 400 })
```

### `lib/posesion.ts` (F1)

```ts
export type PropositoHuella = 'telemetria' | 'conduccion'

/**
 * hashToken(proposito + ':' + token) sobre la cookie acta_posesion (usa tokenDePosesion, que sigue sin exportarse).
 * Con crear, emite la cookie si falta (sólo desde un route handler). null si no hay cookie y crear es false.
 * La separación por propósito impide cruzar en la base las posesiones con el historial de conducción.
 */
export async function huellaDispositivo(proposito: PropositoHuella, crear: boolean): Promise<string | null>
```

### `lib/hash.ts` (F1)

```ts
/** v === undefined ? null : JSON.parse(JSON.stringify(v)). Con un detalle que ya es JSON puro no cambia ningún hash. */
export function aJsonPuro(valor: unknown): unknown

// hashEvento: misma firma; hashea canonico(aJsonPuro(entrada.detalle)).
// registrarEvento: misma firma; calcula `const puro = aJsonPuro(detalle) as Record<string, unknown>` y
//   `const reservadoPuro = aJsonPuro(opciones.reservado)` ANTES del compromiso, del hash y de los INSERT, y usa sólo esos.
// registrarGestion (lib/gestion.ts): misma firma; hashea y guarda aJsonPuro(detalle).
```

Valor fijo para la prueba de «no cambia ningún hash» (calculado con el código actual, antes de F1):

```js
hashEvento({
  caso_id: 'ADS-AAAAAA', ts: '2026-09-16T12:00:00.000Z', tipo: 'apertura_actuacion', hash_previo: null,
  detalle: { user_agent: 'prueba', origen: 'impacto', telemetria_id: 'TEL-AAAAAA', nivel: 'sospecha', pico_g: 6.5, ocurrido_en_telefono: '2026-09-16T11:59:30.000Z', desfase_reloj_ms: -120, lista: [1, 'a', null, true] },
}) === '7e35a94f980fc6b17e0cb60d1ca3ec08785acf412064fe234e32e6ff20f52b87'
```

Y con `const conFecha = { a: new Date('2026-09-16T12:00:00.000Z'), b: undefined, c: 1 }` sobre la misma base, después de F1 `hashEvento({ ...base, detalle: conFecha }) === hashEvento({ ...base, detalle: aJsonPuro(conFecha) })`, y ese hash es `a5d1c2ec41050d6ba1d8a746e29dc3314f8793dadeb9615a1c814cd15c24420c` (antes de F1 da `3bcfe4e5e6bb72bb8d0d580bea2e1e4e3a1c2e7fb8fe00b14498cb173c70985e`, que es la falla).

### `lib/db.ts` (F1)

```ts
/** Antes `const SCHEMA`; se exporta para que el e2e lo aplique dos veces dentro de BEGIN…ROLLBACK. */
export const SCHEMA: string

export const TABLAS = ['casos', 'eventos', 'medias', 'testigos', 'usuarios', 'sesiones', 'posesiones', 'bitacora', 'productores', 'polizas', 'documentos_poliza', 'contactos_confianza', 'terceros', 'extracciones', 'envios', 'gestiones', 'eventos_reservados', 'expurgos', 'dispositivos', 'telemetria', 'telemetria_episodios', 'eventos_conduccion'] as const
```

### `lib/push.ts` (F0)

```ts
/** true sólo para https, sin usuario ni clave, puerto vacío o 443, y host en la lista de F0. Acepta cualquier cosa. */
export function endpointPushValido(endpoint: unknown): endpoint is string
```

### `lib/telemetria.ts` (servidor; F1, F2 cambia el veredicto)

```ts
import type { PoolClient } from 'pg'

/** Versiones del aviso de datos que el servidor acepta. [V6] verifica que incluya AVISO_DATOS_VERSION. */
export const AVISOS_DATOS_CONOCIDOS: readonly string[] = ['2026-09-16']

/** El 404 de «no existe» y de «no es tuya», idéntico. */
export const MENSAJE_TELEMETRIA_AJENA = 'No encontramos esa detección en este teléfono. Si ya no la tenés, abrí la actuación con "Tuve un accidente".'

/** §2.9. */
export interface ConfiguracionModoViaje {
  /** sha256(canonico({ alerta, caida_sin_golpe, motor_minimo, umbrales })).slice(0, 16). */
  version: string
  umbrales: Umbrales
  alerta: 'normal' | 'silenciosa' | 'apagada'
  caida_sin_golpe: 'alerta' | 'silenciosa'
  motor_minimo: number
  dias_conservacion: number
}

/**
 * Calculada una vez por proceso: umbrales = UMBRALES; MODO_VIAJE_ALERTA ('normal' por omisión),
 * MODO_VIAJE_CAIDA_SIN_GOLPE ('silenciosa'), MODO_VIAJE_MOTOR_MINIMO (entero ≥ 1; 1),
 * TELEMETRIA_DIAS_CONSERVACION (entero ≥ 1; 90). Un valor inválido usa la omisión y se loguea una vez.
 */
export function configuracionModoViaje(): ConfiguracionModoViaje

export interface QuienPide {
  /** huellaDispositivo('telemetria', …). */
  huella: string | null
  /** Usuario de la sesión, si hay. */
  usuarioId: string | null
}

export interface DuenioTelemetria {
  usuario_id: string | null
  dispositivo_sha256: string | null
  recibido_en: Date | string | null
}

/**
 * §5.1. Sin dispositivo_sha256 (filas viejas): sólo la sesión de su usuario_id (sin usuario_id, nadie).
 * Sin usuario_id: la misma huella. Con usuario_id: la sesión de ese usuario, o la misma huella dentro de las
 * 24 h desde recibido_en. Pura.
 */
export function accesoTelemetria(fila: DuenioTelemetria, quien: QuienPide, ahoraMs: number): boolean

/**
 * desfase = recibidoEnMs − enviado_en. La hora del teléfono se acepta si ocurrido_en + desfase cae entre
 * recibidoEnMs − 24 h y recibidoEnMs + 5 min; se devuelve la ISO del teléfono tal como vino. Si no, aceptada
 * null y console.warn('[telemetria] hora del teléfono fuera de rango', …). desfaseMs es entero; null si
 * enviado_en no es fecha.
 */
export function horaTelefonoAceptable(ocurridoEn: string, enviadoEn: string, recibidoEnMs: number): { aceptada: string | null; desfaseMs: number | null }

export interface ResultadoTelemetria {
  id: string
  /** true si la alerta se creó en este pedido (201); false si ya existía (200). */
  nueva: boolean
  /** telemetria.nivel después de recalcularlo. */
  nivel: NivelImpacto
  /** planEscalamiento({ nivel: nivelMayor(nivel, nivel_cliente), alertaMostrada: alerta_mostrada }, respuesta). */
  plan: PlanEscalamiento
}

/**
 * Una transacción: upsert de la alerta con la fusión de «Esquema › Reglas de fusión», upsert del episodio si vino,
 * recálculo de nivel, pico_g y veredicto de la alerta. Valida aviso_version contra AVISOS_DATOS_CONOCIDOS y, si no
 * está, lanza ErrorTransporte('campos.aviso_version', <texto servidor.aviso_desconocido>). Veredicto del servidor:
 * F1 analizarImpacto(episodio.serie); F2 evaluarEpisodio(episodio, { umbrales: UMBRALES, caidaSinGolpe: configuracionModoViaje().caida_sin_golpe }).
 */
export async function guardarTelemetria(
  cuerpo: { campos: CamposAlerta; episodio: EpisodioDecodificado | null },
  quien: { huella: string; usuarioId: string | null },
  recibidoEnMs: number,
): Promise<ResultadoTelemetria>

/** Cuerpo del detector anterior: alerta nueva sin id_cliente con un episodio n = 1; alerta_mostrada true, apertura 'episodio', aviso_version null. */
export async function guardarTelemetriaLegada(
  cuerpo: CuerpoTelemetriaLegado,
  quien: { huella: string; usuarioId: string | null },
): Promise<ResultadoTelemetria & { veredicto: Veredicto }>

export interface LecturaTelemetria {
  id: string
  /** ISO de coalesce(ocurrido_en_telefono, ts). */
  ocurrido_en: string
  nivel: NivelImpacto
  gps: { lat: number; lon: number; precision_m: number | null } | null
  respuesta: RespuestaAlerta | null
  hubo_choque: boolean | null
}

/** null si no existe o si accesoTelemetria da false. */
export async function leerTelemetriaPropia(id: string, quien: QuienPide): Promise<LecturaTelemetria | null>

/** Misma fusión que el upsert, en una sola sentencia. null si no existe o no hay acceso. */
export async function responderTelemetria(id: string, cuerpo: CuerpoRespuesta, quien: QuienPide): Promise<{ id: string; plan: PlanEscalamiento } | null>

/** DELETE de telemetria con caso_id IS NULL y (dispositivo_sha256 = huellaTelemetria o usuario_id = usuarioId), y de eventos_conduccion con dispositivo_sha256 = huellaConduccion. Una clave null no borra nada. */
export async function borrarTelemetriaPropia(quien: { huellaTelemetria: string | null; huellaConduccion: string | null; usuarioId: string | null }): Promise<{ alertas: number; eventos_conduccion: number }>

/** INSERT … ON CONFLICT (dispositivo_sha256, id_cliente) DO NOTHING por evento, con id = 'CON-' + randomUUID(); valida aviso_version como guardarTelemetria; ocurrido_en_telefono con horaTelefonoAceptable del lote. Nunca usuario_id. */
export async function guardarEventosConduccion(lote: LoteConduccion, huella: string, recibidoEnMs: number): Promise<{ guardados: number }>
```

`lib/telemetria.ts` importa de `./db`, `./hash`, `./impacto`, `./transporte-viaje` y `randomUUID` de `node:crypto`; `PoolClient` queda para la transacción interna. No importa `./casos`: al revés, `lib/casos.ts` (F5) importa `accesoTelemetria` y el tipo `QuienPide` de `./telemetria`, y `PoolClient` de `pg`.

### `lib/retencion.ts` (F5)

```ts
export interface ResultadoPurgaTelemetria {
  alertas: number
  eventos_conduccion: number
}

/**
 * Simulación: COUNT de telemetria con caso_id IS NULL y ts < now() − make_interval(days => $1::int), y de
 * eventos_conduccion con recibido_en < now() − …. Ejecución: por lotes de 500 con
 * DELETE FROM telemetria WHERE id IN (SELECT id FROM telemetria WHERE caso_id IS NULL AND ts < now() - make_interval(days => $1::int) ORDER BY ts LIMIT 500)
 * hasta que un lote borre menos de 500; lo mismo para eventos_conduccion por recibido_en. Además, al ejecutar:
 * gps en NULL donde hubo_choque = false, y serie y velocidades en NULL en los episodios de esas alertas.
 * Nunca por la hora del teléfono. Días = configuracionModoViaje().dias_conservacion.
 */
export async function purgarTelemetria(ejecutar: boolean): Promise<ResultadoPurgaTelemetria>

/** Corre purgarTelemetria(true) como mucho una vez por hora por proceso (globalThis.__actaUltimaPurgaTelemetria). Nunca lanza: loguea. Se llama dentro de after(). */
export async function purgarTelemetriaSiToca(): Promise<void>

/** Llama purgarTelemetria(ejecutar) siempre, después de expurgos y anonimizaciones. */
export async function aplicarPolitica(ejecutar: boolean): Promise<{ simulado: boolean; acciones: Candidato[]; telemetria: ResultadoPurgaTelemetria }>

// anonimizar(casoId, motivo) y expurgar(casoId, motivo): misma firma; dentro de su transacción,
// DELETE FROM telemetria WHERE caso_id = $1 (en expurgar, antes del DELETE de casos).
```

### `lib/casos.ts` (F5)

```ts
// Caso suma `origen: string` y mapear lee (fila.origen as string) ?? 'boton'. GET /api/casos/[id] lo devuelve.

/** Sólo primitivas: `type` y no `interface`, para que se pueda pasar como Record<string, unknown>. */
export type DetalleAperturaImpacto = {
  user_agent: string | null
  origen: 'impacto'
  telemetria_id: string
  nivel: string
  pico_g: number | null
  ocurrido_en_telefono: string | null
  desfase_reloj_ms: number | null
}

/** Convierte Date a ISO, BIGINT en texto a número (null si no es finito), undefined y NaN a null. Pura. */
export function detalleAperturaImpacto(
  fila: { id: string; nivel: string; pico_g: number | null; ocurrido_en_telefono: Date | string | null; desfase_reloj_ms: number | string | null },
  userAgent: string | null,
): DetalleAperturaImpacto

export interface AltaDesdeImpacto {
  /** El telemetria_id del cuerpo (TEL-XXXXXX). */
  telemetriaId: string
  quien: QuienPide
  /** Carátula ya resuelta por la ruta: el cuerpo o la precarga de la póliza. */
  caratula: { poliza: string | null; patente: string | null; asegurado: string | null; telefono: string | null; poliza_id: string | null }
  userAgent: string | null
  /** hashToken del secreto nuevo que la ruta devuelve una sola vez. */
  secretoSha256: string
}

export type ResultadoAltaImpacto =
  | { tipo: 'nueva'; id: string; vinculo: 'ok' | 'rechazado' }
  | { tipo: 'repetida'; id: string }

/**
 * §5.3 pasos 1–8 con BEGIN y COMMIT propios (ROLLBACK y relanza ante error). SELECT … FOR UPDATE de la
 * telemetría y accesoTelemetria. Sin fila o sin acceso: alta normal con origen 'boton', detalle { user_agent } y
 * vinculo 'rechazado'. Con caso_id: rota casos.secreto_sha256 y devuelve 'repetida'. Si no: INSERT con
 * origen 'impacto' y ON CONFLICT (id) DO NOTHING RETURNING id en el bucle de 5 intentos (sin SAVEPOINT);
 * UPDATE telemetria SET caso_id … AND caso_id IS NULL con rowCount 1; registrarEvento(id, 'apertura_actuacion',
 * detalleAperturaImpacto(fila, userAgent), { reservado: { poliza, patente }, cliente }). anotarPosesion lo hace
 * la ruta después del COMMIT.
 */
export async function abrirActuacionDesdeImpacto(cliente: PoolClient, alta: AltaDesdeImpacto): Promise<ResultadoAltaImpacto>
```

### `app/components/ModoViaje.tsx` (F4; F5 y F6 lo amplían)

Exporta sólo `ModoViaje` y `useModoViaje` (§1).

```tsx
'use client'

type MotorViaje = NonNullable<ReturnType<typeof motorDelNavegador>>

/** Sección de la hoja a la que se desplaza al abrir. 'golpe' la suma F5. */
type SeccionHoja = 'estado' | 'datos' | 'permisos' | 'golpe'

interface ContextoModoViaje {
  /** ESTADO_SERVIDOR en el servidor y durante la hidratación. */
  estado: EstadoModoViaje
  /** null en el servidor y antes de hidratar. */
  motor: MotorViaje | null
  /** Contacto de confianza leído con sesión (memoria y localStorage 'acta:viaje:contacto'); null sin contacto. */
  contacto: { nombre: string; telefono: string } | null
  /** Ref de callback de la tarjeta del inicio: la observa con IntersectionObserver para la regla de la píldora en '/'. */
  refTarjeta: (elemento: HTMLElement | null) => void
  /** Abre la hoja (showModal) y se desplaza a la sección con scrollIntoView sobre una ref. No hace nada con una alerta abierta. */
  abrirHoja: (seccion?: SeccionHoja) => void
}

/**
 * <div className="raiz-app" inert={capaBloqueante || undefined}>{children}</div> y después la capa dentro de un
 * error boundary de clase (sin exportar) que devuelve null ante un error; {children} queda fuera del boundary.
 * capaBloqueante = estado.alerta !== null.
 * useSyncExternalStore(suscribir, obtener, () => ESTADO_SERVIDOR), con suscribir y obtener definidos a nivel de
 * módulo: `(fn) => motorDelNavegador()?.suscribir(fn) ?? (() => {})` y `() => motorDelNavegador()?.estado() ?? ESTADO_SERVIDOR`.
 * Efectos: motor.cambiarRuta(usePathname()) en cada cambio; motor.drenarCola() al montar, en 'online', al volver
 * visible y cada 30 s; GET /api/perfil cuando la fase pasa a 'activo' (200 guarda contacto; 401 lo borra);
 * useLayoutEffect que cierra la hoja apenas estado.alerta deja de ser null; data-pildora-viaje en body mientras la
 * píldora está visible; focusin y focusout para ocultarla con un input, textarea o select con foco.
 */
export function ModoViaje({ children }: { children: React.ReactNode }): React.JSX.Element

/** Fuera del proveedor devuelve { estado: ESTADO_SERVIDOR, motor: null, contacto: null, refTarjeta: () => {}, abrirHoja: () => {} }. */
export function useModoViaje(): ContextoModoViaje
```

Regla de la píldora (F4):

```ts
const intencion = estado.fase === 'reanudando' || estado.fase === 'pidiendo' || estado.fase === 'activo' || estado.fase === 'en_pausa' || estado.fase === 'reanudar_con_toque'
const pideAccion = estado.golpePendiente !== null || estado.inactividad !== null || estado.fase === 'reanudar_con_toque' || (estado.fase === 'activo' && estado.avisos.sonido === 'requiere_toque')
const visible = estado.alerta === null && !campoConFoco && (
  (estado.ruta.conPildora && (intencion || estado.golpePendiente !== null)) ||
  (estado.ruta.actual === '/' && pideAccion && tarjetaQuedoArriba)
)
// tarjetaQuedoArriba: la última entrada del IntersectionObserver dice !isIntersecting && boundingClientRect.bottom < 0.
// F4 escribe la regla sin los dos términos de golpePendiente (todavía no tiene rótulo ni sección); F5 los agrega.
```

**Decisión:** en `/` la píldora sólo aparece si la tarjeta quedó **arriba** del viewport; si todavía está abajo, la persona llega a ella bajando. Como `.boton-gigante` está arriba de la tarjeta, así nunca se superponen, sin observar otro elemento.

Rótulo y toque de la píldora, en orden de prioridad (el primero que aplica):

| Condición | Rótulo | Toque |
|---|---|---|
| `golpePendiente` | `pildora.golpe` (F5) | abre la hoja en `'golpe'` |
| `inactividad` | `pildora.inactividad` | `motor.seguirViaje()` (sin `aria-haspopup`) |
| `fase === 'reanudar_con_toque'` | `pildora.reanudar` | `motor.reanudar()` (sin `aria-haspopup`) |
| `avisos.sonido === 'requiere_toque'` | `pildora.sonido` | abre la hoja (el destrabador global destraba) |
| `fase === 'en_pausa'` | `pildora.en_pausa` | abre la hoja |
| resto | `pildora.activo` | abre la hoja |

Cuando abre la hoja lleva `aria-haspopup="dialog"` y `aria-expanded`. El punto es `<span className="punto" data-estado=…>` con `ok` (activo), `espera` (pausa, sonido, reanudar, inactividad) o `error` (golpe pendiente).

**Decisión:** el estado de la hoja vive en el proveedor, no en el motor. Un `<dialog>` modal está en la capa superior y deja inerte todo lo demás, incluida la alerta: por eso se cierra en un `useLayoutEffect` antes de pintar la alerta.

### `app/page.tsx` (F4)

- `TarjetaModoViaje` es un componente **sin exportar** dentro del archivo, hijo directo de `main.inicio`, después del enlace «Continuar la actuación que dejaste abierta» (hoy `app/page.tsx:123-127`) y antes de `section.bloque-inicio` (`app/page.tsx:129`). Usa `useModoViaje()` y le pasa `refTarjeta` a su `section`.
- `iniciar()` (hoy `app/page.tsx:55`) llama `motor?.apagar('accidente_registrado')` antes del `fetch`.

### `app/components/AyudaImpacto.tsx` (F5)

Exporta sólo `AyudaImpacto` (§1: la usan la alerta y `/aviso`).

```tsx
'use client'

export function AyudaImpacto(props: {
  /** Título: ayuda.titulo_pediste o ayuda.titulo_no_respondiste. */
  origen: 'necesito_ayuda' | 'sin_respuesta'
  /** id_cliente si la alerta es la del motor en este teléfono; null desde /aviso con una alerta sólo del servidor. */
  idCliente: string | null
  /** TEL-XXXXXX si se conoce. */
  idServidor: string | null
  /** Para «Compartir mi ubicación»; null → no hay botón y se muestra ayuda.sin_ubicacion. */
  ubicacion: { lat: number; lon: number } | null
  /** Ya hubo respuesta humana: tocar un tel: no registra nada. */
  respondida: boolean
  /** Se llama en el onClick de cada tel: (BotonesEmergencia y contacto) antes de dejar seguir el enlace, sólo si !respondida. */
  alLlamar: () => void
  /** «Estoy bien, fue una falsa alarma». */
  alFalsaAlarma: () => void
}): React.JSX.Element
```

Adentro: `useModoViaje()` para `contacto` y `motor`, `useRouter()` para navegar. «Registrar el accidente»: si `actuacionAbierta()` devuelve un id, el botón dice `ayuda.continuar` y navega a `/s/<id>`; si no, `await motor.registrarAccidente({ idCliente, idServidor })` y según el resultado navega a `/s/<id>`, muestra `ayuda.sin_senal` o muestra el mensaje de error. El enlace de ubicación se arma antes del toque: `` `https://www.google.com/maps/search/?api=1&query=${lat},${lon}` ``; en el `onClick`, sin ningún `await` antes, `navigator.share({ text: <ayuda.compartir_texto>, url })`; `AbortError` no hace nada; el portapapeles sólo si no hay `share` o `navigator.canShare?.(datos) === false`, y entonces muestra `ayuda.copiado`.

Uso en la alerta: `alLlamar={() => motor.responder('necesito_ayuda')}` y `alFalsaAlarma={() => motor.falsaAlarma()}`. Uso en `/aviso` sin alerta del motor: `alLlamar` hace `POST /api/telemetria/<t>/respuesta { respuesta: 'necesito_ayuda' }` y `alFalsaAlarma` hace `POST … { respuesta: 'estoy_bien', hubo_choque: false }` y después `router.replace('/')` (**Decisión:** en esta etapa el motor nunca hace `push` a `/aviso`, así que nunca `router.back()` ni `push('/')`).

### `app/components/BotonesEmergencia.tsx` (F4)

```tsx
/** chicos: clase 'emergencias emergencias-chicas' (debajo de «¿Hubo un choque?»). alLlamar: onClick de cada <a href="tel:…">, sin preventDefault. */
export function BotonesEmergencia({ soloLugar = false, chicos = false, alLlamar }: { soloLugar?: boolean; chicos?: boolean; alLlamar?: (numero: string) => void }): React.JSX.Element
```

Con `soloLugar` sigue la clase `emergencias`; sin él, `emergencias emergencias-inicio`; con `chicos` (y sin `soloLugar`), `emergencias emergencias-chicas`. Todos los llamadores actuales son Client Components; el archivo sigue sin `'use client'`.

### `app/components/Iconos.tsx` (F4)

`NombreIcono` suma `'auto'`. Dibujo (números como expresión JSX por la trampa de `VALOR`):

```tsx
{nombre === 'auto' ? (
  <>
    <path d="M5 17v-4.4l1.8-4.5a2 2 0 0 1 1.9-1.3h6.6a2 2 0 0 1 1.9 1.3l1.8 4.5V17" />
    <path d="M4 12.6h16M5 17h14M7 17v2M17 17v2" />
    <circle cx={8.5} cy={14.8} r={1} />
    <circle cx={15.5} cy={14.8} r={1} />
  </>
) : null}
```

---

## Contratos HTTP

Convenciones de todas las rutas de esta sección: `runtime` y `dynamic` exportados; `catch` final en `errorApi`; errores con forma `{ error: string, tipo?: string, … }`; el cliente manda el cuerpo como string (`JSON.stringify`) con `Content-Type: application/json`. Formas de error comunes que produce `errorApi` desde F1:

| Estado | Cuerpo | Cuándo |
|---|---|---|
| 400 | `{ "error": "serie[37].ax no es un número", "tipo": "transporte", "campo": "serie[37].ax" }` | `ErrorTransporte` |
| 400 | `{ "error": "El cuerpo del pedido no es JSON válido: mandalo como texto JSON.", "tipo": "cuerpo" }` | `ErrorCuerpo` |
| 413 | `{ "error": "El pedido supera los 128 KB que acepta esta ruta: mandá menos datos por envío.", "tipo": "cuerpo" }` | `ErrorCuerpo` |
| 429 | `{ "error": "Se mandaron demasiadas lecturas desde este teléfono. Esperá 37 segundos.", "tipo": "limite", "reintentar_en_s": 37 }` + cabecera `Retry-After: 37` | `ErrorLimite` |
| 503 | `{ "error": "…", "tipo": "configuracion", "causa": "…", "ayuda": "Revisá el estado del sistema en /api/salud" }` | base de datos (sin cambios) |

### `GET /api/telemetria/configuracion` (F1) — `app/api/telemetria/configuracion/route.ts`

- Sin cuerpo. Llama `huellaDispositivo('telemetria', true)`: crea la cookie `acta_posesion` si falta, para que los pedidos siguientes no compitan por crearla.
- 200, cabecera `Cache-Control: no-store`:

```json
{
  "version": "9f2c4a1b7e3d5c60",
  "umbrales": { "sospechaG": 4, "confirmadoG": 8, "msSobreUmbral": 30, "velocidadPreviaKmh": 15, "velocidadPreviaCaidaKmh": 30, "velocidadPosteriorKmh": 8, "ventanaPostMs": 8000, "topeEpisodioMs": 15000, "giroDps": 180, "giroManipulacionDps": 300, "desaceleracionImposibleG": 1.4, "frenadaG": 0.45, "aceleracionG": 0.4, "retrasoMinMs": 0, "retrasoMaxMs": 3000 },
  "alerta": "normal",
  "caida_sin_golpe": "silenciosa",
  "motor_minimo": 1,
  "dias_conservacion": 90
}
```

(En F1 `umbrales` todavía tiene los 7 campos viejos; desde F2, los 15.)

### `POST /api/telemetria` (F1; F2 cambia el veredicto; F5 suma la purga) — `app/api/telemetria/route.ts`

- Máximo `BYTES_MAX_TELEMETRIA` = 131 072 bytes (128 KB).
- Orden: `huellaDispositivo('telemetria', true)` → `leerSesion()` → `limitar('telemetria', { ip: ipDelCliente(req.headers), huella })` → `leerCuerpoLimitado` → si `esCuerpoLegado`: `decodificarCuerpoLegado` y `guardarTelemetriaLegada`; si no: `validarCuerpoTelemetria` y `guardarTelemetria` → respuesta → (F5) `after(() => purgarTelemetriaSiToca())`.
- Cuerpo nuevo (`CuerpoTelemetria`), `episodio` puede ser `null`:

```json
{
  "campos": {
    "id_cliente": "7d0f5a4e-2c1b-4f7e-9a3d-5e6f7a8b9c0d",
    "aviso_version": "2026-09-16",
    "version_motor": 1,
    "plataforma": "android",
    "standalone": true,
    "ocurrido_en_telefono": "2026-09-16T17:32:08.412Z",
    "enviado_en": "2026-09-16T17:32:20.050Z",
    "apertura": "episodio",
    "nivel_cliente": "confirmado",
    "alerta_mostrada": true,
    "sonido": true,
    "respuestas": [{ "respuesta": "sin_respuesta", "en_telefono": "2026-09-16T17:32:47.001Z" }],
    "hubo_choque": null,
    "ms_hasta_respuesta": null,
    "hz_medido": 59.8,
    "aceleracion_derivada": false,
    "gps": { "lat": -34.6037, "lon": -58.3816, "precision_m": 9.5 },
    "umbrales_cliente": { "sospechaG": 4, "confirmadoG": 8, "msSobreUmbral": 30, "velocidadPreviaKmh": 15, "velocidadPreviaCaidaKmh": 30, "velocidadPosteriorKmh": 8, "ventanaPostMs": 8000, "topeEpisodioMs": 15000, "giroDps": 180, "giroManipulacionDps": 300, "desaceleracionImposibleG": 1.4, "frenadaG": 0.45, "aceleracionG": 0.4, "retrasoMinMs": 0, "retrasoMaxMs": 3000 }
  },
  "episodio": {
    "n": 1,
    "ocurrido_en_telefono": "2026-09-16T17:32:08.412Z",
    "disparador": "golpe",
    "fuente": "confiable",
    "hz_medido": 59.8,
    "veredicto_cliente": { "nivel": "confirmado", "picoG": 11.7, "motivo": "Iba andando y quedó detenido después de un golpe sostenido." },
    "serie": [[-2000, 0.113, -0.052, 0.201, 1.004, 2.1, 0.012], [-1983.3, 0.098, -0.047, 0.188, 1.002, 1.9, 0.011]],
    "velocidades": [[-9800, 54.2, 8, 0, 0], [-8800, 55.1, 8, 15.2, 0.4]]
  }
}
```

(El teléfono manda en `veredicto_cliente` el `Veredicto` entero; el servidor lo reconstruye desde la lista cerrada.)

- Cuerpo del detector anterior: `{ "serie": [{ "t": 0, "ax": 0.2, "ay": 0.1, "az": 0.1, "gTotal": 1, "giro": 3 }], "origen": "navegador" }` (acepta además `lat` y `lon` numéricos).
- Respuestas:

| Estado | Cuerpo | Cuándo |
|---|---|---|
| 201 | `{ "id": "TEL-7K2M4Q", "nivel": "confirmado", "plan": { "ofrecerEmergencias": true, "ofrecerContactoDeConfianza": true, "precargarDenuncia": true, "texto": "No hubo respuesta y el impacto está confirmado. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente." } }` | alerta nueva |
| 200 | la misma forma | alerta que ya existía (mismo `dispositivo_sha256` e `id_cliente`) |
| 201 | `{ "ok": true, "id": "TEL-…", "veredicto": { … }, "nivel": "sospecha", "plan": { … } }` | cuerpo del detector anterior |
| 400 | `tipo: 'transporte'` o `'cuerpo'` | validación, `aviso_version` desconocida, JSON inválido |
| 413 / 429 / 503 | ver tabla común | |

### `GET /api/telemetria/[id]` (F1) — `app/api/telemetria/[id]/route.ts`

- `type Ctx = { params: Promise<{ id: string }> }`. `huellaDispositivo('telemetria', false)` y `leerSesion()`; `leerTelemetriaPropia`.
- 200, `Cache-Control: no-store`: `{ "id": "TEL-7K2M4Q", "ocurrido_en": "2026-09-16T17:32:08.412Z", "nivel": "confirmado", "gps": { "lat": -34.6037, "lon": -58.3816, "precision_m": 9.5 }, "respuesta": "sin_respuesta", "hubo_choque": null }`.
- 404, `Cache-Control: no-store`: `{ "error": "No encontramos esa detección en este teléfono. Si ya no la tenés, abrí la actuación con \"Tuve un accidente\"." }` — igual si no existe o si no es de este teléfono.

### `POST /api/telemetria/[id]/respuesta` (F1) — `app/api/telemetria/[id]/respuesta/route.ts`

- Máximo `BYTES_MAX_RESPUESTA` = 2 048 bytes. Limitador `telemetria`. Posesión como el `GET`.
- Cuerpo: `{ "respuesta": "estoy_bien", "hubo_choque": false, "en_telefono": "2026-09-16T17:33:02.000Z" }` (`hubo_choque` y `en_telefono` opcionales).
- 200: `{ "ok": true, "id": "TEL-7K2M4Q", "plan": { … } }`. 400: `{ "error": "Respuesta no válida. Las posibles son: estoy_bien, necesito_ayuda, sin_respuesta.", "tipo": "transporte", "campo": "respuesta" }`. 404: el mensaje de ajena. 413 / 429.
- Nunca registra eslabones, aunque la alerta esté vinculada a una actuación (a lo sumo `anotarEnBitacora`; esta etapa no anota nada).

### `DELETE /api/telemetria/mias` (F1) — `app/api/telemetria/mias/route.ts`

- Sin cuerpo; sin limitador. `huellaDispositivo('telemetria', false)`, `huellaDispositivo('conduccion', false)` y `leerSesion()`; `borrarTelemetriaPropia`.
- 200, `Cache-Control: no-store`: `{ "ok": true, "alertas": 2, "eventos_conduccion": 14 }` (ceros si no hay nada).
- La carpeta estática `mias` convive con `[id]`: en el app router gana el segmento estático; no se define `GET` en `mias`.

### `POST /api/conduccion` (F1; F5 suma la purga) — `app/api/conduccion/route.ts`

- Máximo `BYTES_MAX_CONDUCCION` = 8 192 bytes. `huellaDispositivo('conduccion', true)`; limitador `conduccion`; **nunca** `leerSesion()` ni `usuario_id`.
- Cuerpo (`LoteConduccion`, de 1 a 50 eventos):

```json
{
  "aviso_version": "2026-09-16",
  "version_motor": 1,
  "plataforma": "ios",
  "enviado_en": "2026-09-16T17:40:00.000Z",
  "eventos": [
    ["0b8f2d9e-6c4a-4a1b-8e3f-2d1c0b9a8e7f", "frenada", "2026-09-16T17:38:12.500Z", 58.4, 30.2, 1800, 0.52, 0.61],
    ["5a1e3c7b-9d2f-4b6a-8c0e-1f2a3b4c5d6e", "golpe_en_marcha", "2026-09-16T17:39:01.020Z", 47, 45.5, null, null, 6.3]
  ]
}
```

- 200: `{ "ok": true, "guardados": 2 }` (`guardados` cuenta sólo los nuevos: repetir el lote da 0). 400 / 413 / 429.

### `POST /api/casos` (F1 tope y límite; F5 vínculo) — `app/api/casos/route.ts`

- Máximo 8 192 bytes con `leerCuerpoLimitado` (reemplaza `req.json()` de `app/api/casos/route.ts:24`).
- Sin sesión: `limitar('altas', { ip: ipDelCliente(req.headers), huella: await huellaDispositivo('telemetria', false) })` antes de leer el cuerpo. **Decisión:** la huella de propósito `telemetria` sin crear la cookie sirve de clave en memoria; nunca se guarda. Con sesión no se limita.
- Sin `telemetria_id` (o que no sea texto de 1 a 20 caracteres): igual que hoy, 201 `{ "id": "ADS-7K2M4Q", "secreto": "…", "precarga_ambigua": false }`.
- Con `{ "telemetria_id": "TEL-7K2M4Q" }` (F5): la ruta resuelve la carátula y la precarga como hoy, genera `secreto = nuevoToken()`, toma un cliente del pool y llama `abrirActuacionDesdeImpacto`; después del `COMMIT`, `anotarPosesion(id)`.

| Estado | Cuerpo | Cuándo |
|---|---|---|
| 201 | `{ "id": "ADS-7K2M4Q", "secreto": "…", "precarga_ambigua": false, "vinculo_telemetria": "ok" }` | alta nueva vinculada |
| 201 | `{ "id": "ADS-9P3R5T", "secreto": "…", "precarga_ambigua": false, "vinculo_telemetria": "rechazado" }` | la telemetría no existe o no es de este teléfono: la actuación se abre igual, sin vínculo |
| 200 | `{ "id": "ADS-7K2M4Q", "secreto": "<nuevo>", "ya_registrada": true, "vinculo_telemetria": "ok" }` | la telemetría ya tenía `caso_id`: secreto rotado, sin eslabón |
| 413 / 429 / 503 | tabla común | Nunca 403 ni 500 por el vínculo |

### `PATCH /api/casos/[id]` (F1) — `app/api/casos/[id]/route.ts`

- `leerCuerpoLimitado(req, 65_536)` en lugar de `req.json()` (`app/api/casos/[id]/route.ts:51`), después de las comprobaciones de acceso y de estado que ya están. 413: `El pedido supera los 64 KB que acepta esta ruta: mandá menos datos por envío.`

### `POST /api/push/dispositivos` y `POST /api/push/prueba` (F0)

- `dispositivos`: 400 `{ "error": <push.endpoint_invalido> }` o `{ "error": <push.claves_invalidas> }`; el resto sin cambios (201 `{ "ok": true }`).
- `prueba`: 400 `{ "error": <push.endpoint_invalido> }`; 404 sin cambios; 403 `{ "error": <push.suscripcion_ajena>, "tipo": "acceso" }` vía `ErrorAcceso`; 200 o 502 `{ "ok", "estado", "motivo", "caducada" }` con `motivo` de texto fijo, nunca con el cuerpo del servicio.

### `GET /api/salud` (F2)

- La respuesta suma `"modo_viaje": { "ok": true, "detalle": "Umbrales del detector dentro de rango.", "problemas": [] }`; con problemas, `ok: false`, `detalle: "Hay 2 umbrales fuera de rango: se usan los valores de omisión. Revisá las variables IMPACTO_* y CONDUCCION_*."` y `problemas` con los `ProblemaUmbral`. No cambia el `ok` general ni el estado HTTP.

### `POST /api/mantenimiento/expurgo` (F5, sin tocar la ruta)

- Como `aplicarPolitica` devuelve `telemetria`, la respuesta pasa a `{ "ok": true, "simulado": true, "acciones": [], "telemetria": { "alertas": 3, "eventos_conduccion": 41 } }`.

### `GET /api/perfil` (existente, lo usa el proveedor desde F4)

- 200 `{ "usuario": { … }, "poliza_principal": { … }, "contacto": { "nombre": "…", "telefono": "…", "relacion": "…" } | null }`; 401 sin sesión. El proveedor guarda sólo `nombre` y `telefono`.

---

## Esquema

F1 agrega este bloque al final de `SCHEMA` en `lib/db.ts`, después de `CREATE TRIGGER gestiones_inmutables … EXECUTE FUNCTION eventos_solo_insercion();` (hoy `lib/db.ts:594-596`) y antes del backtick de cierre (`lib/db.ts:597`). Dentro del template string no puede aparecer `${`.

```sql
-- ===================== Modo viaje =====================
--
-- REGLA para constraints sobre tablas que ya existen: nombre versionado dentro de un bloque
-- DO con guarda, NOT VALID y EXCEPTION WHEN duplicate_object. Nunca ADD CHECK sin nombre (se
-- duplica en cada arranque) ni un CHECK dentro de ADD COLUMN IF NOT EXISTS sobre una columna
-- que ya existe (se ignora en silencio). SCHEMA corre como UNA sola consulta: un error revierte
-- todo y deja caída la aplicación. Para cambiar la lista de valores: crear _v2 y hacer
-- DROP CONSTRAINT IF EXISTS … _v1 dentro del mismo bloque.

-- telemetria es la ALERTA: una fila por alerta del teléfono, con sus episodios aparte.
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS id_cliente           TEXT;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS dispositivo_sha256   TEXT;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS ocurrido_en_telefono TIMESTAMPTZ;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS enviado_en           TIMESTAMPTZ;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS recibido_en          TIMESTAMPTZ;
-- Las filas anteriores toman su hora de alta, no la del despliegue; el WHERE lo hace idempotente.
UPDATE telemetria SET recibido_en = ts WHERE recibido_en IS NULL;
ALTER TABLE telemetria ALTER COLUMN recibido_en SET DEFAULT now();
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS desfase_reloj_ms     BIGINT;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS nivel_cliente        TEXT;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS veredicto_cliente    JSONB;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS umbrales             JSONB;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS umbrales_cliente     JSONB;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS respuestas           JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS hubo_choque          BOOLEAN;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS ms_hasta_respuesta   INTEGER;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS sonido               BOOLEAN;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS alerta_mostrada      BOOLEAN;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS version_motor        INTEGER;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS plataforma           TEXT;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS standalone           BOOLEAN;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS hz_medido            REAL;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS aceleracion_derivada BOOLEAN;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS gps_precision_m      REAL;
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS aviso_version        TEXT;
-- Qué abrió la alerta: un episodio o el seguimiento de un golpe en marcha. Sirve para calibrar.
ALTER TABLE telemetria ADD COLUMN IF NOT EXISTS apertura             TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS telemetria_cliente_uidx ON telemetria (dispositivo_sha256, id_cliente) WHERE id_cliente IS NOT NULL;
CREATE INDEX IF NOT EXISTS telemetria_caso_idx  ON telemetria (caso_id);
CREATE INDEX IF NOT EXISTS telemetria_purga_idx ON telemetria (ts) WHERE caso_id IS NULL;

DO $c$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'telemetria_respuesta_valida_v1'
                   AND conrelid = 'telemetria'::regclass) THEN
    ALTER TABLE telemetria ADD CONSTRAINT telemetria_respuesta_valida_v1
      CHECK (respuesta IN ('estoy_bien','necesito_ayuda','sin_respuesta')) NOT VALID;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $c$;

-- Un episodio: lo necesario para que el servidor repita el cálculo. serie y velocidades sólo
-- si algún veredicto es sospecha o confirmado, o si la alerta se abrió por seguimiento.
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

-- Frenadas, aceleraciones, golpes en marcha y caídas silenciosas: sin cuenta y sin ubicación.
-- En esta etapa sólo sirven para calibrar el detector.
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

DO $c$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'eventos_conduccion_tipo_valido_v1'
                   AND conrelid = 'eventos_conduccion'::regclass) THEN
    ALTER TABLE eventos_conduccion ADD CONSTRAINT eventos_conduccion_tipo_valido_v1
      CHECK (tipo IN ('frenada','aceleracion','golpe_en_marcha','caida_silenciosa')) NOT VALID;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $c$;
```

**Decisiones:** (1) `recibido_en` se agrega sin `DEFAULT`, se completa con `ts` y recién después toma `DEFAULT now()`: con `ADD COLUMN … DEFAULT now()` todas las filas viejas quedaban con la hora del despliegue y la regla de 24 h de §5.1 las leía como recientes. (2) La columna `apertura` no está en §5.2: se suma para separar en las consultas de calibración las alertas abiertas por seguimiento. (3) `serie` y `velocidades` también se guardan cuando `apertura = 'seguimiento'`: esa alerta se le mostró a una persona con veredicto `nada`, y sin la serie no hay forma de revisarla. (4) Los ids nuevos: `nuevoId('TEL')` para alertas (como hoy), `nuevoId('EPI')` para episodios y `'CON-' + randomUUID()` (de `node:crypto`) para eventos de conducción: con millones de eventos en los días de conservación, los 6 caracteres de `nuevoId` (unos 1,07e9 valores) chocan, y `ON CONFLICT (dispositivo_sha256, id_cliente)` no cubre la clave primaria `id`, así que un choque daría 23505 y un 500 para el lote entero.

`TABLAS` suma `'telemetria_episodios'` y `'eventos_conduccion'` (ver «Interfaces › `lib/db.ts`»).

Filas viejas: hora = `coalesce(ocurrido_en_telefono, ts)`; `gps.precision_m` opcional; una fila sin `dispositivo_sha256` sólo se lee o vincula con la sesión de su `usuario_id`; sin dueño, 404.

### Reglas de fusión del upsert de la alerta (`guardarTelemetria`)

Una sola sentencia `INSERT … ON CONFLICT (dispositivo_sha256, id_cliente) WHERE id_cliente IS NOT NULL DO UPDATE SET …` (el predicado es obligatorio para que Postgres encuentre el índice parcial), dentro de la transacción que después guarda el episodio y recalcula los máximos.

| Columna | Alta | Ya existía |
|---|---|---|
| `id` | `nuevoId('TEL')` | se conserva |
| `usuario_id` | sesión o NULL | se conserva (iniciar sesión no reasigna filas anónimas) |
| `ts`, `recibido_en` | `now()` | se conservan |
| `origen` | `'navegador'` | se conserva |
| `respuesta` | se aplica cada elemento de `campos.respuestas` en orden sobre NULL, con la regla de la columna de al lado; NULL si el arreglo está vacío | cada elemento de `campos.respuestas`, en orden: humana (`estoy_bien`, `necesito_ayuda`): se escribe siempre; `sin_respuesta`: sólo si `respuesta IS NULL` en ese momento; arreglo vacío: se conserva. Para que siga siendo una sola sentencia, el servidor lo reduce antes a dos parámetros equivalentes: la última humana del arreglo (si hay, gana) y si el arreglo trae `sin_respuesta` (vale sólo con `respuesta IS NULL` y sin humana) |
| `respondido_en` | `now()` si se escribió alguna respuesta | `now()` cuando alguna respuesta se escribe |
| `respuestas` | `[{ respuesta, en_telefono, recibido_en }]` por cada elemento que se escribió, o `[]` | por cada elemento de `campos.respuestas` que se escribió, se agrega `{ respuesta, en_telefono, recibido_en: now() }` si no hay ya una entrada con el mismo `respuesta` y `en_telefono` (deduplica por ese par; en SQL, con `jsonb_array_elements` sobre el arreglo del cuerpo) (`NOT (telemetria.respuestas @> jsonb_build_array(jsonb_build_object('respuesta', …, 'en_telefono', …)))`) |
| `hubo_choque` | valor | se escribe si vino no null |
| `gps`, `gps_precision_m` | `campos.gps` (`gps` NULL si `hubo_choque` es false) | `gps`: el existente si no es NULL, si no el nuevo; NULL cuando `hubo_choque` queda en false. `gps_precision_m` igual pero no se borra |
| `ms_hasta_respuesta` | valor | `COALESCE(existente, nuevo)` |
| `sonido` | valor | el nuevo si no es null; si no, el existente |
| `alerta_mostrada` | valor | `existente OR nuevo` |
| `nivel_cliente` | valor | el mayor de los dos |
| `ocurrido_en_telefono` | aceptada por `horaTelefonoAceptable` o NULL | `COALESCE(existente, nuevo)` |
| `enviado_en`, `desfase_reloj_ms` | del intento | del último intento |
| `umbrales` | `configuracionModoViaje().umbrales` | el actual |
| `umbrales_cliente`, `version_motor`, `plataforma`, `standalone`, `hz_medido`, `aceleracion_derivada`, `aviso_version`, `apertura` | valor | el último |
| `nivel`, `pico_g`, `veredicto` | `'nada'`, NULL, `'{}'` | se recalculan al final de la transacción desde los episodios: `nivel` el mayor, `pico_g` el máximo de `(veredicto->>'picoG')::real`, `veredicto` el del episodio de mayor nivel (a igual nivel, mayor `picoG`); sin episodios quedan como estaban |

Si `hubo_choque` queda en `false` (por el upsert o por la respuesta), en la misma transacción: `UPDATE telemetria_episodios SET serie = NULL, velocidades = NULL WHERE telemetria_id = $1`.

### Reglas del upsert del episodio

`INSERT … ON CONFLICT (telemetria_id, n) DO UPDATE SET` todas las columnas salvo `id` y `recibido_en` (un reintento pisa con lo mismo).

| Columna | Valor |
|---|---|
| `veredicto` | F1: `analizarImpacto(episodio.serie)`; F2: `evaluarEpisodio(episodio, …)` |
| `veredicto_cliente` | `EpisodioDecodificado.veredictoCliente` |
| `serie`, `velocidades` | las filas reconstruidas si `veredicto.nivel` o `veredicto_cliente.nivel` es `sospecha` o `confirmado`, o si `apertura = 'seguimiento'`; NULL si no, o si la alerta tiene `hubo_choque = false` |
| `recortada` | `EpisodioDecodificado.recortada` |
| `ocurrido_en_telefono` | aceptada por `horaTelefonoAceptable` con el `enviado_en` de los campos, o NULL |

---

## Almacenamiento del cliente

Todo acceso a `localStorage` va en `try/catch` (hay navegadores que tiran al acceder) y se hace desde el motor con `fuentes.almacenamiento` (o con `fuentes.local` para las dos claves de `lib/local.ts`), salvo el contacto, que es del proveedor, y la lectura de `actuacionAbierta()` que hace `AyudaImpacto.tsx`. Todas las horas son ms de pared (`Date.now()`); todos los valores son `JSON.stringify` salvo `acta:diagnostico`, `acta:actuacion-abierta` y `acta:secreto:<id>`.

| Clave | Quién escribe | Fase | Vigencia | Para qué |
|---|---|---|---|---|
| `acta:viaje` | motor | F3 | `ultimoLatido` de menos de 30 min | Intención de tener el modo encendido (§4.3) |
| `acta:golpe-pendiente` | motor | F3 | 30 min desde `ocurridoEn` | Golpe detectado sin decidir (§3.5); sobrevive a recarga y apagado |
| `acta:viaje:alerta` | motor | F3 | ver reglas de restauración | La alerta viva, para que una recarga o el cierre de la PWA durante una llamada no la pierdan |
| `acta:viaje:sin-sensores` | motor | F3 | 24 h desde `en` | El equipo no entregó lecturas: la tarjeta lo dice sin volver a pedir permiso |
| `acta:viaje:configuracion` | motor | F3 | 24 h desde `guardadaEn` | Última configuración remota, para usarla sin red |
| `acta:viaje:contacto` | proveedor | F4 | hasta un 401 de `/api/perfil` | Mostrar «Llamar a …» sin red |
| `acta:actuacion-abierta` | `lib/local.ts` (el motor, vía `fuentes.local`, en `registrarAccidente`; el recorrido, como hoy) | ya existe (F3 la escribe desde el motor) | hasta `olvidarActuacion` | La actuación abierta en este teléfono; valor: el id en texto plano, sin `JSON.stringify` |
| `acta:secreto:<id>` | `lib/local.ts` (el motor, vía `fuentes.local`, en `registrarAccidente`) | ya existe (F3 la escribe desde el motor) | se conserva después de `olvidarActuacion` (sirve para reclamar la actuación desde una cuenta) | El secreto de esa actuación; valor: texto plano, sin `JSON.stringify` |
| `acta:diagnostico` | la persona, a mano | F3 lee, F6 muestra | mientras exista | Habilita la sección «Diagnóstico» de la hoja |

Formas exactas:

```json
// acta:viaje
{ "encendidoEn": 1789579800000, "ultimoLatido": 1789580400000, "ultimoMovimiento": 1789580390000, "documentoId": "3c1e2b7a-5d4f-4e6a-9b8c-7d6e5f4a3b2c" }
```

- `documentoId`: UUID que genera cada instancia del motor. El latido se escribe cada 30 s sólo desde el documento visible y con fase `activo`, o `en_pausa` por ruta. Se escribe la intención recién con lecturas válidas (§4.1 paso 8) y se borra al apagar, con `sin_lecturas` y con `'denied'` al reanudar. Si otra ventana la borra (evento `storage` con `key === 'acta:viaje'` y `newValue === null`), este motor se apaga sin volver a escribirla.

```json
// acta:golpe-pendiente   (telemetriaId se omite si todavía no se conoce)
{ "telemetriaIdCliente": "7d0f5a4e-2c1b-4f7e-9a3d-5e6f7a8b9c0d", "telemetriaId": "TEL-7K2M4Q", "ocurridoEn": 1789580328412 }
```

- Se crea con «Estoy bien» en movimiento, con `hubo_choque` sin respuesta a los 60 s, con una alerta en `hubo_choque` reemplazada por otra y con la ayuda reducida porque el auto volvió a andar. Se borra con «No, fue una falsa alarma», al registrar el accidente y al vencer.

```json
// acta:viaje:alerta
{
  "estado": "ayuda",
  "idCliente": "7d0f5a4e-2c1b-4f7e-9a3d-5e6f7a8b9c0d",
  "idServidor": "TEL-7K2M4Q",
  "plazo": null,
  "ocurridoEn": 1789580328412,
  "abiertaEn": 1789580336500,
  "ayudaDesde": 1789580366600,
  "apertura": "episodio",
  "origenAyuda": "sin_respuesta",
  "respuestas": [{ "respuesta": "sin_respuesta", "enTelefono": 1789580366600 }],
  "huboChoque": null,
  "ubicacion": { "lat": -34.6037, "lon": -58.3816 }
}
```

- **Decisión:** se persiste en los tres estados, no sólo en `ayuda`. Reglas al crearse el motor: `pregunta` con `pared < plazo` vuelve a `pregunta` y sigue la misma cuenta; con `pared ≥ plazo` pasa a `sin_respuesta` y a `ayuda`. `hubo_choque` con `pared < plazo` vuelve igual; si no, se cierra y queda golpe pendiente. `ayuda` vuelve si `pared − ayudaDesde < 30 min` y no hay `estoy_bien` en `respuestas`. En cualquier otro caso se borra. También se borra al cerrarse la alerta.

```json
// acta:viaje:sin-sensores
{ "en": 1789579803000 }

// acta:viaje:configuracion   (configuracion: el JSON de GET /api/telemetria/configuracion tal como vino)
{ "guardadaEn": 1789579800000, "configuracion": { "version": "9f2c4a1b7e3d5c60", "umbrales": { "sospechaG": 4 }, "alerta": "normal", "caida_sin_golpe": "silenciosa", "motor_minimo": 1, "dias_conservacion": 90 } }

// acta:viaje:contacto
{ "nombre": "Laura Pérez", "telefono": "11 5555 0101", "guardadoEn": 1789579801000 }
```

- `acta:diagnostico`: cuenta la presencia (`getItem(…) !== null`), no el valor. Se habilita desde la consola con `localStorage.setItem('acta:diagnostico', 'si')`. En el código de `app/components/` nunca se escribe un literal para esto (trampa de `VALOR`).
- La configuración guardada siempre pasa por `validarUmbrales` al leerse.

### IndexedDB

| Base | Versión | Almacén | keyPath | Índices | Módulo |
|---|---|---|---|---|---|
| `acta-viaje` | 1 | `entradas` | `clave` | ninguno | `lib/cola-viaje.ts` (`almacenIndexedDb`) |
| `acta-cola` | 1 | `piezas` | `id` | `caso` | `lib/cola.ts` (existente, no se toca) |

Registros de `acta-viaje/entradas`: exactamente `EntradaColaViaje` (ver «Interfaces › `lib/cola-viaje.ts`»), con claves `alerta:<idCliente>`, `episodio:<idCliente>:<n>` y `conduccion:<uuid>`.

### `sessionStorage`

No se usa.

---

## Interfaz: clases, atributos y textos

### Clases nuevas de `app/globals.css`

Ninguna choca con las existentes (se verificó contra la lista de clases de la hoja). Todas cuelgan de sí mismas; ningún selector nuevo usa un tipo de elemento, salvo `body[data-pildora-viaje]`, que no entra en la regla de elementos desnudos porque no empieza con una clase.

| Clase | Fase | Elemento y rol |
|---|---|---|
| `.raiz-app` | F4 | `div` que envuelve `{children}`; `display: contents` y recibe `inert` |
| `.tarjeta-viaje` | F4 | `section` de la tarjeta del inicio; `min-height` fijo igual al alto del estado más alto medido a 375 px (el número queda anotado en `docs/MAPA-PANTALLAS.md`) |
| `.tarjeta-viaje-encabezado` | F4 | fila con el ícono y el título |
| `.tarjeta-viaje-icono` | F4 | contenedor del `<Icono nombre="auto" />` |
| `.tarjeta-viaje-titulo` | F4 | `h2` «Modo viaje» |
| `.tarjeta-viaje-limites` | F4 | las dos frases de límite |
| `.tarjeta-viaje-aviso-datos` | F4 | el aviso de datos corto con el enlace «Qué datos guarda» |
| `.tarjeta-viaje-estado` | F4 | la única línea de estado |
| `.tarjeta-viaje-pie` | F4 | fila de abajo: acción a la izquierda, interruptor a la derecha |
| `.tarjeta-viaje-accion` | F4 | botón de la acción de estado (tocar, reanudar, cómo habilitarlo) |
| `.tarjeta-viaje-golpe` | F5 | bloque del golpe pendiente dentro de la tarjeta |
| `.interruptor` | F4 | `button role="switch" aria-checked`; estilo por `[aria-checked='true']` |
| `.interruptor-perilla` | F4 | `span` de la perilla, `aria-hidden="true"` |
| `.pildora-viaje` | F4 | `button` fijo abajo al centro, `bottom: calc(12px + env(safe-area-inset-bottom))`, `z-index: 25` |
| `.pildora-viaje-texto` | F4 | texto del rótulo |
| `.hoja-viaje` | F4 | `dialog` abierto con `showModal()` |
| `.hoja-viaje-encabezado` | F4 | título y botón de cerrar |
| `.hoja-viaje-titulo` | F4 | `h2` con el id de `aria-labelledby` |
| `.hoja-viaje-cerrar` | F4 | botón «Cerrar» |
| `.hoja-viaje-seccion` | F4 | cada sección |
| `.hoja-viaje-subtitulo` | F4 | `h3` de sección |
| `.hoja-viaje-dato` | F4 | una línea de dato (velocidad, precisión, detección) |
| `.hoja-viaje-acciones` | F4 | columna de botones (probar, borrar, apagar) |
| `.hoja-viaje-golpe` | F5 | sección del golpe pendiente |
| `.hoja-viaje-diagnostico` | F6 | sección «Diagnóstico» |
| `.hoja-viaje-diagnostico-tabla` | F6 | tabla de los últimos 20 episodios |
| `.alerta-viaje` | F4 | `div role="alertdialog" aria-modal="true"`, `position: fixed; inset: 0; z-index: 40; overflow-y: auto; overscroll-behavior: contain`; lleva `data-armada` |
| `.alerta-viaje-panel` | F4 | caja interior; con `@media (max-height: 480px)`, dos columnas y `env(safe-area-inset-left/right)` |
| `.alerta-viaje-destello` | F4 | capa del refuerzo visual, sólo en `pregunta`; `animation: destello-viaje 1.2s steps(2, jump-none) infinite` (menos de 3 destellos por segundo) |
| `.alerta-viaje-cabeza` | F4 | título, texto y cuenta (columna izquierda en apaisado) |
| `.alerta-viaje-titulo` | F4 | `h2` «¿Estás bien?» con `tabIndex={-1}` |
| `.alerta-viaje-texto` | F4 | frases de la alerta |
| `.alerta-viaje-cuenta` | F4 | el número de la cuenta (`.contador` ya existe y lo usa el recorrido) |
| `.alerta-viaje-botones` | F4 | columna de botones (derecha en apaisado) |
| `.alerta-viaje-boton` | F4 | cada botón, `min-height: 60px`; `.alerta-viaje:not([data-armada]) .alerta-viaje-boton { pointer-events: none }` |
| `.emergencias-chicas` | F4 | variante de `BotonesEmergencia` debajo de «¿Hubo un choque?» |
| `.ayuda-impacto` | F5 | raíz de `AyudaImpacto` |
| `.ayuda-impacto-titulo` | F5 | «Pediste ayuda» / «No respondiste» |
| `.ayuda-impacto-contacto` | F5 | botón «Llamar a …» y la nota al lado |
| `.ayuda-impacto-nota` | F5 | «La aplicación no llama ni manda mensajes por su cuenta» |
| `.ayuda-impacto-acciones` | F5 | compartir, registrar, falsa alarma |
| `.ayuda-impacto-sin-ubicacion` | F5 | «No hay ubicación: el GPS estaba apagado» |

Reglas de hoja fijas:

- `body[data-pildora-viaje] .envoltura, body[data-pildora-viaje] .inicio { padding-bottom: calc(96px + env(safe-area-inset-bottom)); }` (F4). `.chip-cola` no se toca.
- `@keyframes destello-viaje` usa sólo tokens existentes (`--emergencia`, `--sobre-color`); ningún color nuevo. Si hace falta uno, se declara como token en `:root` y en el bloque oscuro.
- En el bloque final `@media (prefers-reduced-motion: reduce)` se agrega `.alerta-viaje-destello { animation: none; }` y el color queda fijo.
- Sin `:hover` nuevos fuera de `@media (hover: hover)`.

Verificado al escribir este índice: ningún selector de `app/globals.css` depende de `body > main`; los hijos directos que importan son `.inicio > .acceso` y `.inicio > .aviso`, y `.raiz-app` envuelve `main`, no sus hijos.

### Atributos `data-*` nuevos (van a la tabla de CONTRATO-UI §3 en F4)

| Atributo | Dónde | Valores | Qué significa |
|---|---|---|---|
| `data-armada` | `.alerta-viaje` | presente (`data-armada=""`) o ausente | Pasaron 600 ms desde que se abrió la alerta: recién ahí los botones reciben toques |
| `data-pildora-viaje` | `body` | presente o ausente (lo pone el proveedor con `toggleAttribute`) | La píldora del modo viaje está visible: la página reserva lugar abajo |

`data-estado` sigue con `pidiendo` · `ok` · `error` · `espera` y `data-nivel` con `info` · `ok` · `alerta` · `atencion` · `cobertura` · `neutra`: la tarjeta y la píldora reusan `.punto[data-estado]` y `.aviso[data-nivel]` sin valores nuevos.

### Ícono nuevo

`auto` en `app/components/Iconos.tsx` (dibujo en «Interfaces»). CONTRATO-UI y MAPA-PANTALLAS pasan de once a doce íconos: `archivo`, `auto`, `camara`, `compartir`, `descargar`, `escudo`, `microfono`, `personas`, `telefono`, `tilde`, `ubicacion`, `verificar`.

### Textos obligatorios por archivo (los verifica el contrato)

| Archivo | Texto literal que tiene que aparecer en una sola línea del código | Fase |
|---|---|---|
| `app/page.tsx` | `Funciona sólo con la aplicación abierta` | F4 |
| `app/page.tsx` | `No llama ni le avisa a nadie por su cuenta` | F4 |
| `app/components/ModoViaje.tsx` | `La aplicación no llama sola a emergencias` | F4 |
| `app/perfil/page.tsx` | `no llama ni manda mensajes por su cuenta` | F4 (ya está, dentro de `<strong>`) |
| `app/components/AyudaImpacto.tsx` | `no llama ni manda mensajes por su cuenta` | F5 |

### Textos exactos

Clave → texto. Las claves son sólo para citar entre planes: en el código no hay un diccionario de textos, cada archivo escribe el texto literal (el contrato busca algunos por archivo). `{hora}` es `new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })` (queda «14:32»); `{min}`, `{activa}`, `{total}`, `{n}`, `{kb}`, `{kmh}` y `{m}` son enteros (`{activa}` y `{total}` en minutos); `{nombre}` y `{version}` son texto; `{dias}` es `configuracion.dias_conservacion`. Origen: `§` es texto del diseño; `índice` es texto decidido acá.

**Tarjeta del inicio (`app/page.tsx`, F4 salvo indicación)**

| Clave | Texto | Origen |
|---|---|---|
| `tarjeta.titulo` | Modo viaje | §3.1 |
| `tarjeta.limite_abierta` | Funciona sólo con la aplicación abierta y la pantalla encendida. | §3.1 |
| `tarjeta.no_llama` | No llama ni le avisa a nadie por su cuenta. | §3.1 |
| `tarjeta.aviso_datos` | Si detecta un posible choque, manda a tu aseguradora la hora, los sensores y la ubicación. Las frenadas bruscas se guardan sin ubicación y sin tu cuenta. Es optativo. | §3.1 |
| `tarjeta.enlace_datos` | Qué datos guarda | §3.1 |
| `tarjeta.activo` | Activo · detección {min} min | §3.1 |
| `tarjeta.sin_retener` | Tocá la pantalla para que no se apague | §3.1 |
| `tarjeta.avisos_toque` | Tocá la pantalla para activar el sonido y la vibración del aviso | §3.1 |
| `tarjeta.reanudar` | Tocá para reanudar (el iPhone te vuelve a pedir permiso) | §3.1 |
| `tarjeta.sin_permiso` | Sin permiso de movimiento | §3.1 |
| `tarjeta.como_habilitar` | Cómo habilitarlo | §3.1 |
| `tarjeta.sin_lecturas` | Este equipo no entrega lecturas de movimiento: el modo viaje funciona en el teléfono | §3.1 (también para `no_soportado` por `sin_sensores`, decisión del índice) |
| `tarjeta.inseguro` | Abrí la aplicación desde su dirección https | §3.1 |
| `tarjeta.otra_ventana` | El modo viaje está abierto en otra ventana | §3.1 |
| `tarjeta.apagado_inactividad` | Se apagó solo a las {hora} porque el auto estuvo detenido | §3.1 |
| `tarjeta.apagado_accidente` | Se apagó al registrar el accidente | §3.1 |
| `tarjeta.no_disponible` | El modo viaje no está disponible por ahora | §2.9 |
| `tarjeta.desactualizado` | Cerrá y volvé a abrir la aplicación para actualizarla | §2.9 |
| `tarjeta.inactividad` | ¿Terminaste el viaje? Tocá para seguir | §4.4 |
| `tarjeta.siguio` | Seguimos: el auto volvió a moverse | §4.4 |
| `tarjeta.golpe` (F5) | Golpe detectado {hora} · Registrar este choque | §3.1 |
| `tarjeta.sin_vibracion` | En este teléfono la alerta no vibra y, en silencio, puede no sonar | §3.1 |
| `tarjeta.sin_vibracion_con_sesion` | En este teléfono la alerta no vibra | §3.1 (con `navigator.audioSession`) |
| `tarjeta.bateria` | Con la pantalla encendida y el GPS gasta batería: conviene tenerlo enchufado. | §3.1 |

Las dos advertencias previas (`sin_vibracion*` y `bateria`) se muestran sólo con fase `apagado`.

**Píldora y región de estado (`ModoViaje.tsx`, F4)**

| Clave | Texto | Origen |
|---|---|---|
| `pildora.activo` | Modo viaje activo | §3.2 |
| `pildora.en_pausa` | Modo viaje en pausa | §3.2 |
| `pildora.reanudar` | Modo viaje: tocá para reanudar | §3.2 |
| `pildora.sonido` | Tocá para activar el sonido del aviso | §3.2 |
| `pildora.inactividad` | ¿Terminaste el viaje? Tocá para seguir | §3.2 |
| `pildora.golpe` (F5) | Golpe detectado {hora} | §3.2 |
| `anuncio.pausa` | Modo viaje en pausa | índice (fase pasa a `en_pausa`) |
| `anuncio.reanudado` | Modo viaje activo de nuevo | índice (de `en_pausa` o `reanudando` a `activo`) |
| `anuncio.sin_gps` | Sin GPS: el modo viaje sigue con el acelerómetro | índice (`gps` pasa de `ok` a `buscando`, `sin_permiso` o `requiere_toque`) |
| `anuncio.sin_sonido` | El aviso no va a sonar hasta que toques la pantalla | índice (`avisos.sonido` pasa a `requiere_toque`) |
| `anuncio.siguio` | Seguimos: el auto volvió a moverse | §4.4 (cambia `siguioPorMovimientoEn`) |

**Hoja (`ModoViaje.tsx`, F4 salvo indicación)**

| Clave | Texto | Origen |
|---|---|---|
| `hoja.titulo` | Modo viaje | índice |
| `hoja.cerrar` | Cerrar | índice |
| `hoja.deteccion` | Detección activa {activa} de {total} min | §3.2 |
| `hoja.hueco` | Sin detección {min} min: pantalla bloqueada u otra aplicación | §3.2 |
| `hoja.velocidad` | Velocidad {kmh} km/h | índice |
| `hoja.velocidad_sin_dato` | Velocidad: sin GPS | índice |
| `hoja.precision` | Precisión del GPS {m} m | índice |
| `hoja.gps_buscando` | Buscando GPS | índice |
| `hoja.gps_sin_permiso` | Sin permiso de ubicación: la detección sigue con el acelerómetro | índice |
| `hoja.gps_requiere_toque` | El GPS está en pausa hasta que lo actives | índice |
| `hoja.usar_gps` | Usar el GPS | índice (botón que llama `motor.activarGps()`) |
| `hoja.sin_giroscopo` | Sensor sin giróscopo: detección menos precisa | §2.2 |
| `hoja.pantalla_liberada` | La pantalla se puede apagar sola (ahorro de batería). Enchufalo o desactivá el ahorro. | §4.3 |
| `hoja.ios_viejo` | En esta versión de iOS la pantalla se apaga sola: actualizá o poné Bloqueo automático en Nunca mientras manejás. | §4.3 |
| `hoja.permisos` | Permisos | índice |
| `permisos.movimiento_iphone_instalada` | Cerrá Acta Digital deslizándola hacia arriba en el selector de apps, volvé a abrirla y, al encender, tocá Permitir. | §3.2 |
| `permisos.movimiento_iphone_safari` | Cerrá Safari por completo deslizándolo hacia arriba en el selector de apps, volvé a abrirlo y, al encender, tocá Permitir. | §3.2 (adaptado) |
| `permisos.movimiento_android` | Tocá el candado o ⋮ › Configuración del sitio › Sensores de movimiento › Permitir. | §3.2 |
| `permisos.ubicacion_iphone` | Abrí Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari, elegí Mientras se usa la app y volvé a encender el modo viaje. | índice |
| `permisos.ubicacion_android` | Tocá el candado o ⋮ › Configuración del sitio › Ubicación › Permitir. | índice |
| `permisos.ubicacion_otro` | Habilitá la ubicación para este sitio en la configuración del navegador y volvé a encender el modo viaje. | índice |
| `hoja.limites` | Límites | índice |
| `limites.abierta` | Sólo con la aplicación abierta, a la vista y la pantalla encendida. | §0.5 |
| `limites.leves` | No detecta golpes leves ni choques con el auto detenido. | §0.5 |
| `limites.no_llama` | No llama ni le avisa a nadie por su cuenta. | §0.5 |
| `limites.iphone` | En iPhone no vibra; con el iPhone en silencio, que suene depende de la versión de iOS. | §0.5 (adaptado) |
| `limites.ios_viejo` | Con la aplicación instalada en iOS anterior a 18.4, la pantalla se puede apagar sola. | §0.5 |
| `hoja.probar` | Probar la alerta | §3.2 |
| `hoja.datos` | Qué datos guarda | §3.2 |
| `datos.finalidad` | Para qué: avisarte y documentar un siniestro. Las frenadas y los golpes en marcha sirven sólo para ajustar el detector. | §5.6 |
| `datos.destinatario` | Quién los recibe: tu aseguradora, que es la responsable de esos datos. | §5.6 (la identidad y el domicilio del responsable quedan para el abogado) |
| `datos.optativo` | Es optativo: se apaga con un toque y la aplicación funciona igual. | §5.6 |
| `datos.consecuencias` | Las frenadas no se asocian a tu cuenta ni a tu póliza. | §5.6 |
| `datos.conservacion` | Se guardan {dias} días, salvo el golpe con el que registres un accidente, que queda con la actuación. | §5.6 |
| `datos.derechos` | Podés pedir acceso, rectificación o supresión de tus datos (Ley 25.326). Desde este teléfono, con «Borrar mis registros del modo viaje»; si borraste los datos del navegador, pedíselo a tu aseguradora. | §5.6 |
| `hoja.borrar` | Borrar mis registros del modo viaje | §3.2 |
| `hoja.borrado_ok` | Se borraron {n} registros de este teléfono. | índice |
| `hoja.borrado_sin_red` | Sin señal: probá de nuevo cuando vuelva la señal. | índice |
| `hoja.apagar` | Apagar el modo viaje | §3.2 |
| `hoja.diagnostico` (F6) | Diagnóstico | §3.2 |

**Alerta (`ModoViaje.tsx`, F4)**

| Clave | Texto | Origen |
|---|---|---|
| `alerta.titulo` | ¿Estás bien? | §3.3 |
| `alerta.detectamos` | Detectamos un posible choque a las {hora}. | §3.3 |
| `alerta.detectamos_seguimiento` | Detectamos un golpe hace {n} segundos. | §3.3 (`apertura === 'seguimiento'`) |
| `alerta.no_llama` | La aplicación no llama sola a emergencias. Si no respondés, al llegar a cero te mostramos los teléfonos para llamar. | §3.3 (es también la frase fija de `aria-describedby`) |
| `alerta.quedan` | Quedan {n} segundos | índice (región `aria-live="assertive"`, sólo con `restanteS` en 20, 10 o 5) |
| `alerta.estoy_bien` | Estoy bien | §3.3 |
| `alerta.necesito_ayuda` | Necesito ayuda | §3.3 |
| `hubo_choque.titulo` | ¿Hubo un choque? | §3.3 |
| `hubo_choque.si` | Sí, registrar el accidente | §3.3 |
| `hubo_choque.no` | No, fue una falsa alarma | §3.3 |

**Ayuda (`AyudaImpacto.tsx`, F5; F4 usa en su ayuda provisoria los títulos, `ayuda.falsa_alarma` y `ayuda.sin_senal`)**

| Clave | Texto | Origen |
|---|---|---|
| `ayuda.titulo_pediste` | Pediste ayuda | §3.4 |
| `ayuda.titulo_no_respondiste` | No respondiste | §3.4 |
| `ayuda.llamar_contacto` | Llamar a {nombre} | §3.4 |
| `ayuda.no_llama` | La aplicación no llama ni manda mensajes por su cuenta | §3.4 |
| `ayuda.compartir` | Compartir mi ubicación | §3.4 |
| `ayuda.compartir_texto` | Esta es mi ubicación después de un posible choque. | índice |
| `ayuda.copiado` | Copiamos el enlace de tu ubicación: pegalo en un mensaje. | índice |
| `ayuda.sin_ubicacion` | No hay ubicación: el GPS estaba apagado | §3.4 |
| `ayuda.registrar` | Registrar el accidente | §3.4 |
| `ayuda.continuar` | Continuar la actuación abierta | §3.4 |
| `ayuda.abriendo` | Abriendo... | índice (mismo patrón que el inicio) |
| `ayuda.sin_senal` | Sin señal: la lectura queda guardada en el teléfono. Llamá desde los botones de arriba y registralo cuando vuelva la señal. | §3.4 |
| `ayuda.error_registro` | No se pudo abrir la actuación. Esperá unos segundos y volvé a tocar el botón. | índice (mismo texto que `/aviso` hoy) |
| `ayuda.falsa_alarma` | Estoy bien, fue una falsa alarma | §3.4 |

**Fuera del modo viaje (F4)**

| Clave | Archivo | Texto nuevo | Reemplaza |
|---|---|---|---|
| `inicio.pie_permisos` | `app/page.tsx:159-160` | Si registrás un accidente, vamos a pedirte permiso de ubicación, cámara y micrófono para documentar dónde, cuándo y cómo ocurrió ante tu aseguradora (Ley 25.326). Lo que guarda el modo viaje está explicado en su tarjeta. | «Vamos a pedirte permiso de ubicación, cámara y micrófono para registrar dónde, cuándo y cómo ocurrió. Los datos se usan sólo para documentar este siniestro ante tu aseguradora (Ley 25.326).» |
| `perfil.contacto_bajada` | `app/perfil/page.tsx:144-145` | A quién vas a poder llamar con un toque desde la pantalla de ayuda si el teléfono detecta un golpe. Avisale a esa persona que la cargaste: son sus datos, no los tuyos. | «A quién avisarle si el teléfono detecta un impacto y no respondés. Avisale a esa persona que la cargaste: son sus datos, no los tuyos.» |

**Servidor**

| Clave | Estado | Texto | Fase |
|---|---|---|---|
| `servidor.ajena` | 404 | No encontramos esa detección en este teléfono. Si ya no la tenés, abrí la actuación con "Tuve un accidente". | F1 |
| `servidor.limite_lecturas` | 429 | Se mandaron demasiadas lecturas desde este teléfono. Esperá {n} segundos. | F1 |
| `servidor.limite_altas` | 429 | Se abrieron demasiadas actuaciones desde este teléfono. Esperá {n} segundos. | F1 |
| `servidor.cuerpo_grande` | 413 | El pedido supera los {kb} KB que acepta esta ruta: mandá menos datos por envío. | F1 |
| `servidor.cuerpo_no_json` | 400 | El cuerpo del pedido no es JSON válido: mandalo como texto JSON. | F1 |
| `servidor.cuerpo_no_utf8` | 400 | El cuerpo del pedido no es texto UTF-8 válido: mandalo como texto JSON. | F1 |
| `servidor.respuesta_invalida` | 400 | Respuesta no válida. Las posibles son: estoy_bien, necesito_ayuda, sin_respuesta. | F1 |
| `servidor.aviso_desconocido` | 400 | La versión del aviso de datos "{version}" no la conoce el servidor: cerrá y volvé a abrir la aplicación para actualizarla. | F1 |
| `servidor.ventana_caida_obsoleta` | log | IMPACTO_VENTANA_CAIDA_MS ya no se usa: la reemplaza IMPACTO_VENTANA_POST_MS (8000 ms por omisión); borrala de las variables del servicio | F2 |
| `push.endpoint_invalido` | 400 | La suscripción no apunta a un servicio de notificaciones conocido (Google, Mozilla, Apple o Microsoft): volvé a activar las notificaciones desde el teléfono. | F0 |
| `push.claves_invalidas` | 400 | Las claves de la suscripción no tienen el formato de Web Push: volvé a activar las notificaciones desde el teléfono. | F0 |
| `push.suscripcion_ajena` | 403 | Esta suscripción es de otra cuenta: entrá con esa cuenta para mandarle un aviso de prueba. | F0 |

---

## Pruebas: convenciones

### Dónde vive cada prueba

**Decisión:** las pruebas del modo viaje van a un archivo propio, `scripts/prueba-viaje.mjs`, encadenado desde `package.json`: `"prueba": "tsx scripts/prueba-logica.mjs && tsx scripts/prueba-viaje.mjs"`. Motivos: `prueba-logica.mjs` ya tiene 823 líneas y diez secciones; el banco con 50 ensayos por escena y el motor con reloj falso suman más de mil; separado se puede correr sólo lo del modo viaje, o una sola sección, mientras se itera; y `npm run prueba` sigue corriendo todo.

| Qué | Archivo | Sección | Fase |
|---|---|---|---|
| `endpointPushValido` y `enviarPush` sin eco | `scripts/prueba-logica.mjs` | bloque bajo el comentario `/* ---------- 10. Impacto y notificaciones ---------- */` | F0 |
| `aJsonPuro`, hash fijo, `hashEvento` con `Date` y `undefined` | `scripts/prueba-logica.mjs` | bloque bajo el comentario `/* ---------- 1. Serialización canónica y cadena ---------- */` | F1 |
| Las dos llamadas viejas `planEscalamiento(v, false)` y `planEscalamiento(v, true)`, con la firma nueva (`'sin_respuesta'` y `'estoy_bien'`) | `scripts/prueba-logica.mjs` | bloque bajo `/* ---------- 10. Impacto y notificaciones ---------- */` | F1 (F2 borra el bloque) |
| `leerCuerpoLimitado`, `limitar`, `ipDelCliente`, `accesoTelemetria`, `horaTelefonoAceptable`, `planEscalamiento`, `nivelMayor`, transporte y validaciones (incluido un cuerpo del detector anterior con t desde 180000, que `decodificarCuerpoLegado` acepta y deja con la primera muestra en t = 0: la ruta da 201), `configuracionModoViaje().version` determinista | `scripts/prueba-viaje.mjs` | `[V1] Servidor: cuerpo, límites, acceso, plan y transporte` | F1 |
| `validarUmbrales` (NaN, fuera de rango, relaciones), `evaluarEpisodio` fila por fila, `analizarImpacto`, paridad teléfono–servidor incluida la caída sin golpe, `reconstruirVeredicto` | `scripts/prueba-viaje.mjs` | `[V2] Umbrales y veredicto` | F2 |
| `estimarVelocidades` (hora GNSS corrida 8 s, reloj +300 s, fix en caché de 2 min), `estaDetenido`, `velocidadMedia`, fuente derivada, `detectarManiobras` unitario | `scripts/prueba-viaje.mjs` | `[V3] Velocidad, fuente de aceleración y maniobras` | F2 |
| Escenas obligatorias de §6.1 y tasas | `scripts/prueba-viaje.mjs` | `[V4] Banco de simulación` | F2 |
| Tope, descarte, orden de drenado, retroceso, 429 y 4xx (incluido: 400 `tipo: 'transporte'` con `campo: 'serie[12].t'` y 413 sobre un pedido con episodio → el episodio se borra, la alerta sube con `episodio: null` en el mismo drenado y no queda `rechazada`; 400 con `campo: 'campos.plataforma'` → alerta `rechazada`) | `scripts/prueba-viaje.mjs` | `[V5] Cola de viaje` | F3 |
| Gesto, destrabador, reanudación, idempotencia, singleton, sin lecturas, rutas, ventanas, `storage`, `AVISOS_DATOS_CONOCIDOS` incluye `AVISO_DATOS_VERSION` | `scripts/prueba-viaje.mjs` | `[V6] Motor: encendido, gesto, reanudación, rutas y ventanas` | F3 |
| Episodios y alertas, cuenta por pared, seguimiento, respuestas, golpe pendiente, sin red, inactividad, suspensión, configuración, `registrarAccidente`, limpieza al terminar | `scripts/prueba-viaje.mjs` | `[V7] Motor: episodios, alerta, respuestas, inactividad y configuración` | F3 |
| `detalleAperturaImpacto` (sólo primitivas, `Date` a ISO, BIGINT en texto a número) | `scripts/prueba-viaje.mjs` | `[V8] Alta vinculada` | F5 |
| Importaciones permitidas | `scripts/prueba-contrato.mjs` | `[5] Lo que el expediente no perdona` | F2, F3 |
| Textos obligatorios, orden del layout, literales de `data-estado` y `data-nivel`, ningún `'use server'` | `scripts/prueba-contrato.mjs` | `[4] Marcado del que depende la funcionalidad` | F4 |
| Datos personales en `registrarEvento` dentro de `lib/**/*.ts` (salvo `lib/hash.ts`) y `PROHIBIDAS` + `lat`, `lon`, `ubicacion`, `kmh` | `scripts/prueba-contrato.mjs` | `[5]` | F5 |
| `app/components/AyudaImpacto.tsx` en la tabla de textos obligatorios | `scripts/prueba-contrato.mjs` | `[4]` | F5 |
| Servidor real | `scripts/prueba-e2e.mjs` | `[10a]`–`[10g]` (F1), `[10h]`–`[10m]` (F5) | F1, F5 |

### Arnés de `scripts/prueba-viaje.mjs` (lo crea F1)

```js
/**
 * Pruebas del modo viaje: servidor puro, detección, banco de simulación, cola y motor.
 *
 *   npm run prueba                                   (corre también prueba-logica.mjs)
 *   npx tsx scripts/prueba-viaje.mjs                 (sólo esto)
 *   SECCION=V4 npx tsx scripts/prueba-viaje.mjs      (Git Bash: una sección)
 *   $env:SECCION='V4'; npx tsx scripts/prueba-viaje.mjs   (PowerShell)
 */

let fallos = 0
let pruebas = 0

function verificar(nombre, condicion, extra = '') {
  pruebas++
  if (condicion) {
    console.log(`  ok   ${nombre}`)
  } else {
    fallos++
    console.log(`  FALLA ${nombre} ${extra}`)
  }
}

const SECCION = process.env.SECCION ?? null

/** Una excepción adentro no corta el archivo: queda como una falla con su mensaje. */
async function seccion(id, titulo, fn) {
  if (SECCION !== null && SECCION !== id) return
  console.log(`\n[${id}] ${titulo}`)
  try {
    await fn()
  } catch (err) {
    verificar(`[${id}] terminó sin excepciones`, false, err?.stack ?? String(err))
  }
}

await seccion('V1', 'Servidor: cuerpo, límites, acceso, plan y transporte', async () => {
  // Importaciones DINÁMICAS dentro de cada sección: un export que todavía no existe da undefined
  // y la prueba falla con su nombre, en vez de abortar el archivo entero antes de empezar.
  const { leerCuerpoLimitado, ErrorCuerpo } = await import('../lib/api.ts')
  // …
})

/* ---------- Resultado ---------- */
console.log(`\n${pruebas - fallos}/${pruebas} verificaciones pasaron`)
if (fallos > 0) {
  console.error(`${fallos} FALLARON`)
  process.exit(1)
}
console.log('Todo en orden.')
```

Cada fase agrega su `await seccion('Vn', …)` antes del bloque de resultado, en orden V1 → V8.

### Cómo se escriben «Correr» y «Esperado» en los planes

- **Correr una sección:** `SECCION=V2 npx tsx scripts/prueba-viaje.mjs` desde la raíz (en PowerShell, `$env:SECCION='V2'; npx tsx scripts/prueba-viaje.mjs`).
- **Esperado FALLA (prueba-viaje):** la salida tiene la línea `  FALLA <nombre exacto de la verificación>` (o `  FALLA [V2] terminó sin excepciones TypeError: evaluarEpisodio is not a function`), termina con `N FALLARON` y el proceso sale con código 1.
- **Esperado PASA (prueba-viaje):** todas las líneas de la sección empiezan con `  ok   `, la última línea es `Todo en orden.` y el código de salida es 0.
- **Esperado FALLA (prueba-logica, imports estáticos):** un export que falta aborta antes de imprimir nada con `SyntaxError: The requested module '../lib/hash.ts' does not provide an export named 'aJsonPuro'`; una verificación nueva que no se cumple imprime `  FALLA <nombre> ` y al final `N FALLARON`.
- **Esperado FALLA (contrato):** `  FALLA <nombre de la comprobación>` y debajo, con nueve espacios, el detalle; al final `N FALLARON. El contrato está en docs/CONTRATO-UI.md.`
- **Esperado PASA (contrato):** `El contrato se cumple.`; **tipos:** `npm run tipos` sin salida y código 0.
- **e2e:** `  ok   <nombre>`, `  FALLA <nombre> <extra>` y, para lo que no se puede probar en este entorno, `  salta <nombre> (<motivo>)`, que no cuenta ni como prueba ni como falla.

### Banco de simulación: `scripts/banco-impacto.mjs` (F2)

Portado de `docs/superpowers/specs/2026-09-16-modo-viaje-banco/` (`base.mts`, `escenas.mts`) a JavaScript sin dependencias. Es un módulo: exporta y no corre nada al importarse. Los tres `Math.random()` de `escenas.mts` pasan a `aleatorio()`. Corre el pipeline real: `crearDetector` de `lib/conduccion.ts` (se importa como `'../lib/conduccion.ts'`, que `tsx` resuelve).

```js
/** PRNG mulberry32 con semilla (el de base.mts). Cada escena de [V4] siembra antes de correr: sembrar(99). */
export function sembrar(semilla) {}
/** [0, 1). */
export function aleatorio() {}

/** Rango del sensor en g, pasa-bajos del HAL en Hz y frecuencia de muestreo. */
export const SENSORES = { g8: { rango: 8, fcHal: 25, hz: 60 }, g4: { rango: 4, fcHal: 25, hz: 60 } }

/** GPS de 1 Hz con fase aleatoria. lag y tau en ms, ruido en ± km/h, huecos y velocidadCeroEn como [desdeMs, hastaMs][]. */
export const GPS_BASE = { periodo: 1000, lag: 2000, tau: 500, ruido: 3, ios: false, rho: 0.9, sigmaPos: 3, huecos: [], velocidadCeroEn: [], desfaseRelojMs: 0, horaGnssCorridaMs: 0, sinGps: false }

/** Todas devuelven una Escena (clase del anexo). El evento ocurre en T0 = 20000 ms. `opciones.duracionMs` alarga la escena (34000 por omisión). */
export const escenas = {
  // falsos positivos
  sacudida(frecuenciaHz, amplitudM, kmh, opciones) {},
  dosPozos(separacionMs, kmh, factor, opciones) {},
  lomo(sueltoElSoporte, kmh, opciones) {},
  caidaSoporte(kmh, contraAlgoDuro, opciones) {},
  tironAcompanante(kmh, opciones) {},
  portazo(enLaPuerta, opciones) {},
  tirarAlAsiento(picoG, opciones) {},       // 5 o 12 g: al asiento y a la consola
  golpeConsola(kmh, opciones) {},
  crucero(kmh, opciones) {},               // con GPS_BASE.velocidadCeroEn o huecos para la velocidad 0 espuria y los fixes que no llegan
  urbano(minutos, opciones) {},
  // choques
  choqueFrontal(picoG, kmh, opciones) {},  // opciones.msDesdeSemaforo (4000, 6000, 8000) y opciones.montaje { fn, zeta }
  choqueYDespedido(picoG, kmh, msDespues, opciones) {},
  caidaLuegoChoque(msSeparacion, picoG, kmh, opciones) {},
  trompo(dps, kmh, opciones) {},
  vuelco(opciones) {},
  choqueQueRueda(picoG, kmh, kmhRodando, msRodando, opciones) {},
  rocePatina(kmh, opciones) {},
  choqueYFrenaSuave(picoG, kmhAntes, kmhDespues, gRodado, opciones) {}, // 60→35 que rueda a 0.05 g: alerta por seguimiento
  choqueYSigue(picoG, kmhAntes, kmhDespues, opciones) {},               // 60→35 que sigue a 35: golpe_en_marcha; opciones.detenerseEnMs para el motor
  alcanceTrasero(conElAutoDetenido, opciones) {},
  // caída sin golpe y maniobras
  detencionBlanda(g, kmh, opciones) {},
  frenada(g, kmhAntes, kmhDespues, opciones) {},
  aceleracion(g, kmhAntes, kmhDespues, opciones) {},
  frenadaYDetencionBlanda(gFrenada, gDetencion, kmh, opciones) {},
  rotondaYParada(gLateral, kmh, opciones) {},
  // fuente derivada
  pulso(picoG, ms, kmh, opciones) {},      // 10 g y 80 ms con correr({ derivada: true })
}

/**
 * Muestras como las entrega DeviceMotionEvent (MuestraMovimiento de lib/conduccion.ts), con t en ms desde el
 * comienzo de la escena más opciones.inicioMono (1000 por omisión). opciones.derivada: rotationRate null y
 * acceleration calculada con la fusión de Chromium (pasa-altos con τ = 1/60 s) desde accelerationIncludingGravity.
 */
export function sensar(escena, sensor, opciones) {}

/**
 * Fixes (FixGps de lib/conduccion.ts). llegadaMono con la misma base que sensar; llegadaPared = opciones.inicioPared
 * (Date.UTC(2026, 8, 16, 17, 30) por omisión) + t; adquiridoPared con el retraso, desfaseRelojMs y horaGnssCorridaMs.
 * En modo ios, velocidadMs null por debajo de 3 km/h y posiciones con ruido AR(1).
 */
export function generarGps(escena, gps) {}

/**
 * n ensayos: fabricar(), sensar, generarGps, y todo al detector en orden de tiempo, con avanzar(mono, pared) cada
 * 1000 ms. opciones: { sensor = SENSORES.g8, gps = {}, derivada = false, umbrales = UMBRALES, caidaSinGolpe = 'silenciosa',
 * suspensiones = [] ({ enMs, ms }: mono no avanza y pared sí, sin muestras ni fixes), fixEnCacheMs = null (al salir de
 * la primera suspensión llega un fix con adquiridoPared de hace fixEnCacheMs) }.
 * Un ensayo tiene alerta si el detector emitió un 'episodio' con nivel distinto de 'nada' o un 'seguimiento'.
 */
export function correr(fabricar, n, opciones) {}
// → { n, conAlerta, tasaAlerta, golpesEnMarcha, caidasSilenciosas, frenadas, tasaFrenada, aceleraciones, tasaAceleracion, motivos }
//   motivos: { '<nivel>:<motivo>': cantidad } del primer episodio de cada ensayo.
```

`N = Number(process.env.BANCO_N ?? 50)` ensayos por escena en [V4], salvo `urbano(20)`, que corre siempre con `correr(fabricar, 3, …)` (tres ensayos = una hora simulada), independiente de `BANCO_N`. Presupuesto: [V4] completa tarda menos de 60 s en esta máquina. Si no entra, F2 cambia la omisión a `N = Number(process.env.BANCO_N ?? (process.env.BANCO_COMPLETO === '1' ? 50 : 10))`: [V4] con N = 50 corre sólo con `BANCO_COMPLETO=1` y `npm run prueba` usa N = 10 con el aviso de abajo (y lo anota en su commit). Con `BANCO_N` menor que 50, [V4] imprime `  aviso BANCO_N=<n> es menor que 50: las tasas no valen como prueba` y afirma igual. Tasas que se afirman (§6.1): choques con alerta ≥ 0.95 cada escena; falsos positivos con alerta ≤ 0.02 cada escena; `urbano(20)` en sus tres ensayos (una hora) con cero alertas; frenadas de 0.5 a 0.8 g detectadas ≥ 0.95; frenadas de 0.30 a 0.35 g registradas ≤ 0.05; `choqueYSigue` con `golpesEnMarcha` ≥ 0.95 y alerta ≤ 0.05; choque 50→0 con `frenadas === 0` (absorción); relojes: el nivel con suspensión de 25, 60 y 120 s es el mismo que sin suspensión; `alcanceTrasero(true)` sin alerta (límite declarado).

### Fuentes falsas: `scripts/fuentes-falsas.mjs` (F3)

Imitan las APIs del navegador que usa `FuentesMotor`, con contadores para afirmar. Módulo sin dependencias.

```js
/** Candados compartidos entre dos juegos de fuentes, para simular dos ventanas. */
export function crearRegistroCandados() {}   // → { ocupados: Set<string> }

/**
 * Servidor en memoria con las rutas que usa el motor y la misma fusión de respuestas que el real
 * (humana siempre; sin_respuesta sólo sin respuesta previa; hubo_choque si viene).
 */
export function crearServidorFalso(opciones) {}
// opciones: { configuracion?: objeto de GET /api/telemetria/configuracion, perfil?: { contacto } | null (null → 401) }
// → {
//   fetch(ruta, init): Promise<Response>   (enLinea false → rechaza con TypeError('Failed to fetch'))
//   enLinea: boolean
//   alertas: Map<id_cliente, { id, campos, episodios: Map<n, episodio>, respuesta, respuestas, hubo_choque }>
//   lotesConduccion: LoteConduccion[]
//   casos: Array<{ id, secreto, cuerpo }>
//   configuracion: objeto (se puede cambiar entre pasos)
//   perfil: objeto | null
//   forzarEstado(ruta, status): void       (la próxima respuesta de esa ruta devuelve ese estado)
//   pedidos: Array<{ ruta, metodo, cuerpo }>
// }

export function crearFuentesFalsas(opciones) {}
// opciones (todas opcionales):
//   seguro = true, standalone = false,
//   userAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36',
//   movimiento = 'sin_funcion'      'sin_funcion' (Android: no hay requestPermission) · 'granted' · 'denied' · 'NotAllowedError' · 'ausente' (sin DeviceMotionEvent)
//   demoraPermisoMs = 0             8000 para «el diálogo tardó 8 s»
//   geolocalizacion = 'granted'     'granted' · 'prompt' · 'denied' · 'ausente'
//   wakeLock = true, vibracion = true, audio = true, sesionDeAudio = false,
//   candados = crearRegistroCandados()   (null: sin navigator.locks)
//   almacenamiento = new Map()      (pasar el Map de un juego anterior simula una recarga con lo guardado)
//   servidor = crearServidorFalso(),
//   inicioMono = 1000, inicioPared = Date.UTC(2026, 8, 16, 17, 30)
//
// → {
//   fuentes,                                              FuentesMotor para crearMotorViaje
//   reloj: { mono(), pared(), avanzar(ms): Promise<void>, saltarPared(ms): void, pendientes(): number },
//   gesto(tipo = 'click'): void,                          despacha el evento en la ventana y marca la activación transitoria
//   ventana: { despachar(tipo, datos = {}): void, escuchas(tipo?): number },
//   documento: { ponerVisible(visible): void },           cambia visibilityState y despacha visibilitychange
//   movimiento: { pedidos: number, emitir(muestra): void },
//   geo: { vigilancias: number, pedidos: number, emitirFix({ lat, lon, precisionM, velocidadMs, adquiridoPared }): void, emitirError(codigo): void },
//   wakeLock: { pedidos: number, activos: number, autorizadoAntes: boolean, liberarPorSistema(): void },
//   audio: { destrabes: number, despertares: number, tonos: number, sonando: boolean, sesionTipo: string },
//   vibracion: { patrones: Array<number | number[]> },
//   almacenamiento: { mapa: Map, cambiarDesdeOtraVentana(clave, valor | null): void },
//   reproducir(muestras, fixes): Promise<void>,           intercala por tiempo avanzando el reloj; emite cada muestra y cada fix en su momento
//   limpio(): { temporizadores: number, escuchas: number, vigilancias: number, centinelas: number },
//   crearVentana(): object,                               ventana falsa completa para globalThis.window y motorDelNavegador
// }
```

Semántica que las pruebas de §6.2 dan por hecha:

- `reloj.avanzar(ms)` es `async`: dispara en orden los temporizadores vencidos y, entre cada uno y al final, vacía microtareas (`await new Promise((r) => setImmediate(r))` varias veces). `saltarPared(ms)` mueve sólo la pared (equipo suspendido o reloj cambiado) y no dispara nada.
- Activación transitoria: `gesto()` guarda `ultimoGesto = mono()`. `navigator.wakeLock.request('screen')` resuelve con un centinela si `mono() − ultimoGesto ≤ 5000` o si `autorizadoAntes`; si no, rechaza con un error de `name: 'NotAllowedError'`. Al conceder, `autorizadoAntes = true` (es por documento: un juego de fuentes nuevo empieza en false). `liberarPorSistema()` suelta el centinela activo y despacha `release`.
- `DeviceMotionEvent.requestPermission()` resuelve o rechaza recién después de `demoraPermisoMs` de reloj falso.
- `navigator.permissions.query({ name: 'geolocation' })` resuelve con el estado configurado; `watchPosition` suma a `vigilancias` y `pedidos`; `clearWatch` resta. Con `'denied'`, llama al callback de error con `{ code: 1 }`.
- `ventana.despachar('pointerdown')` no toca `ultimoGesto` ni ninguna escucha del motor; `'pointerup'`, `'touchend'`, `'click'` y `'keydown'` sí marcan la activación.
- `fuentes.local` escribe y lee `acta:actuacion-abierta` y `acta:secreto:<id>` en `almacenamiento.mapa`, como `lib/local.ts`: [V7] afirma sobre ese `Map` que `registrarAccidente` dejó recordada la actuación.
- `movimiento.emitir(muestra)` despacha `devicemotion` con `{ timeStamp: muestra.t, acceleration, accelerationIncludingGravity, rotationRate, interval: 16 }`.
- `limpio()` después de `motor.destruir()` tiene que dar todo en 0 («Al terminar cada prueba: cero temporizadores y cero listeners pendientes»).
- Para `motorDelNavegador`: `globalThis.window = falsas.crearVentana()`, `const a = await import('../lib/viaje.ts?instancia=1')`, `a.motorDelNavegador()`, `const b = await import('../lib/viaje.ts?instancia=2')`, `b.motorDelNavegador()`; la prueba afirma que las escuchas de la ventana después de la segunda llamada son las mismas que después de la primera (la primera instancia quedó destruida) y al final hace `delete globalThis.window` y `delete globalThis.__actaMotorViaje`. (Verificado: `tsx` carga instancias distintas del módulo con `?instancia=N`.)

### e2e: `scripts/prueba-e2e.mjs`

**Decisiones:** (1) `"e2e": "tsx scripts/prueba-e2e.mjs"`: hace falta importar `lib/db.ts` (`SCHEMA`) y `lib/retencion.ts` (`anonimizar`); con `node` a secas los `.ts` con propiedades de parámetro no cargan. (2) El e2e **nunca** lee `.env` ni `DATABASE_URL`. Lo que no tiene ruta HTTP usa `E2E_DATABASE_URL`, que tiene que ser la base descartable del servidor que se está probando; sin esa variable esas verificaciones imprimen `  salta …`. Antes de usar `lib/retencion.ts`, el e2e hace `process.env.DATABASE_URL = process.env.E2E_DATABASE_URL` y `process.env.DATABASE_SSL = process.env.E2E_DATABASE_SSL ?? 'false'`, las dos antes del `await import('../lib/retencion.ts')`, que es dinámico y posterior: `lib/db.ts` arma el pool la primera vez con `DATABASE_SSL`, no con `E2E_DATABASE_SSL`. `E2E_DATABASE_SSL=true` agrega además `ssl: { rejectUnauthorized: false }` al `pg.Client` propio de [10a]. (3) La purga simulada usa `CLAVE_MANTENIMIENTO` del entorno del e2e (la misma que el servidor); sin ella, salta.

F1 refactoriza el arnés: `pedir(ruta, opciones)` pasa a usar un frasco por omisión y se agrega `crearFrasco()` → `{ galletas: Map, ip: string, pedir(ruta, opciones) }` para clientes con otra cookie. Cada frasco, también el de omisión, manda en todos sus pedidos la cabecera `x-forwarded-for` con una IP propia: `10.<a>.<b>.<n>`, con `a` y `b` sorteados una vez por corrida (`crypto.randomInt(0, 256)`) y `n` el número de frasco de esa corrida (de 1 a 254); y `saltar(nombre, motivo)` imprime `  salta ${nombre} (${motivo})` sin contar. La sección va después de `[9]` y antes de `/* ---------- Resultado ---------- */`, con encabezado `console.log('\n[10] Modo viaje')`.

| Subsección | Fase | Qué verifica |
|---|---|---|
| `[10a] Esquema idempotente` | F1 | Con `E2E_DATABASE_URL`: `new pg.Client`, `BEGIN`, `SCHEMA`, `SCHEMA`, `ROLLBACK`, sin error. Sin la variable: `salta` |
| `[10b] Configuración` | F1 | Frasco nuevo: `GET /api/telemetria/configuracion` 200, `cache-control` incluye `no-store`, queda la cookie `acta_posesion`, `version` de 16 hexadecimales, `alerta` en la lista, `umbrales.sospechaG` numérico |
| `[10c] Alta de alerta` | F1 | Cuerpo nuevo sin episodio → 201 con `id` `/^TEL-/`; el mismo `id_cliente` otra vez → 200 con el mismo `id`; con `episodio` n = 1 → 200 mismo `id`; cuerpo del detector anterior → 201 con `id` y `veredicto` |
| `[10d] Dueño y respuestas` | F1 | `GET /api/telemetria/[id]` con el frasco dueño → 200 y `no-store`; con otro frasco → 404 con `MENSAJE_TELEMETRIA_AJENA`; campos con `estoy_bien` y después con `sin_respuesta` → el `GET` sigue en `estoy_bien`; alerta nueva con `necesito_ayuda` → `plan.ofrecerEmergencias === true`; `POST …/respuesta` con `{ respuesta: 'quizas' }` → 400; `POST …/respuesta` `sin_respuesta` sobre la de `estoy_bien` → 200 y el `GET` sigue en `estoy_bien` |
| `[10e] Topes` | F1 | Cuerpo de 500 KB → 413 y `error` incluye `128 KB`; frasco nuevo, `GET` de configuración y 31 `POST /api/telemetria` con cuerpo `x` → el 31 da 429 con `Retry-After` numérico |
| `[10f] Conducción y borrado` | F1 | `POST /api/conduccion` con 2 eventos → `guardados: 2`; repetido → `guardados: 0`; `DELETE /api/telemetria/mias` → 200 con `alertas ≥ 1` y `eventos_conduccion ≥ 2`; el `GET` de una alerta borrada → 404 |
| `[10g] Altas anónimas y PATCH` | F1 | Actuación nueva abierta: `PATCH` con 70 KB → 413; frasco nuevo, `GET` de configuración y 11 `POST /api/casos` con 9 KB → el 11 da 429 (no se crea ninguna actuación: el límite corre antes del cuerpo) |
| `[10h] Actuación desde un golpe` | F5 | Frasco nuevo: alerta → `POST /api/casos { telemetria_id }` → 201 `vinculo_telemetria: 'ok'`; `GET /api/casos/[id]` → `origen === 'impacto'`; con `E2E_DATABASE_URL`, el detalle de `apertura_actuacion` tiene `origen: 'impacto'`, `telemetria_id`, `nivel`, sólo primitivas y ninguna de `lat`, `lon`, `gps`, `ubicacion`, `kmh`; cerrar → 200; `POST /api/verificar` → `valido: true` |
| `[10i] Reintento del alta` | F5 | El mismo `telemetria_id` → 200 `ya_registrada: true`, mismo `id`, `secreto` distinto |
| `[10j] Telemetría ajena` | F5 | Otro frasco con ese `telemetria_id` → 201 `vinculo_telemetria: 'rechazado'`, otro `id`, `origen === 'boton'` |
| `[10k] Responder después del cierre` | F5 | `POST /api/telemetria/[id]/respuesta` `estoy_bien` → 200; `/api/verificar` sigue `valido: true` con los mismos `eslabones` |
| `[10l] Purga simulada` | F5 | Con `CLAVE_MANTENIMIENTO`: `POST /api/mantenimiento/expurgo` sin cuerpo → 200 con `telemetria.alertas` y `telemetria.eventos_conduccion` numéricos. Sin la variable: `salta` |
| `[10m] Anonimizar` | F5 | Con `E2E_DATABASE_URL`: `anonimizar(id, 'prueba e2e')` → el `GET` de la telemetría vinculada da 404 y `/api/verificar` sigue `valido: true`. Sin la variable: `salta` |

**Decisión:** Next completa `x-forwarded-for` con la IP del socket (`node_modules/next/dist/server/base-server.js`, `req.headers['x-forwarded-for'] ??= …remoteAddress`), así que en local también se limita por IP (`::1` o `::ffff:127.0.0.1`). Cada corrida hace hasta 16 `POST /api/casos` (2 que ya existen, 11 de [10g] y 3 de [10h]–[10j]) y el tope de `altas` por IP es 30 por minuto: sin una IP propia, una segunda corrida seguida fallaría con 429 en [10h]–[10j]. Por eso cada frasco manda su `x-forwarded-for` (ver arriba): con `PROXY_SALTOS_CONFIABLES` en 1 y una sola entrada, `ipDelCliente` toma esa IP y cada frasco queda aislado por huella y por IP. Contra un servidor detrás de un proxy, el proxy agrega la IP real y la cabecera propia deja de contar: ahí, entre dos corridas se esperan 60 s (`reiniciarLimites` sólo existe en la memoria del servidor).

---

## Riesgos de implementación conocidos

Cada punto es una trampa concreta y la regla que la evita.

**Cadena de custodia y base**

1. **`Date` o `undefined` en el detalle de `registrarEvento`.** `canonico` convierte un `Date` en `{}` y `JSON.stringify` en texto; un `undefined` entra al hash como `null` y desaparece del JSON guardado. El eslabón queda inverificable para siempre. Regla: el detalle lleva sólo primitivas (ISO en texto, números, `null`); `aJsonPuro` es la red, no la costumbre.
2. **`pg` devuelve BIGINT y `count(*)` como texto, y TIMESTAMPTZ como `Date`.** `desfase_reloj_ms` llega como `'-120'` y `ocurrido_en_telefono` como `Date`. Regla: convertir con `detalleAperturaImpacto` o a mano antes de detalles y respuestas JSON; contar con `count(*)::int`.
3. **Un objeto `interface` no se asigna a `Record<string, unknown>`.** Regla: lo que se pasa como detalle se declara con `type` (como `DetalleAperturaImpacto`).
4. **`ALTER TABLE … ADD CONSTRAINT` no es idempotente, `ADD CHECK` sin nombre se duplica, y un CHECK dentro de `ADD COLUMN IF NOT EXISTS` sobre una columna existente se ignora.** `SCHEMA` corre como una sola consulta: un error lo revierte todo y la aplicación no arranca. Regla: el bloque `DO $c$ … $c$` de «Esquema», tal cual.
5. **`ADD COLUMN recibido_en … DEFAULT now()` le pone la hora del despliegue a las filas viejas.** Regla: agregar sin default, `UPDATE … SET recibido_en = ts WHERE recibido_en IS NULL`, después `SET DEFAULT now()`.
6. **Un 23505 dentro de `BEGIN` aborta la transacción: el reintento siguiente da 25P02.** Regla: `INSERT … ON CONFLICT (id) DO NOTHING RETURNING id` en el bucle de 5 intentos, sin `SAVEPOINT`.
7. **`ON CONFLICT (dispositivo_sha256, id_cliente)` sin el predicado del índice parcial falla con «there is no unique or exclusion constraint matching the ON CONFLICT specification».** Regla: `ON CONFLICT (dispositivo_sha256, id_cliente) WHERE id_cliente IS NOT NULL`.
8. **`anotarPosesion` dentro de la transacción del alta** usa otra conexión y la clave foránea todavía no ve la fila. Regla: después del `COMMIT`.
9. **El contrato de datos personales corta el texto en `'{ reservado'`.** Con `{ cliente, reservado: { poliza, patente } }` no corta y encuentra `{ poliza,`. Regla: escribir las opciones empezando por `reservado`: `{ reservado: { poliza, patente }, cliente }`.
10. **Un eslabón sobre un expediente sellado** hace que el verificador denuncie como alterado un expediente intacto. Regla: ninguna respuesta, borrado ni purga del modo viaje llama a `registrarEvento`; `abrirActuacionDesdeImpacto` sólo escribe sobre una actuación que acaba de crear.

**Next y el servidor**

11. **`cookies().set()` sólo funciona en un route handler.** Regla: `huellaDispositivo(…, true)` nunca desde un Server Component.
12. **`after()` corre aunque la respuesta haya fallado.** Regla: `after(() => purgarTelemetriaSiToca())`, que atrapa y loguea; nunca `await` de la purga antes de responder.
13. **Carpetas estáticas junto a `[id]`.** `app/api/telemetria/mias` y `configuracion` ganan sobre `[id]`; no definir en ellas métodos que se esperan en `[id]`.
14. **`leerCuerpoLimitado` y los clientes sin `Content-Length`.** Regla: el teléfono manda `JSON.stringify(…)` (string, no `Blob` ni `ReadableStream`); el servidor igual cuenta bytes leyendo y hace `reader.cancel()` al pasarse. En pruebas de Node, `new Request(url, { method: 'POST', body: 'x' })` no trae `content-length`: ponerlo a mano cuando se prueba esa rama.
15. **Limitar antes de leer el cuerpo** hace que los pedidos rechazados por tamaño también cuenten (es lo que el e2e aprovecha para no crear filas). No mover el orden.
16. **El entorno desplegado puede tener `IMPACTO_VELOCIDAD_PREVIA_KMH=30`** copiado del `.env.example` viejo: pasa la validación y apaga la mejora de §2.5. Regla: F2 lo avisa en el README y en el commit; revisar las variables del servicio al desplegar.

**Navegador y motor**

17. **`typeof navigator` es `'object'` en Node ≥ 21 (aquí 24.19).** Regla: la guarda es `typeof window === 'undefined'`, y las fuentes del navegador leen `window.navigator`, `window.document`, `window.performance` y `window.localStorage`, nunca los globales sueltos.
18. **Efectos al importar.** El layout importa `ModoViaje.tsx`, que importa `lib/viaje.ts`, durante el render del servidor. Regla: `lib/viaje.ts`, `lib/cola-viaje.ts`, `lib/conduccion.ts`, `lib/transporte-viaje.ts` e `lib/impacto.ts` no tocan APIs del navegador fuera de funciones.
19. **`useSyncExternalStore` sin `getServerSnapshot` rompe la hidratación, y un `estado()` que arma un objeto nuevo en cada llamada entra en bucle («The result of getSnapshot should be cached»).** Regla: `() => ESTADO_SERVIDOR`; `suscribir` y `obtener` a nivel de módulo; la instantánea se reemplaza sólo cuando algo cambió.
20. **Cualquier `await` antes del wake lock, del audio o de `requestPermission` pierde el gesto** (en WebKit la activación transitoria dura 5 s y el diálogo del sistema la consume). Regla: en `encender`, `reanudar`, `activarGps`, `probarAlerta` y el destrabador, las llamadas sincrónicas van primero; nada de `import()`, `fetch` ni IndexedDB antes.
21. **`pointerdown` no da activación con el dedo.** Regla: `pointerup`, `touchend`, `click` y `keydown`, en captura y `passive`.
22. **`requestPermission()` resuelve `'denied'` (no rechaza) cuando la negativa quedó en memoria, y rechaza con `NotAllowedError` sin activación.** Regla: tratar los dos caminos como en §4.1 y §4.3.
23. **`crypto.randomUUID` no existe fuera de contexto seguro.** El motor se crea también por http (para decir `no_soportado`). Regla: `nuevoId` con respaldo en `crypto.getRandomValues`, y sin generar ids antes de comprobar `seguro`.
24. **`e.timeStamp` de `devicemotion` puede no estar en la base de `performance.now()`** en navegadores viejos. Regla: si `|e.timeStamp − reloj.mono()| > 10 000`, usar `reloj.mono()` al recibir la muestra.
25. **`navigator.vibrate` devuelve `false` sin tirar** cuando no hay activación. Regla: ignorar el `false`; en iPhone no existe.
26. **Un `<dialog>` abierto con `showModal()` está en la capa superior y deja inerte la alerta.** Regla: cerrar la hoja en un `useLayoutEffect` apenas `estado.alerta` deja de ser `null`, y no abrirla con una alerta.
27. **`inert` sobre `.raiz-app` también apaga las regiones vivas que estén adentro.** Regla: la región `role="status"`, la región `assertive` de la cuenta y la alerta van en la capa, fuera de `.raiz-app`. React 19 recibe `inert={capaBloqueante || undefined}`.
28. **`display: contents` y los selectores de hijo directo.** Verificado: no hay `body > main`; `.inicio > .acceso` y `.inicio > .aviso` siguen funcionando porque `.raiz-app` envuelve `main`. Si alguien agrega un selector de hijo directo de `body`, se rompe.
29. **`localStorage` puede tirar al acceder y el evento `storage` sólo llega a las otras ventanas.** Regla: todo en `try/catch`; una escritura propia no dispara `storage` en la misma ventana.
30. **`usePathname()` no cambia con el `pushState` de `?paso=` del recorrido**: la pausa se decide por el pathname `/s/<id>` y no depende del paso.
31. **`toLocaleTimeString` agrega «a. m.»/«p. m.» en algunos motores.** Regla: `{ hour: '2-digit', minute: '2-digit', hour12: false }`.

**Contrato de interfaz**

32. **Trampa de literales de `VALOR` en `app/components/`**: `'1'`, `"2"`, `'3'`, `'Sí'`, `'No'`, `'Yo'`, `'Verde'`, `'Rojo'`, `'Amarillo'`, `'Seco'`, `'Mojado'`, `'Niebla'`, `'Nublado'`, `'Despejado'`, `'Ambulancia'`, `'Bomberos'`, `'Grúa'`, `'Leves'`, `'Graves'`, `'No sé'`, `'No recuerdo'`… entre comillas hacen fallar el contrato (106 textos en total). Regla: números de SVG como `{2}`; nada de `'1'` para `acta:diagnostico`; textos de la interfaz en JSX sin comillas o en frases que no coincidan exactas con una opción.
33. **`.contador` ya existe y lo usa el recorrido.** Regla: la cuenta de la alerta es `.alerta-viaje-cuenta`.
34. **Una frase obligatoria partida en dos líneas del código** no la encuentra el contrato (busca texto literal). Regla: cada frase de la tabla de textos obligatorios en una sola línea del `.tsx`.
35. **Cupo 0 de estilos en línea en archivos nuevos.** Regla: ningún `style={{` en `ModoViaje.tsx`, `AyudaImpacto.tsx` ni en la tarjeta; lo que cambia con el estado va por clases o atributos existentes.
36. **Las clases compuestas con interpolación no se verifican** (`` `x-${y}` ``). Regla: clases literales por rama.
37. **El chequeo de literales de `data-estado` y `data-nivel`** tiene que ignorar lo que va después de una comparación (`f.estado === 'cerrado' ? 'ok' : 'neutra'` existe hoy). Regla: reusar `COMPARACION` del chequeo de clases.
38. **`BotonesEmergencia` no tiene `'use client'`**: pasarle `alLlamar` sólo vale desde un Client Component (hoy todos sus llamadores lo son).

**Pruebas**

39. **Los imports estáticos de `prueba-logica.mjs` abortan el archivo entero** si falta un export. En `prueba-viaje.mjs` los imports van dentro de cada `seccion` con `await import()`.
40. **Una prueba que deja `globalThis.window` definido** hace que `motorDelNavegador()` deje de devolver `null` en las siguientes. Regla: borrar `globalThis.window` y `globalThis.__actaMotorViaje` al terminar.
41. **`enviarPush` genera la clave VAPID en `data/claves/vapid.pem`** si no existe. `data/` está en `.gitignore`; no borrarla a mano durante las pruebas de un servidor que ya suscribió teléfonos.
42. **El banco a 1 kHz con `urbano(20)` usa unos 100 MB por escena.** Regla: correr las tres veces en secuencia y no guardar las escenas.

---

## Decisiones tomadas en este índice (resumen)

Lo que el diseño dejaba abierto y quedó fijado acá; el detalle está en la sección citada.

1. **Módulo de transporte propio** (`lib/transporte-viaje.ts`) y `./transporte-viaje` en las importaciones permitidas del motor (Interfaces).
2. **Todo el pipeline de detección es puro en `lib/conduccion.ts`** detrás de `crearDetector`, para que el banco mida lo mismo que corre en el teléfono (Interfaces).
3. **La serie compacta tiene 7 columnas**: `[t, ax, ay, az, gTotal, giro, h]`; `h` (horizontal filtrada) hace falta para que el servidor repita la caída sin golpe. `t` relativo al disparo, x e y relativos a la primera lectura del episodio (Interfaces › `lib/impacto.ts`).
4. **El cuerpo de `POST /api/telemetria` es `{ campos, episodio }`** con un episodio anidado o `null`, las respuestas viajan como `respuestas: [{ respuesta, en_telefono }]` (todas, en orden, con el mismo nombre que en `POST …/respuesta` y en la columna `respuestas`) y el lote de conducción usa filas compactas de 8 columnas para caber en 8 KB (Contratos HTTP).
5. **El teléfono evalúa exactamente lo que manda**: el detector recorta y redondea el episodio antes de `evaluarEpisodio` (Interfaces › `lib/conduccion.ts`).
6. **Rangos de `validarUmbrales`** y regla de relaciones (Interfaces › `lib/impacto.ts`).
7. **`planEscalamiento(veredicto, respuesta)`** recibe `{ nivel, alertaMostrada }`, ofrece el contacto siempre que escala, y sus textos quedan fijos; se suma `nivelMayor`.
8. **`analizarImpacto` queda como adaptador** para el cuerpo del detector anterior y para `/api/casos/[id]/sensores` (fuera de alcance), y el cuerpo viejo se sigue aceptando hasta el final de este plan.
9. **Topes del limitador** por ámbito, huella e IP; `PROXY_SALTOS_CONFIABLES = 0` no limita por IP; las altas anónimas se limitan con la huella de propósito `telemetria` sin crear la cookie (Interfaces › `lib/limite.ts`, Contratos HTTP).
10. **`leerCuerpoLimitado` devuelve `{}` con cuerpo vacío**, y los errores de cuerpo, límite y transporte los traduce `errorApi` por clase (`ErrorCuerpo`, `ErrorLimite`, `ErrorTransporte`).
11. **Topes de cuerpo que el diseño no fijaba**: `POST /api/casos` 8 KB y `PATCH /api/casos/[id]` 64 KB, en F1 (§0.4 los pide «aparte y antes», y usan las piezas de F1).
12. **F0 autoriza lo mínimo**: lista de servicios de push, `redirect: 'manual'`, nunca el cuerpo del servicio, y sesión exigida en la prueba sólo si la suscripción es de una cuenta; el alta y la baja de dispositivos siguen sin sesión.
13. **Esquema**: `recibido_en` agregado sin default y completado con `ts`; columna nueva `apertura`; la serie se guarda también en alertas abiertas por seguimiento; `gps` en NULL apenas `hubo_choque` queda en false (no sólo en la purga); prefijo `EPI` con `nuevoId` y `CON-` con `randomUUID()` (Esquema).
14. **Reglas de fusión columna por columna** del upsert (Esquema).
15. **La alerta viva se persiste en `acta:viaje:alerta` en sus tres estados** y se restaura con reglas por estado; `acta:golpe-pendiente` vence a los 30 min de `ocurridoEn`; `acta:viaje:sin-sensores` vence a las 24 h (Almacenamiento).
16. **`EstadoModoViaje` suma** `motivoNoSoportado`, `pantallaLiberada`, `sesionDeAudio`, `plataforma`, `standalone`, `ruta`, `velocidadKmh`, `precisionM`, `siguioPorMovimientoEn`, `diagnostico`, y en la alerta `restanteS`, `abiertaEn`, `apertura`, `respondida`, `armada` y `ubicacion`; `lib/viaje.ts` exporta sólo lo de §1.1 y el resto de los tipos no se exporta (Interfaces › `lib/viaje.ts`).
17. **El motor suma** `tocar`, `activarGps`, `falsaAlarma`, `descartarGolpePendiente`, `borrarRegistros` y `drenarCola`, y `registrarAccidente` vive en el motor desde F3 (antes de que el servidor vincule en F5).
18. **La hoja vive en el proveedor** y se cierra con `useLayoutEffect` al abrirse una alerta; la píldora en `/` sólo aparece si la tarjeta quedó arriba del viewport; prioridad de rótulos y toques de la píldora (Interfaces › `ModoViaje.tsx`).
19. **Una alerta nueva durante `ayuda`** se registra aparte con `alerta_mostrada: false`; durante `hubo_choque`, reemplaza a la anterior dejando golpe pendiente; la inactividad no empieza con un golpe pendiente.
20. **F4 dibuja una ayuda provisoria** (títulos, `BotonesEmergencia` y falsa alarma) hasta que F5 trae `AyudaImpacto`; en esta etapa `/aviso` vuelve siempre con `router.replace('/')`.
21. **Textos que el diseño no escribía**: anuncios de la región de estado, instrucciones de ubicación por plataforma, textos de la hoja, compartir, errores de servidor y de push (Interfaz › Textos exactos).
22. **Clases y atributos**: dos `data-*` nuevos (`data-armada`, `data-pildora-viaje`), sin valores nuevos de `data-estado` ni `data-nivel`; animación `destello-viaje` con tokens existentes (Interfaz).
23. **Pruebas separadas** en `scripts/prueba-viaje.mjs` con secciones [V1]–[V8], imports dinámicos por sección y filtro `SECCION`; `npm run prueba` las encadena (Pruebas).
24. **El e2e corre con `tsx`**, nunca lee `.env` ni `DATABASE_URL`, y lo que no tiene ruta HTTP usa `E2E_DATABASE_URL` con salto explícito (Pruebas › e2e).
25. **Valor fijo del hash** para probar que `aJsonPuro` no cambia hashes existentes: `7e35a94f980fc6b17e0cb60d1ca3ec08785acf412064fe234e32e6ff20f52b87` (Interfaces › `lib/hash.ts`).
