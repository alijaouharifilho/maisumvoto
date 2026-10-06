// Busca contra os dados publicados (public/dados), quando o ETL já rodou: as consultas que falhavam na revisão
// de 05/10/2026 ("bairro cidade" sem vírgula nas capitais), o exemplo da dica de erro e o CEP de casa.
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { regrasBusca } from '../nucleo/candidatura.ts'
import { EXEMPLO_BUSCA } from '../src/conteudo/textos/mapa.ts'
import { resolverBusca, type RespostaBusca } from '../src/dados/buscar.ts'
import { criarCarregador, type Buscar } from '../src/dados/carregar.ts'

const DADOS = process.env['CONTRATO_DADOS'] ?? join(import.meta.dirname, '..', 'public', 'dados')
const TEM_DADOS = existsSync(join(DADOS, 'indice.json'))

const doDisco: Buscar = async (url) => {
  const caminho = join(DADOS, new URL(url, 'http://x').pathname.replace(/^\/dados\//, ''))
  if (!existsSync(caminho)) return new Response('', { status: 404 })
  return new Response(readFileSync(caminho), { headers: { 'content-type': 'application/json' } })
}

function rotulos(r: RespostaBusca): string[] {
  if (r.tipo === 'ponto') return [r.ponto.rotulo ?? '']
  return r.tipo === 'opcoes' ? r.itens.map((i) => `${i.n}, ${i.m ?? ''}`) : []
}

describe.skipIf(!TEM_DADOS)('busca nos dados publicados', () => {
  const carregador = criarCarregador({ base: '/dados', buscar: doDisco })

  it.each([
    ['Tijuca Rio de Janeiro', 'Tijuca, Rio de Janeiro – RJ'],
    ['Batel Curitiba', 'Batel, Curitiba – PR'],
    ['Asa Norte Brasília', 'Asa Norte, Brasília – DF'],
    ['Asa Sul Brasília', 'Asa Sul, Brasília – DF'],
    ['Sitio Cercado Curitiba', 'Sitio Cercado, Curitiba – PR'],
    ['Campo Grande Rio de Janeiro', 'Campo Grande, Rio de Janeiro – RJ'],
  ])('"%s" sem vírgula vai direto ao bairro', async (consulta, rotulo) => {
    const r = await resolverBusca(carregador, consulta, regrasBusca)
    expect(r.tipo).toBe('ponto')
    expect(rotulos(r)).toEqual([rotulo])
  })

  it('o exemplo da dica de "não achamos" acha o lugar', async () => {
    const r = await resolverBusca(carregador, EXEMPLO_BUSCA, regrasBusca)
    expect(['ponto', 'opcoes']).toContain(r.tipo)
  })

  it('CEP de casa no centro de Curitiba (não é de local de votação) cai num local do mesmo setor', async () => {
    const r = await resolverBusca(carregador, '80010-000', regrasBusca)
    expect(r.tipo).toBe('ponto')
    expect(rotulos(r)[0]).toMatch(/^Perto do CEP 80010-000 · .*Curitiba – PR$/)
  })
})
