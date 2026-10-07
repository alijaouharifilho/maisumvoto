// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { candidatura } from '../../nucleo/candidatura.ts'
import { App } from '../../src/App.tsx'
import { linkDeFora } from '../../src/paginas/estadoMapa.ts'
import { textos } from '../../src/conteudo/textos.ts'
import { carregadorFalso, comDados, prepararDom } from './apoio.tsx'
import { regiao, votosDe } from './fabrica.ts'

// Sem WebGL no jsdom: o motor do mapa nunca carrega (a lista é a alternativa ao mapa).
vi.mock('../../src/mapa/hospedeiro.ts', () => ({
  noDoMapa: () => document.createElement('div'),
  motorCarregado: () => null,
  obterMotor: () => new Promise(() => undefined),
}))

const nomeSite = candidatura.site.nome

/** O menu principal do cabeçalho (a página do plano tem outra navegação, a das abas). */
function menu(): HTMLElement {
  return screen.getByRole('navigation', { name: textos.navegacao.rotulo })
}

function irPara(hash: string): void {
  act(() => {
    window.location.hash = hash
    window.dispatchEvent(new HashChangeEvent('hashchange'))
  })
}

beforeEach(() => {
  prepararDom()
  window.history.replaceState(null, '', '/')
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe('rotas por hash', () => {
  it('sem hash abre o mapa, com a navegação marcando a página atual', async () => {
    comDados(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: textos.abertura.titulo(nomeSite) })).toBeTruthy()
    const atual = screen.getByRole('link', { current: 'page' })
    expect(atual.textContent).toBe(textos.navegacao.rotas.mapa)
  })

  it('#/guia traz os três blocos numa página (carregada sob demanda); #/sobre fica fora do menu', async () => {
    comDados(<App />)
    irPara('#/guia')
    expect(await screen.findByRole('heading', { level: 1, name: textos.paginas.guia.titulo })).toBeTruthy()
    expect(within(menu()).getByRole('link', { current: 'page' }).textContent).toBe(textos.navegacao.rotas.guia)
    const p = textos.paginas
    for (const bloco of [p.prosa.titulo, p.plano.titulo(candidatura.alvo.nomeCurto), p.comparar.titulo]) {
      expect(screen.getByRole('heading', { level: 2, name: bloco })).toBeTruthy()
    }
    const indice = screen.getByRole('navigation', { name: p.guia.indice })
    expect(within(indice).getAllByRole('link').map((l) => l.getAttribute('href'))).toEqual(['#/guia/conversa', '#/guia/plano', '#/guia/comparar'])
    irPara('#/sobre/privacidade')
    expect(await screen.findByRole('heading', { name: 'Privacidade' })).toBeTruthy()
    expect(within(menu()).queryByRole('link', { current: 'page' })).toBeNull()
  })

  it('links antigos (#/plano/<capítulo>, #/prosa/<ficha>) abrem o Guia já no bloco certo', async () => {
    comDados(<App />)
    irPara('#/plano/seguranca')
    expect(await screen.findByRole('heading', { level: 1, name: textos.paginas.guia.titulo })).toBeTruthy()
    await waitFor(() => expect(document.activeElement?.id).toBe('guia-plano-seguranca'))
    expect(document.title).toBe(`${textos.paginas.guia.titulo} · ${nomeSite}`)
    irPara('#/prosa/abstencao')
    await waitFor(() => expect(document.activeElement?.id).toBe('guia-conversa-abstencao'))
  })

  it('trocar de página pelo menu muda o título da aba e leva o foco ao conteúdo (A11Y-10)', async () => {
    comDados(<App />)
    await screen.findByRole('heading', { level: 1, name: textos.abertura.titulo(nomeSite) })
    expect(document.title).toBe(textos.meta.titulo(nomeSite))
    irPara('#/guia')
    await screen.findByRole('heading', { level: 1, name: textos.paginas.guia.titulo })
    expect(document.title).toBe(`${textos.paginas.guia.titulo} · ${nomeSite}`)
    expect(document.activeElement?.id).toBe('conteudo')
  })

  it('rota desconhecida cai no mapa', async () => {
    window.history.replaceState(null, '', '/#/perto/@-25.430,-49.275')
    comDados(<App />)
    expect(await screen.findByRole('heading', { level: 1, name: textos.abertura.titulo(nomeSite) })).toBeTruthy()
  })

  it('link com âncora abre o ponto: busca as regiões e mostra o resultado', async () => {
    const r = regiao({ id: 'pr-75353-0001-0001', lat: -25.43, lon: -49.275, votos: votosDe({ aptos: 100, comparecimento: 80, abstencao: 20, brancos: 2, nulos: 3, nominais: { [candidatura.alvo.numero]: 40, [candidatura.adversario.numero]: 35 } }) })
    const carregador = carregadorFalso({ celulas: { '-102_-198': [r] } })
    window.history.replaceState(null, '', '/#/mapa/@-25.430,-49.275')
    comDados(<App />, carregador)
    expect(await screen.findByText(textos.busca.origem.link)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: new RegExp(textos.resultado.manchete(25).antes) })).toBeTruthy()
    expect(window.location.hash).toBe('#/mapa/@-25.430,-49.275')
  })

  it('escolher outro ponto grava o hash arredondado (nunca o ponto exato)', async () => {
    const carregador = carregadorFalso({ busca: { cur: [{ t: 'm', n: 'Curitiba', uf: 'PR', lat: -25.42871, lon: -49.27312, e: 10 }] } })
    comDados(<App />, carregador)
    const usuario = userEvent.setup()
    await usuario.type(await screen.findByRole('searchbox'), 'Curitiba')
    await usuario.click(screen.getByRole('button', { name: textos.busca.buscar }))
    await waitFor(() => expect(window.location.hash).toBe('#/mapa/@-25.430,-49.275'))
  })

  it('índice fora do ar: erro com "tentar de novo", sem número nenhum', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const carregador = carregadorFalso({ indice: new Error('fora do ar') })
    comDados(<App />, carregador)
    expect(await screen.findByRole('heading', { name: textos.erroDados.titulo })).toBeTruthy()
    expect(screen.queryByText(textos.abertura.brasilAte)).toBeNull()
    await userEvent.setup().click(screen.getByRole('button', { name: textos.erroDados.tentar }))
    await waitFor(() => expect(carregador.indice).toHaveBeenCalledTimes(2))
  })

  it('dia da votação: o mapa vira o aviso estático e o Guia perde os roteiros (o plano continua)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-25T10:00:00-03:00'))
    comDados(<App />)
    expect(await screen.findByRole('heading', { name: textos.diaDaVotacao.titulo })).toBeTruthy()
    expect(screen.queryByRole('searchbox')).toBeNull()
    expect(screen.queryByText(textos.compartilhar.botao)).toBeNull()
    irPara('#/prosa')
    expect(await screen.findByRole('heading', { level: 1, name: textos.paginas.guia.titulo })).toBeTruthy()
    expect(screen.queryByRole('heading', { name: textos.paginas.prosa.titulo })).toBeNull()
    expect(screen.getByText(textos.diaDaVotacao.paragrafos[0])).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2, name: textos.paginas.plano.titulo(candidatura.alvo.nomeCurto) })).toBeTruthy()
    const indice = screen.getByRole('navigation', { name: textos.paginas.guia.indice })
    expect(within(indice).queryByRole('link', { name: textos.paginas.guia.partes.conversa })).toBeNull()
  })
})

describe('linkDeFora: âncora nova que o site ainda não adotou', () => {
  const curitiba = { lat: -25.43, lon: -49.275 }

  it('link de outro ponto, que o site não escreveu, é de fora (o ouvinte de hashchange adota)', () => {
    expect(linkDeFora('-23.550,-46.635', '-25.430,-49.275', curitiba)).toBe(true)
    expect(linkDeFora('-23.550,-46.635', null, null)).toBe(true)
  })

  it('o que o próprio site escreveu, o mesmo ponto, âncora vazia ou inválida não são de fora', () => {
    expect(linkDeFora('-25.430,-49.275', '-25.430,-49.275', curitiba)).toBe(false)
    expect(linkDeFora('-25.430,-49.275', null, curitiba)).toBe(false)
    expect(linkDeFora(null, '-25.430,-49.275', curitiba)).toBe(false)
    expect(linkDeFora('qualquer-coisa', null, curitiba)).toBe(false)
  })
})

describe('hash do mapa vindo de outra página', () => {
  it('Sobre → link de outro ponto troca o ponto e mantém o hash do link', async () => {
    const votos = votosDe({ aptos: 100, comparecimento: 80, abstencao: 20, brancos: 2, nulos: 3, nominais: { [candidatura.alvo.numero]: 40, [candidatura.adversario.numero]: 35 } })
    const a = regiao({ id: 'pr-75353-0001-0001', lat: -25.43, lon: -49.275, votos })
    const b = regiao({ id: 'sp-71072-0001-0001', lat: -23.55, lon: -46.635, votos: { ...votos, abstencao: 70 } })
    const carregador = carregadorFalso({ celulas: { '-102_-198': [a], '-95_-187': [b] } })
    window.history.replaceState(null, '', '/#/mapa/@-25.430,-49.275')
    comDados(<App />, carregador)
    expect(await screen.findByText(textos.busca.origem.link)).toBeTruthy()
    irPara('#/sobre')
    expect(await screen.findByRole('heading', { level: 1, name: /Sobre/ })).toBeTruthy()
    irPara('#/mapa/@-23.550,-46.635')
    await waitFor(() => expect(carregador.regioesDaCelula).toHaveBeenCalledWith('-95_-187', expect.anything()))
    expect(window.location.hash).toBe('#/mapa/@-23.550,-46.635')
  })
})
