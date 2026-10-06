// @vitest-environment jsdom
// Tela do mapa: resposta atrasada não troca o ponto, foco e anúncio depois da busca, ponto
// arredondado na escolha, painel inert com a Ficha aberta e mapa que não carregou.
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { candidatura } from '../../nucleo/candidatura.ts'
import { App } from '../../src/App.tsx'
import { Busca } from '../../src/componentes/Busca.tsx'
import { textos } from '../../src/conteudo/textos.ts'
import { FIM_CONVERSA } from '../../src/config.ts'
import type { PontoEscolhido } from '../../src/dados/buscar.ts'
import type { Carregador } from '../../src/dados/carregar.ts'
import { useEstadoMapa } from '../../src/paginas/estadoMapa.ts'
import { carregadorFalso, comDados, prepararDom } from './apoio.tsx'
import { indiceDe, itemBusca, regiao, votosDe } from './fabrica.ts'

const motor = vi.hoisted(() => ({ obter: vi.fn<() => Promise<never>>(() => new Promise(() => undefined)) }))

vi.mock('../../src/mapa/hospedeiro.ts', () => ({
  noDoMapa: () => document.createElement('div'),
  motorCarregado: () => null,
  obterMotor: motor.obter,
}))

const t = textos.busca
const A = candidatura.alvo.numero
const D = candidatura.adversario.numero

beforeEach(() => {
  prepararDom()
  window.history.replaceState(null, '', '/')
  motor.obter.mockImplementation(() => new Promise(() => undefined))
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** A mesma fiação da PaginaMapa: a Busca e um "toque no mapa" escolhem o ponto pelo mesmo caminho. */
function Montagem({ carregador }: { carregador: Carregador }) {
  const [ponto, setPonto] = useState<PontoEscolhido | null>(null)
  const [versao, setVersao] = useState(0)
  const escolher = (p: PontoEscolhido): void => {
    setPonto(p)
    setVersao((v) => v + 1)
  }
  return (
    <>
      <Busca carregador={carregador} onEscolher={escolher} versaoPonto={versao} />
      <button type="button" onClick={() => escolher({ lat: -25.43, lon: -49.27, origem: 'mapa', rotulo: null })}>
        toque no mapa
      </button>
      <p data-testid="ponto">{ponto === null ? '' : `${ponto.origem}:${ponto.lat}`}</p>
    </>
  )
}

function adiado<T>() {
  let resolver: (v: T) => void = () => undefined
  const promessa = new Promise<T>((r) => {
    resolver = r
  })
  return { promessa, resolver }
}

describe('resposta atrasada não troca o ponto escolhido depois', () => {
  it('busca lenta resolve depois de um toque no mapa: vale o toque', async () => {
    const arquivo = adiado<ReturnType<typeof itemBusca>[]>()
    const carregador = carregadorFalso()
    carregador.busca.mockImplementation(() => arquivo.promessa)
    render(<Montagem carregador={carregador} />)
    const usuario = userEvent.setup()
    await usuario.type(screen.getByRole('searchbox'), 'Batel')
    await usuario.click(screen.getByRole('button', { name: t.buscar }))
    await usuario.click(screen.getByRole('button', { name: 'toque no mapa' }))
    await act(async () => arquivo.resolver([itemBusca({ t: 'b', n: 'Batel', m: 'Curitiba', lat: -25.44, lon: -49.29 })]))
    expect(screen.getByTestId('ponto').textContent).toBe('mapa:-25.43')
    expect(screen.getByRole('button', { name: t.buscar })).toBeTruthy()
  })

  it('GPS responde depois de um toque no mapa: vale o toque', async () => {
    let responder: PositionCallback = () => undefined
    vi.stubGlobal('navigator', { geolocation: { getCurrentPosition: (ok: PositionCallback) => (responder = ok) } })
    render(<Montagem carregador={carregadorFalso()} />)
    const usuario = userEvent.setup()
    await usuario.click(screen.getByRole('button', { name: t.minhaLocalizacao }))
    await usuario.click(screen.getByRole('button', { name: 'toque no mapa' }))
    act(() => responder({ coords: { latitude: -23.55, longitude: -46.63 } } as GeolocationPosition))
    expect(screen.getByTestId('ponto').textContent).toBe('mapa:-25.43')
    expect(screen.getByRole('button', { name: t.minhaLocalizacao })).toBeTruthy()
  })
})

describe('foco e anúncio depois da busca', () => {
  it('enquanto busca, o botão fica aria-disabled e com o foco (não vai para o body)', async () => {
    const arquivo = adiado<ReturnType<typeof itemBusca>[]>()
    const carregador = carregadorFalso()
    carregador.busca.mockImplementation(() => arquivo.promessa)
    render(<Montagem carregador={carregador} />)
    const usuario = userEvent.setup()
    await usuario.type(screen.getByRole('searchbox'), 'Batel')
    await usuario.click(screen.getByRole('button', { name: t.buscar }))
    const botao = screen.getByRole('button', { name: t.buscando })
    expect(botao.getAttribute('aria-disabled')).toBe('true')
    expect(botao.hasAttribute('disabled')).toBe(false)
    expect(document.activeElement).toBe(botao)
    await usuario.click(botao) // clique de novo não dispara outra busca
    expect(carregador.busca).toHaveBeenCalledTimes(1)
    await act(async () => arquivo.resolver([]))
  })

  it('escolher uma sugestão leva o foco à manchete e a região viva anuncia o ponto', async () => {
    const votos = votosDe({ aptos: 100, comparecimento: 80, abstencao: 20, brancos: 2, nulos: 3, nominais: { [A]: 40, [D]: 35 } })
    const r = regiao({ id: 'pr-75353-0001-0001', lat: -25.43, lon: -49.275, votos })
    const itens = [
      itemBusca({ t: 'b', n: 'Centro', m: 'Curitiba', lat: -25.43, lon: -49.275, e: 900 }),
      itemBusca({ t: 'b', n: 'Centro', m: 'Recife', uf: 'PE', lat: -8.06, lon: -34.88, e: 800 }),
    ]
    comDados(<App />, carregadorFalso({ busca: { cen: itens }, celulas: { '-102_-198': [r] } }))
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByRole('searchbox'), 'Centro')
    await usuario.click(screen.getByRole('button', { name: t.buscar }))
    await usuario.click(await screen.findByRole('button', { name: 'Centro, Curitiba – PR' }))
    const manchete = await screen.findByRole('heading', { level: 2, name: new RegExp(textos.resultado.manchete(25).antes) })
    await waitFor(() => expect(document.activeElement).toBe(manchete))
    const anuncio = document.querySelector('output.sr-only')?.textContent ?? ''
    expect(anuncio).toContain('Centro, Curitiba – PR')
    expect(anuncio).toContain('25')
  })
})

describe('ponto arredondado na escolha', () => {
  it('busca, GPS e toque entram já na grade do link: tela, link e mensagem mostram o mesmo ponto', () => {
    const { result } = renderHook(() => useEstadoMapa(carregadorFalso(), indiceDe(), { rota: 'mapa', ancora: null }))
    act(() => result.current.escolher({ lat: -25.4672, lon: -49.2761, origem: 'busca', rotulo: 'Curitiba – PR' }))
    expect(result.current.ponto).toEqual({ lat: -25.465, lon: -49.275, origem: 'busca', rotulo: 'Curitiba – PR' })
    expect(result.current.versao).toBe(1)
  })
})

describe('Ficha aberta no desktop', () => {
  it('o painel de baixo fica inert: Tab e leitor de tela não passam por trás da ficha', async () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('min-width') || q.includes('reduce'), addEventListener: () => undefined, removeEventListener: () => undefined }))
    const votos = votosDe({ aptos: 100, comparecimento: 80, abstencao: 20, brancos: 2, nulos: 3, nominais: { [A]: 40, [D]: 35 } })
    const r = regiao({ id: 'pr-75353-0001-0001', lat: -25.43, lon: -49.275, votos })
    window.history.replaceState(null, '', '/#/mapa/@-25.430,-49.275')
    comDados(<App />, carregadorFalso({ celulas: { '-102_-198': [r] } }))
    const usuario = userEvent.setup()
    const item = await screen.findByRole('button', { name: new RegExp(r.locais[0]?.nome ?? '') })
    const busca = screen.getByRole('searchbox')
    expect(busca.closest('[inert]')).toBeNull()
    await usuario.click(item)
    expect(await screen.findByRole('dialog')).toBeTruthy()
    expect(busca.closest('[inert]')).not.toBeNull()
  })
})

describe('mapa que não carrega', () => {
  it('mostra o aviso com "tentar de novo" em vez da caixa vazia, e some a dica de tocar no mapa', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    motor.obter.mockImplementation(() => Promise.reject(new Error('sem WebGL')))
    comDados(<App />)
    expect(await screen.findByText(textos.mapa.falhou)).toBeTruthy()
    expect(screen.queryByText(t.dica)).toBeNull()
    expect(screen.queryByText(textos.mapa.dica)).toBeNull()
    const chamadas = motor.obter.mock.calls.length
    await userEvent.setup().click(screen.getByRole('button', { name: textos.mapa.tentarDeNovo }))
    await waitFor(() => expect(motor.obter.mock.calls.length).toBeGreaterThan(chamadas))
  })
})

describe('abertura fora da fase aberta (R11)', () => {
  it('na pausa, a chamada não convida a conversar: só consulta', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-24T23:00:00-03:00'))
    try {
      comDados(<App />)
      expect(await screen.findByText(textos.abertura.chamadaConsulta(FIM_CONVERSA))).toBeTruthy()
      expect(screen.queryByText(/Conversa de vizinho para vizinho/)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})
