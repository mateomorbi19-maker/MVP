# Acta Digital de Siniestro

Registro probatorio de siniestros viales. Reúne fotos del lugar, documentación previa y
declaraciones, conserva sus distintos orígenes, los incorpora a una cadena de custodia
verificable y genera un expediente en PDF para presentar ante la aseguradora.

Versión 1 — MVP. Orientado a **aseguradora**: prioriza hechos objetivos, datos de cobertura y
detección de contradicciones.

---

## Qué hace

La persona abre la aplicación en el celular parada al lado del auto y toca **un solo
botón**: "Tuve un accidente". No se le pide nada antes: ni la póliza, ni la patente, ni el
nombre. Un formulario en la primera pantalla es exactamente lo que hace que alguien con
adrenalina abandone.

A partir de ahí hay pantallas breves y botones grandes. El recorrido actual es:

1. **Daños y documentación del otro vehículo** — foto del daño propio con patente visible,
   cantidad de vehículos y, cuando corresponde, daño y papeles del otro conductor.
   Se pueden sumar fotos adicionales opcionales.
2. **Guardar o continuar** — el corte permite guardar y relatar después. Ahí se puede
   elegir el vehículo y la póliza, incorporar documentación propia y generar un QR limitado
   para compartirla. También ofrece QR para testigos y permite anotar varios teléfonos.
3. **Un solo relato** — por escrito o con audio, con una guía permanente. Se puede escuchar,
   descartar y volver a grabar antes de confirmar. La transcripción, si está configurada,
   es editable; se distingue el texto original recibido del texto confirmado.
4. **Lo que se completa después** — circulabilidad y ubicación actual del vehículo,
   intervención policial Sí/No, número y foto o PDF del acta cuando corresponde, otros
   intervinientes, VTV y alcoholemia. Los formularios redundantes y el croquis ya no se
   muestran en actuaciones nuevas; sus datos anteriores se conservan.
5. **Firma, revisión y cierre** — la firma electrónica se vincula al hash del acta mostrada.
   Se revisan faltantes y se cierra el expediente. Una firma de contenido anterior se
   rechaza para que la persona vuelva a revisar y firmar.
6. **Expediente PDF y verificación** — fotos, documentos elegidos, relato, testigos,
   contactos anotados, informe de consistencia y cadena de custodia. Los contactos
   aportados por el asegurado se distinguen de los testimonios con consentimiento.

Con permiso del navegador se registra la ubicación disponible. La dirección y el clima
dependen de la conexión y de sus proveedores; si no se obtienen, se informa la ausencia.
Una coordenada ausente no se convierte en `0,0`. La hora de recepción del servidor se
distingue de la hora declarada por el dispositivo y de la documentación cargada antes del
hecho. Al cerrar se calcula el hash maestro y se solicita el sello RFC 3161 cuando la TSA
está habilitada. El expediente cerrado no admite nuevas piezas ni eventos de cadena.

Más un **panel** para la aseguradora y un **verificador público** de integridad.

---

## El orden es de urgencia, no jurídico

El recorrido visible se calcula a partir de las respuestas y las definiciones de
`lib/cuestionario.ts`. El archivo también conserva preguntas y tomas retiradas para leer
expedientes anteriores: su cantidad total no describe lo que se le pide hoy a una persona.

| Etapa | Qué contiene | Por qué ahí |
| --- | --- | --- |
| `lugar` | daños con patentes, cantidad de vehículos, documentos del tercero y extras | Conviene obtenerlo antes de irse |
| Corte | guardar/continuar, documentación propia y contactos de testigos | Permite retomar sin repetir la primera etapa |
| `despues` | relato, estado del vehículo, intervenciones, VTV, alcoholemia, firma y revisión | Puede completarse más tarde |

Las preguntas sobre heridos y riesgo se conservaron para los históricos y están ocultas
en el recorrido actual. Las omisiones visibles quedan en la revisión y no impiden cerrar
un expediente incompleto. La falta de documentación propia tampoco bloquea una denuncia
urgente. Los avisos de emergencia no llaman por su cuenta.

El paso y las omisiones se guardan en el servidor y en un borrador local cuando el
navegador lo permite. Las fotos pendientes usan una cola local. Si falla la conexión, la
interfaz informa el estado del guardado; no conviene cerrar una página que avisa que no
pudo guardar ni en el servidor ni en el dispositivo.

## Mi documentación y pólizas

Se pueden cargar varias pólizas y elegir cuál es principal. Cada vehículo se identifica
por su póliza; la patente, cobertura, vigencia y contactos del productor y de la
aseguradora se pueden editar. Tener varias pólizas no atribuye automáticamente la patente
del vehículo principal a una actuación sin selección expresa.

La documentación reúne **fotos de póliza, cédula, licencia y DNI**. Los PDF y los datos a
mano complementan las fotos. La indicación de documentación completa exige una foto de
cada categoría para el vehículo elegido; la persona debe revisar legibilidad y caras
necesarias. Los archivos de póliza y cédula se asocian a una póliza, mientras licencia y DNI
son personales. Los archivos anteriores sin asignar requieren elegir su vehículo.

Desde el recorrido se puede guardar el vehículo elegido aunque todavía no haya archivos.
Para incorporar o compartir documentos hay que seleccionarlos expresamente: el sistema
copia sus bytes al expediente, conserva su hash y los identifica como documentación
previa. Cambiar o borrar el original de la cuenta no cambia esa copia. No se mezclan
documentos de distintos vehículos.

El QR de documentación permite acceder sólo a las copias seleccionadas por **24 horas** y
puede revocarse, incluso después del sellado. Un permiso nuevo reemplaza el anterior de la
misma cuenta y actuación. La revocación no borra las copias que un receptor ya descargó.

El estado de cuenta es **informativo y manual**, con fecha, origen, modalidad de pago,
saldo y movimientos. Lo puede cargar el titular, el productor asignado activo o una cuenta
de aseguradora autorizada. No consulta bancos ni confirma pagos o cobertura. Los cambios
de póliza y de cuenta quedan en un historial independiente de la cadena de los expedientes.

---

## Motor de consistencia

Contrasta los datos disponibles contra registros objetivos y contra su coherencia interna.
Los siguientes contrastes siguen disponibles para datos existentes, incluidos expedientes
anteriores; las preguntas cerradas retiradas no vuelven a aparecer para alimentarlos:

| Declaración | Se contrasta contra |
| --- | --- |
| "el pavimento estaba seco" | precipitación real registrada en las 3 h previas |
| "estaba despejado" | condición meteorológica del punto y la hora |
| "era de día" | hora solar real (amanecer y atardecer del lugar) |
| "hielo en la calzada" | temperatura ambiente registrada |
| "venía por Av. X" | dirección real resuelta desde las coordenadas |
| "pasó recién" | antigüedad declarada vs. momento de la captura |
| "detenido, a 40 km/h" | coherencia interna entre respuestas |

Además levanta **banderas de cobertura**: licencia vencida, alcoholemia positiva, conductor
no titular, uso comercial, VTV vencida, fuga del tercero.

Cuando faltan datos o una fuente externa no estuvo disponible, el control figura como no
evaluable. La ausencia de información no se presenta como coincidencia. El relato no se
convierte automáticamente en respuestas estructuradas de mecánica o clima.

Criterio de diseño deliberado: **el motor no dice quién tuvo la culpa ni concluye que hay
fraude.** Marca contradicciones verificables y las deja a criterio del liquidador. Un sistema
que "detecta fraude" automáticamente genera responsabilidad propia; uno que señala
contradicciones objetivas, no.

---

## Cómo correrlo en local

Requiere Node 22+ y un Postgres.

```bash
cp .env.example .env      # ajustar DATABASE_URL
docker compose up -d db   # o usar cualquier Postgres propio
npm install
npm run dev
```

Abrir http://localhost:3000

### Si algo no funciona, mirar acá primero

```bash
curl http://localhost:3000/api/salud
```

Dice si la base está configurada, alcanzable y con el esquema creado, y muestra qué
variables de entorno están definidas. El inicio también avisa en pantalla cuando el
sistema no está operativo, antes de que alguien cargue datos al pedo.

### Con Supabase como base

Copiar la cadena de **Connect → Session pooler** (no "Direct connection": el pooler anda
sobre IPv4 y soporta las transacciones que el encadenado de hashes necesita) y agregar
`DATABASE_SSL=true`. Sin eso la conexión se corta por tiempo de espera.

En Supabase conviene además dejar **RLS habilitado sin políticas** en las cuatro tablas:
la aplicación se conecta como dueña y no lo nota, pero bloquea el acceso vía PostgREST con
la clave `anon`, que de otro modo dejaría los datos personales del siniestro a la vista de
cualquiera que tenga esa clave.

```sql
ALTER TABLE casos ENABLE ROW LEVEL SECURITY;
ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE medias ENABLE ROW LEVEL SECURITY;
ALTER TABLE testigos ENABLE ROW LEVEL SECURITY;
```

> **La cámara y la geolocalización sólo funcionan sobre HTTPS o en `localhost`.** Si probás
> desde el celular contra la IP de tu máquina, el navegador va a bloquear los permisos.
> Para probar en un teléfono real, usá el deploy con dominio y certificado.

### Scripts

```bash
npm run prueba    # suites de lógica, documentación, relato, integridad y entorno, sin DB real
npm run contrato  # el borde entre el trabajo visual y el funcional
npm run tipos     # chequeo de tipos
npm run build     # build de producción
npm run e2e       # circuito completo contra un servidor ya levantado
```

`npm run prueba` ejecuta las suites de `scripts/prueba-mvp.mjs`. Verifica el orden y la visibilidad del cuestionario (que ninguna sección
quede fuera del recorrido, que no se pidan fotos del tercero cuando no hay tercero), el
encadenado de hashes —incluido que alterar o suprimir un eslabón rompa la validación—, el
motor de consistencia y la generación del PDF de punta a punta. Deja un expediente de
ejemplo en `data/expediente-de-prueba.pdf`.

`npm run contrato` verifica que un cambio puramente visual no pueda romper la
funcionalidad en silencio: que no se renombre un id de pregunta, que no cambie el texto de
una opción —que no es copy sino el dato que guardan los expedientes sellados—, que la
entrada de la cámara siga siendo cámara y no galería, que ningún color quede fuera de los
tokens, y una docena más. El documento que verifica es `docs/CONTRATO-UI.md`, y es lectura
obligatoria antes de tocar pantallas o estilos.

`npm run e2e` necesita `npm run dev` corriendo aparte y una base configurada: recorre el
circuito real, desde el alta sin datos hasta el sello de tiempo y la verificación pública.
Para la verificación reproducible sin cuentas, archivos ni credenciales de producción,
usá el entorno local aislado de [docs/VERIFICACION-MVP.md](docs/VERIFICACION-MVP.md).

### Transcripción del relato

El servidor tiene una integración con ElevenLabs Scribe v2 mediante una credencial
dedicada, `TRANSCRIPCION_ELEVENLABS_API_KEY`. No lleva prefijo `NEXT_PUBLIC_` y no se
reutilizan claves de otros módulos. La configuración corresponde al operador del servidor.

Sin credencial o ante un error del proveedor, la aplicación informa la causa y permite
conservar el audio y escribir el relato. La transcripción original recibida se conserva
separada de las correcciones confirmadas por el usuario. La integración real requiere
validación con una credencial autorizada; las pruebas locales usan respuestas controladas
y el entorno aislado desactiva las llamadas externas.

---

## Deploy en Easypanel

1. **Servicio Postgres** — crearlo desde Easypanel y copiar la cadena de conexión interna.
2. **Servicio App** — origen: este repositorio de GitHub, builder: **Dockerfile**.
3. **Variables de entorno**:

   | Variable | Valor |
   | --- | --- |
   | `DATABASE_URL` | la cadena interna del Postgres |
   | `URL_PUBLICA` | `https://tu-dominio.com` |
   | `DIR_DATOS` | `/app/data` |
   | `TSA_URL` | `https://freetsa.org/tsr` |

4. **Volumen persistente** montado en `/app/data`. Sin esto, cada redeploy borra las
   fotos, los audios y la clave de firma.
5. **Dominio + HTTPS** — Easypanel emite el certificado. No es opcional: sin HTTPS el
   navegador no da acceso a la cámara ni al GPS.

El esquema de base de datos se crea solo en el primer arranque.

---

## Estado real: qué está terminado y qué no

### Funciona

- Flujo completo de captura, cuestionario, fotos, audio y testigos
- Integraciones de clima y geocodificación (Open-Meteo y Nominatim), con ausencia explícita si no responden
- Mapa del lugar en el PDF cuando están disponibles los mosaicos de OpenStreetMap
- Cadena de custodia con hashes encadenados, más un trigger de Postgres que rechaza
  `UPDATE` y `DELETE` sobre las tablas append-only
- Motor de consistencia con controles no evaluables cuando faltan fuentes o declaraciones
- Expediente PDF, verificador público y página pública de verificación por QR
- Sello de tiempo RFC 3161 contra una TSA pública (la solicitud DER se arma a mano
  en `lib/sello.ts`)
- Cuentas con rol, sesiones y control de acceso sobre el panel, el listado, las
  fotografías y el expediente
- Varias pólizas y vehículos, fotos de cuatro categorías, contactos y estado de cuenta manual con historial
- Copia inmutable y QR limitado de documentos seleccionados; contacto de confianza
- Lectura y conservación de croquis históricos, retirados del recorrido nuevo
- Relato único por audio o texto, reproducción y transcripción editable cuando se configura el servidor
- Firma electrónica del asegurado, atada al hash del contenido que firma
- Consentimiento del tercero desde su propio teléfono
- Lectura automática de la documentación del tercero, **enchufable y apagada por defecto**
- Entrega al productor por correo (SMTP propio) y por su bandeja, con enlace que vence
- Cola de subida offline, para no perder la foto sin señal
- Conservación, anonimización y baja de expedientes
- Notificaciones push con VAPID, sin SDK, y detección de impacto en primer plano

### Falta antes de mostrárselo a una aseguradora

1. **Firma digital de verdad.** Hoy se firma con una clave del servidor: eso es *firma
   electrónica* (art. 5, Ley 25.506), sin las presunciones de autoría e integridad de los
   arts. 7 y 8. Para tenerlas hace falta un certificado de **certificador licenciado**
   (Encode, Lakaut, Box Custodia o Digilogix) y firmar el PDF en formato PAdES. Está
   aislado en `lib/sello.ts` para que el cambio toque un solo archivo.
2. **Revisión del cuestionario por un abogado de tránsito.** Las preguntas están
   redactadas con criterio de aseguradora, pero no las validó nadie del fuero. Es lo
   más importante de la lista: la tecnología la copia cualquiera, las preguntas correctas no.
3. **Registro de la base ante la AAIP**, conforme a la Ley 25.326.
4. **Los plazos de conservación.** El mecanismo está y arranca en cero: los meses los pone
   el abogado, según los plazos de prescripción que apliquen. Un plazo puesto al azar es
   peor que no tener ninguno.
5. **El consentimiento del tercero y la transferencia internacional**, si alguna vez se
   enchufa un proveedor de lectura automática fuera del país. Los cinco pasos están
   escritos al principio de `lib/extraccion.ts`.
6. **Validación real de transcripción y teléfono.** La integración está implementada;
   falta probar el proveedor con una credencial autorizada y completar las comprobaciones
   manuales de cámara, micrófono, GPS, navegación y pérdida de señal.
7. **Nominatim y los mosaicos de OSM** son gratuitos pero piden volumen bajo. Con uso real
   hay que pasar a un proveedor propio.

### Lo que una aplicación web NO puede hacer, y hay que decirlo

Esto reemplaza lo que este README decía antes —que la detección de impacto requería
licenciar un SDK de telemática—. Es más matizado que eso.

**Leer el acelerómetro se puede, y está hecho.** El detector cruza el pico de aceleración
con la caída de velocidad del GPS y con el giróscopo, descarta la caída libre previa (el
teléfono que se cae del soporte da entre 10 y 30 g, más que muchos choques) y descarta el
pico aislado (un pozo). Corre con lógica pura y se prueba con series sintéticas.

**Pero corre sólo con la aplicación abierta y a la vista.** Cuando pasa a segundo plano el
navegador suspende el hilo de JavaScript, `DeviceMotionEvent` deja de emitir, y el service
worker sólo se despierta cuando llega un push *desde el servidor*: nunca por su cuenta,
nunca por un sensor, nunca por un temporizador. No hay API que lo cambie, ni en iOS ni en
Android. **Una PWA no detecta un choque con la pantalla bloqueada.**

**Las tres acciones de la notificación de bloqueo no existen en iPhone.** Web Push en iOS
ignora por completo el arreglo `actions`. En Android existen, pero Chrome dibuja como
máximo dos. Por eso el toque sobre la notificación lleva a `/aviso`, una pantalla propia con
los tres botones en grande, que es lo único que funciona en los dos lados.

**Y en iOS no hay Background Sync**: la cola de subida sólo avanza con la aplicación
abierta, y Safari desaloja el almacenamiento del sitio a los siete días sin uso.

Lo que sí queda listo: el backend es agnóstico del origen. La tabla de telemetría, los
umbrales y el endpoint de ingesta no suponen de dónde vienen las lecturas, así que un
envoltorio nativo —que sí puede leer sensores en segundo plano— no tendría que tocar el
servidor. Esa sigue siendo la única forma de cumplir la sección 5 de la especificación al
pie de la letra.

---

## Estructura

```
app/
  page.tsx               inicio: un botón, "Tuve un accidente"
  s/[id]/Flujo.tsx       el conmutador: decide qué pantalla se muestra
  s/[id]/pantallas/      una pantalla por archivo
  s/[id]/tipos.ts        los tipos que comparten las pantallas
  t/[id]/                carga de testigo por QR
  compartir/[token]/     documentación elegida, con permiso limitado y revocable
  panel/                 listado y detalle para la aseguradora
  verificar/             verificador público de integridad
  api/                   rutas de servidor
lib/
  cuestionario.ts        las preguntas, las tomas fotográficas y los valores
  recorrido.ts           qué pantallas hay, en qué orden y en cuál se retoma
  consistencia.ts        motor de contrastes
  hash.ts                cadena de custodia y manifiesto
  sello.ts               firma y sello de tiempo RFC 3161
  pdf.ts                 generación del expediente
  clima.ts               Open-Meteo
  geo.ts                 Nominatim y mosaicos de mapa
  db.ts                  Postgres y esquema
  almacenamiento.ts      archivos en el volumen
  documentacion.ts       documentos de la cuenta y completitud por categoría
  polizas.ts             vehículos, pólizas, contactos, cuenta manual e historial
  intercambio.ts         copia al expediente y permisos de QR
  transcripcion.ts       integración dedicada de transcripción del relato
  local.ts               qué actuación quedó abierta en este teléfono
docs/
  CONTRATO-UI.md         qué puede tocar un agente visual y qué no
  MAPA-PANTALLAS.md      de cada pantalla del mockup al archivo que la dibuja
  VERIFICACION-MVP.md    entorno aislado, evidencia automatizada y controles manuales pendientes
scripts/
  prueba-logica.mjs      pruebas sin base de datos
  prueba-contrato.mjs    el contrato de interfaz
  prueba-e2e.mjs         circuito completo contra un servidor levantado
  prueba-mvp-e2e.mjs     cuentas, pólizas, documentación, copias y QR en entorno aislado
  prueba-evidencia-e2e.mjs  concurrencia, firma, PDF e integridad en entorno aislado
  servidor-prueba.mjs    runner con puertos, archivos e integraciones de prueba separados
```

`lib/cuestionario.ts` es el único lugar donde se toca el contenido del cuestionario:
`SECCIONES` define las preguntas, `RECORRIDO` el orden en que se intercalan con las
pantallas propias (fotos, testigos, corte) y `VALOR` los textos de las respuestas cerradas.
**Los ids de las preguntas son API** —los usan el motor de consistencia, el PDF y la
validación del `PATCH`—: se pueden reordenar, no renombrar. **Y el texto de una opción
tampoco es copy**: es el valor que se guarda en `casos.respuestas`, ya escrito dentro de
expedientes sellados, y contra el que el motor de consistencia compara por igualdad
literal. Por eso los arrays de opciones se arman desde `VALOR` y `lib/consistencia.ts` lo
importa, en lugar de repetir los textos.

Cada pantalla del recorrido es una entrada del historial del navegador (`?paso=`), así que
el gesto de atrás del teléfono vuelve a la pregunta anterior en vez de salirse de la

aplicación, y el enlace se puede compartir apuntando a un paso concreto.
---

## Privacidad

Datos personales tratados conforme a la **Ley 25.326**. El consentimiento del testigo se
registra de forma expresa y separada. La autoridad de control es la **AAIP** (Agencia de
Acceso a la Información Pública), que absorbió a la ex DNPDP en 2017.
