// Regras do congelamento de deploy no período eleitoral (deploy/CONGELAMENTO.md).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

import { avaliarCongelamento, formatarBrasilia, janelaCongelamento, MARGEM_ULTIMO_DEPLOY_MS } from '../congelamento.mjs'

const CONFIG_REAL = JSON.parse(readFileSync(new URL('../../config/candidatura.json', import.meta.url), 'utf8'))

const CALENDARIO = Object.freeze({
  fuso: '-03:00',
  fases: [
    { id: 'campanha', ate: '2026-10-22T00:00:00-03:00' },
    { id: 'retaFinal', ate: '2026-10-24T22:00:00-03:00' },
    { id: 'pausa', ate: '2026-10-25T00:00:00-03:00' },
    { id: 'votacao', ate: '2026-10-26T02:00:00-03:00' },
    { id: 'encerrada', ate: null },
  ],
  fasesAbertas: ['campanha', 'retaFinal'],
})

const JANELA = janelaCongelamento(CALENDARIO)
const em = (iso) => avaliarCongelamento(new Date(iso), JANELA).estado

test('janela vai do fim da última fase aberta até o fim da última fase com data', () => {
  assert.equal(JANELA.inicio.toISOString(), '2026-10-25T01:00:00.000Z')
  assert.equal(JANELA.fim.toISOString(), '2026-10-26T05:00:00.000Z')
})

test('margem do último deploy é de 2 horas', () => {
  assert.equal(MARGEM_ULTIMO_DEPLOY_MS, 2 * 60 * 60 * 1000)
})

test('livre antes das 20h do último dia aberto', () => {
  assert.equal(em('2026-10-24T19:59:59-03:00'), 'livre')
  assert.equal(em('2026-10-10T12:00:00-03:00'), 'livre')
})

test('entre 20h e 22h do último dia aberto é a margem (bloqueia)', () => {
  assert.equal(em('2026-10-24T20:00:00-03:00'), 'margem')
  assert.equal(em('2026-10-24T21:59:59-03:00'), 'margem')
})

test('de 22h de 24/10 até 02h de 26/10 está congelado (início inclusivo, fim exclusivo)', () => {
  assert.equal(em('2026-10-24T22:00:00-03:00'), 'congelado')
  assert.equal(em('2026-10-25T12:00:00-03:00'), 'congelado')
  assert.equal(em('2026-10-26T01:59:59-03:00'), 'congelado')
  assert.equal(em('2026-10-26T02:00:00-03:00'), 'livre')
})

test('a avaliação traz uma mensagem com o horário de Brasília', () => {
  const r = avaliarCongelamento(new Date('2026-10-25T12:00:00-03:00'), JANELA)
  assert.match(r.mensagem, /24\/10\/2026.*22:00/)
  assert.match(r.mensagem, /26\/10\/2026.*02:00/)
})

test('formata em America/Sao_Paulo', () => {
  assert.equal(formatarBrasilia(new Date('2026-10-25T01:00:00Z')), '24/10/2026 22:00')
})

test('calendário inválido falha fechado', () => {
  assert.throws(() => janelaCongelamento({ ...CALENDARIO, fasesAbertas: [] }), /fasesAbertas/)
  assert.throws(() => janelaCongelamento({ ...CALENDARIO, fases: [] }), /fases/)
  assert.throws(
    () => janelaCongelamento({ ...CALENDARIO, fases: [{ id: 'campanha', ate: 'amanhã' }, { id: 'x', ate: null }] }),
    /data inválida/,
  )
  const invertido = {
    fasesAbertas: ['campanha'],
    fases: [
      { id: 'campanha', ate: '2026-10-26T00:00:00-03:00' },
      { id: 'votacao', ate: '2026-10-25T00:00:00-03:00' },
      { id: 'encerrada', ate: null },
    ],
  }
  assert.throws(() => janelaCongelamento(invertido), /início/)
})

test('lê o calendário real de config/candidatura.json', () => {
  const janela = janelaCongelamento(CONFIG_REAL.calendario)
  assert.equal(formatarBrasilia(janela.inicio), '24/10/2026 22:00')
  assert.equal(formatarBrasilia(janela.fim), '26/10/2026 02:00')
})
