'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'
import { SinSesion } from '@/app/components/SinSesion'

type Documento = { id: string; tipo: string; titulo: string | null; sha256: string; creado_en: string }
type Poliza = {
  id: string
  numero: string
  aseguradora: string
  patente: string | null
  marca_modelo: string | null
  anio: number | null
  cobertura: string | null
  vigencia_hasta: string | null
  principal: boolean
  productor: { nombre: string; aseguradora: string } | null
  documentos: Documento[]
}
type TipoBloque = 'poliza' | 'licencia' | 'cedula'
type Archivo = { id: string; tipo: TipoBloque; nombre: string | null; mime: string; bytes: number; creado_en: string }
type Datos = Record<string, string | null>
type Documentacion = { licencia: Datos | null; cedula: Datos | null; archivos: Archivo[] }
type Campo = { clave: string; etiqueta: string; fecha?: boolean }

// El mismo tope que lib/documentacion.ts: se repite acá para no mandar un archivo que el
// servidor va a rechazar después de subirlo entero con poca señal.
const MAXIMO_ARCHIVOS = 10

const CAMPOS_LICENCIA: Campo[] = [
  { clave: 'numero', etiqueta: 'Número de licencia' },
  { clave: 'categoria', etiqueta: 'Categoría' },
  { clave: 'vencimiento', etiqueta: 'Vencimiento', fecha: true },
]

const CAMPOS_CEDULA: Campo[] = [
  { clave: 'patente', etiqueta: 'Patente' },
  { clave: 'marca_modelo', etiqueta: 'Marca y modelo' },
  { clave: 'numero', etiqueta: 'Número de cédula' },
  { clave: 'titular', etiqueta: 'Titular' },
]

// Un fallo de red llega como TypeError y su mensaje viene del navegador, en inglés:
// «Failed to fetch» no le dice a nadie que lo que falta es señal.
const mensajeDe = (e: unknown, generico: string) =>
  e instanceof TypeError
    ? 'No se pudo conectar con el servidor. Revisá que tengas señal o wifi y volvé a intentar.'
    : e instanceof Error
      ? e.message
      : generico

/**
 * Mi documentación. Lo que la persona tiene siempre y no se pierde en el lugar.
 *
 * Cada bloque admite a la vez datos a mano, fotos y PDF: la póliza suele llegar en PDF por
 * correo, la licencia se fotografía y la patente se tipea, y obligar a elegir una sola
 * forma dejaba afuera justo la que la persona tenía a mano.
 */
export default function MiDocumentacion() {
  const [polizas, setPolizas] = useState<Poliza[] | null>(null)
  const [doc, setDoc] = useState<Documentacion | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sinSesion, setSinSesion] = useState(false)
  const [alta, setAlta] = useState(false)
  const [nueva, setNueva] = useState({ numero: '', aseguradora: '', patente: '', marca_modelo: '', anio: '' })

  const leer = async (url: string, generico: string) => {
    const r = await fetch(url)
    // Que falte la sesión no es una falla del sistema: es un estado con su propia salida.
    if (r.status === 401) {
      setSinSesion(true)
      return null
    }
    const c = await r.json()
    if (!r.ok) throw new Error(c?.error ?? generico)
    return c
  }

  const cargar = () =>
    Promise.all([
      leer('/api/polizas', 'No se pudieron leer las pólizas. Volvé a cargar la pantalla en un minuto.'),
      leer('/api/documentacion', 'No se pudo leer tu documentación. Volvé a cargar la pantalla en un minuto.'),
    ])
      .then(([p, d]) => {
        if (p) setPolizas(p)
        if (d) setDoc(d)
      })
      .catch((e) => setError(mensajeDe(e, 'No se pudo leer tu documentación. Volvé a cargar la pantalla en un minuto.')))

  useEffect(() => {
    cargar()
  }, [])

  async function guardarPoliza(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const res = await fetch('/api/polizas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nueva),
      })
      const c = await res.json()
      if (!res.ok) throw new Error(c?.error ?? 'No se pudo guardar la póliza. Revisá el número y la aseguradora.')
      setAlta(false)
      setNueva({ numero: '', aseguradora: '', patente: '', marca_modelo: '', anio: '' })
      cargar()
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la póliza. Revisá el número y la aseguradora.'))
    }
  }

  const campo = (clave: keyof typeof nueva) => ({
    value: nueva[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNueva({ ...nueva, [clave]: e.target.value }),
  })

  const archivosDe = (tipo: TipoBloque) => (doc?.archivos ?? []).filter((a) => a.tipo === tipo)

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Mi documentación</h1>
        <p className="bajada-pagina">
          Lo que tenés que tener a mano el día del choque y nunca aparece: la póliza, la licencia y la cédula del
          vehículo. Cargala a mano, con fotos o en PDF, como te quede más cómodo, y queda acá.
        </p>
      </header>

      {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

      {sinSesion ? <SinSesion volver="/poliza" que="tu documentación" /> : null}

      {sinSesion || polizas === null || doc === null ? null : (
        <>
          <section className="tarjeta">
            <h2 className="titulo-tarjeta">Póliza</h2>

            {polizas.length === 0 && !alta ? (
              <p className="apagado mini">
                Con la póliza cargada, el recorrido de un siniestro arranca con tus datos ya puestos.
              </p>
            ) : null}

            {polizas.map((p) => (
              <div className="documentacion-poliza" key={p.id}>
                <h3 className="documentacion-poliza-titulo">
                  {p.aseguradora} · {p.numero}
                </h3>
                {/*
                  La insignia encabeza la línea de datos y no va como renglón suelto, igual que en
                  /historial: sola entre el título y los datos queda a 0px del título y a 0px del
                  párrafo, sin pertenecer a ninguno de los dos.
                */}
                <p className="mini">
                  {p.principal ? (
                    <>
                      <span className="insignia" data-nivel="ok">
                        Principal
                      </span>{' '}
                    </>
                  ) : null}
                  {[p.marca_modelo, p.anio, p.patente, p.cobertura].filter(Boolean).join(' · ') ||
                    'Sin datos del vehículo'}
                  {p.vigencia_hasta ? ` · vence ${p.vigencia_hasta}` : ''}
                </p>
                {p.productor ? <p className="mini">Productor: {p.productor.nombre}</p> : null}
                {/*
                  Los adjuntos viejos, colgados de la póliza, se siguen mostrando: son de la
                  persona y no se migran. Los nuevos van a los archivos del bloque.
                  Es un <a> y no un <Link>: lo sirve un route handler, no es una ruta.
                */}
                {p.documentos.map((d) => (
                  <a className="enlace mini" href={`/api/documentos/${d.id}`} target="_blank" rel="noreferrer" key={d.id}>
                    Ver {d.titulo || d.tipo}
                  </a>
                ))}
              </div>
            ))}

            {alta ? (
              <form onSubmit={guardarPoliza}>
                <h3 className="documentacion-poliza-titulo">Agregar una póliza</h3>
                <div className="campo">
                  <label htmlFor="numero">Número de póliza</label>
                  <input id="numero" type="text" {...campo('numero')} />
                </div>
                <div className="campo">
                  <label htmlFor="aseguradora">Aseguradora</label>
                  <input id="aseguradora" type="text" {...campo('aseguradora')} />
                </div>
                <div className="campo">
                  <label htmlFor="patente">Patente</label>
                  <input id="patente" type="text" {...campo('patente')} />
                </div>
                <div className="campo">
                  <label htmlFor="marca_modelo">Marca y modelo</label>
                  <input id="marca_modelo" type="text" {...campo('marca_modelo')} />
                </div>
                <div className="campo">
                  <label htmlFor="anio">Año</label>
                  <input id="anio" type="text" inputMode="numeric" {...campo('anio')} />
                </div>
                <div className="fila-botones">
                  <button className="boton boton-secundario" type="button" onClick={() => setAlta(false)}>
                    Cancelar
                  </button>
                  <button className="boton-primario" type="submit">
                    Guardar
                  </button>
                </div>
              </form>
            ) : (
              <button className="boton boton-ancho boton-secundario" type="button" onClick={() => setAlta(true)}>
                {polizas.length ? 'Agregar otra póliza' : 'Cargar los datos a mano'}
              </button>
            )}

            <Adjuntos tipo="poliza" archivos={archivosDe('poliza')} alCambiar={cargar} alFallar={setError} />
          </section>

          <section className="tarjeta">
            <h2 className="titulo-tarjeta">Licencia de conducir</h2>
            <DatosAMano
              tipo="licencia"
              campos={CAMPOS_LICENCIA}
              iniciales={doc.licencia}
              alCambiar={cargar}
              alFallar={setError}
            />
            <Adjuntos tipo="licencia" archivos={archivosDe('licencia')} alCambiar={cargar} alFallar={setError} />
          </section>

          <section className="tarjeta">
            <h2 className="titulo-tarjeta">Cédula del vehículo</h2>
            <DatosAMano
              tipo="cedula"
              campos={CAMPOS_CEDULA}
              iniciales={doc.cedula}
              alCambiar={cargar}
              alFallar={setError}
            />
            <Adjuntos tipo="cedula" archivos={archivosDe('cedula')} alCambiar={cargar} alFallar={setError} />
          </section>
        </>
      )}

      {/*
        Sin sesión el pie sobra: /cuenta rebota a /entrar?volver=/cuenta y la persona pierde
        que lo que quería ver era su documentación.
      */}
      {sinSesion ? null : (
        <p className="mini centrado pie-sesion">
          <Link href="/cuenta" className="enlace">Volver a mi cuenta</Link>
        </p>
      )}
    </main>
  )
}

/** El formulario a mano de la licencia o la cédula. Guardar reemplaza lo anterior del bloque. */
function DatosAMano({
  tipo,
  campos,
  iniciales,
  alCambiar,
  alFallar,
}: {
  tipo: 'licencia' | 'cedula'
  campos: Campo[]
  iniciales: Datos | null
  alCambiar: () => void
  alFallar: (m: string | null) => void
}) {
  const [valores, setValores] = useState<Record<string, string>>(() =>
    Object.fromEntries(campos.map((c) => [c.clave, iniciales?.[c.clave] ?? ''])),
  )
  const [guardando, setGuardando] = useState(false)
  const [guardado, setGuardado] = useState(false)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    alFallar(null)
    setGuardando(true)
    setGuardado(false)
    try {
      const res = await fetch('/api/documentacion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo, datos: valores }),
      })
      const c = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(c?.error ?? 'No se pudieron guardar los datos. Revisá los campos y volvé a intentar.')
      setGuardado(true)
      alCambiar()
    } catch (err) {
      alFallar(mensajeDe(err, 'No se pudieron guardar los datos. Revisá los campos y volvé a intentar.'))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <form onSubmit={guardar}>
      {campos.map((c) => (
        <div className="campo" key={c.clave}>
          <label htmlFor={`${tipo}-${c.clave}`}>{c.etiqueta}</label>
          <input
            id={`${tipo}-${c.clave}`}
            type={c.fecha ? 'date' : 'text'}
            value={valores[c.clave]}
            onChange={(e) => {
              setGuardado(false)
              setValores({ ...valores, [c.clave]: e.target.value })
            }}
          />
        </div>
      ))}
      <button className="boton-primario" type="submit" disabled={guardando}>
        {guardando ? 'Guardando…' : guardado ? 'Guardado' : 'Guardar'}
      </button>
    </form>
  )
}

/**
 * Fotos y PDF de un bloque. Las tres entradas conviven: tener el PDF no impide sumar la
 * foto del dorso, y viceversa. La cámara lleva capture para ir derecho a sacarla; la
 * galería y el PDF no, porque con capture el navegador no deja elegir un archivo guardado.
 */
function Adjuntos({
  tipo,
  archivos,
  alCambiar,
  alFallar,
}: {
  tipo: TipoBloque
  archivos: Archivo[]
  alCambiar: () => void
  alFallar: (m: string | null) => void
}) {
  const [subiendo, setSubiendo] = useState(false)
  const lleno = archivos.length >= MAXIMO_ARCHIVOS

  async function subir(e: React.ChangeEvent<HTMLInputElement>) {
    const elegidos = Array.from(e.target.files ?? [])
    // Se vacía para que elegir el mismo archivo dos veces vuelva a disparar el cambio.
    e.target.value = ''
    if (elegidos.length === 0) return
    alFallar(null)
    const lugar = MAXIMO_ARCHIVOS - archivos.length
    if (elegidos.length > lugar) {
      alFallar(`Entran ${lugar} archivo${lugar === 1 ? '' : 's'} más en este bloque. Quitá alguno para sumar el resto.`)
    }
    setSubiendo(true)
    try {
      for (const archivo of elegidos.slice(0, lugar)) {
        const cuerpo = new FormData()
        cuerpo.append('tipo', tipo)
        cuerpo.append('archivo', archivo)
        const res = await fetch('/api/documentacion/archivos', { method: 'POST', body: cuerpo })
        if (!res.ok) {
          const c = await res.json().catch(() => ({}))
          throw new Error(c?.error ?? `No se pudo guardar ${archivo.name}. Probá de nuevo o con otro archivo.`)
        }
      }
    } catch (err) {
      alFallar(mensajeDe(err, 'No se pudo guardar el archivo. Probá de nuevo o con otro archivo.'))
    } finally {
      setSubiendo(false)
      alCambiar()
    }
  }

  async function quitar(id: string) {
    alFallar(null)
    try {
      const res = await fetch(`/api/documentacion/archivos/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const c = await res.json().catch(() => ({}))
        throw new Error(c?.error ?? 'No se pudo quitar el archivo. Volvé a cargar la pantalla y probá de nuevo.')
      }
      alCambiar()
    } catch (err) {
      alFallar(mensajeDe(err, 'No se pudo quitar el archivo. Volvé a cargar la pantalla y probá de nuevo.'))
    }
  }

  return (
    <div className="adjuntos">
      <h3 className="rotulo">Fotos y PDF</h3>
      {archivos.length === 0 ? <p className="apagado mini">Todavía no sumaste fotos ni PDF.</p> : null}
      {archivos.length ? (
        <div className="foto-grilla">
          {archivos.map((a) => {
            const url = `/api/documentacion/archivos/${a.id}`
            return (
              <div className="adjunto" key={a.id}>
                <div className="miniatura">
                  {a.mime === 'application/pdf' ? (
                    <span className="miniatura-pdf">
                      <Icono nombre="archivo" />
                      <span className="miniatura-pdf-nombre">{a.nombre || 'Documento PDF'}</span>
                    </span>
                  ) : (
                    <img src={url} alt={a.nombre || 'Foto de la documentación'} loading="lazy" />
                  )}
                </div>
                <div className="adjunto-acciones">
                  <a className="adjunto-accion" href={url} target="_blank" rel="noreferrer">
                    Ver
                  </a>
                  <button className="adjunto-accion adjunto-quitar" type="button" onClick={() => void quitar(a.id)}>
                    Quitar
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {subiendo ? <p className="mini apagado">Guardando…</p> : null}

      {lleno ? (
        <p className="mini apagado">Llegaste a {MAXIMO_ARCHIVOS} archivos. Quitá alguno para sumar otro.</p>
      ) : (
        <div className="adjuntar-opciones">
          <label className="boton boton-secundario" aria-disabled={subiendo}>
            <Icono nombre="camara" />
            Sacar foto
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="entrada-oculta"
              disabled={subiendo}
              onChange={subir}
            />
          </label>
          <label className="boton boton-secundario" aria-disabled={subiendo}>
            <Icono nombre="descargar" />
            Elegir de la galería
            <input type="file" accept="image/*" multiple className="entrada-oculta" disabled={subiendo} onChange={subir} />
          </label>
          <label className="boton boton-secundario" aria-disabled={subiendo}>
            <Icono nombre="archivo" />
            Cargar PDF
            <input
              type="file"
              accept="application/pdf"
              multiple
              className="entrada-oculta"
              disabled={subiendo}
              onChange={subir}
            />
          </label>
        </div>
      )}
    </div>
  )
}
