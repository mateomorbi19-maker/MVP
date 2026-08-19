# Acta Digital de Siniestro

Registro probatorio de siniestros viales. Captura la evidencia **en el lugar y en el momento
del hecho**, la sella con una cadena de custodia verificable y genera un expediente en PDF
listo para presentar ante la aseguradora.

Versión 1 — MVP. Orientado a **aseguradora**: prioriza hechos objetivos, datos de cobertura y
detección de contradicciones.

---

## Qué hace

La persona abre un enlace en el celular parada al lado del auto. No instala nada.

1. **Triage** — ¿hay heridos? Botones directos al 107 y al 911.
2. **Captura silenciosa** — mientras contesta, el sistema registra por su cuenta las
   coordenadas GPS, la hora, la dirección real de la calle y **las condiciones
   meteorológicas de ese punto en ese minuto**.
3. **Cuestionario guiado** — 7 secciones, 34 preguntas, con relato en audio.
4. **12 fotografías guiadas** — una por una, con instrucción concreta de encuadre.
5. **Testigos por QR** — el testigo escanea con *su* teléfono y carga sus datos él mismo,
   con consentimiento expreso registrado.
6. **Cierre y sellado** — se calcula el hash maestro, se firma y se pide un sello de tiempo
   RFC 3161. Desde ese momento el expediente no admite cambios.
7. **Expediente PDF** — mapa del lugar, fotos, declaración, testigos, clima, informe de
   consistencia y tabla completa de cadena de custodia.

Más un **panel** para la aseguradora y un **verificador público** de integridad.

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
npm run tipos     # chequeo de tipos
npm run build     # build de producción
```

`npm run prueba` verifica el encadenado de hashes (incluido que alterar o suprimir un eslabón
rompa la validación), el motor de consistencia y la generación del PDF de punta a punta.
Deja un expediente de ejemplo en `data/expediente-de-prueba.pdf`.

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
4. **Revisión del cuestionario por un abogado de tránsito.** Las 34 preguntas están
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
  page.tsx               inicio: apertura de la actuación
  s/[id]/                flujo de captura (el wizard)
  t/[id]/                carga de testigo por QR
  panel/                 listado y detalle para la aseguradora
  verificar/             verificador público de integridad
  api/                   rutas de servidor
lib/
  cuestionario.ts        las 34 preguntas y las 12 tomas fotográficas
  consistencia.ts        motor de contrastes
  hash.ts                cadena de custodia y manifiesto
  sello.ts               firma y sello de tiempo RFC 3161
  pdf.ts                 generación del expediente
  clima.ts               Open-Meteo
  geo.ts                 Nominatim y mosaicos de mapa
  db.ts                  Postgres y esquema
  almacenamiento.ts      archivos en el volumen
scripts/
  prueba-logica.mjs      pruebas sin base de datos
```

---

## Privacidad

Datos personales tratados conforme a la **Ley 25.326**. El consentimiento del testigo se
registra de forma expresa y separada. La autoridad de control es la **AAIP** (Agencia de
Acceso a la Información Pública), que absorbió a la ex DNPDP en 2017.
