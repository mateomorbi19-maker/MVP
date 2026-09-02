'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Marca } from '@/app/components/Marca'

interface Resultado {
  id: string
  estado: string
  valido: boolean
  hash_maestro: string
  hash_al_sellar: string | null
  coincide_con_hash_aportado: boolean | null
  eslabones: number
  piezas: number
  abierta_en: string
  cerrada_en: string | null
  sello: {
    sellado_en: string
    algoritmo: string
    tipo_firma: string
    advertencia: string | null
    clave_publica_sha256: string
    tsa_obtenida: boolean
    tsa_autoridad: string | null
    tsa_token_sha256: string | null
    tsa_error: string | null
  } | null
  cadena: Array<{ n: number; ts: string; tipo: string; hash: string }>
  problemas: string[]
}

/*
 * El tipo de eslabón es un identificador de la base y queda escrito dentro del expediente
 * sellado: no se renombra. Lo que se traduce es lo que se muestra, porque esta pantalla la
 * lee un perito o un liquidador que no tiene por qué conocer los nombres de la base. Si
 * mañana aparece un tipo sin rótulo, el respaldo lo deja legible igual en vez de esconderlo.
 */
const ROTULO_ESLABON: Record<string, string> = {
  apertura_actuacion: 'Apertura de la actuación',
  respuestas_registradas: 'Respuestas registradas',
  ubicacion_registrada: 'Ubicación registrada',
  fotografia_incorporada: 'Fotografía incorporada',
  audio_incorporado: 'Relato en audio incorporado',
  sensores_incorporados: 'Lecturas de sensores incorporadas',
  extraccion_solicitada: 'Lectura automática solicitada',
  lectura_automatica_registrada: 'Lectura automática registrada',
  lectura_automatica_fallida: 'Lectura automática fallida',
  datos_tercero_confirmados: 'Datos del tercero confirmados',
  tercero_identificado: 'Tercero identificado',
  testigo_registrado: 'Testigo registrado',
  croquis_registrado: 'Croquis registrado',
  datos_asegurado_registrados: 'Datos del asegurado registrados',
  acta_firmada_asegurado: 'Acta firmada por el asegurado',
  informe_consistencia_generado: 'Informe de consistencia generado',
  caso_vinculado_a_cuenta: 'Actuación vinculada a una cuenta',
  cierre_actuacion: 'Cierre y sellado de la actuación',
}

const rotuloEslabon = (tipo: string) =>
  ROTULO_ESLABON[tipo] ?? tipo.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())

function Verificador() {
  const parametros = useSearchParams()
  const [id, setId] = useState(parametros.get('id') ?? '')
  const [hash, setHash] = useState('')
  const [resultado, setResultado] = useState<Resultado | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [cargando, setCargando] = useState(false)

  const verificar = useCallback(
    async (actuacion: string, hashAportado?: string) => {
      setCargando(true)
      setError(null)
      setResultado(null)
      try {
        const res = await fetch('/api/verificar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: actuacion, hash: hashAportado || undefined }),
        })
        const cuerpo = await res.json()
        if (!res.ok) throw new Error(cuerpo?.error ?? 'No se pudo verificar.')
        setResultado(cuerpo)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error inesperado.')
      } finally {
        setCargando(false)
      }
    },
    [],
  )

  useEffect(() => {
    const inicial = parametros.get('id')
    if (inicial) verificar(inicial)
  }, [parametros, verificar])

  /*
   * Va por submit del formulario y no por onClick del botón: con el teclado abierto en un
   * teléfono, «Verificar» queda tapado, y sin <form> la tecla de retorno no dispara nada.
   * Con formulario, iOS además rotula esa tecla como «Ir» en vez de dejarla inerte.
   */
  function enviar(e: React.FormEvent) {
    e.preventDefault()
    verificar(id, hash)
  }

  return (
    <main className="envoltura">
      <Marca />

      <header className="encabezado-pagina">
        <h1 className="titulo-pagina">Verificar un expediente</h1>
        <p className="bajada-pagina">
          Cualquiera puede comprobar acá que un expediente no fue modificado después de sellarse. No hace falta
          identificarse ni tener acceso a su contenido: basta el número de actuación.
        </p>
      </header>

      <form className="tarjeta" onSubmit={enviar}>
        <div className="campo">
          <label htmlFor="id">Número de actuación</label>
          <input
            id="id"
            type="text"
            placeholder="ADS-7K2M4Q"
            value={id}
            onChange={(e) => setId(e.target.value.toUpperCase())}
            autoCapitalize="characters"
          />
        </div>
        <div className="campo">
          <label htmlFor="hash">Hash maestro del documento</label>
          <p className="ayuda">Opcional. Figura al pie del PDF; si lo pegás acá, se compara además contra el registro.</p>
          <input id="hash" type="text" placeholder="Opcional" value={hash} onChange={(e) => setHash(e.target.value.trim())} />
        </div>
        {error ? <div className="aviso" data-nivel="alerta">{error}</div> : null}
        <button className="boton-primario" type="submit" disabled={cargando || id.length < 5}>
          {cargando ? 'Verificando...' : 'Verificar'}
        </button>
      </form>

      {resultado ? (
        <>
          <Veredicto resultado={resultado} />

          {resultado.problemas.length > 0 ? (
            <div className="tarjeta tarjeta-problemas">
              <h3>Problemas detectados</h3>
              <ul className="lista-problemas">
                {resultado.problemas.map((p, i) => (
                  <li key={i} className="lista-problema">
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="tarjeta">
            <h3 className="tarjeta-titulo">Datos de la verificación</h3>
            <Fila etiqueta="Actuación" valor={resultado.id} />
            <Fila etiqueta="Estado" valor={resultado.estado === 'cerrado' ? 'Cerrada y sellada' : 'En curso (aún no sellada)'} />
            <Fila etiqueta="Abierta" valor={new Date(resultado.abierta_en).toLocaleString('es-AR')} />
            <Fila
              etiqueta="Cerrada"
              valor={resultado.cerrada_en ? new Date(resultado.cerrada_en).toLocaleString('es-AR') : '-'}
            />
            <Fila etiqueta="Eslabones de la cadena" valor={String(resultado.eslabones)} />
            <Fila etiqueta="Piezas incorporadas" valor={String(resultado.piezas)} />
            <Fila etiqueta="Hash maestro recalculado" valor={<span className="mono">{resultado.hash_maestro}</span>} />
            {resultado.coincide_con_hash_aportado !== null ? (
              <Fila
                etiqueta="Hash aportado"
                valor={
                  <span className="insignia" data-nivel={resultado.coincide_con_hash_aportado ? 'ok' : 'alerta'}>
                    {resultado.coincide_con_hash_aportado ? 'Coincide' : 'No coincide'}
                  </span>
                }
              />
            ) : null}
          </div>

          {resultado.sello ? (
            <div className="tarjeta">
              <h3 className="tarjeta-titulo">Sellado</h3>
              <Fila etiqueta="Sellado el" valor={new Date(resultado.sello.sellado_en).toLocaleString('es-AR')} />
              <Fila etiqueta="Algoritmo de firma" valor={resultado.sello.algoritmo} />
              <Fila etiqueta="Huella de clave pública" valor={<span className="mono">{resultado.sello.clave_publica_sha256}</span>} />
              <Fila
                etiqueta="Sello de tiempo RFC 3161"
                valor={
                  resultado.sello.tsa_obtenida
                    ? `Obtenido de ${resultado.sello.tsa_autoridad}`
                    : `No obtenido — ${resultado.sello.tsa_error ?? 'sin detalle'}`
                }
              />
              {resultado.sello.tsa_token_sha256 ? (
                <Fila etiqueta="Hash del token TSA" valor={<span className="mono">{resultado.sello.tsa_token_sha256}</span>} />
              ) : null}
              {resultado.sello.advertencia ? (
                <div className="aviso aviso-sello" data-nivel="atencion">
                  {resultado.sello.advertencia}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="tarjeta">
            <h3 className="tarjeta-titulo">Cadena de custodia</h3>
            <div className="pila">
              {resultado.cadena.map((e) => (
                <div key={e.n} className="tarjeta-plana eslabon">
                  <div className="eslabon-encabezado">
                    <strong className="eslabon-tipo">
                      {e.n}. {rotuloEslabon(e.tipo)}
                    </strong>
                    <span className="mini">{new Date(e.ts).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="mono eslabon-hash">
                    {e.hash}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tarjeta-plana">
            <h3>Cómo funciona</h3>
            <p className="mini explicacion-verificacion">
              Cada acción sobre el expediente genera un asiento cuyo hash incorpora el hash del asiento anterior. La
              verificación recalcula toda la cadena desde el primer eslabón. Si un solo dato hubiera sido modificado,
              suprimido o reordenado después de registrarse, el recálculo no coincidiría y esta pantalla lo informaría.
            </p>
          </div>
        </>
      ) : null}
    </main>
  )
}

/*
 * Tres estados, no dos. Una actuación abierta puede tener la cadena perfecta y aun así no
 * hay sello: decirle «íntegro» a un perito ahí promete una garantía que todavía no se dio.
 * La verificación pública de /v/[id] ya distingue los tres; ésta tiene que decir lo mismo.
 *
 * La rama de alerta no dice «la cadena no cierra»: `problemas` también se llena cuando el
 * hash que pegó la persona no coincide, y ahí la cadena está intacta. Qué falló lo dice la
 * tarjeta de problemas.
 */
function Veredicto({ resultado }: { resultado: Resultado }) {
  if (!resultado.valido) {
    return (
      <div className="aviso" data-nivel="alerta">
        <strong>La verificación detectó problemas de integridad.</strong>
      </div>
    )
  }
  if (resultado.estado !== 'cerrado') {
    return (
      <div className="aviso" data-nivel="atencion">
        <strong>La actuación existe y su cadena cierra, pero todavía no fue sellada.</strong>
        <p className="aviso-detalle">
          Hasta que se cierre se le pueden seguir agregando eslabones. Lo que queda sellado es el expediente cerrado.
        </p>
      </div>
    )
  }
  return (
    <div className="aviso" data-nivel="ok">
      <strong>Expediente íntegro. La cadena de custodia es consistente.</strong>
    </div>
  )
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div className="fila-dato">
      <span className="mini fila-dato-etiqueta">{etiqueta}</span>
      <span className="fila-dato-valor">{valor}</span>
    </div>
  )
}

export default function PaginaVerificar() {
  return (
    <Suspense fallback={<main className="envoltura"><p className="apagado">Cargando...</p></main>}>
      <Verificador />
    </Suspense>
  )
}
