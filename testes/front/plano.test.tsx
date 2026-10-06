// @vitest-environment jsdom
// Cartões de conversa do plano: número com fonte, porquê, pergunta com cópia (sucesso e falha), cuidado e trecho literal.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { linkPagina, plano, type Proposta } from '../../src/conteudo/conteudo.ts'
import { dia, textos } from '../../src/conteudo/textos.ts'
import { CartaoDoPlano } from '../../src/componentes/CartaoDoPlano.tsx'
import { PaginaPlano } from '../../src/paginas/PaginaPlano.tsx'

const t = textos.paginas.plano
const todas: readonly Proposta[] = plano.capitulos.flatMap((c) => c.propostas)

function primeira(filtro: (p: Proposta) => boolean): Proposta {
  const p = todas.find(filtro)
  if (p === undefined) throw new Error('nenhum cartão atende ao filtro')
  return p
}

function definirClipboard(valor: { writeText: (s: string) => Promise<void> } | undefined): void {
  Object.defineProperty(window.navigator, 'clipboard', { value: valor, configurable: true })
}

afterEach(() => {
  cleanup()
  definirClipboard(undefined)
})

describe('CartaoDoPlano', () => {
  it('mostra o que é, o número com a fonte (nova aba, sem referrer) e por que faz sentido', () => {
    const p = primeira((x) => x.dado !== null)
    render(<CartaoDoPlano proposta={p} />)
    const cartao = screen.getByRole('article', { name: p.titulo })
    expect(within(cartao).getByText(p.emUmaFrase)).toBeTruthy()
    expect(within(cartao).getByText(p.dado?.numero ?? '')).toBeTruthy()
    const fonte = within(cartao).getByRole('link', { name: new RegExp(`^${p.dado?.fonte.slice(0, 20).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`) })
    expect(fonte.getAttribute('href')).toBe(p.dado?.url)
    expect(fonte.getAttribute('target')).toBe('_blank')
    expect(fonte.getAttribute('rel')).toContain('noopener')
    expect(within(cartao).getByText(t.porQue)).toBeTruthy()
    expect(within(cartao).getByText(p.porQue)).toBeTruthy()
  })

  it('copiar põe a pergunta na área de transferência e avisa', async () => {
    const writeText = vi.fn(async (_texto: string) => undefined)
    definirClipboard({ writeText })
    const p = primeira(() => true)
    render(<CartaoDoPlano proposta={p} />)
    fireEvent.click(screen.getByRole('button', { name: t.copiar }))
    expect(await screen.findByText(t.copiado)).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith(p.paraPuxar)
  })

  it('se a cópia falhar (ou não existir), explica como copiar à mão', async () => {
    definirClipboard({ writeText: async () => Promise.reject(new Error('negado')) })
    const { unmount } = render(<CartaoDoPlano proposta={primeira(() => true)} />)
    fireEvent.click(screen.getByRole('button', { name: t.copiar }))
    expect(await screen.findByText(t.copiaFalhou)).toBeTruthy()
    unmount()

    definirClipboard(undefined)
    render(<CartaoDoPlano proposta={primeira(() => true)} />)
    fireEvent.click(screen.getByRole('button', { name: t.copiar }))
    expect(await screen.findByText(t.copiaFalhou)).toBeTruthy()
  })

  it('sem a API de área de transferência (navegador de app), copia pelo jeito antigo', async () => {
    definirClipboard(undefined)
    const execCommand = vi.fn((_comando: string) => true)
    Object.defineProperty(document, 'execCommand', { value: execCommand, configurable: true })
    try {
      render(<CartaoDoPlano proposta={primeira(() => true)} />)
      fireEvent.click(screen.getByRole('button', { name: t.copiar }))
      expect(await screen.findByText(t.copiado)).toBeTruthy()
      expect(execCommand).toHaveBeenCalledWith('copy')
      expect(document.querySelector('textarea')).toBeNull()
    } finally {
      Reflect.deleteProperty(document, 'execCommand')
    }
  })

  it('o botão de copiar descreve a própria pergunta (52 botões não ficam iguais no leitor de tela)', () => {
    const p = primeira(() => true)
    render(<CartaoDoPlano proposta={p} />)
    const botao = screen.getByRole('button', { name: t.copiar })
    const idDescricao = botao.getAttribute('aria-describedby') ?? ''
    expect(document.getElementById(idDescricao)?.textContent).toContain(p.paraPuxar)
  })

  it('o cuidado ao falar aparece só no cartão que tem', () => {
    const comCuidado = primeira((x) => x.cuidado !== undefined)
    const semCuidado = primeira((x) => x.cuidado === undefined)
    render(<CartaoDoPlano proposta={comCuidado} />)
    expect(screen.getByText(comCuidado.cuidado ?? '')).toBeTruthy()
    cleanup()
    render(<CartaoDoPlano proposta={semCuidado} />)
    expect(screen.queryByText(t.cuidado)).toBeNull()
  })

  it('o trecho literal fica recolhido no fim, com link para a página do PDF', () => {
    const p = primeira(() => true)
    const { container } = render(<CartaoDoPlano proposta={p} />)
    const detalhes = container.querySelector('details')
    expect(detalhes?.open).toBe(false)
    expect(within(detalhes as HTMLElement).getByText(t.oQueOPlanoDiz(p.pagina))).toBeTruthy()
    expect(within(detalhes as HTMLElement).getByText(`“${p.trecho}”`)).toBeTruthy()
    const link = within(detalhes as HTMLElement).getByRole('link', { name: new RegExp(`^${t.pagina(p.pagina)}`) })
    expect(link.getAttribute('href')).toBe(linkPagina(p.pagina))
  })
})

describe('PaginaPlano', () => {
  it('mostra um cartão para cada proposta e a data de conferência dos números', () => {
    window.scrollTo = vi.fn()
    render(<PaginaPlano ancora={null} />)
    // A própria página também é um <article>; os cartões são os que têm título ligado por aria-labelledby.
    const cartoes = screen.getAllByRole('article').filter((a) => a.hasAttribute('aria-labelledby'))
    expect(cartoes).toHaveLength(todas.length)
    expect(document.body.textContent).toContain(t.dadosConferidos(dia(plano.dadosConferidosEm)))
  })
})
