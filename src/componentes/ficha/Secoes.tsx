// Seções de um local: um botão por seção; o resultado da seção só é baixado quando aberto
// (arquivo secoes/{uf}/{mun}-{zona}.json, compartilhado por todas as seções da zona).
import { useEffect, useId, useState } from 'react'
import type { ArquivoSecoes, Indice, Local } from '../../../nucleo/tipos.ts'
import { textos } from '../../conteudo/textos.ts'
import { useDados } from '../../dados/contexto.ts'
import { nomeDoCandidato } from '../../util/formatar.ts'

type VotosSecao = ArquivoSecoes['secoes'][string]

type Estado = { readonly tipo: 'carregando' } | { readonly tipo: 'ok'; readonly votos: VotosSecao | null } | { readonly tipo: 'erro' }

type Props = { uf: string; mun: string; local: Local; indice: Indice | null }

export function Secoes({ uf, mun, local, indice }: Props) {
  const [aberta, setAberta] = useState<number | null>(null)
  const id = useId()
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">{textos.ficha.zona(local.zona, local.secoes)}</p>
      <ul className="flex flex-wrap gap-1">
        {local.secoes.map((s) => (
          <li key={s}>
            <button
              type="button"
              aria-expanded={aberta === s}
              aria-controls={aberta === s ? id : undefined}
              aria-label={textos.ficha.zona(local.zona, [s])}
              onClick={() => setAberta((a) => (a === s ? null : s))}
              className="numeros min-h-11 min-w-11 rounded-lg border-2 border-tinta-suave px-2 text-sm aria-expanded:border-marca aria-expanded:bg-marca aria-expanded:text-branco"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
      {aberta === null ? null : <ResultadoSecao id={id} uf={uf} mun={mun} zona={local.zona} secao={aberta} indice={indice} />}
    </div>
  )
}

function useSecao(uf: string, mun: string, zona: number, secao: number): Estado {
  const { carregador } = useDados()
  const chave = `${uf}|${mun}|${zona}|${secao}`
  const [concluido, setConcluido] = useState<{ chave: string; estado: Estado } | null>(null)
  useEffect(() => {
    const controle = new AbortController()
    carregador.secoes(uf, mun, zona, controle.signal).then(
      (arq) => setConcluido({ chave, estado: { tipo: 'ok', votos: arq.secoes[String(secao)] ?? null } }),
      (erro: unknown) => {
        if (controle.signal.aborted) return
        console.error('Seção indisponível', erro)
        setConcluido({ chave, estado: { tipo: 'erro' } })
      },
    )
    return () => controle.abort()
  }, [carregador, chave, uf, mun, zona, secao])
  return concluido !== null && concluido.chave === chave ? concluido.estado : { tipo: 'carregando' }
}

type PropsResultado = { id: string; uf: string; mun: string; zona: number; secao: number; indice: Indice | null }

function ResultadoSecao({ id, uf, mun, zona, secao, indice }: PropsResultado) {
  const estado = useSecao(uf, mun, zona, secao)
  return (
    <div id={id} aria-live="polite" className="rounded-xl bg-superficie-2 p-3 text-sm">
      {estado.tipo === 'carregando' ? <p>{textos.acessibilidade.carregando}…</p> : null}
      {estado.tipo === 'erro' ? <p className="text-alerta">{textos.erroDados.titulo}</p> : null}
      {estado.tipo === 'ok' && estado.votos === null ? <p>{textos.ficha.semResultado}</p> : null}
      {estado.tipo === 'ok' && estado.votos !== null ? <VotosDaSecao votos={estado.votos} indice={indice} /> : null}
    </div>
  )
}

function VotosDaSecao({ votos, indice }: { votos: VotosSecao; indice: Indice | null }) {
  const p = textos.resultado.parcela
  const nominais = Object.entries(votos.nominais).sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
  return (
    <div className="flex flex-col gap-1">
      <p className="font-bold">{textos.ficha.eleitorado(votos.aptos)}</p>
      <ul className="flex flex-col gap-0.5">
        <li>{p.abstencao(Math.max(0, votos.aptos - votos.comparecimento))}</li>
        {nominais.map(([numero, n]) => (
          <li key={numero}>{p.candidato(n, nomeDoCandidato(indice, numero))}</li>
        ))}
        <li>{p.brancos(votos.brancos)}</li>
        <li>{p.nulos(votos.nulos)}</li>
      </ul>
    </div>
  )
}
