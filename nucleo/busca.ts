// Busca local por prefixo (CONTRATO §5). As regras vêm de config/busca.json, as mesmas do ETL.
import type { ItemBusca, RegrasBusca } from './tipos.ts'

const MIN_LETRAS_ULTIMO_RECURSO = 3
/** Máximo de arquivos de prefixo pedidos numa consulta (CONTRATO §5.4). */
export const MAX_ARQUIVOS_CONSULTA = 4
// 80010-000, 80010000, 80.010-000 e 80010 000 (o formato com ponto é o tradicional dos Correios).
const RE_CEP = /^\d{2}\.?\d{3}[-\s]?\d{3}$/
const RE_APOSTROFO = /['’]/g
// Nomes de dispositivo do Windows (CON, PRN, AUX, NUL, COM1–9, LPT1–9) não podem ser nome de arquivo:
// o Git no Windows recusa "aux.json" e "con.json". Esses prefixos ganham "_" no nome do arquivo (CONTRATO §1).
const RE_RESERVADO_WINDOWS = /^(con|prn|aux|nul|com\d|lpt\d)$/

/** Nome do arquivo de busca (sem ".json") de um prefixo: igual ao prefixo, ou com "_" se for nome reservado. */
export function arquivoDaBusca(prefixo: string): string {
  return RE_RESERVADO_WINDOWS.test(prefixo) ? `${prefixo}_` : prefixo
}

export function normalizar(s: string): string {
  return s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/ +/g, ' ')
    .trim()
}

function palavras(s: string): string[] {
  const n = normalizar(s)
  return n === '' ? [] : n.split(' ')
}

/** O nome normalizado e a grafia sem apóstrofo ("sant ana do livramento" e "santana do livramento"). */
function formas(s: string): string[] {
  return [...new Set([normalizar(s), normalizar(s.replace(RE_APOSTROFO, ''))])]
}

/** Palavras das duas formas do nome, sem repetir. */
function palavrasDasFormas(s: string): string[] {
  return [...new Set(formas(s).flatMap((f) => (f === '' ? [] : f.split(' '))))]
}

export function palavrasChave(nome: string, regras: RegrasBusca): string[] {
  const unicas = [...new Set(palavras(nome))]
  const genericas = new Set(regras.genericas)
  const boas = (min: number): string[] => unicas.filter((p) => p.length >= min && !genericas.has(p))
  const fortes = boas(regras.minLetrasPalavraChave)
  if (fortes.length > 0) return fortes
  const reserva = boas(regras.minLetrasReserva)
  if (reserva.length > 0) return reserva
  return unicas.filter((p) => p.length >= MIN_LETRAS_ULTIMO_RECURSO)
}

function dividir(texto: string): { termos: string[]; restricao: string[] } {
  const virgula = texto.indexOf(',')
  if (virgula === -1) return { termos: palavras(texto), restricao: [] }
  return { termos: palavras(texto.slice(0, virgula)), restricao: palavras(texto.slice(virgula + 1)) }
}

/**
 * Arquivos de prefixo de uma consulta (CONTRATO §5.4). O índice põe cada item só nos arquivos das palavras do
 * próprio nome; numa consulta sem vírgula ("Tijuca Rio de Janeiro"), a palavra mais longa pode ser da cidade.
 * Por isso juntam-se as palavras-chave de cada trecho inicial do texto antes da vírgula ("tijuca", "tijuca rio",
 * …, o trecho inteiro): as que não são genéricas primeiro, na ordem em que aparecem; sem prefixo repetido;
 * no máximo MAX_ARQUIVOS_CONSULTA.
 */
export function prefixosConsulta(texto: string, regras: RegrasBusca): string[] {
  const { termos } = dividir(texto)
  const genericas = new Set(regras.genericas)
  const chaves = [...new Set(termos.flatMap((_, i) => palavrasChave(termos.slice(0, i + 1).join(' '), regras)))]
  const ordenadas = [...chaves.filter((p) => !genericas.has(p)), ...chaves.filter((p) => genericas.has(p))]
  const prefixos = [...new Set(ordenadas.map((p) => p.slice(0, regras.tamanhoPrefixo)))]
  return prefixos.slice(0, MAX_ARQUIVOS_CONSULTA)
}

export function ehCep(texto: string): { arquivo: string; chave: string } | null {
  const limpo = texto.trim()
  if (!RE_CEP.test(limpo)) return null
  const chave = limpo.replace(/[.\s-]/g, '')
  return { arquivo: chave.slice(0, 3), chave }
}

function algumComPrefixo(termo: string, alvo: readonly string[]): boolean {
  return alvo.some((p) => p.startsWith(termo))
}

/** Nome do item seguido da cidade e/ou da UF, como se digita sem vírgula: "tijuca rio de janeiro", "curitiba pr". */
function nomeComLugar(item: ItemBusca): string[] {
  const uf = item.uf.toLowerCase()
  const cidades = item.m === undefined ? [] : formas(item.m)
  return formas(item.n).flatMap((nome) =>
    item.m === undefined ? [`${nome} ${uf}`] : cidades.flatMap((c) => [`${nome} ${c}`, `${nome} ${c} ${uf}`]),
  )
}

type Candidato = { item: ItemBusca; exato: boolean }

export function filtrarResultados(itens: readonly ItemBusca[], texto: string, regras: RegrasBusca): ItemBusca[] {
  const { termos, restricao } = dividir(texto)
  if (termos.length === 0) return []
  const consulta = termos.join(' ')
  const candidatos: Candidato[] = itens.flatMap((item) => {
    const nome = palavrasDasFormas(item.n)
    const lugar = [...palavrasDasFormas(item.m ?? item.n), item.uf.toLowerCase()]
    const todos = [...nome, ...lugar]
    const casa = termos.every((t) => algumComPrefixo(t, todos)) && restricao.every((t) => algumComPrefixo(t, lugar))
    return casa ? [{ item, exato: formas(item.n).includes(consulta) || nomeComLugar(item).includes(consulta) }] : []
  })
  // sort é estável: no empate total fica a ordem do arquivo (o ETL já grava por eleitorado)
  return candidatos
    .sort((x, y) => Number(y.exato) - Number(x.exato) || y.item.e - x.item.e)
    .slice(0, regras.maxResultados)
    .map((c) => c.item)
}

/**
 * Consulta que já diz a cidade e aponta um só bairro ou município ("Água Verde, Curitiba", "Tijuca Rio de
 * Janeiro", "Curitiba, PR", "Curitiba PR"): vai direto ao ponto, sem lista. Com vírgula, o nome antes dela tem de
 * ser o do item; sem vírgula, o texto tem de ser o nome com a cidade ou a UF. Só o nome ("Curitiba") continua
 * mostrando a lista, e local de votação nunca vai direto.
 */
export function escolhaDireta(itens: readonly ItemBusca[], texto: string): ItemBusca | null {
  const { termos, restricao } = dividir(texto)
  const consulta = termos.join(' ')
  if (consulta === '') return null
  const qualificados = itens.filter((item) => {
    if (item.t === 'l') return false
    return restricao.length > 0 ? formas(item.n).includes(consulta) : nomeComLugar(item).includes(consulta)
  })
  return qualificados.length === 1 ? (qualificados[0] ?? null) : null
}
