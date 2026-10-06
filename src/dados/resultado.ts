// Do ponto escolhido ao modelo da tela: regiões no raio, lista ordenada e total do raio.
import { celulasNoRaio } from '../../nucleo/geo.ts'
import { derivar, type CfgMetricas, type Derivadas } from '../../nucleo/metricas.ts'
import { ordenarLista, regioesNoRaio, totalDoRaio, type ItemLista, type RegiaoComDist, type TotalRaio } from '../../nucleo/ranking.ts'
import type { Carregador } from './carregar.ts'

export type Ponto = { readonly lat: number; readonly lon: number }

export type ResultadoPonto = {
  /** Todas as regiões no raio, com e sem resultado. */
  readonly regioes: readonly RegiaoComDist[]
  /** Só as com resultado, do maior "até" para o menor. */
  readonly lista: readonly ItemLista[]
  readonly semResultado: number
  readonly total: TotalRaio
  /** Métricas do total do raio; null quando nenhuma região tem resultado. */
  readonly metricas: Derivadas | null
}

export async function regioesPerto(
  carregador: Carregador,
  centro: Ponto,
  raioKm: number,
  sinal?: AbortSignal,
): Promise<RegiaoComDist[]> {
  const indice = await carregador.indice(sinal)
  const chaves = celulasNoRaio(centro.lat, centro.lon, raioKm, indice.celulaGraus)
  const listas = await Promise.all(chaves.map((c) => carregador.regioesDaCelula(c, sinal)))
  return regioesNoRaio(listas.flat(), centro, raioKm)
}

export function montarResultado(regioes: readonly RegiaoComDist[], cfg: CfgMetricas): ResultadoPonto {
  const lista = ordenarLista(regioes, cfg)
  const total = totalDoRaio(lista)
  return {
    regioes,
    lista,
    semResultado: regioes.length - lista.length,
    total,
    metricas: lista.length === 0 ? null : derivar(total.votos, cfg),
  }
}
