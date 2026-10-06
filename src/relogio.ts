// Fase do calendário (config), reavaliada a cada 30 s, quando a aba volta a ficar visível e quando chega a hora do
// servidor. ?agora=<ISO> simula o relógio, mas só no build de desenvolvimento.
// Dois relógios: o do aparelho e o do servidor (cabeçalho Date do indice.json, que vai sempre revalidado). Um
// aparelho com a data errada não reabre mapa e roteiros no dia da votação (nucleo/calendario.ts, faseComRelogios).
import { useEffect, useState } from 'react'
import { faseAberta, faseComRelogios } from '../nucleo/calendario.ts'
import type { IdFase } from '../nucleo/tipos.ts'
import { candidatura } from './config.ts'

const INTERVALO_MS = 30_000

function deslocamentoSimulado(): number {
  if (!import.meta.env.DEV) return 0
  const pedido = new URLSearchParams(window.location.search).get('agora')
  const t = pedido === null ? Number.NaN : Date.parse(pedido)
  return Number.isNaN(t) ? 0 : t - Date.now()
}

const DESLOCAMENTO = deslocamentoSimulado()

/** Hora do servidor no momento em que chegou, e o relógio monotônico do aparelho naquele momento. */
type Referencia = { readonly servidor: number; readonly monotonico: number }

let referencia: Referencia | null = null
const ouvintes = new Set<() => void>()

export function agora(): number {
  return Date.now() + DESLOCAMENTO
}

/** Hora do servidor agora (a recebida + o tempo que passou), ou null se ainda não chegou ou se está simulando. */
export function agoraDoServidor(): number | null {
  if (referencia === null || DESLOCAMENTO !== 0) return null
  return referencia.servidor + (performance.now() - referencia.monotonico)
}

/** Guarda a hora do cabeçalho Date de uma resposta revalidada. Valor ausente ou ilegível é ignorado. */
export function registrarHoraDoServidor(cabecalhoDate: string | null): void {
  const t = cabecalhoDate === null ? Number.NaN : Date.parse(cabecalhoDate)
  if (Number.isNaN(t)) return
  referencia = { servidor: t, monotonico: performance.now() }
  ouvintes.forEach((avisar) => avisar())
}

/** Só para testes: volta ao estado sem hora do servidor. */
export function esquecerHoraDoServidor(): void {
  referencia = null
}

export type EstadoFase = { fase: IdFase; aberta: boolean }

export function faseAgora(): EstadoFase {
  const fase = faseComRelogios(agora(), agoraDoServidor(), candidatura.calendario)
  return { fase, aberta: faseAberta(fase, candidatura.calendario) }
}

export function useFase(): EstadoFase {
  const [estado, setEstado] = useState(faseAgora)
  useEffect(() => {
    const atualizar = (): void => {
      const novo = faseAgora()
      setEstado((velho) => (velho.fase === novo.fase ? velho : novo))
    }
    const id = window.setInterval(atualizar, INTERVALO_MS)
    document.addEventListener('visibilitychange', atualizar)
    ouvintes.add(atualizar)
    atualizar()
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', atualizar)
      ouvintes.delete(atualizar)
    }
  }, [])
  return estado
}
