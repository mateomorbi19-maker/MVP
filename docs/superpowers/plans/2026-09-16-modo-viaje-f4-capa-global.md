# F4 · Capa global del modo viaje — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el modo viaje se encienda con un toque desde la tarjeta del inicio, siga escuchando en toda la aplicación, se vea en una píldora con su hoja de opciones y abra una alerta que tapa cualquier pantalla, con la ayuda mínima a un toque aun sin señal; todo sobre el motor de F3, sin tocar `lib/`.

**Architecture:** `app/components/ModoViaje.tsx` es un Client Component que el layout (Server Component) pone alrededor de `{children}`. Conecta el motor (`motorDelNavegador()` de `lib/viaje.ts`) con `useSyncExternalStore`, envuelve las pantallas en `div.raiz-app` (que queda `inert` con una alerta) y dibuja después, dentro de un límite de errores de clase, la región de estado, la píldora, la hoja (`<dialog>` con `showModal()`) y la alerta (`div role="alertdialog"`). La tarjeta es un componente sin exportar de `app/page.tsx` que lee el mismo contexto. Todo el aspecto vive en `app/globals.css`; el contrato suma cuatro comprobaciones y la documentación registra las piezas nuevas.

**Tech Stack:** Next.js 16.3 (app router, Turbopack, layout Server Component con un proveedor cliente), React 19.2 (`useSyncExternalStore`, `inert`, componente de clase como límite de errores, `<dialog onClose>`), TypeScript 7 (`tsc --noEmit`), CSS plano con tokens, `tsx` para `scripts/prueba-contrato.mjs`.

**Spec:** `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md` (§1.2, §3.1–§3.3, §3.6, §3.7, §4.1, §4.4, §5.6, §6.3, §6.5, §6.6) · índice: `docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md` (fase F4; Interfaces › `app/components/ModoViaje.tsx`, `app/page.tsx`, `app/components/BotonesEmergencia.tsx`, `app/components/Iconos.tsx`; Interfaz: clases, atributos y textos; Riesgos 17–38)

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

**Precondiciones** (todas, en este orden, desde la raíz del repositorio en Git Bash):

1. F3 terminada: el motor existe con las exportaciones del índice.

   ```bash
   grep -nE "^export (function motorDelNavegador|const ESTADO_SERVIDOR|interface EstadoModoViaje)" lib/viaje.ts
   ```

   Esperado: tres líneas, una por nombre. Si falta alguna, F3 no está terminada: no se empieza F4.

2. Las pruebas del motor pasan: `SECCION=V6 npx tsx scripts/prueba-viaje.mjs` y `SECCION=V7 npx tsx scripts/prueba-viaje.mjs` terminan cada una con la línea `Todo en orden.` y código 0.
3. Rama y árbol: `git rev-parse --abbrev-ref HEAD` imprime `modo-viaje-global`, y `git status --short` no muestra archivos de `app/`, `lib/`, `scripts/` ni `docs/CONTRATO-UI.md` / `docs/MAPA-PANTALLAS.md` modificados.
4. Las tres verificaciones en verde: `npm run contrato && npm run tipos && npm run prueba`. Esperado: `El contrato se cumple.`, `tsc --noEmit` sin ninguna línea `error TS`, y la última línea `Todo en orden.`; código 0.
5. `next dev` detenido cada vez que un paso corre `npm run build`: los dos escriben en `.next/`.

**Qué leer primero:**

- Del índice: «Fases › F4», «Interfaces › `app/components/ModoViaje.tsx`» (contexto, regla de la píldora, rótulos, decisiones), «`app/page.tsx`», «`BotonesEmergencia.tsx`», «`Iconos.tsx`», «Interfaz: clases, atributos y textos» completa y «Riesgos» 17–38. Los tipos que se consumen de F3 están en «Interfaces › `lib/viaje.ts`» (`EstadoModoViaje` y el bloque de tipos sin exportar: `MotorViaje`, `ResultadoRegistro`, `ResultadoBorrado`).
- Del diseño: §1.2 (el proveedor), §3.1–§3.3 (tarjeta, píldora, hoja, alerta), §3.6 (rutas), §3.7 (textos que cambian), §6.5 (matriz).
- Del repositorio: `app/layout.tsx`, `app/page.tsx`, `app/perfil/page.tsx`, `app/components/DetectorImpacto.tsx` (lo que se retira), `app/components/BombaCola.tsx` (el patrón de drenado que se copia), `app/components/BotonesEmergencia.tsx`, `app/components/Iconos.tsx`, `lib/viaje.ts` (F3), `scripts/prueba-contrato.mjs` completo, `docs/CONTRATO-UI.md` y `docs/MAPA-PANTALLAS.md`. En `app/globals.css`: los tokens (`:root` y el bloque oscuro), `.inicio`, `.envoltura`, `.punto`, `.aviso`, `.emergencias*`, `.solo-lectores`, `.chip-cola` y el bloque final de `prefers-reduced-motion`.
- De Next (ya verificado para este plan, pero leelo antes de tocar el layout): `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md` («Context providers»: el proveedor es un Client Component que recibe `children` y el layout sigue siendo Server Component), `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-pathname.md` (`next.config.mjs` no activa `cacheComponents`, así que `usePathname` en el layout no necesita `Suspense`) y `node_modules/next/dist/docs/01-app/01-getting-started/10-error-handling.md` (no hay `app/global-error.tsx`: la capa lleva su propio límite de errores).

**Cómo leer los pasos de este plan:**

- «Reemplazar»: buscá el bloque **Antes** por su contenido exacto (aparece una sola vez en el archivo) y cambialo por el bloque **Después**. Los números de línea son aproximados, del árbol al empezar F4.
- Las salidas esperadas de `npm run tipos` y `npm run contrato` se validaron aplicando estos mismos bloques sobre una copia del repositorio con los tipos de F3 del índice. Las cuentas «N/N comprobaciones» dependen de lo que sumaron F2 y F3, así que el plan cita las líneas `FALLA`, `ok` y la última línea, no la cuenta.
- Las revisiones en escritorio usan `npm run dev` y Chrome en `http://localhost:3000` (contexto seguro: `localhost` cuenta como https). Lo que depende del teléfono está en «Verificación de la fase».

---

### Task 1: Ícono `auto` y botones de emergencia con `chicos` y `alLlamar`

**Files:**
- Modify: `app/components/BotonesEmergencia.tsx` (archivo entero, 41 líneas)
- Modify: `app/components/Iconos.tsx` (tipo `NombreIcono`, líneas 1–13; bloque `nombre === 'verificar'`, líneas 84–90)
- Modify: `app/globals.css` (después de la regla `.emergencia .emergencias-inicio .boton-llamada-detalle`, línea ~1896)
- Test: `scripts/prueba-contrato.mjs` (comprobación existente «toda clase del marcado está definida en globals.css»)

**Interfaces:**
- Consumes: `EMERGENCIAS`, `EMERGENCIAS_EN_EL_LUGAR` y `type Emergencia` de `lib/emergencias.ts` (existentes).
- Produces: `export function BotonesEmergencia({ soloLugar = false, chicos = false, alLlamar }: { soloLugar?: boolean; chicos?: boolean; alLlamar?: (numero: string) => void }): React.JSX.Element` (clase `emergencias` con `soloLugar`; `emergencias emergencias-chicas` con `chicos`; si no, `emergencias emergencias-inicio`) · `NombreIcono` suma `'auto'` (sigue sin exportarse; `<Icono nombre="auto" />` compila). Los tres llamadores actuales (`app/page.tsx`, `app/aviso/page.tsx`, `app/s/[id]/pantallas/PantallaEmergencia.tsx`) no cambian.

- [ ] **Step 1: Confirmar que todavía no existen**

```bash
grep -n "'auto'" app/components/Iconos.tsx; grep -n "chicos\|alLlamar" app/components/BotonesEmergencia.tsx
```

Esperado: ninguna línea de salida.

- [ ] **Step 2: Reemplazar `app/components/BotonesEmergencia.tsx` entero por esto**

```tsx
import { EMERGENCIAS, EMERGENCIAS_EN_EL_LUGAR, type Emergencia } from '@/lib/emergencias'
import { Icono } from './Iconos'

/**
 * Los botones para llamar.
 *
 * Marcado estático con href tel:. No consulta nada ni depende del servidor a propósito:
 * es lo último que tiene que seguir funcionando cuando todo lo demás falla.
 *
 * `alLlamar` existe para la alerta del modo viaje: tocar un número después de un golpe es
 * pedir ayuda, y eso tiene que quedar registrado antes de que el teléfono pase al marcador.
 * Va en el onClick y sin preventDefault, así el enlace sigue igual aunque falle lo demás.
 * El archivo sigue sin 'use client': sólo se le pasa una función desde un Client Component.
 */
export function BotonesEmergencia({
  soloLugar = false,
  chicos = false,
  alLlamar,
}: {
  soloLugar?: boolean
  chicos?: boolean
  alLlamar?: (numero: string) => void
}): React.JSX.Element {
  const lista: Emergencia[] = soloLugar ? EMERGENCIAS_EN_EL_LUGAR : EMERGENCIAS
  /*
   * `emergencias` sola ya da la grilla de una columna, que es lo que la pantalla del lugar
   * necesita. Antes decia `emergencias emergencias-lugar` y esa segunda clase no existia
   * en la hoja: no se veia rota, pero cualquier ajuste a la variante del lugar se habria
   * escrito contra una clase que el CSS no conoce, sin que nada fallara.
   */
  return (
    <div className={soloLugar ? 'emergencias' : chicos ? 'emergencias emergencias-chicas' : 'emergencias emergencias-inicio'}>
      {lista.map((e) => (
        <a
          key={e.numero}
          href={`tel:${e.numero}`}
          className="boton boton-llamada"
          aria-label={`Llamar al ${e.numero}, ${e.nombre}`}
          onClick={alLlamar ? () => alLlamar(e.numero) : undefined}
        >
          <span className="boton-llamada-icono">
            <Icono nombre="telefono" />
          </span>
          <span className="boton-llamada-contenido">
            <span className="boton-llamada-nombre">{e.nombre}</span>
            <span className="boton-llamada-detalle">
              {e.numero} · {e.detalle}
            </span>
          </span>
          <span className="boton-llamada-accion">Llamar</span>
        </a>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Correr el contrato y ver la falla que obliga a escribir la regla**

```bash
npm run contrato
```

Esperado (código 1): en la sección `[3]`,

```text
  FALLA toda clase del marcado está definida en globals.css
         .emergencias-chicas (app/components/BotonesEmergencia.tsx)
```

y al final `1 FALLARON. El contrato está en docs/CONTRATO-UI.md.`

- [ ] **Step 4: Escribir la variante chica en `app/globals.css`**

Reemplazar. **Antes:**

```css
.emergencia .emergencias-inicio .boton-llamada-detalle {
  display: block;
}
```

**Después:**

```css
.emergencia .emergencias-inicio .boton-llamada-detalle {
  display: block;
}

/*
 * Los teléfonos debajo de «¿Hubo un choque?», en la alerta del modo viaje.
 *
 * La persona ya dijo que está bien y la pregunta que importa es la de arriba, así que van
 * más bajos; pero siguen en fila y con el número escrito, porque llamar tiene que seguir a
 * un toque y el 107 no se deduce de la palabra «Ambulancia».
 */
.emergencias-chicas .boton-llamada {
  min-height: 56px;
  padding: 10px 12px;
  gap: 10px;
}

.emergencias-chicas .boton-llamada-icono {
  width: 34px;
  height: 34px;
}

.emergencias-chicas .boton-llamada-icono .icono {
  width: 18px;
  height: 18px;
}
```

- [ ] **Step 5: Sumar el ícono `auto` en `app/components/Iconos.tsx`**

Reemplazar. **Antes:**

```tsx
type NombreIcono =
  | 'archivo'
  | 'personas'
```

**Después:**

```tsx
type NombreIcono =
  | 'archivo'
  | 'auto'
  | 'personas'
```

Reemplazar. **Antes:**

```tsx
      {nombre === 'verificar' ? (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5M7.8 10.7l1.8 1.8 3.8-4" />
        </>
      ) : null}
    </svg>
```

**Después** (los números van como expresión: entre comillas, `"1"` es el texto de una opción y el contrato lo rechaza en `app/components/`; el comentario tampoco lleva el número entre comillas por la misma razón):

```tsx
      {nombre === 'verificar' ? (
        <>
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 5 5M7.8 10.7l1.8 1.8 3.8-4" />
        </>
      ) : null}
      {/* Los números van como expresión y no entre comillas: entre comillas, un 1 es igual al texto de una opción del cuestionario y el contrato lo rechaza en app/components/. */}
      {nombre === 'auto' ? (
        <>
          <path d="M5 17v-4.4l1.8-4.5a2 2 0 0 1 1.9-1.3h6.6a2 2 0 0 1 1.9 1.3l1.8 4.5V17" />
          <path d="M4 12.6h16M5 17h14M7 17v2M17 17v2" />
          <circle cx={8.5} cy={14.8} r={1} />
          <circle cx={15.5} cy={14.8} r={1} />
        </>
      ) : null}
    </svg>
```

- [ ] **Step 6: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `  ok   toda clase del marcado está definida en globals.css`, `  ok   ninguna pantalla compara contra el texto de una respuesta`, `El contrato se cumple.`; `tsc --noEmit` sin líneas `error TS`; la última línea `Todo en orden.`; código 0.

- [ ] **Step 7: Revisar que los llamadores siguen iguales**

```bash
grep -rn "<BotonesEmergencia" app
```

Esperado: exactamente tres líneas, `app/page.tsx` (`<BotonesEmergencia />`), `app/aviso/page.tsx` (`<BotonesEmergencia />`) y `app/s/[id]/pantallas/PantallaEmergencia.tsx` (`<BotonesEmergencia soloLugar />`). Con `npm run dev`, `http://localhost:3000/` muestra las tres tarjetas de llamada del inicio igual que antes (tres columnas por encima de 520 px, una por debajo).

- [ ] **Step 8: Commit**

```bash
git add "app/components/BotonesEmergencia.tsx" "app/components/Iconos.tsx" "app/globals.css"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Sumar el ícono del auto y botones de emergencia que registran la llamada

La tarjeta del modo viaje necesita su ícono, y la alerta necesita que tocar un
teléfono después de un golpe quede registrado como pedido de ayuda antes de
pasar al marcador. La variante chica va debajo de «¿Hubo un choque?»; su regla
entra en este mismo commit porque sin ella el contrato rechaza la clase.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Estilos del modo viaje en `app/globals.css`

**Files:**
- Modify: `app/globals.css` (sección nueva antes de `/* ---------- Verificación pública ---------- */`, línea ~2711; bloque final `@media (prefers-reduced-motion: reduce)`, líneas ~2900–2916)
- Test: script de clases (paso 1) y `scripts/prueba-contrato.mjs` (colores, `:hover`, selectores de elemento)

**Interfaces:**
- Consumes: tokens existentes `--superficie`, `--superficie-2`, `--borde`, `--sombra`, `--sombra-alta`, `--sombra-rgb`, `--acento`, `--acento-suave`, `--tinta`, `--tinta-2`, `--ok`, `--emergencia`, `--sobre-color`, `--sobre-color-rgb`, `--radio`, `--ancho`. Ningún token nuevo.
- Produces: las clases F4 de «Interfaz › Clases nuevas» (`.raiz-app`, `.tarjeta-viaje` y sus ocho partes, `.interruptor`, `.interruptor-perilla`, `.pildora-viaje`, `.pildora-viaje-texto`, `.hoja-viaje` y sus siete partes, `.alerta-viaje` y sus ocho partes; `.emergencias-chicas` ya entró en la tarea 1), `@keyframes destello-viaje`, la reserva `body[data-pildora-viaje] .envoltura, body[data-pildora-viaje] .inicio` y `.tarjeta-viaje { min-height: 434px }`.

- [ ] **Step 1: Correr el control de clases y ver que faltan**

```bash
node <<'EOF'
const css = require('fs').readFileSync('app/globals.css', 'utf8')
const clases = ['raiz-app', 'tarjeta-viaje', 'tarjeta-viaje-encabezado', 'tarjeta-viaje-icono', 'tarjeta-viaje-titulo', 'tarjeta-viaje-limites', 'tarjeta-viaje-aviso-datos', 'tarjeta-viaje-estado', 'tarjeta-viaje-pie', 'tarjeta-viaje-accion', 'interruptor', 'interruptor-perilla', 'pildora-viaje', 'pildora-viaje-texto', 'hoja-viaje', 'hoja-viaje-encabezado', 'hoja-viaje-titulo', 'hoja-viaje-cerrar', 'hoja-viaje-seccion', 'hoja-viaje-subtitulo', 'hoja-viaje-dato', 'hoja-viaje-acciones', 'alerta-viaje', 'alerta-viaje-panel', 'alerta-viaje-destello', 'alerta-viaje-cabeza', 'alerta-viaje-titulo', 'alerta-viaje-texto', 'alerta-viaje-cuenta', 'alerta-viaje-botones', 'alerta-viaje-boton', 'emergencias-chicas']
const faltan = clases.filter((c) => !new RegExp('\\.' + c + '(?![-\\w])').test(css))
const reducido = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'))
const destelloQuieto = /\.alerta-viaje-destello\s*\{\s*animation: none;/.test(reducido)
console.log(faltan.length === 0 ? 'Están las 32 clases del modo viaje.' : 'Faltan ' + faltan.length + ': ' + faltan.join(' '))
console.log(destelloQuieto ? 'El destello queda quieto con prefers-reduced-motion.' : 'Falta .alerta-viaje-destello en el bloque de prefers-reduced-motion.')
process.exit(faltan.length === 0 && destelloQuieto ? 0 : 1)
EOF
```

Esperado (código 1):

```text
Faltan 31: raiz-app tarjeta-viaje tarjeta-viaje-encabezado tarjeta-viaje-icono tarjeta-viaje-titulo tarjeta-viaje-limites tarjeta-viaje-aviso-datos tarjeta-viaje-estado tarjeta-viaje-pie tarjeta-viaje-accion interruptor interruptor-perilla pildora-viaje pildora-viaje-texto hoja-viaje hoja-viaje-encabezado hoja-viaje-titulo hoja-viaje-cerrar hoja-viaje-seccion hoja-viaje-subtitulo hoja-viaje-dato hoja-viaje-acciones alerta-viaje alerta-viaje-panel alerta-viaje-destello alerta-viaje-cabeza alerta-viaje-titulo alerta-viaje-texto alerta-viaje-cuenta alerta-viaje-botones alerta-viaje-boton
Falta .alerta-viaje-destello en el bloque de prefers-reduced-motion.
```

- [ ] **Step 2: Raíz, reserva de la píldora, tarjeta e interruptor**

Los pasos 2 a 5 insertan, cada uno, un tramo antes de la misma marca; en orden, la sección queda completa. Reemplazar. **Antes:**

```css
/* ---------- Verificación pública ---------- */
```

**Después** (el alto mínimo de la tarjeta, 434 px, es el del estado más alto medido a 375 px: apagado por inactividad en un iPhone, con las dos advertencias, 433,27 px en Chrome):

```css
/* ---------- Modo viaje ---------- */

/*
 * El proveedor del modo viaje envuelve las pantallas en este div para poder volverlas inertes
 * mientras hay una alerta. `display: contents` lo saca de la caja y el maquetado no cambia:
 * ningún selector de esta hoja depende de `body > main`, y `.inicio > .acceso` e
 * `.inicio > .aviso` siguen valiendo porque el div envuelve a `main`, no a sus hijos. Un
 * selector nuevo de hijo directo de `body` se rompería acá.
 */
.raiz-app {
  display: contents;
}

/*
 * Mientras la píldora está visible, la página deja lugar abajo para que no tape el último
 * botón. `.chip-cola` no se toca: flota por arriba de la barra del recorrido, y en el
 * recorrido la píldora no aparece.
 */
body[data-pildora-viaje] .envoltura,
body[data-pildora-viaje] .inicio {
  padding-bottom: calc(96px + env(safe-area-inset-bottom));
}

/*
 * La tarjeta del inicio.
 *
 * El alto mínimo es el del estado más alto medido a 375px (apagado por inactividad en un
 * iPhone, con las dos advertencias): la hidratación y los cambios de estado no pueden mover
 * los teléfonos de emergencia que vienen debajo. El pie va con margin-top: auto para que el
 * interruptor quede siempre en el mismo lugar.
 */
.tarjeta-viaje {
  margin-top: 22px;
  min-height: 434px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px;
  background: var(--superficie);
  border: 1px solid var(--borde);
  border-radius: var(--radio);
  box-shadow: var(--sombra);
}

.tarjeta-viaje-encabezado {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tarjeta-viaje-icono {
  flex: none;
  width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border-radius: 12px;
  background: var(--acento-suave);
  color: var(--acento);
}

.tarjeta-viaje-titulo {
  margin: 0;
  font-size: 18px;
  font-weight: 750;
  letter-spacing: -0.02em;
  color: var(--tinta);
}

.tarjeta-viaje-limites {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.45;
  font-weight: 650;
  color: var(--tinta);
}

.tarjeta-viaje-aviso-datos {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.45;
  color: var(--tinta-2);
}

/* «Qué datos guarda» abre la hoja, así que es un botón; dentro de la frase se lee como enlace. */
.tarjeta-viaje-aviso-datos .enlace {
  display: inline;
  min-height: 0;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: none;
  font: inherit;
  font-weight: 650;
  color: var(--acento);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.tarjeta-viaje-estado {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 9px;
  font-size: 14.5px;
  line-height: 1.4;
  font-weight: 650;
  color: var(--tinta);
}

/* Las dos advertencias de antes de encender: el gap de la tarjeta ya las separa. */
.tarjeta-viaje .mini {
  margin: 0;
}

.tarjeta-viaje-pie {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
}

.tarjeta-viaje-accion {
  flex: 1;
  min-width: 0;
  min-height: 48px;
  justify-content: flex-start;
  gap: 9px;
  padding: 10px 14px;
  text-align: left;
  font-size: 14px;
}

/*
 * El interruptor es un botón con role="switch": el estado se dibuja desde aria-checked y no
 * desde una clase, así lo que se ve y lo que dice el lector de pantalla no pueden separarse.
 */
.interruptor {
  position: relative;
  flex: none;
  width: 60px;
  height: 36px;
  min-height: 36px;
  padding: 0;
  justify-content: flex-start;
  border-radius: 999px;
  border: 1px solid var(--borde);
  background: var(--borde);
}

/* El área de toque llega a 48px de alto sin agrandar el dibujo. */
.interruptor::before {
  content: '';
  position: absolute;
  inset: -6px -4px;
}

.interruptor-perilla {
  width: 28px;
  height: 28px;
  margin-left: 3px;
  border-radius: 50%;
  background: var(--sobre-color);
  box-shadow: 0 1px 4px rgb(var(--sombra-rgb) / 0.3);
  transition: transform 140ms ease;
}

.interruptor[aria-checked='true'] {
  background: var(--ok);
  border-color: var(--ok);
}

.interruptor[aria-checked='true'] .interruptor-perilla {
  transform: translateX(24px);
}

/* ---------- Verificación pública ---------- */
```

- [ ] **Step 3: La píldora**

Reemplazar. **Antes:**

```css
/* ---------- Verificación pública ---------- */
```

**Después:**

```css
/*
 * La píldora: fija abajo al centro, por encima de las pantallas y por debajo de la alerta.
 * Se centra con márgenes automáticos y no con transform, porque el :active de los botones
 * ya usa transform y la haría saltar hacia un costado al tocarla.
 */
.pildora-viaje {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: calc(12px + env(safe-area-inset-bottom));
  z-index: 25;
  width: max-content;
  max-width: calc(100% - 24px);
  margin: 0 auto;
  min-height: 48px;
  padding: 10px 18px;
  gap: 10px;
  border-radius: 999px;
  border: 1px solid var(--borde);
  background: var(--superficie);
  color: var(--tinta);
  box-shadow: var(--sombra-alta);
  font-size: 14.5px;
}

.pildora-viaje-texto {
  min-width: 0;
  text-align: left;
  line-height: 1.25;
}

/* ---------- Verificación pública ---------- */
```

- [ ] **Step 4: La hoja**

Reemplazar. **Antes:**

```css
/* ---------- Verificación pública ---------- */
```

**Después:**

```css
/*
 * La hoja de opciones: un <dialog> abierto con showModal(). Queda en la capa superior y deja
 * inerte todo lo demás, también la alerta; por eso el proveedor la cierra antes de pintar una.
 * Abajo en el teléfono, centrada en pantallas anchas.
 */
.hoja-viaje {
  width: 100%;
  max-width: var(--ancho);
  max-height: min(88dvh, 760px);
  margin: auto auto 0;
  padding: 0 18px calc(18px + env(safe-area-inset-bottom));
  border: 1px solid var(--borde);
  border-bottom: 0;
  border-radius: var(--radio) var(--radio) 0 0;
  background: var(--superficie);
  color: var(--tinta);
  box-shadow: var(--sombra-alta);
  overflow-y: auto;
  overscroll-behavior: contain;
}

.hoja-viaje::backdrop {
  background: rgb(var(--sombra-rgb) / 0.45);
}

.hoja-viaje-encabezado {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 0 10px;
  background: var(--superficie);
  border-bottom: 1px solid var(--borde);
}

.hoja-viaje-titulo {
  margin: 0;
  font-size: 19px;
}

.hoja-viaje-cerrar {
  min-height: 44px;
}

.hoja-viaje-seccion {
  display: grid;
  gap: 8px;
  padding: 16px 0;
  border-bottom: 1px solid var(--borde);
  /* Al desplazarse a una sección, que el encabezado fijo no le tape el título. */
  scroll-margin-top: 72px;
}

.hoja-viaje-seccion:last-child {
  border-bottom: 0;
}

.hoja-viaje-subtitulo {
  margin: 0;
  font-size: 15.5px;
}

.hoja-viaje-dato {
  margin: 0;
  font-size: 14.5px;
  line-height: 1.45;
  color: var(--tinta-2);
}

.hoja-viaje-acciones {
  display: grid;
  gap: 10px;
  margin-top: 4px;
}

@media (min-width: 700px) {
  .hoja-viaje {
    margin: auto;
    border-bottom: 1px solid var(--borde);
    border-radius: var(--radio);
  }
}

/* ---------- Verificación pública ---------- */
```

- [ ] **Step 5: La alerta**

Reemplazar. **Antes:**

```css
/* ---------- Verificación pública ---------- */
```

**Después:**

```css
/*
 * La alerta.
 *
 * No es un <dialog> ni un popover: la abre un sensor, sin activación, y el atrás de Android
 * la cerraría sin respuesta. Es un div fijo que tapa todo, con scroll propio para que en
 * apaisado o con letra grande los botones sigan al alcance.
 */
.alerta-viaje {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  overscroll-behavior: contain;
  background: var(--emergencia);
  color: var(--sobre-color);
}

/*
 * El refuerzo visual de la pregunta: un marco que se prende y se apaga una vez cada 1,2 s,
 * lejos de los tres destellos por segundo a partir de los cuales una luz intermitente puede
 * provocar una convulsión. Con prefers-reduced-motion queda fijo.
 */
.alerta-viaje-destello {
  position: fixed;
  inset: 0;
  pointer-events: none;
  border: 10px solid var(--sobre-color);
  animation: destello-viaje 1.2s steps(2, jump-none) infinite;
}

@keyframes destello-viaje {
  from {
    border-color: var(--sobre-color);
  }
  to {
    border-color: var(--emergencia);
  }
}

.alerta-viaje-panel {
  position: relative;
  flex: 1;
  width: 100%;
  max-width: var(--ancho);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 22px;
  padding: calc(26px + env(safe-area-inset-top)) calc(22px + env(safe-area-inset-right))
    calc(22px + env(safe-area-inset-bottom)) calc(22px + env(safe-area-inset-left));
}

.alerta-viaje-cabeza {
  display: grid;
  gap: 12px;
}

.alerta-viaje-titulo {
  margin: 0;
  font-size: clamp(34px, 9vw, 44px);
  line-height: 1.05;
  font-weight: 820;
  letter-spacing: -0.035em;
  color: var(--sobre-color);
}

/* El título recibe el foco por programa para que el lector lo diga primero; no es un control. */
.alerta-viaje-titulo:focus {
  outline: none;
}

.alerta-viaje-texto {
  margin: 0;
  font-size: 17px;
  line-height: 1.45;
  color: rgb(var(--sobre-color-rgb) / 0.92);
}

.alerta-viaje-cuenta {
  margin: 4px 0 0;
  font-size: 72px;
  line-height: 1;
  font-weight: 820;
  font-variant-numeric: tabular-nums;
  color: var(--sobre-color);
}

.alerta-viaje-botones {
  margin-top: auto;
  display: grid;
  gap: 12px;
}

.alerta-viaje-boton {
  width: 100%;
  min-height: 60px;
  font-size: 18px;
  background: var(--sobre-color);
  color: var(--emergencia);
  border-color: var(--sobre-color);
}

/*
 * Los primeros 600 ms los botones no reciben toques: el dedo que venía tocando la pantalla
 * de abajo no puede responder una alerta que la persona todavía no leyó.
 */
.alerta-viaje:not([data-armada]) .alerta-viaje-boton {
  pointer-events: none;
}

/*
 * Dentro de la alerta los teléfonos de la ayuda van en fila y con el número escrito, por el
 * mismo motivo que en `.emergencia`: en apaisado la grilla de tres columnas del inicio vuelve
 * y esconde el número.
 */
.alerta-viaje .emergencias-inicio {
  grid-template-columns: 1fr;
}

.alerta-viaje .emergencias-inicio .boton-llamada {
  min-height: 72px;
  flex-direction: row;
  gap: 12px;
  text-align: left;
}

.alerta-viaje .emergencias-inicio .boton-llamada-contenido {
  display: grid;
  flex: 1;
  text-align: left;
}

.alerta-viaje .emergencias-inicio .boton-llamada-detalle {
  display: block;
}

/* Apaisado en el soporte: título y cuenta a un lado, botones al otro, sin salirse de la pantalla. */
@media (max-height: 480px) {
  .alerta-viaje-panel {
    max-width: none;
    flex-direction: row;
    align-items: flex-start;
    gap: 28px;
    padding-top: calc(16px + env(safe-area-inset-top));
  }

  .alerta-viaje-cabeza,
  .alerta-viaje-botones {
    flex: 1;
    min-width: 0;
  }

  .alerta-viaje-botones {
    margin-top: 0;
  }

  .alerta-viaje-titulo {
    font-size: 32px;
  }

  .alerta-viaje-cuenta {
    font-size: 56px;
  }
}

/* ---------- Verificación pública ---------- */
```

- [ ] **Step 6: Neutralizar el destello y la perilla con `prefers-reduced-motion`**

Reemplazar el bloque final de la hoja. **Antes:**

```css
@media (prefers-reduced-motion: reduce) {
  .opcion,
  .zona,
  .marca-opcion,
  .faltante,
  .boton,
  .boton-primario,
  .boton-secundario,
  .boton-gigante {
    transition: none;
  }

  .punto[data-estado='espera'],
  .grabando {
    animation: none;
  }
}
```

**Después:**

```css
@media (prefers-reduced-motion: reduce) {
  .opcion,
  .zona,
  .marca-opcion,
  .faltante,
  .boton,
  .boton-primario,
  .boton-secundario,
  .boton-gigante,
  .interruptor-perilla {
    transition: none;
  }

  .punto[data-estado='espera'],
  .grabando {
    animation: none;
  }

  /* El marco de la alerta queda fijo, sin parpadear. */
  .alerta-viaje-destello {
    animation: none;
  }
}
```

- [ ] **Step 7: Correr de nuevo el control de clases**

Repetir el comando del paso 1. Esperado (código 0):

```text
Están las 32 clases del modo viaje.
El destello queda quieto con prefers-reduced-motion.
```

- [ ] **Step 8: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `  ok   ningún color literal fuera de los tokens`, `  ok   ninguna regla :hover fuera de @media (hover: hover)`, `  ok   ningún selector cuelga de un tipo de elemento sin motivo`, `El contrato se cumple.`; tipos sin `error TS`; `Todo en orden.`; código 0.

- [ ] **Step 9: Revisión manual**

Ninguna pantalla usa todavía estas clases: con `npm run dev`, `http://localhost:3000/` y `/perfil` se ven exactamente como antes del paso 2. Esa es la observación esperada.

- [ ] **Step 10: Commit**

```bash
git add "app/globals.css"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Agregar los estilos del modo viaje antes de dibujar sus piezas

Tarjeta, interruptor, píldora, hoja y alerta usan sólo tokens existentes. El alto
mínimo de la tarjeta es el del estado más alto medido a 375 px, para que la
hidratación no mueva los teléfonos de emergencia de abajo. El marco de la alerta
parpadea una vez cada 1,2 s, lejos de los tres destellos por segundo, y queda
quieto con prefers-reduced-motion.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Proveedor en el layout y retiro de `DetectorImpacto` (un solo commit)

**Files:**
- Create: `app/components/ModoViaje.tsx`
- Modify: `app/layout.tsx` (archivo entero, 59 líneas)
- Modify: `app/perfil/page.tsx` (import de la línea 6; bloque de las líneas 178–183)
- Delete: `app/components/DetectorImpacto.tsx`
- Test: `npm run tipos`, `npm run build` y el HTML prerenderizado de `/`

**Interfaces:**
- Consumes (F3, `lib/viaje.ts`): `motorDelNavegador(): MotorViaje | null`; `ESTADO_SERVIDOR: EstadoModoViaje`; `type EstadoModoViaje`; del motor: `suscribir(fn: () => void): () => void`, `estado(): EstadoModoViaje`, `cambiarRuta(ruta: string): void`, `drenarCola(): Promise<void>` (nunca rechaza). De la aplicación: `GET /api/perfil` → 200 `{ usuario, poliza_principal, contacto: { nombre, telefono, relacion } | null }` o 401.
- Produces: `export function ModoViaje({ children }: { children: React.ReactNode }): React.JSX.Element` y `export function useModoViaje(): ContextoModoViaje`, con `ContextoModoViaje = { estado: EstadoModoViaje; motor: MotorViaje | null; contacto: { nombre: string; telefono: string } | null; refTarjeta: (elemento: HTMLElement | null) => void; abrirHoja: (seccion?: SeccionHoja) => void }`, `type MotorViaje = NonNullable<ReturnType<typeof motorDelNavegador>>` y `type SeccionHoja = 'estado' | 'datos' | 'permisos'` (ninguno de los tres tipos se exporta; F5 suma `'golpe'`). Fuera del proveedor, `useModoViaje()` devuelve `{ estado: ESTADO_SERVIDOR, motor: null, contacto: null, refTarjeta: () => {}, abrirHoja: () => {} }`. Clave `localStorage` `acta:viaje:contacto` = `{ nombre, telefono, guardadoEn }`. Estructura: `<body><ModoViaje>{children}</ModoViaje><BombaCola /></body>` y `<div class="raiz-app">` alrededor de las pantallas, con `inert` mientras `estado.alerta !== null`.

- [ ] **Step 1: Reemplazar `app/layout.tsx` entero por esto**

```tsx
import type { Metadata, Viewport } from 'next'
import './globals.css'
import { BombaCola } from './components/BombaCola'
import { ModoViaje } from './components/ModoViaje'

export const metadata: Metadata = {
  title: 'Acta Digital de Siniestro',
  description:
    'Registro probatorio de siniestros viales con cadena de custodia verificable. Captura la evidencia en el lugar y en el momento del hecho.',
  applicationName: 'Acta Digital',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/iconos/icono-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/iconos/icono-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: [{ url: '/iconos/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  // Hace que iOS abra desde la pantalla de inicio sin barra de navegador.
  appleWebApp: {
    capable: true,
    title: 'Acta Digital',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  other: {
    // Next emite la forma estandarizada "mobile-web-app-capable". Las versiones de
    // iOS anteriores a la 16.4 sólo entienden la variante con prefijo de Apple, así
    // que se agrega también para que abran a pantalla completa.
    'apple-mobile-web-app-capable': 'yes',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  // Deja lugar para la barra de estado cuando corre a pantalla completa.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6f7f9' },
    { media: '(prefers-color-scheme: dark)', color: '#0f1216' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-AR">
      <body>
        {/*
          El modo viaje envuelve las pantallas en vez de vivir en una: la alerta tiene que poder
          aparecer en cualquier ruta, y cambiar de pantalla no puede apagar los sensores ni
          cortar una cuenta regresiva.
        */}
        <ModoViaje>{children}</ModoViaje>
        {/*
          Va en el layout y no en el recorrido: en iPhone no hay Background Sync, así que la
          cola sólo avanza con la aplicación abierta. Si la persona reabre en el inicio y no
          en su actuación, esto igual la drena.
        */}
        <BombaCola />
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Correr los tipos y ver que falta el proveedor**

```bash
npm run tipos
```

Esperado (código 1), exactamente:

```text
app/layout.tsx(4,27): error TS2307: Cannot find module './components/ModoViaje' or its corresponding type declarations.
```

- [ ] **Step 3: Crear `app/components/ModoViaje.tsx`**

```tsx
'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { usePathname } from 'next/navigation'
import { ESTADO_SERVIDOR, motorDelNavegador, type EstadoModoViaje } from '@/lib/viaje'

/**
 * El modo viaje en toda la aplicación.
 *
 * El motor (lib/viaje.ts) vive fuera de React: escucha los sensores, decide las alertas y
 * publica un estado inmutable. Esto es la capa fina que lo conecta con las pantallas. Va en
 * el layout y no en una pantalla porque la alerta tiene que poder aparecer en cualquier ruta,
 * y porque desmontar una pantalla no puede apagar los sensores ni perder una cuenta regresiva:
 * eso pasaba cuando el detector vivía al pie de «Mis datos».
 *
 * Ninguna pantalla registra listeners de sensores. Todo pasa por el motor.
 */

type MotorViaje = NonNullable<ReturnType<typeof motorDelNavegador>>

/** Sección de la hoja a la que se desplaza al abrir. */
type SeccionHoja = 'estado' | 'datos' | 'permisos'

interface Contacto {
  nombre: string
  telefono: string
}

interface ContextoModoViaje {
  /** ESTADO_SERVIDOR en el servidor y durante la hidratación. */
  estado: EstadoModoViaje
  /** null en el servidor y antes de hidratar. */
  motor: MotorViaje | null
  /** Contacto de confianza leído con sesión (memoria y localStorage 'acta:viaje:contacto'); null sin contacto. */
  contacto: Contacto | null
  /** Ref de callback de la tarjeta del inicio: la observa con IntersectionObserver para la regla de la píldora en '/'. */
  refTarjeta: (elemento: HTMLElement | null) => void
  /** Abre la hoja (showModal) y se desplaza a la sección. No hace nada con una alerta abierta. */
  abrirHoja: (seccion?: SeccionHoja) => void
}

/*
 * A nivel de módulo y no dentro del componente: useSyncExternalStore vuelve a suscribirse
 * cada vez que cambia la identidad de `suscribir`. El motor se crea recién acá adentro, que
 * sólo corre en el cliente; en el servidor y al hidratar vale ESTADO_SERVIDOR.
 */
const suscribir = (aviso: () => void) => motorDelNavegador()?.suscribir(aviso) ?? (() => {})
const obtener = () => motorDelNavegador()?.estado() ?? ESTADO_SERVIDOR
const obtenerEnServidor = () => ESTADO_SERVIDOR
/* La instancia del motor no cambia mientras vive el documento: no hay nada que escuchar. */
const sinCambios = () => () => {}
const sinMotor = () => null

const CLAVE_CONTACTO = 'acta:viaje:contacto'

function contactoValido(valor: unknown): Contacto | null {
  if (typeof valor !== 'object' || valor === null) return null
  const { nombre, telefono } = valor as { nombre?: unknown; telefono?: unknown }
  if (typeof nombre !== 'string' || typeof telefono !== 'string') return null
  if (nombre.trim() === '' || telefono.trim() === '') return null
  return { nombre, telefono }
}

/* localStorage puede tirar con sólo tocarlo (Safari en navegación privada): todo va en try/catch. */
function leerContactoGuardado(): Contacto | null {
  try {
    const crudo = window.localStorage.getItem(CLAVE_CONTACTO)
    return crudo === null ? null : contactoValido(JSON.parse(crudo))
  } catch {
    return null
  }
}

function recordarContacto(contacto: Contacto | null): void {
  try {
    if (contacto === null) window.localStorage.removeItem(CLAVE_CONTACTO)
    else window.localStorage.setItem(CLAVE_CONTACTO, JSON.stringify({ ...contacto, guardadoEn: Date.now() }))
  } catch {
    /* sin almacenamiento: el contacto se ofrece mientras la pestaña siga abierta */
  }
}

const FUERA_DEL_PROVEEDOR: ContextoModoViaje = {
  estado: ESTADO_SERVIDOR,
  motor: null,
  contacto: null,
  refTarjeta: () => {},
  abrirHoja: () => {},
}

const Contexto = createContext<ContextoModoViaje>(FUERA_DEL_PROVEEDOR)

/** El estado del modo viaje y lo que la capa ofrece. Fuera del proveedor, el estado del servidor y acciones que no hacen nada. */
export function useModoViaje(): ContextoModoViaje {
  return useContext(Contexto)
}

export function ModoViaje({ children }: { children: React.ReactNode }): React.JSX.Element {
  const estado = useSyncExternalStore(suscribir, obtener, obtenerEnServidor)
  const motor = useSyncExternalStore(sinCambios, motorDelNavegador, sinMotor)
  const ruta = usePathname()
  const [contacto, setContacto] = useState<Contacto | null>(null)
  const [tarjetaQuedoArriba, setTarjetaQuedoArriba] = useState(false)
  // La hoja vive acá y no en el motor: es de la interfaz, y el motor tiene que andar sin ella.
  const [hoja, setHoja] = useState<SeccionHoja | null>(null)
  const refHoja = useRef<HTMLDialogElement | null>(null)
  const observador = useRef<IntersectionObserver | null>(null)

  // Qué hacer en cada ruta (pausa en el recorrido, píldora) lo decide el motor; acá sólo se le avisa.
  useEffect(() => {
    motor?.cambiarRuta(ruta)
  }, [motor, ruta])

  /*
   * La cola del modo viaje se drena con el modo encendido o apagado, como BombaCola: en iPhone
   * no hay Background Sync, y una alerta con «necesito ayuda» que quedó sin subir tiene que
   * salir apenas vuelva la señal, aunque la persona ya haya apagado el modo.
   */
  useEffect(() => {
    if (motor === null) return
    const drenar = () => {
      void motor.drenarCola()
    }
    const alVolver = () => {
      if (document.visibilityState === 'visible') drenar()
    }
    drenar()
    window.addEventListener('online', drenar)
    document.addEventListener('visibilitychange', alVolver)
    const intervalo = window.setInterval(drenar, 30_000)
    return () => {
      window.removeEventListener('online', drenar)
      document.removeEventListener('visibilitychange', alVolver)
      window.clearInterval(intervalo)
    }
  }, [motor])

  useEffect(() => {
    setContacto(leerContactoGuardado())
  }, [])

  /*
   * El contacto de confianza se lee al encender y no al abrir la ayuda: después de un choque
   * puede no haber señal. Se guarda en el teléfono para ofrecer «Llamar a …» sin red, y un 401
   * lo borra para no seguir mostrando el contacto de una cuenta que ya no está en este teléfono.
   */
  const activo = estado.fase === 'activo'
  useEffect(() => {
    if (!activo) return
    let vigente = true
    fetch('/api/perfil')
      .then(async (r) => {
        if (r.status === 401) return null
        if (!r.ok) return undefined
        const cuerpo = (await r.json()) as { contacto?: unknown } | null
        return contactoValido(cuerpo?.contacto)
      })
      .then((leido) => {
        if (!vigente || leido === undefined) return
        recordarContacto(leido)
        setContacto(leido)
      })
      .catch(() => {
        /* sin red o sin servidor: queda el contacto que ya estaba guardado */
      })
    return () => {
      vigente = false
    }
  }, [activo])

  /*
   * En el inicio la píldora sólo aparece si la tarjeta quedó arriba, fuera de la vista: si
   * todavía está abajo, la persona llega a ella bajando. Como «Tuve un accidente» está arriba
   * de la tarjeta, así la píldora nunca lo tapa, sin observar ningún otro elemento.
   */
  const refTarjeta = useCallback((elemento: HTMLElement | null) => {
    observador.current?.disconnect()
    observador.current = null
    if (elemento === null || typeof IntersectionObserver === 'undefined') {
      setTarjetaQuedoArriba(false)
      return
    }
    const nuevo = new IntersectionObserver((entradas) => {
      const ultima = entradas[entradas.length - 1]
      if (ultima) setTarjetaQuedoArriba(!ultima.isIntersecting && ultima.boundingClientRect.bottom < 0)
    })
    nuevo.observe(elemento)
    observador.current = nuevo
  }, [])

  useEffect(() => () => observador.current?.disconnect(), [])

  // Mientras hay una alerta, la pantalla de abajo no recibe foco ni toques.
  const capaBloqueante = estado.alerta !== null

  const abrirHoja = useCallback(
    (seccion: SeccionHoja = 'estado') => {
      const dialogo = refHoja.current
      // Un <dialog> modal va a la capa superior y dejaría inerte la alerta: con una alerta, nada.
      if (capaBloqueante || dialogo === null) return
      if (!dialogo.open) dialogo.showModal()
      setHoja(seccion)
    },
    [capaBloqueante],
  )

  /*
   * Si se abre una alerta con la hoja abierta, la hoja se cierra antes de pintar: con un
   * useEffect habría un cuadro con la alerta debajo de la hoja, tapada y sin recibir toques.
   */
  useLayoutEffect(() => {
    if (capaBloqueante && refHoja.current?.open) refHoja.current.close()
  }, [capaBloqueante])

  const valor = useMemo<ContextoModoViaje>(
    () => ({ estado, motor, contacto, refTarjeta, abrirHoja }),
    [estado, motor, contacto, refTarjeta, abrirHoja],
  )

  return (
    <Contexto.Provider value={valor}>
      <div className="raiz-app" inert={capaBloqueante || undefined}>
        {children}
      </div>
    </Contexto.Provider>
  )
}
```

- [ ] **Step 4: Correr los tipos**

```bash
npm run tipos
```

Esperado: ninguna línea `error TS`, código 0.

- [ ] **Step 5: Borrar el detector anterior y ver dónde se usaba**

```bash
git rm "app/components/DetectorImpacto.tsx"
npm run tipos
```

Esperado: `rm 'app/components/DetectorImpacto.tsx'` y después (código 1), exactamente:

```text
app/perfil/page.tsx(6,33): error TS2307: Cannot find module '@/app/components/DetectorImpacto' or its corresponding type declarations.
```

- [ ] **Step 6: Sacar el detector de `app/perfil/page.tsx`**

Reemplazar. **Antes:**

```tsx
import { Marca } from '@/app/components/Marca'
import { DetectorImpacto } from '@/app/components/DetectorImpacto'
import { SinSesion } from '@/app/components/SinSesion'
```

**Después:**

```tsx
import { Marca } from '@/app/components/Marca'
import { SinSesion } from '@/app/components/SinSesion'
```

Reemplazar (el comentario explicaba la separación con la tarjeta que se va). **Antes:**

```tsx
      {/* El botón azul a ancho completo pegado al borde de arriba de la tarjeta se lee como su
          encabezado, y el pulgar cae sobre «Encender el modo viaje» en vez de sobre Guardar.
          Misma separación que /cuenta entre los accesos y las acciones de sesión. */}
      <div className="separacion-bloque" />
      <DetectorImpacto />

      <p className="centrado">
```

**Después:**

```tsx
      <p className="centrado">
```

- [ ] **Step 7: Confirmar que no quedan usos en las pantallas**

```bash
grep -rn "DetectorImpacto" app
```

Esperado: ninguna línea, código 1. (Los comentarios de `lib/transporte-viaje.ts` que nombran el cuerpo del detector anterior se quedan: describen un formato que el servidor sigue aceptando.)

- [ ] **Step 8: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, tipos sin `error TS`, `Todo en orden.`, código 0.

- [ ] **Step 9: Compilar y mirar el HTML prerenderizado del inicio**

Con `next dev` detenido:

```bash
npm run build && grep -c 'class="raiz-app"' .next/server/app/index.html
```

Esperado: la salida de Next incluye `✓ Compiled successfully` y `✓ Generating static pages`, la lista de rutas mantiene `○ /` y `○ /perfil` como estáticas, y el `grep` imprime `1`. Sin `inert` en ese HTML: `grep -c 'raiz-app" inert' .next/server/app/index.html` imprime `0`.

- [ ] **Step 10: Revisión manual en escritorio**

`npm run dev` y Chrome en `http://localhost:3000/perfil`:

- La tarjeta «Modo viaje» ya no aparece al pie; después del formulario (o de «Entrá para ver tus datos» sin sesión) viene «Volver a mi cuenta».
- En Elements, `<body>` contiene `<div class="raiz-app">` y adentro `<main class="envoltura">`; el `div` no tiene `inert` y la página se ve igual que antes (el `div` no genera caja).
- En la consola, `__actaMotorViaje.estado().fase` devuelve `'apagado'` y `__actaMotorViaje.estado().ruta.actual` devuelve `'/perfil'`; tocar «Volver a mi cuenta» y volver con el atrás del navegador cambia `ruta.actual` sin errores en la consola.

- [ ] **Step 11: Commit**

```bash
git add "app/components/ModoViaje.tsx" "app/layout.tsx" "app/perfil/page.tsx"
git status --short
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Montar el modo viaje en el layout y retirar el detector de «Mis datos»

El detector vivía al pie de «Mis datos»: salir de esa pantalla lo desmontaba y
dejaba de escuchar, aun con una cuenta regresiva en curso. El proveedor envuelve
todas las pantallas desde el layout, conecta el motor con useSyncExternalStore
y drena la cola del modo viaje con el modo encendido o apagado. DetectorImpacto
se borra en este mismo commit para que no haya nunca dos detectores escuchando
el acelerómetro, ni ninguno.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

Esperado antes del commit: `git status --short` muestra `D  app/components/DetectorImpacto.tsx`, `A  app/components/ModoViaje.tsx`, `M  app/layout.tsx` y `M  app/perfil/page.tsx`, y nada más de `app/`.

---

### Task 4: Tarjeta del inicio, textos de §3.7 y «Tuve un accidente» apaga el modo

**Files:**
- Modify: `app/page.tsx` (imports, líneas 10–11; comienzo de `Inicio`, líneas 38–40; `iniciar()`, líneas 55–56; enlace «Continuar la actuación…», líneas 123–129; pie y fin del archivo, líneas 156–166)
- Modify: `app/perfil/page.tsx` (bajada del contacto de confianza, líneas 143–146)
- Test: `npm run tipos`, `npm run contrato` y los textos con `grep`

**Interfaces:**
- Consumes: `useModoViaje()` (tarea 3) → `estado`, `motor`, `refTarjeta`, `abrirHoja`; del motor (F3): `encender(): Promise<void>` (lo sincrónico va antes del primer `await`), `apagar(motivo: 'usuario' | 'inactividad' | 'accidente_registrado' | 'configuracion'): void`, `reanudar(): Promise<void>`, `tocar(): void`, `seguirViaje(): void`; de `EstadoModoViaje`: `fase`, `motivoNoSoportado`, `configuracion.alerta`, `configuracion.desactualizado`, `apagadoPor`, `inactividad`, `pantalla`, `avisos`, `sesionDeAudio`, `siguioPorMovimientoEn`, `deteccion.activaMs`.
- Produces: `TarjetaModoViaje`, `lineaDeLaTarjeta` y `horaCorta`, sin exportar, dentro de `app/page.tsx`; la tarjeta es hija directa de `main.inicio`, después del enlace «Continuar la actuación que dejaste abierta» y antes de `section.bloque-inicio`, y le pasa `refTarjeta` a su `section`. `iniciar()` llama `motor?.apagar('accidente_registrado')` antes del `fetch`.

Qué dibuja la tarjeta, en orden: ícono `auto` y título; los dos límites (`tarjeta.limite_abierta` y `tarjeta.no_llama`, cada uno entero en una línea del código); el aviso de datos con el botón «Qué datos guarda» (abre la hoja en `'datos'`); una línea de estado; con fase `apagado`, las advertencias `tarjeta.sin_vibracion` o `tarjeta.sin_vibracion_con_sesion` (sólo si `avisos.vibracion === 'no_soportada'`) y `tarjeta.bateria`; y el pie con la acción a la izquierda y el interruptor a la derecha. Estados que hacen del texto un botón: `reanudar_con_toque` (→ `motor.reanudar()`), `activo` con `inactividad` (→ `motor.seguirViaje()`), `activo` con `pantalla: 'sin_retener'` o con `avisos` en `requiere_toque` (→ `motor.tocar()`). `sin_permiso`, y `sin_lecturas` en Android, muestran la línea y el botón «Cómo habilitarlo» (hoja en `'permisos'`; ver «Desvíos»). Sin interruptor con `sin_lecturas`, `no_soportado`, `otra_ventana` o configuración `apagada`; deshabilitado con `desconocido` y `reanudando` (el estado del servidor y de la hidratación).

- [ ] **Step 1: Poner la tarjeta en su lugar y ver que todavía no existe**

En `app/page.tsx`, reemplazar. **Antes:**

```tsx
          Continuar la actuación que dejaste abierta
        </Link>
      ) : null}

      <section className="bloque-inicio">
```

**Después:**

```tsx
          Continuar la actuación que dejaste abierta
        </Link>
      ) : null}

      <TarjetaModoViaje />

      <section className="bloque-inicio">
```

```bash
npm run tipos
```

Esperado (código 1), exactamente:

```text
app/page.tsx(129,8): error TS2304: Cannot find name 'TarjetaModoViaje'.
```

- [ ] **Step 2: Importar el contexto y el tipo del estado**

Reemplazar. **Antes:**

```tsx
import { Icono } from './components/Iconos'
import { actuacionAbierta, recordarActuacion } from '@/lib/local'
```

**Después:**

```tsx
import { Icono } from './components/Iconos'
import { useModoViaje } from './components/ModoViaje'
import { actuacionAbierta, recordarActuacion } from '@/lib/local'
import type { EstadoModoViaje } from '@/lib/viaje'
```

- [ ] **Step 3: Tomar el motor en `Inicio`**

Reemplazar. **Antes:**

```tsx
export default function Inicio() {
  const router = useRouter()
  const [enviando, setEnviando] = useState(false)
```

**Después:**

```tsx
export default function Inicio() {
  const router = useRouter()
  const { motor } = useModoViaje()
  const [enviando, setEnviando] = useState(false)
```

- [ ] **Step 4: «Tuve un accidente» apaga el modo viaje antes del `fetch`**

Reemplazar. **Antes:**

```tsx
  async function iniciar() {
    setEnviando(true)
```

**Después:**

```tsx
  async function iniciar() {
    /*
     * Registrar un accidente apaga el modo viaje antes de pedir nada, y el motor descarta los
     * episodios abiertos: el golpe que la persona está por documentar no puede abrir una
     * alerta encima del recorrido.
     */
    motor?.apagar('accidente_registrado')
    setEnviando(true)
```

- [ ] **Step 5: Texto del pie (§3.7) y la tarjeta al final del archivo**

Reemplazar el final de `app/page.tsx`. **Antes:**

```tsx
        <p className="mini centrado">
          Vamos a pedirte permiso de ubicación, cámara y micrófono para registrar dónde, cuándo y cómo ocurrió. Los
          datos se usan sólo para documentar este siniestro ante tu aseguradora (Ley 25.326).
        </p>
        <BarraCuenta />
      </div>
    </main>
  )
}
```

**Después:**

```tsx
        <p className="mini centrado">
          Si registrás un accidente, vamos a pedirte permiso de ubicación, cámara y micrófono para documentar dónde,
          cuándo y cómo ocurrió ante tu aseguradora (Ley 25.326). Lo que guarda el modo viaje está explicado en su
          tarjeta.
        </p>
        <BarraCuenta />
      </div>
    </main>
  )
}

/** Hora de pared en 24 h: algunos motores agregan «a. m.» si no se pide hour12: false. */
function horaCorta(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** 'tocar', 'reanudar' y 'seguir' hacen del texto de estado un botón; 'como_habilitar' agrega «Cómo habilitarlo». */
type AccionTarjeta = 'tocar' | 'reanudar' | 'seguir' | 'como_habilitar'

interface LineaTarjeta {
  texto: string
  punto: 'ok' | 'espera' | 'error' | null
  accion: AccionTarjeta | null
}

/**
 * La única línea de estado de la tarjeta. `ahora` entra por parámetro: «Seguimos: el auto
 * volvió a moverse» se muestra dos minutos y después vuelve la línea normal.
 */
function lineaDeLaTarjeta(estado: EstadoModoViaje, ahora: number): LineaTarjeta | null {
  if (estado.configuracion.alerta === 'apagada') {
    return { texto: 'El modo viaje no está disponible por ahora', punto: null, accion: null }
  }
  if (estado.fase === 'no_soportado') {
    return estado.motivoNoSoportado === 'inseguro'
      ? { texto: 'Abrí la aplicación desde su dirección https', punto: 'error', accion: null }
      : { texto: 'Este equipo no entrega lecturas de movimiento: el modo viaje funciona en el teléfono', punto: 'error', accion: null }
  }
  if (estado.configuracion.desactualizado) {
    return { texto: 'Cerrá y volvé a abrir la aplicación para actualizarla', punto: 'espera', accion: null }
  }
  switch (estado.fase) {
    case 'sin_lecturas':
      // En Android, negar «Sensores de movimiento» no da sin_permiso: los eventos no llegan y termina acá.
      return {
        texto: 'Este equipo no entrega lecturas de movimiento: el modo viaje funciona en el teléfono',
        punto: 'error',
        accion: estado.plataforma === 'android' ? 'como_habilitar' : null,
      }
    case 'otra_ventana':
      return { texto: 'El modo viaje está abierto en otra ventana', punto: null, accion: null }
    case 'sin_permiso':
      return { texto: 'Sin permiso de movimiento', punto: 'error', accion: 'como_habilitar' }
    case 'reanudar_con_toque':
      return { texto: 'Tocá para reanudar (el iPhone te vuelve a pedir permiso)', punto: 'espera', accion: 'reanudar' }
    case 'apagado':
      if (estado.apagadoPor?.motivo === 'inactividad') {
        return { texto: `Se apagó solo a las ${horaCorta(estado.apagadoPor.hora)} porque el auto estuvo detenido`, punto: null, accion: null }
      }
      if (estado.apagadoPor?.motivo === 'accidente_registrado') {
        return { texto: 'Se apagó al registrar el accidente', punto: null, accion: null }
      }
      return null
    case 'activo':
      if (estado.inactividad !== null) {
        return { texto: '¿Terminaste el viaje? Tocá para seguir', punto: 'espera', accion: 'seguir' }
      }
      // Sin la pantalla retenida la detección muere al apagarse: va antes que el sonido.
      if (estado.pantalla === 'sin_retener') {
        return { texto: 'Tocá la pantalla para que no se apague', punto: 'espera', accion: 'tocar' }
      }
      if (estado.avisos.sonido === 'requiere_toque' || estado.avisos.vibracion === 'requiere_toque') {
        return { texto: 'Tocá la pantalla para activar el sonido y la vibración del aviso', punto: 'espera', accion: 'tocar' }
      }
      if (estado.siguioPorMovimientoEn !== null && ahora - estado.siguioPorMovimientoEn < 120_000) {
        return { texto: 'Seguimos: el auto volvió a moverse', punto: 'ok', accion: null }
      }
      return { texto: `Activo · detección ${Math.floor(estado.deteccion.activaMs / 60_000)} min`, punto: 'ok', accion: null }
    default:
      return null
  }
}

/**
 * La tarjeta del modo viaje.
 *
 * Los dos límites y el aviso de datos se leen ANTES del interruptor, que va abajo a la
 * derecha y nunca en la fila del título: quien enciende creyendo que detecta con la pantalla
 * bloqueada no vuelve a leer la letra chica. No depende de ninguna consulta, y su alto
 * mínimo es fijo para que los teléfonos de emergencia de abajo no se muevan al hidratar.
 */
function TarjetaModoViaje() {
  const { estado, motor, refTarjeta, abrirHoja } = useModoViaje()
  const linea = lineaDeLaTarjeta(estado, Date.now())
  const encendido =
    estado.fase === 'reanudando' ||
    estado.fase === 'pidiendo' ||
    estado.fase === 'activo' ||
    estado.fase === 'en_pausa' ||
    estado.fase === 'reanudar_con_toque'
  const conInterruptor =
    estado.configuracion.alerta !== 'apagada' &&
    estado.fase !== 'sin_lecturas' &&
    estado.fase !== 'no_soportado' &&
    estado.fase !== 'otra_ventana'
  const textoEsBoton = linea !== null && (linea.accion === 'tocar' || linea.accion === 'reanudar' || linea.accion === 'seguir')

  function alternar() {
    if (motor === null) return
    // Nada antes de encender(): el wake lock, el audio y el permiso de movimiento necesitan el gesto entero.
    if (encendido) motor.apagar('usuario')
    else void motor.encender()
  }

  function actuar() {
    if (motor === null || linea === null) return
    if (linea.accion === 'reanudar') void motor.reanudar()
    else if (linea.accion === 'seguir') motor.seguirViaje()
    else motor.tocar()
  }

  return (
    <section className="tarjeta-viaje" ref={refTarjeta} aria-labelledby="tarjeta-viaje-titulo">
      <div className="tarjeta-viaje-encabezado">
        <span className="tarjeta-viaje-icono">
          <Icono nombre="auto" />
        </span>
        <h2 className="tarjeta-viaje-titulo" id="tarjeta-viaje-titulo">
          Modo viaje
        </h2>
      </div>

      <p className="tarjeta-viaje-limites">
        Funciona sólo con la aplicación abierta y la pantalla encendida.
        No llama ni le avisa a nadie por su cuenta.
      </p>

      <p className="tarjeta-viaje-aviso-datos">
        Si detecta un posible choque, manda a tu aseguradora la hora, los sensores y la ubicación. Las frenadas bruscas
        se guardan sin ubicación y sin tu cuenta. Es optativo.{' '}
        <button type="button" className="enlace" aria-haspopup="dialog" onClick={() => abrirHoja('datos')}>
          Qué datos guarda
        </button>
      </p>

      {linea !== null && !textoEsBoton ? (
        <p className="tarjeta-viaje-estado">
          {linea.punto !== null ? <span className="punto" data-estado={linea.punto} /> : null}
          {linea.texto}
        </p>
      ) : null}

      {estado.fase === 'apagado' && conInterruptor ? (
        <>
          {estado.avisos.vibracion === 'no_soportada' ? (
            <p className="mini">
              {estado.sesionDeAudio
                ? 'En este teléfono la alerta no vibra'
                : 'En este teléfono la alerta no vibra y, en silencio, puede no sonar'}
            </p>
          ) : null}
          <p className="mini">Con la pantalla encendida y el GPS gasta batería: conviene tenerlo enchufado.</p>
        </>
      ) : null}

      <div className="tarjeta-viaje-pie">
        {linea !== null && textoEsBoton ? (
          <button type="button" className="boton boton-secundario tarjeta-viaje-accion" onClick={actuar}>
            <span className="punto" data-estado="espera" />
            {linea.texto}
          </button>
        ) : null}
        {linea?.accion === 'como_habilitar' ? (
          <button
            type="button"
            className="boton boton-secundario tarjeta-viaje-accion"
            aria-haspopup="dialog"
            onClick={() => abrirHoja('permisos')}
          >
            Cómo habilitarlo
          </button>
        ) : null}
        {conInterruptor ? (
          <button
            type="button"
            role="switch"
            aria-checked={encendido}
            aria-labelledby="tarjeta-viaje-titulo"
            className="interruptor"
            disabled={motor === null || estado.fase === 'desconocido' || estado.fase === 'reanudando'}
            onClick={alternar}
          >
            <span className="interruptor-perilla" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </section>
  )
}
```

- [ ] **Step 6: Bajada del contacto de confianza (§3.7) en `app/perfil/page.tsx`**

Reemplazar. **Antes:**

```tsx
          <p className="apagado mini">
            A quién avisarle si el teléfono detecta un impacto y no respondés. Avisale a esa persona que la cargaste:
            son sus datos, no los tuyos.
          </p>
```

**Después:**

```tsx
          <p className="apagado mini">
            A quién vas a poder llamar con un toque desde la pantalla de ayuda si el teléfono detecta un golpe. Avisale
            a esa persona que la cargaste: son sus datos, no los tuyos.
          </p>
```

- [ ] **Step 7: Tipos, contrato y los textos en su lugar**

```bash
npm run tipos && npm run contrato && grep -c "Funciona sólo con la aplicación abierta y la pantalla encendida.\|No llama ni le avisa a nadie por su cuenta.\|Si registrás un accidente, vamos a pedirte permiso" app/page.tsx && grep -c "A quién vas a poder llamar con un toque" app/perfil/page.tsx
```

Esperado: tipos sin `error TS`; `  ok   toda clase del marcado está definida en globals.css`, `  ok   los estilos en línea respetan su cupo` y `El contrato se cumple.`; después `3` y `1`; código 0.

- [ ] **Step 8: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, tipos sin `error TS`, `Todo en orden.`, código 0.

- [ ] **Step 9: Revisión manual en escritorio**

`npm run dev`, Chrome en `http://localhost:3000/` con la ventana en 375 px de ancho (DevTools › Toggle device toolbar › Responsive 375×667):

- Debajo de «Tuve un accidente» (y de «Continuar la actuación…» si aparece) está la tarjeta: ícono de auto y «Modo viaje»; «Funciona sólo con la aplicación abierta y la pantalla encendida. No llama ni le avisa a nadie por su cuenta.»; el aviso de datos terminado en el botón subrayado «Qué datos guarda»; «Con la pantalla encendida y el GPS gasta batería: conviene tenerlo enchufado.»; y el interruptor apagado abajo a la derecha. Después, «¿Necesitás ayuda urgente?» con los teléfonos.
- Recargar: durante la carga la tarjeta ya ocupa su alto (434 px en Elements › Computed) y los teléfonos de emergencia no saltan cuando aparece el interruptor.
- «Qué datos guarda» todavía no abre nada: la hoja llega en la tarea 5.
- Tocar el interruptor: pasa a encendido y Chrome puede pedir la ubicación (bloquearla). A los 3 s, como el escritorio no entrega lecturas de movimiento, la línea dice «Este equipo no entrega lecturas de movimiento: el modo viaje funciona en el teléfono» y el interruptor desaparece. (Que «Tuve un accidente» apague el modo se revisa en la tarea 5, con el modo encendido.)
- Al terminar, en la consola: `localStorage.removeItem('acta:viaje:sin-sensores')` y recargar, para que las revisiones de las tareas 5 y 6 vuelvan a tener interruptor.

- [ ] **Step 10: Commit**

```bash
git add "app/page.tsx" "app/perfil/page.tsx"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Encender el modo viaje desde el inicio, con sus límites antes del interruptor

La tarjeta va debajo de la sección del accidente y dice, antes de encender, que
sólo funciona con la aplicación abierta, que no llama a nadie y qué datos manda.
«Tuve un accidente» apaga el modo antes de abrir la actuación, para que el golpe
que se está documentando no abra una alerta encima del recorrido. El pie del
inicio y la bajada del contacto de confianza dejan de prometer lo que no hacen.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Píldora, región de estado y hoja

**Files:**
- Modify: `app/components/ModoViaje.tsx` (siete reemplazos: el `return` del proveedor; el import de `react`; después de `recordarContacto`; los estados del proveedor; la línea de `capaBloqueante`; después del `useLayoutEffect` que cierra la hoja; el final del archivo)
- Test: `npm run tipos`, `npm run build` y el HTML prerenderizado de `/`

**Interfaces:**
- Consumes (F3): de `EstadoModoViaje`, `fase`, `inactividad`, `avisos.sonido`, `ruta.actual`, `ruta.conPildora`, `alerta`, `gps`, `velocidadKmh`, `precisionM`, `deteccion` (`activaMs`, `totalMs`, `huecos`), `fuente`, `pantalla`, `pantallaLiberada`, `plataforma`, `standalone`, `siguioPorMovimientoEn`; del motor, `seguirViaje(): void`, `reanudar(): Promise<void>`, `activarGps(): void`, `probarAlerta(): void`, `apagar('usuario')` y `borrarRegistros(): Promise<{ tipo: 'ok'; alertas: number; eventos_conduccion: number } | { tipo: 'sin_red' } | { tipo: 'error'; mensaje: string }>`. Sólo lectura de `localStorage['acta:viaje:configuracion']` = `{ guardadaEn, configuracion: { dias_conservacion, … } }` (lo escribe el motor).
- Produces: `data-pildora-viaje` en `body` mientras la píldora se ve; la hoja que abre `abrirHoja` (tarea 3): `<dialog className="hoja-viaje">` con `.hoja-viaje-encabezado` como primer hijo y, después, `HojaViaje` con las secciones; la región `p.solo-lectores[role="status"]` fuera de `.raiz-app`. En el proveedor, las refs de sección `refEstado`, `refDatos` y `refPermisos` y `secciones: Record<SeccionHoja, React.RefObject<HTMLElement | null>>`, que `HojaViaje` recibe por props y usa para desplazarse (F5 suma `refGolpe` y `golpe: refGolpe`, y dibuja su sección entre el encabezado y `HojaViaje`). La regla de la píldora (`pildoraDe`) devuelve `{ rotulo, toque: 'seguir' | 'reanudar' | 'hoja', seccion: SeccionHoja, punto: 'ok' | 'espera' | 'error' }` (F5 suma la rama del golpe con `seccion: 'golpe'` y `punto: 'error'`). `LimiteCapa` recibe `alFallar: () => void` y lo llama desde `componentDidCatch`; el proveedor guarda `capaFallo` y la regla queda `capaBloqueante = estado.alerta !== null && !capaFallo` (ver «Desvíos»). Nada nuevo exportado.

Regla (índice, sin los términos del golpe pendiente, que suma F5): `intencion` = fase `reanudando`, `pidiendo`, `activo`, `en_pausa` o `reanudar_con_toque`; `pideAccion` = `inactividad` o `reanudar_con_toque` o (`activo` y sonido en `requiere_toque`); visible = sin alerta, sin campo con foco, y (`ruta.conPildora` e `intencion`) o (`ruta.actual === '/'` y `pideAccion` y la tarjeta quedó arriba). Rótulo y toque, el primero que aplica: inactividad → «¿Terminaste el viaje? Tocá para seguir» y `seguirViaje()`; `reanudar_con_toque` → «Modo viaje: tocá para reanudar» y `reanudar()`; sonido en `requiere_toque` → «Tocá para activar el sonido del aviso» y abre la hoja; `en_pausa` → «Modo viaje en pausa» y abre la hoja; si no, «Modo viaje activo» y abre la hoja. Punto `espera` salvo en el último caso (`ok`); `aria-haspopup="dialog"` y `aria-expanded` sólo cuando abre la hoja.

- [ ] **Step 1: Dibujar la capa en el proveedor y ver lo que falta**

Reemplazar el `return` del proveedor. **Antes:**

```tsx
  return (
    <Contexto.Provider value={valor}>
      <div className="raiz-app" inert={capaBloqueante || undefined}>
        {children}
      </div>
    </Contexto.Provider>
  )
}
```

**Después:**

```tsx
  return (
    <Contexto.Provider value={valor}>
      <div className="raiz-app" inert={capaBloqueante || undefined}>
        {children}
      </div>
      {/* La capa va fuera de .raiz-app: inert también apagaría estas regiones vivas. */}
      <LimiteCapa alFallar={() => setCapaFallo(true)}>
        <p className="solo-lectores" role="status">
          {anuncio}
        </p>
        {pildora !== null ? (
          <button
            type="button"
            ref={refPildora}
            className="pildora-viaje"
            onClick={tocarPildora}
            aria-haspopup={pildora.toque === 'hoja' ? 'dialog' : undefined}
            aria-expanded={pildora.toque === 'hoja' ? hoja !== null : undefined}
          >
            <span className="punto" data-estado={pildora.punto} />
            <span className="pildora-viaje-texto">{pildora.rotulo}</span>
          </button>
        ) : null}
        <dialog ref={refHoja} className="hoja-viaje" aria-labelledby="hoja-viaje-titulo" onClose={alCerrarHoja}>
          {hoja !== null && motor !== null ? (
            <>
              <div className="hoja-viaje-encabezado">
                <h2 className="hoja-viaje-titulo" id="hoja-viaje-titulo">
                  Modo viaje
                </h2>
                <button type="button" className="boton boton-fantasma hoja-viaje-cerrar" onClick={cerrarHoja}>
                  Cerrar
                </button>
              </div>
              <HojaViaje estado={estado} motor={motor} seccion={hoja} secciones={secciones} alCerrar={cerrarHoja} />
            </>
          ) : null}
        </dialog>
      </LimiteCapa>
    </Contexto.Provider>
  )
}
```

```bash
npm run tipos
```

Esperado (código 1), exactamente:

```text
app/components/ModoViaje.tsx(236,8): error TS2304: Cannot find name 'LimiteCapa'.
app/components/ModoViaje.tsx(236,35): error TS2304: Cannot find name 'setCapaFallo'.
app/components/ModoViaje.tsx(238,12): error TS2304: Cannot find name 'anuncio'.
app/components/ModoViaje.tsx(240,10): error TS2304: Cannot find name 'pildora'.
app/components/ModoViaje.tsx(243,18): error TS2304: Cannot find name 'refPildora'.
app/components/ModoViaje.tsx(245,22): error TS2304: Cannot find name 'tocarPildora'.
app/components/ModoViaje.tsx(246,28): error TS2304: Cannot find name 'pildora'.
app/components/ModoViaje.tsx(247,28): error TS2304: Cannot find name 'pildora'.
app/components/ModoViaje.tsx(249,50): error TS2304: Cannot find name 'pildora'.
app/components/ModoViaje.tsx(250,52): error TS2304: Cannot find name 'pildora'.
app/components/ModoViaje.tsx(253,99): error TS2304: Cannot find name 'alCerrarHoja'.
app/components/ModoViaje.tsx(260,99): error TS2304: Cannot find name 'cerrarHoja'.
app/components/ModoViaje.tsx(264,16): error TS2304: Cannot find name 'HojaViaje'.
app/components/ModoViaje.tsx(264,82): error TS2304: Cannot find name 'secciones'.
app/components/ModoViaje.tsx(264,103): error TS2304: Cannot find name 'cerrarHoja'.
app/components/ModoViaje.tsx(268,9): error TS2304: Cannot find name 'LimiteCapa'.
```

- [ ] **Step 2: Importar `Component` para el límite de errores**

Reemplazar. **Antes:**

```tsx
import {
  createContext,
```

**Después:**

```tsx
import {
  Component,
  createContext,
```

- [ ] **Step 3: Las reglas puras de la capa y el límite de errores**

Reemplazar (el final de `recordarContacto`). **Antes:**

```tsx
    /* sin almacenamiento: el contacto se ofrece mientras la pestaña siga abierta */
  }
}
```

**Después:**

```tsx
    /* sin almacenamiento: el contacto se ofrece mientras la pestaña siga abierta */
  }
}

/*
 * Los días de conservación los fija el servidor (TELEMETRIA_DIAS_CONSERVACION) y el estado del
 * motor no los publica. Se leen de la última configuración que guardó el motor en vez de
 * pedirla: pedirla crea la cookie que identifica al teléfono, y leer el aviso de datos no puede
 * dejar un identificador. Sin configuración guardada vale la omisión del servidor.
 */
const DIAS_CONSERVACION_OMISION = 90

function diasDeConservacion(): number {
  try {
    const crudo = window.localStorage.getItem('acta:viaje:configuracion')
    const guardada = crudo === null ? null : (JSON.parse(crudo) as { configuracion?: { dias_conservacion?: unknown } } | null)
    const dias = guardada?.configuracion?.dias_conservacion
    return typeof dias === 'number' && Number.isInteger(dias) && dias >= 1 ? dias : DIAS_CONSERVACION_OMISION
  } catch {
    return DIAS_CONSERVACION_OMISION
  }
}

const minutos = (ms: number) => Math.floor(ms / 60_000)

/** La persona quiere el modo encendido, aunque ahora esté en pausa o esperando un toque. */
function conIntencion(estado: EstadoModoViaje): boolean {
  return (
    estado.fase === 'reanudando' ||
    estado.fase === 'pidiendo' ||
    estado.fase === 'activo' ||
    estado.fase === 'en_pausa' ||
    estado.fase === 'reanudar_con_toque'
  )
}

interface Pildora {
  rotulo: string
  /** 'seguir' y 'reanudar' actúan sin abrir nada; 'hoja' abre la hoja en `seccion`. */
  toque: 'seguir' | 'reanudar' | 'hoja'
  seccion: SeccionHoja
  punto: 'ok' | 'espera' | 'error'
}

/**
 * Si la píldora se ve y qué dice. Nunca muestra la velocidad: se mira de reojo, manejando.
 * Con una alerta no hay píldora, y con un campo enfocado tampoco: con el teclado abierto
 * taparía lo que se está escribiendo.
 */
function pildoraDe(estado: EstadoModoViaje, campoConFoco: boolean, tarjetaQuedoArriba: boolean): Pildora | null {
  const intencion = conIntencion(estado)
  const pideAccion = estado.inactividad !== null || estado.fase === 'reanudar_con_toque' || (estado.fase === 'activo' && estado.avisos.sonido === 'requiere_toque')
  const visible = estado.alerta === null && !campoConFoco && (
    (estado.ruta.conPildora && intencion) ||
    (estado.ruta.actual === '/' && pideAccion && tarjetaQuedoArriba)
  )
  if (!visible) return null
  if (estado.inactividad !== null) {
    return { rotulo: '¿Terminaste el viaje? Tocá para seguir', toque: 'seguir', seccion: 'estado', punto: 'espera' }
  }
  if (estado.fase === 'reanudar_con_toque') {
    return { rotulo: 'Modo viaje: tocá para reanudar', toque: 'reanudar', seccion: 'estado', punto: 'espera' }
  }
  // Tocar la píldora ya destraba el audio: el destrabador del motor escucha cualquier toque.
  if (estado.avisos.sonido === 'requiere_toque') {
    return { rotulo: 'Tocá para activar el sonido del aviso', toque: 'hoja', seccion: 'estado', punto: 'espera' }
  }
  if (estado.fase === 'en_pausa') {
    return { rotulo: 'Modo viaje en pausa', toque: 'hoja', seccion: 'estado', punto: 'espera' }
  }
  return { rotulo: 'Modo viaje activo', toque: 'hoja', seccion: 'estado', punto: 'ok' }
}

/** Qué anunciar cuando el estado cambia. Nunca números: la cuenta y la velocidad no se anuncian. */
function anuncioEntre(antes: EstadoModoViaje, ahora: EstadoModoViaje): string | null {
  if (ahora.fase === 'en_pausa' && antes.fase !== 'en_pausa') return 'Modo viaje en pausa'
  if (ahora.fase === 'activo' && (antes.fase === 'en_pausa' || antes.fase === 'reanudando')) return 'Modo viaje activo de nuevo'
  if (antes.gps === 'ok' && (ahora.gps === 'buscando' || ahora.gps === 'sin_permiso' || ahora.gps === 'requiere_toque')) {
    return 'Sin GPS: el modo viaje sigue con el acelerómetro'
  }
  if (ahora.avisos.sonido === 'requiere_toque' && antes.avisos.sonido !== 'requiere_toque') {
    return 'El aviso no va a sonar hasta que toques la pantalla'
  }
  if (ahora.siguioPorMovimientoEn !== null && ahora.siguioPorMovimientoEn !== antes.siguioPorMovimientoEn) {
    return 'Seguimos: el auto volvió a moverse'
  }
  return null
}

/** Cómo recuperar un permiso negado, en los pasos de cada plataforma: la tarjeta sólo dice que falta. */
function instruccionesDePermisos(estado: EstadoModoViaje): string[] {
  const instrucciones: string[] = []
  if (estado.fase === 'sin_permiso' && estado.plataforma === 'ios') {
    instrucciones.push(
      estado.standalone
        ? 'Cerrá Acta Digital deslizándola hacia arriba en el selector de apps, volvé a abrirla y, al encender, tocá Permitir.'
        : 'Cerrá Safari por completo deslizándolo hacia arriba en el selector de apps, volvé a abrirlo y, al encender, tocá Permitir.',
    )
  }
  if ((estado.fase === 'sin_permiso' || estado.fase === 'sin_lecturas') && estado.plataforma === 'android') {
    instrucciones.push('Tocá el candado o ⋮ › Configuración del sitio › Sensores de movimiento › Permitir.')
  }
  if (estado.gps === 'sin_permiso') {
    if (estado.plataforma === 'ios') {
      instrucciones.push(
        'Abrí Ajustes › Privacidad y seguridad › Localización › Sitios web de Safari, elegí Mientras se usa la app y volvé a encender el modo viaje.',
      )
    } else if (estado.plataforma === 'android') {
      instrucciones.push('Tocá el candado o ⋮ › Configuración del sitio › Ubicación › Permitir.')
    } else {
      instrucciones.push('Habilitá la ubicación para este sitio en la configuración del navegador y volvé a encender el modo viaje.')
    }
  }
  return instrucciones
}

/*
 * Si la capa falla al dibujarse, que no se lleve puesta la aplicación: no hay
 * app/global-error.tsx, y un error en el layout dejaría en blanco todas las pantallas, también
 * «Tuve un accidente». Las pantallas quedan afuera de este límite. Le avisa al proveedor porque
 * el inert de las pantallas se decide allá: sin el aviso, una alerta que no se ve las dejaría
 * trabadas, con los teléfonos de emergencia adentro.
 */
class LimiteCapa extends Component<{ children: React.ReactNode; alFallar: () => void }, { fallo: boolean }> {
  state = { fallo: false }

  static getDerivedStateFromError() {
    return { fallo: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[modo-viaje] la capa falló al dibujarse y se ocultó; las pantallas siguen:', error)
    this.props.alFallar()
  }

  render() {
    return this.state.fallo ? null : this.props.children
  }
}
```

- [ ] **Step 4: Estados y referencias del proveedor, y la regla de `inert`**

Reemplazar. **Antes:**

```tsx
  const [hoja, setHoja] = useState<SeccionHoja | null>(null)
  const refHoja = useRef<HTMLDialogElement | null>(null)
  const observador = useRef<IntersectionObserver | null>(null)
```

**Después:**

```tsx
  const [hoja, setHoja] = useState<SeccionHoja | null>(null)
  const [campoConFoco, setCampoConFoco] = useState(false)
  const [anuncio, setAnuncio] = useState('')
  const [capaFallo, setCapaFallo] = useState(false)
  const refHoja = useRef<HTMLDialogElement | null>(null)
  const refPildora = useRef<HTMLButtonElement | null>(null)
  // Las secciones a las que abrirHoja lleva el scroll; las dibuja la hoja.
  const refEstado = useRef<HTMLElement | null>(null)
  const refDatos = useRef<HTMLElement | null>(null)
  const refPermisos = useRef<HTMLElement | null>(null)
  const abiertaDesdePildora = useRef(false)
  const estadoAnterior = useRef(estado)
  const observador = useRef<IntersectionObserver | null>(null)
```

Reemplazar también la regla de `inert` de la tarea 3 (arriba de `const abrirHoja`). **Antes:**

```tsx
  // Mientras hay una alerta, la pantalla de abajo no recibe foco ni toques.
  const capaBloqueante = estado.alerta !== null
```

**Después:**

```tsx
  /*
   * Mientras hay una alerta, la pantalla de abajo no recibe foco ni toques. Si la capa falló al
   * dibujarse, la alerta no se ve: con las pantallas inertes no quedaría nada para tocar, ni
   * «Tuve un accidente» ni los teléfonos de emergencia, y una ayuda guardada vuelve al recargar.
   */
  const capaBloqueante = estado.alerta !== null && !capaFallo
```

- [ ] **Step 5: Foco en campos, anuncios, reserva de la píldora y sus toques**

Reemplazar. **Antes:**

```tsx
  useLayoutEffect(() => {
    if (capaBloqueante && refHoja.current?.open) refHoja.current.close()
  }, [capaBloqueante])
```

**Después:**

```tsx
  useLayoutEffect(() => {
    if (capaBloqueante && refHoja.current?.open) refHoja.current.close()
  }, [capaBloqueante])

  useEffect(() => {
    const esCampo = (objetivo: EventTarget | null) =>
      objetivo instanceof HTMLInputElement || objetivo instanceof HTMLTextAreaElement || objetivo instanceof HTMLSelectElement
    const alEnfocar = (e: FocusEvent) => setCampoConFoco(esCampo(e.target))
    // relatedTarget es a dónde va el foco: pasar de un campo a otro no hace parpadear la píldora.
    const alDesenfocar = (e: FocusEvent) => setCampoConFoco(esCampo(e.relatedTarget))
    document.addEventListener('focusin', alEnfocar)
    document.addEventListener('focusout', alDesenfocar)
    return () => {
      document.removeEventListener('focusin', alEnfocar)
      document.removeEventListener('focusout', alDesenfocar)
    }
  }, [])

  useEffect(() => {
    const texto = anuncioEntre(estadoAnterior.current, estado)
    estadoAnterior.current = estado
    if (texto !== null) setAnuncio(texto)
  }, [estado])

  const pildora = pildoraDe(estado, campoConFoco, tarjetaQuedoArriba)
  const pildoraVisible = pildora !== null

  // Mientras la píldora se ve, la página reserva lugar abajo (globals.css) para que no tape el último botón.
  useLayoutEffect(() => {
    document.body.toggleAttribute('data-pildora-viaje', pildoraVisible)
    return () => document.body.removeAttribute('data-pildora-viaje')
  }, [pildoraVisible])

  // Memorizado: si cambiara en cada estado nuevo, la hoja volvería a desplazarse a la sección una vez por segundo.
  const secciones = useMemo<Record<SeccionHoja, React.RefObject<HTMLElement | null>>>(
    () => ({ estado: refEstado, datos: refDatos, permisos: refPermisos }),
    [],
  )

  function tocarPildora() {
    if (motor === null || pildora === null) return
    // Sin nada antes: reanudar() pide el permiso de movimiento y necesita el gesto entero.
    if (pildora.toque === 'reanudar') void motor.reanudar()
    else if (pildora.toque === 'seguir') motor.seguirViaje()
    else {
      abiertaDesdePildora.current = true
      abrirHoja(pildora.seccion)
    }
  }

  const cerrarHoja = () => refHoja.current?.close()

  function alCerrarHoja() {
    setHoja(null)
    // Safari no enfoca un botón al tocarlo, así que el <dialog> no tiene a quién devolverle el foco.
    if (abiertaDesdePildora.current) refPildora.current?.focus()
    abiertaDesdePildora.current = false
  }
```

```bash
npm run tipos
```

Esperado (código 1), exactamente una línea:

```text
app/components/ModoViaje.tsx(470,16): error TS2304: Cannot find name 'HojaViaje'.
```

- [ ] **Step 6: La hoja**

Reemplazar el final del proveedor. **Antes:**

```tsx
      </LimiteCapa>
    </Contexto.Provider>
  )
}
```

**Después:**

```tsx
      </LimiteCapa>
    </Contexto.Provider>
  )
}

/**
 * Las secciones de la hoja de opciones. Se dibujan sólo mientras la hoja está abierta: cerrada
 * no hay nada que leer, y así la sección pedida existe recién cuando hay que desplazarse a ella.
 */
function HojaViaje({
  estado,
  motor,
  seccion,
  secciones,
  alCerrar,
}: {
  estado: EstadoModoViaje
  motor: MotorViaje
  seccion: SeccionHoja
  secciones: Record<SeccionHoja, React.RefObject<HTMLElement | null>>
  alCerrar: () => void
}) {
  const [dias] = useState(diasDeConservacion)
  const [borrando, setBorrando] = useState(false)
  const [borrado, setBorrado] = useState<{ nivel: 'ok' | 'atencion' | 'alerta'; texto: string } | null>(null)
  const instrucciones = instruccionesDePermisos(estado)
  const encendido = conIntencion(estado)

  // useLayoutEffect y no useEffect: la hoja se muestra ya desplazada, sin un cuadro en la sección equivocada.
  useLayoutEffect(() => {
    secciones[seccion].current?.scrollIntoView({ block: 'start' })
  }, [secciones, seccion])

  async function borrar() {
    setBorrando(true)
    setBorrado(null)
    const resultado = await motor.borrarRegistros()
    setBorrando(false)
    if (resultado.tipo === 'ok') {
      setBorrado({ nivel: 'ok', texto: `Se borraron ${resultado.alertas + resultado.eventos_conduccion} registros de este teléfono.` })
    } else if (resultado.tipo === 'sin_red') {
      setBorrado({ nivel: 'atencion', texto: 'Sin señal: probá de nuevo cuando vuelva la señal.' })
    } else {
      setBorrado({ nivel: 'alerta', texto: resultado.mensaje })
    }
  }

  return (
    <>
      {encendido ? (
        <section className="hoja-viaje-seccion" ref={secciones.estado}>
          <p className="hoja-viaje-dato">
            Detección activa {minutos(estado.deteccion.activaMs)} de {minutos(estado.deteccion.totalMs)} min
          </p>
          {estado.deteccion.huecos.map((hueco) => (
            <p className="hoja-viaje-dato" key={hueco.inicio}>
              Sin detección {Math.ceil(hueco.ms / 60_000)} min: pantalla bloqueada u otra aplicación
            </p>
          ))}
          {estado.gps === 'ok' || estado.gps === 'impreciso' ? (
            <>
              <p className="hoja-viaje-dato">
                {estado.velocidadKmh !== null ? `Velocidad ${Math.round(estado.velocidadKmh)} km/h` : 'Velocidad: sin GPS'}
              </p>
              {estado.precisionM !== null ? (
                <p className="hoja-viaje-dato">Precisión del GPS {Math.round(estado.precisionM)} m</p>
              ) : null}
            </>
          ) : null}
          {estado.gps === 'buscando' ? <p className="hoja-viaje-dato">Buscando GPS</p> : null}
          {estado.gps === 'sin_permiso' ? (
            <p className="hoja-viaje-dato">Sin permiso de ubicación: la detección sigue con el acelerómetro</p>
          ) : null}
          {estado.gps === 'requiere_toque' ? (
            <>
              <p className="hoja-viaje-dato">El GPS está en pausa hasta que lo actives</p>
              <div className="hoja-viaje-acciones">
                {/* Dentro del toque: watchPosition puede abrir el diálogo de permiso y necesita el gesto. */}
                <button type="button" className="boton boton-secundario" onClick={() => motor.activarGps()}>
                  Usar el GPS
                </button>
              </div>
            </>
          ) : null}
          {estado.fuente === 'derivada' ? (
            <p className="hoja-viaje-dato">Sensor sin giróscopo: detección menos precisa</p>
          ) : null}
          {estado.pantallaLiberada ? (
            <p className="hoja-viaje-dato">
              La pantalla se puede apagar sola (ahorro de batería). Enchufalo o desactivá el ahorro.
            </p>
          ) : null}
          {estado.pantalla === 'no_garantizada' ? (
            <p className="hoja-viaje-dato">
              En esta versión de iOS la pantalla se apaga sola: actualizá o poné Bloqueo automático en Nunca mientras manejás.
            </p>
          ) : null}
        </section>
      ) : null}

      {instrucciones.length > 0 ? (
        <section className="hoja-viaje-seccion" ref={secciones.permisos} aria-labelledby="hoja-viaje-permisos">
          <h3 className="hoja-viaje-subtitulo" id="hoja-viaje-permisos">
            Permisos
          </h3>
          {instrucciones.map((texto) => (
            <p className="hoja-viaje-dato" key={texto}>
              {texto}
            </p>
          ))}
        </section>
      ) : null}

      <section className="hoja-viaje-seccion" aria-labelledby="hoja-viaje-limites">
        <h3 className="hoja-viaje-subtitulo" id="hoja-viaje-limites">
          Límites
        </h3>
        <p className="hoja-viaje-dato">Sólo con la aplicación abierta, a la vista y la pantalla encendida.</p>
        <p className="hoja-viaje-dato">No detecta golpes leves ni choques con el auto detenido.</p>
        <p className="hoja-viaje-dato">No llama ni le avisa a nadie por su cuenta.</p>
        <p className="hoja-viaje-dato">En iPhone no vibra; con el iPhone en silencio, que suene depende de la versión de iOS.</p>
        <p className="hoja-viaje-dato">Con la aplicación instalada en iOS anterior a 18.4, la pantalla se puede apagar sola.</p>
        <div className="hoja-viaje-acciones">
          {/* Suena y vibra por el mismo camino que la alerta real y dentro de este toque: también destraba el audio. */}
          <button type="button" className="boton boton-secundario" onClick={() => motor.probarAlerta()}>
            Probar la alerta
          </button>
        </div>
      </section>

      <section className="hoja-viaje-seccion" ref={secciones.datos} aria-labelledby="hoja-viaje-datos">
        <h3 className="hoja-viaje-subtitulo" id="hoja-viaje-datos">
          Qué datos guarda
        </h3>
        <p className="hoja-viaje-dato">
          Para qué: avisarte y documentar un siniestro. Las frenadas y los golpes en marcha sirven sólo para ajustar el detector.
        </p>
        <p className="hoja-viaje-dato">Quién los recibe: tu aseguradora, que es la responsable de esos datos.</p>
        <p className="hoja-viaje-dato">Es optativo: se apaga con un toque y la aplicación funciona igual.</p>
        <p className="hoja-viaje-dato">Las frenadas no se asocian a tu cuenta ni a tu póliza.</p>
        <p className="hoja-viaje-dato">
          Se guardan {dias} días, salvo el golpe con el que registres un accidente, que queda con la actuación.
        </p>
        <p className="hoja-viaje-dato">
          Podés pedir acceso, rectificación o supresión de tus datos (Ley 25.326). Desde este teléfono, con «Borrar mis registros del modo viaje»; si borraste los datos del navegador, pedíselo a tu aseguradora.
        </p>
        <div className="hoja-viaje-acciones">
          <button type="button" className="boton boton-secundario" onClick={borrar} disabled={borrando}>
            Borrar mis registros del modo viaje
          </button>
          {borrado !== null ? (
            <div className="aviso" data-nivel={borrado.nivel} role="status">
              {borrado.texto}
            </div>
          ) : null}
        </div>
      </section>

      {encendido ? (
        <section className="hoja-viaje-seccion">
          <div className="hoja-viaje-acciones">
            <button
              type="button"
              className="boton boton-secundario"
              onClick={() => {
                motor.apagar('usuario')
                alCerrar()
              }}
            >
              Apagar el modo viaje
            </button>
          </div>
        </section>
      ) : null}
    </>
  )
}
```

- [ ] **Step 7: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `  ok   toda clase del marcado está definida en globals.css`, `  ok   ninguna pantalla compara contra el texto de una respuesta`, `  ok   los estilos en línea respetan su cupo`, `El contrato se cumple.`; tipos sin `error TS`; `Todo en orden.`; código 0.

- [ ] **Step 8: Compilar y mirar la capa en el HTML del inicio**

Con `next dev` detenido:

```bash
npm run build && grep -o 'role="status"\|class="hoja-viaje"' .next/server/app/index.html
```

Esperado: `✓ Compiled successfully`, `✓ Generating static pages`, y el `grep` imprime `role="status"` y `class="hoja-viaje"`, una línea cada uno. No aparece `pildora-viaje`: en el servidor el estado es `desconocido`.

- [ ] **Step 9: Revisión manual en escritorio**

`npm run dev`, Chrome en `http://localhost:3000/` en primer plano, DevTools abierto. En la consola, lecturas de movimiento sintéticas (el escritorio no tiene acelerómetro; el motor las recibe por `window` como las reales):

```js
const emitir = (x) => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x, y: 0.1, z: 0.1 }, accelerationIncludingGravity: { x, y: 0.1, z: 9.9 }, rotationRate: { alpha: 1, beta: 1, gamma: 1 }, interval: 16 }))
window.__ruido = setInterval(() => emitir(0.2), 16)
```

- Tocar el interruptor (bloquear la ubicación si Chrome la pide). En unos 3 s la línea dice «Activo · detección 0 min».
- Ir a «Mi póliza y documentación» (navegación del cliente: el intervalo sigue vivo). Abajo al centro aparece la píldora «Modo viaje activo» con el punto verde; `document.body.hasAttribute('data-pildora-viaje')` devuelve `true` y el contenido de la página no queda tapado al bajar hasta el final.
- Tocar la píldora: se abre la hoja con «Modo viaje» y «Cerrar», «Detección activa 0 de 0 min», «Sin permiso de ubicación: la detección sigue con el acelerómetro», «Límites» con sus cinco frases, «Probar la alerta» (suena), «Qué datos guarda» con «Se guardan 90 días, …» (o los días que devuelva `GET /api/telemetria/configuracion`) y «Borrar mis registros del modo viaje», y «Apagar el modo viaje». Escape la cierra y el foco vuelve a la píldora (anillo de foco visible con Tab).
- Con sesión, llegar a «Mis datos» por los enlaces, sin recargar (una recarga corta `window.__ruido`): «Mi cuenta» › «Mis datos y contacto de confianza». Tocar el campo «Nombre y apellido»: la píldora desaparece; al salir del campo, vuelve.
- Volver al inicio con la marca de arriba y bajar hasta los teléfonos de emergencia: la píldora no aparece (no hay acción pendiente). Volver arriba, tocar «Qué datos guarda» en la tarjeta: la hoja abre desplazada a esa sección.
- «Apagar el modo viaje»: la hoja se cierra y la píldora desaparece.
- Volver a encender desde la tarjeta (con `window.__ruido` todavía corriendo) y tocar «Tuve un accidente»: en la consola, `__actaMotorViaje.estado().fase` es `'apagado'` y `__actaMotorViaje.estado().apagadoPor.motivo` es `'accidente_registrado'`, aunque el alta falle sin base de datos. Al final, `clearInterval(window.__ruido)`.

- [ ] **Step 10: Commit**

```bash
git add "app/components/ModoViaje.tsx"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Mostrar la píldora y la hoja del modo viaje en el resto de las pantallas

Con el modo encendido, la píldora dice en texto en qué estado está y abre la
hoja: estado, permisos por plataforma, límites, «Probar la alerta», qué datos
guarda y cómo borrarlos. Se oculta con un campo enfocado, y en el inicio sólo
aparece si la tarjeta quedó arriba, así nunca tapa «Tuve un accidente». Una
región de estado anuncia los cambios, nunca números. La capa va dentro de un
límite de errores: si falla, las pantallas siguen y dejan de estar inertes.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Alerta: `pregunta`, `hubo_choque` y ayuda provisoria

**Files:**
- Modify: `app/components/ModoViaje.tsx` (la capa del proveedor; el import de `next/navigation`, con `BotonesEmergencia` y `lib/local`; el final del archivo)
- Test: `npm run tipos`, `npm run build`

**Interfaces:**
- Consumes (F3): `EstadoModoViaje['alerta']` → `estado`, `idCliente`, `idServidor`, `restanteS`, `ocurridoEn`, `apertura`, `origenAyuda`, `respondida`, `armada`; del motor, `responder(respuesta: 'estoy_bien' | 'necesito_ayuda'): void`, `marcarHuboChoque(hubo: boolean): void`, `falsaAlarma(): void` y `registrarAccidente(telemetria?: { idCliente?: string | null; idServidor?: string | null }): Promise<{ tipo: 'creada'; id: string; vinculo: 'ok' | 'rechazado' | 'sin_dato' } | { tipo: 'sin_red' } | { tipo: 'error'; mensaje: string }>` (con 2xx el motor ya recordó la actuación, cerró la alerta y apagó el modo). `BotonesEmergencia` con `chicos` y `alLlamar` (tarea 1). `useRouter` de `next/navigation`. `actuacionAbierta(): string | null` de `lib/local.ts` (ya existe).
- Produces: `div.alerta-viaje[role="alertdialog"][aria-modal="true"]` con `data-armada` (presente o ausente), fuera de `.raiz-app`; nada exportado. F5 reemplaza el contenido del estado `ayuda` por `AyudaImpacto`.

- [ ] **Step 1: Pedir la alerta desde la capa y ver que falta**

Reemplazar. **Antes:**

```tsx
              <HojaViaje estado={estado} motor={motor} seccion={hoja} secciones={secciones} alCerrar={cerrarHoja} />
            </>
          ) : null}
        </dialog>
      </LimiteCapa>
```

**Después:**

```tsx
              <HojaViaje estado={estado} motor={motor} seccion={hoja} secciones={secciones} alCerrar={cerrarHoja} />
            </>
          ) : null}
        </dialog>
        {/* La clave es la alerta: una alerta nueva empieza sin el estado de registro de la anterior. */}
        {estado.alerta !== null && motor !== null ? (
          <AlertaViaje key={estado.alerta.idCliente} alerta={estado.alerta} motor={motor} />
        ) : null}
      </LimiteCapa>
```

```bash
npm run tipos
```

Esperado (código 1), exactamente:

```text
app/components/ModoViaje.tsx(476,12): error TS2304: Cannot find name 'AlertaViaje'.
```

- [ ] **Step 2: Importar el router, los botones de emergencia y la actuación abierta**

Reemplazar. **Antes:**

```tsx
import { usePathname } from 'next/navigation'
import { ESTADO_SERVIDOR, motorDelNavegador, type EstadoModoViaje } from '@/lib/viaje'
```

**Después:**

```tsx
import { usePathname, useRouter } from 'next/navigation'
import { BotonesEmergencia } from './BotonesEmergencia'
import { actuacionAbierta } from '@/lib/local'
import { ESTADO_SERVIDOR, motorDelNavegador, type EstadoModoViaje } from '@/lib/viaje'
```

- [ ] **Step 3: La alerta**

Reemplazar el final del archivo. **Antes:**

```tsx
              Apagar el modo viaje
            </button>
          </div>
        </section>
      ) : null}
    </>
  )
}
```

**Después** (la frase «La aplicación no llama sola a emergencias…» va entera en una línea: la busca el contrato de la tarea 7):

```tsx
              Apagar el modo viaje
            </button>
          </div>
        </section>
      ) : null}
    </>
  )
}

/** Hora de pared en 24 h: algunos motores agregan «a. m.» si no se pide hour12: false. */
function horaCorta(ms: number): string {
  return new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

type Alerta = NonNullable<EstadoModoViaje['alerta']>

/**
 * La alerta, en sus tres estados: la pregunta, «¿Hubo un choque?» y la ayuda.
 *
 * El estado vive en el motor y no en la URL: un cambio de ruta, el atrás o Escape no la
 * cierran. Cada respuesta pasa al motor de forma sincrónica, antes de cualquier navegación.
 * La ayuda es la mínima que funciona sin red: los teléfonos, registrar el accidente (o seguir
 * la actuación que ya está abierta en el teléfono) y la falsa alarma.
 */
function AlertaViaje({ alerta, motor }: { alerta: Alerta; motor: MotorViaje }) {
  const router = useRouter()
  const refTitulo = useRef<HTMLHeadingElement | null>(null)
  const [registrando, setRegistrando] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [anuncioCuenta, setAnuncioCuenta] = useState('')
  // Se lee al crearse, como los días de la hoja: la alerta nunca se dibuja en el servidor ni al hidratar.
  const [abierta] = useState(actuacionAbierta)

  // El lector de pantalla tiene que decir la pregunta antes de que un doble toque pueda responderla.
  useEffect(() => {
    refTitulo.current?.focus()
  }, [alerta.estado])

  // El número de la cuenta no es una región viva: anunciar cada segundo taparía todo lo demás.
  const restante = alerta.estado === 'pregunta' ? alerta.restanteS : null
  useEffect(() => {
    if (restante === 20 || restante === 10 || restante === 5) setAnuncioCuenta(`Quedan ${restante} segundos`)
  }, [restante])

  // Llamar después de un golpe es pedir ayuda: se registra sólo si todavía no hubo una respuesta humana.
  const alLlamar = alerta.respondida ? undefined : () => motor.responder('necesito_ayuda')

  async function registrar() {
    setRegistrando(true)
    setAviso(null)
    if (alerta.estado === 'hubo_choque') motor.marcarHuboChoque(true)
    const resultado = await motor.registrarAccidente({ idCliente: alerta.idCliente, idServidor: alerta.idServidor })
    if (resultado.tipo === 'creada') {
      router.push(`/s/${resultado.id}`)
      return
    }
    setRegistrando(false)
    setAviso(
      resultado.tipo === 'sin_red'
        ? 'Sin señal: la lectura queda guardada en el teléfono. Llamá desde los botones de arriba y registralo cuando vuelva la señal.'
        : resultado.mensaje,
    )
  }

  // El aviso va debajo de los teléfonos: «los botones de arriba» tiene que ser cierto en los dos estados.
  const avisoRegistro =
    aviso !== null ? (
      <div className="aviso" data-nivel="alerta" role="alert">
        {aviso}
      </div>
    ) : null

  return (
    <div
      className="alerta-viaje"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-viaje-titulo"
      aria-describedby={alerta.estado === 'pregunta' ? 'alerta-viaje-frase' : undefined}
      data-armada={alerta.armada ? '' : undefined}
    >
      {alerta.estado === 'pregunta' ? <div className="alerta-viaje-destello" aria-hidden="true" /> : null}
      <div className="alerta-viaje-panel">
        {alerta.estado === 'pregunta' ? (
          <>
            <div className="alerta-viaje-cabeza">
              <h2 className="alerta-viaje-titulo" id="alerta-viaje-titulo" tabIndex={-1} ref={refTitulo}>
                ¿Estás bien?
              </h2>
              <p className="alerta-viaje-texto">
                {alerta.apertura === 'seguimiento'
                  ? `Detectamos un golpe hace ${Math.max(0, Math.round((Date.now() - alerta.ocurridoEn) / 1000))} segundos.`
                  : `Detectamos un posible choque a las ${horaCorta(alerta.ocurridoEn)}.`}
              </p>
              <p className="alerta-viaje-texto" id="alerta-viaje-frase">
                La aplicación no llama sola a emergencias. Si no respondés, al llegar a cero te mostramos los teléfonos para llamar.
              </p>
              <p className="alerta-viaje-cuenta">{alerta.restanteS}</p>
              <p className="solo-lectores" aria-live="assertive" aria-atomic="true">
                {anuncioCuenta}
              </p>
            </div>
            <div className="alerta-viaje-botones">
              <button type="button" className="boton alerta-viaje-boton" onClick={() => motor.responder('estoy_bien')}>
                Estoy bien
              </button>
              <button type="button" className="boton alerta-viaje-boton" onClick={() => motor.responder('necesito_ayuda')}>
                Necesito ayuda
              </button>
            </div>
          </>
        ) : null}

        {alerta.estado === 'hubo_choque' ? (
          <>
            <div className="alerta-viaje-cabeza">
              <h2 className="alerta-viaje-titulo" id="alerta-viaje-titulo" tabIndex={-1} ref={refTitulo}>
                ¿Hubo un choque?
              </h2>
            </div>
            <div className="alerta-viaje-botones">
              <button type="button" className="boton alerta-viaje-boton" onClick={registrar} disabled={registrando}>
                {registrando ? 'Abriendo...' : 'Sí, registrar el accidente'}
              </button>
              <button
                type="button"
                className="boton alerta-viaje-boton"
                onClick={() => motor.marcarHuboChoque(false)}
                disabled={registrando}
              >
                No, fue una falsa alarma
              </button>
              <BotonesEmergencia chicos alLlamar={alLlamar} />
              {avisoRegistro}
            </div>
          </>
        ) : null}

        {alerta.estado === 'ayuda' ? (
          <>
            <div className="alerta-viaje-cabeza">
              <h2 className="alerta-viaje-titulo" id="alerta-viaje-titulo" tabIndex={-1} ref={refTitulo}>
                {alerta.origenAyuda === 'necesito_ayuda' ? 'Pediste ayuda' : 'No respondiste'}
              </h2>
            </div>
            <div className="alerta-viaje-botones">
              <BotonesEmergencia alLlamar={alLlamar} />
              {/* Con una actuación abierta en el teléfono se sigue ésa: otra duplicaría el siniestro y el teléfono olvidaría la primera. */}
              {abierta !== null ? (
                <button type="button" className="boton alerta-viaje-boton" onClick={() => router.push(`/s/${abierta}`)}>
                  Continuar la actuación abierta
                </button>
              ) : (
                <button type="button" className="boton alerta-viaje-boton" onClick={registrar} disabled={registrando}>
                  {registrando ? 'Abriendo...' : 'Registrar el accidente'}
                </button>
              )}
              <button type="button" className="boton alerta-viaje-boton" onClick={() => motor.falsaAlarma()} disabled={registrando}>
                Estoy bien, fue una falsa alarma
              </button>
              {avisoRegistro}
            </div>
          </>
        ) : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Las tres verificaciones y la compilación**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `  ok   ninguna pantalla compara contra el texto de una respuesta`, `  ok   toda clase del marcado está definida en globals.css`, `El contrato se cumple.`; tipos sin `error TS`; `Todo en orden.`; código 0. Después, con `next dev` detenido, `npm run build` termina con `✓ Compiled successfully` y `✓ Generating static pages`.

- [ ] **Step 5: Revisión manual en escritorio**

Como en la tarea 5, paso 9: `npm run dev`, consola con `emitir` y `window.__ruido`, interruptor encendido, ir a «Mi póliza y documentación». Definir el golpe, de unos 6 g y 90 ms, y darlo con `golpear()` cada vez que abajo dice «golpe». El ruido se corta mientras dura el golpe y vuelve al terminar: si los dos intervalos corrieran juntos, las muestras alternarían 60 y 0,2, ninguna racha con |a| ≥ sospechaG/2 llegaría a `msSobreUmbral` (30 ms), el golpe no sería `sostenido` y no se abriría ninguna alerta. No volver a llamar a `golpear()` antes de que termine el anterior (unos 100 ms):

```js
window.golpear = () => { clearInterval(window.__ruido); let n = 0; const id = setInterval(() => { emitir(60); if (++n === 6) { clearInterval(id); window.__ruido = setInterval(() => emitir(0.2), 16) } }, 16) }
golpear()
```

- Unos 8 s después (el episodio cierra 8 s después de la última muestra fuerte), la alerta roja tapa la pantalla: «¿Estás bien?», «Detectamos un posible choque a las HH:MM.», «La aplicación no llama sola a emergencias. Si no respondés, al llegar a cero te mostramos los teléfonos para llamar.», la cuenta en 30 y bajando, y «Estoy bien» arriba de «Necesito ayuda». El marco blanco se prende y se apaga. La píldora desaparece.
- En la consola: `document.activeElement.textContent` es `¿Estás bien?`; `document.querySelector('.raiz-app').inert` es `true`; Tab sólo recorre los dos botones; Escape y el atrás del navegador no la cierran.
- «Estoy bien» (en escritorio no hay velocidad confiable) → «¿Hubo un choque?» con «Sí, registrar el accidente», «No, fue una falsa alarma» y los tres teléfonos chicos debajo. «No, fue una falsa alarma» → la alerta se cierra, vuelve la píldora y `document.querySelector('.raiz-app').inert` es `false`.
- Otro golpe → «Necesito ayuda» → «Pediste ayuda» con los tres teléfonos, «Registrar el accidente» y «Estoy bien, fue una falsa alarma». DevTools › Network › Offline, «Registrar el accidente»: el botón dice «Abriendo...» y después aparece, debajo de todo, «Sin señal: la lectura queda guardada en el teléfono. Llamá desde los botones de arriba y registralo cuando vuelva la señal.». Volver a Online y tocar «Estoy bien, fue una falsa alarma»: se cierra.
- Otro golpe y no tocar nada: al llegar a cero, «No respondiste».
- Otro golpe con DevTools › Rendering › «Emulate CSS media feature prefers-reduced-motion: reduce»: el marco queda blanco y quieto. Con Toggle device toolbar en 667×375: título y cuenta a la izquierda, botones a la derecha.
- En la consola, `localStorage.setItem('acta:actuacion-abierta', 'ACT-PRUEBA')`. Otro golpe → «Necesito ayuda» → «Pediste ayuda» muestra «Continuar la actuación abierta» en lugar de «Registrar el accidente». Con DevTools › Network abierto, tocarlo: la dirección pasa a `/s/ACT-PRUEBA`, no sale ningún `POST /api/casos` y `localStorage.getItem('acta:actuacion-abierta')` sigue siendo `'ACT-PRUEBA'`; la alerta sigue encima (sólo la cierra una respuesta; lo que diga la página de abajo, que no existe, no cuenta, y si `next dev` muestra su aviso de error se cierra con Escape). «Estoy bien, fue una falsa alarma», `localStorage.removeItem('acta:actuacion-abierta')` y volver con el atrás del navegador a «Mi póliza y documentación».
- Al final: «Estoy bien, fue una falsa alarma» si quedó abierta, «Apagar el modo viaje» desde la hoja y `clearInterval(window.__ruido)`.

- [ ] **Step 6: Commit**

```bash
git add "app/components/ModoViaje.tsx"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Abrir la alerta del modo viaje encima de cualquier pantalla

La alerta es un div alertdialog y no un <dialog>: la abre un sensor, sin gesto, y
el atrás de Android la cerraría sin respuesta. Vuelve inerte la pantalla de
abajo, lleva el foco al título, no recibe toques los primeros 600 ms y anuncia
sólo los 20, 10 y 5 segundos. Después de «Estoy bien» pregunta si hubo un choque,
y la ayuda mínima funciona sin red: los teléfonos, registrar el accidente y la
falsa alarma. La ayuda completa llega con la fase siguiente.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Contrato: avisos de límite, orden del layout, valores de `data-*` y ningún `'use server'`

**Files:**
- Modify: `scripts/prueba-contrato.mjs` (import de `node:fs`, línea 18; después de `const normalizar`, línea 47; dentro del bloque «Toda clase que el marcado usa…», líneas 339–362; después de `ELEMENTOS_ADMITIDOS`, líneas 163–169; sección `[4]`, después de la comprobación «cada pantalla mantiene su cuerpo y su barra de acción», líneas 448–454). F2 y F3 suman `IMPORTS_PERMITIDOS` en este archivo: los números se corren, los bloques se buscan por contenido.
- Test: una copia temporal del repositorio con cuatro violaciones (paso 6) y `npm run contrato` sobre el árbol real (paso 7)

**Interfaces:**
- Consumes: `archivos(dir, filtro)`, `leer(ruta)`, `normalizar(ruta)`, `verificar(nombre, condicion, extra)` y `todosTsx`, existentes en el script.
- Produces: `expresion(texto, desde)` y `COMPARACION` pasan a nivel de módulo (antes vivían dentro del bloque de clases); `TEXTOS_OBLIGATORIOS` (F5 le suma `'app/components/AyudaImpacto.tsx': ['no llama ni manda mensajes por su cuenta']`) y `VALORES_DATA`; cuatro comprobaciones nuevas en `[4]`, con estos nombres exactos: `los avisos que dicen un límite siguen en su archivo`, `el layout envuelve las pantallas con el modo viaje`, `data-estado y data-nivel sólo usan los valores del contrato`, `ningún 'use server' en app/ ni en lib/`.

- [ ] **Step 1: Importar `existsSync`**

Reemplazar. **Antes:**

```js
import { readFileSync, readdirSync, statSync } from 'node:fs'
```

**Después:**

```js
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
```

(Si F2 o F3 ya dejaron `existsSync` en ese import, no se toca la línea.)

- [ ] **Step 2: Subir `expresion` y `COMPARACION` a nivel de módulo**

Reemplazar. **Antes:**

```js
const leer = (ruta) => readFileSync(ruta, 'utf8')
const normalizar = (ruta) => ruta.split('\\').join('/')
```

**Después:**

```js
const leer = (ruta) => readFileSync(ruta, 'utf8')
const normalizar = (ruta) => ruta.split('\\').join('/')

/** El contenido de un {...} equilibrado que empieza en `desde`. */
function expresion(texto, desde) {
  let nivel = 0
  for (let i = desde; i < texto.length; i++) {
    if (texto[i] === '{') nivel++
    else if (texto[i] === '}') {
      nivel--
      if (nivel === 0) return texto.slice(desde + 1, i)
    }
  }
  return ''
}

/*
 * Un literal que viene despues de una comparacion es un valor con el que se compara, no el
 * valor del atributo: en `className={estado === 'cerrado' ? 'a' : 'b'}`, «cerrado» no es una
 * clase, y en `data-nivel={f.estado === 'cerrado' ? 'ok' : 'neutra'}` no es un nivel. Lo usan
 * la comprobacion de clases y la de los valores de data-estado y data-nivel.
 */
const COMPARACION = /[=!]==?\s*$/
```

- [ ] **Step 3: Sacarlas del bloque de clases, que ahora las usa desde arriba**

Reemplazar. **Antes:**

```js
  const definidas = new Set()
  for (const m of css.matchAll(/[.]([a-zA-Z][-\w]*)/g)) definidas.add(m[1])

  /** El contenido de un {...} equilibrado que empieza en `desde`. */
  function expresion(texto, desde) {
    let nivel = 0
    for (let i = desde; i < texto.length; i++) {
      if (texto[i] === '{') nivel++
      else if (texto[i] === '}') {
        nivel--
        if (nivel === 0) return texto.slice(desde + 1, i)
      }
    }
    return ''
  }

  /*
   * Un literal que viene despues de una comparacion es un valor con el que se compara, no
   * una clase: en `className={estado === 'cerrado' ? 'a' : 'b'}`, «cerrado» no es una
   * clase. Hoy no hay ninguno asi, pero la comprobacion tiene que aguantar el que venga.
   */
  const COMPARACION = /[=!]==?\s*$/

  const huerfanas = new Map()
```

**Después:**

```js
  const definidas = new Set()
  for (const m of css.matchAll(/[.]([a-zA-Z][-\w]*)/g)) definidas.add(m[1])

  const huerfanas = new Map()
```

- [ ] **Step 4: Las dos tablas nuevas, junto a las otras tablas del contrato**

Reemplazar. **Antes:**

```js
const ELEMENTOS_ADMITIDOS = {
  '.qr-imagen svg': 'el SVG lo inyecta la biblioteca de códigos QR, no lo escribe nadie acá',
  '.boton-gigante span': 'el subtítulo del botón de inicio',
  '.boton-llamada span': 'la aclaración debajo del número de emergencia',
  '.enlaces-pie a': 'los enlaces del pie',
  '.emergencia p': 'el párrafo de la pantalla de emergencia',
}
```

**Después:**

```js
const ELEMENTOS_ADMITIDOS = {
  '.qr-imagen svg': 'el SVG lo inyecta la biblioteca de códigos QR, no lo escribe nadie acá',
  '.boton-gigante span': 'el subtítulo del botón de inicio',
  '.boton-llamada span': 'la aclaración debajo del número de emergencia',
  '.enlaces-pie a': 'los enlaces del pie',
  '.emergencia p': 'el párrafo de la pantalla de emergencia',
}

/*
 * Los avisos que dicen un límite (CONTRATO-UI §12), por archivo.
 *
 * Parecen relleno y son lo que evita que el producto prometa algo que no hace: que detecta
 * con la pantalla bloqueada, o que llama solo a emergencias. Cada uno tiene que estar entero
 * en UNA línea del archivo: partido en dos se sigue viendo igual en pantalla, pero la
 * búsqueda deja de encontrarlo y la próxima edición lo puede borrar sin que nada falle.
 */
const TEXTOS_OBLIGATORIOS = {
  'app/page.tsx': ['Funciona sólo con la aplicación abierta', 'No llama ni le avisa a nadie por su cuenta'],
  'app/components/ModoViaje.tsx': ['La aplicación no llama sola a emergencias'],
  'app/perfil/page.tsx': ['no llama ni manda mensajes por su cuenta'],
}

/* Los valores de data-estado y data-nivel que la hoja de estilos conoce (CONTRATO-UI §3). */
const VALORES_DATA = {
  estado: ['pidiendo', 'ok', 'error', 'espera'],
  nivel: ['info', 'ok', 'alerta', 'atencion', 'cobertura', 'neutra'],
}
```

- [ ] **Step 5: Las cuatro comprobaciones en `[4]`**

Reemplazar. **Antes:**

```js
  verificar(
    'cada pantalla mantiene su cuerpo y su barra de acción',
    sinPareja.length === 0,
    sinPareja.join('\n         ') +
      '\n         Una pantalla devuelve dos hermanos, .pantalla-cuerpo y .barra-accion, hijos directos de .pantalla. Envolverlos rompe el anclaje al pie —flex y margin-top:auto son relación padre-hijo— y el botón principal deja de estar al alcance del pulgar en TODO el recorrido, sin que se note en un monitor.',
  )
}
```

**Después:**

```js
  verificar(
    'cada pantalla mantiene su cuerpo y su barra de acción',
    sinPareja.length === 0,
    sinPareja.join('\n         ') +
      '\n         Una pantalla devuelve dos hermanos, .pantalla-cuerpo y .barra-accion, hijos directos de .pantalla. Envolverlos rompe el anclaje al pie —flex y margin-top:auto son relación padre-hijo— y el botón principal deja de estar al alcance del pulgar en TODO el recorrido, sin que se note en un monitor.',
  )
}

{
  const faltan = []
  for (const [ruta, textos] of Object.entries(TEXTOS_OBLIGATORIOS)) {
    const lineas = existsSync(ruta) ? leer(ruta).split('\n') : []
    for (const texto of textos) {
      if (!lineas.some((linea) => linea.includes(texto))) faltan.push(`${ruta}: «${texto}»`)
    }
  }
  verificar(
    'los avisos que dicen un límite siguen en su archivo',
    faltan.length === 0,
    faltan.join('\n         ') +
      '\n         Cada uno evita que el producto prometa algo que no hace (docs/CONTRATO-UI.md §12). Se puede cambiar su aspecto, no borrarlo ni partirlo en dos líneas del código.',
  )
}

{
  /*
   * El modo viaje envuelve las pantallas desde el layout. Si {children} queda fuera de
   * <ModoViaje>, las pantallas dejan de ver el estado del motor y la alerta ya no vuelve inerte
   * lo que tapa, sin que falle nada. BombaCola va después: las pantallas siguen siendo lo
   * primero del documento, y «Tuve un accidente» lo primero que se puede tocar.
   */
  const layout = leer('app/layout.tsx')
  const envuelve = layout.match(/<ModoViaje>\s*\{children\}\s*<\/ModoViaje>/)
  verificar(
    'el layout envuelve las pantallas con el modo viaje',
    envuelve !== null && (layout.match(/\{children\}/g) || []).length === 1 && layout.indexOf('<BombaCola') > envuelve.index,
    'app/layout.tsx tiene que quedar <body><ModoViaje>{children}</ModoViaje><BombaCola /></body>, con {children} una sola vez.',
  )
}

{
  /*
   * data-estado y data-nivel son el contrato entre la lógica y la hoja. Un valor que la hoja no
   * conoce no falla: el elemento sale sin el estilo de su estado, y un punto de «error» se ve
   * igual que uno apagado. Se miran el literal y los literales de una expresión, salteando lo
   * que viene después de una comparación.
   */
  const fuera = []
  for (const ruta of todosTsx) {
    const cuerpo = leer(ruta)
    for (const m of cuerpo.matchAll(/data-(estado|nivel)=/g)) {
      const i = m.index + m[0].length
      const valores = []
      if (cuerpo[i] === '"') valores.push(cuerpo.slice(i + 1, cuerpo.indexOf('"', i + 1)))
      if (cuerpo[i] === '{') {
        const dentro = expresion(cuerpo, i)
        for (const lit of dentro.matchAll(/'([^']*)'|"([^"]*)"|`([^`]*)`/g)) {
          if (!COMPARACION.test(dentro.slice(0, lit.index))) valores.push(lit[1] ?? lit[2] ?? lit[3] ?? '')
        }
      }
      for (const valor of valores) {
        if (!valor.includes('${') && !VALORES_DATA[m[1]].includes(valor)) fuera.push(`${normalizar(ruta)}: data-${m[1]}="${valor}"`)
      }
    }
  }
  verificar(
    'data-estado y data-nivel sólo usan los valores del contrato',
    fuera.length === 0,
    fuera.join('\n         ') +
      `\n         data-estado admite ${VALORES_DATA.estado.join(' · ')} y data-nivel ${VALORES_DATA.nivel.join(' · ')} (docs/CONTRATO-UI.md §3). Un valor nuevo se agrega primero a la hoja y a la tabla.`,
  )
}

{
  /*
   * Sin Server Actions (AGENTS.md). Una acción de servidor es un POST que no aparece en
   * app/api/: no pasa por errorApi ni por la comprobación de rutas de este contrato, y desde el
   * código del cliente se ve igual que una función cualquiera.
   */
  const conAcciones = [...archivos('app', (n) => /\.tsx?$/.test(n)), ...archivos('lib', (n) => n.endsWith('.ts'))]
    .filter((ruta) => /['"]use server['"]/.test(leer(ruta)))
    .map(normalizar)
  verificar(
    "ningún 'use server' en app/ ni en lib/",
    conAcciones.length === 0,
    conAcciones.join('\n         ') +
      '\n         Toda mutación va por fetch a un route handler de app/api/, que exporta runtime y dynamic y traduce sus errores con errorApi.',
  )
}
```

- [ ] **Step 6: Ver fallar cada comprobación sobre una copia con la violación**

Desde la raíz del repositorio (no toca el árbol real: copia `app`, `lib`, `docs` y `scripts` a un directorio temporal, rompe una cosa por comprobación, corre el contrato allá y borra la copia):

```bash
(
RAIZ="$(pwd)"
COPIA="$(mktemp -d)"
cp -r app lib docs scripts "$COPIA/"
cd "$COPIA"
# 1. Una frase obligatoria partida en dos líneas del código.
sed -i 's/No llama ni le avisa a nadie por su cuenta\./No llama ni le avisa\n        a nadie por su cuenta./' app/page.tsx
# 2. Las pantallas fuera del proveedor.
sed -i 's#<ModoViaje>{children}</ModoViaje>#{children}#' app/layout.tsx
# 3. Un valor de data-estado que la hoja no conoce.
printf '%s\n' 'export function Falso() {' '  return <span className="punto" data-estado="activo" />' '}' > app/components/Falso.tsx
# 4. Una Server Action.
printf '%s\n' "'use server'" '' 'export async function accionFalsa() {}' > lib/falso.ts
node "$RAIZ/node_modules/tsx/dist/cli.mjs" scripts/prueba-contrato.mjs
RESULTADO=$?
cd "$RAIZ"
rm -rf "$COPIA"
exit $RESULTADO
)
```

Esperado (código 1): en la sección `[4]`,

```text
  FALLA los avisos que dicen un límite siguen en su archivo
         app/page.tsx: «No llama ni le avisa a nadie por su cuenta»
  FALLA el layout envuelve las pantallas con el modo viaje
         app/layout.tsx tiene que quedar <body><ModoViaje>{children}</ModoViaje><BombaCola /></body>, con {children} una sola vez.
  FALLA data-estado y data-nivel sólo usan los valores del contrato
         app/components/Falso.tsx: data-estado="activo"
  FALLA ningún 'use server' en app/ ni en lib/
         lib/falso.ts
```

cada `FALLA` seguida de su explicación, ninguna otra `FALLA` en las demás secciones, y al final `4 FALLARON. El contrato está en docs/CONTRATO-UI.md.`

- [ ] **Step 7: Correr el contrato sobre el árbol real**

```bash
npm run contrato
```

Esperado (código 0): en `[4]`, después de las tres comprobaciones que ya estaban,

```text
  ok   los avisos que dicen un límite siguen en su archivo
  ok   el layout envuelve las pantallas con el modo viaje
  ok   data-estado y data-nivel sólo usan los valores del contrato
  ok   ningún 'use server' en app/ ni en lib/
```

y la última línea `El contrato se cumple.`

- [ ] **Step 8: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, tipos sin `error TS`, `Todo en orden.`, código 0.

- [ ] **Step 9: Commit**

```bash
git add "scripts/prueba-contrato.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Verificar en el contrato los avisos de límite, el layout y los valores de data-*

Cuatro comprobaciones nuevas: las frases que dicen un límite siguen enteras en su
archivo; el layout envuelve las pantallas con el modo viaje; data-estado y
data-nivel sólo usan valores que la hoja conoce; y no hay ningún 'use server'.
Cada una se vio fallar sobre una copia con la violación antes de darla por buena:
una comprobación que no puede fallar es peor que ninguna.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: `docs/CONTRATO-UI.md` y `docs/MAPA-PANTALLAS.md`

**Files:**
- Modify: `docs/CONTRATO-UI.md` (íconos, líneas 63–66; tabla de §3, líneas 101–106; §12, líneas 198–202; árbol de «Dónde vive cada cosa», líneas 213–220; cuenta de comprobaciones, línea 308)
- Modify: `docs/MAPA-PANTALLAS.md` (§1, línea 16; tabla de §2, líneas 38–41; párrafo de las emergencias, líneas 53–55; fila «Mis datos», línea 251; íconos, líneas 269–271)
- Test: `grep` antes y después, y `npm run contrato` (`[6] toda pantalla del recorrido figura en el mapa`)

**Interfaces:**
- Consumes: las medidas de la tarjeta (434 px de alto mínimo; posiciones medidas en Chrome sin el aviso de sistema no operativo y sin «Continuar la actuación»), los nombres de `TEXTOS_OBLIGATORIOS` y la cuenta que imprime `npm run contrato`.
- Produces: §3 con `data-armada` y `data-pildora-viaje`; §12 con los avisos del modo viaje; doce íconos; la sección «2b · Modo viaje en toda la aplicación» del mapa. F5 suma `/aviso` y el texto de la ayuda.

- [ ] **Step 1: Ver lo que está desactualizado**

```bash
grep -c "son once" docs/CONTRATO-UI.md docs/MAPA-PANTALLAS.md; grep -c "DetectorImpacto" docs/MAPA-PANTALLAS.md
```

Esperado:

```text
docs/CONTRATO-UI.md:1
docs/MAPA-PANTALLAS.md:1
1
```

- [ ] **Step 2: `docs/CONTRATO-UI.md`: los doce íconos**

Reemplazar. **Antes:**

```md
Los íconos disponibles en `app/components/Iconos.tsx` son once: `archivo`, `personas`,
`camara`, `compartir`, `descargar`, `escudo`, `microfono`, `telefono`, `tilde`,
`ubicacion`, `verificar`. Agregar uno es bienvenido; usar un nombre que no está en la lista
no compila.
```

**Después:**

```md
Los íconos disponibles en `app/components/Iconos.tsx` son doce: `archivo`, `auto`,
`camara`, `compartir`, `descargar`, `escudo`, `microfono`, `personas`, `telefono`, `tilde`,
`ubicacion`, `verificar`. Agregar uno es bienvenido; usar un nombre que no está en la lista
no compila. Los números de un dibujo van como expresión (`r={1}`), nunca entre comillas:
`"1"` es el texto de una opción del cuestionario y el contrato lo rechaza en
`app/components/`.
```

- [ ] **Step 3: `docs/CONTRATO-UI.md`: los dos `data-*` nuevos (§3)**

Reemplazar. **Antes:**

```md
| `data-paso` | `.pantalla` | Qué tipo de pantalla es |
| `data-bloque` | `.pantalla` | `seguridad` · `lugar` · `despues` |

Estilalos como quieras. **No los saques ni les cambies el valor**: son el contrato entre
la lógica y la hoja de estilos. Antes esto se hacía componiendo el nombre de la clase
(`` `aviso aviso-${nivel}` ``), que es peor: una búsqueda por nombres de clase no lo ve.
```

**Después:**

```md
| `data-paso` | `.pantalla` | Qué tipo de pantalla es |
| `data-bloque` | `.pantalla` | `seguridad` · `lugar` · `despues` |
| `data-armada` | `.alerta-viaje` | Presente (`data-armada=""`) o ausente. Pasaron 600 ms desde que se abrió la alerta del modo viaje: recién ahí los botones reciben toques |
| `data-pildora-viaje` | `body` | Presente o ausente; lo pone el proveedor del modo viaje. La píldora está visible y la página reserva lugar abajo |

Estilalos como quieras. **No los saques ni les cambies el valor**: son el contrato entre
la lógica y la hoja de estilos. Antes esto se hacía componiendo el nombre de la clase
(`` `aviso aviso-${nivel}` ``), que es peor: una búsqueda por nombres de clase no lo ve.
`npm run contrato` rechaza un valor de `data-estado` o de `data-nivel` que no esté en esta
tabla, escrito suelto o dentro de una expresión.
```

- [ ] **Step 4: `docs/CONTRATO-UI.md`: los avisos del modo viaje (§12)**

Reemplazar. **Antes:**

```md
- «Funciona sólo con la aplicación abierta» (modo viaje).
- «La aplicación no llama ni manda mensajes por su cuenta» (contacto de confianza).
- Todo lo que diga firma **electrónica**, art. 5 de la Ley 25.506, y los arts. 7 y 8.

Ninguno es cosmético: cada uno evita que el producto prometa algo que no hace.
```

**Después:**

```md
- «Funciona sólo con la aplicación abierta» y «No llama ni le avisa a nadie por su cuenta»
  (tarjeta del modo viaje, en el inicio).
- El aviso de datos del modo viaje: «Si detecta un posible choque, manda a tu aseguradora la
  hora, los sensores y la ubicación…» en la tarjeta, y la sección «Qué datos guarda» de la
  hoja. Es el aviso del art. 6 de la Ley 25.326, dicho antes de encender.
- «La aplicación no llama sola a emergencias» (alerta del modo viaje).
- «La aplicación no llama ni manda mensajes por su cuenta» (contacto de confianza).
- Todo lo que diga firma **electrónica**, art. 5 de la Ley 25.506, y los arts. 7 y 8.

Ninguno es cosmético: cada uno evita que el producto prometa algo que no hace. Los que
figuran en `TEXTOS_OBLIGATORIOS` (`scripts/prueba-contrato.mjs`) los busca
`npm run contrato` en su archivo, enteros y en una sola línea del código: se puede cambiar
su aspecto, no borrarlos ni partirlos.
```

- [ ] **Step 5: `docs/CONTRATO-UI.md`: dónde vive el modo viaje**

Reemplazar (son líneas de adentro del bloque de código del documento; los tres acentos graves que lo abren y lo cierran no se tocan). **Antes:**

```md
app/
  page.tsx                    inicio: un botón
  s/[id]/Flujo.tsx            el conmutador: decide qué pantalla se muestra
  s/[id]/tipos.ts             los tipos que comparten las pantallas
  s/[id]/pantallas/*.tsx      una pantalla por archivo  <- acá se trabaja
  globals.css                 TODO el estilo             <- y acá
  components/                 lo compartido entre pantallas
  entrar/ registro/ cuenta/   sesión
```

**Después:**

```md
app/
  page.tsx                    inicio: un botón y la tarjeta del modo viaje
  layout.tsx                  envuelve todas las pantallas con <ModoViaje>
  s/[id]/Flujo.tsx            el conmutador: decide qué pantalla se muestra
  s/[id]/tipos.ts             los tipos que comparten las pantallas
  s/[id]/pantallas/*.tsx      una pantalla por archivo  <- acá se trabaja
  globals.css                 TODO el estilo             <- y acá
  components/                 lo compartido entre pantallas
  components/ModoViaje.tsx    el modo viaje sobre toda la app: píldora, hoja y alerta
  entrar/ registro/ cuenta/   sesión
```

- [ ] **Step 6: `docs/CONTRATO-UI.md`: la cuenta de comprobaciones**

La frase dice cuántas comprobaciones corre el contrato, y ese número lo cambiaron F2, F3 y la tarea 7. Se toma de la salida real:

```bash
(
N=$(npm run contrato 2>/dev/null | grep -oE '^[0-9]+/[0-9]+ comprobaciones' | cut -d/ -f1)
test -n "$N" || { echo 'npm run contrato no imprimió la cuenta de comprobaciones: correlo solo y arreglá lo que falle.'; exit 1; }
sed -i -E "s/^\`npm run contrato\` son [0-9]+ comprobaciones\./\`npm run contrato\` son $N comprobaciones./" docs/CONTRATO-UI.md
grep -n "comprobaciones. Tres de ellas" docs/CONTRATO-UI.md
)
```

Esperado: una línea `308:` (o la que corresponda) con `` `npm run contrato` son N comprobaciones. Tres de ellas existen porque el defecto que ``, donde N es el total que imprime `npm run contrato` en su línea `N/N comprobaciones pasaron`.

- [ ] **Step 7: `docs/MAPA-PANTALLAS.md`: la notificación ya no depende del detector (§1)**

Reemplazar. **Antes:**

```md
| Archivos | `public/sw.js` (push y notificationclick) · `app/aviso/page.tsx` · `components/DetectorImpacto.tsx` |
```

**Después:**

```md
| Archivos | `public/sw.js` (push y notificationclick) · `app/aviso/page.tsx` · `components/ModoViaje.tsx` (la alerta en pantalla, ver 2b) |
```

- [ ] **Step 8: `docs/MAPA-PANTALLAS.md`: clases y cupo real del inicio (§2)**

Reemplazar. **Antes:**

```md
| Archivo | `app/page.tsx` |
| Clases | `.inicio`, `.denuncia`, `.denuncia-pasos`, `.denuncia-paso`, `.denuncia-resguardo`, `.boton-gigante`, `.bloque-inicio`, `.acceso`, `.inicio-pie`, `.aviso[data-nivel]` |
| Endpoints | `GET /api/salud` al montar · `POST /api/casos` al tocar el botón |
| Cupo de estilos en línea | 3 |
```

**Después:**

```md
| Archivo | `app/page.tsx` |
| Clases | `.inicio`, `.denuncia`, `.denuncia-pasos`, `.denuncia-paso`, `.denuncia-resguardo`, `.boton-gigante`, `.tarjeta-viaje` y sus partes, `.interruptor`, `.punto[data-estado]`, `.bloque-inicio`, `.acceso`, `.inicio-pie`, `.aviso[data-nivel]` |
| Endpoints | `GET /api/salud` al montar · `POST /api/casos` al tocar el botón |
| Cupo de estilos en línea | 0 |
```

- [ ] **Step 9: `docs/MAPA-PANTALLAS.md`: la tarjeta, sus medidas y el modo viaje global**

Reemplazar. **Antes:**

```md
Las emergencias 911 / 100 / 107 salen de `lib/emergencias.ts` a través de
`<BotonesEmergencia>`, el mismo componente que usa la pantalla de emergencia del recorrido
y `/aviso`. Los tres números están en un solo lugar.
```

**Después:**

```md
Las emergencias 911 / 100 / 107 salen de `lib/emergencias.ts` a través de
`<BotonesEmergencia>`, el mismo componente que usa la pantalla de emergencia del recorrido
y `/aviso`. Los tres números están en un solo lugar.

**La tarjeta del modo viaje** (`TarjetaModoViaje`, sin exportar, dentro de `app/page.tsx`) va
entre la sección del accidente y `.bloque-inicio`, después del enlace «Continuar la actuación
que dejaste abierta» cuando existe. En orden: ícono `auto` y título; los dos límites; el aviso
de datos con «Qué datos guarda»; una sola línea de estado; y abajo, la acción a la izquierda y
el interruptor a la derecha. El interruptor es un `button role="switch"` y se dibuja desde
`aria-checked`; nunca va en la fila del título.

Su alto mínimo es fijo, **434 px**: el del estado más alto medido a 375 px de ancho (apagado
por inactividad en un iPhone, con las dos advertencias), en Chrome con la tipografía del
sistema. Así la hidratación y los cambios de estado no mueven lo que viene debajo. Si un
cambio de texto o de tipografía hace más alto algún estado, este número sube con él.

Medidas con la tarjeta (sin el aviso de sistema no operativo y sin «Continuar la actuación»):

| Pantalla | «Tuve un accidente» | Tarjeta | «Ambulancia» | Sin la tarjeta, «Ambulancia» estaba en |
| --- | --- | --- | --- | --- |
| 375×667 | 405–467 | 540–974 | 1057–1139 | 601–683 |
| 390×797 | 412–478 | 555–989 | 1072–1154 | 616–698 |

El alto de la pantalla no cambia las posiciones: en los dos tamaños «Ambulancia» queda debajo
del pliegue y se llega bajando. Es la consecuencia de poner la tarjeta debajo de la sección
del accidente, y hay que tenerla presente en cualquier rediseño del inicio.

## 2b · Modo viaje en toda la aplicación

| | |
| --- | --- |
| Archivos | `app/components/ModoViaje.tsx` (proveedor, píldora, hoja y alerta) · `app/layout.tsx` · `lib/viaje.ts` (el motor, sin React) |
| Clases | `.raiz-app`, `.pildora-viaje`, `.pildora-viaje-texto`, `.hoja-viaje` y sus partes, `.alerta-viaje[data-armada]` y sus partes, `.emergencias-chicas`, `.solo-lectores`, `.punto[data-estado]`, `.aviso[data-nivel]` |
| Endpoints | Los llama el motor: `GET /api/telemetria/configuracion` · `POST /api/telemetria` · `POST /api/conduccion` · `DELETE /api/telemetria/mias` · `POST /api/casos`. El proveedor: `GET /api/perfil` al encender |
| Cupo de estilos en línea | 0 |

El layout dibuja `<ModoViaje>{children}</ModoViaje>` y después `<BombaCola />`. El proveedor
envuelve las pantallas en `.raiz-app` (`display: contents`) y dibuja la capa después: una
región `role="status"` que anuncia cambios de estado, la píldora, la hoja y la alerta.

- **Píldora:** fija abajo al centro, en toda ruta salvo `/`, `/s/*`, `/t/*`, `/c/*`, `/e/*`,
  `/v/*`, `/verificar`, `/panel*`, `/entrar` y `/registro`. En `/` sólo aparece si el estado
  pide una acción y la tarjeta quedó arriba, fuera de la vista. Se oculta mientras un campo
  tiene el foco. Mientras se ve, `body` lleva `data-pildora-viaje` y `.envoltura` e `.inicio`
  reservan lugar abajo.
- **Hoja:** un `<dialog>` abierto con `showModal()`: estado, permisos, límites, «Probar la
  alerta», «Qué datos guarda», «Borrar mis registros del modo viaje» y «Apagar el modo viaje».
- **Alerta:** tapa todo desde cualquier ruta, en tres estados: «¿Estás bien?» con la cuenta,
  «¿Hubo un choque?» y la ayuda.

**Intocable:**

- La alerta es un `div role="alertdialog"`, **no un `<dialog>` ni un popover**: la abre un
  sensor, sin gesto, y el atrás de Android la cerraría sin respuesta. Va fuera de `.raiz-app`,
  que queda `inert` mientras está abierta; adentro, `inert` apagaría también sus regiones vivas.
- `data-armada` y `.alerta-viaje:not([data-armada]) .alerta-viaje-boton { pointer-events: none }`:
  los primeros 600 ms los botones no reciben el toque que venía de la pantalla de abajo.
- El marco que parpadea (`.alerta-viaje-destello`) no pasa de un destello cada 1,2 s y queda
  fijo con `prefers-reduced-motion`.
- La cuenta (`.alerta-viaje-cuenta`) no es región viva: lo que se anuncia son los 20, 10 y 5
  segundos, en una región aparte.
- «La aplicación no llama sola a emergencias» no se borra ni se parte en dos líneas: lo
  verifica `npm run contrato`.
```

- [ ] **Step 10: `docs/MAPA-PANTALLAS.md`: «Mis datos» y los doce íconos**

Reemplazar. **Antes:**

```md
| Mis datos | `app/perfil/page.tsx` | Carátula precargada, contacto de confianza y modo viaje |
```

**Después:**

```md
| Mis datos | `app/perfil/page.tsx` | Carátula precargada y contacto de confianza. El modo viaje ya no está acá: se enciende desde la tarjeta del inicio |
```

Reemplazar. **Antes:**

```md
Los iconos salen de `app/components/Iconos.tsx` y son once: `archivo`, `personas`,
`camara`, `compartir`, `descargar`, `escudo`, `microfono`, `telefono`, `tilde`,
`ubicacion`, `verificar`.
```

**Después:**

```md
Los iconos salen de `app/components/Iconos.tsx` y son doce: `archivo`, `auto`,
`camara`, `compartir`, `descargar`, `escudo`, `microfono`, `personas`, `telefono`, `tilde`,
`ubicacion`, `verificar`.
```

- [ ] **Step 11: Ver que no queda nada desactualizado**

```bash
grep -c "son once\|DetectorImpacto" docs/CONTRATO-UI.md docs/MAPA-PANTALLAS.md
```

Esperado (código 1):

```text
docs/CONTRATO-UI.md:0
docs/MAPA-PANTALLAS.md:0
```

- [ ] **Step 12: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `  ok   toda pantalla del recorrido figura en el mapa`, `El contrato se cumple.`; tipos sin `error TS`; `Todo en orden.`; código 0.

- [ ] **Step 13: Revisión de las medidas**

Con `npm run dev`, Chrome en `http://localhost:3000/`, sin sesión y sin actuación abierta (en la consola, `localStorage.removeItem('acta:actuacion-abierta')` y recargar), DevTools en Responsive 375×667: en Elements, `section.tarjeta-viaje` mide 434 px de alto y su borde de arriba queda a 540 px del comienzo de la página; el enlace «Ambulancia» empieza a 1057 px. En 390×797: 555 px y 1072 px. Si el aviso rojo de «El sistema no está operativo» aparece (sin base de datos), todo baja lo que mide ese aviso: la diferencia entre la tarjeta y «Ambulancia» sigue siendo 517 px. Con otra tipografía del sistema los números pueden moverse unos píxeles; si un estado de la tarjeta queda más alto que 434 px, se sube `min-height` en `.tarjeta-viaje` y el número del mapa en el mismo commit.

- [ ] **Step 14: Commit**

```bash
git add "docs/CONTRATO-UI.md" "docs/MAPA-PANTALLAS.md"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Documentar el modo viaje global en el contrato y en el mapa de pantallas

El contrato suma los dos data-* nuevos, los avisos que dicen un límite y el ícono
del auto. El mapa deja de mandar a DetectorImpacto, corrige el cupo real de
estilos en línea del inicio y anota cuánto baja la tarjeta los teléfonos de
emergencia, para que cualquier rediseño del inicio lo tenga presente.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Despliegue en dos pasos con `MODO_VIAJE_ALERTA` y matriz de dispositivos

**Files:** ninguno. Esta tarea no cambia archivos ni hace commit: prueba lo construido en un entorno de staging.

**Interfaces:**
- Consumes (F1, F2): `GET /api/telemetria/configuracion` (`alerta: 'normal' | 'silenciosa' | 'apagada'`), las variables `MODO_VIAJE_ALERTA`, `IMPACTO_UMBRAL_SOSPECHA_G` (rango válido 2 a 20) e `IMPACTO_MS_SOBRE_UMBRAL` (5 a 500), la tabla `telemetria` (columnas `alerta_mostrada`, `apertura`, `nivel`, `nivel_cliente`, `recibido_en`) y `eventos_conduccion`.
- Produces: el resultado de cada fila de la matriz, anotado en la verificación de la fase.

- [ ] **Step 1: Staging en silencio**

Desplegar la rama en staging por https, con certificado de confianza (por `http://192.168.x.x` los sensores no existen), con `MODO_VIAJE_ALERTA=silenciosa`, `IMPACTO_UMBRAL_SOSPECHA_G=2` e `IMPACTO_MS_SOBRE_UMBRAL=5`, para provocar episodios sin chocar.

```bash
curl -s "https://<host de staging>/api/telemetria/configuracion"
```

Esperado: JSON con `"alerta":"silenciosa"` y, dentro de `"umbrales"`, `"sospechaG":2` y `"msSobreUmbral":5`.

- [ ] **Step 2: Provocar un episodio sin alerta**

En un Android con Chrome: abrir la aplicación instalada, con el permiso de ubicación del sitio denegado (sin velocidad decide la fila 7 de §2.5, `sospecha`; con GPS preciso y el teléfono quieto decidiría la fila 1, `nada`). Encender el modo viaje desde la tarjeta, apoyar el teléfono plano sobre una mesa y dar un golpe seco con la palma sobre la mesa, al lado del teléfono, sin moverlo antes. Esperado: a los 8 s no aparece ninguna alerta y la píldora (en `/poliza`) sigue diciendo «Modo viaje activo». En la base de staging:

```sql
SELECT id, nivel, nivel_cliente, alerta_mostrada, apertura, recibido_en FROM telemetria ORDER BY recibido_en DESC LIMIT 3;
```

Esperado: una fila reciente con `alerta_mostrada = false` y `apertura = 'episodio'`.

- [ ] **Step 3: Staging con alerta**

Cambiar a `MODO_VIAJE_ALERTA=normal`, reiniciar el servicio, cerrar y volver a abrir la aplicación en el teléfono (la configuración guardada se renueva al reanudar). `curl` del paso 1 devuelve `"alerta":"normal"`. Repetir el golpe del paso 2: aparece la alerta «¿Estás bien?» con la cuenta. Responder «Estoy bien» → «¿Hubo un choque?» → «No, fue una falsa alarma». La fila nueva de `telemetria` tiene `alerta_mostrada = true`.

- [ ] **Step 4: Correr la matriz**

Correr las filas 1–9 y 11–16 de «Verificación de la fase» en cada dispositivo de la lista, con los umbrales de los pasos anteriores salvo en la fila 15, que va con los de omisión (las dos variables sin cargar). Anotar el resultado de cada celda al lado de la fila. Al terminar, staging vuelve a `IMPACTO_UMBRAL_SOSPECHA_G` e `IMPACTO_MS_SOBRE_UMBRAL` sin cargar.

---

## Verificación de la fase

**Comandos** (desde la raíz, con `next dev` detenido):

```bash
npm run contrato && npm run tipos && npm run prueba
npm run build
SECCION=V6 npx tsx scripts/prueba-viaje.mjs
SECCION=V7 npx tsx scripts/prueba-viaje.mjs
git log --oneline -8
```

Esperado: `El contrato se cumple.` con las cuatro comprobaciones de la tarea 7 en `ok`; tipos sin `error TS`; `Todo en orden.`; `✓ Compiled successfully`; las dos secciones del motor terminan en `Todo en orden.` (F4 no toca `lib/`); y los ocho commits de las tareas 1 a 8, del más nuevo al más viejo: «Documentar el modo viaje global…», «Verificar en el contrato…», «Abrir la alerta…», «Mostrar la píldora…», «Encender el modo viaje desde el inicio…», «Montar el modo viaje en el layout…», «Agregar los estilos…», «Sumar el ícono del auto…».

**En escritorio** (se puede repetir sin teléfono): la revisión manual de la tarea 4, paso 9, y las de las tareas 5 (paso 9) y 6 (paso 5), en ese orden y con los mismos resultados.

**En dispositivos** (§6.5, filas de F4; la 10 es de F5 y la 17 de F6). Staging por https con certificado de confianza, `MODO_VIAJE_ALERTA=normal`, `IMPACTO_UMBRAL_SOSPECHA_G=2` e `IMPACTO_MS_SOBRE_UMBRAL=5` salvo donde se indica. Dispositivos: iPhone con iOS ≥ 18.4 instalada, iPhone con iOS < 18.4 instalada, iPhone en Safari, Android con Chrome instalada, iPad Wi-Fi y escritorio. Para provocar la alerta (filas 12, 13 y 14): el golpe seco sobre la mesa de la tarea 9, paso 2, con el permiso de ubicación del sitio denegado. En las demás filas la ubicación queda permitida.

| # | Procedimiento | Esperado |
|---|---|---|
| 1 | Primer encendido desde la tarjeta, esperando 8 s antes de tocar «Permitir» | A los 2 min la pantalla sigue encendida, o la tarjeta dice «Tocá la pantalla para que no se apague» y un toque la retiene |
| 2 | Con el modo encendido, recorrer `/`, `/poliza`, `/historial`, `/perfil`, `/cuenta`, `/aviso` y abrir una actuación (`/s/<id>`) | Sigue activo en todas. La píldora aparece en `/poliza`, `/historial`, `/perfil`, `/cuenta` y `/aviso`; no aparece en `/`, `/s/<id>`, `/entrar`, `/registro` ni `/verificar`. Al entrar a `/s/<id>` el lector de pantalla anuncia «Modo viaje en pausa» y al salir «Modo viaje activo de nuevo» |
| 3 | Recargar con la aplicación abierta y esperar el bloqueo automático sin tocar | Antes de que se apague la pantalla (o todo el tiempo, si el sistema la retiene), la tarjeta pide un toque («Tocá la pantalla para que no se apague» o «Tocá la pantalla para activar el sonido y la vibración del aviso») y, fuera del inicio, la píldora dice «Tocá para activar el sonido del aviso» |
| 4 | Cerrar la aplicación desde el selector de apps y volver a abrirla | La tarjeta dice «Tocá para reanudar (el iPhone te vuelve a pedir permiso)» (fuera del inicio, la píldora «Modo viaje: tocá para reanudar»); en iPhone vuelve el diálogo de movimiento al tocar |
| 5 | Denegar el permiso de movimiento y seguir la instrucción (en Android: candado o ⋮ › Configuración del sitio › Sensores de movimiento › Bloquear, y después encender) | iPhone: la tarjeta dice «Sin permiso de movimiento»; «Cómo habilitarlo» abre la hoja en «Permisos» con los pasos de iPhone; siguiéndolos, el interruptor vuelve a encender. Android: Chrome no pregunta, los eventos no llegan y a los 3 s la tarjeta dice «Este equipo no entrega lecturas de movimiento: el modo viaje funciona en el teléfono», sin interruptor y con «Cómo habilitarlo», que abre la hoja en «Permisos» con «Tocá el candado o ⋮ › Configuración del sitio › Sensores de movimiento › Permitir.»; siguiéndolos, el interruptor vuelve recién cuando vence `acta:viaje:sin-sensores` (24 h) o se borra esa clave desde la consola remota y se recarga. Anotar ese plazo en el resultado de la fila, para F6 |
| 6 | iPhone con la llave de silencio, música por Bluetooth, «Probar la alerta» en la hoja | Se oye; la música se pausa mientras suena y la persona lo nota |
| 7 | Android en silencio, «Probar la alerta» y después una alerta real | No vibra y la tarjeta lo dice. Con F4 la advertencia de la tarjeta sale sólo si el navegador no tiene `navigator.vibrate` (`tarjeta.sin_vibracion`); si en ese Android la tarjeta no lo dice, se anota así en el resultado de la fila (ver «Desvíos») |
| 8 | Recibir una llamada durante el viaje y volver a la aplicación | El sonido sigue destrabado, o la tarjeta o la píldora piden «Tocá…» y un toque lo destraba |
| 9 | Bloquear el teléfono 3 min, desbloquear y frenar fuerte en un playón | La frenada queda en `SELECT tipo, kmh_inicial, kmh_final, g_estimada, recibido_en FROM eventos_conduccion ORDER BY recibido_en DESC LIMIT 5;` y no aparece ninguna alerta |
| 11 | Abrir la PWA y la misma dirección en una pestaña, encender en las dos | Una queda en «El modo viaje está abierto en otra ventana», sin interruptor |
| 12 | Teléfono apaisado en el soporte, provocar la alerta | «¿Estás bien?» entra entera: título y cuenta a la izquierda, botones a la derecha. En «¿Hubo un choque?» y en la ayuda, lo que no entra se alcanza con scroll dentro de la alerta sin mover la pantalla de abajo |
| 13 | VoiceOver / TalkBack, provocar la alerta y hacer doble toque enseguida | El lector dice «¿Estás bien?» primero; un doble toque dentro de los primeros 600 ms no responde |
| 14 | Con la alerta abierta, gesto atrás (Android) o deslizar desde el borde (iPhone) | La alerta sigue, con la misma cuenta |
| 15 | Con los umbrales de omisión (`IMPACTO_UMBRAL_SOSPECHA_G` e `IMPACTO_MS_SOBRE_UMBRAL` sin cargar, servicio reiniciado, aplicación reabierta): sacudir el teléfono en la mano, dejarlo caer al asiento, golpear la consola | Sin alerta |
| 16 | Abrir la aplicación por `http://` (IP de la red local) | La tarjeta dice «Abrí la aplicación desde su dirección https», sin interruptor |

## Desvíos respecto del índice

1. **`.emergencias-chicas` entra en la tarea 1, no en la 2.** El índice pone todas las clases en la tarea 2 (índice, «Fases › F4», punto 2), pero la tarea 1 ya usa la clase en `BotonesEmergencia.tsx` y `npm run contrato` rechaza una clase del marcado que no está en la hoja (`scripts/prueba-contrato.mjs:393`): sin la regla, el commit de la tarea 1 no pasa las tres verificaciones. Se verificó: el contrato falla con `.emergencias-chicas (app/components/BotonesEmergencia.tsx)` hasta que la regla existe.
2. **Los días de «Se guardan {dias} días» se leen de `localStorage['acta:viaje:configuracion']`.** El índice define `{dias}` como `configuracion.dias_conservacion` («Textos exactos», párrafo inicial; clave `datos.conservacion`), pero `EstadoModoViaje.configuracion` no tiene ese campo («Interfaces › `lib/viaje.ts`», bloque `configuracion`), y el índice reserva `localStorage` al motor salvo el contacto y `actuacionAbierta()` («Almacenamiento del cliente», primer párrafo). Arreglo mínimo: la hoja lee esa clave, que escribe el motor con la forma del índice, sólo para leer, y usa 90 (la omisión de `TELEMETRIA_DIAS_CONSERVACION`) si falta. No se pide la configuración al servidor porque esa ruta crea la cookie que identifica al teléfono, y leer el aviso de datos no puede dejar un identificador.
3. **La ayuda provisoria suma «Registrar el accidente» (`ayuda.registrar`) y «Abriendo...» (`ayuda.abriendo`).** El resumen de decisiones dice que F4 dibuja títulos, `BotonesEmergencia` y falsa alarma (decisión 20), pero la tabla de textos dice que F4 usa `ayuda.sin_senal` («Textos exactos › Ayuda»), que sólo tiene sentido después de intentar registrar sin red. Sin el botón, quien pidió ayuda después de un choque real sólo puede salir de la alerta con «Estoy bien, fue una falsa alarma», que guarda `hubo_choque = false`. El botón usa `motor.registrarAccidente` de F3 tal cual; F5 lo reemplaza con `AyudaImpacto`. Por la misma razón, «Sí, registrar el accidente» de `hubo_choque` muestra `ayuda.sin_senal` sin red, debajo de los teléfonos chicos para que «los botones de arriba» sea cierto. Como en `AyudaImpacto` (índice, «Interfaces › `app/components/AyudaImpacto.tsx` (F5)», párrafo «Adentro»; diseño §3.4), si `actuacionAbierta()` devuelve un id el botón dice «Continuar la actuación abierta» (`ayuda.continuar`) y navega a `/s/<id>`: sin eso, registrar abría una segunda actuación y `recordarActuacion` pisaba `acta:actuacion-abierta`, así que el teléfono olvidaba la primera. Para eso `AlertaViaje` lee `actuacionAbierta()`, que «Almacenamiento del cliente» (primer párrafo) sólo le permite a `AyudaImpacto.tsx`; es la misma lectura con el mismo `try/catch` de `lib/local.ts`. Efecto sobre F5: `ModoViaje.tsx` ya importa `actuacionAbierta` de `@/lib/local` desde la tarea 6, y la rama `ayuda` que F5 reemplaza trae el botón condicional.
4. **La fila 7 de §6.5 no se puede cumplir tal cual con el índice.** «Android en silencio: no vibra y la tarjeta lo dice», pero la advertencia `tarjeta.sin_vibracion` sale sólo sin `navigator.vibrate` (diseño §3.1 e índice, nota bajo la tabla de la tarjeta), y un navegador no puede saber si el teléfono está en silencio. El plan no inventa un texto: la fila se corre y se anota el resultado para la calibración de F6.
5. **`capaBloqueante` también mira si la capa falló.** El índice fija `capaBloqueante = estado.alerta !== null` en el proveedor y un límite de errores que sólo devuelve `null` («Interfaces › `app/components/ModoViaje.tsx`», comentario del proveedor). Si la alerta tira al dibujarse, el límite la esconde pero `.raiz-app` queda `inert`: ninguna pantalla recibe toques, tampoco «Tuve un accidente» ni los `tel:`, y una alerta en `ayuda` vuelve al recargar durante 30 min (índice, «Almacenamiento del cliente», decisión sobre `acta:viaje:alerta`), justo lo que el límite existe para evitar (diseño §1.2). Arreglo mínimo (tarea 5): `LimiteCapa` recibe `alFallar` y lo llama desde `componentDidCatch`, el proveedor guarda `capaFallo` y la regla queda `estado.alerta !== null && !capaFallo`. Con la capa dibujada, la regla es la del índice.
6. **En Android, `sin_lecturas` suma «Cómo habilitarlo» en la tarjeta.** La tabla de §3.1 del diseño no le pone acción a `sin_lecturas`, pero en Android negar «Sensores de movimiento» no da `sin_permiso` (no hay `requestPermission`: los eventos no llegan y la fase termina en `sin_lecturas`), y el diseño manda la instrucción de Android para `sin_permiso` o `sin_lecturas` a la hoja (§3.2, «permisos»). Sin el botón, esa instrucción sólo se alcanzaba desde «Qué datos guarda», subiendo. Arreglo mínimo (tarea 4): `lineaDeLaTarjeta` da `accion: 'como_habilitar'` a `sin_lecturas` sólo con `plataforma === 'android'`; texto e interruptor no cambian. Queda del índice que `acta:viaje:sin-sensores` dura 24 h, así que después de habilitar el permiso el interruptor no vuelve enseguida: la fila 5 lo anota para F6.
7. **Queda sin cambiar, fuera del índice:** `app/cuenta/page.tsx:42` sigue diciendo «A quién avisar si el teléfono detecta un impacto y no respondés.», la misma promesa que §3.7 corrige en «Mis datos». El índice no la incluye en F4 ni fija un texto de reemplazo, así que este plan no la toca.
