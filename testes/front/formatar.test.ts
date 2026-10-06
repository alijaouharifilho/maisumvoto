import { describe, expect, it } from 'vitest'
import { candidatura } from '../../nucleo/candidatura.ts'
import { formatarCep, nomeDoCandidato, nomeProprio, rotuloItemBusca } from '../../src/util/formatar.ts'
import { ancoraDoPonto, linkDoPonto, pontoArredondado } from '../../src/util/link.ts'
import { indiceDe } from './fabrica.ts'

describe('formatação de dados do TSE', () => {
  it('nome em caixa alta vira nome próprio, com partículas minúsculas', () => {
    expect(nomeProprio('JOSÉ DA SILVA')).toBe('José da Silva')
    expect(nomeProprio('  OUTRO   NOME ')).toBe('Outro Nome')
  })

  it('finalistas pelo nome curto da config; os demais pelo índice; sem cadastro, o número', () => {
    const indice = indiceDe()
    expect(nomeDoCandidato(indice, candidatura.alvo.numero)).toBe(candidatura.alvo.nomeCurto)
    expect(nomeDoCandidato(indice, candidatura.adversario.numero)).toBe(candidatura.adversario.nomeCurto)
    expect(nomeDoCandidato(indice, '99')).toBe('Outro Nome')
    expect(nomeDoCandidato(null, '77')).toBe('77')
  })

  it('CEP e rótulos da busca', () => {
    expect(formatarCep('80010000')).toBe('80010-000')
    expect(formatarCep('123')).toBe('123')
    expect(rotuloItemBusca({ n: 'Curitiba', uf: 'PR' })).toBe('Curitiba – PR')
    expect(rotuloItemBusca({ n: 'Centro', m: 'Curitiba', uf: 'PR' })).toBe('Centro, Curitiba – PR')
  })
})

describe('link do ponto', () => {
  it('sempre arredondado à grade da config (nunca o ponto exato)', () => {
    const exato = { lat: -25.42871, lon: -49.27312 }
    expect(ancoraDoPonto(exato)).toBe('@-25.430,-49.275')
    expect(pontoArredondado(exato)).toEqual({ lat: -25.43, lon: -49.275 })
    expect(linkDoPonto('https://exemplo.test/', exato)).toBe('https://exemplo.test/#/mapa/@-25.430,-49.275')
    expect(linkDoPonto('https://exemplo.test', null)).toBe('https://exemplo.test/')
  })
})
