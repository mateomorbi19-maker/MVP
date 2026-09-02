'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'

/**
 * Apertura del expediente desde el correo.
 *
 * El token viene en el FRAGMENTO de la URL, después del #, y se consume con un POST que
 * dispara un clic. Los escáneres de enlaces corporativos visitan todos los enlaces de un
 * correo antes de que lo abra nadie: el fragmento no viaja al servidor, así que ninguno
 * puede quemar un token de un solo uso.
 */
export default function AbrirEntrega({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [token, setToken] = useState<string | null>(null)
  const [caso, setCaso] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [abriendo, setAbriendo] = useState(false)

  useEffect(() => {
    setToken(window.location.hash.replace(/^#/, '') || null)
  }, [])

  async function abrir() {
    setAbriendo(true)
    setError(null)
    try {
      const res = await fetch('/api/entregas/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envio: id, token }),
      })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo abrir el expediente.')
      setCaso(cuerpo.caso_id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setAbriendo(false)
    }
  }

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">{caso ? 'Ya podés ver el expediente' : 'Te entregaron un expediente'}</h1>
        <p className="bajada-pagina">
          {caso
            ? 'Quedó asociado a este navegador. Podés volver a abrirlo desde acá.'
            : 'Tocá el botón para abrirlo. El enlace sirve una sola vez: desde ahí queda asociado a este navegador.'}
        </p>
      </header>

      {caso ? (
        <div className="tarjeta">
          <div className="numero-actuacion">{caso}</div>
          <div className="pila">
            <a className="boton boton-primario" href={`/api/casos/${caso}/pdf?descargar=1`}>
              Descargar el expediente
            </a>
            <Link className="boton boton-secundario" href={`/panel/${caso}`}>
              Ver el detalle
            </Link>
          </div>
        </div>
      ) : (
        <div className="tarjeta">
          {!token ? (
            <div className="aviso" data-nivel="alerta">
              Al enlace le falta la parte final. Copialo entero desde el correo, incluyendo todo lo que va después del
              signo numeral.
            </div>
          ) : null}
          {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}
          <button className="boton-primario boton-ancho" onClick={abrir} disabled={!token || abriendo}>
            {abriendo ? 'Abriendo...' : 'Abrir el expediente'}
          </button>
        </div>
      )}
    </main>
  )
}
