// Guia, bloco "Como conversar": roteiro geral e fichas de conversa por tipo de voto (abstenção, branco, nulo).
// Fichas ainda em preparação (fase 2) não aparecem; nas fases fechadas a chamada vira "material de consulta".
// No dia da votação este bloco não é montado (PaginaGuia): nada de orientação de abordagem.
import { fichaPronta, type FichaVoto } from '../conteudo/conteudo.ts'
import { textos } from '../conteudo/textos.ts'
import { CorpoDoRoteiro, RoteiroGeralDaConversa } from '../componentes/Roteiro.tsx'
import { FIM_CONVERSA } from '../config.ts'
import { useFaseAtual } from '../fase.ts'
import { ancoraNoGuia, idNoGuia, ROLAGEM_GUIA } from './guia.ts'
import { useRoteiros } from './valores.ts'

const t = textos.paginas.prosa
const CHAVE_GERAL = 'geral'

export function BlocoConversa() {
  const roteiros = useRoteiros()
  const { aberta } = useFaseAtual()
  const fichas = Object.entries(roteiros.fichas).flatMap(([chave, f]) => (fichaPronta(f) ? [{ chave, ficha: f as FichaVoto }] : []))
  const temPendentes = Object.values(roteiros.fichas).some((f) => !fichaPronta(f))
  const idBloco = idNoGuia(ancoraNoGuia('conversa'))
  return (
    <section id={idBloco} tabIndex={-1} aria-labelledby={`${idBloco}-titulo`} className={`flex flex-col gap-5 ${ROLAGEM_GUIA}`}>
      <header className="flex flex-col gap-2 border-l-8 border-destaque pl-4">
        <h2 id={`${idBloco}-titulo`} className="font-titulo text-2xl font-extrabold text-marca lg:text-3xl">
          {t.titulo}
        </h2>
        <p className="text-lg">{aberta ? t.chamada : t.chamadaConsulta(FIM_CONVERSA)}</p>
      </header>
      <section
        id={idNoGuia(ancoraNoGuia('conversa', CHAVE_GERAL))}
        tabIndex={-1}
        aria-labelledby="guia-conversa-geral-titulo"
        className={`cartao flex flex-col gap-3 ${ROLAGEM_GUIA}`}
      >
        <h3 id="guia-conversa-geral-titulo" className="font-titulo text-xl font-bold">
          {roteiros.geral.titulo}
        </h3>
        <RoteiroGeralDaConversa geral={roteiros.geral} nivel={3} />
      </section>
      {fichas.map(({ chave, ficha }) => {
        const id = idNoGuia(ancoraNoGuia('conversa', chave))
        return (
          <section key={chave} id={id} tabIndex={-1} aria-labelledby={`${id}-titulo`} className={`cartao flex flex-col gap-3 ${ROLAGEM_GUIA}`}>
            <h3 id={`${id}-titulo`} className="font-titulo text-xl font-bold">
              {ficha.titulo}
            </h3>
            <CorpoDoRoteiro ficha={ficha} nivel={4} />
          </section>
        )
      })}
      {temPendentes ? <p className="text-tinta-suave">{t.emPreparo}</p> : null}
    </section>
  )
}
