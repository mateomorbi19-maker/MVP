# Mapa de pantallas

De cada pantalla del mockup al archivo que la dibuja, las clases que usa y el endpoint del
que depende. Si creás una pantalla nueva bajo `app/s/[id]/pantallas/`, agregala acá:
`npm run contrato` falla si falta.

Las nueve pantallas del mockup están numeradas en el orden real de uso. El PDF de
referencia las trae invertidas.

---

## 1 · Notificación en pantalla de bloqueo

| | |
| --- | --- |
| Archivos | `public/sw.js` (push y notificationclick) · `app/aviso/page.tsx` · `components/DetectorImpacto.tsx` |
| Endpoints | `GET /api/push/clave-publica` · `POST /api/push/dispositivos` · `POST /api/telemetria` |

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
| Consentimiento del tercero | `pantallas/PantallaConsentimiento.tsx` | `.qr`, `.qr-imagen`, `.aviso[data-nivel]` | `GET /api/casos/[id]/qr?destino=tercero` |
| Ubicación | `pantallas/ChipUbicacion.tsx` | `.chip[data-estado]`, `.punto[data-estado]`, `.chip-flecha` | `POST /api/casos/[id]/ubicacion` |
| Conmutador | `Flujo.tsx` | `.envoltura-flujo`, `.pantalla[data-paso][data-bloque]`, `.progreso-fino`, `.progreso-fino-relleno`, `.volver` | — |

**Intocable en la pantalla de foto:** el disparador es un `<label>` que envuelve el
`<input type="file" capture="environment">`. Convertirlo en `<button>` —que es lo obvio,
porque ya parece un botón— deja de abrir la cámara. Sacar `capture` abre la galería, y la
evidencia deja de ser una toma del lugar. El `<small>` que dice «La hora y el lugar los
pone el sistema, no el archivo» sostiene el valor probatorio: no se borra.

## 5 · Revisión de lo que leyó la máquina

| | |
| --- | --- |
| Archivo | `pantallas/PantallaValidacion.tsx` |
| Clases | `.tarjeta`, `.campo`, `.insignia[data-nivel]`, `.aviso[data-nivel]`, `.omitir` |
| Endpoints | `GET /api/casos/[id]/extracciones` · `POST …/[extraccionId]/confirmar` |

Ocurre en el lugar del hecho y no en casa, a diferencia del mockup: se lee lo que se
fotografió recién, y va después del relato en audio para no romper su orden.

**Tres cosas que no se tocan:**

1. **No se muestra el porcentaje de confianza.** La propia especificación funcional lo
   pide: un número que la persona no sabe interpretar genera dudas legales sin aportar
   nada de uso. Cada campo dice «Verificado» o «Revisar dato». El número queda en el
   expediente y en el panel de la aseguradora, que es donde sirve.
2. **Un campo «Revisar dato» llega vacío**, con la lectura como pista en el placeholder.
   Para confirmarlo hay que escribirlo.
3. **«Lo reviso después» siempre avanza.** Lo que se fuerza es confirmar, no avanzar.

El aviso rojo de «lectura de demostración» aparece cuando el proveedor es el simulado, que
inventa nombres y DNI con formato argentino correcto que **no salen de la foto**. No se
borra ni se suaviza.

## 6 · Modo casa · contexto y cierre

Hoy son las preguntas del bloque `despues` más la pantalla de corte, con el mismo
componente de pregunta de la etapa 4.

| Pantalla | Archivo | Clases |
| --- | --- | --- |
| Corte | `pantallas/PantallaCorte.tsx` | `.hito`, `.hito-simbolo`, `.numero-actuacion` |
| Relato ampliado | `pantallas/PantallaPregunta.tsx` (tipo `parrafo`) | `.ayuda`, `.campo-grande` |
| Croquis | `pantallas/PantallaCroquis.tsx` + `components/CroquisVisor.tsx` | `.croquis`, `.croquis-lienzo`, `.croquis-calzada`, `.croquis-linea`, `.croquis-vehiculo`, `.croquis-flecha`, `.croquis-impacto` |
| Carátula | `pantallas/PantallaDatos.tsx` | `.campo`, `.campo-grande` |

**Intocable en el croquis:** `.croquis` declara `aspect-ratio: 1` y no recibe `width` y
`height` por separado, ni `padding` ni `border` sobre el propio `<svg>` —el borde va en
`.croquis-lienzo`, el div de afuera—. El `viewBox` es `0 0 100 100` y no se toca. Con una
caja de otra proporción el dibujo se apaisa dentro y aparece letterboxing, y el croquis de
la pantalla deja de coincidir con el que se imprime en el expediente.

El arrastrar y soltar del mockup queda para una segunda etapa: la especificación funcional
dice expresamente que no es prioritario. El modelo de datos ya es el definitivo, así que el
paso 2 reemplaza sólo el editor.

El pie que dice que el croquis es declarativo y no un peritaje es obligatorio en las dos
vistas y en el PDF. No es una nota al pie decorativa: es lo que evita que un dibujo armado
eligiendo de una lista se lea como una reconstrucción.

## 6b · La firma

| | |
| --- | --- |
| Archivo | `pantallas/PantallaFirma.tsx` + `components/LienzoFirma.tsx` |
| Clases | `.lienzo-firma`, `.lienzo-firma-area`, `.tarjeta`, `.campo`, `.mono`, `.omitir` |
| Endpoints | `GET /api/casos/[id]/acta` · `POST /api/casos/[id]/firma` |

Etapa propia, antes de la revisión y no dentro de ella: la revisión ya es la pantalla más
cargada del recorrido y meter el lienzo ahí empuja a firmar sin leer.

**Intocable:**

- El canvas recibe `width` y `height` en píxeles reales desde JavaScript, no desde CSS.
  Con el tamaño puesto por CSS el navegador escala el bitmap y el trazo sale borroso y
  corrido respecto del dedo.
- `touch-action: none` sobre `.lienzo-firma`. Sin eso, arrastrar el dedo hace scroll de la
  página en vez de dibujar: no se puede firmar en un teléfono.
- `.lienzo-firma-area` lleva alto en píxeles y **no** en `dvh`, `svh` ni `lvh`. Esas
  unidades cambian cuando el navegador móvil esconde la barra de direcciones, y el trazo se
  re-escala mientras la persona está firmando.
- **«Cerrar sin firmar» nunca desaparece.** La firma es opcional y su ausencia no genera
  ningún reproche en el informe.

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

La entrega vive en `components/EntregaExpediente.tsx`: descargar, compartir y mandárselo al
productor.

**Compartir usa el share sheet del propio teléfono** (`navigator.share`), no una
integración con WhatsApp. No hace falta ninguna API, la persona elige por dónde mandarlo, y
funciona igual con Telegram, con el correo o con AirDrop. Cuando el navegador no lo soporta
—Firefox de escritorio, Chrome sin archivos— el plan B es descargar y compartir el enlace
de verificación, que es lo que la persona iba a mandar igual.

## 8b · Páginas de la entrega

| Pantalla | Archivo | Para qué |
| --- | --- | --- |
| Verificación pública | `app/v/[id]/page.tsx` | Lo que abre el código impreso en el acta. **Sin un solo dato personal**: número, fechas, hash e integridad. Para ver el contenido hace falta la actuación, una cuenta o el enlace de entrega. |
| Abrir desde el correo | `app/e/[id]/page.tsx` | El token llega en el fragmento de la URL, después del `#`, y se consume por POST con un clic. Los escáneres de enlaces corporativos visitan todos los enlaces de un correo antes que nadie: el fragmento no viaja al servidor, así que no pueden quemar un token de un solo uso. |
| Tramitación | `components/AccionesGestion.tsx` (en `/panel/[id]`) | Confirmar recepción, poner en trámite, comentar. Cadena propia, anclada al hash del acta pero fuera de ella. |

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
