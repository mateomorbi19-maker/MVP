# Mapa de pantallas

De cada pantalla del mockup al archivo que la dibuja, las clases que usa y el endpoint del
que depende. Si creás una pantalla nueva bajo `app/s/[id]/pantallas/`, agregala acá:
`npm run contrato` falla si falta.

Las nueve pantallas del mockup están numeradas en el orden real de uso. El PDF de
referencia las trae invertidas.

---

## 1 · Notificación en pantalla de bloqueo

**Estado: no construida.** Llega con el módulo de notificaciones.

Límite que hay que tener presente antes de maquetarla: **en iPhone no existe.** Web Push
en iOS ignora por completo el arreglo `actions`, así que los tres botones del mockup
—Llamar a emergencias / Solicitar asistencia / Reportar accidente— no se pueden dibujar
dentro de una notificación. En Android sí existen, pero Chrome sólo muestra **dos**
(`Notification.maxActions`), y sólo con la aplicación instalada.

El degradado previsto: en Android van dos acciones reales; en iPhone la notificación es un
solo toque que abre una pantalla nuestra con los tres botones grandes, que sí es marcado
normal y sí se puede estilar. La maqueta de esta pantalla se rotula **«sólo Android»**.

El branding del estudio jurídico que aparece en el mockup **no va**: la propia
especificación funcional pide sacarlo de la pantalla de emergencia. En el momento de un
accidente la persona necesita ayuda, no publicidad. El branding queda para la aplicación y
el acta.

## 2 · Inicio

| | |
| --- | --- |
| Archivo | `app/page.tsx` |
| Clases | `.inicio`, `.inicio-centro`, `.inicio-pie`, `.boton-gigante`, `.enlaces-pie`, `.aviso[data-nivel]` |
| Endpoints | `GET /api/salud` al montar · `POST /api/casos` al tocar el botón |
| Cupo de estilos en línea | 3 |

**Intocable:** el botón «Tuve un accidente» es lo primero del DOM y no puede depender de
ninguna consulta. Es un Client Component a propósito: si el inicio pasara a resolverse en
el servidor, con la base lenta o caída la persona vería un error en vez del botón. El
aviso de sistema no operativo aparece *encima* pero no lo desplaza ni lo tapa.

Las emergencias 911 / 100 / 107 y los accesos a póliza e historial que muestra el mockup
llegan con el módulo de cuentas.

## 3 · Ingreso

**Estado: no construida.** Llega con el módulo de cuentas.

Decisión de producto que cambia el mockup: **el ingreso no va a ser la primera pantalla.**
El botón «Tuve un accidente» sigue sin pedir nada. La sesión sirve para ver la póliza, el
historial y mandarle el acta al productor, y para vincular después una actuación que se
abrió sin identificarse. Un formulario entre la persona y la evidencia perecedera es
exactamente lo que hace que alguien con adrenalina abandone.

## 4 · Modo lugar del hecho

El mockup lo muestra como una sola pantalla con todo junto. La aplicación lo resuelve como
**una pregunta por pantalla**, que es la decisión de diseño que ordena el producto entero:
botones grandes, un toque por respuesta, y elegir es avanzar.

| Pantalla | Archivo | Clases | Endpoint |
| --- | --- | --- | --- |
| Una pregunta | `pantallas/PantallaPregunta.tsx` | `.pregunta`, `.pregunta-ayuda`, `.opciones`, `.opcion[data-elegida]`, `.marca-opcion`, `.marca-opcion-punto`, `.zonas`, `.zona[data-elegida]`, `.campo`, `.omitir` | `PATCH /api/casos/[id]` |
| Emergencia | `pantallas/PantallaEmergencia.tsx` | `.emergencia`, `.boton-llamada` | ninguno (`tel:`) |
| Relato en audio | `pantallas/GrabadorAudio.tsx` | `.grabando`, `.contador`, `.aviso[data-nivel]` | `POST /api/casos/[id]/media` |
| Una foto | `pantallas/PantallaFoto.tsx` | `.foto-guiada`, `.foto-tomada`, `.entrada-oculta`, `.miniatura` | `POST /api/casos/[id]/media` |
| Testigos | `pantallas/PantallaTestigos.tsx` | `.qr`, `.qr-imagen`, `.punto[data-estado]` | `GET /api/casos/[id]/qr` |
| Ubicación | `pantallas/ChipUbicacion.tsx` | `.chip[data-estado]`, `.punto[data-estado]`, `.chip-flecha` | `POST /api/casos/[id]/ubicacion` |
| Conmutador | `Flujo.tsx` | `.envoltura-flujo`, `.pantalla[data-paso][data-bloque]`, `.progreso-fino`, `.progreso-fino-relleno`, `.volver` | — |

**Intocable en la pantalla de foto:** el disparador es un `<label>` que envuelve el
`<input type="file" capture="environment">`. Convertirlo en `<button>` —que es lo obvio,
porque ya parece un botón— deja de abrir la cámara. Sacar `capture` abre la galería, y la
evidencia deja de ser una toma del lugar. El `<small>` que dice «La hora y el lugar los
pone el sistema, no el archivo» sostiene el valor probatorio: no se borra.

## 5 · Modo casa · revisión de lo que detectó la IA

**Estado: no construida.** Llega con el módulo de lectura automática.

Cambio obligatorio respecto del mockup: **no se muestra el porcentaje de confianza.** La
propia especificación funcional lo pide. Cada campo se marca «Verificado» o «Revisar
dato»; el número queda como dato interno de soporte, en el panel de la aseguradora.

## 6 · Modo casa · contexto y cierre

Hoy son las preguntas del bloque `despues` más la pantalla de corte, con el mismo
componente de pregunta de la etapa 4.

| Pantalla | Archivo | Clases |
| --- | --- | --- |
| Corte | `pantallas/PantallaCorte.tsx` | `.hito`, `.hito-simbolo`, `.numero-actuacion` |
| Carátula | `pantallas/PantallaDatos.tsx` | `.campo`, `.campo-grande` |

El croquis y el relato ampliado llegan con su módulo.

## 7 · Generando el acta

| | |
| --- | --- |
| Archivo | `pantallas/PantallaRevision.tsx` |
| Clases | `.tarjeta`, `.pila`, `.punto[data-estado]`, `.faltante`, `.faltante-ir`, `.aviso[data-nivel]` |
| Endpoint | `POST /api/casos/[id]/cerrar` |
| Cupo de estilos en línea | 8 |

**Intocable:** el botón de sellar **no se deshabilita nunca** por faltantes. Cada faltante
es un botón que lleva directo a esa pregunta, y el expediente se puede cerrar igual. Un
expediente incompleto vale más que uno abandonado en la tercera pantalla.

El mockup dice «Hash blockchain» y «Prueba inviolable». **No se usa ninguno de los dos.**
No hay blockchain, y lo que el sistema garantiza es detección, no imposibilidad. El texto
correcto está en el componente.

## 8 · Acta lista

| | |
| --- | --- |
| Archivo | `pantallas/PantallaFinal.tsx` |
| Clases | `.tarjeta`, `.centrado`, `.numero-actuacion`, `.mono` |
| Endpoints | `GET /api/casos/[id]/pdf` · `GET /api/casos/[id]/pdf?descargar=1` |

Compartir por WhatsApp y enviar al productor llegan con el módulo de entrega.

## 9 · El acta en PDF

| | |
| --- | --- |
| Archivo | `lib/pdf.ts` |
| Endpoint | `GET /api/casos/[id]/pdf` |

**No es HTML y no lleva CSS.** Es un documento A4 dibujado a mano sobre `pdf-lib`, con su
propio motor de maquetación. Cambiarle el aspecto es editar código de servidor, no estilos.

Dos cosas que hay que saber antes de tocar cualquier texto que termine acá:

1. Las fuentes estándar de PDF usan **WinAnsi**. Todo carácter por encima de U+00FF se
   borra sin aviso: una viñeta, una flecha, un tilde ✓, un signo ≥. En pantalla se ve
   perfecto y en el documento que va al liquidador no está. `npm run contrato` lo detecta
   para los textos del cuestionario.
2. El PDF imprime el **texto de la pregunta** como etiqueta del expediente sellado. Cambiar
   un enunciado cambia lo que dice un documento con valor probatorio.

---

## Pantallas que no están en el mockup

| Pantalla | Archivo | Para qué |
| --- | --- | --- |
| Carga de testigo | `app/t/[id]/page.tsx` | El testigo escanea el QR y carga sus datos desde su propio teléfono, con consentimiento expreso |
| Verificador público | `app/verificar/page.tsx` | Cualquiera comprueba la integridad de un expediente con su número |
| Panel de la aseguradora | `app/panel/page.tsx`, `app/panel/[id]/page.tsx` | Listado y detalle, con el informe de consistencia |
