// Busca local (CONTRATO §5): CEP pelo arquivo de CEP; o resto pelos arquivos de prefixo das palavras-chave.
import { ehCep, escolhaDireta, filtrarResultados, normalizar, prefixosConsulta } from '../../nucleo/busca.ts'
import type { ArquivoCep, ItemBusca, RegrasBusca } from '../../nucleo/tipos.ts'
import { textos } from '../conteudo/textos.ts'
import { formatarCep, rotuloItemBusca } from '../util/formatar.ts'
import type { Carregador } from './carregar.ts'

export type OrigemPonto = 'link' | 'mapa' | 'localizacao' | 'busca'

export type PontoEscolhido = {
  readonly lat: number
  readonly lon: number
  readonly origem: OrigemPonto
  /** Rótulo da busca ("Centro, Curitiba – PR"); null nas outras origens. */
  readonly rotulo: string | null
}

export type RespostaBusca =
  | { readonly tipo: 'curto' }
  | { readonly tipo: 'nada' }
  | { readonly tipo: 'cepNaoEncontrado' }
  | { readonly tipo: 'ponto'; readonly ponto: PontoEscolhido }
  | { readonly tipo: 'opcoes'; readonly itens: readonly ItemBusca[] }

/** Tamanhos de prefixo tentados quando o CEP digitado não é de um local de votação: mesmo setor, depois subsetor. */
const PREFIXOS_CEP_APROXIMADO = [5, 4] as const

export function pontoDoItem(item: ItemBusca): PontoEscolhido {
  return { lat: item.lat, lon: item.lon, origem: 'busca', rotulo: rotuloItemBusca(item) }
}

/**
 * CEP indexado mais parecido com o digitado: do mesmo setor (5 primeiros dígitos) ou, sem nenhum, do mesmo
 * subsetor (4); entre eles, o de numeração mais próxima (empate: o menor). Null se nem isso.
 */
export function cepParecido(ceps: ArquivoCep, chave: string): string | null {
  const alvo = Number(chave)
  for (const tamanho of PREFIXOS_CEP_APROXIMADO) {
    const prefixo = chave.slice(0, tamanho)
    const mesmos = Object.keys(ceps).filter((c) => c.startsWith(prefixo)).sort()
    const melhor = mesmos.reduce<string | null>(
      (m, c) => (m === null || Math.abs(Number(c) - alvo) < Math.abs(Number(m) - alvo) ? c : m),
      null,
    )
    if (melhor !== null) return melhor
  }
  return null
}

async function buscarCep(carregador: Carregador, arquivo: string, chave: string, sinal?: AbortSignal): Promise<RespostaBusca> {
  const ceps = await carregador.cep(arquivo, sinal)
  const usado = ceps[chave] === undefined ? cepParecido(ceps, chave) : chave
  const achado = usado === null ? undefined : ceps[usado]
  if (achado === undefined) return { tipo: 'cepNaoEncontrado' }
  const lugar = rotuloItemBusca(achado.b.trim() === '' ? { n: achado.m, uf: achado.uf } : { n: achado.b, m: achado.m, uf: achado.uf })
  const rotulo = usado === chave ? `${formatarCep(chave)} · ${lugar}` : textos.busca.cepAproximado(formatarCep(chave), lugar)
  return { tipo: 'ponto', ponto: { lat: achado.lat, lon: achado.lon, origem: 'busca', rotulo } }
}

/** Itens de vários arquivos de prefixo, sem repetir o que está em mais de um (mesma ordem de chegada). */
function unir(listas: readonly (readonly ItemBusca[])[]): ItemBusca[] {
  const vistos = new Set<string>()
  return listas.flat().filter((item) => {
    const chave = `${item.t}|${item.n}|${item.m ?? ''}|${item.uf}|${item.lat}|${item.lon}`
    if (vistos.has(chave)) return false
    vistos.add(chave)
    return true
  })
}

export async function resolverBusca(
  carregador: Carregador,
  texto: string,
  regras: RegrasBusca,
  sinal?: AbortSignal,
): Promise<RespostaBusca> {
  const limpo = texto.trim()
  const cep = ehCep(limpo)
  if (cep !== null) return buscarCep(carregador, cep.arquivo, cep.chave, sinal)
  if (normalizar(limpo).replace(/ /g, '').length < regras.tamanhoPrefixo) return { tipo: 'curto' }
  const prefixos = prefixosConsulta(limpo, regras)
  if (prefixos.length === 0) return { tipo: 'curto' }
  const arquivos = await Promise.all(prefixos.map((p) => carregador.busca(p, sinal)))
  const itens = filtrarResultados(unir(arquivos), limpo, regras)
  const [unico] = itens
  if (unico === undefined) return { tipo: 'nada' }
  const direto = itens.length === 1 ? unico : escolhaDireta(itens, limpo)
  return direto === null ? { tipo: 'opcoes', itens } : { tipo: 'ponto', ponto: pontoDoItem(direto) }
}
