'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Cambio de contraseña. Exige la actual: una sesión robada no alcanza. */
export function CambiarClave() {
  const [abierto, setAbierto] = useState(false)
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [aviso, setAviso] = useState<{ nivel: 'ok' | 'alerta'; texto: string } | null>(null)
  const router = useRouter()

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setAviso(null)
    const res = await fetch('/api/usuarios/clave', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual, nueva }),
    })
    const cuerpo = await res.json()
    if (!res.ok) {
      setAviso({ nivel: 'alerta', texto: cuerpo?.error ?? 'No se pudo cambiar la contraseña.' })
      return
    }
    setAviso({ nivel: 'ok', texto: 'Listo. Se cerraron las demás sesiones; volvé a entrar.' })
    setTimeout(() => router.push('/entrar'), 1500)
  }

  if (!abierto) {
    return (
      <button className="boton boton-secundario" onClick={() => setAbierto(true)}>
        Cambiar la contraseña
      </button>
    )
  }

  return (
    <form className="tarjeta" onSubmit={guardar}>
      <h3>Cambiar la contraseña</h3>
      <div className="campo">
        <label htmlFor="actual">Contraseña actual</label>
        <input
          id="actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(e) => setActual(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="nueva">Contraseña nueva</label>
        <input
          id="nueva"
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
        />
      </div>
      {aviso ? <div className="aviso" data-nivel={aviso.nivel}>{aviso.texto}</div> : null}
      <button className="boton-primario" type="submit">
        Guardar
      </button>
    </form>
  )
}

export function CerrarSesion() {
  const router = useRouter()
  return (
    <button
      className="boton boton-secundario"
      onClick={async () => {
        await fetch('/api/sesion', { method: 'DELETE' })
        router.push('/')
        router.refresh()
      }}
    >
      Cerrar sesión
    </button>
  )
}
