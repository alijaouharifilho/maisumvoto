// Foco e rolagem de diálogos: foco inicial, devolução ao fechar, Esc, foco preso e trava de rolagem (modal).
import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])'

/** Foca `inicial` ao abrir; ao fechar, devolve o foco a quem tinha antes (ou ao elemento de reserva). */
export function useFocoDeDialogo(inicial: RefObject<HTMLElement | null>, reserva: () => HTMLElement | null): void {
  const reservaAtual = useRef(reserva)
  useLayoutEffect(() => {
    reservaAtual.current = reserva
  })
  useEffect(() => {
    const anterior = document.activeElement
    inicial.current?.focus()
    const obterReserva = reservaAtual
    return () => {
      const volta = anterior instanceof HTMLElement && anterior !== document.body && anterior.isConnected ? anterior : obterReserva.current()
      volta?.focus()
    }
  }, [inicial])
}

export function useTeclaEsc(aoApertar: () => void): void {
  useEffect(() => {
    const ouvir = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') aoApertar()
    }
    document.addEventListener('keydown', ouvir)
    return () => document.removeEventListener('keydown', ouvir)
  }, [aoApertar])
}

/** Com o diálogo modal, Tab e Shift+Tab circulam só dentro dele. */
export function useFocoPreso(caixa: RefObject<HTMLElement | null>, ativo: boolean): void {
  useEffect(() => {
    const el = caixa.current
    if (!ativo || el === null) return
    const ouvir = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') return
      const itens = Array.from(el.querySelectorAll<HTMLElement>(FOCAVEIS))
      const primeiro = itens[0]
      const ultimo = itens.at(-1)
      if (primeiro === undefined || ultimo === undefined) return
      const atual = document.activeElement
      if (e.shiftKey && (atual === primeiro || !el.contains(atual))) {
        e.preventDefault()
        ultimo.focus()
      } else if (!e.shiftKey && (atual === ultimo || !el.contains(atual))) {
        e.preventDefault()
        primeiro.focus()
      }
    }
    document.addEventListener('keydown', ouvir)
    return () => document.removeEventListener('keydown', ouvir)
  }, [caixa, ativo])
}

/** Ficha de tela cheia: a página de baixo não rola. */
export function useTravaRolagem(ativo: boolean): void {
  useEffect(() => {
    if (!ativo) return
    const antes = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = antes
    }
  }, [ativo])
}
