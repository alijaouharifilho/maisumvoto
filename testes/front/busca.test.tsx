// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { textos } from '../../src/conteudo/textos.ts'
import { Busca } from '../../src/componentes/Busca.tsx'
import { cepParecido, type PontoEscolhido } from '../../src/dados/buscar.ts'
import { carregadorFalso } from './apoio.tsx'
import { itemBusca } from './fabrica.ts'

const t = textos.busca

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function montar(dados: Parameters<typeof carregadorFalso>[0] = {}) {
  const carregador = carregadorFalso(dados)
  const escolhidos: PontoEscolhido[] = []
  render(<Busca carregador={carregador} onEscolher={(p) => escolhidos.push(p)} versaoPonto={0} />)
  return { carregador, escolhidos, usuario: userEvent.setup() }
}

async function buscar(usuario: ReturnType<typeof userEvent.setup>, texto: string): Promise<void> {
  await usuario.type(screen.getByRole('searchbox', { name: t.rotulo }), texto)
  await usuario.click(screen.getByRole('button', { name: t.buscar }))
}

describe('Busca', () => {
  it('texto curto: erro de validação sem pedir arquivo nenhum', async () => {
    const { carregador, usuario } = montar()
    await buscar(usuario, 'ab')
    expect(await screen.findByRole('alert')).toHaveProperty('textContent', t.erros.curto(3))
    expect(carregador.busca).not.toHaveBeenCalled()
  })

  it('um resultado: aplica direto, com o rótulo "nome – UF"', async () => {
    const { carregador, escolhidos, usuario } = montar({ busca: { cur: [itemBusca({ n: 'Curitiba', lat: -25.43, lon: -49.27 })] } })
    await buscar(usuario, 'Curitiba')
    await vi.waitFor(() => expect(escolhidos).toHaveLength(1))
    expect(carregador.busca.mock.calls[0]?.[0]).toBe('cur')
    expect(escolhidos[0]).toEqual({ lat: -25.43, lon: -49.27, origem: 'busca', rotulo: 'Curitiba – PR' })
  })

  it('vários resultados: lista de sugestões em botões; escolher aplica o ponto', async () => {
    const itens = [
      itemBusca({ t: 'b', n: 'Centro', m: 'Curitiba', e: 900 }),
      itemBusca({ t: 'b', n: 'Centro', m: 'Recife', uf: 'PE', e: 800, lat: -8.06, lon: -34.88 }),
    ]
    const { escolhidos, usuario } = montar({ busca: { cen: itens } })
    await buscar(usuario, 'Centro')
    expect(await screen.findByText(t.sugestoes(2))).toBeTruthy()
    await usuario.click(screen.getByRole('button', { name: 'Centro, Recife – PE' }))
    expect(escolhidos[0]).toMatchObject({ lat: -8.06, lon: -34.88, origem: 'busca', rotulo: 'Centro, Recife – PE' })
    expect(screen.queryByText(t.sugestoes(2))).toBeNull()
  })

  it('"bairro cidade" sem vírgula: pede o arquivo do bairro também e vai direto ao bairro', async () => {
    const tijuca = itemBusca({ t: 'b', n: 'Tijuca', m: 'Rio de Janeiro', uf: 'RJ', e: 151_142, lat: -22.93, lon: -43.24 })
    const colegio = itemBusca({ t: 'l', n: 'Colégio Tijuca', m: 'Rio de Janeiro', uf: 'RJ', e: 900 })
    const janeiro = itemBusca({ t: 'l', n: 'Escola Primeiro de Janeiro', m: 'Rio de Janeiro', uf: 'RJ', e: 800 })
    const { carregador, escolhidos, usuario } = montar({ busca: { tij: [tijuca, colegio], jan: [janeiro] } })
    await buscar(usuario, 'Tijuca Rio de Janeiro')
    await vi.waitFor(() => expect(escolhidos).toHaveLength(1))
    expect(carregador.busca.mock.calls.map((c) => c[0])).toEqual(['tij', 'jan'])
    expect(escolhidos[0]).toMatchObject({ lat: -22.93, lon: -43.24, rotulo: 'Tijuca, Rio de Janeiro – RJ' })
  })

  it('item em dois arquivos de prefixo aparece uma vez só', async () => {
    const asa = itemBusca({ t: 'b', n: 'Asa Sul', m: 'Brasília', uf: 'DF', e: 90_000 })
    const outro = itemBusca({ t: 'b', n: 'Asa Sul', m: 'Taguatinga', uf: 'DF', e: 10 })
    const { usuario } = montar({ busca: { asa: [asa, outro], sul: [asa, outro] } })
    await buscar(usuario, 'Asa Sul')
    expect(await screen.findByText(t.sugestoes(2))).toBeTruthy()
  })

  it('nada encontrado: erro com role=alert', async () => {
    const { usuario } = montar({ busca: { xyz: [] } })
    await buscar(usuario, 'Xyzabc')
    expect((await screen.findByRole('alert')).textContent).toBe(t.erros.nadaEncontrado)
  })

  it('CEP vai para o arquivo de CEP (3 primeiros dígitos)', async () => {
    const cep = { '800': { '80010000': { lat: -25.43, lon: -49.27, m: 'Curitiba', uf: 'PR', b: 'Centro' } } }
    const { carregador, escolhidos, usuario } = montar({ cep })
    await buscar(usuario, '80010-000')
    await vi.waitFor(() => expect(escolhidos).toHaveLength(1))
    expect(carregador.cep.mock.calls[0]?.[0]).toBe('800')
    expect(carregador.busca).not.toHaveBeenCalled()
    expect(escolhidos[0]?.rotulo).toBe('80010-000 · Centro, Curitiba – PR')
  })

  it('CEP de casa (fora dos locais): usa o CEP de local do mesmo setor, rotulado "perto do CEP"', async () => {
    const cep = {
      '800': {
        '80010000': { lat: -25.43, lon: -49.27, m: 'Curitiba', uf: 'PR', b: 'Centro' },
        '80010900': { lat: -25.44, lon: -49.28, m: 'Curitiba', uf: 'PR', b: 'Centro' },
        '80020000': { lat: -25.5, lon: -49.3, m: 'Curitiba', uf: 'PR', b: 'Batel' },
      },
    }
    const { escolhidos, usuario } = montar({ cep })
    await buscar(usuario, '80.010-120')
    await vi.waitFor(() => expect(escolhidos).toHaveLength(1))
    expect(escolhidos[0]).toMatchObject({ lat: -25.43, lon: -49.27, rotulo: t.cepAproximado('80010-120', 'Centro, Curitiba – PR') })
  })

  it('CEP que não está nos locais de votação: mensagem própria', async () => {
    const { usuario } = montar({ cep: { '800': {} } })
    await buscar(usuario, '80010000')
    expect((await screen.findByRole('alert')).textContent).toBe(t.erros.cepNaoEncontrado)
  })

  it('falha ao baixar o índice de busca: "a busca não respondeu"', async () => {
    const { carregador, usuario } = montar()
    carregador.busca.mockRejectedValueOnce(new Error('rede'))
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await buscar(usuario, 'Curitiba')
    expect((await screen.findByRole('alert')).textContent).toBe(t.erros.falhaBusca)
  })

  it('sem API de localização: avisa, sem quebrar', async () => {
    vi.stubGlobal('navigator', { ...navigator, geolocation: undefined })
    Reflect.deleteProperty(navigator, 'geolocation')
    const { usuario } = montar()
    await usuario.click(screen.getByRole('button', { name: t.minhaLocalizacao }))
    expect((await screen.findByRole('alert')).textContent).toBe(t.erros.localizacaoIndisponivel)
  })

  it('localização negada: avisa; concedida: aplica o ponto com origem "localizacao"', async () => {
    const negar = { getCurrentPosition: (_ok: PositionCallback, erro: PositionErrorCallback) => erro({ code: 1 } as GeolocationPositionError) }
    vi.stubGlobal('navigator', { geolocation: negar })
    const primeiro = montar()
    await primeiro.usuario.click(screen.getByRole('button', { name: t.minhaLocalizacao }))
    expect((await screen.findByRole('alert')).textContent).toBe(t.erros.localizacaoNegada)
    cleanup()

    const conceder = {
      getCurrentPosition: (ok: PositionCallback, _erro: PositionErrorCallback, opcoes?: PositionOptions) => {
        expect(opcoes).toMatchObject({ enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 })
        ok({ coords: { latitude: -23.55, longitude: -46.63 } } as GeolocationPosition)
      },
    }
    vi.stubGlobal('navigator', { geolocation: conceder })
    const segundo = montar()
    await segundo.usuario.click(screen.getByRole('button', { name: t.minhaLocalizacao }))
    expect(segundo.escolhidos[0]).toEqual({ lat: -23.55, lon: -46.63, origem: 'localizacao', rotulo: null })
  })
})

describe('cepParecido', () => {
  const ceps = {
    '80010000': { lat: 1, lon: 1, m: 'Curitiba', uf: 'PR', b: 'Centro' },
    '80010900': { lat: 2, lon: 2, m: 'Curitiba', uf: 'PR', b: 'Centro' },
    '80019000': { lat: 3, lon: 3, m: 'Curitiba', uf: 'PR', b: 'Centro' },
    '80030000': { lat: 4, lon: 4, m: 'Curitiba', uf: 'PR', b: 'Alto da Glória' },
  }

  it('mesmo setor (5 dígitos): o de numeração mais próxima', () => {
    expect(cepParecido(ceps, '80010800')).toBe('80010900')
    expect(cepParecido(ceps, '80010100')).toBe('80010000')
  })

  it('empate de distância: o menor', () => {
    expect(cepParecido(ceps, '80010450')).toBe('80010000')
  })

  it('sem setor, cai para o subsetor (4 dígitos); sem nada, null', () => {
    expect(cepParecido(ceps, '80015000')).toBe('80019000')
    expect(cepParecido(ceps, '80040000')).toBeNull()
  })
})
