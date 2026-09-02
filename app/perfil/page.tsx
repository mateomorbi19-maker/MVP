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
  const [enviando, setEnviando] = useState(false)

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
    setEnviando(true)
    setAviso(null)
    try {
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
    } catch {
      /*
       * Sin red el fetch rechaza. Sin este catch, tocar Guardar no cambiaba nada en
       * pantalla y la persona volvia a tocar. El mensaje no culpa a la señal: el fetch
       * rechaza igual cuando el que no contesta es el servidor.
       */
      setAviso({
        nivel: 'alerta',
        texto:
          'No se pudo llegar al servidor. Revisá la conexión y volvé a tocar Guardar: lo que escribiste sigue en pantalla.',
      })
    } finally {
      /*
       * El finally va acá y no en el catch —como en /entrar y /registro— porque esas dos
       * sacan el formulario de pantalla al terminar bien y ésta se queda: si sólo se apagara
       * en el error, el botón quedaría deshabilitado para siempre despues de un guardado
       * exitoso.
       */
      setEnviando(false)
    }
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
          {/* El aviso va antes de los campos y no al final de la tarjeta, que es donde uno lo
              pondría por instinto. Con el teclado abierto sus 135px empujaban el botón Guardar
              fuera del viewport justo cuando la persona termina de escribir la relación. Y dice
              qué hace y qué no hace el sistema con un teléfono ajeno: eso se lee antes de
              pedirlo, no después de haberlo cargado. */}
          <div className="aviso" data-nivel="info">
            La aplicación <strong>no llama ni manda mensajes por su cuenta</strong>: no hay forma de hacerlo desde el
            navegador. Lo que hace es abrirte el marcador con el número puesto, para que toques una sola vez.
          </div>
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
        </div>

        {aviso ? <div className="aviso" data-nivel={aviso.nivel}>{aviso.texto}</div> : null}

        <button className="boton-primario boton-ancho" type="submit" disabled={enviando}>
          {enviando ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
      )}

      {/* El botón azul a ancho completo pegado al borde de arriba de la tarjeta se lee como su
          encabezado, y el pulgar cae sobre «Encender el modo viaje» en vez de sobre Guardar.
          Misma separación que /cuenta entre los accesos y las acciones de sesión. */}
      <div className="separacion-bloque" />
      <DetectorImpacto />

      <p className="centrado">
        <Link href="/cuenta" className="boton boton-fantasma">
          Volver a mi cuenta
        </Link>
      </p>
    </main>
  )
}
