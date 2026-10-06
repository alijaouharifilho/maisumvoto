// Conteúdo editorial: frases sem buraco, modelos {{chave}} completos, roteiros e plano coerentes com a config,
// markdown seguro e datas por extenso. Os .md são lidos do disco (o "?raw" do Vite não existe no tsc do Node).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { candidatura } from '../nucleo/candidatura.ts'
import type { Classificacao, RegraViravel } from '../nucleo/tipos.ts'
import { lerEmLinha, lerMarkdown, type Bloco, type Trecho } from '../src/conteudo/markdown.ts'
import {
  CHAVES_MODELO,
  chavesDesconhecidas,
  fimConversa,
  preencherModelo,
  preencherTudo,
  valoresDoModelo,
  type ValoresModelo,
} from '../src/conteudo/modelo.ts'
import { comparacao } from '../src/conteudo/comparacao.ts'
import planoJson from '../src/conteudo/plano.json' with { type: 'json' }
import roteirosJson from '../src/conteudo/roteiros.json' with { type: 'json' }
import { dataHora, dia, prazo, textos } from '../src/conteudo/textos.ts'

const CONTEUDO = join(import.meta.dirname, '..', 'src', 'conteudo')
const MARKDOWN = { sobre: lerArquivo('sobre.md'), privacidade: lerArquivo('privacidade.md') }
const CLASSES: readonly Classificacao[] = ['semVotos', 'empate', 'folga', 'aDefender', 'alvoNaFrente', 'aVirar', 'dificil']
const REGRAS: readonly RegraViravel[] = ['abertos', 'abertosMaisOutros']
const NOMES = { alvo: candidatura.alvo.nomeCurto, adversario: candidatura.adversario.nomeCurto }
// Sinais de texto mal montado: valor ausente, conta inválida, chave de modelo sem preencher, objeto virando texto.
const BURACO = /undefined|NaN|\{\{|\}\}|\[object|null/
const MVP = ['abstencao', 'branco', 'nulo']

type FichaJson = { readonly status: string }
const fichas: Readonly<Record<string, FichaJson>> = roteirosJson.fichas

function lerArquivo(nome: string): string {
  return readFileSync(join(CONTEUDO, nome), 'utf8')
}

function valores(geradoEm: string | null = '2026-10-06T12:00:00Z'): ValoresModelo {
  return valoresDoModelo(candidatura, { geradoEm, urlPlano: planoJson.documento.url, exteriorAte: 614_824 })
}

/** Todas as strings de um JSON (valores, não chaves). */
function textosDe(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor]
  if (Array.isArray(valor)) return valor.flatMap(textosDe)
  if (valor !== null && typeof valor === 'object') return Object.values(valor).flatMap(textosDe)
  return []
}

function textoDosTrechos(trechos: readonly Trecho[]): string {
  return trechos.map((t) => t.texto).join('')
}

function textoDoBloco(b: Bloco): string {
  if (b.tipo === 'lista') return b.itens.map(textoDosTrechos).join(' ')
  return textoDosTrechos(b.conteudo)
}

describe('frases da disputa', () => {
  const casos = [
    { votosAlvo: 0, votosAdversario: 0, reservatorio: 0 },
    { votosAlvo: 1, votosAdversario: 1, reservatorio: 1 },
    { votosAlvo: 1234, votosAdversario: 987, reservatorio: 4321 },
    { votosAlvo: 50, votosAdversario: 1_500_000, reservatorio: 2 },
  ]

  it.each(CLASSES)('%s: frase completa nas duas regras e com qualquer número', (classe) => {
    for (const regra of REGRAS) {
      for (const caso of casos) {
        const frase = textos.disputa[classe]({ nomes: NOMES, regra, ...caso })
        expect(frase.length, `${classe}/${regra}`).toBeGreaterThan(20)
        expect(frase, `${classe}/${regra}`).not.toMatch(BURACO)
      }
    }
  })

  it('reservatório igual à diferença: a frase não diz "maior que" nem "mais do que" (caso real de Barracão-PR, 25 e 25)', () => {
    const frente = textos.disputa.alvoNaFrente({ nomes: NOMES, regra: 'abertos', votosAlvo: 68, votosAdversario: 43, reservatorio: 25 })
    expect(frente).toContain('igual ao número')
    expect(frente).not.toContain('maior que')
    const dificil = textos.disputa.dificil({ nomes: NOMES, regra: 'abertos', votosAlvo: 43, votosAdversario: 68, reservatorio: 25 })
    expect(dificil).toContain('o mesmo número de pessoas')
    expect(dificil).not.toContain('mais do que')
    const folgado = textos.disputa.alvoNaFrente({ nomes: NOMES, regra: 'abertos', votosAlvo: 68, votosAdversario: 43, reservatorio: 10 })
    expect(folgado).toContain('maior que o número')
  })

  it.each(CLASSES)('%s: rótulo para leitor de tela sem buraco', (classe) => {
    const rotulo = textos.classificacaoAria[classe](NOMES)
    expect(rotulo.length).toBeGreaterThan(3)
    expect(rotulo).not.toMatch(BURACO)
  })

  it.each(REGRAS)('nota de "dá para virar" da abertura com a regra %s', (regra) => {
    const nota = textos.abertura.notaViraveis(NOMES, regra)
    expect(nota).toContain(NOMES.alvo)
    expect(nota).toContain(NOMES.adversario)
    expect(nota).not.toMatch(BURACO)
  })
})

describe('modelos {{chave}}', () => {
  it('valoresDoModelo preenche exatamente as chaves de CHAVES_MODELO, nenhuma vazia', () => {
    const v = valores()
    expect(Object.keys(v).sort()).toEqual([...CHAVES_MODELO].sort())
    for (const [chave, valor] of Object.entries(v)) {
      expect(valor.trim(), chave).not.toBe('')
      expect(valor, chave).not.toMatch(/undefined|NaN|null/)
    }
  })

  it('sem data do índice e sem responsável ou hospedagem, mostra "a definir" (nunca vazio)', () => {
    const v = valores(null)
    expect(v.atualizadoEm).toBe('a definir')
    expect(v.hospedagem).toBe(candidatura.site.hospedagem ?? 'a definir')
    expect(v['responsavel.nome']).toBe(candidatura.site.responsavel.nome ?? 'a definir')
  })

  it('hospedagem vem de config site.hospedagem', () => {
    const cfg = { ...candidatura, site: { ...candidatura.site, hospedagem: 'Provedor X (São Paulo)' } }
    expect(valoresDoModelo(cfg, { geradoEm: null, urlPlano: 'https://exemplo', exteriorAte: null }).hospedagem).toBe('Provedor X (São Paulo)')
  })

  it.each(Object.entries(MARKDOWN))('%s.md usa só chaves conhecidas e fica sem buraco depois de preenchido', (_nome, md) => {
    expect(chavesDesconhecidas(md)).toEqual([])
    const blocos = lerMarkdown(preencherModelo(md, valores()))
    expect(blocos.length).toBeGreaterThan(3)
    for (const b of blocos) expect(textoDoBloco(b)).not.toMatch(/undefined|NaN|\{\{|\}\}/)
  })

  it('roteiros.json usa só chaves conhecidas e fica sem {{ depois de preenchido', () => {
    expect(chavesDesconhecidas(JSON.stringify(roteirosJson))).toEqual([])
    const strings = textosDe(preencherTudo(roteirosJson, valores()))
    expect(strings.length).toBeGreaterThan(50)
    for (const s of strings) expect(s).not.toMatch(/\{\{|\}\}|undefined|NaN/)
  })

  it('chave desconhecida falha alto em vez de ir para a tela', () => {
    expect(chavesDesconhecidas('Oi {{site.nome}} e {{nao.existe}}')).toEqual(['nao.existe'])
    expect(() => preencherModelo('{{nao.existe}}', valores())).toThrow(/nao\.existe/)
  })

  it('preencherTudo devolve cópia e não altera o original (nem congelado)', () => {
    const antes = structuredClone(roteirosJson)
    const congelado = Object.freeze({ a: '{{site.nome}}', b: Object.freeze(['{{raio}}', 3]) })
    const preenchido = preencherTudo(roteirosJson, valores())
    expect(roteirosJson).toEqual(antes)
    expect(preenchido).not.toBe(roteirosJson)
    expect(preencherTudo(congelado, valores())).toEqual({ a: candidatura.site.nome, b: [valores().raio, 3] })
    expect(congelado.a).toBe('{{site.nome}}')
  })
})

describe('roteiros e grupos de conversa', () => {
  it('todo valor de gruposConversa tem ficha, e toda ficha é de um grupo', () => {
    const grupos = Object.values(candidatura.gruposConversa)
    for (const g of grupos) expect(fichas, g).toHaveProperty(g)
    expect(Object.keys(fichas).sort()).toEqual([...new Set(grupos)].sort())
  })

  it('MVP = abstenção, branco e nulo; os demais ficam para a fase 2', () => {
    const porStatus = (s: string): string[] => Object.keys(fichas).filter((k) => fichas[k]?.status === s).sort()
    expect(porStatus('mvp')).toEqual(MVP)
    expect(porStatus('fase2')).toEqual(Object.keys(fichas).filter((k) => !MVP.includes(k)).sort())
  })
})

describe('plano de governo', () => {
  it('tem 9 capítulos, com chaves únicas e páginas dentro do PDF', () => {
    const { capitulos, documento } = planoJson
    expect(capitulos).toHaveLength(9)
    expect(new Set(capitulos.map((c) => c.chave)).size).toBe(9)
    for (const c of capitulos) {
      expect(c.propostas.length, c.chave).toBeGreaterThan(0)
      for (const p of c.propostas) expect(p.pagina >= 1 && p.pagina <= documento.paginas, `${c.chave} p.${p.pagina}`).toBe(true)
    }
  })
})

describe('cartões de conversa do plano (simples e com fonte)', () => {
  const palavras = (s: string): number => s.trim().split(/\s+/).length
  // Fonte oficial que só existe em http (o SIGTAP do DataSUS recusa https); qualquer outra tem de ser https.
  const SO_HTTP = ['sigtap.datasus.gov.br']
  const cartoes = planoJson.capitulos.flatMap((c) =>
    c.propostas.map((p) => ({ capitulo: c.chave, ...p, cuidado: 'cuidado' in p ? p.cuidado : undefined })),
  )
  const anoDaConferencia = Number(planoJson.dadosConferidosEm.slice(0, 4))

  it('a data de conferência dos números é uma data de calendário', () => {
    expect(planoJson.dadosConferidosEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('cada capítulo abre com um resumo curto (até 25 palavras)', () => {
    for (const c of planoJson.capitulos) expect(palavras(c.chamada), c.chave).toBeLessThanOrEqual(25)
  })

  it.each(cartoes.map((c) => [c.titulo, c] as const))('“%s”: frases curtas e sem buraco', (_titulo, c) => {
    expect(palavras(c.emUmaFrase)).toBeLessThanOrEqual(20)
    expect(palavras(c.porQue)).toBeLessThanOrEqual(30)
    expect(palavras(c.paraPuxar)).toBeLessThanOrEqual(20)
    if (c.cuidado !== undefined) expect(palavras(c.cuidado)).toBeLessThanOrEqual(25)
    for (const texto of [c.emUmaFrase, c.porQue, c.paraPuxar, c.cuidado ?? 'ok']) {
      expect(texto.trim().length).toBeGreaterThan(0)
      expect(texto).not.toMatch(BURACO)
    }
  })

  it.each(cartoes.map((c) => [c.titulo, c] as const))('“%s”: o número tem fonte, link, ano e trecho de conferência', (_titulo, c) => {
    const d = c.dado
    expect(d).not.toBeNull()
    if (d === null) return
    expect(d.numero.trim()).not.toBe('')
    expect(palavras(d.frase)).toBeLessThanOrEqual(15)
    expect(d.fonte.trim().length).toBeGreaterThan(3)
    const url = new URL(d.url)
    expect(url.protocol === 'https:' || (url.protocol === 'http:' && SO_HTTP.includes(url.hostname)), d.url).toBe(true)
    expect(Number.isInteger(d.ano) && d.ano >= 1988 && d.ano <= anoDaConferencia, String(d.ano)).toBe(true)
    expect(d.confere.trim().length).toBeGreaterThan(10)
  })

  it('cada pergunta para puxar conversa é diferente das outras', () => {
    const perguntas = cartoes.map((c) => c.paraPuxar)
    expect(new Set(perguntas).size).toBe(perguntas.length)
  })
})

describe('comparação entre os planos (mesmos assuntos, os dois lados com trecho do próprio plano)', () => {
  const palavras = (s: string): number => s.trim().split(/\s+/).length
  // Os textos nossos citam os candidatos por {{alvo.nomeCurto}} e {{adversario.nomeCurto}}: confere já preenchido.
  const { documentoAdversario: doc, temas } = preencherTudo(comparacao, valores())
  // A comparação descreve propostas: sem dizer qual é melhor e sem palavra de ataque, nos textos nossos.
  const JULGAMENTO = /\b(melhor|pior|fracass\w*|desastr\w*|mentir\w*|mentiros\w*|vergonh\w*|absurd\w*|perigos\w*|radica\w*|extremis\w*|culpa\w*)\b/i

  it('o PDF do outro plano é o registrado em dados/fontes (mesmo SHA-256) e fica no site do TSE', () => {
    const registrado = readFileSync(join(import.meta.dirname, '..', 'dados', 'fontes', `plano-${candidatura.adversario.numero}.sha256`), 'utf8')
    expect(registrado.split(/\s+/)[0]).toBe(doc.sha256)
    expect(registrado).toContain(doc.url)
    const url = new URL(doc.url)
    expect(url.protocol).toBe('https:')
    expect(url.hostname.endsWith('tse.jus.br')).toBe(true)
    expect(doc.conferidoEm).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('usa só chaves de modelo conhecidas e fica sem {{ depois de preenchida', () => {
    expect(chavesDesconhecidas(JSON.stringify(comparacao))).toEqual([])
    expect(JSON.stringify(temas)).not.toContain('{{')
  })

  it('assuntos com chave única, que serve de âncora no link (#/comparar/<chave>)', () => {
    expect(temas.length).toBeGreaterThanOrEqual(4)
    expect(new Set(temas.map((t) => t.chave)).size).toBe(temas.length)
    for (const t of temas) expect(t.chave).toMatch(/^[a-z0-9-]+$/)
  })

  it.each(temas.map((t) => [t.titulo, t] as const))('“%s”: resumos curtos, trecho dos dois lados, sem julgamento', (_titulo, t) => {
    expect(palavras(t.pergunta)).toBeLessThanOrEqual(20)
    expect(palavras(t.diferenca)).toBeLessThanOrEqual(45)
    if (t.emComum !== null) expect(palavras(t.emComum)).toBeLessThanOrEqual(35)
    for (const lado of [t.alvo, t.adversario]) {
      expect(palavras(lado.resumo)).toBeLessThanOrEqual(40)
      expect(lado.citacoes.length).toBeGreaterThan(0)
    }
    for (const c of t.alvo.citacoes) {
      expect(c.fonte ?? 'plano').toBe('plano')
      expect(c.pagina >= 1 && c.pagina <= planoJson.documento.paginas, `p. ${c.pagina}`).toBe(true)
    }
    for (const c of t.adversario.citacoes) {
      expect(c.fonte).toBe('adversario')
      expect(c.pagina >= 1 && c.pagina <= doc.paginas, `p. ${c.pagina}`).toBe(true)
    }
    for (const texto of [t.titulo, t.pergunta, t.alvo.resumo, t.adversario.resumo, t.diferenca, t.emComum ?? 'ok']) {
      expect(texto.trim().length).toBeGreaterThan(0)
      expect(texto).not.toMatch(BURACO)
      expect(texto).not.toMatch(JULGAMENTO)
    }
  })
})

describe('markdown seguro', () => {
  it.each(['javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:x', 'data:text/html,oi', 'vbscript:x', '//outro.site'])(
    'recusa link %s (vira texto)',
    (url) => {
      const trechos = lerEmLinha(`antes [clique](${url}) depois`)
      expect(trechos.some((t) => t.tipo === 'link')).toBe(false)
      expect(textoDosTrechos(trechos)).toContain('clique')
    },
  )

  it.each(['https://www.tse.jus.br/x', 'mailto:alguem@exemplo.org', '#/sobre/privacidade'])('aceita link %s', (url) => {
    expect(lerEmLinha(`[ok](${url})`)).toEqual([{ tipo: 'link', texto: 'ok', url }])
  })

  it('o markdown publicado não tem link fora de http(s), mailto e #', () => {
    const urls = Object.values(MARKDOWN).flatMap((md) => [...md.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1] ?? ''))
    for (const url of urls) expect(url).toMatch(/^(https?:\/\/|mailto:|#|\{\{plano\.url\}\})/)
  })
})

describe('datas por extenso', () => {
  it('dia de calendário com o dia da semana', () => {
    expect(dia('2026-10-25')).toBe('domingo, 25/10')
    expect(dia('2026-10-04')).toBe('domingo, 04/10')
    expect(() => dia('25/10/2026')).toThrow()
  })

  it('prazo no fuso da config, com "às" e "à" e minutos quando houver', () => {
    expect(prazo('2026-10-24T22:00:00-03:00', '-03:00')).toBe('sábado, 24/10, às 22h')
    expect(prazo('2026-10-25T04:00:00Z', '-03:00')).toBe('domingo, 25/10, à 1h')
    expect(prazo('2026-10-22T00:00:00-03:00', '-03:00')).toBe('quinta-feira, 22/10, à 0h')
    expect(prazo('2026-10-24T21:30:00-03:00', '-03:00')).toBe('sábado, 24/10, às 21h30')
    expect(() => prazo('ontem', '-03:00')).toThrow()
    expect(() => prazo('2026-10-24T22:00:00-03:00', 'BRT')).toThrow()
  })

  it('data e hora da geração dos dados no horário de Brasília', () => {
    expect(dataHora('2026-10-06T12:00:00Z', '-03:00')).toBe('06/10/2026, 9h')
    expect(valores().atualizadoEm).toBe('06/10/2026, 9h (horário de Brasília)')
  })

  it('fim da conversa = fim da última fase aberta da config', () => {
    expect(fimConversa(candidatura)).toBe('sábado, 24/10, às 22h (horário de Brasília)')
    expect(valores().fimConversa).toBe(fimConversa(candidatura))
  })
})

describe('privacidade bate com o comportamento do site', () => {
  const estilo = JSON.parse(lerArquivo('../../public/mapa/estilo.json')) as { glyphs?: string; sprite?: string }
  const texto = MARKDOWN.privacidade

  it('glifos e sprites de outro host: o aviso cita o host e não diz que nenhum terceiro carrega fonte', () => {
    const hosts = [estilo.glyphs, estilo.sprite].flatMap((u) => (u !== undefined && /^https?:/.test(u) ? [new URL(u).hostname] : []))
    for (const host of hosts) expect(texto).toContain(host.split('.').slice(-2, -1)[0] ?? host)
    expect(texto).not.toMatch(/Nenhuma fonte do Google ou de outro terceiro/)
  })

  it('diz o país do provedor do mapa e a transferência internacional', () => {
    expect(texto).toContain('Hungria')
    expect(texto).toContain('art. 33')
  })

  it('hospedagem na Vercel (EUA): diz a transferência internacional e não promete que ninguém vê o IP', () => {
    const cfg = candidatura.site.hospedagem ?? ''
    expect(cfg).toMatch(/Vercel/)
    expect(texto).toContain('Estados Unidos')
    // Nós não guardamos IP, mas a hospedagem recebe e mostra o tráfego por IP no painel: o aviso tem de dizer isso.
    expect(texto).toContain('Nós não guardamos o seu endereço IP')
    expect(texto).toContain('tráfego por IP')
    expect(texto).not.toMatch(/servidor no Brasil/)
    expect(texto).not.toMatch(/IP não é guardado em lugar nenhum|ninguém vê o seu IP/)
  })
})

describe('Sobre: o número “no Brasil” deixa o exterior de fora e o texto diz isso', () => {
  it('cita os eleitores no exterior com o número vindo do índice', () => {
    const sobre = preencherModelo(MARKDOWN.sobre, valores())
    expect(sobre).toContain('Eleitores no exterior')
    expect(sobre).toContain('614.824')
  })
})
