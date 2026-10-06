// Partes puras do mapa: marcadores, quadrados visíveis, densidade (sem MapLibre nem WebGL).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { haversineKm } from '../../nucleo/geo.ts'
import { featuresRegioes, foraDoRaio, quadradosNaCaixa, type Marcador, type PontoLatLon } from '../../src/mapa/camadas.ts'
import { Densidade, type Desenhar } from '../../src/mapa/densidade.ts'
import { PALETA } from '../../src/estilo/paleta.ts'
import { raioMarcador, SIMBOLOGIA } from '../../src/mapa/simbologia.ts'
import { localeDoMapa } from '../../src/mapa/rotulos.ts'
import { textos } from '../../src/conteudo/textos.ts'

beforeEach(() => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0))
})
afterEach(() => vi.unstubAllGlobals())

function luminancia(hex: string): number {
  const canais = [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = canais.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contraste(a: string, b: string): number {
  const [claro, escuro] = [luminancia(a), luminancia(b)].sort((x, y) => y - x)
  return ((claro ?? 0) + 0.05) / ((escuro ?? 0) + 0.05)
}

describe('marcadores', () => {
  const marcadores: Marcador[] = [
    { id: 'a', lat: -25.43, lon: -49.27, ate: 400, classe: 'aVirar' },
    { id: 'b', lat: -25.431, lon: -49.271, ate: 100, classe: 'folga' },
    { id: 'c', lat: -25.432, lon: -49.272, ate: 0, classe: 'semResultado' },
  ]

  it('raio de 9 a 23 px, proporcional à raiz do "até"; sem resultado fica pequeno e vazado', () => {
    const f = featuresRegioes(marcadores, null).features.map((x) => x.properties)
    expect(f[0]?.raio).toBe(23)
    expect(f[1]?.raio).toBeCloseTo(raioMarcador(100, 400))
    expect(f[2]?.raio).toBe(5.5)
    expect(f[0]?.centro).toBe(true)
    expect(f[1]?.centro).toBe(false)
  })

  it('o selecionado é desenhado por último', () => {
    const f = featuresRegioes(marcadores, 'b').features.map((x) => x.properties)
    expect(f[1]?.selecionada).toBe(true)
    expect(Math.max(...f.map((p) => p.ordem))).toBe(f[1]?.ordem)
  })

  it('cada classe se distingue por algo além da cor (cheio/vazado, ponto central ou espessura)', () => {
    // "Cheio" só se o preenchimento se destaca do papel (contraste ≥ 1,5:1): o verde-claro da folga (1,16:1) é vazado.
    const assinaturas = Object.values(SIMBOLOGIA).map((s) => `${contraste(s.preenchimento, PALETA.papel) >= 1.5 ? 'cheio' : 'vazado'}|${s.centro}|${s.largura}`)
    expect(new Set(assinaturas).size).toBe(assinaturas.length)
  })

  it('folga e difícil (classes opostas) diferem na forma: contorno com pelo menos 1 px de diferença', () => {
    expect(Math.abs(SIMBOLOGIA.folga.largura - SIMBOLOGIA.dificil.largura)).toBeGreaterThanOrEqual(1)
  })
})

describe('quadrados e densidade', () => {
  it('lista os quadrados de 1° que tocam a caixa com folga', () => {
    expect(quadradosNaCaixa({ oeste: -49.4, sul: -25.6, leste: -49.1, norte: -25.3 })).toEqual(['-26_-50'])
    expect(quadradosNaCaixa({ oeste: -50.1, sul: -26.1, leste: -49.9, norte: -25.9 }, 0)).toEqual(['-27_-51', '-27_-50', '-26_-51', '-26_-50'])
    expect(quadradosNaCaixa({ oeste: -80, sul: -40, leste: 0, norte: 10 })).toEqual([])
  })

  it('esconde os pontos do raio com a mesma haversine da lista', () => {
    const centro = { lat: -25.43, lon: -49.27 }
    const pontos: PontoLatLon[] = [
      [-25.43, -49.27],
      [-25.435, -49.27],
      [-25.45, -49.27],
    ]
    const fora = foraDoRaio(pontos, centro, 1)
    expect(fora).toEqual([[-25.45, -49.27]])
    expect(fora.every((p) => haversineKm(centro, p) > 1)).toBe(true)
  })

  it('pede só os quadrados que existem, uma vez cada, e desenha os pontos fora do raio', async () => {
    const desenhos: Parameters<Desenhar>[] = []
    const d = new Densidade(1, (qual, dados) => desenhos.push([qual, dados]))
    const quadrado = vi.fn(async (): Promise<readonly PontoLatLon[]> => [
      [-25.43, -49.27],
      [-25.5, -49.3],
    ])
    d.usarFonte({ resumo: async () => [], quadrado, existe: (c) => c === '-26_-50' })
    d.definirCentro({ lat: -25.43, lon: -49.27 })
    const caixa = { oeste: -49.4, sul: -25.6, leste: -49.1, norte: -25.3 }
    d.atualizar(14, caixa)
    d.atualizar(14, caixa)
    await vi.waitFor(() => expect(desenhos.length).toBeGreaterThan(0))
    expect(quadrado).toHaveBeenCalledTimes(1)
    const [qual, dados] = desenhos.at(-1) ?? []
    expect(qual).toBe('quadrados')
    expect(dados?.features.map((f) => f.geometry.coordinates)).toEqual([[-49.3, -25.5]])
  })

  it('em zoom baixo usa o resumo, pedido uma vez só', async () => {
    const desenhos: Parameters<Desenhar>[] = []
    const d = new Densidade(1, (qual, dados) => desenhos.push([qual, dados]))
    const resumo = vi.fn(async (): Promise<readonly PontoLatLon[]> => [[-25, -50]])
    d.usarFonte({ resumo, quadrado: async () => [], existe: () => true })
    d.atualizar(4, { oeste: -60, sul: -30, leste: -40, norte: -10 })
    d.atualizar(5, { oeste: -60, sul: -30, leste: -40, norte: -10 })
    await vi.waitFor(() => expect(desenhos).toHaveLength(1))
    expect(resumo).toHaveBeenCalledTimes(1)
    expect(desenhos[0]?.[0]).toBe('resumo')
  })
})

describe('textos do MapLibre em português', () => {
  // Chaves do default_locale da versão instalada: chave inexistente faria o botão continuar em inglês, calado.
  const fonte = readFileSync(join(import.meta.dirname, '..', '..', 'node_modules', 'maplibre-gl', 'dist', 'maplibre-gl-dev.mjs'), 'utf8')
  const bloco = /const defaultLocale = \{([\s\S]*?)\n\};/.exec(fonte)?.[1] ?? ''
  const padrao = Object.fromEntries([...bloco.matchAll(/"([\w.]+)":\s*"([^"]*)"/g)].map((m) => [m[1] ?? '', m[2] ?? '']))

  it('cada chave usada existe no MapLibre instalado', () => {
    expect(Object.keys(padrao).length).toBeGreaterThan(10)
    for (const chave of Object.keys(localeDoMapa())) expect(padrao, chave).toHaveProperty(chave)
  })

  it('botões de zoom e créditos com rótulo em português (nunca o texto padrão em inglês)', () => {
    const locale = localeDoMapa()
    expect(locale['NavigationControl.ZoomIn']).toBe(textos.mapa.controles.aproximar)
    expect(locale['NavigationControl.ZoomOut']).toBe(textos.mapa.controles.afastar)
    expect(locale['AttributionControl.ToggleAttribution']).toBe(textos.mapa.controles.creditos)
    for (const [chave, valor] of Object.entries(locale)) expect(valor, chave).not.toBe(padrao[chave])
  })
})
