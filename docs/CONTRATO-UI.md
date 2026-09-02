# Contrato de interfaz

Qué se puede cambiar libremente y qué no, para que el trabajo visual y el funcional
avancen sin pisarse.

El trabajo de este proyecto está partido en dos: la funcionalidad y el backend por un
lado, la parte visual y estética por el otro. Este documento es el borde entre ambos.

```bash
npm run contrato
```

Casi todo lo que dice acá está verificado por ese script. Si algo se rompe, falla ahí, con
el motivo escrito. **Lo que el script no puede ver** —contraste, jerarquía, un texto que
desborda, un botón abajo del pliegue— lo revisa una persona, con un teléfono, parada al
sol. Verde no quiere decir que se vea bien.

---

## Lo primero: qué es esta aplicación

Se usa **parada al lado de un auto chocado, con adrenalina y una sola mano.** No es un
formulario: es una pregunta por pantalla, con botones grandes, donde elegir ya es avanzar.
Y no produce una pantalla: produce **prueba**, un expediente sellado que puede terminar
delante de un liquidador, un perito o un juez.

Las dos cosas juntas explican casi todas las reglas de abajo. Un error de estilo acá no se
paga con una pantalla fea: se paga con una ambulancia que no se llamó, o con un expediente
que no verifica.

---

## Lista verde: tocá lo que quieras

- **`app/globals.css` entero.** Colores, tipografía, espaciado, bordes, sombras, radios,
  animaciones, disposición. Es el único lugar donde vive el estilo y la idea es que ahí
  vivan todos los cambios.
- **El marcado dentro de cada pantalla** de `app/s/[id]/pantallas/`, salvo lo que la lista
  roja nombra.
- **Los nombres de clase**, incluso renombrarlos. Se puede: verifiqué que no hay ni un
  `querySelector`, `getElementById`, `classList` ni `getBoundingClientRect` en todo
  `app/` y `lib/`. Ninguna clase se lee desde JavaScript.
- **Los textos de la interfaz** que no sean opciones del cuestionario: títulos, ayudas,
  rótulos de botones, mensajes vacíos.
- **Íconos, ilustraciones y recursos** nuevos.
- **`app/components/Marca.tsx`** y el aspecto del encabezado.

### Lo que ya está resuelto y conviene reusar

Hay cuatro piezas compartidas por las pantallas de fuera del recorrido. No son
obligatorias, pero antes de inventar una variante mirá si alguna sirve: la razón por la que
existen es que cada pantalla resolvía lo mismo de una manera distinta, y al abrirlas una
detrás de otra no parecían del mismo sistema.

| Pieza | Clases o componente | Para qué |
| --- | --- | --- |
| Encabezado de pantalla | `.encabezado-pagina` con `.titulo-pagina` y `.bajada-pagina` | La `<Marca />` dice de quién es la aplicación; el encabezado dice en qué pantalla estás. Con encabezado, la marca va **sin** la prop `sub` |
| Encabezado con acción | `+ .encabezado-con-accion` | Título a la izquierda y un botón a la derecha. Apila en vertical por debajo de 700px |
| Estado vacío | `.vacio`, `.vacio-icono`, `.vacio-titulo`, `.vacio-texto` | Cuando todavía no hay nada cargado. El texto dice **para qué sirve** lo que falta |
| Hace falta una cuenta | `<SinSesion volver que>` | El 401. No va en rojo: no es una falla, es un estado con salida a `/entrar` |
| Fila que lleva a otro lado | `.acceso` y sus partes | Icono, título, detalle y flecha |

Los íconos disponibles en `app/components/Iconos.tsx` son once: `archivo`, `personas`,
`camara`, `compartir`, `descargar`, `escudo`, `microfono`, `telefono`, `tilde`,
`ubicacion`, `verificar`. Agregar uno es bienvenido; usar un nombre que no está en la lista
no compila.

## Lista roja: esto se pide, no se hace

Cada punto tiene su motivo. Ninguno es una manía.

### 1. El texto de las opciones del cuestionario

En `lib/cuestionario.ts`, la constante `VALOR`.

**No es copy: es el dato.** El texto de cada opción es literalmente lo que se guarda en
`casos.respuestas`, ya escrito dentro de expedientes sellados, y es contra lo que el motor
de consistencia compara **por igualdad literal** en veintiséis lugares. Cambiar
`'No lo sé'` por `'No estoy seguro'` —una mejora de redacción perfectamente razonable, y
de hecho el mismo cuestionario usa `'No estoy seguro'` en otras dos preguntas— deja
huérfanos los expedientes anteriores y apaga en silencio la contradicción que ese valor
detectaba. No falla nada. Simplemente deja de funcionar.

Si hace falta cambiar una redacción, es una decisión de producto que arrastra qué se hace
con lo ya sellado.

### 2. Los ids de pregunta y de toma fotográfica

Se pueden **reordenar**; no se pueden **renombrar**. Los usan el motor de consistencia, el
generador de PDF y la validación del `PATCH`, y quedan guardados dentro de cada expediente
y de cada fotografía incorporada.

### 3. Los `data-*`

| Atributo | Dónde | Qué significa |
| --- | --- | --- |
| `data-elegida` | `.opcion`, `.zona` | La respuesta elegida |
| `data-cuadrada` | `.marca-opcion` | La marca es casilla y no círculo |
| `data-estado` | `.chip`, `.punto` | `pidiendo` · `ok` · `error` · `espera` |
| `data-nivel` | `.aviso`, `.insignia` | `info` · `ok` · `alerta` · `atencion` · `cobertura` · `neutra` |
| `data-paso` | `.pantalla` | Qué tipo de pantalla es |
| `data-bloque` | `.pantalla` | `seguridad` · `lugar` · `despues` |

Estilalos como quieras. **No los saques ni les cambies el valor**: son el contrato entre
la lógica y la hoja de estilos. Antes esto se hacía componiendo el nombre de la clase
(`` `aviso aviso-${nivel}` ``), que es peor: una búsqueda por nombres de clase no lo ve.

### 4. La pantalla de foto

El disparador es un **`<label>`** que envuelve un `<input type="file" capture="environment">`.

- Convertirlo en `<button>` es lo primero que uno hace, porque ya parece un botón. **Un
  `<button>` no abre el selector de archivos**: se terminaron las fotos.
- El input tiene que seguir siendo descendiente del label, o llevar `htmlFor` explícito.
- **`capture="environment"` no se saca.** Sin eso se abre la galería en vez de la cámara
  trasera, y la evidencia deja de ser una toma del lugar.
- El `<small>` que dice «La hora y el lugar los pone el sistema, no el archivo» sostiene el
  valor probatorio de la toma. No es relleno.

### 5. La estructura de cada pantalla

Una pantalla devuelve **exactamente dos hermanos**, hijos directos de `.pantalla`:

```jsx
<>
  <div className="pantalla-cuerpo">…</div>
  <div className="barra-accion">…</div>
</>
```

Envolverlos en un contenedor —el movimiento más natural de un rediseño, «lo envuelvo para
darle padding»— rompe el anclaje al pie **en todo el recorrido a la vez**, porque `flex: 1`
y `margin-top: auto` son estrictamente relación padre-hijo. El botón principal deja de
estar al alcance del pulgar. Y como `.barra-accion` conserva `position: sticky`, **no se
nota en un monitor**: sólo en un teléfono.

### 6. `min-height`, nunca `height`

`.envoltura-flujo` y `.pantalla` usan `min-height`. Con `height` fijo, el contenido más
alto que la pantalla desborda de forma simétrica y **el desbordamiento superior queda
fuera del alcance del scroll**: el título y las primeras filas se vuelven inaccesibles.
Pasa justo en las pantallas que más importan —la revisión, los testigos, la carátula con
el teclado abierto— y no se ve nunca en un escritorio.

### 7. El presupuesto de animación

Ninguna transición sobre `.opcion`, `.zona`, `.marca-opcion` o `.faltante` puede superar
**180 ms**.

Al elegir una opción, la aplicación espera **260 ms** antes de cambiar de pantalla, a
propósito: sin ese retardo la pantalla cambia antes de que el dedo se levante y no queda
ninguna confirmación de qué se eligió. Una transición más larga que el retardo hace que la
opción todavía se esté pintando cuando la pantalla ya se fue: el costo sigue y la
confirmación desaparece. Si un diseño necesita más tiempo, hay que mover ese 260, y eso es
una edición de lógica.

### 8. El punto de la opción elegida

`.marca-opcion-punto`. En las preguntas de opción el auto-avance quita el botón de seguir,
así que **ese punto es la única señal afirmativa de qué se eligió**. Se puede rediseñar;
no se puede eliminar.

### 9. Los caracteres que el PDF se come

Las fuentes estándar de PDF usan **WinAnsi**. Todo carácter por encima de U+00FF se borra
**sin aviso** al generar el expediente: una viñeta `•`, una flecha `→`, un tilde `✓`, un
`≥`. En pantalla se ve perfecto; en el documento que va al liquidador, no está.

La tentación es real: la interfaz ya usa `✓` y `→` en otros lugares, así que copiar ese
estilo hacia el cuestionario es lo natural. `npm run contrato` lo detecta para los textos
del cuestionario, que son los que terminan impresos.

### 10. El lienzo de la firma

`.lienzo-firma` lleva `touch-action: none`: sin eso, arrastrar el dedo hace scroll de la
página en vez de dibujar, y no se puede firmar en un teléfono. El canvas recibe su tamaño
en píxeles reales desde JavaScript, no desde CSS, y `.lienzo-firma-area` lleva alto en
píxeles y **no** en `dvh`, `svh` ni `lvh`: esas unidades cambian cuando el navegador móvil
esconde la barra de direcciones, y el trazo se re-escala mientras la persona firma. Es la
pieza que se ata al hash del acta.

### 11. El croquis

`.croquis` declara `aspect-ratio: 1` y no recibe `width` y `height` por separado, ni
`padding` ni `border` sobre el propio `<svg>` —el borde va en `.croquis-lienzo`—. El
`viewBox` es `0 0 100 100` y no se toca. Con una caja de otra proporción el dibujo se apaisa
adentro, y el croquis de la pantalla deja de coincidir con el que se imprime en el
expediente sellado.

### 12. Los avisos que dicen un límite

Hay textos que parecen relleno y no lo son. Antes de acortar o borrar uno, mirá si dice algo
de esta lista:

- «La hora y el lugar los pone el sistema, no el archivo» (pantalla de foto).
- «Lectura de demostración… no salen de la foto» (revisión de la lectura automática).
- El pie del croquis, que aclara que es declarativo y no un peritaje.
- «Funciona sólo con la aplicación abierta» (modo viaje).
- «La aplicación no llama ni manda mensajes por su cuenta» (contacto de confianza).
- Todo lo que diga firma **electrónica**, art. 5 de la Ley 25.506, y los arts. 7 y 8.

Ninguno es cosmético: cada uno evita que el producto prometa algo que no hace.

### 13. El código de servidor

`lib/`, `app/api/`, y el armado del recorrido en `lib/recorrido.ts`.

---

## Dónde vive cada cosa

```
app/
  page.tsx                    inicio: un botón
  s/[id]/Flujo.tsx            el conmutador: decide qué pantalla se muestra
  s/[id]/tipos.ts             los tipos que comparten las pantallas
  s/[id]/pantallas/*.tsx      una pantalla por archivo  <- acá se trabaja
  globals.css                 TODO el estilo             <- y acá
  components/                 lo compartido entre pantallas
  entrar/ registro/ cuenta/   sesión
  poliza/ historial/ perfil/  la mitad identificada
  t/[id]/ c/[id]/             carga de testigo y de tercero, por QR
  v/[id]/ e/[id]/             verificación pública y apertura desde el correo
  aviso/                      a dónde lleva la notificación de impacto
lib/
  recorrido.ts                qué pantallas hay y en cuál se retoma
  cuestionario.ts             las preguntas, las tomas y los VALORES
docs/
  MAPA-PANTALLAS.md           del mockup al archivo
```

Cada pantalla recibe **valores ya resueltos**, nunca el objeto de respuestas. La pantalla
de emergencia recibe `variante: 'confirmado' | 'dudoso'` en vez de las respuestas
justamente por esto: antes decidía su propio titular comparando contra el texto de una
opción, y mejorar esa redacción cambiaba en silencio lo que ve alguien que no sabe si hay
heridos, en la pantalla más crítica del producto.

---

## Estilo

### Los tokens

Un color nuevo se declara como token en `:root`, **con su valor de modo oscuro**, y se usa
con `var()`. Nunca un color literal suelto: el script lo rechaza.

`--fondo` · `--superficie` · `--superficie-2` · `--tinta` · `--tinta-2` · `--tinta-3` ·
`--borde` · `--acento` · `--acento-fuerte` · `--acento-suave` · `--alerta` ·
`--alerta-fondo` · `--atencion` · `--atencion-fondo` · `--cobertura` ·
`--cobertura-fondo` · `--ok` · `--ok-fondo` · `--radio` · `--radio-s` · `--sombra` ·
`--ancho`

Cuatro **no cambian con el tema**, y el motivo está escrito al lado de cada uno:

- `--emergencia`: en modo oscuro `--alerta` es un rosa pensado para texto; usado de fondo
  pierde el contraste con el blanco justo donde más falta hace leer rápido.
- `--sobre-color` y `--sobre-color-rgb`: blanco sobre una superficie de color pleno. Sobre
  un fondo de color el contraste lo da el color, no el tema del teléfono.
- `--fondo-qr`: el QR necesita fondo claro para que una cámara lo lea, aunque el teléfono
  esté en modo oscuro.

### Estilos en línea

Hay un cupo por archivo, con **máximo y mínimo**, en `scripts/prueba-contrato.mjs`. El
máximo sólo puede bajar. Un archivo que no figura tiene cupo cero: todo lo que se cree
nace limpio.

El mínimo existe por un caso: hay estilos en línea que **no se pueden mover**, los que
transportan un valor calculado en tiempo de ejecución. Ésos van como propiedad
personalizada y el aspecto vuelve a la hoja:

```jsx
<div className="progreso-fino-relleno" style={{ '--avance': `${porcentaje}%` }} />
```
```css
.progreso-fino-relleno { width: var(--avance, 0%); }
```

Sin el mínimo, el trinquete empuja a cero y la forma obvia de cumplir es borrar el valor,
que deja la barra de progreso clavada en 0% para siempre y sin ningún error.

### `:hover`

Toda regla `:hover` va dentro de `@media (hover: hover)`. En una pantalla táctil el
navegador deja el `:hover` pegado en lo último que se tocó, y sobre una opción del
cuestionario eso se ve igual que haberla elegido. Antes se neutralizaba caso por caso, así
que cada hover nuevo nacía desprotegido: el botón de llamar al 107 quedaba apagado después
de tocarlo, como si estuviera deshabilitado, en la pantalla de emergencia.

### Selectores

Un selector cuelga de una clase, no de un tipo de elemento. `.tarjeta div` se desconecta
en cuanto alguien reordena el marcado, sin que nada falle. Hay cinco excepciones
admitidas, cada una con su motivo en `ELEMENTOS_ADMITIDOS`.

---

## Antes de dar por terminado

```bash
npm run contrato && npm run tipos && npm run prueba
```

```bash
npm run build
```

`npm run contrato` son 19 comprobaciones. Tres de ellas existen porque el defecto que
buscan **no falla en ningún otro lado** y sólo se ve abriendo la pantalla justa en el
estado justo:

| Comprobación | Qué pasa si no está |
| --- | --- |
| Toda clase del marcado está definida en `globals.css` | Una clase mal escrita no rompe la compilación, no tira nada en consola y no falla ninguna prueba: el elemento sale sin estilo. Con estados que aparecen poco —un vacío, un 401, un token vencido— llega a producción sin que nadie lo haya visto. `.emergencias-lugar` estuvo así. Las clases armadas con interpolación quedan afuera |
| Los estilos en línea respetan su cupo | El cupo **sólo baja**. Hoy hay un solo estilo en línea en todo el repositorio, el de `Flujo.tsx`, y tiene mínimo además de máximo porque transporta el avance del recorrido como propiedad personalizada. Si necesitás subir un máximo, lo que falta es una clase |
| La cámara sigue siendo cámara y no galería | Sin `capture` el navegador abre la galería y la evidencia deja de ser una toma del lugar. La excepción está en `ENTRADAS_SIN_CAPTURE`: `/poliza` adjunta documentación cargada antes del hecho, y su `accept` declara PDF, así que ahí `capture` impedía elegir el archivo |

Y **a mano, en un teléfono real**, que es lo único que ninguna de las tres cubre:

- El gesto de atrás de Android vuelve a la pregunta anterior, no sale de la aplicación.
- La cámara abre la cámara, no la galería.
- El botón principal queda al alcance del pulgar en la pantalla más larga.
- Se lee con sol de frente.

---

## Si algo de acá estorba

Estas reglas están para que un cambio visual no rompa una funcionalidad en silencio, no
para impedir un rediseño. Si alguna bloquea algo que hay que hacer, se cambia la regla y
el script en el mismo commit, con una línea diciendo por qué.

Lo que no se hace nunca es comentar una comprobación para que pase.
