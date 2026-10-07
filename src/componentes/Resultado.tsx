// Resultado do raio: manchete com o "até" (animada só nas fases abertas), decomposição, alcance,
// fatia do candidato apoiado e frase da disputa. O anúncio para leitor de tela fica numa região viva sempre montada
// (PaginaMapa): região viva que nasce já com o texto não é anunciada. A manchete recebe o foco depois da busca.
import type { Ref } from 'react'
import { fracaoHumana } from '../../nucleo/frases.ts'
import type { Derivadas } from '../../nucleo/metricas.ts'
import type { Indice, Votos } from '../../nucleo/tipos.ts'
import { textos } from '../conteudo/textos.ts'
import { NOMES, RAIO_TEXTO } from '../config.ts'
import type { PontoEscolhido } from '../dados/buscar.ts'
import { fraseDecomposicao, rotuloOrigem } from '../util/textosDados.ts'
import { AlvoAqui } from './AlvoAqui.tsx'
import { ContaNumero } from './ContaNumero.tsx'
import { Disputa } from './Disputa.tsx'

const t = textos.resultado

type Props = {
  ponto: PontoEscolhido
  votos: Votos
  metricas: Derivadas
  indice: Indice | null
  aberta: boolean
  ref?: Ref<HTMLElement>
}

function Manchete({ ate, aberta }: { ate: number; aberta: boolean }) {
  if (!aberta) return <h2 tabIndex={-1} className="font-titulo text-2xl font-bold">{t.mancheteNeutra(ate, NOMES, RAIO_TEXTO)}</h2>
  const m = t.manchete(ate)
  return (
    <>
      <h2 tabIndex={-1} className="font-titulo text-2xl leading-tight font-bold">
        {m.antes} <ContaNumero valor={ate} className="numeros block text-5xl font-extrabold text-marca" /> {m.depois}
      </h2>
      <p className="text-sm text-tinta-suave">{t.notaTeto}</p>
    </>
  )
}

export function Resultado({ ponto, votos, metricas, indice, aberta, ref }: Props) {
  const decomposicao = fraseDecomposicao(votos, indice)
  return (
    <section ref={ref} className="flex flex-col gap-3">
      <p className="text-sm font-bold tracking-wide text-marca uppercase">{rotuloOrigem(ponto)}</p>
      <Manchete ate={metricas.ate} aberta={aberta} />
      {decomposicao === null ? null : <p>{decomposicao}</p>}
      {votos.aptos > 0 ? <p>{t.alcance(votos.aptos, fracaoHumana(metricas.ate / votos.aptos))}</p> : null}
      <AlvoAqui metricas={metricas} variante="porAqui" />
      <Disputa metricas={metricas} />
    </section>
  )
}
