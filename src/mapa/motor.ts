// Motor do mapa (MapLibre). Este módulo só é carregado sob demanda: fica fora do JS de entrada.
// Uma instância por aba; o nó do contêiner muda de encaixe (celular/desktop) sem remontar o mapa.
import type { GeoJSONSource, LngLatBoundsLike, Map as MapaML, MapMouseEvent, Marker } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { circuloGeoJSON, haversineKm } from '../../nucleo/geo.ts'
import { CAMADAS, camadaDensidade, camadasRaio, camadasRegioes, colecao, featuresRegioes, FONTES, ZOOM_QUADRADOS, type Marcador } from './camadas.ts'
import { carregarMapLibre, type BibliotecaMapa } from './biblioteca.ts'
import { Densidade, type FonteDensidade } from './densidade.ts'
import { carregarEstilo } from './estilo.ts'
import type { LocaleMapa } from './rotulos.ts'

export type OpcoesMotor = {
  estiloUrl: string
  fonteTiles: string
  centro: [lon: number, lat: number]
  zoom: number
  /** Ponto já escolhido quando o mapa nasce (link recebido): o mapa nasce enquadrado nele, sem voar do Brasil. */
  pontoInicial: Ponto | null
  raioKm: number
  /** Textos da interface do MapLibre (src/mapa/rotulos.ts). */
  locale: LocaleMapa
  rotuloPonto: string
  menosMovimento: () => boolean
}

type Ponto = { lat: number; lon: number }

// Folga em volta do toque para achar um marcador: maior no dedo (pointer: coarse) do que no mouse.
const FOLGA_CLIQUE_PX = 6
const FOLGA_TOQUE_PX = 12
const PADDING_RAIO_PX = 12
const ZOOM_MAXIMO_RAIO = 16
const MARGEM_CENTRAL = 0.1
/** Acima disto o mapa salta direto para o ponto: o voo animado baixa tiles de todos os zooms no caminho. */
const SALTO_ANIMADO_KM = 30

/** Caixa que contém o círculo do raio em volta do ponto. */
function caixaDoRaio(ponto: Ponto, raioKm: number): LngLatBoundsLike {
  const anel = circuloGeoJSON(ponto.lat, ponto.lon, raioKm).geometry.coordinates[0] ?? []
  const lons = anel.map(([lon]) => lon)
  const lats = anel.map(([, lat]) => lat)
  return [
    [Math.min(...lons), Math.min(...lats)],
    [Math.max(...lons), Math.max(...lats)],
  ]
}

// Só espera o 'load': erro de tile antes disso não impede o mapa de abrir (vira aviso no console).
function esperarCarga(mapa: MapaML): Promise<void> {
  return new Promise((resolver) => {
    if (mapa.loaded()) resolver()
    else mapa.once('load', () => resolver())
  })
}

export class Motor {
  private readonly mapa: MapaML
  private readonly op: OpcoesMotor
  private readonly densidade: Densidade
  private readonly marcadorPonto: Marker
  private marcadores: readonly Marcador[] = []
  private selecionada: string | null = null
  private aoEscolher: (lat: number, lon: number) => void = () => undefined
  private aoAbrir: (id: string) => void = () => undefined

  constructor(ml: BibliotecaMapa, mapa: MapaML, op: OpcoesMotor) {
    this.mapa = mapa
    this.op = op
    this.densidade = new Densidade(op.raioKm, (qual, dados) => this.fonte(qual === 'resumo' ? FONTES.resumo : FONTES.quadrados)?.setData(dados))
    const el = document.createElement('div')
    el.className = 'ponto-escolhido'
    el.setAttribute('role', 'img')
    el.setAttribute('aria-label', op.rotuloPonto)
    this.marcadorPonto = new ml.Marker({ element: el })
    this.montarCamadas()
    this.ligarEventos()
  }

  aoEscolherPonto(cb: (lat: number, lon: number) => void): void {
    this.aoEscolher = cb
  }

  aoAbrirRegiao(cb: (id: string) => void): void {
    this.aoAbrir = cb
  }

  redimensionar(): void {
    this.mapa.resize()
  }

  /** Celular: um dedo rola a página e dois movem o mapa (o mapa embutido não prende a rolagem nem troca o ponto
   *  num toque acidental). Desktop: gestos normais. */
  usarGestosCooperativos(ativo: boolean): void {
    if (ativo) this.mapa.cooperativeGestures.enable()
    else this.mapa.cooperativeGestures.disable()
  }

  usarDensidade(fonte: FonteDensidade): void {
    this.densidade.usarFonte(fonte)
    // Com a câmera indo até um ponto (link recebido), espera o moveend: evita baixar o resumo do país à toa.
    if (!this.mapa.isMoving()) this.atualizarDensidade()
  }

  definirPonto(ponto: Ponto | null): void {
    this.densidade.definirCentro(ponto)
    if (ponto === null) {
      this.marcadorPonto.remove()
      this.fonte(FONTES.raio)?.setData({ type: 'FeatureCollection', features: [] })
      return
    }
    this.fonte(FONTES.raio)?.setData(circuloGeoJSON(ponto.lat, ponto.lon, this.op.raioKm))
    this.marcadorPonto.setLngLat([ponto.lon, ponto.lat]).addTo(this.mapa)
    const centro = this.mapa.getCenter()
    const perto = haversineKm({ lat: centro.lat, lon: centro.lng }, [ponto.lat, ponto.lon]) <= SALTO_ANIMADO_KM
    const animar = perto && !this.op.menosMovimento()
    this.mapa.fitBounds(caixaDoRaio(ponto, this.op.raioKm), { padding: PADDING_RAIO_PX, animate: animar, maxZoom: ZOOM_MAXIMO_RAIO })
  }

  definirMarcadores(marcadores: readonly Marcador[]): void {
    this.marcadores = marcadores
    this.redesenharRegioes()
  }

  selecionar(id: string | null): void {
    this.selecionada = id
    this.redesenharRegioes()
    const m = id === null ? undefined : this.marcadores.find((x) => x.id === id)
    if (m !== undefined) this.trazerParaOCentro(m)
  }

  private fonte(id: string): GeoJSONSource | undefined {
    return this.mapa.getSource<GeoJSONSource>(id)
  }

  private redesenharRegioes(): void {
    this.fonte(FONTES.regioes)?.setData(featuresRegioes(this.marcadores, this.selecionada))
  }

  /** Região escolhida fora dos 80% centrais da tela: o mapa vai até ela. */
  private trazerParaOCentro(m: Marcador): void {
    const { x, y } = this.mapa.project([m.lon, m.lat])
    const { clientWidth: w, clientHeight: h } = this.mapa.getContainer()
    const dentro = x > w * MARGEM_CENTRAL && x < w * (1 - MARGEM_CENTRAL) && y > h * MARGEM_CENTRAL && y < h * (1 - MARGEM_CENTRAL)
    if (!dentro) this.mapa.panTo([m.lon, m.lat], { animate: !this.op.menosMovimento() })
  }

  private montarCamadas(): void {
    const vazio = colecao<Record<string, never>>([])
    Object.values(FONTES).forEach((id) => this.mapa.addSource(id, { type: 'geojson', data: vazio }))
    // Densidade e raio ficam por baixo dos nomes do mapa; marcadores por cima de tudo.
    const primeiroRotulo = this.mapa.getStyle().layers.find((l) => l.type === 'symbol')?.id
    this.mapa.addLayer(camadaDensidade(CAMADAS.resumo, FONTES.resumo, { maxzoom: ZOOM_QUADRADOS }), primeiroRotulo)
    this.mapa.addLayer(camadaDensidade(CAMADAS.quadrados, FONTES.quadrados, { minzoom: ZOOM_QUADRADOS }), primeiroRotulo)
    camadasRaio().forEach((c) => this.mapa.addLayer(c, primeiroRotulo))
    camadasRegioes().forEach((c) => this.mapa.addLayer(c))
  }

  private ligarEventos(): void {
    this.mapa.on('moveend', () => this.atualizarDensidade())
    this.mapa.on('click', (e) => this.clicar(e))
    this.mapa.on('mouseenter', CAMADAS.regioes, () => {
      this.mapa.getCanvas().style.cursor = 'pointer'
    })
    this.mapa.on('mouseleave', CAMADAS.regioes, () => {
      this.mapa.getCanvas().style.cursor = ''
    })
  }

  private clicar(e: MapMouseEvent): void {
    const { x, y } = e.point
    const dedo = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches
    const folga = dedo ? FOLGA_TOQUE_PX : FOLGA_CLIQUE_PX
    const achados = this.mapa.queryRenderedFeatures(
      [
        [x - folga, y - folga],
        [x + folga, y + folga],
      ],
      { layers: [CAMADAS.regioesCentro, CAMADAS.regioes] },
    )
    const id: unknown = achados[0]?.properties.id
    if (typeof id === 'string') this.aoAbrir(id)
    else this.aoEscolher(e.lngLat.lat, e.lngLat.lng)
  }

  private atualizarDensidade(): void {
    const b = this.mapa.getBounds()
    this.densidade.atualizar(this.mapa.getZoom(), { oeste: b.getWest(), sul: b.getSouth(), leste: b.getEast(), norte: b.getNorth() })
  }
}

export async function criarMotor(no: HTMLElement, op: OpcoesMotor): Promise<Motor> {
  const [ml, estilo] = await Promise.all([carregarMapLibre(), carregarEstilo(op.estiloUrl, op.fonteTiles)])
  const camera = op.pontoInicial === null
    ? { center: op.centro, zoom: op.zoom }
    : { bounds: caixaDoRaio(op.pontoInicial, op.raioKm), fitBoundsOptions: { padding: PADDING_RAIO_PX, maxZoom: ZOOM_MAXIMO_RAIO } }
  const mapa = new ml.Map({
    container: no,
    style: estilo,
    ...camera,
    attributionControl: { compact: false },
    locale: op.locale,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    maxPitch: 0,
    renderWorldCopies: false,
    reduceMotion: op.menosMovimento(),
  })
  mapa.touchZoomRotate.disableRotation()
  mapa.keyboard.disableRotation()
  // Só + e −: o mapa não gira, então a bússola não faz sentido.
  mapa.addControl(new ml.NavigationControl({ showCompass: false, visualizePitch: false }), 'top-right')
  // Sem ouvinte, o MapLibre manda todo tile que falhou para console.error.
  mapa.on('error', (e) => console.warn('Mapa:', e.error.message))
  await esperarCarga(mapa)
  return new Motor(ml, mapa, op)
}
