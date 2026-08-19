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

  return (
    <main className="envoltura">
      <Marca sub="Verificación pública de integridad" />

      <h1>Verificar un expediente</h1>
      <p className="apagado">
        Cualquiera puede comprobar acá que un expediente no fue modificado después de sellarse. No hace falta
        identificarse ni tener acceso a su contenido: basta el número de actuación.
      </p>

      <div className="tarjeta">
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
        {error ? <div className="aviso aviso-alerta">{error}</div> : null}
        <button className="boton-primario" onClick={() => verificar(id, hash)} disabled={cargando || id.length < 5}>
          {cargando ? 'Verificando...' : 'Verificar'}
        </button>
      </div>

      {resultado ? (
        <>
          <div className={`aviso ${resultado.valido ? 'aviso-ok' : 'aviso-alerta'}`}>
            <strong>
              {resultado.valido
                ? 'Expediente íntegro. La cadena de custodia es consistente.'
                : 'La verificación detectó problemas de integridad.'}
            </strong>
          </div>

          {resultado.problemas.length > 0 ? (
            <div className="tarjeta">
              <h3>Problemas detectados</h3>
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {resultado.problemas.map((p, i) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="tarjeta">
            <h3 style={{ marginBottom: 10 }}>Datos de la verificación</h3>
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
                  <span style={{ color: resultado.coincide_con_hash_aportado ? 'var(--ok)' : 'var(--alerta)', fontWeight: 600 }}>
                    {resultado.coincide_con_hash_aportado ? 'Coincide' : 'No coincide'}
                  </span>
                }
              />
            ) : null}
          </div>

          {resultado.sello ? (
            <div className="tarjeta">
              <h3 style={{ marginBottom: 10 }}>Sellado</h3>
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
                <div className="aviso aviso-atencion" style={{ marginTop: 12, marginBottom: 0 }}>
                  {resultado.sello.advertencia}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="tarjeta">
            <h3 style={{ marginBottom: 10 }}>Cadena de custodia</h3>
            <div className="pila">
              {resultado.cadena.map((e) => (
                <div key={e.n} className="tarjeta-plana" style={{ marginBottom: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 14 }}>
                      {e.n}. {e.tipo}
                    </strong>
                    <span className="mini">{new Date(e.ts).toLocaleString('es-AR')}</span>
                  </div>
                  <div className="mono" style={{ marginTop: 4 }}>
                    {e.hash}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="tarjeta-plana">
            <h3>Cómo funciona</h3>
            <p className="mini" style={{ marginBottom: 0 }}>
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

function Fila({ etiqueta, valor }: { etiqueta: string; valor: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--borde)', flexWrap: 'wrap' }}>
      <span className="mini" style={{ minWidth: 190, fontWeight: 600 }}>
        {etiqueta}
      </span>
      <span style={{ flex: 1, minWidth: 180, fontSize: 14 }}>{valor}</span>
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
