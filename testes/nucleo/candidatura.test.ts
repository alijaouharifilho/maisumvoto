import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { candidatura, regrasBusca, validarConfig } from '../../nucleo/candidatura.ts'
import { esquemaCandidatura, esquemaRegrasBusca } from '../../nucleo/esquemas.ts'

const RAIZ = join(import.meta.dirname, '..', '..')

function lerJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(RAIZ, rel), 'utf8')) as Record<string, unknown>
}

describe('candidatura (config/candidatura.json validada na carga)', () => {
  it('carrega a configuração do repositório', () => {
    const bruto = lerJson('config/candidatura.json')
    expect(candidatura.esquema).toBe(1)
    expect(candidatura.alvo).toEqual(bruto['alvo'])
    expect(candidatura.adversario).toEqual(bruto['adversario'])
    expect(candidatura.alvo.numero).not.toBe(candidatura.adversario.numero)
  })

  it('não carrega chaves fora do tipo (ex.: $schema)', () => {
    expect(candidatura).not.toHaveProperty('$schema')
  })

  it('é imutável', () => {
    expect(Object.isFrozen(candidatura)).toBe(true)
    expect(Object.isFrozen(candidatura.alvo)).toBe(true)
    expect(Object.isFrozen(candidatura.calendario.fases)).toBe(true)
  })

  it('regrasBusca carrega config/busca.json', () => {
    const bruto = lerJson('config/busca.json')
    expect(regrasBusca.tamanhoPrefixo).toBe(bruto['tamanhoPrefixo'])
    expect(regrasBusca.genericas).toEqual(bruto['genericas'])
    expect(regrasBusca).not.toHaveProperty('descricao')
    expect(Object.isFrozen(regrasBusca.genericas)).toBe(true)
  })
})

describe('validarConfig — erro claro quando a configuração é inválida', () => {
  const valida = lerJson('config/candidatura.json')

  it('aponta o arquivo e o campo', () => {
    const invalida = { ...valida, metricas: { ...(valida['metricas'] as object), raioKm: -1 } }
    expect(() => validarConfig(esquemaCandidatura, invalida, 'config/candidatura.json')).toThrow(
      /config\/candidatura\.json[\s\S]*metricas\.raioKm/,
    )
  })

  it.each([
    ['alvo igual ao adversário', (c: Record<string, unknown>) => ({ ...c, adversario: c['alvo'] }), /adversario/],
    [
      'fases fora de ordem',
      (c: Record<string, unknown>) => ({
        ...c,
        calendario: {
          ...(c['calendario'] as object),
          fases: [
            { id: 'campanha', ate: '2026-10-24T22:00:00-03:00' },
            { id: 'retaFinal', ate: '2026-10-22T00:00:00-03:00' },
            { id: 'encerrada', ate: null },
          ],
        },
      }),
      /calendario\.fases/,
    ],
    [
      'fim aberto antes da última fase',
      (c: Record<string, unknown>) => ({
        ...c,
        calendario: {
          ...(c['calendario'] as object),
          fases: [
            { id: 'campanha', ate: null },
            { id: 'encerrada', ate: null },
          ],
        },
      }),
      /calendario\.fases/,
    ],
    [
      'fase aberta que não existe',
      (c: Record<string, unknown>) => ({
        ...c,
        calendario: {
          ...(c['calendario'] as object),
          fases: [{ id: 'encerrada', ate: null }],
          fasesAbertas: ['campanha'],
        },
      }),
      /fasesAbertas/,
    ],
    ['número de candidato com 3 dígitos', (c: Record<string, unknown>) => ({ ...c, alvo: { ...(c['alvo'] as object), numero: '222' } }), /alvo\.numero/],
    ['data com fuso ausente', (c: Record<string, unknown>) => ({ ...c, calendario: { ...(c['calendario'] as object), fases: [{ id: 'encerrada', ate: '2026-10-25T00:00:00' }] } }), /calendario\.fases/],
  ])('rejeita %s', (_nome, alterar, caminho) => {
    expect(() => validarConfig(esquemaCandidatura, alterar(valida), 'config/candidatura.json')).toThrow(caminho)
  })

  it('regras de busca: prefixo precisa ser ≥ 1 e genéricas em minúsculas normalizadas', () => {
    const busca = lerJson('config/busca.json')
    expect(() => validarConfig(esquemaRegrasBusca, { ...busca, tamanhoPrefixo: 0 }, 'config/busca.json')).toThrow(/tamanhoPrefixo/)
    expect(() => validarConfig(esquemaRegrasBusca, { ...busca, genericas: ['São'] }, 'config/busca.json')).toThrow(/genericas/)
  })

  it('devolve cópia congelada do valor válido', () => {
    const r = validarConfig(esquemaRegrasBusca, lerJson('config/busca.json'), 'config/busca.json')
    expect(Object.isFrozen(r)).toBe(true)
  })
})
