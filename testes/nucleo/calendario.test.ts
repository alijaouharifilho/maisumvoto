import { describe, expect, it } from 'vitest'
import { faseAberta, faseComRelogios, faseEm } from '../../nucleo/calendario.ts'
import { candidatura } from '../../nucleo/candidatura.ts'
import type { Candidatura } from '../../nucleo/tipos.ts'

const cal = candidatura.calendario
const em = (iso: string): number => Date.parse(iso)

describe('faseEm (datas da configuração)', () => {
  it.each([
    ['2026-10-05T20:00:00-03:00', 'campanha'],
    ['2026-10-21T23:59:59-03:00', 'campanha'],
    ['2026-10-22T00:00:00-03:00', 'retaFinal'],
    ['2026-10-24T21:59:59-03:00', 'retaFinal'],
    ['2026-10-24T22:00:00-03:00', 'pausa'],
    ['2026-10-25T00:00:00-03:00', 'votacao'],
    ['2026-10-25T23:00:00-03:00', 'votacao'],
    ['2026-10-26T02:00:00-03:00', 'encerrada'],
    ['2027-01-01T00:00:00-03:00', 'encerrada'],
  ] as const)('%s → %s', (iso, fase) => {
    expect(faseEm(em(iso), cal)).toBe(fase)
  })

  it('o limite é exclusivo: o instante exato já é a fase seguinte (em UTC também)', () => {
    expect(faseEm(em('2026-10-25T01:00:00Z'), cal)).toBe('pausa')
    expect(faseEm(em('2026-10-25T00:59:59.999Z'), cal)).toBe('retaFinal')
  })

  it('se nenhuma fase tem fim aberto, depois da última fica a última', () => {
    const fechado: Candidatura['calendario'] = { ...cal, fases: [{ id: 'campanha', ate: '2026-10-01T00:00:00-03:00' }] }
    expect(faseEm(em('2026-12-01T00:00:00Z'), fechado)).toBe('campanha')
  })

  it('calendário sem fases ou com data inválida é erro explícito', () => {
    expect(() => faseEm(0, { ...cal, fases: [] })).toThrow(/sem fases/)
    expect(() => faseEm(0, { ...cal, fases: [{ id: 'campanha', ate: 'amanhã' }] })).toThrow(/amanhã/)
  })
})

describe('faseAberta', () => {
  it('só as fases listadas em fasesAbertas permitem conversar/marcar', () => {
    expect(faseAberta('campanha', cal)).toBe(true)
    expect(faseAberta('retaFinal', cal)).toBe(true)
    expect(faseAberta('pausa', cal)).toBe(false)
    expect(faseAberta('votacao', cal)).toBe(false)
    expect(faseAberta('encerrada', cal)).toBe(false)
  })
})

describe('faseComRelogios (relógio do aparelho + hora do servidor)', () => {
  it('sem hora do servidor, vale o aparelho', () => {
    expect(faseComRelogios(em('2026-10-20T12:00:00-03:00'), null, cal)).toBe('campanha')
  })

  it('aparelho atrasado em 25/10: o servidor diz votação, vale votação', () => {
    expect(faseComRelogios(em('2026-10-20T12:00:00-03:00'), em('2026-10-25T09:00:00-03:00'), cal)).toBe('votacao')
  })

  it('aparelho adiantado para 26/10 com o servidor em 25/10: continua votação (falha fechada)', () => {
    expect(faseComRelogios(em('2026-10-27T12:00:00-03:00'), em('2026-10-25T09:00:00-03:00'), cal)).toBe('votacao')
  })

  it('fora da votação, vale o relógio mais adiantado', () => {
    expect(faseComRelogios(em('2026-10-20T12:00:00-03:00'), em('2026-10-24T23:00:00-03:00'), cal)).toBe('pausa')
    expect(faseComRelogios(em('2026-10-24T23:00:00-03:00'), em('2026-10-20T12:00:00-03:00'), cal)).toBe('pausa')
  })
})
