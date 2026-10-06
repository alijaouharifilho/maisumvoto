// Manifesto sha256 usado no envio incremental por tar+ssh (sem rsync).
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, test } from 'node:test'

import { diferenca, formatarManifesto, gerarManifesto, lerManifesto } from '../manifesto.mjs'

const CLI = fileURLToPath(new URL('../manifesto.mjs', import.meta.url))
const sha = (texto) => createHash('sha256').update(texto).digest('hex')

let dir
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'muv-manif-'))
  mkdirSync(join(dir, 'dist', 'dados', 'celulas'), { recursive: true })
  writeFileSync(join(dir, 'dist', 'index.html'), '<!doctype html>')
  writeFileSync(join(dir, 'dist', 'dados', 'celulas', '1_2.json'), '[]')
})
afterEach(() => rmSync(dir, { recursive: true, force: true }))

test('gera o manifesto com caminhos "./" e sha256 de cada arquivo', async () => {
  const m = await gerarManifesto(join(dir, 'dist'))
  assert.deepEqual([...m.keys()], ['./dados/celulas/1_2.json', './index.html'])
  assert.equal(m.get('./index.html'), sha('<!doctype html>'))
})

test('formata no mesmo formato do sha256sum, ordenado por caminho', async () => {
  const texto = formatarManifesto(await gerarManifesto(join(dir, 'dist')))
  assert.equal(texto, `${sha('[]')}  ./dados/celulas/1_2.json\n${sha('<!doctype html>')}  ./index.html\n`)
})

test('lê a saída do sha256sum (modo texto e binário) e ignora linhas vazias', () => {
  const m = lerManifesto(`${sha('a')}  ./a.json\n${sha('b')} *./b c.json\n\n`)
  assert.equal(m.get('./a.json'), sha('a'))
  assert.equal(m.get('./b c.json'), sha('b'))
})

test('linha malformada é erro explícito', () => {
  assert.throws(() => lerManifesto('isto não é manifesto\n'), /linha 1/)
})

test('diferença: envia novos e alterados, remove os que sumiram', () => {
  const local = new Map([['./a', sha('1')], ['./b', sha('2-novo')], ['./c', sha('3')]])
  const remoto = new Map([['./a', sha('1')], ['./b', sha('2')], ['./velho', sha('x')]])
  assert.deepEqual(diferenca(local, remoto), { enviar: ['./b', './c'], remover: ['./velho'] })
})

test('diferença sem release anterior envia tudo', () => {
  const local = new Map([['./a', sha('1')]])
  assert.deepEqual(diferenca(local, new Map()), { enviar: ['./a'], remover: [] })
})

test('CLI gerar + diferenca grava as listas', () => {
  const g = spawnSync(process.execPath, [CLI, 'gerar', join(dir, 'dist')], { encoding: 'utf8' })
  assert.equal(g.status, 0, g.stderr)
  writeFileSync(join(dir, 'local.sha256'), g.stdout)
  writeFileSync(join(dir, 'remoto.sha256'), `${sha('[]')}  ./dados/celulas/1_2.json\n${sha('x')}  ./sumiu.json\n`)
  const args = ['diferenca', 'local.sha256', 'remoto.sha256', 'enviar.txt', 'remover.txt'].map((a, i) => (i ? join(dir, a) : a))
  const d = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf8' })
  assert.equal(d.status, 0, d.stderr)
  assert.equal(readFileSync(join(dir, 'enviar.txt'), 'utf8'), './index.html\n')
  assert.equal(readFileSync(join(dir, 'remover.txt'), 'utf8'), './sumiu.json\n')
})

test('CLI com subcomando desconhecido dá código 2', () => {
  assert.equal(spawnSync(process.execPath, [CLI, 'xpto'], { encoding: 'utf8' }).status, 2)
})
