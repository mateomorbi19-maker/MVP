'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Marca } from '@/app/components/Marca'
import { Icono } from '@/app/components/Iconos'

/** Alta de cuenta de asegurado. Los productores los da de alta la aseguradora. */
export default function Registro() {
  const [datos, setDatos] = useState({ dni: '', nombre: '', telefono: '', email: '', clave: '' })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  /*
   * El alta terminaba en router.push('/entrar'), que deja a la persona en un formulario
   * vacío igualito al que acaba de completar: mismo encabezado, misma tarjeta, DNI y
   * contraseña en blanco otra vez. Nada decía que la cuenta existía, así que la lectura
   * natural era «falló y volví al principio» y el reintento se comía un cartel rojo de DNI
   * duplicado provocado por la cuenta propia recién creada. Se confirma acá, y el paso
   * siguiente se toca, no se adivina.
   */
  const [creada, setCreada] = useState(false)

  const campo = (clave: keyof typeof datos) => ({
    value: datos[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, [clave]: e.target.value }),
  })

  async function registrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo crear la cuenta.')
      setCreada(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setEnviando(false)
    }
  }

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">{creada ? 'Tu cuenta quedó creada' : 'Crear una cuenta'}</h1>
        <p className="bajada-pagina">
          La cuenta sirve para ver tu póliza, el historial de tus actuaciones y mandarle el acta a tu productor. Para
          registrar un siniestro no hace falta: ese botón nunca te va a pedir nada.
        </p>
      </header>

      {creada ? (
        <div className="vacio">
          <span className="vacio-icono">
            <Icono nombre="tilde" />
          </span>
          <h2 className="vacio-titulo">Ya podés entrar</h2>
          <p className="vacio-texto">
            Entrá con el DNI {datos.dni} y la contraseña que elegiste. Es la misma cuenta desde cualquier teléfono.
          </p>
          <Link className="boton boton-primario" href="/entrar">
            Iniciar sesión
          </Link>
        </div>
      ) : (
      <form className="tarjeta" onSubmit={registrar}>
        <div className="campo">
          <label htmlFor="dni">DNI</label>
          <input id="dni" type="text" inputMode="numeric" autoComplete="username" {...campo('dni')} />
        </div>
        <div className="campo">
          <label htmlFor="nombre">Nombre y apellido</label>
          <input id="nombre" type="text" autoComplete="name" {...campo('nombre')} />
        </div>
        <div className="campo">
          <label htmlFor="telefono">Teléfono</label>
          <input id="telefono" type="tel" autoComplete="tel" {...campo('telefono')} />
        </div>
        <div className="campo">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" autoComplete="email" {...campo('email')} />
        </div>
        <div className="campo">
          <label htmlFor="clave">Contraseña</label>
          <input id="clave" type="password" autoComplete="new-password" {...campo('clave')} />
          <small className="apagado">Al menos 8 caracteres, y que no sea sólo números ni contenga tu DNI.</small>
        </div>

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

        <button className="boton-primario" type="submit" disabled={enviando}>
          {enviando ? 'Creando...' : 'Crear la cuenta'}
        </button>
      </form>
      )}

      {creada ? null : (
        <p className="centrado">
          <Link href="/entrar" className="boton boton-secundario">Ya tengo cuenta</Link>
        </p>
      )}
    </main>
  )
}
