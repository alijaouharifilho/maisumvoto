// Fases do calendário eleitoral. Datas e fases abertas vêm de config/candidatura.json.
import type { Candidatura, IdFase } from './tipos.ts'

type Calendario = Candidatura['calendario']

function fimDe(ate: string): number {
  const t = Date.parse(ate)
  if (Number.isNaN(t)) throw new Error(`data inválida no calendário: "${ate}"`)
  return t
}

function faseAtual(instante: number, cal: Calendario): { id: IdFase; fim: number | null } {
  const ultima = cal.fases.at(-1)
  if (ultima === undefined) throw new Error('calendário sem fases')
  for (const fase of cal.fases) {
    if (fase.ate === null) return { id: fase.id, fim: null }
    const fim = fimDe(fase.ate)
    if (instante < fim) return { id: fase.id, fim }
  }
  return { id: ultima.id, fim: null }
}

// O fim de cada fase é exclusivo: no instante exato do fim já vale a fase seguinte.
export function faseEm(instante: number, cal: Calendario): IdFase {
  return faseAtual(instante, cal).id
}

export function faseAberta(fase: IdFase, cal: Calendario): boolean {
  return cal.fasesAbertas.includes(fase)
}

export function proximaMudanca(instante: number, cal: Calendario): number | null {
  return faseAtual(instante, cal).fim
}

/**
 * Fase com dois relógios: o do aparelho e o do servidor (cabeçalho Date), se houver. Falha fechada: se qualquer
 * um disser "votacao", vale "votacao" (aparelho atrasado não reabre mapa nem roteiros em 25/10); senão, vale o mais
 * adiantado (aparelho atrasado também não reabre a conversa depois do fim).
 */
export function faseComRelogios(local: number, servidor: number | null, cal: Calendario): IdFase {
  if (servidor === null) return faseEm(local, cal)
  if (faseEm(local, cal) === 'votacao' || faseEm(servidor, cal) === 'votacao') return 'votacao'
  return faseEm(Math.max(local, servidor), cal)
}
