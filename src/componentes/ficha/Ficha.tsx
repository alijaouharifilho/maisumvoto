// Ficha da região (carregada sob demanda). Desktop: painel sobre a coluna da esquerda, mapa à vista.
// Celular: tela cheia, aria-modal, foco preso e página de baixo sem rolar. Esc fecha; o foco volta ao item.
import { useCallback, useId, useRef } from 'react'
import { formatarDistancia, nomeLocal } from '../../../nucleo/frases.ts'
import { derivar } from '../../../nucleo/metricas.ts'
import type { RegiaoComDist } from '../../../nucleo/ranking.ts'
import type { Indice } from '../../../nucleo/tipos.ts'
import { textos } from '../../conteudo/textos.ts'
import { CFG } from '../../config.ts'
import { useFocoDeDialogo, useFocoPreso, useTeclaEsc, useTravaRolagem } from '../../util/foco.ts'
import { ComoChegar, ConversaDaFicha, LocaisDaFicha, NumerosDaFicha } from './Partes.tsx'

const t = textos.ficha

type Props = {
  regiao: RegiaoComDist
  indice: Indice | null
  /** Fase aberta (manchete com "até") ou fechada (frase neutra). */
  aberta: boolean
  /** Tela cheia no celular. */
  modal: boolean
  onFechar: () => void
}

export function Ficha({ regiao, indice, aberta, modal, onFechar }: Props) {
  const id = useId()
  const voltar = useRef<HTMLButtonElement>(null)
  const caixa = useRef<HTMLDivElement>(null)
  const itemDaLista = useCallback(
    () => Array.from(document.querySelectorAll<HTMLElement>('[data-regiao]')).find((el) => el.dataset.regiao === regiao.id) ?? null,
    [regiao.id],
  )
  useFocoDeDialogo(voltar, itemDaLista)
  useTeclaEsc(onFechar)
  useFocoPreso(caixa, modal)
  useTravaRolagem(modal)
  const metricas = regiao.votos === null ? null : derivar(regiao.votos, CFG)
  const posicao = modal
    ? 'fixed inset-0 z-50 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]'
    : 'absolute inset-0 z-20'
  return (
    // <dialog> nativo põe a Ficha na camada do topo e rouba o controle do foco; aqui o controle é manual
    // (não modal no desktop, modal no celular), então o papel vai explícito.
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    <div ref={caixa} role="dialog" aria-modal={modal} aria-labelledby={`${id}-titulo`} className={`${posicao} animate-entrada overflow-y-auto overscroll-contain bg-fundo`}>
      <div className="sticky top-0 z-10 flex items-center border-b border-linha bg-branco px-2 py-2">
        <button ref={voltar} type="button" onClick={onFechar} aria-label={t.fecharAria} className="botao botao-secundario min-h-11 py-1">
          <span aria-hidden="true">←</span> {t.voltar}
        </button>
      </div>
      <div className="flex flex-col gap-5 p-4">
        <header className="flex flex-col gap-1">
          <h2 id={`${id}-titulo`} className="font-titulo text-2xl font-bold">
            {nomeLocal(regiao)}
          </h2>
          <p className="text-tinta-suave">
            {t.subtitulo({ bairro: regiao.bairro, municipio: regiao.municipio, uf: regiao.uf, distancia: formatarDistancia(regiao.dist) })}
          </p>
          <p className="font-bold">{t.eleitorado(regiao.eleitores)}</p>
        </header>
        {regiao.votos !== null && metricas !== null ? (
          <>
            <NumerosDaFicha votos={regiao.votos} metricas={metricas} indice={indice} aberta={aberta} />
            <ConversaDaFicha votos={regiao.votos} />
          </>
        ) : (
          <p className="cartao">{t.semResultado}</p>
        )}
        <ComoChegar regiao={regiao} />
        <LocaisDaFicha regiao={regiao} indice={indice} />
      </div>
    </div>
  )
}
