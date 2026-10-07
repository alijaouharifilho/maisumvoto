// Link para uma âncora do Guia (índice fixo, capítulos do plano, assuntos da comparação). Se a âncora já é a atual
// (inclusive vinda de um link antigo, #/plano/x), o hash não muda e nada rolaria: aqui o clique rola e foca o destino.
import type { MouseEvent, ReactNode } from 'react'
import { lerHash } from '../../nucleo/link.ts'
import { hrefDe } from '../rotas.ts'
import { menosMovimentoAgora } from '../util/midia.ts'
import { idNoGuia } from './guia.ts'

type Props = { ancora: string; className?: string; children: ReactNode }

export function LinkDoGuia({ ancora, className, children }: Props) {
  function aoClicar(e: MouseEvent<HTMLAnchorElement>): void {
    const atual = lerHash(window.location.hash)
    if (atual.rota !== 'guia' || atual.ancora !== ancora) return
    const alvo = document.getElementById(idNoGuia(ancora))
    if (alvo === null) return
    e.preventDefault()
    alvo.scrollIntoView({ block: 'start', behavior: menosMovimentoAgora() ? 'auto' : 'smooth' })
    alvo.focus({ preventScroll: true })
  }
  return (
    <a href={hrefDe('guia', ancora)} onClick={aoClicar} className={className}>
      {children}
    </a>
  )
}
