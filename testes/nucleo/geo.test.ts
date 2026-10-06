import { describe, expect, it } from 'vitest'
import { celulasNoRaio, chaveCelula, chaveQuadrado, circuloGeoJSON, haversineKm } from '../../nucleo/geo.ts'
import { golden } from './golden.ts'

const { celulaGraus } = golden.geo

describe('haversineKm (CONTRATO §4)', () => {
  it.each(golden.geo.haversineKm)('$de → $para = $km km', ({ de, para, km }) => {
    expect(haversineKm(de, para)).toBeCloseTo(km, 12)
  })

  it('aceita {lat, lon} e [lat, lon] com o mesmo resultado', () => {
    const a = { lat: -25.4284, lon: -49.2733 }
    const b = { lat: -25.4374, lon: -49.2733 }
    expect(haversineKm(a, b)).toBe(haversineKm([a.lat, a.lon], [b.lat, b.lon]))
  })

  it('é zero no mesmo ponto e simétrica', () => {
    const a = { lat: -23.5505, lon: -46.6333 }
    const b = { lat: -22.9068, lon: -43.1729 }
    expect(haversineKm(a, a)).toBe(0)
    expect(haversineKm(a, b)).toBe(haversineKm(b, a))
  })
})

describe('chaves de célula e quadrado (CONTRATO §1)', () => {
  it.each(golden.geo.chaves)('($lat, $lon) → $celula / $quadrado', ({ lat, lon, celula, quadrado }) => {
    expect(chaveCelula(lat, lon, celulaGraus)).toBe(celula)
    expect(chaveQuadrado(lat, lon)).toBe(quadrado)
  })

  it('borda exata da célula pertence à célula de cima', () => {
    expect(chaveCelula(-25.25, -49.5, 0.25)).toBe('-101_-198')
  })

  it('nunca escreve "-0"', () => {
    expect(chaveCelula(-0, -0, 0.25)).toBe('0_0')
    expect(chaveQuadrado(-0, 0.5)).toBe('0_0')
  })
})

describe('celulasNoRaio', () => {
  it('ponto no meio da célula toca só ela', () => {
    // Centro de -102_-198: lat -25.375, lon -49.375
    expect(celulasNoRaio(-25.375, -49.375, 1, celulaGraus)).toEqual(['-102_-198'])
  })

  it('ponto perto do canto toca as 4 células, em ordem (i, j)', () => {
    // (-25.5, -49.5) é o canto entre as linhas -103/-102 e as colunas -199/-198
    expect(celulasNoRaio(-25.4999, -49.4999, 1, celulaGraus)).toEqual([
      '-103_-199',
      '-103_-198',
      '-102_-199',
      '-102_-198',
    ])
  })

  it('cobre toda região dentro do raio (amostragem do círculo)', () => {
    const lat = -25.2502
    const lon = -49.0001
    const celulas = new Set(celulasNoRaio(lat, lon, 1, celulaGraus))
    const circulo = circuloGeoJSON(lat, lon, 0.999, 128)
    for (const [lo, la] of circulo.geometry.coordinates[0] ?? []) {
      expect(celulas.has(chaveCelula(la, lo, celulaGraus))).toBe(true)
    }
  })

  it('raio inválido é erro explícito', () => {
    expect(() => celulasNoRaio(0, 0, -1, celulaGraus)).toThrow(RangeError)
    expect(() => celulasNoRaio(0, 0, 1, 0)).toThrow(RangeError)
  })
})

describe('circuloGeoJSON', () => {
  it('anel fechado com passos + 1 vértices, todos à distância do raio, em [lon, lat]', () => {
    const lat = -25.4284
    const lon = -49.2733
    const f = circuloGeoJSON(lat, lon, 1)
    const anel = f.geometry.coordinates[0] ?? []
    expect(f.type).toBe('Feature')
    expect(f.geometry.type).toBe('Polygon')
    expect(anel).toHaveLength(65)
    expect(anel[0]).toEqual(anel[64])
    for (const [lo, la] of anel) expect(haversineKm({ lat, lon }, { lat: la, lon: lo })).toBeCloseTo(1, 9)
  })

  it('respeita o número de passos', () => {
    expect(circuloGeoJSON(0, 0, 2, 8).geometry.coordinates[0]).toHaveLength(9)
  })

  it('parâmetros inválidos são erro explícito', () => {
    expect(() => circuloGeoJSON(0, 0, 1, 2)).toThrow(RangeError)
    expect(() => circuloGeoJSON(0, 0, 1, 3.5)).toThrow(RangeError)
    expect(() => circuloGeoJSON(0, 0, 0)).toThrow(RangeError)
  })
})
