// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { candidatura } from '../../nucleo/candidatura.ts'
import type { RegiaoComDist } from '../../nucleo/ranking.ts'
import { roteiros } from '../../src/conteudo/conteudo.ts'
import { textos } from '../../src/conteudo/textos.ts'
import { Compartilhar } from '../../src/componentes/Compartilhar.tsx'
import { Ficha } from '../../src/componentes/ficha/Ficha.tsx'
import { carregadorFalso, comDados, prepararDom } from './apoio.tsx'
import { indiceDe, regiao, votosDe } from './fabrica.ts'

const A = candidatura.alvo.numero
const D = candidatura.adversario.numero
// Primeiro número de gruposConversa que não é grupo fixo (um candidato com ficha ainda em preparação).
const numeroFase2 = Object.keys(candidatura.gruposConversa).find((k) => /^\d{2}$/.test(k)) ?? '70'

function regiaoDeTeste(): RegiaoComDist {
  return {
    ...regiao({
      id: 'pr-75353-0001-0001',
      votos: votosDe({ aptos: 100, comparecimento: 80, abstencao: 20, brancos: 2, nulos: 3, nominais: { [A]: 40, [D]: 30, [numeroFase2]: 5 } }),
      locais: [{ nome: 'Escola A', endereco: 'Rua A, 1', cep: '80010000', zona: 1, nr: 1015, secoes: [12, 13] }],
    }),
    dist: 0.4,
  }
}

beforeEach(prepararDom)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Ficha', () => {
  it('é um diálogo rotulado pelo nome do local; o foco vai para "voltar" e Esc fecha', async () => {
    const fechar = vi.fn()
    comDados(<Ficha regiao={regiaoDeTeste()} indice={indiceDe()} aberta modal={false} onFechar={fechar} />)
    const dialogo = screen.getByRole('dialog', { name: 'Escola A' })
    expect(dialogo.getAttribute('aria-modal')).toBe('false')
    expect(document.activeElement).toBe(screen.getByRole('button', { name: textos.ficha.fecharAria }))
    await userEvent.setup().keyboard('{Escape}')
    expect(fechar).toHaveBeenCalledTimes(1)
  })

  it('no celular é modal: aria-modal=true e o foco não sai do diálogo', async () => {
    comDados(<Ficha regiao={regiaoDeTeste()} indice={indiceDe()} aberta modal onFechar={() => undefined} />)
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('true')
    expect(document.body.style.overflow).toBe('hidden')
    const usuario = userEvent.setup()
    for (let i = 0; i < 30; i += 1) await usuario.tab()
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true)
  })

  it('devolve o foco a quem abriu ao fechar', () => {
    const botao = document.createElement('button')
    document.body.appendChild(botao)
    botao.focus()
    const { unmount } = render(<span />)
    unmount()
    const r = comDados(<Ficha regiao={regiaoDeTeste()} indice={indiceDe()} aberta modal={false} onFechar={() => undefined} />)
    expect(document.activeElement).not.toBe(botao)
    r.unmount()
    expect(document.activeElement).toBe(botao)
    botao.remove()
  })

  it('só mostra roteiros publicados: abstenção sim, candidato em preparação não', () => {
    comDados(<Ficha regiao={regiaoDeTeste()} indice={indiceDe()} aberta modal={false} onFechar={() => undefined} />)
    const abstencao = roteiros.fichas.abstencao
    expect(abstencao !== undefined && 'titulo' in abstencao).toBe(true)
    if (abstencao === undefined || !('titulo' in abstencao)) return
    expect(screen.getByText(textos.ficha.grupo(abstencao.titulo, 20))).toBeTruthy()
    expect(screen.queryAllByRole('group').length).toBeGreaterThan(0)
    const resumos = Array.from(document.querySelectorAll('summary')).map((s) => s.textContent ?? '')
    expect(resumos.some((r) => r.endsWith('· 5'))).toBe(false)
  })

  it('resultado da seção só é baixado quando a seção é aberta', async () => {
    const carregador = carregadorFalso({
      secoes: { secoes: { '12': { aptos: 50, comparecimento: 40, brancos: 1, nulos: 2, nominais: { [A]: 20, [D]: 17 } } } },
    })
    comDados(<Ficha regiao={regiaoDeTeste()} indice={indiceDe()} aberta modal={false} onFechar={() => undefined} />, carregador)
    expect(carregador.secoes).not.toHaveBeenCalled()
    await userEvent.setup().click(screen.getByRole('button', { name: textos.ficha.zona(1, [12]) }))
    await waitFor(() => expect(carregador.secoes).toHaveBeenCalledWith('PR', '75353', 1, expect.any(AbortSignal)))
    expect(await screen.findByText(textos.resultado.parcela.abstencao(10))).toBeTruthy()
  })

  it('como chegar pela coordenada (Google Maps e Waze), em outra aba', () => {
    comDados(<Ficha regiao={regiaoDeTeste()} indice={indiceDe()} aberta modal={false} onFechar={() => undefined} />)
    const google = screen.getByRole('link', { name: new RegExp(textos.ficha.googleMaps.replace(/[()]/g, '\\$&')) })
    expect(google.getAttribute('href')).toBe('https://www.google.com/maps/dir/?api=1&destination=-25.4284%2C-49.2733')
    expect(google.getAttribute('rel')).toBe('noopener noreferrer')
  })
})

describe('Compartilhar', () => {
  it('monta o wa.me com a mensagem do conteúdo, o "até" e o link arredondado', () => {
    const link = 'https://exemplo.test/#/mapa/@-25.430,-49.275'
    render(<Compartilhar link={link} ate={1234} />)
    const botao = screen.getByRole('link', { name: new RegExp(textos.compartilhar.botao) })
    const href = botao.getAttribute('href') ?? ''
    expect(href.startsWith('https://wa.me/?text=')).toBe(true)
    const texto = decodeURIComponent(href.slice('https://wa.me/?text='.length))
    expect(texto).toBe(textos.compartilhar.mensagem({ nomeSite: candidatura.site.nome, alvo: candidatura.alvo.nomeCurto, link, ate: 1234 }))
    expect(texto).toContain('#/mapa/@-25.430,-49.275')
    expect(screen.getByText(textos.compartilhar.regra)).toBeTruthy()
  })

  it('sem número, a mensagem não inventa: usa a frase genérica', () => {
    act(() => {
      render(<Compartilhar link="https://exemplo.test/" />)
    })
    const href = screen.getByRole('link', { name: new RegExp(textos.compartilhar.botao) }).getAttribute('href') ?? ''
    expect(decodeURIComponent(href)).not.toMatch(/até \d/)
  })
})
