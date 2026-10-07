// Guia, bloco "O plano de <alvo>": os capítulos do plano de governo em cartões de conversa (em uma frase, um número
// com fonte, por que faz sentido, pergunta para puxar o assunto) e, em cada um, o trecho literal com a página do PDF.
import { linkPagina, plano, type Capitulo } from '../conteudo/conteudo.ts'
import { dia, textos } from '../conteudo/textos.ts'
import { CartaoDoPlano } from '../componentes/CartaoDoPlano.tsx'
import { NOMES } from '../config.ts'
import { hrefDe } from '../rotas.ts'
import { ancoraNoGuia, idNoGuia, ROLAGEM_GUIA } from './guia.ts'

const t = textos.paginas.plano

function BlocoCapitulo({ capitulo }: { capitulo: Capitulo }) {
  const [inicio, fim] = capitulo.paginas
  const id = idNoGuia(ancoraNoGuia('plano', capitulo.chave))
  return (
    <section id={id} tabIndex={-1} aria-labelledby={`${id}-titulo`} className={`flex flex-col gap-3 border-t border-linha pt-6 ${ROLAGEM_GUIA}`}>
      <h3 id={`${id}-titulo`} className="font-titulo text-xl font-extrabold text-marca lg:text-2xl">
        {capitulo.titulo}
      </h3>
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

export function BlocoPlano() {
  const idBloco = idNoGuia(ancoraNoGuia('plano'))
  return (
    <section id={idBloco} tabIndex={-1} aria-labelledby={`${idBloco}-titulo`} className={`flex flex-col gap-6 ${ROLAGEM_GUIA}`}>
      <header className="flex flex-col gap-2 border-l-8 border-destaque pl-4">
        <h2 id={`${idBloco}-titulo`} className="font-titulo text-2xl font-extrabold text-marca lg:text-3xl">
          {t.titulo(NOMES.alvo)}
        </h2>
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
      <nav aria-label={textos.paginas.prosa.indice}>
        <ul className="flex flex-wrap gap-2">
          {plano.capitulos.map((c) => (
            <li key={c.chave}>
              <a
                href={hrefDe('guia', ancoraNoGuia('plano', c.chave))}
                className="inline-flex min-h-11 items-center rounded-full border border-linha bg-branco px-3 text-sm font-bold no-underline hover:bg-marca-clara"
              >
                {c.titulo}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      {plano.capitulos.map((c) => (
        <BlocoCapitulo key={c.chave} capitulo={c} />
      ))}
    </section>
  )
}
