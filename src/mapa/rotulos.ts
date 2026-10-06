// Textos da interface do próprio MapLibre (botões de zoom, créditos, rótulo do mapa) em português.
// O MapLibre lê pela opção `locale` do Map; as chaves são as do default_locale dele. testes/front/mapa.test.ts
// confere que cada chave existe na versão instalada (chave errada cairia calada no texto em inglês).
import { textos } from '../conteudo/textos.ts'

export type LocaleMapa = Readonly<Record<string, string>>

export function localeDoMapa(): LocaleMapa {
  const c = textos.mapa.controles
  return {
    'Map.Title': c.quadro,
    'Marker.Title': textos.acessibilidade.pontoEscolhido,
    'NavigationControl.ZoomIn': c.aproximar,
    'NavigationControl.ZoomOut': c.afastar,
    'NavigationControl.ResetBearing': c.norte,
    'AttributionControl.ToggleAttribution': c.creditos,
    'AttributionControl.MapFeedback': c.corrigirMapa,
    'CooperativeGesturesHandler.MobileHelpText': c.doisDedos,
    'CooperativeGesturesHandler.WindowsHelpText': c.zoomWindows,
    'CooperativeGesturesHandler.MacHelpText': c.zoomMac,
  }
}
