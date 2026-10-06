// Carregador dos arquivos de public/dados (CONTRATO §2).
// - indice.json: sem ?v e com cache "no-cache" (muda a cada publicação); o resto vai com ?v=<versão>.
// - Uma Promise por URL; falha nunca fica guardada (a próxima chamada pede de novo).
// - Fila de até 6 pedidos simultâneos; quem desiste (AbortSignal) só cancela o download se ninguém mais o quiser.
//   Os pontinhos de densidade (pontos/) têm fila própria, de 2: dezenas de quadrados pedidos a cada movimento do
//   mapa não atrasam as células do ponto escolhido, a busca e as seções.
// - Tudo validado com os esquemas zod do núcleo. 404 ou resposta que não é JSON contam como "arquivo ausente".
// - O cabeçalho Date da resposta do índice (sempre revalidada) vai para `aoHoraDoServidor` (src/relogio.ts).
import type { z } from 'zod/mini'
import {
  esquemaBusca,
  esquemaCep,
  esquemaIndice,
  esquemaPontos,
  esquemaRegioes,
  esquemaSecoes,
  RE_CHAVE_GRADE,
} from '../../nucleo/esquemas.ts'
import { arquivoDaBusca } from '../../nucleo/busca.ts'
import { decodificarPontos } from '../../nucleo/pontos.ts'
import type { ArquivoCep, ArquivoSecoes, Indice, ItemBusca, Regiao } from '../../nucleo/tipos.ts'
import { criarFila, erroAbortado } from './fila.ts'

export { criarFila, erroAbortado }

export type MotivoErro = 'rede' | 'http' | 'formato' | 'ausente'

export class ErroDados extends Error {
  readonly motivo: MotivoErro
  constructor(motivo: MotivoErro, mensagem: string, opcoes?: ErrorOptions) {
    super(mensagem, opcoes)
    this.name = 'ErroDados'
    this.motivo = motivo
  }
}

export type PontoLatLon = [lat: number, lon: number]

export type Buscar = (url: string, init: RequestInit) => Promise<Response>

export type Carregador = {
  indice(sinal?: AbortSignal): Promise<Indice>
  regioesDaCelula(chave: string, sinal?: AbortSignal): Promise<Regiao[]>
  pontosResumo(sinal?: AbortSignal): Promise<PontoLatLon[]>
  pontosQuadrado(chave: string, sinal?: AbortSignal): Promise<PontoLatLon[]>
  busca(prefixo: string, sinal?: AbortSignal): Promise<ItemBusca[]>
  cep(prefixo: string, sinal?: AbortSignal): Promise<ArquivoCep>
  secoes(uf: string, mun: string, zona: number, sinal?: AbortSignal): Promise<ArquivoSecoes>
}

export type OpcoesCarregador = {
  base: string
  buscar?: Buscar
  maxSimultaneos?: number
  /** Recebe o cabeçalho Date de cada resposta do índice (hora do servidor). */
  aoHoraDoServidor?: (cabecalhoDate: string | null) => void
}

const MAX_SIMULTANEOS = 6
const MAX_SIMULTANEOS_DENSIDADE = 2
const AUSENTE: unique symbol = Symbol('ausente')
const RE_PREFIXO = /^[a-z0-9]{1,8}$/
const RE_CEP3 = /^\d{3}$/
const RE_UF = /^[A-Za-z]{2}$/
const RE_MUN = /^\d{5}$/
const ZONA_MAX = 9999

type Bruto = unknown | typeof AUSENTE

type Entrada = { promessa: Promise<unknown>; controle: AbortController; interessados: number; pronta: boolean }

async function baixarJson(buscar: Buscar, url: string, cache: RequestCache, sinal: AbortSignal): Promise<Bruto> {
  let resposta: Response
  try {
    resposta = await buscar(url, { cache, signal: sinal, headers: { Accept: 'application/json' } })
  } catch (erro) {
    if (sinal.aborted) throw erroAbortado()
    throw new ErroDados('rede', `sem resposta de ${url}`, { cause: erro })
  }
  if (resposta.status === 404) return AUSENTE
  if (!resposta.ok) throw new ErroDados('http', `HTTP ${resposta.status} em ${url}`)
  // Servidor de SPA devolve index.html (200, text/html) para arquivo que não existe.
  if (!/json/i.test(resposta.headers.get('content-type') ?? '')) return AUSENTE
  try {
    return (await resposta.json()) as unknown
  } catch (erro) {
    if (sinal.aborted) throw erroAbortado()
    throw new ErroDados('formato', `JSON ilegível em ${url}`, { cause: erro })
  }
}

function validar<T>(esquema: z.ZodMiniType<T>, bruto: unknown, url: string): T {
  const r = esquema.safeParse(bruto)
  if (r.success) return r.data
  const problema = r.error.issues[0]
  throw new ErroDados('formato', `${url} fora do contrato: ${problema?.path.join('.') ?? ''} ${problema?.message ?? ''}`)
}

function ouVazio<T>(esquema: z.ZodMiniType<T>, vazio: () => T, url: string): (bruto: Bruto) => T {
  return (bruto) => (bruto === AUSENTE ? vazio() : validar(esquema, bruto, url))
}

/** Uma Promise por URL. Quem desiste só cancela o download se ninguém mais estiver esperando. */
class CacheDeArquivos {
  private readonly fila
  private readonly entradas = new Map<string, Entrada>()
  private readonly buscar: Buscar

  constructor(buscar: Buscar, maxSimultaneos: number) {
    this.buscar = buscar
    this.fila = criarFila(maxSimultaneos)
  }

  // A mesma URL sempre usa a mesma transformação, então o tipo guardado é sempre T.
  obter<T>(url: string, cache: RequestCache, transformar: (b: Bruto) => T, sinal?: AbortSignal): Promise<T> {
    const entrada = this.entradas.get(url) ?? this.criar(url, cache, transformar)
    return this.assinar(url, entrada, sinal) as Promise<T>
  }

  private esquecer(url: string, entrada: Entrada): void {
    if (this.entradas.get(url) === entrada) this.entradas.delete(url)
  }

  private criar<T>(url: string, cache: RequestCache, transformar: (b: Bruto) => T): Entrada {
    const controle = new AbortController()
    const promessa = this.fila
      .executar(() => baixarJson(this.buscar, url, cache, controle.signal), controle.signal)
      .then(transformar)
    const entrada: Entrada = { promessa, controle, interessados: 0, pronta: false }
    promessa.then(
      () => {
        entrada.pronta = true
      },
      () => this.esquecer(url, entrada),
    )
    this.entradas.set(url, entrada)
    return entrada
  }

  private assinar(url: string, entrada: Entrada, sinal: AbortSignal | undefined): Promise<unknown> {
    entrada.interessados += 1
    if (sinal === undefined) return entrada.promessa
    return new Promise((resolver, rejeitar) => {
      const desistir = (): void => {
        entrada.interessados -= 1
        if (entrada.interessados === 0 && !entrada.pronta) {
          entrada.controle.abort()
          this.esquecer(url, entrada)
        }
        rejeitar(erroAbortado())
      }
      if (sinal.aborted) {
        desistir()
        return
      }
      sinal.addEventListener('abort', desistir, { once: true })
      const soltar = (): void => sinal.removeEventListener('abort', desistir)
      entrada.promessa.then(
        (v) => {
          soltar()
          resolver(v)
        },
        (e: unknown) => {
          soltar()
          rejeitar(e)
        },
      )
    })
  }
}

type Versionado = <T>(caminho: string, fazer: (url: string) => (b: Bruto) => T, sinal?: AbortSignal) => Promise<T>

const pontosDe = (url: string) => (bruto: Bruto) => (bruto === AUSENTE ? [] : decodificarPontos(validar(esquemaPontos, bruto, url)))

function caminhoSecoes(uf: string, mun: string, zona: number): string | null {
  if (!RE_UF.test(uf) || !RE_MUN.test(mun) || !Number.isInteger(zona) || zona < 1 || zona > ZONA_MAX) return null
  return `secoes/${uf.toLowerCase()}/${mun}-${String(zona).padStart(4, '0')}.json`
}

/** Os arquivos versionados; chave fora do formato nunca vira caminho de pedido. */
function arquivos(
  indice: Carregador['indice'],
  versionado: Versionado,
  densidade: Versionado,
  existeQuadrado: (ind: Indice, chave: string) => boolean,
): Omit<Carregador, 'indice'> {
  return {
    async regioesDaCelula(chave, sinal) {
      if (!RE_CHAVE_GRADE.test(chave)) return []
      return versionado(`celulas/${chave}.json`, (url) => ouVazio(esquemaRegioes, () => [], url), sinal)
    },
    async pontosResumo(sinal) {
      return densidade('pontos/resumo.json', pontosDe, sinal)
    },
    async pontosQuadrado(chave, sinal) {
      if (!RE_CHAVE_GRADE.test(chave) || !existeQuadrado(await indice(sinal), chave)) return []
      return densidade(`pontos/${chave}.json`, pontosDe, sinal)
    },
    async busca(prefixo, sinal) {
      if (!RE_PREFIXO.test(prefixo)) return []
      return versionado(`busca/${arquivoDaBusca(prefixo)}.json`, (url) => ouVazio(esquemaBusca, () => [], url), sinal)
    },
    async cep(prefixo, sinal) {
      if (!RE_CEP3.test(prefixo)) return {}
      return versionado(`cep/${prefixo}.json`, (url) => ouVazio(esquemaCep, () => ({}), url), sinal)
    },
    async secoes(uf, mun, zona, sinal) {
      const caminho = caminhoSecoes(uf, mun, zona)
      if (caminho === null) return { secoes: {} }
      return versionado(caminho, (url) => ouVazio(esquemaSecoes, () => ({ secoes: {} }), url), sinal)
    },
  }
}

export function criarCarregador(opcoes: OpcoesCarregador): Carregador {
  const base = opcoes.base.replace(/\/$/, '')
  const urlIndice = `${base}/indice.json`
  const buscarBase: Buscar = opcoes.buscar ?? ((url, init) => fetch(url, init))
  const buscar: Buscar = async (url, init) => {
    const resposta = await buscarBase(url, init)
    if (url === urlIndice) opcoes.aoHoraDoServidor?.(resposta.headers.get('date'))
    return resposta
  }
  const cache = new CacheDeArquivos(buscar, opcoes.maxSimultaneos ?? MAX_SIMULTANEOS)
  const cacheDensidade = new CacheDeArquivos(buscar, MAX_SIMULTANEOS_DENSIDADE)
  const quadradosPorIndice = new WeakMap<Indice, ReadonlySet<string>>()

  const indice = (sinal?: AbortSignal): Promise<Indice> => {
    const url = urlIndice
    const transformar = (bruto: Bruto): Indice => {
      if (bruto === AUSENTE) throw new ErroDados('ausente', `${url} não encontrado`)
      return validar(esquemaIndice, bruto, url)
    }
    return cache.obter(url, 'no-cache', transformar, sinal)
  }

  const comVersao = (alvo: CacheDeArquivos): Versionado => async (caminho, fazer, sinal) => {
    const { versao } = await indice(sinal)
    const url = `${base}/${caminho}?v=${versao}`
    return alvo.obter(url, 'default', fazer(url), sinal)
  }
  const versionado = comVersao(cache)

  const existeQuadrado = (ind: Indice, chave: string): boolean => {
    const conjunto = quadradosPorIndice.get(ind) ?? new Set(ind.quadrados)
    quadradosPorIndice.set(ind, conjunto)
    return conjunto.has(chave)
  }

  return { indice, ...arquivos(indice, versionado, comVersao(cacheDensidade), existeQuadrado) }
}
