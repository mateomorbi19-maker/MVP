'use client'

import Link from 'next/link'

/* ================= Final ================= */

export function PantallaFinal({ casoId, cierre }: { casoId: string; cierre: { hash_maestro: string } | null }) {
  return (
    <div className="pantalla-cuerpo">
      <div className="hito">
        <div className="hito-simbolo">✓</div>
        <h1 className="pregunta">Expediente cerrado y sellado</h1>
        <p className="pregunta-ayuda">
          Presentalo en tu aseguradora. El número de actuación alcanza para que lo verifiquen.
        </p>
      </div>

      <div className="tarjeta">
        <h3>Número de actuación</h3>
        <p className="numero-actuacion" style={{ margin: '4px 0 16px' }}>
          {casoId}
        </p>

        {cierre ? (
          <>
            <h3>Hash maestro</h3>
            <p className="mono" style={{ marginBottom: 16 }}>
              {cierre.hash_maestro}
            </p>
          </>
        ) : null}

        <div className="pila">
          <a className="boton boton-primario" href={`/api/casos/${casoId}/pdf?descargar=1`}>
            Descargar el expediente en PDF
          </a>
          <a className="boton boton-secundario" href={`/api/casos/${casoId}/pdf`} target="_blank" rel="noreferrer">
            Verlo en pantalla
          </a>
          <Link className="boton boton-secundario" href={`/verificar?id=${casoId}`}>
            Verificar la integridad
          </Link>
        </div>
      </div>

      <p className="mini">
        Guardá el número de actuación. Cualquiera puede comprobar con él que el expediente no fue modificado, sin
        necesidad de acceder a su contenido.
      </p>
    </div>
  )
}
