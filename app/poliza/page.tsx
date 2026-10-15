'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'
import { SinSesion } from '@/app/components/SinSesion'
import { CuentaPoliza } from '@/app/components/CuentaPoliza'
import type { EstadoCuenta, ContactosPoliza } from '@/lib/polizas'

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
  vigencia_desde: string | null
  principal: boolean
  productor: { nombre: string; aseguradora: string; email: string; telefono: string | null } | null
  documentos: Documento[]
  contactos: ContactosPoliza
  estado_cuenta: EstadoCuenta | null
}
type TipoBloque = 'poliza' | 'licencia' | 'cedula' | 'dni'
type Archivo = { id: string; tipo: TipoBloque; nombre: string | null; mime: string; bytes: number; creado_en: string; poliza_id: string | null }
type Datos = Record<string, string | null>
type Documentacion = { licencia: Datos | null; cedula: Datos | null; archivos: Archivo[] }
type Campo = { clave: string; etiqueta: string; fecha?: boolean }

const CAMPOS_POLIZA: Campo[] = [
  { clave: 'numero', etiqueta: 'Número de póliza' },
  { clave: 'aseguradora', etiqueta: 'Aseguradora' },
  { clave: 'patente', etiqueta: 'Patente' },
  { clave: 'marca_modelo', etiqueta: 'Marca y modelo' },
  { clave: 'anio', etiqueta: 'Año del vehículo' },
  { clave: 'cobertura', etiqueta: 'Cobertura declarada' },
  { clave: 'vigencia_desde', etiqueta: 'Vigencia desde', fecha: true },
  { clave: 'vigencia_hasta', etiqueta: 'Vigencia hasta', fecha: true },
  { clave: 'productor_nombre', etiqueta: 'Nombre del productor' },
  { clave: 'productor_email', etiqueta: 'Email del productor' },
  { clave: 'productor_telefono', etiqueta: 'Teléfono del productor' },
  { clave: 'aseguradora_email', etiqueta: 'Email de la aseguradora' },
  { clave: 'aseguradora_telefono', etiqueta: 'Teléfono de la aseguradora' },
]

// El mismo tope que lib/documentacion.ts: se repite acá para no mandar un archivo que el
// servidor va a rechazar después de subirlo entero con poca señal.
const MAXIMO_ARCHIVOS = 10

const CAMPOS_LICENCIA: Campo[] = [
  { clave: 'numero', etiqueta: 'Número de licencia' },
  { clave: 'categoria', etiqueta: 'Categoría' },
  { clave: 'vencimiento', etiqueta: 'Vencimiento', fecha: true },
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
  const [seleccionada, setSeleccionada] = useState('')
  const [nueva, setNueva] = useState<Record<string, string>>(() => Object.fromEntries(CAMPOS_POLIZA.map((c) => [c.clave, ''])))
  const [guardando, setGuardando] = useState(false)

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
        if (p) {
          setPolizas(p)
          setSeleccionada((actual) => p.some((f: Poliza) => f.id === actual) ? actual : p.find((f: Poliza) => f.principal)?.id ?? p[0]?.id ?? '')
        }
        if (d) setDoc(d)
      })
      .catch((e) => setError(mensajeDe(e, 'No se pudo leer tu documentación. Volvé a cargar la pantalla en un minuto.')))

  useEffect(() => {
    cargar()
  }, [])

  async function guardarPoliza(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setGuardando(true)
    try {
      const res = await fetch('/api/polizas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nueva),
      })
      const c = await res.json()
      if (!res.ok) throw new Error(c?.error ?? 'No se pudo guardar la póliza. Revisá el número y la aseguradora.')
      setAlta(false)
      setSeleccionada(c.id)
      setNueva(Object.fromEntries(CAMPOS_POLIZA.map((c) => [c.clave, ''])))
      cargar()
    } catch (err) {
      setError(mensajeDe(err, 'No se pudo guardar la póliza. Revisá el número y la aseguradora.'))
    } finally {
      setGuardando(false)
    }
  }

  const campo = (clave: keyof typeof nueva) => ({
    value: nueva[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setNueva({ ...nueva, [clave]: e.target.value }),
  })

  const archivosDe = (tipo: TipoBloque) => (doc?.archivos ?? []).filter((a) => a.tipo === tipo && ((tipo === 'licencia' || tipo === 'dni') || a.poliza_id === seleccionada))
  const faltantes = (['poliza', 'cedula', 'licencia', 'dni'] as TipoBloque[]).filter((tipo) => !archivosDe(tipo).some((a) => a.mime.startsWith('image/')))
  const sinAsignar = (doc?.archivos ?? []).filter((a) => (a.tipo === 'poliza' || a.tipo === 'cedula') && !a.poliza_id)

  async function asignar(id: string) {
    try {
      const r = await fetch(`/api/documentacion/archivos/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poliza_id: seleccionada }) })
      const c = await r.json()
      if (!r.ok) throw new Error(c.error)
      await cargar()
    } catch (err) {
      setError(mensajeDe(err, 'Elegí una póliza y volvé a asignar el archivo.'))
    }
  }

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Mi documentación</h1>
        <p className="bajada-pagina">
          Guardá fotos de tu póliza, cédula, licencia y DNI. Los PDF y los datos a mano complementan las fotos.
          Elegí el vehículo antes de cargar sus documentos.
        </p>
      </header>

      {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

      {sinSesion ? <SinSesion volver="/poliza" que="tu documentación" /> : null}

      {sinSesion || polizas === null || doc === null ? null : (
        <>
          <div className="aviso" data-nivel={faltantes.length ? 'info' : 'ok'}>
            {faltantes.length ? `Faltan fotos de: ${faltantes.map((t) => ({ poliza: 'póliza', cedula: 'cédula', licencia: 'licencia', dni: 'DNI' })[t]).join(', ')}.` : 'Tenés fotos de las cuatro categorías para este vehículo.'}
            {' '}Esto no impide iniciar una denuncia urgente. Revisá que todas las caras necesarias se lean bien.
          </div>
          <section className="tarjeta">
            <h2 className="titulo-tarjeta">Mis vehículos y pólizas</h2>
            {polizas.length ? <div className="campo">
              <label htmlFor="vehiculo-elegido">Vehículo y póliza seleccionados</label>
              <select id="vehiculo-elegido" value={seleccionada} onChange={(e) => setSeleccionada(e.target.value)}>
                {polizas.map((p) => <option key={p.id} value={p.id}>{p.patente || 'Sin patente'} · {p.marca_modelo || p.aseguradora} · {p.numero}{p.principal ? ' · Principal' : ''}</option>)}
              </select>
            </div> : null}

            {polizas.length === 0 && !alta ? (
              <p className="apagado mini">
                Con la póliza cargada, el recorrido de un siniestro arranca con tus datos ya puestos.
              </p>
            ) : null}

            {polizas.filter((p) => p.id === seleccionada).map((p) => (
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
                <Contactos poliza={p} />
                <EditorPoliza key={p.id} poliza={p} alCambiar={cargar} alFallar={setError} />
                <CuentaPoliza key={`cuenta-${p.id}`} poliza={p} alCambiar={cargar} alFallar={setError} />
                <HistorialPoliza key={`historial-${p.id}`} id={p.id} alFallar={setError} />
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
                {CAMPOS_POLIZA.map((c) => <div className="campo" key={c.clave}>
                  <label htmlFor={`alta-${c.clave}`}>{c.etiqueta}</label>
                  <input id={`alta-${c.clave}`} type={c.fecha ? 'date' : 'text'} required={c.clave === 'numero' || c.clave === 'aseguradora'} {...campo(c.clave)} />
                </div>)}
                <div className="fila-botones">
                  <button className="boton boton-secundario" type="button" onClick={() => setAlta(false)}>
                    Cancelar
                  </button>
                  <button className="boton-primario" type="submit" disabled={guardando}>
                    {guardando ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </form>
            ) : (
              <button className="boton boton-ancho boton-secundario" type="button" onClick={() => setAlta(true)}>
                {polizas.length ? 'Agregar otra póliza' : 'Cargar los datos a mano'}
              </button>
            )}

            {seleccionada ? <Adjuntos tipo="poliza" polizaId={seleccionada} archivos={archivosDe('poliza')} alCambiar={cargar} alFallar={setError} /> : <p className="mini">Cargá primero los datos de la póliza para asociar sus fotos.</p>}
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
            <p className="mini">Corresponde al vehículo seleccionado arriba. Editá su patente y modelo desde la póliza.</p>
            {doc.cedula ? <details><summary>Datos históricos de cédula, sin vehículo asignado</summary><p className="mini">{Object.values(doc.cedula).filter(Boolean).join(' · ')}</p></details> : null}
            {seleccionada ? <Adjuntos tipo="cedula" polizaId={seleccionada} archivos={archivosDe('cedula')} alCambiar={cargar} alFallar={setError} /> : <p className="mini">Cargá primero una póliza para identificar el vehículo.</p>}
          </section>
          <section className="tarjeta">
            <h2 className="titulo-tarjeta">DNI</h2>
            <p className="mini">Sumá frente y dorso legibles. Es personal y sirve para cualquiera de tus vehículos.</p>
            <Adjuntos tipo="dni" archivos={archivosDe('dni')} alCambiar={cargar} alFallar={setError} />
          </section>
          {sinAsignar.length ? <section className="tarjeta">
            <h2 className="titulo-tarjeta">Archivos anteriores sin asignar</h2>
            <p className="mini">Revisá cada archivo y asignalo al vehículo seleccionado. No se elige por vos.</p>
            {sinAsignar.map((a) => <div className="documentacion-poliza" key={a.id}>
              <a className="enlace" href={`/api/documentacion/archivos/${a.id}`} target="_blank" rel="noreferrer">{a.nombre || a.tipo}</a>
              <button className="boton boton-secundario" type="button" disabled={!seleccionada} onClick={() => void asignar(a.id)}>Asignar al vehículo seleccionado</button>
            </div>)}
          </section> : null}
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
  polizaId,
  archivos,
  alCambiar,
  alFallar,
}: {
  tipo: TipoBloque
  polizaId?: string
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
        if (polizaId) cuerpo.append('poliza_id', polizaId)
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

async function guardarJson(url: string, method: string, datos: unknown) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos) })
  const c = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(c.error || 'Revisá los campos y volvé a guardar.')
}

function Contactos({ poliza }: { poliza: Poliza }) {
  const c = poliza.contactos ?? {} as ContactosPoliza
  const email = c.productor_email || poliza.productor?.email
  const telefono = c.productor_telefono || poliza.productor?.telefono
  return <div className="adjuntos">
    <h3 className="rotulo">Contactos</h3>
    <p className="mini">Productor: {c.productor_nombre || poliza.productor?.nombre || 'Sin nombre cargado'}</p>
    <div className="fila-botones">
      {telefono ? <a className="boton boton-secundario" href={`tel:${telefono.replace(/[^+\d]/g, '')}`}>Llamar al productor</a> : null}
      {email ? <a className="enlace" href={`mailto:${email}`}>Escribir al productor</a> : null}
    </div>
    <p className="mini">Aseguradora: {poliza.aseguradora}</p>
    <div className="fila-botones">
      {c.aseguradora_telefono ? <a className="boton boton-secundario" href={`tel:${c.aseguradora_telefono.replace(/[^+\d]/g, '')}`}>Llamar a la aseguradora</a> : null}
      {c.aseguradora_email ? <a className="enlace" href={`mailto:${c.aseguradora_email}`}>Escribir a la aseguradora</a> : null}
    </div>
    {!telefono && !email && !c.aseguradora_telefono && !c.aseguradora_email ? <p className="mini apagado">Cargá los contactos desde Editar datos de la póliza.</p> : null}
  </div>
}

function EditorPoliza({ poliza, alCambiar, alFallar }: { poliza: Poliza; alCambiar: () => void; alFallar: (m: string | null) => void }) {
  const [editando, setEditando] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const iniciales = () => Object.fromEntries(CAMPOS_POLIZA.map((c) => [c.clave, String(({ ...poliza, ...poliza.contactos } as Record<string, unknown>)[c.clave] ?? '')]))
  const [valores, setValores] = useState<Record<string, string>>(iniciales)
  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    alFallar(null)
    setGuardando(true)
    try {
      await guardarJson(`/api/polizas/${poliza.id}`, 'PATCH', valores)
      setEditando(false)
      alCambiar()
    } catch (err) {
      alFallar(mensajeDe(err, 'Revisá los datos de la póliza y volvé a guardar.'))
    } finally {
      setGuardando(false)
    }
  }
  async function principal() {
    setGuardando(true)
    alFallar(null)
    try {
      await guardarJson(`/api/polizas/${poliza.id}`, 'PATCH', { principal: true })
      alCambiar()
    } catch (err) {
      alFallar(mensajeDe(err, 'Volvé a elegir la póliza principal.'))
    } finally {
      setGuardando(false)
    }
  }
  return <div className="adjuntos">
    {editando ? <form onSubmit={guardar}>
      <p className="mini">Los cambios son una declaración manual tuya. No modifican el contrato de seguro ni los expedientes ya sellados.</p>
      {CAMPOS_POLIZA.map((c) => <div className="campo" key={c.clave}>
        <label htmlFor={`editar-${c.clave}`}>{c.etiqueta}</label>
        <input id={`editar-${c.clave}`} type={c.fecha ? 'date' : 'text'} required={c.clave === 'numero' || c.clave === 'aseguradora'} value={valores[c.clave]} onChange={(e) => setValores({ ...valores, [c.clave]: e.target.value })} />
      </div>)}
      <div className="fila-botones">
        <button className="boton boton-secundario" type="button" disabled={guardando} onClick={() => setEditando(false)}>Cancelar</button>
        <button className="boton-primario" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar cambios'}</button>
      </div>
    </form> : <div className="fila-botones">
      <button className="boton boton-secundario" type="button" onClick={() => { setValores(iniciales()); setEditando(true) }}>Editar datos de la póliza</button>
      {!poliza.principal ? <button className="boton boton-secundario" type="button" disabled={guardando} onClick={() => void principal()}>Usar como principal</button> : null}
    </div>}
  </div>
}

function HistorialPoliza({ id, alFallar }: { id: string; alFallar: (m: string | null) => void }) {
  const [cambios, setCambios] = useState<{ id: string; origen: string; creado_en: string; anterior: Record<string, unknown>; actual: Record<string, unknown> }[] | null>(null)
  const [cargando, setCargando] = useState(false)
  async function cargar() {
    setCargando(true)
    try {
      const r = await fetch(`/api/polizas/${id}`)
      const c = await r.json()
      if (!r.ok) throw new Error(c.error)
      setCambios(c)
    } catch (err) {
      alFallar(mensajeDe(err, 'Volvé a abrir el historial de cambios.'))
    } finally {
      setCargando(false)
    }
  }
  const mostrar = (valor: unknown): string => valor === null || valor === undefined || valor === '' ? 'Sin informar' : typeof valor === 'object' ? Object.entries(valor).map(([k, v]) => `${k.replaceAll('_', ' ')}: ${mostrar(v)}`).join(' · ') : String(valor)
  return <div className="adjuntos">
    <h3 className="rotulo">Historial de cambios</h3>
    <button className="boton boton-secundario" type="button" disabled={cargando} onClick={() => void cargar()}>{cargando ? 'Leyendo…' : cambios ? 'Actualizar historial' : 'Ver historial'}</button>
    {cambios?.length === 0 ? <p className="mini">No hay cambios registrados desde que se habilitó este historial.</p> : null}
    {cambios?.map((c) => <details className="documentacion-poliza" key={c.id}>
      <summary>{new Date(c.creado_en).toLocaleString('es-AR')} · {c.origen}</summary>
      {Object.entries(c.actual).filter(([clave, valor]) => JSON.stringify(valor) !== JSON.stringify(c.anterior[clave])).map(([clave, valor]) => <p className="mini" key={clave}>
        <strong>{CAMPOS_POLIZA.find((f) => f.clave === clave)?.etiqueta || clave.replaceAll('_', ' ')}:</strong> {mostrar(c.anterior[clave])} → {mostrar(valor)}
      </p>)}
    </details>)}
  </div>
}
