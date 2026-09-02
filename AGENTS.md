<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Reglas de este proyecto

Todo lo de arriba lo escribe `next dev` y se reescribe solo. Lo de acá abajo es del
proyecto: leelo antes de escribir código.

## Antes de terminar

```bash
npm run contrato && npm run tipos && npm run prueba
```

`npm run contrato` verifica el borde entre el trabajo visual y el funcional. Está
explicado en `docs/CONTRATO-UI.md`. Si vas a tocar pantallas o estilos, ese documento es
obligatorio.

## Lo que no se hace

1. **No renombrar un id de pregunta ni de toma fotográfica** (`lib/cuestionario.ts`). Se
   pueden reordenar. Están escritos dentro de expedientes ya sellados.
2. **No cambiar el texto de una opción del cuestionario.** No es copy: es el valor que se
   guarda en `casos.respuestas` y contra el que el motor de consistencia compara por
   igualdad literal. Viven una sola vez, en `VALOR`.
3. **No usar Server Actions.** No existe ni un `'use server'` en el repositorio. Toda
   mutación va por `fetch` a un route handler de `app/api/`.
4. **No crear una carpeta de migraciones.** El esquema es el template string `SCHEMA` de
   `lib/db.ts`, aplicado de forma idempotente. Los cambios se agregan ahí.
5. **No agregar una dependencia sin justificarla.** El proyecto tiene seis y es
   deliberado. Antes de sumar una, mirá si Node 22 o el navegador ya lo traen: la firma
   ECDSA, el sello de tiempo RFC 3161 y el hash de contraseñas están hechos así.
6. **No registrar un evento de cadena sobre un expediente sellado.** El verificador
   público recalcula el manifiesto sobre todos los eventos del caso: un eslabón posterior
   al cierre hace que denuncie como alterado un expediente intacto. Lo posterior al
   sellado va a una tabla propia, fuera de la cadena.

## Lo que sí

- **Español en todo**: identificadores, comentarios, nombres de archivo, columnas
  (snake_case), clases CSS, copy. Voseo. Acentos en textos, nunca en identificadores.
- **Sin punto y coma, comillas simples, indentación de 2.**
- Todo cambio de estado sobre un caso registra su evento con `registrarEvento`.
- Todo route handler exporta `runtime` y `dynamic`, y termina su `catch` en `errorApi`.
- Los mensajes de error dicen **qué hay que arreglar**, no «algo salió mal».
- Los comentarios explican **por qué**, no qué hace la línea de abajo.

## Excepción consciente

La regla de dejar los componentes de una sola pantalla sin exportar, dentro del archivo
que los usa, no aplica a `app/s/[id]/pantallas/`: ahí cada pantalla tiene su propio
archivo y se exporta. Se hizo para que la parte visual se pueda trabajar sin abrir el
conmutador del recorrido. No las vuelvas a juntar.

