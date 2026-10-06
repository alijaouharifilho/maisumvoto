// Liga os números do núcleo aos textos do conteúdo (parcelas, disputa, origem do ponto).
import { parcelas, type Derivadas, type Parcela, type VotosBase } from '../../nucleo/metricas.ts'
import type { Indice } from '../../nucleo/tipos.ts'
import { textos, type DadosDisputa } from '../conteudo/textos.ts'
import { CFG, NOMES, RAIO_TEXTO } from '../config.ts'
import type { PontoEscolhido } from '../dados/buscar.ts'
import type { ResultadoPonto } from '../dados/resultado.ts'
import { nomeDoCandidato } from './formatar.ts'

export function rotuloParcela(p: Parcela, indice: Indice | null): string {
  const t = textos.resultado.parcela
  if (p.chave === 'brancos') return t.brancos(p.valor)
  if (p.chave === 'nulos') return t.nulos(p.valor)
  if (p.chave === 'abstencao') return t.abstencao(p.valor)
  if (p.numero !== undefined) return t.candidato(p.valor, nomeDoCandidato(indice, p.numero))
  return t.outros(p.valor)
}

export function parcelasDe(votos: VotosBase): Parcela[] {
  return parcelas(votos, CFG)
}

export function fraseDecomposicao(votos: VotosBase, indice: Indice | null): string | null {
  const lista = parcelasDe(votos)
  return lista.length === 0 ? null : textos.resultado.decomposicao(lista.map((p) => rotuloParcela(p, indice)))
}

export function dadosDisputa(m: Derivadas): DadosDisputa {
  return {
    nomes: NOMES,
    votosAlvo: m.alvo,
    votosAdversario: m.adversario,
    reservatorio: m.reservatorio,
    regra: CFG.regraViravel,
  }
}

/** Frase da disputa; null quando nenhum dos dois finalistas teve voto (com outros votos válidos). */
export function fraseDisputa(m: Derivadas): string | null {
  if (m.classificacao !== 'semVotos' && m.alvo + m.adversario === 0) return null
  return textos.disputa[m.classificacao](dadosDisputa(m))
}

export function rotuloOrigem(p: PontoEscolhido): string {
  if (p.origem === 'busca' && p.rotulo !== null) return p.rotulo
  if (p.origem === 'localizacao') return textos.busca.origem.localizacao
  if (p.origem === 'mapa') return textos.busca.origem.mapa
  return textos.busca.origem.link
}

/**
 * Frase da região viva da tela do mapa: origem do ponto, manchete (ou o aviso de vazio) e quantos locais a lista
 * traz. Vazia enquanto não há resultado. A manchete segue a fase: neutra, sem convite, nas fases fechadas.
 */
export function anuncioDoPonto(ponto: PontoEscolhido | null, resultado: ResultadoPonto | null, aberta: boolean): string {
  if (ponto === null || resultado === null) return ''
  const origem = rotuloOrigem(ponto)
  if (resultado.metricas === null) {
    const titulo = resultado.regioes.length > 0 ? textos.vazio.semResultado.titulo : textos.vazio.semLocal.titulo(RAIO_TEXTO)
    return textos.acessibilidade.anuncioSemLocal(origem, titulo)
  }
  const { ate } = resultado.metricas
  const m = textos.resultado.manchete(ate)
  const frase = aberta ? `${m.antes} ${m.numero} ${m.depois}` : textos.resultado.mancheteNeutra(ate, NOMES, RAIO_TEXTO)
  return textos.acessibilidade.anuncioPonto(origem, frase, resultado.lista.length)
}
