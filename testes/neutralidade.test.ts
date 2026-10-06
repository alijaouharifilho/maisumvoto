// Derruba o CI se nome ou número de candidato vazar para fora da configuração e do conteúdo editorial.
// Lugares permitidos: config/, src/conteudo/, docs/, testes/golden/, testes/etl/fixtures/.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'

const RAIZ = join(import.meta.dirname, '..')
const VARRER = ['src', 'nucleo', 'etl', 'ferramentas', 'deploy', 'public']
const PERMITIDOS = [`src${sep}conteudo`, `public${sep}dados`, '__pycache__']
const EXTENSOES = /\.(ts|tsx|py|mjs|js|css|html|json|svg|conf|sh|md)$/
const PROIBIDOS = [
  /flavio|fl[áa]vio/i,
  /bolsonaro/i,
  // \b do JS sem a flag u trata letra acentuada como separador ("célula" casaria); por isso o lookaround Unicode.
  /(?<![\p{L}\p{N}_])lula(?![\p{L}\p{N}_])/iu,
  /["'`]22["'`]/,
  /["'`]13["'`]/,
]

function arquivos(dir: string): string[] {
  let saida: string[] = []
  let entradas: string[]
  try {
    entradas = readdirSync(dir)
  } catch {
    return saida
  }
  for (const nome of entradas) {
    const caminho = join(dir, nome)
    const rel = relative(RAIZ, caminho)
    if (PERMITIDOS.some((p) => rel.startsWith(p) || rel.includes(`${sep}${p}`))) continue
    if (statSync(caminho).isDirectory()) saida = saida.concat(arquivos(caminho))
    else if (EXTENSOES.test(nome)) saida.push(caminho)
  }
  return saida
}

describe('neutralidade do código', () => {
  it('nenhum nome ou número de candidato fora de config/ e src/conteudo/', () => {
    const vazamentos: string[] = []
    for (const dir of VARRER) {
      for (const arquivo of arquivos(join(RAIZ, dir))) {
        const linhas = readFileSync(arquivo, 'utf8').split('\n')
        linhas.forEach((linha, i) => {
          if (PROIBIDOS.some((re) => re.test(linha))) vazamentos.push(`${relative(RAIZ, arquivo)}:${i + 1}: ${linha.trim().slice(0, 120)}`)
        })
      }
    }
    expect(vazamentos).toEqual([])
  })
})
