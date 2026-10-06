// Abertura da tela do mapa: selo do 2º turno, título, chamada e os dois números do país (rotulados como teto).
// Abaixo de 960 px fica compacta (letra menor, números lado a lado) para a busca caber na primeira tela do celular;
// a partir de 960 px (lg) volta ao tamanho cheio do painel do desktop.
import { formatarNumero } from '../../nucleo/frases.ts'
import type { Indice } from '../../nucleo/tipos.ts'
import { textos } from '../conteudo/textos.ts'
import { CFG, DIA_2T, FIM_CONVERSA, NOME_SITE, NOMES } from '../config.ts'
import { useFaseAtual } from '../fase.ts'
import { Icone } from './Icone.tsx'

const t = textos.abertura

export function Abertura({ indice }: { indice: Indice | null }) {
  const { aberta } = useFaseAtual()
  return (
    <section className="flex flex-col gap-2 lg:gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1 lg:gap-2">
          <p className="self-start rounded-full bg-petroleo px-2.5 py-0.5 text-xs font-bold text-branco lg:px-3 lg:py-1 lg:text-sm">
            {t.selo(DIA_2T)}
          </p>
          <h1 className="animate-entrada font-titulo text-2xl font-extrabold lg:text-4xl">{t.titulo(NOME_SITE)}</h1>
        </div>
        <Icone tamanho={64} className="hidden shrink-0 lg:block" />
      </div>
      <p className="leading-snug lg:text-lg lg:leading-normal">{aberta ? t.chamada(NOMES.alvo, FIM_CONVERSA) : t.chamadaConsulta(FIM_CONVERSA)}</p>
      {indice === null ? null : <NumerosDoPais indice={indice} />}
    </section>
  )
}

function NumerosDoPais({ indice }: { indice: Indice }) {
  const viraveis = indice.brasil.viraveis[CFG.regraViravel]
  return (
    <div className="flex flex-col gap-1.5 lg:gap-2">
      <dl className="grid grid-cols-2 gap-2">
        <div className="cartao flex flex-col-reverse gap-0.5 p-3 lg:gap-1 lg:p-4">
          <dt className="text-xs leading-snug lg:text-sm lg:leading-normal">{t.brasilAte}</dt>
          <dd className="numeros text-xl font-bold text-mata lg:text-2xl">{formatarNumero(indice.brasil.ate)}</dd>
        </div>
        <div className="cartao flex flex-col-reverse gap-0.5 p-3 lg:gap-1 lg:p-4">
          <dt className="text-xs leading-snug lg:text-sm lg:leading-normal">{t.brasilViraveis}</dt>
          <dd className="numeros text-xl font-bold text-petroleo lg:text-2xl">{formatarNumero(viraveis)}</dd>
        </div>
      </dl>
      <p className="text-xs leading-snug text-tinta-suave lg:text-sm lg:leading-normal">{t.notaViraveis(NOMES, CFG.regraViravel)}</p>
    </div>
  )
}
