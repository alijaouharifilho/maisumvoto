// Encaixe visual do mapa e sincronização do estado React com o motor (imperativo).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { textos } from '../conteudo/textos.ts'
import type { Marcador } from './camadas.ts'
import type { FonteDensidade } from './densidade.ts'
import { motorCarregado, noDoMapa, obterMotor } from './hospedeiro.ts'
import type { Motor } from './motor.ts'

/** Espera máxima pela folga do navegador antes de carregar o MapLibre (não disputa a primeira pintura). */
const ESPERA_OCIOSA_MS = 1500

type PropsEncaixe = {
  className?: string
  dica?: boolean
  /** O mapa não carregou: mensagem e botão de tentar de novo no lugar da caixa vazia. */
  falhou?: boolean
  onTentarDeNovo?: () => void
  children?: ReactNode
}

function AvisoSemMapa({ onTentarDeNovo }: { onTentarDeNovo: (() => void) | undefined }) {
  return (
    <div className="flex flex-col items-start gap-2 p-4">
      <p>{textos.mapa.falhou}</p>
      {onTentarDeNovo === undefined ? null : (
        <button type="button" className="botao botao-secundario" onClick={onTentarDeNovo}>
          {textos.mapa.tentarDeNovo}
        </button>
      )}
    </div>
  )
}

/** Lugar onde o nó único do mapa é pendurado. Só um encaixe fica montado por vez. */
export function EncaixeMapa({ className = '', dica = false, falhou = false, onTentarDeNovo, children }: PropsEncaixe) {
  const alvo = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const el = alvo.current
    if (el === null) return
    const no = noDoMapa()
    el.appendChild(no)
    motorCarregado()?.redimensionar()
    return () => {
      if (no.parentElement === el) el.removeChild(no)
    }
  }, [])
  return (
    <section aria-label={textos.mapa.rotulo} className={`relative overflow-hidden bg-superficie-2 ${falhou ? '' : className}`}>
      <div ref={alvo} className={falhou ? 'hidden' : 'absolute inset-0'} />
      {falhou ? <AvisoSemMapa onTentarDeNovo={onTentarDeNovo} /> : null}
      {dica && !falhou ? (
        <p className="pointer-events-none absolute top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-linha bg-branco px-4 py-2 text-sm font-bold shadow-md">
          {textos.mapa.dica}
        </p>
      ) : null}
      {children}
    </section>
  )
}

type PropsSincronia = {
  ponto: { lat: number; lon: number } | null
  marcadores: readonly Marcador[]
  selecionada: string | null
  densidade: FonteDensidade | null
  /** Celular: dois dedos movem o mapa, um dedo rola a página. */
  cooperativo: boolean
  /** Muda para pedir o mapa de novo depois de uma falha. */
  tentativa: number
  onEscolherPonto: (lat: number, lon: number) => void
  onAbrirRegiao: (id: string) => void
  onFalha: () => void
}

type Agendar = (fazer: () => void) => () => void

/** Roda quando o navegador estiver folgado (ou depois da espera máxima); sem requestIdleCallback, no próximo ciclo. */
const quandoFolgado: Agendar = (fazer) => {
  if (typeof window.requestIdleCallback === 'function') {
    const id = window.requestIdleCallback(fazer, { timeout: ESPERA_OCIOSA_MS })
    return () => window.cancelIdleCallback(id)
  }
  const id = window.setTimeout(fazer, 0)
  return () => window.clearTimeout(id)
}

function useMotor(ponto: { lat: number; lon: number } | null, tentativa: number, onFalha: () => void): Motor | null {
  const [motor, setMotor] = useState<Motor | null>(motorCarregado)
  // Só o ponto do primeiro carregamento importa (o mapa nasce nele); mudar de ponto depois não recarrega nada.
  const pontoInicial = useRef(ponto)
  useEffect(() => {
    if (motor !== null) return
    let vivo = true
    const cancelar = quandoFolgado(() => {
      obterMotor(pontoInicial.current).then(
        (m) => vivo && setMotor(m),
        (erro: unknown) => {
          console.warn('Mapa indisponível', erro)
          if (vivo) onFalha()
        },
      )
    })
    return () => {
      vivo = false
      cancelar()
    }
  }, [motor, onFalha, tentativa])
  return motor
}

/** Não desenha nada: leva ponto, marcadores, seleção e densidade para o motor. */
export function MapaSincronizado(p: PropsSincronia) {
  const motor = useMotor(p.ponto, p.tentativa, p.onFalha)
  const escolher = useRef(p.onEscolherPonto)
  const abrir = useRef(p.onAbrirRegiao)
  useLayoutEffect(() => {
    escolher.current = p.onEscolherPonto
    abrir.current = p.onAbrirRegiao
  })
  useEffect(() => {
    motor?.aoEscolherPonto((lat, lon) => escolher.current(lat, lon))
    motor?.aoAbrirRegiao((id) => abrir.current(id))
  }, [motor])
  useEffect(() => motor?.usarGestosCooperativos(p.cooperativo), [motor, p.cooperativo])
  const { lat, lon } = p.ponto ?? { lat: null, lon: null }
  useEffect(() => {
    motor?.definirPonto(lat === null || lon === null ? null : { lat, lon })
  }, [motor, lat, lon])
  useEffect(() => motor?.definirMarcadores(p.marcadores), [motor, p.marcadores])
  useEffect(() => motor?.selecionar(p.selecionada), [motor, p.selecionada])
  useEffect(() => {
    if (p.densidade !== null) motor?.usarDensidade(p.densidade)
  }, [motor, p.densidade])
  return null
}
