// Hex da paleta "Prosa de vizinho" para quem não lê CSS: o mapa (MapLibre) e a imagem OG.
// Mesmos valores de src/estilo/tokens.css (lá em oklch); testes/front/paleta.test.ts confere que não divergem.
export const PALETA = {
  papel: '#fcfaf2',
  papel2: '#f3f0e4',
  linha: '#d2d8dd',
  tinta: '#161b20',
  tintaSuave: '#515d65',
  mata: '#0c6944',
  mataEscura: '#025032',
  mataClara: '#d5f0e0',
  ambar: '#f1aa47',
  ambarTexto: '#8f5d14',
  petroleo: '#115667',
  petroleoClaro: '#d7ecf4',
  alerta: '#be241f',
  adversario: '#cc272e',
  branco: '#ffffff',
} as const

export type CorPaleta = keyof typeof PALETA
