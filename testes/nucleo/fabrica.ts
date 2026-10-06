// Fábrica de regiões para os testes do núcleo (dados fictícios, só para teste).
import type { Regiao, Votos } from '../../nucleo/tipos.ts'

export function votosDe(parcial: Partial<Votos>): Votos {
  return { aptos: 0, comparecimento: 0, abstencao: 0, brancos: 0, nulos: 0, nominais: {}, ...parcial }
}

export function regiao(parcial: Partial<Regiao> & Pick<Regiao, 'id'>): Regiao {
  return {
    uf: 'PR',
    mun: '75353',
    municipio: 'Curitiba',
    bairro: 'Centro',
    lat: -25.4284,
    lon: -49.2733,
    posicao: 'tse',
    locais: [{ nome: 'Escola A', endereco: 'Rua A, 1', cep: '80010000', zona: 1, nr: 1015, secoes: [1, 2] }],
    eleitores: 100,
    secoes: 2,
    votos: votosDe({ aptos: 100, comparecimento: 80, abstencao: 20, nominais: { '22': 40, '13': 40 } }),
    ...parcial,
  }
}
