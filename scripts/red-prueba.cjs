// Sólo lo carga el runner aislado: no cambia el comportamiento de producción.
const solicitudOriginal = globalThis.fetch
globalThis.fetch = async function solicitudLocal(entrada, opciones) {
  const url = new URL(typeof entrada === 'string' || entrada instanceof URL ? entrada : entrada.url)
  if (!['http:', 'https:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('Consulta remota desactivada en las pruebas locales.')
  }
  // Un redirect local no puede eludir la restricción y terminar enviando datos afuera.
  return solicitudOriginal(entrada, { ...opciones, redirect: 'error' })
}
