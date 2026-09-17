# F0 — SSRF de /api/push/prueba — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el servidor deje de ser una forma de leer la red interna desde afuera: `POST /api/push/prueba` sólo le habla a servicios de Web Push conocidos, no sigue redirecciones, nunca devuelve el cuerpo de lo que contesta el servicio y, si la suscripción es de una cuenta, exige la sesión de esa cuenta.

**Architecture:** Una función pura nueva, `endpointPushValido(endpoint)`, en `lib/push.ts`, decide si una URL es de un servicio de push (https, sin credenciales, puerto 443 y host de una lista cerrada). `enviarPush` la usa antes de firmar y de hacer el `fetch` (hay filas viejas en `dispositivos`), manda con `redirect: 'manual'` y arma el `motivo` con textos fijos. Las dos rutas de push la usan para rechazar con 400 antes de tocar la base; `POST /api/push/dispositivos` además valida el largo de las claves, y `POST /api/push/prueba` lanza `ErrorAcceso(403)` cuando la suscripción tiene `usuario_id` y la sesión no es de ese usuario. `POST` y `DELETE /api/push/dispositivos` siguen sin exigir sesión.

**Tech Stack:** Next.js 16.3 (route handlers), TypeScript 7 (`tsc --noEmit`), Node 24.19 (`fetch` de undici, `URL`, `Buffer`), Postgres con `pg`, `tsx` para `scripts/prueba-logica.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md` (§0.4 «Se arregla aparte y antes», §7 fila F0) · índice: `docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md` («Fases › F0», «Interfaces › `lib/push.ts` (F0)», «Contratos HTTP › `POST /api/push/dispositivos` y `POST /api/push/prueba` (F0)», «Textos exactos › Servidor», «Pruebas: convenciones»).

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

---

## Antes de empezar

Precondiciones:

- F0 es la primera fase: no depende de ninguna otra.
- Rama `modo-viaje-global` (`git branch --show-current` imprime `modo-viaje-global`). El árbol puede tener sin seguir `docs/superpowers/plans/`: no se agrega en ningún commit de esta fase.
- Las tres verificaciones en verde antes de tocar nada, desde la raíz del repositorio (Git Bash):

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, `tsc --noEmit` sin salida, y al final de la prueba `129/129 verificaciones pasaron` y `Todo en orden.` (con el árbol del commit `f47005e`; si el número difiere porque entró otro commit, lo que importa es que no haya ninguna línea `FALLA`).

Leer primero, enteros:

1. `lib/push.ts` (148 líneas): `pushActivo` (líneas 53–55), `autorizacion` (64–79), `ResultadoEnvio` (99–105), `enviarPush` (107–148; la lectura del cuerpo está en la 130 y su eco en la 137).
2. `app/api/push/dispositivos/route.ts` (64 líneas) y `app/api/push/prueba/route.ts` (45 líneas).
3. `lib/sesion.ts`: `ErrorAcceso` (líneas 46–55) y `leerSesion` (76–103). `leerSesion()` sin cookie devuelve `null` sin tocar la base.
4. `lib/api.ts`: `errorApi` traduce `ErrorAcceso` a `{ error, tipo: 'acceso' }` con `err.estado` (líneas 24–26).
5. `lib/cifrado.ts`: `Suscripcion` (líneas 21–27) y `cifrarCarga` (63 en adelante).
6. `scripts/prueba-logica.mjs`: imports (líneas 12–25), `verificar` (30–38), el bloque bajo `/* ---------- 10. Impacto y notificaciones ---------- */` (línea 732), el bloque del vector del RFC 8291 (735–773) y el comentario `/* El detector de impacto, contra series sintéticas. */` (línea 775).
7. `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` (no se usa ninguna API nueva de Next, pero se tocan dos route handlers).

Cómo se reparte la lista de F0 del índice en las tareas: los puntos 1 y 2 son las tareas 1 y 2; el punto 6 (pruebas en `prueba-logica.mjs`) se escribe primero dentro de esas dos tareas; el punto 3 es la tarea 3; el punto 4 es la tarea 4; la decisión del punto 5 queda escrita como comentario en las rutas de las tareas 3 y 4.

Riesgo conocido (índice, riesgo 41): la prueba de la tarea 2 llega hasta `autorizacion()`, que genera `data/claves/vapid.pem` si no existe. `data/` está en `.gitignore`; no borrar esa clave a mano.

---

### Task 1: `endpointPushValido` en `lib/push.ts`

**Files:**
- Modify: `lib/push.ts` — después de `export function pushActivo(): boolean { … }` (hoy líneas 53–55), antes del comentario `Arma el encabezado de autorización VAPID.`
- Test: `scripts/prueba-logica.mjs` — import después de `import { UMBRALES, analizarImpacto, planEscalamiento } from '../lib/impacto.ts'` (hoy línea 21); bloque nuevo inmediatamente antes de `/* El detector de impacto, contra series sintéticas. */` (hoy línea 775), es decir, después del bloque del RFC 8291.

**Interfaces:**
- Consumes: nada (usa `URL` global de Node y del navegador).
- Produces (índice, «Interfaces › `lib/push.ts` (F0)»):

```ts
/** true sólo para https, sin usuario ni clave, puerto vacío o 443, y host en la lista de F0. Acepta cualquier cosa. */
export function endpointPushValido(endpoint: unknown): endpoint is string
```

- [ ] **Step 1: Escribir la prueba que falla (import)**

En `scripts/prueba-logica.mjs`, reemplazar:

```js
import { UMBRALES, analizarImpacto, planEscalamiento } from '../lib/impacto.ts'
```

por:

```js
import { UMBRALES, analizarImpacto, planEscalamiento } from '../lib/impacto.ts'
import { endpointPushValido } from '../lib/push.ts'
```

- [ ] **Step 2: Escribir la prueba que falla (tabla de endpoints)**

En `scripts/prueba-logica.mjs`, reemplazar:

```js
/* El detector de impacto, contra series sintéticas. */
```

por:

```js
/* Push: el servidor sólo le habla a servicios de notificaciones conocidos. */
{
  // Si el endpoint fuera libre, /api/push/prueba le haría un POST a cualquier URL: la red interna leída desde afuera.
  const validos = [
    'https://fcm.googleapis.com/fcm/send/abc',
    'https://updates.push.services.mozilla.com/wpush/v2/abc',
    'https://web.push.apple.com/QGx',
    'https://wns2-par02p.notify.windows.com/w/?token=abc',
  ]
  for (const endpoint of validos) {
    verificar(`endpoint de push aceptado: ${endpoint}`, endpointPushValido(endpoint) === true)
  }

  const invalidos = [
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://169.254.169.254/latest/meta-data',
    'https://fcm.googleapis.com.evil.com/x',
    'https://usuario:clave@fcm.googleapis.com/x',
    'https://fcm.googleapis.com:8443/x',
    'https://evilnotify.windows.com/x',
    'no es una url',
    42,
  ]
  for (const endpoint of invalidos) {
    verificar(`endpoint de push rechazado: ${String(endpoint)}`, endpointPushValido(endpoint) === false)
  }
}

/* El detector de impacto, contra series sintéticas. */
```

- [ ] **Step 3: Correr la prueba y ver que falla**

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
npm run prueba
```

Esperado: aborta antes de imprimir ninguna verificación, con código 1 y:

```
SyntaxError: The requested module '../lib/push.ts' does not provide an export named 'endpointPushValido'
```

- [ ] **Step 4: Implementar `endpointPushValido`**

En `lib/push.ts`, reemplazar:

```ts
export function pushActivo(): boolean {
  return process.env.PUSH_DESACTIVADO !== 'true'
}
```

por:

```ts
export function pushActivo(): boolean {
  return process.env.PUSH_DESACTIVADO !== 'true'
}

/*
 * El servidor le hace un POST al endpoint que mandó el teléfono. Con cualquier URL, eso
 * es una lectura de la red interna desde afuera: los metadatos de la nube en
 * 169.254.169.254, un puerto de la base, un panel sin clave. Por eso la lista es cerrada y
 * nombra sólo a los servicios de Web Push de los navegadores que usa la aplicación.
 */
const HOSTS_PUSH = new Set(['fcm.googleapis.com', 'android.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'])

// Apple y Microsoft reparten las suscripciones entre subdominios. El punto inicial es lo
// que impide que pase evilnotify.windows.com.
const SUFIJOS_PUSH = ['.push.apple.com', '.notify.windows.com']

/** true sólo para https, sin usuario ni clave, puerto vacío o 443, y host de un servicio de push conocido. Acepta cualquier cosa. */
export function endpointPushValido(endpoint: unknown): endpoint is string {
  if (typeof endpoint !== 'string') return false
  let url: URL
  try {
    url = new URL(endpoint)
  } catch {
    return false
  }
  if (url.protocol !== 'https:') return false
  if (url.username !== '' || url.password !== '') return false
  // URL deja el puerto vacío cuando es el de omisión, pero se acepta '443' por si otro motor no lo normaliza.
  if (url.port !== '' && url.port !== '443') return false
  const host = url.hostname.toLowerCase()
  return HOSTS_PUSH.has(host) || SUFIJOS_PUSH.some((sufijo) => host.endsWith(sufijo))
}
```

- [ ] **Step 5: Correr la prueba y ver que pasa**

```bash
npm run prueba
```

Esperado: código 0, estas doce líneas dentro de `[10] Impacto y notificaciones`, ninguna `FALLA`, y al final `141/141 verificaciones pasaron` y `Todo en orden.`:

```
  ok   endpoint de push aceptado: https://fcm.googleapis.com/fcm/send/abc
  ok   endpoint de push aceptado: https://updates.push.services.mozilla.com/wpush/v2/abc
  ok   endpoint de push aceptado: https://web.push.apple.com/QGx
  ok   endpoint de push aceptado: https://wns2-par02p.notify.windows.com/w/?token=abc
  ok   endpoint de push rechazado: http://fcm.googleapis.com/fcm/send/abc
  ok   endpoint de push rechazado: https://169.254.169.254/latest/meta-data
  ok   endpoint de push rechazado: https://fcm.googleapis.com.evil.com/x
  ok   endpoint de push rechazado: https://usuario:clave@fcm.googleapis.com/x
  ok   endpoint de push rechazado: https://fcm.googleapis.com:8443/x
  ok   endpoint de push rechazado: https://evilnotify.windows.com/x
  ok   endpoint de push rechazado: no es una url
  ok   endpoint de push rechazado: 42
```

- [ ] **Step 6: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `19/19 comprobaciones pasaron` y `El contrato se cumple.`; `tsc --noEmit` sin salida; `141/141 verificaciones pasaron` y `Todo en orden.`. (El contrato no se queja de nombres repetidos: `endpointPushValido` no está en «Nombres ocupados».)

- [ ] **Step 7: Commit**

```bash
git add "lib/push.ts" "scripts/prueba-logica.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Decidir si un endpoint es de un servicio de push antes de mandarle nada

El servidor le hace un POST al endpoint que registra el teléfono. Sin una lista
cerrada de servicios, cualquiera que registre una URL propia lo usa para tocar la
red interna. endpointPushValido acepta sólo https, sin credenciales, en el puerto
443 y con el host de Google, Mozilla, Apple o Microsoft.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `enviarPush` sin redirecciones ni eco del servicio

**Files:**
- Modify: `lib/push.ts` — cuerpo de `export async function enviarPush(…)` (hoy líneas 109–139: desde `if (!pushActivo())` hasta el `return` con `detalle.slice(0, 200)`; el `catch` final no cambia).
- Test: `scripts/prueba-logica.mjs` — el import de la tarea 1 y un bloque nuevo inmediatamente antes de `/* El detector de impacto, contra series sintéticas. */` (después del bloque de la tarea 1).

**Interfaces:**
- Consumes: `endpointPushValido(endpoint: unknown): endpoint is string` (tarea 1); `cifrarCarga(suscripcion: Suscripcion, carga: string, salFija?: Buffer, efimeraFija?: Buffer): Buffer` (`lib/cifrado.ts`, existente).
- Produces: `enviarPush(suscripcion: Suscripcion, aviso: Aviso): Promise<ResultadoEnvio>` con la misma firma. Cambia sólo el comportamiento:
  - endpoint inválido → `{ ok: false, estado: 0, motivo: 'La suscripción no apunta a un servicio de notificaciones conocido: no se le mandó nada.', caducada: false }` sin ningún pedido;
  - 3xx → `{ ok: false, estado: <3xx>, motivo: 'El servicio de notificaciones respondió con una redirección, que no se sigue.', caducada: false }`;
  - otro no-2xx distinto de 403 → `motivo: \`El servicio de notificaciones respondió ${res.status}.\``; el 403 conserva su texto actual; el cuerpo de la respuesta nunca se lee.

- [ ] **Step 1: Escribir la prueba que falla (import)**

En `scripts/prueba-logica.mjs`, reemplazar:

```js
import { endpointPushValido } from '../lib/push.ts'
```

por:

```js
import { endpointPushValido, enviarPush } from '../lib/push.ts'
```

- [ ] **Step 2: Escribir la prueba que falla (envíos con un `fetch` falso)**

En `scripts/prueba-logica.mjs`, reemplazar:

```js
/* El detector de impacto, contra series sintéticas. */
```

por:

```js
/* Push: enviarPush no sigue redirecciones ni devuelve lo que contesta el servicio. */
{
  // Con PUSH_DESACTIVADO=true, enviarPush vuelve antes del fetch y todo lo de abajo pasaría sin probar nada.
  delete process.env.PUSH_DESACTIVADO

  // Las claves del vector del RFC 8291 de arriba: cifrarCarga necesita un punto P-256 de verdad.
  const suscripcion = (endpoint) => ({
    endpoint,
    p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
    auth: 'BTBZMqHH6r4Tts7J_aSIgg',
  })
  const aviso = { titulo: 'Acta Digital', cuerpo: 'Prueba de push', url: '/' }
  const fetchOriginal = globalThis.fetch

  try {
    let pedidosAlInvalido = 0
    globalThis.fetch = async () => {
      pedidosAlInvalido++
      return new Response(null, { status: 201 })
    }
    const invalido = await enviarPush(suscripcion('https://169.254.169.254/latest/meta-data'), aviso)
    verificar('enviarPush no le hace ningún pedido a un endpoint que no es de push', pedidosAlInvalido === 0, `pedidos: ${pedidosAlInvalido}`)
    verificar(
      'y devuelve estado 0 con el motivo',
      invalido.ok === false &&
        invalido.estado === 0 &&
        invalido.caducada === false &&
        invalido.motivo === 'La suscripción no apunta a un servicio de notificaciones conocido: no se le mandó nada.',
      JSON.stringify(invalido),
    )

    let llamadoRedireccion = false
    let redirectRedireccion = null
    globalThis.fetch = async (_url, init) => {
      llamadoRedireccion = true
      redirectRedireccion = init?.redirect ?? null
      return new Response(null, { status: 302, headers: { Location: 'http://169.254.169.254/latest/meta-data' } })
    }
    const redireccion = await enviarPush(suscripcion('https://fcm.googleapis.com/fcm/send/abc'), aviso)
    verificar('con una redirección, enviarPush llama al servicio con redirect manual', llamadoRedireccion && redirectRedireccion === 'manual', `redirect: ${String(redirectRedireccion)}`)
    verificar(
      'y no la sigue: devuelve el 302 con el motivo',
      redireccion.ok === false &&
        redireccion.estado === 302 &&
        redireccion.motivo === 'El servicio de notificaciones respondió con una redirección, que no se sigue.',
      JSON.stringify(redireccion),
    )

    let llamadoError = false
    let redirectError = null
    globalThis.fetch = async (_url, init) => {
      llamadoError = true
      redirectError = init?.redirect ?? null
      return new Response('secreto-interno', { status: 500 })
    }
    const error = await enviarPush(suscripcion('https://fcm.googleapis.com/fcm/send/abc'), aviso)
    verificar('con un 500, enviarPush llama al servicio con redirect manual', llamadoError && redirectError === 'manual', `redirect: ${String(redirectError)}`)
    verificar(
      'y devuelve el estado con un motivo de texto fijo',
      error.ok === false && error.estado === 500 && error.motivo === 'El servicio de notificaciones respondió 500.',
      JSON.stringify(error),
    )
    verificar('el motivo nunca trae el cuerpo de la respuesta del servicio', !String(error.motivo).includes('secreto-interno'), String(error.motivo))
  } finally {
    globalThis.fetch = fetchOriginal
  }
}

/* El detector de impacto, contra series sintéticas. */
```

- [ ] **Step 3: Correr la prueba y ver que falla**

```bash
npm run prueba
```

Esperado: código 1, estas siete líneas después de `  ok   endpoint de push rechazado: 42`, y al final `141/148 verificaciones pasaron` y `7 FALLARON`:

```
  FALLA enviarPush no le hace ningún pedido a un endpoint que no es de push pedidos: 1
  FALLA y devuelve estado 0 con el motivo {"ok":true,"estado":201,"motivo":null,"caducada":false}
  FALLA con una redirección, enviarPush llama al servicio con redirect manual redirect: null
  FALLA y no la sigue: devuelve el 302 con el motivo {"ok":false,"estado":302,"motivo":"El servicio de push respondió 302. ","caducada":false}
  FALLA con un 500, enviarPush llama al servicio con redirect manual redirect: null
  FALLA y devuelve el estado con un motivo de texto fijo {"ok":false,"estado":500,"motivo":"El servicio de push respondió 500. secreto-interno","caducada":false}
  FALLA el motivo nunca trae el cuerpo de la respuesta del servicio El servicio de push respondió 500. secreto-interno
```

(La última es la falla que importa: hoy el servicio, o lo que haya en esa URL, le habla a quien llama a la ruta.)

- [ ] **Step 4: Implementar en `enviarPush`**

En `lib/push.ts`, reemplazar:

```ts
  if (!pushActivo()) return { ok: false, estado: 0, motivo: 'Las notificaciones están desactivadas.', caducada: false }

  try {
    const carga = cifrarCarga(suscripcion, JSON.stringify(aviso))
    const res = await fetch(suscripcion.endpoint, {
      method: 'POST',
      headers: {
        Authorization: autorizacion(suscripcion.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '900',
        Urgency: 'high',
      },
      body: new Uint8Array(carga),
      signal: AbortSignal.timeout(10_000),
    })

    // 404 y 410 significan que el navegador dio de baja la suscripción.
    const caducada = res.status === 404 || res.status === 410
    if (res.ok) return { ok: true, estado: res.status, motivo: null, caducada: false }

    const detalle = await res.text().catch(() => '')
    return {
      ok: false,
      estado: res.status,
      motivo:
        res.status === 403
          ? 'El servicio de push rechazó la clave VAPID. Suele pasar cuando la clave del servidor cambió: las suscripciones viejas quedaron atadas a la anterior y hay que volver a suscribir los teléfonos.'
          : `El servicio de push respondió ${res.status}. ${detalle.slice(0, 200)}`,
      caducada,
    }
```

por:

```ts
  if (!pushActivo()) return { ok: false, estado: 0, motivo: 'Las notificaciones están desactivadas.', caducada: false }

  // Antes de firmar y de cualquier pedido: el alta valida el endpoint desde hace poco, y las
  // filas anteriores pueden apuntar a cualquier lado.
  if (!endpointPushValido(suscripcion.endpoint)) {
    return {
      ok: false,
      estado: 0,
      motivo: 'La suscripción no apunta a un servicio de notificaciones conocido: no se le mandó nada.',
      caducada: false,
    }
  }

  try {
    const carga = cifrarCarga(suscripcion, JSON.stringify(aviso))
    const res = await fetch(suscripcion.endpoint, {
      method: 'POST',
      headers: {
        Authorization: autorizacion(suscripcion.endpoint),
        'Content-Encoding': 'aes128gcm',
        'Content-Type': 'application/octet-stream',
        TTL: '900',
        Urgency: 'high',
      },
      body: new Uint8Array(carga),
      // Seguir una redirección mandaría el pedido a un destino que la lista de servicios no aprobó.
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })

    // El cuerpo no se lee: devolverlo convertía este envío en una forma de leer la red
    // interna. Se cancela para que la conexión no quede tomada hasta que la libere el recolector.
    await res.body?.cancel().catch(() => {})

    if (res.status >= 300 && res.status < 400) {
      return {
        ok: false,
        estado: res.status,
        motivo: 'El servicio de notificaciones respondió con una redirección, que no se sigue.',
        caducada: false,
      }
    }

    // 404 y 410 significan que el navegador dio de baja la suscripción.
    const caducada = res.status === 404 || res.status === 410
    if (res.ok) return { ok: true, estado: res.status, motivo: null, caducada: false }

    return {
      ok: false,
      estado: res.status,
      motivo:
        res.status === 403
          ? 'El servicio de push rechazó la clave VAPID. Suele pasar cuando la clave del servidor cambió: las suscripciones viejas quedaron atadas a la anterior y hay que volver a suscribir los teléfonos.'
          : `El servicio de notificaciones respondió ${res.status}.`,
      caducada,
    }
```

El `catch (err) { … }` que sigue queda igual.

- [ ] **Step 5: Correr la prueba y ver que pasa**

```bash
npm run prueba
```

Esperado: código 0, estas siete líneas después de `  ok   endpoint de push rechazado: 42`, y al final `148/148 verificaciones pasaron` y `Todo en orden.`:

```
  ok   enviarPush no le hace ningún pedido a un endpoint que no es de push
  ok   y devuelve estado 0 con el motivo
  ok   con una redirección, enviarPush llama al servicio con redirect manual
  ok   y no la sigue: devuelve el 302 con el motivo
  ok   con un 500, enviarPush llama al servicio con redirect manual
  ok   y devuelve el estado con un motivo de texto fijo
  ok   el motivo nunca trae el cuerpo de la respuesta del servicio
```

- [ ] **Step 6: Comprobar que no quedó ninguna lectura del cuerpo**

Buscar con la herramienta Grep en `lib/push.ts` el patrón `res\.text|res\.json|detalle`. Esperado: ninguna coincidencia.

- [ ] **Step 7: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`; `tsc --noEmit` sin salida; `148/148 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 8: Commit**

```bash
git add "lib/push.ts" "scripts/prueba-logica.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Mandar los avisos push sin seguir redirecciones ni devolver lo que contesta el servicio

enviarPush devolvía hasta 200 caracteres del cuerpo de la respuesta y seguía
redirecciones: con un endpoint propio, la prueba de notificaciones leía la red
interna desde afuera. Ahora comprueba el endpoint antes de firmar (hay filas
viejas que pueden apuntar a cualquier lado), manda con redirect manual y arma el
motivo sólo con textos fijos y el código de estado.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `POST /api/push/dispositivos` rechaza suscripciones que no son de Web Push

**Files:**
- Modify: `app/api/push/dispositivos/route.ts` — el import de `@/lib/push` (hoy línea 6) y el comienzo de `POST` (hoy líneas 11–21, desde el comentario `Alta o reactivación de una suscripción.` hasta el `if (!endpoint || !p256dh || !auth) { … }`). El `INSERT`, el `catch` y `DELETE` no cambian.

**Interfaces:**
- Consumes: `endpointPushValido(endpoint: unknown): endpoint is string` (tarea 1); `huellaVapid(): string` (existente).
- Produces (índice, «Contratos HTTP»): 400 `{ "error": <push.endpoint_invalido> }` o `{ "error": <push.claves_invalidas> }`; el resto sin cambios (201 `{ "ok": true }`). Textos:
  - `push.endpoint_invalido`: `La suscripción no apunta a un servicio de notificaciones conocido (Google, Mozilla, Apple o Microsoft): volvé a activar las notificaciones desde el teléfono.`
  - `push.claves_invalidas`: `Las claves de la suscripción no tienen el formato de Web Push: volvé a activar las notificaciones desde el teléfono.`

- [ ] **Step 1: Ver el comportamiento actual (antes de tocar la ruta)**

Esto muestra que las comprobaciones manuales del paso 4 distinguen el código de hoy del nuevo: hoy la ruta no valida ni el endpoint ni las claves. En una terminal (Git Bash):

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
npm run dev
```

Esperar `✓ Ready in …`. En otra terminal, las mismas tres órdenes del paso 4:

```bash
P='BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
A='BTBZMqHH6r4Tts7J_aSIgg'
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"http://169.254.169.254/\",\"p256dh\":\"$P\",\"auth\":\"$A\"}"
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/plan-f0\",\"p256dh\":\"abc\",\"auth\":\"$A\"}"
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/plan-f0\",\"p256dh\":\"$P\",\"auth\":\"A@A\"}"
```

Esperado con el código de hoy: ninguna de las tres da 400. Sin la base levantada, las tres responden 503 porque pasan la única validación que hay (los tres campos presentes), `leerSesion()` devuelve `null` sin consultar y recién `db()` falla:

```
{"error":"…","tipo":"configuracion","causa":"…","ayuda":"Revisá el estado del sistema en /api/salud"} 503
{"error":"…","tipo":"configuracion","causa":"…","ayuda":"Revisá el estado del sistema en /api/salud"} 503
{"error":"…","tipo":"configuracion","causa":"…","ayuda":"Revisá el estado del sistema en /api/salud"} 503
```

(`error` y `causa` dependen de por qué no hay base: falta `DATABASE_URL`, no hay Postgres escuchando, etc.) Con la base levantada, las tres responden `{"ok":true} 201`: la fila apuntando a `169.254.169.254` queda guardada. En ese caso, darlas de baja para no dejar suscripciones inválidas activas en la base de desarrollo (el `DELETE` no cambia en esta fase y no exige sesión):

```bash
curl -s -w ' %{http_code}\n' -X DELETE http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d '{"endpoint":"http://169.254.169.254/"}'
curl -s -w ' %{http_code}\n' -X DELETE http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d '{"endpoint":"https://fcm.googleapis.com/fcm/send/plan-f0"}'
```

Esperado: `{"ok":true} 200` dos veces. Cortar `npm run dev` con Ctrl+C.

- [ ] **Step 2: Implementar la validación**

En `app/api/push/dispositivos/route.ts`, reemplazar:

```ts
import { huellaVapid } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Alta o reactivación de una suscripción. Idempotente por endpoint. */
export async function POST(req: Request) {
  try {
    const sesion = await leerSesion()
    const cuerpo = await req.json().catch(() => ({}))
    const endpoint = typeof cuerpo?.endpoint === 'string' ? cuerpo.endpoint : ''
    const p256dh = typeof cuerpo?.p256dh === 'string' ? cuerpo.p256dh : ''
    const auth = typeof cuerpo?.auth === 'string' ? cuerpo.auth : ''
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'La suscripción llegó incompleta.' }, { status: 400 })
    }
```

por:

```ts
import { endpointPushValido, huellaVapid } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * true si el texto es base64url (con o sin relleno) y decodifica a exactamente `bytes` bytes.
 * Buffer.from ignora los caracteres que no entiende, así que sin la expresión regular una
 * clave con basura adentro pasaría con el largo justo.
 */
function claveWebPush(texto: string, bytes: number): boolean {
  if (!/^[A-Za-z0-9_-]+={0,2}$/.test(texto)) return false
  return Buffer.from(texto, 'base64url').length === bytes
}

/**
 * Alta o reactivación de una suscripción. Idempotente por endpoint.
 *
 * Sigue sin exigir sesión, a propósito: los teléfonos sin cuenta también van a necesitar
 * avisos. Con el destino restringido a servicios de push, una suscripción sólo le permite
 * al servidor mandar avisos cifrados a ese navegador, y exigir sesión no protegería nada
 * más y rompería el circuito anónimo.
 */
export async function POST(req: Request) {
  try {
    const sesion = await leerSesion()
    const cuerpo = await req.json().catch(() => ({}))
    const endpoint = typeof cuerpo?.endpoint === 'string' ? cuerpo.endpoint : ''
    const p256dh = typeof cuerpo?.p256dh === 'string' ? cuerpo.p256dh : ''
    const auth = typeof cuerpo?.auth === 'string' ? cuerpo.auth : ''
    if (!endpoint || !p256dh || !auth) {
      return NextResponse.json({ error: 'La suscripción llegó incompleta.' }, { status: 400 })
    }
    if (!endpointPushValido(endpoint)) {
      return NextResponse.json(
        { error: 'La suscripción no apunta a un servicio de notificaciones conocido (Google, Mozilla, Apple o Microsoft): volvé a activar las notificaciones desde el teléfono.' },
        { status: 400 },
      )
    }
    // p256dh es un punto P-256 sin comprimir (65 bytes) y auth un secreto de 16: con otro
    // largo, cifrarCarga tira recién al mandar el primer aviso.
    if (!claveWebPush(p256dh, 65) || !claveWebPush(auth, 16)) {
      return NextResponse.json(
        { error: 'Las claves de la suscripción no tienen el formato de Web Push: volvé a activar las notificaciones desde el teléfono.' },
        { status: 400 },
      )
    }
```

- [ ] **Step 3: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.` (la ruta sigue con `runtime`, `dynamic` y `errorApi(`); `tsc --noEmit` sin salida; `148/148 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 4: Comprobación manual contra el servidor de desarrollo**

Las mismas órdenes del paso 1, ahora con la validación. Las dos respuestas 400 salen antes de tocar la base: sin cookie, `leerSesion()` devuelve `null` sin consultar, así que esto funciona aunque Postgres no esté levantado. En una terminal (Git Bash):

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
npm run dev
```

Esperar `✓ Ready in …`. En otra terminal:

```bash
P='BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
A='BTBZMqHH6r4Tts7J_aSIgg'
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"http://169.254.169.254/\",\"p256dh\":\"$P\",\"auth\":\"$A\"}"
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/plan-f0\",\"p256dh\":\"abc\",\"auth\":\"$A\"}"
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/plan-f0\",\"p256dh\":\"$P\",\"auth\":\"A@A\"}"
```

Esperado, en ese orden (en el paso 1 las tres daban 503 o 201):

```
{"error":"La suscripción no apunta a un servicio de notificaciones conocido (Google, Mozilla, Apple o Microsoft): volvé a activar las notificaciones desde el teléfono."} 400
{"error":"Las claves de la suscripción no tienen el formato de Web Push: volvé a activar las notificaciones desde el teléfono."} 400
{"error":"Las claves de la suscripción no tienen el formato de Web Push: volvé a activar las notificaciones desde el teléfono."} 400
```

Con la base levantada, además:

```bash
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"https://fcm.googleapis.com/fcm/send/plan-f0\",\"p256dh\":\"$P\",\"auth\":\"$A\"}"
```

Esperado: `{"ok":true} 201` (sin base: 503 con `tipo: 'configuracion'`, que es el comportamiento de siempre). Cortar `npm run dev` con Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add "app/api/push/dispositivos/route.ts"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Rechazar en el alta las suscripciones que no son de Web Push

El alta de dispositivos aceptaba cualquier URL como endpoint y cualquier texto
como clave. Ahora devuelve 400 si el endpoint no es de un servicio de push
conocido o si p256dh y auth no decodifican a 65 y 16 bytes. Sigue sin exigir
sesión: con el destino restringido no protegería nada más y rompería el circuito
anónimo que van a necesitar los teléfonos sin cuenta.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `POST /api/push/prueba` sólo a servicios conocidos y, si es de una cuenta, con su sesión

**Files:**
- Modify: `app/api/push/prueba/route.ts` — los imports (hoy líneas 1–5), el comentario de `POST` y el comienzo del handler (hoy líneas 10–31, desde el `/**` de la línea 10, cuya primera línea de texto es `Manda un aviso de prueba a una suscripción.`, hasta la llamada `const resultado = await enviarPush(res.rows[0], {` de la línea 31). El resto (`titulo`, `cuerpo`, `url`, la baja por caducada, el `return` y el `catch`) no cambia.

**Interfaces:**
- Consumes: `endpointPushValido` (tarea 1); `enviarPush` con el comportamiento de la tarea 2; `ErrorAcceso(estado: 401 | 403, mensaje: string)` y `leerSesion(): Promise<Sesion | null>` (`lib/sesion.ts`, existentes); `errorApi` traduce `ErrorAcceso` a `{ error, tipo: 'acceso' }` con su estado (`lib/api.ts:24-26`).
- Produces (índice, «Contratos HTTP»): 400 `{ "error": <push.endpoint_invalido> }`; 404 sin cambios; 403 `{ "error": <push.suscripcion_ajena>, "tipo": "acceso" }`; 200 o 502 `{ "ok", "estado", "motivo", "caducada" }` con `motivo` de texto fijo. Texto `push.suscripcion_ajena`: `Esta suscripción es de otra cuenta: entrá con esa cuenta para mandarle un aviso de prueba.`

- [ ] **Step 1: Ver el comportamiento actual (antes de tocar la ruta)**

Esto muestra que la comprobación del paso 4 distingue el código de hoy del nuevo: hoy la ruta no valida el endpoint y va directo a la base. En una terminal (Git Bash):

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
npm run dev
```

Esperar `✓ Ready in …`. En otra terminal, la misma orden del paso 4:

```bash
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/prueba -H 'Content-Type: application/json' \
  -d '{"endpoint":"https://169.254.169.254/latest/meta-data"}'
```

Esperado con el código de hoy: no da 400. Sin la base levantada, `db()` falla y responde:

```
{"error":"…","tipo":"configuracion","causa":"…","ayuda":"Revisá el estado del sistema en /api/salud"} 503
```

(`error` y `causa` dependen de por qué no hay base.) Con la base levantada, como ese endpoint no está suscripto:

```
{"error":"Este teléfono no está suscripto en el servidor."} 404
```

Cortar `npm run dev` con Ctrl+C.

- [ ] **Step 2: Implementar la validación y la autorización**

En `app/api/push/prueba/route.ts`, reemplazar:

```ts
import { enviarPush } from '@/lib/push'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Manda un aviso de prueba a una suscripción.
 *
 * Sin esto, un push que no llega no se distingue de un permiso denegado, de una clave
 * VAPID cambiada, de un endpoint caducado o de un navegador que no lo soporta. Con esto,
 * la respuesta dice cuál de las cinco cosas pasó.
 */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const endpoint = typeof cuerpo?.endpoint === 'string' ? cuerpo.endpoint : ''
    if (!endpoint) return NextResponse.json({ error: 'Falta la suscripción.' }, { status: 400 })

    const pg = await db()
    const res = await pg.query('SELECT endpoint, p256dh, auth FROM dispositivos WHERE endpoint_sha256 = $1 AND activo', [
      sha256(endpoint),
    ])
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Este teléfono no está suscripto en el servidor.' }, { status: 404 })
    }

    const resultado = await enviarPush(res.rows[0], {
```

por:

```ts
import { enviarPush, endpointPushValido } from '@/lib/push'
import { ErrorAcceso, leerSesion } from '@/lib/sesion'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Manda un aviso de prueba a una suscripción.
 *
 * Sin esto, un push que no llega no se distingue de un permiso denegado, de una clave
 * VAPID cambiada, de un endpoint caducado o de un navegador que no lo soporta. Con esto,
 * la respuesta dice cuál de las cinco cosas pasó.
 *
 * Si la suscripción es de una cuenta, exige la sesión de esa cuenta. El texto del aviso es
 * fijo, el destino está restringido a servicios de push y el cuerpo del servicio no se
 * devuelve: lo único que queda es molestar a un endpoint conocido, y eso se cierra para las
 * cuentas. Las suscripciones anónimas siguen sin sesión, como el alta.
 */
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const endpoint = typeof cuerpo?.endpoint === 'string' ? cuerpo.endpoint : ''
    if (!endpoint) return NextResponse.json({ error: 'Falta la suscripción.' }, { status: 400 })
    if (!endpointPushValido(endpoint)) {
      return NextResponse.json(
        { error: 'La suscripción no apunta a un servicio de notificaciones conocido (Google, Mozilla, Apple o Microsoft): volvé a activar las notificaciones desde el teléfono.' },
        { status: 400 },
      )
    }

    const pg = await db()
    const res = await pg.query(
      'SELECT endpoint, p256dh, auth, usuario_id FROM dispositivos WHERE endpoint_sha256 = $1 AND activo',
      [sha256(endpoint)],
    )
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Este teléfono no está suscripto en el servidor.' }, { status: 404 })
    }
    const fila = res.rows[0]

    if (fila.usuario_id) {
      const sesion = await leerSesion()
      if (sesion?.usuario_id !== fila.usuario_id) {
        throw new ErrorAcceso(403, 'Esta suscripción es de otra cuenta: entrá con esa cuenta para mandarle un aviso de prueba.')
      }
    }

    const resultado = await enviarPush({ endpoint: fila.endpoint, p256dh: fila.p256dh, auth: fila.auth }, {
```

(Se le pasa a `enviarPush` un objeto con las tres propiedades de `Suscripcion` y no la fila entera: `usuario_id` no tiene nada que hacer en el cifrado.)

- [ ] **Step 3: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`; `tsc --noEmit` sin salida; `148/148 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 4: Comprobación manual del 400 (sin base)**

Arrancar de nuevo el servidor de desarrollo y esperar `✓ Ready in …`:

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
npm run dev
```

En otra terminal, la misma orden del paso 1:

```bash
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/prueba -H 'Content-Type: application/json' \
  -d '{"endpoint":"https://169.254.169.254/latest/meta-data"}'
```

Esperado, con o sin base (en el paso 1 daba 503 o 404):

```
{"error":"La suscripción no apunta a un servicio de notificaciones conocido (Google, Mozilla, Apple o Microsoft): volvé a activar las notificaciones desde el teléfono."} 400
```

- [ ] **Step 5: Comprobación manual del 403 y del 502 sin eco (con base)**

Necesita la base levantada y `COOKIE_INSEGURA=true` para que `curl` mande la cookie de sesión por http. Cortar el `npm run dev` anterior y arrancar:

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
COOKIE_INSEGURA=true npm run dev
```

En otra terminal (el DNI `30111222` es de prueba; si ya existe, la primera orden da 400 y se sigue igual):

```bash
P='BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4'
A='BTBZMqHH6r4Tts7J_aSIgg'
E="https://fcm.googleapis.com/fcm/send/plan-f0-$(date +%s)"
FRASCO="$(mktemp)"
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/usuarios -H 'Content-Type: application/json' \
  -d '{"dni":"30111222","clave":"prueba plan f0"}'
curl -s -c "$FRASCO" -w ' %{http_code}\n' -X POST http://localhost:3000/api/sesion -H 'Content-Type: application/json' \
  -d '{"dni":"30111222","clave":"prueba plan f0"}'
curl -s -b "$FRASCO" -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/dispositivos -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"$E\",\"p256dh\":\"$P\",\"auth\":\"$A\"}"
curl -s -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/prueba -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"$E\"}"
curl -s -b "$FRASCO" -w ' %{http_code}\n' -X POST http://localhost:3000/api/push/prueba -H 'Content-Type: application/json' \
  -d "{\"endpoint\":\"$E\"}"
```

Esperado:

1. Registro: `{"ok":true,"id":"USR-…"} 201` (o 400 si el DNI ya existía).
2. Ingreso: `{"ok":true,"usuario":{…}} 200`.
3. Alta con sesión: `{"ok":true} 201` (la fila queda con `usuario_id`).
4. Prueba sin cookie: `{"error":"Esta suscripción es de otra cuenta: entrá con esa cuenta para mandarle un aviso de prueba.","tipo":"acceso"} 403`.
5. Prueba con la cookie de esa cuenta: `502` con `{"ok":false,"estado":<código>,"motivo":…,"caducada":…}`, donde `motivo` es exactamente uno de los textos fijos (`El servicio de notificaciones respondió <código>.`, el del 403 de la clave VAPID, o el mensaje de red con `estado: 0` si la máquina no tiene salida a internet) y **no** contiene nada de lo que contestó FCM (ni `UNREGISTERED`, ni `<HTML>`, ni JSON del servicio).

Cortar `npm run dev` con Ctrl+C y borrar el frasco: `rm -f "$FRASCO"`.

- [ ] **Step 6: Commit**

```bash
git add "app/api/push/prueba/route.ts"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Cerrar el SSRF de la prueba de notificaciones

La prueba de notificaciones le hacía un POST a la URL que se hubiera registrado y
devolvía lo que contestaba. Ahora rechaza con 400 un endpoint que no es de un
servicio de push y, si la suscripción es de una cuenta, exige la sesión de esa
cuenta (403 con ErrorAcceso). Con el destino restringido y sin el cuerpo del
servicio en la respuesta, lo único que quedaba era molestar a un endpoint
conocido, y eso queda cerrado para las cuentas.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verificación de la fase

Automática, desde la raíz:

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
npm run contrato && npm run tipos && npm run prueba
git log --oneline -4
git status --short
```

Esperado:

- `El contrato se cumple.`; `tsc --noEmit` sin salida; `148/148 verificaciones pasaron` y `Todo en orden.`, con las doce líneas de `endpoint de push …` y las siete de `enviarPush …` dentro de `[10] Impacto y notificaciones`.
- `git log --oneline -4` muestra, del más nuevo al más viejo: `Cerrar el SSRF de la prueba de notificaciones`, `Rechazar en el alta las suscripciones que no son de Web Push`, `Mandar los avisos push sin seguir redirecciones ni devolver lo que contesta el servicio`, `Decidir si un endpoint es de un servicio de push antes de mandarle nada`.
- `git status --short` no muestra `lib/`, `app/` ni `scripts/` modificados (a lo sumo `?? docs/superpowers/plans/`).

Revisión con Grep (herramienta Grep, no recursiva en `node_modules`):

- `lib/push.ts`, patrón `res\.text|detalle\.slice`: ninguna coincidencia.
- `lib/push.ts`, patrón `redirect: 'manual'`: una coincidencia.
- `app/api/push`, patrón `endpointPushValido`: dos archivos (`dispositivos/route.ts` y `prueba/route.ts`).

Manual («Se puede probar» de F0 en el índice; §6.5 del diseño no tiene filas para F0): con `npm run dev`, `POST /api/push/dispositivos` con `{"endpoint":"http://169.254.169.254/", …}` → 400 con el texto `push.endpoint_invalido` (tarea 3, paso 4; antes del cambio, 503 o 201 en el paso 1); `POST /api/push/prueba` con un endpoint fuera de la lista → 400 (tarea 4, paso 4; antes del cambio, 503 o 404 en el paso 1); con base, la suscripción de una cuenta sin su sesión → 403 `tipo: 'acceso'` y con su sesión → 502 con `motivo` de texto fijo (tarea 4, paso 5).

## Desvíos respecto del índice

Ninguno.
