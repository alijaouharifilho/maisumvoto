// Media queries como estado React (largura de desktop e preferência por menos movimento).
import { useSyncExternalStore } from 'react'
import { LARGURA_DESKTOP_PX } from '../config.ts'

function consulta(q: string): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(q) : null
}

export function useMidia(q: string, padrao = false): boolean {
  return useSyncExternalStore(
    (ouvinte) => {
      const mq = consulta(q)
      mq?.addEventListener('change', ouvinte)
      return () => mq?.removeEventListener('change', ouvinte)
    },
    () => consulta(q)?.matches ?? padrao,
    () => padrao,
  )
}

export const CONSULTA_DESKTOP = `(min-width: ${LARGURA_DESKTOP_PX}px)`
export const CONSULTA_MENOS_MOVIMENTO = '(prefers-reduced-motion: reduce)'

export function useDesktop(): boolean {
  return useMidia(CONSULTA_DESKTOP)
}

export function useMenosMovimento(): boolean {
  return useMidia(CONSULTA_MENOS_MOVIMENTO)
}

export function menosMovimentoAgora(): boolean {
  return consulta(CONSULTA_MENOS_MOVIMENTO)?.matches ?? false
}
