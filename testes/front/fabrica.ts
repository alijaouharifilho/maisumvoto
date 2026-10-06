// Fábrica de dados fictícios para os testes do front (só para teste; nunca vai para a tela real).
import type { Indice, ItemBusca, Regiao } from '../../nucleo/tipos.ts'
import { regiao, votosDe } from '../nucleo/fabrica.ts'

export { regiao, votosDe }

export const VERSAO = 'abcdef123456'

export function indiceDe(parcial: Partial<Indice> = {}): Indice {
  return {
    esquema: 1,
    versao: VERSAO,
    geradoEm: '2026-10-06T12:00:00Z',
    eleicao: { codigo: '6257', pleito: '3220', turno: 1, cargo: '1' },
    celulaGraus: 0.25,
    candidatos: {
      '22': { nome: 'CANDIDATO A', partido: 'PA' },
      '13': { nome: 'CANDIDATO B', partido: 'PB' },
      '70': { nome: 'CANDIDATO DE TAL', partido: 'PC' },
      '99': { nome: 'OUTRO NOME', partido: 'PD' },
    },
    brasil: {
      secoes: 10,
      aptos: 1000,
      comparecimento: 800,
      abstencao: 200,
      brancos: 20,
      nulos: 30,
      nominais: { '22': 400, '13': 300, '70': 50 },
      regioes: 5,
      regioesNoMapa: 5,
      ate: 300,
      classificacao: { semVotos: 0, empate: 0, folga: 1, aDefender: 1, alvoNaFrente: 1, aVirar: 1, dificil: 1 },
      viraveis: { abertos: 1, abertosMaisOutros: 2 },
      eleitoresForaDoMapa: { presoProvisorio: 0, votoEmTransito: 0 },
    },
    exterior: { secoes: 0, aptos: 0, comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, nominais: {} },
    ufs: {},
    quadrados: ['-26_-50'],
    conferencia: { ok: true, referencia: 'teste', diferencas: [] },
    fontes: [],
    ...parcial,
  }
}

export function itemBusca(parcial: Partial<ItemBusca> & Pick<ItemBusca, 'n'>): ItemBusca {
  return { t: 'm', uf: 'PR', lat: -25.43, lon: -49.27, e: 1000, ...parcial }
}

/** Resposta JSON como a Vercel ou o vite devolveriam. */
export function respostaJson(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'content-type': 'application/json' } })
}

export function respostaHtml(): Response {
  return new Response('<!doctype html><title>x</title>', { status: 200, headers: { 'content-type': 'text/html' } })
}

export function regioesDeExemplo(): Regiao[] {
  return [
    regiao({ id: 'pr-75353-0001-0001', lat: -25.43, lon: -49.27 }),
    regiao({ id: 'pr-75353-0001-0002', lat: -25.431, lon: -49.271, votos: null }),
  ]
}
