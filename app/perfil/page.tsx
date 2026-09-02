'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'

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

  useEffect(() => {
    fetch('/api/perfil')
      .then((r) => r.json())
      .then((c) => {
        setTitular({
          nombre: c?.usuario?.nombre ?? '',
          telefono: c?.usuario?.telefono ?? '',
          email: c?.usuario?.email ?? '',
        })
        if (c?.contacto) setContacto({ ...c.contacto, relacion: c.contacto.relacion ?? '' })
      })
      .catch(() => setAviso({ nivel: 'alerta', texto: 'No se pudo leer el perfil.' }))
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

  const campoTitular = (clave: keyof typeof titular) => ({
    value: titular[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setTitular({ ...titular, [clave]: e.target.value }),
  })
  const campoContacto = (clave: keyof Contacto) => ({
    value: contacto[clave] ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setContacto({ ...contacto, [clave]: e.target.value }),
  })

  return (
    <main className="envoltura">
      <Marca sub="Mis datos" />

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

        <button className="boton-primario" type="submit">
          Guardar
        </button>
      </form>

      <p className="mini centrado">
        <Link href="/cuenta" className="enlace">Volver a mi cuenta</Link>
      </p>
    </main>
  )
}
