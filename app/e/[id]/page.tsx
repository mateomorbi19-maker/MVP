'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'

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
  // undefined = el fragmento todavía no se leyó; null = el enlace llegó sin él. Sin esa
  // distinción, el primer render —antes de que corra el efecto— es idéntico al del enlace
  // recortado, y la pantalla acusa un enlace incompleto que puede estar entero.
  const [token, setToken] = useState<string | null | undefined>(undefined)
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
      // Un fetch que no llega rechaza con TypeError('Failed to fetch'). Ese texto lo escribe el
      // navegador, viene en inglés y no dice si falló el enlace, la señal o el sistema: se ataja
      // acá para que el catch no lo muestre tal cual, que es la falla más probable en la calle.
      const res = await fetch('/api/entregas/abrir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ envio: id, token }),
      }).catch(() => null)
      if (!res) throw new Error('No se pudo contactar al servidor. Revisá la conexión y volvé a tocar el botón.')
      // Un proxy caído contesta HTML: sin este catch, res.json() rechaza con un SyntaxError,
      // también en inglés.
      const cuerpo = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(
          cuerpo?.error ?? 'No se pudo abrir el expediente. Pedile a quien te lo mandó que te lo vuelva a enviar.',
        )
      }
      // Un 200 sin cuerpo dejaría caso en undefined y la pantalla se quedaría en blanco sin decir
      // nada, que es peor que un mensaje.
      if (!cuerpo?.caso_id) {
        throw new Error('El servidor contestó algo que no entendemos. Volvé a tocar el botón en unos segundos.')
      }
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
            : 'El enlace sirve una sola vez: desde que lo abrís queda asociado a este navegador.'}
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
      ) : token === null ? (
        <div className="vacio">
          <span className="vacio-icono">
            <Icono nombre="archivo" />
          </span>
          <h2 className="vacio-titulo">Al enlace le falta la parte final</h2>
          <p className="vacio-texto">
            Lo que va después del signo numeral (#) es lo que abre el expediente, y no llegó. Copiá el enlace entero
            desde el correo, o pedile a quien te lo mandó que te lo vuelva a enviar.
          </p>
        </div>
      ) : (
        <div className="tarjeta">
          {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}
          <button className="boton-primario boton-ancho" onClick={abrir} disabled={!token || abriendo}>
            {abriendo ? 'Abriendo...' : 'Abrir el expediente'}
          </button>
        </div>
      )}
    </main>
  )
}
