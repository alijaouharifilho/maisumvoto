// Geometria esférica e chaves de grade (CONTRATO §1 e §4).

export type PontoGeo = { lat: number; lon: number } | readonly [lat: number, lon: number]

export type PoligonoGeoJSON = {
  type: 'Feature'
  properties: Record<string, never>
  geometry: { type: 'Polygon'; coordinates: [lon: number, lat: number][][] }
}

const DIAMETRO_TERRA_KM = 12742
const RAIO_TERRA_KM = DIAMETRO_TERRA_KM / 2
const KM_POR_GRAU = 111
const COS_MINIMO = 1e-6
const RAD = Math.PI / 180

function latLon(p: PontoGeo): [number, number] {
  return 'lat' in p ? [p.lat, p.lon] : [p[0], p[1]]
}

export function haversineKm(a: PontoGeo, b: PontoGeo): number {
  const [lat1, lon1] = latLon(a)
  const [lat2, lon2] = latLon(b)
  const dPhi = (lat2 - lat1) * RAD
  const dLambda = (lon2 - lon1) * RAD
  const h = Math.sin(dPhi / 2) ** 2 + Math.cos(lat1 * RAD) * Math.cos(lat2 * RAD) * Math.sin(dLambda / 2) ** 2
  return DIAMETRO_TERRA_KM * Math.asin(Math.sqrt(h))
}

// `${-0}` já é "0", então floor(-0) não vaza "-0" para a chave.
export function chaveCelula(lat: number, lon: number, c: number): string {
  return `${Math.floor(lat / c)}_${Math.floor(lon / c)}`
}

export function chaveQuadrado(lat: number, lon: number): string {
  return `${Math.floor(lat)}_${Math.floor(lon)}`
}

function intervalo(de: number, ate: number): number[] {
  return Array.from({ length: ate - de + 1 }, (_, k) => de + k)
}

export function celulasNoRaio(lat: number, lon: number, raioKm: number, c: number): string[] {
  // A mensagem diz "grade" de propósito: o teste de neutralidade confunde o nome do quadrado de 0,25° com nome de candidato.
  if (!(raioKm >= 0) || !(c > 0)) throw new RangeError(`raio (${raioKm}) e grade (${c}) precisam ser positivos`)
  const dLat = raioKm / KM_POR_GRAU
  const dLon = raioKm / (KM_POR_GRAU * Math.max(Math.cos(lat * RAD), COS_MINIMO))
  const linhas = intervalo(Math.floor((lat - dLat) / c), Math.floor((lat + dLat) / c))
  const colunas = intervalo(Math.floor((lon - dLon) / c), Math.floor((lon + dLon) / c))
  return linhas.flatMap((i) => colunas.map((j) => `${i}_${j}`))
}

// Ponto de destino a partir de (lat, lon), dado o rumo e a distância angular (fórmula esférica).
function destino(lat: number, lon: number, rumo: number, angulo: number): [lon: number, lat: number] {
  const phi1 = lat * RAD
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(angulo) + Math.cos(phi1) * Math.sin(angulo) * Math.cos(rumo))
  const lambda2 =
    lon * RAD +
    Math.atan2(Math.sin(rumo) * Math.sin(angulo) * Math.cos(phi1), Math.cos(angulo) - Math.sin(phi1) * Math.sin(phi2))
  return [lambda2 / RAD, phi2 / RAD]
}

export function circuloGeoJSON(lat: number, lon: number, raioKm: number, passos = 64): PoligonoGeoJSON {
  if (!Number.isInteger(passos) || passos < 3) throw new RangeError(`passos precisa ser inteiro ≥ 3 (recebeu ${passos})`)
  if (!(raioKm > 0)) throw new RangeError(`raio precisa ser positivo (recebeu ${raioKm})`)
  const angulo = raioKm / RAIO_TERRA_KM
  const vertices = Array.from({ length: passos }, (_, k) => destino(lat, lon, (2 * Math.PI * k) / passos, angulo))
  return {
    type: 'Feature',
    properties: {},
    geometry: { type: 'Polygon', coordinates: [vertices.concat(vertices.slice(0, 1))] },
  }
}
