# F1 — Servidor compatible — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el servidor listo para el modo viaje sin romper lo que ya anda: cuerpos leídos con tope, límite de pedidos por teléfono e IP, huella del teléfono sobre la cookie de posesión, esquema nuevo, transporte que valida reconstruyendo, alertas con fusión de respuestas y las rutas de §5.3 (salvo el vínculo de `POST /api/casos`, que es de F5), mientras `app/components/DetectorImpacto.tsx` sigue registrando y respondiendo contra el servidor nuevo.

**Architecture:** Piezas de servidor chicas y que se prueban en Node: `lib/api.ts` lee el cuerpo con tope y traduce `ErrorCuerpo`, `ErrorLimite` y `ErrorTransporte`; `lib/limite.ts` es una ventana deslizante en memoria; `lib/posesion.ts` suma una huella por propósito sobre la cookie `acta_posesion`; `lib/transporte-viaje.ts` tiene el formato compacto y la validación que reconstruye (lo va a usar también el motor del teléfono); `lib/telemetria.ts` concentra acceso, fusión y SQL. Las rutas quedan finas: huella → sesión → límite → cuerpo → validación → `lib/telemetria.ts` → respuesta, y terminan en `errorApi`. El veredicto del servidor en esta fase es provisorio (`analizarImpacto` sobre la serie); F2 lo cambia por `evaluarEpisodio`.

**Tech Stack:** Next.js 16.3 (route handlers, `cookies()` de `next/headers`), TypeScript 7 (`tsc --noEmit`), Postgres con `pg` (`INSERT … ON CONFLICT` sobre índice parcial, `jsonb`, `jsonb_to_recordset`), Node 24 con `tsx` para las pruebas, `Request`, `ReadableStream` y `fetch` de Node.

**Spec:** `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md` (§0.4, §2.9, §5.1, §5.2, §5.3, §6.4) · Índice: `docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md` (F1; «Interfaces»; «Contratos HTTP»; «Esquema» y sus reglas de fusión; «Textos exactos › Servidor»; «Pruebas: convenciones»; «Riesgos de implementación conocidos» 1 a 16 y 39)

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

1. F0 está terminada: `git log --oneline` muestra sus commits sobre `modo-viaje-global` (los de `endpointPushValido` y las rutas de push).
2. `git branch --show-current` imprime `modo-viaje-global`.
3. `git status --short` no muestra cambios salvo `?? docs/superpowers/plans/`.
4. Las tres verificaciones están en verde: `npm run contrato && npm run tipos && npm run prueba` imprime `El contrato se cumple.`, `tsc` no imprime nada y la última línea es `Todo en orden.`.

**Leer antes de escribir código**

- `AGENTS.md`.
- El índice entero, y con atención: «Interfaces» (`lib/impacto.ts` en su parte F1, `lib/transporte-viaje.ts`, `lib/limite.ts`, `lib/api.ts`, `lib/posesion.ts`, `lib/hash.ts`, `lib/db.ts`, `lib/telemetria.ts`), «Contratos HTTP», «Esquema», «Textos exactos › Servidor», «Pruebas: convenciones» y los riesgos 1 a 16 y 39.
- El diseño: §0.4, §2.9, §5.1 a §5.3 y §6.4.
- Next, antes de tocar una ruta (nunca con una búsqueda recursiva dentro de `node_modules`): `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md` y `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/cookies.md` (`cookies().set()` sólo funciona en un route handler).
- Los archivos que esta fase toca o usa: `lib/hash.ts`, `lib/gestion.ts`, `lib/api.ts`, `lib/posesion.ts`, `lib/db.ts`, `lib/impacto.ts`, `lib/sesion.ts` (`leerSesion`, `ErrorAcceso`), `lib/claves.ts` (`hashToken`, `nuevoToken`), `app/api/telemetria/route.ts`, `app/api/telemetria/[id]/respuesta/route.ts`, `app/api/casos/route.ts`, `app/api/casos/[id]/route.ts`, `app/aviso/page.tsx`, `app/components/DetectorImpacto.tsx`, `scripts/prueba-logica.mjs`, `scripts/prueba-e2e.mjs`, `package.json`, `.env.example`, y `scripts/prueba-contrato.mjs` para saber qué exige a las rutas (`runtime`, `dynamic`, `errorApi(`) y a `lib/` (ningún nombre exportado dos veces).

**Cómo se corre cada cosa en esta fase**

- La sección [V1]: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs` desde la raíz (PowerShell: `$env:SECCION='V1'; npx tsx scripts/prueba-viaje.mjs`). En F1 es la única sección del archivo, así que imprime los totales del archivo entero; los totales de cada paso son exactos.
- Las tres verificaciones: `npm run contrato && npm run tipos && npm run prueba`. Los totales de `scripts/prueba-logica.mjs` dependen de lo que sumó F0: en ese archivo se mira que no haya ninguna línea `  FALLA` y que termine en `Todo en orden.`.
- **Servidor y base para el e2e** (Tareas 5, 9 y 11). El e2e nunca se apunta a la base del `.env`, que es compartida. Con Docker:

```bash
docker compose up -d db
# Terminal 1 (Git Bash), en la raíz. La variable de la línea pisa la del .env.
DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run dev
# Terminal 2, cuando http://localhost:3000/api/salud responde "ok": true:
E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e
```

- Si en la máquina no hay Docker ni otra base descartable, el paso del e2e no se corre: el informe de la tarea dice «e2e no corrido: sin base descartable» y se sigue con el resto. Nunca se da por pasado un e2e que no corrió.
- `npm run dev` reescribe `next-env.d.ts`: al cortar el servidor, `git checkout -- next-env.d.ts`, y nunca se lo agrega a un commit. La sección [2] del e2e necesita salida a internet (dirección y clima). Contra un servidor detrás de un proxy real, entre dos corridas seguidas se espera un minuto (índice, decisión del e2e).
- Cada commit agrega sólo los archivos que nombra su paso, con la plantilla de «Global Constraints».

---

### Task 1: `aJsonPuro` en `lib/hash.ts` y su uso en `hashEvento`, `registrarEvento` y `registrarGestion`

**Files:**
- Modify: `lib/hash.ts` — `function reservadoDe` (hoy líneas 19–22); después de `export function canonico` (termina hoy en la línea 44); `export function hashEvento` (hoy 46–56); dentro de `registrarEvento` (hoy 103–185): después de la guarda de la firma vieja, la línea `const sal = reservadoDe(opciones) …` con su `detalleFinal`, y el `JSON.stringify(opciones.reservado)` del INSERT de `eventos_reservados`.
- Modify: `lib/gestion.ts` — el import de `./hash` (línea 2) y `registrarGestion` (hoy 52–88).
- Test: `scripts/prueba-logica.mjs` — el import de `../lib/hash.ts` (línea 13) y, en el bloque bajo `/* ---------- 1. Serialización canónica y cadena ---------- */`, a continuación de `verificar('suprimir un eslabón rompe la validación', !validarCadena(truncada))` (hoy línea 284).

**Interfaces:**
- Consumes: `canonico(valor: unknown): string`, `sha256(dato: string | Buffer | Uint8Array): string`, `hashEvento(entrada: { caso_id: string; ts: string; tipo: string; detalle: unknown; hash_previo: string | null }): string` y `registrarEvento(casoId: string, tipo: string, detalle?: Record<string, unknown>, opciones?: OpcionesEvento): Promise<{ hash: string; id: number }>`, todos existentes en `lib/hash.ts`.
- Produces: `export function aJsonPuro(valor: unknown): unknown` (`valor === undefined ? null : JSON.parse(JSON.stringify(valor))`). `hashEvento`, `registrarEvento` y `registrarGestion` no cambian de firma: `hashEvento` hashea `canonico(aJsonPuro(entrada.detalle))`, `registrarEvento` calcula `puro` y `reservadoPuro` antes del compromiso, del hash y de los INSERT, y `registrarGestion` hashea y guarda `aJsonPuro(detalle)`. F5 (`abrirActuacionDesdeImpacto`) cuenta con que lo hasheado y lo guardado sean lo mismo.

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-logica.mjs`, reemplazá la línea 13:

```js
import { canonico, sha256, hashEvento, registrarEvento, VERSION_MANIFIESTO } from '../lib/hash.ts'
```

por:

```js
import { aJsonPuro, canonico, sha256, hashEvento, registrarEvento, VERSION_MANIFIESTO } from '../lib/hash.ts'
```

Y reemplazá estas dos líneas del bloque 1:

```js
const truncada = cadenaReal.slice(0, 2).concat(cadenaReal.slice(3))
verificar('suprimir un eslabón rompe la validación', !validarCadena(truncada))
```

por:

```js
const truncada = cadenaReal.slice(0, 2).concat(cadenaReal.slice(3))
verificar('suprimir un eslabón rompe la validación', !validarCadena(truncada))

/*
 * Lo que se hashea tiene que ser lo que se guarda. canonico() convierte un Date en {} y
 * JSON.stringify en texto, y un undefined entra al hash como null pero desaparece del JSON
 * guardado: el verificador recalcula sobre lo guardado y denuncia un eslabón intacto.
 */
{
  const baseFija = { caso_id: 'ADS-AAAAAA', ts: '2026-09-16T12:00:00.000Z', tipo: 'apertura_actuacion', hash_previo: null }
  const detalleFijo = { user_agent: 'prueba', origen: 'impacto', telemetria_id: 'TEL-AAAAAA', nivel: 'sospecha', pico_g: 6.5, ocurrido_en_telefono: '2026-09-16T11:59:30.000Z', desfase_reloj_ms: -120, lista: [1, 'a', null, true] }
  // Calculado con el código anterior a aJsonPuro: si cambia, cambió el hash de eslabones ya sellados.
  const HASH_FIJO = '7e35a94f980fc6b17e0cb60d1ca3ec08785acf412064fe234e32e6ff20f52b87'
  verificar(
    'un detalle que ya es JSON puro conserva su hash',
    hashEvento({ ...baseFija, detalle: detalleFijo }) === HASH_FIJO,
    hashEvento({ ...baseFija, detalle: detalleFijo }),
  )

  const conFecha = { a: new Date('2026-09-16T12:00:00.000Z'), b: undefined, c: 1 }
  verificar(
    'un detalle con Date y undefined se hashea igual que lo que queda guardado',
    hashEvento({ ...baseFija, detalle: conFecha }) === hashEvento({ ...baseFija, detalle: aJsonPuro(conFecha) }),
  )
  verificar(
    'y ese hash es el del JSON guardado, no el de canonico sobre el Date',
    hashEvento({ ...baseFija, detalle: conFecha }) === 'a5d1c2ec41050d6ba1d8a746e29dc3314f8793dadeb9615a1c814cd15c24420c',
    hashEvento({ ...baseFija, detalle: conFecha }),
  )
  verificar(
    'aJsonPuro pasa el Date a texto ISO y saca la clave undefined',
    JSON.stringify(aJsonPuro(conFecha)) === '{"a":"2026-09-16T12:00:00.000Z","c":1}',
    JSON.stringify(aJsonPuro(conFecha)),
  )
  verificar('aJsonPuro de undefined es null', aJsonPuro(undefined) === null)
}
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `npm run prueba`

Expected: el proceso termina con código 1 antes de imprimir ninguna verificación, con

```
SyntaxError: The requested module '../lib/hash.ts' does not provide an export named 'aJsonPuro'
```

- [ ] **Step 3: Implementar `aJsonPuro` y usarlo en `hashEvento`**

En `lib/hash.ts`, reemplazá:

```ts
/** ¿Este evento trae datos reservados? Un objeto vacío no cuenta. */
function reservadoDe(opciones: OpcionesEvento): boolean {
  return Boolean(opciones.reservado && Object.keys(opciones.reservado).length > 0)
}
```

por:

```ts
/** ¿Este evento trae datos reservados? Un objeto vacío no cuenta. */
function reservadoDe(reservado: unknown): boolean {
  return typeof reservado === 'object' && reservado !== null && Object.keys(reservado).length > 0
}
```

Después reemplazá la función `hashEvento` entera:

```ts
export function hashEvento(entrada: {
  caso_id: string
  ts: string
  tipo: string
  detalle: unknown
  hash_previo: string | null
}): string {
  return sha256(
    [entrada.hash_previo ?? 'GENESIS', entrada.caso_id, entrada.ts, entrada.tipo, canonico(entrada.detalle)].join('|'),
  )
}
```

por:

```ts
/**
 * El valor tal como queda guardado en una columna JSONB.
 *
 * canonico() y JSON.stringify() no ven lo mismo: un Date se hashea como {} y se guarda como
 * texto, y un undefined entra al hash como null y desaparece del JSON guardado. Con
 * cualquiera de los dos, el verificador recalcula sobre lo guardado, no le da el mismo hash y
 * denuncia como alterado un eslabón intacto, para siempre. Hashear y guardar esto hace que las
 * dos cosas coincidan. Con un detalle que ya es JSON puro no cambia ningún hash.
 */
export function aJsonPuro(valor: unknown): unknown {
  return valor === undefined ? null : JSON.parse(JSON.stringify(valor))
}

export function hashEvento(entrada: {
  caso_id: string
  ts: string
  tipo: string
  detalle: unknown
  hash_previo: string | null
}): string {
  return sha256(
    [entrada.hash_previo ?? 'GENESIS', entrada.caso_id, entrada.ts, entrada.tipo, canonico(aJsonPuro(entrada.detalle))].join('|'),
  )
}
```

- [ ] **Step 4: Usar sólo las copias puras dentro de `registrarEvento`**

En `lib/hash.ts`, dentro de `registrarEvento`, reemplazá:

```ts
      'registrarEvento cambió de firma: pasá { cliente } como cuarto argumento en vez del PoolClient suelto.',
    )
  }

  const pg = await db()
```

por:

```ts
      'registrarEvento cambió de firma: pasá { cliente } como cuarto argumento en vez del PoolClient suelto.',
    )
  }

  // Desde acá sólo se usan estas dos copias: lo que entra al compromiso y al hash es exactamente lo que se guarda.
  const puro = aJsonPuro(detalle) as Record<string, unknown>
  const reservadoPuro = aJsonPuro(opciones.reservado)

  const pg = await db()
```

Reemplazá:

```ts
    const sal = reservadoDe(opciones) ? randomBytes(16).toString('base64') : null
    const detalleFinal = sal
      ? { ...detalle, reservado_sha256: sha256(sal + '|' + canonico(opciones.reservado)) }
      : detalle
```

por:

```ts
    const sal = reservadoDe(reservadoPuro) ? randomBytes(16).toString('base64') : null
    const detalleFinal = sal
      ? { ...puro, reservado_sha256: sha256(sal + '|' + canonico(reservadoPuro)) }
      : puro
```

Y en el INSERT de `eventos_reservados`, reemplazá:

```ts
        res.rows[0].id,
        sal,
        JSON.stringify(opciones.reservado),
      ])
```

por:

```ts
        res.rows[0].id,
        sal,
        JSON.stringify(reservadoPuro),
      ])
```

- [ ] **Step 5: Hashear y guardar lo mismo en `registrarGestion`**

En `lib/gestion.ts`, reemplazá la línea 2:

```ts
import { canonico, sha256 } from './hash'
```

por:

```ts
import { aJsonPuro, canonico, sha256 } from './hash'
```

Reemplazá:

```ts
): Promise<string> {
  const pg = await db()
  const cliente = await pg.connect()
```

por:

```ts
): Promise<string> {
  // Lo mismo que registrarEvento: se hashea exactamente lo que queda guardado. Ver aJsonPuro.
  const puro = aJsonPuro(detalle)
  const pg = await db()
  const cliente = await pg.connect()
```

Reemplazá:

```ts
    const hash = sha256([ancla, casoId, ts, tipo, canonico(detalle)].join('|'))
```

por:

```ts
    const hash = sha256([ancla, casoId, ts, tipo, canonico(puro)].join('|'))
```

Y reemplazá:

```ts
      [casoId, ts, tipo, actor, JSON.stringify(detalle), previo.rows[0]?.hash ?? null, hash],
```

por:

```ts
      [casoId, ts, tipo, actor, JSON.stringify(puro), previo.rows[0]?.hash ?? null, hash],
```

- [ ] **Step 6: Correr la prueba y verla pasar**

Run: `npm run prueba`

Expected: entre las líneas de `[1] Serialización canónica y encadenado` aparecen

```
  ok   un detalle que ya es JSON puro conserva su hash
  ok   un detalle con Date y undefined se hashea igual que lo que queda guardado
  ok   y ese hash es el del JSON guardado, no el de canonico sobre el Date
  ok   aJsonPuro pasa el Date a texto ISO y saca la clave undefined
  ok   aJsonPuro de undefined es null
```

ninguna línea empieza con `  FALLA`, la última es `Todo en orden.` y el código de salida es 0. Si falla `un detalle que ya es JSON puro conserva su hash`, el cambio movió hashes de eslabones ya sellados: no se sigue hasta entender por qué.

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tsc --noEmit` sin salida y `Todo en orden.` como última línea.

- [ ] **Step 8: Commit**

```bash
git add "lib/hash.ts" "lib/gestion.ts" "scripts/prueba-logica.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Hashear el detalle tal como se guarda para que un Date no rompa la verificación

canonico() convierte un Date en {} y JSON.stringify lo guarda como texto; un undefined
entra al hash como null pero desaparece del JSON guardado. En los dos casos el verificador
recalcula sobre lo guardado y denuncia como alterado un eslabón intacto, para siempre.
aJsonPuro hace que registrarEvento (detalle y reservado), hashEvento y registrarGestion
hasheen exactamente lo que guardan. Un detalle que ya era JSON puro conserva su hash: lo
prueba un valor fijo calculado con el código anterior.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `ErrorCuerpo` y `leerCuerpoLimitado` en `lib/api.ts`, `scripts/prueba-viaje.mjs` con [V1] y el script `prueba`

**Files:**
- Modify: `lib/api.ts` — entre `import { ErrorAcceso } from './sesion'` (hoy línea 4) y el comentario `/** Respuesta de error uniforme.` (hoy línea 6); y dentro de `errorApi`, a continuación de la rama `if (err instanceof ErrorActuacionCerrada) { … }` (hoy líneas 28–30).
- Create: `scripts/prueba-viaje.mjs`.
- Modify: `package.json` — el script `"prueba"` (hoy línea 9).
- Test: `scripts/prueba-viaje.mjs`, sección `[V1] Servidor: cuerpo, límites, acceso, plan y transporte`.

**Interfaces:**
- Consumes: `errorApi(contexto: string, err: unknown, mensajeGenerico: string): NextResponse` (existente), `ErrorAcceso` de `lib/sesion.ts`, `ErrorActuacionCerrada` de `lib/hash.ts`.
- Produces:
  - `export class ErrorCuerpo extends Error { constructor(readonly estado: 400 | 413, mensaje: string) }`, que `errorApi` traduce a `{ error, tipo: 'cuerpo' }` con `status: err.estado`, después de `ErrorAcceso` y `ErrorActuacionCerrada` y antes de la base.
  - `export async function leerCuerpoLimitado(req: Request, maxBytes: number): Promise<unknown>`: 413 si `Content-Length` ya supera `maxBytes`; si no, lee `req.body` con `getReader()` y hace `reader.cancel()` y 413 apenas se pasa; 400 si no es UTF-8 (`TextDecoder` con `fatal: true`) o no es JSON; cuerpo ausente o de 0 bytes → `{}`. Textos `servidor.cuerpo_grande` (`El pedido supera los {kb} KB que acepta esta ruta: mandá menos datos por envío.` con `kb = Math.round(maxBytes / 1024)`), `servidor.cuerpo_no_utf8` y `servidor.cuerpo_no_json`. Lo usan las Tareas 9 y 11.
  - `scripts/prueba-viaje.mjs` con el arnés del índice (`verificar`, `SECCION`, `seccion`) y la sección `V1`, a la que las tareas siguientes suman bloques.

- [ ] **Step 1: Escribir la prueba que falla**

Creá `scripts/prueba-viaje.mjs` con este contenido completo. Es el arnés del índice; `rechazoDe` vive dentro de la sección para no ocupar un nombre global que otra fase pueda querer:

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

  /** Lo que rechazó la promesa, o null si resolvió. */
  const rechazoDe = async (promesa) => {
    try {
      await promesa
      return null
    } catch (err) {
      return err
    }
  }

  /* ---- leerCuerpoLimitado y ErrorCuerpo ---- */
  {
    const { leerCuerpoLimitado, ErrorCuerpo, errorApi } = await import('../lib/api.ts')
    const RUTA = 'http://prueba.local/api/telemetria'
    const pedido = (cuerpo, cabeceras = {}) =>
      new Request(RUTA, { method: 'POST', body: cuerpo, headers: cabeceras, duplex: 'half' })

    verificar(
      'un pedido sin cuerpo se lee como {}',
      JSON.stringify(await leerCuerpoLimitado(new Request(RUTA, { method: 'POST' }), 2048)) === '{}',
    )
    verificar('un cuerpo de 0 bytes se lee como {}', JSON.stringify(await leerCuerpoLimitado(pedido(''), 2048)) === '{}')
    const leido = await leerCuerpoLimitado(pedido('{"respuesta":"estoy_bien"}'), 2048)
    verificar('un JSON dentro del tope se lee entero', leido?.respuesta === 'estoy_bien', JSON.stringify(leido))

    const porCabecera = await rechazoDe(leerCuerpoLimitado(pedido('{}', { 'content-length': '999999' }), 2048))
    verificar(
      'un Content-Length mayor que el tope da 413 sin leer el cuerpo',
      porCabecera instanceof ErrorCuerpo && porCabecera.estado === 413,
      String(porCabecera),
    )
    verificar(
      'el 413 dice cuántos KB acepta la ruta',
      porCabecera?.message === 'El pedido supera los 2 KB que acepta esta ruta: mandá menos datos por envío.',
      porCabecera?.message,
    )

    let entregados = 0
    let cancelado = false
    const sinFin = new ReadableStream({
      pull(control) {
        entregados++
        control.enqueue(new Uint8Array(1024).fill(0x20))
      },
      cancel() {
        cancelado = true
      },
    })
    const porLectura = await rechazoDe(leerCuerpoLimitado(pedido(sinFin), 2048))
    verificar(
      'sin Content-Length corta al pasarse del tope con 413',
      porLectura instanceof ErrorCuerpo && porLectura.estado === 413,
      String(porLectura),
    )
    verificar(
      'y cancela la lectura en vez de seguir recibiendo',
      cancelado && entregados <= 4,
      `cancelado=${cancelado} entregados=${entregados}`,
    )

    const noUtf8 = await rechazoDe(leerCuerpoLimitado(pedido(new Uint8Array([0x7b, 0xff, 0x7d])), 2048))
    verificar(
      'bytes que no son UTF-8 dan 400 con qué arreglar',
      noUtf8 instanceof ErrorCuerpo && noUtf8.estado === 400 && noUtf8.message === 'El cuerpo del pedido no es texto UTF-8 válido: mandalo como texto JSON.',
      noUtf8?.message,
    )
    const noJson = await rechazoDe(leerCuerpoLimitado(pedido('esto no es json'), 2048))
    verificar(
      'un texto que no es JSON da 400 con qué arreglar',
      noJson instanceof ErrorCuerpo && noJson.estado === 400 && noJson.message === 'El cuerpo del pedido no es JSON válido: mandalo como texto JSON.',
      noJson?.message,
    )

    const res = errorApi('prueba', new ErrorCuerpo(413, 'El pedido supera los 128 KB que acepta esta ruta: mandá menos datos por envío.'), 'No se pudo.')
    const cuerpo = await res.json()
    verificar(
      'errorApi traduce ErrorCuerpo con su estado y tipo cuerpo',
      res.status === 413 && cuerpo.tipo === 'cuerpo' && cuerpo.error.includes('128 KB'),
      `${res.status} ${JSON.stringify(cuerpo)}`,
    )
  }
})

/* ---------- Resultado ---------- */
console.log(`\n${pruebas - fallos}/${pruebas} verificaciones pasaron`)
if (fallos > 0) {
  console.error(`${fallos} FALLARON`)
  process.exit(1)
}
console.log('Todo en orden.')
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: la salida tiene

```
  FALLA [V1] terminó sin excepciones TypeError: leerCuerpoLimitado is not a function
```

seguida de la pila, después `0/1 verificaciones pasaron` y `1 FALLARON`; el código de salida es 1.

- [ ] **Step 3: Implementar `ErrorCuerpo` y `leerCuerpoLimitado`**

En `lib/api.ts`, reemplazá:

```ts
import { ErrorAcceso } from './sesion'

/**
 * Respuesta de error uniforme.
```

por:

```ts
import { ErrorAcceso } from './sesion'

/** El cuerpo no se puede leer. errorApi lo traduce a { error: message, tipo: 'cuerpo' } con este estado. */
export class ErrorCuerpo extends Error {
  constructor(
    readonly estado: 400 | 413,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorCuerpo'
  }
}

/**
 * Lee el cuerpo JSON de un pedido sin pasarse de maxBytes.
 *
 * req.json() lee el cuerpo entero a memoria antes de que nadie mire su tamaño: un cliente en
 * bucle, o uno que manda una serie de sensores sin recortar, ocupa la memoria del proceso que
 * atiende a todos. Acá se corta apenas se pasa. Content-Length no alcanza solo, porque un
 * cuerpo por partes no lo trae, así que además se cuentan los bytes a medida que llegan.
 *
 * Un cuerpo ausente o vacío vale {}: el alta de una actuación se hace con un toque y sin cuerpo.
 */
export async function leerCuerpoLimitado(req: Request, maxBytes: number): Promise<unknown> {
  const demasiado = () =>
    new ErrorCuerpo(
      413,
      `El pedido supera los ${Math.round(maxBytes / 1024)} KB que acepta esta ruta: mandá menos datos por envío.`,
    )

  const declarado = req.headers.get('content-length')
  if (declarado !== null && Number(declarado) > maxBytes) throw demasiado()
  if (!req.body) return {}

  const lector = req.body.getReader()
  const partes: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await lector.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await lector.cancel().catch(() => {})
      throw demasiado()
    }
    partes.push(value)
  }
  if (total === 0) return {}

  const bytes = new Uint8Array(total)
  let desde = 0
  for (const parte of partes) {
    bytes.set(parte, desde)
    desde += parte.byteLength
  }

  let texto: string
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    throw new ErrorCuerpo(400, 'El cuerpo del pedido no es texto UTF-8 válido: mandalo como texto JSON.')
  }
  try {
    return JSON.parse(texto)
  } catch {
    throw new ErrorCuerpo(400, 'El cuerpo del pedido no es JSON válido: mandalo como texto JSON.')
  }
}

/**
 * Respuesta de error uniforme.
```

- [ ] **Step 4: Traducir `ErrorCuerpo` en `errorApi`**

En `lib/api.ts`, reemplazá:

```ts
  if (err instanceof ErrorActuacionCerrada) {
    return NextResponse.json({ error: err.message, tipo: 'cerrada' }, { status: 409 })
  }
```

por:

```ts
  if (err instanceof ErrorActuacionCerrada) {
    return NextResponse.json({ error: err.message, tipo: 'cerrada' }, { status: 409 })
  }

  /*
   * Un cuerpo ilegible o demasiado grande es un error del cliente: va como 4xx para que la cola
   * del teléfono no lo reintente igual para siempre, y sin log, porque no hay nada que arreglar
   * en el servidor.
   */
  if (err instanceof ErrorCuerpo) {
    return NextResponse.json({ error: err.message, tipo: 'cuerpo' }, { status: err.estado })
  }
```

- [ ] **Step 5: Correr la prueba y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
[V1] Servidor: cuerpo, límites, acceso, plan y transporte
  ok   un pedido sin cuerpo se lee como {}
  ok   un cuerpo de 0 bytes se lee como {}
  ok   un JSON dentro del tope se lee entero
  ok   un Content-Length mayor que el tope da 413 sin leer el cuerpo
  ok   el 413 dice cuántos KB acepta la ruta
  ok   sin Content-Length corta al pasarse del tope con 413
  ok   y cancela la lectura en vez de seguir recibiendo
  ok   bytes que no son UTF-8 dan 400 con qué arreglar
  ok   un texto que no es JSON da 400 con qué arreglar
  ok   errorApi traduce ErrorCuerpo con su estado y tipo cuerpo

10/10 verificaciones pasaron
Todo en orden.
```

- [ ] **Step 6: Encadenar las pruebas del modo viaje en `npm run prueba`**

En `package.json`, reemplazá:

```json
    "prueba": "tsx scripts/prueba-logica.mjs",
```

por:

```json
    "prueba": "tsx scripts/prueba-logica.mjs && tsx scripts/prueba-viaje.mjs",
```

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin ninguna línea `  FALLA` y con `Todo en orden.`; después `prueba-viaje.mjs` con `10/10 verificaciones pasaron` y `Todo en orden.` como última línea.

- [ ] **Step 8: Commit**

```bash
git add "lib/api.ts" "scripts/prueba-viaje.mjs" "package.json"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Leer los cuerpos con tope para que un cliente en bucle no ocupe la memoria del servidor

req.json() lee el cuerpo entero antes de que nadie mire su tamaño. leerCuerpoLimitado corta
con 413 apenas se pasa del máximo, aunque el pedido no traiga Content-Length, y contesta 400
con qué arreglar si no es UTF-8 o no es JSON. errorApi traduce ErrorCuerpo sin loguear: es un
error del cliente y no hay nada que arreglar en el servidor.

Las pruebas del modo viaje van a scripts/prueba-viaje.mjs, por secciones, y npm run prueba
las corre después de prueba-logica.mjs.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `lib/limite.ts` y la rama 429 de `errorApi`

**Files:**
- Create: `lib/limite.ts`.
- Modify: `lib/api.ts` — los imports (hoy líneas 3–4) y la rama `if (err instanceof ErrorCuerpo) { … }` que sumó la Tarea 2.
- Test: `scripts/prueba-viaje.mjs`, bloque nuevo al final de la sección [V1].

**Interfaces:**
- Consumes: `errorApi` y `ErrorCuerpo` de `lib/api.ts` (Tarea 2).
- Produces (firmas exactas del índice, «Interfaces › `lib/limite.ts`»):
  - `export type AmbitoLimite = 'telemetria' | 'conduccion' | 'altas'`
  - `export interface TopeLimite { porMinuto: number; porHora: number }`
  - `export const TOPES_LIMITE: Readonly<Record<AmbitoLimite, { huella: TopeLimite; ip: TopeLimite }>>` con telemetria 30/300 por huella y 120/2000 por IP, conduccion 10/120 y 60/1000, altas 10/60 y 30/300.
  - `export class ErrorLimite extends Error { constructor(readonly ambito: AmbitoLimite, readonly reintentarEnS: number) }` con el texto `servidor.limite_lecturas` o `servidor.limite_altas`.
  - `export function ipDelCliente(cabeceras: Headers, saltosConfiables?: number): string | null`
  - `export function limitar(ambito: AmbitoLimite, claves: { ip: string | null; huella: string | null }, ahoraMs?: number): void`
  - `export function reiniciarLimites(): void`
  - `errorApi` traduce `ErrorLimite` a 429 `{ error, tipo: 'limite', reintentar_en_s }` con cabecera `Retry-After`. Lo usan las rutas de las Tareas 9 y 11.

**Decisiones de esta tarea:** las ventanas viven en `globalThis.__actaLimites` (y la hora de la última poda en `globalThis.__actaLimitesPoda`) y no en una variable del módulo: en desarrollo cada ruta puede cargar su propia copia del módulo, y `POST /api/telemetria` y `POST /api/telemetria/[id]/respuesta` comparten el tope `telemetria`. Un pedido rechazado también se registra (el índice dice «registra el pedido y, si … pasa su tope, lanza»); para que un cliente en bucle no haga crecer la lista sin fin, cada clave guarda como mucho `2 · porHora` marcas, que alcanzan para calcular exacta la espera de la ventana de una hora.

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, reemplazá el final de la sección [V1]:

```js
  }
})

/* ---------- Resultado ---------- */
```

por el mismo final con el bloque nuevo adentro (una línea vacía antes del bloque):

```js
  }

  /* ---- limitar, ipDelCliente y ErrorLimite ---- */
  {
    const { limitar, reiniciarLimites, ipDelCliente, ErrorLimite, TOPES_LIMITE } = await import('../lib/limite.ts')
    const { errorApi } = await import('../lib/api.ts')
    const t0 = Date.UTC(2026, 8, 16, 17, 30)
    /** Llama limitar y devuelve el ErrorLimite que lanzó, o null. Cualquier otro error sube. */
    const probar = (ambito, claves, ahora) => {
      try {
        limitar(ambito, claves, ahora)
        return null
      } catch (err) {
        if (err instanceof ErrorLimite) return err
        throw err
      }
    }

    verificar(
      'los topes son los del diseño',
      TOPES_LIMITE.telemetria.huella.porMinuto === 30 && TOPES_LIMITE.telemetria.ip.porHora === 2000 && TOPES_LIMITE.altas.huella.porMinuto === 10,
      JSON.stringify(TOPES_LIMITE),
    )

    reiniciarLimites()
    let primerRechazo = -1
    let rechazo = null
    for (let i = 0; i < 31 && rechazo === null; i++) {
      rechazo = probar('telemetria', { ip: null, huella: 'h1' }, t0 + i * 100)
      if (rechazo) primerRechazo = i
    }
    verificar('la huella pasa 30 pedidos en un minuto y el 31 no', primerRechazo === 30, `primer rechazo en ${primerRechazo}`)
    verificar(
      'reintentarEnS espera a que salga la marca más vieja que sobra',
      rechazo?.reintentarEnS === 58,
      String(rechazo?.reintentarEnS),
    )
    verificar(
      'el mensaje dice cuánto esperar',
      rechazo?.message === 'Se mandaron demasiadas lecturas desde este teléfono. Esperá 58 segundos.',
      rechazo?.message,
    )
    verificar('otro teléfono no queda limitado', probar('telemetria', { ip: null, huella: 'h2' }, t0 + 3100) === null)
    verificar('un milisegundo antes de que salga esa marca sigue limitado', probar('telemetria', { ip: null, huella: 'h1' }, t0 + 60_099) !== null)
    reiniciarLimites()
    for (let i = 0; i < 31; i++) probar('telemetria', { ip: null, huella: 'h1' }, t0 + i * 100)
    verificar('cuando sale esa marca, el siguiente pasa', probar('telemetria', { ip: null, huella: 'h1' }, t0 + 60_100) === null)

    reiniciarLimites()
    let sinClaves = 0
    for (let i = 0; i < 500; i++) if (probar('telemetria', { ip: null, huella: null }, t0 + i) !== null) sinClaves++
    verificar('sin IP ni huella no se limita', sinClaves === 0, `rechazos=${sinClaves}`)

    reiniciarLimites()
    let porHora = null
    for (let i = 0; i < 121 && porHora === null; i++) porHora = probar('conduccion', { ip: null, huella: 'h3' }, t0 + i * 7000)
    verificar(
      'el tope por hora cuenta aparte del de minuto',
      porHora?.reintentarEnS === 2767,
      String(porHora?.reintentarEnS),
    )

    reiniciarLimites()
    let altas = null
    for (let i = 0; i < 31 && altas === null; i++) altas = probar('altas', { ip: '203.0.113.7', huella: null }, t0 + i * 10)
    verificar(
      'las altas se limitan por IP con su propio texto',
      altas?.ambito === 'altas' && altas.message.startsWith('Se abrieron demasiadas actuaciones desde este teléfono. Esperá '),
      altas?.message,
    )
    reiniciarLimites()
    verificar('reiniciarLimites vacía las ventanas', probar('altas', { ip: '203.0.113.7', huella: null }, t0 + 400) === null)

    const cabeceras = (xff) => new Headers(xff === null ? {} : { 'x-forwarded-for': xff })
    verificar('con un salto toma la última entrada', ipDelCliente(cabeceras('203.0.113.7'), 1) === '203.0.113.7')
    verificar(
      'el cliente no puede elegir su IP escribiendo delante de la del proxy',
      ipDelCliente(cabeceras('1.2.3.4, 203.0.113.7'), 1) === '203.0.113.7',
    )
    verificar('con dos saltos toma la anteúltima', ipDelCliente(cabeceras('198.51.100.1, 203.0.113.7'), 2) === '198.51.100.1')
    verificar('con menos entradas que saltos no hay IP', ipDelCliente(cabeceras('203.0.113.7'), 2) === null)
    verificar('con cero saltos no se limita por IP', ipDelCliente(cabeceras('203.0.113.7'), 0) === null)
    verificar('sin la cabecera no hay IP', ipDelCliente(cabeceras(null), 1) === null)
    verificar('una entrada que no es una IP no cuenta', ipDelCliente(cabeceras('<script>'), 1) === null)
    verificar('acepta la IPv6 del socket local', ipDelCliente(cabeceras('::ffff:127.0.0.1'), 1) === '::ffff:127.0.0.1')
    const saltosPrevios = process.env.PROXY_SALTOS_CONFIABLES
    process.env.PROXY_SALTOS_CONFIABLES = '2'
    verificar('por omisión cuenta PROXY_SALTOS_CONFIABLES', ipDelCliente(cabeceras('198.51.100.1, 203.0.113.7')) === '198.51.100.1')
    process.env.PROXY_SALTOS_CONFIABLES = 'dos'
    verificar('con PROXY_SALTOS_CONFIABLES inválido cuenta 1', ipDelCliente(cabeceras('198.51.100.1, 203.0.113.7')) === '203.0.113.7')
    if (saltosPrevios === undefined) delete process.env.PROXY_SALTOS_CONFIABLES
    else process.env.PROXY_SALTOS_CONFIABLES = saltosPrevios

    const res = errorApi('prueba', new ErrorLimite('telemetria', 37), 'No se pudo.')
    const cuerpo = await res.json()
    verificar(
      'errorApi traduce ErrorLimite a 429 con Retry-After',
      res.status === 429 && res.headers.get('retry-after') === '37' && cuerpo.tipo === 'limite' && cuerpo.reintentar_en_s === 37 && cuerpo.error === 'Se mandaron demasiadas lecturas desde este teléfono. Esperá 37 segundos.',
      `${res.status} ${res.headers.get('retry-after')} ${JSON.stringify(cuerpo)}`,
    )
    reiniciarLimites()
  }
})

/* ---------- Resultado ---------- */
```

Así se agrega cada bloque de [V1] en las tareas siguientes: siempre al final de la sección, antes de su `})`.

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: las 10 verificaciones de la Tarea 2 siguen en `ok` y después aparece

```
  FALLA [V1] terminó sin excepciones Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\lib\limite.ts' imported from C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\prueba-viaje.mjs
```

con `10/11 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: Crear `lib/limite.ts`**

```ts
/**
 * Limitador de pedidos en memoria, por IP y por teléfono.
 *
 * Se reinicia con cada despliegue y cada réplica cuenta por su lado: es una primera barrera y
 * protege contra un cliente propio en bucle (una cola que reintenta sin esperar, una pantalla
 * que se vuelve a montar), no contra un atacante decidido. Para eso hace falta un límite en el
 * proxy, delante de la aplicación.
 *
 * Las ventanas viven en globalThis y no en el módulo: en desarrollo cada recarga en caliente
 * evalúa el módulo de nuevo, y cada ruta puede cargar su propia copia. Con una variable del
 * módulo, POST /api/telemetria y su respuesta contarían por separado un tope que comparten.
 */

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
  constructor(
    readonly ambito: AmbitoLimite,
    readonly reintentarEnS: number,
  ) {
    super(
      ambito === 'altas'
        ? `Se abrieron demasiadas actuaciones desde este teléfono. Esperá ${reintentarEnS} segundos.`
        : `Se mandaron demasiadas lecturas desde este teléfono. Esperá ${reintentarEnS} segundos.`,
    )
    this.name = 'ErrorLimite'
  }
}

const MINUTO_MS = 60_000
const HORA_MS = 3_600_000
const IP_VALIDA = /^[0-9A-Fa-f:.]{2,45}$/

const almacen = globalThis as unknown as {
  __actaLimites?: Map<string, number[]>
  __actaLimitesPoda?: number
}

function ventanas(): Map<string, number[]> {
  if (!almacen.__actaLimites) almacen.__actaLimites = new Map()
  return almacen.__actaLimites
}

/** PROXY_SALTOS_CONFIABLES: entero ≥ 0; 1 si falta o no es un entero. */
function saltosDelEntorno(): number {
  const crudo = process.env.PROXY_SALTOS_CONFIABLES
  if (crudo === undefined || crudo.trim() === '') return 1
  const saltos = Number(crudo)
  return Number.isInteger(saltos) && saltos >= 0 ? saltos : 1
}

/**
 * IP del cliente desde x-forwarded-for, contando `saltosConfiables` desde el final: entradas separadas por coma,
 * sin espacios, ip = entradas[largo − saltos]. null si saltos < 1, si hay menos entradas que saltos o si la ip no
 * cumple /^[0-9A-Fa-f:.]{2,45}$/. Por omisión, saltos = PROXY_SALTOS_CONFIABLES (entero ≥ 0; 1 si falta o es inválido).
 * Next completa x-forwarded-for con la IP del socket si no vino, así que en local también se limita por IP (::1).
 */
export function ipDelCliente(cabeceras: Headers, saltosConfiables: number = saltosDelEntorno()): string | null {
  if (!Number.isInteger(saltosConfiables) || saltosConfiables < 1) return null
  const cabecera = cabeceras.get('x-forwarded-for')
  if (!cabecera) return null
  // Lo de la izquierda lo escribe el cliente; sólo las últimas entradas las agregó un proxy propio.
  const entradas = cabecera.split(',').map((entrada) => entrada.trim())
  if (entradas.length < saltosConfiables) return null
  const ip = entradas[entradas.length - saltosConfiables]
  return IP_VALIDA.test(ip) ? ip : null
}

/**
 * Segundos hasta que el próximo pedido entre en una ventana con `tope`, o 0 si no se pasó.
 * `marcas` está en orden y ya incluye el pedido actual.
 */
function esperaEnVentana(marcas: number[], ventanaMs: number, tope: number, ahoraMs: number): number {
  const enVentana = marcas.filter((t) => t > ahoraMs - ventanaMs)
  if (enVentana.length <= tope) return 0
  // Para que el siguiente entre, tienen que salir las marcas que sobran: la última de ésas decide.
  const decisiva = enVentana[enVentana.length - tope]
  return Math.max(1, Math.ceil((decisiva + ventanaMs - ahoraMs) / 1000))
}

/**
 * Ventana deslizante en memoria por clave `${ambito}:ip:${ip}` y `${ambito}:huella:${huella}` (una clave null no
 * limita). Registra el pedido y, si cualquiera de las dos claves pasa su tope por minuto o por hora, lanza
 * ErrorLimite con reintentarEnS = segundos hasta que salga de la ventana la marca más vieja que hace falta
 * (entero ≥ 1). Poda las claves sin marcas de la última hora. Se reinicia con cada despliegue: es una primera
 * barrera y protege contra un cliente propio en bucle, no contra un atacante decidido.
 */
export function limitar(ambito: AmbitoLimite, claves: { ip: string | null; huella: string | null }, ahoraMs: number = Date.now()): void {
  const mapa = ventanas()
  if (ahoraMs - (almacen.__actaLimitesPoda ?? 0) > MINUTO_MS) {
    almacen.__actaLimitesPoda = ahoraMs
    for (const [clave, marcas] of mapa) {
      if (marcas.length === 0 || marcas[marcas.length - 1] <= ahoraMs - HORA_MS) mapa.delete(clave)
    }
  }

  let espera = 0
  const candidatas: Array<[string | null, TopeLimite]> = [
    [claves.ip === null ? null : `${ambito}:ip:${claves.ip}`, TOPES_LIMITE[ambito].ip],
    [claves.huella === null ? null : `${ambito}:huella:${claves.huella}`, TOPES_LIMITE[ambito].huella],
  ]
  for (const [clave, tope] of candidatas) {
    if (clave === null) continue
    const previas = mapa.get(clave) ?? []
    const marcas = previas.filter((t) => t > ahoraMs - HORA_MS)
    marcas.push(ahoraMs)
    marcas.sort((a, b) => a - b)
    /*
     * Los pedidos rechazados también cuentan, así que un cliente que no espera sigue afuera. El
     * techo de marcas guardadas es el doble del tope por hora: alcanza para calcular la espera
     * exacta de la ventana de una hora, y sin él un cliente en bucle haría crecer la lista sin fin.
     */
    mapa.set(clave, marcas.slice(-2 * tope.porHora))
    espera = Math.max(
      espera,
      esperaEnVentana(marcas, MINUTO_MS, tope.porMinuto, ahoraMs),
      esperaEnVentana(marcas, HORA_MS, tope.porHora, ahoraMs),
    )
  }
  if (espera > 0) throw new ErrorLimite(ambito, espera)
}

/** Vacía todas las ventanas. Sólo para las pruebas. */
export function reiniciarLimites(): void {
  ventanas().clear()
  almacen.__actaLimitesPoda = 0
}
```

- [ ] **Step 4: Correr la prueba y ver que falta sólo la traducción**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: todas las verificaciones del bloque nuevo en `ok` salvo la última. `errorApi` todavía no conoce `ErrorLimite`: lo loguea como error interno (una línea que empieza con `[prueba] ErrorLimite: Se mandaron demasiadas lecturas desde este teléfono. Esperá 37 segundos.`, seguida de su pila) y contesta 500, así que aparece

```
  FALLA errorApi traduce ErrorLimite a 429 con Retry-After 500 null {"error":"No se pudo.","tipo":"interno"}
```

con `31/32 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 5: Traducir `ErrorLimite` en `errorApi`**

En `lib/api.ts`, reemplazá:

```ts
import { ErrorActuacionCerrada } from './hash'
import { ErrorAcceso } from './sesion'
```

por:

```ts
import { ErrorActuacionCerrada } from './hash'
import { ErrorLimite } from './limite'
import { ErrorAcceso } from './sesion'
```

Y reemplazá:

```ts
  if (err instanceof ErrorCuerpo) {
    return NextResponse.json({ error: err.message, tipo: 'cuerpo' }, { status: err.estado })
  }
```

por:

```ts
  if (err instanceof ErrorCuerpo) {
    return NextResponse.json({ error: err.message, tipo: 'cuerpo' }, { status: err.estado })
  }

  // Retry-After es lo que lee la cola del teléfono para no volver a pedir antes de tiempo.
  if (err instanceof ErrorLimite) {
    return NextResponse.json(
      { error: err.message, tipo: 'limite', reintentar_en_s: err.reintentarEnS },
      { status: 429, headers: { 'Retry-After': String(err.reintentarEnS) } },
    )
  }
```

- [ ] **Step 6: Correr la prueba y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras,

```
  ok   la huella pasa 30 pedidos en un minuto y el 31 no
  ok   reintentarEnS espera a que salga la marca más vieja que sobra
  ok   el tope por hora cuenta aparte del de minuto
  ok   el cliente no puede elegir su IP escribiendo delante de la del proxy
  ok   errorApi traduce ErrorLimite a 429 con Retry-After
```

y al final `32/32 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `32/32 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 8: Commit**

```bash
git add "lib/limite.ts" "lib/api.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Limitar las lecturas por teléfono para que un cliente en bucle no tumbe la base

El limitador vive en memoria y se reinicia con cada despliegue: es una primera
barrera y protege contra un cliente propio en bucle, no contra un atacante decidido.
Cuenta por teléfono y por IP, con la IP tomada de x-forwarded-for contando desde el final
los proxies propios, para que el cliente no pueda elegirla. errorApi lo traduce a 429 con
Retry-After, que es lo que la cola del teléfono lee para esperar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: `huellaDispositivo` en `lib/posesion.ts` y el comentario de la cookie

**Files:**
- Modify: `lib/posesion.ts` — encima de `export const COOKIE_POSESION = 'acta_posesion'` (hoy línea 25) y a continuación de la función `tokenDePosesion` (hoy líneas 30–46).
- Test: `scripts/prueba-viaje.mjs`, bloque nuevo al final de [V1].

**Interfaces:**
- Consumes: `tokenDePosesion(crear: boolean): Promise<string | null>` (existente, sin exportar, en `lib/posesion.ts`) y `hashToken(token: string): string` de `lib/claves.ts`.
- Produces: `export type PropositoHuella = 'telemetria' | 'conduccion'` y `export async function huellaDispositivo(proposito: PropositoHuella, crear: boolean): Promise<string | null>` = `hashToken(proposito + ':' + token)` sobre la cookie `acta_posesion`; con `crear`, emite la cookie si falta (sólo desde un route handler); `null` si no hay cookie y `crear` es `false`. La usan las Tareas 9 y 11, y F5 (`QuienPide.huella`).

**Qué se puede probar en Node y qué no:** `cookies()` de Next sólo existe dentro de un pedido; fuera de uno lanza «`cookies` was called outside a request scope». [V1] prueba que la huella sale de ahí (ni de una cabecera ni de algo que mande el cliente); la creación de la cookie y que un teléfono ajeno no lea lo que no es suyo los prueban `[10b]` y `[10d]` del e2e en la Tarea 9.

- [ ] **Step 1: Escribir la prueba que falla**

En `scripts/prueba-viaje.mjs`, agregá al final de la sección [V1] (antes de su `})`, con una línea vacía antes, como en la Tarea 3):

```js
  /* ---- huellaDispositivo ---- */
  {
    const { huellaDispositivo } = await import('../lib/posesion.ts')
    verificar('huellaDispositivo existe', typeof huellaDispositivo === 'function')
    /*
     * La cookie sólo existe dentro de un pedido: fuera de uno, cookies() de Next falla. Que falle
     * acá prueba que la huella sale de la cookie de posesión y no de una cabecera ni de un dato
     * que mande el cliente. Lo demás (crear la cookie, un teléfono ajeno) lo prueba el e2e [10b] y [10d].
     */
    const fuera = await rechazoDe(Promise.resolve().then(() => huellaDispositivo('telemetria', false)))
    verificar(
      'la huella sale de la cookie de posesión, que sólo existe dentro de un pedido',
      String(fuera?.message ?? '').includes('`cookies` was called outside a request scope'),
      String(fuera?.message),
    )
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
  FALLA huellaDispositivo existe 
  FALLA la huella sale de la cookie de posesión, que sólo existe dentro de un pedido huellaDispositivo is not a function
```

con `32/34 verificaciones pasaron` y `2 FALLARON`.

- [ ] **Step 3: Implementar `huellaDispositivo` y documentar el uso nuevo de la cookie**

En `lib/posesion.ts`, reemplazá:

```ts
export const COOKIE_POSESION = 'acta_posesion'
```

por:

```ts
/*
 * La misma cookie identifica además al teléfono en el modo viaje. La telemetría y los eventos de
 * conducción no guardan el token sino huellaDispositivo, un hash distinto por propósito. Quien
 * borra los datos del navegador pierde el acceso a sus alertas sin cuenta, igual que a sus
 * actuaciones sin cuenta.
 */
export const COOKIE_POSESION = 'acta_posesion'
```

Y reemplazá:

```ts
/** Anota que este navegador tiene el id de esta actuación. */
```

por:

```ts
export type PropositoHuella = 'telemetria' | 'conduccion'

/**
 * hashToken(proposito + ':' + token) sobre la cookie acta_posesion (usa tokenDePosesion, que sigue sin exportarse).
 * Con crear, emite la cookie si falta (sólo desde un route handler). null si no hay cookie y crear es false.
 * La separación por propósito impide cruzar en la base las posesiones con el historial de conducción.
 */
export async function huellaDispositivo(proposito: PropositoHuella, crear: boolean): Promise<string | null> {
  const token = await tokenDePosesion(crear)
  return token ? hashToken(proposito + ':' + token) : null
}

/** Anota que este navegador tiene el id de esta actuación. */
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
  ok   huellaDispositivo existe
  ok   la huella sale de la cookie de posesión, que sólo existe dentro de un pedido
```

y `34/34 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `34/34 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 6: Commit**

```bash
git add "lib/posesion.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Identificar el teléfono con un hash por propósito de la cookie de posesión

La telemetría y los eventos de conducción se guardan sin cuenta: la cookie acta_posesion,
que ya existe, es lo único que dice de qué teléfono son. No se guarda el token sino un hash
distinto por propósito, para que la base no permita cruzar el historial de manejo con las
alertas ni con las posesiones de actuaciones.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Esquema del modo viaje, `SCHEMA` exportado, `TABLAS`, e2e con `tsx`, frascos con IP propia y [10a]

**Files:**
- Modify: `lib/db.ts` — la línea que abre el template string, `const SCHEMA =` (hoy línea 137); el final del template string, después de `CREATE TRIGGER gestiones_inmutables … EXECUTE FUNCTION eventos_solo_insercion();` (hoy líneas 593–597); `export const TABLAS` (hoy línea 607).
- Modify: `package.json` — el script `"e2e"` (hoy línea 12).
- Modify: `scripts/prueba-e2e.mjs` — el comentario de cabecera y los imports (hoy líneas 1–13); el bloque del frasco de cookies, desde el comentario ` * Frasco de cookies.` hasta `const olvidarCookies = () => galletas.clear()` (hoy líneas 25–60); y antes de `/* ---------- Resultado ---------- */` (hoy línea 445).
- Test: `scripts/prueba-viaje.mjs` (bloque nuevo al final de [V1]) y `scripts/prueba-e2e.mjs` `[10a] Esquema idempotente`.

**Interfaces:**
- Consumes: `pool()`, `asegurarEsquema()` y `db()` de `lib/db.ts` (existentes; aplican `SCHEMA` una vez por proceso).
- Produces:
  - `export const SCHEMA: string` (antes `const SCHEMA`), con el bloque «Modo viaje» del índice al final: columnas nuevas de `telemetria`, `telemetria_cliente_uidx` parcial, `telemetria_caso_idx`, `telemetria_purga_idx`, `telemetria_respuesta_valida_v1`, `telemetria_episodios` con `telemetria_episodios_n_uidx`, `eventos_conduccion` con `eventos_conduccion_cliente_uidx`, `eventos_conduccion_purga_idx` y `eventos_conduccion_tipo_valido_v1`.
  - `export const TABLAS` con `'telemetria_episodios'` y `'eventos_conduccion'` agregadas al final, después de `'telemetria'` (`/api/salud` informa si falta alguna).
  - En `scripts/prueba-e2e.mjs`: `crearFrasco()` → `{ galletas: Map, ip: string, pedir(ruta, opciones) }`, cada frasco con `x-forwarded-for: 10.<a>.<b>.<n>` (`a` y `b` con `randomInt(0, 256)` una vez por corrida, `n` el número de frasco); el frasco por omisión `principal`, con `pedir`, `galletas`, `cabeceraCookies` y `olvidarCookies` como antes; `saltar(nombre, motivo)`; la sección `[10] Modo viaje`, a la que F1 y F5 suman subsecciones. Las Tareas 9 y 11 y F5 usan `crearFrasco`, `principal`, `pedir` y `saltar`.

- [ ] **Step 1: Escribir la prueba de [V1] que falla**

Agregá al final de la sección [V1] de `scripts/prueba-viaje.mjs` (antes de su `})`, con una línea vacía antes):

```js
  /* ---- Esquema del modo viaje ---- */
  {
    const { SCHEMA, TABLAS } = await import('../lib/db.ts')
    // Aplicarlo de verdad, dos veces y dentro de una transacción, lo hace el e2e [10a]; acá, sus trampas conocidas.
    const esquema = String(SCHEMA)
    verificar('SCHEMA se exporta para que el e2e lo aplique', typeof SCHEMA === 'string' && esquema.includes('CREATE TABLE IF NOT EXISTS casos'))
    verificar(
      'TABLAS incluye las dos tablas del modo viaje',
      TABLAS.includes('telemetria_episodios') && TABLAS.includes('eventos_conduccion'),
      TABLAS.join(', '),
    )
    verificar(
      'los CHECK nuevos van con nombre versionado dentro de un bloque DO con guarda',
      esquema.includes("conname = 'telemetria_respuesta_valida_v1'") &&
        esquema.includes("conname = 'eventos_conduccion_tipo_valido_v1'") &&
        (esquema.match(/EXCEPTION WHEN duplicate_object THEN NULL;/g) ?? []).length >= 2,
    )
    verificar(
      'recibido_en toma la hora de alta de las filas viejas antes de tener DEFAULT',
      esquema.indexOf('ADD COLUMN IF NOT EXISTS recibido_en') > -1 &&
        esquema.indexOf('UPDATE telemetria SET recibido_en = ts WHERE recibido_en IS NULL;') > esquema.indexOf('ADD COLUMN IF NOT EXISTS recibido_en') &&
        esquema.indexOf('ALTER COLUMN recibido_en SET DEFAULT now();') > esquema.indexOf('UPDATE telemetria SET recibido_en = ts'),
    )
    verificar(
      'el índice único de la alerta es parcial, como lo pide su ON CONFLICT',
      esquema.includes('ON telemetria (dispositivo_sha256, id_cliente) WHERE id_cliente IS NOT NULL'),
    )
  }
```

- [ ] **Step 2: Correrla y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
  FALLA SCHEMA se exporta para que el e2e lo aplique 
  FALLA TABLAS incluye las dos tablas del modo viaje casos, eventos, medias, testigos, usuarios, sesiones, posesiones, bitacora, productores, polizas, documentos_poliza, contactos_confianza, terceros, extracciones, envios, gestiones, eventos_reservados, expurgos, dispositivos, telemetria
  FALLA los CHECK nuevos van con nombre versionado dentro de un bloque DO con guarda 
  FALLA recibido_en toma la hora de alta de las filas viejas antes de tener DEFAULT 
  FALLA el índice único de la alerta es parcial, como lo pide su ON CONFLICT 
```

con `34/39 verificaciones pasaron` y `5 FALLARON`.

- [ ] **Step 3: Pasar el e2e a `tsx`**

`lib/db.ts` y las rutas nuevas usan propiedades de parámetro de TypeScript, que `node` a secas no carga. En `package.json`, reemplazá:

```json
    "e2e": "node scripts/prueba-e2e.mjs"
```

por:

```json
    "e2e": "tsx scripts/prueba-e2e.mjs"
```

- [ ] **Step 4: Cabecera e imports del e2e**

En `scripts/prueba-e2e.mjs`, reemplazá las líneas 1 a 13:

```js
/**
 * Prueba de punta a punta contra el servidor y la base reales.
 *
 * Recorre el circuito completo como lo haría una persona en la calle y después
 * intenta romper la cadena de custodia para comprobar que el sistema lo detecta.
 *
 *   npm run dev          (en otra terminal)
 *   npm run e2e
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
```

por:

```js
/**
 * Prueba de punta a punta contra el servidor y la base reales.
 *
 * Recorre el circuito completo como lo haría una persona en la calle y después
 * intenta romper la cadena de custodia para comprobar que el sistema lo detecta.
 *
 *   npm run dev          (en otra terminal)
 *   npm run e2e
 *
 * Lo que no tiene ruta HTTP (aplicar el esquema dos veces) se prueba contra E2E_DATABASE_URL,
 * que tiene que ser la base DESCARTABLE del servidor que se está probando; E2E_DATABASE_SSL=true
 * si esa base exige TLS. Sin la variable, esas verificaciones dicen «salta». Esta prueba nunca
 * lee .env ni DATABASE_URL: una corrida contra la base compartida mezclaría actuaciones de
 * prueba con las reales.
 */

import { deflateSync } from 'node:zlib'
import { writeFileSync, mkdirSync } from 'node:fs'
import { createHash, randomInt, randomUUID } from 'node:crypto'
```

- [ ] **Step 5: Frascos con IP propia y `saltar`**

En `scripts/prueba-e2e.mjs`, reemplazá el bloque entero del frasco de cookies:

```js
/*
 * Frasco de cookies.
 *
 * Sin esto la prueba no representa a nadie: desde que existe la posesión de la actuación,
 * el servidor le entrega las fotos y el expediente al navegador que abrió el caso, no a
 * cualquiera que sepa el id. Un cliente sin cookies es exactamente el que hay que
 * rechazar, así que el circuito tiene que comportarse como un navegador.
 */
const galletas = new Map()

function guardarCookies(res) {
  const crudas = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
  for (const c of crudas) {
    const [par] = c.split(';')
    const i = par.indexOf('=')
    if (i > 0) galletas.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
  }
}

const cabeceraCookies = () =>
  galletas.size ? [...galletas].map(([k, v]) => `${k}=${v}`).join('; ') : undefined

async function pedir(ruta, opciones = {}) {
  const cookie = cabeceraCookies()
  const res = await fetch(`${BASE}${ruta}`, {
    ...opciones,
    headers: { ...(opciones.headers ?? {}), ...(cookie ? { cookie } : {}) },
  })
  guardarCookies(res)
  const tipo = res.headers.get('content-type') || ''
  const cuerpo = tipo.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer())
  return { res, cuerpo }
}

/** Olvida las cookies: para comprobar que un cliente ajeno NO puede leer el expediente. */
const olvidarCookies = () => galletas.clear()
```

por:

```js
/** Lo que no se puede probar en este entorno: se dice, pero no cuenta ni como prueba ni como falla. */
function saltar(nombre, motivo) {
  console.log(`  salta ${nombre} (${motivo})`)
}

/*
 * Frascos de cookies.
 *
 * Sin esto la prueba no representa a nadie: desde que existe la posesión de la actuación,
 * el servidor le entrega las fotos y el expediente al navegador que abrió el caso, no a
 * cualquiera que sepa el id. Un cliente sin cookies es exactamente el que hay que
 * rechazar, así que el circuito tiene que comportarse como un navegador.
 *
 * Cada frasco es un teléfono distinto: su cookie y su IP en x-forwarded-for. La IP propia hace
 * falta porque el servidor limita por IP y Next completa esa cabecera con la del socket: sin
 * esto, todas las corridas desde esta máquina comparten el tope de altas y la segunda corrida
 * seguida falla con 429 por culpa de la primera. Detrás de un proxy real la cabecera propia
 * deja de contar, y ahí entre dos corridas hay que esperar un minuto.
 */
const RED_A = randomInt(0, 256)
const RED_B = randomInt(0, 256)
let frascos = 0

function crearFrasco() {
  frascos++
  if (frascos > 254) throw new Error('La prueba ya creó 254 frascos: no quedan IP propias en 10.a.b.n. Reusá uno.')
  const galletas = new Map()
  const ip = `10.${RED_A}.${RED_B}.${frascos}`

  function guardarCookies(res) {
    const crudas = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : []
    for (const c of crudas) {
      const [par] = c.split(';')
      const i = par.indexOf('=')
      if (i > 0) galletas.set(par.slice(0, i).trim(), par.slice(i + 1).trim())
    }
  }

  async function pedir(ruta, opciones = {}) {
    const cookie = galletas.size ? [...galletas].map(([k, v]) => `${k}=${v}`).join('; ') : undefined
    const res = await fetch(`${BASE}${ruta}`, {
      ...opciones,
      headers: { ...(opciones.headers ?? {}), 'x-forwarded-for': ip, ...(cookie ? { cookie } : {}) },
    })
    guardarCookies(res)
    const tipo = res.headers.get('content-type') || ''
    const cuerpo = tipo.includes('json') ? await res.json() : Buffer.from(await res.arrayBuffer())
    return { res, cuerpo }
  }

  return { galletas, ip, pedir }
}

/** El teléfono del circuito principal: es el frasco por omisión. */
const principal = crearFrasco()
const galletas = principal.galletas
const pedir = principal.pedir

const cabeceraCookies = () =>
  galletas.size ? [...galletas].map(([k, v]) => `${k}=${v}`).join('; ') : undefined

/** Olvida las cookies: para comprobar que un cliente ajeno NO puede leer el expediente. */
const olvidarCookies = () => galletas.clear()
```

El resto del archivo sigue usando `pedir`, `galletas`, `cabeceraCookies` y `olvidarCookies` sin cambios (la sección `[7c]` escribe en `galletas` para devolver las cookies).

- [ ] **Step 6: Escribir `[10a]` en el e2e**

En `scripts/prueba-e2e.mjs`, reemplazá:

```js
/* ---------- Resultado ---------- */
```

por:

```js
/* ---------- 10. Modo viaje ---------- */
console.log('\n[10] Modo viaje')

console.log('\n[10a] Esquema idempotente')
if (!process.env.E2E_DATABASE_URL) {
  saltar('el esquema se aplica dos veces seguidas sin error', 'falta E2E_DATABASE_URL, la base descartable del servidor que se prueba')
} else {
  const { default: pg } = await import('pg')
  const { SCHEMA } = await import('../lib/db.ts')
  const cliente = new pg.Client({
    connectionString: process.env.E2E_DATABASE_URL,
    ssl: process.env.E2E_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  })
  let error = null
  try {
    await cliente.connect()
    await cliente.query('BEGIN')
    // Dos veces seguidas es el segundo arranque del servicio: una sentencia que no es idempotente falla acá.
    await cliente.query(SCHEMA)
    await cliente.query(SCHEMA)
  } catch (err) {
    error = err
  } finally {
    await cliente.query('ROLLBACK').catch(() => {})
    await cliente.end().catch(() => {})
  }
  verificar('el esquema se aplica dos veces seguidas sin error', error === null, error?.message ?? '')
}

/* ---------- Resultado ---------- */
```

Verificá la sintaxis sin servidor: `node --check scripts/prueba-e2e.mjs` no imprime nada y sale con 0.

- [ ] **Step 7: Correr `[10a]` y verlo fallar**

Con el servidor y la base descartable de «Antes de empezar» levantados: `E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e`.

Expected: las secciones `[0]` a `[9]` como antes (con salida a internet, todas `ok`) y después

```
[10] Modo viaje

[10a] Esquema idempotente
  FALLA el esquema se aplica dos veces seguidas sin error Client was passed a null or undefined query
```

con `50/51 verificaciones pasaron` y `1 FALLARON`. Sin `E2E_DATABASE_URL` la línea es `  salta el esquema se aplica dos veces seguidas sin error (falta E2E_DATABASE_URL, la base descartable del servidor que se prueba)` y no cuenta. Sin base descartable, este paso y el Step 10 no se corren y el informe lo dice.

- [ ] **Step 8: Exportar `SCHEMA` y agregar el bloque del modo viaje**

En `lib/db.ts`, reemplazá la línea 137:

```ts
const SCHEMA = `
```

por:

```ts
export const SCHEMA = `
```

Reemplazá el final del template string (hoy líneas 593–597):

```ts
DROP TRIGGER IF EXISTS gestiones_inmutables ON gestiones;
CREATE TRIGGER gestiones_inmutables
  BEFORE UPDATE OR DELETE ON gestiones
  FOR EACH ROW EXECUTE FUNCTION eventos_solo_insercion();
`
```

por (dentro del template string no puede aparecer `${`):

```ts
DROP TRIGGER IF EXISTS gestiones_inmutables ON gestiones;
CREATE TRIGGER gestiones_inmutables
  BEFORE UPDATE OR DELETE ON gestiones
  FOR EACH ROW EXECUTE FUNCTION eventos_solo_insercion();

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
`
```

Y reemplazá la línea de `TABLAS`:

```ts
export const TABLAS = ['casos', 'eventos', 'medias', 'testigos', 'usuarios', 'sesiones', 'posesiones', 'bitacora', 'productores', 'polizas', 'documentos_poliza', 'contactos_confianza', 'terceros', 'extracciones', 'envios', 'gestiones', 'eventos_reservados', 'expurgos', 'dispositivos', 'telemetria'] as const
```

por:

```ts
export const TABLAS = ['casos', 'eventos', 'medias', 'testigos', 'usuarios', 'sesiones', 'posesiones', 'bitacora', 'productores', 'polizas', 'documentos_poliza', 'contactos_confianza', 'terceros', 'extracciones', 'envios', 'gestiones', 'eventos_reservados', 'expurgos', 'dispositivos', 'telemetria', 'telemetria_episodios', 'eventos_conduccion'] as const
```

- [ ] **Step 9: Correr [V1] y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: las cinco verificaciones del Step 2 en `ok`, `39/39 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 10: Correr `[10a]` y verlo pasar**

Reiniciá `npm run dev` (el esquema se aplica una vez por proceso) y corré `E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e`.

Expected: `[0] Salud del sistema` con `  ok   no falta ninguna tabla del esquema` (ya cuenta `telemetria_episodios` y `eventos_conduccion`), `  ok   el esquema se aplica dos veces seguidas sin error`, `51/51 verificaciones pasaron` y `Circuito completo funcionando.`. Una segunda corrida seguida también pasa: cada frasco manda su propia IP. Al cortar el servidor, `git checkout -- next-env.d.ts`.

- [ ] **Step 11: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `39/39 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 12: Commit**

```bash
git add "lib/db.ts" "package.json" "scripts/prueba-e2e.mjs" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Agregar al esquema las tablas del modo viaje sin tocar la hora de las filas viejas

telemetria pasa a ser la alerta, con sus episodios y los eventos de conducción en tablas
propias. recibido_en se completa con ts antes de tomar DEFAULT now(): con el DEFAULT directo,
las filas viejas quedaban con la hora del despliegue y la regla de 24 h de acceso las leía
como recientes. Los CHECK nuevos llevan nombre versionado dentro de un bloque DO, porque
SCHEMA corre en cada arranque y un error lo revierte entero.

El e2e corre con tsx para poder importar SCHEMA, cada frasco manda su propia IP para que dos
corridas seguidas no compartan el límite de altas, y [10a] aplica SCHEMA dos veces dentro de
una transacción que se revierte, contra la base descartable de E2E_DATABASE_URL.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Agregados de F1 en `lib/impacto.ts` y las dos llamadas viejas a `planEscalamiento`

**Files:**
- Modify: `lib/impacto.ts` — `export interface Lectura` (hoy líneas 20–33); `const G = 9.80665` con `const modulo` (hoy 77–78); `export interface PlanEscalamiento` hasta el final de `planEscalamiento` (hoy 181–217).
- Modify: `app/api/telemetria/[id]/respuesta/route.ts` — la llamada `planEscalamiento(veredicto, respuesta !== 'sin_respuesta')` (hoy línea 40). Una sola línea, para que compile; la Tarea 9 reescribe la ruta entera.
- Modify: `scripts/prueba-logica.mjs` — las dos verificaciones que llaman `planEscalamiento(v, false)` y `planEscalamiento(v, true)` en el bloque bajo `/* ---------- 10. Impacto y notificaciones ---------- */` (antes de F0 eran las líneas 812–813; F0 las corrió hacia abajo: se buscan por contenido).
- Test: `scripts/prueba-viaje.mjs`, bloque nuevo al final de [V1].

**Interfaces:**
- Consumes: `NivelImpacto`, `Veredicto`, `UMBRALES` y `analizarImpacto` de `lib/impacto.ts` (existentes, no cambian en F1).
- Produces (índice, «Interfaces › `lib/impacto.ts`», bloque F1):
  - `Lectura` con `gTotal?: number | null`, `giro?: number | null`, `h?: number | null` y `kmh?: number | null`.
  - `export interface VelocidadEpisodio { t: number; kmh: number | null; precisionM: number; x: number; y: number }`
  - `export type DisparadorEpisodio = 'golpe' | 'caida_velocidad'` y `export type FuenteAceleracion = 'confiable' | 'derivada'`
  - `export interface EpisodioImpacto { disparador; fuente; hzMedido: number; serie: Lectura[]; velocidades: VelocidadEpisodio[] }`
  - `export const GRAVEDAD_MS2 = 9.80665`, `export const KMH_POR_S_POR_G = 35.30394`, `export const MAX_MUESTRAS_EPISODIO = 1000`, `export const MAX_VELOCIDADES_EPISODIO = 120`
  - `export function redondearEpisodio(episodio: EpisodioImpacto): EpisodioImpacto` (idempotente; arma las claves en el orden de `decodificarEpisodio`, que es lo que hace igual el JSON de los dos)
  - `export function recortarEpisodio(episodio: EpisodioImpacto, max?: number): { episodio: EpisodioImpacto; recortada: boolean }`
  - `export type RespuestaAlerta = 'estoy_bien' | 'necesito_ayuda' | 'sin_respuesta'`
  - `export interface ImpactoParaPlan { nivel: NivelImpacto; alertaMostrada?: boolean }`
  - `export interface PlanEscalamiento { ofrecerEmergencias: boolean; ofrecerContactoDeConfianza: boolean; precargarDenuncia: boolean; texto: string }`
  - `export function planEscalamiento(veredicto: ImpactoParaPlan, respuesta: RespuestaAlerta | null): PlanEscalamiento` con los siete textos exactos del índice y `Error` ante cualquier otro valor.
  - `export function nivelMayor(a: NivelImpacto, b: NivelImpacto | null | undefined): NivelImpacto`
  - Los usan las Tareas 7 y 8; F2 suma el resto de `lib/impacto.ts` sin tocar estos nombres.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección [V1] de `scripts/prueba-viaje.mjs` (antes de su `})`, con una línea vacía antes):

```js
  /* ---- planEscalamiento, nivelMayor, redondeo y recorte del episodio ---- */
  {
    const impacto = await import('../lib/impacto.ts')
    const { planEscalamiento, nivelMayor, redondearEpisodio, recortarEpisodio } = impacto

    const OFRECE = ' Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente.'
    const casosPlan = [
      [{ nivel: 'nada' }, 'necesito_ayuda', true, 'La persona pidió ayuda.' + OFRECE],
      [{ nivel: 'confirmado' }, 'sin_respuesta', true, 'No hubo respuesta y el impacto está confirmado.' + OFRECE],
      [{ nivel: 'confirmado', alertaMostrada: false }, 'sin_respuesta', true, 'No hubo respuesta y el impacto está confirmado.' + OFRECE],
      [{ nivel: 'sospecha' }, 'sin_respuesta', true, 'No hubo respuesta a un posible impacto.' + OFRECE],
      [{ nivel: 'nada' }, 'sin_respuesta', true, 'No hubo respuesta a la alerta.' + OFRECE],
      [{ nivel: 'nada', alertaMostrada: false }, 'sin_respuesta', false, 'Sin novedad: la alerta no se mostró.'],
      [{ nivel: 'confirmado' }, 'estoy_bien', false, 'La persona respondió que está bien.'],
      [{ nivel: 'confirmado' }, null, false, 'Todavía no hay respuesta.'],
    ]
    for (const [paraPlan, respuesta, escala, texto] of casosPlan) {
      const plan = planEscalamiento(paraPlan, respuesta)
      const nombre = `planEscalamiento(${JSON.stringify(paraPlan)}, ${respuesta})`
      verificar(
        `${nombre} ${escala ? 'escala' : 'no escala'}`,
        plan.ofrecerEmergencias === escala && plan.ofrecerContactoDeConfianza === escala && plan.precargarDenuncia === escala,
        JSON.stringify(plan),
      )
      verificar(`${nombre} dice qué pasó`, plan.texto === texto, plan.texto)
    }
    verificar(
      'el plan ya no promete avisar al contacto: ofrece llamarlo',
      !('avisarContactoDeConfianza' in planEscalamiento({ nivel: 'nada' }, 'necesito_ayuda')),
    )
    let firmaVieja = null
    try {
      planEscalamiento({ nivel: 'confirmado' }, true)
    } catch (err) {
      firmaVieja = err
    }
    verificar(
      'planEscalamiento con la firma vieja falla fuerte',
      firmaVieja?.message === 'planEscalamiento recibió la respuesta true: las posibles son estoy_bien, necesito_ayuda, sin_respuesta o null.',
      String(firmaVieja?.message),
    )

    verificar(
      'nivelMayor ordena nada < sospecha < confirmado',
      nivelMayor('nada', 'sospecha') === 'sospecha' && nivelMayor('confirmado', 'sospecha') === 'confirmado' && nivelMayor('sospecha', 'nada') === 'sospecha',
    )
    verificar('nivelMayor no cuenta null ni undefined', nivelMayor('sospecha', null) === 'sospecha' && nivelMayor('nada', undefined) === 'nada')

    verificar(
      'las constantes del episodio son las del diseño',
      impacto.GRAVEDAD_MS2 === 9.80665 && impacto.KMH_POR_S_POR_G === 35.30394 && impacto.MAX_MUESTRAS_EPISODIO === 1000 && impacto.MAX_VELOCIDADES_EPISODIO === 120,
    )

    const crudo = {
      disparador: 'golpe',
      fuente: 'confiable',
      hzMedido: 59.83,
      serie: [
        { t: -16.66666, ax: 0.11349, ay: -0.0524, az: 0.20149, gTotal: 1.00449, giro: 2.149, h: 0.01249 },
        { t: 0.04, ax: 118.33333, ay: -0.0004, az: 3.3333 },
      ],
      velocidades: [
        { t: -9800.04, kmh: 54.26, precisionM: 8.04, x: 1200.55, y: -300.25 },
        { t: -8800, kmh: null, precisionM: 12.36, x: 1215.75, y: -299.85 },
      ],
    }
    const redondeado = redondearEpisodio(crudo)
    verificar(
      'redondearEpisodio deja t con 1 decimal y la aceleración con 3',
      JSON.stringify(redondeado.serie[0]) === '{"t":-16.7,"ax":0.113,"ay":-0.052,"az":0.201,"gTotal":1.004,"giro":2.1,"h":0.012}',
      JSON.stringify(redondeado.serie[0]),
    )
    verificar(
      'redondearEpisodio completa con null lo que el equipo no entregó y no deja -0',
      JSON.stringify(redondeado.serie[1]) === '{"t":0,"ax":118.333,"ay":0,"az":3.333,"gTotal":null,"giro":null,"h":null}' && Object.is(redondeado.serie[1].ay, 0),
      JSON.stringify(redondeado.serie[1]),
    )
    verificar(
      'redondearEpisodio deja x e y relativos a la primera velocidad',
      JSON.stringify(redondeado.velocidades) === '[{"t":-9800,"kmh":54.3,"precisionM":8,"x":0,"y":0},{"t":-8800,"kmh":null,"precisionM":12.4,"x":15.2,"y":0.4}]',
      JSON.stringify(redondeado.velocidades),
    )
    verificar('redondearEpisodio es idempotente', JSON.stringify(redondearEpisodio(redondeado)) === JSON.stringify(redondeado))
    verificar('redondearEpisodio no modifica el episodio que recibe', crudo.serie[0].t === -16.66666 && crudo.velocidades[1].x === 1215.75)

    const serieLarga = (n, indicePico, corrimiento) =>
      Array.from({ length: n }, (_, i) => ({ t: (i - corrimiento) * 16.7, ax: i === indicePico ? 60 : 0.1, ay: 0, az: 0, gTotal: 1, giro: 0, h: 0 }))
    const velocidades = [{ t: -1000, kmh: 50, precisionM: 5, x: 0, y: 0 }]

    const corto = { disparador: 'golpe', fuente: 'confiable', hzMedido: 60, serie: serieLarga(10, 5, 5), velocidades }
    verificar('recortarEpisodio no toca una serie dentro del tope', recortarEpisodio(corto).recortada === false && recortarEpisodio(corto).episodio === corto)

    const centrada = serieLarga(1500, 700, 300)
    const alMedio = recortarEpisodio({ disparador: 'golpe', fuente: 'confiable', hzMedido: 60, serie: centrada, velocidades })
    verificar(
      'recortarEpisodio deja 1000 muestras con el golpe en el medio',
      alMedio.recortada === true && alMedio.episodio.serie.length === 1000 && alMedio.episodio.serie[499] === centrada[700],
      `largo=${alMedio.episodio.serie.length}`,
    )
    const alFinal = serieLarga(1500, 1400, 300)
    const corrida = recortarEpisodio({ disparador: 'golpe', fuente: 'confiable', hzMedido: 60, serie: alFinal, velocidades })
    verificar(
      'con el golpe cerca del final corre la ventana en vez de cortarlo',
      corrida.episodio.serie.length === 1000 && corrida.episodio.serie.includes(alFinal[1400]) && corrida.episodio.serie.at(-1) === alFinal.at(-1),
    )
    const caida = serieLarga(3000, -1, 1500)
    const porCruce = recortarEpisodio({ disparador: 'caida_velocidad', fuente: 'confiable', hzMedido: 60, serie: caida, velocidades }, 1000)
    verificar(
      'con el disparador (b) centra en el cruce de velocidad, t = 0',
      porCruce.episodio.serie.length === 1000 && porCruce.episodio.serie[499].t === 0,
      String(porCruce.episodio.serie[499]?.t),
    )
    verificar('recortarEpisodio no toca las velocidades', porCruce.episodio.velocidades === velocidades)
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: las 39 verificaciones anteriores en `ok`; después dieciséis líneas que empiezan con `  FALLA planEscalamiento(` (la firma vieja trata cualquier respuesta como «respondió»), por ejemplo

```
  FALLA planEscalamiento({"nivel":"nada"}, necesito_ayuda) escala {"ofrecerEmergencias":false,"avisarContactoDeConfianza":false,"precargarDenuncia":false,"texto":"Sin novedad."}
```

y además

```
  FALLA el plan ya no promete avisar al contacto: ofrece llamarlo 
  FALLA planEscalamiento con la firma vieja falla fuerte undefined
  FALLA [V1] terminó sin excepciones TypeError: nivelMayor is not a function
```

con `39/58 verificaciones pasaron` y `19 FALLARON`.

- [ ] **Step 3: Tipos, constantes, redondeo y recorte del episodio**

En `lib/impacto.ts`, reemplazá la interfaz `Lectura` entera:

```ts
export interface Lectura {
  /** Milisegundos desde el comienzo de la serie. */
  t: number
  /** Aceleración lineal, sin gravedad, en m/s². */
  ax: number
  ay: number
  az: number
  /** Módulo CON gravedad, en g. Sirve para detectar caída libre. */
  gTotal?: number
  /** Velocidad del GPS en km/h, cuando la hay. */
  kmh?: number | null
  /** Giro en grados por segundo, cuando lo hay. */
  giro?: number | null
}
```

por:

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

/** Redondea a `decimales` sin dejar un -0, que JSON escribe como 0 y rompería la igualdad con lo transportado. */
function redondear(valor: number, decimales: number): number {
  const factor = 10 ** decimales
  const r = Math.round(valor * factor) / factor
  return r === 0 ? 0 : r
}

const redondearONulo = (valor: number | null | undefined, decimales: number): number | null =>
  typeof valor === 'number' ? redondear(valor, decimales) : null

/**
 * Redondea como el transporte y nada más: t con 1 decimal; ax, ay, az con 3; gTotal y h con 3; giro con 1;
 * en velocidades, t, kmh, precisionM, x e y con 1. x e y quedan relativos a la primera lectura. Idempotente:
 * decodificarEpisodio(codificarEpisodio(...)).episodio es igual a redondearEpisodio(episodio).
 */
export function redondearEpisodio(episodio: EpisodioImpacto): EpisodioImpacto {
  const primera = episodio.velocidades[0]
  // Las claves van en el mismo orden que las arma decodificarEpisodio: así el JSON de los dos es idéntico.
  return {
    disparador: episodio.disparador,
    fuente: episodio.fuente,
    hzMedido: episodio.hzMedido,
    serie: episodio.serie.map((l) => ({
      t: redondear(l.t, 1),
      ax: redondear(l.ax, 3),
      ay: redondear(l.ay, 3),
      az: redondear(l.az, 3),
      gTotal: redondearONulo(l.gTotal, 3),
      giro: redondearONulo(l.giro, 1),
      h: redondearONulo(l.h, 3),
    })),
    velocidades: episodio.velocidades.map((v) => ({
      t: redondear(v.t, 1),
      kmh: redondearONulo(v.kmh, 1),
      precisionM: redondear(v.precisionM, 1),
      // Se resta antes de redondear: al revés, 1215.75 − 1200.55 deja 15.200000000000045 y deja de ser idempotente.
      x: redondear(v.x - primera.x, 1),
      y: redondear(v.y - primera.y, 1),
    })),
  }
}

/**
 * Recorta la serie a `max` (MAX_MUESTRAS_EPISODIO por omisión) alrededor del pico: centro en la muestra de
 * mayor |a| con el disparador (a) y en la más cercana a t = 0 con el (b); igual cantidad a cada lado cuando
 * alcanza y, si no, corre la ventana para llenar `max`. Nunca slice(0, max) ni slice(-max). No toca velocidades.
 */
export function recortarEpisodio(
  episodio: EpisodioImpacto,
  max: number = MAX_MUESTRAS_EPISODIO,
): { episodio: EpisodioImpacto; recortada: boolean } {
  const { serie } = episodio
  if (serie.length <= max) return { episodio, recortada: false }

  let centro = 0
  let mejor = -Infinity
  serie.forEach((l, i) => {
    // Con (a) importa el golpe; con (b), el instante del cruce de velocidad, que es t = 0.
    const valor = episodio.disparador === 'golpe' ? modulo(l) : -Math.abs(l.t)
    if (valor > mejor) {
      mejor = valor
      centro = i
    }
  })
  const desde = Math.max(0, Math.min(centro - Math.floor((max - 1) / 2), serie.length - max))
  return { episodio: { ...episodio, serie: serie.slice(desde, desde + max) }, recortada: true }
}
```

- [ ] **Step 4: Una sola constante de gravedad**

En `lib/impacto.ts`, reemplazá:

```ts
const G = 9.80665
const modulo = (l: Lectura) => Math.sqrt(l.ax * l.ax + l.ay * l.ay + l.az * l.az) / G
```

por:

```ts
const modulo = (l: Lectura) => Math.sqrt(l.ax * l.ax + l.ay * l.ay + l.az * l.az) / GRAVEDAD_MS2
```

- [ ] **Step 5: `planEscalamiento` por respuesta y `nivelMayor`**

En `lib/impacto.ts`, reemplazá desde `export interface PlanEscalamiento {` hasta el final del archivo:

```ts
export interface PlanEscalamiento {
  ofrecerEmergencias: boolean
  avisarContactoDeConfianza: boolean
  precargarDenuncia: boolean
  texto: string
}

/**
 * Qué hacer cuando se venció la ventana de verificación sin respuesta.
 *
 * NUNCA se llama a emergencias solo. Lo que se hace es dejar los tres botones a un toque y
 * el borrador de la denuncia ya abierto con la hora y el lugar del impacto, para que si la
 * persona retoma el teléfono no tenga que empezar de cero.
 *
 * Y el aviso al contacto de confianza tiene su propio límite honesto: desde un navegador no
 * se puede llamar ni mandar un SMS por cuenta propia. Lo que se puede es abrir el marcador
 * con el número puesto. Un aviso automático de verdad necesita un proveedor de SMS.
 */
export function planEscalamiento(veredicto: Veredicto, respondio: boolean): PlanEscalamiento {
  if (respondio || veredicto.nivel === 'nada') {
    return {
      ofrecerEmergencias: false,
      avisarContactoDeConfianza: false,
      precargarDenuncia: false,
      texto: 'Sin novedad.',
    }
  }
  return {
    ofrecerEmergencias: true,
    avisarContactoDeConfianza: veredicto.nivel === 'confirmado',
    precargarDenuncia: true,
    texto:
      veredicto.nivel === 'confirmado'
        ? 'No hubo respuesta y el impacto está confirmado por más de una señal. Se ofrecen las llamadas de emergencia y el aviso al contacto de confianza, y queda abierto el borrador de la denuncia con la hora y el lugar.'
        : 'No hubo respuesta. Se ofrecen las llamadas de emergencia y queda abierto el borrador de la denuncia.',
  }
}
```

por:

```ts
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

const escala = (texto: string): PlanEscalamiento => ({
  ofrecerEmergencias: true,
  ofrecerContactoDeConfianza: true,
  precargarDenuncia: true,
  texto,
})

const noEscala = (texto: string): PlanEscalamiento => ({
  ofrecerEmergencias: false,
  ofrecerContactoDeConfianza: false,
  precargarDenuncia: false,
  texto,
})

/**
 * Qué ofrecer según lo que respondió la persona.
 *
 * NUNCA se llama a emergencias ni se le avisa a nadie por cuenta propia: escalar es dejar las
 * llamadas y el contacto de confianza a un toque, y el registro del accidente a mano. Desde un
 * navegador no se puede llamar ni mandar un SMS solo.
 *
 *   necesito_ayuda → escala siempre, con cualquier nivel.
 *   estoy_bien     → no escala.
 *   sin_respuesta  → escala si el nivel es sospecha o confirmado, o si es nada y alertaMostrada !== false.
 *   null           → no escala todavía.
 *
 * Cualquier otro valor lanza: la firma vieja recibía un booleano, y un planEscalamiento(v, true)
 * olvidado tiene que fallar fuerte en vez de devolver «no escala» en silencio.
 */
export function planEscalamiento(veredicto: ImpactoParaPlan, respuesta: RespuestaAlerta | null): PlanEscalamiento {
  switch (respuesta) {
    case 'necesito_ayuda':
      return escala('La persona pidió ayuda. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente.')
    case 'estoy_bien':
      return noEscala('La persona respondió que está bien.')
    case 'sin_respuesta':
      if (veredicto.nivel === 'confirmado') {
        return escala('No hubo respuesta y el impacto está confirmado. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente.')
      }
      if (veredicto.nivel === 'sospecha') {
        return escala('No hubo respuesta a un posible impacto. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente.')
      }
      if (veredicto.alertaMostrada !== false) {
        return escala('No hubo respuesta a la alerta. Se ofrecen las llamadas de emergencia y el contacto de confianza, y queda a mano el registro del accidente.')
      }
      return noEscala('Sin novedad: la alerta no se mostró.')
    case null:
      return noEscala('Todavía no hay respuesta.')
    default:
      throw new Error(
        `planEscalamiento recibió la respuesta ${String(respuesta)}: las posibles son estoy_bien, necesito_ayuda, sin_respuesta o null.`,
      )
  }
}

const ORDEN_NIVEL: Record<NivelImpacto, number> = { nada: 0, sospecha: 1, confirmado: 2 }

/** El mayor de dos niveles con nada < sospecha < confirmado; b null o undefined no cuenta. */
export function nivelMayor(a: NivelImpacto, b: NivelImpacto | null | undefined): NivelImpacto {
  if (b === null || b === undefined) return a
  return ORDEN_NIVEL[b] > ORDEN_NIVEL[a] ? b : a
}
```

- [ ] **Step 6: Correr [V1] y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras,

```
  ok   planEscalamiento({"nivel":"nada","alertaMostrada":false}, sin_respuesta) no escala
  ok   planEscalamiento con la firma vieja falla fuerte
  ok   redondearEpisodio es idempotente
  ok   con el golpe cerca del final corre la ventana en vez de cortarlo
```

y `70/70 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 7: Ver fallar fuerte a los llamadores viejos**

Run: `npm run tipos`

Expected: código 1 con

```
app/api/telemetria/[id]/respuesta/route.ts(40,76): error TS2345: Argument of type 'boolean' is not assignable to parameter of type 'RespuestaAlerta | null'.
```

Run: `npx tsx scripts/prueba-logica.mjs`

Expected: se corta en el bloque `[10] Impacto y notificaciones` con

```
Error: planEscalamiento recibió la respuesta false: las posibles son estoy_bien, necesito_ayuda, sin_respuesta o null.
```

- [ ] **Step 8: Actualizar las dos verificaciones viejas de `prueba-logica.mjs`**

En `scripts/prueba-logica.mjs`, buscá por contenido y reemplazá:

```js
  verificar('sin respuesta se escala, pero sin llamar solo', planEscalamiento(v, false).ofrecerEmergencias === true)
  verificar('si la persona contesta, no se escala nada', planEscalamiento(v, true).ofrecerEmergencias === false)
```

por:

```js
  verificar('sin respuesta se escala, pero sin llamar solo', planEscalamiento(v, 'sin_respuesta').ofrecerEmergencias === true)
  verificar('si la persona contesta, no se escala nada', planEscalamiento(v, 'estoy_bien').ofrecerEmergencias === false)
```

(`v` es un choque confirmado: con `sin_respuesta` escala y con `estoy_bien` no.)

- [ ] **Step 9: Pasar la respuesta, no un booleano, en la ruta de respuesta**

En `app/api/telemetria/[id]/respuesta/route.ts`, reemplazá:

```ts
    return NextResponse.json({ ok: true, plan: planEscalamiento(veredicto, respuesta !== 'sin_respuesta') })
```

por:

```ts
    return NextResponse.json({ ok: true, plan: planEscalamiento(veredicto, respuesta) })
```

Con esto, «Necesito ayuda» desde `/aviso` ya escala; antes contaba como «respondió» y no escalaba.

- [ ] **Step 10: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` con `  ok   sin respuesta se escala, pero sin llamar solo` y `  ok   si la persona contesta, no se escala nada`, sin `  FALLA`; `prueba-viaje.mjs` con `70/70 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 11: Commit**

```bash
git add "lib/impacto.ts" "app/api/telemetria/[id]/respuesta/route.ts" "scripts/prueba-logica.mjs" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Escalar según la respuesta y no según un booleano que perdía el pedido de ayuda

planEscalamiento recibía «respondió o no», así que «Necesito ayuda» contaba como respuesta
y no escalaba. Ahora recibe la respuesta: necesito_ayuda escala siempre, sin_respuesta según
el nivel, y cualquier otro valor falla fuerte para que una llamada con la firma vieja no pase
callada. avisarContactoDeConfianza pasa a ofrecerContactoDeConfianza: la aplicación ofrece
llamar, no avisa.

Se suman los tipos del episodio, nivelMayor, y el redondeo y el recorte alrededor del pico que
van a compartir el teléfono y el servidor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `lib/transporte-viaje.ts` (sin `reconstruirVeredicto`) y la rama 400 de `errorApi`

**Files:**
- Create: `lib/transporte-viaje.ts`.
- Modify: `lib/api.ts` — los imports y la rama `if (err instanceof ErrorLimite) { … }` que sumó la Tarea 3.
- Test: `scripts/prueba-viaje.mjs`, bloque nuevo al final de [V1].

**Interfaces:**
- Consumes (de la Tarea 6, `lib/impacto.ts`): `UMBRALES`, `GRAVEDAD_MS2`, `MAX_MUESTRAS_EPISODIO`, `MAX_VELOCIDADES_EPISODIO`, `recortarEpisodio`, `redondearEpisodio` y los tipos `DisparadorEpisodio`, `EpisodioImpacto`, `FuenteAceleracion`, `Lectura`, `NivelImpacto`, `RespuestaAlerta`, `Umbrales`, `Veredicto`, con el import de una sola línea que fija el índice. `lib/transporte-viaje.ts` no importa nada más (F2 lo hace cumplir con `IMPORTS_PERMITIDOS`).
- Produces (índice, «Interfaces › `lib/transporte-viaje.ts`», todo salvo `reconstruirVeredicto`, que es de F2):
  - Tipos `Plataforma`, `AperturaAlerta`, `TipoEventoConduccion`, `FilaSerie`, `FilaVelocidad`, `FilaEventoConduccion`, `RespuestaTransportada`, `GpsTransportado`, `CamposAlerta`, `EpisodioTransportado`, `CuerpoTelemetria`, `CuerpoTelemetriaLegado`, `CuerpoRespuesta`, `LoteConduccion`, `VeredictoClienteReconstruido`, `EpisodioDecodificado`.
  - `BYTES_MAX_TELEMETRIA = 131_072`, `BYTES_MAX_RESPUESTA = 2_048`, `BYTES_MAX_CONDUCCION = 8_192`, `MAX_EVENTOS_LOTE = 50`.
  - `export class ErrorTransporte extends Error { constructor(readonly campo: string, mensaje: string) }`, que `errorApi` traduce a 400 `{ error, tipo: 'transporte', campo }`.
  - `codificarEpisodio(n: number, ocurridoEnTelefono: number, episodio: EpisodioImpacto, veredictoCliente: Veredicto): EpisodioTransportado`
  - `decodificarEpisodio(crudo: unknown): EpisodioDecodificado`
  - `validarCuerpoTelemetria(crudo: unknown): { campos: CamposAlerta; episodio: EpisodioDecodificado | null }`
  - `esCuerpoLegado(crudo: unknown): boolean` y `decodificarCuerpoLegado(crudo: unknown): CuerpoTelemetriaLegado`
  - `validarCuerpoRespuesta(crudo: unknown): CuerpoRespuesta` y `validarLoteConduccion(crudo: unknown): LoteConduccion`
  - Los usan las Tareas 8 y 9, el motor de F3 (`codificarEpisodio`, los tipos) y F2 (`reconstruirVeredicto` reemplaza a `veredictoBasico`, que no se exporta).

**Mensajes que el índice no escribía** (mismo formato: la ruta del campo primero y qué arreglar): `… tiene que ser un número entero`, `… tiene que tener de 8 a 64 letras, números o guiones`, `… tiene que ser true, false o null`, `… tiene que ser una lista`, `serie está vacía: con el disparador golpe tiene que traer al menos una muestra`, `serie está vacía: tiene que traer al menos una muestra` (cuerpo anterior), `serie[3].t no puede ser negativo` (cuerpo anterior), `velocidades[3].t no crece respecto de la lectura anterior`, `velocidades tiene 130 lecturas: el máximo es 120`, `eventos tiene 51 eventos: el máximo es 50`, `eventos está vacía: tiene que traer al menos un evento`, `campos tiene que ser un objeto`, `campos.gps tiene que ser un objeto con lat, lon y precision_m, o null`, `campos.respuestas[1] tiene que ser un objeto con respuesta y en_telefono`, `episodio tiene que ser un objeto con n, disparador, serie y velocidades, o null` y los dos de cuerpo no objeto del cuerpo anterior y del lote. Un problema del cuerpo entero va con `campo: 'cuerpo'`; uno de `campos` sin subcampo, con `campo: 'campos'`.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección [V1] de `scripts/prueba-viaje.mjs` (antes de su `})`, con una línea vacía antes):

```js
  /* ---- Transporte del modo viaje ---- */
  {
    const transporte = await import('../lib/transporte-viaje.ts')
    const { UMBRALES } = await import('../lib/impacto.ts')
    const { errorApi } = await import('../lib/api.ts')
    const {
      ErrorTransporte,
      codificarEpisodio,
      decodificarEpisodio,
      validarCuerpoTelemetria,
      esCuerpoLegado,
      decodificarCuerpoLegado,
      validarCuerpoRespuesta,
      validarLoteConduccion,
    } = transporte
    const { redondearEpisodio } = await import('../lib/impacto.ts')

    /** Corre fn y devuelve el ErrorTransporte que lanzó, o null. Cualquier otro error sube. */
    const errorDe = (fn) => {
      try {
        fn()
        return null
      } catch (err) {
        if (err instanceof ErrorTransporte) return err
        throw err
      }
    }
    /** Cambia una copia profunda del cuerpo y devuelve el error de validarlo. */
    const conCambio = (base, cambiar, validar = validarCuerpoTelemetria) => {
      const copia = JSON.parse(JSON.stringify(base))
      cambiar(copia)
      return errorDe(() => validar(copia))
    }
    /** console.warn que anota en vez de escribir, para afirmar sobre el log sin ensuciar la salida. */
    const conAvisos = (fn) => {
      const avisos = []
      const original = console.warn
      console.warn = (...args) => avisos.push(args)
      try {
        return { resultado: fn(), avisos }
      } finally {
        console.warn = original
      }
    }

    verificar(
      'los topes de cuerpo son 128 KB, 2 KB y 8 KB, y 50 eventos por lote',
      transporte.BYTES_MAX_TELEMETRIA === 131072 && transporte.BYTES_MAX_RESPUESTA === 2048 && transporte.BYTES_MAX_CONDUCCION === 8192 && transporte.MAX_EVENTOS_LOTE === 50,
    )

    // Un episodio como lo arma el motor, con decimales de más y x, y absolutos.
    const episodio = {
      disparador: 'golpe',
      fuente: 'confiable',
      hzMedido: 59.8,
      serie: Array.from({ length: 150 }, (_, i) => ({
        t: -2000.0004 + i * 16.6667,
        ax: i === 120 ? 114.73121 : 0.11234 * Math.sin(i),
        ay: -0.05219,
        az: 0.20111,
        gTotal: i % 7 === 0 ? null : 1.00449,
        giro: i === 121 ? 261.44 : 2.149,
        h: i % 7 === 0 ? null : 0.01249,
      })),
      velocidades: [
        { t: -9800.04, kmh: 54.26, precisionM: 8.04, x: 1200.55, y: -300.25 },
        { t: -8800, kmh: 55.14, precisionM: 8, x: 1215.75, y: -299.85 },
        { t: 1500, kmh: null, precisionM: 30, x: 1300.33, y: -290.11 },
      ],
    }
    const veredictoTelefono = { nivel: 'confirmado', picoG: 11.7, msPico: 0, motivo: 'Iba andando y quedó detenido después de un golpe sostenido.', descartes: [], llamar_emergencias: false }
    const codificado = codificarEpisodio(1, Date.UTC(2026, 8, 16, 17, 32, 8, 412), episodio, veredictoTelefono)
    verificar(
      'codificarEpisodio arma filas de 7 y de 5 valores con la hora en ISO',
      codificado.serie.every((f) => f.length === 7) && codificado.velocidades.every((f) => f.length === 5) && codificado.ocurrido_en_telefono === '2026-09-16T17:32:08.412Z',
    )
    const decodificado = decodificarEpisodio(JSON.parse(JSON.stringify(codificado)))
    verificar(
      'decodificar lo codificado da exactamente el episodio redondeado',
      JSON.stringify(decodificado.episodio) === JSON.stringify(redondearEpisodio(episodio)),
    )
    verificar(
      'del veredicto del teléfono se reconstruyen nivel, pico y motivo',
      decodificado.veredictoCliente?.nivel === 'confirmado' && decodificado.veredictoCliente.picoG === 11.7 && decodificado.veredictoCliente.motivo === veredictoTelefono.motivo,
      JSON.stringify(decodificado.veredictoCliente),
    )
    verificar(
      'las filas del episodio decodificado son las que se guardan',
      decodificado.recortada === false && decodificado.serie.length === 150 && JSON.stringify(decodificado.serie) === JSON.stringify(codificado.serie),
    )

    const cuerpo = {
      campos: {
        id_cliente: '7d0f5a4e-2c1b-4f7e-9a3d-5e6f7a8b9c0d',
        aviso_version: '2026-09-16',
        version_motor: 1,
        plataforma: 'android',
        standalone: true,
        ocurrido_en_telefono: '2026-09-16T17:32:08.412Z',
        enviado_en: '2026-09-16T17:32:20.050Z',
        apertura: 'episodio',
        nivel_cliente: 'confirmado',
        alerta_mostrada: true,
        sonido: true,
        respuestas: [{ respuesta: 'sin_respuesta', en_telefono: '2026-09-16T17:32:47.001Z' }],
        hubo_choque: null,
        ms_hasta_respuesta: null,
        hz_medido: 59.8,
        aceleracion_derivada: false,
        gps: { lat: -34.6037, lon: -58.3816, precision_m: 9.5 },
        umbrales_cliente: { sospechaG: 4, confirmadoG: 8, msSobreUmbral: 30, velocidadPreviaKmh: 15, velocidadPosteriorKmh: 8, giroDps: 180, clave_inventada: 1 },
      },
      episodio: codificado,
    }
    const valido = validarCuerpoTelemetria(JSON.parse(JSON.stringify(cuerpo)))
    verificar('el cuerpo del ejemplo del índice es válido', valido.campos.id_cliente === cuerpo.campos.id_cliente && valido.episodio?.n === 1)
    verificar(
      'de umbrales_cliente quedan sólo las claves que el servidor conoce',
      !('clave_inventada' in valido.campos.umbrales_cliente) && Object.keys(valido.campos.umbrales_cliente).every((k) => k in UMBRALES),
      JSON.stringify(valido.campos.umbrales_cliente),
    )
    const conExtras = JSON.parse(JSON.stringify(cuerpo))
    conExtras.campos.extra = 'x'
    conExtras.campos.gps.altura = 30
    conExtras.episodio.veredicto_cliente = { nivel: 'sospecha', picoG: 5, motivo: 'm', anidado: { mucho: { mas: [1, 2, { hondo: true }] } } }
    const sinExtras = validarCuerpoTelemetria(conExtras)
    verificar(
      'los campos que no están en la lista cerrada no llegan a la base',
      !('extra' in sinExtras.campos) && !('altura' in sinExtras.campos.gps) && !('anidado' in sinExtras.episodio.veredictoCliente) && sinExtras.episodio.veredictoCliente.nivel === 'sospecha',
    )
    const sinEpisodio = validarCuerpoTelemetria({ ...JSON.parse(JSON.stringify(cuerpo)), episodio: null })
    verificar('una alerta sin episodio es válida', sinEpisodio.episodio === null)
    const veredictoIlegible = conCambio(cuerpo, (c) => (c.episodio.veredicto_cliente = { nivel: 'catastrofe' }))
    verificar('un veredicto del teléfono ilegible no rechaza el episodio', veredictoIlegible === null, veredictoIlegible?.message)

    const mensajes = [
      [null, (c) => c, 'cuerpo', 'el cuerpo tiene que ser un objeto JSON con campos y episodio'],
      ['número', (c) => (c.episodio.serie[37][1] = 'mucho'), 'serie[37].ax', 'serie[37].ax no es un número'],
      ['null no es 0', (c) => (c.episodio.serie[2][1] = null), 'serie[2].ax', 'serie[2].ax no es un número'],
      ['rango', (c) => (c.episodio.velocidades[1][1] = 301), 'velocidades[1].kmh', 'velocidades[1].kmh está fuera de rango (0 a 300)'],
      ['falta', (c) => delete c.campos.id_cliente, 'campos.id_cliente', 'falta campos.id_cliente'],
      ['texto', (c) => (c.campos.id_cliente = 'x'.repeat(65)), 'campos.id_cliente', 'campos.id_cliente tiene que ser un texto de hasta 64 caracteres'],
      ['lista', (c) => (c.campos.plataforma = 'windows'), 'campos.plataforma', 'campos.plataforma tiene que ser uno de: ios, android, otro'],
      ['t no crece', (c) => (c.episodio.serie[12][0] = c.episodio.serie[11][0]), 'serie[12].t', 'serie[12].t no crece respecto de la muestra anterior'],
      ['t fuera de ventana', (c) => (c.episodio.serie[0][0] = -120001), 'serie[0].t', 'serie[0].t está fuera de rango (-120000 a 120000)'],
      ['demasiadas', (c) => (c.episodio.serie = Array.from({ length: 3200 }, (_, i) => [i, 0, 0, 0, null, null, null])), 'serie', 'serie tiene 3200 muestras: el máximo es 1000'],
      ['booleano', (c) => (c.campos.standalone = 'si'), 'campos.standalone', 'campos.standalone tiene que ser true o false'],
      ['fecha', (c) => (c.campos.enviado_en = 'ayer'), 'campos.enviado_en', 'campos.enviado_en no es una fecha ISO 8601'],
      ['fila', (c) => (c.episodio.serie[12] = [1, 2, 3]), 'serie[12]', 'serie[12] tiene que ser una lista de 7 valores'],
      ['respuestas de más', (c) => (c.campos.respuestas = Array.from({ length: 6 }, () => ({ respuesta: 'estoy_bien', en_telefono: '2026-09-16T17:33:00.000Z' }))), 'campos.respuestas', 'campos.respuestas tiene 6 elementos: el máximo es 5'],
      ['respuesta inventada', (c) => (c.campos.respuestas[0].respuesta = 'quizas'), 'campos.respuestas[0].respuesta', 'campos.respuestas[0].respuesta tiene que ser uno de: estoy_bien, necesito_ayuda, sin_respuesta'],
      ['latitud', (c) => (c.campos.gps.lat = -91), 'campos.gps.lat', 'campos.gps.lat está fuera de rango (-90 a 90)'],
      ['golpe sin muestras', (c) => (c.episodio.serie = []), 'serie', 'serie está vacía: con el disparador golpe tiene que traer al menos una muestra'],
    ]
    for (const [nombre, cambiar, campo, mensaje] of mensajes) {
      const error = nombre === null ? errorDe(() => validarCuerpoTelemetria(null)) : conCambio(cuerpo, cambiar)
      verificar(`validación (${nombre ?? 'cuerpo nulo'}): ${mensaje}`, error?.campo === campo && error?.message === mensaje, `${error?.campo} | ${error?.message}`)
    }
    const caidaSinMuestras = conCambio(cuerpo, (c) => {
      c.episodio.disparador = 'caida_velocidad'
      c.episodio.serie = []
    })
    verificar('con el disparador caida_velocidad la serie puede venir vacía', caidaSinMuestras === null, caidaSinMuestras?.message)

    const largo = JSON.parse(JSON.stringify(cuerpo))
    largo.episodio.serie = Array.from({ length: 1500 }, (_, i) => [i - 700, i === 1400 ? 300 : 0.1, 0, 0, null, null, null])
    const { resultado: recortado, avisos } = conAvisos(() => validarCuerpoTelemetria(largo))
    verificar(
      'una serie de 1500 muestras se recorta a 1000 alrededor del pico y queda marcada',
      recortado.episodio.recortada === true && recortado.episodio.serie.length === 1000 && recortado.episodio.serie.some((f) => f[1] === 300),
    )
    verificar('y el recorte queda en el log', avisos.length === 1 && avisos[0][0] === '[telemetria] serie recortada', JSON.stringify(avisos))

    const legado = {
      serie: Array.from({ length: 40 }, (_, i) => ({ t: 180000 + i * 17, ax: i === 20 ? 117.7 : 0.2, ay: 0.1, az: 0.1, ...(i % 2 ? { gTotal: 1 } : {}), giro: i % 3 ? 3 : null })),
      origen: 'navegador',
      lat: -34.6037,
      lon: -58.3816,
    }
    verificar('esCuerpoLegado reconoce el cuerpo del detector anterior', esCuerpoLegado(legado) === true)
    verificar(
      'esCuerpoLegado no confunde el cuerpo nuevo ni un objeto con serie y campos',
      esCuerpoLegado(cuerpo) === false && esCuerpoLegado({ serie: [], campos: {} }) === false && esCuerpoLegado(null) === false,
    )
    const leido = decodificarCuerpoLegado(JSON.parse(JSON.stringify(legado)))
    verificar(
      'el cuerpo anterior con t desde 180000 queda relativo a su primera muestra',
      leido.serie[0].t === 0 && leido.serie[39].t === 39 * 17 && leido.recortada === false,
      `${leido.serie[0]?.t} ${leido.serie[39]?.t}`,
    )
    verificar(
      'gTotal ausente queda null, y origen y ubicación se reconstruyen',
      leido.serie[0].gTotal === null && leido.serie[1].gTotal === 1 && leido.origen === 'navegador' && leido.gps?.lat === -34.6037,
    )
    const negativo = errorDe(() => decodificarCuerpoLegado({ serie: [{ t: -1, ax: 0, ay: 0, az: 0 }] }))
    verificar('el cuerpo anterior con t negativo se rechaza', negativo?.message === 'serie[0].t no puede ser negativo', negativo?.message)
    const quieto = errorDe(() => decodificarCuerpoLegado({ serie: [{ t: 5, ax: 0, ay: 0, az: 0 }, { t: 5, ax: 0, ay: 0, az: 0 }] }))
    verificar('el cuerpo anterior con t que no crece se rechaza', quieto?.message === 'serie[1].t no crece respecto de la muestra anterior', quieto?.message)

    const quizas = errorDe(() => validarCuerpoRespuesta({ respuesta: 'quizas' }))
    verificar(
      'una respuesta que no existe dice cuáles valen',
      quizas?.campo === 'respuesta' && quizas.message === 'Respuesta no válida. Las posibles son: estoy_bien, necesito_ayuda, sin_respuesta.',
      quizas?.message,
    )
    verificar(
      'una respuesta sin hubo_choque ni hora queda con null en los dos',
      JSON.stringify(validarCuerpoRespuesta({ respuesta: 'necesito_ayuda' })) === '{"respuesta":"necesito_ayuda","hubo_choque":null,"en_telefono":null}',
    )
    verificar(
      'una respuesta completa se reconstruye',
      JSON.stringify(validarCuerpoRespuesta({ respuesta: 'estoy_bien', hubo_choque: false, en_telefono: '2026-09-16T17:33:02.000Z', extra: 1 })) ===
        '{"respuesta":"estoy_bien","hubo_choque":false,"en_telefono":"2026-09-16T17:33:02.000Z"}',
    )

    const lote = {
      aviso_version: '2026-09-16',
      version_motor: 1,
      plataforma: 'ios',
      enviado_en: '2026-09-16T17:40:00.000Z',
      eventos: [
        ['0b8f2d9e-6c4a-4a1b-8e3f-2d1c0b9a8e7f', 'frenada', '2026-09-16T17:38:12.500Z', 58.4, 30.2, 1800, 0.52, 0.61],
        ['5a1e3c7b-9d2f-4b6a-8c0e-1f2a3b4c5d6e', 'golpe_en_marcha', '2026-09-16T17:39:01.020Z', 47, 45.5, null, null, 6.3],
      ],
    }
    verificar('el lote del ejemplo del índice es válido', validarLoteConduccion(JSON.parse(JSON.stringify(lote))).eventos.length === 2)
    const erroresLote = [
      [(l) => (l.eventos[1][3] = 301), 'eventos[1].kmh_inicial', 'eventos[1].kmh_inicial está fuera de rango (0 a 300)'],
      [(l) => (l.eventos[0][1] = 'derrape'), 'eventos[0].tipo', 'eventos[0].tipo tiene que ser uno de: frenada, aceleracion, golpe_en_marcha, caida_silenciosa'],
      [(l) => (l.eventos[0][5] = 12.5), 'eventos[0].duracion_ms', 'eventos[0].duracion_ms tiene que ser un número entero'],
      [(l) => (l.eventos[0][0] = 'corto'), 'eventos[0].id_cliente', 'eventos[0].id_cliente tiene que tener de 8 a 64 letras, números o guiones'],
      [(l) => (l.eventos = Array.from({ length: 51 }, () => l.eventos[0])), 'eventos', 'eventos tiene 51 eventos: el máximo es 50'],
      [(l) => (l.eventos = []), 'eventos', 'eventos está vacía: tiene que traer al menos un evento'],
    ]
    for (const [cambiar, campo, mensaje] of erroresLote) {
      const error = conCambio(lote, cambiar, validarLoteConduccion)
      verificar(`lote: ${mensaje}`, error?.campo === campo && error?.message === mensaje, `${error?.campo} | ${error?.message}`)
    }

    const res = errorApi('prueba', new ErrorTransporte('serie[37].ax', 'serie[37].ax no es un número'), 'No se pudo.')
    const cuerpoError = await res.json()
    verificar(
      'errorApi traduce ErrorTransporte a 400 con el campo',
      res.status === 400 && cuerpoError.tipo === 'transporte' && cuerpoError.campo === 'serie[37].ax' && cuerpoError.error === 'serie[37].ax no es un número',
      `${res.status} ${JSON.stringify(cuerpoError)}`,
    )
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
  FALLA [V1] terminó sin excepciones Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\lib\transporte-viaje.ts' imported from C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\prueba-viaje.mjs
```

con `70/71 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: Crear `lib/transporte-viaje.ts`**

```ts
import { UMBRALES, GRAVEDAD_MS2, MAX_MUESTRAS_EPISODIO, MAX_VELOCIDADES_EPISODIO, recortarEpisodio, redondearEpisodio, type DisparadorEpisodio, type EpisodioImpacto, type FuenteAceleracion, type Lectura, type NivelImpacto, type RespuestaAlerta, type Umbrales, type Veredicto } from './impacto'

/**
 * Formato compacto del modo viaje y su validación, compartidos por el motor del teléfono y el
 * servidor.
 *
 * Vive aparte de lib/impacto.ts para que el servidor valide sin cargar la detección y para que
 * el teléfono nunca importe pg: este módulo sólo depende de las reglas puras.
 *
 * La validación RECONSTRUYE desde una lista cerrada de campos y nunca guarda el objeto que
 * llegó: así no entran claves de más, anidamientos arbitrarios ni un null que Number()
 * convertiría en 0. Cada error nombra el campo con su posición, para que se sepa qué arreglar.
 */

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
  constructor(
    readonly campo: string,
    mensaje: string,
  ) {
    super(mensaje)
    this.name = 'ErrorTransporte'
  }
}

const PLATAFORMAS: readonly Plataforma[] = ['ios', 'android', 'otro']
const APERTURAS: readonly AperturaAlerta[] = ['episodio', 'seguimiento']
const NIVELES: readonly NivelImpacto[] = ['nada', 'sospecha', 'confirmado']
const RESPUESTAS: readonly RespuestaAlerta[] = ['estoy_bien', 'necesito_ayuda', 'sin_respuesta']
const DISPARADORES: readonly DisparadorEpisodio[] = ['golpe', 'caida_velocidad']
const FUENTES: readonly FuenteAceleracion[] = ['confiable', 'derivada']
const TIPOS_EVENTO: readonly TipoEventoConduccion[] = ['frenada', 'aceleracion', 'golpe_en_marcha', 'caida_silenciosa']

const ID_CLIENTE = /^[A-Za-z0-9-]{8,64}$/
/** Dentro de un episodio, t es relativo al disparo: dos minutos para cada lado sobran. */
const MAX_T_EPISODIO_MS = 120_000
/** Más de esto se rechaza; entre MAX_MUESTRAS_EPISODIO y esto, se recorta alrededor del pico. */
const MAX_MUESTRAS_ACEPTADAS = 3000
const MAX_A_MS2 = 50 * GRAVEDAD_MS2

type Crudo = Record<string, unknown>

const esObjeto = (valor: unknown): valor is Crudo => typeof valor === 'object' && valor !== null && !Array.isArray(valor)

function obligatorio(crudo: Crudo, clave: string, ruta: string): unknown {
  const valor = crudo[clave]
  if (valor === undefined) throw new ErrorTransporte(ruta, `falta ${ruta}`)
  return valor
}

/** Nunca Number(valor): Number(null) da 0 y Number('') también. */
function finito(valor: unknown, ruta: string): number {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) throw new ErrorTransporte(ruta, `${ruta} no es un número`)
  return valor
}

function numero(valor: unknown, ruta: string, minimo: number, maximo: number): number {
  const n = finito(valor, ruta)
  if (n < minimo || n > maximo) throw new ErrorTransporte(ruta, `${ruta} está fuera de rango (${minimo} a ${maximo})`)
  return n
}

function numeroONulo(valor: unknown, ruta: string, minimo: number, maximo: number): number | null {
  return valor === null ? null : numero(valor, ruta, minimo, maximo)
}

function entero(valor: unknown, ruta: string, minimo: number, maximo: number): number {
  const n = numero(valor, ruta, minimo, maximo)
  if (!Number.isInteger(n)) throw new ErrorTransporte(ruta, `${ruta} tiene que ser un número entero`)
  return n
}

function texto(valor: unknown, ruta: string, maximo: number): string {
  if (typeof valor !== 'string' || valor.length > maximo) {
    throw new ErrorTransporte(ruta, `${ruta} tiene que ser un texto de hasta ${maximo} caracteres`)
  }
  return valor
}

function idCliente(valor: unknown, ruta: string): string {
  const id = texto(valor, ruta, 64)
  if (!ID_CLIENTE.test(id)) throw new ErrorTransporte(ruta, `${ruta} tiene que tener de 8 a 64 letras, números o guiones`)
  return id
}

function fecha(valor: unknown, ruta: string): string {
  if (typeof valor !== 'string' || valor.length > 40 || !Number.isFinite(Date.parse(valor))) {
    throw new ErrorTransporte(ruta, `${ruta} no es una fecha ISO 8601`)
  }
  return valor
}

function booleano(valor: unknown, ruta: string): boolean {
  if (typeof valor !== 'boolean') throw new ErrorTransporte(ruta, `${ruta} tiene que ser true o false`)
  return valor
}

function booleanoONulo(valor: unknown, ruta: string): boolean | null {
  if (valor !== null && typeof valor !== 'boolean') throw new ErrorTransporte(ruta, `${ruta} tiene que ser true, false o null`)
  return valor as boolean | null
}

function deLista<T extends string>(valor: unknown, ruta: string, opciones: readonly T[]): T {
  if (typeof valor !== 'string' || !(opciones as readonly string[]).includes(valor)) {
    throw new ErrorTransporte(ruta, `${ruta} tiene que ser uno de: ${opciones.join(', ')}`)
  }
  return valor as T
}

function lista(valor: unknown, ruta: string): unknown[] {
  if (!Array.isArray(valor)) throw new ErrorTransporte(ruta, `${ruta} tiene que ser una lista`)
  return valor
}

function fila(valor: unknown, ruta: string, largo: number): unknown[] {
  if (!Array.isArray(valor) || valor.length !== largo) {
    throw new ErrorTransporte(ruta, `${ruta} tiene que ser una lista de ${largo} valores`)
  }
  return valor
}

const aFilaSerie = (l: Lectura): FilaSerie => [l.t, l.ax, l.ay, l.az, l.gTotal ?? null, l.giro ?? null, l.h ?? null]

const aFilaVelocidad = (v: EpisodioImpacto['velocidades'][number]): FilaVelocidad => [v.t, v.kmh, v.precisionM, v.x, v.y]

/** Lo que manda el motor. Redondea con redondearEpisodio y arma filas; no valida. `ocurridoEnTelefono` en ms de pared. */
export function codificarEpisodio(
  n: number,
  ocurridoEnTelefono: number,
  episodio: EpisodioImpacto,
  veredictoCliente: Veredicto,
): EpisodioTransportado {
  const redondeado = redondearEpisodio(episodio)
  return {
    n,
    ocurrido_en_telefono: new Date(ocurridoEnTelefono).toISOString(),
    disparador: redondeado.disparador,
    fuente: redondeado.fuente,
    hz_medido: redondeado.hzMedido,
    veredicto_cliente: veredictoCliente,
    serie: redondeado.serie.map(aFilaSerie),
    velocidades: redondeado.velocidades.map(aFilaVelocidad),
  }
}

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

/** Reconstruye y valida un episodio (reglas abajo). Lanza ErrorTransporte con la ruta del campo relativa al episodio: 'serie[37].ax'. */
export function decodificarEpisodio(crudo: unknown): EpisodioDecodificado {
  if (!esObjeto(crudo)) throw new ErrorTransporte('episodio', 'episodio tiene que ser un objeto con n, disparador, serie y velocidades, o null')

  const n = entero(obligatorio(crudo, 'n', 'n'), 'n', 1, 50)
  const ocurridoEnTelefono = fecha(obligatorio(crudo, 'ocurrido_en_telefono', 'ocurrido_en_telefono'), 'ocurrido_en_telefono')
  const disparador = deLista(obligatorio(crudo, 'disparador', 'disparador'), 'disparador', DISPARADORES)
  const fuente = deLista(obligatorio(crudo, 'fuente', 'fuente'), 'fuente', FUENTES)
  const hzMedido = numero(obligatorio(crudo, 'hz_medido', 'hz_medido'), 'hz_medido', 0, 1000)
  const veredictoCliente = veredictoBasico(crudo.veredicto_cliente)

  const filas = lista(obligatorio(crudo, 'serie', 'serie'), 'serie')
  if (filas.length > MAX_MUESTRAS_ACEPTADAS) {
    throw new ErrorTransporte('serie', `serie tiene ${filas.length} muestras: el máximo es ${MAX_MUESTRAS_EPISODIO}`)
  }
  if (filas.length === 0 && disparador === 'golpe') {
    throw new ErrorTransporte('serie', 'serie está vacía: con el disparador golpe tiene que traer al menos una muestra')
  }
  const serie: Lectura[] = []
  filas.forEach((crudaFila, i) => {
    const ruta = `serie[${i}]`
    const valores = fila(crudaFila, ruta, 7)
    const t = numero(valores[0], `${ruta}.t`, -MAX_T_EPISODIO_MS, MAX_T_EPISODIO_MS)
    if (i > 0 && t <= serie[i - 1].t) throw new ErrorTransporte(`${ruta}.t`, `${ruta}.t no crece respecto de la muestra anterior`)
    serie.push({
      t,
      ax: numero(valores[1], `${ruta}.ax`, -MAX_A_MS2, MAX_A_MS2),
      ay: numero(valores[2], `${ruta}.ay`, -MAX_A_MS2, MAX_A_MS2),
      az: numero(valores[3], `${ruta}.az`, -MAX_A_MS2, MAX_A_MS2),
      gTotal: numeroONulo(valores[4], `${ruta}.gTotal`, 0, 50),
      giro: numeroONulo(valores[5], `${ruta}.giro`, 0, 5000),
      h: numeroONulo(valores[6], `${ruta}.h`, 0, 50),
    })
  })

  const filasVelocidad = lista(obligatorio(crudo, 'velocidades', 'velocidades'), 'velocidades')
  if (filasVelocidad.length > MAX_VELOCIDADES_EPISODIO) {
    throw new ErrorTransporte('velocidades', `velocidades tiene ${filasVelocidad.length} lecturas: el máximo es ${MAX_VELOCIDADES_EPISODIO}`)
  }
  const velocidades: EpisodioImpacto['velocidades'] = []
  filasVelocidad.forEach((crudaFila, i) => {
    const ruta = `velocidades[${i}]`
    const valores = fila(crudaFila, ruta, 5)
    const t = numero(valores[0], `${ruta}.t`, -MAX_T_EPISODIO_MS, MAX_T_EPISODIO_MS)
    if (i > 0 && t <= velocidades[i - 1].t) throw new ErrorTransporte(`${ruta}.t`, `${ruta}.t no crece respecto de la lectura anterior`)
    velocidades.push({
      t,
      kmh: numeroONulo(valores[1], `${ruta}.kmh`, 0, 300),
      precisionM: numero(valores[2], `${ruta}.precision_m`, 0, 10000),
      x: numero(valores[3], `${ruta}.x`, -100000, 100000),
      y: numero(valores[4], `${ruta}.y`, -100000, 100000),
    })
  })

  // Nunca slice(0, MAX) ni slice(-MAX): el golpe puede estar en cualquier punta de lo que llegó.
  const recorte = recortarEpisodio({ disparador, fuente, hzMedido, serie, velocidades })
  if (recorte.recortada) {
    console.warn('[telemetria] serie recortada', { n, llegaron: serie.length, quedaron: recorte.episodio.serie.length })
  }
  return {
    n,
    ocurridoEnTelefono,
    episodio: recorte.episodio,
    veredictoCliente,
    recortada: recorte.recortada,
    serie: recorte.episodio.serie.map(aFilaSerie),
    velocidades: recorte.episodio.velocidades.map(aFilaVelocidad),
  }
}

/** Valida el cuerpo nuevo entero. Rutas: 'campos.<campo>' y, para el episodio, las de decodificarEpisodio. No valida aviso_version contra la lista (eso es del servidor). */
export function validarCuerpoTelemetria(crudo: unknown): { campos: CamposAlerta; episodio: EpisodioDecodificado | null } {
  if (!esObjeto(crudo)) throw new ErrorTransporte('cuerpo', 'el cuerpo tiene que ser un objeto JSON con campos y episodio')
  const c = obligatorio(crudo, 'campos', 'campos')
  if (!esObjeto(c)) throw new ErrorTransporte('campos', 'campos tiene que ser un objeto')

  // En el orden de CamposAlerta: el primer error que se informa es siempre el mismo.
  const id_cliente = idCliente(obligatorio(c, 'id_cliente', 'campos.id_cliente'), 'campos.id_cliente')
  const aviso_version = texto(obligatorio(c, 'aviso_version', 'campos.aviso_version'), 'campos.aviso_version', 40)
  const version_motor = entero(obligatorio(c, 'version_motor', 'campos.version_motor'), 'campos.version_motor', 1, 1000)
  const plataforma = deLista(obligatorio(c, 'plataforma', 'campos.plataforma'), 'campos.plataforma', PLATAFORMAS)
  const standalone = booleano(obligatorio(c, 'standalone', 'campos.standalone'), 'campos.standalone')
  const ocurrido_en_telefono = fecha(obligatorio(c, 'ocurrido_en_telefono', 'campos.ocurrido_en_telefono'), 'campos.ocurrido_en_telefono')
  const enviado_en = fecha(obligatorio(c, 'enviado_en', 'campos.enviado_en'), 'campos.enviado_en')
  const apertura = deLista(obligatorio(c, 'apertura', 'campos.apertura'), 'campos.apertura', APERTURAS)
  const nivel_cliente = deLista(obligatorio(c, 'nivel_cliente', 'campos.nivel_cliente'), 'campos.nivel_cliente', NIVELES)
  const alerta_mostrada = booleano(obligatorio(c, 'alerta_mostrada', 'campos.alerta_mostrada'), 'campos.alerta_mostrada')
  const sonido = booleanoONulo(obligatorio(c, 'sonido', 'campos.sonido'), 'campos.sonido')

  const respuestasCrudas = lista(obligatorio(c, 'respuestas', 'campos.respuestas'), 'campos.respuestas')
  if (respuestasCrudas.length > 5) {
    throw new ErrorTransporte('campos.respuestas', `campos.respuestas tiene ${respuestasCrudas.length} elementos: el máximo es 5`)
  }
  const respuestas = respuestasCrudas.map((crudaRespuesta, i): RespuestaTransportada => {
    const ruta = `campos.respuestas[${i}]`
    if (!esObjeto(crudaRespuesta)) throw new ErrorTransporte(ruta, `${ruta} tiene que ser un objeto con respuesta y en_telefono`)
    return {
      respuesta: deLista(obligatorio(crudaRespuesta, 'respuesta', `${ruta}.respuesta`), `${ruta}.respuesta`, RESPUESTAS),
      en_telefono: fecha(obligatorio(crudaRespuesta, 'en_telefono', `${ruta}.en_telefono`), `${ruta}.en_telefono`),
    }
  })

  const hubo_choque = booleanoONulo(obligatorio(c, 'hubo_choque', 'campos.hubo_choque'), 'campos.hubo_choque')
  const msCrudo = obligatorio(c, 'ms_hasta_respuesta', 'campos.ms_hasta_respuesta')
  const ms_hasta_respuesta = msCrudo === null ? null : entero(msCrudo, 'campos.ms_hasta_respuesta', 0, 86_400_000)
  const hz_medido = numeroONulo(obligatorio(c, 'hz_medido', 'campos.hz_medido'), 'campos.hz_medido', 0, 1000)
  const aceleracion_derivada = booleano(obligatorio(c, 'aceleracion_derivada', 'campos.aceleracion_derivada'), 'campos.aceleracion_derivada')

  const gpsCrudo = obligatorio(c, 'gps', 'campos.gps')
  let gps: GpsTransportado | null = null
  if (gpsCrudo !== null) {
    if (!esObjeto(gpsCrudo)) throw new ErrorTransporte('campos.gps', 'campos.gps tiene que ser un objeto con lat, lon y precision_m, o null')
    gps = {
      lat: numero(obligatorio(gpsCrudo, 'lat', 'campos.gps.lat'), 'campos.gps.lat', -90, 90),
      lon: numero(obligatorio(gpsCrudo, 'lon', 'campos.gps.lon'), 'campos.gps.lon', -180, 180),
      precision_m: numero(obligatorio(gpsCrudo, 'precision_m', 'campos.gps.precision_m'), 'campos.gps.precision_m', 0, 10000),
    }
  }

  const umbralesCrudos = obligatorio(c, 'umbrales_cliente', 'campos.umbrales_cliente')
  if (!esObjeto(umbralesCrudos)) throw new ErrorTransporte('campos.umbrales_cliente', 'campos.umbrales_cliente tiene que ser un objeto')
  // Sólo las claves que el servidor conoce, con número finito: las demás se descartan sin rechazar la alerta.
  const umbrales: Record<string, number> = {}
  for (const clave of Object.keys(UMBRALES)) {
    const valor = umbralesCrudos[clave]
    if (typeof valor === 'number' && Number.isFinite(valor)) umbrales[clave] = valor
  }

  const episodioCrudo = obligatorio(crudo, 'episodio', 'episodio')
  return {
    campos: {
      id_cliente,
      aviso_version,
      version_motor,
      plataforma,
      standalone,
      ocurrido_en_telefono,
      enviado_en,
      apertura,
      nivel_cliente,
      alerta_mostrada,
      sonido,
      respuestas,
      hubo_choque,
      ms_hasta_respuesta,
      hz_medido,
      aceleracion_derivada,
      gps,
      umbrales_cliente: umbrales as unknown as Umbrales,
    },
    episodio: episodioCrudo === null ? null : decodificarEpisodio(episodioCrudo),
  }
}

/** true si es un objeto con `serie` arreglo y sin `campos`: el cuerpo de DetectorImpacto.tsx. */
export function esCuerpoLegado(crudo: unknown): boolean {
  return esObjeto(crudo) && Array.isArray(crudo.serie) && crudo.campos === undefined
}

/**
 * Reconstruye { serie: Lectura[], origen, lat?, lon? } (hasta 3000 muestras; recorta a 1000 alrededor del pico). Lanza ErrorTransporte.
 * No aplica |t| ≤ 120000: DetectorImpacto.tsx mide t desde que se encendió y pasa de 120000 a los 2 minutos de viaje.
 * Acepta t finito ≥ 0 y estrictamente creciente y, antes de recortar, le resta a cada t el de la primera muestra
 * (la serie queda relativa a su comienzo, como espera analizarImpacto).
 */
export function decodificarCuerpoLegado(crudo: unknown): CuerpoTelemetriaLegado {
  if (!esObjeto(crudo)) throw new ErrorTransporte('cuerpo', 'el cuerpo tiene que ser un objeto JSON con serie y origen')
  const muestras = lista(obligatorio(crudo, 'serie', 'serie'), 'serie')
  if (muestras.length > MAX_MUESTRAS_ACEPTADAS) {
    throw new ErrorTransporte('serie', `serie tiene ${muestras.length} muestras: el máximo es ${MAX_MUESTRAS_EPISODIO}`)
  }
  if (muestras.length === 0) throw new ErrorTransporte('serie', 'serie está vacía: tiene que traer al menos una muestra')

  const leidas: Lectura[] = []
  muestras.forEach((muestra, i) => {
    const ruta = `serie[${i}]`
    if (!esObjeto(muestra)) throw new ErrorTransporte(ruta, `${ruta} tiene que ser un objeto con t, ax, ay y az`)
    const t = finito(obligatorio(muestra, 't', `${ruta}.t`), `${ruta}.t`)
    if (t < 0) throw new ErrorTransporte(`${ruta}.t`, `${ruta}.t no puede ser negativo`)
    if (i > 0 && t <= leidas[i - 1].t) throw new ErrorTransporte(`${ruta}.t`, `${ruta}.t no crece respecto de la muestra anterior`)
    leidas.push({
      t,
      ax: numero(obligatorio(muestra, 'ax', `${ruta}.ax`), `${ruta}.ax`, -MAX_A_MS2, MAX_A_MS2),
      ay: numero(obligatorio(muestra, 'ay', `${ruta}.ay`), `${ruta}.ay`, -MAX_A_MS2, MAX_A_MS2),
      az: numero(obligatorio(muestra, 'az', `${ruta}.az`), `${ruta}.az`, -MAX_A_MS2, MAX_A_MS2),
      // El detector anterior omite gTotal cuando el equipo no lo entrega y manda giro null sin giróscopo.
      gTotal: muestra.gTotal === undefined ? null : numeroONulo(muestra.gTotal, `${ruta}.gTotal`, 0, 50),
      giro: muestra.giro === undefined ? null : numeroONulo(muestra.giro, `${ruta}.giro`, 0, 5000),
      h: null,
    })
  })

  const inicio = leidas[0].t
  const serie = leidas.map((l) => ({ ...l, t: l.t - inicio }))
  const recorte = recortarEpisodio({ disparador: 'golpe', fuente: 'confiable', hzMedido: 0, serie, velocidades: [] })
  if (recorte.recortada) {
    console.warn('[telemetria] serie recortada', { detector: 'anterior', llegaron: serie.length, quedaron: recorte.episodio.serie.length })
  }

  const { lat, lon } = crudo
  const gps =
    typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    typeof lon === 'number' && Number.isFinite(lon) && lon >= -180 && lon <= 180
      ? { lat, lon }
      : null
  return {
    serie: recorte.episodio.serie,
    origen: typeof crudo.origen === 'string' ? crudo.origen.slice(0, 40) : 'navegador',
    gps,
    recortada: recorte.recortada,
  }
}

/** Lanza ErrorTransporte('respuesta', <texto servidor.respuesta_invalida>) si respuesta no es una de las tres. */
export function validarCuerpoRespuesta(crudo: unknown): CuerpoRespuesta {
  const c = esObjeto(crudo) ? crudo : {}
  if (typeof c.respuesta !== 'string' || !(RESPUESTAS as readonly string[]).includes(c.respuesta)) {
    throw new ErrorTransporte('respuesta', 'Respuesta no válida. Las posibles son: estoy_bien, necesito_ayuda, sin_respuesta.')
  }
  return {
    respuesta: c.respuesta as RespuestaAlerta,
    hubo_choque: c.hubo_choque === undefined ? null : booleanoONulo(c.hubo_choque, 'hubo_choque'),
    en_telefono: c.en_telefono === undefined || c.en_telefono === null ? null : fecha(c.en_telefono, 'en_telefono'),
  }
}

/** Reconstruye y valida el lote. Rutas: 'eventos[3].kmh_inicial'. */
export function validarLoteConduccion(crudo: unknown): LoteConduccion {
  if (!esObjeto(crudo)) {
    throw new ErrorTransporte('cuerpo', 'el cuerpo tiene que ser un objeto JSON con aviso_version, version_motor, plataforma, enviado_en y eventos')
  }
  const aviso_version = texto(obligatorio(crudo, 'aviso_version', 'aviso_version'), 'aviso_version', 40)
  const version_motor = entero(obligatorio(crudo, 'version_motor', 'version_motor'), 'version_motor', 1, 1000)
  const plataforma = deLista(obligatorio(crudo, 'plataforma', 'plataforma'), 'plataforma', PLATAFORMAS)
  const enviado_en = fecha(obligatorio(crudo, 'enviado_en', 'enviado_en'), 'enviado_en')
  const filas = lista(obligatorio(crudo, 'eventos', 'eventos'), 'eventos')
  if (filas.length === 0) throw new ErrorTransporte('eventos', 'eventos está vacía: tiene que traer al menos un evento')
  if (filas.length > MAX_EVENTOS_LOTE) {
    throw new ErrorTransporte('eventos', `eventos tiene ${filas.length} eventos: el máximo es ${MAX_EVENTOS_LOTE}`)
  }
  const eventos = filas.map((crudaFila, i): FilaEventoConduccion => {
    const ruta = `eventos[${i}]`
    const v = fila(crudaFila, ruta, 8)
    return [
      idCliente(v[0], `${ruta}.id_cliente`),
      deLista(v[1], `${ruta}.tipo`, TIPOS_EVENTO),
      fecha(v[2], `${ruta}.ocurrido_en_telefono`),
      numeroONulo(v[3], `${ruta}.kmh_inicial`, 0, 300),
      numeroONulo(v[4], `${ruta}.kmh_final`, 0, 300),
      v[5] === null ? null : entero(v[5], `${ruta}.duracion_ms`, 0, 600_000),
      numeroONulo(v[6], `${ruta}.g_estimada`, 0, 5),
      numeroONulo(v[7], `${ruta}.pico_g`, 0, 50),
    ]
  })
  return { aviso_version, version_motor, plataforma, enviado_en, eventos }
}
```

- [ ] **Step 4: Correr la prueba y ver que falta sólo la traducción**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: todo el bloque nuevo en `ok` salvo la última verificación. `errorApi` todavía no conoce `ErrorTransporte`: lo loguea (una línea que empieza con `[prueba] ErrorTransporte: serie[37].ax no es un número`, seguida de su pila) y contesta 500, así que aparece

```
  FALLA errorApi traduce ErrorTransporte a 400 con el campo 500 {"error":"No se pudo.","tipo":"interno"}
```

con `116/117 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 5: Traducir `ErrorTransporte` en `errorApi`**

En `lib/api.ts`, reemplazá:

```ts
import { ErrorLimite } from './limite'
import { ErrorAcceso } from './sesion'
```

por:

```ts
import { ErrorLimite } from './limite'
import { ErrorAcceso } from './sesion'
import { ErrorTransporte } from './transporte-viaje'
```

Y reemplazá:

```ts
      { status: 429, headers: { 'Retry-After': String(err.reintentarEnS) } },
    )
  }
```

por:

```ts
      { status: 429, headers: { 'Retry-After': String(err.reintentarEnS) } },
    )
  }

  // El campo va aparte del mensaje: la cola del teléfono decide con él si el problema es del episodio o de la alerta.
  if (err instanceof ErrorTransporte) {
    return NextResponse.json({ error: err.message, tipo: 'transporte', campo: err.campo }, { status: 400 })
  }
```

- [ ] **Step 6: Correr la prueba y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA`; entre otras,

```
  ok   decodificar lo codificado da exactamente el episodio redondeado
  ok   validación (null no es 0): serie[2].ax no es un número
  ok   una serie de 1500 muestras se recorta a 1000 alrededor del pico y queda marcada
  ok   el cuerpo anterior con t desde 180000 queda relativo a su primera muestra
  ok   errorApi traduce ErrorTransporte a 400 con el campo
```

y `117/117 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (incluye `  ok   ningún nombre se exporta desde dos módulos de lib/`); `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `117/117 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 8: Commit**

```bash
git add "lib/transporte-viaje.ts" "lib/api.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Validar el transporte del modo viaje reconstruyendo desde una lista cerrada

El servidor nunca guarda el objeto que llegó: arma uno nuevo campo por campo, sin Number()
sobre algo que no es un número (Number(null) da 0), y cada error dice la ruta del campo y qué
arreglar. Una serie de más de 1000 muestras se recorta alrededor del pico, nunca por una punta.

Vive en lib/transporte-viaje.ts para que el motor del teléfono lo use sin importar pg y el
servidor valide sin cargar la detección. Acepta además el cuerpo de DetectorImpacto.tsx
mientras queden teléfonos con esa versión, con el tiempo de la serie relativo a su comienzo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `lib/telemetria.ts` con el veredicto provisorio de F1

**Files:**
- Create: `lib/telemetria.ts`.
- Test: `scripts/prueba-viaje.mjs`, bloque nuevo al final de [V1] (las funciones puras). Las que tocan la base las prueba el e2e `[10c]` a `[10f]` de la Tarea 9, contra el servidor.

**Interfaces:**
- Consumes: `db()` y `nuevoId(prefijo)` de `lib/db.ts`; `canonico` y `sha256` de `lib/hash.ts`; `UMBRALES`, `analizarImpacto`, `nivelMayor`, `planEscalamiento` y los tipos `NivelImpacto`, `PlanEscalamiento`, `RespuestaAlerta`, `Umbrales`, `Veredicto` de `lib/impacto.ts` (Tarea 6); `ErrorTransporte` y los tipos `CamposAlerta`, `CuerpoRespuesta`, `CuerpoTelemetriaLegado`, `EpisodioDecodificado`, `FilaSerie`, `LoteConduccion` de `lib/transporte-viaje.ts` (Tarea 7); `randomUUID` de `node:crypto`; el tipo `PoolClient` de `pg`. No importa `./casos` ni `./posesion`.
- Produces (índice, «Interfaces › `lib/telemetria.ts`»):
  - `AVISOS_DATOS_CONOCIDOS: readonly string[] = ['2026-09-16']` y `MENSAJE_TELEMETRIA_AJENA`.
  - `interface ConfiguracionModoViaje` y `configuracionModoViaje(): ConfiguracionModoViaje`.
  - `interface QuienPide { huella: string | null; usuarioId: string | null }`, `interface DuenioTelemetria`, `accesoTelemetria(fila: DuenioTelemetria, quien: QuienPide, ahoraMs: number): boolean`.
  - `horaTelefonoAceptable(ocurridoEn: string, enviadoEn: string, recibidoEnMs: number): { aceptada: string | null; desfaseMs: number | null }`.
  - `interface ResultadoTelemetria { id; nueva; nivel; plan }`, `guardarTelemetria(cuerpo, quien: { huella: string; usuarioId: string | null }, recibidoEnMs: number): Promise<ResultadoTelemetria>` y `guardarTelemetriaLegada(cuerpo: CuerpoTelemetriaLegado, quien): Promise<ResultadoTelemetria & { veredicto: Veredicto }>`.
  - `interface LecturaTelemetria`, `leerTelemetriaPropia(id: string, quien: QuienPide): Promise<LecturaTelemetria | null>`.
  - `responderTelemetria(id: string, cuerpo: CuerpoRespuesta, quien: QuienPide): Promise<{ id: string; plan: PlanEscalamiento } | null>`.
  - `borrarTelemetriaPropia(quien: { huellaTelemetria: string | null; huellaConduccion: string | null; usuarioId: string | null }): Promise<{ alertas: number; eventos_conduccion: number }>`.
  - `guardarEventosConduccion(lote: LoteConduccion, huella: string, recibidoEnMs: number): Promise<{ guardados: number }>`.
  - Los usan las rutas de la Tarea 9; F5 importa `accesoTelemetria`, `QuienPide` y `configuracionModoViaje`; F2 cambia `analizarImpacto(episodio.episodio.serie)` por `evaluarEpisodio`.

**Decisiones de esta tarea:**
- `configuracionModoViaje()` se calcula una vez por proceso y queda en `globalThis.__actaConfiguracionModoViaje` (cada ruta puede cargar su copia del módulo en desarrollo). Los días de conservación no entran a `version`: no cambian lo que hace el teléfono.
- La fusión de respuestas se reduce en JavaScript a cuatro parámetros (la última humana, la `sin_respuesta` candidata —la primera anterior a toda humana—, las humanas y `hubo_choque`) y el SQL decide con la fila bloqueada si la candidata se escribe (`t.respuesta IS NULL`). El historial deduplica por `respuesta` y `en_telefono` con `@>`. `(t.xmax = 0)` distingue el alta (201) del reintento (200) en la misma sentencia.
- `responderTelemetria` sin `en_telefono` anota la hora del servidor en el historial.
- `guardarEventosConduccion` inserta el lote en una sola sentencia (`jsonb_to_recordset`) con `ON CONFLICT (dispositivo_sha256, id_cliente) DO NOTHING`: cada fila choca o entra por su cuenta, y `rowCount` es `guardados`.
- `borrarTelemetriaPropia` sin ninguna clave no abre conexión: devuelve ceros.
- Ninguna función registra eslabones ni anota en la bitácora (Riesgo 10).

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección [V1] de `scripts/prueba-viaje.mjs` (antes de su `})`, con una línea vacía antes):

```js
  /* ---- Telemetría: acceso, hora del teléfono y configuración ---- */
  {
    const telemetria = await import('../lib/telemetria.ts')
    const { canonico, sha256 } = await import('../lib/hash.ts')
    const { UMBRALES } = await import('../lib/impacto.ts')
    const { accesoTelemetria, horaTelefonoAceptable } = telemetria

    verificar('el servidor conoce la versión del aviso de datos de esta etapa', telemetria.AVISOS_DATOS_CONOCIDOS?.includes('2026-09-16'))
    verificar(
      'el 404 de una detección ajena es el mismo que el de una que no existe',
      telemetria.MENSAJE_TELEMETRIA_AJENA === 'No encontramos esa detección en este teléfono. Si ya no la tenés, abrí la actuación con "Tuve un accidente".',
    )

    const ahora = Date.UTC(2026, 8, 16, 18, 0)
    const hace = (ms) => new Date(ahora - ms)
    const HORA = 3_600_000
    const casosAcceso = [
      ['fila vieja sin huella: la sesión de su usuario la lee', { usuario_id: 'U1', dispositivo_sha256: null, recibido_en: hace(HORA) }, { huella: 'h1', usuarioId: 'U1' }, true],
      ['fila vieja sin huella: otra sesión no', { usuario_id: 'U1', dispositivo_sha256: null, recibido_en: hace(HORA) }, { huella: 'h1', usuarioId: 'U2' }, false],
      ['fila vieja sin huella ni usuario: nadie', { usuario_id: null, dispositivo_sha256: null, recibido_en: hace(HORA) }, { huella: null, usuarioId: null }, false],
      ['sin cuenta: la misma huella', { usuario_id: null, dispositivo_sha256: 'h1', recibido_en: hace(40 * 24 * HORA) }, { huella: 'h1', usuarioId: null }, true],
      ['sin cuenta: otra huella no', { usuario_id: null, dispositivo_sha256: 'h1', recibido_en: hace(HORA) }, { huella: 'h2', usuarioId: 'U1' }, false],
      ['sin cuenta: sin cookie no', { usuario_id: null, dispositivo_sha256: 'h1', recibido_en: hace(HORA) }, { huella: null, usuarioId: null }, false],
      ['con cuenta: la sesión de ese usuario desde otro teléfono', { usuario_id: 'U1', dispositivo_sha256: 'h1', recibido_en: hace(40 * 24 * HORA) }, { huella: 'h9', usuarioId: 'U1' }, true],
      ['con cuenta: la misma huella a las 24 h justas', { usuario_id: 'U1', dispositivo_sha256: 'h1', recibido_en: hace(24 * HORA) }, { huella: 'h1', usuarioId: null }, true],
      ['con cuenta: la misma huella pasadas las 24 h no', { usuario_id: 'U1', dispositivo_sha256: 'h1', recibido_en: hace(24 * HORA + 1) }, { huella: 'h1', usuarioId: null }, false],
      ['con cuenta: recibido_en como texto ISO', { usuario_id: 'U1', dispositivo_sha256: 'h1', recibido_en: hace(HORA).toISOString() }, { huella: 'h1', usuarioId: null }, true],
    ]
    for (const [nombre, fila, quien, esperado] of casosAcceso) {
      verificar(`accesoTelemetria, ${nombre}`, accesoTelemetria(fila, quien, ahora) === esperado)
    }

    const avisos = []
    const warnOriginal = console.warn
    console.warn = (...args) => avisos.push(args)
    try {
      const recibido = Date.UTC(2026, 9, 1, 12, 0, 0)
      const enHora = horaTelefonoAceptable('2026-10-01T11:59:30.000Z', '2026-10-01T11:59:59.000Z', recibido)
      verificar('una hora del teléfono en rango se acepta tal como vino', enHora.aceptada === '2026-10-01T11:59:30.000Z' && enHora.desfaseMs === 1000, JSON.stringify(enHora))
      // Reloj del teléfono 300 s adelantado: ocurrido y enviado vienen corridos igual y el desfase lo corrige.
      const corrido = horaTelefonoAceptable('2026-10-01T12:04:30.000Z', '2026-10-01T12:05:00.000Z', recibido)
      verificar('con el reloj del teléfono corrido, el desfase la corrige', corrido.aceptada === '2026-10-01T12:04:30.000Z' && corrido.desfaseMs === -300000, JSON.stringify(corrido))
      const vieja = horaTelefonoAceptable('2026-09-29T11:00:00.000Z', '2026-10-01T11:59:59.000Z', recibido)
      verificar('una hora de más de 24 h antes no se acepta', vieja.aceptada === null && vieja.desfaseMs === 1000, JSON.stringify(vieja))
      const futura = horaTelefonoAceptable('2026-10-01T12:06:00.000Z', '2026-10-01T12:00:00.000Z', recibido)
      verificar('una hora de más de 5 min después no se acepta', futura.aceptada === null, JSON.stringify(futura))
      const sinEnvio = horaTelefonoAceptable('2026-10-01T11:59:30.000Z', 'ayer', recibido)
      verificar('sin enviado_en legible no hay desfase', sinEnvio.aceptada === null && sinEnvio.desfaseMs === null, JSON.stringify(sinEnvio))
      verificar(
        'cada hora rechazada queda en el log',
        avisos.length === 3 && avisos.every((a) => a[0] === '[telemetria] hora del teléfono fuera de rango'),
        JSON.stringify(avisos.map((a) => a[0])),
      )
    } finally {
      console.warn = warnOriginal
    }

    const variables = ['MODO_VIAJE_ALERTA', 'MODO_VIAJE_CAIDA_SIN_GOLPE', 'MODO_VIAJE_MOTOR_MINIMO', 'TELEMETRIA_DIAS_CONSERVACION']
    const previas = Object.fromEntries(variables.map((v) => [v, process.env[v]]))
    const restaurar = () => {
      for (const v of variables) {
        if (previas[v] === undefined) delete process.env[v]
        else process.env[v] = previas[v]
      }
      // La configuración se calcula una vez por proceso y queda en globalThis: la prueba la olvida.
      delete globalThis.__actaConfiguracionModoViaje
    }
    try {
      for (const v of variables) delete process.env[v]
      delete globalThis.__actaConfiguracionModoViaje
      const configuracion = telemetria.configuracionModoViaje()
      verificar(
        'la configuración por omisión es normal, silenciosa, motor 1 y 90 días',
        configuracion.alerta === 'normal' && configuracion.caida_sin_golpe === 'silenciosa' && configuracion.motor_minimo === 1 && configuracion.dias_conservacion === 90,
        JSON.stringify(configuracion),
      )
      verificar(
        'la versión es el hash canónico de lo que cambia el comportamiento del teléfono',
        configuracion.version === sha256(canonico({ alerta: 'normal', caida_sin_golpe: 'silenciosa', motor_minimo: 1, umbrales: UMBRALES })).slice(0, 16),
        configuracion.version,
      )
      verificar('la configuración se calcula una vez por proceso', telemetria.configuracionModoViaje() === configuracion)

      delete globalThis.__actaConfiguracionModoViaje
      process.env.MODO_VIAJE_ALERTA = 'a veces'
      process.env.TELEMETRIA_DIAS_CONSERVACION = '0'
      const avisosConfiguracion = []
      console.warn = (...args) => avisosConfiguracion.push(args)
      let invalida
      try {
        invalida = telemetria.configuracionModoViaje()
        telemetria.configuracionModoViaje()
      } finally {
        console.warn = warnOriginal
      }
      verificar(
        'un valor inválido usa la omisión',
        invalida.alerta === 'normal' && invalida.dias_conservacion === 90 && invalida.version === configuracion.version,
        JSON.stringify(invalida),
      )
      verificar(
        'y se loguea una sola vez, diciendo qué poner',
        avisosConfiguracion.length === 2 && String(avisosConfiguracion[0][0]).includes('MODO_VIAJE_ALERTA="a veces" no es válido: tiene que ser normal, silenciosa, apagada.'),
        JSON.stringify(avisosConfiguracion),
      )
      delete globalThis.__actaConfiguracionModoViaje
      delete process.env.TELEMETRIA_DIAS_CONSERVACION
      process.env.MODO_VIAJE_ALERTA = 'silenciosa'
      verificar('otra configuración da otra versión', telemetria.configuracionModoViaje().version !== configuracion.version)
    } finally {
      restaurar()
    }
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
  FALLA [V1] terminó sin excepciones Error [ERR_MODULE_NOT_FOUND]: Cannot find module 'C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\lib\telemetria.ts' imported from C:\Users\mateo\OneDrive\Desktop\Proyectos\mvp aseguradora\scripts\prueba-viaje.mjs
```

con `117/118 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: Crear `lib/telemetria.ts`**

```ts
import { randomUUID } from 'node:crypto'
import type { PoolClient } from 'pg'
import { db, nuevoId } from './db'
import { canonico, sha256 } from './hash'
import { UMBRALES, analizarImpacto, nivelMayor, planEscalamiento, type NivelImpacto, type PlanEscalamiento, type RespuestaAlerta, type Umbrales, type Veredicto } from './impacto'
import { ErrorTransporte, type CamposAlerta, type CuerpoRespuesta, type CuerpoTelemetriaLegado, type EpisodioDecodificado, type FilaSerie, type LoteConduccion } from './transporte-viaje'

/**
 * Servidor del modo viaje: configuración remota, acceso por posesión del teléfono, alertas,
 * episodios, respuestas y eventos de conducción.
 *
 * Nada de esto es la cadena de custodia. Ninguna función de acá registra un eslabón: una
 * alerta puede responderse o borrarse después de que la actuación vinculada se selló, y un
 * eslabón posterior al sellado haría que el verificador público denuncie como alterado un
 * expediente intacto. El único eslabón del modo viaje lo escribe el alta de la actuación.
 */

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

const cache = globalThis as unknown as { __actaConfiguracionModoViaje?: ConfiguracionModoViaje }

/** El valor de la variable si está en la lista; si no, la omisión, con un aviso que dice qué poner. */
function opcionDelEntorno<T extends string>(nombre: string, opciones: readonly T[], omision: T): T {
  const crudo = process.env[nombre]
  if (crudo === undefined || crudo.trim() === '') return omision
  if ((opciones as readonly string[]).includes(crudo.trim())) return crudo.trim() as T
  console.warn(`[modo viaje] ${nombre}="${crudo}" no es válido: tiene que ser ${opciones.join(', ')}. Se usa ${omision}.`)
  return omision
}

function enteroDelEntorno(nombre: string, omision: number): number {
  const crudo = process.env[nombre]
  if (crudo === undefined || crudo.trim() === '') return omision
  const valor = Number(crudo)
  if (Number.isInteger(valor) && valor >= 1) return valor
  console.warn(`[modo viaje] ${nombre}="${crudo}" no es válido: tiene que ser un entero de 1 o más. Se usa ${omision}.`)
  return omision
}

/**
 * Calculada una vez por proceso: umbrales = UMBRALES; MODO_VIAJE_ALERTA ('normal' por omisión),
 * MODO_VIAJE_CAIDA_SIN_GOLPE ('silenciosa'), MODO_VIAJE_MOTOR_MINIMO (entero ≥ 1; 1),
 * TELEMETRIA_DIAS_CONSERVACION (entero ≥ 1; 90). Un valor inválido usa la omisión y se loguea una vez.
 */
export function configuracionModoViaje(): ConfiguracionModoViaje {
  if (!cache.__actaConfiguracionModoViaje) {
    const alerta = opcionDelEntorno('MODO_VIAJE_ALERTA', ['normal', 'silenciosa', 'apagada'] as const, 'normal')
    const caida_sin_golpe = opcionDelEntorno('MODO_VIAJE_CAIDA_SIN_GOLPE', ['alerta', 'silenciosa'] as const, 'silenciosa')
    const motor_minimo = enteroDelEntorno('MODO_VIAJE_MOTOR_MINIMO', 1)
    const dias_conservacion = enteroDelEntorno('TELEMETRIA_DIAS_CONSERVACION', 90)
    // La versión cambia con todo lo que cambia el comportamiento del teléfono, no con los días de conservación.
    const version = sha256(canonico({ alerta, caida_sin_golpe, motor_minimo, umbrales: UMBRALES })).slice(0, 16)
    cache.__actaConfiguracionModoViaje = { version, umbrales: UMBRALES, alerta, caida_sin_golpe, motor_minimo, dias_conservacion }
  }
  return cache.__actaConfiguracionModoViaje
}

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

const DIA_MS = 24 * 60 * 60 * 1000

/**
 * §5.1. Sin dispositivo_sha256 (filas viejas): sólo la sesión de su usuario_id (sin usuario_id, nadie).
 * Sin usuario_id: la misma huella. Con usuario_id: la sesión de ese usuario, o la misma huella dentro de las
 * 24 h desde recibido_en. Pura.
 */
export function accesoTelemetria(fila: DuenioTelemetria, quien: QuienPide, ahoraMs: number): boolean {
  const sesionDelDuenio = Boolean(fila.usuario_id) && fila.usuario_id === quien.usuarioId
  if (!fila.dispositivo_sha256) return sesionDelDuenio
  const mismaHuella = Boolean(quien.huella) && quien.huella === fila.dispositivo_sha256
  if (!fila.usuario_id) return mismaHuella
  if (sesionDelDuenio) return true
  /*
   * Con cuenta, la huella vale sólo un día: un teléfono prestado o vendido no tiene por qué
   * seguir viendo la ubicación de las alertas de otra persona. Después, sólo con la sesión.
   */
  const recibido = fila.recibido_en === null ? NaN : new Date(fila.recibido_en).getTime()
  return mismaHuella && Number.isFinite(recibido) && ahoraMs - recibido <= DIA_MS
}

/**
 * desfase = recibidoEnMs − enviado_en. La hora del teléfono se acepta si ocurrido_en + desfase cae entre
 * recibidoEnMs − 24 h y recibidoEnMs + 5 min; se devuelve la ISO del teléfono tal como vino. Si no, aceptada
 * null y console.warn('[telemetria] hora del teléfono fuera de rango', …). desfaseMs es entero; null si
 * enviado_en no es fecha.
 */
export function horaTelefonoAceptable(ocurridoEn: string, enviadoEn: string, recibidoEnMs: number): { aceptada: string | null; desfaseMs: number | null } {
  const enviado = Date.parse(enviadoEn)
  if (!Number.isFinite(enviado)) {
    console.warn('[telemetria] hora del teléfono fuera de rango', { ocurridoEn, enviadoEn, motivo: 'enviado_en no es una fecha' })
    return { aceptada: null, desfaseMs: null }
  }
  const desfaseMs = Math.round(recibidoEnMs - enviado)
  // Corregida por el desfase, la hora queda en el reloj del servidor aunque el del teléfono esté corrido.
  const corregida = Date.parse(ocurridoEn) + desfaseMs
  if (Number.isFinite(corregida) && corregida >= recibidoEnMs - DIA_MS && corregida <= recibidoEnMs + 5 * 60 * 1000) {
    return { aceptada: ocurridoEn, desfaseMs }
  }
  console.warn('[telemetria] hora del teléfono fuera de rango', { ocurridoEn, enviadoEn, desfaseMs })
  return { aceptada: null, desfaseMs }
}

export interface ResultadoTelemetria {
  id: string
  /** true si la alerta se creó en este pedido (201); false si ya existía (200). */
  nueva: boolean
  /** telemetria.nivel después de recalcularlo. */
  nivel: NivelImpacto
  /** planEscalamiento({ nivel: nivelMayor(nivel, nivel_cliente), alertaMostrada: alerta_mostrada }, respuesta). */
  plan: PlanEscalamiento
}

function exigirAvisoConocido(avisoVersion: string): void {
  if (!AVISOS_DATOS_CONOCIDOS.includes(avisoVersion)) {
    throw new ErrorTransporte(
      'campos.aviso_version',
      `La versión del aviso de datos "${avisoVersion}" no la conoce el servidor: cerrá y volvé a abrir la aplicación para actualizarla.`,
    )
  }
}

/** Lo que hace falta de la fila para contestar con el plan. */
interface EstadoAlerta {
  id: string
  nivel: NivelImpacto
  nivel_cliente: NivelImpacto | null
  respuesta: RespuestaAlerta | null
  alerta_mostrada: boolean | null
  hubo_choque: boolean | null
}

const planDe = (fila: EstadoAlerta): PlanEscalamiento =>
  planEscalamiento({ nivel: nivelMayor(fila.nivel, fila.nivel_cliente), alertaMostrada: fila.alerta_mostrada !== false }, fila.respuesta)

/**
 * Las respuestas que llegan, reducidas a lo que necesita una sola sentencia de SQL.
 *
 * Aplicadas en orden sobre la respuesta guardada: una humana (estoy_bien, necesito_ayuda) se
 * escribe siempre; sin_respuesta sólo si todavía no hay ninguna. Por eso de todas las
 * sin_respuesta cuenta, como mucho, la primera anterior a toda humana, y sólo si la fila no
 * tenía respuesta: eso lo decide el SQL, que es el único que ve la fila bloqueada.
 */
function reducirRespuestas(respuestas: Array<{ respuesta: RespuestaAlerta; en_telefono: string }>): {
  ultimaHumana: RespuestaAlerta | null
  sinRespuesta: string
  humanas: string
} {
  const vistas = new Set<string>()
  const humanas: Array<{ respuesta: RespuestaAlerta; en_telefono: string }> = []
  let sinRespuesta: Array<{ respuesta: RespuestaAlerta; en_telefono: string }> = []
  for (const { respuesta, en_telefono } of respuestas) {
    const clave = `${respuesta}|${en_telefono}`
    if (vistas.has(clave)) continue
    vistas.add(clave)
    if (respuesta === 'sin_respuesta') {
      if (humanas.length === 0 && sinRespuesta.length === 0) sinRespuesta = [{ respuesta, en_telefono }]
    } else {
      humanas.push({ respuesta, en_telefono })
    }
  }
  return {
    ultimaHumana: humanas.length > 0 ? humanas[humanas.length - 1].respuesta : null,
    sinRespuesta: JSON.stringify(sinRespuesta),
    humanas: JSON.stringify(humanas),
  }
}

/*
 * La fusión de respuestas, compartida por el upsert de la alerta y por POST …/respuesta.
 * $H: la última humana o NULL; $S: [la sin_respuesta candidata] o []; $L: las humanas; $C: hubo_choque.
 * En un UPDATE, t.respuesta es siempre el valor ANTERIOR de la fila: es lo que hace falta.
 */
function fusionRespuestas(h: string, s: string, l: string, c: string): string {
  return `
    respuesta = COALESCE(${h}::text, CASE WHEN t.respuesta IS NULL AND jsonb_array_length(${s}::jsonb) > 0 THEN 'sin_respuesta' END, t.respuesta),
    respondido_en = CASE WHEN jsonb_array_length(${l}::jsonb) > 0 OR (t.respuesta IS NULL AND jsonb_array_length(${s}::jsonb) > 0) THEN now() ELSE t.respondido_en END,
    respuestas = t.respuestas || (
      SELECT COALESCE(jsonb_agg(e.valor || jsonb_build_object('recibido_en', now()) ORDER BY e.orden), '[]'::jsonb)
        FROM jsonb_array_elements(CASE WHEN t.respuesta IS NULL THEN ${s}::jsonb ELSE '[]'::jsonb END || ${l}::jsonb) WITH ORDINALITY AS e(valor, orden)
       WHERE NOT (t.respuestas @> jsonb_build_array(jsonb_build_object('respuesta', e.valor->>'respuesta', 'en_telefono', e.valor->>'en_telefono')))
    ),
    hubo_choque = COALESCE(${c}::boolean, t.hubo_choque)`
}

/** serie y velocidades de los episodios, fuera: una falsa alarma no guarda por dónde andaba la persona. */
async function borrarSeriesSiFalsaAlarma(cliente: PoolClient, alerta: EstadoAlerta): Promise<void> {
  if (alerta.hubo_choque === false) {
    await cliente.query('UPDATE telemetria_episodios SET serie = NULL, velocidades = NULL WHERE telemetria_id = $1', [alerta.id])
  }
}

const COLUMNAS_ESTADO = 't.id, t.nivel, t.nivel_cliente, t.respuesta, t.alerta_mostrada, t.hubo_choque'

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
): Promise<ResultadoTelemetria> {
  const { campos, episodio } = cuerpo
  exigirAvisoConocido(campos.aviso_version)
  const hora = horaTelefonoAceptable(campos.ocurrido_en_telefono, campos.enviado_en, recibidoEnMs)
  const respuestas = reducirRespuestas(campos.respuestas)

  const pg = await db()
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    /*
     * Una sola sentencia para el alta y para el reintento. El WHERE del ON CONFLICT es el
     * predicado del índice parcial: sin él Postgres no encuentra el índice y falla.
     * (xmax = 0) sólo es verdadero en la fila recién insertada: distingue 201 de 200.
     */
    const upsert = await cliente.query<EstadoAlerta & { nueva: boolean }>(
      `INSERT INTO telemetria AS t (
         id, usuario_id, origen, id_cliente, dispositivo_sha256, nivel, pico_g, veredicto,
         respuesta, respondido_en, respuestas, hubo_choque, gps, gps_precision_m, ms_hasta_respuesta,
         sonido, alerta_mostrada, nivel_cliente, ocurrido_en_telefono, enviado_en, desfase_reloj_ms,
         umbrales, umbrales_cliente, version_motor, plataforma, standalone, hz_medido,
         aceleracion_derivada, aviso_version, apertura
       ) VALUES (
         $1, $2, 'navegador', $3, $4, 'nada', NULL, '{}'::jsonb,
         COALESCE($5::text, CASE WHEN jsonb_array_length($6::jsonb) > 0 THEN 'sin_respuesta' END),
         CASE WHEN jsonb_array_length($6::jsonb) + jsonb_array_length($7::jsonb) > 0 THEN now() END,
         (SELECT COALESCE(jsonb_agg(e.valor || jsonb_build_object('recibido_en', now()) ORDER BY e.orden), '[]'::jsonb)
            FROM jsonb_array_elements($6::jsonb || $7::jsonb) WITH ORDINALITY AS e(valor, orden)),
         $8::boolean,
         CASE WHEN $8::boolean IS FALSE THEN NULL ELSE $9::jsonb END,
         $10::real, $11::integer, $12::boolean, $13::boolean, $14::text, $15::timestamptz, $16::timestamptz, $17::bigint,
         $18::jsonb, $19::jsonb, $20::integer, $21::text, $22::boolean, $23::real, $24::boolean, $25::text, $26::text
       )
       ON CONFLICT (dispositivo_sha256, id_cliente) WHERE id_cliente IS NOT NULL DO UPDATE SET
         ${fusionRespuestas('$5', '$6', '$7', '$8')},
         gps = CASE WHEN COALESCE($8::boolean, t.hubo_choque) IS FALSE THEN NULL ELSE COALESCE(t.gps, $9::jsonb) END,
         gps_precision_m = COALESCE(t.gps_precision_m, $10::real),
         ms_hasta_respuesta = COALESCE(t.ms_hasta_respuesta, $11::integer),
         sonido = COALESCE($12::boolean, t.sonido),
         alerta_mostrada = COALESCE(t.alerta_mostrada, false) OR $13::boolean,
         nivel_cliente = CASE
           WHEN t.nivel_cliente = 'confirmado' OR $14::text = 'confirmado' THEN 'confirmado'
           WHEN t.nivel_cliente = 'sospecha' OR $14::text = 'sospecha' THEN 'sospecha'
           ELSE $14::text END,
         ocurrido_en_telefono = COALESCE(t.ocurrido_en_telefono, $15::timestamptz),
         enviado_en = $16::timestamptz,
         desfase_reloj_ms = $17::bigint,
         umbrales = $18::jsonb,
         umbrales_cliente = $19::jsonb,
         version_motor = $20::integer,
         plataforma = $21::text,
         standalone = $22::boolean,
         hz_medido = $23::real,
         aceleracion_derivada = $24::boolean,
         aviso_version = $25::text,
         apertura = $26::text
       RETURNING ${COLUMNAS_ESTADO}, (t.xmax = 0) AS nueva`,
      [
        nuevoId('TEL'),
        quien.usuarioId,
        campos.id_cliente,
        quien.huella,
        respuestas.ultimaHumana,
        respuestas.sinRespuesta,
        respuestas.humanas,
        campos.hubo_choque,
        campos.gps === null ? null : JSON.stringify(campos.gps),
        campos.gps?.precision_m ?? null,
        campos.ms_hasta_respuesta,
        campos.sonido,
        campos.alerta_mostrada,
        campos.nivel_cliente,
        hora.aceptada,
        campos.enviado_en,
        hora.desfaseMs,
        JSON.stringify(configuracionModoViaje().umbrales),
        JSON.stringify(campos.umbrales_cliente),
        campos.version_motor,
        campos.plataforma,
        campos.standalone,
        campos.hz_medido,
        campos.aceleracion_derivada,
        campos.aviso_version,
        campos.apertura,
      ],
    )
    const alerta = upsert.rows[0]

    if (episodio) {
      const veredicto = analizarImpacto(episodio.episodio.serie)
      /*
       * La serie y las velocidades son la parte sensible: sólo se guardan si alguien vio un
       * posible choque (el servidor, el teléfono, o una alerta abierta por seguimiento que se
       * le mostró a una persona) y nunca en una falsa alarma confirmada.
       */
      const vale =
        alerta.hubo_choque !== false &&
        (veredicto.nivel !== 'nada' || (episodio.veredictoCliente !== null && episodio.veredictoCliente.nivel !== 'nada') || campos.apertura === 'seguimiento')
      await cliente.query(
        `INSERT INTO telemetria_episodios (id, telemetria_id, n, ocurrido_en_telefono, serie, velocidades, veredicto, veredicto_cliente, recortada)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (telemetria_id, n) DO UPDATE SET
           ocurrido_en_telefono = EXCLUDED.ocurrido_en_telefono,
           serie = EXCLUDED.serie,
           velocidades = EXCLUDED.velocidades,
           veredicto = EXCLUDED.veredicto,
           veredicto_cliente = EXCLUDED.veredicto_cliente,
           recortada = EXCLUDED.recortada`,
        [
          nuevoId('EPI'),
          alerta.id,
          episodio.n,
          horaTelefonoAceptable(episodio.ocurridoEnTelefono, campos.enviado_en, recibidoEnMs).aceptada,
          vale ? JSON.stringify(episodio.serie) : null,
          vale ? JSON.stringify(episodio.velocidades) : null,
          JSON.stringify(veredicto),
          episodio.veredictoCliente === null ? null : JSON.stringify(episodio.veredictoCliente),
          episodio.recortada,
        ],
      )
    }

    await borrarSeriesSiFalsaAlarma(cliente, alerta)

    // Sin episodios el subselect no da filas y la alerta queda como estaba.
    await cliente.query(
      `UPDATE telemetria SET nivel = m.nivel, pico_g = m.pico_g, veredicto = m.veredicto
         FROM (
           SELECT e.veredicto->>'nivel' AS nivel,
                  max((e.veredicto->>'picoG')::real) OVER () AS pico_g,
                  e.veredicto
             FROM telemetria_episodios e
            WHERE e.telemetria_id = $1
            ORDER BY CASE e.veredicto->>'nivel' WHEN 'confirmado' THEN 2 WHEN 'sospecha' THEN 1 ELSE 0 END DESC,
                     (e.veredicto->>'picoG')::real DESC NULLS LAST, e.n
            LIMIT 1
         ) m
        WHERE telemetria.id = $1`,
      [alerta.id],
    )
    const final = await cliente.query<EstadoAlerta>(`SELECT ${COLUMNAS_ESTADO} FROM telemetria t WHERE t.id = $1`, [alerta.id])
    await cliente.query('COMMIT')

    return { id: alerta.id, nueva: alerta.nueva, nivel: final.rows[0].nivel, plan: planDe(final.rows[0]) }
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }
}

/** Cuerpo del detector anterior: alerta nueva sin id_cliente con un episodio n = 1; alerta_mostrada true, apertura 'episodio', aviso_version null. */
export async function guardarTelemetriaLegada(
  cuerpo: CuerpoTelemetriaLegado,
  quien: { huella: string; usuarioId: string | null },
): Promise<ResultadoTelemetria & { veredicto: Veredicto }> {
  const veredicto = analizarImpacto(cuerpo.serie)
  const id = nuevoId('TEL')
  const filas: FilaSerie[] = cuerpo.serie.map((l) => [l.t, l.ax, l.ay, l.az, l.gTotal ?? null, l.giro ?? null, l.h ?? null])
  const vale = veredicto.nivel !== 'nada'

  const pg = await db()
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    await cliente.query(
      `INSERT INTO telemetria (id, usuario_id, origen, dispositivo_sha256, nivel, pico_g, veredicto, gps, alerta_mostrada, apertura, umbrales)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, 'episodio', $9)`,
      [
        id,
        quien.usuarioId,
        cuerpo.origen,
        quien.huella,
        veredicto.nivel,
        veredicto.picoG,
        JSON.stringify(veredicto),
        cuerpo.gps === null ? null : JSON.stringify(cuerpo.gps),
        JSON.stringify(configuracionModoViaje().umbrales),
      ],
    )
    await cliente.query(
      `INSERT INTO telemetria_episodios (id, telemetria_id, n, serie, velocidades, veredicto, recortada)
       VALUES ($1, $2, 1, $3, $4, $5, $6)`,
      [nuevoId('EPI'), id, vale ? JSON.stringify(filas) : null, vale ? '[]' : null, JSON.stringify(veredicto), cuerpo.recortada],
    )
    await cliente.query('COMMIT')
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }

  const plan = planEscalamiento({ nivel: veredicto.nivel, alertaMostrada: true }, null)
  return { id, nueva: true, nivel: veredicto.nivel, plan, veredicto }
}

export interface LecturaTelemetria {
  id: string
  /** ISO de coalesce(ocurrido_en_telefono, ts). */
  ocurrido_en: string
  nivel: NivelImpacto
  gps: { lat: number; lon: number; precision_m: number | null } | null
  respuesta: RespuestaAlerta | null
  hubo_choque: boolean | null
}

const numeroFinito = (valor: unknown): number | null => (typeof valor === 'number' && Number.isFinite(valor) ? valor : null)

/** null si no existe o si accesoTelemetria da false. */
export async function leerTelemetriaPropia(id: string, quien: QuienPide): Promise<LecturaTelemetria | null> {
  const pg = await db()
  const res = await pg.query(
    `SELECT id, usuario_id, dispositivo_sha256, recibido_en, nivel, gps, gps_precision_m, respuesta, hubo_choque,
            COALESCE(ocurrido_en_telefono, ts) AS ocurrido_en
       FROM telemetria WHERE id = $1`,
    [id],
  )
  const fila = res.rows[0]
  // «No existe» y «no es tuya» salen iguales: si no, el 404 dice qué ids existen.
  if (!fila || !accesoTelemetria(fila, quien, Date.now())) return null

  const gps = fila.gps as { lat?: unknown; lon?: unknown; precision_m?: unknown } | null
  const lat = numeroFinito(gps?.lat)
  const lon = numeroFinito(gps?.lon)
  return {
    id: fila.id,
    ocurrido_en: new Date(fila.ocurrido_en).toISOString(),
    nivel: fila.nivel,
    // Las filas anteriores al modo viaje guardaban { lat, lon } sin precisión.
    gps: lat === null || lon === null ? null : { lat, lon, precision_m: numeroFinito(gps?.precision_m) ?? numeroFinito(fila.gps_precision_m) },
    respuesta: fila.respuesta ?? null,
    hubo_choque: fila.hubo_choque ?? null,
  }
}

/** Misma fusión que el upsert, en una sola sentencia. null si no existe o no hay acceso. */
export async function responderTelemetria(id: string, cuerpo: CuerpoRespuesta, quien: QuienPide): Promise<{ id: string; plan: PlanEscalamiento } | null> {
  // Sin hora del teléfono (/aviso no la manda), la entrada del historial lleva la del servidor.
  const respuestas = reducirRespuestas([{ respuesta: cuerpo.respuesta, en_telefono: cuerpo.en_telefono ?? new Date().toISOString() }])
  const pg = await db()
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    const duenio = await cliente.query<DuenioTelemetria>(
      'SELECT usuario_id, dispositivo_sha256, recibido_en FROM telemetria WHERE id = $1 FOR UPDATE',
      [id],
    )
    if (!duenio.rows[0] || !accesoTelemetria(duenio.rows[0], quien, Date.now())) {
      await cliente.query('ROLLBACK')
      return null
    }
    const res = await cliente.query<EstadoAlerta>(
      `UPDATE telemetria AS t SET
         ${fusionRespuestas('$2', '$3', '$4', '$5')},
         gps = CASE WHEN COALESCE($5::boolean, t.hubo_choque) IS FALSE THEN NULL ELSE t.gps END
       WHERE t.id = $1
       RETURNING ${COLUMNAS_ESTADO}`,
      [id, respuestas.ultimaHumana, respuestas.sinRespuesta, respuestas.humanas, cuerpo.hubo_choque],
    )
    await borrarSeriesSiFalsaAlarma(cliente, res.rows[0])
    await cliente.query('COMMIT')
    return { id: res.rows[0].id, plan: planDe(res.rows[0]) }
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }
}

/** DELETE de telemetria con caso_id IS NULL y (dispositivo_sha256 = huellaTelemetria o usuario_id = usuarioId), y de eventos_conduccion con dispositivo_sha256 = huellaConduccion. Una clave null no borra nada. */
export async function borrarTelemetriaPropia(quien: { huellaTelemetria: string | null; huellaConduccion: string | null; usuarioId: string | null }): Promise<{ alertas: number; eventos_conduccion: number }> {
  if (!quien.huellaTelemetria && !quien.huellaConduccion && !quien.usuarioId) return { alertas: 0, eventos_conduccion: 0 }
  const pg = await db()
  const cliente = await pg.connect()
  try {
    await cliente.query('BEGIN')
    // Con caso_id la alerta ya es parte de una actuación: la borran anonimizar y expurgar, no este botón.
    const alertas = await cliente.query(
      'DELETE FROM telemetria WHERE caso_id IS NULL AND (dispositivo_sha256 = $1 OR usuario_id = $2)',
      [quien.huellaTelemetria, quien.usuarioId],
    )
    const eventos = await cliente.query('DELETE FROM eventos_conduccion WHERE dispositivo_sha256 = $1', [quien.huellaConduccion])
    await cliente.query('COMMIT')
    return { alertas: alertas.rowCount ?? 0, eventos_conduccion: eventos.rowCount ?? 0 }
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    cliente.release()
  }
}

/** INSERT … ON CONFLICT (dispositivo_sha256, id_cliente) DO NOTHING por evento, con id = 'CON-' + randomUUID(); valida aviso_version como guardarTelemetria; ocurrido_en_telefono con horaTelefonoAceptable del lote. Nunca usuario_id. */
export async function guardarEventosConduccion(lote: LoteConduccion, huella: string, recibidoEnMs: number): Promise<{ guardados: number }> {
  if (!AVISOS_DATOS_CONOCIDOS.includes(lote.aviso_version)) {
    throw new ErrorTransporte(
      'aviso_version',
      `La versión del aviso de datos "${lote.aviso_version}" no la conoce el servidor: cerrá y volvé a abrir la aplicación para actualizarla.`,
    )
  }
  /*
   * randomUUID y no nuevoId: con millones de eventos en los días de conservación, los 6
   * caracteres de nuevoId chocan, y el ON CONFLICT de abajo no cubre la clave primaria.
   * Una sola sentencia para todo el lote: cada fila choca o entra por su cuenta.
   */
  const eventos = lote.eventos.map(([idCliente, tipo, ocurrido, kmhInicial, kmhFinal, duracionMs, gEstimada, picoG]) => ({
    id: 'CON-' + randomUUID(),
    id_cliente: idCliente,
    tipo,
    ocurrido_en_telefono: horaTelefonoAceptable(ocurrido, lote.enviado_en, recibidoEnMs).aceptada,
    kmh_inicial: kmhInicial,
    kmh_final: kmhFinal,
    duracion_ms: duracionMs,
    g_estimada: gEstimada,
    pico_g: picoG,
  }))
  const pg = await db()
  const res = await pg.query(
    `INSERT INTO eventos_conduccion (id, id_cliente, dispositivo_sha256, tipo, ocurrido_en_telefono, kmh_inicial, kmh_final, duracion_ms, g_estimada, pico_g, version_motor, plataforma, aviso_version)
     SELECT e.id, e.id_cliente, $2, e.tipo, e.ocurrido_en_telefono, e.kmh_inicial, e.kmh_final, e.duracion_ms, e.g_estimada, e.pico_g, $3, $4, $5
       FROM jsonb_to_recordset($1::jsonb) AS e(id text, id_cliente text, tipo text, ocurrido_en_telefono timestamptz, kmh_inicial real, kmh_final real, duracion_ms integer, g_estimada real, pico_g real)
     ON CONFLICT (dispositivo_sha256, id_cliente) DO NOTHING`,
    [JSON.stringify(eventos), huella, lote.version_motor, lote.plataforma, lote.aviso_version],
  )
  return { guardados: res.rowCount ?? 0 }
}
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: ninguna línea `  FALLA` ni avisos sueltos en la salida (los `console.warn` esperados los capturan las pruebas); entre otras,

```
  ok   accesoTelemetria, con cuenta: la misma huella a las 24 h justas
  ok   accesoTelemetria, con cuenta: la misma huella pasadas las 24 h no
  ok   con el reloj del teléfono corrido, el desfase la corrige
  ok   la versión es el hash canónico de lo que cambia el comportamiento del teléfono
  ok   y se loguea una sola vez, diciendo qué poner
```

y `141/141 verificaciones pasaron`, `Todo en orden.`.

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `141/141 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 6: Commit**

```bash
git add "lib/telemetria.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Guardar las alertas del modo viaje con una fusión que no pierde un pedido de ayuda

Una alerta se guarda por teléfono e id del cliente en una sola sentencia: un reintento no
duplica, una respuesta humana nunca queda pisada por un sin_respuesta que llegó tarde, y una
falsa alarma borra la ubicación y las series de sus episodios. El acceso es por la huella del
teléfono o por la sesión del dueño, y «no existe» y «no es tuya» contestan lo mismo.

Nada de esto registra eslabones: una respuesta puede llegar después de que la actuación
vinculada se selló. El veredicto del servidor es provisorio hasta que F2 traiga
evaluarEpisodio.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Las rutas del modo viaje y e2e [10b]–[10f]

**Files:**
- Create: `app/api/telemetria/configuracion/route.ts`, `app/api/telemetria/[id]/route.ts`, `app/api/telemetria/mias/route.ts`, `app/api/conduccion/route.ts`.
- Modify (contenido completo): `app/api/telemetria/route.ts`, `app/api/telemetria/[id]/respuesta/route.ts`.
- Modify: `app/components/DetectorImpacto.tsx` — después de `const SEGUNDOS_CONFIRMACION = 45` (hoy línea 24) y el `buffer.current.push({ … })` de `alMovimiento` (hoy líneas 53–62). Ver «Desvíos respecto del índice».
- Modify: `scripts/prueba-e2e.mjs` — antes de `/* ---------- Resultado ---------- */`.
- Test: `scripts/prueba-e2e.mjs` `[10b] Configuración`, `[10c] Alta de alerta`, `[10d] Dueño y respuestas`, `[10e] Topes`, `[10f] Conducción y borrado`.

**Interfaces:**
- Consumes: `errorApi`, `leerCuerpoLimitado` (Tareas 2, 3 y 7); `ipDelCliente`, `limitar` (Tarea 3); `huellaDispositivo` (Tarea 4); `leerSesion()` de `lib/sesion.ts`; `configuracionModoViaje`, `guardarTelemetria`, `guardarTelemetriaLegada`, `leerTelemetriaPropia`, `responderTelemetria`, `borrarTelemetriaPropia`, `guardarEventosConduccion`, `MENSAJE_TELEMETRIA_AJENA` (Tarea 8); `BYTES_MAX_TELEMETRIA`, `BYTES_MAX_RESPUESTA`, `BYTES_MAX_CONDUCCION`, `esCuerpoLegado`, `decodificarCuerpoLegado`, `validarCuerpoTelemetria`, `validarCuerpoRespuesta`, `validarLoteConduccion` (Tarea 7); en el e2e, `crearFrasco`, `principal`, `pedir` y `saltar` (Tarea 5).
- Produces (índice, «Contratos HTTP»):
  - `GET /api/telemetria/configuracion` → 200 `ConfiguracionModoViaje` con `Cache-Control: no-store`; crea la cookie `acta_posesion` si falta.
  - `POST /api/telemetria` (128 KB) → 201 `{ id, nivel, plan }` si la alerta es nueva, 200 si ya existía; con el cuerpo del detector anterior, 201 `{ ok: true, id, veredicto, nivel, plan }`; 400 / 413 / 429 / 503 por `errorApi`.
  - `GET /api/telemetria/[id]` → 200 `LecturaTelemetria` o 404 `{ error: MENSAJE_TELEMETRIA_AJENA }`, los dos con `no-store`.
  - `POST /api/telemetria/[id]/respuesta` (2 KB) → 200 `{ ok: true, id, plan }`, 400 `tipo: 'transporte'` con `campo: 'respuesta'`, 404 ajena, 413 / 429.
  - `DELETE /api/telemetria/mias` → 200 `{ ok: true, alertas, eventos_conduccion }` con `no-store`.
  - `POST /api/conduccion` (8 KB) → 200 `{ ok: true, guardados }`; nunca lee la sesión.
  - El motor de F3 y `/aviso` de F5 usan estas rutas tal cual; F5 suma `after(() => purgarTelemetriaSiToca())` en `POST /api/telemetria` y `POST /api/conduccion`.

- [ ] **Step 1: Escribir `[10b]` a `[10f]` en el e2e**

En `scripts/prueba-e2e.mjs`, reemplazá:

```js
/* ---------- Resultado ---------- */
```

por:

```js
const { MENSAJE_TELEMETRIA_AJENA } = await import('../lib/telemetria.ts')
const iso = (ms) => new Date(ms).toISOString()
const postJson = (frasco, ruta, cuerpo) =>
  frasco.pedir(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) })

/** Los campos de una alerta como los manda el motor, con lo que cada prueba necesita cambiar. */
function camposAlerta(idCliente, cambios = {}) {
  return {
    id_cliente: idCliente,
    aviso_version: '2026-09-16',
    version_motor: 1,
    plataforma: 'android',
    standalone: true,
    ocurrido_en_telefono: iso(Date.now() - 10_000),
    enviado_en: iso(Date.now()),
    apertura: 'episodio',
    nivel_cliente: 'confirmado',
    alerta_mostrada: true,
    sonido: true,
    respuestas: [],
    hubo_choque: null,
    ms_hasta_respuesta: null,
    hz_medido: 59.8,
    aceleracion_derivada: false,
    gps: { lat: -34.6037, lon: -58.3816, precision_m: 9.5 },
    umbrales_cliente: { sospechaG: 4, confirmadoG: 8, msSobreUmbral: 30 },
    ...cambios,
  }
}

/** Un choque sintético: dos segundos antes del golpe, cinco muestras de 12 g y la velocidad que cae a cero. */
function episodioChoque(n) {
  return {
    n,
    ocurrido_en_telefono: iso(Date.now() - 10_000),
    disparador: 'golpe',
    fuente: 'confiable',
    hz_medido: 59.8,
    veredicto_cliente: { nivel: 'confirmado', picoG: 11.7, motivo: 'Iba andando y quedó detenido después de un golpe sostenido.' },
    serie: Array.from({ length: 180 }, (_, i) => {
      const t = Math.round((-2000 + i * 16.7) * 10) / 10
      const golpe = i >= 120 && i <= 124
      return [t, golpe ? 117.68 : 0.113, -0.052, 0.201, golpe ? 12.9 : 1.004, golpe ? 260.1 : 2.1, golpe ? 11.8 : 0.012]
    }),
    velocidades: [[-9800, 54.2, 8, 0, 0], [-8800, 55.1, 8, 15.2, 0.4], [2000, 3.1, 8, 40.1, 1], [3000, 0, 8, 40.3, 1]],
  }
}

console.log('\n[10b] Configuración')
const telefono = crearFrasco()
{
  const { res, cuerpo } = await telefono.pedir('/api/telemetria/configuracion')
  verificar('la configuración responde', res.status === 200, `status=${res.status}`)
  verificar(
    'la configuración no queda en ningún caché',
    res.status === 200 && (res.headers.get('cache-control') ?? '').includes('no-store'),
    `status=${res.status} ${res.headers.get('cache-control') ?? ''}`,
  )
  verificar('crea la cookie de posesión del teléfono', telefono.galletas.has('acta_posesion'))
  verificar('la versión son 16 hexadecimales', /^[0-9a-f]{16}$/.test(cuerpo?.version ?? ''), cuerpo?.version)
  verificar('la alerta es un valor conocido', ['normal', 'silenciosa', 'apagada'].includes(cuerpo?.alerta), cuerpo?.alerta)
  verificar('trae los umbrales', typeof cuerpo?.umbrales?.sospechaG === 'number', JSON.stringify(cuerpo?.umbrales))
}

console.log('\n[10c] Alta de alerta')
const ID_CLIENTE = randomUUID()
let TEL = null
{
  const alta = await postJson(telefono, '/api/telemetria', { campos: camposAlerta(ID_CLIENTE), episodio: null })
  TEL = alta.cuerpo?.id ?? null
  verificar('una alerta nueva sin episodio da 201', alta.res.status === 201 && /^TEL-/.test(TEL ?? ''), JSON.stringify(alta.cuerpo))

  const otraVez = await postJson(telefono, '/api/telemetria', { campos: camposAlerta(ID_CLIENTE), episodio: null })
  verificar('el mismo id_cliente otra vez da 200 con el mismo id', otraVez.res.status === 200 && otraVez.cuerpo?.id === TEL, JSON.stringify(otraVez.cuerpo))

  const conEpisodio = await postJson(telefono, '/api/telemetria', { campos: camposAlerta(ID_CLIENTE), episodio: episodioChoque(1) })
  verificar('con el episodio 1 da 200 con el mismo id', conEpisodio.res.status === 200 && conEpisodio.cuerpo?.id === TEL, JSON.stringify(conEpisodio.cuerpo))

  /*
   * El cuerpo de DetectorImpacto.tsx tal como sale del buffer lleno: 1125 muestras, redondeadas,
   * con t contado desde que se encendió (180 s). Tiene que entrar en los 128 KB y recortarse a 1000.
   */
  const serie = Array.from({ length: 1125 }, (_, i) => {
    const golpe = i >= 900 && i <= 904
    return { t: 180_000 + Math.round(i * 16.667), ax: golpe ? 117.68 : 0.213, ay: -0.052, az: 0.187, gTotal: golpe ? 12.998 : 1.004, giro: golpe ? 260.1 : 2.1 }
  })
  const legado = await postJson(telefono, '/api/telemetria', { serie, origen: 'navegador' })
  verificar(
    'el cuerpo del detector anterior da 201 con id y veredicto',
    legado.res.status === 201 && /^TEL-/.test(legado.cuerpo?.id ?? '') && typeof legado.cuerpo?.veredicto?.nivel === 'string',
    `status=${legado.res.status} ${JSON.stringify(legado.cuerpo).slice(0, 200)}`,
  )
}

console.log('\n[10d] Dueño y respuestas')
{
  const propia = await telefono.pedir(`/api/telemetria/${TEL}`)
  verificar('el teléfono dueño lee su alerta', propia.res.status === 200 && propia.cuerpo?.id === TEL, JSON.stringify(propia.cuerpo))
  verificar(
    'la lectura con ubicación no queda en ningún caché',
    propia.res.status === 200 && (propia.res.headers.get('cache-control') ?? '').includes('no-store'),
    `status=${propia.res.status} ${propia.res.headers.get('cache-control') ?? ''}`,
  )

  const ajeno = crearFrasco()
  const ajena = await ajeno.pedir(`/api/telemetria/${TEL}`)
  verificar(
    'otro teléfono recibe el mismo 404 que si no existiera',
    ajena.res.status === 404 && ajena.cuerpo?.error === MENSAJE_TELEMETRIA_AJENA,
    `status=${ajena.res.status} ${JSON.stringify(ajena.cuerpo)}`,
  )

  const idBien = randomUUID()
  const bien = await postJson(telefono, '/api/telemetria', {
    campos: camposAlerta(idBien, { respuestas: [{ respuesta: 'estoy_bien', en_telefono: iso(Date.now()) }] }),
    episodio: null,
  })
  const TEL_BIEN = bien.cuerpo?.id
  await postJson(telefono, '/api/telemetria', {
    campos: camposAlerta(idBien, { respuestas: [{ respuesta: 'sin_respuesta', en_telefono: iso(Date.now()) }] }),
    episodio: null,
  })
  const trasSin = await telefono.pedir(`/api/telemetria/${TEL_BIEN}`)
  verificar('una sin_respuesta que llega tarde no pisa estoy_bien', trasSin.cuerpo?.respuesta === 'estoy_bien', JSON.stringify(trasSin.cuerpo))

  const ayuda = await postJson(telefono, '/api/telemetria', {
    campos: camposAlerta(randomUUID(), { respuestas: [{ respuesta: 'necesito_ayuda', en_telefono: iso(Date.now()) }] }),
    episodio: null,
  })
  verificar('necesito_ayuda escala', ayuda.res.status === 201 && ayuda.cuerpo?.plan?.ofrecerEmergencias === true, JSON.stringify(ayuda.cuerpo))

  const quizas = await postJson(telefono, `/api/telemetria/${TEL}/respuesta`, { respuesta: 'quizas' })
  verificar(
    'una respuesta que no existe da 400 y dice cuáles valen',
    quizas.res.status === 400 && quizas.cuerpo?.tipo === 'transporte' && quizas.cuerpo?.campo === 'respuesta',
    `status=${quizas.res.status} ${JSON.stringify(quizas.cuerpo)}`,
  )

  const tarde = await postJson(telefono, `/api/telemetria/${TEL_BIEN}/respuesta`, { respuesta: 'sin_respuesta' })
  const final = await telefono.pedir(`/api/telemetria/${TEL_BIEN}`)
  verificar(
    'por la ruta de respuesta, sin_respuesta tampoco pisa estoy_bien',
    tarde.res.status === 200 && final.cuerpo?.respuesta === 'estoy_bien',
    `status=${tarde.res.status} ${JSON.stringify(final.cuerpo)}`,
  )
}

console.log('\n[10e] Topes')
{
  const grande = await telefono.pedir('/api/telemetria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(500 * 1024) })
  verificar(
    'un cuerpo de 500 KB da 413 y dice el máximo',
    grande.res.status === 413 && (grande.cuerpo?.error ?? '').includes('128 KB'),
    `status=${grande.res.status} ${JSON.stringify(grande.cuerpo)}`,
  )

  const rafaga = crearFrasco()
  await rafaga.pedir('/api/telemetria/configuracion')
  let ultimo = null
  for (let i = 0; i < 31; i++) {
    ultimo = await rafaga.pedir('/api/telemetria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'x' })
  }
  verificar(
    'el pedido 31 del mismo teléfono en un minuto da 429 con Retry-After',
    ultimo.res.status === 429 && /^\d+$/.test(ultimo.res.headers.get('retry-after') ?? ''),
    `status=${ultimo.res.status} retry-after=${ultimo.res.headers.get('retry-after')}`,
  )
}

console.log('\n[10f] Conducción y borrado')
{
  const lote = {
    aviso_version: '2026-09-16',
    version_motor: 1,
    plataforma: 'ios',
    enviado_en: iso(Date.now()),
    eventos: [
      [randomUUID(), 'frenada', iso(Date.now() - 60_000), 58.4, 30.2, 1800, 0.52, 0.61],
      [randomUUID(), 'golpe_en_marcha', iso(Date.now() - 30_000), 47, 45.5, null, null, 6.3],
    ],
  }
  const primera = await postJson(telefono, '/api/conduccion', lote)
  verificar('un lote de 2 eventos guarda 2', primera.res.status === 200 && primera.cuerpo?.guardados === 2, JSON.stringify(primera.cuerpo))
  const repetida = await postJson(telefono, '/api/conduccion', lote)
  verificar('repetir el lote no guarda nada', repetida.res.status === 200 && repetida.cuerpo?.guardados === 0, JSON.stringify(repetida.cuerpo))

  const borrado = await telefono.pedir('/api/telemetria/mias', { method: 'DELETE' })
  verificar(
    'borrar mis registros borra alertas y eventos de este teléfono',
    borrado.res.status === 200 && borrado.cuerpo?.alertas >= 1 && borrado.cuerpo?.eventos_conduccion >= 2,
    JSON.stringify(borrado.cuerpo),
  )
  const borrada = await telefono.pedir(`/api/telemetria/${TEL}`)
  verificar('una alerta borrada ya no se puede leer', borrada.res.status === 404, `status=${borrada.res.status}`)
}

/* ---------- Resultado ---------- */
```

`[10c]` manda el cuerpo de `DetectorImpacto.tsx` como sale con el buffer lleno: 1125 muestras redondeadas y `t` desde 180 000 ms. Tiene que entrar en los 128 KB y el servidor lo recorta a 1000.

Las dos verificaciones de `no-store` exigen además el 200: el 404 que Next contesta cuando ninguna ruta coincide ya trae `Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate` (`node_modules/next/dist/server/lib/router-server.js:517-518`), así que sin atarlas al 200 pasarían antes de que existan `configuracion/route.ts` y `[id]/route.ts`.

Verificá la sintaxis: `node --check scripts/prueba-e2e.mjs` no imprime nada.

- [ ] **Step 2: Correr el e2e y verlo fallar**

Con el servidor y la base descartable levantados: `E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e`.

Expected: `[0]` a `[10a]` en `ok` y, entre otras,

```
[10b] Configuración
  FALLA la configuración responde status=404
```

```
[10c] Alta de alerta
  FALLA una alerta nueva sin episodio da 201 {"error":"La serie llegó vacía."}
```

```
[10e] Topes
  FALLA un cuerpo de 500 KB da 413 y dice el máximo status=400 {"error":"La serie llegó vacía."}
```

con `53/74 verificaciones pasaron` y `21 FALLARON` (pasan sólo `el cuerpo del detector anterior da 201 con id y veredicto`, porque la ruta vieja lo acepta, y `una alerta borrada ya no se puede leer`). Sin base descartable, este paso y el Step 11 no se corren y el informe lo dice.

- [ ] **Step 3: `GET /api/telemetria/configuracion`**

Creá `app/api/telemetria/configuracion/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { huellaDispositivo } from '@/lib/posesion'
import { configuracionModoViaje } from '@/lib/telemetria'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Configuración remota del modo viaje (§2.9): con esto se apaga o se silencia la alerta en
 * todos los teléfonos sin publicar una versión nueva.
 *
 * Crea la cookie de posesión si falta. El teléfono pide esto antes que nada al encender: así
 * los pedidos que siguen ya llevan la cookie, y dos altas simultáneas no crean dos cookies
 * distintas que dejarían una de las alertas sin dueño.
 */
export async function GET() {
  try {
    await huellaDispositivo('telemetria', true)
    return NextResponse.json(configuracionModoViaje(), { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return errorApi('telemetria:configuracion', err, 'No se pudo leer la configuración del modo viaje.')
  }
}
```

- [ ] **Step 4: `POST /api/telemetria`**

Reemplazá el contenido completo de `app/api/telemetria/route.ts` por:

```ts
import { NextResponse } from 'next/server'
import { errorApi, leerCuerpoLimitado } from '@/lib/api'
import { ipDelCliente, limitar } from '@/lib/limite'
import { huellaDispositivo } from '@/lib/posesion'
import { leerSesion } from '@/lib/sesion'
import { guardarTelemetria, guardarTelemetriaLegada } from '@/lib/telemetria'
import { BYTES_MAX_TELEMETRIA, decodificarCuerpoLegado, esCuerpoLegado, validarCuerpoTelemetria } from '@/lib/transporte-viaje'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Alta o actualización de una alerta del modo viaje y, si viene, de uno de sus episodios.
 *
 * El teléfono manda la alerta entera en cada intento y el servidor funde por
 * (teléfono, id_cliente): un reintento sin red no duplica nada y una respuesta humana nunca
 * queda pisada por una sin_respuesta que llegó tarde. El veredicto se vuelve a calcular acá
 * con los umbrales del servidor: el del teléfono se guarda aparte, para calibrar.
 *
 * Mientras existan teléfonos con la versión anterior, también acepta el cuerpo de
 * DetectorImpacto.tsx ({ serie, origen }) y lo guarda como una alerta de un solo episodio.
 *
 * El orden importa: el límite corre antes de leer el cuerpo, así un cliente en bucle con
 * cuerpos enormes también queda frenado sin que el servidor lea ni un byte.
 */
export async function POST(req: Request) {
  try {
    const recibidoEnMs = Date.now()
    // Con crear en true siempre hay cookie: la huella nunca es null acá.
    const huella = (await huellaDispositivo('telemetria', true)) as string
    const sesion = await leerSesion()
    limitar('telemetria', { ip: ipDelCliente(req.headers), huella })
    const crudo = await leerCuerpoLimitado(req, BYTES_MAX_TELEMETRIA)
    const quien = { huella, usuarioId: sesion?.usuario_id ?? null }

    if (esCuerpoLegado(crudo)) {
      const legado = await guardarTelemetriaLegada(decodificarCuerpoLegado(crudo), quien)
      return NextResponse.json(
        { ok: true, id: legado.id, veredicto: legado.veredicto, nivel: legado.nivel, plan: legado.plan },
        { status: 201 },
      )
    }

    const resultado = await guardarTelemetria(validarCuerpoTelemetria(crudo), quien, recibidoEnMs)
    return NextResponse.json(
      { id: resultado.id, nivel: resultado.nivel, plan: resultado.plan },
      { status: resultado.nueva ? 201 : 200 },
    )
  } catch (err) {
    return errorApi('telemetria:POST', err, 'No se pudo registrar la lectura de los sensores.')
  }
}
```

- [ ] **Step 5: `GET /api/telemetria/[id]`**

Creá `app/api/telemetria/[id]/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { huellaDispositivo } from '@/lib/posesion'
import { leerSesion } from '@/lib/sesion'
import { leerTelemetriaPropia, MENSAJE_TELEMETRIA_AJENA } from '@/lib/telemetria'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Una alerta de este teléfono, para /aviso.
 *
 * «No existe» y «no es tuya» responden el mismo 404: con dos respuestas distintas, cualquiera
 * podría recorrer ids y saber cuáles son alertas reales de otras personas. Lleva no-store
 * porque trae la ubicación.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const huella = await huellaDispositivo('telemetria', false)
    const sesion = await leerSesion()
    const lectura = await leerTelemetriaPropia(id, { huella, usuarioId: sesion?.usuario_id ?? null })
    if (!lectura) {
      return NextResponse.json({ error: MENSAJE_TELEMETRIA_AJENA }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    }
    return NextResponse.json(lectura, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return errorApi('telemetria:GET', err, 'No se pudo leer la detección.')
  }
}
```

- [ ] **Step 6: `POST /api/telemetria/[id]/respuesta`**

Reemplazá el contenido completo de `app/api/telemetria/[id]/respuesta/route.ts` por:

```ts
import { NextResponse } from 'next/server'
import { errorApi, leerCuerpoLimitado } from '@/lib/api'
import { ipDelCliente, limitar } from '@/lib/limite'
import { huellaDispositivo } from '@/lib/posesion'
import { leerSesion } from '@/lib/sesion'
import { MENSAJE_TELEMETRIA_AJENA, responderTelemetria } from '@/lib/telemetria'
import { BYTES_MAX_RESPUESTA, validarCuerpoRespuesta } from '@/lib/transporte-viaje'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ id: string }> }

/**
 * Qué contestó la persona, por el id del servidor (lo usan /aviso y el detector anterior).
 *
 * Devuelve el plan de escalamiento. NUNCA incluye llamar a emergencias por cuenta propia: deja
 * las llamadas y el contacto de confianza a un toque. Una llamada automática por un falso
 * positivo satura una línea que alguien más puede necesitar.
 *
 * Nunca registra un eslabón, aunque la alerta ya esté vinculada a una actuación: esa actuación
 * puede estar sellada, y un eslabón posterior al cierre haría que el verificador denuncie como
 * alterado un expediente intacto.
 */
export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const huella = await huellaDispositivo('telemetria', false)
    const sesion = await leerSesion()
    limitar('telemetria', { ip: ipDelCliente(req.headers), huella })
    const cuerpo = validarCuerpoRespuesta(await leerCuerpoLimitado(req, BYTES_MAX_RESPUESTA))
    const resultado = await responderTelemetria(id, cuerpo, { huella, usuarioId: sesion?.usuario_id ?? null })
    if (!resultado) return NextResponse.json({ error: MENSAJE_TELEMETRIA_AJENA }, { status: 404 })
    return NextResponse.json({ ok: true, id: resultado.id, plan: resultado.plan })
  } catch (err) {
    return errorApi('telemetria:respuesta', err, 'No se pudo registrar la respuesta.')
  }
}
```

- [ ] **Step 7: `DELETE /api/telemetria/mias`**

Creá `app/api/telemetria/mias/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { huellaDispositivo } from '@/lib/posesion'
import { leerSesion } from '@/lib/sesion'
import { borrarTelemetriaPropia } from '@/lib/telemetria'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * «Borrar mis registros del modo viaje»: el derecho de supresión (Ley 25.326) ejercido desde el
 * teléfono, sin pedírselo a nadie.
 *
 * Borra las alertas de este teléfono (o de la cuenta en sesión) que no están vinculadas a una
 * actuación, y los eventos de conducción de este teléfono. Lo vinculado es parte de un
 * expediente y se borra con anonimizar o expurgar.
 *
 * Esta carpeta convive con [id]: en el app router gana el segmento estático. Por eso acá no se
 * define GET, que es de [id].
 */
export async function DELETE() {
  try {
    const huellaTelemetria = await huellaDispositivo('telemetria', false)
    const huellaConduccion = await huellaDispositivo('conduccion', false)
    const sesion = await leerSesion()
    const borrados = await borrarTelemetriaPropia({ huellaTelemetria, huellaConduccion, usuarioId: sesion?.usuario_id ?? null })
    return NextResponse.json({ ok: true, ...borrados }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return errorApi('telemetria:mias', err, 'No se pudieron borrar los registros del modo viaje.')
  }
}
```

- [ ] **Step 8: `POST /api/conduccion`**

Creá `app/api/conduccion/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { errorApi, leerCuerpoLimitado } from '@/lib/api'
import { ipDelCliente, limitar } from '@/lib/limite'
import { huellaDispositivo } from '@/lib/posesion'
import { guardarEventosConduccion } from '@/lib/telemetria'
import { BYTES_MAX_CONDUCCION, validarLoteConduccion } from '@/lib/transporte-viaje'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Lote de frenadas, aceleraciones, golpes en marcha y caídas silenciosas.
 *
 * NUNCA lee la sesión ni guarda usuario_id, a propósito: en esta etapa estos eventos sólo
 * sirven para calibrar el detector, y se le prometió a la persona que no se asocian a su cuenta
 * ni a su póliza. Con la cuenta a mano, el primer uso nuevo sería un puntaje de manejo.
 *
 * Idempotente por (teléfono, id_cliente): repetir el lote no duplica nada y `guardados` cuenta
 * sólo los nuevos.
 */
export async function POST(req: Request) {
  try {
    const recibidoEnMs = Date.now()
    // Con crear en true siempre hay cookie: la huella nunca es null acá.
    const huella = (await huellaDispositivo('conduccion', true)) as string
    limitar('conduccion', { ip: ipDelCliente(req.headers), huella })
    const lote = validarLoteConduccion(await leerCuerpoLimitado(req, BYTES_MAX_CONDUCCION))
    const { guardados } = await guardarEventosConduccion(lote, huella, recibidoEnMs)
    return NextResponse.json({ ok: true, guardados })
  } catch (err) {
    return errorApi('conduccion:POST', err, 'No se pudieron registrar los eventos de conducción.')
  }
}
```

- [ ] **Step 9: Redondear las lecturas de `DetectorImpacto.tsx` y hacer creciente su `t`**

Sin esto el detector anterior se rompe contra el tope de 128 KB en cuanto se llena su buffer (medido: 1000 muestras sin redondear son 142 731 bytes y reciben 413; redondeadas, 72 882 bytes y 201). En `app/components/DetectorImpacto.tsx`, reemplazá:

```tsx
const SEGUNDOS_CONFIRMACION = 45
```

por:

```tsx
const SEGUNDOS_CONFIRMACION = 45

/*
 * El sensor entrega 17 dígitos por eje. Sin redondear, el buffer llega a 1125 muestras de unos
 * 140 bytes, pasa de los 128 KB que acepta POST /api/telemetria y el servidor contesta 413: la
 * alerta se ve igual, pero /aviso queda sin la lectura y sin poder registrar la respuesta.
 */
const redondear = (valor: number, decimales: number) => Math.round(valor * 10 ** decimales) / 10 ** decimales
```

Y reemplazá:

```tsx
    buffer.current.push({
      t: Math.round(ahora - inicio.current),
      ax: a.x ?? 0,
      ay: a.y ?? 0,
      az: a.z ?? 0,
      gTotal: aG
        ? Math.sqrt((aG.x ?? 0) ** 2 + (aG.y ?? 0) ** 2 + (aG.z ?? 0) ** 2) / 9.80665
        : undefined,
      giro: e.rotationRate ? Math.abs(e.rotationRate.alpha ?? 0) : null,
    })
```

por:

```tsx
    /*
     * POST /api/telemetria rechaza con 400 una serie cuyo t no crece. Con el hilo ocupado en
     * analizarImpacto, dos devicemotion en cola pueden llegar a menos de 1 ms y redondear al mismo
     * t: el detector se quedaría sin id de alerta. Se corre un milisegundo en vez de repetirlo.
     */
    const tBruto = Math.round(ahora - inicio.current)
    const previo = buffer.current.at(-1)?.t
    buffer.current.push({
      t: previo !== undefined && tBruto <= previo ? previo + 1 : tBruto,
      ax: redondear(a.x ?? 0, 3),
      ay: redondear(a.y ?? 0, 3),
      az: redondear(a.z ?? 0, 3),
      gTotal: aG
        ? redondear(Math.sqrt((aG.x ?? 0) ** 2 + (aG.y ?? 0) ** 2 + (aG.z ?? 0) ** 2) / 9.80665, 3)
        : undefined,
      giro: e.rotationRate ? redondear(Math.abs(e.rotationRate.alpha ?? 0), 1) : null,
    })
```

- [ ] **Step 10: Verificar el contrato de las rutas nuevas**

Run: `npm run contrato`

Expected: `  ok   todas las rutas declaran su entorno y traducen sus errores`, `  ok   ningún dato personal en claro dentro de un eslabón` y `El contrato se cumple.`.

- [ ] **Step 11: Correr el e2e y verlo pasar**

Reiniciá `npm run dev` y corré `E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e`.

Expected: ninguna línea `  FALLA`. Cada verificación de `[10b]` a `[10f]` imprime una línea que empieza con `  ok   ` y su nombre, seguido del detalle; por ejemplo, empiezan así:

```
  ok   crea la cookie de posesión del teléfono
  ok   el mismo id_cliente otra vez da 200 con el mismo id
  ok   el cuerpo del detector anterior da 201 con id y veredicto status=201
  ok   otro teléfono recibe el mismo 404 que si no existiera status=404
  ok   por la ruta de respuesta, sin_respuesta tampoco pisa estoy_bien status=200
  ok   un cuerpo de 500 KB da 413 y dice el máximo status=413
  ok   el pedido 31 del mismo teléfono en un minuto da 429 con Retry-After status=429 retry-after=
  ok   borrar mis registros borra alertas y eventos de este teléfono
```

Al final, `74/74 verificaciones pasaron` y `Circuito completo funcionando.`. Al cortar el servidor, `git checkout -- next-env.d.ts`.

- [ ] **Step 12: Ver al detector anterior contra el servidor nuevo**

Con `npm run dev` levantado, abrí `http://localhost:3000/perfil` en Chrome de escritorio (la tarjeta «Modo viaje» se ve aun sin sesión) y tocá «Encender el modo viaje»: queda «Escuchando.». Esperá al menos 20 segundos desde que cargó /perfil antes de pegar el script: el detector anterior no avisa en sus primeros 20 s (`ultimoAviso` arranca en 0 y `alMovimiento` corta mientras `ahora - ultimoAviso.current < 20_000`, `app/components/DetectorImpacto.tsx:38` y `:71`). Abrí DevTools › Network y pegá en la consola:

```js
let i = 0
const golpe = setInterval(() => {
  const fuerte = i >= 70 && i < 75
  window.dispatchEvent(new DeviceMotionEvent('devicemotion', {
    acceleration: { x: fuerte ? 117.7 : 0.21, y: 0.1, z: 0.1 },
    accelerationIncludingGravity: { x: 0.2, y: 0.1, z: 9.8 },
    rotationRate: { alpha: fuerte ? 260 : 3, beta: 0, gamma: 0 },
    interval: 16,
  }))
  if (++i === 120) clearInterval(golpe)
}, 16)
```

Expected: la tarjeta pasa a «¿Estás bien?» con «El teléfono detectó un golpe de 12.0 g»; en Network, `POST /api/telemetria` responde 201 con un JSON que trae `"ok":true`, un `id` que empieza con `TEL-`, `veredicto`, `"nivel":"confirmado"` y `plan`, y en el cuerpo enviado ningún número tiene más de 3 decimales. Tocá «Estoy bien»: el `POST` a `/api/telemetria/<ese id>/respuesta` responde 200 con `"texto":"La persona respondió que está bien."`. Si no hay base descartable, este paso tampoco se corre y el informe lo dice.

- [ ] **Step 13: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `141/141 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 14: Commit**

```bash
git add "app/api/telemetria/configuracion/route.ts" "app/api/telemetria/route.ts" "app/api/telemetria/[id]/route.ts" "app/api/telemetria/[id]/respuesta/route.ts" "app/api/telemetria/mias/route.ts" "app/api/conduccion/route.ts" "app/components/DetectorImpacto.tsx" "scripts/prueba-e2e.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Abrir las rutas del modo viaje con límite, tope de cuerpo y dueño

Configuración remota, alta y actualización de la alerta (también con el cuerpo del detector
anterior), lectura para /aviso, respuesta, borrado de los registros propios y lote de eventos
de conducción. Cada ruta limita antes de leer el cuerpo, lo lee con tope y termina en
errorApi; lo que trae una ubicación sale con no-store.

DetectorImpacto.tsx redondea las lecturas: con los 17 dígitos del sensor, el buffer lleno
pasaba de los 128 KB y el servidor contestaba 413, así que /aviso se quedaba sin la lectura.
Y no repite t: la ruta nueva rechaza una serie que no crece, y dos muestras a menos de 1 ms
redondeaban al mismo milisegundo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: `/aviso` deja de escribir al montar

**Files:**
- Modify: `app/aviso/page.tsx` — el import de React (línea 3) y, dentro de `Aviso`, `const accion = useSearchParams().get('accion')` (hoy línea 21) y el `useEffect` que registra `sin_respuesta` (hoy líneas 26–35).
- Test: `scripts/prueba-viaje.mjs`, bloque nuevo al final de [V1].

**Interfaces:**
- Consumes: `POST /api/telemetria/[id]/respuesta` de la Tarea 9 (lo siguen usando los botones).
- Produces: `/aviso?t=<id>` no manda ningún pedido al montar; sólo escriben «Registrar el accidente» (`POST /api/casos`) y «Estoy bien, fue una falsa alarma» (`POST …/respuesta` con `estoy_bien`). F5 reemplaza la pantalla por la versión con `AyudaImpacto` y mantiene esta regla; la prueba busca el cuerpo `respuesta: 'sin_respuesta'` y no `useEffect`, porque leer la alerta al montar sí está permitido.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección [V1] de `scripts/prueba-viaje.mjs` (antes de su `})`, con una línea vacía antes):

```js
  /* ---- /aviso no escribe al montar ---- */
  {
    const { readFileSync } = await import('node:fs')
    const aviso = readFileSync(new URL('../app/aviso/page.tsx', import.meta.url), 'utf8')
    /*
     * Abrir /aviso no es una respuesta: la abren una notificación, un enlace viejo o el botón
     * atrás. Registrar sin_respuesta al montar dejaba escrita una respuesta que nadie dio. Se busca
     * el cuerpo del pedido y no useEffect: leer la alerta al montar sí está permitido.
     */
    verificar("/aviso no manda { respuesta: 'sin_respuesta' } por su cuenta", !aviso.includes("respuesta: 'sin_respuesta'"))
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
  FALLA /aviso no manda { respuesta: 'sin_respuesta' } por su cuenta 
```

con `141/142 verificaciones pasaron` y `1 FALLARON`.

- [ ] **Step 3: Sacar la escritura al montar**

En `app/aviso/page.tsx`, reemplazá:

```tsx
import { Suspense, useEffect, useState } from 'react'
```

por:

```tsx
import { Suspense, useState } from 'react'
```

Y reemplazá:

```tsx
  const router = useRouter()
  const accion = useSearchParams().get('accion')
  const telemetria = useSearchParams().get('t')
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Si la notificación se venció sin respuesta, queda registrado.
    if (telemetria && accion === null) {
      fetch(`/api/telemetria/${telemetria}/respuesta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta: 'sin_respuesta' }),
      }).catch(() => undefined)
    }
  }, [telemetria, accion])

  async function reportar() {
```

por:

```tsx
  const router = useRouter()
  const telemetria = useSearchParams().get('t')
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reportar() {
```

`accion` sólo lo leía ese efecto: sin él queda sin uso y se va con el efecto. No se agrega nada más: F5 reemplaza la pantalla entera y, antes de hacerlo, revisa que el diff de F1 sobre este archivo sea sólo esto; la regla «abrir `/aviso` no escribe» queda escrita en la prueba del Step 1.

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: `  ok   /aviso no manda { respuesta: 'sin_respuesta' } por su cuenta`, `142/142 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 5: Ver en el navegador que abrir `/aviso` no escribe nada**

Con el servidor de prueba levantado, abrí `http://localhost:3000/aviso?t=TEL-AAAAAA` con DevTools › Network abierto y recargá.

Expected: no aparece ningún pedido a `/api/telemetria/`; la pantalla muestra «¿Estás bien?», los botones de emergencia, «Registrar el accidente» y «Estoy bien, fue una falsa alarma». Al tocar este último aparece un `POST /api/telemetria/TEL-AAAAAA/respuesta` (404 con `MENSAJE_TELEMETRIA_AJENA`, porque ese id no existe) y la pantalla vuelve al inicio. Sin servidor de prueba, alcanza con el Step 4 y el informe lo dice.

- [ ] **Step 6: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `142/142 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 7: Commit**

```bash
git add "app/aviso/page.tsx" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Dejar de registrar sin_respuesta al abrir /aviso

A /aviso la abren una notificación, un enlace viejo o el botón atrás, y ninguno de los tres
es una respuesta: registrar sin_respuesta al montar dejaba escrita una respuesta que nadie
dio y, con el plan nuevo, escalaba una alerta que la persona quizás ya había contestado en el
teléfono. Ahora sólo escriben los botones.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: Tope de 64 KB en `PATCH /api/casos/[id]`, tope de 8 KB y límite de altas anónimas en `POST /api/casos`, e2e [10g]

**Files:**
- Modify: `app/api/casos/route.ts` — los imports (hoy líneas 1–10); el comienzo de `POST`, `const cuerpo = await req.json().catch(() => ({}))` (hoy línea 24); y `const sesion = await leerSesion()` (hoy línea 47), que pasa al comienzo.
- Modify: `app/api/casos/[id]/route.ts` — el import de `@/lib/api` (línea 2) y `const cuerpo = await req.json().catch(() => ({}))` dentro de `PATCH` (hoy línea 51).
- Modify: `scripts/prueba-e2e.mjs` — antes de `/* ---------- Resultado ---------- */`.
- Test: `scripts/prueba-viaje.mjs` (bloque nuevo al final de [V1]) y `scripts/prueba-e2e.mjs` `[10g] Altas anónimas y PATCH`.

**Interfaces:**
- Consumes: `leerCuerpoLimitado` (Tarea 2), `ipDelCliente` y `limitar` con el ámbito `'altas'` (Tarea 3), `huellaDispositivo('telemetria', false)` (Tarea 4), `leerSesion()` y `limpiarDatosAsegurado(cuerpo: unknown)` (existentes); en el e2e, `principal`, `crearFrasco`, `pedir` (Tarea 5) y `postJson` (Tarea 9).
- Produces:
  - `POST /api/casos`: sin sesión, `limitar('altas', { ip: ipDelCliente(req.headers), huella: await huellaDispositivo('telemetria', false) })` antes de leer el cuerpo (la huella sólo es clave en memoria: no crea la cookie ni se guarda); después `leerCuerpoLimitado(req, 8_192)`; 413 `El pedido supera los 8 KB que acepta esta ruta: mandá menos datos por envío.`; 429 `servidor.limite_altas`. Con sesión no se limita. Lo demás, igual (201 `{ id, secreto, precarga_ambigua }`). F5 suma el vínculo con `telemetria_id` sobre esta versión.
  - `PATCH /api/casos/[id]`: `leerCuerpoLimitado(req, 65_536)` después de las comprobaciones de acceso y de estado que ya están; 413 `El pedido supera los 64 KB que acepta esta ruta: mandá menos datos por envío.`. Un cuerpo que no es JSON pasa de `{ ok: true, sinCambios: true }` a 400 con qué arreglar.

- [ ] **Step 1: Escribir la prueba de [V1] que falla**

Agregá al final de la sección [V1] de `scripts/prueba-viaje.mjs` (antes de su `})`, con una línea vacía antes). El bloque lee el código de las dos rutas, así falla aun sin servidor; el comportamiento lo prueba `[10g]`:

```js
  /* ---- Topes de las rutas de casos ---- */
  {
    const { readFileSync } = await import('node:fs')
    /*
     * Este bloque lee el código: así falla sin base ni servidor. Los números (8 KB, 64 KB, 10 altas
     * por minuto) los prueba el e2e [10g] contra el servidor. Acá no se atan a un literal, porque el tope
     * puede vivir en una constante.
     */
    const alta = readFileSync(new URL('../app/api/casos/route.ts', import.meta.url), 'utf8')
    const patch = readFileSync(new URL('../app/api/casos/[id]/route.ts', import.meta.url), 'utf8')
    const limite = alta.indexOf("limitar('altas'")
    verificar('POST /api/casos lee el cuerpo con tope', alta.includes('leerCuerpoLimitado(req, ') && !alta.includes('req.json()'))
    verificar(
      'POST /api/casos limita las altas sin sesión antes de leer el cuerpo',
      limite > -1 && limite < alta.indexOf('leerCuerpoLimitado(req, '),
    )
    verificar('PATCH /api/casos/[id] lee el cuerpo con tope', patch.includes('leerCuerpoLimitado(req, ') && !patch.includes('req.json()'))
  }
```

- [ ] **Step 2: Escribir `[10g]` en el e2e**

En `scripts/prueba-e2e.mjs`, reemplazá:

```js
/* ---------- Resultado ---------- */
```

por:

```js
console.log('\n[10g] Altas anónimas y PATCH')
{
  const abierta = await postJson(principal, '/api/casos', {})
  const patch = await pedir(`/api/casos/${abierta.cuerpo?.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ respuestas: { relato_texto: 'x'.repeat(70 * 1024) } }),
  })
  verificar(
    'un PATCH de 70 KB da 413 y dice el máximo',
    abierta.res.status === 201 && patch.res.status === 413 && (patch.cuerpo?.error ?? '').includes('64 KB'),
    `alta=${abierta.res.status} patch=${patch.res.status} ${JSON.stringify(patch.cuerpo)}`,
  )

  // Frasco nuevo con cookie: sin la cookie la huella es null y sólo contaría el tope por IP, que es 30.
  const altas = crearFrasco()
  await altas.pedir('/api/telemetria/configuracion')
  let ultima = null
  let creadas = 0
  for (let i = 0; i < 11; i++) {
    ultima = await postJson(altas, '/api/casos', { relleno: 'x'.repeat(9 * 1024) })
    if (ultima.res.status === 201) creadas++
  }
  verificar(
    'el alta anónima 11 del mismo teléfono en un minuto da 429',
    ultima.res.status === 429 && /^\d+$/.test(ultima.res.headers.get('retry-after') ?? ''),
    `status=${ultima.res.status} ${JSON.stringify(ultima.cuerpo)}`,
  )
  verificar('ninguna de esas altas de 9 KB creó una actuación', creadas === 0, `creadas=${creadas}`)
}

/* ---------- Resultado ---------- */
```

Verificá la sintaxis: `node --check scripts/prueba-e2e.mjs` no imprime nada.

- [ ] **Step 3: Correr las pruebas y verlas fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
  FALLA POST /api/casos lee el cuerpo con tope 
  FALLA POST /api/casos limita las altas sin sesión antes de leer el cuerpo 
  FALLA PATCH /api/casos/[id] lee el cuerpo con tope 
```

con `142/145 verificaciones pasaron` y `3 FALLARON`.

Con el servidor de prueba levantado: `E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e`.

Expected: todo lo anterior en `ok` y

```
[10g] Altas anónimas y PATCH
```

seguido de tres líneas que empiezan con `  FALLA un PATCH de 70 KB da 413 y dice el máximo alta=201 patch=200`, `  FALLA el alta anónima 11 del mismo teléfono en un minuto da 429 status=201` y `  FALLA ninguna de esas altas de 9 KB creó una actuación creadas=11`; al final `74/77 verificaciones pasaron` y `3 FALLARON`. (Esta corrida crea once actuaciones vacías en la base descartable.) Sin base descartable, esta parte y la del Step 7 no se corren y el informe lo dice.

- [ ] **Step 4: Tope y límite en `POST /api/casos`**

En `app/api/casos/route.ts`, reemplazá los imports:

```ts
import { NextResponse } from 'next/server'
import { errorApi } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento, VERSION_MANIFIESTO } from '@/lib/hash'
import { listarCasos, limpiarDatosAsegurado } from '@/lib/casos'
import { hashToken, nuevoToken } from '@/lib/claves'
import { anotarPosesion } from '@/lib/posesion'
import { alcanceDe, exigirRol } from '@/lib/sesion'
import { precargaDe } from '@/lib/polizas'
import { leerSesion } from '@/lib/sesion'
```

por:

```ts
import { NextResponse } from 'next/server'
import { errorApi, leerCuerpoLimitado } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento, VERSION_MANIFIESTO } from '@/lib/hash'
import { listarCasos, limpiarDatosAsegurado } from '@/lib/casos'
import { hashToken, nuevoToken } from '@/lib/claves'
import { ipDelCliente, limitar } from '@/lib/limite'
import { anotarPosesion, huellaDispositivo } from '@/lib/posesion'
import { alcanceDe, exigirRol } from '@/lib/sesion'
import { precargaDe } from '@/lib/polizas'
import { leerSesion } from '@/lib/sesion'
```

Reemplazá el comienzo de `POST`:

```ts
export async function POST(req: Request) {
  try {
    const cuerpo = await req.json().catch(() => ({}))
    const datos = limpiarDatosAsegurado(cuerpo)
    const pg = await db()
```

por:

```ts
export async function POST(req: Request) {
  try {
    const sesion = await leerSesion()
    /*
     * El alta sin cuenta es pública a propósito, y por eso se limita: sin tope, un cliente en
     * bucle llena la base de actuaciones vacías, cada una con su eslabón que no se puede borrar.
     * Corre antes de leer el cuerpo, así un cuerpo enorme también cuenta. La huella de la cookie
     * sirve sólo de clave en memoria: no se crea la cookie ni se guarda en ningún lado.
     */
    if (!sesion) {
      limitar('altas', { ip: ipDelCliente(req.headers), huella: await huellaDispositivo('telemetria', false) })
    }
    const cuerpo = await leerCuerpoLimitado(req, 8_192)
    const datos = limpiarDatosAsegurado(cuerpo)
    const pg = await db()
```

Y borrá la lectura de la sesión que quedó repetida más abajo: reemplazá

```ts
    const secreto = nuevoToken()
    const sesion = await leerSesion()
```

por:

```ts
    const secreto = nuevoToken()
```

(La precarga de la carátula, más abajo, sigue usando `sesion`.)

- [ ] **Step 5: Tope en `PATCH /api/casos/[id]`**

En `app/api/casos/[id]/route.ts`, reemplazá la línea 2:

```ts
import { errorApi } from '@/lib/api'
```

por:

```ts
import { errorApi, leerCuerpoLimitado } from '@/lib/api'
```

Y reemplazá:

```ts
    const cuerpo = await req.json().catch(() => ({}))
    const entrantes = (cuerpo?.respuestas ?? {}) as Record<string, unknown>
```

por:

```ts
    // 64 KB sobran para un guardado automático de respuestas; más es un cliente roto o un abuso.
    const cuerpo = (await leerCuerpoLimitado(req, 65_536)) as { respuestas?: unknown; datos?: unknown } | null
    const entrantes = (cuerpo?.respuestas ?? {}) as Record<string, unknown>
```

- [ ] **Step 6: Correr [V1] y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: las tres verificaciones del Step 3 en `ok`, `145/145 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 7: Correr el e2e y verlo pasar**

Reiniciá `npm run dev` y corré `E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e`.

Expected: `[1] Apertura de la actuación` sigue en `ok` (el alta sin cuerpo y sin sesión pasa el límite), `[3]` y `[3b]` siguen en `ok` (el PATCH normal entra en 64 KB), y

```
[10g] Altas anónimas y PATCH
```

con tres líneas que empiezan con `  ok   un PATCH de 70 KB da 413 y dice el máximo alta=201 patch=413`, `  ok   el alta anónima 11 del mismo teléfono en un minuto da 429 status=429` y `  ok   ninguna de esas altas de 9 KB creó una actuación creadas=0`; al final `77/77 verificaciones pasaron` y `Circuito completo funcionando.`. Al cortar el servidor, `git checkout -- next-env.d.ts`.

- [ ] **Step 8: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.` (incluye `  ok   ningún dato personal en claro dentro de un eslabón`: el `registrarEvento` del alta no cambió); `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `145/145 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 9: Commit**

```bash
git add "app/api/casos/route.ts" "app/api/casos/[id]/route.ts" "scripts/prueba-viaje.mjs" "scripts/prueba-e2e.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Poner tope al cuerpo de las actuaciones y límite a las altas sin cuenta

El alta sin cuenta es pública a propósito, y cada alta deja un eslabón que no se puede
borrar: sin límite, un cliente en bucle llena la base de actuaciones vacías. El límite corre
antes de leer el cuerpo, así un cuerpo enorme también cuenta, y usa la huella de la cookie
sólo como clave en memoria, sin crearla ni guardarla. Con sesión no se limita.

El alta acepta hasta 8 KB y el guardado del recorrido hasta 64 KB: req.json() leía cualquier
tamaño antes de mirar nada.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: `.env.example` con las variables del modo viaje y sin `TELEMETRIA_MAX_MUESTRAS`

**Files:**
- Modify: `.env.example` — las dos últimas líneas, `IMPACTO_GIRO_DPS=180` y `TELEMETRIA_MAX_MUESTRAS=1500` (hoy líneas 147–148).
- Test: `scripts/prueba-viaje.mjs`, bloque nuevo al final de [V1].

**Interfaces:**
- Consumes: las variables que leen `lib/telemetria.ts` (`MODO_VIAJE_ALERTA`, `MODO_VIAJE_CAIDA_SIN_GOLPE`, `MODO_VIAJE_MOTOR_MINIMO`, `TELEMETRIA_DIAS_CONSERVACION`) y `lib/limite.ts` (`PROXY_SALTOS_CONFIABLES`). `TELEMETRIA_MAX_MUESTRAS` ya no la lee nadie desde la Tarea 9.
- Produces: la sección `# ---------- Modo viaje ----------` de `.env.example`, con el motivo de cada variable. F2 edita el bloque `IMPACTO_*` de arriba y suma `CONDUCCION_*`; F6 las documenta en el README.

- [ ] **Step 1: Escribir la prueba que falla**

Agregá al final de la sección [V1] de `scripts/prueba-viaje.mjs` (antes de su `})`, con una línea vacía antes):

```js
  /* ---- Variables del modo viaje en .env.example ---- */
  {
    const { readFileSync } = await import('node:fs')
    const ejemplo = readFileSync(new URL('../.env.example', import.meta.url), 'utf8')
    for (const variable of ['MODO_VIAJE_ALERTA', 'MODO_VIAJE_CAIDA_SIN_GOLPE', 'MODO_VIAJE_MOTOR_MINIMO', 'TELEMETRIA_DIAS_CONSERVACION', 'PROXY_SALTOS_CONFIABLES']) {
      verificar(`.env.example documenta ${variable}`, new RegExp(`^${variable}=`, 'm').test(ejemplo))
    }
    verificar('.env.example ya no ofrece TELEMETRIA_MAX_MUESTRAS, que nadie lee', !ejemplo.includes('TELEMETRIA_MAX_MUESTRAS'))
  }
```

- [ ] **Step 2: Correr la prueba y verla fallar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected:

```
  FALLA .env.example documenta MODO_VIAJE_ALERTA 
  FALLA .env.example documenta MODO_VIAJE_CAIDA_SIN_GOLPE 
  FALLA .env.example documenta MODO_VIAJE_MOTOR_MINIMO 
  FALLA .env.example documenta TELEMETRIA_DIAS_CONSERVACION 
  FALLA .env.example documenta PROXY_SALTOS_CONFIABLES 
  FALLA .env.example ya no ofrece TELEMETRIA_MAX_MUESTRAS, que nadie lee 
```

con `145/151 verificaciones pasaron` y `6 FALLARON`.

- [ ] **Step 3: Documentar las variables**

Confirmá primero que nadie más lee la variable que se va: la búsqueda de `TELEMETRIA_MAX_MUESTRAS` en `app/`, `lib/` y `scripts/` sólo encuentra la prueba del Step 1.

En `.env.example`, reemplazá las dos últimas líneas:

```
IMPACTO_GIRO_DPS=180
TELEMETRIA_MAX_MUESTRAS=1500
```

por:

```bash
IMPACTO_GIRO_DPS=180

# ---------- Modo viaje ----------

# Qué hacen los teléfonos con el modo viaje encendido. Lo releen al encender, al volver a la
# aplicación y cada 10 minutos: sirve para encenderlo de a poco y para apagarlo sin publicar nada.
#   normal:     detecta, registra y muestra la alerta.
#   silenciosa: detecta y registra, pero no muestra la alerta. Para probar en campo sin molestar.
#   apagada:    la tarjeta dice que no está disponible y los teléfonos que lo tenían encendido lo apagan.
MODO_VIAJE_ALERTA=normal

# Una detención brusca sin golpe (el auto pasa de andar a quieto sin que el acelerómetro vea un
# choque). silenciosa la registra sin alertar, que es lo prudente hasta calibrar con datos de campo;
# alerta la trata como un posible choque.
MODO_VIAJE_CAIDA_SIN_GOLPE=silenciosa

# Versión mínima del motor del teléfono (entero, 1 o más). Subirla hace que un teléfono con la
# aplicación vieja abierta pida cerrarla y volver a abrirla, y que no alerte mientras tanto.
MODO_VIAJE_MOTOR_MINIMO=1

# Días que se conservan las alertas que no quedaron vinculadas a una actuación y los eventos de
# conducción. PROVISORIO: no es evidencia de ningún expediente y el plazo lo confirma el abogado.
# El golpe con el que se registra un accidente queda con la actuación y sigue su conservación.
TELEMETRIA_DIAS_CONSERVACION=90

# Cuántos proxies propios agregan su entrada a x-forwarded-for delante de la aplicación. El
# limitador de pedidos toma la IP del cliente contando esa cantidad desde el final: con 1 (un solo
# proxy, como el de Easypanel) usa la última entrada. En 0 no limita por IP, sólo por teléfono.
# Un número mayor que la cantidad real de proxies deja que el cliente elija su propia IP.
PROXY_SALTOS_CONFIABLES=1
```

- [ ] **Step 4: Correr la prueba y verla pasar**

Run: `SECCION=V1 npx tsx scripts/prueba-viaje.mjs`

Expected: las seis verificaciones del Step 2 en `ok`, `151/151 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 5: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin `  FALLA`; `prueba-viaje.mjs` con `151/151 verificaciones pasaron` y `Todo en orden.`.

- [ ] **Step 6: Commit**

```bash
git add ".env.example" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Documentar las variables del modo viaje y sacar la que nadie lee

MODO_VIAJE_ALERTA permite encender el modo viaje de a poco y apagarlo en todos los teléfonos
sin publicar una versión. TELEMETRIA_DIAS_CONSERVACION queda marcada como provisoria hasta
que la confirme el abogado. PROXY_SALTOS_CONFIABLES dice cuántos proxies propios hay delante:
con un número de más, el cliente elige su IP y esquiva el límite. TELEMETRIA_MAX_MUESTRAS ya
no la lee nadie: el tope lo pone el transporte.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verificación de la fase

**Comandos**

1. `git log --oneline -13` muestra los doce commits de esta fase, de la Tarea 12 (arriba) a la Tarea 1, y debajo el último de F0.
2. `git status --short` no muestra cambios salvo `?? docs/superpowers/plans/` (si `next-env.d.ts` aparece modificado, `git checkout -- next-env.d.ts`).
3. `npm run contrato && npm run tipos && npm run prueba`: `El contrato se cumple.`; `tsc --noEmit` sin salida; `prueba-logica.mjs` sin ninguna línea `  FALLA` y con `Todo en orden.`; `prueba-viaje.mjs` con `151/151 verificaciones pasaron` y `Todo en orden.` como última línea.
4. `SECCION=V1 npx tsx scripts/prueba-viaje.mjs` imprime sólo líneas `  ok   ` bajo `[V1] Servidor: cuerpo, límites, acceso, plan y transporte`, sin avisos sueltos.
5. Con la base descartable (ver «Antes de empezar»): `DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run dev` en una terminal y `E2E_DATABASE_URL=postgres://acta:acta_local@localhost:5432/acta npm run e2e` en otra: `[10a]` a `[10g]` en `ok`, `77/77 verificaciones pasaron` y `Circuito completo funcionando.`. Corrida otra vez enseguida, vuelve a dar `77/77` (cada frasco manda su IP). Sin base descartable, el informe de la fase dice que el e2e no se corrió.

**Chequeos manuales** (la matriz de §6.5 empieza en F4: F1 no tiene filas propias; esto es lo que el índice pide que se pueda probar al terminar F1)

| # | Procedimiento | Esperado |
|---|---|---|
| F1-a | Tarea 9, Step 12: en `/perfil`, encender el modo viaje del detector anterior, esperar al menos 20 segundos desde que cargó /perfil (el detector anterior no avisa en sus primeros 20 s) y simular un golpe con `DeviceMotionEvent` desde la consola | `POST /api/telemetria` → 201 con un `id` que empieza con `TEL-` y un cuerpo enviado sin números de más de 3 decimales; «Estoy bien» → `POST /api/telemetria/<ese id>/respuesta` → 200 con `La persona respondió que está bien.` |
| F1-b | Tarea 10, Step 5: abrir `/aviso?t=TEL-AAAAAA` con Network abierto | Ningún pedido al montar; sólo «Estoy bien, fue una falsa alarma» manda `POST /api/telemetria/TEL-AAAAAA/respuesta` |
| F1-c | `curl -i http://localhost:3000/api/telemetria/configuracion` | 200; cabecera `cache-control: no-store` y un `set-cookie` que empieza con `acta_posesion=` y trae `HttpOnly` y `SameSite=lax`; cuerpo con `version` de 16 hexadecimales, `"alerta":"normal"`, `"caida_sin_golpe":"silenciosa"`, `"motor_minimo":1`, `"dias_conservacion":90` y `umbrales` con los 7 campos de hoy (F2 los lleva a 15) |
| F1-d | `curl -i -X POST http://localhost:3000/api/telemetria -H "Content-Type: application/json" --data-binary "{"` | 400 `{"error":"El cuerpo del pedido no es JSON válido: mandalo como texto JSON.","tipo":"cuerpo"}` |
| F1-e | `curl -i http://localhost:3000/api/salud` | `"tablas":22` y `"faltan":[]` |

## Desvíos respecto del índice

1. **`app/components/DetectorImpacto.tsx` redondea sus lecturas y hace creciente su `t` (Tarea 9, Step 9).** El índice no lo lista en F1, pero sin eso F1 no cumple lo que promete («`DetectorImpacto.tsx` sigue registrando y respondiendo contra el servidor nuevo»). El detector anterior guarda las lecturas con todos sus dígitos (`app/components/DetectorImpacto.tsx:53-62`) y deja crecer el buffer hasta `HZ * SEGUNDOS_BUFFER * 1.5` = 1125 muestras (`app/components/DetectorImpacto.tsx:66`), mientras que `POST /api/telemetria` acepta `BYTES_MAX_TELEMETRIA = 131_072` (índice, «Interfaces › `lib/transporte-viaje.ts`»). Medido contra la ruta de la Tarea 9: 1000 muestras sin redondear son 142 731 bytes y reciben 413; las mismas redondeadas a 3 decimales (1 en el giro) son 72 882 bytes y reciben 201. Arreglo mínimo: redondear al tomar la muestra, sin tocar ningún nombre, tope ni texto del índice. En el mismo reemplazo, `t` se vuelve estrictamente creciente del lado del teléfono (si el redondeo repite el anterior, se usa el anterior + 1): `decodificarCuerpoLegado` rechaza con 400 un `t` que no crece (Tarea 7) y la ruta vieja lo aceptaba, así que dos `devicemotion` a menos de 1 ms (`app/components/DetectorImpacto.tsx:54` redondea al milisegundo y `:72` corre `analizarImpacto` en cada muestra) dejarían al detector sin id de alerta. F4 borra el archivo.
2. **La Tarea 6 cambia una línea de `app/api/telemetria/[id]/respuesta/route.ts`.** Con la firma nueva de `planEscalamiento`, la llamada `planEscalamiento(veredicto, respuesta !== 'sin_respuesta')` (`app/api/telemetria/[id]/respuesta/route.ts:40`) no compila (`TS2345`) y la tarea no podría cerrar con `npm run tipos` en verde. Se pasa `respuesta`; la ruta sigue leyendo con `req.json()` durante un commit, hasta que la Tarea 9 la reescribe entera como dice el índice.
3. **La rama de `ErrorTransporte` en `errorApi` entra en la Tarea 7, no en la 2.** El índice asigna a la Tarea 2 «ramas nuevas de `errorApi`» y a la 3 «la rama 429», pero `ErrorTransporte` nace en `lib/transporte-viaje.ts` (Tarea 7) y `lib/api.ts` no puede importarlo antes. El orden de las ramas es el del índice: `ErrorCuerpo`, `ErrorLimite`, `ErrorTransporte`, todas después de `ErrorActuacionCerrada` y antes de la base.
4. **`guardarEventosConduccion` inserta el lote en una sola sentencia.** El índice dice «`INSERT … ON CONFLICT (dispositivo_sha256, id_cliente) DO NOTHING` por evento»; la Tarea 8 hace un único `INSERT … SELECT … FROM jsonb_to_recordset($1) … ON CONFLICT (dispositivo_sha256, id_cliente) DO NOTHING`, que resuelve el conflicto fila por fila igual que cincuenta sentencias pero en un solo viaje a la base. `guardados` es su `rowCount` y repetir el lote da 0 (e2e `[10f]`).
