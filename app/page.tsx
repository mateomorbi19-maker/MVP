'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Marca } from './components/Marca'

export default function Inicio() {
  const router = useRouter()
  const [datos, setDatos] = useState({ poliza: '', patente: '', asegurado: '', telefono: '' })
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [salud, setSalud] = useState<{ ok: boolean; detalle: string } | null>(null)

  // Avisa del problema antes de que la persona cargue los datos, no después.
  useEffect(() => {
    fetch('/api/salud')
      .then((r) => r.json())
      .then((c) => setSalud({ ok: Boolean(c?.ok), detalle: c?.base?.detalle ?? 'Sin detalle.' }))
      .catch(() => setSalud({ ok: false, detalle: 'No se pudo contactar al servidor.' }))
  }, [])

  async function iniciar() {
    setEnviando(true)
    setError(null)
    try {
      const res = await fetch('/api/casos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(datos),
      })
      const cuerpo = await res.json()
      if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo iniciar la actuación.')
      router.push(`/s/${cuerpo.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setEnviando(false)
    }
  }

  const campo = (clave: keyof typeof datos) => ({
    value: datos[clave],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setDatos({ ...datos, [clave]: e.target.value }),
  })

  return (
    <main className="envoltura">
      <Marca enlace={false} sub="Registro probatorio de siniestros viales" />

      {salud && !salud.ok ? (
        <div className="aviso aviso-alerta">
          <strong>El sistema no está operativo.</strong>
          <div style={{ marginTop: 6 }}>{salud.detalle}</div>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Diagnóstico completo en <code>/api/salud</code>.
          </div>
        </div>
      ) : null}

      <h1>¿Tuviste un accidente?</h1>
      <p className="apagado">
        Vamos a registrar lo que pasó ahora mismo, mientras todo está fresco y la evidencia sigue en el lugar. Lleva
        unos minutos y genera un expediente sellado para presentar en la aseguradora.
      </p>

      <div className="tarjeta">
        <div className="campo">
          <label htmlFor="patente">Patente del vehículo asegurado</label>
          <input id="patente" type="text" placeholder="AB 123 CD" autoCapitalize="characters" {...campo('patente')} />
        </div>
        <div className="campo">
          <label htmlFor="poliza">Número de póliza</label>
          <input id="poliza" type="text" placeholder="Si no lo tenés a mano, dejalo vacío" {...campo('poliza')} />
        </div>
        <div className="campo">
          <label htmlFor="asegurado">Nombre y apellido</label>
          <input id="asegurado" type="text" placeholder="Como figura en la póliza" {...campo('asegurado')} />
        </div>
        <div className="campo" style={{ marginBottom: 8 }}>
          <label htmlFor="telefono">Teléfono de contacto</label>
          <input id="telefono" type="tel" placeholder="11 5555 5555" {...campo('telefono')} />
        </div>

        {error ? <div className="aviso aviso-alerta">{error}</div> : null}

        <button className="boton-primario" onClick={iniciar} disabled={enviando}>
          {enviando ? 'Abriendo la actuación...' : 'Empezar el registro'}
        </button>
        <p className="mini centrado" style={{ marginTop: 12, marginBottom: 0 }}>
          Si hay heridos, llamá primero al 107. El registro puede esperar.
        </p>
      </div>

      <div className="tarjeta-plana">
        <h3>Antes de empezar</h3>
        <p className="mini" style={{ marginBottom: 8 }}>
          La aplicación va a pedirte permiso de <strong>ubicación</strong> y de <strong>cámara y micrófono</strong>. Los
          necesita para registrar dónde y cuándo ocurrió el hecho, y para incorporar las fotografías y tu relato al
          expediente.
        </p>
        <p className="mini" style={{ marginBottom: 0 }}>
          Los datos se usan exclusivamente para documentar este siniestro ante tu aseguradora (Ley 25.326 de Protección
          de Datos Personales).
        </p>
      </div>

      <div className="fila-botones">
        <Link href="/panel" className="boton boton-secundario">
          Panel de siniestros
        </Link>
        <Link href="/verificar" className="boton boton-secundario">
          Verificar expediente
        </Link>
      </div>
    </main>
  )
}
