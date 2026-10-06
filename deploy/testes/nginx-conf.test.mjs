// Guarda estática do deploy/nginx.conf. A validação de sintaxe e de comportamento real
// fica em deploy/validar-nginx.sh (Docker); aqui só o que um erro de digitação quebraria calado.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

const ler = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8')
const CONF = ler('../nginx.conf')
  .split('\n')
  .map((l) => l.replace(/(^|\s)#.*$/, ''))
  .join('\n')
const CABECALHOS = JSON.parse(ler('../cabecalhos-seguranca.json'))
const CONFIG = JSON.parse(ler('../../config/candidatura.json'))

function blocos(texto, abertura) {
  const saida = []
  let inicio = texto.search(abertura)
  while (inicio !== -1) {
    const chave = texto.indexOf('{', inicio)
    let profundidade = 0
    let i = chave
    for (; i < texto.length; i += 1) {
      if (texto[i] === '{') profundidade += 1
      if (texto[i] === '}') profundidade -= 1
      if (profundidade === 0) break
    }
    saida.push(texto.slice(inicio, i + 1))
    const resto = texto.slice(i + 1).search(abertura)
    inicio = resto === -1 ? -1 : i + 1 + resto
  }
  return saida
}

const servidorPrincipal = () => {
  const nome = `server_name ${CONFIG.site.dominio};`
  const s = blocos(CONF, /\bserver\s*\{/).find((b) => b.includes(nome) && b.includes('listen 443'))
  assert.ok(s, 'server principal (HTTPS do domínio canônico) não encontrado')
  return s
}

test('cada cabeçalho de segurança do JSON está no server principal com o mesmo valor', () => {
  const s = servidorPrincipal()
  for (const [nome, valor] of Object.entries(CABECALHOS)) {
    assert.ok(s.includes(`add_header ${nome} "${valor}" always;`), `${nome} ausente ou diferente`)
  }
})

test('nenhum add_header dentro de location (senão os do server deixam de valer ali)', () => {
  for (const loc of blocos(CONF, /\blocation\b[^{]*\{/)) {
    assert.equal(loc.includes('add_header'), false, loc.split('\n')[0])
  }
})

test('HSTS de 1 ano, sem preload', () => {
  const m = servidorPrincipal().match(/add_header Strict-Transport-Security "([^"]+)" always;/)
  assert.ok(m)
  assert.match(m[1], /max-age=31536000/)
  assert.equal(m[1].includes('preload'), false)
})

test('CSP sem unsafe-inline/unsafe-eval e com a origem dos tiles da config', () => {
  const csp = CABECALHOS['Content-Security-Policy']
  assert.equal(/unsafe-(inline|eval)/.test(csp), false)
  const origemTiles = new URL(CONFIG.mapa.fonteTiles).origin
  for (const diretiva of ['connect-src', 'img-src']) {
    const valor = csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(diretiva))
    assert.ok(valor?.includes(origemTiles), `${diretiva} sem ${origemTiles}`)
  }
  assert.match(csp, /frame-ancestors 'none'/)
  assert.match(csp, /base-uri 'none'/)
})

test('server_name usa o domínio da config (apex canônico e www)', () => {
  const dominio = CONFIG.site.dominio
  assert.ok(CONF.includes(`server_name ${dominio};`))
  assert.ok(CONF.includes(`server_name www.${dominio};`))
  assert.ok(CONF.includes(`return 301 https://${dominio}$request_uri;`))
})

test('logs sem IP: log_format sem endereço do cliente e access_log só com ele ou off', () => {
  const formatos = CONF.match(/log_format\s+(\S+)[^;]*;/g) ?? []
  assert.equal(formatos.length, 1)
  assert.equal(/remote_addr|x_forwarded_for|realip/.test(formatos[0]), false)
  const nome = formatos[0].split(/\s+/)[1]
  for (const linha of CONF.match(/access_log[^;]*;/g) ?? []) {
    assert.ok(linha === 'access_log off;' || linha.includes(` ${nome}`), linha)
  }
  assert.match(CONF, /limit_req_log_level info;/)
  assert.match(CONF, /error_log \S+ warn;/)
})

test('cache: assets e dados imutáveis só em sucesso, índice 60 s, resto do erro no-store', () => {
  const mapa = blocos(CONF, /\bmap\s+"\$status:\$uri"/)[0]
  assert.ok(mapa, 'map de Cache-Control ausente')
  assert.match(mapa, /default\s+"no-store";/)
  assert.match(mapa, /\/assets\/"\s+"public, max-age=31536000, immutable";/)
  assert.match(mapa, /indice\\\.json\$"\s+"public, max-age=60";/)
  assert.ok(mapa.indexOf('indice') < mapa.indexOf(':/dados/"'), 'índice tem de vir antes da regra geral de /dados/')
  assert.match(mapa, /:\/mapa\/maplibre-\[0-9\]\[\^\/\]\*\/"\s+"public, max-age=31536000, immutable";/)
  assert.match(servidorPrincipal(), /add_header Cache-Control \$muv_cache always;/)
})

test('MapLibre versionado imutável; estilo do mapa e resto da raiz não', () => {
  const mapa = blocos(CONF, /\bmap\s+"\$status:\$uri"/)[0]
  const regras = [...mapa.matchAll(/"~([^"]+)"\s+"([^"]+)";/g)].map(([, re, valor]) => ({ re: new RegExp(re), valor }))
  const cache = (chave) => (regras.find((r) => r.re.test(chave)) ?? { valor: 'no-store' }).valor
  const imutavel = 'public, max-age=31536000, immutable'
  assert.equal(cache('200:/mapa/maplibre-6.12.0/maplibre-gl.mjs'), imutavel)
  assert.equal(cache('304:/mapa/maplibre-6.12.0/maplibre-gl-worker.mjs'), imutavel)
  assert.equal(cache('404:/mapa/maplibre-6.12.0/nao-existe.mjs'), 'no-store')
  assert.equal(cache('200:/mapa/estilo.json'), 'public, max-age=300')
  assert.equal(cache('200:/mapa/maplibre-sem-versao/x.mjs'), 'public, max-age=300')
  assert.equal(cache('200:/'), 'no-cache')
  assert.equal(cache('200:/dados/indice.json'), 'public, max-age=60')
})

test('sem fallback de SPA: try_files termina em =404', () => {
  for (const linha of CONF.match(/try_files[^;]*;/g) ?? []) {
    assert.match(linha, /=404;$/, linha)
    assert.equal(linha.includes('index.html') && !linha.includes('try_files /index.html =404'), false, linha)
  }
})

test('servers do site recusam método que não é GET/HEAD e pedido com corpo no nível do server (antes do log de erro com IP)', () => {
  const nome = `server_name ${CONFIG.site.dominio}`
  // Os servers 80 e 443 do apex (o www tem outro server_name e só redireciona).
  const doSite = blocos(CONF, /\bserver\s*\{/).filter((b) => b.includes(nome))
  assert.ok(doSite.length >= 2, 'esperava os servers 80 e 443 do domínio')
  for (const s of doSite) {
    assert.match(s, /if \(\$request_method !~ \^\(GET\|HEAD\)\$\) \{\s*return 405;/)
    assert.match(s, /if \(\$http_content_length ~ "\^\[1-9\]"\) \{\s*return 400;/)
    assert.match(s, /if \(\$http_transfer_encoding\) \{\s*return 400;/)
  }
})
