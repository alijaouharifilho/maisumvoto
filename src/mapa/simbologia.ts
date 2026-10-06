// Como cada classificação aparece no mapa e na lista. A cor diz quem ficou à frente no local no 1º turno:
// verde = candidato apoiado, vermelho = adversário, âmbar = empate. Como vermelho e verde se confundem para
// quem tem daltonismo, a cor nunca está sozinha: o verde tem contorno branco e o vermelho, contorno escuro
// (diferença de luminosidade visível em preto e branco), e o ponto âmbar no centro marca onde a conversa pode
// mudar o lado (WCAG 1.4.1; testes/front/mapa.test.ts).
import type { Classificacao } from '../../nucleo/tipos.ts'
import { PALETA } from '../estilo/paleta.ts'

export type Classe = Classificacao | 'semResultado'

export type Simbolo = {
  readonly preenchimento: string
  readonly contorno: string
  readonly largura: number
  /** Ponto no centro: lugares onde a conversa pode mudar o lado (a defender, a virar). */
  readonly centro: boolean
}

const ALVO_A_FRENTE: Simbolo = { preenchimento: PALETA.mata, contorno: PALETA.branco, largura: 2, centro: false }
const ADVERSARIO_A_FRENTE: Simbolo = { preenchimento: PALETA.adversario, contorno: PALETA.tinta, largura: 2.5, centro: false }
const SEM_VOTOS: Simbolo = { preenchimento: PALETA.branco, contorno: PALETA.tintaSuave, largura: 2, centro: false }

export const SIMBOLOGIA: Readonly<Record<Classe, Simbolo>> = {
  folga: ALVO_A_FRENTE,
  alvoNaFrente: ALVO_A_FRENTE,
  aDefender: { ...ALVO_A_FRENTE, centro: true },
  empate: { preenchimento: PALETA.ambar, contorno: PALETA.tinta, largura: 2.5, centro: false },
  aVirar: { ...ADVERSARIO_A_FRENTE, centro: true },
  dificil: ADVERSARIO_A_FRENTE,
  semVotos: SEM_VOTOS,
  semResultado: SEM_VOTOS,
}

/** Entradas da legenda: uma por símbolo diferente (classes com o mesmo símbolo dividem a entrada). */
export type GrupoLegenda = 'adversarioVirar' | 'alvoDefender' | 'empate' | 'alvoFrente' | 'adversarioFrente' | 'semVotos'

export const GRUPO_DA_CLASSE: Readonly<Record<Classificacao, GrupoLegenda>> = {
  aVirar: 'adversarioVirar',
  aDefender: 'alvoDefender',
  empate: 'empate',
  alvoNaFrente: 'alvoFrente',
  folga: 'alvoFrente',
  dificil: 'adversarioFrente',
  semVotos: 'semVotos',
}

/** Classe usada para desenhar a miniatura de cada entrada da legenda. */
export const CLASSE_DO_GRUPO: Readonly<Record<GrupoLegenda, Classe>> = {
  adversarioVirar: 'aVirar',
  alvoDefender: 'aDefender',
  empate: 'empate',
  alvoFrente: 'alvoNaFrente',
  adversarioFrente: 'dificil',
  semVotos: 'semVotos',
}

/** Ordem da legenda: primeiro onde a conversa mais pode mudar o resultado. */
export const ORDEM_LEGENDA: readonly GrupoLegenda[] = ['adversarioVirar', 'alvoDefender', 'empate', 'alvoFrente', 'adversarioFrente', 'semVotos']

export const CENTRO = { preenchimento: PALETA.ambar, contorno: PALETA.tinta, raio: 3.5, largura: 1.5 } as const

export const SELECIONADA = { contorno: PALETA.tinta, largura: 3.5 } as const

export const RAIO_SEM_RESULTADO = 5.5
const RAIO_MIN = 9
const RAIO_VARIACAO = 14

/** Área proporcional ao "até": raio de 9 a 23 px; maxAte é o "até" da 1ª região da lista. */
export function raioMarcador(ate: number, maxAte: number): number {
  return RAIO_MIN + RAIO_VARIACAO * Math.sqrt(Math.max(ate, 0) / Math.max(maxAte, 1))
}
