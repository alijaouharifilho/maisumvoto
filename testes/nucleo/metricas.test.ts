import { describe, expect, it } from 'vitest'
import { candidatura } from '../../nucleo/candidatura.ts'
import { cfgMetricas, derivar, parcelas, somarVotos, type CfgMetricas } from '../../nucleo/metricas.ts'
import type { Votos } from '../../nucleo/tipos.ts'
import { golden } from './golden.ts'

const base: Omit<CfgMetricas, 'regraViravel'> = {
  alvo: golden.alvo,
  adversario: golden.adversario,
  limiarFolga: golden.limiarFolga,
}

describe('derivar — casos golden (CONTRATO §3)', () => {
  it.each(golden.metricas)('$caso', ({ votos, regra, esperado }) => {
    // Arrange
    const cfg: CfgMetricas = { ...base, regraViravel: regra }
    // Act
    const r = derivar(votos, cfg)
    // Assert
    expect(r.validos).toBe(esperado.validos)
    expect(r.alvo).toBe(esperado.alvo)
    expect(r.adversario).toBe(esperado.adversario)
    expect(r.outros).toBe(esperado.outros)
    expect(r.abertos).toBe(esperado.abertos)
    expect(r.ate).toBe(esperado.ate)
    expect(r.pctAlvo).toBe(esperado.pctAlvo)
    expect(r.classificacao).toBe(esperado.classificacao)
    expect(r.viravel).toBe(esperado.viravel)
  })
})

describe('derivar — regras', () => {
  const cfg: CfgMetricas = { ...base, regraViravel: 'abertos' }

  it('reservatório é só abertos na regra estrita e abertos + outros na ampla', () => {
    const votos = { brancos: 1, nulos: 2, abstencao: 3, nominais: { '22': 10, '13': 20, '70': 4 } }
    expect(derivar(votos, cfg).reservatorio).toBe(6)
    expect(derivar(votos, { ...cfg, regraViravel: 'abertosMaisOutros' }).reservatorio).toBe(10)
  })

  it('número ausente em nominais conta como zero', () => {
    const r = derivar({ brancos: 0, nulos: 0, abstencao: 0, nominais: { '70': 5 } }, cfg)
    expect(r.alvo).toBe(0)
    expect(r.adversario).toBe(0)
    expect(r.outros).toBe(5)
    expect(r.classificacao).toBe('empate')
  })

  it('folga vale no limiar exato (≥)', () => {
    const r = derivar({ brancos: 0, nulos: 0, abstencao: 0, nominais: { '22': 65, '13': 35 } }, { ...cfg, limiarFolga: 0.65 })
    expect(r.pctAlvo).toBe(0.65)
    expect(r.classificacao).toBe('folga')
  })

  it('aVirar na regra estrita quando abertos superam a diferença', () => {
    const r = derivar({ brancos: 5, nulos: 5, abstencao: 51, nominais: { '22': 100, '13': 160 } }, cfg)
    expect(r.classificacao).toBe('aVirar')
    expect(r.viravel).toBe(true)
  })

  it('não muta a entrada', () => {
    const votos = Object.freeze({ brancos: 1, nulos: 1, abstencao: 1, nominais: Object.freeze({ '22': 1 }) })
    expect(() => derivar(votos, cfg)).not.toThrow()
  })
})

function votos(parcial: Partial<Votos>): Votos {
  return { aptos: 0, comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, nominais: {}, ...parcial }
}

describe('somarVotos', () => {
  it('lista vazia dá zeros', () => {
    expect(somarVotos([])).toEqual(votos({}))
  })

  it('soma campo a campo e une os nominais', () => {
    const a = votos({ aptos: 10, comparecimento: 8, abstencao: 2, brancos: 1, nulos: 1, nominais: { '22': 3, '13': 3 } })
    const b = votos({ aptos: 5, comparecimento: 5, abstencao: 0, brancos: 0, nulos: 2, nominais: { '22': 1, '70': 2 } })
    expect(somarVotos([a, b])).toEqual({
      aptos: 15,
      comparecimento: 13,
      abstencao: 2,
      brancos: 1,
      nulos: 3,
      nominais: { '22': 4, '13': 3, '70': 2 },
    })
  })

  it('não muta as entradas', () => {
    const a = votos({ nominais: { '22': 1 } })
    const b = votos({ nominais: { '22': 2 } })
    somarVotos([a, b])
    expect(a.nominais).toEqual({ '22': 1 })
    expect(b.nominais).toEqual({ '22': 2 })
  })
})

describe('parcelas do "até"', () => {
  const cfg = { alvo: '22', adversario: '13', gruposConversa: candidatura.gruposConversa }

  it('fixas + candidatos com grupo + outros agregados, sem zeros, em ordem decrescente', () => {
    const r = parcelas(
      { brancos: 10, nulos: 0, abstencao: 100, nominais: { '22': 300, '13': 200, '70': 50, '30': 5, '44': 7, '50': 3 } },
      cfg,
    )
    expect(r).toEqual([
      { chave: 'abstencao', grupo: 'abstencao', valor: 100 },
      { chave: '70', numero: '70', grupo: 'cury', valor: 50 },
      { chave: 'brancos', grupo: 'branco', valor: 10 },
      { chave: 'outros', valor: 10 },
      { chave: '30', numero: '30', grupo: 'zema', valor: 5 },
    ])
  })

  it('a soma das parcelas é o "até"', () => {
    const v = { brancos: 3, nulos: 4, abstencao: 5, nominais: { '22': 9, '13': 9, '55': 2, '99': 1 } }
    const soma = parcelas(v, cfg).reduce((s, p) => s + p.valor, 0)
    expect(soma).toBe(derivar(v, { ...cfg, limiarFolga: 0.65, regraViravel: 'abertos' }).ate)
  })

  it('fixa sem grupo configurado sai sem o campo grupo', () => {
    const r = parcelas({ brancos: 2, nulos: 1, abstencao: 0, nominais: {} }, { ...cfg, gruposConversa: {} })
    expect(r).toEqual([
      { chave: 'brancos', valor: 2 },
      { chave: 'nulos', valor: 1 },
    ])
  })

  it('alvo e adversário nunca viram parcela, mesmo se estiverem em gruposConversa', () => {
    const r = parcelas(
      { brancos: 0, nulos: 0, abstencao: 0, nominais: { '22': 5, '13': 5 } },
      { ...cfg, gruposConversa: { '22': 'x', '13': 'y' } },
    )
    expect(r).toEqual([])
  })

  it('empate de valor mantém a ordem de montagem (fixas antes dos candidatos)', () => {
    const r = parcelas({ brancos: 4, nulos: 4, abstencao: 4, nominais: { '14': 4 } }, cfg)
    expect(r.map((p) => p.chave)).toEqual(['brancos', 'nulos', 'abstencao', '14'])
  })
})

describe('cfgMetricas', () => {
  it('extrai da candidatura o que derivar e parcelas precisam', () => {
    expect(cfgMetricas(candidatura)).toEqual({
      alvo: candidatura.alvo.numero,
      adversario: candidatura.adversario.numero,
      limiarFolga: candidatura.metricas.limiarFolga,
      regraViravel: candidatura.metricas.regraViravel,
      gruposConversa: candidatura.gruposConversa,
    })
  })
})
