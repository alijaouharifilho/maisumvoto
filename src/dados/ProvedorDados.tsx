// Carrega o índice uma vez. Se falhar: estado de erro, novas tentativas automáticas com espera crescente
// e botão "tentar de novo". Nunca cai em número de exemplo.
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Carregador } from './carregar.ts'
import { ContextoDados, type EstadoIndice, type ValorDados } from './contexto.ts'

/** Esperas entre tentativas automáticas; depois disso só o botão tenta de novo. */
const ESPERAS_MS: readonly number[] = [2_000, 5_000, 10_000, 20_000, 30_000]

type Props = { carregador: Carregador; children: ReactNode }

export function ProvedorDados({ carregador, children }: Props) {
  const [estado, setEstado] = useState<EstadoIndice>({ tipo: 'carregando' })
  const [rodada, setRodada] = useState(0)

  useEffect(() => {
    const controle = new AbortController()
    carregador.indice(controle.signal).then(
      (indice) => setEstado({ tipo: 'ok', indice }),
      (erro: unknown) => {
        if (controle.signal.aborted) return
        console.error('Índice dos dados indisponível', erro)
        setEstado((velho) => ({ tipo: 'erro', falhas: velho.tipo === 'erro' ? velho.falhas + 1 : 1, tentando: false }))
      },
    )
    return () => controle.abort()
  }, [carregador, rodada])

  const tentarDeNovo = useCallback(() => {
    setEstado((velho) => (velho.tipo === 'erro' ? { ...velho, tentando: true } : velho))
    setRodada((r) => r + 1)
  }, [])

  const espera = estado.tipo === 'erro' && !estado.tentando ? ESPERAS_MS[estado.falhas - 1] : undefined
  useEffect(() => {
    if (espera === undefined) return
    const id = window.setTimeout(tentarDeNovo, espera)
    return () => window.clearTimeout(id)
  }, [espera, tentarDeNovo])

  const valor = useMemo<ValorDados>(() => ({ carregador, estado, tentarDeNovo }), [carregador, estado, tentarDeNovo])
  return <ContextoDados.Provider value={valor}>{children}</ContextoDados.Provider>
}
