# F5 — Ayuda, vínculo y retención — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que después de un golpe la persona quede a un toque de la ayuda y del registro del accidente, con o sin señal: la ayuda completa dentro de la alerta y en `/aviso`, el golpe pendiente a la vista en la tarjeta, la píldora y la hoja, la actuación abierta desde un golpe vinculada a su telemetría con un eslabón que se puede verificar para siempre, y la telemetría que nunca se vincula borrada al cumplir sus días de conservación.

**Architecture:** `app/components/AyudaImpacto.tsx` (cliente, exportado) arma la ayuda con `useModoViaje()` y el motor: llamadas, contacto de confianza, ubicación, registro del accidente y falsa alarma. La usan la capa de `app/components/ModoViaje.tsx` en estado `ayuda` y `app/aviso/page.tsx`, que no escribe nada al montar. El golpe pendiente se dibuja en la tarjeta de `app/page.tsx`, en la píldora y en una sección nueva de la hoja. En el servidor, `lib/casos.ts` suma `abrirActuacionDesdeImpacto`: una transacción con `SELECT … FOR UPDATE` de la telemetría, `INSERT … ON CONFLICT (id) DO NOTHING RETURNING id` sin `SAVEPOINT`, el vínculo con `caso_id IS NULL` y un eslabón de apertura con sólo primitivas; `POST /api/casos` la llama con `telemetria_id` y anota la posesión después del `COMMIT`. `lib/retencion.ts` suma la purga de telemetría por lotes de 500, que `aplicarPolitica` corre siempre y que `POST /api/telemetria` y `POST /api/conduccion` disparan dentro de `after()` como mucho una vez por hora; anonimizar y expurgar borran la telemetría vinculada. El contrato de datos personales en eslabones pasa a revisar también `lib/`.

**Tech Stack:** Next.js 16.3 (route handlers, `after()` de `next/server`, `useRouter` y `useSearchParams`), React 19.2 (`useId`, refs de objeto), TypeScript 7 (`tsc --noEmit`), Postgres con `pg` (`PoolClient`, `make_interval`), Node 24.19 con `tsx`, APIs del navegador (Web Share, Clipboard, `fetch` con `keepalive`, `<dialog>`).

**Spec:** `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md` (§3.3 y §3.4 ayuda, §3.5 golpe pendiente, §5.3 `POST /api/casos` con `telemetria_id`, §5.5 retención, §6.3 contrato, §6.4 e2e, §6.5 fila 10, §7 fila F5) · índice: `docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md` («Fases › F5», «Interfaces › `lib/retencion.ts` (F5)», «› `lib/casos.ts` (F5)», «› `app/components/ModoViaje.tsx`», «› `app/components/AyudaImpacto.tsx` (F5)», «Contratos HTTP › `POST /api/casos`» y «› `POST /api/mantenimiento/expurgo`», «Almacenamiento del cliente», «Interfaz: clases, atributos y textos», «Pruebas: convenciones», «Riesgos de implementación conocidos» 1–3, 6, 8–10, 12, 26, 27 y 32–36).

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

Todos los comandos son de Git Bash y se corren desde la raíz del repositorio:

```bash
cd "/c/Users/mateo/OneDrive/Desktop/Proyectos/mvp aseguradora"
```

- [ ] **Precondición 1: rama y árbol.** `git branch --show-current` imprime `modo-viaje-global`. `git status --short` no muestra cambios sin commitear fuera de `docs/superpowers/plans/` (esa carpeta no entra en ningún commit de esta fase).
- [ ] **Precondición 2: F4 terminada.** `git log --oneline -30` muestra los commits de F0 a F4. Existen `app/components/ModoViaje.tsx`, `lib/viaje.ts`, `lib/telemetria.ts` y `scripts/prueba-viaje.mjs`, y no existe `app/components/DetectorImpacto.tsx`.
- [ ] **Precondición 3: las tres verificaciones en verde antes de tocar nada.**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Esperado: el contrato termina en `El contrato se cumple.`, `npm run tipos` no imprime nada y sale con 0, y `npm run prueba` termina en `Todo en orden.` (la última línea es la de `scripts/prueba-viaje.mjs`) sin ninguna línea `  FALLA`.

- [ ] **Precondición 4: los anclajes de F1 y F4 que este plan toca existen como los describe el índice.**

```bash
grep -n "type SeccionHoja" app/components/ModoViaje.tsx
grep -n "const pideAccion" app/components/ModoViaje.tsx
grep -n 'role="alertdialog"' app/components/ModoViaje.tsx
grep -n "Estoy bien, fue una falsa alarma" app/components/ModoViaje.tsx
grep -n "hoja-viaje-encabezado" app/components/ModoViaje.tsx
grep -n "^export function ModoViaje(" app/components/ModoViaje.tsx
grep -nE "^function (pildoraDe|HojaViaje|AlertaViaje|horaCorta)\(" app/components/ModoViaje.tsx
grep -n "data-estado={pildora.enEspera ? 'espera' : 'ok'}" app/components/ModoViaje.tsx
grep -n "const destino = seccion === 'datos' ? refDatos : seccion === 'permisos' ? refPermisos : refEstado" app/components/ModoViaje.tsx
grep -n 'aria-labelledby="alerta-viaje-titulo"' app/components/ModoViaje.tsx
grep -n "function TarjetaModoViaje" app/page.tsx
grep -n "tarjeta-viaje-estado" app/page.tsx
grep -n "{linea !== null && !textoEsBoton ? (" app/page.tsx
grep -n "^function horaCorta(" app/page.tsx
grep -n "return NextResponse.json(" app/api/telemetria/route.ts app/api/conduccion/route.ts
grep -n "alLlamar" app/components/BotonesEmergencia.tsx
grep -nE "export (async )?function (accesoTelemetria|configuracionModoViaje|leerTelemetriaPropia)|export interface QuienPide" lib/telemetria.ts
grep -n "export async function leerCuerpoLimitado" lib/api.ts
grep -n "export function limitar" lib/limite.ts
grep -n "export async function huellaDispositivo" lib/posesion.ts
grep -nE "(function|const) (crearFrasco|saltar)\b" scripts/prueba-e2e.mjs
grep -n "\[10g\]" scripts/prueba-e2e.mjs
grep -n "/\* ---------- Resultado ---------- \*/" scripts/prueba-viaje.mjs scripts/prueba-e2e.mjs
grep -n "no llama ni manda mensajes por su cuenta" scripts/prueba-contrato.mjs
```

Esperado: cada comando imprime al menos una línea. Estos anclajes son el código que escriben los planes de F1 (`docs/superpowers/plans/2026-09-16-modo-viaje-f1-servidor.md`, Tarea 9) y F4 (`docs/superpowers/plans/2026-09-16-modo-viaje-f4-capa-global.md`, Tareas 3 a 6), y los bloques «reemplazar … por …» de este plan los copian tal cual; la de `^function (pildoraDe|…)` imprime cuatro líneas y la de `return NextResponse.json(` tres (dos en `telemetria`, una en `conduccion`). La de `type SeccionHoja` todavía no tiene `'golpe'`; la de `Estoy bien, fue una falsa alarma` es la ayuda provisoria de F4; la de `lib/telemetria.ts` imprime cuatro líneas; la última es la entrada de `app/perfil/page.tsx` en la tabla de textos obligatorios que F4 sumó al contrato. Si alguno no imprime nada, F1 o F4 no quedaron como dice el índice: se frena y se reporta; no se arregla desde este plan.

**Servidor para el e2e** (Tareas 6, 7 y 8, y la verificación de la fase). Es la misma preparación que usó F1 para `[10a]`–`[10g]`:

- En otra terminal, `npm run dev` con `DATABASE_URL` apuntando a una base Postgres descartable (nunca la del `.env`: es la base compartida) y con `CLAVE_MANTENIMIENTO` definida.
- En la terminal del e2e, exportadas: `E2E_DATABASE_URL` con la misma cadena que usa el servidor, `CLAVE_MANTENIMIENTO` con el mismo valor que el servidor y, si esa base exige TLS, `E2E_DATABASE_SSL=true`. Sin las dos primeras, `[10h]` y `[10m]` imprimen `  salta …` en lo que necesita la base y `[10l]` salta entera: para dar la fase por terminada no puede quedar ningún `salta` de `[10h]`–`[10m]`.

**Leer primero, enteros:**

- El índice: «Fases › F5», «Interfaces › `lib/casos.ts` (F5)», «› `lib/retencion.ts` (F5)», «› `app/components/AyudaImpacto.tsx` (F5)», «› `app/components/ModoViaje.tsx`» (regla y rótulos de la píldora), «Contratos HTTP › `POST /api/casos`», «Almacenamiento del cliente», «Textos exactos» (Tarjeta, Píldora, Hoja, Alerta y Ayuda), «Pruebas: convenciones» y los riesgos 1–3, 6, 8–10, 12, 26, 27 y 32–36.
- `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`: `after` corre aunque la respuesta haya fallado, y en un route handler el callback puede leer cookies y cabeceras. Se abre ese archivo directo; nunca se busca adentro de `node_modules`.
- `app/components/ModoViaje.tsx` (F4): el tipo `SeccionHoja`, `pildoraDe` (regla y rótulos de la píldora) y el `<button className="pildora-viaje">` con `tocarPildora`, `HojaViaje` (sus refs de sección, el `useLayoutEffect` que elige `destino` y `alCerrar`), el `<dialog className="hoja-viaje">`, y `AlertaViaje` (el `div` con `role="alertdialog"` y la rama `ayuda` provisoria).
- `app/page.tsx` (F4): `horaCorta`, `lineaDeLaTarjeta` y `TarjetaModoViaje` con su `.tarjeta-viaje-estado`.
- `app/components/BotonesEmergencia.tsx` (F4), `lib/viaje.ts` (F3: `EstadoModoViaje`, `registrarAccidente`, `responder`, `falsaAlarma`, `descartarGolpePendiente`) y `lib/local.ts`.
- `lib/telemetria.ts` (F1), `lib/hash.ts` (`registrarEvento` con `aJsonPuro`), `lib/casos.ts`, `lib/retencion.ts` y `lib/db.ts` (la caché del pool en `globalThis`).
- `app/api/casos/route.ts`, `app/api/telemetria/route.ts`, `app/api/conduccion/route.ts` y `app/aviso/page.tsx`, tal como los dejó F1.
- `scripts/prueba-viaje.mjs`, `scripts/prueba-e2e.mjs` (el arnés de F1 y `[10a]`–`[10g]`) y `scripts/prueba-contrato.mjs` (secciones `[4]` y `[5]`).

---

### Task 1: `AyudaImpacto` y la alerta en estado `ayuda`

Índice F5.1, primera parte. La ayuda completa (§3.4) reemplaza la ayuda provisoria que F4 dibujó dentro de la alerta. `/aviso` la usa en la Tarea 2: se separa porque se revisa aparte (lee del servidor y responde por HTTP).

**Files:**
- Create: `app/components/AyudaImpacto.tsx`
- Modify: `scripts/prueba-contrato.mjs` (sección `[4]`: la tabla de textos obligatorios por archivo que sumó F4; se ubica con `grep -n "no llama ni manda mensajes por su cuenta" scripts/prueba-contrato.mjs`)
- Modify: `app/globals.css` (las cuatro reglas `.emergencia .emergencias-inicio…` y el final de su comentario, hoy líneas 1876–1898; bloque nuevo inmediatamente antes de la línea `@media (prefers-reduced-motion: reduce) {` seguida de `  .opcion,`, el último bloque del archivo)
- Modify: `app/components/ModoViaje.tsx` (imports; la rama `ayuda` de la alerta, que contiene `Estoy bien, fue una falsa alarma`; los atributos del `div` con `role="alertdialog"`)
- Test: `npm run contrato`, `npm run tipos`, verificación manual en el navegador

**Interfaces:**
- Consumes:
  - `useModoViaje(): ContextoModoViaje` de `app/components/ModoViaje.tsx` (F4), con `contacto: { nombre: string; telefono: string } | null` y `motor: MotorViaje | null`.
  - `MotorViaje.registrarAccidente(telemetria?: { idCliente?: string | null; idServidor?: string | null }): Promise<ResultadoRegistro>`, con `ResultadoRegistro = { tipo: 'creada'; id: string; vinculo: 'ok' | 'rechazado' | 'sin_dato' } | { tipo: 'sin_red' } | { tipo: 'error'; mensaje: string }`; `MotorViaje.responder(respuesta: 'estoy_bien' | 'necesito_ayuda'): void`; `MotorViaje.falsaAlarma(): void` (F3, `lib/viaje.ts`).
  - `EstadoModoViaje['alerta']`: `estado`, `idCliente`, `idServidor`, `origenAyuda`, `respondida`, `ubicacion` (F3).
  - `BotonesEmergencia({ soloLugar = false, chicos = false, alLlamar }: { soloLugar?: boolean; chicos?: boolean; alLlamar?: (numero: string) => void })` (F4).
  - `actuacionAbierta(): string | null` de `lib/local.ts`.
- Produces:
  - `export function AyudaImpacto(props: { origen: 'necesito_ayuda' | 'sin_respuesta'; idCliente: string | null; idServidor: string | null; ubicacion: { lat: number; lon: number } | null; respondida: boolean; alLlamar: () => void; alFalsaAlarma: () => void }): React.JSX.Element` (lo usa `/aviso` en la Tarea 2).
  - Clases `.ayuda-impacto`, `.ayuda-impacto-titulo`, `.ayuda-impacto-contacto`, `.ayuda-impacto-nota`, `.ayuda-impacto-acciones`, `.ayuda-impacto-sin-ubicacion`.

- [ ] **Step 1: Sumar `AyudaImpacto.tsx` a la tabla de textos obligatorios del contrato**

`TEXTOS_OBLIGATORIOS` es el objeto que F4 escribió a nivel de módulo en `scripts/prueba-contrato.mjs` (plan F4, Tarea 7, Step 4; el índice le asigna a F5 esta entrada). Se ubica con:

```bash
grep -n "no llama ni manda mensajes por su cuenta" scripts/prueba-contrato.mjs
```

Expected: una línea, `  'app/perfil/page.tsx': ['no llama ni manda mensajes por su cuenta'],`. Reemplazar:

```js
  'app/perfil/page.tsx': ['no llama ni manda mensajes por su cuenta'],
}
```

por:

```js
  'app/perfil/page.tsx': ['no llama ni manda mensajes por su cuenta'],
  'app/components/AyudaImpacto.tsx': ['no llama ni manda mensajes por su cuenta'],
}
```

- [ ] **Step 2: Correr el contrato y ver que falla por el archivo que falta**

Run: `npm run contrato`

Expected: código 1 y, en la sección `[4]`, exactamente (la comprobación de F4 trata un archivo que no existe como uno sin ninguna línea):

```text
  FALLA los avisos que dicen un límite siguen en su archivo
         app/components/AyudaImpacto.tsx: «no llama ni manda mensajes por su cuenta»
```

- [ ] **Step 3: Crear `app/components/AyudaImpacto.tsx`**

```tsx
'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BotonesEmergencia } from './BotonesEmergencia'
import { useModoViaje } from './ModoViaje'
import { actuacionAbierta } from '@/lib/local'

/**
 * La ayuda después de un golpe (§3.4). La usan la alerta del modo viaje, en su estado `ayuda`, y
 * `/aviso`, que es su respaldo.
 *
 * Todo lo que importa funciona sin red: las llamadas son enlaces tel:, el contacto de confianza lo
 * guarda el proveedor en el teléfono y la ubicación ya está acá. Lo único que necesita señal es abrir
 * la actuación, y eso lo resuelve el motor con su cola.
 *
 * La aplicación no llama ni le avisa a nadie por su cuenta: cada llamada es un toque de la persona.
 */
export function AyudaImpacto({
  origen,
  idCliente,
  idServidor,
  ubicacion,
  respondida,
  alLlamar,
  alFalsaAlarma,
}: {
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
}): React.JSX.Element {
  const router = useRouter()
  const { contacto, motor } = useModoViaje()
  const idTitulo = useId()
  const refTitulo = useRef<HTMLHeadingElement>(null)
  const [abierta, setAbierta] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    // Quien usa un lector de pantalla oye primero qué pasó, no el botón que tocó antes.
    refTitulo.current?.focus()
    // localStorage sólo existe en el navegador: leerlo al dibujar rompería la hidratación de /aviso.
    setAbierta(actuacionAbierta())
  }, [])

  // El enlace se arma antes del toque: dentro del onClick no puede haber nada que espere.
  const urlUbicacion = ubicacion ? `https://www.google.com/maps/search/?api=1&query=${ubicacion.lat},${ubicacion.lon}` : null
  // El teléfono del contacto es texto libre («11 5555-0101»): el tel: lleva sólo dígitos y el +.
  const telefonoContacto = contacto ? contacto.telefono.replace(/[^\d+]/g, '') : ''

  function llamar() {
    // No se previene el enlace: el marcador se abre igual, se haya podido registrar o no.
    if (!respondida) alLlamar()
  }

  function compartir() {
    if (urlUbicacion === null) return
    const datos = { text: 'Esta es mi ubicación después de un posible choque.', url: urlUbicacion }
    const navegador = window.navigator
    // Sin ningún await antes de share(): la activación del toque se pierde apenas se espera algo.
    if (typeof navegador.share === 'function' && navegador.canShare?.(datos) !== false) {
      navegador.share(datos).catch((err: unknown) => {
        // Cerrar la hoja de compartir sin elegir a nadie no es un error.
        if ((err as { name?: string } | null)?.name === 'AbortError') return
        console.warn('[ayuda] no se pudo compartir la ubicación', err)
      })
      return
    }
    navegador.clipboard
      ?.writeText(urlUbicacion)
      .then(() => setCopiado(true))
      .catch(() => undefined)
  }

  async function registrar() {
    // Si ya hay una actuación abierta en este teléfono, abrir otra duplicaría el siniestro.
    const abiertaAhora = actuacionAbierta()
    if (abiertaAhora) {
      router.push(`/s/${abiertaAhora}`)
      return
    }
    if (motor === null) return
    setAbriendo(true)
    setAviso(null)
    const resultado = await motor.registrarAccidente({ idCliente, idServidor })
    if (resultado.tipo === 'creada') {
      // vinculo 'rechazado' no frena nada: la actuación se abrió igual, sólo que sin el golpe.
      router.push(`/s/${resultado.id}`)
      return
    }
    setAbriendo(false)
    setAviso(
      resultado.tipo === 'sin_red'
        ? 'Sin señal: la lectura queda guardada en el teléfono. Llamá desde los botones de arriba y registralo cuando vuelva la señal.'
        : resultado.mensaje,
    )
  }

  return (
    <section className="ayuda-impacto" aria-labelledby={idTitulo}>
      <h2 id={idTitulo} ref={refTitulo} className="ayuda-impacto-titulo" tabIndex={-1}>
        {origen === 'necesito_ayuda' ? 'Pediste ayuda' : 'No respondiste'}
      </h2>

      <BotonesEmergencia alLlamar={llamar} />

      {contacto && telefonoContacto ? (
        <div className="ayuda-impacto-contacto">
          <a href={`tel:${telefonoContacto}`} className="boton boton-secundario boton-ancho" onClick={llamar}>
            Llamar a {contacto.nombre}
          </a>
          <p className="ayuda-impacto-nota">La aplicación no llama ni manda mensajes por su cuenta</p>
        </div>
      ) : null}

      <div className="ayuda-impacto-acciones">
        {urlUbicacion ? (
          <button type="button" className="boton boton-secundario boton-ancho" onClick={compartir}>
            Compartir mi ubicación
          </button>
        ) : (
          <p className="ayuda-impacto-sin-ubicacion">No hay ubicación: el GPS estaba apagado</p>
        )}
        {copiado ? (
          <div className="aviso" data-nivel="ok" role="status">
            Copiamos el enlace de tu ubicación: pegalo en un mensaje.
          </div>
        ) : null}

        <button
          type="button"
          className="boton-primario"
          onClick={registrar}
          disabled={abriendo || (motor === null && abierta === null)}
        >
          {abriendo ? 'Abriendo...' : abierta ? 'Continuar la actuación abierta' : 'Registrar el accidente'}
        </button>
        {aviso ? (
          <div className="aviso" data-nivel="alerta" role="alert">
            {aviso}
          </div>
        ) : null}

        <button type="button" className="boton boton-secundario boton-ancho" onClick={alFalsaAlarma}>
          Estoy bien, fue una falsa alarma
        </button>
      </div>
    </section>
  )
}
```

Notas que un revisor va a buscar: la frase obligatoria está entera en una sola línea (riesgo 34); ningún `style={{` (riesgo 35); ningún literal igual a un texto de `VALOR` (riesgo 32); `BotonesEmergencia` va sin `soloLugar` para que estén los tres números, incluido Bomberos.

- [ ] **Step 4: Correr el contrato y ver que ahora faltan las clases**

Run: `npm run contrato`

Expected: la comprobación de textos obligatorios pasa, y falla exactamente ésta:

```
  FALLA toda clase del marcado está definida en globals.css
         .ayuda-impacto (app/components/AyudaImpacto.tsx), .ayuda-impacto-titulo (app/components/AyudaImpacto.tsx), .ayuda-impacto-contacto (app/components/AyudaImpacto.tsx), .ayuda-impacto-nota (app/components/AyudaImpacto.tsx), .ayuda-impacto-acciones (app/components/AyudaImpacto.tsx), .ayuda-impacto-sin-ubicacion (app/components/AyudaImpacto.tsx)
         Una clase que no existe no falla: el elemento sale sin estilo y sólo se ve abriendo esa pantalla en ese estado.
```

con `1 FALLARON. El contrato está en docs/CONTRATO-UI.md.` al final.

- [ ] **Step 5: Poner los teléfonos de la ayuda en filas y con el número escrito**

En `app/globals.css`, reemplazar:

```css
 * `.emergencia` envuelve solo las dos pantallas rojas —la del recorrido y /aviso—; el
 * inicio usa `.bloque-inicio` y conserva sus tres columnas.
 */
.emergencia .emergencias-inicio {
  grid-template-columns: 1fr;
}

.emergencia .emergencias-inicio .boton-llamada {
  min-height: 86px;
  flex-direction: row;
  gap: 12px;
  text-align: left;
}

.emergencia .emergencias-inicio .boton-llamada-contenido {
  display: grid;
  flex: 1;
  text-align: left;
}

.emergencia .emergencias-inicio .boton-llamada-detalle {
  display: block;
}
```

por:

```css
 * `.emergencia` envuelve la pantalla roja del recorrido y `.ayuda-impacto` la ayuda después de
 * un golpe, en la alerta del modo viaje y en /aviso; el inicio usa `.bloque-inicio` y conserva
 * sus tres columnas.
 */
.emergencia .emergencias-inicio,
.ayuda-impacto .emergencias-inicio {
  grid-template-columns: 1fr;
}

.emergencia .emergencias-inicio .boton-llamada,
.ayuda-impacto .emergencias-inicio .boton-llamada {
  min-height: 86px;
  flex-direction: row;
  gap: 12px;
  text-align: left;
}

.emergencia .emergencias-inicio .boton-llamada-contenido,
.ayuda-impacto .emergencias-inicio .boton-llamada-contenido {
  display: grid;
  flex: 1;
  text-align: left;
}

.emergencia .emergencias-inicio .boton-llamada-detalle,
.ayuda-impacto .emergencias-inicio .boton-llamada-detalle {
  display: block;
}
```

(El motivo ya está en el comentario de arriba de esas reglas: con la grilla de tres columnas del inicio la línea del número queda oculta, y después de un golpe el 107 no se deduce de la palabra «Ambulancia».)

- [ ] **Step 6: Sumar el bloque de clases de la ayuda**

En `app/globals.css`, inmediatamente antes de estas dos líneas (el último bloque del archivo; F4 le pudo haber agregado reglas al final, pero empieza igual):

```css
@media (prefers-reduced-motion: reduce) {
  .opcion,
```

insertar:

```css
/* ---------- Ayuda después de un golpe ---------- */

/*
 * La misma ayuda se dibuja en dos lugares: dentro de la alerta del modo viaje, sobre el panel de la
 * capa, y en /aviso, sobre el fondo común. Por eso no pinta fondos y el texto hereda el color de
 * donde esté; los botones y los avisos traen el suyo. Los teléfonos de emergencia van en filas y con
 * el número escrito, como en la pantalla roja del recorrido (ver .emergencia .emergencias-inicio).
 */
.ayuda-impacto {
  display: grid;
  gap: 16px;
}

.ayuda-impacto-titulo {
  margin: 0;
  font-size: clamp(26px, 7vw, 32px);
  line-height: 1.15;
  color: inherit;
}

.ayuda-impacto-contacto {
  display: grid;
  gap: 6px;
}

.ayuda-impacto-nota {
  margin: 0;
  font-size: 13.5px;
  line-height: 1.45;
  color: inherit;
}

.ayuda-impacto-acciones {
  display: grid;
  gap: 12px;
}

.ayuda-impacto-sin-ubicacion {
  margin: 0;
  font-size: 14.5px;
  font-weight: 600;
  line-height: 1.45;
  color: inherit;
}

/* Dentro de la grilla, el margen propio del aviso se suma al espacio entre filas. */
.ayuda-impacto .aviso {
  margin-bottom: 0;
}

```

- [ ] **Step 7: Correr el contrato en verde**

Run: `npm run contrato`

Expected: `El contrato se cumple.` (incluye `ok   toda clase del marcado está definida en globals.css`, `ok   ninguna pantalla compara contra el texto de una respuesta`, `ok   ningún color literal fuera de los tokens` y `ok   ninguna regla :hover fuera de @media (hover: hover)`).

- [ ] **Step 8: Importar `AyudaImpacto` en `ModoViaje.tsx`**

En `app/components/ModoViaje.tsx`, reemplazar (el import que sumó F4 en su Tarea 6, Step 2):

```tsx
import { BotonesEmergencia } from './BotonesEmergencia'
```

por:

```tsx
import { AyudaImpacto } from './AyudaImpacto'
import { BotonesEmergencia } from './BotonesEmergencia'
```

- [ ] **Step 9: Reemplazar la ayuda provisoria de la alerta por `AyudaImpacto`**

En `function AlertaViaje(` de `app/components/ModoViaje.tsx` (plan F4, Tarea 6, Step 3), reemplazar la rama `ayuda` provisoria entera:

```tsx
        {alerta.estado === 'ayuda' ? (
          <>
            <div className="alerta-viaje-cabeza">
              <h2 className="alerta-viaje-titulo" id="alerta-viaje-titulo" tabIndex={-1} ref={refTitulo}>
                {alerta.origenAyuda === 'necesito_ayuda' ? 'Pediste ayuda' : 'No respondiste'}
              </h2>
            </div>
            <div className="alerta-viaje-botones">
              <BotonesEmergencia alLlamar={alLlamar} />
              <button type="button" className="boton alerta-viaje-boton" onClick={registrar} disabled={registrando}>
                {registrando ? 'Abriendo...' : 'Registrar el accidente'}
              </button>
              <button type="button" className="boton alerta-viaje-boton" onClick={() => motor.falsaAlarma()} disabled={registrando}>
                Estoy bien, fue una falsa alarma
              </button>
              {avisoRegistro}
            </div>
          </>
        ) : null}
```

por:

```tsx
        {alerta.estado === 'ayuda' ? (
          <AyudaImpacto
            origen={alerta.origenAyuda ?? 'sin_respuesta'}
            idCliente={alerta.idCliente}
            idServidor={alerta.idServidor}
            ubicacion={alerta.ubicacion}
            respondida={alerta.respondida}
            alLlamar={() => motor.responder('necesito_ayuda')}
            alFalsaAlarma={() => motor.falsaAlarma()}
          />
        ) : null}
```

En `AlertaViaje`, `alerta` es `NonNullable<EstadoModoViaje['alerta']>` y `motor` es `MotorViaje` (no nulo). El índice fija estos dos manejadores («Uso en la alerta»); `?? 'sin_respuesta'` sólo existe porque el tipo de `origenAyuda` admite `null` aunque en `ayuda` siempre viene. `registrar`, `alLlamar`, `avisoRegistro` y `refTitulo` de `AlertaViaje` siguen en uso en `pregunta` y `hubo_choque`; en `ayuda` el foco lo pone `AyudaImpacto` en su propio título, y el `useEffect` de `AlertaViaje` encuentra `refTitulo.current` en `null` y no hace nada.

Run: `grep -c "Pediste ayuda" app/components/ModoViaje.tsx`

Expected: `0` (el título provisorio ya no está; el del Step 10 todavía no).

- [ ] **Step 10: Nombrar la alerta en `ayuda` sin el título que se acaba de quitar**

`AyudaImpacto` trae su propio `h2`, con un `id` de `useId`, así que `alerta-viaje-titulo` ya no existe en estado `ayuda` (riesgo 27: la alerta tiene que seguir teniendo nombre). `aria-describedby` ya vale `undefined` fuera de `pregunta` y queda como está. En el `div` con `role="alertdialog"` de `AlertaViaje`, reemplazar:

```tsx
      aria-labelledby="alerta-viaje-titulo"
      aria-describedby={alerta.estado === 'pregunta' ? 'alerta-viaje-frase' : undefined}
```

por:

```tsx
      aria-labelledby={alerta.estado === 'ayuda' ? undefined : 'alerta-viaje-titulo'}
      aria-label={alerta.estado === 'ayuda' ? (alerta.origenAyuda === 'necesito_ayuda' ? 'Pediste ayuda' : 'No respondiste') : undefined}
      aria-describedby={alerta.estado === 'pregunta' ? 'alerta-viaje-frase' : undefined}
```

- [ ] **Step 11: Compilar**

Run: `npm run tipos`

Expected: sin salida, código 0.

- [ ] **Step 12: Verificar en el navegador**

Con `npm run dev` corriendo, abrir `http://localhost:3000/` en Chrome de escritorio y pegar en DevTools › Console (es la alerta viva tal como la persiste el motor, índice «Almacenamiento del cliente › `acta:viaje:alerta`»):

```js
const ahora = Date.now()
localStorage.setItem('acta:viaje:alerta', JSON.stringify({ estado: 'ayuda', idCliente: '0f5e4c1a-9b7d-4e2f-8a6c-3d1b2e4f5a60', idServidor: null, plazo: null, ocurridoEn: ahora - 60000, abiertaEn: ahora - 55000, ayudaDesde: ahora - 25000, apertura: 'episodio', origenAyuda: 'sin_respuesta', respuestas: [{ respuesta: 'sin_respuesta', enTelefono: ahora - 25000 }], huboChoque: null, ubicacion: { lat: -34.6037, lon: -58.3816 } }))
location.reload()
```

Expected, al recargar:
- La alerta tapa la pantalla con el título «No respondiste», que tiene el foco; debajo, tres filas de llamada con el número escrito (107 Ambulancia, 911 Policía, 100 Bomberos); sin sesión no aparece «Llamar a …»; después «Compartir mi ubicación», «Registrar el accidente» y «Estoy bien, fue una falsa alarma». Ningún «¿Estás bien?».
- En Elements, el `div` con `role="alertdialog"` tiene `aria-label="No respondiste"` y no tiene `aria-labelledby`.
- «Compartir mi ubicación» en Chrome de Windows abre la hoja de compartir del sistema con «Esta es mi ubicación después de un posible choque.» y el enlace; cerrarla sin elegir no muestra nada. (En Firefox, que no tiene Web Share, aparece «Copiamos el enlace de tu ubicación: pegalo en un mensaje.» y el portapapeles tiene `https://www.google.com/maps/search/?api=1&query=-34.6037,-58.3816`.)
- «Estoy bien, fue una falsa alarma» cierra la alerta, y `localStorage.getItem('acta:viaje:alerta')` en la consola da `null`.

- [ ] **Step 13: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.` al final, sin ninguna línea `  FALLA`.

- [ ] **Step 14: Commit**

```bash
git add "app/components/AyudaImpacto.tsx" "app/components/ModoViaje.tsx" "app/globals.css" "scripts/prueba-contrato.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Mostrar la ayuda completa dentro de la alerta después de un golpe

La ayuda provisoria de la alerta sólo tenía los teléfonos y la falsa alarma. Ahora
la dibuja AyudaImpacto: los tres teléfonos con el número escrito, el contacto de
confianza si se leyó con sesión, compartir la ubicación armada antes del toque,
registrar el accidente con el motor (que funciona sin señal y no duplica una
actuación ya abierta) y la falsa alarma. Tocar un teléfono registra
necesito_ayuda si todavía no hubo respuesta, sin frenar la llamada.

El contrato exige en el componente la frase de que la aplicación no llama ni manda
mensajes por su cuenta, y la alerta en ayuda se nombra con el título que se ve.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `/aviso` como respaldo de la ayuda

Índice F5.1, segunda parte: «`/aviso` la usa». La pantalla deja de repetir «¿Estás bien?» (§3.4 lo prohíbe), dibuja `AyudaImpacto` y sólo registra lo que la persona toca.

**Files:**
- Modify: `app/aviso/page.tsx` (el archivo entero)
- Test: `npm run tipos`, `npm run contrato`, verificación manual en el navegador

**Interfaces:**
- Consumes:
  - `AyudaImpacto(props)` (Tarea 1).
  - `useModoViaje()` (F4): `estado.alerta` (`idCliente`, `idServidor`, `origenAyuda`, `respondida`, `ubicacion`), `estado.golpePendiente` (`{ telemetriaIdCliente: string; telemetriaId: string | null; ocurridoEn: number } | null`) y `motor` con `responder`, `falsaAlarma` y `descartarGolpePendiente(): void` (F3).
  - `GET /api/telemetria/[id]` (F1): 200 `{ id, ocurrido_en, nivel, gps: { lat, lon, precision_m } | null, respuesta, hubo_choque }`; 404 `{ error: <MENSAJE_TELEMETRIA_AJENA> }`.
  - `POST /api/telemetria/[id]/respuesta` (F1): cuerpo `{ respuesta, hubo_choque?, en_telefono? }`.
- Produces: la pantalla `/aviso?t=TEL-XXXXXX` (la documenta la Tarea 9).

- [ ] **Step 1: Confirmar qué dejó F1 en `/aviso`**

Run: `git diff f47005e -- app/aviso/page.tsx`

Expected: sólo desaparece el `useEffect` que registraba `sin_respuesta` al montar (en `f47005e`, líneas 26–35) y lo que quedó sin uso por eso (`useEffect` en el import de `react`, la constante `accion`). Esta tarea reemplaza el archivo entero, así que con ese diff no se pierde nada de F1. Si el diff muestra otra cosa, se frena y se reporta.

- [ ] **Step 2: Ver la falla en el navegador**

Con `npm run dev` corriendo, abrir `http://localhost:3000/aviso?t=TEL-ZZZZZZ`.

Expected (lo que esta tarea corrige): la pantalla muestra «¿Estás bien?» en la tarjeta roja —el título que §3.4 prohíbe repetir—, no muestra ningún aviso de que esa detección no es de este teléfono y no ofrece compartir la ubicación.

- [ ] **Step 3: Reemplazar `app/aviso/page.tsx` entero**

```tsx
'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Marca } from '@/app/components/Marca'
import { AyudaImpacto } from '@/app/components/AyudaImpacto'
import { useModoViaje } from '@/app/components/ModoViaje'

/**
 * Respaldo de la ayuda después de un golpe (§3.4) y destino de las notificaciones de impacto.
 *
 * No escribe nada al montar: abrir esta pantalla no es una respuesta. Registra sólo lo que la persona
 * toca, llamar o «falsa alarma». Si la alerta de ?t= es la que tiene el motor de este teléfono, la
 * ayuda trabaja con el motor, que tiene la cola y funciona sin señal; si no, la lee del servidor y
 * responde por HTTP.
 *
 * NUNCA se llama sola a emergencias. Los botones están a un toque, y nada más.
 */

/** Lo que devuelve GET /api/telemetria/[id]. */
interface LecturaAviso {
  id: string
  ocurrido_en: string
  nivel: string
  gps: { lat: number; lon: number; precision_m: number | null } | null
  respuesta: 'estoy_bien' | 'necesito_ayuda' | 'sin_respuesta' | null
  hubo_choque: boolean | null
}

function Aviso() {
  const router = useRouter()
  const t = useSearchParams().get('t')
  const { estado, motor } = useModoViaje()
  const [lectura, setLectura] = useState<LecturaAviso | null>(null)
  const [problema, setProblema] = useState<string | null>(null)
  const [ajena, setAjena] = useState(false)
  const [llamo, setLlamo] = useState(false)

  const alerta = estado.alerta
  const delMotor = t !== null && alerta !== null && (alerta.idServidor === t || alerta.idCliente === t)
  const golpe = estado.golpePendiente
  const golpeDeEsta = t !== null && golpe !== null && golpe.telemetriaId === t

  useEffect(() => {
    if (t === null || delMotor) return
    // Sólo lectura: la respuesta la registra lo que la persona toque.
    let vigente = true
    fetch(`/api/telemetria/${encodeURIComponent(t)}`, { cache: 'no-store' })
      .then(async (res) => {
        const cuerpo = await res.json().catch(() => null)
        if (!vigente) return
        if (res.ok && cuerpo) {
          setLectura(cuerpo as LecturaAviso)
          return
        }
        // 404 es «no existe» o «no es de este teléfono»: el servidor dice lo mismo en los dos casos.
        if (res.status === 404) setAjena(true)
        if (typeof cuerpo?.error === 'string') setProblema(cuerpo.error)
      })
      // Sin señal no hay lectura, pero las llamadas y el registro del accidente no la necesitan.
      .catch(() => undefined)
    return () => {
      vigente = false
    }
  }, [t, delMotor])

  useEffect(() => {
    // Si la persona ya respondió que está bien, esta pantalla no tiene nada que ofrecerle.
    if (lectura?.respuesta === 'estoy_bien') router.replace('/')
  }, [lectura, router])

  /** Registra necesito_ayuda por HTTP. keepalive: el tel: abre el marcador y la página puede quedar suspendida antes de que el pedido salga. */
  function llamarSinMotor() {
    setLlamo(true)
    if (t === null || ajena) return
    fetch(`/api/telemetria/${encodeURIComponent(t)}/respuesta`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ respuesta: 'necesito_ayuda' }),
      keepalive: true,
    }).catch(() => undefined)
  }

  /** Nunca router.back() ni push('/'): en esta etapa el motor no navega a /aviso, así que atrás puede ser cualquier cosa. */
  function falsaAlarmaSinMotor() {
    if (t !== null && !ajena) {
      fetch(`/api/telemetria/${encodeURIComponent(t)}/respuesta`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ respuesta: 'estoy_bien', hubo_choque: false }),
        keepalive: true,
      }).catch(() => undefined)
    }
    // Si el motor guardaba esta alerta como golpe pendiente, que la tarjeta deje de ofrecer registrarlo.
    if (golpeDeEsta) motor?.descartarGolpePendiente()
    router.replace('/')
  }

  return (
    <main className="envoltura">
      <Marca enlace={false} />

      {problema ? (
        <div className="aviso" data-nivel="atencion">
          {problema}
        </div>
      ) : null}

      {delMotor ? (
        <AyudaImpacto
          origen={alerta.origenAyuda ?? 'sin_respuesta'}
          idCliente={alerta.idCliente}
          idServidor={alerta.idServidor}
          ubicacion={alerta.ubicacion}
          respondida={alerta.respondida}
          alLlamar={() => motor?.responder('necesito_ayuda')}
          alFalsaAlarma={() => {
            motor?.falsaAlarma()
            router.replace('/')
          }}
        />
      ) : (
        <AyudaImpacto
          origen={lectura?.respuesta === 'necesito_ayuda' ? 'necesito_ayuda' : 'sin_respuesta'}
          idCliente={golpeDeEsta ? golpe.telemetriaIdCliente : null}
          idServidor={ajena ? null : t}
          ubicacion={lectura?.gps ? { lat: lectura.gps.lat, lon: lectura.gps.lon } : null}
          respondida={llamo || lectura?.respuesta === 'necesito_ayuda' || lectura?.respuesta === 'estoy_bien'}
          alLlamar={llamarSinMotor}
          alFalsaAlarma={falsaAlarmaSinMotor}
        />
      )}

      <p className="mini">
        El teléfono detectó un movimiento compatible con un impacto. Puede equivocarse: un pozo fuerte o un golpe al
        aparato dan lecturas parecidas. Por eso te pregunta en vez de llamar por su cuenta.
      </p>
    </main>
  )
}

export default function PaginaAviso() {
  return (
    <Suspense fallback={null}>
      <Aviso />
    </Suspense>
  )
}
```

Por qué así: con la alerta del motor la ayuda usa los mismos manejadores que la capa (índice «Uso en la alerta»); sin ella, los del índice «Uso en `/aviso` sin alerta del motor», más `descartarGolpePendiente` cuando esa telemetría es el golpe pendiente del motor, para que la tarjeta no la siga ofreciendo. Las llamadas y el registro nunca esperan la lectura del servidor: la ayuda se dibuja apenas carga la pantalla.

- [ ] **Step 4: Compilar y correr el contrato**

Run: `npm run tipos && npm run contrato`

Expected: `tipos` sin salida y `El contrato se cumple.`

- [ ] **Step 5: Verificar en el navegador**

Con `npm run dev` corriendo, en `http://localhost:3000/` (Chrome de escritorio, DevTools › Console), crear una alerta de este navegador y abrir `/aviso` con su id:

```js
await fetch('/api/telemetria/configuracion')
const ahora = Date.now()
const res = await fetch('/api/telemetria', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ campos: { id_cliente: crypto.randomUUID(), aviso_version: '2026-09-16', version_motor: 1, plataforma: 'otro', standalone: false, ocurrido_en_telefono: new Date(ahora - 45000).toISOString(), enviado_en: new Date(ahora).toISOString(), apertura: 'episodio', nivel_cliente: 'sospecha', alerta_mostrada: true, sonido: true, respuestas: [{ respuesta: 'sin_respuesta', en_telefono: new Date(ahora - 5000).toISOString() }], hubo_choque: null, ms_hasta_respuesta: null, hz_medido: 60, aceleracion_derivada: false, gps: { lat: -34.6037, lon: -58.3816, precision_m: 9.5 }, umbrales_cliente: { sospechaG: 4, confirmadoG: 8, msSobreUmbral: 30, velocidadPreviaKmh: 15, velocidadPreviaCaidaKmh: 30, velocidadPosteriorKmh: 8, ventanaPostMs: 8000, topeEpisodioMs: 15000, giroDps: 180, giroManipulacionDps: 300, desaceleracionImposibleG: 1.4, frenadaG: 0.45, aceleracionG: 0.4, retrasoMinMs: 0, retrasoMaxMs: 3000 } }, episodio: null }) })
const { id } = await res.json()
location.href = `/aviso?t=${id}`
```

Expected:
1. `/aviso` muestra «No respondiste», las tres filas de llamada con el número, «Compartir mi ubicación», «Registrar el accidente», «Estoy bien, fue una falsa alarma» y el párrafo chico del final. En Network, el único pedido a `/api/telemetria/TEL-…` es el `GET` con 200; ningún `POST /api/telemetria/TEL-…/respuesta` al cargar (los pedidos del proveedor a `/api/telemetria/configuracion` o el drenado de la cola no cuentan).
2. Tocar «Llamar» en la fila del 107 (si Chrome pregunta con qué aplicación abrir el `tel:`, cancelar): aparece `POST /api/telemetria/TEL-…/respuesta` con el cuerpo `{"respuesta":"necesito_ayuda"}` y 200. Tocar «Llamar» otra vez: no sale otro `POST`.
3. Recargar: el título pasa a «Pediste ayuda».
4. Tocar «Estoy bien, fue una falsa alarma»: sale `POST …/respuesta` con `{"respuesta":"estoy_bien","hubo_choque":false}` y 200, y la pantalla pasa a `/`.
5. Escribir otra vez `http://localhost:3000/aviso?t=` seguido del mismo id: vuelve sola a `/`.
6. Abrir `http://localhost:3000/aviso?t=TEL-ZZZZZZ`: arriba de la ayuda, el aviso amarillo «No encontramos esa detección en este teléfono. Si ya no la tenés, abrí la actuación con "Tuve un accidente".»; en Network, ningún `POST` al cargar.

- [ ] **Step 6: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.`, sin ninguna línea `  FALLA`.

- [ ] **Step 7: Commit**

```bash
git add "app/aviso/page.tsx"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Hacer de /aviso el respaldo de la ayuda sin registrar nada al abrirla

/aviso repetía «¿Estás bien?» y sólo ofrecía los teléfonos y abrir una actuación
sin vínculo. Ahora dibuja la misma ayuda que la alerta. Si la telemetría de ?t= es
la alerta del motor de este teléfono, trabaja con el motor, que tiene la cola y
funciona sin señal; si no, la lee del servidor y responde por HTTP con keepalive,
porque el tel: abre el marcador y la página puede quedar suspendida.

Abrir la pantalla no registra nada; una alerta que ya se respondió como estoy_bien
vuelve al inicio, y una que no es de este teléfono lo dice con el texto del servidor.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Golpe pendiente en la tarjeta, la píldora y la hoja

Índice F5.2. §3.5: el golpe que quedó sin decidir se muestra en la tarjeta (aunque el modo esté apagado) y en la píldora, y abre la actuación vinculada como la ayuda. La píldora abre la hoja en la sección nueva `'golpe'`, que también ofrece «No, fue una falsa alarma».

**Files:**
- Modify: `app/components/ModoViaje.tsx` (tipo `SeccionHoja`; el import de `react` y el de `@/lib/viaje`; componente nuevo `SeccionGolpePendiente` inmediatamente antes de `export function ModoViaje(`; `interface Pildora` y `function pildoraDe(`; el `<button>` con `className="pildora-viaje"` y `function tocarPildora(` del proveedor; las refs y el `useLayoutEffect` de `function HojaViaje(`, y su JSX entre `.hoja-viaje-encabezado` y la sección con `ref={refEstado}`)
- Modify: `app/page.tsx` (componente nuevo `GolpeEnTarjeta` inmediatamente antes del comentario `/**` que abre con ` * La tarjeta del modo viaje.`, encima de `function TarjetaModoViaje`; la expresión `{linea !== null && !textoEsBoton ? (` que dibuja `.tarjeta-viaje-estado` dentro de `TarjetaModoViaje`)
- Modify: `app/globals.css` (bloque nuevo inmediatamente antes del último `@media (prefers-reduced-motion: reduce) {`; `min-height` de `.tarjeta-viaje` sólo si la medición del Step 13 lo pide)
- Modify: `docs/MAPA-PANTALLAS.md` (sólo si cambia el `min-height`: el alto de la tarjeta en 375×667 que anotó F4)
- Test: `npm run tipos`, `npm run contrato`, verificación manual en el navegador

**Interfaces:**
- Consumes:
  - `EstadoModoViaje['golpePendiente']`: `null | { telemetriaIdCliente: string; telemetriaId: string | null; ocurridoEn: number }` (F3).
  - `MotorViaje.registrarAccidente(telemetria?)` y `MotorViaje.descartarGolpePendiente(): void` (F3).
  - En `ModoViaje.tsx` (F4, plan F4 Tareas 3, 5 y 6): `type SeccionHoja = 'estado' | 'datos' | 'permisos'`, `abrirHoja(seccion?: SeccionHoja)`, el tipo local `MotorViaje`, `conIntencion(estado: EstadoModoViaje): boolean`, `interface Pildora { rotulo; toque: 'seguir' | 'reanudar' | 'hoja'; enEspera }`, `pildoraDe(estado: EstadoModoViaje, campoConFoco: boolean, tarjetaQuedoArriba: boolean): Pildora | null`, `tocarPildora()` y `abiertaDesdePildora` del proveedor, `HojaViaje({ estado, motor, seccion, alCerrar }: { estado: EstadoModoViaje; motor: MotorViaje; seccion: SeccionHoja; alCerrar: () => void })` (se dibuja dentro del `<dialog className="hoja-viaje">` sólo con la hoja abierta y `motor !== null`; `alCerrar` es `() => refHoja.current?.close()`, con `refHoja` la ref del `<dialog>` en el proveedor) y `horaCorta(ms: number): string`.
  - En `app/page.tsx` (F4, plan F4 Tarea 4): `TarjetaModoViaje` con `const { estado, motor, refTarjeta, abrirHoja } = useModoViaje()`, `linea` y `textoEsBoton`.
  - `actuacionAbierta(): string | null` de `lib/local.ts`.
- Produces:
  - `type SeccionHoja = 'estado' | 'datos' | 'permisos' | 'golpe'` (lo usa F6 sin cambiarlo).
  - Clases `.tarjeta-viaje-golpe` y `.hoja-viaje-golpe`.

- [ ] **Step 1: Ver la falla en el navegador**

Con `npm run dev` corriendo y el modo viaje apagado, en `http://localhost:3000/` pegar en DevTools › Console (el golpe pendiente tal como lo persiste el motor, índice «Almacenamiento del cliente › `acta:golpe-pendiente`»):

```js
localStorage.setItem('acta:golpe-pendiente', JSON.stringify({ telemetriaIdCliente: '1c2d3e4f-5a6b-4c7d-8e9f-0a1b2c3d4e5f', ocurridoEn: Date.now() - 120000 }))
location.reload()
```

Expected (lo que esta tarea corrige): la tarjeta del inicio muestra su línea de estado de siempre y ningún «Golpe detectado»; en `http://localhost:3000/cuenta` no hay píldora.

- [ ] **Step 2: Sumar `'golpe'` a las secciones de la hoja**

En `app/components/ModoViaje.tsx`, reemplazar:

```tsx
type SeccionHoja = 'estado' | 'datos' | 'permisos'
```

por:

```tsx
type SeccionHoja = 'estado' | 'datos' | 'permisos' | 'golpe'
```

Run: `npm run tipos`

Expected: sin salida, código 0. El `useLayoutEffect` de `HojaViaje` elige la ref con un ternario que cae en `refEstado` para cualquier otra sección, así que `'golpe'` compila todavía sin ref propia; la tiene en el Step 5.

- [ ] **Step 3: Completar los imports de `ModoViaje.tsx`**

`useRef`, `useState`, `useEffect` y `useRouter` ya los importó F4 (plan F4, Tarea 3 y Tarea 6, Step 2). En `app/components/ModoViaje.tsx`, reemplazar:

```tsx
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
```

por:

```tsx
import {
  Component,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useLayoutEffect,
```

y reemplazar:

```tsx
import { ESTADO_SERVIDOR, motorDelNavegador, type EstadoModoViaje } from '@/lib/viaje'
```

por:

```tsx
import { actuacionAbierta } from '@/lib/local'
import { ESTADO_SERVIDOR, motorDelNavegador, type EstadoModoViaje } from '@/lib/viaje'
```

Run: `grep -c "^import { actuacionAbierta } from '@/lib/local'$\|^  useId,$" app/components/ModoViaje.tsx`

Expected: `2`.

- [ ] **Step 4: Crear la sección de la hoja**

En `app/components/ModoViaje.tsx`, inmediatamente antes de la línea `export function ModoViaje(`, insertar:

```tsx
/**
 * El golpe que quedó sin decidir (§3.5), como primera sección de la hoja: la píldora abre la hoja
 * acá. Registra por el mismo camino que la ayuda (§3.4) y «No, fue una falsa alarma» lo borra.
 */
function SeccionGolpePendiente({
  golpe,
  motor,
  refSeccion,
  alCerrar,
}: {
  golpe: NonNullable<EstadoModoViaje['golpePendiente']>
  motor: MotorViaje
  refSeccion: React.RefObject<HTMLElement | null>
  /** El alCerrar de HojaViaje: cierra el <dialog> por la ref del proveedor, no por esta sección. */
  alCerrar: () => void
}) {
  const router = useRouter()
  const idTitulo = useId()
  const [abierta, setAbierta] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const hora = horaCorta(golpe.ocurridoEn)

  useEffect(() => {
    setAbierta(actuacionAbierta())
  }, [])

  /*
   * La hoja es un <dialog> modal del proveedor, que sobrevive a la navegación: sin cerrarla quedaría
   * abierta encima del recorrido, con todo lo demás inerte. Se cierra con alCerrar y no buscando el
   * <dialog> desde esta sección: con 2xx, registrarAccidente borra el golpe pendiente antes de resolver,
   * esta sección se desmonta y su ref ya vale null cuando sigue el await.
   */
  async function registrar() {
    const abiertaAhora = actuacionAbierta()
    if (abiertaAhora) {
      alCerrar()
      router.push(`/s/${abiertaAhora}`)
      return
    }
    setAbriendo(true)
    setAviso(null)
    const resultado = await motor.registrarAccidente({ idCliente: golpe.telemetriaIdCliente, idServidor: golpe.telemetriaId })
    if (resultado.tipo === 'creada') {
      alCerrar()
      router.push(`/s/${resultado.id}`)
      return
    }
    setAbriendo(false)
    setAviso(resultado.tipo === 'sin_red' ? 'Sin señal: probá de nuevo cuando vuelva la señal.' : resultado.mensaje)
  }

  return (
    <section ref={refSeccion} className="hoja-viaje-seccion hoja-viaje-golpe" aria-labelledby={idTitulo}>
      <h3 id={idTitulo} className="hoja-viaje-subtitulo">
        Golpe detectado {hora}
      </h3>
      <div className="hoja-viaje-acciones">
        <button
          type="button"
          className="boton-primario"
          onClick={registrar}
          disabled={abriendo}
        >
          {abriendo ? 'Abriendo...' : abierta ? 'Continuar la actuación abierta' : 'Registrar este choque'}
        </button>
        <button
          type="button"
          className="boton boton-secundario boton-ancho"
          onClick={() => motor.descartarGolpePendiente()}
          disabled={abriendo}
        >
          No, fue una falsa alarma
        </button>
      </div>
      {aviso ? (
        <div className="aviso" data-nivel="alerta" role="alert">
          {aviso}
        </div>
      ) : null}
    </section>
  )
}
```

Textos: «Golpe detectado {hora}» es `pildora.golpe`; «Registrar este choque» sale de `tarjeta.golpe`; «Continuar la actuación abierta» es `ayuda.continuar`; «Abriendo...» es `ayuda.abriendo`; «No, fue una falsa alarma» es `hubo_choque.no`; «Sin señal: probá de nuevo cuando vuelva la señal.» es `hoja.borrado_sin_red` (el `ayuda.sin_senal` habla de «los botones de arriba», que en la hoja no están).

- [ ] **Step 5: Declarar la ref de la sección `'golpe'` y desplazarse a ella**

La hoja de F4 declara sus refs de sección dentro de `function HojaViaje(`, no en el proveedor (plan F4, Tarea 5, Step 6). En `app/components/ModoViaje.tsx`, reemplazar:

```tsx
  const refEstado = useRef<HTMLElement | null>(null)
  const refPermisos = useRef<HTMLElement | null>(null)
  const refDatos = useRef<HTMLElement | null>(null)
```

por:

```tsx
  const refGolpe = useRef<HTMLElement | null>(null)
  const refEstado = useRef<HTMLElement | null>(null)
  const refPermisos = useRef<HTMLElement | null>(null)
  const refDatos = useRef<HTMLElement | null>(null)
```

y reemplazar:

```tsx
    const destino = seccion === 'datos' ? refDatos : seccion === 'permisos' ? refPermisos : refEstado
```

por:

```tsx
    const destino =
      seccion === 'golpe' ? refGolpe : seccion === 'datos' ? refDatos : seccion === 'permisos' ? refPermisos : refEstado
```

Run: `npm run tipos`

Expected: sin salida, código 0.

- [ ] **Step 6: Dibujar la sección como primera de la hoja**

En `function HojaViaje(` de `app/components/ModoViaje.tsx`, reemplazar:

```tsx
        <button type="button" className="boton boton-fantasma hoja-viaje-cerrar" onClick={alCerrar}>
          Cerrar
        </button>
      </div>

      {encendido ? (
        <section className="hoja-viaje-seccion" ref={refEstado}>
```

por:

```tsx
        <button type="button" className="boton boton-fantasma hoja-viaje-cerrar" onClick={alCerrar}>
          Cerrar
        </button>
      </div>

      {estado.golpePendiente !== null ? (
        <SeccionGolpePendiente golpe={estado.golpePendiente} motor={motor} refSeccion={refGolpe} alCerrar={alCerrar} />
      ) : null}

      {encendido ? (
        <section className="hoja-viaje-seccion" ref={refEstado}>
```

`estado`, `motor` (ya no nulo: el proveedor dibuja `HojaViaje` sólo con `motor !== null`) y `alCerrar` son las props de `HojaViaje`.

Run: `npm run tipos`

Expected: sin salida, código 0.

- [ ] **Step 7: Sumar el golpe pendiente a la regla y al rótulo de la píldora**

La regla y los rótulos viven juntos en `pildoraDe` (plan F4, Tarea 5, Step 3). Se reemplaza `interface Pildora` y la función entera: la regla suma los dos términos de `golpePendiente` del índice («Regla de la píldora (F4)»), la primera rama es la fila `golpePendiente` («Rótulo y toque de la píldora») y el punto deja de ser un booleano, porque el golpe pendiente pide un tercer valor, `error`.

En `app/components/ModoViaje.tsx`, reemplazar:

```tsx
interface Pildora {
  rotulo: string
  /** 'seguir' y 'reanudar' actúan sin abrir nada; 'hoja' abre la hoja de opciones. */
  toque: 'seguir' | 'reanudar' | 'hoja'
  enEspera: boolean
}

/**
 * Si la píldora se ve y qué dice. Nunca muestra la velocidad: se mira de reojo, manejando.
 * Con una alerta no hay píldora, y con un campo enfocado tampoco: con el teclado abierto
 * taparía lo que se está escribiendo.
 */
function pildoraDe(estado: EstadoModoViaje, campoConFoco: boolean, tarjetaQuedoArriba: boolean): Pildora | null {
  const intencion = conIntencion(estado)
  const pideAccion =
    estado.inactividad !== null ||
    estado.fase === 'reanudar_con_toque' ||
    (estado.fase === 'activo' && estado.avisos.sonido === 'requiere_toque')
  const visible =
    estado.alerta === null &&
    !campoConFoco &&
    ((estado.ruta.conPildora && intencion) || (estado.ruta.actual === '/' && pideAccion && tarjetaQuedoArriba))
  if (!visible) return null
  if (estado.inactividad !== null) return { rotulo: '¿Terminaste el viaje? Tocá para seguir', toque: 'seguir', enEspera: true }
  if (estado.fase === 'reanudar_con_toque') return { rotulo: 'Modo viaje: tocá para reanudar', toque: 'reanudar', enEspera: true }
  // Tocar la píldora ya destraba el audio: el destrabador del motor escucha cualquier toque.
  if (estado.avisos.sonido === 'requiere_toque') return { rotulo: 'Tocá para activar el sonido del aviso', toque: 'hoja', enEspera: true }
  if (estado.fase === 'en_pausa') return { rotulo: 'Modo viaje en pausa', toque: 'hoja', enEspera: true }
  return { rotulo: 'Modo viaje activo', toque: 'hoja', enEspera: false }
}
```

por:

```tsx
interface Pildora {
  rotulo: string
  /** 'seguir' y 'reanudar' actúan sin abrir nada; 'hoja' abre la hoja de opciones y 'golpe' la abre en el golpe pendiente. */
  toque: 'seguir' | 'reanudar' | 'hoja' | 'golpe'
  punto: 'ok' | 'espera' | 'error'
}

/**
 * Si la píldora se ve y qué dice. Nunca muestra la velocidad: se mira de reojo, manejando.
 * Con una alerta no hay píldora, y con un campo enfocado tampoco: con el teclado abierto
 * taparía lo que se está escribiendo.
 *
 * El golpe pendiente la muestra aunque el modo esté apagado (§3.5): sobrevive al apagado y es
 * algo que la persona tiene que resolver, así que va primero y con el punto en error.
 */
function pildoraDe(estado: EstadoModoViaje, campoConFoco: boolean, tarjetaQuedoArriba: boolean): Pildora | null {
  const intencion = conIntencion(estado)
  const pideAccion =
    estado.golpePendiente !== null ||
    estado.inactividad !== null ||
    estado.fase === 'reanudar_con_toque' ||
    (estado.fase === 'activo' && estado.avisos.sonido === 'requiere_toque')
  const visible =
    estado.alerta === null &&
    !campoConFoco &&
    ((estado.ruta.conPildora && (intencion || estado.golpePendiente !== null)) ||
      (estado.ruta.actual === '/' && pideAccion && tarjetaQuedoArriba))
  if (!visible) return null
  if (estado.golpePendiente !== null) {
    return { rotulo: `Golpe detectado ${horaCorta(estado.golpePendiente.ocurridoEn)}`, toque: 'golpe', punto: 'error' }
  }
  if (estado.inactividad !== null) return { rotulo: '¿Terminaste el viaje? Tocá para seguir', toque: 'seguir', punto: 'espera' }
  if (estado.fase === 'reanudar_con_toque') return { rotulo: 'Modo viaje: tocá para reanudar', toque: 'reanudar', punto: 'espera' }
  // Tocar la píldora ya destraba el audio: el destrabador del motor escucha cualquier toque.
  if (estado.avisos.sonido === 'requiere_toque') return { rotulo: 'Tocá para activar el sonido del aviso', toque: 'hoja', punto: 'espera' }
  if (estado.fase === 'en_pausa') return { rotulo: 'Modo viaje en pausa', toque: 'hoja', punto: 'espera' }
  return { rotulo: 'Modo viaje activo', toque: 'hoja', punto: 'ok' }
}
```

`horaCorta` es la función de F4 al final del archivo (plan F4, Tarea 6, Step 3): `toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })`, el formato de `pildora.golpe`. Es una declaración de función, así que se puede usar desde más arriba.

Run: `npm run tipos`

Expected: código 1 y exactamente un error, en la línea del `<span className="punto"` de la píldora (lo arregla el Step 8):

```text
app/components/ModoViaje.tsx(<línea>,<columna>): error TS2339: Property 'enEspera' does not exist on type 'Pildora'.
```

- [ ] **Step 8: El botón de la píldora abre la hoja en el golpe y pinta su punto**

En el `return` del proveedor, reemplazar:

```tsx
            aria-haspopup={pildora.toque === 'hoja' ? 'dialog' : undefined}
            aria-expanded={pildora.toque === 'hoja' ? hoja !== null : undefined}
          >
            <span className="punto" data-estado={pildora.enEspera ? 'espera' : 'ok'} />
```

por:

```tsx
            aria-haspopup={pildora.toque === 'hoja' || pildora.toque === 'golpe' ? 'dialog' : undefined}
            aria-expanded={pildora.toque === 'hoja' || pildora.toque === 'golpe' ? hoja !== null : undefined}
          >
            <span className="punto" data-estado={pildora.punto} />
```

y, en `function tocarPildora(`, reemplazar:

```tsx
    else {
      abiertaDesdePildora.current = true
      abrirHoja('estado')
    }
```

por:

```tsx
    else {
      abiertaDesdePildora.current = true
      abrirHoja(pildora.toque === 'golpe' ? 'golpe' : 'estado')
    }
```

Run: `npm run tipos && grep -c "data-estado={pildora.punto}\|abrirHoja(pildora.toque === 'golpe' ? 'golpe' : 'estado')" app/components/ModoViaje.tsx`

Expected: `tipos` sin salida y después `2`.

- [ ] **Step 9: Crear el bloque del golpe en la tarjeta**

En `app/page.tsx`, inmediatamente antes de estas líneas (el comentario de F4 que encabeza `TarjetaModoViaje`):

```tsx
/**
 * La tarjeta del modo viaje.
```

insertar:

```tsx
/**
 * El golpe que quedó sin decidir (§3.5), en el lugar de la línea de estado de la tarjeta. Se muestra
 * aunque el modo esté apagado: el golpe sobrevive al apagado y a la recarga.
 *
 * Registra por el mismo camino que la ayuda (§3.4): con una actuación abierta en este teléfono lleva
 * a ésa, y si no el motor sube lo pendiente de esa alerta y abre la actuación vinculada. La tarjeta
 * crece sólo con el aviso de error, que aparece después de un toque de la persona.
 */
function GolpeEnTarjeta({
  golpe,
  motor,
}: {
  golpe: NonNullable<ReturnType<typeof useModoViaje>['estado']['golpePendiente']>
  motor: ReturnType<typeof useModoViaje>['motor']
}) {
  const router = useRouter()
  const [abierta, setAbierta] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)
  const [aviso, setAviso] = useState<string | null>(null)
  const hora = horaCorta(golpe.ocurridoEn)

  useEffect(() => {
    setAbierta(actuacionAbierta())
  }, [])

  async function registrar() {
    const abiertaAhora = actuacionAbierta()
    if (abiertaAhora) {
      router.push(`/s/${abiertaAhora}`)
      return
    }
    if (motor === null) return
    setAbriendo(true)
    setAviso(null)
    const resultado = await motor.registrarAccidente({ idCliente: golpe.telemetriaIdCliente, idServidor: golpe.telemetriaId })
    if (resultado.tipo === 'creada') {
      router.push(`/s/${resultado.id}`)
      return
    }
    setAbriendo(false)
    setAviso(resultado.tipo === 'sin_red' ? 'Sin señal: probá de nuevo cuando vuelva la señal.' : resultado.mensaje)
  }

  return (
    <div className="tarjeta-viaje-golpe">
      <button
        type="button"
        className="boton boton-secundario boton-ancho"
        onClick={registrar}
        disabled={abriendo || (motor === null && abierta === null)}
      >
        {abriendo
          ? 'Abriendo...'
          : abierta
            ? `Golpe detectado ${hora} · Continuar la actuación abierta`
            : `Golpe detectado ${hora} · Registrar este choque`}
      </button>
      {aviso ? (
        <div className="aviso" data-nivel="alerta" role="alert">
          {aviso}
        </div>
      ) : null}
    </div>
  )
}
```

`app/page.tsx` ya importa `useEffect`, `useState`, `useRouter` y `actuacionAbierta`, F4 importa `useModoViaje` y declara `horaCorta` en el mismo archivo (plan F4, Tarea 4): no hace falta ningún import nuevo.

- [ ] **Step 10: Poner el golpe en el lugar de la línea de estado**

`TarjetaModoViaje` ya toma `motor` de `useModoViaje()` (plan F4, Tarea 4). En `app/page.tsx`, reemplazar:

```tsx
      {linea !== null && !textoEsBoton ? (
        <p className="tarjeta-viaje-estado">
          {linea.punto !== null ? <span className="punto" data-estado={linea.punto} /> : null}
          {linea.texto}
        </p>
      ) : null}
```

por:

```tsx
      {estado.golpePendiente !== null ? (
        <GolpeEnTarjeta golpe={estado.golpePendiente} motor={motor} />
      ) : linea !== null && !textoEsBoton ? (
        <p className="tarjeta-viaje-estado">
          {linea.punto !== null ? <span className="punto" data-estado={linea.punto} /> : null}
          {linea.texto}
        </p>
      ) : null}
```

(§3.1: «Una línea de estado y una acción»; el golpe pendiente es esa línea y su acción es registrar. El botón de acción de `.tarjeta-viaje-pie` y el interruptor quedan como están: siguen hablando del modo, no del golpe.)

Run: `npm run tipos && grep -c "<GolpeEnTarjeta golpe={estado.golpePendiente} motor={motor} />" app/page.tsx`

Expected: `tipos` sin salida y después `1`.

- [ ] **Step 11: Correr el contrato y ver que faltan las dos clases**

Run: `npm run tipos && npm run contrato`

Expected: `tipos` sin salida, y el contrato falla exactamente con:

```
  FALLA toda clase del marcado está definida en globals.css
         .hoja-viaje-golpe (app/components/ModoViaje.tsx), .tarjeta-viaje-golpe (app/page.tsx)
         Una clase que no existe no falla: el elemento sale sin estilo y sólo se ve abriendo esa pantalla en ese estado.
```

y `1 FALLARON. El contrato está en docs/CONTRATO-UI.md.`

- [ ] **Step 12: Sumar las clases del golpe pendiente**

En `app/globals.css`, inmediatamente antes de las líneas

```css
@media (prefers-reduced-motion: reduce) {
  .opcion,
```

(es decir, a continuación del bloque «Ayuda después de un golpe» de la Tarea 1), insertar:

```css
/* ---------- Golpe pendiente ---------- */

/*
 * El golpe que quedó sin decidir ocupa el lugar de la línea de estado de la tarjeta y encabeza la
 * hoja. Va en --alerta, el mismo nivel que el punto de la píldora (data-estado="error"): no es un
 * estado más del modo viaje, es algo que la persona tiene que resolver.
 */
.tarjeta-viaje-golpe {
  display: grid;
  gap: 10px;
}

.tarjeta-viaje-golpe .boton-secundario {
  color: var(--alerta);
  border-color: rgb(var(--alerta-rgb) / 0.45);
}

@media (hover: hover) {
  .tarjeta-viaje-golpe .boton-secundario:hover:not(:disabled) {
    background: var(--alerta-fondo);
    border-color: var(--alerta);
  }
}

.tarjeta-viaje-golpe .aviso {
  margin-bottom: 0;
}

.hoja-viaje-golpe .hoja-viaje-subtitulo {
  color: var(--alerta);
}

.hoja-viaje-golpe .aviso {
  margin: 12px 0 0;
}

```

Run: `npm run contrato`

Expected: `El contrato se cumple.`

- [ ] **Step 13: Verificar en el navegador y medir la tarjeta**

Con `npm run dev` corriendo y el golpe pendiente del Step 1 todavía guardado (si ya venció, volver a pegar ese fragmento), recargar `http://localhost:3000/`.

Expected (si ese navegador ya tiene una actuación abierta —`localStorage.getItem('acta:actuacion-abierta')` no da `null`—, donde dice «Registrar este choque» dice «Continuar la actuación abierta»):
1. En la tarjeta, en lugar de la línea de estado, un botón con borde y texto en el color de alerta: «Golpe detectado HH:MM · Registrar este choque», con HH:MM la hora de hace dos minutos en 24 h.
2. En `http://localhost:3000/cuenta`, con el modo apagado, la píldora abajo al centro dice «Golpe detectado HH:MM» con el punto rojo (`data-estado="error"` en Elements) y lleva `aria-haspopup="dialog"`.
3. Tocar la píldora abre la hoja, arriba de todo, en la sección «Golpe detectado HH:MM» con «Registrar este choque» y «No, fue una falsa alarma».
4. Tocar «No, fue una falsa alarma»: la sección desaparece, la hoja sigue abierta con el resto; al cerrarla ya no hay píldora, y `localStorage.getItem('acta:golpe-pendiente')` en la consola da `null`.
5. Volver a guardar el golpe pendiente del Step 1, ir a `/cuenta`, abrir la hoja desde la píldora y tocar «Registrar este choque»: la pantalla pasa a `/s/ADS-…` (o a la actuación abierta) y la hoja no queda abierta encima del recorrido. En la base de desarrollo queda una actuación nueva: es esperable.

Medición (§3.1 «Alto fijo»; el golpe pendiente es un estado nuevo de la tarjeta): volver a guardar el golpe pendiente del Step 1, activar DevTools › Toggle device toolbar en 375 × 667, recargar `/`, seleccionar `section.tarjeta-viaje` y leer en Computed su `height`. Después del punto 5 el navegador tiene una actuación abierta, así que la tarjeta muestra la variante más larga del botón, «Golpe detectado HH:MM · Continuar la actuación abierta»: es la que se mide. Si es mayor que el `min-height` de la regla `.tarjeta-viaje` de `app/globals.css`, subir ese `min-height` a ese alto redondeado hacia arriba al píxel entero, y reemplazar en `docs/MAPA-PANTALLAS.md` el alto de la tarjeta en 375×667 que anotó F4 por el mismo número. Si no es mayor, no se cambia nada. Al terminar, `localStorage.removeItem('acta:golpe-pendiente')`.

- [ ] **Step 14: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.`, sin ninguna línea `  FALLA`.

- [ ] **Step 15: Commit**

Si el Step 13 no cambió el `min-height`, se omite `"docs/MAPA-PANTALLAS.md"` del `git add`.

```bash
git add "app/components/ModoViaje.tsx" "app/page.tsx" "app/globals.css" "docs/MAPA-PANTALLAS.md"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Mostrar el golpe pendiente en la tarjeta, la píldora y la hoja

Un golpe que quedó sin decidir —«Estoy bien» con el auto andando, «¿Hubo un
choque?» sin respuesta o la ayuda reducida porque el auto volvió a moverse— ya
se guardaba en el teléfono, pero no se veía en ningún lado. Ahora ocupa la línea
de estado de la tarjeta aunque el modo esté apagado, muestra la píldora con el
punto rojo y abre la hoja en una sección propia.

Registrar abre la actuación vinculada por el mismo camino que la ayuda: con una
actuación ya abierta en el teléfono lleva a ésa, para no duplicar el siniestro.
«No, fue una falsa alarma» lo borra.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: El contrato de datos personales en eslabones revisa también `lib/`

Índice F5.3, primera parte: «contrato de datos personales extendido a `lib/`» (§6.3; índice «Pruebas: convenciones», fila de `[5]` de F5). Va antes del alta vinculada para que el eslabón nuevo de `lib/casos.ts` nazca vigilado.

**Files:**
- Modify: `scripts/prueba-contrato.mjs` (el bloque que empieza con el comentario `Ningún dato personal en claro dentro del detalle de un eslabón.`, en la sección `[5] Lo que el expediente no perdona`; en `f47005e`, líneas 533–576)
- Test: `npm run contrato`

**Interfaces:**
- Consumes: `archivos(dir, filtro)`, `leer(ruta)`, `normalizar(ruta)` y `verificar(nombre, condicion, extra)`, ya definidos en `scripts/prueba-contrato.mjs`.
- Produces: la comprobación `ningún dato personal en claro dentro de un eslabón` sobre `app/api/**/route.ts` y `lib/**/*.ts` salvo `lib/hash.ts`, con `PROHIBIDAS` + `lat`, `lon`, `ubicacion`, `kmh`, y dos comprobaciones nuevas que prueban que puede fallar.

- [ ] **Step 1: Escribir las dos comprobaciones nuevas sobre la búsqueda refactorizada (con las listas de hoy)**

En `scripts/prueba-contrato.mjs`, reemplazar:

```js
  const PROHIBIDAS = [
    'nombre', 'telefono', 'asegurado', 'dni', 'patente', 'poliza',
    'gps', 'direccion', 'domicilio', 'valores',
  ]
  const infractores = []
  for (const ruta of archivos('app/api', (n) => n === 'route.ts')) {
    const c = leer(ruta)
    let desde = 0
    for (;;) {
      const i = c.indexOf('registrarEvento(', desde)
      if (i < 0) break
      desde = i + 16
      // El objeto de opciones va después del detalle: se corta ahí para no mirar lo reservado.
      const trozo = c.slice(i, i + 800).split('{ reservado')[0]
      for (const clave of PROHIBIDAS) {
        for (const forma of ['{ ' + clave + ':', ', ' + clave + ':', '  ' + clave + ':', '{ ' + clave + ',', ', ' + clave + ',']) {
          if (trozo.includes(forma)) {
            infractores.push(normalizar(ruta) + ': ' + clave)
            break
          }
        }
      }
    }
  }
  verificar(
```

por:

```js
  const PROHIBIDAS = [
    'nombre', 'telefono', 'asegurado', 'dni', 'patente', 'poliza',
    'gps', 'direccion', 'domicilio', 'valores',
  ]
  /**
   * Las claves prohibidas que aparecen en claro en cada registrarEvento( del texto. Una mención dentro
   * de un comentario no es una llamada: sin saltearla, la documentación de una función que registra
   * un eslabón haría gritar a la comprobación sin motivo.
   */
  function datosEnEslabones(texto) {
    const encontradas = []
    let desde = 0
    for (;;) {
      const i = texto.indexOf('registrarEvento(', desde)
      if (i < 0) break
      desde = i + 16
      const antes = texto.slice(texto.lastIndexOf('\n', i) + 1, i).trim()
      if (antes.startsWith('*') || antes.startsWith('//') || antes.startsWith('/*')) continue
      // El objeto de opciones va después del detalle: se corta ahí para no mirar lo reservado.
      const trozo = texto.slice(i, i + 800).split('{ reservado')[0]
      for (const clave of PROHIBIDAS) {
        for (const forma of ['{ ' + clave + ':', ', ' + clave + ':', '  ' + clave + ':', '{ ' + clave + ',', ', ' + clave + ',']) {
          if (trozo.includes(forma)) {
            encontradas.push(clave)
            break
          }
        }
      }
    }
    return encontradas
  }
  /*
   * También lib/, salvo lib/hash.ts, que es donde se define registrarEvento: desde el modo viaje el
   * eslabón de apertura de una actuación abierta desde un golpe se registra en lib/casos.ts.
   */
  const revisadas = [
    ...archivos('app/api', (n) => n === 'route.ts'),
  ]
  verificar(
    'la comprobación de datos personales en eslabones recorre las rutas y lib/, salvo lib/hash.ts',
    revisadas.some((r) => normalizar(r) === 'lib/casos.ts') &&
      revisadas.some((r) => normalizar(r).startsWith('app/api/')) &&
      !revisadas.some((r) => normalizar(r) === 'lib/hash.ts'),
    'lib/casos.ts registra el eslabón de apertura desde un golpe: si lib/ no se revisa, una coordenada en claro pasa en verde.',
  )
  verificar(
    'la comprobación de datos personales en eslabones detecta una coordenada en claro y respeta lo reservado',
    JSON.stringify(datosEnEslabones("await registrarEvento(id, 'x', { lat: 1, lon: 2, ubicacion: 'u', kmh: 3 }, { reservado: { poliza } })")) ===
      JSON.stringify(['lat', 'lon', 'ubicacion', 'kmh']) &&
      datosEnEslabones("await registrarEvento(id, 'x', { user_agent }, { reservado: { poliza, lat } })").length === 0 &&
      datosEnEslabones(" * registrarEvento(id, 'x', { lat: 1 })").length === 0,
    'Una comprobación que no puede fallar es peor que ninguna: el eslabón armado a mano tiene que dar exactamente lat, lon, ubicacion y kmh.',
  )
  const infractores = []
  for (const ruta of revisadas) {
    for (const clave of datosEnEslabones(leer(ruta))) infractores.push(normalizar(ruta) + ': ' + clave)
  }
  verificar(
```

(El `verificar(` final es el que ya existía, `'ningún dato personal en claro dentro de un eslabón'`, y sigue igual.)

- [ ] **Step 2: Correr el contrato y ver fallar las dos comprobaciones nuevas**

Run: `npm run contrato`

Expected: el resto sigue en `ok` (incluida `ok   ningún dato personal en claro dentro de un eslabón`) y fallan exactamente:

```
  FALLA la comprobación de datos personales en eslabones recorre las rutas y lib/, salvo lib/hash.ts
         lib/casos.ts registra el eslabón de apertura desde un golpe: si lib/ no se revisa, una coordenada en claro pasa en verde.
  FALLA la comprobación de datos personales en eslabones detecta una coordenada en claro y respeta lo reservado
         Una comprobación que no puede fallar es peor que ninguna: el eslabón armado a mano tiene que dar exactamente lat, lon, ubicacion y kmh.
```

con `2 FALLARON. El contrato está en docs/CONTRATO-UI.md.` al final.

- [ ] **Step 3: Sumar las cuatro claves del modo viaje**

En `scripts/prueba-contrato.mjs`, reemplazar:

```js
    'gps', 'direccion', 'domicilio', 'valores',
  ]
```

por:

```js
    'gps', 'direccion', 'domicilio', 'valores',
    // Del modo viaje: una coordenada o una velocidad en claro dicen dónde estaba alguien y a qué hora.
    'lat', 'lon', 'ubicacion', 'kmh',
  ]
```

- [ ] **Step 4: Sumar `lib/` al recorrido**

En `scripts/prueba-contrato.mjs`, reemplazar:

```js
  const revisadas = [
    ...archivos('app/api', (n) => n === 'route.ts'),
  ]
```

por:

```js
  const revisadas = [
    ...archivos('app/api', (n) => n === 'route.ts'),
    ...archivos('lib', (n) => n.endsWith('.ts')).filter((r) => normalizar(r) !== 'lib/hash.ts'),
  ]
```

- [ ] **Step 5: Correr el contrato en verde**

Run: `npm run contrato`

Expected: `El contrato se cumple.`, con estas tres líneas en `[5]`:

```
  ok   la comprobación de datos personales en eslabones recorre las rutas y lib/, salvo lib/hash.ts
  ok   la comprobación de datos personales en eslabones detecta una coordenada en claro y respeta lo reservado
  ok   ningún dato personal en claro dentro de un eslabón
```

Si en cambio aparece `  FALLA ningún dato personal en claro dentro de un eslabón` con un archivo de `lib/` en el detalle, es un `registrarEvento(` real con un dato en claro en código de una fase anterior: se frena y se reporta; no se toca la lista para que pase.

- [ ] **Step 6: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.`, sin ninguna línea `  FALLA`.

- [ ] **Step 7: Commit**

```bash
git add "scripts/prueba-contrato.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Revisar también lib/ en busca de datos personales dentro de un eslabón

La comprobación sólo miraba las rutas de app/api, pero el eslabón de apertura de
una actuación abierta desde un golpe se registra en lib/casos.ts. Ahora recorre
también lib/ (salvo lib/hash.ts, que define registrarEvento) y suma lat, lon,
ubicacion y kmh: una coordenada o una velocidad en claro dentro del hash ubican a
alguien en un momento y no se pueden borrar nunca.

Dos comprobaciones nuevas prueban que puede fallar: un eslabón armado a mano con
esas claves tiene que dar exactamente las cuatro, y lo reservado y los
comentarios no cuentan.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `detalleAperturaImpacto`, `abrirActuacionDesdeImpacto` y `[V8]`

Índice F5.3, segunda parte: la lógica del alta vinculada en `lib/casos.ts`, probada sin base. §5.3 pasos 1–8; riesgos 1, 2, 3, 6, 9 y 10.

**Files:**
- Modify: `scripts/prueba-viaje.mjs` (sección nueva `[V8]` inmediatamente antes de `/* ---------- Resultado ---------- */`)
- Modify: `lib/casos.ts` (imports, hoy líneas 1–3; bloque nuevo al final, después de `contarTerceros`, hoy línea 289)
- Test: `SECCION=V8 npx tsx scripts/prueba-viaje.mjs`

**Interfaces:**
- Consumes:
  - `accesoTelemetria(fila: DuenioTelemetria, quien: QuienPide, ahoraMs: number): boolean` y `interface QuienPide { huella: string | null; usuarioId: string | null }` de `lib/telemetria.ts` (F1).
  - `registrarEvento(casoId: string, tipo: string, detalle?: Record<string, unknown>, opciones?: OpcionesEvento): Promise<{ hash: string; id: number }>` con `aJsonPuro` (F1) y `VERSION_MANIFIESTO` de `lib/hash.ts`; `nuevoId(prefijo?: string): string` de `lib/db.ts`; `PoolClient` de `pg`.
  - En las pruebas: `canonico` y `hashEvento` de `lib/hash.ts`; la caché del pool de `lib/db.ts` en `globalThis._pool` y `globalThis._schemaLista`.
- Produces (índice «Interfaces › `lib/casos.ts` (F5)»):
  - `export type DetalleAperturaImpacto = { user_agent: string | null; origen: 'impacto'; telemetria_id: string; nivel: string; pico_g: number | null; ocurrido_en_telefono: string | null; desfase_reloj_ms: number | null }`
  - `export function detalleAperturaImpacto(fila: { id: string; nivel: string; pico_g: number | null; ocurrido_en_telefono: Date | string | null; desfase_reloj_ms: number | string | null }, userAgent: string | null): DetalleAperturaImpacto`
  - `export interface AltaDesdeImpacto { telemetriaId: string; quien: QuienPide; caratula: { poliza: string | null; patente: string | null; asegurado: string | null; telefono: string | null; poliza_id: string | null }; userAgent: string | null; secretoSha256: string }`
  - `export type ResultadoAltaImpacto = { tipo: 'nueva'; id: string; vinculo: 'ok' | 'rechazado' } | { tipo: 'repetida'; id: string }`
  - `export async function abrirActuacionDesdeImpacto(cliente: PoolClient, alta: AltaDesdeImpacto): Promise<ResultadoAltaImpacto>` (la usa `POST /api/casos` en la Tarea 6).

- [ ] **Step 1: Escribir `[V8]`**

En `scripts/prueba-viaje.mjs`, inmediatamente antes de la línea `/* ---------- Resultado ---------- */`, insertar (seguida de una línea en blanco):

```js
await seccion('V8', 'Alta vinculada', async () => {
  const { detalleAperturaImpacto, abrirActuacionDesdeImpacto } = await import('../lib/casos.ts')
  const { canonico, hashEvento } = await import('../lib/hash.ts')

  /* ---------- El detalle del eslabón de apertura ---------- */

  const soloPrimitivas = (objeto) =>
    Object.values(objeto).every((v) => v === null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')

  const conFecha = detalleAperturaImpacto(
    { id: 'TEL-AAAAAA', nivel: 'sospecha', pico_g: 6.5, ocurrido_en_telefono: new Date('2026-09-16T11:59:30.000Z'), desfase_reloj_ms: '-120' },
    'prueba',
  )
  verificar(
    'detalleAperturaImpacto pasa la fecha a ISO y el BIGINT en texto a número',
    JSON.stringify(conFecha) ===
      JSON.stringify({ user_agent: 'prueba', origen: 'impacto', telemetria_id: 'TEL-AAAAAA', nivel: 'sospecha', pico_g: 6.5, ocurrido_en_telefono: '2026-09-16T11:59:30.000Z', desfase_reloj_ms: -120 }),
    JSON.stringify(conFecha),
  )
  verificar('detalleAperturaImpacto devuelve sólo primitivas', soloPrimitivas(conFecha), JSON.stringify(conFecha))
  verificar(
    'el detalle de apertura se serializa igual antes y después de guardarlo como JSON',
    canonico(conFecha) === canonico(JSON.parse(JSON.stringify(conFecha))),
  )
  const base = { caso_id: 'ADS-AAAAAA', ts: '2026-09-16T12:00:00.000Z', tipo: 'apertura_actuacion', hash_previo: null }
  verificar(
    'el hash del detalle de apertura es el fijado en el plan',
    hashEvento({ ...base, detalle: conFecha }) === '5ee7f2439daa12ad2db59a2417a51e1e72a03c383c3c038bdd6f03674f784814',
    hashEvento({ ...base, detalle: conFecha }),
  )

  const vacio = detalleAperturaImpacto({ id: 'TEL-BBBBBB', nivel: 'nada', pico_g: null, ocurrido_en_telefono: null, desfase_reloj_ms: null }, null)
  verificar(
    'detalleAperturaImpacto deja en null lo que no vino',
    JSON.stringify(vacio) ===
      JSON.stringify({ user_agent: null, origen: 'impacto', telemetria_id: 'TEL-BBBBBB', nivel: 'nada', pico_g: null, ocurrido_en_telefono: null, desfase_reloj_ms: null }),
    JSON.stringify(vacio),
  )

  const raro = detalleAperturaImpacto(
    { id: 'TEL-CCCCCC', nivel: 'confirmado', pico_g: Number.NaN, ocurrido_en_telefono: new Date('no es una fecha'), desfase_reloj_ms: 'abc' },
    undefined,
  )
  verificar(
    'detalleAperturaImpacto convierte NaN, una fecha inválida, un texto no numérico y undefined en null',
    raro.pico_g === null && raro.ocurrido_en_telefono === null && raro.desfase_reloj_ms === null && raro.user_agent === null && soloPrimitivas(raro),
    JSON.stringify(raro),
  )

  const enTexto = detalleAperturaImpacto(
    { id: 'TEL-DDDDDD', nivel: 'sospecha', pico_g: 7, ocurrido_en_telefono: '2026-09-16T11:59:30Z', desfase_reloj_ms: 250 },
    'x',
  )
  verificar(
    'detalleAperturaImpacto normaliza una fecha en texto a ISO y conserva los números',
    enTexto.ocurrido_en_telefono === '2026-09-16T11:59:30.000Z' && enTexto.desfase_reloj_ms === 250 && enTexto.pico_g === 7,
    JSON.stringify(enTexto),
  )

  /* ---------- La transacción del alta, contra un cliente falso ---------- */

  /*
   * registrarEvento pide db() antes de usar el cliente que recibe. Con el esquema marcado como listo y
   * un pool que se niega a todo, db() no toca ninguna base, y si algo intentara salir de la transacción
   * fallaría con nombre. _pool y _schemaLista son los nombres de la caché de lib/db.ts en globalThis.
   */
  const poolPrevio = globalThis._pool
  const esquemaPrevio = globalThis._schemaLista
  globalThis._schemaLista = Promise.resolve()
  globalThis._pool = {
    connect: async () => {
      throw new Error('[V8] registrarEvento pidió una conexión propia: tiene que usar el cliente de la transacción')
    },
    query: async () => {
      throw new Error('[V8] una consulta salió por el pool y no por el cliente de la transacción')
    },
  }

  /** Cliente de pg falso: anota cada consulta con el SQL en una línea y contesta según cómo empieza. */
  function clienteFalso({ telemetria = null, conflictos = 0, filasVinculadas = 1, fallaCon = null } = {}) {
    const consultas = []
    let altas = 0
    return {
      consultas,
      sqls: () => consultas.map((c) => c.sql),
      async query(sql, params = []) {
        const texto = String(sql).replace(/\s+/g, ' ').trim()
        consultas.push({ sql: texto, params })
        if (fallaCon !== null && texto.startsWith(fallaCon)) throw new Error(`falla simulada en ${fallaCon}`)
        if (texto.startsWith('SELECT id, nivel')) return { rows: telemetria ? [telemetria] : [], rowCount: telemetria ? 1 : 0 }
        if (texto.startsWith('INSERT INTO casos')) {
          altas++
          return altas <= conflictos ? { rows: [], rowCount: 0 } : { rows: [{ id: params[0] }], rowCount: 1 }
        }
        if (texto.startsWith('UPDATE telemetria SET caso_id')) return { rows: [], rowCount: filasVinculadas }
        if (texto.startsWith('UPDATE casos SET secreto_sha256')) return { rows: [], rowCount: 1 }
        if (texto.startsWith('SELECT estado FROM casos')) return { rows: [{ estado: 'abierto' }], rowCount: 1 }
        if (texto.startsWith('INSERT INTO eventos (')) return { rows: [{ id: '1' }], rowCount: 1 }
        return { rows: [], rowCount: 0 }
      },
      release() {},
    }
  }

  const filaPropia = {
    id: 'TEL-AAAAAA',
    nivel: 'sospecha',
    pico_g: 6.5,
    ocurrido_en_telefono: new Date('2026-09-16T11:59:30.000Z'),
    desfase_reloj_ms: '-120',
    caso_id: null,
    usuario_id: null,
    dispositivo_sha256: 'huella-propia',
    recibido_en: new Date(),
  }
  const alta = (telemetriaId = 'TEL-AAAAAA', quien = { huella: 'huella-propia', usuarioId: null }) => ({
    telemetriaId,
    quien,
    caratula: { poliza: 'POL-1', patente: 'AB123CD', asegurado: null, telefono: null, poliza_id: null },
    userAgent: 'prueba',
    secretoSha256: 'sha-del-secreto',
  })
  /** El detalle que registrarEvento guardó: el parámetro JSON del INSERT de eventos que trae user_agent. */
  const detalleDe = (cliente) => {
    const insercion = cliente.consultas.find((c) => c.sql.startsWith('INSERT INTO eventos ('))
    for (const valor of insercion?.params ?? []) {
      if (typeof valor !== 'string' || !valor.startsWith('{')) continue
      const objeto = JSON.parse(valor)
      if ('user_agent' in objeto) return objeto
    }
    return null
  }
  const fallaDe = async (fn) => {
    try {
      await fn()
      return null
    } catch (err) {
      return err
    }
  }

  try {
    {
      const cliente = clienteFalso({ telemetria: filaPropia })
      const r = await abrirActuacionDesdeImpacto(cliente, alta())
      const sqls = cliente.sqls()
      verificar('el alta con la telemetría de este teléfono abre una actuación vinculada', r.tipo === 'nueva' && r.vinculo === 'ok' && /^ADS-[A-Z0-9]{6}$/.test(r.id), JSON.stringify(r))
      verificar(
        'la transacción abre con BEGIN, bloquea la telemetría con FOR UPDATE y cierra con COMMIT',
        sqls[0] === 'BEGIN' && sqls[1].startsWith('SELECT id, nivel') && sqls[1].endsWith('FROM telemetria WHERE id = $1 FOR UPDATE') && sqls.at(-1) === 'COMMIT' && !sqls.includes('ROLLBACK'),
        sqls.join(' | '),
      )
      const iAlta = sqls.findIndex((s) => s.startsWith('INSERT INTO casos'))
      const iVinculo = sqls.findIndex((s) => s.startsWith('UPDATE telemetria SET caso_id'))
      const iEslabon = sqls.findIndex((s) => s.startsWith('INSERT INTO eventos ('))
      const insercion = cliente.consultas[iAlta]
      verificar(
        'el número se toma con ON CONFLICT (id) DO NOTHING RETURNING id y la actuación nace con origen impacto',
        insercion?.sql.endsWith('ON CONFLICT (id) DO NOTHING RETURNING id') && insercion.params[0] === r.id && insercion.params.at(-1) === 'impacto' && insercion.params.includes('sha-del-secreto'),
        JSON.stringify(insercion),
      )
      verificar(
        'el vínculo exige caso_id IS NULL y va entre el alta y el eslabón',
        iAlta < iVinculo && iVinculo < iEslabon && sqls[iVinculo].endsWith('AND caso_id IS NULL') && JSON.stringify(cliente.consultas[iVinculo].params) === JSON.stringify([r.id, 'TEL-AAAAAA']),
        sqls.join(' | '),
      )
      const detalle = detalleDe(cliente)
      verificar(
        'el eslabón de apertura lleva origen, telemetría, nivel y horas, sólo con primitivas',
        detalle?.origen === 'impacto' && detalle.telemetria_id === 'TEL-AAAAAA' && detalle.nivel === 'sospecha' && detalle.ocurrido_en_telefono === '2026-09-16T11:59:30.000Z' && detalle.desfase_reloj_ms === -120 && soloPrimitivas(detalle),
        JSON.stringify(detalle),
      )
      verificar(
        'el eslabón no lleva ubicación, velocidad ni carátula en claro, y compromete la carátula aparte',
        detalle !== null && ['lat', 'lon', 'gps', 'ubicacion', 'kmh', 'poliza', 'patente'].every((k) => !(k in detalle)) && typeof detalle.reservado_sha256 === 'string',
        JSON.stringify(detalle),
      )
      verificar('ninguna consulta del alta usa SAVEPOINT', sqls.every((s) => !s.includes('SAVEPOINT')), sqls.join(' | '))
    }

    {
      const cliente = clienteFalso({ telemetria: filaPropia, conflictos: 2 })
      const r = await abrirActuacionDesdeImpacto(cliente, alta())
      const intentos = cliente.consultas.filter((c) => c.sql.startsWith('INSERT INTO casos')).map((c) => c.params[0])
      verificar(
        'un número ocupado se reintenta dentro de la misma transacción, sin SAVEPOINT ni ROLLBACK',
        r.tipo === 'nueva' && intentos.length === 3 && new Set(intentos).size === 3 && r.id === intentos[2] && cliente.sqls().every((s) => !s.includes('SAVEPOINT') && s !== 'ROLLBACK'),
        JSON.stringify(intentos),
      )
    }

    {
      const cliente = clienteFalso({ telemetria: filaPropia, conflictos: 5 })
      const error = await fallaDe(() => abrirActuacionDesdeImpacto(cliente, alta()))
      const sqls = cliente.sqls()
      verificar(
        'cinco números ocupados deshacen la transacción con un mensaje que dice qué pasó',
        error?.message === 'No se pudo generar un número de actuación libre después de cinco intentos.' && sqls.filter((s) => s.startsWith('INSERT INTO casos')).length === 5 && sqls.at(-1) === 'ROLLBACK' && !sqls.includes('COMMIT'),
        `${error?.message} | ${sqls.join(' | ')}`,
      )
    }

    {
      const cliente = clienteFalso({ telemetria: { ...filaPropia, dispositivo_sha256: 'huella-de-otro' } })
      const r = await abrirActuacionDesdeImpacto(cliente, alta())
      const sqls = cliente.sqls()
      const insercion = cliente.consultas.find((c) => c.sql.startsWith('INSERT INTO casos'))
      verificar(
        'con la telemetría de otro teléfono la actuación se abre igual, sin vínculo y con origen boton',
        r.tipo === 'nueva' && r.vinculo === 'rechazado' && insercion?.params.at(-1) === 'boton' && !sqls.some((s) => s.startsWith('UPDATE telemetria')) && sqls.at(-1) === 'COMMIT',
        `${JSON.stringify(r)} | ${sqls.join(' | ')}`,
      )
      verificar(
        'el alta sin vínculo no deja rastro del impacto en el eslabón',
        JSON.stringify(Object.keys(detalleDe(cliente) ?? {}).sort()) === JSON.stringify(['reservado_sha256', 'user_agent']),
        JSON.stringify(detalleDe(cliente)),
      )
    }

    {
      const cliente = clienteFalso({ telemetria: null })
      const r = await abrirActuacionDesdeImpacto(cliente, alta('TEL-ZZZZZZ'))
      verificar(
        'una telemetría que no existe termina igual que una ajena',
        r.tipo === 'nueva' && r.vinculo === 'rechazado' && cliente.consultas.find((c) => c.sql.startsWith('INSERT INTO casos'))?.params.at(-1) === 'boton',
        JSON.stringify(r),
      )
    }

    {
      const cliente = clienteFalso({ telemetria: { ...filaPropia, dispositivo_sha256: null, usuario_id: 'USR-1' } })
      const r = await abrirActuacionDesdeImpacto(cliente, alta('TEL-AAAAAA', { huella: null, usuarioId: 'USR-1' }))
      verificar('con la sesión del dueño se vincula una alerta vieja sin huella', r.tipo === 'nueva' && r.vinculo === 'ok', JSON.stringify(r))
    }

    {
      const cliente = clienteFalso({ telemetria: { ...filaPropia, caso_id: 'ADS-BBBBBB' } })
      const r = await abrirActuacionDesdeImpacto(cliente, alta())
      const sqls = cliente.sqls()
      const rotacion = cliente.consultas.find((c) => c.sql.startsWith('UPDATE casos SET secreto_sha256'))
      verificar(
        'una telemetría ya vinculada rota el secreto de esa actuación y no crea nada ni registra eslabones',
        r.tipo === 'repetida' && r.id === 'ADS-BBBBBB' && JSON.stringify(rotacion?.params) === JSON.stringify(['ADS-BBBBBB', 'sha-del-secreto']) && !sqls.some((s) => s.startsWith('INSERT')) && sqls.at(-1) === 'COMMIT',
        sqls.join(' | '),
      )
    }

    {
      const cliente = clienteFalso({ telemetria: { ...filaPropia, caso_id: 'ADS-BBBBBB', dispositivo_sha256: 'huella-de-otro' } })
      const r = await abrirActuacionDesdeImpacto(cliente, alta())
      verificar(
        'una telemetría vinculada de otro teléfono no rota nada: abre otra actuación sin vínculo',
        r.tipo === 'nueva' && r.vinculo === 'rechazado' && !cliente.sqls().some((s) => s.startsWith('UPDATE casos')),
        JSON.stringify(r),
      )
    }

    {
      const cliente = clienteFalso({ telemetria: filaPropia, filasVinculadas: 0 })
      const error = await fallaDe(() => abrirActuacionDesdeImpacto(cliente, alta()))
      const sqls = cliente.sqls()
      verificar(
        'si el vínculo no toca exactamente una fila se deshace todo, sin eslabón',
        error !== null && sqls.at(-1) === 'ROLLBACK' && !sqls.includes('COMMIT') && !sqls.some((s) => s.startsWith('INSERT INTO eventos (')),
        `${error?.message} | ${sqls.join(' | ')}`,
      )
    }

    {
      const cliente = clienteFalso({ telemetria: filaPropia, fallaCon: 'SELECT id, nivel' })
      const error = await fallaDe(() => abrirActuacionDesdeImpacto(cliente, alta()))
      verificar(
        'un error de la base hace ROLLBACK y se relanza tal cual',
        error?.message === 'falla simulada en SELECT id, nivel' && cliente.sqls().at(-1) === 'ROLLBACK',
        `${error?.message} | ${cliente.sqls().join(' | ')}`,
      )
    }
  } finally {
    if (poolPrevio === undefined) delete globalThis._pool
    else globalThis._pool = poolPrevio
    if (esquemaPrevio === undefined) delete globalThis._schemaLista
    else globalThis._schemaLista = esquemaPrevio
  }
})
```

Qué fija cada parte: el detalle sale sólo con primitivas y con el hash `5ee7f2439daa12ad2db59a2417a51e1e72a03c383c3c038bdd6f03674f784814` (calculado sobre el código de hoy; es JSON puro, así que `aJsonPuro` de F1 no lo mueve); la transacción, contra un cliente falso, abre con `BEGIN`, bloquea con `FOR UPDATE`, reserva el número con `ON CONFLICT (id) DO NOTHING RETURNING id` sin `SAVEPOINT` ni `ROLLBACK` entre intentos, vincula con `caso_id IS NULL` antes del eslabón, rota el secreto en el reintento y deshace todo ante un error. El pool falso hace que ninguna de estas pruebas pueda tocar una base, aunque `DATABASE_URL` esté definida en la terminal.

- [ ] **Step 2: Correr `[V8]` y ver que falla**

Run: `SECCION=V8 npx tsx scripts/prueba-viaje.mjs`

Expected: la salida tiene

```
[V8] Alta vinculada
  FALLA [V8] terminó sin excepciones TypeError: detalleAperturaImpacto is not a function
```

(seguida del stack), termina con `1 FALLARON` y el proceso sale con código 1.

- [ ] **Step 3: Sumar los imports de `lib/casos.ts`**

En `lib/casos.ts`, reemplazar:

```ts
import { db } from './db'
import { construirManifiesto } from './hash'
import { construirActa } from './acta'
```

por:

```ts
import type { PoolClient } from 'pg'
import { db, nuevoId } from './db'
import { construirManifiesto, registrarEvento, VERSION_MANIFIESTO } from './hash'
import { construirActa } from './acta'
import { accesoTelemetria, type QuienPide } from './telemetria'
```

(`lib/telemetria.ts` no importa `./casos`, así que no hay ciclo; índice, párrafo final de «Interfaces › `lib/telemetria.ts`».)

- [ ] **Step 4: Agregar el alta desde un golpe al final de `lib/casos.ts`**

Después del cierre de `contarTerceros`, que hoy es el final del archivo:

```ts
  const res = await pg.query<{ n: string }>('SELECT count(*)::text AS n FROM terceros WHERE caso_id = $1', [casoId])
  return Number(res.rows[0]?.n ?? 0)
}
```

agregar una línea en blanco y este bloque:

```ts
/* ================= Alta desde un golpe detectado ================= */

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

/** Un número finito o null. pg entrega BIGINT como texto: '-120' pasa a -120. */
function numeroONull(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null
  if (typeof valor === 'string' && valor.trim() !== '') {
    const numero = Number(valor)
    return Number.isFinite(numero) ? numero : null
  }
  return null
}

/** ISO 8601 o null. pg entrega TIMESTAMPTZ como Date, y una fecha inválida no puede entrar al eslabón. */
function isoONull(valor: unknown): string | null {
  const ms = valor instanceof Date ? valor.getTime() : typeof valor === 'string' ? Date.parse(valor) : Number.NaN
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null
}

/**
 * Convierte Date a ISO, BIGINT en texto a número (null si no es finito), undefined y NaN a null. Pura.
 *
 * Este detalle entra al hash del eslabón de apertura. `canonico` convierte un Date en {} y
 * JSON.stringify en texto, y un undefined entra al hash como null pero desaparece del JSON que se
 * guarda: cualquiera de los dos deja el eslabón inverificable para siempre. Por eso de acá sólo salen
 * textos, números y null, y nunca la ubicación ni las velocidades del golpe.
 */
export function detalleAperturaImpacto(
  fila: { id: string; nivel: string; pico_g: number | null; ocurrido_en_telefono: Date | string | null; desfase_reloj_ms: number | string | null },
  userAgent: string | null,
): DetalleAperturaImpacto {
  return {
    user_agent: typeof userAgent === 'string' ? userAgent : null,
    origen: 'impacto',
    telemetria_id: fila.id,
    nivel: fila.nivel,
    pico_g: numeroONull(fila.pico_g),
    ocurrido_en_telefono: isoONull(fila.ocurrido_en_telefono),
    desfase_reloj_ms: numeroONull(fila.desfase_reloj_ms),
  }
}

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

/** Lo que el alta lee de la telemetría. `type` y no `interface`: pg exige filas indexables. */
type FilaTelemetriaAlta = {
  id: string
  nivel: string
  pico_g: number | null
  ocurrido_en_telefono: Date | null
  desfase_reloj_ms: string | null
  caso_id: string | null
  usuario_id: string | null
  dispositivo_sha256: string | null
  recibido_en: Date | null
}

/**
 * El INSERT del caso con reintento por número ocupado, dentro de la transacción de quien llama.
 *
 * Con ON CONFLICT y no atrapando el 23505 como hace el alta sin vínculo: dentro de BEGIN un 23505
 * aborta la transacción y el reintento siguiente fallaría con 25P02. Tampoco hace falta un SAVEPOINT.
 */
async function insertarCaso(cliente: PoolClient, alta: AltaDesdeImpacto, origen: 'impacto' | 'boton'): Promise<string> {
  for (let intento = 0; intento < 5; intento++) {
    const res = await cliente.query<{ id: string }>(
      `INSERT INTO casos (id, poliza, patente, asegurado, telefono, manifiesto_version, secreto_sha256, usuario_id, poliza_id, origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO NOTHING RETURNING id`,
      [nuevoId(), alta.caratula.poliza, alta.caratula.patente, alta.caratula.asegurado, alta.caratula.telefono, VERSION_MANIFIESTO, alta.secretoSha256, alta.quien.usuarioId, alta.caratula.poliza_id, origen],
    )
    if (res.rows[0]) return res.rows[0].id
  }
  throw new Error('No se pudo generar un número de actuación libre después de cinco intentos.')
}

/**
 * §5.3 pasos 1–8 con BEGIN y COMMIT propios (ROLLBACK y relanza ante error). SELECT … FOR UPDATE de la
 * telemetría y accesoTelemetria. Sin fila o sin acceso: alta normal con origen 'boton', detalle { user_agent } y
 * vinculo 'rechazado'. Con caso_id: rota casos.secreto_sha256 y devuelve 'repetida'. Si no: INSERT con
 * origen 'impacto' y ON CONFLICT (id) DO NOTHING RETURNING id en el bucle de 5 intentos (sin SAVEPOINT);
 * UPDATE telemetria SET caso_id … AND caso_id IS NULL con rowCount 1; registrarEvento(id, 'apertura_actuacion',
 * detalleAperturaImpacto(fila, userAgent), { reservado: { poliza, patente }, cliente }). anotarPosesion lo hace
 * la ruta después del COMMIT.
 */
export async function abrirActuacionDesdeImpacto(cliente: PoolClient, alta: AltaDesdeImpacto): Promise<ResultadoAltaImpacto> {
  // La póliza y la patente son dato personal: van al compromiso del eslabón, nunca al detalle en claro.
  const reservado = { poliza: alta.caratula.poliza, patente: alta.caratula.patente }
  try {
    await cliente.query('BEGIN')
    /*
     * FOR UPDATE: dos toques seguidos en «Registrar el accidente» son dos pedidos con el mismo
     * telemetria_id. El segundo espera acá a que el primero confirme y encuentra el caso_id ya escrito,
     * en vez de abrir una segunda actuación para el mismo golpe.
     */
    const lectura = await cliente.query<FilaTelemetriaAlta>(
      `SELECT id, nivel, pico_g, ocurrido_en_telefono, desfase_reloj_ms, caso_id, usuario_id, dispositivo_sha256, recibido_en
         FROM telemetria WHERE id = $1 FOR UPDATE`,
      [alta.telemetriaId],
    )
    const fila = lectura.rows[0] ?? null
    /*
     * «No existe» y «no es de este teléfono» terminan igual: la actuación se abre sin vínculo. Quien toca
     * esto puede estar parado al lado del auto, y un 403 o un 500 por el vínculo lo dejaría sin actuación.
     */
    const propia = fila !== null && accesoTelemetria(fila, alta.quien, Date.now())

    if (propia && fila.caso_id !== null) {
      // Reintento del alta. El secreto se entrega una sola vez: se rota para poder devolver uno. No es un eslabón.
      await cliente.query('UPDATE casos SET secreto_sha256 = $2 WHERE id = $1', [fila.caso_id, alta.secretoSha256])
      await cliente.query('COMMIT')
      return { tipo: 'repetida', id: fila.caso_id }
    }

    const id = await insertarCaso(cliente, alta, propia ? 'impacto' : 'boton')

    if (propia) {
      const vinculo = await cliente.query('UPDATE telemetria SET caso_id = $1 WHERE id = $2 AND caso_id IS NULL', [id, fila.id])
      if (vinculo.rowCount !== 1) {
        throw new Error(`La detección ${fila.id} quedó vinculada a otra actuación mientras se abría ésta: volvé a tocar «Registrar el accidente».`)
      }
      await registrarEvento(id, 'apertura_actuacion', detalleAperturaImpacto(fila, alta.userAgent), { reservado, cliente })
    } else {
      await registrarEvento(id, 'apertura_actuacion', { user_agent: alta.userAgent }, { reservado, cliente })
    }

    await cliente.query('COMMIT')
    return { tipo: 'nueva', id, vinculo: propia ? 'ok' : 'rechazado' }
  } catch (err) {
    await cliente.query('ROLLBACK').catch(() => {})
    throw err
  }
}
```

Lo que un revisor va a buscar, y dónde está:
- `SELECT … FOR UPDATE` antes de decidir: dos toques seguidos van en fila y el segundo ve el `caso_id` (§5.3 paso 2).
- Sin fila o sin acceso, el mismo camino: actuación con `origen` `'boton'`, detalle `{ user_agent }` y `vinculo` `'rechazado'`; nunca un 403 ni un 500 por el vínculo (§5.3 paso 3).
- `ON CONFLICT (id) DO NOTHING RETURNING id` en el bucle de 5 intentos, sin `SAVEPOINT` (riesgo 6).
- `UPDATE telemetria SET caso_id … AND caso_id IS NULL` con `rowCount` 1 (§5.3 paso 6).
- El detalle sale de `detalleAperturaImpacto`: sólo primitivas, sin ubicación ni velocidades (riesgos 1–3). Las opciones empiezan por `reservado`, en una sola línea: `{ reservado, cliente }` (riesgo 9).
- `anotarPosesion` no está acá: la ruta la llama después del `COMMIT` (riesgo 8).
- Ningún eslabón en el camino repetido: la actuación puede estar sellada (riesgo 10).

- [ ] **Step 5: Correr `[V8]` en verde**

Run: `SECCION=V8 npx tsx scripts/prueba-viaje.mjs`

Expected: 24 líneas que empiezan con `  ok   ` bajo `[V8] Alta vinculada`, `24/24 verificaciones pasaron` y `Todo en orden.`, con código 0.

- [ ] **Step 6: Compilar y correr el contrato**

Run: `npm run tipos && npm run contrato`

Expected: `tipos` sin salida y `El contrato se cumple.`, con `ok   ningún dato personal en claro dentro de un eslabón` (ahora revisa también los dos `registrarEvento(` de `lib/casos.ts`) y `ok   ningún nombre se exporta desde dos módulos de lib/`.

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.`, sin ninguna línea `  FALLA`.

- [ ] **Step 8: Commit**

```bash
git add "lib/casos.ts" "scripts/prueba-viaje.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Abrir la actuación vinculada a un golpe en una sola transacción verificable

abrirActuacionDesdeImpacto bloquea la telemetría con FOR UPDATE, comprueba que sea
de este teléfono o de esta cuenta y, si lo es, crea la actuación con origen
impacto, la vincula y registra el eslabón de apertura, todo antes del COMMIT. Si
la telemetría no existe o es ajena, la actuación se abre igual, sin vínculo: quien
toca esto puede estar parado al lado del auto.

El número se reserva con ON CONFLICT DO NOTHING y no atrapando el 23505, que dentro
de la transacción la dejaría abortada. El detalle del eslabón lleva sólo textos,
números y null: un Date o un undefined lo volverían inverificable para siempre.
[V8] prueba todo contra un cliente falso, sin base.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `POST /api/casos` con `telemetria_id`, `origen` en `Caso` y e2e `[10h]`–`[10k]`

Índice F5.3, tercera parte: la ruta usa `abrirActuacionDesdeImpacto` y el e2e lo prueba contra el servidor y la base reales (§6.4; índice «Contratos HTTP › `POST /api/casos`» y «Pruebas › e2e»).

**Files:**
- Modify: `scripts/prueba-e2e.mjs` (bloque nuevo inmediatamente antes de `/* ---------- Resultado ---------- */`, después de `[10g]`)
- Modify: `lib/casos.ts` (`interface Caso`, hoy líneas 12–33; `mapear`, hoy líneas 37–59)
- Modify: `app/api/casos/route.ts` (el archivo entero, sobre la versión de F1)
- Test: `npm run e2e` con el servidor de «Antes de empezar»

**Interfaces:**
- Consumes:
  - `abrirActuacionDesdeImpacto(cliente: PoolClient, alta: AltaDesdeImpacto): Promise<ResultadoAltaImpacto>` (Tarea 5).
  - `leerCuerpoLimitado(req: Request, maxBytes: number): Promise<unknown>` de `lib/api.ts`; `limitar(ambito: AmbitoLimite, claves: { ip: string | null; huella: string | null }, ahoraMs?: number): void` e `ipDelCliente(cabeceras: Headers, saltosConfiables?: number): string | null` de `lib/limite.ts`; `huellaDispositivo(proposito: PropositoHuella, crear: boolean): Promise<string | null>` de `lib/posesion.ts` (F1).
  - `anotarPosesion(casoId: string): Promise<void>`, `precargaDe(usuarioId: string): Promise<Precarga | null>`, `leerSesion(): Promise<Sesion | null>`, `nuevoToken()`, `hashToken()`, `db()` (existentes).
  - En el e2e (F1): `crearFrasco(): { galletas: Map, ip: string, pedir(ruta, opciones) }`, cuyo `pedir` devuelve `{ res, cuerpo }` como el `pedir` por omisión; `saltar(nombre, motivo)`; `verificar(nombre, condicion, extra)`.
- Produces:
  - `Caso.origen: string` (`GET /api/casos/[id]` lo devuelve porque esparce el caso).
  - `POST /api/casos` con `{ "telemetria_id": "TEL-…" }`: 201 `{ id, secreto, precarga_ambigua, vinculo_telemetria: 'ok' | 'rechazado' }` o 200 `{ id, secreto, ya_registrada: true, vinculo_telemetria: 'ok' }` (lo consume `registrarAccidente` del motor).

- [ ] **Step 1: Escribir `[10h]`–`[10k]`**

En `scripts/prueba-e2e.mjs`, inmediatamente antes de la línea `/* ---------- Resultado ---------- */`, insertar (seguido de una línea en blanco):

```js
/* ---------- 10h a 10m. Alta vinculada y retención (F5) ---------- */
{
  /*
   * Todo en un bloque propio: los nombres de acá no chocan con los de [10a]–[10g]. Cada frasco manda
   * su propia IP y su propia cookie, así que el límite de altas de una corrida anterior no molesta.
   */
  const json = { 'Content-Type': 'application/json' }
  const UMBRALES_TELEFONO = { sospechaG: 4, confirmadoG: 8, msSobreUmbral: 30, velocidadPreviaKmh: 15, velocidadPreviaCaidaKmh: 30, velocidadPosteriorKmh: 8, ventanaPostMs: 8000, topeEpisodioMs: 15000, giroDps: 180, giroManipulacionDps: 300, desaceleracionImposibleG: 1.4, frenadaG: 0.45, aceleracionG: 0.4, retrasoMinMs: 0, retrasoMaxMs: 3000 }
  /** Una alerta sin episodio, como la sube el motor cuando venció la cuenta. */
  const cuerpoAlerta = () => {
    const ahora = Date.now()
    return JSON.stringify({
      campos: {
        id_cliente: crypto.randomUUID(),
        aviso_version: '2026-09-16',
        version_motor: 1,
        plataforma: 'android',
        standalone: false,
        ocurrido_en_telefono: new Date(ahora - 45_000).toISOString(),
        enviado_en: new Date(ahora).toISOString(),
        apertura: 'episodio',
        nivel_cliente: 'confirmado',
        alerta_mostrada: true,
        sonido: true,
        respuestas: [{ respuesta: 'sin_respuesta', en_telefono: new Date(ahora - 5_000).toISOString() }],
        hubo_choque: null,
        ms_hasta_respuesta: null,
        hz_medido: 60,
        aceleracion_derivada: false,
        gps: { lat: -34.6037, lon: -58.3816, precision_m: 9.5 },
        umbrales_cliente: UMBRALES_TELEFONO,
      },
      episodio: null,
    })
  }
  /** Un pg.Client propio contra E2E_DATABASE_URL, como el de [10a]. */
  const clienteBase = async () => {
    const { Client } = (await import('pg')).default
    const cliente = new Client({
      connectionString: process.env.E2E_DATABASE_URL,
      ssl: process.env.E2E_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    })
    await cliente.connect()
    return cliente
  }

  console.log('\n[10h] Actuación desde un golpe')
  const dueno = crearFrasco()
  await dueno.pedir('/api/telemetria/configuracion')
  const { res: resAlerta, cuerpo: alertaH } = await dueno.pedir('/api/telemetria', { method: 'POST', headers: json, body: cuerpoAlerta() })
  verificar('la alerta del golpe queda registrada', resAlerta.status === 201 && /^TEL-/.test(alertaH?.id ?? ''), `status=${resAlerta.status} ${JSON.stringify(alertaH)}`)
  const TEL = alertaH?.id ?? 'TEL-ZZZZZZ'

  const { res: resAltaH, cuerpo: altaH } = await dueno.pedir('/api/casos', { method: 'POST', headers: json, body: JSON.stringify({ telemetria_id: TEL }) })
  verificar(
    'la actuación se abre vinculada al golpe',
    resAltaH.status === 201 && altaH?.vinculo_telemetria === 'ok' && /^ADS-[A-Z0-9]{6}$/.test(altaH?.id ?? '') && typeof altaH?.secreto === 'string',
    `status=${resAltaH.status} vinculo=${altaH?.vinculo_telemetria} id=${altaH?.id}`,
  )
  const ID_IMPACTO = altaH?.id ?? 'ADS-ZZZZZZ'

  const { res: resCasoH, cuerpo: casoH } = await dueno.pedir(`/api/casos/${ID_IMPACTO}`)
  verificar('la actuación dice que salió de un golpe detectado', resCasoH.status === 200 && casoH?.origen === 'impacto', `status=${resCasoH.status} origen=${casoH?.origen}`)

  const NOMBRE_DETALLE = 'el eslabón de apertura vincula el golpe sólo con primitivas y sin ubicación'
  if (process.env.E2E_DATABASE_URL) {
    const cliente = await clienteBase()
    try {
      const r = await cliente.query("SELECT detalle FROM eventos WHERE caso_id = $1 AND tipo = 'apertura_actuacion'", [ID_IMPACTO])
      const detalle = r.rows[0]?.detalle ?? {}
      const soloPrimitivas = Object.values(detalle).every((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v))
      const sinUbicacion = ['lat', 'lon', 'gps', 'ubicacion', 'kmh'].every((clave) => !(clave in detalle))
      verificar(
        NOMBRE_DETALLE,
        r.rowCount === 1 && detalle.origen === 'impacto' && detalle.telemetria_id === TEL && typeof detalle.nivel === 'string' && soloPrimitivas && sinUbicacion,
        JSON.stringify(detalle),
      )
    } finally {
      await cliente.end()
    }
  } else {
    saltar(NOMBRE_DETALLE, 'falta E2E_DATABASE_URL')
  }

  const { res: resCierreH, cuerpo: cierreH } = await dueno.pedir(`/api/casos/${ID_IMPACTO}/cerrar`, { method: 'POST' })
  verificar('la actuación vinculada se cierra', resCierreH.status === 200 && cierreH?.ok === true, `status=${resCierreH.status}`)
  const { cuerpo: verH } = await dueno.pedir('/api/verificar', { method: 'POST', headers: json, body: JSON.stringify({ id: ID_IMPACTO }) })
  verificar('el expediente abierto desde un golpe verifica como íntegro', verH?.valido === true, JSON.stringify(verH?.problemas ?? verH))
  const ESLABONES_H = verH?.eslabones

  console.log('\n[10i] Reintento del alta')
  {
    const { res, cuerpo } = await dueno.pedir('/api/casos', { method: 'POST', headers: json, body: JSON.stringify({ telemetria_id: TEL }) })
    verificar(
      'repetir el alta devuelve la misma actuación con un secreto nuevo',
      res.status === 200 && cuerpo?.ya_registrada === true && cuerpo?.id === ID_IMPACTO && typeof cuerpo?.secreto === 'string' && cuerpo.secreto !== altaH?.secreto,
      `status=${res.status} id=${cuerpo?.id} ya_registrada=${cuerpo?.ya_registrada}`,
    )
  }

  console.log('\n[10j] Telemetría ajena')
  {
    const ajeno = crearFrasco()
    await ajeno.pedir('/api/telemetria/configuracion')
    const { res, cuerpo } = await ajeno.pedir('/api/casos', { method: 'POST', headers: json, body: JSON.stringify({ telemetria_id: TEL }) })
    verificar(
      'con la telemetría de otro teléfono la actuación se abre igual, sin vínculo',
      res.status === 201 && cuerpo?.vinculo_telemetria === 'rechazado' && /^ADS-[A-Z0-9]{6}$/.test(cuerpo?.id ?? '') && cuerpo.id !== ID_IMPACTO,
      `status=${res.status} vinculo=${cuerpo?.vinculo_telemetria} id=${cuerpo?.id}`,
    )
    const { cuerpo: caso } = await ajeno.pedir(`/api/casos/${cuerpo?.id}`)
    verificar('esa actuación queda con origen boton', caso?.origen === 'boton', `origen=${caso?.origen}`)
  }

  console.log('\n[10k] Responder después del cierre')
  {
    const { res } = await dueno.pedir(`/api/telemetria/${TEL}/respuesta`, { method: 'POST', headers: json, body: JSON.stringify({ respuesta: 'estoy_bien' }) })
    verificar('responder una alerta vinculada a un expediente cerrado da 200', res.status === 200, `status=${res.status}`)
    const { cuerpo: ver } = await dueno.pedir('/api/verificar', { method: 'POST', headers: json, body: JSON.stringify({ id: ID_IMPACTO }) })
    verificar(
      'la respuesta posterior no agrega eslabones ni rompe la verificación',
      ver?.valido === true && typeof ESLABONES_H === 'number' && ver?.eslabones === ESLABONES_H,
      `valido=${ver?.valido} eslabones=${ver?.eslabones} antes=${ESLABONES_H}`,
    )
  }
}
```

Todo va dentro de un bloque `{ … }`: los nombres de F5 (`dueno`, `TEL`, `json`…) no pueden chocar con los de `[10a]`–`[10g]`. La Tarea 7 agrega `[10l]` y `[10m]` antes del `}` final de este bloque.

- [ ] **Step 2: Correr el e2e y ver las fallas del alta vinculada**

Con el servidor de «Antes de empezar» corriendo y las variables exportadas:

Run: `npm run e2e`

Expected: `[10a]`–`[10g]` siguen en `ok` y, en `[10h]`–`[10k]` (los ids cambian en cada corrida):

```
  FALLA la actuación se abre vinculada al golpe status=201 vinculo=undefined id=ADS-…
  FALLA la actuación dice que salió de un golpe detectado status=200 origen=undefined
  FALLA el eslabón de apertura vincula el golpe sólo con primitivas y sin ubicación {"user_agent":…,"reservado_sha256":"…"}
  FALLA repetir el alta devuelve la misma actuación con un secreto nuevo status=201 id=ADS-… ya_registrada=undefined
  FALLA con la telemetría de otro teléfono la actuación se abre igual, sin vínculo status=201 vinculo=undefined id=ADS-…
  FALLA esa actuación queda con origen boton origen=undefined
```

y en `ok`: `la alerta del golpe queda registrada`, `la actuación vinculada se cierra`, `el expediente abierto desde un golpe verifica como íntegro`, `responder una alerta vinculada a un expediente cerrado da 200` y `la respuesta posterior no agrega eslabones ni rompe la verificación`. El proceso termina con `6 FALLARON` y código 1.

- [ ] **Step 3: Sumar `origen` a `Caso`**

En `lib/casos.ts`, reemplazar:

```ts
  croquis: Croquis | null
}
```

por:

```ts
  croquis: Croquis | null
  /** De dónde salió la actuación: 'boton' («Tuve un accidente») o 'impacto' (registrada desde un golpe detectado). */
  origen: string
}
```

y en `mapear`, reemplazar:

```ts
    croquis: (fila.croquis as Croquis) ?? null,
  }
```

por:

```ts
    croquis: (fila.croquis as Croquis) ?? null,
    origen: (fila.origen as string) ?? 'boton',
  }
```

(La columna `casos.origen TEXT NOT NULL DEFAULT 'boton'` ya existe en `SCHEMA`; `mapear` es el único lugar que arma un `Caso`.)

- [ ] **Step 4: Confirmar qué dejó F1 en la ruta**

Run: `git diff f47005e -- app/api/casos/route.ts`

Expected: sólo los cambios de F1 que la versión nueva conserva: `leerSesion()` antes de leer el cuerpo, `limitar('altas', { ip: ipDelCliente(req.headers), huella: … huellaDispositivo('telemetria', false) … })` sin sesión, `leerCuerpoLimitado(req, …)` con 8192 bytes en lugar de `req.json()`, y los imports de esas funciones. Si el diff muestra otra cosa, se frena y se reporta: el paso siguiente reemplaza el archivo entero.

- [ ] **Step 5: Reemplazar `app/api/casos/route.ts` entero**

```ts
import { NextResponse } from 'next/server'
import { errorApi, leerCuerpoLimitado } from '@/lib/api'
import { db, nuevoId } from '@/lib/db'
import { registrarEvento, VERSION_MANIFIESTO } from '@/lib/hash'
import { abrirActuacionDesdeImpacto, listarCasos, limpiarDatosAsegurado } from '@/lib/casos'
import { hashToken, nuevoToken } from '@/lib/claves'
import { ipDelCliente, limitar } from '@/lib/limite'
import { anotarPosesion, huellaDispositivo } from '@/lib/posesion'
import { alcanceDe, exigirRol, leerSesion } from '@/lib/sesion'
import { precargaDe } from '@/lib/polizas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Una carátula y un telemetria_id entran de sobra en 8 KB: más que eso no lo manda nuestro teléfono. */
const BYTES_MAX_ALTA = 8_192

/** El telemetria_id del cuerpo si es un texto de 1 a 20 caracteres; con cualquier otra cosa el alta sigue como siempre. */
function telemetriaIdDe(cuerpo: unknown): string | null {
  if (!cuerpo || typeof cuerpo !== 'object') return null
  const valor = (cuerpo as Record<string, unknown>).telemetria_id
  return typeof valor === 'string' && valor.length >= 1 && valor.length <= 20 ? valor : null
}

/**
 * Alta de una actuación. Es el primer eslabón de la cadena de custodia.
 *
 * El cuerpo puede venir vacío, y es el caso normal: desde el teléfono la actuación se
 * abre con un solo toque, sin pedir nada. Los datos del asegurado se cargan después,
 * por PATCH. Se siguen aceptando acá para las altas hechas desde otro sistema.
 *
 * Con `telemetria_id` la abre el modo viaje desde un golpe detectado: la actuación queda
 * vinculada a esa alerta si es de este teléfono (o de esta cuenta), y se abre igual, sin
 * vínculo, si no lo es. Nunca un 403 ni un 500 por el vínculo.
 */
export async function POST(req: Request) {
  try {
    const sesion = await leerSesion()
    /*
     * El límite de altas anónimas corre ANTES de leer el cuerpo: un pedido rechazado por tamaño
     * también cuenta, y una ráfaga no llega a crear filas. La huella de propósito telemetria sin
     * crear la cookie sirve de clave en memoria y, con telemetria_id, dice de quién es la alerta.
     */
    const huella = await huellaDispositivo('telemetria', false)
    if (!sesion) limitar('altas', { ip: ipDelCliente(req.headers), huella })

    const cuerpo = await leerCuerpoLimitado(req, BYTES_MAX_ALTA)
    const datos = limpiarDatosAsegurado(cuerpo)
    const pg = await db()

    /*
     * El secreto de apertura se devuelve UNA sola vez, acá, y de la base sólo se guarda su
     * hash. Es la única prueba que después se acepta para reclamar esta actuación desde
     * una cuenta: el id no alcanza, porque se dicta por teléfono, se imprime en el
     * expediente y viaja dentro del QR que escanea cualquier testigo.
     */
    const secreto = nuevoToken()

    /*
     * Precarga de la carátula desde la póliza, sólo con sesión.
     *
     * Con más de una póliza NO se precarga la patente: si la persona chocó con el otro
     * auto, poner la del principal mete un dato falso en la carátula, y la carátula
     * termina dentro del expediente sellado y del informe de consistencia. Los cuatro
     * campos siguen siendo editables al final del recorrido.
     */
    const precarga = sesion ? await precargaDe(sesion.usuario_id) : null
    const conPrecarga = {
      poliza: datos.poliza ?? precarga?.poliza ?? null,
      patente: datos.patente ?? precarga?.patente ?? null,
      asegurado: datos.asegurado ?? precarga?.asegurado ?? null,
      telefono: datos.telefono ?? precarga?.telefono ?? null,
    }

    const telemetriaId = telemetriaIdDe(cuerpo)
    if (telemetriaId !== null) {
      /*
       * La transacción vive en lib/casos.ts; la ruta presta la conexión y la devuelve pase lo que
       * pase. anotarPosesion va DESPUÉS del COMMIT: usa otra conexión, y la clave foránea de
       * posesiones todavía no vería la actuación recién creada.
       */
      const cliente = await pg.connect()
      const resultado = await abrirActuacionDesdeImpacto(cliente, {
        telemetriaId,
        quien: { huella, usuarioId: sesion?.usuario_id ?? null },
        caratula: { ...conPrecarga, poliza_id: precarga?.poliza_id ?? null },
        userAgent: req.headers.get('user-agent')?.slice(0, 200) ?? null,
        secretoSha256: hashToken(secreto),
      }).finally(() => cliente.release())
      await anotarPosesion(resultado.id)

      if (resultado.tipo === 'repetida') {
        return NextResponse.json({ id: resultado.id, secreto, ya_registrada: true, vinculo_telemetria: 'ok' }, { status: 200 })
      }
      return NextResponse.json(
        { id: resultado.id, secreto, precarga_ambigua: precarga?.ambigua ?? false, vinculo_telemetria: resultado.vinculo },
        { status: 201 },
      )
    }

    /*
     * Reintento por colisión de número.
     *
     * nuevoId() son 6 caracteres sobre un alfabeto de 32: unas 1.07e9 combinaciones, que
     * por la paradoja del cumpleaños dan alrededor de 50% de probabilidad de al menos una
     * colisión a las ~33.000 actuaciones. Sin reintento, esa colisión es un 500 genérico
     * justo cuando la persona toca "Tuve un accidente" parada al lado del auto.
     *
     * La versión del manifiesto se escribe acá y no se deja en el DEFAULT de la columna:
     * el DEFAULT es '1.0' para las filas que ya existían, y toda actuación nueva tiene
     * que nacer en la versión vigente. Ver VERSION_MANIFIESTO en lib/hash.ts.
     */
    let id = ''
    for (let intento = 0; intento < 5; intento++) {
      const candidato = nuevoId()
      try {
        await pg.query(
          `INSERT INTO casos (id, poliza, patente, asegurado, telefono, manifiesto_version, secreto_sha256, usuario_id, poliza_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [candidato, conPrecarga.poliza, conPrecarga.patente, conPrecarga.asegurado, conPrecarga.telefono, VERSION_MANIFIESTO, hashToken(secreto), sesion?.usuario_id ?? null, precarga?.poliza_id ?? null],
        )
        id = candidato
        break
      } catch (err) {
        // 23505 = unique_violation. Cualquier otra cosa no se resuelve reintentando.
        if ((err as { code?: string })?.code !== '23505') throw err
      }
    }
    if (!id) {
      throw new Error('No se pudo generar un número de actuación libre después de cinco intentos.')
    }

    await registrarEvento(
      id,
      'apertura_actuacion',
      { user_agent: req.headers.get('user-agent')?.slice(0, 200) ?? null },
      { reservado: { poliza: conPrecarga.poliza, patente: conPrecarga.patente } },
    )

    // Anota qué navegador tiene este id: es lo que le habilita las fotos y el expediente.
    await anotarPosesion(id)

    return NextResponse.json({ id, secreto, precarga_ambigua: precarga?.ambigua ?? false }, { status: 201 })
  } catch (err) {
    return errorApi('casos:POST', err, 'No se pudo crear la actuación.')
  }
}

/**
 * Listado, acotado a quién pregunta.
 *
 * Dejó de ser público. La aseguradora ve todo, el productor ve los suyos, el asegurado
 * los propios. Antes devolvía las doscientas actuaciones más recientes del sistema —con
 * la patente, el nombre y el lugar del hecho— a cualquiera que supiera la ruta.
 */
export async function GET() {
  try {
    const sesion = await exigirRol('asegurado', 'productor', 'aseguradora')
    const casos = await listarCasos(alcanceDe(sesion))
    return NextResponse.json(
      casos.map((c) => ({
        id: c.id,
        creado_en: c.creado_en,
        cerrado_en: c.cerrado_en,
        estado: c.estado,
        poliza: c.poliza,
        patente: c.patente,
        asegurado: c.asegurado,
        direccion: c.direccion,
        resumen: c.consistencia?.resumen ?? null,
      })),
    )
  } catch (err) {
    return errorApi('casos:GET', err, 'No se pudo leer el listado.')
  }
}
```

Qué se conserva de F1 y qué se suma: la sesión se lee primero y, sin sesión, el límite de altas corre antes de leer el cuerpo (riesgo 15), con la huella de propósito `telemetria` sin crear la cookie; el cuerpo se lee con `leerCuerpoLimitado` y 8 KB; sin `telemetria_id` válido el alta es la de siempre. Con `telemetria_id`, la huella se calcula igual con sesión, porque es la que dice de quién es la alerta; la ruta presta un cliente del pool, `abrirActuacionDesdeImpacto` hace su transacción y, recién después del `COMMIT`, `anotarPosesion` (riesgo 8). La respuesta sigue la tabla del índice: 201 con `vinculo_telemetria`, o 200 con `ya_registrada: true`.

- [ ] **Step 6: Compilar y correr el contrato**

Run: `npm run tipos && npm run contrato`

Expected: `tipos` sin salida y `El contrato se cumple.` (la ruta sigue declarando `runtime` y `dynamic`, terminando en `errorApi`, y su `registrarEvento(` del alta sin vínculo pasa la comprobación de datos personales).

- [ ] **Step 7: Correr el e2e en verde**

Con el servidor recargado (en `next dev` alcanza con guardar los archivos):

Run: `npm run e2e`

Expected: todo `[10]` en `ok`, incluidas:

```
  ok   la alerta del golpe queda registrada
  ok   la actuación se abre vinculada al golpe
  ok   la actuación dice que salió de un golpe detectado
  ok   el eslabón de apertura vincula el golpe sólo con primitivas y sin ubicación
  ok   la actuación vinculada se cierra
  ok   el expediente abierto desde un golpe verifica como íntegro
  ok   repetir el alta devuelve la misma actuación con un secreto nuevo
  ok   con la telemetría de otro teléfono la actuación se abre igual, sin vínculo
  ok   esa actuación queda con origen boton
  ok   responder una alerta vinculada a un expediente cerrado da 200
  ok   la respuesta posterior no agrega eslabones ni rompe la verificación
```

(cada línea puede terminar con el detalle que imprime el arnés), ningún `  FALLA` y `Circuito completo funcionando.` al final.

- [ ] **Step 8: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.`, sin ninguna línea `  FALLA`.

- [ ] **Step 9: Commit**

```bash
git add "app/api/casos/route.ts" "lib/casos.ts" "scripts/prueba-e2e.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Aceptar telemetria_id en el alta para vincular la actuación con el golpe

POST /api/casos con telemetria_id abre la actuación con abrirActuacionDesdeImpacto
y anota la posesión recién después del COMMIT, cuando la clave foránea ya ve la
fila. Responde vinculo_telemetria ok o rechazado, y ya_registrada con un secreto
nuevo si esa telemetría ya tenía actuación, así un reintento del teléfono no abre
una segunda. Caso suma origen y el GET lo devuelve.

El e2e prueba el circuito contra la base real: el eslabón de apertura sólo lleva
primitivas y ninguna ubicación, el expediente verifica íntegro, una telemetría ajena
abre una actuación sin vínculo y responder después del cierre no agrega eslabones.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Retención de la telemetría y e2e `[10l]`–`[10m]`

Índice F5.4, primera parte: `purgarTelemetria`, `purgarTelemetriaSiToca`, `aplicarPolitica`, y anonimizar y expurgar borran la telemetría vinculada (§5.5). La purga oportunista desde las rutas es la Tarea 8.

**Files:**
- Modify: `scripts/prueba-e2e.mjs` (el final del bloque de F5 que escribió la Tarea 6)
- Modify: `lib/retencion.ts` (imports, hoy líneas 1–5; `anonimizar`, hoy línea 94; `expurgar`, hoy líneas 129–134; `aplicarPolitica` con su comentario, hoy líneas 193–212)
- Test: `npm run e2e` con el servidor de «Antes de empezar»

**Interfaces:**
- Consumes:
  - `configuracionModoViaje(): ConfiguracionModoViaje` de `lib/telemetria.ts` (F1), con `dias_conservacion: number` (`TELEMETRIA_DIAS_CONSERVACION`, 90 por omisión).
  - `db()` y `pool()` de `lib/db.ts`; `candidatos()`, `anonimizar()` y `expurgar()` de `lib/retencion.ts`.
  - Tablas `telemetria` (`caso_id`, `ts`, `hubo_choque`, `gps`), `telemetria_episodios` (`telemetria_id`, `serie`, `velocidades`, con `ON DELETE CASCADE`) y `eventos_conduccion` (`recibido_en`) del esquema de F1.
  - En el e2e: el bloque de F5 de la Tarea 6 (`dueno`, `TEL`, `ID_IMPACTO`, `json`), `pedir`, `saltar`, `verificar`.
- Produces (índice «Interfaces › `lib/retencion.ts` (F5)»):
  - `export interface ResultadoPurgaTelemetria { alertas: number; eventos_conduccion: number }`
  - `export async function purgarTelemetria(ejecutar: boolean): Promise<ResultadoPurgaTelemetria>`
  - `export async function purgarTelemetriaSiToca(): Promise<void>` (la usa la Tarea 8 dentro de `after()`).
  - `export async function aplicarPolitica(ejecutar: boolean): Promise<{ simulado: boolean; acciones: Candidato[]; telemetria: ResultadoPurgaTelemetria }>`; por eso `POST /api/mantenimiento/expurgo`, que no se toca, pasa a responder también `telemetria`.
  - `anonimizar(casoId, motivo)` y `expurgar(casoId, motivo)` con la misma firma, borrando `telemetria` con ese `caso_id` dentro de su transacción.

- [ ] **Step 1: Escribir `[10l]` y `[10m]`**

En `scripts/prueba-e2e.mjs`, al final del bloque de F5, reemplazar:

```js
      `valido=${ver?.valido} eslabones=${ver?.eslabones} antes=${ESLABONES_H}`,
    )
  }
}
```

por:

```js
      `valido=${ver?.valido} eslabones=${ver?.eslabones} antes=${ESLABONES_H}`,
    )
  }

  console.log('\n[10l] Purga simulada')
  {
    const NOMBRE = 'la política de conservación informa cuánta telemetría vencida purgaría'
    if (process.env.CLAVE_MANTENIMIENTO) {
      const { res, cuerpo } = await pedir('/api/mantenimiento/expurgo', {
        method: 'POST',
        headers: { 'x-clave-mantenimiento': process.env.CLAVE_MANTENIMIENTO },
      })
      verificar(
        NOMBRE,
        res.status === 200 && cuerpo?.simulado === true && Number.isInteger(cuerpo?.telemetria?.alertas) && Number.isInteger(cuerpo?.telemetria?.eventos_conduccion),
        `status=${res.status} ${JSON.stringify(cuerpo?.telemetria ?? cuerpo)}`,
      )
    } else {
      saltar(NOMBRE, 'falta CLAVE_MANTENIMIENTO')
    }
  }

  console.log('\n[10m] Anonimizar')
  {
    const NOMBRES = [
      'anonimizar la actuación borra la telemetría vinculada',
      'el expediente anonimizado sigue verificando como íntegro',
      'la purga ejecutada corre contra la base sin error',
    ]
    if (process.env.E2E_DATABASE_URL) {
      // lib/db.ts arma el pool la primera vez con DATABASE_URL y DATABASE_SSL: se fijan antes de importar.
      process.env.DATABASE_URL = process.env.E2E_DATABASE_URL
      process.env.DATABASE_SSL = process.env.E2E_DATABASE_SSL ?? 'false'
      const { anonimizar, purgarTelemetria } = await import('../lib/retencion.ts')
      const { pool } = await import('../lib/db.ts')
      try {
        await anonimizar(ID_IMPACTO, 'prueba e2e')
        const { res } = await dueno.pedir(`/api/telemetria/${TEL}`)
        verificar(NOMBRES[0], res.status === 404, `status=${res.status}`)
        const { cuerpo: ver } = await dueno.pedir('/api/verificar', { method: 'POST', headers: json, body: JSON.stringify({ id: ID_IMPACTO }) })
        verificar(NOMBRES[1], ver?.valido === true, JSON.stringify(ver?.problemas ?? ver))
        // La única vez que los DELETE por lotes y los UPDATE de la purga corren contra Postgres de verdad.
        const purga = typeof purgarTelemetria === 'function' ? await purgarTelemetria(true) : null
        verificar(NOMBRES[2], Number.isInteger(purga?.alertas) && Number.isInteger(purga?.eventos_conduccion), JSON.stringify(purga))
      } finally {
        // Sin esto el proceso queda vivo hasta que el pool suelta sus conexiones ociosas.
        await pool().end()
      }
    } else {
      for (const nombre of NOMBRES) saltar(nombre, 'falta E2E_DATABASE_URL')
    }
  }
}
```

`[10m]` fija `DATABASE_URL` y `DATABASE_SSL` antes del `import()` dinámico porque `lib/db.ts` arma el pool la primera vez con esas dos variables (índice, decisión 2 del e2e), y cierra el pool al final para que el proceso termine. La tercera verificación de `[10m]` corre la purga real una vez: es el único lugar donde los `DELETE` por lotes y los `UPDATE` de la purga se ejecutan contra Postgres; `E2E_DATABASE_URL` es por definición una base descartable.

- [ ] **Step 2: Correr el e2e y ver las fallas de la retención**

Run: `npm run e2e`

Expected: `[10a]`–`[10k]` en `ok` y:

```
[10l] Purga simulada
  FALLA la política de conservación informa cuánta telemetría vencida purgaría status=200 {"ok":true,"simulado":true,"acciones":[]}

[10m] Anonimizar
  FALLA anonimizar la actuación borra la telemetría vinculada status=200
  ok   el expediente anonimizado sigue verificando como íntegro []
  FALLA la purga ejecutada corre contra la base sin error null
```

con `3 FALLARON` al final y código 1.

- [ ] **Step 3: Importar la configuración del modo viaje en `lib/retencion.ts`**

En `lib/retencion.ts`, reemplazar:

```ts
import { anotarEnBitacora } from './bitacora'
```

por:

```ts
import { anotarEnBitacora } from './bitacora'
import { configuracionModoViaje } from './telemetria'
```

- [ ] **Step 4: Borrar la telemetría vinculada al anonimizar**

En `anonimizar`, reemplazar:

```ts
    await cliente.query('UPDATE medias SET purgada_en = now() WHERE caso_id = $1 AND purgada_en IS NULL', [casoId])
    await cliente.query('COMMIT')
```

por:

```ts
    await cliente.query('UPDATE medias SET purgada_en = now() WHERE caso_id = $1 AND purgada_en IS NULL', [casoId])
    /*
     * La alerta del modo viaje vinculada guarda la hora, los sensores y la ubicación del golpe: es dato
     * personal y se va con lo demás. No está en la preimagen de ningún hash (el eslabón de apertura sólo
     * lleva primitivas copiadas), así que borrarla no mueve la verificación.
     */
    await cliente.query('DELETE FROM telemetria WHERE caso_id = $1', [casoId])
    await cliente.query('COMMIT')
```

- [ ] **Step 5: Borrar la telemetría vinculada al expurgar, antes que el caso**

En `expurgar`, reemplazar:

```ts
      [casoId, f.hash_maestro, f.creado_en, f.cerrado_en, motivo],
    )
    await cliente.query('DELETE FROM casos WHERE id = $1', [casoId])
```

por:

```ts
      [casoId, f.hash_maestro, f.creado_en, f.cerrado_en, motivo],
    )
    /*
     * Antes que el caso: telemetria.caso_id es ON DELETE SET NULL, así que borrar el caso dejaría la
     * alerta con la ubicación del golpe suelta, sin actuación y otra vez legible desde el teléfono.
     */
    await cliente.query('DELETE FROM telemetria WHERE caso_id = $1', [casoId])
    await cliente.query('DELETE FROM casos WHERE id = $1', [casoId])
```

- [ ] **Step 6: Sumar la purga de telemetría y llamarla desde `aplicarPolitica`**

En `lib/retencion.ts`, reemplazar:

```ts
/**
 * Aplica la política.
 *
 * SIMULA por omisión. Un proceso que borra expedientes tiene que decir primero qué va a
 * borrar: ejecutar de una es la clase de cosa que se descubre cuando ya no hay vuelta.
 */
export async function aplicarPolitica(ejecutar: boolean): Promise<{ simulado: boolean; acciones: Candidato[] }> {
  const acciones = await candidatos()
  if (!ejecutar) return { simulado: true, acciones }

  for (const a of acciones) {
    try {
      if (a.accion === 'expurgar') await expurgar(a.caso_id, `Plazo de conservación cumplido (${a.meses} meses)`)
      else await anonimizar(a.caso_id, `Plazo de conservación de las piezas cumplido (${a.meses} meses)`)
    } catch (err) {
      console.error('[retencion] no se pudo aplicar sobre', a.caso_id, err)
    }
  }
  return { simulado: false, acciones }
}
```

por:

```ts
/* ================= Telemetría del modo viaje ================= */

export interface ResultadoPurgaTelemetria {
  alertas: number
  eventos_conduccion: number
}

/*
 * De a cuántas filas borra cada DELETE. Es el mismo 500 que va escrito en el LIMIT de las dos
 * sentencias: un DELETE sin tope sobre semanas de alertas bloquea la tabla que los teléfonos están
 * escribiendo en ese momento.
 */
const LOTE_PURGA = 500

/** Una hora: la purga oportunista corre como mucho esto por proceso. */
const INTERVALO_PURGA_MS = 60 * 60 * 1000

/** Repite un DELETE de a LOTE_PURGA filas hasta que un lote borre menos. Devuelve el total borrado. */
async function borrarPorLotes(sql: string, dias: number): Promise<number> {
  const pg = await db()
  let total = 0
  for (;;) {
    const res = await pg.query(sql, [dias])
    const borradas = res.rowCount ?? 0
    total += borradas
    if (borradas < LOTE_PURGA) return total
  }
}

/**
 * Simulación: COUNT de telemetria con caso_id IS NULL y ts < now() − make_interval(days => $1::int), y de
 * eventos_conduccion con recibido_en < now() − …. Ejecución: por lotes de 500 con
 * DELETE FROM telemetria WHERE id IN (SELECT id FROM telemetria WHERE caso_id IS NULL AND ts < now() - make_interval(days => $1::int) ORDER BY ts LIMIT 500)
 * hasta que un lote borre menos de 500; lo mismo para eventos_conduccion por recibido_en. Además, al ejecutar:
 * gps en NULL donde hubo_choque = false, y serie y velocidades en NULL en los episodios de esas alertas.
 * Nunca por la hora del teléfono. Días = configuracionModoViaje().dias_conservacion.
 *
 * La hora que cuenta es la del servidor: la del teléfono puede estar corrida días, y una alerta con el
 * reloj atrasado se borraría antes de tiempo o no se borraría nunca. La telemetría vinculada a una
 * actuación no vence acá: se va con la actuación, al anonimizarla o expurgarla.
 */
export async function purgarTelemetria(ejecutar: boolean): Promise<ResultadoPurgaTelemetria> {
  const dias = configuracionModoViaje().dias_conservacion
  const pg = await db()

  if (!ejecutar) {
    const alertas = await pg.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM telemetria WHERE caso_id IS NULL AND ts < now() - make_interval(days => $1::int)',
      [dias],
    )
    const eventos = await pg.query<{ n: number }>(
      'SELECT count(*)::int AS n FROM eventos_conduccion WHERE recibido_en < now() - make_interval(days => $1::int)',
      [dias],
    )
    return { alertas: alertas.rows[0]?.n ?? 0, eventos_conduccion: eventos.rows[0]?.n ?? 0 }
  }

  const alertas = await borrarPorLotes(
    'DELETE FROM telemetria WHERE id IN (SELECT id FROM telemetria WHERE caso_id IS NULL AND ts < now() - make_interval(days => $1::int) ORDER BY ts LIMIT 500)',
    dias,
  )
  const eventos = await borrarPorLotes(
    'DELETE FROM eventos_conduccion WHERE id IN (SELECT id FROM eventos_conduccion WHERE recibido_en < now() - make_interval(days => $1::int) ORDER BY recibido_en LIMIT 500)',
    dias,
  )
  /*
   * Red de seguridad: el alta y la respuesta ya ponen en NULL la ubicación y la serie apenas hubo_choque
   * queda en false. Esto alcanza a las filas escritas antes de esa regla, que si no guardarían dónde
   * estaba alguien que dijo que no chocó hasta que venza el plazo.
   */
  await pg.query('UPDATE telemetria SET gps = NULL WHERE hubo_choque = false AND gps IS NOT NULL')
  await pg.query(
    `UPDATE telemetria_episodios SET serie = NULL, velocidades = NULL
      WHERE (serie IS NOT NULL OR velocidades IS NOT NULL)
        AND telemetria_id IN (SELECT id FROM telemetria WHERE hubo_choque = false)`,
  )
  return { alertas, eventos_conduccion: eventos }
}

/** Corre purgarTelemetria(true) como mucho una vez por hora por proceso (globalThis.__actaUltimaPurgaTelemetria). Nunca lanza: loguea. Se llama dentro de after(). */
export async function purgarTelemetriaSiToca(): Promise<void> {
  const memoria = globalThis as unknown as { __actaUltimaPurgaTelemetria?: number }
  const ahora = Date.now()
  const ultima = memoria.__actaUltimaPurgaTelemetria
  if (ultima !== undefined && ahora - ultima < INTERVALO_PURGA_MS) return
  /*
   * La marca va ANTES de purgar. Dos pedidos que terminan juntos disparan dos after() casi a la vez, y
   * con la marca al final correrían dos purgas en paralelo sobre las mismas filas. Si la purga falla,
   * se reintenta dentro de una hora y no en el pedido siguiente: con la base caída, reintentar en cada
   * lectura de un teléfono sólo suma carga.
   */
  memoria.__actaUltimaPurgaTelemetria = ahora
  try {
    const resultado = await purgarTelemetria(true)
    if (resultado.alertas > 0 || resultado.eventos_conduccion > 0) {
      console.log('[retencion] telemetría vencida purgada', resultado)
    }
  } catch (err) {
    console.error('[retencion] la purga oportunista de telemetría falló; se vuelve a intentar dentro de una hora', err)
  }
}

/**
 * Aplica la política.
 *
 * SIMULA por omisión. Un proceso que borra expedientes tiene que decir primero qué va a
 * borrar: ejecutar de una es la clase de cosa que se descubre cuando ya no hay vuelta.
 *
 * Llama purgarTelemetria(ejecutar) siempre, después de expurgos y anonimizaciones.
 */
export async function aplicarPolitica(
  ejecutar: boolean,
): Promise<{ simulado: boolean; acciones: Candidato[]; telemetria: ResultadoPurgaTelemetria }> {
  const acciones = await candidatos()
  if (!ejecutar) return { simulado: true, acciones, telemetria: await purgarTelemetria(false) }

  for (const a of acciones) {
    try {
      if (a.accion === 'expurgar') await expurgar(a.caso_id, `Plazo de conservación cumplido (${a.meses} meses)`)
      else await anonimizar(a.caso_id, `Plazo de conservación de las piezas cumplido (${a.meses} meses)`)
    } catch (err) {
      console.error('[retencion] no se pudo aplicar sobre', a.caso_id, err)
    }
  }
  /*
   * La telemetría va después: anonimizar y expurgar ya se llevaron la vinculada a esas actuaciones, y lo
   * que queda para purgar es sólo lo que nunca se vinculó.
   */
  return { simulado: false, acciones, telemetria: await purgarTelemetria(true) }
}
```

Las sentencias son las del índice: `make_interval(days => $1::int)` con los días de `configuracionModoViaje()`, siempre por `ts` o `recibido_en` (la hora del servidor, nunca la del teléfono), y la telemetría con `caso_id` fuera de la purga (se va con su actuación). La marca de `purgarTelemetriaSiToca` vive en `globalThis` para sobrevivir a las recargas de módulos de `next dev`, como el pool de `lib/db.ts`.

- [ ] **Step 7: Compilar y correr el contrato**

Run: `npm run tipos && npm run contrato`

Expected: `tipos` sin salida (`app/api/mantenimiento/expurgo/route.ts` compila sin cambios: esparce el resultado) y `El contrato se cumple.` (`ok   ningún nombre se exporta desde dos módulos de lib/` con los tres nombres nuevos).

- [ ] **Step 8: Correr el e2e en verde**

Run: `npm run e2e`

Expected: todo `[10]` en `ok`, incluidas:

```
  ok   la política de conservación informa cuánta telemetría vencida purgaría
  ok   anonimizar la actuación borra la telemetría vinculada
  ok   el expediente anonimizado sigue verificando como íntegro
  ok   la purga ejecutada corre contra la base sin error
```

(cada una con su detalle al final; la primera muestra `{"alertas":…,"eventos_conduccion":…}` con dos enteros), ningún `  FALLA` y `Circuito completo funcionando.`

- [ ] **Step 9: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.`, sin ninguna línea `  FALLA`.

- [ ] **Step 10: Commit**

```bash
git add "lib/retencion.ts" "scripts/prueba-e2e.mjs"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Purgar la telemetría vencida y borrar la vinculada al anonimizar o expurgar

La telemetría que nunca se vinculó a una actuación se borra a los días de
TELEMETRIA_DIAS_CONSERVACION contados con la hora del servidor, de a 500 filas por
sentencia para no bloquear la tabla que los teléfonos están escribiendo; lo mismo
los eventos de conducción. aplicarPolitica la corre siempre y la informa también
cuando simula. Como red de seguridad, una alerta con hubo_choque en false pierde la
ubicación y la serie.

Anonimizar y expurgar borran la alerta vinculada dentro de su transacción: guarda la
hora, los sensores y la ubicación del golpe, y no está en ningún hash.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Purga oportunista con `after()` en `POST /api/telemetria` y `POST /api/conduccion`

Índice F5.4, segunda parte. No hay planificador propio (§5.5), así que las dos rutas que los teléfonos llaman seguido disparan la purga después de responder, como mucho una vez por hora por proceso (índice «Contratos HTTP › `POST /api/telemetria`»: «→ respuesta → (F5) `after(() => purgarTelemetriaSiToca())`»; riesgo 12).

**Files:**
- Modify: `app/api/telemetria/route.ts` (versión de F1: el import de `next/server`, el de `@/lib/posesion` y las dos `return NextResponse.json(` del `try` de `POST`)
- Modify: `app/api/conduccion/route.ts` (versión de F1: el import de `next/server`, el de `@/lib/posesion` y la `return NextResponse.json(` del `try` de `POST`)
- Test: conteo con `grep`, `npm run tipos`, verificación manual contra el servidor de desarrollo, `npm run e2e`

**Interfaces:**
- Consumes:
  - `after<T>(task: AfterTask<T>): void` de `next/server`, con `AfterCallback<T> = () => T | Promise<T>` (`node_modules/next/dist/server/after/after.d.ts`); la documentación está en `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md`.
  - `purgarTelemetriaSiToca(): Promise<void>` (Tarea 7): nunca lanza, loguea.
- Produces: la purga de telemetría y eventos de conducción vencidos sin ningún proceso aparte.

- [ ] **Step 1: Leer la documentación de `after`**

Abrir `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md` (el archivo, directo; nunca una búsqueda dentro de `node_modules`). Lo que importa acá: el callback corre después de enviar la respuesta, se puede llamar desde un route handler y corre aunque la respuesta haya fallado; por eso lo que se le pasa tiene que atrapar sus propios errores, y `purgarTelemetriaSiToca` lo hace.

- [ ] **Step 2: Comprobar que hoy ninguna ruta purga**

Run: `grep -c "after(() => purgarTelemetriaSiToca())" app/api/telemetria/route.ts app/api/conduccion/route.ts`

Expected:

```
app/api/telemetria/route.ts:0
app/api/conduccion/route.ts:0
```

Y contar las respuestas que va a haber que cubrir:

Run: `grep -c "return NextResponse.json(" app/api/telemetria/route.ts app/api/conduccion/route.ts`

Expected: `app/api/telemetria/route.ts:2` (la del cuerpo del detector anterior y la del cuerpo nuevo) y `app/api/conduccion/route.ts:1`. Si los números difieren, F1 no quedó como su plan (Tarea 9, Steps 4 y 8) y los bloques de los Steps 3 y 4 no van a coincidir: se frena y se reporta. Los errores no retornan dentro del `try`: se lanzan y los traduce `errorApi`.

- [ ] **Step 3: Sumar `after` a `app/api/telemetria/route.ts`**

Los bloques de «reemplazar» son el archivo que escribe F1 (plan F1, Tarea 9, Step 4); ninguna fase posterior lo toca antes que ésta (índice, «Mapa de archivos»).

1. Reemplazar:

```ts
import { NextResponse } from 'next/server'
```

por:

```ts
import { after, NextResponse } from 'next/server'
```

2. Reemplazar:

```ts
import { huellaDispositivo } from '@/lib/posesion'
import { leerSesion } from '@/lib/sesion'
```

por:

```ts
import { huellaDispositivo } from '@/lib/posesion'
import { purgarTelemetriaSiToca } from '@/lib/retencion'
import { leerSesion } from '@/lib/sesion'
```

3. Reemplazar las dos respuestas del `try` de `POST`:

```ts
    if (esCuerpoLegado(crudo)) {
      const legado = await guardarTelemetriaLegada(decodificarCuerpoLegado(crudo), quien)
      return NextResponse.json(
        { ok: true, id: legado.id, veredicto: legado.veredicto, nivel: legado.nivel, plan: legado.plan },
        { status: 201 },
      )
    }

    const resultado = await guardarTelemetria(validarCuerpoTelemetria(crudo), quien, recibidoEnMs)
    return NextResponse.json(
```

por:

```ts
    if (esCuerpoLegado(crudo)) {
      const legado = await guardarTelemetriaLegada(decodificarCuerpoLegado(crudo), quien)
      // La purga de lo vencido corre después de responder: el teléfono no espera a que se borre nada.
      after(() => purgarTelemetriaSiToca())
      return NextResponse.json(
        { ok: true, id: legado.id, veredicto: legado.veredicto, nivel: legado.nivel, plan: legado.plan },
        { status: 201 },
      )
    }

    const resultado = await guardarTelemetria(validarCuerpoTelemetria(crudo), quien, recibidoEnMs)
    // La purga de lo vencido corre después de responder: el teléfono no espera a que se borre nada.
    after(() => purgarTelemetriaSiToca())
    return NextResponse.json(
```

Nunca `await` de la purga antes de responder (riesgo 12). Un error de validación se lanza antes de llegar a `after`, así que un cuerpo inválido no dispara la purga.

- [ ] **Step 4: Sumar `after` a `app/api/conduccion/route.ts`**

Los bloques de «reemplazar» son el archivo que crea F1 (plan F1, Tarea 9, Step 8).

1. Reemplazar:

```ts
import { NextResponse } from 'next/server'
```

por:

```ts
import { after, NextResponse } from 'next/server'
```

2. Reemplazar:

```ts
import { huellaDispositivo } from '@/lib/posesion'
import { guardarEventosConduccion } from '@/lib/telemetria'
```

por:

```ts
import { huellaDispositivo } from '@/lib/posesion'
import { purgarTelemetriaSiToca } from '@/lib/retencion'
import { guardarEventosConduccion } from '@/lib/telemetria'
```

3. Reemplazar:

```ts
    const { guardados } = await guardarEventosConduccion(lote, huella, recibidoEnMs)
    return NextResponse.json({ ok: true, guardados })
```

por:

```ts
    const { guardados } = await guardarEventosConduccion(lote, huella, recibidoEnMs)
    // La purga de lo vencido corre después de responder: el teléfono no espera a que se borre nada.
    after(() => purgarTelemetriaSiToca())
    return NextResponse.json({ ok: true, guardados })
```

La ruta sigue sin `leerSesion()` ni `usuario_id`: la purga no los necesita.

- [ ] **Step 5: Contar**

Run: `grep -c "after(() => purgarTelemetriaSiToca())" app/api/telemetria/route.ts app/api/conduccion/route.ts`

Expected:

```
app/api/telemetria/route.ts:2
app/api/conduccion/route.ts:1
```

Los mismos números que el segundo conteo del Step 2: una purga antes de cada respuesta.

- [ ] **Step 6: Compilar y correr el contrato**

Run: `npm run tipos && npm run contrato`

Expected: `tipos` sin salida y `El contrato se cumple.` (las dos rutas siguen con `runtime`, `dynamic` y `errorApi`).

- [ ] **Step 7: Verificar la purga contra el servidor de desarrollo**

1. Reiniciar `npm run dev` (Ctrl+C y otra vez) con las variables de «Antes de empezar»: la marca de la última purga vive en la memoria del proceso y un proceso nuevo la tiene vacía.
2. En la terminal del e2e, crear una alerta sin vincular de hace 100 días en la base descartable:

```bash
node -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.E2E_DATABASE_URL, ssl: process.env.E2E_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined }); c.connect().then(() => c.query(\"INSERT INTO telemetria (id, ts, nivel) VALUES ('TEL-PURGA1', now() - interval '100 days', 'nada') ON CONFLICT (id) DO NOTHING\")).then((r) => console.log('insertadas', r.rowCount)).finally(() => c.end())"
```

Expected: `insertadas 1`.

3. Mandar un lote de conducción:

```bash
node -e "fetch('http://localhost:3000/api/conduccion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ aviso_version: '2026-09-16', version_motor: 1, plataforma: 'otro', enviado_en: new Date().toISOString(), eventos: [[crypto.randomUUID(), 'frenada', new Date().toISOString(), 58.4, 30.2, 1800, 0.52, 0.61]] }) }).then(async (r) => console.log(r.status, await r.text()))"
```

Expected: `200 {"ok":true,"guardados":1}`, y en la terminal de `npm run dev`, después de esa respuesta, una línea que empieza con `[retencion] telemetría vencida purgada` y muestra `alertas` de 1 o más.

4. Confirmar que se borró:

```bash
node -e "const { Client } = require('pg'); const c = new Client({ connectionString: process.env.E2E_DATABASE_URL, ssl: process.env.E2E_DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined }); c.connect().then(() => c.query(\"SELECT count(*)::int AS n FROM telemetria WHERE id = 'TEL-PURGA1'\")).then((r) => console.log('quedan', r.rows[0].n)).finally(() => c.end())"
```

Expected: `quedan 0`.

5. Repetir el paso 3 enseguida. Expected: `200 {"ok":true,"guardados":1}` y ninguna línea nueva de `[retencion]` en la terminal del servidor (una purga por hora por proceso).

- [ ] **Step 8: Correr el e2e completo**

Run: `npm run e2e`

Expected: todo `[10]` en `ok` (`[10b]`–`[10f]` siguen pasando con `after` en las rutas), ningún `  FALLA` y `Circuito completo funcionando.`

- [ ] **Step 9: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.`, sin ninguna línea `  FALLA`.

- [ ] **Step 10: Commit**

```bash
git add "app/api/telemetria/route.ts" "app/api/conduccion/route.ts"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Purgar la telemetría vencida después de responder al teléfono

La aplicación no tiene un planificador propio, así que la purga de la telemetría
y de los eventos de conducción vencidos la disparan las dos rutas que los
teléfonos llaman seguido, dentro de after(): corre después de responder, como
mucho una vez por hora por proceso, y nunca hace esperar ni falla un pedido,
porque purgarTelemetriaSiToca atrapa y loguea sus propios errores.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Documentación: `/aviso` en el mapa y el texto de la ayuda en §12

Índice F5.5 («Docs: `/aviso` en el mapa; §12 registra el texto de la ayuda; matriz 10») y spec §3.7 y §6.6. La fila 10 de la matriz no es un documento en esta fase: se corre en «Verificación de la fase» y su texto va al README en F6, junto con el resto de la matriz.

**Files:**
- Modify: `docs/MAPA-PANTALLAS.md` (sección `## 1 · Notificación en pantalla de bloqueo`, filas `| Archivos |` y `| Endpoints |`; sección `## 2 · Inicio`, fila `| Clases |`; tabla «Pantallas que no están en el mockup», fila `| Aviso de impacto |`)
- Modify: `docs/CONTRATO-UI.md` (`### 12. Los avisos que dicen un límite`: la viñeta que empieza con `- «La aplicación no llama ni manda mensajes por su cuenta»`)
- Test: `grep`, `npm run contrato`

**Interfaces:**
- Consumes: lo que produjeron las Tareas 1, 2 y 3 (`app/components/AyudaImpacto.tsx`, `/aviso`, `.tarjeta-viaje-golpe`).
- Produces: el mapa y el contrato al día con F5.

- [ ] **Step 1: Comprobar que los documentos todavía no lo dicen**

Run:

```bash
grep -c "tarjeta-viaje-golpe" docs/MAPA-PANTALLAS.md
grep -c "No escribe nada al montar" docs/MAPA-PANTALLAS.md
grep -c "app/components/AyudaImpacto.tsx" docs/CONTRATO-UI.md
```

Expected: `0`, `0` y `0`.

- [ ] **Step 2: `/aviso` en la sección 1 del mapa**

En `docs/MAPA-PANTALLAS.md`, sección `## 1 · Notificación en pantalla de bloqueo`:
- en la fila `| Archivos |`, agregar `` · `app/components/AyudaImpacto.tsx` `` inmediatamente después de `` `app/aviso/page.tsx` ``;
- en la fila `| Endpoints |`, agregar `` · `GET /api/telemetria/[id]` · `POST /api/telemetria/[id]/respuesta` `` inmediatamente después de `` `POST /api/telemetria` ``.

- [ ] **Step 3: La fila de `/aviso` en «Pantallas que no están en el mockup»**

En `docs/MAPA-PANTALLAS.md`, reemplazar:

```markdown
| Aviso de impacto | `app/aviso/page.tsx` | Lo que abre la notificación del detector. Los tres botones que en iPhone no caben dentro de la notificación |
```

por:

```markdown
| Aviso de impacto | `app/aviso/page.tsx` · `app/components/AyudaImpacto.tsx` | Respaldo de la ayuda después de un golpe y destino de la notificación de impacto. No escribe nada al montar: si `?t=` es la alerta del motor trabaja con el motor; si no, la lee con `GET /api/telemetria/[id]` y responde con `POST /api/telemetria/[id]/respuesta` sólo cuando la persona llama o marca la falsa alarma. Nunca repite «¿Estás bien?» |
```

- [ ] **Step 4: La clase del golpe pendiente en el inicio**

En `docs/MAPA-PANTALLAS.md`, sección `## 2 · Inicio`, en la fila `| Clases |`, agregar `` , `.tarjeta-viaje-golpe` `` inmediatamente antes del `|` final de la fila.

- [ ] **Step 5: El texto de la ayuda en §12 del contrato**

En `docs/CONTRATO-UI.md`, `### 12. Los avisos que dicen un límite`, reemplazar la viñeta:

```markdown
- «La aplicación no llama ni manda mensajes por su cuenta» (contacto de confianza).
```

por:

```markdown
- «La aplicación no llama ni manda mensajes por su cuenta» (contacto de confianza en «Mis datos» y en la ayuda después de un golpe, `app/components/AyudaImpacto.tsx`).
```

Si F4 ya había cambiado el paréntesis de esa viñeta, se reemplaza el paréntesis que haya por el de arriba; el texto entre comillas no cambia.

- [ ] **Step 6: Comprobar**

Run:

```bash
grep -c "tarjeta-viaje-golpe" docs/MAPA-PANTALLAS.md
grep -c "No escribe nada al montar" docs/MAPA-PANTALLAS.md
grep -c "app/components/AyudaImpacto.tsx" docs/CONTRATO-UI.md
npm run contrato
```

Expected: `1`, `1`, `1` y `El contrato se cumple.` (incluye `ok   toda pantalla del recorrido figura en el mapa`).

- [ ] **Step 7: Las tres verificaciones**

Run: `npm run contrato && npm run tipos && npm run prueba`

Expected: `El contrato se cumple.`, `tipos` sin salida y `Todo en orden.`, sin ninguna línea `  FALLA`.

- [ ] **Step 8: Commit**

```bash
git add "docs/MAPA-PANTALLAS.md" "docs/CONTRATO-UI.md"
git -c user.name="Mateo Morbiducci" -c user.email="mateomorbi19@gmail.com" commit -m "$(cat <<'EOF'
Documentar /aviso y el texto de la ayuda en el mapa y el contrato

El mapa decía que /aviso era la pantalla de los tres botones de la notificación.
Ahora es el respaldo de la ayuda después de un golpe, no escribe nada al abrirse y
usa AyudaImpacto; el inicio suma la clase del golpe pendiente. El contrato registra
que «La aplicación no llama ni manda mensajes por su cuenta» también está en la
ayuda: es un aviso de límite, no relleno, y un agente visual no lo puede acortar.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Verificación de la fase

- [ ] **1. Las tres verificaciones, desde la raíz:**

```bash
npm run contrato && npm run tipos && npm run prueba
```

Expected: `El contrato se cumple.`, `tipos` sin salida con código 0, y `Todo en orden.` al final de `npm run prueba`, sin ninguna línea `  FALLA`.

- [ ] **2. `[V8]` sola:**

Run: `SECCION=V8 npx tsx scripts/prueba-viaje.mjs`

Expected: 24 líneas `  ok   ` bajo `[V8] Alta vinculada`, `24/24 verificaciones pasaron` y `Todo en orden.`

- [ ] **3. El e2e completo** (índice: «F5 … Se puede probar: Matriz 10; e2e completo»), con el servidor y las variables de «Antes de empezar»:

Run: `npm run e2e`

Expected: `[0]`–`[9]` y `[10a]`–`[10m]` en `ok`, ninguna línea `  FALLA`, ninguna línea `  salta` en `[10h]`–`[10m]`, y `Circuito completo funcionando.` al final.

- [ ] **4. Lo que se ve en el navegador** (Chrome de escritorio contra `npm run dev`): repetir el Step 12 de la Tarea 1 (alerta en `ayuda` restaurada: «No respondiste», tres teléfonos con número, compartir, registrar, falsa alarma), el Step 5 de la Tarea 2 (`/aviso` no escribe al abrir, registra al llamar y vuelve al inicio con la falsa alarma) y el Step 13 de la Tarea 3 (golpe pendiente en la tarjeta, en la píldora con el modo apagado y en la hoja). Mismos resultados que en cada tarea.

- [ ] **5. Matriz de §6.5, fila 10: «Modo avión durante la cuenta» → «Estado `ayuda` sin error; al volver la red, una sola alerta».**

La alerta tiene que ser una alerta real del motor: sólo así existe en la cola del teléfono con sus `CamposAlerta` completos (índice, «Interfaces › `lib/cola-viaje.ts` (F3)», `ColaViaje.guardarAlerta`), que es lo que sube al volver la red.

Entorno (el mismo de la Tarea 9 del plan F4, Steps 1 a 3): staging por https con certificado de confianza y esta rama desplegada (por `http://192.168.x.x` los sensores no existen), con `MODO_VIAJE_ALERTA=normal`, `IMPACTO_UMBRAL_SOSPECHA_G=2` e `IMPACTO_MS_SOBRE_UMBRAL=5`; un Android con Chrome, la aplicación instalada, el permiso de ubicación del sitio **denegado** (sin velocidad, el golpe sobre la mesa decide `sospecha` y abre la alerta; con GPS preciso y el teléfono quieto decidiría `nada`) y depuración USB abierta desde `chrome://inspect` en la computadora.

1. Encender el modo viaje desde la tarjeta, ir a `/poliza`, apoyar el teléfono plano sobre una mesa y dar un golpe seco con la palma sobre la mesa, al lado del teléfono, sin moverlo antes. Expected: aparece «¿Estás bien?» con la cuenta.
2. Enseguida, sin tocar la pantalla, activar el modo avión en el teléfono.
3. En la consola remota (sigue andando por USB sin red), anotar el `id_cliente` de la alerta:

```js
JSON.parse(localStorage.getItem('acta:viaje:alerta')).idCliente
```

Expected: un UUID entre comillas.

4. Expected al llegar a cero: la alerta pasa a «No respondiste» sin ningún mensaje de error, con los tres teléfonos, «No hay ubicación: el GPS estaba apagado» en el lugar de «Compartir mi ubicación», «Registrar el accidente» y «Estoy bien, fue una falsa alarma». Tocar «Registrar el accidente»: aparece «Sin señal: la lectura queda guardada en el teléfono. Llamá desde los botones de arriba y registralo cuando vuelva la señal.» y la alerta sigue abierta. La consola remota no muestra errores sin atrapar.
5. Desactivar el modo avión y esperar 40 segundos (el proveedor drena la cola al volver `online` y cada 30 s), sin tocar la alerta.
6. Expected en la base de staging, con el UUID del paso 3:

```sql
SELECT count(*)::int AS alertas, max(respuesta) AS respuesta, bool_or(alerta_mostrada) AS mostrada
  FROM telemetria
 WHERE id_cliente = '<UUID del paso 3>';
```

da `alertas = 1`, `respuesta = 'sin_respuesta'` y `mostrada = true`; la misma consulta un minuto después da lo mismo (si la alerta alcanzó a subir antes del modo avión, el reintento funde sobre la misma fila y el conteo sigue en 1).
7. Tocar «Estoy bien, fue una falsa alarma» para cerrar la prueba, apagar el modo viaje desde la tarjeta y volver staging a `IMPACTO_UMBRAL_SOSPECHA_G` e `IMPACTO_MS_SOBRE_UMBRAL` sin cargar.

Para mirar sólo la interfaz de los pasos 2 y 4 sin provocar un golpe (por ejemplo en Chrome de escritorio con DevTools › Network › Offline), se puede restaurar una alerta en `pregunta` con el formato de «Almacenamiento del cliente › `acta:viaje:alerta`» y recargar:

```js
const ahora = Date.now()
localStorage.setItem('acta:viaje:alerta', JSON.stringify({ estado: 'pregunta', idCliente: '6b1f2c3d-4e5a-4b6c-9d7e-8f9a0b1c2d3e', idServidor: null, plazo: ahora + 25000, ocurridoEn: ahora - 3000, abiertaEn: ahora - 5000, ayudaDesde: null, apertura: 'episodio', origenAyuda: null, respuestas: [], huboChoque: null, ubicacion: { lat: -34.6037, lon: -58.3816 } }))
location.reload()
```

Esa alerta nunca pasó por la cola del motor, así que no sirve para la fila 10: no se espera ninguna fila en `telemetria` y la consulta del paso 6 no se corre con ella.

- [ ] **6. Historial:** `git log --oneline -9` muestra, en este orden, los nueve commits de las Tareas 1 a 9 sobre `modo-viaje-global`, y `git status --short` no muestra nada fuera de `docs/superpowers/plans/`.

## Desvíos respecto del índice

1. **La tarjeta y la hoja también leen `actuacionAbierta()`.** El índice, en «Almacenamiento del cliente» (`docs/superpowers/plans/2026-09-16-modo-viaje-00-indice.md:2123`), nombra a `AyudaImpacto.tsx` como el único lector de `actuacionAbierta()` fuera del motor. El golpe pendiente registra «como en §3.4» (spec `docs/superpowers/specs/2026-09-16-modo-viaje-global-design.md:521-522`), y §3.4 (`…-design.md:496-498`) manda a la actuación ya abierta en vez de abrir otra; sin esa lectura, quien tocó «Tuve un accidente» y después toca «Golpe detectado · Registrar este choque» duplica el siniestro. Es la misma función de `lib/local.ts` (con su `try/catch`) y `app/page.tsx` ya la usaba (`app/page.tsx:46`); `GolpeEnTarjeta` (Tarea 3, Step 9) y `SeccionGolpePendiente` (Tarea 3, Step 4) la leen en un efecto y otra vez al tocar.
