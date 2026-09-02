'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Marca } from '@/app/components/Marca'

/** Alta de cuenta de asegurado. Los productores los da de alta la aseguradora. */
export default function Registro() {
  const router = useRouter()
  const [datos, setDatos] = useState({ dni: '', nombre: '', telefono: '', email: '', clave: '' })
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

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
      router.push('/entrar')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setEnviando(false)
    }
  }

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Crear una cuenta</h1>
        <p className="bajada-pagina">
          La cuenta sirve para ver tu póliza, el historial de tus actuaciones y mandarle el acta a tu productor. Para
          registrar un siniestro no hace falta: ese botón nunca te va a pedir nada.
        </p>
      </header>

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

      <p className="centrado">
        <Link href="/entrar" className="boton boton-secundario">Ya tengo cuenta</Link>
      </p>
    </main>
  )
}
