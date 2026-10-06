// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { candidatura } from '../../nucleo/candidatura.ts'
import { formatarNumero } from '../../nucleo/frases.ts'
import { cfgMetricas, derivar } from '../../nucleo/metricas.ts'
import type { Votos } from '../../nucleo/tipos.ts'
import { textos } from '../../src/conteudo/textos.ts'
import { Disputa } from '../../src/componentes/Disputa.tsx'
import { Resultado } from '../../src/componentes/Resultado.tsx'
import { prepararDom } from './apoio.tsx'
import { indiceDe, votosDe } from './fabrica.ts'

const cfg = cfgMetricas(candidatura)
const nomes = { alvo: candidatura.alvo.nomeCurto, adversario: candidatura.adversario.nomeCurto }
const A = candidatura.alvo.numero
const D = candidatura.adversario.numero
const ponto = { lat: -25.43, lon: -49.27, origem: 'mapa' as const, rotulo: null }

beforeEach(() => {
  // Sem animação nos testes: o número final aparece de cara.
  prepararDom()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function votos(nominais: Record<string, number>, extra: Partial<Votos> = {}): Votos {
  return votosDe({ aptos: 1000, comparecimento: 800, abstencao: 200, brancos: 30, nulos: 20, nominais, ...extra })
}

function montar(v: Votos, aberta = true) {
  const metricas = derivar(v, cfg)
  render(<Resultado ponto={ponto} votos={v} metricas={metricas} indice={indiceDe()} aberta={aberta} />)
  return metricas
}

describe('Resultado', () => {
  it('fase aberta: manchete com o "até" do raio, nota de teto e origem do ponto', () => {
    const m = montar(votos({ [A]: 300, [D]: 400, '70': 50 }))
    expect(m.ate).toBe(300)
    const manchete = screen.getByRole('heading', { level: 2 })
    expect(manchete.textContent).toContain(textos.resultado.manchete(300).antes)
    expect(manchete.textContent).toContain(formatarNumero(300))
    expect(screen.getByText(textos.resultado.notaTeto)).toBeTruthy()
    expect(screen.getByText(textos.busca.origem.mapa)).toBeTruthy()
  })

  it('decompõe o "até" em linguagem natural, com o nome do candidato vindo do índice', () => {
    montar(votos({ [A]: 300, [D]: 400, '70': 50 }))
    const p = textos.resultado.parcela
    const esperado = textos.resultado.decomposicao([p.abstencao(200), p.candidato(50, 'Candidato de Tal'), p.brancos(30), p.nulos(20)])
    expect(screen.getByText(esperado)).toBeTruthy()
  })

  it('alcance usa os aptos com resultado como denominador', () => {
    montar(votos({ [A]: 300, [D]: 400, '70': 50 }))
    const esperado = textos.resultado.alcance(1000, { texto: 'quase 1 em cada 3', numerador: 1 })
    expect(screen.getByText(esperado)).toBeTruthy()
  })

  it('barra da fatia do alvo com role=img e rótulo com o percentual', () => {
    montar(votos({ [A]: 300, [D]: 400, '70': 50 }))
    const barra = screen.getByRole('img', { name: textos.alvoAqui.ariaBarra(nomes.alvo, 300 / 750) })
    expect(barra).toBeTruthy()
    expect(screen.queryByText(textos.alvoAqui.notaFolga(nomes.alvo, cfg.limiarFolga))).toBeNull()
  })

  it('nota de folga quando o alvo passa do limiar', () => {
    montar(votos({ [A]: 700, [D]: 100 }))
    expect(screen.getByText(textos.alvoAqui.notaFolga(nomes.alvo, cfg.limiarFolga))).toBeTruthy()
  })

  it('fase fechada: frase neutra, sem convite nem animação', () => {
    montar(votos({ [A]: 300, [D]: 400 }), false)
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(textos.resultado.mancheteNeutra(250, nomes, '1 km'))
    expect(screen.queryByText(textos.resultado.notaTeto)).toBeNull()
  })
})

describe('Disputa', () => {
  const casos: Array<[string, Record<string, number>]> = [
    ['aVirar', { [A]: 300, [D]: 400 }],
    ['dificil', { [A]: 100, [D]: 900 }],
    ['empate', { [A]: 300, [D]: 300 }],
    ['aDefender', { [A]: 400, [D]: 300 }],
    ['alvoNaFrente', { [A]: 900, [D]: 600 }],
    ['folga', { [A]: 800, [D]: 100 }],
  ]

  it.each(casos)('classificação %s escolhe a frase certa', (classe, nominais) => {
    const v = votos(nominais, classe === 'alvoNaFrente' || classe === 'dificil' ? { abstencao: 20, brancos: 5, nulos: 5 } : {})
    const m = derivar(v, cfg)
    expect(m.classificacao).toBe(classe)
    const { container } = render(<Disputa metricas={m} />)
    const frase = textos.disputa[m.classificacao]({ nomes, votosAlvo: m.alvo, votosAdversario: m.adversario, reservatorio: m.reservatorio, regra: cfg.regraViravel })
    expect(within(container).getByText(frase, { exact: false })).toBeTruthy()
  })

  it('não mostra nada quando nenhum dos dois finalistas teve voto', () => {
    const { container } = render(<Disputa metricas={derivar(votos({ '70': 10 }), cfg)} />)
    expect(container.textContent).toBe('')
  })
})
