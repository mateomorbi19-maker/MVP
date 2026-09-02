'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Marca } from '@/app/components/Marca'

/**
 * Ingreso.
 *
 * NO es la primera pantalla de la aplicación, y eso es deliberado: el botón «Tuve un
 * accidente» sigue sin pedir nada. Acá se entra para ver la póliza, el historial y
 * mandarle el acta al productor. Un formulario entre la persona y la evidencia perecedera
 * es exactamente lo que hace que alguien con adrenalina abandone.
 */
function Formulario() {
  const router = useRouter()
  const volver = useSearchParams().get('volver') || '/cuenta'
  const [dni, setDni] = useState('')
  const [clave, setClave] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/sesion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dni, clave }),
      })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo iniciar sesión.')
      router.push(volver)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setEnviando(false)
    }
  }

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Entrá a tu cuenta</h1>
        <p className="bajada-pagina">
          Para ver tu póliza, tu historial de actuaciones y mandarle el acta a tu productor. Registrar un siniestro no
          necesita cuenta.
        </p>
      </header>

      <form className="tarjeta" onSubmit={entrar}>
        <div className="campo">
          <label htmlFor="dni">DNI</label>
          <input
            id="dni"
            type="text"
            inputMode="numeric"
            autoComplete="username"
            value={dni}
            onChange={(e) => setDni(e.target.value)}
          />
        </div>
        <div className="campo">
          <label htmlFor="clave">Contraseña</label>
          <input
            id="clave"
            type="password"
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
          />
        </div>

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}

        <button className="boton-primario" type="submit" disabled={enviando}>
          {enviando ? 'Entrando...' : 'Ingresar'}
        </button>
      </form>

      <p className="mini centrado">
        ¿No tenés cuenta? <Link href="/registro" className="enlace">Registrate</Link>
      </p>
      <p className="mini centrado">
        Si olvidaste la contraseña, pedile a tu aseguradora que te la reinicie: por ahora no hay recuperación
        automática, porque el DNI es un dato público y un reinicio pedido sólo con el DNI sería una puerta abierta.
      </p>
      <p className="mini centrado">
        <Link href="/" className="enlace">Volver al inicio</Link>
      </p>
    </main>
  )
}

export default function Entrar() {
  return (
    <Suspense fallback={null}>
      <Formulario />
    </Suspense>
  )
}
