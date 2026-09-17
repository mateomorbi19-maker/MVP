# F6 — Calibración — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar el modo viaje listo para calibrarse en campo: una sección «Diagnóstico» en la hoja que muestra lo que el motor ya mide, un README que dice lo que el detector hace de verdad, sus límites, sus variables, las tres consultas SQL de calibración, el procedimiento de staging y la matriz de prueba en dispositivo con la fila 17, y los dos comentarios que evitan romperlo sin querer (`lib/local.ts` y `next.config.mjs`).

**Architecture:** No hay lógica nueva. La sección «Diagnóstico» es un componente sin exportar dentro de `app/components/ModoViaje.tsx` que lee el mismo almacén externo que el proveedor (`suscribir` y `obtener` de nivel de módulo, `ESTADO_SERVIDOR` como instantánea del servidor) y dibuja `estado.diagnostico` (publicado por el motor de F3 sólo cuando existe `localStorage['acta:diagnostico']`); se inserta al final del `<dialog>` de la hoja y trae dos clases nuevas en `app/globals.css`. El resto es documentación: `README.md` y dos comentarios. Las consultas de calibración leen las columnas que F1 agregó a `telemetria` y a `eventos_conduccion`, sin tocar el esquema.

**Tech Stack:** Next.js 16.3 (app router), React 19.2 (`useSyncExternalStore`), TypeScript 7 (`tsc --noEmit`), CSS con tokens de `app/globals.css`, Postgres (consultas de sólo lectura), `pg` y Node 24 para validar las consultas con `EXPLAIN`.

**Spec:** `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md` (§0.5, §2, §3.2, §6.5, §6.6) · índice: `docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md`

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

Todos los comandos de este plan son de Git Bash y se corren desde la raíz del repositorio:

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
```

- [ ] **Precondición 1: rama y árbol.** `git branch --show-current` imprime `modo-viaje-global`. `git status --short` no muestra cambios sin commitear fuera de `docs/superpowers/plans/`.
- [ ] **Precondición 2: F5 terminada.** `git log --oneline -15` muestra los commits de F5 (ayuda, golpe pendiente, alta vinculada, retención y documentación). Existen `app/components/AyudaImpacto.tsx` y `app/components/ModoViaje.tsx`, y `grep -c "export async function purgarTelemetria" lib/retencion.ts` imprime `1`.
- [ ] **Precondición 3: las tres verificaciones en verde.**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: el contrato termina en `El contrato se cumple.`, `npm run tipos` no imprime nada y sale con 0, y `npm run prueba` termina en `Todo en orden.` (la última línea es la de `scripts/prueba-viaje.mjs`).
- [ ] **Precondición 4: los anclajes que este plan usa existen tal como los dejó F4.**

```bash
grep -c "</dialog>" app/components/ModoViaje.tsx
grep -nE "^(const|function) (suscribir|obtener)\b" app/components/ModoViaje.tsx
grep -n "useSyncExternalStore" app/components/ModoViaje.tsx
grep -n "lib/viaje'" app/components/ModoViaje.tsx
grep -c "VERSION_MOTOR" app/components/ModoViaje.tsx
grep -c "hoja-viaje-diagnostico" app/components/ModoViaje.tsx app/globals.css
grep -nE "^\.hoja-viaje-(seccion|subtitulo|dato)\b" app/globals.css
grep -c "cruza el pico de aceleración" README.md
grep -n "IMPACTO_VELOCIDAD_PREVIA_KMH" README.md
```

Esperado, en orden: `1` (la hoja es el único `<dialog>`: la alerta es un `div role="alertdialog"`); dos líneas, una que declara `suscribir` y otra `obtener`; al menos dos líneas (el import de `react` y el uso en `ModoViaje`); una línea con el import de `lib/viaje` (con `@/lib/viaje` o ruta relativa); `0`; `app/components/ModoViaje.tsx:0` y `app/globals.css:0`; las tres clases de F4 (en una o más líneas); `1`; al menos una línea (el aviso de F2 de que la omisión pasó de 30 a 15). Si alguna no da eso, se para acá y se anota en «Desvíos» con la salida.
- [ ] **Leer antes de escribir:**
  - el índice completo, en especial «Interfaces › `lib/viaje.ts`» (`EstadoModoViaje.diagnostico`), «Interfaces › `app/components/ModoViaje.tsx`», «Esquema», «Almacenamiento del cliente» (`acta:diagnostico`) y los riesgos 32–36;
  - el diseño: §0.5, §2 completa, §2.8, §2.9, §3.2 (último punto de la hoja), §6.5 y §6.6;
  - `app/components/ModoViaje.tsx` entero (cómo arma la hoja y dónde cierra el `<dialog>`);
  - el bloque de reglas `.hoja-viaje…` de `app/globals.css` (`grep -n "^\.hoja-viaje" app/globals.css`) y las reglas globales de `table` (hoy `app/globals.css:860-865`, con `min-width: 640px`);
  - `docs/CONTRATO-UI.md` §2 y §3 (clases y cupo de estilos);
  - `README.md` entero, `lib/local.ts` y `next.config.mjs`;
  - `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md`, sección «Permissions-Policy» (su ejemplo apaga `geolocation` y `microphone`: es lo que el comentario de la Tarea 4 advierte).

---

### Task 1: «Diagnóstico» en la hoja

Índice F6.1. Datos que ya publica `estado().diagnostico` desde F3, más los campos del estado que pide §3.2 (velocidad, precisión, fuente, pantalla y audio).

**Files:**
- Modify: `app/components/ModoViaje.tsx` — el import desde `lib/viaje` (suma `VERSION_MOTOR`); un componente nuevo sin exportar `DiagnosticoViaje` inmediatamente antes de `export function ModoViaje(`; y `<DiagnosticoViaje />` inmediatamente antes del único `</dialog>` (la hoja).
- Modify: `app/globals.css` — dos reglas nuevas después de la última regla de nivel superior cuyo selector empieza con `.hoja-viaje` (ubicarla con `grep -n "^\.hoja-viaje" app/globals.css | tail -1`).
- Test: `scripts/prueba-contrato.mjs` (sin cambios: la comprobación existente «toda clase del marcado está definida en globals.css» es la prueba que falla primero), `npm run tipos` y verificación manual.

**Interfaces:**
- Consumes:
  - `lib/viaje.ts` (F3): `export const VERSION_MOTOR = 1`; `export const ESTADO_SERVIDOR: EstadoModoViaje`; los campos de `EstadoModoViaje` `diagnostico: null | { gVivo: number | null; hz: number | null; episodios: ReadonlyArray<{ en: number; nivel: NivelImpacto; picoG: number; motivo: string }> }`, `velocidadKmh: number | null`, `precisionM: number | null`, `gps`, `fuente: 'confiable' | 'derivada'`, `pantalla`, `pantallaLiberada: boolean`, `avisos: { sonido; vibracion }`, `sesionDeAudio: boolean`, `plataforma`, `standalone: boolean` y `configuracion: { version: string | null; alerta; caidaSinGolpe; umbrales: Umbrales; desactualizado: boolean }`.
  - `app/components/ModoViaje.tsx` (F4): `suscribir` y `obtener` de nivel de módulo, `(fn) => motorDelNavegador()?.suscribir(fn) ?? (() => {})` y `() => motorDelNavegador()?.estado() ?? ESTADO_SERVIDOR`; el import de `useSyncExternalStore` desde `react`.
  - `app/globals.css` (F4): `.hoja-viaje-seccion`, `.hoja-viaje-subtitulo`, `.hoja-viaje-dato`; token `--tinta-2`.
- Produces: ningún export nuevo (`ModoViaje.tsx` sigue exportando sólo `ModoViaje` y `useModoViaje`). Clases `.hoja-viaje-diagnostico` y `.hoja-viaje-diagnostico-tabla`. Textos nuevos, decididos en esta fase (el índice sólo fija `hoja.diagnostico` = «Diagnóstico»):

| Clave (sólo para citar) | Texto |
|---|---|
| `diagnostico.g_vivo` | Aceleración en vivo {g} g · sin dato: «Aceleración en vivo: sin lecturas» |
| `diagnostico.hz` | Frecuencia del acelerómetro {n} Hz · sin dato: «Frecuencia del acelerómetro: sin lecturas» |
| `diagnostico.fuente` | «Fuente de aceleración: con giróscopo» / «Fuente de aceleración: derivada, sin giróscopo» |
| `diagnostico.velocidad` | los de la hoja: «Velocidad {kmh} km/h» / «Velocidad: sin GPS» |
| `diagnostico.precision` | «Precisión del GPS {m} m» / «Precisión del GPS: sin dato», seguido de « · GPS {estado.gps}» |
| `diagnostico.pantalla` | «Pantalla {estado.pantalla}» y, si `pantallaLiberada`, « · liberada por el sistema» |
| `diagnostico.audio` | «Sonido {sonido} · vibración {vibracion} · sesión de audio disponible» (o «no disponible») |
| `diagnostico.configuracion` | «Configuración {version o «de este teléfono»} · alerta {alerta} · caída sin golpe {caidaSinGolpe}» y, si `desactualizado`, « · motor desactualizado» |
| `diagnostico.motor` | «Motor {VERSION_MOTOR} · umbral de sospecha {sospechaG} g · {plataforma}» y « instalada» o « en el navegador» |
| `diagnostico.sin_episodios` | Todavía no hay episodios en este teléfono. |
| `diagnostico.lista` (`aria-label`) | Últimos episodios, el más reciente primero |
| `diagnostico.episodio` | «{hh:mm:ss} · {nivel} · {pico} g» en negrita y, a continuación, el motivo |

**Decisión de esta fase:** los estados (`gps`, `pantalla`, `sonido`, `vibracion`, `alerta`, `nivel`) se muestran con su código tal cual (`sin_permiso`, `no_garantizada`…). Es una sección para quien calibra, y el código es el mismo que aparece en el índice, en las columnas y en los motivos: traducirlo obliga a una tabla de equivalencias para leer un reporte de campo.

- [ ] **Step 1: Confirmar la forma exacta de los anclajes**

```bash
grep -n "</dialog>" app/components/ModoViaje.tsx
grep -n "^export function ModoViaje(" app/components/ModoViaje.tsx
grep -n "lib/viaje'" app/components/ModoViaje.tsx
grep -n "^\.hoja-viaje" app/globals.css | tail -1
```

Esperado: una línea por cada uno de los tres primeros y una línea para el último (la última regla `.hoja-viaje…` de nivel superior; con F5 suele ser `.hoja-viaje-golpe`). Anotar los números: se usan en los pasos 2 a 4 y en el 7.

- [ ] **Step 2: Sumar `VERSION_MOTOR` al import de `lib/viaje`**

En la línea encontrada en el paso 1 con `lib/viaje'`, agregar `VERSION_MOTOR` como último nombre dentro de las llaves. Si el import ocupa una sola línea, por ejemplo:

```tsx
import { ESTADO_SERVIDOR, motorDelNavegador, type EstadoModoViaje } from '@/lib/viaje'
```

queda:

```tsx
import { ESTADO_SERVIDOR, motorDelNavegador, type EstadoModoViaje, VERSION_MOTOR } from '@/lib/viaje'
```

(se conservan todos los nombres que ya tenía, en su orden, y la ruta tal como está). Si ocupa varias líneas, se agrega la línea `  VERSION_MOTOR,` inmediatamente antes de la que empieza con `} from`.

- [ ] **Step 3: Escribir `DiagnosticoViaje` inmediatamente antes de `export function ModoViaje(`**

Insertar este bloque completo, seguido de una línea en blanco, justo arriba de la línea `export function ModoViaje(` (si esa función tiene un comentario `/** … */` encima, el bloque va arriba del comentario):

```tsx
/**
 * «Diagnóstico» de la hoja (§3.2). Sólo sirve para calibrar en campo: el motor publica
 * estado.diagnostico únicamente si alguien escribió a mano la clave de diagnóstico en este
 * teléfono, así que sin ella la sección no existe y la hoja queda igual para el asegurado.
 *
 * Lee el almacén por su cuenta, con las mismas suscribir y obtener del proveedor, en vez de
 * recibir el estado por props: así no depende de cómo la hoja reparte el estado entre sus
 * secciones. El <dialog> cerrado sigue montado y la suscripción sigue viva también con la hoja
 * cerrada: no se condiciona a que esté abierta porque sin la clave de diagnóstico devuelve null
 * en la primera línea, y con ella lo que interesa es que la sección ya esté al día al abrir.
 *
 * Los estados van con su código (sin_permiso, no_garantizada): es el mismo que aparece en el
 * índice, en las columnas de telemetria y en los motivos, y un reporte de campo se lee sin
 * tabla de equivalencias.
 */
function DiagnosticoViaje() {
  const estado = useSyncExternalStore(suscribir, obtener, () => ESTADO_SERVIDOR)
  const diagnostico = estado.diagnostico
  if (diagnostico === null) return null

  // El orden en que el motor guarda los episodios no es parte del contrato: se ordena acá.
  const episodios = [...diagnostico.episodios].sort((a, b) => b.en - a.en).slice(0, 20)
  // hour12: false porque algunos motores agregan «a. m.» (riesgo 31); con segundos, para
  // poder cruzar un episodio con lo que se anotó en el viaje.
  const reloj = (ms: number) =>
    new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })

  return (
    <section className="hoja-viaje-seccion hoja-viaje-diagnostico">
      <h3 className="hoja-viaje-subtitulo">Diagnóstico</h3>
      <p className="hoja-viaje-dato">
        {diagnostico.gVivo === null ? 'Aceleración en vivo: sin lecturas' : `Aceleración en vivo ${diagnostico.gVivo.toFixed(2)} g`}
      </p>
      <p className="hoja-viaje-dato">
        {diagnostico.hz === null ? 'Frecuencia del acelerómetro: sin lecturas' : `Frecuencia del acelerómetro ${Math.round(diagnostico.hz)} Hz`}
      </p>
      <p className="hoja-viaje-dato">
        {estado.fuente === 'confiable' ? 'Fuente de aceleración: con giróscopo' : 'Fuente de aceleración: derivada, sin giróscopo'}
      </p>
      <p className="hoja-viaje-dato">
        {estado.velocidadKmh === null ? 'Velocidad: sin GPS' : `Velocidad ${Math.round(estado.velocidadKmh)} km/h`}
      </p>
      <p className="hoja-viaje-dato">
        {estado.precisionM === null ? 'Precisión del GPS: sin dato' : `Precisión del GPS ${Math.round(estado.precisionM)} m`} · GPS {estado.gps}
      </p>
      <p className="hoja-viaje-dato">
        Pantalla {estado.pantalla}
        {estado.pantallaLiberada ? ' · liberada por el sistema' : ''}
      </p>
      <p className="hoja-viaje-dato">
        Sonido {estado.avisos.sonido} · vibración {estado.avisos.vibracion} · sesión de audio {estado.sesionDeAudio ? 'disponible' : 'no disponible'}
      </p>
      <p className="hoja-viaje-dato">
        Configuración {estado.configuracion.version ?? 'de este teléfono'} · alerta {estado.configuracion.alerta} · caída sin golpe {estado.configuracion.caidaSinGolpe}
        {estado.configuracion.desactualizado ? ' · motor desactualizado' : ''}
      </p>
      <p className="hoja-viaje-dato">
        Motor {VERSION_MOTOR} · umbral de sospecha {estado.configuracion.umbrales.sospechaG} g · {estado.plataforma}
        {estado.standalone ? ' instalada' : ' en el navegador'}
      </p>
      {episodios.length === 0 ? (
        <p className="hoja-viaje-dato">Todavía no hay episodios en este teléfono.</p>
      ) : (
        <ol className="hoja-viaje-diagnostico-tabla" aria-label="Últimos episodios, el más reciente primero">
          {episodios.map((episodio, i) => (
            <li key={`${episodio.en}-${i}`}>
              <strong>
                {reloj(episodio.en)} · {episodio.nivel} · {episodio.picoG.toFixed(1)} g
              </strong>{' '}
              {episodio.motivo}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
```

Por qué una lista y no `<table>`: la regla global `table { min-width: 640px }` (`app/globals.css`, bloque «Tabla») abriría scroll horizontal dentro de la hoja en un teléfono de 375 px, y estilar celdas obligaría a selectores que cuelgan de `th` y `td`. Los `<li>` no llevan clase: heredan todo de `.hoja-viaje-diagnostico-tabla` (y no se les pone `.hoja-viaje-dato` porque si F4 la hizo flex, la negrita y el motivo se partirían en dos columnas).

- [ ] **Step 4: Montar la sección al final de la hoja**

Reemplazar la única línea que contiene `</dialog>` (paso 1) por dos líneas con la misma sangría que tenía `</dialog>` más dos espacios para la primera:

Antes:

```tsx
    </dialog>
```

Después:

```tsx
      <DiagnosticoViaje />
    </dialog>
```

(la sangría real es la que tenga el archivo: `<DiagnosticoViaje />` va dos espacios más adentro que `</dialog>`). No hace falta condición: el componente devuelve `null` sin diagnóstico.

- [ ] **Step 5: Correr el contrato y ver que falla por las clases nuevas**

```bash
npm run contrato
```

Esperado FALLA: la salida tiene

```
  FALLA toda clase del marcado está definida en globals.css
         .hoja-viaje-diagnostico (app/components/ModoViaje.tsx), .hoja-viaje-diagnostico-tabla (app/components/ModoViaje.tsx)
         Una clase que no existe no falla: el elemento sale sin estilo y sólo se ve abriendo esa pantalla en ese estado.
```

y termina con `1 FALLARON. El contrato está en docs/CONTRATO-UI.md.` y sale con código 1. Si en la lista aparece otra clase además de esas dos, hay un error de tipeo en el paso 3: corregirlo antes de seguir. Si no falla, alguien ya definió las clases: detenerse y anotarlo en «Desvíos».

- [ ] **Step 6: Correr los tipos**

```bash
npm run tipos
```

Esperado: sin salida y código 0. Un error `Cannot find name 'VERSION_MOTOR'` quiere decir que el paso 2 no quedó bien; `Cannot find name 'suscribir'` u `'obtener'`, que F4 los nombró distinto (se anota en «Desvíos» y se usan los nombres reales de las dos funciones de nivel de módulo que F4 pasa a `useSyncExternalStore`).

- [ ] **Step 7: Escribir las reglas de estilo**

Ubicar con `grep -n "^\.hoja-viaje" app/globals.css | tail -1` la última regla `.hoja-viaje…` de nivel superior; buscar desde esa línea hacia abajo la primera línea que contiene sólo `}` en la columna 1 (el cierre de esa regla; el archivo tiene fin de línea CRLF en el árbol de trabajo y se conserva así). Inmediatamente después de esa `}`, insertar una línea en blanco y este bloque:

```css
/* ---------- Modo viaje: diagnóstico ---------- */

/*
 * Sólo lo ve quien calibra, con la clave de diagnóstico escrita a mano. Números tabulares
 * para que dos lecturas seguidas se comparen sin que el texto baile; y el motivo corta en
 * cualquier punto porque trae nombres de señales largos (golpe_en_marcha, desaceleracionImposibleG)
 * que empujarían el ancho de la hoja en un teléfono de 375 px.
 */
.hoja-viaje-diagnostico {
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

/*
 * Lista y no <table>: la regla global de table fija min-width: 640px para el panel, y dentro
 * de la hoja abriría scroll horizontal. Los li heredan list-style, tamaño y color de acá, así
 * que ningún selector cuelga de un tipo de elemento.
 */
.hoja-viaje-diagnostico-tabla {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
  font-size: 14px;
  line-height: 1.4;
  color: var(--tinta-2);
}
```

Sin colores literales, sin `:hover`, sin animaciones: el bloque de `prefers-reduced-motion` no cambia.

- [ ] **Step 8: Correr el contrato y ver que pasa**

```bash
npm run contrato
```

Esperado PASA: la línea `  ok   toda clase del marcado está definida en globals.css`, también `  ok   los estilos en línea respetan su cupo` y `  ok   ninguna pantalla compara contra el texto de una respuesta`, y la última línea `El contrato se cumple.`.

- [ ] **Step 9: Verificación manual en el escritorio, con un acelerómetro simulado**

Con la base configurada, `npm run dev` en otra terminal y Chrome de escritorio en `http://localhost:3000` (localhost es contexto seguro; la pestaña tiene que quedar al frente: en segundo plano Chrome frena los temporizadores).

1. Sin la clave: abrir la consola y correr `localStorage.removeItem('acta:diagnostico')`, recargar, tocar «Qué datos guarda» en la tarjeta del modo viaje y bajar hasta el final de la hoja. Esperado: no hay ninguna sección «Diagnóstico».
2. Cerrar la hoja. En la consola:

   ```js
   localStorage.setItem('acta:diagnostico', 'si')
   location.reload()
   ```

3. Después de recargar, en la consola (simula un teléfono quieto a unos 60 Hz):

   ```js
   window.__simulador = setInterval(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: 0.01, y: 0, z: 0.02 }, accelerationIncludingGravity: { x: 0.01, y: 0, z: 9.81 }, rotationRate: { alpha: 0.1, beta: 0, gamma: 0 }, interval: 16 })), 16)
   ```

4. Encender el interruptor de la tarjeta; cuando Chrome pida la ubicación, tocar «Bloquear». Tocar «Qué datos guarda» y bajar hasta el final. Esperado: la sección «Diagnóstico» con, en este orden, «Aceleración en vivo 0.00 g», «Frecuencia del acelerómetro N Hz» con N entre 50 y 65, «Fuente de aceleración: con giróscopo», «Velocidad: sin GPS», «Precisión del GPS: sin dato · GPS sin_permiso», «Pantalla retenida», «Sonido listo · vibración listo · sesión de audio no disponible» (Chrome de escritorio no tiene `navigator.audioSession`; si todavía no hubo un toque después de encender, `sonido` y `vibracion` pueden decir `requiere_toque` hasta el primer clic en la página), «Configuración» seguida de los 16 caracteres hexadecimales de la versión y de « · alerta normal · caída sin golpe silenciosa», «Motor 1 · umbral de sospecha 4 g · otro en el navegador» y «Todavía no hay episodios en este teléfono.». Ninguna línea desborda a lo ancho con la ventana en 375 px (DevTools › barra de dispositivos).
5. Cerrar la hoja. Simular un golpe de 5 g sostenido unos 64 ms (sin velocidad, fila 7: sospecha). El intervalo de muestras quietas del punto 3 se corta antes del golpe y se reanuda después: si siguiera corriendo, sus muestras se intercalarían con las fuertes, la racha contigua sobre `sospechaG/2` que contiene el pico duraría una sola muestra, no llegaría a `msSobreUmbral` (30 ms) y el veredicto quedaría en `nada` sin ninguna alerta:

   ```js
   clearInterval(window.__simulador)
   for (let i = 0; i < 5; i++) setTimeout(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: 50, y: 0, z: 0 }, accelerationIncludingGravity: { x: 50, y: 0, z: 9.81 }, rotationRate: { alpha: 0.1, beta: 0, gamma: 0 }, interval: 16 })), i * 16)
   setTimeout(() => { window.__simulador = setInterval(() => window.dispatchEvent(new DeviceMotionEvent('devicemotion', { acceleration: { x: 0.01, y: 0, z: 0.02 }, accelerationIncludingGravity: { x: 0.01, y: 0, z: 9.81 }, rotationRate: { alpha: 0.1, beta: 0, gamma: 0 }, interval: 16 })), 16) }, 5 * 16)
   ```

   Esperado: unos 8 segundos después se abre la alerta «¿Estás bien?». Si no se abre y la sección «Diagnóstico» tampoco muestra el episodio, revisar que se haya pegado el bloque entero (las tres líneas) antes de sospechar del motor. Tocar «Estoy bien» y, en «¿Hubo un choque?», «No, fue una falsa alarma».
6. Abrir de nuevo la hoja con «Qué datos guarda» y bajar hasta el final. Esperado: en lugar de «Todavía no hay episodios…» hay una lista con una fila «hh:mm:ss · sospecha · 5.1 g» en negrita (la hora de hace unos segundos) seguida del motivo del veredicto.
7. Limpiar: `clearInterval(window.__simulador)`, apagar el modo viaje desde la hoja, «Borrar mis registros del modo viaje», y `localStorage.removeItem('acta:diagnostico')`.

Si en el punto 4 la tarjeta dice «Este equipo no entrega lecturas de movimiento: el modo viaje funciona en el teléfono», el motor de F3 descarta los eventos sintéticos (`isTrusted` en `false`): no es una falla de esta tarea. En ese caso los puntos 4 a 6 se hacen en un teléfono contra staging, con los pasos 1 a 5 de «Staging» que escribe la Tarea 3 (el golpe sobre la mesa reemplaza al del punto 5), y se anota en el reporte de la tarea.

- [ ] **Step 10: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, `npm run tipos` sin salida y `Todo en orden.` al final.

- [ ] **Step 11: Commit**

```bash
git add "app/components/ModoViaje.tsx" "app/globals.css"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Mostrar el diagnóstico del modo viaje en la hoja para calibrar en campo

Quien prueba en la calle necesita ver lo que el motor mide mientras pasa: la
aceleración en vivo, la frecuencia real del sensor, la fuente, el GPS, la pantalla,
el audio, la configuración vigente y los últimos 20 episodios con su motivo. Sin
eso, una alerta que no salió no se puede explicar después.

La sección sólo existe si en ese teléfono alguien escribió a mano la clave de
diagnóstico: para el asegurado la hoja queda igual. Es una lista y no una tabla
porque la regla global de table fija 640 px de ancho mínimo y abría scroll
horizontal dentro de la hoja.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: README — lo que el detector hace de verdad, límites, variables y consultas de calibración

Índice F6.2, primera mitad. Se parte en dos tareas porque son dos revisiones independientes: ésta se revisa contra el código y el esquema (reglas, variables y SQL); la Tarea 3 contra el uso en la calle (diagnóstico, staging y matriz).

**Files:**
- Modify: `README.md` — el párrafo que empieza con `**Leer el acelerómetro se puede, y está hecho.**` (hoy líneas 242–245); la viñeta `- Notificaciones push con VAPID, sin SDK, y detección de impacto en primer plano` (hoy línea 214); una sección nueva `## Modo viaje` entre el `---` que sigue a «…pie de la letra.» (hoy línea 267) y `## Estructura` (hoy línea 269); y el bloque de `lib/`, `docs/` y `scripts/` de «Estructura» (hoy líneas 290–299). Las líneas corren si F2 agregó su aviso más arriba: todo se ubica por contenido.
- Test: una comprobación del README que se corre con `node` desde la raíz (en el paso 1) y `EXPLAIN` de las consultas contra la base descartable del e2e (paso 7).

**Interfaces:**
- Consumes (sólo como texto que tiene que ser verdad):
  - reglas de detección de §2.2–§2.7 tal como las implementan `evaluarEpisodio` (`lib/impacto.ts`, F2) y `crearDetector` (`lib/conduccion.ts`, F2);
  - la tabla «Rangos, omisiones y variables de `Umbrales`» del índice (F2) y las variables de `configuracionModoViaje` (F1): `MODO_VIAJE_ALERTA`, `MODO_VIAJE_CAIDA_SIN_GOLPE`, `MODO_VIAJE_MOTOR_MINIMO`, `TELEMETRIA_DIAS_CONSERVACION`, más `PROXY_SALTOS_CONFIABLES` (`ipDelCliente`, F1);
  - columnas de `telemetria` (existentes: `id`, `ts`, `nivel`, `pico_g`, `respuesta`, `gps`; de F1: `id_cliente`, `alerta_mostrada`, `version_motor`, `plataforma`, `standalone`, `hubo_choque`, `sonido`, `gps_precision_m`, `aceleracion_derivada`, `umbrales`, `umbrales_cliente`, `nivel_cliente`) y de `eventos_conduccion` (F1: `tipo`, `pico_g`, `recibido_en`), con la regla de fusión que pone `gps` en NULL cuando `hubo_choque` queda en false y conserva `gps_precision_m`;
  - `GET /api/salud` con `modo_viaje.problemas` (F2), `GET /api/telemetria/configuracion` (F1), la sección `[V4]` de `scripts/prueba-viaje.mjs` y `correr(…, { umbrales = UMBRALES })` del banco (F2).
- Produces: el ancla `#modo-viaje` y las subsecciones `### Lo que el detector hace de verdad`, `### Límites que se declaran`, `### Variables`, `### Cambiar un umbral` y `### Consultas de calibración` (la Tarea 3 agrega las suyas a continuación de la última).

- [ ] **Step 1: Escribir la comprobación del README y ver que falla**

Desde la raíz del repositorio, en Git Bash:

````bash
node --input-type=module - <<'FIN'
import { readFileSync } from 'node:fs'

let fallos = 0
function verificar(nombre, condicion) {
  if (condicion) console.log(`  ok   ${nombre}`)
  else {
    fallos++
    console.log(`  FALLA ${nombre}`)
  }
}

// El árbol de trabajo tiene CRLF (core.autocrlf): se normaliza antes de buscar.
const r = readFileSync('README.md', 'utf8').replace(/\r\n/g, '\n')
const inicio = r.indexOf('\n## Modo viaje\n')
const fin = r.indexOf('\n## Estructura\n')
const seccion = inicio >= 0 && fin > inicio ? r.slice(inicio, fin) : ''
const sub = (titulo) => {
  const i = seccion.indexOf(`\n### ${titulo}\n`)
  if (i < 0) return ''
  const j = seccion.indexOf('\n### ', i + 1)
  return seccion.slice(i, j < 0 ? seccion.length : j)
}
const bloquesSql = (texto) => [...texto.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1])

verificar('el README ya no dice que el detector cruza el pico con el giróscopo', !r.includes('cruza el pico de aceleración'))
verificar('la sección Modo viaje está antes de Estructura', seccion !== '')
for (const t of ['Lo que el detector hace de verdad', 'Límites que se declaran', 'Variables', 'Cambiar un umbral', 'Consultas de calibración']) {
  verificar(`existe la subsección ${t}`, sub(t) !== '')
}
for (const t of [
  'Sólo con la aplicación abierta, a la vista y la pantalla encendida.',
  'No detecta golpes leves ni choques con el auto detenido.',
  'No llama ni le avisa a nadie por su cuenta.',
  'En iPhone no vibra',
  'iOS anterior a 18.4, la pantalla se puede apagar sola.',
]) {
  verificar(`el límite «${t}» está declarado`, sub('Límites que se declaran').includes(t))
}
const VARIABLES = [
  'IMPACTO_UMBRAL_SOSPECHA_G', 'IMPACTO_UMBRAL_CONFIRMADO_G', 'IMPACTO_MS_SOBRE_UMBRAL', 'IMPACTO_VELOCIDAD_PREVIA_KMH',
  'IMPACTO_VELOCIDAD_PREVIA_CAIDA_KMH', 'IMPACTO_VELOCIDAD_POSTERIOR_KMH', 'IMPACTO_VENTANA_POST_MS', 'IMPACTO_TOPE_EPISODIO_MS',
  'IMPACTO_GIRO_DPS', 'IMPACTO_GIRO_MANIPULACION_DPS', 'IMPACTO_DESACELERACION_IMPOSIBLE_G', 'CONDUCCION_FRENADA_G',
  'CONDUCCION_ACELERACION_G', 'CONDUCCION_RETRASO_MIN_MS', 'CONDUCCION_RETRASO_MAX_MS', 'MODO_VIAJE_ALERTA',
  'MODO_VIAJE_CAIDA_SIN_GOLPE', 'MODO_VIAJE_MOTOR_MINIMO', 'TELEMETRIA_DIAS_CONSERVACION', 'PROXY_SALTOS_CONFIABLES',
]
const tablaVariables = sub('Variables')
verificar('las 20 variables del modo viaje tienen su fila', VARIABLES.every((v) => tablaVariables.includes('| `' + v + '` |')))
const consultas = bloquesSql(sub('Consultas de calibración'))
verificar('hay exactamente tres consultas de calibración', consultas.length === 3)
verificar('la consulta 1 agrupa por version_motor y plataforma', /GROUP BY version_motor, plataforma/.test(consultas[0] ?? ''))
verificar('la consulta 2 reparte pico_g por nivel', /pico_g/.test(consultas[1] ?? '') && /nivel AS clase/.test(consultas[1] ?? ''))
verificar('la consulta 3 cuenta alertas sin GPS y sin sonido', /gps_precision_m IS NULL/.test(consultas[2] ?? '') && /sonido IS FALSE/.test(consultas[2] ?? ''))

console.log(fallos === 0 ? 'README en orden.' : `${fallos} FALLARON`)
process.exit(fallos === 0 ? 0 : 1)
FIN
````

Esperado FALLA: la primera línea es `  FALLA el README ya no dice que el detector cruza el pico con el giróscopo`, le siguen otras 16 líneas `  FALLA …` (ninguna `ok`), la última es `17 FALLARON` y el código de salida es 1 (`echo $?` imprime `1`).

- [ ] **Step 2: Corregir el párrafo que dice que el detector cruza con el giróscopo**

En `README.md`, dentro de «Lo que una aplicación web NO puede hacer, y hay que decirlo», reemplazar exactamente estas cuatro líneas:

Antes:

````markdown
**Leer el acelerómetro se puede, y está hecho.** El detector cruza el pico de aceleración
con la caída de velocidad del GPS y con el giróscopo, descarta la caída libre previa (el
teléfono que se cae del soporte da entre 10 y 30 g, más que muchos choques) y descarta el
pico aislado (un pozo). Corre con lógica pura y se prueba con series sintéticas.
````

Después:

````markdown
**Leer el acelerómetro se puede, y está hecho.** Pero el detector no «cruza con el
giróscopo»: el giróscopo no confirma ningún choque. Lo que decide es el contexto del
vehículo —si iba andando y si quedó detenido después del golpe, según el GPS— y la forma del
golpe: que se sostenga unas decenas de milisegundos (un pozo da uno o dos picos sueltos), que
el teléfono no haya girado ni caído antes del pico (eso delata la mano o el teléfono que se
cae del soporte) y que la sacudida no viniera de antes. Corre con lógica pura, la misma en el
teléfono y en el servidor, y se prueba con un banco de simulación. El detalle está en
[Modo viaje](#modo-viaje).
````

- [ ] **Step 3: Actualizar la viñeta de «Funciona»**

Antes:

````markdown
- Notificaciones push con VAPID, sin SDK, y detección de impacto en primer plano
````

Después:

````markdown
- Notificaciones push con VAPID, sin SDK
- Modo viaje de un toque desde el inicio: detección de choques con la aplicación abierta,
  alerta desde cualquier pantalla y ayuda aun sin señal
````

- [ ] **Step 4: Insertar la sección «Modo viaje»**

Ubicar el final de la sección de las limitaciones de la web y el comienzo de «Estructura». Hoy es:

````markdown
servidor. Esa sigue siendo la única forma de cumplir la sección 5 de la especificación al
pie de la letra.

---

## Estructura
````

Insertar, entre la línea `---` y la línea `## Estructura`, el bloque siguiente seguido de una línea en blanco, una línea `---` y otra línea en blanco (así la sección nueva queda separada por `---` de las dos vecinas, como el resto del README). El resultado alrededor de los bordes es:

````markdown
pie de la letra.

---

## Modo viaje
…
web: esta consulta no la ve. `sin_giroscopo`: la aceleración fue derivada.

---

## Estructura
````

Bloque a insertar, completo:

````markdown
## Modo viaje

Se enciende con un toque desde la tarjeta del inicio y, mientras la aplicación está abierta,
escucha el acelerómetro y el GPS en todas las pantallas; en el recorrido de una actuación
(`/s/…`) queda en pausa. Si detecta un posible choque abre una alerta de pantalla completa,
desde cualquier pantalla, con 30 segundos de cuenta, tono y vibración. Si la persona pide
ayuda o no responde, le deja a un toque los teléfonos de emergencia, su contacto de confianza,
compartir la ubicación y el registro del accidente, también sin señal. **No llama ni le avisa
a nadie por su cuenta.**

### Lo que el detector hace de verdad

Todo lo que decide si hay alerta es lógica pura: `lib/conduccion.ts` arma los episodios en el
teléfono y `evaluarEpisodio` (`lib/impacto.ts`) decide el nivel. El servidor repite
`evaluarEpisodio` sobre la serie que recibe, con sus propios umbrales: `telemetria.nivel` es el
nivel del servidor y `telemetria.nivel_cliente`, el del teléfono. `llamar_emergencias` es el
literal `false` en el tipo del veredicto: ninguna regla puede marcar el 107 por la persona.

Los números de abajo son los valores por omisión; todos se cambian con una variable
(ver [Variables](#variables)).

1. **Fuente de aceleración.** Con giróscopo, el navegador entrega la aceleración sin gravedad y
   se usa tal cual. Sin giróscopo, esa lectura viene suavizada y se come el pulso de un choque:
   se deriva de la aceleración con gravedad, no se abren episodios hasta que la gravedad
   estimada se estabiliza y la hoja avisa «Sensor sin giróscopo: detección menos precisa».
2. **Episodio.** Lo abre una muestra de 4 g o más, o una caída de velocidad del GPS desde
   30 km/h o más hasta 8 km/h o menos. Cierra 8 segundos después del último golpe, con un tope
   de 15. Los golpes separados por más de 300 ms se evalúan cada uno por su cuenta y el
   episodio toma el nivel más alto.
3. **La forma del golpe.**
   - *Sostenido:* la sacudida por encima de la mitad del umbral dura 30 ms o más. Un pozo da
     uno o dos picos sueltos.
   - *Manipulado:* el teléfono giró a 300 °/s o más, o estuvo en caída libre, **antes** del
     pico. Delata la mano o el teléfono que se cae del soporte: en un choque, el teléfono gira
     después.
   - *Sacudida:* ya había dos lóbulos de 2 g o más en el segundo y medio anterior al pico.
4. **El contexto del vehículo.** El GPS llega atrasado: cada fix se sella al llegar y se
   corrige por su edad, así que la velocidad se compara con el golpe en la misma base de
   tiempo. Con eso se sabe si iba andando (15 km/h o más), si quedó detenido (8 km/h o menos
   en los 8 segundos siguientes, con posiciones que no lo contradigan) o si siguió andando.
5. **El nivel.** Gana la primera fila que aplica:

   | Qué pasó | Nivel |
   | --- | --- |
   | Con velocidad, el auto iba a menos de 10 km/h antes del golpe | nada (límite declarado) |
   | Golpe sostenido, iba andando y quedó detenido | confirmado; sospecha si hubo manipulación |
   | Golpe sostenido sin manipulación, iba andando y siguió andando | nada, y un `golpe_en_marcha` en silencio |
   | Golpe sostenido sin manipulación e iba andando, sin que quede claro si se detuvo o siguió andando | sospecha |
   | Entre 10 y 15 km/h, golpe sostenido de 8 g o más, sin manipulación ni sacudida | sospecha |
   | Sin velocidad, golpe sostenido sin manipulación ni sacudida | sospecha: sin GPS nunca es confirmado |
   | Se detuvo desde 30 km/h o más sin golpe y, con giróscopo, con una desaceleración media de 1,4 g que ninguna frenada alcanza | `caida_silenciosa` en silencio; sospecha sólo con `MODO_VIAJE_CAIDA_SIN_GOLPE=alerta` y giróscopo |
   | Ninguna de las anteriores | nada |

   Confirmado no depende del tamaño del pico: muchos Android miden hasta 4 g y saturan.
6. **Seguimiento del golpe en marcha.** Durante los 90 segundos siguientes, si el auto queda a
   8 km/h o menos durante 10 segundos, se pierde el GPS o hay un hueco de detección, se abre
   la alerta con «Detectamos un golpe hace N segundos». Sólo se descarta si el GPS muestra
   20 km/h o más hasta el final.
7. **Frenadas y aceleraciones.** Una frenada de 0,45 g o más, o una aceleración de 0,40 g o
   más, desde 20 km/h y confirmada por el GPS, se guarda en silencio en `eventos_conduccion`,
   sin cuenta y sin ubicación. Si coincide con un episodio de impacto, no se guarda aparte. En
   esta etapa sólo sirven para calibrar.
8. **La alerta.** Un episodio `sospecha` o `confirmado`, o el seguimiento, abre la alerta. Con
   `MODO_VIAJE_ALERTA=silenciosa` se registra igual pero no se muestra
   (`alerta_mostrada = false`).

Lo que **no** hace: no detecta nada con la pantalla bloqueada ni con la aplicación en segundo
plano; no ve golpes por debajo de 4 g; no reconoce un choque con el auto detenido (un alcance
trasero en un semáforo da `nada`); el giróscopo no confirma un choque, sólo delata la
manipulación; y no llama ni avisa a nadie.

### Límites que se declaran

Son los mismos que dice la hoja del modo viaje:

- Sólo con la aplicación abierta, a la vista y la pantalla encendida.
- No detecta golpes leves ni choques con el auto detenido.
- No llama ni le avisa a nadie por su cuenta.
- En iPhone no vibra; con el iPhone en silencio, que el tono suene depende de la versión de
  iOS (`navigator.audioSession`).
- Con la aplicación instalada en iOS anterior a 18.4, la pantalla se puede apagar sola.

### Variables

Todas son opcionales. Los umbrales (`IMPACTO_*` y `CONDUCCION_*`) que no son un número o
quedan fuera de rango se reemplazan por su omisión: se escribe una vez en el log y lo informa
`GET /api/salud` en `modo_viaje.problemas`, sin cambiar el `ok` general. Las demás, si son
inválidas, usan su omisión y se escriben una vez en el log. El teléfono recibe los umbrales
del servidor con `GET /api/telemetria/configuracion`: cambiar una variable cambia lo que decide
el teléfono y lo que recalcula el servidor.

| Variable | Omisión | Rango | Para qué |
| --- | --- | --- | --- |
| `IMPACTO_UMBRAL_SOSPECHA_G` | 4 | 2 a 20 | Abre un episodio. Es un disparador, no un veredicto: por debajo, un pozo con un soporte que resuena abre episodios todo el tiempo |
| `IMPACTO_UMBRAL_CONFIRMADO_G` | 8 | 2 a 50, y ≥ sospecha | Sólo decide con el auto casi quieto (10 a 15 km/h) |
| `IMPACTO_MS_SOBRE_UMBRAL` | 30 | 5 a 500 | Un pozo da uno o dos picos; un choque sostiene la sacudida decenas de ms |
| `IMPACTO_VELOCIDAD_PREVIA_KMH` | 15 | 5 a 60 | Desde cuánto «iba andando». Con 30 se perdían los choques saliendo de un semáforo: si el servicio tiene 30 copiado del `.env.example` viejo, bajalo |
| `IMPACTO_VELOCIDAD_PREVIA_CAIDA_KMH` | 30 | 15 a 150 | Desde cuánto una detención sin golpe cuenta como caída |
| `IMPACTO_VELOCIDAD_POSTERIOR_KMH` | 8 | 0 a 30, y < previa | Hasta cuánto es «detenido»: el GPS parado oscila ±3–5 km/h |
| `IMPACTO_VENTANA_POST_MS` | 8000 | 3000 a 15000 | Cuánto se espera después del último golpe: el GPS llega 1 a 3 s atrasado |
| `IMPACTO_TOPE_EPISODIO_MS` | 15000 | 5000 a 60000, y ≥ ventana | Un vuelco entra; más largo, un camino de ripio sería un solo episodio |
| `IMPACTO_GIRO_DPS` | 180 | 30 a 2000 | Giro brusco: se guarda como dato, no decide |
| `IMPACTO_GIRO_MANIPULACION_DPS` | 300 | 100 a 2000 | Giro antes del golpe que delata la mano |
| `IMPACTO_DESACELERACION_IMPOSIBLE_G` | 1.4 | 1.0 a 4.0, y < sospecha | Una frenada con ABS llega a 1,1 g |
| `CONDUCCION_FRENADA_G` | 0.45 | 0.2 a 1.0 | 0,30 a 0,35 g es manejo normal en ciudad |
| `CONDUCCION_ACELERACION_G` | 0.40 | 0.2 a 1.0 | Arranque brusco |
| `CONDUCCION_RETRASO_MIN_MS` | 0 | 0 a 5000 | Retraso mínimo del GPS respecto del acelerómetro |
| `CONDUCCION_RETRASO_MAX_MS` | 3000 | 0 a 10000, y ≥ mínimo | Retraso máximo del GPS respecto del acelerómetro |
| `MODO_VIAJE_ALERTA` | `normal` | `normal`, `silenciosa`, `apagada` | `silenciosa` detecta y registra sin mostrar alertas; `apagada` apaga los modos encendidos y la tarjeta dice «El modo viaje no está disponible por ahora» |
| `MODO_VIAJE_CAIDA_SIN_GOLPE` | `silenciosa` | `alerta`, `silenciosa` | Si una detención sin golpe que ninguna frenada explica abre la alerta. Queda en `silenciosa` hasta calibrar |
| `MODO_VIAJE_MOTOR_MINIMO` | 1 | entero ≥ 1 | Un teléfono con un motor más viejo no alerta y pide cerrar y volver a abrir la aplicación |
| `TELEMETRIA_DIAS_CONSERVACION` | 90 | entero ≥ 1 | Días que se guardan las alertas no vinculadas a una actuación y los eventos de conducción. Provisional: el plazo lo fija el abogado |
| `PROXY_SALTOS_CONFIABLES` | 1 | entero ≥ 0 | Cuántos proxies propios agregan `x-forwarded-for` antes de la aplicación; con 0 no se limita por IP |

`IMPACTO_VENTANA_CAIDA_MS` ya no se usa (la reemplaza `IMPACTO_VENTANA_POST_MS`) y
`TELEMETRIA_MAX_MUESTRAS` ya no existe: si siguen cargadas en el servicio, se borran.

### Cambiar un umbral

1. Probar el valor nuevo contra el banco de simulación. El banco evalúa con `UMBRALES`, que
   se lee del entorno al importar, así que la variable se le pasa igual que al servidor:

   ```bash
   IMPACTO_UMBRAL_SOSPECHA_G=3.5 SECCION=V4 npx tsx scripts/prueba-viaje.mjs
   ```

   Tiene que terminar en `Todo en orden.`: los choques simulados siguen alertando y los pozos,
   sacudidas y caídas del soporte siguen sin alertar, con las tasas que exige el diseño.
2. Cargar la variable en el servicio y reiniciarlo. `GET /api/salud` tiene que traer
   `"modo_viaje": { "ok": true, … }`; si no, `problemas` dice qué campo se rechazó y por qué.
3. `GET /api/telemetria/configuracion` devuelve otra `version`. Los teléfonos la toman al
   encender, al volver a la aplicación y cada 10 minutos.
4. Cada alerta guarda los umbrales con que la evaluó el servidor (`telemetria.umbrales`) y los
   del teléfono (`telemetria.umbrales_cliente`): para comparar antes y después, agregar
   `umbrales->>'sospechaG'` al `GROUP BY` de las consultas de abajo.
5. Si algo sale mal en la calle: `MODO_VIAJE_ALERTA=silenciosa` deja de mostrar alertas sin
   dejar de registrar, y `apagada` apaga el modo viaje en los teléfonos que lo tienen abierto
   en 10 minutos como máximo.

### Consultas de calibración

Se corren contra la base de producción, con un usuario de sólo lectura. Miran los últimos 30
días (la telemetría no vinculada se borra a los `TELEMETRIA_DIAS_CONSERVACION` días) y sólo las
alertas del motor nuevo (`id_cliente IS NOT NULL`): las filas del detector anterior no tienen
versión, plataforma ni respuestas.

#### 1. Estoy bien y falsas alarmas, por versión del motor y plataforma

```sql
SELECT version_motor,
       plataforma,
       count(*)::int                                                 AS alertas_mostradas,
       count(*) FILTER (WHERE respuesta = 'estoy_bien')::int         AS estoy_bien,
       round(avg(coalesce(respuesta = 'estoy_bien', false)::int), 3) AS tasa_estoy_bien,
       count(*) FILTER (WHERE hubo_choque = false)::int              AS falsa_alarma,
       round(avg(coalesce(hubo_choque = false, false)::int), 3)      AS tasa_falsa_alarma,
       count(*) FILTER (WHERE hubo_choque = true)::int               AS hubo_choque_si,
       count(*) FILTER (WHERE respuesta IS NULL OR respuesta = 'sin_respuesta')::int AS sin_respuesta_humana
FROM telemetria
WHERE id_cliente IS NOT NULL
  AND alerta_mostrada IS TRUE
  AND ts >= now() - interval '30 days'
GROUP BY version_motor, plataforma
ORDER BY version_motor DESC, plataforma;
```

Cómo se lee: `tasa_estoy_bien` es la parte de las alertas mostradas en que lo último que tocó la
persona fue «Estoy bien»; `tasa_falsa_alarma`, la parte en que dijo que no hubo choque (en
«¿Hubo un choque?», en la ayuda o sobre el golpe pendiente). Una tasa de falsa alarma que sube de
una versión a la siguiente es una regresión del detector, no del uso. Un `sin_respuesta_humana`
alto en una plataforma dice que ahí la alerta no se nota: cruzarlo con la consulta 3.

#### 2. Distribución del pico por nivel

```sql
WITH picos AS (
  SELECT nivel AS clase,
         pico_g,
         coalesce(respuesta = 'estoy_bien' OR hubo_choque = false, false) AS descartada
  FROM telemetria
  WHERE id_cliente IS NOT NULL
    AND pico_g IS NOT NULL
    AND ts >= now() - interval '30 days'
  UNION ALL
  SELECT tipo, pico_g, false
  FROM eventos_conduccion
  WHERE tipo IN ('golpe_en_marcha', 'caida_silenciosa')
    AND pico_g IS NOT NULL
    AND recibido_en >= now() - interval '30 days'
)
SELECT clase,
       least(floor(pico_g / 2)::int, 8) * 2                                  AS desde_g,
       count(*)::int                                                         AS cantidad,
       round(100.0 * count(*) / sum(count(*)) OVER (PARTITION BY clase), 1) AS porcentaje_de_la_clase,
       count(*) FILTER (WHERE descartada)::int                               AS descartadas_por_la_persona
FROM picos
GROUP BY clase, desde_g
ORDER BY CASE clase WHEN 'confirmado' THEN 1 WHEN 'sospecha' THEN 2 WHEN 'nada' THEN 3 WHEN 'golpe_en_marcha' THEN 4 ELSE 5 END,
         desde_g;
```

Cómo se lee: `clase` es el nivel de la alerta según el servidor, o `golpe_en_marcha` y
`caida_silenciosa` para lo que se registró en silencio. `desde_g` es el comienzo de una franja de
2 g (`16` junta todo lo de 16 g o más). Si las `sospecha` descartadas por la persona se amontonan
en la franja del umbral de sospecha, subirlo saca falsas alarmas; si los `golpe_en_marcha` llegan
a las franjas de los `confirmado`, lo que separa un choque de un pozo es la velocidad, y subir el
umbral no ayuda. Un amontonamiento en la franja de 4 g en Android es un sensor que satura, no la
forma real del golpe.

#### 3. Alertas sin GPS y sin sonido

```sql
SELECT plataforma,
       standalone,
       version_motor,
       count(*)::int                                                            AS alertas_mostradas,
       count(*) FILTER (WHERE gps_precision_m IS NULL)::int                     AS sin_gps,
       count(*) FILTER (WHERE gps_precision_m > 50)::int                        AS gps_impreciso,
       count(*) FILTER (WHERE sonido IS FALSE)::int                             AS sin_sonido,
       count(*) FILTER (WHERE sonido IS NULL)::int                              AS sonido_sin_dato,
       count(*) FILTER (WHERE gps_precision_m IS NULL AND sonido IS FALSE)::int AS sin_gps_ni_sonido,
       count(*) FILTER (WHERE aceleracion_derivada IS TRUE)::int                AS sin_giroscopo
FROM telemetria
WHERE id_cliente IS NOT NULL
  AND alerta_mostrada IS TRUE
  AND ts >= now() - interval '30 days'
GROUP BY plataforma, standalone, version_motor
ORDER BY alertas_mostradas DESC, plataforma;
```

Cómo se lee: `sin_gps` cuenta las alertas que nunca tuvieron ubicación (permiso negado o sin
fix): se decidieron sin velocidad y como mucho llegaron a sospecha. Se mira `gps_precision_m` y
no `gps` porque `gps` se borra cuando la persona dice que no hubo choque. `gps_impreciso`: la
precisión fue peor que 50 m. `sin_sonido`: el audio no había arrancado a los 500 ms de abrir la
alerta, casi siempre porque nadie tocó la pantalla desde que se abrió la aplicación;
`sonido_sin_dato`: no se llegó a saber. La llave de silencio del iPhone no se puede medir desde la
web: esta consulta no la ve. `sin_giroscopo`: la aceleración fue derivada.
````

- [ ] **Step 5: Sumar los archivos del modo viaje a «Estructura»**

Antes:

````markdown
  db.ts                  Postgres y esquema
  almacenamiento.ts      archivos en el volumen
  local.ts               qué actuación quedó abierta en este teléfono
docs/
  CONTRATO-UI.md         qué puede tocar un agente visual y qué no
  MAPA-PANTALLAS.md      de cada pantalla del mockup al archivo que la dibuja
scripts/
  prueba-logica.mjs      pruebas sin base de datos
  prueba-contrato.mjs    el contrato de interfaz
  prueba-e2e.mjs         circuito completo contra un servidor levantado
````

Después:

````markdown
  db.ts                  Postgres y esquema
  almacenamiento.ts      archivos en el volumen
  local.ts               qué actuación quedó abierta en este teléfono
  impacto.ts             reglas del veredicto de un golpe, las mismas en el teléfono y el servidor
  conduccion.ts          velocidad, episodios, seguimiento y maniobras del viaje en curso
  transporte-viaje.ts    formato compacto y validación de lo que manda el teléfono
  viaje.ts               el motor del modo viaje: sensores, alertas y estado
  cola-viaje.ts          alertas y eventos del modo viaje que esperan señal
  telemetria.ts          servidor de la telemetría: posesión, fusión, respuestas y borrado
docs/
  CONTRATO-UI.md         qué puede tocar un agente visual y qué no
  MAPA-PANTALLAS.md      de cada pantalla del mockup al archivo que la dibuja
scripts/
  prueba-logica.mjs      pruebas sin base de datos
  prueba-viaje.mjs       pruebas del modo viaje: servidor, detección, banco, cola y motor
  banco-impacto.mjs      banco de simulación de choques, pozos, sacudidas y frenadas
  fuentes-falsas.mjs     navegador, reloj y servidor falsos para probar el motor en Node
  prueba-contrato.mjs    el contrato de interfaz
  prueba-e2e.mjs         circuito completo contra un servidor levantado
````

(los nombres quedan alineados en la columna 25, como las líneas que ya estaban; `app/components/ModoViaje.tsx` no se agrega porque la lista de `app/` sólo nombra carpetas de rutas).

- [ ] **Step 6: Correr la comprobación del README y ver que pasa**

Correr otra vez exactamente el comando del paso 1.

Esperado PASA: 17 líneas que empiezan con `  ok   `, la última línea es `README en orden.` y el código de salida es 0.

- [ ] **Step 7: Validar las consultas contra el esquema real**

Hace falta una base descartable con el esquema de F1 ya aplicado: la del e2e, con `E2E_DATABASE_URL` (y `E2E_DATABASE_SSL=true` si la base lo pide) exportada en esta terminal igual que para `npm run e2e`. Nunca la base del `.env`. Arrancar el servidor no alcanza: `SCHEMA` se aplica recién en el primer pedido que usa la base (`asegurarEsquema()` desde `db()`, `lib/db.ts`, bloque «Crea el esquema si no existe»). Por eso, antes del comando, con el servidor que usa esa base levantado (código de F1 o posterior), pedirle la salud una vez:

```bash
curl -s "${BASE_URL:-http://localhost:3000}/api/salud"
```

Esperado: un JSON cuya parte de base dice `Base conectada y esquema creado.`. Correr `npm run e2e` contra ese servidor también sirve. El comando de abajo lo comprueba igual antes de los `EXPLAIN` y no lee ninguna otra variable:

````bash
node --input-type=module - <<'FIN'
import pg from 'pg'
import { readFileSync } from 'node:fs'

// Como el e2e: nunca .env ni DATABASE_URL, sólo la base descartable con el esquema ya aplicado.
const url = process.env.E2E_DATABASE_URL
if (!url) {
  console.log('  salta consultas del modo viaje en el README (falta E2E_DATABASE_URL)')
  process.exit(0)
}
const readme = readFileSync('README.md', 'utf8').replace(/\r\n/g, '\n')
const desde = readme.indexOf('\n## Modo viaje\n')
const hasta = readme.indexOf('\n## Estructura\n')
const bloques = [...readme.slice(desde, hasta).matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1].trim().replace(/;$/, ''))
const cliente = new pg.Client({ connectionString: url, ssl: process.env.E2E_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined })
await cliente.connect()
// SCHEMA se aplica en el primer pedido que usa la base, no al arrancar el servidor: sin este
// control, una base que nadie usó desde F1 haría creer que las consultas están mal escritas.
const esquemaF1 = await cliente.query(
  `SELECT
     EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'telemetria' AND column_name = 'apertura') AS columnas,
     to_regclass('public.telemetria_episodios') IS NOT NULL AS episodios,
     to_regclass('public.eventos_conduccion') IS NOT NULL AS conduccion`,
)
const { columnas, episodios, conduccion } = esquemaF1.rows[0]
if (!columnas || !episodios || !conduccion) {
  await cliente.end()
  console.log('  FALLA la base no tiene el esquema de F1: pedí /api/salud al servidor que usa E2E_DATABASE_URL y volvé a correr esto (no se toca ninguna consulta)')
  process.exit(1)
}
let fallos = 0
for (const [i, sql] of bloques.entries()) {
  try {
    // EXPLAIN valida nombres de tablas, columnas y tipos sin leer ni escribir filas.
    await cliente.query('EXPLAIN ' + sql)
    console.log(`  ok   consulta ${i + 1} del modo viaje en el README`)
  } catch (err) {
    fallos++
    console.log(`  FALLA consulta ${i + 1} del modo viaje en el README: ${err.message}`)
  }
}
await cliente.end()
console.log(`${bloques.length} consultas, ${fallos} con error`)
process.exit(fallos === 0 ? 0 : 1)
FIN
````

Esperado PASA: `  ok   consulta 1 del modo viaje en el README`, `  ok   consulta 2 …`, `  ok   consulta 3 …`, la línea `3 consultas, 0 con error` y código de salida 0. Un `  FALLA la base no tiene el esquema de F1: …` quiere decir que a esa base todavía no le llegó ningún pedido con el código de F1: se hace el `curl` de arriba y se repite, sin tocar consultas. Pasado ese control, un `FALLA` con `column "…" does not exist` quiere decir que una columna no coincide con el `SCHEMA` de `lib/db.ts`: se corrige la consulta, no el esquema. Sin `E2E_DATABASE_URL` el comando imprime `  salta consultas del modo viaje en el README (falta E2E_DATABASE_URL)` y sale con 0: en ese caso se anota en el reporte de la tarea que las consultas no se validaron contra una base (este plan las validó al escribirse contra el `SCHEMA` actual más el bloque de F1 del índice, con datos de ejemplo).

- [ ] **Step 8: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, `npm run tipos` sin salida y `Todo en orden.` al final (el README no entra en ninguna de las tres, pero la regla es correrlas antes de cada commit).

- [ ] **Step 9: Commit**

```bash
git add "README.md"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Explicar en el README lo que el detector hace de verdad y cómo calibrarlo

El README decía que el detector cruzaba el pico con el giróscopo, y nunca fue así:
lo que separa un choque de un pozo es el contexto del vehículo y la forma del golpe,
y el giróscopo sólo delata la manipulación. Quien ajuste un umbral en producción
tiene que saber qué mueve.

Se suman los límites que se declaran, las veinte variables con su rango y su
motivo, cómo cambiar un umbral probándolo antes contra el banco, y las tres
consultas de calibración: estoy bien y falsas alarmas por versión y plataforma,
distribución del pico por nivel, y alertas sin GPS y sin sonido. Las alertas sin
GPS se cuentan por gps_precision_m porque gps se borra cuando la persona dice que
no hubo choque.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: README — diagnóstico, staging y matriz de prueba en dispositivo

Índice F6.2, segunda mitad: procedimiento de staging y matriz de §6.5 con la fila 17.

**Files:**
- Modify: `README.md` — insertar tres subsecciones al final de la sección `## Modo viaje`, inmediatamente después del párrafo que termina en ``web: esta consulta no la ve. `sin_giroscopo`: la aceleración fue derivada.`` (el último de la Tarea 2) y antes de la línea en blanco y el `---` que preceden a `## Estructura`.
- Test: la comprobación del README de la Tarea 2 ampliada (paso 1) y `EXPLAIN` de las dos consultas nuevas (paso 4).

**Interfaces:**
- Consumes:
  - la sección «Diagnóstico» de la hoja (Tarea 1) y la clave `acta:diagnostico` («Almacenamiento del cliente» del índice: cuenta la presencia);
  - los textos `tarjeta.inseguro` («Abrí la aplicación desde su dirección https»), la tabla de rangos de `Umbrales` (mínimos `sospechaG` 2 y `msSobreUmbral` 5; relaciones `confirmadoG ≥ sospechaG` y `desaceleracionImposibleG < sospechaG`), las filas 1, 2 y 7 de §2.5 y `ventanaPostMs` de 8000;
  - `GET /api/salud` (`modo_viaje.ok`, `problemas`), `GET /api/telemetria/configuracion` (`umbrales.sospechaG`, `umbrales.msSobreUmbral`), «Borrar mis registros del modo viaje» (`hoja.borrar`);
  - columnas `telemetria.recibido_en`, `apertura`, `nivel_cliente`, `veredicto` (con `motivo`), `eventos_conduccion.ocurrido_en_telefono`, `kmh_inicial`, `kmh_final`, `duracion_ms`, `g_estimada`, `plataforma`;
  - la matriz de §6.5 del diseño, filas 1 a 17, copiada tal cual.
- Produces: subsecciones `### Diagnóstico en el teléfono`, `### Staging` y `### Prueba en dispositivo`.

- [ ] **Step 1: Ampliar la comprobación del README y ver que falla**

Desde la raíz:

````bash
node --input-type=module - <<'FIN'
import { readFileSync } from 'node:fs'

let fallos = 0
function verificar(nombre, condicion) {
  if (condicion) console.log(`  ok   ${nombre}`)
  else {
    fallos++
    console.log(`  FALLA ${nombre}`)
  }
}

// El árbol de trabajo tiene CRLF (core.autocrlf): se normaliza antes de buscar.
const r = readFileSync('README.md', 'utf8').replace(/\r\n/g, '\n')
const inicio = r.indexOf('\n## Modo viaje\n')
const fin = r.indexOf('\n## Estructura\n')
const seccion = inicio >= 0 && fin > inicio ? r.slice(inicio, fin) : ''
const sub = (titulo) => {
  const i = seccion.indexOf(`\n### ${titulo}\n`)
  if (i < 0) return ''
  const j = seccion.indexOf('\n### ', i + 1)
  return seccion.slice(i, j < 0 ? seccion.length : j)
}
const bloquesSql = (texto) => [...texto.matchAll(/```sql\n([\s\S]*?)```/g)].map((m) => m[1])

verificar('el README ya no dice que el detector cruza el pico con el giróscopo', !r.includes('cruza el pico de aceleración'))
verificar('la sección Modo viaje está antes de Estructura', seccion !== '')
for (const t of ['Lo que el detector hace de verdad', 'Límites que se declaran', 'Variables', 'Cambiar un umbral', 'Consultas de calibración']) {
  verificar(`existe la subsección ${t}`, sub(t) !== '')
}
for (const t of [
  'Sólo con la aplicación abierta, a la vista y la pantalla encendida.',
  'No detecta golpes leves ni choques con el auto detenido.',
  'No llama ni le avisa a nadie por su cuenta.',
  'En iPhone no vibra',
  'iOS anterior a 18.4, la pantalla se puede apagar sola.',
]) {
  verificar(`el límite «${t}» está declarado`, sub('Límites que se declaran').includes(t))
}
const VARIABLES = [
  'IMPACTO_UMBRAL_SOSPECHA_G', 'IMPACTO_UMBRAL_CONFIRMADO_G', 'IMPACTO_MS_SOBRE_UMBRAL', 'IMPACTO_VELOCIDAD_PREVIA_KMH',
  'IMPACTO_VELOCIDAD_PREVIA_CAIDA_KMH', 'IMPACTO_VELOCIDAD_POSTERIOR_KMH', 'IMPACTO_VENTANA_POST_MS', 'IMPACTO_TOPE_EPISODIO_MS',
  'IMPACTO_GIRO_DPS', 'IMPACTO_GIRO_MANIPULACION_DPS', 'IMPACTO_DESACELERACION_IMPOSIBLE_G', 'CONDUCCION_FRENADA_G',
  'CONDUCCION_ACELERACION_G', 'CONDUCCION_RETRASO_MIN_MS', 'CONDUCCION_RETRASO_MAX_MS', 'MODO_VIAJE_ALERTA',
  'MODO_VIAJE_CAIDA_SIN_GOLPE', 'MODO_VIAJE_MOTOR_MINIMO', 'TELEMETRIA_DIAS_CONSERVACION', 'PROXY_SALTOS_CONFIABLES',
]
const tablaVariables = sub('Variables')
verificar('las 20 variables del modo viaje tienen su fila', VARIABLES.every((v) => tablaVariables.includes('| `' + v + '` |')))
const consultas = bloquesSql(sub('Consultas de calibración'))
verificar('hay exactamente tres consultas de calibración', consultas.length === 3)
verificar('la consulta 1 agrupa por version_motor y plataforma', /GROUP BY version_motor, plataforma/.test(consultas[0] ?? ''))
verificar('la consulta 2 reparte pico_g por nivel', /pico_g/.test(consultas[1] ?? '') && /nivel AS clase/.test(consultas[1] ?? ''))
verificar('la consulta 3 cuenta alertas sin GPS y sin sonido', /gps_precision_m IS NULL/.test(consultas[2] ?? '') && /sonido IS FALSE/.test(consultas[2] ?? ''))

// Tarea 3
for (const t of ['Diagnóstico en el teléfono', 'Staging', 'Prueba en dispositivo']) {
  verificar(`existe la subsección ${t}`, sub(t) !== '')
}
verificar('el diagnóstico explica cómo escribir la clave', sub('Diagnóstico en el teléfono').includes("localStorage.setItem('acta:diagnostico', 'si')"))
verificar('staging baja el umbral de sospecha a 2', sub('Staging').includes('| `IMPACTO_UMBRAL_SOSPECHA_G` | `2` |'))
verificar('staging tiene sus dos consultas de verificación', bloquesSql(sub('Staging')).length === 2)
const matriz = sub('Prueba en dispositivo')
verificar('la matriz tiene las filas 1 a 17 en orden', Array.from({ length: 17 }, (_, i) => matriz.indexOf(`\n| ${i + 1} | `)).every((p, i, a) => p >= 0 && (i === 0 || p > a[i - 1])))
verificar('la fila 17 es el manejo real de 60 minutos', matriz.includes('| 17 | 60 min de manejo real | Batería, temperatura, huecos y eventos anotados |'))

console.log(fallos === 0 ? 'README en orden.' : `${fallos} FALLARON`)
process.exit(fallos === 0 ? 0 : 1)
FIN
````

Esperado FALLA: las 17 comprobaciones de la Tarea 2 dan `  ok   `, y las 8 nuevas dan `  FALLA existe la subsección Diagnóstico en el teléfono`, `  FALLA existe la subsección Staging`, `  FALLA existe la subsección Prueba en dispositivo`, `  FALLA el diagnóstico explica cómo escribir la clave`, `  FALLA staging baja el umbral de sospecha a 2`, `  FALLA staging tiene sus dos consultas de verificación`, `  FALLA la matriz tiene las filas 1 a 17 en orden` y `  FALLA la fila 17 es el manejo real de 60 minutos`; la última línea es `8 FALLARON` y el código de salida es 1.

- [ ] **Step 2: Insertar «Diagnóstico en el teléfono», «Staging» y «Prueba en dispositivo»**

En `README.md`, ubicar la línea:

````markdown
web: esta consulta no la ve. `sin_giroscopo`: la aceleración fue derivada.
````

Inmediatamente después de esa línea, insertar una línea en blanco y el bloque siguiente, completo. Lo que venía después (la línea en blanco, `---` y `## Estructura`) queda igual, a continuación del bloque.

````markdown
### Diagnóstico en el teléfono

La hoja del modo viaje tiene una sección «Diagnóstico» que sólo aparece si en ese teléfono
existe la clave `acta:diagnostico` en `localStorage` (cuenta que exista, no su valor). Muestra la
aceleración en vivo, la frecuencia real del acelerómetro, la fuente, la velocidad y la precisión
del GPS, el estado de la pantalla y del audio, la configuración vigente con el umbral de
sospecha, y los últimos 20 episodios con su hora, su nivel, su pico y su motivo.

Un teléfono no tiene consola: la clave se escribe desde una computadora, con el teléfono
conectado por cable.

- **Android:** activar las opciones de desarrollador y la depuración USB, abrir
  `chrome://inspect` en Chrome de la computadora, elegir la pestaña (o la aplicación instalada)
  y, en su consola, `localStorage.setItem('acta:diagnostico', 'si')`.
- **iPhone:** activar Ajustes › Safari › Avanzado › Inspector web (en iOS 18, Ajustes › Apps ›
  Safari › Avanzado); en una Mac, Safari › Desarrollo › el iPhone › la página, y en su consola
  la misma línea. La aplicación instalada guarda su `localStorage` aparte del de Safari: hay que
  elegirla a ella, no la pestaña.

Después, recargar la página. Para sacarlo, `localStorage.removeItem('acta:diagnostico')` y
recargar.

### Staging

Para provocar la alerta sin chocar hace falta un entorno aparte con el umbral bajo. **Nunca en
producción:** las alertas de prueba ensucian las consultas de calibración.

1. **Un servicio aparte**, con su propio dominio (por ejemplo `staging.tu-dominio.com`), su propia
   base Postgres y su propio volumen, desplegado desde la misma rama que se va a probar. Con
   HTTPS y un certificado de confianza: por `http://192.168.x.x` el navegador no entrega
   sensores ni GPS, y la tarjeta dice «Abrí la aplicación desde su dirección https» (fila 16 de
   la matriz).
2. **Variables**, además de las de siempre (`DATABASE_URL` de la base de staging, `URL_PUBLICA`
   con el dominio de staging):

   | Variable | Valor en staging | Por qué |
   | --- | --- | --- |
   | `IMPACTO_UMBRAL_SOSPECHA_G` | `2` | El mínimo que se acepta: un golpe seco sobre la mesa lo alcanza |
   | `IMPACTO_MS_SOBRE_UMBRAL` | `5` | El mínimo: un golpe con la mano dura una o dos muestras |
   | `MODO_VIAJE_ALERTA` | `normal` | Que la alerta se muestre |
   | `TELEMETRIA_DIAS_CONSERVACION` | `7` | Lo de prueba se borra solo en una semana |

   Las demás, con su omisión. Con un umbral de sospecha de 2 siguen valiendo las relaciones de
   `IMPACTO_UMBRAL_CONFIRMADO_G` (8, tiene que ser ≥ 2) y de
   `IMPACTO_DESACELERACION_IMPOSIBLE_G` (1.4, tiene que ser < 2).
3. **Comprobar que se tomaron.** `curl https://staging.tu-dominio.com/api/salud` tiene que traer
   `"modo_viaje": { "ok": true, … "problemas": [] }`, y
   `curl https://staging.tu-dominio.com/api/telemetria/configuracion` tiene que traer
   `"sospechaG": 2` y `"msSobreUmbral": 5`. Si trae 4 y 30, la variable se rechazó:
   `/api/salud` dice por qué.
4. **En el teléfono:** abrir staging, escribir la clave de diagnóstico (arriba), recargar,
   encender el modo viaje y abrir la hoja. El diagnóstico tiene que decir «umbral de sospecha
   2 g».
5. **Alerta sin moverse.** Sin velocidad, un golpe sostenido llega a sospecha:
   1. quitarle a staging el permiso de ubicación (en Android, el candado › Configuración del
      sitio › Ubicación › Bloquear; en iPhone, Ajustes › Privacidad y seguridad › Localización ›
      Sitios web de Safari › Nunca) y volver a encender el modo viaje;
   2. apoyar el teléfono quieto sobre una mesa firme, con la pantalla hacia arriba;
   3. dar un solo golpe seco con el puño sobre la mesa, al lado del teléfono, sin tocarlo. Entre
      un intento y otro, esperar 3 segundos: dos golpes seguidos cuentan como sacudida;
   4. esperado: unos 8 segundos después, «¿Estás bien?» con la cuenta de 30. En el diagnóstico,
      el episodio figura como `sospecha`; si figura como `nada`, su motivo dice qué señal faltó
      (casi siempre, que el golpe no fue sostenido: golpear más firme).
6. **Alerta con velocidad** (en un playón vacío y con acompañante; quien maneja no toca el
   teléfono). Con el permiso de ubicación dado y el teléfono en el soporte: andar a 20 km/h o
   más durante 10 segundos, que el acompañante dé un golpe seco con la palma sobre el soporte y
   frenar hasta detenerse dentro de los 8 segundos siguientes. Esperado: `confirmado`, o
   `sospecha` si el golpe hizo girar el teléfono antes del pico.
7. **Ver lo que llegó**, en la base de staging:

   ```sql
   SELECT id, apertura, nivel, nivel_cliente, pico_g, respuesta, hubo_choque, sonido,
          gps_precision_m, veredicto->>'motivo' AS motivo
   FROM telemetria
   WHERE recibido_en >= now() - interval '3 hours'
   ORDER BY recibido_en DESC;
   ```

   ```sql
   SELECT tipo, ocurrido_en_telefono, kmh_inicial, kmh_final, duracion_ms, g_estimada, pico_g, plataforma
   FROM eventos_conduccion
   WHERE recibido_en >= now() - interval '3 hours'
   ORDER BY ocurrido_en_telefono;
   ```

   `nivel` (servidor) y `nivel_cliente` (teléfono) tienen que coincidir: si no, el servidor y el
   teléfono están evaluando con umbrales distintos.
8. **Al terminar:** «Borrar mis registros del modo viaje» en la hoja y
   `localStorage.removeItem('acta:diagnostico')`. Nada de las variables de staging pasa a
   producción; allá conviene desplegar primero con `MODO_VIAJE_ALERTA=silenciosa` y pasar a
   `normal` después de mirar las consultas de calibración.

### Prueba en dispositivo

Siempre por HTTPS con certificado de confianza, en staging (filas 1 a 16) o en producción con
los umbrales de omisión (fila 17). Cada fila se corre en estos equipos, anotando el resultado
por equipo: iPhone con iOS 18.4 o posterior e instalada, iPhone con iOS anterior a 18.4 e
instalada, iPhone en Safari, Android con Chrome e instalada, iPad solo Wi-Fi y escritorio.

| # | Procedimiento | Esperado |
| --- | --- | --- |
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

La fila 15 se corre con los umbrales de omisión: con el umbral de staging, dejar caer el
teléfono al asiento sí puede abrir la alerta.

**Fila 17, qué se anota.** Un viaje real de 60 minutos con la aplicación abierta en el soporte,
el diagnóstico habilitado y los umbrales de omisión, uno por equipo:

| Dato | Cómo se toma |
| --- | --- |
| Equipo | Modelo, versión de iOS o Android, instalada o en el navegador |
| Enchufado | Si estuvo enchufado todo el viaje, parte o nada |
| Batería | Porcentaje al encender y a los 60 minutos |
| Temperatura | Al tacto a los 60 minutos (normal, tibio o caliente) y si el sistema avisó o bajó el brillo |
| Detección | «Detección activa X de Y min» de la hoja al terminar |
| Huecos | Cada «Sin detección N min» de la hoja, con lo que pasó en ese momento (llamada, bloqueo, otra aplicación) |
| Episodios | Los del diagnóstico: hora, nivel, pico y motivo |
| Alertas | Hora de cada una y qué se respondió |
| Eventos | Frenadas, pozos y lomos de burro fuertes que se recuerden, con la hora aproximada, para cruzarlos con `eventos_conduccion` (consulta del paso 7 de «Staging», contra la base donde se hizo el viaje) |
````

- [ ] **Step 3: Correr la comprobación ampliada y ver que pasa**

Correr otra vez exactamente el comando del paso 1.

Esperado PASA: 25 líneas que empiezan con `  ok   `, la última es `README en orden.` y el código de salida es 0.

- [ ] **Step 4: Validar las cinco consultas contra el esquema real**

Correr otra vez exactamente el comando del paso 7 de la Tarea 2 (con la misma `E2E_DATABASE_URL`).

Esperado PASA: `  ok   consulta 1 del modo viaje en el README` hasta `  ok   consulta 5 del modo viaje en el README`, la línea `5 consultas, 0 con error` y código de salida 0. Sin la variable, la línea `  salta …` y se anota en el reporte.

- [ ] **Step 5: Revisión manual del procedimiento**

Leer el README renderizado (la vista previa de Markdown del editor) y comprobar: las cuatro tablas nuevas se dibujan como tablas (no como texto con barras); las dos consultas de staging se ven como bloques de código dentro del paso 7 de la lista; el enlace `[Variables](#variables)` y el de `[Modo viaje](#modo-viaje)` de la sección de limitaciones llevan a su título. Si una tabla sale como texto, falta la línea en blanco antes de ella.

- [ ] **Step 6: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, `npm run tipos` sin salida y `Todo en orden.` al final.

- [ ] **Step 7: Commit**

```bash
git add "README.md"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Escribir el procedimiento de staging y la matriz de prueba del modo viaje

Para ver una alerta hay que provocarla sin chocar: eso pide un entorno aparte con
el umbral de sospecha en su mínimo y un golpe seco sobre la mesa sin permiso de
ubicación, que el detector evalúa sin velocidad y lleva a sospecha. Staging nunca
comparte base con producción, porque las alertas de prueba ensuciarían las
consultas de calibración.

Se suma cómo habilitar el diagnóstico en un teléfono sin consola, la matriz de
prueba en dispositivo con las diecisiete filas del diseño y qué se anota en la
fila 17, el viaje real de una hora que da los primeros datos de campo.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Comentarios de `lib/local.ts` y `next.config.mjs`

Índice F6.3. Sólo comentarios: ninguna línea de código cambia.

**Files:**
- Modify: `lib/local.ts` — el último párrafo del comentario de cabecera, que empieza con ` * Todo va envuelto en try/catch a propósito: en navegación privada de Safari el simple` (hoy líneas 12–13).
- Modify: `next.config.mjs` — un comentario nuevo al final del objeto `nextConfig`, después de `serverExternalPackages: ['pdf-lib'],` (hoy línea 11).
- Test: diferencia de git que sólo toca comentarios, carga de `next.config.mjs` con Node, y las tres verificaciones.

**Interfaces:**
- Consumes: nada de código. Hechos que el comentario afirma: el motor escribe `acta:viaje`, `acta:golpe-pendiente` y `acta:viaje:*` con `fuentes.almacenamiento` en `try/catch` (F3); `GrabadorAudio.tsx` usa `getUserMedia({ audio: true })` (`app/s/[id]/pantallas/GrabadorAudio.tsx:29`); el ejemplo de `Permissions-Policy` de `node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/headers.md` es `camera=(), microphone=(), geolocation=(), browsing-topics=()`.
- Produces: nada que otra fase consuma.

- [ ] **Step 1: Comprobar que hoy los comentarios están desactualizados**

```bash
grep -c "en navegación privada de Safari el simple" lib/local.ts
grep -c "Permissions-Policy" next.config.mjs
```

Esperado: `1` (el comentario viejo, que ya no es cierto: desde Safari 11 `localStorage` funciona en navegación privada) y `0` (no hay advertencia sobre los encabezados).

- [ ] **Step 2: Reescribir el párrafo de `lib/local.ts`**

Antes:

```ts
 * Todo va envuelto en try/catch a propósito: en navegación privada de Safari el simple
 * acceso a localStorage tira excepción, y perder el guardado no puede romper la pantalla.
 */
```

Después:

```ts
 * Todo va envuelto en try/catch a propósito, aunque ya no por la navegación privada de
 * Safari: desde Safari 11 ahí localStorage funciona, pero lo guardado se borra al cerrar la
 * pestaña, así que en una ventana privada la actuación abierta (y la intención del modo
 * viaje) se olvida al cerrarla. El acceso todavía tira con el almacenamiento del sitio
 * bloqueado (cookies bloqueadas en el navegador) y la escritura, con la cuota llena; perder el
 * guardado no puede romper la pantalla.
 */
```

- [ ] **Step 3: Agregar el comentario de `next.config.mjs`**

Antes:

```js
  serverExternalPackages: ['pdf-lib'],
}
```

Después:

```js
  serverExternalPackages: ['pdf-lib'],
  // Todavía no hay headers(). Cuando se agreguen encabezados de seguridad, la
  // Permissions-Policy tiene que dejar habilitados para self estos cinco:
  //   accelerometer=(self), gyroscope=(self), geolocation=(self), screen-wake-lock=(self), microphone=(self)
  // Sin accelerometer y gyroscope, devicemotion no emite nada y el modo viaje queda en «sin
  // lecturas» sin ningún error. Sin geolocation no hay velocidad para el detector ni ubicación
  // para la ayuda y la actuación. Sin screen-wake-lock la pantalla se apaga y la detección
  // muere. Sin microphone, navigator.audioSession no puede hacer sonar la alerta con el iPhone
  // en silencio, y el relato en audio del recorrido no graba. Ojo: el ejemplo de
  // Permissions-Policy de la documentación de Next (headers.md) pone geolocation=() y
  // microphone=(), que apagan justamente esto.
}
```

- [ ] **Step 4: Comprobar que sólo cambiaron comentarios y que la configuración carga**

```bash
git diff -U0 lib/local.ts | grep '^[+-]' | grep -v '^+++\|^---' | grep -v '^[+-] \*'
git diff -U0 next.config.mjs | grep '^[+-]' | grep -v '^+++\|^---' | grep -v '^[+-]  //'
node --input-type=module -e "const m = await import('./next.config.mjs'); console.log(Object.keys(m.default).join(','))"
grep -c "en navegación privada de Safari el simple" lib/local.ts
grep -c "Permissions-Policy" next.config.mjs
```

Esperado: los dos primeros comandos no imprimen nada (toda línea agregada o quitada es de comentario); el tercero imprime `output,outputFileTracingRoot,serverExternalPackages`; el cuarto `0`; el quinto `2`.

- [ ] **Step 5: Las tres verificaciones**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, `npm run tipos` sin salida y `Todo en orden.` al final.

- [ ] **Step 6: Commit**

```bash
git add "lib/local.ts" "next.config.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Advertir qué encabezados apagarían el modo viaje sin ningún error

El ejemplo de Permissions-Policy de la documentación de Next pone geolocation=() y
microphone=(). Copiado tal cual deja al modo viaje sin GPS y sin sonido en un
iPhone en silencio, y sin acelerómetro ni giróscopo si alguien completa la lista:
nada falla, simplemente deja de detectar. El comentario queda donde se van a
escribir esos encabezados.

El comentario de lib/local.ts decía que Safari tira en navegación privada; eso
dejó de ser cierto en Safari 11. El try/catch sigue haciendo falta por otros
motivos, y ahora lo que importa decir es que en una ventana privada lo guardado se
borra al cerrarla.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verificación de la fase

- [ ] **Las tres verificaciones, al final:**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: `El contrato se cumple.`, `npm run tipos` sin salida y `Todo en orden.` al final.

- [ ] **README:** el comando del paso 1 de la Tarea 3 termina en `README en orden.`, y el del paso 7 de la Tarea 2 da `5 consultas, 0 con error` (o `salta …` anotado).
- [ ] **Historial:** `git log --oneline -4` muestra, del más nuevo al más viejo, «Advertir qué encabezados apagarían el modo viaje sin ningún error», «Escribir el procedimiento de staging y la matriz de prueba del modo viaje», «Explicar en el README lo que el detector hace de verdad y cómo calibrarlo» y «Mostrar el diagnóstico del modo viaje en la hoja para calibrar en campo». `git status --short` no muestra nada fuera de `docs/superpowers/plans/`.
- [ ] **Staging (README › Staging, pasos 1 a 8), en un Android con Chrome instalada y en un iPhone con iOS 18.4 o posterior instalada:** `/api/salud` con `modo_viaje.ok: true`; la configuración con `sospechaG: 2`; el diagnóstico dice «umbral de sospecha 2 g»; el golpe sobre la mesa sin permiso de ubicación abre «¿Estás bien?» a los 8 segundos y el episodio figura como `sospecha`; en la base de staging la fila de `telemetria` tiene `nivel` igual a `nivel_cliente`.
- [ ] **Matriz de §6.5, fila 17 (la de esta fase):** un viaje real de 60 minutos por cada equipo de la lista, con la planilla «Fila 17, qué se anota» completa: batería al encender y a los 60 minutos, temperatura, «Detección activa X de Y min», cada hueco con su causa, los episodios del diagnóstico, las alertas con su respuesta, y los eventos recordados cruzados con `eventos_conduccion`.
- [ ] **Primeros datos de campo:** con al menos una semana de uso real, las tres consultas de calibración corridas contra producción con un usuario de sólo lectura y su salida guardada junto a las planillas de la fila 17. Ninguna variable de umbral se cambia sin pasar antes por «Cambiar un umbral».

## Desvíos respecto del índice

1. **`.hoja-viaje-diagnostico-tabla` es un `<ol>`, no un `<table>`.** El índice nombra la clase «tabla de los últimos 20 episodios» sin fijar el elemento. Un `<table>` hereda la regla global `table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 640px; }` (`app/globals.css:860-865`, pensada para el panel) y abre scroll horizontal dentro de la hoja en 375 px; anularla obliga a estilar `th` y `td`, que es colgar selectores de tipos de elemento. Se conserva el nombre de la clase del índice.
