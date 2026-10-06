// Estilo do mapa: public/mapa/estilo.json (Positron do OpenFreeMap recolorido). A fonte dos tiles vem da config,
// para trocar de provedor sem mexer no estilo.
import type { StyleSpecification } from 'maplibre-gl'

const FONTE_VETORIAL = 'openmaptiles'

function ehObjeto(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null && !Array.isArray(x)
}

/** Confere o mínimo que o MapLibre precisa e troca a URL da fonte vetorial pela da config. */
export function prepararEstilo(bruto: unknown, fonteTiles: string): StyleSpecification {
  if (!ehObjeto(bruto) || bruto.version !== 8 || !Array.isArray(bruto.layers) || !ehObjeto(bruto.sources)) {
    throw new Error('estilo do mapa fora do formato (esperado: version 8, sources, layers)')
  }
  const fonte = bruto.sources[FONTE_VETORIAL]
  if (!ehObjeto(fonte)) throw new Error(`estilo do mapa sem a fonte "${FONTE_VETORIAL}"`)
  const sources = { ...bruto.sources, [FONTE_VETORIAL]: { ...fonte, url: fonteTiles } }
  return { ...bruto, sources } as unknown as StyleSpecification
}

export async function carregarEstilo(url: string, fonteTiles: string): Promise<StyleSpecification> {
  const resposta = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!resposta.ok) throw new Error(`estilo do mapa: HTTP ${resposta.status}`)
  return prepararEstilo(await resposta.json(), fonteTiles)
}
