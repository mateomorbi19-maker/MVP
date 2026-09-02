'use client'

import type { Datos } from '../tipos'

/* ================= Datos del asegurado ================= */

export function PantallaDatos({
  datos,
  anotar,
  seguir,
}: {
  datos: Datos
  anotar: (clave: keyof Datos, valor: string) => void
  seguir: () => void
}) {
  return (
    <>
      <div className="pantalla-cuerpo">
        <div className="rotulo">Tus datos</div>
        <h1 className="pregunta">¿Con qué póliza está asegurado?</h1>
        <p className="pregunta-ayuda">
          Son los datos de la carátula del expediente. Si no los tenés a mano, salteálos: podés volver a cargarlos
          hasta que cierres.
        </p>

        <div className="tarjeta formulario-datos">
          <div className="pila">
            <div className="campo">
              <label htmlFor="patente">Patente de tu vehículo</label>
              <input
                id="patente"
                className="campo-grande"
                type="text"
                placeholder="AB 123 CD"
                autoCapitalize="characters"
                value={datos.patente}
                onChange={(e) => anotar('patente', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="poliza">Número de póliza</label>
              <input
                id="poliza"
                className="campo-grande"
                type="text"
                value={datos.poliza}
                onChange={(e) => anotar('poliza', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="asegurado">Nombre y apellido</label>
              <input
                id="asegurado"
                className="campo-grande"
                type="text"
                placeholder="Como figura en la póliza"
                value={datos.asegurado}
                onChange={(e) => anotar('asegurado', e.target.value)}
              />
            </div>
            <div className="campo">
              <label htmlFor="telefono">Teléfono de contacto</label>
              <input
                id="telefono"
                className="campo-grande"
                type="tel"
                placeholder="11 5555 5555"
                value={datos.telefono}
                onChange={(e) => anotar('telefono', e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="barra-accion">
        <button className="boton-primario" onClick={seguir}>
          Seguir
        </button>
      </div>
    </>
  )
}
