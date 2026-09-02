import { EMERGENCIAS, EMERGENCIAS_EN_EL_LUGAR, type Emergencia } from '@/lib/emergencias'

/**
 * Los botones para llamar.
 *
 * Marcado estático con href tel:. No consulta nada ni depende del servidor a propósito:
 * es lo último que tiene que seguir funcionando cuando todo lo demás falla.
 */
export function BotonesEmergencia({ soloLugar = false }: { soloLugar?: boolean }) {
  const lista: Emergencia[] = soloLugar ? EMERGENCIAS_EN_EL_LUGAR : EMERGENCIAS
  return (
    <div className="pila">
      {lista.map((e) => (
        <a key={e.numero} href={`tel:${e.numero}`} className="boton boton-llamada">
          {e.numero}
          <span>{e.detalle}</span>
        </a>
      ))}
    </div>
  )
}
