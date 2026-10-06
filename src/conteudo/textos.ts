// TODO texto da interface. Ponto único de importação para o front:
//   import { textos } from '../conteudo/textos.ts'
//   textos.disputa[classificacao]({ nomes, votosAlvo, votosAdversario, reservatorio, regra })
// Nomes e números de candidato chegam por parâmetro (config/candidatura.json); nada aqui é escrito à mão.
// Revisão humana obrigatória antes de publicar: src/conteudo/APROVACAO.md.
import { abertura, alvoAqui, busca, carregando, disputa, erroDados, lista, mapa, resultado, vazio } from './textos/mapa.ts'
import {
  acessibilidade,
  classificacaoAria,
  compartilhar,
  diaDaVotacao,
  fases,
  ficha,
  meta,
  navegacao,
  paginas,
  rodape,
  sistema,
} from './textos/moldura.ts'

export const textos = {
  meta,
  navegacao,
  abertura,
  mapa,
  busca,
  carregando,
  resultado,
  alvoAqui,
  disputa,
  lista,
  vazio,
  erroDados,
  ficha,
  compartilhar,
  fases,
  diaDaVotacao,
  rodape,
  paginas,
  classificacaoAria,
  acessibilidade,
  sistema,
} as const

export type Textos = typeof textos
export type { DadosDisputa, Manchete } from './textos/mapa.ts'
export type { DadosMensagem } from './textos/moldura.ts'
export type { Apoiado, Nomes, Responsavel } from './textos/tipos.ts'
export { dataHora, dia, prazo } from './textos/formato.ts'
