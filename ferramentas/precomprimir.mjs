// Gera .br (brotli 11) e .gz (gzip 9) ao lado dos arquivos de texto de dist/, para o
// nginx servir com brotli_static/gzip_static sem comprimir nada por requisição.
//   node ferramentas/precomprimir.mjs [dist]
// Idempotente: se o .br/.gz existente já descomprime para o original, fica como está.
// A compressão roda no pool de threads da libuv (API assíncrona) porque o dist/dados tem
// milhares de arquivos e brotli 11 é lento; o resultado é byte a byte o mesmo da versão Sync.
// O pool tem 4 threads por padrão e só aceita outro tamanho por variável de ambiente antes
// do processo subir: UV_THREADPOOL_SIZE=16 node ferramentas/precomprimir.mjs (o publicar.sh
// já passa o número de CPUs; medido: ~6,8 mil arquivos, 100 MB, 54 s com 4 e 24 s com 16).
import { availableParallelism } from 'node:os'
import { readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { extname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'
import { brotliCompress, brotliDecompress, constants, gunzip, gzip } from 'node:zlib'

export const TAMANHO_MINIMO = 1024
export const EXTENSOES = Object.freeze(['.html', '.js', '.mjs', '.css', '.json', '.svg'])
const DIST_PADRAO = fileURLToPath(new URL('../dist', import.meta.url))

const comprimirBr = promisify(brotliCompress)
const comprimirGz = promisify(gzip)
const descomprimirBr = promisify(brotliDecompress)
const descomprimirGz = promisify(gunzip)

const VARIANTES = Object.freeze([
  {
    sufixo: '.br',
    comprimir: (buf) =>
      comprimirBr(buf, {
        params: {
          [constants.BROTLI_PARAM_QUALITY]: 11,
          [constants.BROTLI_PARAM_MODE]: constants.BROTLI_MODE_TEXT,
          [constants.BROTLI_PARAM_SIZE_HINT]: buf.length,
        },
      }),
    descomprimir: descomprimirBr,
  },
  { sufixo: '.gz', comprimir: (buf) => comprimirGz(buf, { level: 9 }), descomprimir: descomprimirGz },
])

async function elegiveis(dir) {
  const entradas = await readdir(dir, { recursive: true, withFileTypes: true })
  const candidatos = entradas.filter((e) => e.isFile() && EXTENSOES.includes(extname(e.name).toLowerCase()))
  const comTamanho = await Promise.all(
    candidatos.map(async (e) => {
      const caminho = join(e.parentPath, e.name)
      return { caminho, tamanho: (await stat(caminho)).size }
    }),
  )
  return comTamanho.filter((a) => a.tamanho >= TAMANHO_MINIMO).map((a) => a.caminho)
}

async function lerSeExistir(caminho) {
  try {
    return await readFile(caminho)
  } catch (erro) {
    if (erro.code === 'ENOENT') return null
    throw erro
  }
}

async function jaConfere(caminho, original, variante) {
  const existente = await lerSeExistir(caminho)
  if (existente === null) return false
  try {
    return (await variante.descomprimir(existente)).equals(original)
  } catch {
    // Comprimido corrompido ou truncado: conta como desatualizado e é regerado.
    return false
  }
}

async function processarVariante(caminho, original, variante) {
  const destino = caminho + variante.sufixo
  if (await jaConfere(destino, original, variante)) return 'mantido'
  const comprimido = await variante.comprimir(original)
  if (comprimido.length >= original.length) {
    await rm(destino, { force: true })
    return 'inutil'
  }
  await writeFile(destino, comprimido)
  return 'gerado'
}

async function emLotes(itens, limite, tarefa) {
  const resultados = []
  let proximo = 0
  const trabalhador = async () => {
    while (proximo < itens.length) {
      const i = proximo
      proximo += 1
      resultados[i] = await tarefa(itens[i])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limite, itens.length) }, trabalhador))
  return resultados
}

export async function precomprimir(dir, { concorrencia = availableParallelism() } = {}) {
  const arquivos = await elegiveis(dir)
  const porArquivo = await emLotes(arquivos, concorrencia, async (caminho) => {
    const original = await readFile(caminho)
    return Promise.all(VARIANTES.map((v) => processarVariante(caminho, original, v)))
  })
  const estados = porArquivo.flat()
  const contar = (estado) => estados.filter((e) => e === estado).length
  return Object.freeze({
    elegiveis: arquivos.length,
    gerados: contar('gerado'),
    mantidos: contar('mantido'),
    inuteis: contar('inutil'),
  })
}

async function principal() {
  const dir = resolve(process.argv[2] ?? DIST_PADRAO)
  try {
    if (!(await stat(dir)).isDirectory()) throw new Error('não é diretório')
  } catch {
    process.stderr.write(`precomprimir: ${dir} não existe ou não é diretório\n`)
    return 1
  }
  const inicio = Date.now()
  const r = await precomprimir(dir)
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1)
  process.stdout.write(
    `precomprimir: ${r.elegiveis} arquivos elegíveis (>= ${TAMANHO_MINIMO} B); ` +
      `${r.gerados} gerados, ${r.mantidos} já em dia, ${r.inuteis} sem ganho; ${segundos} s\n`,
  )
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  principal().then(
    (codigo) => {
      process.exitCode = codigo
    },
    (erro) => {
      process.stderr.write(`precomprimir: ${erro.message}\n`)
      process.exitCode = 1
    },
  )
}
