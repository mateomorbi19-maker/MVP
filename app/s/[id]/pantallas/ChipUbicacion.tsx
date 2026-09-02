'use client'

import { useState } from 'react'
import { Icono } from '@/app/components/Iconos'
import type { FalloGps, Ubicacion } from '../tipos'

/* ================= Ubicación ================= */

/** Instrucción concreta según por qué falló, para que se pueda resolver en el momento. */
const GUIA_FALLO: Record<string, { titulo: string; comoResolver: string }> = {
  denegado: {
    titulo: 'El acceso a la ubicación está bloqueado',
    comoResolver:
      'En Android: tocá el candado a la izquierda de la dirección web y habilitá "Ubicación". En iPhone: entrá a Ajustes › Safari › Ajustes para sitios web › Ubicación y ponelo en "Permitir"; revisá además que Ajustes › Privacidad › Localización esté activado para Safari. Después volvé acá y reintentá.',
  },
  sin_respuesta: {
    titulo: 'El teléfono no respondió al pedido de ubicación',
    comoResolver:
      'Es un problema conocido de iPhone cuando la aplicación está instalada en la pantalla de inicio: el cartel de permiso a veces aparece en Safari en vez de acá. Abrí Safari, entrá a este mismo sitio, aceptá el permiso de ubicación, y después volvé a la aplicación y reintentá.',
  },
  no_disponible: {
    titulo: 'El dispositivo no pudo determinar dónde está',
    comoResolver:
      'Puede que el GPS esté apagado o que no haya señal. Activá la ubicación del teléfono, salí a cielo abierto si estás bajo techo, y reintentá.',
  },
  demora: {
    titulo: 'La ubicación tardó demasiado',
    comoResolver: 'Suele pasar bajo techo o entre edificios altos. Esperá unos segundos y volvé a intentar.',
  },
  no_soportado: {
    titulo: 'Este navegador no permite obtener la ubicación',
    comoResolver: 'Abrí el enlace desde Chrome o Safari en el teléfono. Es donde mejor funciona.',
  },
  servidor: {
    titulo: 'La ubicación se obtuvo pero no se pudo registrar',
    comoResolver: 'Puede ser un problema momentáneo de conexión. Reintentá en unos segundos.',
  },
}

/**
 * Estado de la ubicación en una línea.
 *
 * Ocupa una línea y no una tarjeta porque aparece en todas las pantallas del
 * recorrido: si fuera un cartel completo, empujaría la pregunta fuera de la vista
 * en cada paso. En rojo y tocable cuando hay algo que resolver.
 */
export function ChipUbicacion({
  estado,
  ubicacion,
  fallo,
  alReintentar,
}: {
  estado: 'pidiendo' | 'ok' | 'error'
  ubicacion: Ubicacion
  fallo: FalloGps
  alReintentar: () => void
}) {
  const [abierto, setAbierto] = useState(false)

  if (estado !== 'error') {
    return (
      <div className="chip" data-estado={estado}>
        <span className="chip-icono">
          <Icono nombre="ubicacion" />
        </span>
        <span className="punto" data-estado={estado === 'ok' ? 'ok' : 'espera'} />
        <span className="chip-texto">
          {estado === 'ok'
            ? `Ubicación registrada${ubicacion?.direccion ? ` · ${ubicacion.direccion.split(',').slice(0, 2).join(', ')}` : ''}`
            : 'Registrando la ubicación...'}
        </span>
      </div>
    )
  }

  const guia = GUIA_FALLO[fallo?.motivo ?? 'no_disponible'] ?? GUIA_FALLO.no_disponible

  return (
    <>
      {/*
        Mismo armado que las variantes ok y pidiendo: ícono, punto y texto. Sin el ícono la
        fila se corre 32 px al fallar el GPS a mitad del recorrido, y la única línea que
        habla de ubicación se queda sin el símbolo que dice de qué habla: en rojo y sin
        ícono se lee como un error genérico. El texto se acorta y lleva .chip-texto para
        que en 375 px entre el ícono sin que la línea desborde.
      */}
      <button className="chip" data-estado="error" onClick={() => setAbierto((a) => !a)}>
        <span className="chip-icono">
          <Icono nombre="ubicacion" />
        </span>
        <span className="punto" data-estado="error" />
        <span className="chip-texto">Sin ubicación · cómo resolverlo</span>
        <span className="chip-flecha">{abierto ? '▲' : '▼'}</span>
      </button>

      {abierto ? (
        <div className="aviso" data-nivel="atencion">
          <strong>{guia.titulo}</strong>
          <p className="aviso-detalle">
            Sin ubicación, el expediente pierde el registro objetivo del lugar, la hora solar y el clima. Son
            justamente los datos que después permiten contrastar la declaración.
          </p>
          <p className="aviso-instruccion">{guia.comoResolver}</p>
          <button className="boton-secundario boton-ancho" onClick={alReintentar}>
            Reintentar la ubicación
          </button>
        </div>
      ) : null}
    </>
  )
}
