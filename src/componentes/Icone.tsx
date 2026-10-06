// Ícone do site: balão de conversa (mata) com um pino de mapa (âmbar, contorno tinta) dentro.
// Desenho próprio; o mesmo de public/favicon.svg.
import { PALETA } from '../estilo/paleta.ts'

const CAMINHO_BALAO = 'M9 3h14a7 7 0 0 1 7 7v7a7 7 0 0 1-7 7H14l-6 6v-6.2A7 7 0 0 1 2 17v-7a7 7 0 0 1 7-7z'
const CAMINHO_PINO = 'M16 5.6c-3.3 0-5.9 2.6-5.9 5.8 0 4.2 5.9 9.4 5.9 9.4s5.9-5.2 5.9-9.4c0-3.2-2.6-5.8-5.9-5.8z'

export function Icone({ tamanho = 32, className }: { tamanho?: number; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <path d={CAMINHO_BALAO} fill={PALETA.mata} />
      <path d={CAMINHO_PINO} fill={PALETA.ambar} stroke={PALETA.tinta} strokeWidth="1.3" strokeLinejoin="round" />
      <circle cx="16" cy="11.4" r="2.1" fill={PALETA.papel} stroke={PALETA.tinta} strokeWidth="1.1" />
    </svg>
  )
}
