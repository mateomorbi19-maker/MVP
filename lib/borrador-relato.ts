const BASE = 'acta-borrador-relato'
const ALMACEN = 'relatos'

export interface BorradorRelato {
  casoId: string
  texto: string
  transcripcionOriginal: string | null
  textoBase?: string
  transcripcionBase?: string | null
  audio: Blob | null
  nombreAudio: string | null
  modo: 'audio' | 'texto'
  actualizadoEn: string
}

/** Una confirmación más reciente exige elegir: el borrador no debe taparla en silencio. */
export function borradorRequiereEleccion(borrador: Pick<BorradorRelato, 'texto' | 'textoBase' | 'transcripcionBase'>, textoConfirmado: string, originalConfirmado: string | null): boolean {
  const mismoTexto = borrador.textoBase !== undefined ? borrador.textoBase === textoConfirmado : !textoConfirmado || borrador.texto === textoConfirmado
  const mismoOriginal = borrador.transcripcionBase === undefined || borrador.transcripcionBase === originalConfirmado
  return !mismoTexto || !mismoOriginal
}

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolver, rechazar) => {
    if (typeof indexedDB === 'undefined') {
      rechazar(new Error('Activá el almacenamiento del navegador para conservar el borrador de audio.'))
      return
    }
    const pedido = indexedDB.open(BASE, 1)
    pedido.onupgradeneeded = () => {
      pedido.result.createObjectStore(ALMACEN, { keyPath: 'casoId' })
    }
    pedido.onsuccess = () => resolver(pedido.result)
    pedido.onerror = () => rechazar(pedido.error ?? new Error('Habilitá el almacenamiento del navegador para guardar tu relato.'))
    pedido.onblocked = () => rechazar(new Error('Cerrá las otras pestañas de la aplicación para guardar el borrador.'))
  })
}

async function operar<T>(modo: IDBTransactionMode, operacion: (almacen: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const base = await abrir()
  return new Promise((resolver, rechazar) => {
    const transaccion = base.transaction(ALMACEN, modo)
    const pedido = operacion(transaccion.objectStore(ALMACEN))
    let resultado: T
    pedido.onsuccess = () => { resultado = pedido.result }
    transaccion.oncomplete = () => {
      base.close()
      resolver(resultado)
    }
    // El éxito del pedido no alcanza: una cuota agotada todavía puede abortar el commit.
    transaccion.onabort = transaccion.onerror = () => {
      base.close()
      rechazar(transaccion.error ?? new Error('Liberá espacio en el navegador para conservar el borrador.'))
    }
  })
}

export async function leerBorradorRelato(casoId: string): Promise<BorradorRelato | null> {
  return (await operar<BorradorRelato | undefined>('readonly', (almacen) => almacen.get(casoId))) ?? null
}

export async function guardarBorradorRelato(borrador: BorradorRelato): Promise<void> {
  await operar('readwrite', (almacen) => almacen.put(borrador))
}

export async function borrarBorradorRelato(casoId: string): Promise<void> {
  await operar('readwrite', (almacen) => almacen.delete(casoId))
}
