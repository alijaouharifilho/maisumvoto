// #/comparar: os mesmos assuntos nos dois planos registrados no TSE, lado a lado. Cada lado traz um resumo e o
// trecho literal com link para a página do PDF; no fim de cada assunto, o que há em comum e a diferença.
import { useMemo } from 'react'
import { comparacao, linkPaginaAdversario, type Comparacao, type LadoDaComparacao, type TemaComparado } from '../conteudo/comparacao.ts'
import { linkPagina, plano } from '../conteudo/conteudo.ts'
import { preencherTudo } from '../conteudo/modelo.ts'
import { dia, textos } from '../conteudo/textos.ts'
import { AbasDoPlano } from '../componentes/AbasDoPlano.tsx'
import { Rodape } from '../componentes/Moldura.tsx'
import { CitacaoDoPlano } from '../componentes/Roteiro.tsx'
import { NOMES } from '../config.ts'
import { hrefDe, useRolarParaAncora } from '../rotas.ts'
import { useValoresModelo } from './valores.ts'

const t = textos.paginas.comparar
const idDaAncora = (ancora: string): string => `comparar-${ancora}`

type Lado = {
  readonly nome: string
  readonly link: (pagina: number) => string
  /** Verde para o candidato apoiado, vermelho para o adversário: as mesmas cores do mapa. */
  readonly borda: string
}

const LADO_ALVO: Lado = { nome: NOMES.alvo, link: linkPagina, borda: 'border-mata' }
const LADO_ADVERSARIO: Lado = { nome: NOMES.adversario, link: linkPaginaAdversario, borda: 'border-adversario' }

function Coluna({ lado, conteudo }: { lado: Lado; conteudo: LadoDaComparacao }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl bg-branco p-4">
      <h3 className="font-titulo text-lg font-bold">{t.planoDe(lado.nome)}</h3>
      <p>{conteudo.resumo}</p>
      {conteudo.citacoes.map((c) => (
        <CitacaoDoPlano key={`${c.pagina}-${c.trecho}`} citacao={c} href={lado.link(c.pagina)} complemento={t.paginaComplemento(lado.nome)} borda={lado.borda} />
      ))}
    </div>
  )
}

function BlocoTema({ tema }: { tema: TemaComparado }) {
  const idTitulo = `titulo-comparar-${tema.chave}`
  return (
    <section id={idDaAncora(tema.chave)} tabIndex={-1} aria-labelledby={idTitulo} className="flex scroll-mt-20 flex-col gap-3 border-t border-linha pt-6">
      <h2 id={idTitulo} className="font-titulo text-2xl font-bold">
        {tema.titulo}
      </h2>
      <p className="text-lg">{tema.pergunta}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <Coluna lado={LADO_ALVO} conteudo={tema.alvo} />
        <Coluna lado={LADO_ADVERSARIO} conteudo={tema.adversario} />
      </div>
      <div className="flex flex-col gap-2 rounded-xl bg-petroleo-claro p-3">
        {tema.emComum === null ? null : (
          <p>
            <strong>{t.emComum}</strong> {tema.emComum}
          </p>
        )}
        <p>
          <strong>{t.diferenca}</strong> {tema.diferenca}
        </p>
      </div>
    </section>
  )
}

/** A comparação com os {{nomes}} preenchidos pela config, como os roteiros. */
function useComparacao(): Comparacao {
  const valores = useValoresModelo()
  return useMemo(() => preencherTudo(comparacao, valores), [valores])
}

function LinkPdf({ href, nome }: { href: string; nome: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="font-bold">
      {t.pdfDe(nome)}
      <span className="sr-only"> {textos.acessibilidade.novaAba}</span>
    </a>
  )
}

export function PaginaComparar({ ancora }: { ancora: string | null }) {
  useRolarParaAncora(ancora, idDaAncora)
  const { documentoAdversario, temas } = useComparacao()
  return (
    <article className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-3">
        <AbasDoPlano atual="comparar" />
        <h1 className="font-titulo text-3xl font-extrabold">{t.titulo}</h1>
        <p className="text-lg">{t.chamada(NOMES)}</p>
        <ul className="flex flex-col gap-1">
          <li>
            <LinkPdf href={plano.documento.url} nome={NOMES.alvo} />
          </li>
          <li>
            <LinkPdf href={documentoAdversario.url} nome={NOMES.adversario} />
          </li>
        </ul>
        <p className="text-sm text-tinta-suave">{t.conferido(dia(documentoAdversario.conferidoEm))}</p>
      </header>
      <nav aria-label={t.indice} className="cartao">
        <ul className="flex flex-col gap-1">
          {temas.map((tema) => (
            <li key={tema.chave}>
              <a href={hrefDe('comparar', tema.chave)}>{tema.titulo}</a>
            </li>
          ))}
        </ul>
      </nav>
      {temas.map((tema) => (
        <BlocoTema key={tema.chave} tema={tema} />
      ))}
      <Rodape />
    </article>
  )
}
