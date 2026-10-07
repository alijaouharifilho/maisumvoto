// Guardas contra divergência silenciosa: paleta CSS × TS, cópia do MapLibre, metadados do index.html,
// estilo do mapa × CSP e a imagem de prévia (OG).
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { candidatura } from '../../nucleo/candidatura.ts'
import { textos } from '../../src/conteudo/textos.ts'
import { PALETA } from '../../src/estilo/paleta.ts'
import { VERSAO_MAPLIBRE } from '../../src/mapa/biblioteca.ts'
import { prepararEstilo } from '../../src/mapa/estilo.ts'
import { MARCADOR_DOMINIO } from '../../ferramentas/dominio-do-site.ts'

const RAIZ = join(import.meta.dirname, '..', '..')
const ler = (...p: string[]): string => readFileSync(join(RAIZ, ...p), 'utf8')

function oklchParaHex(l: number, c: number, h: number): string {
  const rad = (h * Math.PI) / 180
  const a = c * Math.cos(rad)
  const b = c * Math.sin(rad)
  const l3 = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m3 = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s3 = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const lin = [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ]
  const gama = (x: number): number => (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055)
  return `#${lin.map((x) => Math.round(Math.min(1, Math.max(0, gama(x))) * 255).toString(16).padStart(2, '0')).join('')}`
}

function canais(hex: string): number[] {
  return [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16))
}

const camelo = (s: string): string => s.replace(/-(\w)/g, (_, x: string) => x.toUpperCase()).replace(/-(\d)/g, '$1')

describe('paleta', () => {
  it('os tokens oklch do CSS e os hex de paleta.ts são a mesma cor (±2 por canal)', () => {
    const css = ler('src', 'estilo', 'tokens.css')
    const tokens = [...css.matchAll(/--color-([a-z0-9-]+):\s*oklch\(([\d.]+)%\s+([\d.]+)\s+([\d.]+)\)/g)]
    expect(tokens.length).toBeGreaterThanOrEqual(13)
    for (const [, nome = '', l = '0', c = '0', h = '0'] of tokens) {
      const chave = camelo(nome) as keyof typeof PALETA
      expect(PALETA[chave], nome).toBeDefined()
      const calculado = canais(oklchParaHex(Number(l) / 100, Number(c), Number(h)))
      canais(PALETA[chave]).forEach((v, i) => expect(Math.abs(v - (calculado[i] ?? -99)), `${nome} canal ${i}`).toBeLessThanOrEqual(2))
    }
  })

  it('pares de texto da paleta passam no contraste WCAG AA (4,5:1); o amarelo nunca é texto sobre claro', () => {
    const lum = (hex: string): number => {
      const [r = 0, g = 0, b = 0] = canais(hex).map((c) => c / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const contraste = (a: string, b: string): number => {
      const [claro = 0, escuro = 0] = [lum(a), lum(b)].sort((x, y) => y - x)
      return (claro + 0.05) / (escuro + 0.05)
    }
    const pares: [string, string, string][] = [
      ['tinta', 'fundo', 'texto'], ['tinta', 'branco', 'texto'], ['tintaSuave', 'fundo', 'texto secundário'],
      ['tintaSuave', 'branco', 'texto secundário'], ['marca', 'branco', 'link'], ['marca', 'fundo', 'link'],
      ['branco', 'marca', 'cabeçalho'], ['branco', 'marcaEscura', 'rodapé'], ['tinta', 'destaque', 'faixa e botão amarelos'],
      ['destaqueTexto', 'branco', 'cuidado'], ['destaqueTexto', 'destaqueClaro', 'cuidado na caixa amarela'],
      ['tinta', 'marcaClara', 'caixa azul-clara'], ['marca', 'marcaClara', 'número e aba atual'], ['alerta', 'branco', 'erro'],
    ]
    for (const [texto, fundo, uso] of pares) {
      const c = contraste(PALETA[texto as keyof typeof PALETA], PALETA[fundo as keyof typeof PALETA])
      expect(c, `${texto} sobre ${fundo} (${uso})`).toBeGreaterThanOrEqual(4.5)
    }
    expect(contraste(PALETA.destaque, PALETA.branco)).toBeLessThan(4.5)
  })

  it('o favicon usa só cores da paleta e o theme-color é a cor primária', () => {
    const svg = ler('public', 'favicon.svg')
    const cores = new Set<string>(Object.values(PALETA))
    for (const [, cor = ''] of svg.matchAll(/(?:fill|stroke)="(#[0-9a-f]{6})"/g)) expect(cores.has(cor), cor).toBe(true)
    expect(ler('index.html')).toContain(`<meta name="theme-color" content="${PALETA.marca}" />`)
  })
})

describe('MapLibre servido de public/', () => {
  const pacote = join(RAIZ, 'node_modules', 'maplibre-gl')
  const pasta = join(RAIZ, 'public', 'mapa', `maplibre-${VERSAO_MAPLIBRE}`)

  it('a versão do código bate com a do pacote instalado', () => {
    const versao = (JSON.parse(readFileSync(join(pacote, 'package.json'), 'utf8')) as { version: string }).version
    expect(VERSAO_MAPLIBRE, 'atualize VERSAO_MAPLIBRE e copie de novo os .mjs de node_modules/maplibre-gl/dist').toBe(versao)
  })

  it('cada .mjs é a cópia do pacote (sem o cabeçalho do lint e sem a linha do sourcemap)', () => {
    const resumo = (texto: string): string =>
      createHash('sha256')
        .update(texto.replace(/^\/\/# sourceMappingURL=.*$/m, '').trimEnd())
        .digest('hex')
    for (const nome of ['maplibre-gl.mjs', 'maplibre-gl-shared.mjs', 'maplibre-gl-worker.mjs']) {
      const copia = readFileSync(join(pasta, nome), 'utf8').replace(/^\/\* oxlint-disable[^\n]*\n/, '')
      const original = readFileSync(join(pacote, 'dist', nome), 'utf8')
      expect(resumo(copia), nome).toBe(resumo(original))
    }
    expect(existsSync(join(pasta, 'LICENSE.txt'))).toBe(true)
  })

  it('não sobrou cópia de versão antiga em public/mapa', () => {
    const versoes = readdirSync(join(RAIZ, 'public', 'mapa')).filter((n) => n.startsWith('maplibre-'))
    expect(versoes).toEqual([`maplibre-${VERSAO_MAPLIBRE}`])
  })
})

describe('index.html', () => {
  const html = ler('index.html')
  const meta = (atributo: string, nome: string): string | undefined =>
    new RegExp(`<meta ${atributo}="${nome}" content="([^"]*)"`).exec(html)?.[1]
  const site = candidatura.site

  it('título e prévia vêm dos textos do conteúdo (sem nome de candidato no HTML estático)', () => {
    expect(html).toContain('<html lang="pt-BR">')
    expect(/<title>([^<]*)<\/title>/.exec(html)?.[1]).toBe(textos.meta.titulo(site.nome))
    expect(meta('name', 'description')).toBe(textos.meta.ogDescricao)
    expect(meta('property', 'og:title')).toBe(textos.meta.ogTitulo(site.nome))
    expect(meta('property', 'og:description')).toBe(textos.meta.ogDescricao)
    expect(meta('property', 'og:image:alt')).toBe(textos.meta.ogImagemAlt)
    // O domínio entra no build (ferramentas/dominio-do-site.ts): o da Vercel em produção, o da config fora dela.
    expect(meta('property', 'og:image')).toBe(`https://${MARCADOR_DOMINIO}/og.png`)
    expect(meta('property', 'og:url')).toBe(`https://${MARCADOR_DOMINIO}/`)
    expect(meta('property', 'og:site_name')).toBe(site.nome)
  })

  it('nada de terceiros, script ou estilo inline (a CSP bloquearia)', () => {
    expect(html).not.toMatch(/googletagmanager|gtag\(|google-analytics/i)
    const scripts = [...html.matchAll(/<script\b([^>]*)>/g)].map((m) => m[1] ?? '')
    expect(scripts.every((a) => /\bsrc="\/src\/main\.tsx"/.test(a))).toBe(true)
    expect(html).not.toMatch(/<style\b|\sstyle=/i)
    expect(html).toContain('viewport-fit=cover')
    expect(html).toContain('<div id="raiz"></div>')
  })
})

describe('estilo do mapa', () => {
  const estilo = JSON.parse(ler('public', 'mapa', 'estilo.json')) as Record<string, unknown>
  const csp = (JSON.parse(ler('deploy', 'cabecalhos-seguranca.json')) as Record<string, string>)['Content-Security-Policy'] ?? ''
  const permitidos = (/connect-src ([^;]+)/.exec(csp)?.[1] ?? '').split(' ').filter((x) => x.startsWith('https://'))

  it('o que o navegador baixa pelo estilo (glifos, sprites, fontes de tiles) está num host liberado pela CSP', () => {
    const fontes = Object.values(estilo.sources as Record<string, { url?: string; tiles?: string[] }>)
    const baixados = [
      String(estilo.glyphs),
      String(estilo.sprite),
      ...fontes.flatMap((f) => [...(f.url === undefined ? [] : [f.url]), ...(f.tiles ?? [])]),
      candidatura.mapa.fonteTiles,
    ]
    expect(permitidos.length).toBeGreaterThan(0)
    for (const u of baixados) expect(permitidos.some((p) => u.startsWith(p)), u).toBe(true)
  })

  it('rótulos do mapa em português: nome em pt (name:pt), senão o nome local; nunca o inglês (name_en)', () => {
    const camadas = estilo.layers as { id: string; layout?: Record<string, unknown> }[]
    const rotulos = camadas.filter((c) => c.layout?.['text-field'] !== undefined && /name/.test(JSON.stringify(c.layout['text-field'])))
    expect(rotulos.length).toBeGreaterThan(10)
    for (const c of rotulos) {
      const campo = JSON.stringify(c.layout?.['text-field'])
      expect(campo, c.id).not.toContain('name_en')
      expect(campo, c.id).toContain('["coalesce",["get","name:pt"],["get","name"]]')
    }
  })

  it('a fonte vetorial passa a ser a da config, e a atribuição do mapa fica visível', () => {
    const pronto = prepararEstilo(estilo, 'https://exemplo.test/tiles')
    const fonte = pronto.sources.openmaptiles as { url?: string; attribution?: string }
    expect(fonte.url).toBe('https://exemplo.test/tiles')
    expect(fonte.attribution).toMatch(/OpenStreetMap/)
    expect(fonte.attribution).toMatch(/OpenMapTiles/)
    expect(fonte.attribution).toMatch(/OpenFreeMap/)
    expect(() => prepararEstilo({ version: 7 }, 'x')).toThrow()
  })
})

describe('imagem de prévia (og.png)', () => {
  it('existe e tem 1200×630', () => {
    const png = readFileSync(join(RAIZ, 'public', 'og.png'))
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(1200)
    expect(png.readUInt32BE(20)).toBe(630)
  })
})

describe('prévia de link (robôs não rodam JS)', () => {
  it('a descrição estática diz que o site é de apoio e não é oficial, sem nome de candidato', () => {
    expect(textos.meta.ogDescricao).toMatch(/de apoio/)
    expect(textos.meta.ogDescricao).toMatch(/não é oficial/)
    expect(textos.meta.ogDescricao).not.toContain(candidatura.alvo.nomeCurto)
  })
})
