'use client'

import { Component, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { BotonesEmergencia } from './BotonesEmergencia'
import { recordarActuacion } from '@/lib/local'
import { ESTADO_SERVIDOR, motorDelNavegador, type EstadoModoViaje, type MotorViaje } from '@/lib/viaje'

/**
 * El modo viaje, montado una sola vez en el layout.
 *
 * Va en el layout y no en una pantalla porque el viaje no termina cuando la persona cambia
 * de página: la alerta tiene que poder aparecer sobre cualquier ruta.
 */

const suscribir = (fn: () => void) => motorDelNavegador()?.suscribir(fn) ?? (() => undefined)
const leer = () => motorDelNavegador()?.estado() ?? ESTADO_SERVIDOR
const leerEnServidor = () => ESTADO_SERVIDOR

export function useModoViaje(): { estado: EstadoModoViaje; motor: MotorViaje | null } {
  const estado = useSyncExternalStore(suscribir, leer, leerEnServidor)
  return { estado, motor: estado === ESTADO_SERVIDOR ? null : motorDelNavegador() }
}

export function ModoViaje({ children }: { children: ReactNode }) {
  const { estado } = useModoViaje()
  const bloqueado = estado.alerta !== null
  return (
    <>
      {/* inert y no sólo un velo: con la alerta abierta, el lector de pantalla y el tabulador no llegan a lo de atrás. */}
      <div className="raiz-app" inert={bloqueado || undefined}>
        {children}
      </div>
      <Resguardo>
        <Capa />
      </Resguardo>
    </>
  )
}

/* Si la capa falla, la aplicación de atrás tiene que seguir andando: es la que registra el accidente. */
class Resguardo extends Component<{ children: ReactNode }, { roto: boolean }> {
  state = { roto: false }
  static getDerivedStateFromError() {
    return { roto: true }
  }
  render() {
    return this.state.roto ? null : this.props.children
  }
}

const RUTAS_SIN_PILDORA = ['/', '/verificar', '/entrar', '/registro']

function llevaPildora(ruta: string) {
  if (RUTAS_SIN_PILDORA.includes(ruta) || ruta.startsWith('/panel')) return false
  return !/^\/(s|t|c|e|v)\//.test(ruta)
}

function Capa() {
  const { estado, motor } = useModoViaje()
  const ruta = usePathname()
  const hoja = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    motor?.cambiarRuta(ruta)
  }, [motor, ruta])

  useEffect(() => {
    if (estado.alerta) hoja.current?.close()
  }, [estado.alerta])

  const conPildora =
    ['activo', 'en_pausa', 'reanudar_con_toque', 'sin_permiso'].includes(estado.fase) || estado.inactividad

  let texto = 'Modo viaje activo'
  if (estado.fase === 'en_pausa') texto = 'Modo viaje en pausa'
  if (estado.fase === 'sin_permiso') texto = 'Modo viaje sin permiso de movimiento'
  if (estado.fase === 'activo' && estado.pantalla === 'sin_retener') texto = 'Tocá la pantalla para que no se apague'
  if (estado.fase === 'reanudar_con_toque') texto = 'Modo viaje: tocá para reanudar'
  if (estado.inactividad) texto = '¿Terminaste el viaje? Tocá para seguir'

  function alTocarPildora() {
    if (!motor) return
    if (estado.fase === 'reanudar_con_toque') motor.reanudar()
    else if (estado.inactividad) motor.tocar()
    else hoja.current?.showModal()
  }

  return (
    <>
      {conPildora && llevaPildora(ruta) ? (
        <button type="button" className="pildora-viaje" aria-haspopup="dialog" onClick={alTocarPildora}>
          <span className="punto" data-estado={estado.fase === 'activo' ? 'ok' : 'espera'} aria-hidden="true" />
          {texto}
        </button>
      ) : null}

      <dialog className="hoja-viaje" ref={hoja} aria-labelledby="hoja-viaje-titulo">
        <h2 id="hoja-viaje-titulo" className="hoja-viaje-titulo">
          Modo viaje
        </h2>
        <dl className="hoja-viaje-datos">
          <dt>Estado</dt>
          <dd>{estado.fase === 'activo' ? 'Activo' : estado.fase === 'en_pausa' ? 'En pausa' : 'Detenido'}</dd>
          <dt>Velocidad</dt>
          <dd>{estado.velocidadKmh === null ? 'Sin dato del GPS' : `${estado.velocidadKmh} km/h`}</dd>
        </dl>
        <p>Detección activa {estado.minutosActivo} min</p>
        <p>Frenadas bruscas registradas: {estado.frenadas}</p>
        {estado.demo ? <p>Modo demostración activo</p> : null}
        <p className="mini">
          Funciona sólo con la aplicación abierta y la pantalla encendida. No llama ni le avisa a nadie por su cuenta.
        </p>
        <div className="pila">
          <button type="button" className="boton boton-secundario" onClick={() => motor?.probarAlerta()}>
            Probar la alerta
          </button>
          <button
            type="button"
            className="boton boton-secundario"
            onClick={() => {
              motor?.apagar()
              hoja.current?.close()
            }}
          >
            Apagar el modo viaje
          </button>
          <button type="button" className="boton boton-fantasma" onClick={() => hoja.current?.close()}>
            Cerrar
          </button>
        </div>
      </dialog>

      {estado.alerta && motor ? <Alerta estado={estado} motor={motor} /> : null}
    </>
  )
}

function Alerta({ estado, motor }: { estado: EstadoModoViaje; motor: MotorViaje }) {
  const alerta = estado.alerta!
  const router = useRouter()
  const titulo = useRef<HTMLHeadingElement>(null)
  const [armada, setArmada] = useState(false)
  const [abriendo, setAbriendo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /*
   * Los botones reciben toques recién a los 600 ms: el golpe que abrió la alerta puede venir
   * con un dedo apoyado en la pantalla, y ese toque no puede contestar por la persona.
   */
  useEffect(() => {
    setArmada(false)
    titulo.current?.focus()
    const t = window.setTimeout(() => setArmada(true), 600)
    return () => window.clearTimeout(t)
  }, [alerta.estado])

  async function registrar() {
    setAbriendo(true)
    setError(null)
    try {
      const res = await fetch('/api/casos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      const cuerpo = await res.json().catch(() => null)
      if (!res.ok || typeof cuerpo?.id !== 'string') throw new Error()
      recordarActuacion(cuerpo.id, cuerpo.secreto)
      motor.apagar('accidente')
      router.push(`/s/${cuerpo.id}`)
    } catch {
      setError('No se pudo abrir la actuación. Revisá la señal y volvé a tocar el botón.')
      setAbriendo(false)
    }
  }

  const hora = new Date(alerta.ocurridoEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
  const avisoError = error ? (
    <div className="aviso" data-nivel="alerta">
      {error}
    </div>
  ) : null

  return (
    <div
      className="alerta-viaje"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="alerta-viaje-titulo"
      data-armada={armada ? '' : undefined}
    >
      {alerta.estado === 'pregunta' ? (
        <>
          <div className="alerta-viaje-texto">
            <h2 id="alerta-viaje-titulo" className="alerta-viaje-titulo" tabIndex={-1} ref={titulo}>
              ¿Estás bien?
            </h2>
            <p className="alerta-viaje-parrafo">Detectamos un posible choque a las {hora}.</p>
            <p className="alerta-viaje-cuenta" aria-live="off">
              {alerta.restanteS}
            </p>
            <p className="alerta-viaje-nota">
              La aplicación no llama sola a emergencias. Si no respondés, al llegar a cero te mostramos los teléfonos
              para llamar.
            </p>
          </div>
          <div className="alerta-viaje-acciones">
            <button type="button" className="boton-alerta-viaje" onClick={() => motor.responder('estoy_bien')}>
              Estoy bien
            </button>
            <button
              type="button"
              className="boton-alerta-viaje boton-alerta-viaje-ayuda"
              onClick={() => motor.responder('necesito_ayuda')}
            >
              Necesito ayuda
            </button>
          </div>
        </>
      ) : null}

      {alerta.estado === 'hubo_choque' ? (
        <>
          <div className="alerta-viaje-texto">
            <h2 id="alerta-viaje-titulo" className="alerta-viaje-titulo" tabIndex={-1} ref={titulo}>
              ¿Hubo un choque?
            </h2>
            <BotonesEmergencia />
          </div>
          <div className="alerta-viaje-acciones">
            {avisoError}
            <button
              type="button"
              className="boton-alerta-viaje"
              disabled={abriendo}
              onClick={() => {
                motor.huboChoque(true)
                void registrar()
              }}
            >
              {abriendo ? 'Abriendo...' : 'Sí, registrar el accidente'}
            </button>
            <button
              type="button"
              className="boton-alerta-viaje boton-alerta-viaje-ayuda"
              onClick={() => motor.huboChoque(false)}
            >
              No, fue una falsa alarma
            </button>
          </div>
        </>
      ) : null}

      {alerta.estado === 'ayuda' ? (
        <>
          <div className="alerta-viaje-texto">
            <h2 id="alerta-viaje-titulo" className="alerta-viaje-titulo" tabIndex={-1} ref={titulo}>
              {alerta.origenAyuda === 'sin_respuesta' ? 'No respondiste' : 'Pediste ayuda'}
            </h2>
            <p className="alerta-viaje-nota">La aplicación no llama sola a emergencias. Tocá el número para llamar.</p>
            <BotonesEmergencia />
          </div>
          <div className="alerta-viaje-acciones">
            {avisoError}
            <button type="button" className="boton-alerta-viaje" disabled={abriendo} onClick={registrar}>
              {abriendo ? 'Abriendo...' : 'Registrar el accidente'}
            </button>
            <button
              type="button"
              className="boton-alerta-viaje boton-alerta-viaje-ayuda"
              onClick={() => motor.huboChoque(false)}
            >
              Estoy bien, fue una falsa alarma
            </button>
          </div>
        </>
      ) : null}
    </div>
  )
}
