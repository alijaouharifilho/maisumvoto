import { describe, expect, it } from 'vitest'
import { arredondarLink, formatarAncora, lerAncora, lerHash, montarHash } from '../../nucleo/link.ts'
import { golden } from './golden.ts'

const g = golden.geo.gradeLinkGraus

describe('arredondarLink / formatarAncora (CONTRATO §1)', () => {
  it.each(golden.geo.chaves)('($lat, $lon) → $link', ({ lat, lon, link }) => {
    expect(formatarAncora(lat, lon, g)).toBe(link)
  })

  it('arredonda meio para cima e escreve 3 casas', () => {
    expect(arredondarLink(-25.4284, g)).toBe('-25.430')
    expect(arredondarLink(1.0075, g)).toBe('1.010')
    expect(arredondarLink(-1.0075, g)).toBe('-1.005')
    expect(arredondarLink(0.0025, g)).toBe('0.005')
    expect(arredondarLink(-0.0025, g)).toBe('0.000')
    expect(arredondarLink(0, g)).toBe('0.000')
  })

  it('nunca escreve "-0.000"', () => {
    expect(arredondarLink(-0.001, g)).toBe('0.000')
    expect(arredondarLink(-0, g)).toBe('0.000')
  })
})

describe('lerAncora', () => {
  it('lê o formato gerado', () => {
    expect(lerAncora('@-25.430,-49.275')).toEqual({ lat: -25.43, lon: -49.275 })
  })

  it('aceita sem "@", inteiros e decimais longos', () => {
    expect(lerAncora('-25,-49')).toEqual({ lat: -25, lon: -49 })
    expect(lerAncora('@2.8235,-60.67581')).toEqual({ lat: 2.8235, lon: -60.67581 })
  })

  it('lê a âncora mesmo se o aplicativo codificou "@" e ","', () => {
    expect(lerAncora('%40-25.430%2C-49.275')).toEqual({ lat: -25.43, lon: -49.275 })
  })

  it.each([
    ['', 'vazio'],
    ['@abc,def', 'não numérico'],
    ['@-25.430', 'sem longitude'],
    ['@-125.4,-49.2', 'latitude com 3 dígitos'],
    ['@-35.0,-49.2', 'latitude ao sul do Brasil'],
    ['@5.6,-60.0', 'latitude ao norte do Brasil'],
    ['@-25.0,-75.0', 'longitude a oeste do Brasil'],
    ['@-25.0,-28.0', 'longitude a leste do Brasil'],
    ['@-25.0,-49.0x', 'lixo no fim'],
    ['@-25.,-49.0', 'ponto sem decimais'],
    ['%E0%A4%A', 'codificação quebrada'],
  ])('rejeita %s (%s)', (entrada) => {
    expect(lerAncora(entrada)).toBeNull()
  })

  it('aceita os limites da caixa do Brasil', () => {
    expect(lerAncora('@-34,-74.5')).toEqual({ lat: -34, lon: -74.5 })
    expect(lerAncora('@5.5,-28.5')).toEqual({ lat: 5.5, lon: -28.5 })
  })
})

describe('lerHash', () => {
  it.each([
    ['', { rota: 'mapa', ancora: null }],
    ['#', { rota: 'mapa', ancora: null }],
    ['#/', { rota: 'mapa', ancora: null }],
    ['#/mapa', { rota: 'mapa', ancora: null }],
    ['#/mapa/', { rota: 'mapa', ancora: null }],
    ['#/mapa/@-25.430,-49.275', { rota: 'mapa', ancora: '@-25.430,-49.275' }],
    ['#/prosa/abstencao', { rota: 'prosa', ancora: 'abstencao' }],
    ['#/plano', { rota: 'plano', ancora: null }],
    ['#/comparar', { rota: 'comparar', ancora: null }],
    ['#/comparar/seguranca', { rota: 'comparar', ancora: 'seguranca' }],
    ['#/sobre', { rota: 'sobre', ancora: null }],
    ['#/PROSA', { rota: 'prosa', ancora: null }],
    ['/prosa/nulo', { rota: 'prosa', ancora: 'nulo' }],
    ['#/perto/@-25.430,-49.275', { rota: 'mapa', ancora: null }],
    ['#/xyz', { rota: 'mapa', ancora: null }],
    ['#/mapa/%40-25.430%2C-49.275', { rota: 'mapa', ancora: '@-25.430,-49.275' }],
    ['#/mapa/@-25.430,-49.275?utm=x', { rota: 'mapa', ancora: '@-25.430,-49.275' }],
    ['#/prosa/a/b', { rota: 'prosa', ancora: 'a/b' }],
    ['#/prosa/%E0%A4%A', { rota: 'prosa', ancora: '%E0%A4%A' }],
  ])('%s', (hash, esperado) => {
    expect(lerHash(hash)).toEqual(esperado)
  })
})

describe('montarHash', () => {
  it('sem âncora', () => {
    expect(montarHash('sobre')).toBe('#/sobre')
    expect(montarHash('mapa', null)).toBe('#/mapa')
    expect(montarHash('mapa', '')).toBe('#/mapa')
  })

  it('com âncora, mantendo "@" e "," legíveis', () => {
    expect(montarHash('mapa', '@-25.430,-49.275')).toBe('#/mapa/@-25.430,-49.275')
  })

  it('codifica caracteres fora do conjunto seguro', () => {
    expect(montarHash('prosa', 'a b#c')).toBe('#/prosa/a%20b%23c')
  })

  it('ida e volta com lerHash', () => {
    const hash = montarHash('mapa', formatarAncora(-23.5505, -46.6333, g))
    expect(lerHash(hash)).toEqual({ rota: 'mapa', ancora: '@-23.550,-46.635' })
    expect(lerHash(montarHash('prosa', 'a b#c'))).toEqual({ rota: 'prosa', ancora: 'a b#c' })
  })
})
