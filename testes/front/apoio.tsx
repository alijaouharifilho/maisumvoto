// Apoio aos testes de componentes: carregador falso e render com os provedores do app.
import { render, type RenderResult } from '@testing-library/react'
import type { ReactNode } from 'react'
import { vi } from 'vitest'
import type { ArquivoCep, ArquivoSecoes, Indice, ItemBusca, Regiao } from '../../nucleo/tipos.ts'
import type { Carregador, PontoLatLon } from '../../src/dados/carregar.ts'
import { ProvedorDados } from '../../src/dados/ProvedorDados.tsx'
import { indiceDe } from './fabrica.ts'

export type CarregadorFalso = { [K in keyof Carregador]: ReturnType<typeof vi.fn<Carregador[K]>> }

export function carregadorFalso(dados: {
  indice?: Indice | Error
  celulas?: Record<string, Regiao[]>
  busca?: Record<string, ItemBusca[]>
  cep?: Record<string, ArquivoCep>
  secoes?: ArquivoSecoes
} = {}): CarregadorFalso {
  const indice = dados.indice ?? indiceDe()
  return {
    indice: vi.fn<Carregador['indice']>(async () => {
      if (indice instanceof Error) throw indice
      return indice
    }),
    regioesDaCelula: vi.fn<Carregador['regioesDaCelula']>(async (chave) => dados.celulas?.[chave] ?? []),
    pontosResumo: vi.fn<Carregador['pontosResumo']>(async (): Promise<PontoLatLon[]> => []),
    pontosQuadrado: vi.fn<Carregador['pontosQuadrado']>(async (): Promise<PontoLatLon[]> => []),
    busca: vi.fn<Carregador['busca']>(async (prefixo) => dados.busca?.[prefixo] ?? []),
    cep: vi.fn<Carregador['cep']>(async (prefixo) => dados.cep?.[prefixo] ?? {}),
    secoes: vi.fn<Carregador['secoes']>(async () => dados.secoes ?? { secoes: {} }),
  }
}

export function comDados(no: ReactNode, carregador: Carregador = carregadorFalso()): RenderResult {
  return render(<ProvedorDados carregador={carregador}>{no}</ProvedorDados>)
}

/** jsdom não implementa rolagem nem media queries: troca por versões inertes (sem animação). */
export function prepararDom(): void {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce'),
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }))
  vi.stubGlobal('scrollTo', () => undefined)
  Element.prototype.scrollIntoView = () => undefined
}
