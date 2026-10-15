'use client'

import { Icono } from '@/app/components/Iconos'
import { useState } from 'react'
import { ContactosTestigos, type ContactoAnotado } from '@/app/components/ContactosTestigos'
import { IntercambioDocumentos } from '@/app/components/IntercambioDocumentos'
import type { Testigo } from '../tipos'

/* ================= Corte: lo urgente ya está ================= */

export function PantallaCorte({
  casoId,
  seguir,
  alGuardar,
  contactos,
  alCambiarContactos,
  testigos,
  alRecibirTestigos,
  alIncorporar,
  esencialesCompletos,
}: {
  casoId: string
  seguir: () => void
  alGuardar: () => void
  contactos: ContactoAnotado[]
  alCambiarContactos: (contactos: ContactoAnotado[]) => void
  testigos: Testigo[]
  alRecibirTestigos: (testigos: Testigo[]) => void
  alIncorporar: () => void
  esencialesCompletos: boolean
}) {
  const [documentosAbiertos, setDocumentosAbiertos] = useState(false)
  const [testigosAbiertos, setTestigosAbiertos] = useState(false)
  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="hito-corte">
          <div className="hito-simbolo">
            <Icono nombre="tilde" />
          </div>
          <h1 className="pregunta hito-titulo">{esencialesCompletos ? '¡Ya tenemos lo más importante!' : 'Podés guardar y continuar después'}</h1>
          <p className="pregunta-ayuda">
            Antes de continuar, podés intercambiar documentación y anotar a los testigos. El relato lo completás ahora o más tarde.
          </p>
        </div>

        <div className="lista-esenciales">
          <button className="acceso acceso-boton" onClick={alGuardar}>
            <span className="acceso-icono acceso-icono-redondo">
              <Icono nombre="reloj" />
            </span>
            <span className="acceso-texto">
              <span className="acceso-titulo">Guardar y relatar el siniestro luego</span>
              <span className="acceso-detalle">Tu progreso queda guardado. Al volver a abrir la app, seguís desde acá.</span>
            </span>
          </button>
          <button className="acceso acceso-boton" onClick={seguir}>
            <span className="acceso-icono acceso-icono-redondo">
              <Icono nombre="lapiz" />
            </span>
            <span className="acceso-texto">
              <span className="acceso-titulo">Seguir con el relato de los hechos</span>
              <span className="acceso-detalle">Grabar o escribir en una sola pantalla.</span>
            </span>
          </button>
          <button className="boton-secundario" onClick={() => setDocumentosAbiertos((v) => !v)} aria-expanded={documentosAbiertos}>
            QR de mi documentación para el tercero
          </button>
          <button className="boton-secundario" onClick={() => setTestigosAbiertos((v) => !v)} aria-expanded={testigosAbiertos}>
            QR y teléfonos de testigos
          </button>
        </div>
        {documentosAbiertos ? <IntercambioDocumentos casoId={casoId} alIncorporar={alIncorporar} /> : null}
        {testigosAbiertos ? <ContactosTestigos casoId={casoId} contactos={contactos} alCambiar={alCambiarContactos} testigos={testigos} alRecibir={alRecibirTestigos} /> : null}

        {/* El número es cómo se vuelve a encontrar la actuación: no se saca aunque sea chico. */}
        <p className="nota-pie">
          Número de actuación <span className="numero-actuacion">{casoId}</span>
        </p>
      </div>

      <div className="barra-accion">
        <p className="nota-pie">Si hay archivos pendientes de subir, quedan en este teléfono hasta recuperar la conexión y volver a abrir la aplicación.</p>
      </div>
    </>
  )
}
