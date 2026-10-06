// Formatação de dados vindos do TSE para exibição (nomes em caixa alta, CEP, rótulos da busca).
import { candidatura } from '../../nucleo/candidatura.ts'
import type { Indice, ItemBusca } from '../../nucleo/tipos.ts'

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

/** "AUGUSTO CURY" → "Augusto Cury"; "JOSÉ DA SILVA" → "José da Silva". */
export function nomeProprio(nome: string): string {
  return nome
    .toLocaleLowerCase('pt-BR')
    .split(/\s+/)
    .filter((p) => p !== '')
    .map((p, i) => (i > 0 && MINUSCULAS.has(p) ? p : p.charAt(0).toLocaleUpperCase('pt-BR') + p.slice(1)))
    .join(' ')
}

/** Nome do candidato pelo número: os dois finalistas pelo nome curto da config (igual ao resto do site);
 *  os demais pelo nome de urna do índice; sem cadastro, o próprio número. */
export function nomeDoCandidato(indice: Indice | null, numero: string): string {
  if (numero === candidatura.alvo.numero) return candidatura.alvo.nomeCurto
  if (numero === candidatura.adversario.numero) return candidatura.adversario.nomeCurto
  const c = indice?.candidatos[numero]
  return c === undefined ? numero : nomeProprio(c.nome)
}

/** "80010000" → "80010-000". */
export function formatarCep(cep: string): string {
  const d = cep.replace(/\D/g, '')
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : cep
}

/** Rótulo de um resultado da busca: "Centro, Curitiba – PR" ou "Curitiba – PR". */
export function rotuloItemBusca(item: Pick<ItemBusca, 'n' | 'm' | 'uf'>): string {
  return item.m === undefined || item.m === item.n ? `${item.n} – ${item.uf}` : `${item.n}, ${item.m} – ${item.uf}`
}

export function primeiraMaiuscula(s: string): string {
  return s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1)
}
