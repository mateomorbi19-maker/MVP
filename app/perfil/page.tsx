'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'
import { DetectorImpacto } from '@/app/components/DetectorImpacto'
import { SinSesion } from '@/app/components/SinSesion'

type Contacto = { nombre: string; telefono: string; relacion: string | null }

/**
 * Perfil y contacto de confianza.
 *
 * El contacto es un dato personal de alguien que no está presente para consentirlo, así
 * que la pantalla se lo dice a quien lo carga. Y dice la verdad sobre qué hace el sistema:
 * una aplicación web no puede llamar ni mandar un SMS sola.
 */
export default function Perfil() {
  const [titular, setTitular] = useState({ nombre: '', telefono: '', email: '' })
  const [contacto, setContacto] = useState<Contacto>({ nombre: '', telefono: '', relacion: '' })
  const [aviso, setAviso] = useState<{ nivel: 'ok' | 'alerta'; texto: string } | null>(null)
  const [sinSesion, setSinSesion] = useState(false)

  useEffect(() => {
    fetch('/api/perfil')
      .then(async (r) => {
        /*
         * Antes esto era `.then((r) => r.json())` sin mirar el estado, y con eso un 401
         * dibujaba el formulario vacío como si funcionara: la persona escribía sus datos y
         * el fallo recién aparecía al guardar.
         */
        if (r.status === 401) {
          setSinSesion(true)
          return
        }
        const c = await r.json()
        if (!r.ok) throw new Error(c?.error ?? 'No se pudo leer el perfil.')
        setTitular({
          nombre: c?.usuario?.nombre ?? '',
          telefono: c?.usuario?.telefono ?? '',
          email: c?.usuario?.email ?? '',
        })
        if (c?.contacto) setContacto({ ...c.contacto, relacion: c.contacto.relacion ?? '' })
      })
      .catch((e) => setAviso({ nivel: 'alerta', texto: e instanceof Error ? e.message : 'No se pudo leer el perfil.' }))
  }, [])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/perfil', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ titular, contacto }),
    })
    const c = await res.json().catch(() => ({}))
    setAviso(
      res.ok
        ? { nivel: 'ok', texto: 'Guardado.' }
        : { nivel: 'alerta', texto: c?.error ?? 'No se pudo guardar.' },
    )
  }

  /*
   * Al primer toque de una tecla se borra el «Guardado.».
   *
   * Si se queda puesto, dice que está guardado mientras la persona edita algo que todavía
   * no mandó, que es exactamente al revés.
   */
  const alEditar = () => setAviso((a) => (a?.nivel === 'ok' ? null : a))

  const campoTitular = (clave: keyof typeof titular) => ({
    value: titular[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      alEditar()
      setTitular({ ...titular, [clave]: e.target.value })
    },
  })
  const campoContacto = (clave: keyof Contacto) => ({
    value: contacto[clave] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      alEditar()
      setContacto({ ...contacto, [clave]: e.target.value })
    },
  })

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Mis datos</h1>
        <p className="bajada-pagina">
          Se usan para completar la carátula de una actuación nueva sin que tengas que escribirlos en el lugar.
        </p>
      </header>

      {sinSesion ? <SinSesion volver="/perfil" que="tus datos" /> : null}

      {sinSesion ? null : (
      <form onSubmit={guardar}>
        <div className="tarjeta">
          <h3>Titular</h3>
          <div className="campo">
            <label htmlFor="nombre">Nombre y apellido</label>
            <input id="nombre" type="text" autoComplete="name" {...campoTitular('nombre')} />
          </div>
          <div className="campo">
            <label htmlFor="telefono">Teléfono</label>
            <input id="telefono" type="tel" autoComplete="tel" {...campoTitular('telefono')} />
          </div>
          <div className="campo">
            <label htmlFor="email">Email</label>
            <input id="email" type="email" autoComplete="email" {...campoTitular('email')} />
          </div>
        </div>

        <div className="tarjeta">
          <h3>Contacto de confianza</h3>
          <p className="apagado mini">
            A quién avisarle si el teléfono detecta un impacto y no respondés. Avisale a esa persona que la cargaste:
            son sus datos, no los tuyos.
          </p>
          <div className="campo">
            <label htmlFor="c_nombre">Nombre</label>
            <input id="c_nombre" type="text" {...campoContacto('nombre')} />
          </div>
          <div className="campo">
            <label htmlFor="c_telefono">Teléfono</label>
            <input id="c_telefono" type="tel" {...campoContacto('telefono')} />
          </div>
          <div className="campo">
            <label htmlFor="c_relacion">Relación</label>
            <input id="c_relacion" type="text" placeholder="Pareja, hermano, un amigo..." {...campoContacto('relacion')} />
          </div>
          <div className="aviso" data-nivel="info">
            La aplicación <strong>no llama ni manda mensajes por su cuenta</strong>: no hay forma de hacerlo desde el
            navegador. Lo que hace es abrirte el marcador con el número puesto, para que toques una sola vez.
          </div>
        </div>

        {aviso ? <div className="aviso" data-nivel={aviso.nivel}>{aviso.texto}</div> : null}

        <button className="boton-primario boton-ancho" type="submit">
          Guardar
        </button>
      </form>
      )}

      <DetectorImpacto />

      <p className="mini centrado">
        <Link href="/cuenta" className="enlace">Volver a mi cuenta</Link>
      </p>
    </main>
  )
}
