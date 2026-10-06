// Carrega testes/golden/metricas.json validando a estrutura — o mesmo arquivo é lido pelo pytest.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const numeroCand = z.string().regex(/^\d{2}$/)
const inteiro = z.number().int().nonnegative()

const esquemaCasoMetrica = z.object({
  caso: z.string().min(1),
  regra: z.enum(['abertos', 'abertosMaisOutros']),
  votos: z.object({
    brancos: inteiro,
    nulos: inteiro,
    abstencao: inteiro,
    nominais: z.record(numeroCand, inteiro),
  }),
  esperado: z.object({
    validos: inteiro,
    alvo: inteiro,
    adversario: inteiro,
    outros: inteiro,
    abertos: inteiro,
    ate: inteiro,
    pctAlvo: z.number().min(0).max(1).nullable(),
    classificacao: z.enum(['semVotos', 'empate', 'folga', 'aDefender', 'alvoNaFrente', 'aVirar', 'dificil']),
    viravel: z.boolean(),
  }),
})

const coordenada = z.tuple([z.number(), z.number()])

export const esquemaGolden = z.object({
  descricao: z.string(),
  alvo: numeroCand,
  adversario: numeroCand,
  limiarFolga: z.number().gt(0).lte(1),
  metricas: z.array(esquemaCasoMetrica).min(1),
  geo: z.object({
    celulaGraus: z.number().positive(),
    gradeLinkGraus: z.number().positive(),
    chaves: z
      .array(
        z.object({
          lat: z.number(),
          lon: z.number(),
          celula: z.string().regex(/^-?\d+_-?\d+$/),
          quadrado: z.string().regex(/^-?\d+_-?\d+$/),
          link: z.string().regex(/^@-?\d+\.\d{3},-?\d+\.\d{3}$/),
        }),
      )
      .min(1),
    haversineKm: z.array(z.object({ de: coordenada, para: coordenada, km: z.number().nonnegative() })).min(1),
  }),
  busca: z.object({
    normalizar: z.array(z.object({ entrada: z.string(), saida: z.string() })).min(1),
    prefixosConsulta: z.array(z.object({ entrada: z.string(), prefixos: z.array(z.string()) })).min(1),
    cep: z
      .array(z.object({ entrada: z.string(), arquivo: z.string().nullable(), chave: z.string().nullable() }))
      .min(1),
    arquivos: z.array(z.object({ prefixo: z.string(), arquivo: z.string() })).min(1),
  }),
})

export type Golden = z.infer<typeof esquemaGolden>

export const CAMINHO_GOLDEN = join(import.meta.dirname, '..', 'golden', 'metricas.json')

export function lerGoldenBruto(): unknown {
  return JSON.parse(readFileSync(CAMINHO_GOLDEN, 'utf8'))
}

export const golden: Golden = esquemaGolden.parse(lerGoldenBruto())
