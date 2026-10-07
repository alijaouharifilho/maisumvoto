// Comparação por assunto entre os dois planos registrados no TSE: um resumo de cada lado, os trechos literais com
// a página (conferidos por ferramentas/conferir_citacoes.py, fonte "adversario" = PDF do outro plano) e o que há
// em comum e de diferente. Fica num módulo à parte para entrar só no pedaço do Guia (#/guia/comparar).
// Os textos nossos citam os candidatos por {{alvo.nomeCurto}} e {{adversario.nomeCurto}}; a página preenche
// com preencherTudo (modelo.ts), como nos roteiros. Os trechos são literais e não levam modelo.
// Não importa conteudo.ts: os testes de conteúdo rodam no tsc do Node, onde o "?raw" do Vite não existe.
import comparacaoJson from './comparacao.json' with { type: 'json' }

/** Trecho citado; "fonte" ausente = plano do candidato apoiado, "adversario" = plano do adversário. */
export type CitacaoComparada = { readonly trecho: string; readonly pagina: number; readonly fonte?: string }

export type LadoDaComparacao = {
  /** O que o plano propõe sobre o assunto, em poucas palavras e sem adjetivo. */
  readonly resumo: string
  readonly citacoes: readonly CitacaoComparada[]
}

export type TemaComparado = {
  readonly chave: string
  readonly titulo: string
  /** A pergunta que o assunto responde ("O que cada plano propõe para..."). */
  readonly pergunta: string
  readonly alvo: LadoDaComparacao
  readonly adversario: LadoDaComparacao
  /** O que os dois planos propõem de parecido; null se não há nada em comum no assunto. */
  readonly emComum: string | null
  readonly diferenca: string
}

export type DocumentoAdversario = {
  readonly descricao: string
  /** PDF oficial no site do TSE; aceita #page=N. */
  readonly url: string
  readonly sha256: string
  readonly paginas: number
  /** Data (AAAA-MM-DD) em que os trechos dos dois lados foram conferidos contra os PDFs. */
  readonly conferidoEm: string
}

export type Comparacao = {
  readonly esquema: number
  readonly documentoAdversario: DocumentoAdversario
  readonly temas: readonly TemaComparado[]
}

export const comparacao: Comparacao = comparacaoJson

/** Link direto para a página do PDF oficial do plano do adversário. */
export function linkPaginaAdversario(pagina: number): string {
  return `${comparacao.documentoAdversario.url}#page=${pagina}`
}
