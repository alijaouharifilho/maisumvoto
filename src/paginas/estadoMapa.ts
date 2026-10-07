// Estado da tela do mapa: ponto escolhido (sincronizado com o hash arredondado), regiões do raio e seleção.
// Fica no App, não na página: ir ao Guia e voltar não perde o ponto.
// O ponto escolhido (busca, GPS, toque) já entra arredondado à grade do link: o número e a lista na tela são os
// mesmos que o link e a mensagem do WhatsApp mostram a quem recebe, e o ponto exato nunca é guardado.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { lerAncora, lerHash } from '../../nucleo/link.ts'
import { derivar } from '../../nucleo/metricas.ts'
import type { Indice } from '../../nucleo/tipos.ts'
import { CFG, RAIO_KM } from '../config.ts'
import type { PontoEscolhido } from '../dados/buscar.ts'
import type { Carregador } from '../dados/carregar.ts'
import { montarResultado, regioesPerto, type ResultadoPonto } from '../dados/resultado.ts'
import type { Marcador } from '../mapa/camadas.ts'
import type { FonteDensidade } from '../mapa/densidade.ts'
import { substituirHash, type EstadoRota } from '../rotas.ts'
import { ancoraDoPonto, mesmoPontoNoLink, pontoArredondado, type Ponto } from '../util/link.ts'

export type EstadoRegioes =
  | { readonly tipo: 'ocioso' }
  | { readonly tipo: 'carregando' }
  | { readonly tipo: 'ok'; readonly resultado: ResultadoPonto }
  | { readonly tipo: 'erro' }

export type EstadoMapa = {
  readonly ponto: PontoEscolhido | null
  /** Sobe a cada ponto escolhido, venha de onde vier: quem espera uma resposta antiga sabe que ela perdeu a vez. */
  readonly versao: number
  readonly regioes: EstadoRegioes
  readonly selecionada: string | null
  readonly escolher: (p: PontoEscolhido) => void
  readonly selecionar: (id: string | null) => void
  readonly tentarDeNovo: () => void
}

function pontoDoLink(ancora: string | null): PontoEscolhido | null {
  const lido = ancora === null ? null : lerAncora(ancora)
  return lido === null ? null : { ...lido, origem: 'link', rotulo: null }
}

/** Âncora que não foi escrita pelo site e aponta para outro ponto: veio de fora e ainda vai ser adotada. */
export function linkDeFora(ancora: string | null, escrita: string | null, atual: Ponto | null): boolean {
  if (ancora === null || ancora === escrita) return false
  const doLink = pontoDoLink(ancora)
  return doLink !== null && (atual === null || !mesmoPontoNoLink(atual, doLink))
}

function ehAbortado(erro: unknown): boolean {
  return erro instanceof DOMException && erro.name === 'AbortError'
}

type Concluido = { readonly chave: string; readonly estado: EstadoRegioes }

/** O "carregando" é derivado: resposta guardada com outra chave (outro ponto ou rodada) ainda não vale. */
function useRegioes(carregador: Carregador, indice: Indice | null, ponto: Ponto | null, rodada: number): EstadoRegioes {
  const [concluido, setConcluido] = useState<Concluido | null>(null)
  const chave = ponto !== null && indice !== null ? `${indice.versao}|${ponto.lat}|${ponto.lon}|${rodada}` : null
  const lat = ponto?.lat ?? 0
  const lon = ponto?.lon ?? 0
  useEffect(() => {
    if (chave === null) return
    const controle = new AbortController()
    regioesPerto(carregador, { lat, lon }, RAIO_KM, controle.signal).then(
      (r) => setConcluido({ chave, estado: { tipo: 'ok', resultado: montarResultado(r, CFG) } }),
      (erro: unknown) => {
        if (controle.signal.aborted || ehAbortado(erro)) return
        console.error('Regiões do ponto indisponíveis', erro)
        setConcluido({ chave, estado: { tipo: 'erro' } })
      },
    )
    return () => controle.abort()
  }, [carregador, chave, lat, lon])
  if (chave === null) return { tipo: 'ocioso' }
  return concluido !== null && concluido.chave === chave ? concluido.estado : { tipo: 'carregando' }
}

/** Link colado, voltar/avançar: hashchange traz outro ponto. (replaceState, que o próprio site usa, não dispara.) */
function useHashDeFora(aoMudar: (p: PontoEscolhido) => void): void {
  useEffect(() => {
    const ouvir = (): void => {
      const { rota, ancora } = lerHash(window.location.hash)
      const p = rota === 'mapa' ? pontoDoLink(ancora) : null
      if (p !== null) aoMudar(p)
    }
    window.addEventListener('hashchange', ouvir)
    return () => window.removeEventListener('hashchange', ouvir)
  }, [aoMudar])
}

export function useEstadoMapa(carregador: Carregador, indice: Indice | null, rota: EstadoRota): EstadoMapa {
  const [ponto, setPonto] = useState<PontoEscolhido | null>(() => (rota.rota === 'mapa' ? pontoDoLink(rota.ancora) : null))
  const [selecionada, setSelecionada] = useState<string | null>(null)
  const [rodada, setRodada] = useState(0)
  const [versao, setVersao] = useState(0)
  const atual = useRef(ponto)
  useEffect(() => {
    atual.current = ponto
  }, [ponto])

  const escolher = useCallback((p: PontoEscolhido) => {
    const { lat, lon } = pontoArredondado(p)
    setPonto({ ...p, lat, lon })
    setSelecionada(null)
    setVersao((v) => v + 1)
  }, [])
  const aoMudarHash = useCallback(
    (p: PontoEscolhido) => {
      if (atual.current === null || !mesmoPontoNoLink(atual.current, p)) escolher(p)
    },
    [escolher],
  )
  useHashDeFora(aoMudarHash)

  // O hash sempre mostra o ponto atual, arredondado (nunca o ponto exato de quem escolheu) — menos quando
  // acabou de chegar um link de outro ponto (colado na barra, voltar/avançar): esse o ouvinte de hashchange adota.
  // Sem essa exceção, vindo de #/sobre para #/mapa/@B, o React renderiza a rota nova antes do ouvinte rodar
  // e este efeito regravava o ponto antigo por cima do link (o ouvinte então lia o hash antigo e não trocava nada).
  const ancoraAtual = ponto === null ? null : ancoraDoPonto(ponto)
  const escrita = useRef<string | null>(null)
  useEffect(() => {
    if (rota.rota !== 'mapa' || ancoraAtual === null) return
    if (linkDeFora(rota.ancora, escrita.current, atual.current)) return
    substituirHash('mapa', ancoraAtual)
    escrita.current = ancoraAtual
  }, [rota.rota, rota.ancora, ancoraAtual])

  const regioes = useRegioes(carregador, indice, ponto, rodada)
  const tentarDeNovo = useCallback(() => setRodada((r) => r + 1), [])
  return { ponto, versao, regioes, selecionada, escolher, selecionar: setSelecionada, tentarDeNovo }
}

export function marcadoresDe(resultado: ResultadoPonto | null): Marcador[] {
  if (resultado === null) return []
  return resultado.regioes.map((r) => {
    const m = r.votos === null ? null : derivar(r.votos, CFG)
    return { id: r.id, lat: r.lat, lon: r.lon, ate: m?.ate ?? 0, classe: m === null ? 'semResultado' : m.classificacao }
  })
}

export function useMarcadores(regioes: EstadoRegioes): Marcador[] {
  const resultado = regioes.tipo === 'ok' ? regioes.resultado : null
  return useMemo(() => marcadoresDe(resultado), [resultado])
}

export function useFonteDensidade(carregador: Carregador, indice: Indice | null): FonteDensidade | null {
  return useMemo(() => {
    if (indice === null) return null
    const existem = new Set(indice.quadrados)
    return {
      resumo: () => carregador.pontosResumo(),
      quadrado: (chave: string) => carregador.pontosQuadrado(chave),
      existe: (chave: string) => existem.has(chave),
    }
  }, [carregador, indice])
}
