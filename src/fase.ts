// Fase do calendário compartilhada pela página (um só relógio para todo o app).
import { createContext, useContext } from 'react'
import type { EstadoFase } from './relogio.ts'

export const ContextoFase = createContext<EstadoFase>({ fase: 'campanha', aberta: true })

export function useFaseAtual(): EstadoFase {
  return useContext(ContextoFase)
}
