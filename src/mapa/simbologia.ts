// Como cada classificação aparece no mapa e na lista. A diferença nunca é só a cor:
// cheio × vazado, ponto no centro e espessura do contorno separam as classes também em preto e branco.
// "folga" (verde-claro, quase o papel) e "difícil" (papel) são opostas e vazadas as duas: o contorno grosso (3 px)
// × fino (1,5 px) as separa sem cor (WCAG 1.4.1; testes/front/mapa.test.ts).
import type { Classificacao } from '../../nucleo/tipos.ts'
import { PALETA } from '../estilo/paleta.ts'

export type Classe = Classificacao | 'semResultado'

export type Simbolo = {
  readonly preenchimento: string
  readonly contorno: string
  readonly largura: number
  /** Ponto no centro: lugares onde a conversa pode mudar o lado (empate, a defender, a virar). */
  readonly centro: boolean
}

export const SIMBOLOGIA: Readonly<Record<Classe, Simbolo>> = {
  folga: { preenchimento: PALETA.mataClara, contorno: PALETA.mata, largura: 3, centro: false },
  alvoNaFrente: { preenchimento: PALETA.mata, contorno: PALETA.branco, largura: 2, centro: false },
  aDefender: { preenchimento: PALETA.mata, contorno: PALETA.branco, largura: 2, centro: true },
  empate: { preenchimento: PALETA.ambar, contorno: PALETA.tinta, largura: 3, centro: true },
  aVirar: { preenchimento: PALETA.papel, contorno: PALETA.petroleo, largura: 3, centro: true },
  dificil: { preenchimento: PALETA.papel, contorno: PALETA.petroleo, largura: 1.5, centro: false },
  semVotos: { preenchimento: PALETA.branco, contorno: PALETA.tintaSuave, largura: 2, centro: false },
  semResultado: { preenchimento: PALETA.branco, contorno: PALETA.mata, largura: 2.5, centro: false },
}

/** Ordem da legenda: primeiro onde a conversa mais pode mudar o resultado. */
export const ORDEM_LEGENDA: readonly Classe[] = ['aVirar', 'aDefender', 'empate', 'alvoNaFrente', 'folga', 'dificil', 'semVotos']

export const CENTRO = { preenchimento: PALETA.ambar, contorno: PALETA.tinta, raio: 3.5, largura: 1.5 } as const

export const SELECIONADA = { contorno: PALETA.tinta, largura: 3.5 } as const

export const RAIO_SEM_RESULTADO = 5.5
const RAIO_MIN = 9
const RAIO_VARIACAO = 14

/** Área proporcional ao "até": raio de 9 a 23 px; maxAte é o "até" da 1ª região da lista. */
export function raioMarcador(ate: number, maxAte: number): number {
  return RAIO_MIN + RAIO_VARIACAO * Math.sqrt(Math.max(ate, 0) / Math.max(maxAte, 1))
}
