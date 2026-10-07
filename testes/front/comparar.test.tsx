// @vitest-environment jsdom
// Guia, bloco da comparação entre os planos: um bloco por assunto com os dois lados, cada trecho levando à página do
// PDF do próprio plano, e o índice por assunto apontando para as âncoras do Guia.
import { cleanup, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { candidatura } from '../../nucleo/candidatura.ts'
import { comparacao as bruta, linkPaginaAdversario, type TemaComparado } from '../../src/conteudo/comparacao.ts'
import { linkPagina, plano } from '../../src/conteudo/conteudo.ts'
import { preencherTudo, valoresDoModelo } from '../../src/conteudo/modelo.ts'
import { textos } from '../../src/conteudo/textos.ts'
import { NOMES } from '../../src/config.ts'
import { BlocoComparar } from '../../src/paginas/BlocoComparar.tsx'
import { comDados, prepararDom } from './apoio.tsx'

const t = textos.paginas.comparar
// O que a página mostra: os {{nomes}} preenchidos pela config.
const comparacao = preencherTudo(bruta, valoresDoModelo(candidatura, { geradoEm: null, urlPlano: plano.documento.url, exteriorAte: null }))

beforeEach(prepararDom)
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function bloco(tema: TemaComparado): HTMLElement {
  return screen.getByRole('region', { name: tema.titulo })
}

describe('BlocoComparar (Guia)', () => {
  it('um bloco por assunto, com os dois planos, o que há em comum e a diferença (nomes preenchidos)', () => {
    comDados(<BlocoComparar />)
    expect(screen.getByRole('heading', { level: 2, name: t.titulo })).toBeTruthy()
    for (const tema of comparacao.temas) {
      const b = bloco(tema)
      expect(within(b).getByRole('heading', { level: 3, name: tema.titulo })).toBeTruthy()
      expect(within(b).getByRole('heading', { level: 4, name: t.planoDe(NOMES.alvo) })).toBeTruthy()
      expect(within(b).getByRole('heading', { level: 4, name: t.planoDe(NOMES.adversario) })).toBeTruthy()
      expect(b.textContent).toContain(tema.alvo.resumo)
      expect(b.textContent).toContain(tema.adversario.resumo)
      expect(b.textContent).toContain(`${t.diferenca} ${tema.diferenca}`)
      expect(b.textContent).not.toContain('{{')
      if (tema.emComum === null) expect(b.textContent).not.toContain(t.emComum)
      else expect(b.textContent).toContain(`${t.emComum} ${tema.emComum}`)
    }
  })

  it('cada trecho leva à página do PDF do próprio plano, em nova aba e sem referrer', () => {
    comDados(<BlocoComparar />)
    for (const tema of comparacao.temas) {
      const links = within(bloco(tema)).getAllByRole('link')
      const hrefs = links.map((l) => l.getAttribute('href'))
      for (const c of tema.alvo.citacoes) expect(hrefs).toContain(linkPagina(c.pagina))
      for (const c of tema.adversario.citacoes) expect(hrefs).toContain(linkPaginaAdversario(c.pagina))
      expect(links).toHaveLength(tema.alvo.citacoes.length + tema.adversario.citacoes.length)
      for (const l of links) {
        expect(l.getAttribute('target')).toBe('_blank')
        expect(l.getAttribute('rel')).toContain('noopener')
      }
    }
  })

  it('o nome do link da página diz de qual plano ela é (leitor de tela)', () => {
    comDados(<BlocoComparar />)
    const [tema] = comparacao.temas
    if (tema === undefined) throw new Error('comparação sem assuntos')
    const [citacao] = tema.adversario.citacoes
    if (citacao === undefined) throw new Error('assunto sem trecho do adversário')
    // \s*: o cálculo de nome do jsdom junta o espaço do início do texto escondido; o navegador lê "p. N do plano...".
    const nome = new RegExp(`^${textos.paginas.plano.pagina(citacao.pagina)}\\s*${t.paginaComplemento(NOMES.adversario)}`)
    expect(within(bloco(tema)).getAllByRole('link', { name: nome }).length).toBeGreaterThan(0)
  })

  it('o índice leva a cada assunto, nas âncoras do Guia', () => {
    comDados(<BlocoComparar />)
    const indice = screen.getByRole('navigation', { name: t.indice })
    const hrefs = within(indice).getAllByRole('link').map((l) => l.getAttribute('href'))
    expect(hrefs).toEqual(comparacao.temas.map((tema) => `#/guia/comparar-${tema.chave}`))
    for (const tema of comparacao.temas) expect(document.getElementById(`guia-comparar-${tema.chave}`)).not.toBeNull()
  })
})
