# Cierre del MVP según informe de capturas

Plan aprobado por el usuario en el chat el 15/10/2026. Fuente: Arreglos_Accidentes_Certificados_capturas.docx, 43 capturas y notas generales. El usuario autorizó ejecutar el plan completo sin esperar su regreso.

## Alcance

1. Guardado durable y reanudación por paso, sin preguntas retiradas ni falsos faltantes.
2. Mi documentación: fotos de póliza, cédula, licencia y DNI; vehículos/pólizas seleccionables, archivos asociados; datos de póliza, contactos, estado de cuenta manual e historial de cambios.
3. Primera etapa: daños y patentes, cantidad de vehículos, documentos del tercero, extras opcionales. Corte con guardar/continuar, QR de documentación propia y QR testigos con teléfonos manuales múltiples.
4. Segunda etapa: relato único audio/texto con guía permanente, reproducción, transcripción real editable, descarte/regrabación antes de confirmar. Original y texto confirmado diferenciados.
5. Conservar circulabilidad, agregar ubicación actual del vehículo; policía Sí/No y número/foto de acta condicional; otros intervinientes, VTV, alcoholemia; firma, revisión y final. Retirar croquis y formularios redundantes conservando históricos.
6. Expediente: copia inmutable de documentos elegidos, fuentes declaradas y medidas diferenciadas, controles no evaluables explícitos, firma/PDF y cierre coherentes.
7. Verificación: contrato, tipos, lógica, build, E2E en entorno aislado, navegador. Documentar límites no verificables con hardware real.

## Reglas

- AGENTS.md y docs/CONTRATO-UI.md vigentes. Documentación Next instalada leída.
- No cambiar IDs ni VALOR existentes. Ocultar conserva históricos.
- API route handlers, sin Server Actions. Esquema idempotente dentro de SCHEMA en lib/db.ts.
- Español/voseo, comillas simples, sin punto y coma, indentación 2, sin dependencias nuevas.
- Ningún evento de cadena posterior al sellado. Operaciones de caso y su evento en transacción.
- Documentación completa exige fotos de las cuatro categorías; nunca bloquea denuncia urgente.
- Estado de cuenta y cambios de póliza informativos, manuales, con origen y fecha; no integración bancaria.
- Compartir sólo archivos expresamente seleccionados, con token limitado y vencimiento.

## Reparto e interfaces

| Trabajo | Responsable | Límites compartidos |
| --- | --- | --- |
| Documentación, pólizas, estado de cuenta y UI | agente documentación | Envía DDL a raíz; define listado de archivos por póliza para QR/copia |
| Pantalla relato y transcripción | agente relato | Exporta PantallaRelato; raíz integra en Flujo. No modifica globals/DB |
| Integridad backend, consistencia y PDF | agente integridad | PATCH acepta progreso; raíz incorpora DDL y define contactos/documentos |
| Recorrido, persistencia cliente, QR/testigos, integración y pruebas | raíz | Dueño de db.ts, globals.css, cuestionario.ts, recorrido.ts y Flujo.tsx |

## Registro de ejecución

- Base limpia en main. Rama de trabajo creada: codex/cierre-mvp-informe.
- Se trabaja en el checkout existente para mantener el entorno instalado; no se publican cambios remotos.
- Baseline: contrato 19/19, tipos correcto, prueba 158/158. npm.cmd requerido en PowerShell. Esbuild requiere ejecutar fuera del aislamiento de procesos.
- Implementados los puntos 1 a 6: recorrido reducido, reanudación, relato único, documentación por póliza y DNI, cuenta manual e historial, QR limitados, acta policial, copias inmutables y cierre transaccional.
- Se preservaron los IDs y valores históricos. Ninguna dependencia nueva. Se agregó al comando `prueba` el conjunto de suites del MVP.
- Revisión independiente: corregidos conteo duplicado de fotos, selección de vehículo sin documentos, audio excedido, coordenadas ausentes, carreras entre documentos y firma, cupos/idempotencia de medios y descarte de pendientes durante subida.
- Verificación final: contrato 19/19, tipos correcto, lógica 157/157, documentación 19, relato 6, integridad 22, intercambio 20, entorno 3, recorrido correcto y build de producción con salida 0.
- E2E sobre PostgreSQL real aislado: base 50/50, documentación/QR 55/55 y evidencia/firma/PDF 44/44. Total 149 comprobaciones correctas.
- Vista local de prueba en http://127.0.0.1:3100, base 55432 y archivos bajo data/pruebas-mvp. Las integraciones remotas están desactivadas en ese entorno.
- Límites pendientes de validación: no había navegador conectado a la herramienta; faltan revisión visual y pruebas de cámara/GPS/micrófono en teléfono real. La transcripción está implementada y probada con respuestas controladas, pero requiere configurar su credencial dedicada para probar el proveedor real.
- Registro reproducible y comprobaciones manuales: [VERIFICACION-MVP.md](../../VERIFICACION-MVP.md).
