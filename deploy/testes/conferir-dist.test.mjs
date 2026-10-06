// ferramentas/conferir-dist.mjs: o que precisa estar certo no dist/ antes de publicar.
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, test } from 'node:test'

import { conferirDist, LIMITE_SECOES_BYTES } from '../../ferramentas/conferir-dist.mjs'

const CLI = fileURLToPath(new URL('../../ferramentas/conferir-dist.mjs', import.meta.url))
// Montados por concatenação para que nenhum varredor de segredos acuse este arquivo.
const CHAVE_AWS_FALSA = 'AKIA' + 'ABCDEFGHIJKLMNOP'
const CABECALHO_PEM = '-----BEGIN ' + 'PRIVATE KEY-----'

let raiz
let dist
const gravar = (rel, conteudo) => writeFileSync(join(dist, rel), conteudo)
const indice = (extra = {}) => JSON.stringify({ esquema: 1, versao: 'a1b2c3d4e5f6', conferencia: { ok: true }, ...extra })

beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), 'muv-conf-'))
  dist = join(raiz, 'dist')
  mkdirSync(join(dist, 'assets'), { recursive: true })
  mkdirSync(join(dist, 'dados', 'secoes', 'pr'), { recursive: true })
  gravar('index.html', '<!doctype html><script type="module" src="/assets/app-abc.js"></script>')
  gravar('assets/app-abc.js', 'export const a = 1;'.repeat(50))
  gravar('dados/indice.json', indice())
  gravar('dados/secoes/pr/75353-0001.json', '{"secoes":{}}')
})
afterEach(() => rmSync(raiz, { recursive: true, force: true }))

const conferir = () => conferirDist(dist, { raizProjeto: raiz })

test('dist correto passa e traz o relatório de tamanho', async () => {
  const r = await conferir()
  assert.deepEqual(r.falhas, [])
  assert.equal(r.totalArquivos, 4)
  assert.ok(r.totalBytes > 0)
  assert.equal(r.maiores[0].caminho, 'assets/app-abc.js')
  assert.ok(r.maiores.length <= 10)
})

test('sem index.html falha', async () => {
  rmSync(join(dist, 'index.html'))
  assert.match((await conferir()).falhas.join('\n'), /index\.html/)
})

test('sem dados/indice.json falha', async () => {
  rmSync(join(dist, 'dados', 'indice.json'))
  assert.match((await conferir()).falhas.join('\n'), /indice\.json/)
})

test('conferencia.ok falso ou versão fora do formato falha', async () => {
  gravar('dados/indice.json', indice({ conferencia: { ok: false } }))
  assert.match((await conferir()).falhas.join('\n'), /conferencia\.ok/)
  gravar('dados/indice.json', indice({ versao: 'abc' }))
  assert.match((await conferir()).falhas.join('\n'), /versao/)
  gravar('dados/indice.json', '{ quebrado')
  assert.match((await conferir()).falhas.join('\n'), /indice\.json/)
})

test('arquivo .map falha', async () => {
  gravar('assets/app-abc.js.map', '{}')
  assert.match((await conferir()).falhas.join('\n'), /app-abc\.js\.map/)
})

test('segredo óbvio falha sem expor o valor', async () => {
  gravar('assets/app-abc.js', `const k="${CHAVE_AWS_FALSA}";`)
  gravar('dados/x.json', JSON.stringify({ k: `${CABECALHO_PEM}\nabc` }))
  const falhas = (await conferir()).falhas.join('\n')
  assert.match(falhas, /assets\/app-abc\.js.*AWS/)
  assert.match(falhas, /dados\/x\.json.*chave privada/)
  assert.equal(falhas.includes(CHAVE_AWS_FALSA), false)
})

test('valor do .env do projeto vazado no bundle falha (só o nome da variável aparece)', async () => {
  writeFileSync(join(raiz, '.env'), '# comentário\nSEGREDO_HMAC=valor-muito-secreto-123\nVAZIA=\nCURTA=abc\n')
  gravar('assets/app-abc.js', 'const s="valor-muito-secreto-123"; const t="abc";')
  const falhas = (await conferir()).falhas
  assert.equal(falhas.length, 1)
  assert.match(falhas[0], /SEGREDO_HMAC/)
  assert.equal(falhas[0].includes('valor-muito-secreto-123'), false)
})

test('CPF formatado em qualquer arquivo falha', async () => {
  gravar('dados/x.json', '{"n":"123.456.789-09"}')
  assert.match((await conferir()).falhas.join('\n'), /CPF/)
})

test('arquivo oculto falha', async () => {
  gravar('.env', 'X=1')
  assert.match((await conferir()).falhas.join('\n'), /oculto/)
})

test('script ou estilo inline no HTML falha (a CSP bloquearia)', async () => {
  gravar('index.html', '<!doctype html><script>alert(1)</script><div style="color:red"></div>')
  const falhas = (await conferir()).falhas.join('\n')
  assert.match(falhas, /script inline/)
  assert.match(falhas, /estilo inline/)
})

test('JSON-LD não conta como script inline', async () => {
  gravar('index.html', '<!doctype html><script type="application/ld+json">{"@type":"WebSite"}</script>')
  assert.deepEqual((await conferir()).falhas, [])
})

test('ignora .br/.gz na varredura e no ranking', async () => {
  gravar('assets/app-abc.js.br', `binario ${CHAVE_AWS_FALSA}`)
  const r = await conferir()
  assert.deepEqual(r.falhas, [])
  assert.equal(r.maiores.some((m) => m.caminho.endsWith('.br')), false)
})

test('arquivo de seções acima de 300 KB é aviso (meta do contrato), não falha', async () => {
  assert.equal(LIMITE_SECOES_BYTES, 300 * 1024)
  gravar('dados/secoes/pr/75353-0001.json', `{"secoes":{"1":"${'x'.repeat(LIMITE_SECOES_BYTES)}"}}`)
  const r = await conferir()
  assert.deepEqual(r.falhas, [])
  assert.match(r.avisos.join('\n'), /75353-0001\.json/)
})

test('CLI: código 0 quando ok e 1 quando falha', () => {
  const ok = spawnSync(process.execPath, [CLI, dist, '--raiz', raiz], { encoding: 'utf8' })
  assert.equal(ok.status, 0, ok.stderr)
  assert.match(ok.stdout, /10 maiores/)
  rmSync(join(dist, 'index.html'))
  const ruim = spawnSync(process.execPath, [CLI, dist, '--raiz', raiz], { encoding: 'utf8' })
  assert.equal(ruim.status, 1)
  assert.match(ruim.stderr, /index\.html/)
})
