import Link from 'next/link'
import { notFound } from 'next/navigation'
import { obtenerCaso, listarMedias, listarTestigos, calcularConsistencia } from '@/lib/casos'
import { construirManifiesto } from '@/lib/hash'
import { SECCIONES, GUIA_FOTOS } from '@/lib/cuestionario'
import { ETIQUETA_NIVEL } from '@/lib/consistencia'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'
import { exigirRol } from '@/lib/sesion'
import { AccionesGestion } from '@/app/components/AccionesGestion'

export const dynamic = 'force-dynamic'

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'medium' }) : '-'

export default async function DetalleCaso({ params }: { params: Promise<{ id: string }> }) {
  await exigirRol('productor', 'aseguradora')
  const { id } = await params
  const caso = await obtenerCaso(id)
  if (!caso) notFound()

  const [medias, testigos, manifiesto] = await Promise.all([
    listarMedias(id),
    listarTestigos(id),
    construirManifiesto(id),
  ])
  const consistencia = caso.consistencia ?? (await calcularConsistencia(id))
  const fotos = medias.filter((m) => m.tipo === 'foto')
  const audios = medias.filter((m) => m.tipo === 'audio')

  return (
    <main className="envoltura-ancha">
      <Marca />

      <header className="encabezado-pagina encabezado-con-accion">
        <div>
          <h1 className="titulo-pagina">{caso.id}</h1>
          <p className="bajada-pagina">
            {caso.patente ? `${caso.patente} · ` : ''}
            {caso.asegurado || 'Sin asegurado declarado'}
            {' · '}
            <span className="insignia" data-nivel={caso.estado === 'cerrado' ? 'ok' : 'neutra'}>
              {caso.estado === 'cerrado' ? 'Sellada' : 'En curso'}
            </span>
          </p>
        </div>
        <div className="fila-botones">
          <a className="boton boton-primario" href={`/api/casos/${id}/pdf?descargar=1`}>
            Descargar PDF
          </a>
          <Link className="boton boton-secundario" href={`/verificar?id=${id}`}>
            Verificar
          </Link>
        </div>
      </header>

      {/* Va después del encabezado: quien llega del listado necesita ver de qué actuación
          es el formulario de tramitación antes que el formulario. */}
      <AccionesGestion casoId={id} />

      <hr className="separador" />

      {/* --- Consistencia --- */}
      {consistencia ? (
        <section>
          <h2>Informe de consistencia</h2>
          <p className="apagado">
            Contrasta lo declarado contra datos objetivos y contra la coherencia interna de las respuestas. No
            determina responsabilidad ni concluye fraude.
          </p>

          <div className="insignias insignias-resumen">
            <span className="insignia" data-nivel="alerta">{consistencia.resumen.alertas} contradicciones</span>
            <span className="insignia" data-nivel="cobertura">{consistencia.resumen.banderas_cobertura} cobertura</span>
            <span className="insignia" data-nivel="atencion">{consistencia.resumen.atenciones} a revisar</span>
            <span className="insignia" data-nivel="ok">{consistencia.resumen.controles_ok} consistentes</span>
          </div>

          {(['alerta', 'cobertura', 'atencion', 'ok'] as const).map((nivel) =>
            consistencia.hallazgos
              .filter((h) => h.nivel === nivel)
              .map((h, i) => (
                <div className="aviso" data-nivel={nivel} key={`${nivel}-${i}`}>
                  <div className="hallazgo-encabezado">
                    <span className="insignia" data-nivel={nivel}>{ETIQUETA_NIVEL[nivel]}</span>
                    <strong>{h.titulo}</strong>
                  </div>
                  <div className="mini hallazgo-detalle">
                    <div>
                      <strong>Declarado:</strong> {h.declarado}
                    </div>
                    <div>
                      <strong>Registro objetivo:</strong> {h.objetivo}
                    </div>
                    <div className="hallazgo-detalle-nota">{h.detalle}</div>
                  </div>
                </div>
              )),
          )}
        </section>
      ) : null}

      {/* --- Datos objetivos --- */}
      <section className="bloque-panel">
        <h2>Datos objetivos registrados</h2>
        <div className="tarjeta">
          <Dato etiqueta="Apertura" valor={fecha(caso.creado_en)} />
          <Dato etiqueta="Cierre y sellado" valor={fecha(caso.cerrado_en)} />
          <Dato etiqueta="Póliza" valor={caso.poliza || '-'} />
          <Dato etiqueta="Teléfono" valor={caso.telefono || '-'} />
          <Dato
            etiqueta="Coordenadas"
            valor={caso.gps ? `${caso.gps.lat.toFixed(6)}, ${caso.gps.lon.toFixed(6)} (±${Math.round(caso.gps.precision_m ?? 0)} m)` : 'Sin registrar'}
          />
          <Dato etiqueta="Dirección" valor={caso.direccion || '-'} />
          {caso.gps ? (
            <Dato
              etiqueta="Mapa"
              valor={
                <a
                  className="enlace"
                  href={`https://www.openstreetmap.org/?mlat=${caso.gps.lat}&mlon=${caso.gps.lon}#map=18/${caso.gps.lat}/${caso.gps.lon}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver el punto en OpenStreetMap
                </a>
              }
            />
          ) : null}
        </div>

        {caso.clima ? (
          <div className="tarjeta">
            <h3 className="titulo-tarjeta">Condiciones meteorológicas</h3>
            <Dato etiqueta="Condición" valor={caso.clima.descripcion} />
            <Dato etiqueta="Hora observada" valor={caso.clima.hora_observada.replace('T', ' ')} />
            <Dato etiqueta="Temperatura" valor={caso.clima.temperatura_c !== null ? `${caso.clima.temperatura_c} °C` : '-'} />
            <Dato
              etiqueta="Precipitación"
              valor={`${caso.clima.precipitacion_mm ?? '-'} mm en la hora · ${caso.clima.precipitacion_3h_mm ?? '-'} mm en 3 h`}
            />
            <Dato etiqueta="Viento" valor={caso.clima.viento_kmh !== null ? `${caso.clima.viento_kmh} km/h` : '-'} />
            <Dato
              etiqueta="Visibilidad"
              valor={caso.clima.visibilidad_m !== null ? `${Math.round(caso.clima.visibilidad_m)} m` : '-'}
            />
            <Dato
              etiqueta="Franja horaria"
              valor={
                caso.clima.es_de_dia === null
                  ? '-'
                  : `${caso.clima.es_de_dia ? 'Diurna' : 'Nocturna'} (amanecer ${(caso.clima.amanecer ?? '').slice(11, 16)}, atardecer ${(caso.clima.atardecer ?? '').slice(11, 16)})`
              }
            />
            <p className="mini pie-fuente">Fuente: {caso.clima.fuente}</p>
          </div>
        ) : null}
      </section>

      {/* --- Declaración --- */}
      <section className="bloque-panel">
        <h2>Declaración del conductor</h2>
        {SECCIONES.map((s) => {
          const conRespuesta = s.preguntas.filter((p) => {
            const v = caso.respuestas[p.id]
            return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
          })
          if (conRespuesta.length === 0) return null
          return (
            <div className="tarjeta" key={s.id}>
              <h3 className="titulo-tarjeta titulo-tarjeta-apagado">{s.titulo}</h3>
              {conRespuesta.map((p) => {
                const v = caso.respuestas[p.id]
                const texto = Array.isArray(v)
                  ? v.join(' · ')
                  : typeof v === 'object' && v !== null
                    ? Object.entries(v as Record<string, unknown>)
                        .filter(([, x]) => x)
                        .map(([k, x]) => `${k}: ${x}`)
                        .join(' · ')
                    : String(v)
                return <Dato key={p.id} etiqueta={p.texto.replace(/^¿|\?$/g, '')} valor={`${texto}${p.unidad ? ` ${p.unidad}` : ''}`} />
              })}
            </div>
          )
        })}
      </section>

      {/* --- Audios --- */}
      {audios.length > 0 ? (
        <section className="bloque-panel">
          <h2>Relato en audio</h2>
          <div className="tarjeta">
            {audios.map((a) => (
              <div className="pieza-audio" key={a.id}>
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <audio className="pieza-audio-reproductor" controls src={`/api/media/${a.id}`} />
                <p className="mono pie-huella">
                  {a.id} · SHA-256 {a.sha256}
                </p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* --- Fotos --- */}
      <section className="bloque-panel">
        <h2>Documentación fotográfica ({fotos.length})</h2>
        {fotos.length === 0 ? (
          <div className="vacio">
            <span className="vacio-icono">
              <Icono nombre="camara" />
            </span>
            <h3 className="vacio-titulo">Sin fotografías incorporadas</h3>
            <p className="vacio-texto">
              Las fotos del lugar son lo que permite contrastar los daños declarados contra el estado real de los
              vehículos. En esta actuación no se incorporó ninguna.
            </p>
          </div>
        ) : (
          <div className="grilla-fotos grilla-fotos-panel">
            {fotos.map((f) => {
              const guia = GUIA_FOTOS.find((g) => g.id === f.guia_id)
              return (
                <a key={f.id} className="foto-panel" href={`/api/media/${f.id}`} target="_blank" rel="noreferrer">
                  <div className="miniatura">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/media/${f.id}`} alt={guia?.titulo ?? 'Fotografía'} />
                  </div>
                  <div className="mini foto-panel-pie">
                    <strong className="foto-panel-titulo">{guia?.titulo ?? 'Toma libre'}</strong>
                    <div>{new Date(f.capturado_en).toLocaleString('es-AR')}</div>
                  </div>
                </a>
              )
            })}
          </div>
        )}
      </section>

      {/* --- Testigos --- */}
      <section className="bloque-panel">
        <h2>Testigos ({testigos.length})</h2>
        {testigos.length === 0 ? (
          <div className="vacio">
            <span className="vacio-icono">
              <Icono nombre="personas" />
            </span>
            <h3 className="vacio-titulo">Sin testigos registrados</h3>
            <p className="vacio-texto">
              Un testigo carga sus datos y su manifestación desde su propio teléfono, escaneando el QR en el lugar
              del hecho. En esta actuación no se sumó ninguno.
            </p>
          </div>
        ) : (
          testigos.map((t) => (
            <div className="tarjeta" key={t.id}>
              <h3>{t.nombre}</h3>
              <Dato etiqueta="DNI" valor={t.dni || '-'} />
              <Dato etiqueta="Teléfono" valor={t.telefono || '-'} />
              <Dato etiqueta="Registrado" valor={fecha(t.creado_en)} />
              {t.relato ? <Dato etiqueta="Manifestación" valor={t.relato} /> : null}
              <p className="mono pie-huella">SHA-256 {t.sha256}</p>
            </div>
          ))
        )}
      </section>

      {/* --- Cadena de custodia --- */}
      <section className="bloque-panel">
        <h2>Cadena de custodia</h2>
        <p className="apagado">
          {manifiesto.cadena.length} eslabones · hash maestro <span className="mono">{manifiesto.hash_maestro}</span>
        </p>
        <div className="tabla-envoltura">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Momento</th>
                <th>Acción</th>
                <th>Hash</th>
              </tr>
            </thead>
            <tbody>
              {manifiesto.cadena.map((e) => (
                <tr key={e.n}>
                  <td>{e.n}</td>
                  <td className="celda-fecha">
                    {new Date(e.ts).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' })}
                  </td>
                  <td>{e.tipo}</td>
                  <td className="mono celda-hash">
                    {e.hash}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {caso.sello ? (
          <div className="tarjeta tarjeta-sellado">
            <h3 className="titulo-tarjeta">Sellado</h3>
            <Dato etiqueta="Sellado el" valor={fecha(caso.sello.sellado_en)} />
            <Dato etiqueta="Algoritmo" valor={caso.sello.firma.algoritmo} />
            <Dato etiqueta="Huella de clave pública" valor={<span className="mono">{caso.sello.firma.clave_publica_sha256}</span>} />
            <Dato
              etiqueta="Sello de tiempo RFC 3161"
              valor={
                caso.sello.tsa.obtenida
                  ? `Obtenido de ${caso.sello.tsa.autoridad}`
                  : `No obtenido — ${caso.sello.tsa.error ?? 'sin detalle'}`
              }
            />
            {caso.sello.firma.advertencia ? (
              <div className="aviso aviso-al-pie" data-nivel="atencion">
                {caso.sello.firma.advertencia}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    </main>
  )
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="dato">
      <span className="mini dato-etiqueta">{etiqueta}</span>
      <span className="dato-valor">{valor}</span>
    </div>
  )
}
