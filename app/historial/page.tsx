'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'

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

  useEffect(() => {
    fetch('/api/historial')
      .then(async (r) => {
        const c = await r.json()
        if (!r.ok) throw new Error(c?.error ?? 'No se pudo leer el historial.')
        setFilas(c)
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error inesperado.'))
  }, [])

  return (
    <main className="envoltura">
      <Marca sub="Mis actuaciones" />

      {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

      {filas && filas.length === 0 ? (
        <div className="tarjeta centrado">
          <h3>Todavía no registraste ningún siniestro</h3>
          <p className="apagado">Ojalá siga así.</p>
          <Link href="/" className="boton boton-secundario">
            Volver al inicio
          </Link>
        </div>
      ) : null}

      {(filas ?? []).map((f) => (
        <div className="tarjeta" key={f.id}>
          <div className="numero-actuacion">{f.id}</div>
          <span className="insignia" data-nivel={f.estado === 'cerrado' ? 'ok' : 'neutra'}>
            {f.estado === 'cerrado' ? 'Sellada' : 'En curso'}
          </span>
          <p className="mini">
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

      <p className="mini centrado">
        <Link href="/cuenta" className="enlace">Volver a mi cuenta</Link>
      </p>
    </main>
  )
}
