// Frases numéricas e formatação em pt-BR.
import type { Regiao } from './tipos.ts'

const NUMERO = new Intl.NumberFormat('pt-BR')
const KM = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })

// Fração humana: abaixo/acima destes extremos a fração engana ("3%" viraria "quase 1 em cada 10").
const PCT_ABAIXO_DE = 0.08
const PCT_ACIMA_DE = 0.92
const ERRO_MAX_UNITARIA = 0.015
const ERRO_MAX_SIMPLES = 0.045
const DENOMINADOR_MAX_SIMPLES = 5
const DENOMINADOR_MAX = 10
const SOBRA_PARA_PREFIXO = 0.015

const PASSO_DISTANCIA_M = 50

type Fracao = { a: number; b: number }

function mdc(x: number, y: number): number {
  return y === 0 ? x : mdc(y, x % y)
}

// Todas as a/b irredutíveis com 2 ≤ b ≤ 10, em ordem de b e depois de a (assim o empate fica com o menor b).
const CANDIDATAS: readonly Fracao[] = Array.from({ length: DENOMINADOR_MAX - 1 }, (_, i) => i + 2).flatMap((b) =>
  Array.from({ length: b - 1 }, (_, i) => i + 1)
    .filter((a) => mdc(a, b) === 1)
    .map((a) => ({ a, b })),
)
const MEIO: Fracao = { a: 1, b: 2 }

function erro(f: Fracao, t: number): number {
  return Math.abs(f.a / f.b - t)
}

function melhor(t: number, aceita: (f: Fracao) => boolean): Fracao {
  return CANDIDATAS.filter(aceita).reduce((m, f) => (erro(f, t) < erro(m, t) ? f : m), MEIO)
}

function escolherFracao(t: number): Fracao {
  const unitaria = melhor(t, (f) => f.a === 1)
  if (erro(unitaria, t) <= ERRO_MAX_UNITARIA) return unitaria
  const simples = melhor(t, (f) => f.b <= DENOMINADOR_MAX_SIMPLES)
  if (erro(simples, t) <= ERRO_MAX_SIMPLES) return simples
  return melhor(t, () => true)
}

function porcentagem(t: number): { texto: string; numerador: number } {
  const p = Math.round(100 * t)
  if (p === 0 && t > 0) return { texto: 'menos de 1%', numerador: 1 }
  if (p === 100 && t < 1) return { texto: 'mais de 99%', numerador: 99 }
  return { texto: `${formatarNumero(p)}%`, numerador: p }
}

// O numerador volta junto para a concordância ("1 em cada 3 não foi" / "2 em cada 3 não foram").
export function fracaoHumana(t: number): { texto: string; numerador: number } {
  if (!Number.isFinite(t)) throw new RangeError(`fração precisa ser um número finito (recebeu ${t})`)
  const x = Math.min(1, Math.max(0, t))
  if (x < PCT_ABAIXO_DE || x > PCT_ACIMA_DE) return porcentagem(x)
  const f = escolherFracao(x)
  const sobra = x - f.a / f.b
  const prefixo = sobra > SOBRA_PARA_PREFIXO ? 'mais de ' : sobra < -SOBRA_PARA_PREFIXO ? 'quase ' : ''
  return { texto: `${prefixo}${f.a} em cada ${f.b}`, numerador: f.a }
}

function exigirNaoNegativo(n: number, nome: string): void {
  if (!Number.isFinite(n) || n < 0) throw new RangeError(`${nome} precisa ser finito e ≥ 0 (recebeu ${n})`)
}

export function formatarNumero(n: number): string {
  return NUMERO.format(n + 0)
}

export function formatarDistancia(km: number): string {
  exigirNaoNegativo(km, 'distância')
  const m = Math.max(PASSO_DISTANCIA_M, Math.round((1000 * km) / PASSO_DISTANCIA_M) * PASSO_DISTANCIA_M)
  return m < 1000 ? `${formatarNumero(m)} m` : `${KM.format(m / 1000)} km`
}

export function formatarPct(f: number): string {
  return `${formatarNumero(Math.round(100 * f))}%`
}

export function listaHumana(itens: readonly string[]): string {
  const inicio = itens.slice(0, -1)
  const ultimo = itens.slice(-1).join('')
  return inicio.length === 0 ? ultimo : `${inicio.join(', ')} e ${ultimo}`
}

export function plural(n: number, formaSingular: string, formaPlural: string): string {
  return Math.abs(n) === 1 ? formaSingular : formaPlural
}

export function contagem(n: number, formaSingular: string, formaPlural: string): string {
  return `${formatarNumero(n)} ${plural(n, formaSingular, formaPlural)}`
}

export function nomeRegiao(r: Pick<Regiao, 'bairro' | 'municipio'>): string {
  return r.bairro.trim() === '' ? r.municipio : `${r.bairro}, ${r.municipio}`
}

export function nomeLocal(r: Pick<Regiao, 'locais' | 'bairro' | 'municipio'>): string {
  const [primeiro, ...outros] = r.locais
  if (primeiro === undefined) return nomeRegiao(r)
  return outros.length === 0 ? primeiro.nome : `${primeiro.nome} e mais ${formatarNumero(outros.length)}`
}
