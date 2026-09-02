'use client'

import Link from 'next/link'
import { EntregaExpediente } from '@/app/components/EntregaExpediente'
import { Icono } from '@/app/components/Iconos'

/* ================= Final ================= */

export function PantallaFinal({ casoId, cierre }: { casoId: string; cierre: { hash_maestro: string } | null }) {
  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="hito hito-final">
          <div className="hito-simbolo hito-simbolo-final">
            <Icono nombre="tilde" />
          </div>
          <div className="rotulo">Accidente Certificado</div>
          <h1 className="pregunta">Expediente cerrado y sellado</h1>
          <p className="pregunta-ayuda">
            Presentalo en tu aseguradora. El número de actuación alcanza para que lo verifiquen.
          </p>
        </div>

        <div className="tarjeta tarjeta-expediente">
          <div className="tarjeta-expediente-encabezado">
            <span className="tarjeta-expediente-icono">
              <Icono nombre="archivo" />
            </span>
            <div className="tarjeta-expediente-datos">
              <h3>Número de actuación</h3>
              <p className="numero-actuacion tarjeta-expediente-numero">{casoId}</p>
            </div>
          </div>

          {cierre ? (
            <div className="hash-expediente">
              <h3>Hash maestro</h3>
              <p className="mono hash-expediente-valor">{cierre.hash_maestro}</p>
            </div>
          ) : null}

          <a className="boton boton-secundario" href={`/api/casos/${casoId}/pdf`} target="_blank" rel="noreferrer">
            <Icono nombre="archivo" />
            Verlo en pantalla
          </a>
        </div>

        <EntregaExpediente casoId={casoId} />

        <p className="mini nota-verificacion">
          Guardá el número de actuación. Cualquiera puede comprobar con él que el expediente no fue modificado, sin
          necesidad de acceder a su contenido.
        </p>
      </div>

      <div className="barra-accion barra-accion-final">
        <a className="boton boton-primario" href={`/api/casos/${casoId}/pdf?descargar=1`}>
          <Icono nombre="descargar" />
          Descargar el expediente
        </a>
        <Link className="boton boton-secundario" href={`/verificar?id=${casoId}`}>
          <Icono nombre="verificar" />
          Verificar la integridad
        </Link>
      </div>
    </>
  )
}
