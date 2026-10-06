import { describe, expect, it } from 'vitest'
import {
  cercaDe,
  contagem,
  formatarDistancia,
  formatarNumero,
  formatarPct,
  fracaoHumana,
  listaHumana,
  nomeLocal,
  nomeRegiao,
  plural,
} from '../../nucleo/frases.ts'
import { regiao } from './fabrica.ts'

describe('fracaoHumana (com porcentagem nos extremos)', () => {
  it.each([
    [0.5, '1 em cada 2', 1],
    [0.25, '1 em cada 4', 1],
    [0.1, '1 em cada 10', 1],
    [0.3, 'quase 1 em cada 3', 1],
    [0.36, 'mais de 1 em cada 3', 1],
    [0.7, 'mais de 2 em cada 3', 2],
    [0.81, '4 em cada 5', 4],
    [0.57, 'quase 3 em cada 5', 3],
    [0.43, 'mais de 2 em cada 5', 2],
    [0.86, '6 em cada 7', 6],
    [0.55, '5 em cada 9', 5],
    [0.08, 'quase 1 em cada 10', 1],
    [0.92, 'mais de 9 em cada 10', 9],
  ])('%f → "%s"', (t, texto, numerador) => {
    expect(fracaoHumana(t)).toEqual({ texto, numerador })
  })

  it.each([
    [0.03, '3%', 3],
    [0.0799, '8%', 8],
    [0.921, '92%', 92],
    [0.95, '95%', 95],
    [0.01, '1%', 1],
    [0.004, 'menos de 1%', 1],
    [0.996, 'mais de 99%', 99],
    [0, '0%', 0],
    [1, '100%', 100],
  ])('extremo %f vira porcentagem "%s"', (t, texto, numerador) => {
    expect(fracaoHumana(t)).toEqual({ texto, numerador })
  })

  it('fora de [0, 1] é limitado ao intervalo', () => {
    expect(fracaoHumana(1.3).texto).toBe('100%')
    expect(fracaoHumana(-0.2).texto).toBe('0%')
  })

  it('valor não finito é erro explícito', () => {
    expect(() => fracaoHumana(Number.NaN)).toThrow(RangeError)
    expect(() => fracaoHumana(Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

describe('cercaDe', () => {
  it.each([
    [0, '0'],
    [7, '7'],
    [19, '19'],
    [20, 'cerca de 20'],
    [24, 'cerca de 20'],
    [25, 'cerca de 30'],
    [999, 'cerca de 1.000'],
    [1049, 'cerca de 1.000'],
    [1050, 'cerca de 1.100'],
    [47913428, 'cerca de 47.913.400'],
  ])('%i → "%s"', (n, texto) => {
    expect(cercaDe(n)).toBe(texto)
  })

  it('negativo ou não finito é erro explícito', () => {
    expect(() => cercaDe(-1)).toThrow(RangeError)
    expect(() => cercaDe(Number.NaN)).toThrow(RangeError)
  })
})

describe('formatarDistancia', () => {
  it.each([
    [0, '50 m'],
    [0.123, '100 m'],
    [0.974, '950 m'],
    [0.976, '1 km'],
    [1.5, '1,5 km'],
    [2.6, '2,6 km'],
  ])('%f km → "%s"', (km, texto) => {
    expect(formatarDistancia(km)).toBe(texto)
  })

  it('negativo ou não finito é erro explícito', () => {
    expect(() => formatarDistancia(-0.1)).toThrow(RangeError)
    expect(() => formatarDistancia(Number.NaN)).toThrow(RangeError)
  })
})

describe('formatarNumero / formatarPct', () => {
  it('separador de milhar e decimal do pt-BR', () => {
    expect(formatarNumero(47913428)).toBe('47.913.428')
    expect(formatarNumero(1234.5)).toBe('1.234,5')
    expect(formatarNumero(-0)).toBe('0')
  })

  it('percentual inteiro arredondado', () => {
    expect(formatarPct(0.5454545454545454)).toBe('55%')
    expect(formatarPct(0)).toBe('0%')
    expect(formatarPct(-0.001)).toBe('0%')
    expect(formatarPct(1)).toBe('100%')
  })
})

describe('listaHumana / plural / contagem', () => {
  it('lista com vírgulas e "e"', () => {
    expect(listaHumana([])).toBe('')
    expect(listaHumana(['a'])).toBe('a')
    expect(listaHumana(['a', 'b'])).toBe('a e b')
    expect(listaHumana(['a', 'b', 'c'])).toBe('a, b e c')
  })

  it('singular só para 1', () => {
    expect(plural(1, 'voto', 'votos')).toBe('voto')
    expect(plural(-1, 'voto', 'votos')).toBe('voto')
    expect(plural(0, 'voto', 'votos')).toBe('votos')
    expect(plural(2, 'voto', 'votos')).toBe('votos')
  })

  it('contagem junta número formatado e palavra concordando', () => {
    expect(contagem(1, 'pessoa', 'pessoas')).toBe('1 pessoa')
    expect(contagem(1234, 'pessoa', 'pessoas')).toBe('1.234 pessoas')
  })
})

describe('nomeRegiao / nomeLocal', () => {
  it('região: "bairro, município" ou só município', () => {
    expect(nomeRegiao(regiao({ id: 'x', bairro: 'Batel', municipio: 'Curitiba' }))).toBe('Batel, Curitiba')
    expect(nomeRegiao(regiao({ id: 'x', bairro: '', municipio: 'Curitiba' }))).toBe('Curitiba')
    expect(nomeRegiao(regiao({ id: 'x', bairro: '  ', municipio: 'Curitiba' }))).toBe('Curitiba')
  })

  it('local: 1º local e "e mais N"', () => {
    const local = { nome: 'Escola B', endereco: '', cep: '', zona: 1, nr: 2, secoes: [] }
    const base = regiao({ id: 'x' })
    expect(nomeLocal(base)).toBe('Escola A')
    expect(nomeLocal({ ...base, locais: [...base.locais, local, local] })).toBe('Escola A e mais 2')
  })

  it('sem locais, usa o nome da região', () => {
    expect(nomeLocal(regiao({ id: 'x', locais: [], bairro: 'Batel' }))).toBe('Batel, Curitiba')
  })
})
