// Lista dos locais no raio: alternativa em texto ao mapa. "Mais gente" (ordem do "até") ou "Por bairro".
import { useId, useMemo, useState } from 'react'
import { formatarDistancia, nomeLocal } from '../../nucleo/frases.ts'
import { agruparPorBairro, type GrupoBairro, type ItemLista } from '../../nucleo/ranking.ts'
import { textos } from '../conteudo/textos.ts'
import { NOMES, RAIO_TEXTO } from '../config.ts'
import { CLASSE_DO_GRUPO, GRUPO_DA_CLASSE, ORDEM_LEGENDA, type GrupoLegenda } from '../mapa/simbologia.ts'
import { Selo } from './Selo.tsx'

const t = textos.lista

type Props = {
  lista: readonly ItemLista[]
  semResultado: number
  onAbrir: (id: string) => void
}

type Modo = 'perto' | 'bairro'

export function Lista({ lista, semResultado, onAbrir }: Props) {
  const [modo, setModo] = useState<Modo>('perto')
  const id = useId()
  const { bairros, semBairro } = useMemo(() => agruparPorBairro(lista), [lista])
  return (
    <section aria-labelledby={`${id}-titulo`} className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={`${id}-titulo`} className="font-titulo text-xl font-bold">
          {t.titulo}
        </h2>
        <span className="text-sm text-tinta-suave">{t.raio(RAIO_TEXTO)}</span>
      </div>
      <fieldset className="flex gap-2">
        <legend className="sr-only">{t.ordenar}</legend>
        {(['perto', 'bairro'] as const).map((m) => (
          <button key={m} type="button" aria-pressed={modo === m} onClick={() => setModo(m)} className={`botao ${modo === m ? 'botao-primario' : 'botao-secundario'} min-h-11 py-1`}>
            {m === 'perto' ? t.perto : t.porBairro}
          </button>
        ))}
      </fieldset>
      <Legenda lista={lista} semResultado={semResultado} />
      {modo === 'perto' ? (
        <Itens itens={lista} onAbrir={onAbrir} rotulo={textos.acessibilidade.lista} />
      ) : (
        <PorBairro bairros={bairros} semBairro={semBairro} onAbrir={onAbrir} />
      )}
      <div className="flex flex-col gap-1 text-sm text-tinta-suave">
        {semResultado > 0 ? <p>{t.notaSemResultado(semResultado)}</p> : null}
        <p>{t.notaOrdem}</p>
      </div>
    </section>
  )
}

function Legenda({ lista, semResultado }: { lista: readonly ItemLista[]; semResultado: number }) {
  const presentes = new Set<GrupoLegenda>(lista.map((i) => GRUPO_DA_CLASSE[i.metricas.classificacao]))
  const grupos = ORDEM_LEGENDA.filter((g) => presentes.has(g))
  return (
    <div className="flex flex-col gap-1 text-sm">
      <p className="font-bold">{t.legendaComResultado}</p>
      <ul className="flex flex-wrap gap-x-4 gap-y-1">
        {grupos.map((g) => (
          <li key={g} className="flex items-center gap-1.5">
            <Selo classe={CLASSE_DO_GRUPO[g]} tamanho={16} />
            {textos.legendaMapa[g](NOMES)}
          </li>
        ))}
        {semResultado > 0 ? (
          <li className="flex items-center gap-1.5">
            <Selo classe="semResultado" tamanho={16} />
            {t.legendaSemResultado}
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function Itens({ itens, onAbrir, rotulo }: { itens: readonly ItemLista[]; onAbrir: (id: string) => void; rotulo: string }) {
  return (
    <ul aria-label={rotulo} className="flex flex-col divide-y divide-linha">
      {itens.map((item) => (
        <li key={item.id}>
          <ItemDaLista item={item} onAbrir={onAbrir} />
        </li>
      ))}
    </ul>
  )
}

function ItemDaLista({ item, onAbrir }: { item: ItemLista; onAbrir: (id: string) => void }) {
  const detalhe = t.itemDetalhe({
    bairro: item.bairro,
    distancia: formatarDistancia(item.dist),
    eleitores: item.eleitores,
    alvo: NOMES.alvo,
    fracaoAlvo: item.metricas.pctAlvo,
  })
  return (
    <button
      type="button"
      data-regiao={item.id}
      onClick={() => onAbrir(item.id)}
      className="flex w-full items-center gap-3 rounded-lg px-2 py-3 text-left hover:bg-superficie-2"
    >
      <Selo classe={item.metricas.classificacao} />
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-bold text-marca underline">{nomeLocal(item)}</span>
        <span className="text-sm text-tinta-suave">{detalhe}</span>
        <span className="sr-only">{textos.classificacaoAria[item.metricas.classificacao](NOMES)}</span>
      </span>
      <span className="numeros shrink-0 text-right text-lg font-bold" aria-hidden="true">
        {t.itemAte(item.metricas.ate)}
      </span>
      <span className="sr-only">{t.itemAteAria(item.metricas.ate)}</span>
    </button>
  )
}

function PorBairro({ bairros, semBairro, onAbrir }: { bairros: readonly GrupoBairro[]; semBairro: number; onAbrir: (id: string) => void }) {
  return (
    <div className="flex flex-col gap-2">
      {bairros.map((g) => (
        <details key={g.chave} className="rounded-xl border border-linha bg-branco">
          <summary className="flex min-h-11 flex-col justify-center px-3 py-2">
            <span className="font-bold">{g.bairro}</span>
            <span className="text-sm text-tinta-suave">
              {t.bairroResumo({ ate: g.ate, locais: g.regioes, eleitores: g.eleitores, distancia: formatarDistancia(g.dist) })}
            </span>
          </summary>
          <div className="px-2 pb-2">
            <Itens itens={g.itens} onAbrir={onAbrir} rotulo={g.bairro} />
          </div>
        </details>
      ))}
      {semBairro > 0 ? <p className="text-sm text-tinta-suave">{t.notaSemBairro(semBairro)}</p> : null}
    </div>
  )
}
