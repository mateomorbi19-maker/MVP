'use client'

import { useEffect, useState } from 'react'
import type { Testigo } from '@/app/s/[id]/tipos'

export type ContactoAnotado = { nombre?: string; telefono: string; origen: 'asegurado' }

export function ContactosTestigos({ casoId, contactos, alCambiar, testigos, alRecibir }: {
  casoId: string
  contactos: ContactoAnotado[]
  alCambiar: (contactos: ContactoAnotado[]) => void
  testigos: Testigo[]
  alRecibir: (testigos: Testigo[]) => void
}) {
  const [nombre, setNombre] = useState('')
  const [telefono, setTelefono] = useState('')
  const [error, setError] = useState('')
  const [falloQr, setFalloQr] = useState(false)
  useEffect(() => {
    const actualizar = async () => {
      try {
        const res = await fetch(`/api/casos/${casoId}`)
        if (!res.ok) return
        const cuerpo = await res.json()
        if (Array.isArray(cuerpo.testigos)) alRecibir(cuerpo.testigos)
      } catch { /* Los contactos manuales siguen disponibles sin conexión. */ }
    }
    void actualizar()
    const reloj = setInterval(actualizar, 5000)
    return () => clearInterval(reloj)
  }, [casoId, alRecibir])
  function agregar() {
    if (telefono.replace(/\D/g, '').length < 6) {
      setError('Escribí un teléfono con al menos 6 dígitos, incluyendo la característica.')
      return
    }
    if (contactos.length >= 20) {
      setError('Podés anotar hasta 20 contactos. Revisá si ya está en la lista.')
      return
    }
    if (contactos.some((c) => c.telefono.replace(/\D/g, '') === telefono.replace(/\D/g, ''))) {
      setError('Ese teléfono ya está anotado.')
      return
    }
    alCambiar([...contactos, { nombre: nombre.trim(), telefono: telefono.trim(), origen: 'asegurado' }])
    setNombre('')
    setTelefono('')
    setError('')
  }
  return (
    <div className="tarjeta pila">
      <h2>Contactar a los testigos</h2>
      <p className="pregunta-ayuda">El testigo puede escanear el QR y dejar sus datos desde su teléfono. También podés anotar uno o varios contactos acá.</p>
      <div className="qr centrado">
        {falloQr ? <p>Recuperá la conexión para mostrar el QR.</p> : <img className="qr-imagen" src={`/api/casos/${casoId}/qr`} alt="QR para que el testigo deje sus datos" onError={() => setFalloQr(true)} />}
      </div>
      <a className="boton-secundario" href={`/t/${casoId}`} target="_blank" rel="noreferrer">Abrir enlace para testigos</a>
      <div className="campo"><label htmlFor="nombre-testigo">Nombre (opcional)</label><input id="nombre-testigo" value={nombre} maxLength={120} onChange={(e) => setNombre(e.target.value)} /></div>
      <div className="campo"><label htmlFor="telefono-testigo">Teléfono</label><input id="telefono-testigo" type="tel" inputMode="tel" value={telefono} maxLength={40} onChange={(e) => setTelefono(e.target.value)} /></div>
      <button className="boton-secundario" onClick={agregar}>Agregar contacto</button>
      {error ? <p className="aviso" data-nivel="atencion">{error}</p> : null}
      {contactos.length > 0 ? <div className="pila">
        <h3>Anotados por vos</h3>
        {contactos.map((c, i) => <div className="fila" key={`${c.telefono}-${i}`}>
          <span>{c.nombre ? `${c.nombre} · ` : ''}{c.telefono}</span>
          <button className="omitir" onClick={() => alCambiar(contactos.filter((_, n) => n !== i))} aria-label={`Quitar contacto ${c.telefono}`}>Quitar</button>
        </div>)}
        <p className="mini">Estos contactos no son declaraciones del testigo.</p>
      </div> : null}
      {testigos.length > 0 ? <div className="pila"><h3>Dejaron sus datos personalmente</h3>{testigos.map((t) => <p key={t.id}>{t.nombre}</p>)}</div> : null}
    </div>
  )
}
