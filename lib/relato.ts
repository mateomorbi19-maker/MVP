/** Audio y escritura son alternativas: un texto breve tampoco obliga a grabar. */
export function relatoCompleto(respuestas: Record<string, unknown>, medias: Array<{ tipo: string }>): boolean {
  return medias.some((m) => m.tipo === 'audio') ||
    [respuestas.relato_texto, respuestas.relato_ampliado].some((v) => typeof v === 'string' && v.trim().length > 0)
}
