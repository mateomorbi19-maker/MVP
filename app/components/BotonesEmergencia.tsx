import { EMERGENCIAS, EMERGENCIAS_EN_EL_LUGAR, type Emergencia } from '@/lib/emergencias'
import { Icono } from './Iconos'

/**
 * Los botones para llamar.
 *
 * Marcado estático con href tel:. No consulta nada ni depende del servidor a propósito:
 * es lo último que tiene que seguir funcionando cuando todo lo demás falla.
 */
export function BotonesEmergencia({ soloLugar = false }: { soloLugar?: boolean }) {
  const lista: Emergencia[] = soloLugar ? EMERGENCIAS_EN_EL_LUGAR : EMERGENCIAS
  /*
   * `emergencias` sola ya da la grilla de una columna, que es lo que la pantalla del lugar
   * necesita. Antes decia `emergencias emergencias-lugar` y esa segunda clase no existia
   * en la hoja: no se veia rota, pero cualquier ajuste a la variante del lugar se habria
   * escrito contra una clase que el CSS no conoce, sin que nada fallara.
   */
  return (
    <div className={soloLugar ? 'emergencias' : 'emergencias emergencias-inicio'}>
      {lista.map((e) => (
        <a
          key={e.numero}
          href={`tel:${e.numero}`}
          className="boton boton-llamada"
          aria-label={`Llamar al ${e.numero}, ${e.nombre}`}
        >
          <span className="boton-llamada-icono">
            <Icono nombre="telefono" />
          </span>
          <span className="boton-llamada-contenido">
            <span className="boton-llamada-nombre">{e.nombre}</span>
            <span className="boton-llamada-detalle">
              {e.numero} · {e.detalle}
            </span>
          </span>
          <span className="boton-llamada-accion">Llamar</span>
        </a>
      ))}
    </div>
  )
}
