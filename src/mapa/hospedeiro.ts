// Um só nó de mapa e um só motor por aba. O nó é criado fora do React e movido entre os encaixes
// (painel no celular, coluna da direita no desktop): cruzar 960 px não remonta o mapa nem baixa tudo de novo.
import { candidatura, RAIO_KM } from '../config.ts'
import { textos } from '../conteudo/textos.ts'
import { menosMovimentoAgora } from '../util/midia.ts'
import type { Motor } from './motor.ts'
import { localeDoMapa } from './rotulos.ts'

let no: HTMLDivElement | null = null
let promessa: Promise<Motor> | null = null
let pronto: Motor | null = null

export function noDoMapa(): HTMLDivElement {
  if (no === null) {
    no = document.createElement('div')
    no.className = 'mapa-no'
  }
  return no
}

export function motorCarregado(): Motor | null {
  return pronto
}

/**
 * Carrega o MapLibre na primeira chamada; falha não fica guardada (a próxima tenta de novo).
 * `pontoInicial` (link recebido) só vale na criação: o mapa já nasce enquadrado no raio, sem baixar o Brasil inteiro.
 */
export function obterMotor(pontoInicial: { lat: number; lon: number } | null = null): Promise<Motor> {
  if (promessa !== null) return promessa
  const nova = import('./motor.ts')
    .then(({ criarMotor }) =>
      criarMotor(noDoMapa(), {
        estiloUrl: candidatura.mapa.estiloUrl,
        fonteTiles: candidatura.mapa.fonteTiles,
        centro: [candidatura.mapa.centroInicial[0], candidatura.mapa.centroInicial[1]],
        zoom: candidatura.mapa.zoomInicial,
        pontoInicial,
        raioKm: RAIO_KM,
        locale: localeDoMapa(),
        rotuloPonto: textos.acessibilidade.pontoEscolhido,
        menosMovimento: menosMovimentoAgora,
      }),
    )
    .then((m) => {
      pronto = m
      return m
    })
  nova.catch(() => {
    if (promessa === nova) promessa = null
  })
  promessa = nova
  return nova
}
