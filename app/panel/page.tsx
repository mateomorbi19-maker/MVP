import Link from 'next/link'
import { listarCasos } from '@/lib/casos'
import { alcanceDe, exigirRol } from '@/lib/sesion'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'

export const dynamic = 'force-dynamic'

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-'

export default async function Panel() {
  const sesion = await exigirRol('productor', 'aseguradora')
  const casos = await listarCasos(alcanceDe(sesion))

  return (
    <main className="envoltura-ancha">
      <Marca />

      <header className="encabezado-pagina encabezado-con-accion">
        <div>
          <h1 className="titulo-pagina">Panel de siniestros</h1>
          <p className="bajada-pagina">
            {casos.length} actuación{casos.length === 1 ? '' : 'es'} registrada{casos.length === 1 ? '' : 's'}.
          </p>
        </div>
        <Link href="/" className="boton boton-secundario">
          Nueva actuación
        </Link>
      </header>

      {casos.length === 0 ? (
        <div className="vacio">
          <span className="vacio-icono">
            <Icono nombre="archivo" />
          </span>
          <h2 className="vacio-titulo">Todavía no hay siniestros cargados</h2>
          <p className="vacio-texto">Cuando alguien complete el recorrido de captura, la actuación aparece acá.</p>
          <Link href="/" className="boton boton-primario">
            Crear una de prueba
          </Link>
        </div>
      ) : (
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>Actuación</th>
                <th>Estado</th>
                <th>Patente</th>
                <th>Asegurado</th>
                <th>Lugar</th>
                <th>Apertura</th>
                <th>Consistencia</th>
              </tr>
            </thead>
            <tbody>
              {casos.map((c) => {
                const r = c.consistencia?.resumen
                return (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/panel/${c.id}`} className="enlace">
                        {c.id}
                      </Link>
                    </td>
                    <td>
                      <span className="insignia" data-nivel={c.estado === 'cerrado' ? 'ok' : 'neutra'}>
                        {c.estado === 'cerrado' ? 'Sellada' : 'En curso'}
                      </span>
                    </td>
                    <td>{c.patente || '-'}</td>
                    <td>{c.asegurado || '-'}</td>
                    <td className="celda-lugar">
                      {c.direccion ? c.direccion.split(',').slice(0, 3).join(', ') : '-'}
                    </td>
                    <td className="celda-fecha">{fecha(c.creado_en)}</td>
                    <td>
                      {r ? (
                        <span className="insignias">
                          {r.alertas > 0 ? <span className="insignia" data-nivel="alerta">{r.alertas} contra.</span> : null}
                          {r.banderas_cobertura > 0 ? (
                            <span className="insignia" data-nivel="cobertura">{r.banderas_cobertura} cob.</span>
                          ) : null}
                          {r.atenciones > 0 ? (
                            <span className="insignia" data-nivel="atencion">{r.atenciones} rev.</span>
                          ) : null}
                          {r.alertas === 0 && r.banderas_cobertura === 0 && r.atenciones === 0 ? (
                            <span className="insignia" data-nivel="ok">Sin observaciones</span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="mini">Sin cerrar</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mini pie-sesion">
        Sesión de {sesion.nombre ?? sesion.dni} ({sesion.rol}).{' '}
        {sesion.rol === 'productor' ? 'Ves las actuaciones que te fueron asignadas.' : 'Ves todas las actuaciones.'}
      </p>
    </main>
  )
}
