// Manifesto sha256 do dist/ para o envio incremental por tar+ssh (quando não há rsync,
// como no Git Bash do Windows). O formato é o mesmo do `sha256sum`, para que o servidor
// gere o dele com `find . -type f -print0 | xargs -0 sha256sum`.
//   node deploy/manifesto.mjs gerar <dir>                                  → stdout
//   node deploy/manifesto.mjs diferenca <local> <remoto> <enviar> <remover> → grava as listas
import { createHash } from 'node:crypto'
import { readFile, readdir, writeFile } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const LINHA = /^([0-9a-f]{64}) [ *](.+)$/

async function sha256(caminho) {
  return createHash('sha256').update(await readFile(caminho)).digest('hex')
}

export async function gerarManifesto(dir) {
  const entradas = await readdir(dir, { recursive: true, withFileTypes: true })
  const arquivos = entradas
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath, e.name))
    .map((abs) => ({ abs, rel: `./${relative(dir, abs).split(sep).join('/')}` }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  const pares = []
  for (const { abs, rel } of arquivos) pares.push([rel, await sha256(abs)])
  return new Map(pares)
}

export function formatarManifesto(manifesto) {
  return [...manifesto].map(([rel, hash]) => `${hash}  ${rel}\n`).join('')
}

export function lerManifesto(texto) {
  const pares = texto
    .split('\n')
    .map((linha, i) => ({ linha: linha.replace(/\r$/, ''), n: i + 1 }))
    .filter(({ linha }) => linha.trim() !== '')
    .map(({ linha, n }) => {
      const m = LINHA.exec(linha)
      if (!m) throw new Error(`manifesto: linha ${n} malformada`)
      return [m[2], m[1]]
    })
  return new Map(pares)
}

export function diferenca(local, remoto) {
  const enviar = [...local].filter(([rel, hash]) => remoto.get(rel) !== hash).map(([rel]) => rel)
  const remover = [...remoto.keys()].filter((rel) => !local.has(rel))
  return { enviar: enviar.sort(), remover: remover.sort() }
}

const comoLista = (itens) => itens.map((i) => `${i}\n`).join('')

async function principal([comando, ...args]) {
  if (comando === 'gerar' && args.length === 1) {
    process.stdout.write(formatarManifesto(await gerarManifesto(args[0])))
    return 0
  }
  if (comando === 'diferenca' && args.length === 4) {
    const [local, remoto, enviar, remover] = args
    const d = diferenca(lerManifesto(await readFile(local, 'utf8')), lerManifesto(await readFile(remoto, 'utf8')))
    await writeFile(enviar, comoLista(d.enviar))
    await writeFile(remover, comoLista(d.remover))
    process.stdout.write(`manifesto: ${d.enviar.length} para enviar, ${d.remover.length} para remover\n`)
    return 0
  }
  process.stderr.write('uso: manifesto.mjs gerar <dir> | diferenca <local> <remoto> <enviar> <remover>\n')
  return 2
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  principal(process.argv.slice(2)).then(
    (codigo) => {
      process.exitCode = codigo
    },
    (erro) => {
      process.stderr.write(`manifesto: ${erro.message}\n`)
      process.exitCode = 1
    },
  )
}
