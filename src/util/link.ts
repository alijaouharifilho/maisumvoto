// Links públicos: o do ponto (sempre arredondado à grade, nunca o ponto exato) e o do WhatsApp.
import { formatarAncora, lerAncora, montarHash } from '../../nucleo/link.ts'
import { GRADE_LINK } from '../config.ts'

export type Ponto = { readonly lat: number; readonly lon: number }

export function ancoraDoPonto(p: Ponto): string {
  return formatarAncora(p.lat, p.lon, GRADE_LINK)
}

/** O ponto que quem abrir o link vai ver (o arredondado). */
export function pontoArredondado(p: Ponto): Ponto {
  const lido = lerAncora(ancoraDoPonto(p))
  return lido ?? p
}

/** "https://site/#/mapa/@-25.430,-49.275"; sem ponto, a raiz. */
export function linkDoPonto(origem: string, p: Ponto | null): string {
  const raiz = `${origem.replace(/\/$/, '')}/`
  return p === null ? raiz : `${raiz}${montarHash('mapa', ancoraDoPonto(p))}`
}

export function hrefWhatsApp(mensagem: string): string {
  return `https://wa.me/?text=${encodeURIComponent(mensagem)}`
}

export function mesmoPontoNoLink(a: Ponto, b: Ponto): boolean {
  return ancoraDoPonto(a) === ancoraDoPonto(b)
}
