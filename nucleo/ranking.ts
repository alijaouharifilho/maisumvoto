// Regiões no raio, lista ordenada, agrupamento por bairro e total do raio.
import { haversineKm } from './geo.ts'
import { derivar, somarVotos, type CfgMetricas, type Derivadas } from './metricas.ts'
import type { Regiao, Votos } from './tipos.ts'

export type RegiaoComDist = Regiao & { dist: number }

export type ItemLista = RegiaoComDist & { votos: Votos; metricas: Derivadas }

export type GrupoBairro = {
  chave: string
  uf: string
  municipio: string
  bairro: string
  ate: number
  eleitores: number
  dist: number
  regioes: number
  itens: ItemLista[]
}

export type TotalRaio = { votos: Votos; eleitores: number; regioes: number }

export function regioesNoRaio(
  regioes: readonly Regiao[],
  centro: { lat: number; lon: number },
  raioKm: number,
): RegiaoComDist[] {
  return regioes
    .map((r) => ({ ...r, dist: haversineKm(centro, r) }))
    .filter((r) => r.dist <= raioKm)
}

function temVotos(r: RegiaoComDist): r is RegiaoComDist & { votos: Votos } {
  return r.votos !== null
}

// Só regiões com votos; "até" decrescente e, no empate, a mais perto primeiro.
export function ordenarLista(regioes: readonly RegiaoComDist[], cfg: CfgMetricas): ItemLista[] {
  return regioes
    .filter(temVotos)
    .map((r) => ({ ...r, metricas: derivar(r.votos, cfg) }))
    .sort((x, y) => y.metricas.ate - x.metricas.ate || x.dist - y.dist)
}

function novoGrupo(chave: string, r: ItemLista): GrupoBairro {
  return { chave, uf: r.uf, municipio: r.municipio, bairro: r.bairro, ate: 0, eleitores: 0, dist: r.dist, regioes: 0, itens: [] }
}

function somarAoGrupo(g: GrupoBairro, r: ItemLista): GrupoBairro {
  return {
    ...g,
    ate: g.ate + r.metricas.ate,
    eleitores: g.eleitores + r.eleitores,
    dist: Math.min(g.dist, r.dist),
    regioes: g.regioes + 1,
    itens: [...g.itens, r],
  }
}

export function agruparPorBairro(lista: readonly ItemLista[]): { bairros: GrupoBairro[]; semBairro: number } {
  const grupos = new Map<string, GrupoBairro>()
  let semBairro = 0
  for (const r of lista) {
    if (r.bairro.trim() === '') {
      semBairro += 1
      continue
    }
    const chave = `${r.uf}|${r.municipio}|${r.bairro}`
    grupos.set(chave, somarAoGrupo(grupos.get(chave) ?? novoGrupo(chave, r), r))
  }
  const bairros = [...grupos.values()].sort((x, y) => y.ate - x.ate || x.dist - y.dist)
  return { bairros, semBairro }
}

// Votos somados das regiões com boletim; eleitores de todas as regiões recebidas.
export function totalDoRaio(lista: readonly Pick<Regiao, 'votos' | 'eleitores'>[]): TotalRaio {
  const votos = lista.flatMap((r) => (r.votos === null ? [] : [r.votos]))
  return {
    votos: somarVotos(votos),
    eleitores: lista.reduce((s, r) => s + r.eleitores, 0),
    regioes: votos.length,
  }
}
