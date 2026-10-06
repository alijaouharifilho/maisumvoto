// Conferência do dist/ antes de publicar (chamada pelo deploy/publicar.sh).
//   node ferramentas/conferir-dist.mjs [dist] [--raiz <raiz do projeto>]
// Falha (código 1) se: faltar index.html ou dados/indice.json; conferencia.ok não for true;
// houver .map, arquivo oculto, segredo óbvio, valor do .env, CPF formatado ou script/estilo
// inline no HTML (a CSP do nginx bloquearia). Imprime o tamanho total e os 10 maiores.
import { readdir, readFile, stat } from 'node:fs/promises'
import { readdirSync, readFileSync } from 'node:fs'
import { extname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const LIMITE_SECOES_BYTES = 300 * 1024
const RAIZ_PADRAO = fileURLToPath(new URL('..', import.meta.url))
const COMPRIMIDOS = Object.freeze(['.br', '.gz'])
const TEXTO = Object.freeze(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest'])
const MIN_VALOR_ENV = 8
const QUANTOS_MAIORES = 10
const VERSAO = /^[0-9a-f]{12}$/

const PADROES = Object.freeze([
  { nome: 'chave privada PEM', re: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/ },
  { nome: 'chave de acesso AWS', re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { nome: 'token do GitHub', re: /\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})/ },
  { nome: 'chave de API do Google', re: /\bAIza[0-9A-Za-z_-]{35}\b/ },
  { nome: 'token do Slack', re: /\bxox[abposr]-[A-Za-z0-9-]{10,}/ },
  { nome: 'chave secreta (sk-/sk_live_)', re: /\b(?:sk-(?:ant-|proj-)?[A-Za-z0-9_-]{32,}|[rs]k_live_[A-Za-z0-9]{20,})/ },
  { nome: 'JWT', re: /\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/ },
  { nome: 'URL com usuário e senha', re: /\b(?:redis|rediss|postgres|postgresql|mysql|mongodb(?:\+srv)?|amqp|https?|ftp):\/\/[^\s/:@"'`]+:[^\s/@"'`]+@/ },
  { nome: 'CPF formatado', re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/ },
])

async function listar(dir) {
  const entradas = await readdir(dir, { recursive: true, withFileTypes: true })
  const arquivos = entradas.filter((e) => e.isFile()).map((e) => join(e.parentPath, e.name))
  return Promise.all(
    arquivos.map(async (abs) => ({ abs, rel: relative(dir, abs).split(sep).join('/'), bytes: (await stat(abs)).size })),
  )
}

const ehComprimido = (rel) => COMPRIMIDOS.includes(extname(rel))

function conferirEstrutura(arquivos) {
  const falhas = []
  if (!arquivos.some((a) => a.rel === 'index.html')) falhas.push('index.html ausente')
  for (const { rel } of arquivos) {
    if (rel.endsWith('.map')) falhas.push(`${rel}: source map não pode ser publicado`)
    if (rel.split('/').some((parte) => parte.startsWith('.'))) falhas.push(`${rel}: arquivo oculto no dist`)
  }
  return falhas
}

async function conferirIndice(dir) {
  let indice
  try {
    indice = JSON.parse(await readFile(join(dir, 'dados', 'indice.json'), 'utf8'))
  } catch (erro) {
    const motivo = erro.code === 'ENOENT' ? 'ausente (rode `npm run dados`)' : `ilegível (${erro.message})`
    return [`dados/indice.json ${motivo}`]
  }
  const falhas = []
  if (indice?.conferencia?.ok !== true) falhas.push('dados/indice.json: conferencia.ok não é true (totais não batem)')
  if (!VERSAO.test(String(indice?.versao))) falhas.push('dados/indice.json: versao fora do formato (12 hex)')
  return falhas
}

export function lerValoresEnv(raiz) {
  let nomes
  try {
    nomes = readdirSync(raiz).filter((n) => /^\.env(\..+)?$/.test(n) && n !== '.env.example')
  } catch {
    return []
  }
  return nomes.flatMap((nome) =>
    readFileSync(join(raiz, nome), 'utf8')
      .split(/\r?\n/)
      .map((linha) => /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linha))
      .filter(Boolean)
      .map(([, chave, valor]) => ({ chave, valor: valor.trim().replace(/^(['"])(.*)\1$/, '$2') }))
      .filter(({ valor }) => valor.length >= MIN_VALOR_ENV),
  )
}

function conferirHtml(rel, texto) {
  const falhas = []
  for (const m of texto.matchAll(/<script\b([^>]*)>/gi)) {
    const atributos = m[1]
    const ehDado = /\btype\s*=\s*["']?application\/(?:ld\+)?json/i.test(atributos)
    if (!/\bsrc\s*=/i.test(atributos) && !ehDado) falhas.push(`${rel}: script inline (a CSP bloqueia)`)
  }
  if (/<style\b|\sstyle\s*=/i.test(texto)) falhas.push(`${rel}: estilo inline (a CSP bloqueia)`)
  if (/<[^>]+\son[a-z]+\s*=/i.test(texto)) falhas.push(`${rel}: handler de evento inline (a CSP bloqueia)`)
  return falhas
}

async function varrerArquivo(arquivo, valoresEnv) {
  const texto = await readFile(arquivo.abs, 'utf8')
  const falhas = PADROES.filter(({ re }) => re.test(texto)).map(({ nome }) => `${arquivo.rel}: ${nome}`)
  for (const { chave } of valoresEnv.filter(({ valor }) => texto.includes(valor))) {
    falhas.push(`${arquivo.rel}: contém o valor de ${chave} (do .env)`)
  }
  return extname(arquivo.rel) === '.html' ? [...falhas, ...conferirHtml(arquivo.rel, texto)] : falhas
}

function avisosDeTamanho(arquivos) {
  return arquivos
    .filter((a) => a.rel.startsWith('dados/secoes/') && a.bytes > LIMITE_SECOES_BYTES)
    .map((a) => `${a.rel}: ${formatarBytes(a.bytes)} (meta do contrato: < ${formatarBytes(LIMITE_SECOES_BYTES)})`)
}

export function formatarBytes(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 ** 2).toFixed(1)} MB`
}

export async function conferirDist(dir, { raizProjeto = RAIZ_PADRAO } = {}) {
  const todos = await listar(dir)
  const arquivos = todos.filter((a) => !ehComprimido(a.rel))
  const valoresEnv = lerValoresEnv(raizProjeto)
  const varridos = arquivos.filter((a) => TEXTO.includes(extname(a.rel).toLowerCase()))
  const achados = []
  for (const a of varridos) achados.push(...(await varrerArquivo(a, valoresEnv)))
  const falhas = [...conferirEstrutura(arquivos), ...(await conferirIndice(dir)), ...achados]
  const maiores = [...arquivos].sort((a, b) => b.bytes - a.bytes).slice(0, QUANTOS_MAIORES)
  return Object.freeze({
    falhas,
    avisos: avisosDeTamanho(arquivos),
    totalArquivos: arquivos.length,
    totalBytes: arquivos.reduce((s, a) => s + a.bytes, 0),
    bytesComprimidos: todos.filter((a) => ehComprimido(a.rel)).reduce((s, a) => s + a.bytes, 0),
    maiores: maiores.map(({ rel, bytes }) => ({ caminho: rel, bytes })),
  })
}

function relatorio(r) {
  const linhas = [
    `conferir-dist: ${r.totalArquivos} arquivos, ${formatarBytes(r.totalBytes)}` +
      ` (+ ${formatarBytes(r.bytesComprimidos)} em .br/.gz)`,
    `${QUANTOS_MAIORES} maiores:`,
    ...r.maiores.map((m) => `  ${formatarBytes(m.bytes).padStart(10)}  ${m.caminho}`),
  ]
  return `${linhas.join('\n')}\n`
}

function lerArgumentos(argv) {
  const opcoes = { dist: join(RAIZ_PADRAO, 'dist'), raizProjeto: RAIZ_PADRAO }
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--raiz') opcoes.raizProjeto = resolve(argv[(i += 1)] ?? '')
    else opcoes.dist = resolve(argv[i])
  }
  return opcoes
}

async function principal() {
  const { dist, raizProjeto } = lerArgumentos(process.argv.slice(2))
  const r = await conferirDist(dist, { raizProjeto })
  process.stdout.write(relatorio(r))
  for (const aviso of r.avisos) process.stderr.write(`AVISO ${aviso}\n`)
  if (r.falhas.length === 0) {
    process.stdout.write('conferir-dist: ok\n')
    return 0
  }
  process.stderr.write(`conferir-dist: ${r.falhas.length} problema(s), publicação bloqueada:\n`)
  for (const falha of r.falhas) process.stderr.write(`  - ${falha}\n`)
  return 1
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  principal().then(
    (codigo) => {
      process.exitCode = codigo
    },
    (erro) => {
      process.stderr.write(`conferir-dist: ${erro.code === 'ENOENT' ? 'dist não encontrado' : erro.message}\n`)
      process.exitCode = 1
    },
  )
}
