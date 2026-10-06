// Moldura do site: link "pular", cabeçalho com marca e navegação, faixa da fase, rodapé e aviso de versão nova.
import type { MouseEvent } from 'react'
import type { Rota } from '../../nucleo/link.ts'
import type { IdFase } from '../../nucleo/tipos.ts'
import { textos } from '../conteudo/textos.ts'
import { APOIADO, candidatura, FIM_CONVERSA, ID_CONTEUDO, NOME_SITE, ORDEM_ROTAS } from '../config.ts'
import { hrefDe } from '../rotas.ts'
import { Icone } from './Icone.tsx'



function pularParaConteudo(e: MouseEvent<HTMLAnchorElement>): void {
  // O hash é das rotas: em vez de navegar para #conteudo, só move o foco.
  e.preventDefault()
  document.getElementById(ID_CONTEUDO)?.focus()
}

/** "Mais um voto" → ["Mais um", "voto"]: a marca ocupa duas linhas. */
function duasLinhas(nome: string): [string, string] {
  const corte = nome.lastIndexOf(' ')
  return corte <= 0 ? [nome, ''] : [nome.slice(0, corte), nome.slice(corte + 1)]
}

export function Cabecalho({ rota }: { rota: Rota }) {
  const [linha1, linha2] = duasLinhas(NOME_SITE)
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-linha bg-papel pt-[env(safe-area-inset-top)]">
      <a href={`#${ID_CONTEUDO}`} onClick={pularParaConteudo} className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-papel focus:p-2">
        {textos.navegacao.pular}
      </a>
      <div className="flex h-(--altura-cabecalho) items-center justify-between gap-2 px-3 sm:px-4">
        <a href={hrefDe('mapa')} aria-label={textos.navegacao.marcaAria(NOME_SITE)} className="flex items-center gap-2 text-tinta no-underline">
          <Icone tamanho={36} />
          <span className="font-titulo text-[0.95rem] leading-none font-extrabold whitespace-nowrap max-[379px]:sr-only">
            {linha1}
            <br />
            {linha2}
          </span>
        </a>
        <nav aria-label={textos.navegacao.rotulo}>
          <ul className="flex gap-0.5 sm:gap-2">
            {ORDEM_ROTAS.map((r) => (
              <li key={r}>
                <a
                  href={hrefDe(r)}
                  aria-current={r === rota ? 'page' : undefined}
                  className="flex min-h-11 items-center rounded-lg px-2 py-2 text-[0.95rem] font-bold text-tinta no-underline hover:bg-papel-2 aria-[current=page]:bg-mata aria-[current=page]:text-branco sm:px-3"
                >
                  {textos.navegacao.rotas[r]}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

export function FaixaDeFase({ fase }: { fase: IdFase }) {
  const destaque = fase === 'retaFinal' || fase === 'votacao' || fase === 'pausa'
  return (
    <output className={`block shrink-0 px-4 py-2 text-center text-sm font-bold ${destaque ? 'bg-ambar text-tinta' : 'bg-mata-clara text-tinta'}`}>
      {textos.fases[fase](FIM_CONVERSA)}
    </output>
  )
}

export function AvisoVersaoNova() {
  return (
    <div role="alert" className="flex flex-wrap items-center justify-center gap-3 bg-petroleo px-4 py-2 text-branco">
      <span className="font-bold">{textos.sistema.versaoNova}</span>
      <button type="button" className="botao bg-papel text-petroleo" onClick={() => window.location.reload()}>
        {textos.sistema.recarregar}
      </button>
    </div>
  )
}

export function Rodape() {
  const t = textos.rodape
  return (
    <footer className="flex flex-col gap-2 border-t border-linha pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-tinta-suave">
      <p className="font-bold text-tinta">{t.natureza(APOIADO)}</p>
      <p>{t.responsavel(candidatura.site.responsavel)}</p>
      <p>{t.dados}</p>
      <p className="flex gap-4">
        <a href={hrefDe('sobre')} className="inline-block py-1.5">{t.sobre}</a>
        <a href={hrefDe('sobre', 'privacidade')} className="inline-block py-1.5">{t.privacidade}</a>
      </p>
    </footer>
  )
}

export function DiaDaVotacao() {
  const t = textos.diaDaVotacao
  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-10">
      <h1 className="font-titulo text-3xl font-bold">{t.titulo}</h1>
      {t.paragrafos.map((p) => (
        <p key={p} className="text-lg">
          {p}
        </p>
      ))}
    </section>
  )
}


