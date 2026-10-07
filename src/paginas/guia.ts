// Âncoras do Guia (#/guia/<âncora>): o bloco ("conversa", "plano", "comparar") ou um item dentro dele
// ("plano-seguranca", "comparar-saude", "conversa-abstencao"). Os links antigos (#/plano/seguranca etc.) chegam aqui
// pelo nucleo/link.ts, já convertidos.

export type BlocoDoGuia = 'conversa' | 'plano' | 'comparar'

/** Âncora de um bloco do Guia ou de um item dentro dele. */
export function ancoraNoGuia(bloco: BlocoDoGuia, item?: string): string {
  return item === undefined ? bloco : `${bloco}-${item}`
}

/** id do elemento que recebe a âncora (o mesmo texto, com prefixo para não colidir com outros ids da página). */
export function idNoGuia(ancora: string): string {
  return `guia-${ancora}`
}

/** Margem do topo ao rolar até uma âncora: cabeçalho fixo + índice fixo do Guia. */
export const ROLAGEM_GUIA = 'scroll-mt-32'
