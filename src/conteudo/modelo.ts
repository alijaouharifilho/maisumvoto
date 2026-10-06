// Preenchimento dos textos-modelo ({{chave}}) usados em sobre.md, privacidade.md e roteiros.json.
// Os valores vêm da configuração e do índice; chave desconhecida é erro (falha alto, nunca "{{x}}" na tela).
import { formatarNumero, formatarPct } from '../../nucleo/frases.ts'
import { dataHora, dia, prazo } from './textos/formato.ts'

export const CHAVES_MODELO = [
  'site.nome',
  'site.dominio',
  'alvo.nomeCurto',
  'alvo.nomeUrna',
  'alvo.numero',
  'alvo.partido',
  'adversario.nomeCurto',
  'adversario.nomeUrna',
  'adversario.numero',
  'responsavel.nome',
  'responsavel.contato',
  'fimConversa',
  'data2T',
  'raio',
  'limiarFolga',
  'reservatorio',
  'reclassificados',
  'atualizadoEm',
  'plano.url',
  'hospedagem',
  'exterior.ate',
] as const

export type ChaveModelo = (typeof CHAVES_MODELO)[number]
export type ValoresModelo = Readonly<Record<ChaveModelo, string>>

type CandidatoCfg = { readonly nomeCurto: string; readonly nomeUrna: string; readonly numero: string; readonly partido: string }

/** Recorte de config/candidatura.json usado pelos modelos (o JSON importado e o tipo Candidatura servem). */
export type FonteModelo = {
  readonly alvo: CandidatoCfg
  readonly adversario: CandidatoCfg
  readonly reclassificarComoNulo: readonly string[]
  readonly eleicao: { readonly data2T: string }
  readonly metricas: { readonly raioKm: number; readonly limiarFolga: number; readonly regraViravel: string }
  readonly calendario: {
    readonly fuso: string
    readonly fases: readonly { readonly id: string; readonly ate: string | null }[]
    readonly fasesAbertas: readonly string[]
  }
  readonly site: {
    readonly nome: string
    readonly dominio: string
    readonly responsavel: { readonly nome: string | null; readonly contato: string | null }
    /** Provedor de hospedagem (config site.hospedagem); null = "a definir" e o portão de publicação bloqueia. */
    readonly hospedagem: string | null
  }
}

/** O que não está na configuração: data do índice, link do plano e o "até" das seções no exterior (do índice). */
export type ExtrasModelo = { readonly geradoEm: string | null; readonly urlPlano: string; readonly exteriorAte: number | null }

const A_DEFINIR = 'a definir'
const MODELO = /\{\{\s*([\w.]+)\s*\}\}/g
const RESERVATORIO: Readonly<Record<string, string>> = {
  abertos: 'as pessoas que não foram votar, votaram em branco ou anularam',
  abertosMaisOutros: 'as pessoas que não foram votar, votaram em branco, anularam ou votaram em outros candidatos',
}

const FUSO_BRASILIA = '-03:00'

/** Prazo formatado do fim da última fase aberta (ex.: "sábado, 24/10, às 22h (horário de Brasília)"). O horário de
 *  Brasília vai escrito: no AM, RR, RO, MT, MS e AC o corte é 1 ou 2 horas mais cedo no relógio local. */
export function fimConversa(cfg: FonteModelo): string {
  const { fases, fasesAbertas, fuso } = cfg.calendario
  const ultimaAberta = fases.filter((f) => fasesAbertas.includes(f.id)).at(-1)
  if (!ultimaAberta?.ate) throw new Error('calendario: a última fase aberta precisa de "ate"')
  const texto = prazo(ultimaAberta.ate, fuso)
  return fuso === FUSO_BRASILIA ? `${texto} (horário de Brasília)` : texto
}

function reservatorio(regra: string): string {
  const texto = RESERVATORIO[regra]
  if (texto === undefined) throw new Error(`regraViravel desconhecida: ${regra}`)
  return texto
}

export function valoresDoModelo(cfg: FonteModelo, extras: ExtrasModelo): ValoresModelo {
  return {
    'site.nome': cfg.site.nome,
    'site.dominio': cfg.site.dominio,
    'alvo.nomeCurto': cfg.alvo.nomeCurto,
    'alvo.nomeUrna': cfg.alvo.nomeUrna,
    'alvo.numero': cfg.alvo.numero,
    'alvo.partido': cfg.alvo.partido,
    'adversario.nomeCurto': cfg.adversario.nomeCurto,
    'adversario.nomeUrna': cfg.adversario.nomeUrna,
    'adversario.numero': cfg.adversario.numero,
    'responsavel.nome': cfg.site.responsavel.nome ?? A_DEFINIR,
    'responsavel.contato': cfg.site.responsavel.contato ?? A_DEFINIR,
    fimConversa: fimConversa(cfg),
    data2T: dia(cfg.eleicao.data2T),
    raio: `${formatarNumero(cfg.metricas.raioKm)} km`,
    limiarFolga: formatarPct(cfg.metricas.limiarFolga),
    reservatorio: reservatorio(cfg.metricas.regraViravel),
    reclassificados: cfg.reclassificarComoNulo.join(', '),
    atualizadoEm: extras.geradoEm === null ? A_DEFINIR : `${dataHora(extras.geradoEm, cfg.calendario.fuso)} (horário de Brasília)`,
    'plano.url': extras.urlPlano,
    hospedagem: cfg.site.hospedagem ?? A_DEFINIR,
    'exterior.ate': extras.exteriorAte === null ? A_DEFINIR : formatarNumero(extras.exteriorAte),
  }
}

function ehChave(chave: string): chave is ChaveModelo {
  return (CHAVES_MODELO as readonly string[]).includes(chave)
}

/** Chaves usadas no texto que não existem em CHAVES_MODELO (para testes e para o portão de publicação). */
export function chavesDesconhecidas(texto: string): string[] {
  return [...texto.matchAll(MODELO)].map((m) => m[1] ?? '').filter((c) => !ehChave(c))
}

export function preencherModelo(texto: string, valores: ValoresModelo): string {
  return texto.replace(MODELO, (_, chave: string) => {
    if (!ehChave(chave)) throw new Error(`chave de modelo desconhecida: {{${chave}}}`)
    return valores[chave]
  })
}

function preencherValor(valor: unknown, valores: ValoresModelo): unknown {
  if (typeof valor === 'string') return preencherModelo(valor, valores)
  if (Array.isArray(valor)) return valor.map((v: unknown) => preencherValor(v, valores))
  if (valor !== null && typeof valor === 'object') {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, preencherValor(v, valores)]))
  }
  return valor
}

/** Cópia do conteúdo (ex.: roteiros) com todas as strings preenchidas. Não altera o original. */
export function preencherTudo<T>(dado: T, valores: ValoresModelo): T {
  return preencherValor(dado, valores) as T
}
