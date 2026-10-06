import { describe, expect, expectTypeOf, it } from 'vitest'
import type { z } from 'zod/mini'
import {
  esquemaBusca,
  esquemaCandidatura,
  esquemaCep,
  esquemaIndice,
  esquemaPontos,
  esquemaRegioes,
  esquemaRegrasBusca,
  esquemaSecoes,
} from '../../nucleo/esquemas.ts'
import type {
  ArquivoCep,
  ArquivoSecoes,
  Candidatura,
  Indice,
  ItemBusca,
  PontosCompactos,
  Regiao,
  RegrasBusca,
} from '../../nucleo/tipos.ts'
import { regiao, votosDe } from './fabrica.ts'

// Achata interseções (ex.: TotaisBrasil = Totais & {...}) para comparar só a forma.
type Plano<T> = T extends object ? { [K in keyof T]: Plano<T[K]> } : T
type Saida<E extends z.ZodMiniType> = Plano<z.output<E>>

describe('esquemas espelham nucleo/tipos.ts', () => {
  it('tipos de saída idênticos (checado pelo tsc)', () => {
    expectTypeOf<Saida<typeof esquemaCandidatura>>().toEqualTypeOf<Plano<Candidatura>>()
    expectTypeOf<Saida<typeof esquemaRegrasBusca>>().toEqualTypeOf<Plano<RegrasBusca>>()
    expectTypeOf<Saida<typeof esquemaIndice>>().toEqualTypeOf<Plano<Indice>>()
    expectTypeOf<Saida<typeof esquemaRegioes>>().toEqualTypeOf<Plano<Regiao[]>>()
    expectTypeOf<Saida<typeof esquemaPontos>>().toEqualTypeOf<Plano<PontosCompactos>>()
    expectTypeOf<Saida<typeof esquemaSecoes>>().toEqualTypeOf<Plano<ArquivoSecoes>>()
    expectTypeOf<Saida<typeof esquemaBusca>>().toEqualTypeOf<Plano<ItemBusca[]>>()
    expectTypeOf<Saida<typeof esquemaCep>>().toEqualTypeOf<Plano<ArquivoCep>>()
    // E os valores validados são atribuíveis aos tipos do contrato sem conversão
    expectTypeOf(esquemaIndice.parse).returns.toExtend<Indice>()
    expectTypeOf(esquemaRegioes.parse).returns.toExtend<Regiao[]>()
  })

  it('o achatamento não esconde diferença real (sanidade do teste de tipos)', () => {
    expectTypeOf<Plano<{ a: number }>>().not.toEqualTypeOf<Plano<{ a: string }>>()
    expectTypeOf<Plano<{ a?: number }>>().not.toEqualTypeOf<Plano<{ a: number }>>()
    expectTypeOf<Plano<{ a: 'x' | 'y' }>>().not.toEqualTypeOf<Plano<{ a: string }>>()
  })
})

function indiceValido(): Indice {
  const totais = { secoes: 1, aptos: 10, comparecimento: 8, abstencao: 2, brancos: 1, nulos: 1, nominais: { '22': 3, '13': 3 } }
  return {
    esquema: 1,
    versao: 'a1b2c3d4e5f6',
    geradoEm: '2026-10-06T12:00:00Z',
    eleicao: { codigo: '6257', pleito: '3220', turno: 1, cargo: '1' },
    celulaGraus: 0.25,
    candidatos: { '22': { nome: 'A', partido: 'P1' }, '13': { nome: 'B', partido: 'P2' } },
    brasil: {
      ...totais,
      regioes: 1,
      regioesNoMapa: 1,
      ate: 2,
      classificacao: { semVotos: 0, empate: 1, folga: 0, aDefender: 0, alvoNaFrente: 0, aVirar: 0, dificil: 0 },
      viraveis: { abertos: 0, abertosMaisOutros: 0 },
      eleitoresForaDoMapa: { presoProvisorio: 0, votoEmTransito: 0 },
    },
    exterior: { ...totais, nominais: {} },
    ufs: { PR: { secoes: 1, aptos: 10, regioes: 1, regioesNoMapa: 1, eleitoresSemPosicao: 0, eleitoresPosicaoReserva: 0, eleitoresForaDoMapa: { presoProvisorio: 0, votoEmTransito: 0 }, ate: 2 } },
    quadrados: ['-26_-50'],
    conferencia: { ok: true, referencia: 'resultados.tse.jus.br EA20', diferencas: [] },
    fontes: [{ id: 'votacao_secao', url: 'https://cdn.tse.jus.br/x.zip', dataGeracao: '05/10/2026 13:58:00', sha256: 'f'.repeat(64) }],
  }
}

describe('esquemaIndice', () => {
  it('aceita o exemplo do contrato', () => {
    expect(esquemaIndice.parse(indiceValido())).toEqual(indiceValido())
  })

  it.each([
    ['esquema diferente de 1', { esquema: 2 }],
    ['versão fora de 12 hex', { versao: 'XYZ' }],
    ['geradoEm sem data', { geradoEm: 'ontem' }],
    ['quadrado mal formado', { quadrados: ['26-50'] }],
    ['celulaGraus zero', { celulaGraus: 0 }],
    ['candidato com número de 3 dígitos', { candidatos: { '222': { nome: 'A', partido: 'P' } } }],
  ])('rejeita %s', (_nome, troca) => {
    expect(esquemaIndice.safeParse({ ...indiceValido(), ...troca }).success).toBe(false)
  })

  it('exige os dois motivos de fora do mapa e recusa motivo desconhecido', () => {
    const i = indiceValido()
    const semTransito = { presoProvisorio: 3 }
    expect(esquemaIndice.safeParse({ ...i, brasil: { ...i.brasil, eleitoresForaDoMapa: semTransito } }).success).toBe(false)
    const comOutro = { presoProvisorio: 3, votoEmTransito: 4, hospital: 1 }
    expect(esquemaIndice.safeParse({ ...i, brasil: { ...i.brasil, eleitoresForaDoMapa: comOutro } }).success).toBe(false)
    const negativo = { presoProvisorio: -1, votoEmTransito: 0 }
    expect(esquemaIndice.safeParse({ ...i, brasil: { ...i.brasil, eleitoresForaDoMapa: negativo } }).success).toBe(false)
  })

  it('exige todas as classes em classificacao', () => {
    const i = indiceValido()
    const { dificil: _, ...semDificil } = i.brasil.classificacao
    expect(esquemaIndice.safeParse({ ...i, brasil: { ...i.brasil, classificacao: semDificil } }).success).toBe(false)
  })
})

describe('esquemaRegioes', () => {
  it('aceita regiões com e sem votos', () => {
    const lista = [regiao({ id: 'pr-75353-0001-1015' }), regiao({ id: 'pr-75353-0001-1023', votos: null, bairro: '' })]
    expect(esquemaRegioes.parse(lista)).toEqual(lista)
  })

  it.each([
    ['id fora do formato', { id: 'PR-75353-1-1015' }],
    ['mun com 4 dígitos', { mun: '7535' }],
    ['uf minúscula', { uf: 'pr' }],
    ['posição desconhecida', { posicao: 'cnefe' }],
    ['voto negativo', { votos: votosDe({ brancos: -1 }) }],
    ['voto fracionário', { votos: votosDe({ nulos: 1.5 }) }],
    ['nominal com chave inválida', { votos: votosDe({ nominais: { x: 1 } }) }],
  ])('rejeita %s', (_nome, troca) => {
    expect(esquemaRegioes.safeParse([{ ...regiao({ id: 'pr-75353-0001-1015' }), ...troca }]).success).toBe(false)
  })

  it('descarta campos que o contrato não conhece', () => {
    const [r] = esquemaRegioes.parse([{ ...regiao({ id: 'pr-75353-0001-1015' }), extra: 1 }])
    expect(r).not.toHaveProperty('extra')
  })
})

describe('esquemaPontos', () => {
  it('aceita pares inteiros', () => {
    expect(esquemaPontos.parse({ escala: 1000, d: [1, 2, 3, 4] })).toEqual({ escala: 1000, d: [1, 2, 3, 4] })
  })

  it('rejeita quantidade ímpar, não inteiros e escala não positiva', () => {
    expect(esquemaPontos.safeParse({ escala: 1000, d: [1, 2, 3] }).success).toBe(false)
    expect(esquemaPontos.safeParse({ escala: 1000, d: [1.5, 2] }).success).toBe(false)
    expect(esquemaPontos.safeParse({ escala: 0, d: [] }).success).toBe(false)
  })
})

describe('esquemaSecoes', () => {
  const secao = { aptos: 300, comparecimento: 240, brancos: 3, nulos: 5, nominais: { '22': 100, '13': 132 } }

  it('aceita seções sem zero à esquerda', () => {
    expect(esquemaSecoes.parse({ secoes: { '123': secao } })).toEqual({ secoes: { '123': secao } })
  })

  it('rejeita chave com zero à esquerda', () => {
    expect(esquemaSecoes.safeParse({ secoes: { '0123': secao } }).success).toBe(false)
  })
})

describe('esquemaBusca', () => {
  const item: ItemBusca = { t: 'b', n: 'Batel', m: 'Curitiba', uf: 'PR', lat: -25.44, lon: -49.29, e: 30000 }

  it('aceita item com e sem município', () => {
    const municipio: ItemBusca = { t: 'm', n: 'Curitiba', uf: 'PR', lat: -25.4, lon: -49.3, e: 1000000 }
    expect(esquemaBusca.parse([item, municipio])).toEqual([item, municipio])
  })

  it('rejeita tipo desconhecido e nome vazio', () => {
    expect(esquemaBusca.safeParse([{ ...item, t: 'x' }]).success).toBe(false)
    expect(esquemaBusca.safeParse([{ ...item, n: '' }]).success).toBe(false)
  })
})

describe('esquemaCep', () => {
  const valor = { lat: -25.43, lon: -49.27, m: 'Curitiba', uf: 'PR', b: 'Centro' }

  it('aceita CEP de 8 dígitos', () => {
    expect(esquemaCep.parse({ '80010000': valor })).toEqual({ '80010000': valor })
  })

  it('rejeita CEP com hífen ou curto', () => {
    expect(esquemaCep.safeParse({ '80010-000': valor }).success).toBe(false)
    expect(esquemaCep.safeParse({ '8001000': valor }).success).toBe(false)
  })
})
