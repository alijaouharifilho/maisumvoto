// Camada de densidade: todos os locais com resultado, como pontinhos. Resumo (≈5 km) em zoom baixo;
// quadrados de 1° (≈100 m) do que está visível, cada um pedido uma vez só e só se o índice disser que existe.
import type { Feature, FeatureCollection, Point } from 'geojson'
import { celulasNoRaio } from '../../nucleo/geo.ts'
import { colecao, featuresPontos, foraDoRaio, quadradosNaCaixa, ZOOM_QUADRADOS, type Caixa, type PontoLatLon } from './camadas.ts'

export type FonteDensidade = {
  resumo(): Promise<readonly PontoLatLon[]>
  quadrado(chave: string): Promise<readonly PontoLatLon[]>
  existe(chave: string): boolean
}

type Centro = { lat: number; lon: number } | null
type PontoGeo = Feature<Point, Record<string, never>>
export type Desenhar = (qual: 'resumo' | 'quadrados', dados: FeatureCollection<Point, Record<string, never>>) => void

const QUADRADO_GRAUS = 1

export class Densidade {
  private fonte: FonteDensidade | null = null
  private centro: Centro = null
  private resumo: readonly PontoLatLon[] | null = null
  private pediuResumo = false
  private agendado = false
  private readonly carregados = new Map<string, readonly PontoLatLon[]>()
  private readonly prontos = new Map<string, PontoGeo[]>()
  private readonly pedidos = new Set<string>()
  private readonly raioKm: number
  private readonly desenhar: Desenhar

  constructor(raioKm: number, desenhar: Desenhar) {
    this.raioKm = raioKm
    this.desenhar = desenhar
  }

  usarFonte(fonte: FonteDensidade): void {
    this.fonte = fonte
  }

  atualizar(zoom: number, caixa: Caixa): void {
    const f = this.fonte
    if (f === null) return
    if (zoom < ZOOM_QUADRADOS) {
      this.pedirResumo(f)
      return
    }
    quadradosNaCaixa(caixa)
      .filter((c) => f.existe(c) && !this.carregados.has(c) && !this.pedidos.has(c))
      .forEach((c) => this.pedirQuadrado(f, c))
  }

  definirCentro(centro: Centro): void {
    this.centro = centro
    this.redesenharResumo()
    if (this.carregados.size > 0) this.agendar()
  }

  private pedirResumo(f: FonteDensidade): void {
    if (this.pediuResumo) return
    this.pediuResumo = true
    f.resumo().then(
      (p) => {
        this.resumo = p
        this.redesenharResumo()
      },
      (erro: unknown) => {
        this.pediuResumo = false
        console.warn('Densidade (resumo) indisponível', erro)
      },
    )
  }

  private pedirQuadrado(f: FonteDensidade, chave: string): void {
    this.pedidos.add(chave)
    f.quadrado(chave).then(
      (p) => {
        this.pedidos.delete(chave)
        this.carregados.set(chave, p)
        this.agendar()
      },
      (erro: unknown) => {
        this.pedidos.delete(chave)
        console.warn(`Densidade (${chave}) indisponível`, erro)
      },
    )
  }

  private agendar(): void {
    if (this.agendado) return
    this.agendado = true
    requestAnimationFrame(() => this.redesenharQuadrados())
  }

  private redesenharResumo(): void {
    if (this.resumo === null) return
    this.desenhar('resumo', colecao(featuresPontos(foraDoRaio(this.resumo, this.centro, this.raioKm))))
  }

  /** Só os quadrados perto do ponto são refiltrados; os outros reaproveitam as features já montadas. */
  private redesenharQuadrados(): void {
    this.agendado = false
    const c = this.centro
    const perto = new Set(c === null ? [] : celulasNoRaio(c.lat, c.lon, this.raioKm, QUADRADO_GRAUS))
    const features = [...this.carregados.entries()].flatMap(([chave, pontos]) => {
      if (perto.has(chave)) return featuresPontos(foraDoRaio(pontos, c, this.raioKm))
      const pronto = this.prontos.get(chave) ?? featuresPontos(pontos)
      this.prontos.set(chave, pronto)
      return pronto
    })
    this.desenhar('quadrados', colecao(features))
  }
}
