// Dados e camadas do mapa, em funções puras (sem MapLibre em tempo de execução: só os tipos).
import type { Feature, FeatureCollection, Point } from 'geojson'
import type { CircleLayerSpecification, ExpressionSpecification, FillLayerSpecification, LineLayerSpecification } from 'maplibre-gl'
import { chaveQuadrado, haversineKm } from '../../nucleo/geo.ts'
import { PALETA } from '../estilo/paleta.ts'
import { CENTRO, RAIO_SEM_RESULTADO, raioMarcador, SELECIONADA, SIMBOLOGIA, type Classe, type Simbolo } from './simbologia.ts'

export type PontoLatLon = readonly [lat: number, lon: number]

export type Marcador = {
  readonly id: string
  readonly lat: number
  readonly lon: number
  readonly ate: number
  readonly classe: Classe
}

export type PropsRegiao = { id: string; classe: Classe; raio: number; centro: boolean; selecionada: boolean; ordem: number }

export const FONTES = {
  resumo: 'muv-densidade-resumo',
  quadrados: 'muv-densidade',
  raio: 'muv-raio',
  regioes: 'muv-regioes',
} as const

export const CAMADAS = {
  resumo: 'muv-densidade-resumo',
  quadrados: 'muv-densidade',
  raioPreenchimento: 'muv-raio-preenchimento',
  raioContorno: 'muv-raio-contorno',
  regioes: 'muv-regioes',
  regioesCentro: 'muv-regioes-centro',
} as const

/** Abaixo deste zoom a densidade vem do resumo (≈5 km); a partir dele, dos quadrados de 1° (≈100 m). */
export const ZOOM_QUADRADOS = 7
export const FOLGA_VIEWPORT = 0.15
const MAX_QUADRADOS_POR_VEZ = 400
const ORDEM_SELECIONADA = 1e12

export function colecao<P>(features: Feature<Point, P>[]): FeatureCollection<Point, P> {
  return { type: 'FeatureCollection', features }
}

export function featuresRegioes(marcadores: readonly Marcador[], selecionada: string | null): FeatureCollection<Point, PropsRegiao> {
  const comResultado = marcadores.filter((m) => m.classe !== 'semResultado')
  const maxAte = comResultado.reduce((max, m) => Math.max(max, m.ate), 1)
  return colecao(
    marcadores.map((m) => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [m.lon, m.lat] },
      properties: {
        id: m.id,
        classe: m.classe,
        raio: m.classe === 'semResultado' ? RAIO_SEM_RESULTADO : raioMarcador(m.ate, maxAte),
        centro: SIMBOLOGIA[m.classe].centro,
        selecionada: m.id === selecionada,
        ordem: m.id === selecionada ? ORDEM_SELECIONADA : m.ate,
      },
    })),
  )
}

export function featuresPontos(pontos: readonly PontoLatLon[]): Feature<Point, Record<string, never>>[] {
  return pontos.map(([lat, lon]) => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [lon, lat] }, properties: {} }))
}

/** Tira os pontos de densidade que caem no raio: ali entram os marcadores de verdade (mesma haversine da lista). */
export function foraDoRaio(pontos: readonly PontoLatLon[], centro: { lat: number; lon: number } | null, raioKm: number): PontoLatLon[] {
  if (centro === null) return [...pontos]
  return pontos.filter((p) => haversineKm(centro, p) > raioKm)
}

export type Caixa = { oeste: number; sul: number; leste: number; norte: number }

/** Quadrados de 1° que tocam a caixa com folga (fração do tamanho visível). */
export function quadradosNaCaixa(c: Caixa, folga = FOLGA_VIEWPORT): string[] {
  const dLat = (c.norte - c.sul) * folga
  const dLon = (c.leste - c.oeste) * folga
  const [i0, j0] = chaveQuadrado(c.sul - dLat, c.oeste - dLon).split('_').map(Number)
  const [i1, j1] = chaveQuadrado(c.norte + dLat, c.leste + dLon).split('_').map(Number)
  if (i0 === undefined || j0 === undefined || i1 === undefined || j1 === undefined) return []
  const total = (i1 - i0 + 1) * (j1 - j0 + 1)
  if (!(total > 0) || total > MAX_QUADRADOS_POR_VEZ) return []
  const chaves: string[] = []
  for (let i = i0; i <= i1; i += 1) for (let j = j0; j <= j1; j += 1) chaves.push(`${i}_${j}`)
  return chaves
}

function porClasse(campo: keyof Omit<Simbolo, 'centro'>): ExpressionSpecification {
  const pares = (Object.keys(SIMBOLOGIA) as Classe[]).flatMap((c) => [c, SIMBOLOGIA[c][campo]])
  return ['match', ['get', 'classe'], ...pares, SIMBOLOGIA.semResultado[campo]] as unknown as ExpressionSpecification
}

const RAIO_DENSIDADE: ExpressionSpecification = ['interpolate', ['linear'], ['zoom'], 4, 1.1, 7, 1.5, 10, 2.2, 12, 3]
const OPACIDADE_DENSIDADE: ExpressionSpecification = ['step', ['zoom'], 0.55, 8, 0.75]

export function camadaDensidade(id: string, fonte: string, faixa: { minzoom?: number; maxzoom?: number }): CircleLayerSpecification {
  return {
    id,
    type: 'circle',
    source: fonte,
    ...faixa,
    paint: { 'circle-color': PALETA.mata, 'circle-radius': RAIO_DENSIDADE, 'circle-opacity': OPACIDADE_DENSIDADE },
  }
}

export function camadasRaio(): [FillLayerSpecification, LineLayerSpecification] {
  return [
    { id: CAMADAS.raioPreenchimento, type: 'fill', source: FONTES.raio, paint: { 'fill-color': PALETA.mata, 'fill-opacity': 0.05 } },
    {
      id: CAMADAS.raioContorno,
      type: 'line',
      source: FONTES.raio,
      paint: { 'line-color': PALETA.mata, 'line-width': 1.5, 'line-dasharray': [3, 4] },
    },
  ]
}

export function camadasRegioes(): [CircleLayerSpecification, CircleLayerSpecification] {
  const sel = ['get', 'selecionada'] as unknown as ExpressionSpecification
  return [
    {
      id: CAMADAS.regioes,
      type: 'circle',
      source: FONTES.regioes,
      layout: { 'circle-sort-key': ['get', 'ordem'] },
      paint: {
        'circle-radius': ['get', 'raio'],
        'circle-color': porClasse('preenchimento'),
        'circle-stroke-color': ['case', sel, SELECIONADA.contorno, porClasse('contorno')],
        'circle-stroke-width': ['case', sel, SELECIONADA.largura, porClasse('largura')],
      },
    },
    {
      id: CAMADAS.regioesCentro,
      type: 'circle',
      source: FONTES.regioes,
      filter: ['==', ['get', 'centro'], true],
      layout: { 'circle-sort-key': ['get', 'ordem'] },
      paint: {
        'circle-radius': CENTRO.raio,
        'circle-color': CENTRO.preenchimento,
        'circle-stroke-color': CENTRO.contorno,
        'circle-stroke-width': CENTRO.largura,
      },
    },
  ]
}
