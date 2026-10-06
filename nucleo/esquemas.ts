// Esquemas zod que espelham nucleo/tipos.ts (docs/CONTRATO.md). Validam a configuração na carga
// e os arquivos de public/dados/ em runtime. A igualdade de tipos é checada em testes/nucleo/esquemas.test.ts.
// zod/mini (API funcional, com tree-shaking) em vez do zod clássico: medido em 05/10/2026, o JS de entrada caiu
// de 384,7 kB (120,3 kB gzip) para 322,3 kB (103,4 kB gzip). Mensagens padrão do mini são curtas e em inglês;
// as que importam estão escritas aqui, e todo erro sai com o caminho do campo.
import { z } from 'zod/mini'
import type { IdFase } from './tipos.ts'

export const RE_NUMERO_CANDIDATO = /^\d{2}$/
export const RE_ID_REGIAO = /^[a-z]{2}-\d{5}-\d{4}-\d{4}$/
export const RE_CHAVE_GRADE = /^-?\d+_-?\d+$/

const inteiro = z.int().check(z.nonnegative('inteiro ≥ 0'))
const texto = z.string()
const naoVazio = z.string().check(z.minLength(1, 'texto vazio'))
const comFormato = (re: RegExp, mensagem: string) => z.string().check(z.regex(re, mensagem))
const numeroCandidato = comFormato(RE_NUMERO_CANDIDATO, 'número de candidato tem 2 dígitos')
const uf = comFormato(/^[A-Z]{2}$/, 'UF em 2 letras maiúsculas')
const latitude = z.number().check(z.gte(-90), z.lte(90))
const longitude = z.number().check(z.gte(-180), z.lte(180))
const positivo = z.number().check(z.positive('número > 0'))
const dataHora = z.iso.datetime({ offset: true, error: 'data e hora ISO com fuso' })
const nominais = z.record(numeroCandidato, inteiro)

export const esquemaClassificacao = z.enum(['semVotos', 'empate', 'folga', 'aDefender', 'alvoNaFrente', 'aVirar', 'dificil'])
export const esquemaRegraViravel = z.enum(['abertos', 'abertosMaisOutros'])
export const esquemaIdFase = z.enum(['campanha', 'retaFinal', 'pausa', 'votacao', 'encerrada'])
export const esquemaMotivoForaDoMapa = z.enum(['presoProvisorio', 'votoEmTransito'])
const eleitoresForaDoMapa = z.record(esquemaMotivoForaDoMapa, inteiro)

// ── Dados (public/dados/) ────────────────────────────────────────────────────

export const esquemaVotos = z.object({
  aptos: inteiro,
  comparecimento: inteiro,
  abstencao: inteiro,
  brancos: inteiro,
  nulos: inteiro,
  nominais,
})

export const esquemaLocal = z.object({
  nome: texto,
  endereco: texto,
  cep: texto,
  zona: inteiro,
  nr: inteiro,
  secoes: z.array(inteiro),
})

export const esquemaRegiao = z.object({
  id: comFormato(RE_ID_REGIAO, 'id de região fora do formato {uf}-{mun5}-{zona4}-{nr4}'),
  uf,
  mun: comFormato(/^\d{5}$/, 'código TSE do município com 5 dígitos'),
  municipio: naoVazio,
  bairro: texto,
  lat: latitude,
  lon: longitude,
  posicao: z.enum(['tse', 'reserva']),
  locais: z.array(esquemaLocal),
  eleitores: inteiro,
  secoes: inteiro,
  votos: z.nullable(esquemaVotos),
})

export const esquemaRegioes = z.array(esquemaRegiao)

const esquemaTotais = z.object({
  secoes: inteiro,
  aptos: inteiro,
  comparecimento: inteiro,
  abstencao: inteiro,
  brancos: inteiro,
  nulos: inteiro,
  nominais,
})

const esquemaTotaisBrasil = z.extend(esquemaTotais, {
  regioes: inteiro,
  regioesNoMapa: inteiro,
  ate: inteiro,
  classificacao: z.record(esquemaClassificacao, inteiro),
  viraveis: z.record(esquemaRegraViravel, inteiro),
  eleitoresForaDoMapa,
})

const esquemaTotaisUf = z.object({
  secoes: inteiro,
  aptos: inteiro,
  regioes: inteiro,
  regioesNoMapa: inteiro,
  eleitoresSemPosicao: inteiro,
  eleitoresPosicaoReserva: inteiro,
  eleitoresForaDoMapa,
  ate: inteiro,
})

const esquemaFonte = z.object({
  id: naoVazio,
  url: z.url(),
  dataGeracao: z.nullable(texto),
  sha256: comFormato(/^[0-9a-f]{64}$/, 'sha256 em 64 hex minúsculos'),
})

export const esquemaIndice = z.object({
  esquema: z.literal(1),
  versao: comFormato(/^[0-9a-f]{12}$/, 'versão = 12 hex'),
  geradoEm: dataHora,
  eleicao: z.object({ codigo: texto, pleito: texto, turno: z.int().check(z.positive()), cargo: texto }),
  celulaGraus: positivo,
  candidatos: z.record(numeroCandidato, z.object({ nome: texto, partido: texto })),
  brasil: esquemaTotaisBrasil,
  exterior: esquemaTotais,
  ufs: z.record(uf, esquemaTotaisUf),
  quadrados: z.array(comFormato(RE_CHAVE_GRADE, 'quadrado no formato {lat}_{lon}')),
  conferencia: z.object({ ok: z.boolean(), referencia: texto, diferencas: z.array(texto) }),
  fontes: z.array(esquemaFonte),
})

export const esquemaPontos = z.object({
  escala: positivo,
  d: z.array(z.int()).check(z.refine((d) => d.length % 2 === 0, 'd precisa ter pares [Δlat, Δlon]')),
})

export const esquemaSecoes = z.object({
  secoes: z.record(comFormato(/^[1-9]\d*$/, 'nº da seção sem zero à esquerda'), z.omit(esquemaVotos, { abstencao: true })),
})

export const esquemaItemBusca = z.object({
  t: z.enum(['m', 'b', 'l']),
  n: naoVazio,
  m: z.optional(naoVazio),
  uf,
  lat: latitude,
  lon: longitude,
  e: inteiro,
})

export const esquemaBusca = z.array(esquemaItemBusca)

export const esquemaCep = z.record(
  comFormato(/^\d{8}$/, 'CEP com 8 dígitos'),
  z.object({ lat: latitude, lon: longitude, m: texto, uf, b: texto }),
)

// ── Configuração (config/) ───────────────────────────────────────────────────

const esquemaCandidato = z.object({
  numero: numeroCandidato,
  nomeCurto: naoVazio,
  nomeUrna: naoVazio,
  partido: naoVazio,
})

type Fase = { id: IdFase; ate: string | null }

// Fim aberto (null) vale +∞: exigir fins estritamente crescentes já garante que só a última fase fica aberta.
function fasesEmOrdem(fases: readonly Fase[]): boolean {
  const fins = fases.map((f) => (f.ate === null ? Number.POSITIVE_INFINITY : Date.parse(f.ate)))
  const inicio = { ok: true, anterior: Number.NEGATIVE_INFINITY }
  return fins.reduce((acc, fim) => ({ ok: acc.ok && fim > acc.anterior, anterior: fim }), inicio).ok
}

const esquemaCalendario = z
  .object({
    fuso: comFormato(/^[+-]\d{2}:\d{2}$/, 'fuso no formato ±HH:MM'),
    fases: z
      .array(z.object({ id: esquemaIdFase, ate: z.nullable(dataHora) }))
      .check(
        z.minLength(1, 'pelo menos uma fase'),
        z.refine(fasesEmOrdem, 'fases em ordem crescente de fim, só a última com fim aberto (null)'),
        z.refine((fases) => new Set(fases.map((f) => f.id)).size === fases.length, 'fase repetida'),
      ),
    fasesAbertas: z.array(esquemaIdFase),
  })
  .check(
    z.refine((c) => c.fasesAbertas.every((id) => c.fases.some((f) => f.id === id)), {
      error: 'fasesAbertas cita fase que não está em fases',
      path: ['fasesAbertas'],
    }),
  )

export const esquemaCandidatura = z
  .object({
    esquema: z.literal(1),
    eleicao: z.object({
      ano: z.int(),
      codigo: naoVazio,
      pleito: naoVazio,
      turno: z.int().check(z.positive()),
      cargo: naoVazio,
      data2T: z.iso.date(),
    }),
    alvo: esquemaCandidato,
    adversario: esquemaCandidato,
    reclassificarComoNulo: z.array(numeroCandidato),
    metricas: z.object({
      raioKm: positivo,
      celulaGraus: positivo,
      gradeLinkGraus: positivo,
      limiarFolga: z.number().check(z.gt(0), z.lte(1)),
      regraViravel: esquemaRegraViravel,
    }),
    gruposConversa: z.record(naoVazio, naoVazio),
    calendario: esquemaCalendario,
    site: z.object({
      nome: naoVazio,
      dominio: naoVazio,
      natureza: z.enum(['independente', 'campanha']),
      responsavel: z.object({ nome: z.nullable(texto), contato: z.nullable(texto) }),
      hospedagem: z.nullable(texto),
      redeSocial: z.nullable(texto),
    }),
    mapa: z.object({
      estiloUrl: naoVazio,
      fonteTiles: naoVazio,
      centroInicial: z.tuple([longitude, latitude]),
      zoomInicial: z.number().check(z.gte(0), z.lte(24)),
    }),
    prefixoArmazenamento: comFormato(/^[a-z][a-z0-9-]*$/, 'prefixo curto em minúsculas'),
  })
  .check(
    z.refine((c) => c.alvo.numero !== c.adversario.numero, {
      error: 'alvo e adversario precisam ter números diferentes',
      path: ['adversario', 'numero'],
    }),
  )

const inteiroMin1 = z.int().check(z.gte(1, 'inteiro ≥ 1'))

export const esquemaRegrasBusca = z
  .object({
    tamanhoPrefixo: inteiroMin1,
    minLetrasPalavraChave: inteiroMin1,
    minLetrasReserva: inteiroMin1,
    maxResultados: inteiroMin1,
    genericas: z.array(comFormato(/^[a-z0-9]+$/, 'genéricas já normalizadas (minúsculas, sem acento)')),
  })
  .check(
    z.refine((r) => r.minLetrasReserva <= r.minLetrasPalavraChave, {
      error: 'minLetrasReserva não pode passar de minLetrasPalavraChave',
      path: ['minLetrasReserva'],
    }),
  )
