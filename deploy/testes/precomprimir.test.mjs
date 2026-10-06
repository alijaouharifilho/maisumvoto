// ferramentas/precomprimir.mjs: .br e .gz ao lado dos arquivos de texto do dist/.
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import { afterEach, beforeEach, test } from 'node:test'

import { precomprimir, TAMANHO_MINIMO } from '../../ferramentas/precomprimir.mjs'

const CLI = fileURLToPath(new URL('../../ferramentas/precomprimir.mjs', import.meta.url))
const textoGrande = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ id: i, nome: `local ${i}` })))

let dist
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'muv-precomp-'))
  mkdirSync(join(dist, 'assets'))
  mkdirSync(join(dist, 'dados', 'celulas'), { recursive: true })
  writeFileSync(join(dist, 'index.html'), `<!doctype html><title>t</title>${'<p>texto</p>'.repeat(200)}`)
  writeFileSync(join(dist, 'assets', 'app-abc.js'), `export const x = ${textoGrande(100)}`)
  writeFileSync(join(dist, 'assets', 'app-abc.css'), 'body{margin:0}'.repeat(100))
  writeFileSync(join(dist, 'dados', 'celulas', '1_2.json'), textoGrande(300))
  writeFileSync(join(dist, 'dados', 'pequeno.json'), '{"a":1}')
  writeFileSync(join(dist, 'assets', 'fonte.woff2'), randomBytes(4000))
})
afterEach(() => rmSync(dist, { recursive: true, force: true }))

test('tamanho mínimo é 1 KB', () => {
  assert.equal(TAMANHO_MINIMO, 1024)
})

test('gera .br e .gz que descomprimem para o original', async () => {
  const r = await precomprimir(dist)
  for (const rel of ['index.html', 'assets/app-abc.js', 'assets/app-abc.css', 'dados/celulas/1_2.json']) {
    const original = readFileSync(join(dist, rel))
    assert.deepEqual(brotliDecompressSync(readFileSync(join(dist, `${rel}.br`))), original, rel)
    assert.deepEqual(gunzipSync(readFileSync(join(dist, `${rel}.gz`))), original, rel)
  }
  assert.equal(r.elegiveis, 4)
  assert.equal(r.gerados, 8)
})

test('pula arquivos menores que 1 KB e extensões fora da lista', async () => {
  await precomprimir(dist)
  assert.equal(existsSync(join(dist, 'dados', 'pequeno.json.br')), false)
  assert.equal(existsSync(join(dist, 'assets', 'fonte.woff2.br')), false)
  assert.equal(existsSync(join(dist, 'assets', 'fonte.woff2.gz')), false)
})

test('é idempotente: a segunda rodada não reescreve nada', async () => {
  await precomprimir(dist)
  const br = join(dist, 'dados', 'celulas', '1_2.json.br')
  const antes = statSync(br).mtimeMs
  const r = await precomprimir(dist)
  assert.equal(r.gerados, 0)
  assert.equal(r.mantidos, 8)
  assert.equal(statSync(br).mtimeMs, antes)
  assert.equal(existsSync(`${br}.br`), false, 'não comprime o que já é comprimido')
})

test('regera quando o original mudou', async () => {
  await precomprimir(dist)
  const alvo = join(dist, 'dados', 'celulas', '1_2.json')
  writeFileSync(alvo, textoGrande(400))
  const r = await precomprimir(dist)
  assert.equal(r.gerados, 2)
  assert.deepEqual(brotliDecompressSync(readFileSync(`${alvo}.br`)), readFileSync(alvo))
})

test('não grava (e apaga o antigo) quando comprimir não reduz o tamanho', async () => {
  const alvo = join(dist, 'dados', 'aleatorio.json')
  writeFileSync(alvo, randomBytes(3000))
  writeFileSync(`${alvo}.gz`, 'velho')
  await precomprimir(dist)
  assert.equal(existsSync(`${alvo}.br`), false)
  assert.equal(existsSync(`${alvo}.gz`), false)
})

test('CLI: diretório inexistente dá código 1', () => {
  const r = spawnSync(process.execPath, [CLI, join(dist, 'nao-existe')], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /não existe/)
})

test('CLI: imprime o resumo', () => {
  const r = spawnSync(process.execPath, [CLI, dist], { encoding: 'utf8' })
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /4 arquivos elegíveis/)
})
