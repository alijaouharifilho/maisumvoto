// Blocos da Ficha da região: números, grupos com roteiro, como chegar e locais com seções.
import { useId } from 'react'
import type { Derivadas } from '../../../nucleo/metricas.ts'
import type { RegiaoComDist } from '../../../nucleo/ranking.ts'
import type { Indice, Votos } from '../../../nucleo/tipos.ts'
import { fichaPronta } from '../../conteudo/conteudo.ts'
import { textos } from '../../conteudo/textos.ts'
import { NOMES } from '../../config.ts'
import { useRoteiros } from '../../paginas/valores.ts'
import { formatarCep } from '../../util/formatar.ts'
import { fraseDecomposicao, parcelasDe } from '../../util/textosDados.ts'
import { AlvoAqui } from '../AlvoAqui.tsx'
import { Disputa } from '../Disputa.tsx'
import { CorpoDoRoteiro } from '../Roteiro.tsx'
import { Secoes } from './Secoes.tsx'

const t = textos.ficha

type PropsNumeros = { votos: Votos; metricas: Derivadas; indice: Indice | null; aberta: boolean }

export function NumerosDaFicha({ votos, metricas, indice, aberta }: PropsNumeros) {
  const decomposicao = fraseDecomposicao(votos, indice)
  return (
    <div className="flex flex-col gap-3">
      <p className="font-titulo text-xl font-bold">{aberta ? t.principal(metricas.ate) : t.principalNeutra(metricas.ate, NOMES)}</p>
      {decomposicao === null ? null : <p>{decomposicao}</p>}
      <AlvoAqui metricas={metricas} variante="nesteLocal" />
      <Disputa metricas={metricas} />
    </div>
  )
}

/** Um <details> por grupo da decomposição que tem roteiro publicado (grupos "fase2" não aparecem). */
export function ConversaDaFicha({ votos }: { votos: Votos }) {
  const roteiros = useRoteiros()
  const id = useId()
  const grupos = parcelasDe(votos).flatMap((p) => {
    const ficha = p.grupo === undefined ? undefined : roteiros.fichas[p.grupo]
    return p.grupo !== undefined && fichaPronta(ficha) ? [{ grupo: p.grupo, valor: p.valor, ficha }] : []
  })
  if (grupos.length === 0) return null
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h3 id={id} className="font-titulo text-lg font-bold">
        {t.secaoConversa}
      </h3>
      {grupos.map((g) => (
        <details key={g.grupo} className="rounded-xl border border-linha bg-branco">
          <summary className="flex min-h-11 items-center px-3 py-2 font-bold">{t.grupo(g.ficha.titulo, g.valor)}</summary>
          <div className="px-3 pb-3">
            <CorpoDoRoteiro ficha={g.ficha} nivel={4} />
          </div>
        </details>
      ))}
    </section>
  )
}

export function ComoChegar({ regiao }: { regiao: RegiaoComDist }) {
  const destino = encodeURIComponent(`${regiao.lat},${regiao.lon}`)
  const novaAba = textos.acessibilidade.novaAba
  return (
    <section className="flex flex-col gap-2">
      <h3 className="font-titulo text-lg font-bold">{t.comoChegar}</h3>
      <div className="flex flex-wrap gap-2">
        <a className="botao botao-secundario no-underline" href={`https://www.google.com/maps/dir/?api=1&destination=${destino}`} target="_blank" rel="noopener noreferrer">
          {t.googleMaps}
          <span className="sr-only"> {novaAba}</span>
        </a>
        <a className="botao botao-secundario no-underline" href={`https://waze.com/ul?ll=${destino}&navigate=yes`} target="_blank" rel="noopener noreferrer">
          {t.waze}
          <span className="sr-only"> {novaAba}</span>
        </a>
      </div>
      <p className="text-sm text-tinta-suave">{t.avisoExterno}</p>
      {regiao.posicao === 'reserva' ? <p className="rounded-xl bg-marca-clara p-3 text-sm">{t.posicaoReserva}</p> : null}
    </section>
  )
}

export function LocaisDaFicha({ regiao, indice }: { regiao: RegiaoComDist; indice: Indice | null }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="font-titulo text-lg font-bold">{t.secaoLocais}</h3>
      <ul className="flex flex-col gap-4">
        {regiao.locais.map((l) => (
          <li key={`${l.zona}-${l.nr}`} className="flex flex-col gap-1">
            <p className="font-bold">{l.nome}</p>
            <p className="text-sm text-tinta-suave">{[l.endereco, l.cep === '' ? '' : formatarCep(l.cep)].filter((x) => x !== '').join(' · ')}</p>
            <Secoes uf={regiao.uf} mun={regiao.mun} local={l} indice={indice} />
          </li>
        ))}
      </ul>
    </section>
  )
}
