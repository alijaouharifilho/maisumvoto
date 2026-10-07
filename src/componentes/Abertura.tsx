// Abertura da tela do mapa: selo do 2º turno, título e chamada. No celular é um bloco azul de ponta a ponta, sobre o
// qual a busca se encaixa; no computador vira o topo do painel da direita, em texto escuro.
// Os dois números do país (rotulados como teto) ficam em NumerosDoPais, logo depois da busca.
import { formatarNumero } from '../../nucleo/frases.ts'
import type { Indice } from '../../nucleo/tipos.ts'
import { textos } from '../conteudo/textos.ts'
import { CFG, DIA_2T, FIM_CONVERSA, NOME_SITE, NOMES } from '../config.ts'
import { useFaseAtual } from '../fase.ts'

const t = textos.abertura

export function Abertura() {
  const { aberta } = useFaseAtual()
  return (
    <section className="sobre-azul -mx-4 flex flex-col gap-2 bg-marca px-4 pt-5 pb-14 lg:mx-0 lg:gap-3 lg:bg-transparent lg:p-0 lg:text-tinta">
      <p className="self-start rounded-full bg-destaque px-3 py-0.5 text-xs font-bold text-tinta lg:text-sm">{t.selo(DIA_2T)}</p>
      <h1 className="animate-entrada font-titulo text-2xl font-extrabold lg:text-3xl lg:text-marca">{t.titulo(NOME_SITE)}</h1>
      <p className="leading-snug lg:leading-normal">{aberta ? t.chamada(NOMES.alvo, FIM_CONVERSA) : t.chamadaConsulta(FIM_CONVERSA)}</p>
    </section>
  )
}

export function NumerosDoPais({ indice }: { indice: Indice }) {
  const viraveis = indice.brasil.viraveis[CFG.regraViravel]
  return (
    <div className="flex flex-col gap-1.5 lg:gap-2">
      <dl className="grid grid-cols-2 gap-2">
        <div className="flex flex-col-reverse gap-0.5 rounded-2xl bg-marca-clara p-3 lg:gap-1 lg:p-4">
          <dt className="text-xs leading-snug lg:text-sm lg:leading-normal">{t.brasilAte}</dt>
          <dd className="numeros text-xl font-extrabold text-marca lg:text-2xl">{formatarNumero(indice.brasil.ate)}</dd>
        </div>
        <div className="flex flex-col-reverse gap-0.5 rounded-2xl bg-destaque-claro p-3 lg:gap-1 lg:p-4">
          <dt className="text-xs leading-snug lg:text-sm lg:leading-normal">{t.brasilViraveis}</dt>
          <dd className="numeros text-xl font-extrabold text-tinta lg:text-2xl">{formatarNumero(viraveis)}</dd>
        </div>
      </dl>
      <p className="text-xs leading-snug text-tinta-suave lg:text-sm lg:leading-normal">{t.notaViraveis(NOMES, CFG.regraViravel)}</p>
    </div>
  )
}
