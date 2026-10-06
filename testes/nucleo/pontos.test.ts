import { describe, expect, it } from 'vitest'
import { decodificarPontos } from '../../nucleo/pontos.ts'

describe('decodificarPontos (CONTRATO §2.3)', () => {
  it('soma acumulada dividida pela escala, em [lat, lon]', () => {
    // pontos (-25.428, -49.273), (-25.427, -49.280), (-25.000, -49.000) com escala 1000
    const d = [-25428, -49273, 1, -7, 427, 280]
    expect(decodificarPontos({ escala: 1000, d })).toEqual([
      [-25.428, -49.273],
      [-25.427, -49.28],
      [-25, -49],
    ])
  })

  it('escala 20 do resumo', () => {
    expect(decodificarPontos({ escala: 20, d: [-509, -985, 0, 1] })).toEqual([
      [-25.45, -49.25],
      [-25.45, -49.2],
    ])
  })

  it('lista vazia', () => {
    expect(decodificarPontos({ escala: 1000, d: [] })).toEqual([])
  })

  it('quantidade ímpar ou escala inválida é erro explícito', () => {
    expect(() => decodificarPontos({ escala: 1000, d: [1, 2, 3] })).toThrow(RangeError)
    expect(() => decodificarPontos({ escala: 0, d: [] })).toThrow(RangeError)
  })
})
