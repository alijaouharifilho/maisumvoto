// vercel.json tem de servir o mesmo que o nginx: cabeçalhos de segurança idênticos a deploy/cabecalhos-seguranca.json
// e a mesma política de cache (assets e dados imutáveis; índice e estilo do mapa com cache curto; HTML sem cache).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const ler = (rel) => JSON.parse(readFileSync(new URL(`../../${rel}`, import.meta.url), 'utf8'))
const vercel = ler('vercel.json')
const seguranca = ler('deploy/cabecalhos-seguranca.json')
const IMUTAVEL = 'public, max-age=31536000, immutable'

/** Cabeçalhos que a Vercel aplicaria a um caminho (todas as regras cujo source casa, na ordem). */
function cabecalhosDe(caminho) {
  const saida = {}
  for (const regra of vercel.headers) {
    if (new RegExp(`^${regra.source}$`).test(caminho)) for (const h of regra.headers) saida[h.key] = h.value
  }
  return saida
}

test('build pela trava de produção, saída em dist, preset Vite', () => {
  assert.equal(vercel.buildCommand, 'node ferramentas/build-vercel.mjs')
  assert.equal(vercel.outputDirectory, 'dist')
  assert.equal(vercel.framework, 'vite')
})

test('todo caminho recebe exatamente os cabeçalhos de segurança do nginx', () => {
  for (const caminho of ['/', '/index.html', '/assets/index-abc.js', '/dados/indice.json', '/dados/celulas/-102_-198.json', '/mapa/estilo.json']) {
    const h = cabecalhosDe(caminho)
    for (const [chave, valor] of Object.entries(seguranca)) assert.equal(h[chave], valor, `${caminho} ${chave}`)
  }
})

test('cache: assets e dados imutáveis; índice 60 s; estilo do mapa 300 s; HTML fica no padrão (sem cache)', () => {
  assert.equal(cabecalhosDe('/assets/index-abc.js')['Cache-Control'], IMUTAVEL)
  assert.equal(cabecalhosDe('/mapa/maplibre-6.12.0/maplibre-gl.mjs')['Cache-Control'], IMUTAVEL)
  assert.equal(cabecalhosDe('/dados/celulas/-102_-198.json')['Cache-Control'], IMUTAVEL)
  assert.equal(cabecalhosDe('/dados/secoes/pr/75353-0001.json')['Cache-Control'], IMUTAVEL)
  assert.equal(cabecalhosDe('/dados/indice.json')['Cache-Control'], 'public, max-age=60')
  assert.equal(cabecalhosDe('/mapa/estilo.json')['Cache-Control'], 'public, max-age=300')
  assert.equal(cabecalhosDe('/')['Cache-Control'], undefined)
  assert.equal(cabecalhosDe('/index.html')['Cache-Control'], undefined)
})

test('nenhum caminho recebe duas regras de Cache-Control (a ordem entre regras não importa)', () => {
  const regrasDeCache = vercel.headers.filter((r) => r.headers.some((h) => h.key === 'Cache-Control'))
  for (const caminho of ['/dados/indice.json', '/dados/celulas/x.json', '/assets/a.js', '/mapa/estilo.json', '/mapa/maplibre-6.12.0/a.mjs']) {
    const casam = regrasDeCache.filter((r) => new RegExp(`^${r.source}$`).test(caminho))
    assert.equal(casam.length, 1, `${caminho}: ${casam.map((r) => r.source).join(', ')}`)
  }
})
