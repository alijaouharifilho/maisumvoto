// Fatia do candidato apoiado nos votos válidos, com barra (role=img) e marca dos 50%.
import type { Derivadas } from '../../nucleo/metricas.ts'
import { textos } from '../conteudo/textos.ts'
import { candidatura, NOMES } from '../config.ts'
import { PALETA } from '../estilo/paleta.ts'

const t = textos.alvoAqui

type Props = { metricas: Derivadas; variante: 'porAqui' | 'nesteLocal' }

export function AlvoAqui({ metricas, variante }: Props) {
  const p = metricas.pctAlvo
  if (p === null) return null
  const limiar = candidatura.metricas.limiarFolga
  const rotulo = variante === 'porAqui' ? t.porAqui(NOMES.alvo) : t.nesteLocal(NOMES.alvo)
  return (
    <div className="cartao flex flex-col gap-2">
      <p className="font-bold">{rotulo}</p>
      <p className="numeros text-xl font-bold">{t.valor(p, metricas.alvo)}</p>
      {/* Barra desenhada com os dados: <img> não serve; SVG com role=img e rótulo é o padrão do WAI. */}
      {/* oxlint-disable-next-line jsx-a11y/prefer-tag-over-role */}
      <svg role="img" aria-label={t.ariaBarra(NOMES.alvo, p)}
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        className="h-3.5 w-full overflow-hidden rounded-full border border-tinta-suave bg-papel"
      >
        <rect x="0" y="0" width={Math.max(0, Math.min(100, 100 * p))} height="10" fill={PALETA.mata} />
        <line x1="50" y1="0" x2="50" y2="10" stroke={PALETA.tinta} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      </svg>
      <p className="text-sm text-tinta-suave">{t.notaValidos}</p>
      {p >= limiar ? <p className="text-sm">{t.notaFolga(NOMES.alvo, limiar)}</p> : null}
    </div>
  )
}
