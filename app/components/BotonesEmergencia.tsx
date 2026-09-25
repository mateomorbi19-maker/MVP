import { EMERGENCIAS } from '@/lib/emergencias'
import { Icono } from './Iconos'

/**
 * Los botones para llamar.
 *
 * Marcado estático con href tel:. No consulta nada ni depende del servidor a propósito:
 * es lo último que tiene que seguir funcionando cuando todo lo demás falla.
 */
export function BotonesEmergencia() {
  return (
    <div className="emergencias emergencias-inicio">
      {EMERGENCIAS.map((e) => (
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
