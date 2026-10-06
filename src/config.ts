// Valores derivados da configuração única (config/candidatura.json), prontos para a interface.
// Nenhum nome ou número de candidato é escrito aqui: tudo vem da config validada pelo núcleo.
import { candidatura, regrasBusca } from '../nucleo/candidatura.ts'
import { formatarDistancia } from '../nucleo/frases.ts'
import { cfgMetricas } from '../nucleo/metricas.ts'
import type { Rota } from '../nucleo/link.ts'
import { fimConversa } from './conteudo/modelo.ts'
import { dia, type Apoiado, type Nomes } from './conteudo/textos.ts'

export { candidatura, regrasBusca }

export const CFG = cfgMetricas(candidatura)

export const NOMES: Nomes = { alvo: candidatura.alvo.nomeCurto, adversario: candidatura.adversario.nomeCurto }

export const APOIADO: Apoiado = { nome: candidatura.alvo.nomeCurto, numero: candidatura.alvo.numero }

export const NOME_SITE = candidatura.site.nome

export const RAIO_KM = candidatura.metricas.raioKm

export const RAIO_TEXTO = formatarDistancia(RAIO_KM)

export const GRADE_LINK = candidatura.metricas.gradeLinkGraus

/** "sábado, 24/10, às 22h": fim da última fase aberta do calendário. */
export const FIM_CONVERSA = fimConversa(candidatura)

/** "domingo, 25/10". */
export const DIA_2T = dia(candidatura.eleicao.data2T)

/** Ponto de quebra único do layout (o mesmo de --breakpoint-lg em tokens.css). */
export const LARGURA_DESKTOP_PX = 960

/** Rotas na ordem da navegação. */
export const ORDEM_ROTAS: readonly Rota[] = ['mapa', 'prosa', 'plano', 'sobre']

export const CHAVE_ARMAZENAMENTO = (nome: string): string => `${candidatura.prefixoArmazenamento}-${nome}`

/** id do <main>: destino do link "pular para o conteúdo". */
export const ID_CONTEUDO = 'conteudo'
