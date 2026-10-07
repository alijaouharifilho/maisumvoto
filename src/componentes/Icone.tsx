// Ícone do site: balão de conversa amarelo com "+1" em azul ("mais um voto"), contorno azul-escuro para aparecer
// tanto no cabeçalho azul quanto na aba clara do navegador. Desenho próprio; o mesmo de public/favicon.svg.
import { PALETA } from '../estilo/paleta.ts'

const CAMINHO_BALAO = 'M9 3h14a7 7 0 0 1 7 7v7a7 7 0 0 1-7 7H14l-6 6v-6.2A7 7 0 0 1 2 17v-7a7 7 0 0 1 7-7z'
const CAMINHO_MAIS = 'M6.6 12.2h2.7v-2.7h2.6v2.7h2.7v2.6h-2.7v2.7h-2.6v-2.7H6.6z'
const CAMINHO_UM = 'M18.4 11.2l3.4-2.6h2.6v11.2h-2.9v-7.6l-2.2 1.5z'

export function Icone({ tamanho = 32, className }: { tamanho?: number; className?: string }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true" focusable="false" className={className}>
      <path d={CAMINHO_BALAO} fill={PALETA.destaque} stroke={PALETA.marcaEscura} strokeWidth="1.2" strokeLinejoin="round" />
      <path d={CAMINHO_MAIS} fill={PALETA.marca} />
      <path d={CAMINHO_UM} fill={PALETA.marca} />
    </svg>
  )
}
