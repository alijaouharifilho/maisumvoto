// Link compartilhável por hash (CONTRATO §1): #/<rota>/<âncora>, com o ponto arredondado à grade.

export type Rota = 'mapa' | 'prosa' | 'plano' | 'comparar' | 'sobre'

export const ROTAS: readonly Rota[] = ['mapa', 'prosa', 'plano', 'comparar', 'sobre']
export const ROTA_PADRAO: Rota = 'mapa'

// Caixa do Brasil: fora dela a âncora é ignorada.
const LAT_MIN = -34
const LAT_MAX = 5.5
const LON_MIN = -74.5
const LON_MAX = -28.5

const RE_ANCORA = /^@?(-?\d{1,2}(?:\.\d+)?),(-?\d{1,2}(?:\.\d+)?)$/
const RE_FORA_DO_SEGURO = /[^A-Za-z0-9@,.\-_~/]/g

function decodificar(s: string): string | null {
  try {
    return decodeURIComponent(s)
  } catch {
    return null
  }
}

// H(x) = (floor(x/g + 0,5) · g) com 3 casas; o "+ 0" troca -0 por 0 para nunca escrever "-0.000".
export function arredondarLink(x: number, g: number): string {
  return (Math.floor(x / g + 0.5) * g + 0).toFixed(3)
}

export function formatarAncora(lat: number, lon: number, g: number): string {
  return `@${arredondarLink(lat, g)},${arredondarLink(lon, g)}`
}

export function lerAncora(s: string): { lat: number; lon: number } | null {
  const texto = decodificar(s.trim())
  const m = texto === null ? null : RE_ANCORA.exec(texto)
  if (m === null) return null
  const lat = Number(m[1])
  const lon = Number(m[2])
  const dentro = lat >= LAT_MIN && lat <= LAT_MAX && lon >= LON_MIN && lon <= LON_MAX
  return dentro ? { lat, lon } : null
}

function ehRota(s: string): s is Rota {
  return (ROTAS as readonly string[]).includes(s)
}

export function lerHash(hash: string): { rota: Rota; ancora: string | null } {
  const semPrefixo = hash.replace(/^#?\/?/, '').replace(/\?.*$/, '')
  const barra = semPrefixo.indexOf('/')
  const nome = (barra === -1 ? semPrefixo : semPrefixo.slice(0, barra)).toLowerCase()
  if (!ehRota(nome)) return { rota: ROTA_PADRAO, ancora: null }
  const bruta = barra === -1 ? '' : semPrefixo.slice(barra + 1)
  if (bruta === '') return { rota: nome, ancora: null }
  return { rota: nome, ancora: decodificar(bruta) ?? bruta }
}

export function montarHash(rota: Rota, ancora?: string | null): string {
  if (ancora === undefined || ancora === null || ancora === '') return `#/${rota}`
  return `#/${rota}/${ancora.replace(RE_FORA_DO_SEGURO, (c) => encodeURIComponent(c))}`
}
