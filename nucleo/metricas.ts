// Métricas derivadas dos votos (CONTRATO §3). Espelho exato em etl/metricas.py; casos em testes/golden/metricas.json.
import type { Candidatura, Classificacao, NumeroCandidato, RegraViravel, Votos } from './tipos.ts'

export type VotosBase = Pick<Votos, 'brancos' | 'nulos' | 'abstencao' | 'nominais'>

export type CfgMetricas = {
  alvo: NumeroCandidato
  adversario: NumeroCandidato
  limiarFolga: number
  regraViravel: RegraViravel
}

export type CfgParcelas = {
  alvo: NumeroCandidato
  adversario: NumeroCandidato
  gruposConversa: Readonly<Record<string, string>>
}

export type Derivadas = {
  validos: number
  alvo: number
  adversario: number
  outros: number
  abertos: number
  ate: number
  pctAlvo: number | null
  reservatorio: number
  classificacao: Classificacao
  viravel: boolean
}

export type Parcela = { chave: string; numero?: NumeroCandidato; grupo?: string; valor: number }

const FIXAS = ['brancos', 'nulos', 'abstencao'] as const

function soma(valores: Iterable<number>): number {
  let total = 0
  for (const v of valores) total += v
  return total
}

type Base = { a: number; d: number; v: number; reservatorio: number; p: number | null }

function classificar({ a, d, v, reservatorio, p }: Base, limiarFolga: number): Classificacao {
  if (v === 0) return 'semVotos'
  if (a === d) return 'empate'
  if (a > d) {
    if (p !== null && p >= limiarFolga) return 'folga'
    return reservatorio > a - d ? 'aDefender' : 'alvoNaFrente'
  }
  return reservatorio > d - a ? 'aVirar' : 'dificil'
}

export function derivar(votos: VotosBase, cfg: CfgMetricas): Derivadas {
  const a = votos.nominais[cfg.alvo] ?? 0
  const d = votos.nominais[cfg.adversario] ?? 0
  const v = soma(Object.values(votos.nominais))
  const outros = v - a - d
  const abertos = votos.brancos + votos.nulos + votos.abstencao
  const reservatorio = cfg.regraViravel === 'abertos' ? abertos : abertos + outros
  const pctAlvo = v > 0 ? a / v : null
  const classificacao = classificar({ a, d, v, reservatorio, p: pctAlvo }, cfg.limiarFolga)
  return {
    validos: v,
    alvo: a,
    adversario: d,
    outros,
    abertos,
    ate: abertos + outros,
    pctAlvo,
    reservatorio,
    classificacao,
    viravel: d > a && reservatorio > d - a,
  }
}

export function somarVotos(lista: readonly Votos[]): Votos {
  const nominais: Record<NumeroCandidato, number> = {}
  for (const v of lista) {
    for (const [numero, n] of Object.entries(v.nominais)) nominais[numero] = (nominais[numero] ?? 0) + n
  }
  return {
    aptos: soma(lista.map((v) => v.aptos)),
    comparecimento: soma(lista.map((v) => v.comparecimento)),
    abstencao: soma(lista.map((v) => v.abstencao)),
    brancos: soma(lista.map((v) => v.brancos)),
    nulos: soma(lista.map((v) => v.nulos)),
    nominais,
  }
}

function comGrupo(base: Parcela, grupo: string | undefined): Parcela {
  return grupo === undefined ? base : { ...base, grupo }
}

// Decomposição do "até": brancos, nulos, abstenção, cada outro candidato com roteiro e o resto somado.
export function parcelas(votos: VotosBase, cfg: CfgParcelas): Parcela[] {
  const fixas = FIXAS.map((chave) => comGrupo({ chave, valor: votos[chave] }, cfg.gruposConversa[chave]))
  const outros = Object.entries(votos.nominais)
    .filter(([n]) => n !== cfg.alvo && n !== cfg.adversario)
    .sort(([x], [y]) => x.localeCompare(y))
  const temRoteiro = ([n]: [string, number]): boolean => cfg.gruposConversa[n] !== undefined
  const candidatos = outros
    .filter(temRoteiro)
    .map(([numero, valor]) => comGrupo({ chave: numero, numero, valor }, cfg.gruposConversa[numero]))
  const resto = soma(outros.filter((par) => !temRoteiro(par)).map(([, valor]) => valor))
  return [...fixas, ...candidatos, { chave: 'outros', valor: resto }]
    .filter((p) => p.valor > 0)
    .sort((x, y) => y.valor - x.valor)
}

export function cfgMetricas(c: Candidatura): CfgMetricas & CfgParcelas {
  return {
    alvo: c.alvo.numero,
    adversario: c.adversario.numero,
    limiarFolga: c.metricas.limiarFolga,
    regraViravel: c.metricas.regraViravel,
    gruposConversa: c.gruposConversa,
  }
}
