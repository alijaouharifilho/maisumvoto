import { describe, expect, it } from 'vitest'
import { haversineKm } from '../../nucleo/geo.ts'
import type { CfgMetricas } from '../../nucleo/metricas.ts'
import { agruparPorBairro, ordenarLista, regioesNoRaio, totalDoRaio } from '../../nucleo/ranking.ts'
import { regiao, votosDe } from './fabrica.ts'

const cfg: CfgMetricas = { alvo: '22', adversario: '13', limiarFolga: 0.65, regraViravel: 'abertosMaisOutros' }
const centro = { lat: -25.4284, lon: -49.2733 }

describe('regioesNoRaio', () => {
  const perto = regiao({ id: 'pr-75353-0001-0001', lat: -25.4374, lon: -49.2733 }) // ~1,0008 km
  const dentro = regiao({ id: 'pr-75353-0001-0002', lat: -25.4300, lon: -49.2733 })
  const fora = regiao({ id: 'pr-75353-0001-0003', lat: -25.45, lon: -49.2733 })

  it('fica com dist ≤ raio e anota a distância haversine', () => {
    const r = regioesNoRaio([perto, dentro, fora], centro, 1.001)
    expect(r.map((x) => x.id)).toEqual([perto.id, dentro.id])
    expect(r[1]?.dist).toBe(haversineKm(centro, dentro))
  })

  it('o limite é inclusivo', () => {
    const d = haversineKm(centro, perto)
    expect(regioesNoRaio([perto], centro, d)).toHaveLength(1)
  })

  it('não muta as regiões', () => {
    regioesNoRaio([dentro], centro, 1)
    expect('dist' in dentro).toBe(false)
  })
})

describe('ordenarLista', () => {
  const a = { ...regiao({ id: 'a', votos: votosDe({ abstencao: 10, nominais: { '22': 1, '13': 1 } }) }), dist: 0.5 }
  const b = { ...regiao({ id: 'b', votos: votosDe({ abstencao: 30, nominais: { '22': 1, '13': 1 } }) }), dist: 0.9 }
  const c = { ...regiao({ id: 'c', votos: votosDe({ abstencao: 25, brancos: 5, nominais: { '22': 1 } }) }), dist: 0.2 }
  const semVotos = { ...regiao({ id: 's', votos: null }), dist: 0.1 }

  it('só regiões com votos, "até" decrescente e, no empate, mais perto primeiro', () => {
    const r = ordenarLista([a, semVotos, b, c], cfg)
    expect(r.map((x) => x.id)).toEqual(['c', 'b', 'a'])
  })

  it('anota as métricas derivadas com a configuração', () => {
    const [primeira] = ordenarLista([a], cfg)
    expect(primeira?.metricas.ate).toBe(10)
    expect(primeira?.metricas.classificacao).toBe('empate')
  })

  it('não reordena a lista recebida', () => {
    const lista = [a, b, c]
    ordenarLista(lista, cfg)
    expect(lista.map((x) => x.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('agruparPorBairro', () => {
  const r1 = { ...regiao({ id: 'r1', bairro: 'Centro', eleitores: 100, votos: votosDe({ abstencao: 10 }) }), dist: 0.7 }
  const r2 = { ...regiao({ id: 'r2', bairro: 'Centro', eleitores: 50, votos: votosDe({ abstencao: 5 }) }), dist: 0.3 }
  const r3 = { ...regiao({ id: 'r3', bairro: 'Batel', eleitores: 80, votos: votosDe({ abstencao: 15 }) }), dist: 0.9 }
  const r4 = { ...regiao({ id: 'r4', bairro: 'Ahú', eleitores: 10, votos: votosDe({ abstencao: 15 }) }), dist: 0.4 }
  const r5 = { ...regiao({ id: 'r5', bairro: '  ', eleitores: 999, votos: votosDe({ abstencao: 99 }) }), dist: 0.1 }
  const r6 = { ...regiao({ id: 'r6', bairro: 'Centro', municipio: 'Pinhais', mun: '75000', votos: votosDe({ abstencao: 1 }) }), dist: 0.8 }

  it('soma "até" e eleitores, guarda a menor distância e conta as regiões', () => {
    const lista = ordenarLista([r1, r2, r3, r4, r5, r6], cfg)
    const { bairros, semBairro } = agruparPorBairro(lista)
    expect(semBairro).toBe(1)
    // Os três primeiros empatam em 15: decide a menor distância (0,3 / 0,4 / 0,9)
    expect(bairros.map((b) => b.chave)).toEqual(['PR|Curitiba|Centro', 'PR|Curitiba|Ahú', 'PR|Curitiba|Batel', 'PR|Pinhais|Centro'])
    const centroCuritiba = bairros.find((b) => b.chave === 'PR|Curitiba|Centro')
    expect(centroCuritiba).toMatchObject({ uf: 'PR', municipio: 'Curitiba', bairro: 'Centro', ate: 15, eleitores: 150, dist: 0.3, regioes: 2 })
    expect(centroCuritiba?.itens.map((i) => i.id)).toEqual(['r1', 'r2'])
  })

  it('empate de "até" no bairro: menor distância primeiro', () => {
    const { bairros } = agruparPorBairro(ordenarLista([r3, r4], cfg))
    expect(bairros.map((b) => b.bairro)).toEqual(['Ahú', 'Batel'])
  })

  it('lista vazia', () => {
    expect(agruparPorBairro([])).toEqual({ bairros: [], semBairro: 0 })
  })
})

describe('totalDoRaio', () => {
  it('soma os votos das regiões com votos e os eleitores de todas', () => {
    const lista = [
      regiao({ id: 'x', eleitores: 100, votos: votosDe({ aptos: 90, abstencao: 10, brancos: 1, nominais: { '22': 5 } }) }),
      regiao({ id: 'y', eleitores: 50, votos: votosDe({ aptos: 50, abstencao: 5, nominais: { '22': 1, '13': 2 } }) }),
      regiao({ id: 'z', eleitores: 30, votos: null }),
    ]
    expect(totalDoRaio(lista)).toEqual({
      votos: votosDe({ aptos: 140, abstencao: 15, brancos: 1, nominais: { '22': 6, '13': 2 } }),
      eleitores: 180,
      regioes: 2,
    })
  })

  it('sem regiões', () => {
    expect(totalDoRaio([])).toEqual({ votos: votosDe({}), eleitores: 0, regioes: 0 })
  })
})
