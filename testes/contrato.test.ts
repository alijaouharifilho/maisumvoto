// Amarra os dois lados do contrato (docs/CONTRATO.md):
// 1) o golden compartilhado com o pytest tem a estrutura esperada;
// 2) se o ETL já gerou public/dados/, o índice e uma amostra real de cada tipo de arquivo passam nos esquemas zod.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod/mini'
import { candidatura } from '../nucleo/candidatura.ts'
import {
  esquemaBusca,
  esquemaCep,
  esquemaIndice,
  esquemaPontos,
  esquemaRegioes,
  esquemaSecoes,
} from '../nucleo/esquemas.ts'
import { chaveCelula } from '../nucleo/geo.ts'
import type { Indice } from '../nucleo/tipos.ts'
import { esquemaGolden, lerGoldenBruto } from './nucleo/golden.ts'

// CONTRATO_DADOS permite validar outra pasta (ex.: saída do ETL num diretório temporário).
const DADOS = process.env['CONTRATO_DADOS'] ?? join(import.meta.dirname, '..', 'public', 'dados')
const CAMINHO_INDICE = join(DADOS, 'indice.json')
const TEM_DADOS = existsSync(CAMINHO_INDICE)
const AMOSTRA = 8
// Nenhum arquivo publicado pode ter campo de dado pessoal (CONTRATO, regras gerais).
const CHAVES_PROIBIDAS = /cpf|titulo|nascimento|e-?mail|telefone|celular|nm_social/i

function lerJson(caminho: string): unknown {
  return JSON.parse(readFileSync(caminho, 'utf8'))
}

function arquivosJson(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .flatMap((nome) => {
      const caminho = join(dir, nome)
      if (statSync(caminho).isDirectory()) return arquivosJson(caminho)
      return nome.endsWith('.json') ? [caminho] : []
    })
    .sort()
}

// Amostra determinística, espalhada pela lista inteira (inclui o primeiro e o último).
function amostra<T>(lista: readonly T[], n = AMOSTRA): T[] {
  if (lista.length <= n) return [...lista]
  const passo = (lista.length - 1) / (n - 1)
  return Array.from({ length: n }, (_, k) => lista[Math.round(k * passo)]).filter((x): x is T => x !== undefined)
}

function chavesProibidas(valor: unknown, caminho = '$'): string[] {
  if (Array.isArray(valor)) return valor.flatMap((v, i) => chavesProibidas(v, `${caminho}[${i}]`))
  if (valor === null || typeof valor !== 'object') return []
  return Object.entries(valor).flatMap(([k, v]) => [
    ...(CHAVES_PROIBIDAS.test(k) ? [`${caminho}.${k}`] : []),
    ...chavesProibidas(v, `${caminho}.${k}`),
  ])
}

// Olha o JSON cru: o esquema descarta chaves desconhecidas e esconderia um campo pessoal a mais.
function validar<T>(esquema: z.ZodMiniType<T>, caminho: string): T {
  const bruto = lerJson(caminho)
  const proibidas = chavesProibidas(bruto)
  if (proibidas.length > 0) throw new Error(`${relative(DADOS, caminho)}: dado pessoal em ${proibidas.join(', ')}`)
  const r = esquema.safeParse(bruto)
  if (!r.success) throw new Error(`${relative(DADOS, caminho)}: ${r.error.message}`)
  return r.data
}

describe('golden compartilhado (testes/golden/metricas.json)', () => {
  it('tem a estrutura que TS e Python esperam', () => {
    expect(esquemaGolden.safeParse(lerGoldenBruto()).success).toBe(true)
  })

  it('usa alvo e adversário diferentes e casos com nomes únicos', () => {
    const g = esquemaGolden.parse(lerGoldenBruto())
    expect(g.alvo).not.toBe(g.adversario)
    expect(new Set(g.metricas.map((m) => `${m.caso}|${m.regra}`)).size).toBe(g.metricas.length)
  })

  it('cobre todas as classificações', () => {
    const g = esquemaGolden.parse(lerGoldenBruto())
    const vistas = new Set(g.metricas.map((m) => m.esperado.classificacao))
    for (const c of ['semVotos', 'empate', 'folga', 'aDefender', 'alvoNaFrente', 'aVirar', 'dificil'] as const) {
      expect(vistas.has(c)).toBe(true)
    }
  })
})

describe.skipIf(!TEM_DADOS)('saída real do ETL (public/dados/)', () => {
  // Lido dentro de cada teste: um índice inválido falha o teste, não a coleta do arquivo.
  const lerIndice = (): Indice => validar(esquemaIndice, CAMINHO_INDICE)

  it('indice.json passa no esquema e bate com a configuração', () => {
    const indice = lerIndice()
    expect(indice.celulaGraus).toBe(candidatura.metricas.celulaGraus)
    expect(indice.candidatos).toHaveProperty(candidatura.alvo.numero)
    expect(indice.candidatos).toHaveProperty(candidatura.adversario.numero)
  })

  it('números reclassificados como nulo não aparecem como nominais', () => {
    const indice = lerIndice()
    for (const numero of candidatura.reclassificarComoNulo) {
      expect(indice.brasil.nominais).not.toHaveProperty(numero)
    }
  })

  it('cada quadrado listado no índice existe em pontos/', () => {
    const indice = lerIndice()
    for (const q of indice.quadrados) expect(existsSync(join(DADOS, 'pontos', `${q}.json`))).toBe(true)
  })

  it('células: esquema, ordenação por id e chave coerente com a coordenada', () => {
    const indice = lerIndice()
    const arquivos = arquivosJson(join(DADOS, 'celulas'))
    expect(arquivos.length).toBeGreaterThan(0)
    for (const caminho of amostra(arquivos)) {
      const regioes = validar(esquemaRegioes, caminho)
      const celula = relative(join(DADOS, 'celulas'), caminho).replace(/\.json$/, '')
      const ids = regioes.map((r) => r.id)
      expect(ids).toEqual([...ids].sort())
      for (const r of regioes) expect(chaveCelula(r.lat, r.lon, indice.celulaGraus)).toBe(celula)
    }
  })

  it('pontos: resumo e amostra de quadrados', () => {
    const indice = lerIndice()
    const quadrados = indice.quadrados.map((q) => join(DADOS, 'pontos', `${q}.json`))
    for (const caminho of [join(DADOS, 'pontos', 'resumo.json'), ...amostra(quadrados)]) {
      validar(esquemaPontos, caminho)
    }
  })

  it.each([
    ['busca', esquemaBusca],
    ['cep', esquemaCep],
    ['secoes', esquemaSecoes],
  ] as const)('%s: amostra passa no esquema, sem dado pessoal', (pasta, esquema) => {
    const arquivos = arquivosJson(join(DADOS, pasta))
    expect(arquivos.length).toBeGreaterThan(0)
    for (const caminho of amostra(arquivos)) {
      validar<unknown>(esquema, caminho)
    }
  })

  it('seções seguem o caminho secoes/{uf}/{mun5}-{zona4}.json', () => {
    for (const caminho of arquivosJson(join(DADOS, 'secoes'))) {
      expect(relative(DADOS, caminho).split(sep).join('/')).toMatch(/^secoes\/[a-z]{2}\/\d{5}-\d{4}\.json$/)
    }
  })
})
