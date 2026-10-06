// Fila com limite de pedidos simultâneos. Tarefa cancelada enquanto espera nem chega a começar.

export type Fila = {
  executar<T>(tarefa: () => Promise<T>, sinal?: AbortSignal): Promise<T>
}

type Pendente = { iniciar: () => void; sinal: AbortSignal | undefined }

export function erroAbortado(): DOMException {
  return new DOMException('pedido cancelado', 'AbortError')
}

export function criarFila(maximo: number): Fila {
  if (!Number.isInteger(maximo) || maximo < 1) throw new RangeError(`limite da fila precisa ser inteiro ≥ 1 (recebeu ${maximo})`)
  let emAndamento = 0
  const espera: Pendente[] = []

  function proxima(): void {
    while (emAndamento < maximo && espera.length > 0) {
      const item = espera.shift()
      if (item !== undefined && item.sinal?.aborted !== true) item.iniciar()
    }
  }

  function executar<T>(tarefa: () => Promise<T>, sinal?: AbortSignal): Promise<T> {
    return new Promise<T>((resolver, rejeitar) => {
      if (sinal?.aborted === true) {
        rejeitar(erroAbortado())
        return
      }
      const aoAbortar = (): void => rejeitar(erroAbortado())
      sinal?.addEventListener('abort', aoAbortar, { once: true })
      const iniciar = (): void => {
        sinal?.removeEventListener('abort', aoAbortar)
        emAndamento += 1
        tarefa()
          .then(resolver, rejeitar)
          .finally(() => {
            emAndamento -= 1
            proxima()
          })
      }
      espera.push({ iniciar, sinal })
      proxima()
    })
  }

  return { executar }
}
