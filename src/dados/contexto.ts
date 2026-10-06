// Contexto dos dados: o carregador e o estado do índice (que a página toda espera).
import { createContext, useContext } from 'react'
import type { Indice } from '../../nucleo/tipos.ts'
import type { Carregador } from './carregar.ts'

export type EstadoIndice =
  | { readonly tipo: 'carregando' }
  | { readonly tipo: 'ok'; readonly indice: Indice }
  | { readonly tipo: 'erro'; readonly falhas: number; readonly tentando: boolean }

export type ValorDados = {
  readonly carregador: Carregador
  readonly estado: EstadoIndice
  readonly tentarDeNovo: () => void
}

export const ContextoDados = createContext<ValorDados | null>(null)

export function useDados(): ValorDados {
  const valor = useContext(ContextoDados)
  if (valor === null) throw new Error('useDados precisa estar dentro de <ProvedorDados>')
  return valor
}

export function useIndice(): Indice | null {
  const { estado } = useDados()
  return estado.tipo === 'ok' ? estado.indice : null
}
