// Miniatura do marcador do mapa, para a lista e a legenda. Decorativa: o texto ao lado diz a classe.
import { PALETA } from '../estilo/paleta.ts'
import { CENTRO, SIMBOLOGIA, type Classe } from '../mapa/simbologia.ts'

type Props = { classe: Classe; tamanho?: number }

export function Selo({ classe, tamanho = 20 }: Props) {
  const s = SIMBOLOGIA[classe]
  const meio = tamanho / 2
  const raio = classe === 'semResultado' ? tamanho * 0.28 : meio - s.largura / 2 - 1
  // Contorno branco some sobre o papel; um fio fino por fora mantém a forma visível na lista.
  const precisaFio = s.contorno === PALETA.branco || s.preenchimento === PALETA.branco
  return (
    <svg width={tamanho} height={tamanho} viewBox={`0 0 ${tamanho} ${tamanho}`} aria-hidden="true" focusable="false" className="shrink-0">
      <circle cx={meio} cy={meio} r={raio} fill={s.preenchimento} stroke={s.contorno} strokeWidth={s.largura} />
      {precisaFio ? (
        <circle cx={meio} cy={meio} r={raio + s.largura / 2} fill="none" stroke={PALETA.tintaSuave} strokeWidth={0.75} />
      ) : null}
      {s.centro ? (
        <circle cx={meio} cy={meio} r={CENTRO.raio * (tamanho / 24)} fill={CENTRO.preenchimento} stroke={CENTRO.contorno} strokeWidth={1} />
      ) : null}
    </svg>
  )
}
