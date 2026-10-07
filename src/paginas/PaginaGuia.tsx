// #/guia: tudo o que ajuda na conversa numa página só. Três blocos (Como conversar, O plano de <alvo>, Os dois planos)
// com um índice fixo no topo. Âncoras: #/guia/plano, #/guia/plano-seguranca etc. (ver guia.ts).
// No dia da votação, o bloco dos roteiros não é montado: nada de orientação de abordagem (o plano e a comparação,
// publicados antes, continuam).
import { textos } from '../conteudo/textos.ts'
import { Rodape } from '../componentes/Moldura.tsx'
import { NOMES } from '../config.ts'
import { useRolarParaAncora } from '../rotas.ts'
import { BlocoComparar } from './BlocoComparar.tsx'
import { BlocoConversa } from './BlocoConversa.tsx'
import { BlocoPlano } from './BlocoPlano.tsx'
import { ancoraNoGuia, idNoGuia, type BlocoDoGuia } from './guia.ts'
import { LinkDoGuia } from './LinkDoGuia.tsx'

const t = textos.paginas.guia

function Indice({ partes }: { partes: readonly { readonly bloco: BlocoDoGuia; readonly rotulo: string }[] }) {
  return (
    <nav
      aria-label={t.indice}
      className="sticky top-[calc(var(--altura-cabecalho)+env(safe-area-inset-top))] z-20 -mx-4 h-(--altura-indice-guia) border-b border-linha bg-fundo px-4 py-1.5"
    >
      {/* No celular os três não cabem lado a lado: rolam na horizontal, sem barra (o terceiro aparece pela metade). */}
      {/* -m-1.5 p-1.5: o recorte da rolagem horizontal não come o anel de foco dos chips. */}
      <ul className="-m-1.5 flex gap-2 overflow-x-auto p-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {partes.map((p) => (
          <li key={p.bloco} className="shrink-0">
            <LinkDoGuia
              ancora={ancoraNoGuia(p.bloco)}
              className="inline-flex min-h-11 items-center rounded-full border-2 border-marca bg-branco px-4 font-titulo text-sm font-bold whitespace-nowrap text-marca no-underline hover:bg-marca-clara"
            >
              {p.rotulo}
            </LinkDoGuia>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function PaginaGuia({ ancora, votacao }: { ancora: string | null; votacao: boolean }) {
  useRolarParaAncora(ancora, idNoGuia)
  const partes = [
    ...(votacao ? [] : [{ bloco: 'conversa' as const, rotulo: t.partes.conversa }]),
    { bloco: 'plano' as const, rotulo: t.partes.plano(NOMES.alvo) },
    { bloco: 'comparar' as const, rotulo: t.partes.comparar },
  ]
  return (
    <article className="pagina-guia mx-auto flex max-w-4xl flex-col gap-10 px-4 pt-6 pb-8">
      <h1 className="-mb-6 font-titulo text-3xl font-extrabold text-marca lg:text-4xl">{t.titulo}</h1>
      <Indice partes={partes} />
      {votacao ? <p className="cartao text-lg">{textos.diaDaVotacao.paragrafos[0]}</p> : <BlocoConversa />}
      <BlocoPlano />
      <BlocoComparar />
      <Rodape />
    </article>
  )
}
