# Verificación del MVP

Estado al 15/10/2026: **implementación y verificación automatizada terminadas**. Este documento distingue las
comprobaciones automatizadas de las que necesitan un navegador o un teléfono real.
El alcance está en el [plan de cierre](superpowers/plans/2026-10-15-cierre-mvp.md).

## Resultado de la verificación final

| Comprobación | Último resultado registrado |
| --- | --- |
| Contrato de interfaz | 19/19 |
| Tipos de TypeScript | Sin errores |
| Suite de lógica histórica adaptada al recorrido | 157/157 |
| Recorrido del MVP | Orden, condicionales, históricos, reanudación y deduplicación correctos |
| Documentación | 19 comprobaciones correctas |
| Relato y transcripción con proveedor simulado en la prueba | 6 pruebas correctas; no se invocó al proveedor real |
| Integridad, concurrencia y cola local | 22 escenarios correctos |
| Intercambio y acceso público | 20 comprobaciones correctas |
| Aislamiento del entorno | 3 pruebas correctas |
| Build aislado final | Correcto, salida 0, Next 16.3.1 sobre Node 24.19.0 |
| E2E base con integraciones externas desactivadas | 50 comprobaciones correctas |
| E2E de pólizas, documentación y QR | 55 comprobaciones correctas contra Next 3100 y Postgres 55432 |
| E2E final de evidencia, concurrencia, firma y PDF | 44 comprobaciones correctas contra la compilación final |
| Revisión independiente de código | Hallazgos corregidos con pruebas de regresión |
| Revisión visual en navegador | No ejecutada: no había navegador de automatización disponible en esta sesión |
| Cámara, GPS y micrófono del teléfono | Pendiente de dispositivo real |
| Transcripción con proveedor real | Pendiente de credencial dedicada autorizada |

Los tres circuitos E2E suman **149 comprobaciones correctas**. Las verificaciones obligatorias
(`contrato`, `tipos`, `prueba`) se repitieron después de la última corrección de la cola;
también se recompiló y se repitió el circuito de evidencia. No se agregaron dependencias.
Estos resultados no certifican la apariencia visual ni el funcionamiento del hardware del teléfono.

La revisión confirmó la corrección de fotos duplicadas al pasar del ID local al remoto,
selección de póliza sin adjuntos, firma durante incorporación de documentos, coordenadas
ausentes, cupos concurrentes y descarte local durante un drenaje ya iniciado. La credencial
`TRANSCRIPCION_ELEVENLABS_API_KEY` no está configurada en el `.env` local; no se imprimió
ni se usó ningún secreto existente para estas pruebas.

## Entorno local separado

El entorno de pruebas usa Next en `http://127.0.0.1:3100`, Postgres en
`127.0.0.1:55432`, usuario y base `acta_pruebas`, y archivos bajo
`data/pruebas-mvp/archivos`. El runner arma un entorno con lista positiva de variables,
evita cargar `.env` del operador y bloquea consultas HTTP externas y redirecciones.
TSA, SMTP, push, lectura automática y transcripción externa quedan desactivados.

Las pruebas crean cuentas y actuaciones con identificadores únicos y conservan esas
fixtures para inspección. Los ajustes SQL de rol, TTL y concurrencia se limitan al entorno
aislado. No hay que apuntar estas pruebas a una base de producción.

En Windows con PowerShell, ejecutá desde la raíz del repositorio:

```powershell
npm.cmd run contrato
npm.cmd run tipos
npm.cmd run prueba
```

El agregado `npm.cmd run prueba` incluye las suites de documentación, relato, recorrido,
integridad, intercambio y entorno. Algunas pruebas usan `tsx` o módulos VM; el runner
agregado les pasa los argumentos correspondientes.

### Preparar Postgres

```powershell
node scripts/preparar-postgres-prueba.mjs
```

El preparador de esta sesión requiere binarios de PostgreSQL 17.11 para Windows en
`%TEMP%/acta-mvp-postgresql-17.11/pgsql/bin`. El script no los descarga. Si faltan,
prepará esos binarios antes de ejecutarlo. Se inicia un clúster propio en
`data/pruebas-mvp/postgres`; la clave local se genera en un archivo ignorado por Git y no
se imprime. Los PID y directorios quedan registrados en
`data/pruebas-mvp/entorno.json`.

Si el puerto 55432 ya está ocupado, el preparador se detiene sin conectarse a un servidor
desconocido. Si es el entorno propio que ya está levantado, continuá con el runner. No
borres ni reinicialices una base para liberar el puerto.

### Compilar e iniciar

Detené primero cualquier Next de pruebas que esté usando el puerto 3100 o escribiendo
en `.next`. Postgres puede seguir levantado.

```powershell
node scripts/servidor-prueba.mjs build
node scripts/servidor-prueba.mjs start
```

Dejá `start` en esa terminal. En otra, podés consultar
`http://127.0.0.1:3100/api/salud`. El modo `dev` también existe para investigar un fallo,
pero la pasada final debe repetirse contra `start` después de compilar.

### Ejecutar los circuitos reales

Con el servidor aislado levantado:

```powershell
node scripts/servidor-prueba.mjs e2e
node scripts/servidor-prueba.mjs mvp-e2e
node scripts/servidor-prueba.mjs evidencia-e2e
```

| Circuito | Qué comprueba |
| --- | --- |
| `e2e` | Alta anónima, guardado, piezas, cierre y verificación pública; en aislamiento espera ausencia explícita de clima y dirección externos |
| `mvp-e2e` | Dos vehículos, selección sin documentos, productor y FK, permisos entre cuentas, cuenta manual e historial, DNI, asignación de archivos, copias inmutables, idempotencia, QR limitado, revocación y vencimiento |
| `evidencia-e2e` | Coordenadas ausentes y `0,0` explícitas, reintentos, límite de piezas con concurrencia, firma de acta actual, distinción de contactos manuales, PDF y cadena íntegra tras el cierre |

La prueba de QR conserva el hash de una copia después de cargar una versión nueva y
borrar la fuente editable. El vencimiento se prueba moviendo únicamente el TTL de una
fixture propia en la base aislada. Ningún circuito hace llamadas a bancos ni envía
correos o notificaciones.

## Comprobaciones manuales pendientes

Estas comprobaciones siguen pendientes hasta ejecutarlas con un navegador y un teléfono.
Para cámara, ubicación y micrófono, usá un contexto seguro: HTTPS o el `localhost` del
propio dispositivo. La IP HTTP de otra máquina no equivale a `localhost` del teléfono.

- **Recorrido y recarga:** avanzar, volver con el gesto de Android, recargar en cada etapa,
  cerrar y reabrir la pestaña. Verificar que se retoma el paso guardado y que una omisión
  no reaparece como pregunta retirada.
- **Guardado y pérdida de conexión:** cortar la conexión mientras se contesta y se toma
  una foto; revisar el aviso y la cola. Recuperar señal y comprobar que aparece una sola
  pieza. Probar también el caso en que el navegador rechaza el almacenamiento local y
  la interfaz avisa que no se cierre la página.
- **Cámara:** comprobar apertura de cámara trasera, captura con una mano, lectura de la
  patente dentro de la foto del daño y acceso a galería/PDF en Mi documentación. Revisar
  límites de tamaño y que el botón principal quede alcanzable con teclado abierto.
- **Ubicación:** conceder y negar permiso, esperar una lectura real y repetir con GPS no
  disponible. Verificar que se informa lo faltante sin fabricar coordenadas y que el
  lugar actual del vehículo se distingue del lugar registrado del siniestro.
- **Audio:** conceder y negar micrófono, grabar, escuchar, descartar y regrabar; verificar
  que el descarte no borra una grabación nueva ni confirma por accidente el borrador.
  Recargar con borrador pendiente y comprobar la elección de conservar o descartar.
- **Transcripción:** sin credencial, comprobar el mensaje y la alternativa de escritura.
  Con una credencial dedicada autorizada, ejecutar una prueba real separada del runner
  aislado; comprobar que el original recibido y el texto corregido se distinguen. Esta
  sesión no configuró ni utilizó una credencial real de transcripción.
- **Pólizas y documentos:** elegir entre dos vehículos, guardar la elección sin archivos,
  comprobar que sólo se ofrecen los documentos de ese vehículo y los personales, y
  asignar explícitamente un archivo antiguo. Un PDF por sí solo no completa una categoría
  de fotos. No bloquear una denuncia urgente por falta de documentación.
- **QR en otro teléfono:** escanear desde un dispositivo sin sesión y verificar que sólo
  abre lo elegido, no otros archivos. Cambiar la selección, generar otro QR y comprobar
  que el anterior deja de servir. Revocar y probar tanto el listado como una URL de
  archivo ya abierta. Una descarga que el receptor guardó no se puede revocar.
- **Testigos:** contrastar un teléfono anotado por el asegurado con un testimonio cargado
  por el propio testigo; deben figurar con orígenes distintos en pantalla y PDF.
- **Firma y cierre:** firmar, cambiar una respuesta y confirmar que se pide revisar y
  firmar el acta nueva. Tras sellar, comprobar rechazo de nuevas piezas y validez pública.
- **Lectura en teléfono:** revisar contraste al sol, desplazamiento en formularios largos,
  barra de acción, QR y PDF en Android e iOS. No reemplazar esta revisión por el resultado
  de los scripts.

## Qué no acredita el entorno aislado

No prueba disponibilidad ni precisión de geocodificación, clima, mapas, TSA o proveedores
externos. Tampoco prueba envío SMTP, notificaciones del sistema, sensores del teléfono,
apertura de la cámara, calidad de grabación ni transcripción real. El modo viaje continúa
dependiendo de que la aplicación esté abierta y visible; estas pruebas no acreditan
detección en segundo plano.
