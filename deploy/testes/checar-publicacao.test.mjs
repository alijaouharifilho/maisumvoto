// Portão de publicação (ferramentas/checar-publicacao.mjs): responsável, hospedagem, conferência dos dados e a
// aprovação humana dos textos (APROVACAO.md inteiro marcado e assinado).
import assert from 'node:assert/strict'
import { test } from 'node:test'
import { falhasDaAprovacao, falhasDaPublicacao } from '../../ferramentas/checar-publicacao.mjs'

// Aprovação incompleta: um item sem marcar e a assinatura em branco (o arquivo real já está assinado).
const APROVACAO_INCOMPLETA = '# Aprovação\n\n- [x] item 1\n- [ ] item 2\n\nAprovado por: ______  Data: ____/____/2026\n'
const CFG_OK = { site: { responsavel: { nome: 'Fulana de Tal', contato: 'contato@exemplo.org' }, hospedagem: 'Provedor X (Brasil)' } }
const APROVADO = '# Aprovação\n\n- [x] item 1\n  - [x] item 2\n\nAprovado por: Fulana de Tal  Data: 20/10/2026\n'

test('tudo preenchido, conferido e aprovado: passa', () => {
  assert.deepEqual(falhasDaPublicacao({ cfg: CFG_OK, indice: { conferencia: { ok: true } }, aprovacao: APROVADO }), [])
})

test('responsável e hospedagem preenchidos não bastam: APROVACAO.md incompleta bloqueia', () => {
  const falhas = falhasDaPublicacao({ cfg: CFG_OK, indice: { conferencia: { ok: true } }, aprovacao: APROVACAO_INCOMPLETA })
  assert.ok(falhas.some((f) => /itens sem marcar/.test(f)), falhas.join('\n'))
  assert.ok(falhas.some((f) => /Aprovado por/.test(f)), falhas.join('\n'))
})

test('item indentado sem marcar também conta', () => {
  assert.match(falhasDaAprovacao('- [x] a\n  - [ ] b\nAprovado por: Fulana  Data: 20/10/2026')[0] ?? '', /1 itens sem marcar/)
})

test('"Aprovado por" ou "Data" só com sublinhados bloqueia', () => {
  assert.equal(falhasDaAprovacao('- [x] a\nAprovado por: ______  Data: ____/____/2026').length, 1)
  assert.equal(falhasDaAprovacao('- [x] a\nAprovado por: Fulana  Data: ____/____/2026').length, 1)
  assert.equal(falhasDaAprovacao('- [x] a\nAprovado por: ______  Data: 20/10/2026').length, 1)
  assert.equal(falhasDaAprovacao('- [x] a').length, 1)
})

test('config sem responsável, sem hospedagem, sem índice ou com conferência falha: cada um vira uma falha', () => {
  const cfg = { site: { responsavel: { nome: null, contato: null }, hospedagem: null } }
  const falhas = falhasDaPublicacao({ cfg, indice: null, aprovacao: APROVADO })
  assert.equal(falhas.length, 4)
  assert.equal(falhasDaPublicacao({ cfg: CFG_OK, indice: { conferencia: { ok: false } }, aprovacao: APROVADO }).length, 1)
  assert.equal(falhasDaPublicacao({ cfg: CFG_OK, indice: { conferencia: { ok: true } }, aprovacao: null }).length, 1)
})
