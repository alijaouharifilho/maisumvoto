// Moldura do site: link "pular", cabeçalho azul com a marca e o selo "independente", as duas abas (no topo no
// computador, fixas embaixo no celular), faixa da fase, rodapé e aviso de versão nova.
import type { MouseEvent, ReactNode } from 'react'
import type { Rota } from '../../nucleo/link.ts'
import type { IdFase } from '../../nucleo/tipos.ts'
import { textos } from '../conteudo/textos.ts'
import { APOIADO, FIM_CONVERSA, ID_CONTEUDO, NOME_SITE, ORDEM_ROTAS, type RotaDoMenu } from '../config.ts'
import { hrefDe } from '../rotas.ts'
import { Icone } from './Icone.tsx'

function pularParaConteudo(e: MouseEvent<HTMLAnchorElement>): void {
  // O hash é das rotas: em vez de navegar para #conteudo, só move o foco.
  e.preventDefault()
  document.getElementById(ID_CONTEUDO)?.focus()
}

/** Ícones das abas (desenho próprio, traço na cor do texto): mapa dobrado e livro aberto. */
function IconeDaAba({ rota }: { rota: RotaDoMenu }) {
  const caminhos: Record<RotaDoMenu, ReactNode> = {
    mapa: (
      <>
        <path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" />
        <path d="M9 4v14M15 6v14" />
      </>
    ),
    guia: (
      <>
        <path d="M12 6.5C10 5 7 4.5 3.5 5v14c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V5c-3.5-.5-6.5 0-8.5 1.5z" />
        <path d="M12 6.5V20" />
      </>
    ),
  }
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {caminhos[rota]}
    </svg>
  )
}

const ESTILO_ABA = {
  topo: 'flex min-h-11 items-center border-b-4 border-transparent px-3 pt-1 font-titulo text-[0.95rem] font-bold no-underline hover:bg-marca-escura aria-[current=page]:border-destaque',
  baixo:
    'flex h-(--altura-menu-inferior) flex-col items-center justify-center gap-0.5 border-t-4 border-transparent font-titulo text-sm font-bold text-tinta-suave no-underline hover:bg-superficie-2 aria-[current=page]:border-destaque aria-[current=page]:bg-marca-clara aria-[current=page]:text-marca',
} as const

/** As duas abas. Só uma das versões é montada por vez (topo no computador, embaixo no celular). */
function Abas({ rota, posicao }: { rota: Rota; posicao: keyof typeof ESTILO_ABA }) {
  return (
    <nav aria-label={textos.navegacao.rotulo} className={posicao === 'topo' ? 'ml-auto' : ''}>
      <ul className={posicao === 'topo' ? 'flex gap-1' : 'grid grid-cols-2'}>
        {ORDEM_ROTAS.map((r) => (
          <li key={r}>
            <a href={hrefDe(r)} aria-current={r === rota ? 'page' : undefined} className={ESTILO_ABA[posicao]}>
              {posicao === 'baixo' ? <IconeDaAba rota={r} /> : null}
              {textos.navegacao.rotas[r]}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function Cabecalho({ rota, desktop }: { rota: Rota; desktop: boolean }) {
  return (
    <header className="sobre-azul sticky top-0 z-30 shrink-0 bg-marca pt-[env(safe-area-inset-top)]">
      <a
        href={`#${ID_CONTEUDO}`}
        onClick={pularParaConteudo}
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-branco focus:p-2 focus:text-marca"
      >
        {textos.navegacao.pular}
      </a>
      <div className="flex h-(--altura-cabecalho) items-center gap-3 px-3 sm:px-4">
        <a href={hrefDe('mapa')} aria-label={textos.navegacao.marcaAria(NOME_SITE)} className="flex min-w-0 items-center gap-2 no-underline">
          <Icone tamanho={34} className="shrink-0" />
          <span className="font-titulo text-lg leading-none font-extrabold whitespace-nowrap max-[359px]:sr-only">{NOME_SITE}</span>
        </a>
        <span className="shrink-0 rounded-full border border-branco/70 px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">{textos.navegacao.selo}</span>
        {desktop ? <Abas rota={rota} posicao="topo" /> : null}
      </div>
    </header>
  )
}

/** Celular: as abas ficam fixas embaixo, ao alcance do polegar. A <main> reserva a altura (App.tsx). */
export function MenuInferior({ rota }: { rota: Rota }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-linha bg-branco pb-[env(safe-area-inset-bottom)]">
      <Abas rota={rota} posicao="baixo" />
    </div>
  )
}

export function FaixaDeFase({ fase }: { fase: IdFase }) {
  return <output className="block shrink-0 bg-destaque px-4 py-2 text-center text-sm font-bold text-tinta">{textos.fases[fase](FIM_CONVERSA)}</output>
}

export function AvisoVersaoNova() {
  return (
    <div role="alert" className="sobre-azul flex flex-wrap items-center justify-center gap-3 bg-marca-escura px-4 py-2">
      <span className="font-bold">{textos.sistema.versaoNova}</span>
      <button type="button" className="botao bg-branco text-marca" onClick={() => window.location.reload()}>
        {textos.sistema.recarregar}
      </button>
    </div>
  )
}

export function Rodape() {
  const t = textos.rodape
  return (
    <footer className="sobre-azul flex flex-col gap-2 rounded-2xl bg-marca-escura p-4 text-sm">
      <p className="font-bold">{t.natureza(APOIADO)}</p>
      <p>{t.dados}</p>
      <p className="flex gap-4">
        <a href={hrefDe('sobre')} className="inline-block py-1.5">
          {t.sobre}
        </a>
        <a href={hrefDe('sobre', 'privacidade')} className="inline-block py-1.5">
          {t.privacidade}
        </a>
      </p>
    </footer>
  )
}

export function DiaDaVotacao() {
  const t = textos.diaDaVotacao
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="font-titulo text-3xl font-extrabold text-marca">{t.titulo}</h1>
      {t.paragrafos.map((p) => (
        <p key={p} className="text-lg">
          {p}
        </p>
      ))}
    </section>
  )
}
