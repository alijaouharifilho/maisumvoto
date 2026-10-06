import { describe, expect, it, vi } from 'vitest'
import { criarCarregador, criarFila, ErroDados } from '../../src/dados/carregar.ts'
import { indiceDe, itemBusca, regioesDeExemplo, respostaHtml, respostaJson, VERSAO } from './fabrica.ts'

type Chamada = { url: string; init: RequestInit | undefined }

/** fetch falso: responde pelo caminho; registra cada chamada. */
function fetchFalso(rotas: Record<string, () => Response | Promise<Response>>) {
  const chamadas: Chamada[] = []
  const buscar = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(entrada)
    chamadas.push({ url, init })
    const caminho = url.replace(/\?.*$/, '')
    const rota = rotas[caminho]
    if (rota === undefined) return new Response('nada', { status: 404, headers: { 'content-type': 'text/plain' } })
    return rota()
  })
  return { buscar, chamadas }
}

function adiado<T>() {
  let resolver: (v: T) => void = () => undefined
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

describe('carregador: índice', () => {
  it('lê o índice sem ?v e sem cache HTTP, pedindo JSON', async () => {
    const { buscar, chamadas } = fetchFalso({ '/dados/indice.json': () => respostaJson(indiceDe()) })
    const c = criarCarregador({ base: '/dados', buscar })
    const indice = await c.indice()
    expect(indice.versao).toBe(VERSAO)
    expect(chamadas[0]?.url).toBe('/dados/indice.json')
    expect(chamadas[0]?.init?.cache).toBe('no-cache')
    expect(new Headers(chamadas[0]?.init?.headers).get('accept')).toBe('application/json')
  })

  it('passa o cabeçalho Date do índice (hora do servidor) e o de nenhum outro arquivo', async () => {
    const comData = (corpo: unknown, data: string): Response =>
      new Response(JSON.stringify(corpo), { headers: { 'content-type': 'application/json', date: data } })
    const { buscar } = fetchFalso({
      '/dados/indice.json': () => comData(indiceDe(), 'Sun, 25 Oct 2026 12:00:00 GMT'),
      '/dados/celulas/-102_-198.json': () => comData([], 'Mon, 05 Oct 2026 12:00:00 GMT'),
    })
    const datas: (string | null)[] = []
    const c = criarCarregador({ base: '/dados', buscar, aoHoraDoServidor: (d) => datas.push(d) })
    await c.indice()
    await c.regioesDaCelula('-102_-198')
    expect(datas).toEqual(['Sun, 25 Oct 2026 12:00:00 GMT'])
  })

  it('falha alto quando o índice não existe ou não é JSON (nunca inventa número)', async () => {
    const semIndice = criarCarregador({ base: '/dados', buscar: fetchFalso({}).buscar })
    await expect(semIndice.indice()).rejects.toBeInstanceOf(ErroDados)
    const html = criarCarregador({ base: '/dados', buscar: fetchFalso({ '/dados/indice.json': respostaHtml }).buscar })
    await expect(html.indice()).rejects.toBeInstanceOf(ErroDados)
  })

  it('não memoriza falha: a segunda tentativa pede de novo', async () => {
    let vez = 0
    const { buscar } = fetchFalso({
      '/dados/indice.json': () => {
        vez += 1
        if (vez === 1) throw new TypeError('sem rede')
        return respostaJson(indiceDe())
      },
    })
    const c = criarCarregador({ base: '/dados', buscar })
    await expect(c.indice()).rejects.toMatchObject({ motivo: 'rede' })
    await expect(c.indice()).resolves.toMatchObject({ versao: VERSAO })
    expect(buscar).toHaveBeenCalledTimes(2)
  })

  it('recusa índice fora do contrato', async () => {
    const { buscar } = fetchFalso({ '/dados/indice.json': () => respostaJson({ ...indiceDe(), versao: 'xyz' }) })
    await expect(criarCarregador({ base: '/dados', buscar }).indice()).rejects.toMatchObject({ motivo: 'formato' })
  })
})

describe('carregador: arquivos versionados', () => {
  it('pede as regiões com ?v=versão e guarda a Promise por URL', async () => {
    const { buscar, chamadas } = fetchFalso({
      '/dados/indice.json': () => respostaJson(indiceDe()),
      '/dados/celulas/-102_-198.json': () => respostaJson(regioesDeExemplo()),
    })
    const c = criarCarregador({ base: '/dados', buscar })
    const [a, b] = await Promise.all([c.regioesDaCelula('-102_-198'), c.regioesDaCelula('-102_-198')])
    expect(a).toHaveLength(2)
    expect(b).toBe(a)
    expect(chamadas.map((x) => x.url)).toEqual(['/dados/indice.json', `/dados/celulas/-102_-198.json?v=${VERSAO}`])
  })

  it('404 vira vazio (região sem arquivo não é erro)', async () => {
    const { buscar } = fetchFalso({ '/dados/indice.json': () => respostaJson(indiceDe()) })
    const c = criarCarregador({ base: '/dados', buscar })
    await expect(c.regioesDaCelula('-1_-1')).resolves.toEqual([])
    await expect(c.busca('cur')).resolves.toEqual([])
    await expect(c.cep('800')).resolves.toEqual({})
    await expect(c.secoes('PR', '75353', 1)).resolves.toEqual({ secoes: {} })
  })

  it('resposta que não é JSON (fallback de SPA) conta como ausente', async () => {
    const { buscar } = fetchFalso({
      '/dados/indice.json': () => respostaJson(indiceDe()),
      '/dados/busca/cur.json': respostaHtml,
    })
    await expect(criarCarregador({ base: '/dados', buscar }).busca('cur')).resolves.toEqual([])
  })

  it('erro de formato rejeita com motivo "formato"', async () => {
    const { buscar } = fetchFalso({
      '/dados/indice.json': () => respostaJson(indiceDe()),
      '/dados/busca/cur.json': () => respostaJson([{ t: 'x' }]),
    })
    await expect(criarCarregador({ base: '/dados', buscar }).busca('cur')).rejects.toMatchObject({ motivo: 'formato' })
  })

  it('erro HTTP 5xx rejeita e não fica guardado', async () => {
    let vez = 0
    const { buscar } = fetchFalso({
      '/dados/indice.json': () => respostaJson(indiceDe()),
      '/dados/busca/cur.json': () => {
        vez += 1
        return vez === 1 ? new Response('x', { status: 503 }) : respostaJson([itemBusca({ n: 'Curitiba' })])
      },
    })
    const c = criarCarregador({ base: '/dados', buscar })
    await expect(c.busca('cur')).rejects.toMatchObject({ motivo: 'http' })
    await expect(c.busca('cur')).resolves.toHaveLength(1)
  })

  it('monta o caminho das seções por UF minúscula, município e zona com 4 dígitos', async () => {
    const { buscar, chamadas } = fetchFalso({
      '/dados/indice.json': () => respostaJson(indiceDe()),
      '/dados/secoes/pr/75353-0001.json': () =>
        respostaJson({ secoes: { '12': { aptos: 10, comparecimento: 8, brancos: 1, nulos: 1, nominais: { '22': 6 } } } }),
    })
    const s = await criarCarregador({ base: '/dados', buscar }).secoes('PR', '75353', 1)
    expect(Object.keys(s.secoes)).toEqual(['12'])
    expect(chamadas.at(-1)?.url).toBe(`/dados/secoes/pr/75353-0001.json?v=${VERSAO}`)
  })

  it('chave fora do formato não vira pedido (nada de caminho montado com texto livre)', async () => {
    const { buscar } = fetchFalso({ '/dados/indice.json': () => respostaJson(indiceDe()) })
    const c = criarCarregador({ base: '/dados', buscar })
    await expect(c.regioesDaCelula('../x')).resolves.toEqual([])
    await expect(c.busca('a/b')).resolves.toEqual([])
    await expect(c.cep('80a')).resolves.toEqual({})
    await expect(c.secoes('P1', '7535', 1)).resolves.toEqual({ secoes: {} })
    expect(buscar).toHaveBeenCalledTimes(0)
  })
})

describe('carregador: pontos', () => {
  it('só pede quadrado que o índice lista', async () => {
    const { buscar, chamadas } = fetchFalso({
      '/dados/indice.json': () => respostaJson(indiceDe({ quadrados: ['-26_-50'] })),
      '/dados/pontos/-26_-50.json': () => respostaJson({ escala: 1000, d: [-25430, -49270, 1, 1] }),
    })
    const c = criarCarregador({ base: '/dados', buscar })
    await expect(c.pontosQuadrado('-30_-50')).resolves.toEqual([])
    const pontos = await c.pontosQuadrado('-26_-50')
    expect(pontos).toEqual([
      [-25.43, -49.27],
      [-25.429, -49.269],
    ])
    expect(chamadas.map((x) => x.url)).toEqual(['/dados/indice.json', `/dados/pontos/-26_-50.json?v=${VERSAO}`])
  })

  it('decodifica o resumo', async () => {
    const { buscar } = fetchFalso({
      '/dados/indice.json': () => respostaJson(indiceDe()),
      '/dados/pontos/resumo.json': () => respostaJson({ escala: 20, d: [-500, -1000] }),
    })
    await expect(criarCarregador({ base: '/dados', buscar }).pontosResumo()).resolves.toEqual([[-25, -50]])
  })
})

describe('carregador: fila e cancelamento', () => {
  it('nunca passa de 6 pedidos ao mesmo tempo', async () => {
    let emVoo = 0
    let maximo = 0
    const portas: Array<() => void> = []
    const lento = vi.fn(async (entrada: RequestInfo | URL): Promise<Response> => {
      if (String(entrada).includes('indice')) return respostaJson(indiceDe())
      emVoo += 1
      maximo = Math.max(maximo, emVoo)
      await new Promise<void>((liberar) => portas.push(liberar))
      emVoo -= 1
      return respostaJson([])
    })
    const c = criarCarregador({ base: '/dados', buscar: lento })
    const todos = Promise.all(Array.from({ length: 10 }, (_, i) => c.regioesDaCelula(`${i}_0`)))
    await vi.waitFor(() => expect(portas).toHaveLength(6))
    for (let liberadas = 0; liberadas < 10; liberadas += 1) {
      await vi.waitFor(() => expect(portas.length).toBeGreaterThan(0))
      portas.shift()?.()
    }
    await todos
    expect(maximo).toBe(6)
    expect(lento).toHaveBeenCalledTimes(11)
  })

  it('dezenas de quadrados de densidade não atrasam a célula do ponto escolhido (fila própria, de 2)', async () => {
    const portas: Array<() => void> = []
    const urls: string[] = []
    const lento = vi.fn(async (entrada: RequestInfo | URL): Promise<Response> => {
      const url = String(entrada)
      if (url.includes('indice')) return respostaJson(indiceDe({ quadrados: Array.from({ length: 60 }, (_, i) => `${i}_0`) }))
      urls.push(url)
      if (url.includes('pontos/')) await new Promise<void>((liberar) => portas.push(liberar))
      return respostaJson(url.includes('pontos/') ? { escala: 1000, d: [] } : [])
    })
    const c = criarCarregador({ base: '/dados', buscar: lento })
    const quadrados = Array.from({ length: 60 }, (_, i) => c.pontosQuadrado(`${i}_0`))
    await vi.waitFor(() => expect(portas).toHaveLength(2))
    await expect(c.regioesDaCelula('-102_-198')).resolves.toEqual([])
    expect(urls.filter((u) => u.includes('pontos/'))).toHaveLength(2)
    portas.splice(0).forEach((liberar) => liberar())
    for (let i = 0; i < 29; i += 1) {
      await vi.waitFor(() => expect(portas.length).toBeGreaterThan(0))
      portas.splice(0).forEach((liberar) => liberar())
    }
    await Promise.all(quadrados)
  })

  it('cancelar um pedido ainda na fila não chama fetch e libera nova tentativa', async () => {
    const fila = criarFila(1)
    const { promessa, resolver } = adiado<string>()
    const primeiro = fila.executar(() => promessa)
    const controle = new AbortController()
    const tarefa = vi.fn(async () => 'segundo')
    const segundo = fila.executar(tarefa, controle.signal)
    controle.abort()
    await expect(segundo).rejects.toMatchObject({ name: 'AbortError' })
    resolver('primeiro')
    await expect(primeiro).resolves.toBe('primeiro')
    expect(tarefa).not.toHaveBeenCalled()
  })

  it('quem desiste recebe AbortError; se ninguém mais quer, o pedido é cancelado e esquecido', async () => {
    const sinais: AbortSignal[] = []
    const { buscar: base } = fetchFalso({ '/dados/indice.json': () => respostaJson(indiceDe()) })
    const buscar = vi.fn(async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      if (String(entrada).includes('indice')) return base(entrada, init)
      if (init?.signal) sinais.push(init.signal)
      return new Promise<Response>((_, rejeitar) => {
        init?.signal?.addEventListener('abort', () => rejeitar(new DOMException('abortado', 'AbortError')))
      })
    })
    const c = criarCarregador({ base: '/dados', buscar })
    const controle = new AbortController()
    const pedido = c.regioesDaCelula('1_1', controle.signal)
    await vi.waitFor(() => expect(sinais).toHaveLength(1))
    controle.abort()
    await expect(pedido).rejects.toMatchObject({ name: 'AbortError' })
    expect(sinais[0]?.aborted).toBe(true)
    void c.regioesDaCelula('1_1').catch(() => undefined)
    await vi.waitFor(() => expect(sinais).toHaveLength(2))
  })

  it('se outro consumidor ainda quer o arquivo, o pedido continua', async () => {
    const { buscar } = fetchFalso({
      '/dados/indice.json': () => respostaJson(indiceDe()),
      '/dados/celulas/1_1.json': async () => {
        await new Promise((r) => setTimeout(r, 5))
        return respostaJson(regioesDeExemplo())
      },
    })
    const c = criarCarregador({ base: '/dados', buscar })
    const controle = new AbortController()
    const desistente = c.regioesDaCelula('1_1', controle.signal)
    const interessado = c.regioesDaCelula('1_1')
    controle.abort()
    await expect(desistente).rejects.toMatchObject({ name: 'AbortError' })
    await expect(interessado).resolves.toHaveLength(2)
  })
})
