// Guia, bloco "Os dois planos": os mesmos assuntos nos dois planos registrados no TSE, lado a lado. Cada lado traz um
// resumo e o trecho literal com link para a página do PDF; no fim de cada assunto, o que há em comum e a diferença.
import { useMemo } from 'react'
import { comparacao, linkPaginaAdversario, type Comparacao, type LadoDaComparacao, type TemaComparado } from '../conteudo/comparacao.ts'
import { linkPagina, plano } from '../conteudo/conteudo.ts'
import { preencherTudo } from '../conteudo/modelo.ts'
import { dia, textos } from '../conteudo/textos.ts'
import { CitacaoDoPlano } from '../componentes/Roteiro.tsx'
import { NOMES } from '../config.ts'
import { hrefDe } from '../rotas.ts'
import { ancoraNoGuia, idNoGuia, ROLAGEM_GUIA } from './guia.ts'
import { useValoresModelo } from './valores.ts'

const t = textos.paginas.comparar

type Lado = {
  readonly nome: string
  readonly link: (pagina: number) => string
  /** Verde para o candidato apoiado, vermelho para o adversário: as mesmas cores do mapa (classes escritas por
   *  inteiro para o Tailwind achar). `borda` vai nos trechos citados; `topo`, na faixa de cima da coluna. */
  readonly borda: string
  readonly topo: string
}

const LADO_ALVO: Lado = { nome: NOMES.alvo, link: linkPagina, borda: 'border-alvo', topo: 'border-t-alvo' }
const LADO_ADVERSARIO: Lado = { nome: NOMES.adversario, link: linkPaginaAdversario, borda: 'border-adversario', topo: 'border-t-adversario' }

function Coluna({ lado, conteudo }: { lado: Lado; conteudo: LadoDaComparacao }) {
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-t-8 border-linha bg-branco p-4 ${lado.topo}`}>
      <h4 className="font-titulo text-lg font-extrabold">{t.planoDe(lado.nome)}</h4>
      <p>{conteudo.resumo}</p>
      {conteudo.citacoes.map((c) => (
        <CitacaoDoPlano key={`${c.pagina}-${c.trecho}`} citacao={c} href={lado.link(c.pagina)} complemento={t.paginaComplemento(lado.nome)} borda={lado.borda} />
      ))}
    </div>
  )
}

function BlocoTema({ tema }: { tema: TemaComparado }) {
  const id = idNoGuia(ancoraNoGuia('comparar', tema.chave))
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-titulo`} className={`flex flex-col gap-3 border-t border-linha pt-6 ${ROLAGEM_GUIA}`}>
      <h3 id={`${id}-titulo`} className="font-titulo text-xl font-extrabold text-marca lg:text-2xl">
        {tema.titulo}
      </h3>
      <p className="text-lg">{tema.pergunta}</p>
      <div className="grid gap-3 lg:grid-cols-2">
        <Coluna lado={LADO_ALVO} conteudo={tema.alvo} />
        <Coluna lado={LADO_ADVERSARIO} conteudo={tema.adversario} />
      </div>
      <div className="flex flex-col gap-2 rounded-2xl bg-marca-clara p-4">
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

export function BlocoComparar() {
  const { documentoAdversario, temas } = useComparacao()
  const idBloco = idNoGuia(ancoraNoGuia('comparar'))
  return (
    <section id={idBloco} tabIndex={-1} aria-labelledby={`${idBloco}-titulo`} className={`flex flex-col gap-6 ${ROLAGEM_GUIA}`}>
      <header className="flex flex-col gap-2 border-l-8 border-destaque pl-4">
        <h2 id={`${idBloco}-titulo`} className="font-titulo text-2xl font-extrabold text-marca lg:text-3xl">
          {t.titulo}
        </h2>
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
      <nav aria-label={t.indice}>
        <ul className="flex flex-wrap gap-2">
          {temas.map((tema) => (
            <li key={tema.chave}>
              <a
                href={hrefDe('guia', ancoraNoGuia('comparar', tema.chave))}
                className="inline-flex min-h-11 items-center rounded-full border border-linha bg-branco px-3 text-sm font-bold no-underline hover:bg-marca-clara"
              >
                {tema.titulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {temas.map((tema) => (
        <BlocoTema key={tema.chave} tema={tema} />
      ))}
    </section>
  )
}
