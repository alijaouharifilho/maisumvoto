// @vitest-environment jsdom
// Relógio da fase: o cabeçalho Date do servidor vale como piso, com falha fechada no dia da votação (E2/E3).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { agoraDoServidor, esquecerHoraDoServidor, faseAgora, registrarHoraDoServidor } from '../../src/relogio.ts'

afterEach(() => {
  esquecerHoraDoServidor()
  vi.useRealTimers()
})

describe('relógio da fase', () => {
  it('sem hora do servidor, vale o aparelho', () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T12:00:00-03:00') })
    expect(faseAgora().fase).toBe('campanha')
    expect(agoraDoServidor()).toBeNull()
  })

  it('aparelho com data atrasada em 25/10: a hora do servidor põe a tela do dia da votação', () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T12:00:00-03:00') })
    registrarHoraDoServidor('Sun, 25 Oct 2026 12:00:00 GMT')
    expect(faseAgora()).toEqual({ fase: 'votacao', aberta: false })
  })

  it('cabeçalho ausente ou ilegível não muda nada', () => {
    vi.useFakeTimers({ now: new Date('2026-10-20T12:00:00-03:00') })
    registrarHoraDoServidor(null)
    registrarHoraDoServidor('ontem')
    expect(agoraDoServidor()).toBeNull()
    expect(faseAgora().fase).toBe('campanha')
  })
})
