# Banco de simulación del modo viaje (anexo del diseño)

Prototipo descartable que armó la revisión crítica del diseño
(`../2026-09-16-modo-viaje-global-design.md`). **No es código del producto**: no se importa
desde `app/` ni `lib/`, y no cumple las reglas de estilo del repositorio.

Se conserva porque es la única evidencia de las tasas que fijan los umbrales y las reglas
de la §2 del diseño, y porque la fase F2 del plan lo porta a `scripts/banco-impacto.mjs`.

| Archivo | Qué tiene |
|---|---|
| `base.mts` | Generador: escena continua a 1 kHz, recorte del rango del sensor, pasa-bajos del HAL (25 Hz), muestreo a 60 Hz con fase aleatoria, soporte resonante; GPS a 1 Hz con retraso, pasa-bajos, ruido, huecos y modo iOS (velocidad null + posiciones AR(1)). PRNG con semilla. |
| `escenas.mts` | Escenas: sacudida con la mano, caída del soporte, pozos, lomo de burro, portazo, choques, frenadas, ciudad. **Usa `Math.random()` en tres lugares: al portarlo, reemplazar por el PRNG con semilla.** |
| `propuesta.mts` | La lógica corregida que propuso el crítico. Los verificadores la ajustaron: la §2 del diseño es la versión que vale cuando no coincidan. |
| `r4-comparar.mts` | Corrida que compara el borrador original contra la propuesta, con N ensayos por escena. |

Se corría con `npx tsx docs/superpowers/specs/2026-09-16-modo-viaje-banco/r4-comparar.mts`
desde la raíz. Las cifras sirven para comparar lógicas y mostrar mecanismos; no son tasas de
campo. Los modelos de soporte, pozo y retraso del GPS son supuestos.
