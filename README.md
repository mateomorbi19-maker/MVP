# Acta Digital de Siniestro

Registro probatorio de siniestros viales. Captura la evidencia **en el lugar y en el momento
del hecho**, la sella con una cadena de custodia verificable y genera un expediente en PDF
listo para presentar ante la aseguradora.

Versión 1 — MVP. Orientado a **aseguradora**: prioriza hechos objetivos, datos de cobertura y
detección de contradicciones.

---

## Qué hace

La persona abre la aplicación en el celular parada al lado del auto y toca **un solo
botón**: "Tuve un accidente". No se le pide nada antes: ni la póliza, ni la patente, ni el
nombre. Un formulario en la primera pantalla es exactamente lo que hace que alguien con
adrenalina abandone.

A partir de ahí es **una pregunta por pantalla**, con botones grandes, y elegir es avanzar:
un toque por respuesta.

1. **¿Hay alguien herido?** — es lo primero y no se puede saltear. Si la respuesta no es
   "no", la pantalla siguiente es roja y tiene dos botones: **107** y **911**.
2. **Captura silenciosa** — mientras contesta, el sistema registra por su cuenta las
   coordenadas GPS, la hora, la dirección real de la calle y **las condiciones
   meteorológicas de ese punto en ese minuto**.
3. **Lo que se pierde si no se toma ahora** — la patente y los datos del tercero, cómo
   quedaron los vehículos, las 12 fotografías guiadas de a una, el relato en audio y los
   testigos por QR.
4. **Cómo ocurrió** — mecánica del hecho, condiciones del lugar y quién intervino.
5. **Corte** — "ya tenés lo importante". Puede irse y retomar más tarde desde el mismo
   enlace, o seguir de largo.
6. **Lo que se completa después** — la póliza, la licencia, la VTV, el uso del vehículo.
   Datos que la persona tiene siempre y que no se pierden por irse del lugar.
7. **Cierre y sellado** — se calcula el hash maestro, se firma y se pide un sello de tiempo
   RFC 3161. Desde ese momento el expediente no admite cambios.
8. **Expediente PDF** — mapa del lugar, fotos, declaración, testigos, clima, informe de
   consistencia y tabla completa de cadena de custodia.

Más un **panel** para la aseguradora y un **verificador público** de integridad.

---

## El orden es de urgencia, no jurídico

Es la decisión de diseño que ordena todo lo demás. El cuestionario tiene 9 secciones y 38
preguntas —muchas condicionales, así que nadie las ve todas— y cada sección declara a qué
`bloque` pertenece:

| Bloque | Qué contiene | Por qué ahí |
| --- | --- | --- |
| `seguridad` | heridos, riesgo en el lugar | Define si hay que pedir una ambulancia |
| `lugar` | tercero, fotos, relato, testigos, mecánica | Deja de existir cuando la persona se va |
| `despues` | póliza, licencia, VTV, uso del vehículo | Lo tiene siempre; no se pierde |

**Nada bloquea el avance salvo la pregunta por los heridos.** Cada pantalla tiene su forma
de saltearse —"No la pude ver", "No me los quiso dar", "Todavía no me lo dieron"— y lo que
quede sin completar aparece en la revisión final como un botón que lleva directo a esa
pregunta. Un expediente incompleto vale más que uno abandonado en la tercera pantalla.

El relato en audio va **antes** que las preguntas de mecánica, también a propósito: primero
la persona cuenta lo que vio con sus palabras, y recién después las preguntas cerradas.
Al revés, cada pregunta le sugiere la respuesta al relato.

Las preguntas y las fotos que no corresponden no se muestran: quien chocó contra un árbol
no ve las cinco pantallas del otro vehículo, y a quien declara que el tercero se dio a la
fuga no se le piden sus datos personales.

---

## Motor de consistencia

Es la pieza diferencial. Contrasta lo declarado contra datos objetivos y contra la coherencia
interna de las propias respuestas, **sin necesidad de ningún sensor**:

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
npm run prueba    # pruebas de la lógica pura, sin base de datos
npm run contrato  # el borde entre el trabajo visual y el funcional
npm run tipos     # chequeo de tipos
npm run build     # build de producción
npm run e2e       # circuito completo contra un servidor ya levantado
```

`npm run prueba` verifica el orden y la visibilidad del cuestionario (que ninguna sección
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
- Clima y geocodificación reales (Open-Meteo y Nominatim, ambos gratuitos)
- Mapa del lugar incrustado en el PDF (mosaicos de OpenStreetMap)
- Cadena de custodia con hashes encadenados, más un trigger de Postgres que rechaza
  `UPDATE` y `DELETE` sobre la tabla de eventos
- Motor de consistencia completo
- Expediente PDF y verificador público
- Sello de tiempo RFC 3161 contra una TSA pública (la solicitud DER se arma a mano
  en `lib/sello.ts`)

### Falta antes de mostrárselo a una aseguradora

1. **Autenticación.** El panel es abierto. Es un MVP de uso interno.
2. **Firma digital de verdad.** Hoy se firma con una clave del servidor: eso es *firma
   electrónica* (art. 5, Ley 25.506), sin las presunciones de autoría e integridad de los
   arts. 7 y 8. Para tenerlas hace falta un certificado de **certificador licenciado**
   (Encode, Lakaut, Box Custodia o Digilogix) y firmar el PDF en formato PAdES. Está
   aislado en `lib/sello.ts` para que el cambio toque un solo archivo.
3. **Transcripción del audio.** El audio se guarda y se hashea, pero no se transcribe.
4. **Revisión del cuestionario por un abogado de tránsito.** Las 38 preguntas están
   redactadas con criterio de aseguradora, pero no las validó nadie del fuero. Es lo
   más importante de la lista: la tecnología la copia cualquiera, las preguntas correctas no.
5. **Registro de la base ante la AAIP**, conforme a la Ley 25.326.
6. **Retención y borrado de datos.** No hay política de expurgo implementada.
7. **Nominatim y los mosaicos de OSM** son gratuitos pero piden volumen bajo. Con uso real
   hay que pasar a un proveedor propio.

### Fuera de alcance (fase 2)

Detección automática del impacto y registro del recorrido previo. Requiere licenciar un SDK
de telemática (Damoov, DriveQuant, Sentiance, Arity, CMT o IMS) — no se puede construir in
house: un conductor promedio tiene un siniestro cada 7 a 15 años, así que no hay forma de
juntar los miles de choques etiquetados que necesita un modelo propio.

---

## Estructura

```
app/
  page.tsx               inicio: un botón, "Tuve un accidente"
  s/[id]/Flujo.tsx       el conmutador: decide qué pantalla se muestra
  s/[id]/pantallas/      una pantalla por archivo
  s/[id]/tipos.ts        los tipos que comparten las pantallas
  t/[id]/                carga de testigo por QR
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
  local.ts               qué actuación quedó abierta en este teléfono
docs/
  CONTRATO-UI.md         qué puede tocar un agente visual y qué no
  MAPA-PANTALLAS.md      de cada pantalla del mockup al archivo que la dibuja
scripts/
  prueba-logica.mjs      pruebas sin base de datos
  prueba-contrato.mjs    el contrato de interfaz
  prueba-e2e.mjs         circuito completo contra un servidor levantado
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
