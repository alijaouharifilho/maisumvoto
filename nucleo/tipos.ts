// Tipos do contrato de dados (docs/CONTRATO.md). Fonte de verdade do formato de public/dados/.
// Nada aqui pode citar candidato por nome: alvo e adversário vêm de config/candidatura.json.

export type NumeroCandidato = string

export type Votos = {
  aptos: number
  comparecimento: number
  abstencao: number
  brancos: number
  nulos: number
  nominais: Record<NumeroCandidato, number>
}

export type Local = {
  nome: string
  endereco: string
  cep: string
  zona: number
  nr: number
  secoes: number[]
}

export type Regiao = {
  id: string
  uf: string
  mun: string
  municipio: string
  bairro: string
  lat: number
  lon: number
  posicao: 'tse' | 'reserva'
  locais: Local[]
  eleitores: number
  secoes: number
  votos: Votos | null
}

export type Classificacao =
  | 'semVotos'
  | 'empate'
  | 'folga'
  | 'aDefender'
  | 'alvoNaFrente'
  | 'aVirar'
  | 'dificil'

export type RegraViravel = 'abertos' | 'abertosMaisOutros'

/** Por que um local de votação fica fora do mapa e da busca (CD_TIPO_LOCAL 2 e 3 do cadastro do TSE). */
export type MotivoForaDoMapa = 'presoProvisorio' | 'votoEmTransito'

export type Totais = {
  secoes: number
  aptos: number
  comparecimento: number
  abstencao: number
  brancos: number
  nulos: number
  nominais: Record<NumeroCandidato, number>
}

export type TotaisBrasil = Totais & {
  regioes: number
  regioesNoMapa: number
  ate: number
  classificacao: Record<Classificacao, number>
  viraveis: Record<RegraViravel, number>
  /** Eleitores de locais que ficam fora do mapa e da busca, mas entram nos totais (CONTRATO §2.1). */
  eleitoresForaDoMapa: Record<MotivoForaDoMapa, number>
}

export type TotaisUf = {
  secoes: number
  aptos: number
  regioes: number
  regioesNoMapa: number
  eleitoresSemPosicao: number
  eleitoresPosicaoReserva: number
  eleitoresForaDoMapa: Record<MotivoForaDoMapa, number>
  ate: number
}

export type Fonte = {
  id: string
  url: string
  dataGeracao: string | null
  sha256: string
}

export type Indice = {
  esquema: 1
  versao: string
  geradoEm: string
  eleicao: { codigo: string; pleito: string; turno: number; cargo: string }
  celulaGraus: number
  candidatos: Record<NumeroCandidato, { nome: string; partido: string }>
  brasil: TotaisBrasil
  exterior: Totais
  ufs: Record<string, TotaisUf>
  quadrados: string[]
  conferencia: { ok: boolean; referencia: string; diferencas: string[] }
  fontes: Fonte[]
}

export type PontosCompactos = { escala: number; d: number[] }

export type ArquivoSecoes = {
  secoes: Record<string, Omit<Votos, 'abstencao'>>
}

export type ItemBusca = {
  t: 'm' | 'b' | 'l'
  n: string
  m?: string
  uf: string
  lat: number
  lon: number
  e: number
}

export type ArquivoCep = Record<string, { lat: number; lon: number; m: string; uf: string; b: string }>

// ── Configuração (config/candidatura.json) ───────────────────────────────────

export type Candidato = { numero: NumeroCandidato; nomeCurto: string; nomeUrna: string; partido: string }

export type IdFase = 'campanha' | 'retaFinal' | 'pausa' | 'votacao' | 'encerrada'

export type Candidatura = {
  esquema: 1
  eleicao: { ano: number; codigo: string; pleito: string; turno: number; cargo: string; data2T: string }
  alvo: Candidato
  adversario: Candidato
  reclassificarComoNulo: NumeroCandidato[]
  metricas: {
    raioKm: number
    celulaGraus: number
    gradeLinkGraus: number
    limiarFolga: number
    regraViravel: RegraViravel
  }
  gruposConversa: Record<string, string>
  calendario: {
    fuso: string
    fases: { id: IdFase; ate: string | null }[]
    fasesAbertas: IdFase[]
  }
  site: {
    nome: string
    dominio: string
    natureza: 'independente' | 'campanha'
    responsavel: { nome: string | null; contato: string | null }
    hospedagem: string | null
    redeSocial: string | null
  }
  mapa: { estiloUrl: string; fonteTiles: string; centroInicial: [number, number]; zoomInicial: number }
  prefixoArmazenamento: string
}

export type RegrasBusca = {
  tamanhoPrefixo: number
  minLetrasPalavraChave: number
  minLetrasReserva: number
  maxResultados: number
  genericas: string[]
}
