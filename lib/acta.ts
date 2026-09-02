import { canonico, sha256 } from './hash'
import type { Caso, Media, Testigo } from './casos'

/**
 * El acta que el asegurado firma.
 *
 * Lo que se firma NO es el PNG del trazo: es el hash de un objeto canonicalizado con la
 * carátula, las respuestas, el lugar, el croquis y la lista de piezas con sus sha256. Sin
 * eso, la firma es un dibujo suelto que no está atado a ninguna declaración, y cualquiera
 * podría mostrarle a la persona una cosa y guardar otra.
 *
 * El cuerpo es DETERMINÍSTICO a propósito: no lleva marca de tiempo ni el último eslabón
 * de la cadena. Si los llevara, el guardado automático del recorrido —que dispara cada
 * 700 ms— invalidaría una firma que la persona está por dar, sin que haya cambiado nada
 * de lo que firma.
 */

/**
 * El texto exacto de lo que se declara.
 *
 * Lleva versión y la versión entra al hash. Cambiar una coma después de que existan firmas
 * invalidaría la comparación en todos los expedientes anteriores, y el expediente mostraría
 * la advertencia de contenido modificado sobre actas intactas. Si hay que cambiarlo, se
 * crea 'acta-asegurado-3' y las firmas viejas siguen verificando contra su propia versión.
 */
export const DECLARACION = {
  version: 'acta-asegurado-2',
  texto:
    'Declaro que los datos, las fotografías y el relato que integran esta actuación fueron aportados por mí y ' +
    'corresponden al siniestro que denuncio. Entiendo que esta es una firma electrónica en los términos del art. 5 ' +
    'de la Ley 25.506, que no cuenta con las presunciones de autoría e integridad de sus arts. 7 y 8, y que su ' +
    'valor probatorio queda sujeto a apreciación judicial.',
}

export interface CuerpoActa {
  version: string
  caso_id: string
  declaracion: string
  caratula: { poliza: string | null; patente: string | null; asegurado: string | null; telefono: string | null }
  respuestas: Record<string, unknown>
  lugar: { direccion: string | null; lat: number | null; lon: number | null }
  /**
   * El croquis entra por su hash y no por su contenido.
   *
   * Sin esto, entre la firma y el cierre el dibujo se podía cambiar entero sin que la
   * firma lo detectara: vive en una columna propia, no está en `respuestas` ni en las
   * piezas. Y el croquis es la reconstrucción declarativa de cómo ocurrió el hecho, o sea
   * la pieza más disputada de un expediente vial.
   */
  croquis_sha256: string | null
  piezas: Array<{ id: string; tipo: string; sha256: string }>
  testigos: Array<{ id: string; sha256: string }>
}

export interface ActaParaFirmar {
  hash: string
  cuerpo: CuerpoActa
  /** Qué cubre la firma, en palabras, para mostrárselo a la persona antes de firmar. */
  resumen: { fotos: number; audios: number; testigos: number; conCroquis: boolean; respuestas: number }
}

/**
 * Arma el acta y su hash.
 *
 * Qué queda AFUERA a propósito, y hay que decirlo en el expediente: el informe de
 * consistencia y el eslabón de cierre, porque los dos se generan después de firmar. A
 * nadie se le puede hacer firmar un informe automático sobre sí mismo.
 */
export function construirActa(caso: Caso, medias: Media[], testigos: Testigo[]): ActaParaFirmar {
  const piezas = medias
    .filter((m) => m.tipo !== 'firma')
    .map((m) => ({ id: m.id, tipo: m.tipo, sha256: m.sha256 }))
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))

  const cuerpo: CuerpoActa = {
    version: DECLARACION.version,
    caso_id: caso.id,
    declaracion: DECLARACION.texto,
    caratula: {
      poliza: caso.poliza,
      patente: caso.patente,
      asegurado: caso.asegurado,
      telefono: caso.telefono,
    },
    respuestas: caso.respuestas,
    lugar: { direccion: caso.direccion, lat: caso.gps?.lat ?? null, lon: caso.gps?.lon ?? null },
    croquis_sha256: caso.croquis ? sha256(canonico(caso.croquis)) : null,
    piezas,
    testigos: testigos.map((t) => ({ id: t.id, sha256: t.sha256 })).sort((a, b) => (a.id < b.id ? -1 : 1)),
  }

  return {
    hash: sha256(canonico(cuerpo)),
    cuerpo,
    resumen: {
      fotos: medias.filter((m) => m.tipo === 'foto').length,
      audios: medias.filter((m) => m.tipo === 'audio').length,
      testigos: testigos.length,
      conCroquis: Boolean(caso.croquis),
      respuestas: Object.keys(caso.respuestas).length,
    },
  }
}
