// Recuperação depois de um deploy: se um pedaço do JS da versão antiga sumiu (vite:preloadError),
// recarrega a página uma vez. Se já recarregou há pouco, não insiste: avisa que há versão nova.
import { useSyncExternalStore } from 'react'
import { CHAVE_ARMAZENAMENTO } from './config.ts'

const CHAVE = CHAVE_ARMAZENAMENTO('recarregou-em')
const JANELA_MS = 60_000

let versaoNova = false
// Com preventDefault, o import que falhou resolve com undefined e a tela quebra com um TypeError comum enquanto a
// página recarrega: nesse intervalo, todo erro de tela é tratado como versão nova (e não "algo deu errado").
let recarregando = false
const ouvintes = new Set<() => void>()

function marcarVersaoNova(): void {
  versaoNova = true
  ouvintes.forEach((o) => o())
}

function lerRecarga(): number {
  try {
    return Number(window.sessionStorage.getItem(CHAVE) ?? '0')
  } catch {
    return 0
  }
}

function gravarRecarga(instante: number): boolean {
  try {
    window.sessionStorage.setItem(CHAVE, String(instante))
    return true
  } catch {
    return false
  }
}

export function aoFalharPreload(evento: Event, agora = Date.now(), recarregar = (): void => window.location.reload()): void {
  const recente = agora - lerRecarga() < JANELA_MS
  if (!recente && gravarRecarga(agora)) {
    evento.preventDefault()
    recarregando = true
    recarregar()
    return
  }
  marcarVersaoNova()
}

export function instalarRecuperacao(): void {
  window.addEventListener('vite:preloadError', (e) => aoFalharPreload(e))
}

export function houveVersaoNova(): boolean {
  return versaoNova
}

/** Erro típico de pedaço de JS que não existe mais no servidor. */
export function pareceFalhaDeVersao(erro: unknown): boolean {
  if (versaoNova || recarregando) return true
  const msg = erro instanceof Error ? erro.message : String(erro)
  return /dynamically imported module|module script failed|Unable to preload|error loading dynamically/i.test(msg)
}

export function useVersaoNova(): boolean {
  return useSyncExternalStore(
    (o) => {
      ouvintes.add(o)
      return () => ouvintes.delete(o)
    },
    () => versaoNova,
    () => false,
  )
}
