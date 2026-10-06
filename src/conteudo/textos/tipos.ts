// Parâmetros dos textos. Nomes e números de candidato chegam SEMPRE daqui, vindos de config/candidatura.json
// (o front passa candidatura.alvo.nomeCurto etc.). Nenhum texto tem nome de candidato escrito.

/** Nomes curtos dos dois finalistas (config: alvo.nomeCurto, adversario.nomeCurto). */
export type Nomes = { readonly alvo: string; readonly adversario: string }

/** Candidato apoiado: nome curto e número (config: alvo.nomeCurto, alvo.numero). */
export type Apoiado = { readonly nome: string; readonly numero: string }

/** Responsável legal (config: site.responsavel). null = ainda não definido; o portão de publicação bloqueia. */
export type Responsavel = { readonly nome: string | null; readonly contato: string | null }
