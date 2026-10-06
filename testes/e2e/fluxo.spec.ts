// Fluxo principal contra o build de produção (vite preview, porta 5151), com a CSP do deploy aplicada:
// abrir → buscar uma cidade real → ver o número → abrir a Ficha → Esc fecha → link de compartilhar arredondado,
// sem erro de console. Sem public/dados (ETL não rodou), o fluxo com dados é pulado com aviso claro.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test, type ConsoleMessage, type Page } from '@playwright/test'
import { textos } from '../../src/conteudo/textos.ts'

const RAIZ = join(import.meta.dirname, '..', '..')
const TEM_DADOS = existsSync(join(RAIZ, 'public', 'dados', 'indice.json'))
const AVISO_SEM_DADOS =
  'public/dados/indice.json não existe: rode `npm run dados` e depois `npm run build` para testar o fluxo com dados reais.'
const CSP = (JSON.parse(readFileSync(join(RAIZ, 'deploy', 'cabecalhos-seguranca.json'), 'utf8')) as Record<string, string>)[
  'Content-Security-Policy'
]
const cfg = JSON.parse(readFileSync(join(RAIZ, 'config', 'candidatura.json'), 'utf8')) as {
  site: { nome: string }
  alvo: { nomeCurto: string }
  adversario: { nomeCurto: string }
}
const RE_LINK = /#\/mapa\/@(-?\d{1,2}\.\d{3}),(-?\d{1,2}\.\d{3})$/

/** Mesma CSP da produção no documento: script/estilo inline ou host não liberado aparecem como erro de console. */
async function aplicarCsp(page: Page): Promise<void> {
  await page.route(/^http:\/\/127\.0\.0\.1:5151\//, async (rota) => {
    if (rota.request().resourceType() !== 'document') return rota.fallback()
    const resposta = await rota.fetch()
    return rota.fulfill({ response: resposta, headers: { ...resposta.headers(), 'content-security-policy': CSP ?? '' } })
  })
}

/** Erros de console, menos o 404 esperado de quadradinho de dados vazio (o carregador trata 404 como "sem regiões"). */
function vigiarConsole(page: Page): string[] {
  const erros: string[] = []
  const esperado = (m: ConsoleMessage): boolean =>
    /status of 404/.test(m.text()) && /\/dados\/(celulas|pontos|busca|cep)\//.test(m.location().url)
  page.on('console', (m) => {
    if (m.type() === 'error' && !esperado(m)) erros.push(`${m.text()} @ ${m.location().url}`)
  })
  page.on('pageerror', (e) => erros.push(e.message))
  return erros
}

function naGrade(valor: string): boolean {
  return Math.round(Math.abs(Number(valor)) * 1000) % 5 === 0
}

async function buscarCuritiba(page: Page): Promise<void> {
  await page.getByRole('searchbox', { name: textos.busca.rotulo }).fill('Curitiba')
  await page.getByRole('button', { name: textos.busca.buscar, exact: true }).click()
  const opcao = page.getByRole('button', { name: 'Curitiba – PR', exact: true })
  const resultado = page.getByText(textos.busca.origem.link, { exact: true }).or(page.getByText('Curitiba – PR', { exact: true }))
  await expect(opcao.or(resultado).first()).toBeVisible({ timeout: 20_000 })
  if (await opcao.isVisible()) await opcao.click()
}

test.describe('fluxo com dados reais', () => {
  test.skip(!TEM_DADOS, AVISO_SEM_DADOS)

  test('buscar, ver o número, abrir a Ficha, Esc fecha e o link sai arredondado', async ({ page }, info) => {
    const erros = vigiarConsole(page)
    await aplicarCsp(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1, name: textos.abertura.titulo(cfg.site.nome) })).toBeVisible()
    await expect(page.getByText(textos.abertura.brasilAte)).toBeVisible({ timeout: 20_000 })

    await buscarCuritiba(page)
    await expect(page).toHaveURL(RE_LINK, { timeout: 20_000 })
    const [, lat = '', lon = ''] = RE_LINK.exec(page.url()) ?? []
    expect(naGrade(lat) && naGrade(lon), `âncora fora da grade: ${lat},${lon}`).toBe(true)

    const manchete = page.getByRole('heading', { level: 2, name: new RegExp(textos.resultado.manchete(2).antes) })
    await expect(manchete).toBeVisible({ timeout: 20_000 })
    const numero = Number(((await manchete.textContent()) ?? '').replace(/\D/g, ''))
    expect(numero).toBeGreaterThan(0)

    const lista = page.getByRole('list', { name: textos.acessibilidade.lista })
    const primeiro = lista.getByRole('button').first()
    await primeiro.click()
    const ficha = page.getByRole('dialog')
    await expect(ficha).toBeVisible()
    await expect(ficha).toHaveAttribute('aria-modal', info.project.name === 'celular' ? 'true' : 'false')
    await expect(page.getByRole('button', { name: textos.ficha.fecharAria })).toBeFocused()
    // Com a Ficha aberta, o painel de baixo sai do Tab e do leitor de tela (inert).
    await expect(page.locator('[inert] input[type="search"]')).toHaveCount(1)
    await page.keyboard.press('Shift+Tab')
    // O foco não volta para trás da ficha (desktop: vai para o cabeçalho; celular: fica preso na ficha).
    expect(await page.evaluate(() => document.activeElement !== null && document.activeElement.closest('[inert]') === null)).toBe(true)
    await page.keyboard.press('Escape')
    await expect(ficha).toBeHidden()
    await expect(primeiro).toBeFocused()

    const whatsapp = page.locator('a[href^="https://wa.me/?text="]')
    const mensagem = decodeURIComponent((await whatsapp.getAttribute('href'))?.slice('https://wa.me/?text='.length) ?? '')
    expect(mensagem).toContain(`/#/mapa/@${lat},${lon}`)
    expect(erros, erros.join('\n')).toEqual([])
  })

  test('cidade cujo prefixo é nome reservado do Windows ("con" de Contagem) também é achada', async ({ page }) => {
    const erros = vigiarConsole(page)
    await page.goto('/')
    await page.getByRole('searchbox', { name: textos.busca.rotulo }).fill('Contagem')
    await page.getByRole('button', { name: textos.busca.buscar, exact: true }).click()
    await expect(page.getByText(/Contagem – MG/).first()).toBeVisible({ timeout: 20_000 })
    expect(erros, erros.join('\n')).toEqual([])
  })

  test('"bairro cidade" sem vírgula vai direto ao bairro e o foco cai na manchete', async ({ page }) => {
    const erros = vigiarConsole(page)
    await aplicarCsp(page)
    await page.goto('/')
    await expect(page.getByText(textos.abertura.brasilAte)).toBeVisible({ timeout: 20_000 })
    await page.getByRole('searchbox', { name: textos.busca.rotulo }).fill('Batel Curitiba')
    await page.getByRole('button', { name: textos.busca.buscar, exact: true }).click()
    await expect(page.getByText('Batel, Curitiba – PR', { exact: true })).toBeVisible({ timeout: 20_000 })
    const manchete = page.getByRole('heading', { level: 2, name: new RegExp(textos.resultado.manchete(2).antes) })
    await expect(manchete).toBeFocused({ timeout: 20_000 })
    await expect(page.locator('output.sr-only').filter({ hasText: 'Batel, Curitiba – PR' })).toHaveCount(1)
    expect(erros, erros.join('\n')).toEqual([])
  })

  test('celular 390×844: a busca aparece na primeira tela, sem rolar', async ({ page }, info) => {
    test.skip(info.project.name !== 'celular', 'medida da primeira tela do celular')
    const erros = vigiarConsole(page)
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    // Com os números do país já na tela: são eles que empurram a busca para baixo.
    await expect(page.getByText(textos.abertura.brasilAte)).toBeVisible({ timeout: 20_000 })
    const campo = page.getByRole('searchbox', { name: textos.busca.rotulo })
    const botao = page.getByRole('button', { name: textos.busca.buscar, exact: true })
    for (const el of [campo, botao]) {
      const caixa = await el.boundingBox()
      expect(caixa, 'elemento da busca sem caixa').not.toBeNull()
      expect((caixa?.y ?? 0) + (caixa?.height ?? 0), 'busca abaixo da primeira tela').toBeLessThanOrEqual(844)
    }
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '24px')
    expect(erros, erros.join('\n')).toEqual([])
  })

  test('o mapa abre, um toque escolhe o ponto, e cruzar 960 px não remonta o mapa', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'o teste de largura usa a janela do desktop')
    const erros = vigiarConsole(page)
    await aplicarCsp(page)
    await page.goto('/#/mapa/@-25.430,-49.275')
    const canvas = page.locator('canvas.maplibregl-canvas')
    await expect(canvas).toBeVisible({ timeout: 30_000 })
    // Botões de zoom do MapLibre com rótulo em português (opção locale), e a abertura no tamanho cheio do desktop.
    await expect(page.getByRole('button', { name: textos.mapa.controles.aproximar, exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: textos.mapa.controles.afastar, exact: true })).toBeVisible()
    await expect(page.locator('button[title="Zoom in"], button[aria-label="Zoom in"]')).toHaveCount(0)
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-size', '36px')
    await page.evaluate(() => {
      const el = document.querySelector('canvas.maplibregl-canvas')
      Object.assign(window, { canvasOriginal: el })
    })
    await page.setViewportSize({ width: 600, height: 900 })
    await expect(canvas).toBeVisible()
    await page.setViewportSize({ width: 1280, height: 800 })
    const mesmo = await page.evaluate(() => document.querySelector('canvas.maplibregl-canvas') === Reflect.get(window, 'canvasOriginal'))
    expect(mesmo).toBe(true)
    // Espera a câmera terminar de voar até o ponto: um clique no meio do voo só interrompe a animação.
    await expect(page.getByText(textos.busca.origem.link, { exact: true })).toBeVisible({ timeout: 20_000 })
    await page.waitForTimeout(2_500)
    const caixa = await canvas.boundingBox()
    expect(caixa).not.toBeNull()
    // Longe do raio (centro) e da atribuição (canto de baixo): um toque no mapa vazio escolhe outro ponto.
    await canvas.click({ position: { x: (caixa?.width ?? 0) * 0.9, y: (caixa?.height ?? 0) * 0.15 } })
    await expect(page.getByText(textos.busca.origem.mapa, { exact: true })).toBeVisible({ timeout: 20_000 })
    expect(erros, erros.join('\n')).toEqual([])
  })

  test('link de outro ponto colado com o site aberto em outra página troca o ponto', async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'comportamento de hash, igual nos dois')
    const erros = vigiarConsole(page)
    const numero = page.locator('h2 .sr-only')
    // Número de referência: o link de São Paulo aberto do zero.
    await page.goto('/#/mapa/@-23.550,-46.635')
    await expect(numero).toBeVisible({ timeout: 20_000 })
    const deSaoPaulo = await numero.textContent()
    // Curitiba → Sobre → link de São Paulo (troca de hash no mesmo documento, como colar o link na barra).
    await page.goto('/#/mapa/@-25.430,-49.275')
    await expect(numero).not.toHaveText(deSaoPaulo ?? '', { timeout: 20_000 })
    await page.goto('/#/sobre')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await page.goto('/#/mapa/@-23.550,-46.635')
    await expect(page).toHaveURL(/#\/mapa\/@-23\.550,-46\.635$/)
    await expect(numero).toHaveText(deSaoPaulo ?? '', { timeout: 20_000 })
    await expect(page).toHaveURL(/#\/mapa\/@-23\.550,-46\.635$/)
    expect(erros, erros.join('\n')).toEqual([])
  })
})

test('dia da votação: só o aviso estático, sem busca, mapa ou compartilhar', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-25T10:00:00-03:00'))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: textos.diaDaVotacao.titulo })).toBeVisible()
  await expect(page.getByRole('searchbox')).toHaveCount(0)
  await expect(page.locator('a[href^="https://wa.me/"]')).toHaveCount(0)
  await expect(page.locator('canvas.maplibregl-canvas')).toHaveCount(0)
})

test('plano: um cartão por proposta, com número, fonte e pergunta; o trecho literal abre com link para a página', async ({ page }) => {
  const erros = vigiarConsole(page)
  await aplicarCsp(page)
  const plano = JSON.parse(readFileSync(join(RAIZ, 'src', 'conteudo', 'plano.json'), 'utf8')) as {
    capitulos: { propostas: { titulo: string; pagina: number; dado: { numero: string } | null }[] }[]
  }
  const propostas = plano.capitulos.flatMap((c) => c.propostas)
  const primeira = propostas[0]
  if (primeira === undefined) throw new Error('plano sem propostas')

  await page.goto('/#/plano')
  await expect(page.getByRole('heading', { level: 1, name: textos.paginas.plano.titulo(cfg.alvo.nomeCurto) })).toBeVisible()
  await expect(page.getByRole('button', { name: textos.paginas.plano.copiar })).toHaveCount(propostas.length)

  const cartao = page.getByRole('article', { name: primeira.titulo })
  await expect(cartao.getByText(primeira.dado?.numero ?? '', { exact: true })).toBeVisible()
  await cartao.getByText(textos.paginas.plano.oQueOPlanoDiz(primeira.pagina)).click()
  const link = cartao.getByRole('link', { name: new RegExp(`^${textos.paginas.plano.pagina(primeira.pagina)}`) })
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute('href', new RegExp(`#page=${primeira.pagina}$`))
  expect(erros, erros.join('\n')).toEqual([])
})

test('comparar: a aba do plano leva à comparação, com os dois lados de cada assunto e o link da página de cada PDF', async ({ page }) => {
  const erros = vigiarConsole(page)
  await aplicarCsp(page)
  const comparacao = JSON.parse(readFileSync(join(RAIZ, 'src', 'conteudo', 'comparacao.json'), 'utf8')) as {
    documentoAdversario: { url: string }
    temas: { titulo: string; adversario: { citacoes: { pagina: number }[] } }[]
  }
  const [tema] = comparacao.temas
  const [citacao] = tema?.adversario.citacoes ?? []
  if (tema === undefined || citacao === undefined) throw new Error('comparação sem assunto ou sem trecho')

  await page.goto('/#/plano')
  await page.getByRole('link', { name: textos.paginas.abasPlano.comparar }).click()
  await expect(page).toHaveURL(/#\/comparar$/)
  await expect(page.getByRole('heading', { level: 1, name: textos.paginas.comparar.titulo })).toBeVisible()
  await expect(page.getByRole('region')).toHaveCount(comparacao.temas.length)

  const bloco = page.getByRole('region', { name: tema.titulo })
  const nome = `${textos.paginas.plano.pagina(citacao.pagina)} ${textos.paginas.comparar.paginaComplemento(cfg.adversario.nomeCurto)}`
  const link = bloco.getByRole('link', { name: new RegExp(`^${nome}`) }).first()
  await expect(link).toHaveAttribute('href', `${comparacao.documentoAdversario.url}#page=${citacao.pagina}`)
  expect(erros, erros.join('\n')).toEqual([])
})
