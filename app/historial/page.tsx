'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'
import { SinSesion } from '@/app/components/SinSesion'

type Fila = {
  id: string
  creado_en: string
  cerrado_en: string | null
  estado: string
  patente: string | null
  direccion: string | null
  hash_maestro: string | null
}

const fecha = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }) : '-'

/** Las actuaciones de la persona, con su estado. */
export default function Historial() {
  const [filas, setFilas] = useState<Fila[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [sinSesion, setSinSesion] = useState(false)

  useEffect(() => {
    fetch('/api/historial')
      .then(async (r) => {
        // Que falte la sesión no es una falla del sistema: es un estado con su propia salida.
        if (r.status === 401) {
          setSinSesion(true)
          return
        }
        const c = await r.json()
        if (!r.ok) throw new Error(c?.error ?? 'No se pudo leer el historial.')
        setFilas(c)
      })
      // Un fallo de red llega como TypeError y su mensaje viene del navegador, en inglés:
      // «Failed to fetch» no le dice a nadie que lo que falta es señal.
      .catch((e) =>
        setError(
          e instanceof TypeError
            ? 'No se pudo conectar con el servidor. Revisá que tengas señal o wifi y volvé a cargar la pantalla.'
            : e instanceof Error
              ? e.message
              : 'No se pudo leer el historial. Volvé a cargar la pantalla en un minuto.',
        ),
      )
  }, [])

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Mis actuaciones</h1>
        <p className="bajada-pagina">
          Los siniestros que registraste. Una vez sellada, la actuación se puede descargar y verificar, pero ya no se
          modifica.
        </p>
      </header>

      {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

      {sinSesion ? <SinSesion volver="/historial" que="tus actuaciones" /> : null}

      {filas && filas.length === 0 ? (
        <div className="vacio">
          <span className="vacio-icono">
            <Icono nombre="tilde" />
          </span>
          <h2 className="vacio-titulo">Todavía no registraste ningún siniestro</h2>
          <p className="vacio-texto">Ojalá siga así.</p>
          <Link href="/" className="boton boton-secundario">
            Volver al inicio
          </Link>
        </div>
      ) : null}

      {(filas ?? []).map((f) => (
        <div className="tarjeta" key={f.id}>
          <div className="numero-actuacion">{f.id}</div>
          {/*
            La insignia encabeza la línea de datos en vez de ser un renglón suelto: .numero-actuacion
            es de bloque, y metida adentro heredaría la monoespaciada y el corte de palabra del número.
          */}
          <p className="mini">
            <span className="insignia" data-nivel={f.estado === 'cerrado' ? 'ok' : 'neutra'}>
              {f.estado === 'cerrado' ? 'Sellada' : 'En curso'}
            </span>{' '}
            {fecha(f.creado_en)}
            {f.direccion ? ` · ${f.direccion.split(',').slice(0, 2).join(', ')}` : ''}
            {f.patente ? ` · ${f.patente}` : ''}
          </p>
          <div className="pila">
            {f.estado === 'cerrado' ? (
              <>
                <a className="boton boton-primario" href={`/api/casos/${f.id}/pdf?descargar=1`}>
                  Descargar el expediente
                </a>
                <Link className="boton boton-secundario" href={`/verificar?id=${f.id}`}>
                  Verificar su integridad
                </Link>
              </>
            ) : (
              <Link className="boton boton-primario" href={`/s/${f.id}`}>
                Seguir completándola
              </Link>
            )}
          </div>
        </div>
      ))}

      {/*
        Sin sesión el pie sobra: /cuenta rebota a /entrar?volver=/cuenta y la persona pierde
        que lo que quería ver eran sus actuaciones.
      */}
      {sinSesion ? null : (
        <p className="mini centrado pie-sesion">
          <Link href="/cuenta" className="enlace">Volver a mi cuenta</Link>
        </p>
      )}
    </main>
  )
}
