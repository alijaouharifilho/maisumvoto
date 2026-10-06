// Trava do build de produção na Vercel (ferramentas/build-vercel.mjs): portão de publicação + congelamento eleitoral.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import { motivosParaBloquear } from '../../ferramentas/build-vercel.mjs'

const CFG_REAL = JSON.parse(readFileSync(new URL('../../config/candidatura.json', import.meta.url), 'utf8'))
const CFG_PRONTA = { ...CFG_REAL, site: { ...CFG_REAL.site, responsavel: { nome: 'Fulana de Tal', contato: 'contato@exemplo.org' }, hospedagem: 'Provedor X' } }
const INDICE_OK = { conferencia: { ok: true } }
const APROVADO = '- [x] tudo\n\nAprovado por: Fulana de Tal  Data: 20/10/2026\n'
const ANTES = new Date('2026-10-10T12:00:00-03:00')
const CONGELADO = new Date('2026-10-25T09:00:00-03:00')
const DEPOIS = new Date('2026-10-26T03:00:00-03:00')

const pronto = (ambiente, agora, extra = {}) =>
  motivosParaBloquear({ ambiente, agora, cfg: CFG_PRONTA, indice: INDICE_OK, aprovacao: APROVADO, ...extra })

test('prévia e build local nunca bloqueiam, mesmo sem responsável nem assinatura', () => {
  for (const ambiente of ['preview', 'development', 'local']) {
    assert.deepEqual(motivosParaBloquear({ ambiente, agora: CONGELADO, cfg: CFG_REAL, indice: null, aprovacao: null }), [])
  }
})

test('produção com tudo pronto e fora do congelamento: monta', () => {
  assert.deepEqual(pronto('production', ANTES), [])
  assert.deepEqual(pronto('production', DEPOIS), [])
})

test('produção sem responsável e com aprovação incompleta: bloqueia e diz por quê', () => {
  const semResponsavel = { ...CFG_REAL, site: { ...CFG_REAL.site, responsavel: { nome: null, contato: null } } }
  const aprovacaoIncompleta = '- [x] um\n- [ ] dois\n\nAprovado por: ______  Data: ____/____/2026\n'
  const motivos = motivosParaBloquear({ ambiente: 'production', agora: ANTES, cfg: semResponsavel, indice: INDICE_OK, aprovacao: aprovacaoIncompleta })
  assert.ok(motivos.some((m) => /responsavel\.nome/.test(m)), motivos.join('\n'))
  assert.ok(motivos.some((m) => /itens sem marcar/.test(m)), motivos.join('\n'))
  assert.ok(motivos.some((m) => /Aprovado por/.test(m)), motivos.join('\n'))
})

test('produção durante o congelamento (24/10 22h a 26/10 2h): bloqueia, salvo emergência declarada', () => {
  const motivos = pronto('production', CONGELADO)
  assert.equal(motivos.length, 1)
  assert.match(motivos[0], /congelado/i)
  assert.deepEqual(pronto('production', CONGELADO, { ignorarCongelamento: true }), [])
})

test('produção nas 2 h antes do congelamento (24/10, 20h a 22h): bloqueia', () => {
  const motivos = pronto('production', new Date('2026-10-24T21:00:00-03:00'))
  assert.equal(motivos.length, 1)
  assert.match(motivos[0], /último deploy era até/)
  assert.deepEqual(pronto('production', new Date('2026-10-24T19:59:00-03:00')), [])
})

test('dados não conferidos com o resultado oficial bloqueiam a produção', () => {
  const motivos = pronto('production', ANTES, { indice: { conferencia: { ok: false } } })
  assert.ok(motivos.some((m) => /conferencia\.ok/.test(m)), motivos.join('\n'))
})
