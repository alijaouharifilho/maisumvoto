// #/prosa: roteiro geral e fichas de conversa por tipo de voto (abstenção, branco, nulo).
// Fichas ainda em preparação (fase 2) não aparecem; nas fases fechadas a chamada vira "material de consulta".
import { fichaPronta, type FichaVoto } from '../conteudo/conteudo.ts'
import { textos } from '../conteudo/textos.ts'
import { CorpoDoRoteiro, RoteiroGeralDaConversa } from '../componentes/Roteiro.tsx'
import { Rodape } from '../componentes/Moldura.tsx'
import { FIM_CONVERSA } from '../config.ts'
import { useFaseAtual } from '../fase.ts'
import { hrefDe, useRolarParaAncora } from '../rotas.ts'
import { useRoteiros } from './valores.ts'

const t = textos.paginas.prosa
const CHAVE_GERAL = 'geral'
const idDaAncora = (ancora: string): string => `conversa-${ancora}`

export function PaginaProsa({ ancora }: { ancora: string | null }) {
  const roteiros = useRoteiros()
  const { aberta } = useFaseAtual()
  const fichas = Object.entries(roteiros.fichas).flatMap(([chave, f]) => (fichaPronta(f) ? [{ chave, ficha: f as FichaVoto }] : []))
  const temPendentes = Object.values(roteiros.fichas).some((f) => !fichaPronta(f))
  useRolarParaAncora(ancora, idDaAncora)
  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-titulo text-3xl font-extrabold">{t.titulo}</h1>
        <p className="text-lg">{aberta ? t.chamada : t.chamadaConsulta(FIM_CONVERSA)}</p>
      </header>
      <nav aria-labelledby="prosa-indice" className="cartao">
        <h2 id="prosa-indice" className="font-titulo text-lg font-bold">
          {t.indice}
        </h2>
        <ul className="mt-2 flex flex-col gap-1">
          <li>
            <a href={hrefDe('prosa', CHAVE_GERAL)}>{roteiros.geral.titulo}</a>
          </li>
          {fichas.map(({ chave, ficha }) => (
            <li key={chave}>
              <a href={hrefDe('prosa', chave)}>{ficha.titulo}</a>
            </li>
          ))}
        </ul>
      </nav>
      <section id={idDaAncora(CHAVE_GERAL)} tabIndex={-1} aria-labelledby="prosa-geral" className="flex scroll-mt-20 flex-col gap-3">
        <h2 id="prosa-geral" className="font-titulo text-2xl font-bold">
          {roteiros.geral.titulo}
        </h2>
        <RoteiroGeralDaConversa geral={roteiros.geral} nivel={2} />
      </section>
      {fichas.map(({ chave, ficha }) => (
        <section key={chave} id={idDaAncora(chave)} tabIndex={-1} aria-labelledby={`prosa-${chave}`} className="flex scroll-mt-20 flex-col gap-3 border-t border-linha pt-6">
          <h2 id={`prosa-${chave}`} className="font-titulo text-2xl font-bold">
            {ficha.titulo}
          </h2>
          <CorpoDoRoteiro ficha={ficha} nivel={3} />
        </section>
      ))}
      {temPendentes ? <p className="text-tinta-suave">{t.emPreparo}</p> : null}
      <Rodape />
    </article>
  )
}
