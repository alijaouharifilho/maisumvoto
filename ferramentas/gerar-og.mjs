// Gera public/og.png (1200×630), a prévia do link no WhatsApp e nas redes.
//   node ferramentas/gerar-og.mjs
// Renderiza um HTML local com a identidade do site no Chromium do Playwright (nada sai da máquina).
// Textos e cores vêm do conteúdo e da config: nenhum nome escrito aqui. Sem foto nem logo de candidato.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const RAIZ = fileURLToPath(new URL('..', import.meta.url))
const SAIDA = join(RAIZ, 'public', 'og.png')
const LARGURA = 1200
const ALTURA = 630

const { textos, dia } = await import(new URL('../src/conteudo/textos.ts', import.meta.url).href)
const { PALETA: P } = await import(new URL('../src/estilo/paleta.ts', import.meta.url).href)
const cfg = JSON.parse(readFileSync(join(RAIZ, 'config', 'candidatura.json'), 'utf8'))

function fonteBase64(pacote, arquivo) {
  return readFileSync(join(RAIZ, 'node_modules', '@fontsource-variable', pacote, 'files', arquivo)).toString('base64')
}

function escapar(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

/** Pontinhos de "densidade" ao fundo: decorativos, posições pseudoaleatórias fixas (imagem estável). */
function pontinhos() {
  let semente = 7
  const aleatorio = () => {
    semente = (semente * 16807) % 2147483647
    return semente / 2147483647
  }
  return Array.from({ length: 260 }, () => {
    const x = Math.round(770 + aleatorio() * 410)
    const y = Math.round(20 + aleatorio() * 420)
    const r = (1.5 + aleatorio() * 2.5).toFixed(1)
    return `<circle cx="${x}" cy="${y}" r="${r}" fill="${P.mata}" opacity="${(0.25 + aleatorio() * 0.45).toFixed(2)}"/>`
  }).join('')
}

function html() {
  const titulo = textos.meta.ogTitulo(cfg.site.nome)
  const chamada = titulo.includes(': ') ? titulo.slice(titulo.indexOf(': ') + 2) : titulo
  const apoiado = { nome: cfg.alvo.nomeCurto, numero: cfg.alvo.numero }
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
@font-face { font-family: Bricolage; src: url(data:font/woff2;base64,${fonteBase64('bricolage-grotesque', 'bricolage-grotesque-latin-wght-normal.woff2')}) format('woff2'); font-weight: 200 800; }
@font-face { font-family: Atkinson; src: url(data:font/woff2;base64,${fonteBase64('atkinson-hyperlegible-next', 'atkinson-hyperlegible-next-latin-wght-normal.woff2')}) format('woff2'); font-weight: 200 800; }
* { margin: 0; box-sizing: border-box; }
body { width: ${LARGURA}px; height: ${ALTURA}px; background: ${P.papel}; color: ${P.tinta}; font-family: Atkinson, sans-serif; position: relative; overflow: hidden; }
.fundo { position: absolute; inset: 0; }
.conteudo { position: absolute; left: 72px; top: 64px; width: 700px; display: flex; flex-direction: column; gap: 22px; }
.selo { align-self: flex-start; background: ${P.petroleo}; color: ${P.branco}; font-weight: 700; font-size: 26px; padding: 8px 20px; border-radius: 999px; }
h1 { font-family: Bricolage, sans-serif; font-weight: 800; font-size: 104px; line-height: 0.95; letter-spacing: -1px; }
.chamada { font-family: Bricolage, sans-serif; font-weight: 700; font-size: 44px; color: ${P.mata}; }
.descricao { font-size: 28px; line-height: 1.3; color: ${P.tintaSuave}; max-width: 680px; }
.icone { position: absolute; right: 120px; top: 150px; width: 300px; height: 300px; }
.rodape { position: absolute; left: 0; right: 0; bottom: 0; background: ${P.mataClara}; padding: 22px 72px; font-size: 24px; font-weight: 700; }
</style></head><body>
<svg class="fundo" viewBox="0 0 ${LARGURA} ${ALTURA}" aria-hidden="true">${pontinhos()}</svg>
<svg class="icone" viewBox="0 0 32 32" aria-hidden="true">
<path d="M9 3h14a7 7 0 0 1 7 7v7a7 7 0 0 1-7 7H14l-6 6v-6.2A7 7 0 0 1 2 17v-7a7 7 0 0 1 7-7z" fill="${P.mata}"/>
<path d="M16 5.6c-3.3 0-5.9 2.6-5.9 5.8 0 4.2 5.9 9.4 5.9 9.4s5.9-5.2 5.9-9.4c0-3.2-2.6-5.8-5.9-5.8z" fill="${P.ambar}" stroke="${P.tinta}" stroke-width="1.1" stroke-linejoin="round"/>
<circle cx="16" cy="11.4" r="2.1" fill="${P.papel}" stroke="${P.tinta}" stroke-width="0.9"/></svg>
<div class="conteudo">
<p class="selo">${escapar(textos.abertura.selo(dia(cfg.eleicao.data2T)))}</p>
<h1>${escapar(cfg.site.nome)}</h1>
<p class="chamada">${escapar(chamada)}</p>
<p class="descricao">${escapar(textos.meta.ogDescricao)}</p>
</div>
<p class="rodape">${escapar(textos.rodape.natureza(apoiado))}</p>
</body></html>`
}

async function principal() {
  const navegador = await chromium.launch()
  try {
    const pagina = await navegador.newPage({ viewport: { width: LARGURA, height: ALTURA }, deviceScaleFactor: 1 })
    await pagina.setContent(html(), { waitUntil: 'load' })
    await pagina.evaluate(() => document.fonts.ready)
    await pagina.screenshot({ path: SAIDA, type: 'png' })
    console.warn(`og.png gerada em ${SAIDA}`)
  } finally {
    await navegador.close()
  }
}

principal().catch((erro) => {
  console.error('Falha ao gerar a og.png:', erro)
  process.exit(1)
})
