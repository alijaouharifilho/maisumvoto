// #/plano: os capítulos do plano de governo em cartões de conversa (em uma frase, um número com fonte,
// por que faz sentido, pergunta para puxar o assunto) e, em cada um, o trecho literal com link para a página do PDF.
import { plano, type Capitulo } from '../conteudo/conteudo.ts'
import { dia, textos } from '../conteudo/textos.ts'
import { AbasDoPlano } from '../componentes/AbasDoPlano.tsx'
import { CartaoDoPlano } from '../componentes/CartaoDoPlano.tsx'
import { Rodape } from '../componentes/Moldura.tsx'
import { NOMES } from '../config.ts'
import { hrefDe, useRolarParaAncora } from '../rotas.ts'
import { linkPagina } from '../conteudo/conteudo.ts'

const t = textos.paginas.plano
const idDaAncora = (ancora: string): string => `plano-${ancora}`

function BlocoCapitulo({ capitulo }: { capitulo: Capitulo }) {
  const [inicio, fim] = capitulo.paginas
  return (
    <section id={idDaAncora(capitulo.chave)} tabIndex={-1} aria-labelledby={`titulo-${capitulo.chave}`} className="flex scroll-mt-20 flex-col gap-3 border-t border-linha pt-6">
      <h2 id={`titulo-${capitulo.chave}`} className="font-titulo text-2xl font-bold">
        {capitulo.titulo}
      </h2>
      <p className="text-sm text-tinta-suave">
        {t.nomeNoPlano(capitulo.nomeNoPlano)}
        {inicio === undefined || fim === undefined ? null : (
          <>
            {' · '}
            <a href={linkPagina(inicio)} target="_blank" rel="noopener noreferrer">
              {t.intervalo(inicio, fim)}
              <span className="sr-only"> {textos.acessibilidade.novaAba}</span>
            </a>
          </>
        )}
      </p>
      <p className="text-lg">{capitulo.chamada}</p>
      <ul className="flex flex-col gap-4">
        {capitulo.propostas.map((p) => (
          <li key={`${p.pagina}-${p.titulo}`}>
            <CartaoDoPlano proposta={p} />
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PaginaPlano({ ancora }: { ancora: string | null }) {
  useRolarParaAncora(ancora, idDaAncora)
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <AbasDoPlano atual="plano" />
        <h1 className="font-titulo text-3xl font-extrabold">{t.titulo(NOMES.alvo)}</h1>
        <p className="text-lg">{t.chamada}</p>
        <p>
          <a href={plano.documento.url} target="_blank" rel="noopener noreferrer" className="font-bold">
            {t.pdfCompleto}
            <span className="sr-only"> {textos.acessibilidade.novaAba}</span>
          </a>
        </p>
        <p className="text-sm text-tinta-suave">
          {t.conferido(dia(plano.documento.conferidoEm))} {t.dadosConferidos(dia(plano.dadosConferidosEm))}
        </p>
      </header>
      <nav aria-label={textos.paginas.prosa.indice} className="cartao">
        <ul className="flex flex-col gap-1">
          {plano.capitulos.map((c) => (
            <li key={c.chave}>
              <a href={hrefDe('plano', c.chave)}>{c.titulo}</a>
            </li>
          ))}
        </ul>
      </nav>
      {plano.capitulos.map((c) => (
        <BlocoCapitulo key={c.chave} capitulo={c} />
      ))}
      <Rodape />
    </article>
  )
}
