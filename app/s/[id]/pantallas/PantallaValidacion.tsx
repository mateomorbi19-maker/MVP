'use client'

import { useCallback, useEffect, useState } from 'react'
import { Icono } from '@/app/components/Iconos'

type Campo = { clave: string; etiqueta: string; lectura: string; estado: 'verificado' | 'revisar' }
type Lectura = {
  id: string
  tipo_documento: string
  estado: string
  simulado: boolean
  error: string | null
  confirmada: boolean
  creado_en: string
  campos: Campo[]
}

/**
 * Revisión de lo que leyó la máquina.
 *
 * Tres reglas, y las tres vienen de la especificación funcional:
 *
 * 1. NO se muestra el porcentaje de confianza. Cada campo dice «Verificado» o «Revisar
 *    dato». Un número que la persona no sabe interpretar genera dudas legales sin aportar
 *    nada de uso; el número queda en el expediente y en el panel de la aseguradora.
 * 2. Un campo marcado «Revisar dato» llega VACÍO, con la lectura como pista al costado.
 *    Para confirmarlo hay que escribirlo. Lo que se fuerza es confirmar, no avanzar.
 * 3. «Lo reviso después» siempre avanza y no escribe nada. Nadie queda encerrado en una
 *    pantalla por una lectura que salió mal.
 */
export function PantallaValidacion({ casoId, seguir }: { casoId: string; seguir: () => void }) {
  const [lecturas, setLecturas] = useState<Lectura[] | null>(null)
  const [valores, setValores] = useState<Record<string, string>>({})
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let vivo = true

    const cargar = async () => {
      const res = await fetch(`/api/casos/${casoId}/extracciones`)
      if (!res.ok || !vivo) return
      const datos: Lectura[] = await res.json()
      if (!vivo) return
      setLecturas(datos)
      setValores((previos) => {
        const siguiente = { ...previos }
        for (const l of datos) {
          for (const c of l.campos) {
            const clave = `${l.id}:${c.clave}`
            // Verificado arranca con la lectura puesta; a revisar, vacío.
            if (siguiente[clave] === undefined) siguiente[clave] = c.estado === 'verificado' ? c.lectura : ''
          }
        }
        return siguiente
      })

      /*
       * Una lectura colgada hace más de medio minuto se reencola. La cola vive en el
       * proceso, así que un redeploy con trabajos en vuelo las dejaría pendientes para
       * siempre; esto es la salida, y la dispara la propia pantalla.
       */
      const colgada = datos.some(
        (l) => l.estado === 'pendiente' && Date.now() - new Date(l.creado_en).getTime() > 30_000,
      )
      if (colgada) await fetch(`/api/casos/${casoId}/extracciones`, { method: 'POST' })
    }

    cargar()
    const t = setInterval(cargar, 4000)
    return () => {
      vivo = false
      clearInterval(t)
    }
  }, [casoId])

  const listas = (lecturas ?? []).filter((l) => l.estado === 'lista' && !l.confirmada)
  const pendientes = (lecturas ?? []).filter((l) => l.estado === 'pendiente')
  const hayVacio = listas.some((l) => l.campos.some((c) => !(valores[`${l.id}:${c.clave}`] ?? '').trim()))
  const nada = lecturas !== null && listas.length === 0 && pendientes.length === 0

  // Si no hay nada que revisar, esta pantalla no tiene por qué existir.
  const salir = useCallback(() => seguir(), [seguir])
  useEffect(() => {
    if (nada) salir()
  }, [nada, salir])

  async function confirmar() {
    setGuardando(true)
    setError(null)
    try {
      for (const l of listas) {
        const cuerpo: Record<string, string> = {}
        for (const c of l.campos) cuerpo[c.clave] = valores[`${l.id}:${c.clave}`] ?? ''
        const res = await fetch(`/api/casos/${casoId}/extracciones/${l.id}/confirmar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ valores: cuerpo }),
        })
        if (!res.ok) {
          const c = await res.json().catch(() => ({}))
          throw new Error(c?.error ?? 'No se pudieron confirmar los datos.')
        }
      }
      seguir()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado.')
      setGuardando(false)
    }
  }

  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">Datos del otro conductor</div>
        <h1 className="pregunta">Revisá lo que se leyó de los documentos</h1>
        <p className="pregunta-ayuda">
          Lo leyó el sistema de las fotos que sacaste. Nada de esto entra al expediente hasta que vos lo confirmes.
        </p>

        {listas.some((l) => l.simulado) ? (
          <div className="aviso" data-nivel="alerta">
            <strong>Lectura de demostración.</strong> Estos valores los inventó el sistema de prueba: no salen de la
            foto. No sirven para nada real.
          </div>
        ) : null}

        {pendientes.length > 0 ? (
          <div className="aviso" data-nivel="info">
            Leyendo los documentos...
          </div>
        ) : null}

        {listas.map((l) => (
          <div className="tarjeta tarjeta-validacion" key={l.id}>
            <div className="validacion-documento">
              <span className="validacion-documento-icono">
                <Icono nombre="archivo" />
              </span>
              <h3 className="validacion-documento-titulo">{l.tipo_documento}</h3>
            </div>
            {l.campos.map((c) => {
              const clave = `${l.id}:${c.clave}`
              return (
                <div className="campo campo-validacion" key={clave}>
                  <label htmlFor={clave}>
                    {c.etiqueta}{' '}
                    <span className="insignia" data-nivel={c.estado === 'verificado' ? 'ok' : 'atencion'}>
                      {c.estado === 'verificado' ? 'Verificado' : 'Revisar dato'}
                    </span>
                  </label>
                  <input
                    id={clave}
                    className="entrada-validacion"
                    type="text"
                    value={valores[clave] ?? ''}
                    placeholder={c.estado === 'revisar' ? `Se leyó: ${c.lectura}` : undefined}
                    onChange={(e) => setValores({ ...valores, [clave]: e.target.value })}
                  />
                </div>
              )
            })}
          </div>
        ))}

        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={confirmar} disabled={guardando || hayVacio || listas.length === 0}>
          {guardando ? 'Confirmando...' : 'Confirmar y seguir'}
        </button>
        <button className="omitir" onClick={seguir}>
          Lo reviso después
        </button>
      </div>
    </>
  )
}
