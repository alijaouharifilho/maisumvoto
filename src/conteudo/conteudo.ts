// Conteúdo editorial tipado: plano (trechos literais conferidos), roteiros de conversa e páginas em markdown.
// A atribuição `const x: Tipo = json` faz o tsc conferir o formato dos JSON no build.
// Strings com {{chave}} (roteiros e .md) passam por preencherModelo/preencherTudo (modelo.ts) antes de exibir.
import planoJson from './plano.json' with { type: 'json' }
import privacidadeMd from './privacidade.md?raw'
import roteirosJson from './roteiros.json' with { type: 'json' }
import sobreMd from './sobre.md?raw'

export type Citacao = { readonly trecho: string; readonly pagina: number }

/** Um número simples sobre o problema que a proposta enfrenta, com a fonte e o trecho que o confirma. */
export type DadoDoCartao = {
  readonly numero: string
  /** O que o número mede, em até 15 palavras. */
  readonly frase: string
  readonly fonte: string
  readonly url: string
  /** Ano a que o dado se refere (não o da consulta). */
  readonly ano: number
  /** Trecho literal da fonte que contém o número, para conferência. */
  readonly confere: string
}

/** Cartão de conversa: o trecho literal do plano + explicação simples, um número e uma pergunta para puxar o assunto. */
export type Proposta = Citacao & {
  readonly titulo: string
  readonly emUmaFrase: string
  readonly dado: DadoDoCartao | null
  readonly porQue: string
  readonly paraPuxar: string
  /** O que o voluntário não deve afirmar (onde seria fácil exagerar o dado). */
  readonly cuidado?: string
}

export type Capitulo = {
  readonly chave: string
  readonly titulo: string
  /** Nome do capítulo no próprio PDF (referência, não título nosso). */
  readonly nomeNoPlano: string
  readonly paginas: readonly number[]
  readonly chamada: string
  readonly propostas: readonly Proposta[]
}

export type DocumentoPlano = {
  readonly descricao: string
  /** PDF oficial no site do TSE; aceita #page=N. */
  readonly url: string
  readonly paginaTse: string
  readonly dadosAbertos: { readonly url: string; readonly entrada: string }
  readonly sha256: string
  readonly paginas: number
  readonly conferidoEm: string
}

export type Plano = {
  readonly esquema: number
  readonly documento: DocumentoPlano
  /** Data (AAAA-MM-DD) em que os números dos cartões foram conferidos nas fontes. */
  readonly dadosConferidosEm: string
  readonly capitulos: readonly Capitulo[]
}

export type Ponte = { readonly tema: string; readonly texto: string; readonly citacoes: readonly Citacao[] }

export type FichaVoto = {
  readonly status: string
  readonly titulo: string
  readonly fraseGuia: string
  readonly contexto: readonly string[]
  readonly passos: readonly string[]
  readonly pontes: readonly Ponte[]
  readonly cuidados: readonly string[]
}

/** Grupo ainda sem texto (status "fase2"). */
export type FichaPendente = { readonly status: string }

export type RoteiroGeral = {
  readonly titulo: string
  readonly fraseGuia: string
  readonly passos: readonly string[]
  readonly cuidados: readonly string[]
}

/** Chaves de `fichas` = valores de config.gruposConversa. */
export type Roteiros = {
  readonly esquema: number
  readonly modelo: string
  readonly geral: RoteiroGeral
  readonly fichas: Readonly<Record<string, FichaVoto | FichaPendente>>
}

export const plano: Plano = planoJson
export const roteiros: Roteiros = roteirosJson

/** Markdown cru, com {{chaves}}. Ler com lerMarkdown(preencherModelo(md, valores)). */
export const markdown = { sobre: sobreMd, privacidade: privacidadeMd } as const

/** Link direto para a página do PDF oficial. */
export function linkPagina(pagina: number): string {
  return `${plano.documento.url}#page=${pagina}`
}

export function fichaPronta(ficha: FichaVoto | FichaPendente | undefined): ficha is FichaVoto {
  return ficha !== undefined && ficha.status === 'mvp' && 'passos' in ficha
}
