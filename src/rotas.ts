// Rotas por hash (#/mapa, #/prosa, #/plano, #/comparar, #/sobre). O ponto do mapa vai no hash arredondado à grade.
// replaceState não dispara hashchange, então quem troca o hash por aqui avisa os ouvintes à mão.
import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { lerHash, montarHash, type Rota } from '../nucleo/link.ts'

type Ouvinte = () => void

const ouvintes = new Set<Ouvinte>()

function avisar(): void {
  ouvintes.forEach((o) => o())
}

function assinar(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte)
  window.addEventListener('hashchange', ouvinte)
  return () => {
    ouvintes.delete(ouvinte)
    window.removeEventListener('hashchange', ouvinte)
  }
}

const lerAtual = (): string => window.location.hash
const lerNoServidor = (): string => ''

export type EstadoRota = { rota: Rota; ancora: string | null }

export function useRota(): EstadoRota {
  const hash = useSyncExternalStore(assinar, lerAtual, lerNoServidor)
  return useMemo(() => lerHash(hash), [hash])
}

/** Troca o hash sem criar entrada no histórico (escolher outro ponto não deve encher o "voltar"). */
export function substituirHash(rota: Rota, ancora: string | null): void {
  const novo = montarHash(rota, ancora)
  if (window.location.hash === novo) return
  window.history.replaceState(window.history.state, '', novo)
  avisar()
}

export function hrefDe(rota: Rota, ancora?: string | null): string {
  return montarHash(rota, ancora)
}

/** Rola até o bloco da âncora (ou ao topo sem âncora) quando a página monta ou a âncora muda. */
export function useRolarParaAncora(ancora: string | null, idDe: (ancora: string) => string, pronto = true): void {
  useEffect(() => {
    if (!pronto) return
    if (ancora === null) {
      window.scrollTo({ top: 0 })
      return
    }
    const alvo = document.getElementById(idDe(ancora))
    if (alvo === null) return
    alvo.scrollIntoView({ block: 'start' })
    if (alvo instanceof HTMLElement) alvo.focus({ preventScroll: true })
  }, [ancora, idDe, pronto])
}
