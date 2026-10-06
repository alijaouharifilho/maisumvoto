// Textos da tela do mapa (rota #/mapa): abertura, busca, resultado, disputa, lista e estados.
// Números chegam crus (inteiros e frações 0–1) e são formatados aqui; distância e fração humana chegam prontas
// do núcleo (regras em nucleo/frases.ts). "Até" é sempre teto: nunca previsão.
import type { Classificacao, RegraViravel } from '../../../nucleo/tipos.ts'
import { contagem, formatarNumero as numero, formatarPct as porcento, listaHumana as emLista, plural } from '../../../nucleo/frases.ts'
import { naData } from './moldura.ts'
import type { Nomes } from './tipos.ts'

/** Quem conta no reservatório da regra de "virar" (config: metricas.regraViravel). */
const RESERVATORIO: Record<RegraViravel, { readonly um: string; readonly varios: string }> = {
  abertos: { um: 'não foi votar, votou em branco ou anulou', varios: 'não foram votar, votaram em branco ou anularam' },
  abertosMaisOutros: { um: 'não votou em nenhum dos dois finalistas', varios: 'não votaram em nenhum dos dois finalistas' },
}

function ficouFora(n: number, regra: RegraViravel): string {
  return `${contagem(n, 'pessoa', 'pessoas')} ${plural(n, RESERVATORIO[regra].um, RESERVATORIO[regra].varios)}`
}

const votos = (n: number): string => contagem(n, 'voto', 'votos')

export const abertura = {
  selo: (dia2T: string) => `2º turno: ${dia2T}`,
  titulo: (nomeSite: string) => `${nomeSite} começa numa conversa`,
  chamada: (alvo: string, fimConversa: string) =>
    `Muita gente não votou em nenhum dos dois finalistas no 1º turno. Escolha um ponto e veja quantas delas votam ali, como foi a disputa e que assunto do plano de ${alvo} puxar. Conversa de vizinho para vizinho, até ${fimConversa}.`,
  /** Fases fechadas (pausa, votação, encerrada): sem convite para conversar, só consulta. */
  chamadaConsulta: (fimConversa: string) =>
    `Aqui ficam, para consulta, os números do 1º turno: onde votam as pessoas que não votaram em nenhum dos dois finalistas e como foi a disputa em cada local. A conversa terminou ${naData(fimConversa)}.`,
  brasilAte: 'pessoas no Brasil não votaram em nenhum dos dois finalistas no 1º turno',
  brasilViraveis: 'pontos do mapa (locais de votação) onde, em tese, dá para virar',
  notaViraveis: (nomes: Nomes, regra: RegraViravel) =>
    `“Dá para virar”: ${nomes.adversario} ficou à frente no local, e as pessoas que ${RESERVATORIO[regra].varios} são mais do que a diferença. É um teto, como se todas escolhessem ${nomes.alvo}. Não é previsão nem pesquisa.`,
} as const

export const mapa = {
  dica: 'Toque ou clique no mapa para escolher um ponto.',
  rotulo: 'Mapa dos locais de votação. A lista traz as mesmas informações em texto.',
  atribuicao: '© colaboradores do OpenStreetMap · OpenFreeMap',
  falhou: 'O mapa não abriu neste aparelho. A busca e a lista funcionam normalmente.',
  tentarDeNovo: 'Tentar abrir o mapa de novo',
  /** Botões e dicas do próprio MapLibre (opção locale do mapa; chaves em src/mapa/rotulos.ts). */
  controles: {
    /** Nome do quadro interativo (curto e diferente do rótulo da seção, que já diz o que é o mapa). */
    quadro: 'Mapa interativo: as setas movem, + e − aproximam e afastam',
    aproximar: 'Aproximar',
    afastar: 'Afastar',
    norte: 'Voltar o mapa para o norte',
    creditos: 'Mostrar ou esconder os créditos do mapa',
    corrigirMapa: 'Sugerir uma correção no mapa',
    doisDedos: 'Use dois dedos para mover o mapa',
    zoomWindows: 'Use Ctrl + rolagem para aproximar o mapa',
    zoomMac: 'Use ⌘ + rolagem para aproximar o mapa',
  },
} as const

/** Exemplo da dica de busca. Precisa existir nos dados: testes/busca-dados.test.ts confere. */
export const EXEMPLO_BUSCA = 'Boa Viagem, Recife'

export const busca = {
  rotulo: 'Onde você quer conversar?',
  placeholder: 'Bairro, cidade ou CEP',
  buscar: 'Buscar',
  buscando: 'Buscando…',
  minhaLocalizacao: 'Usar minha localização',
  localizando: 'Pegando sua localização…',
  dica: 'ou escolha no mapa',
  sugestoes: (n: number) => `Achamos ${numero(n)} lugares. Qual deles?`,
  /** CEP digitado que não é de local de votação: o ponto é o do CEP de local mais parecido (mesmo setor). */
  cepAproximado: (cep: string, lugar: string) => `Perto do CEP ${cep} · ${lugar}`,
  origem: {
    link: 'Ponto recebido por link',
    mapa: 'Ponto escolhido no mapa',
    localizacao: 'Perto da sua localização',
  },
  erros: {
    curto: (minimo: number) => `Digite pelo menos ${minimo} letras.`,
    nadaEncontrado: `Não achamos esse lugar. Tente o bairro e a cidade separados por vírgula, como “${EXEMPLO_BUSCA}”.`,
    cepNaoEncontrado: 'Esse CEP não está entre os dos locais de votação. Tente o nome do bairro.',
    localizacaoIndisponivel: 'Este aparelho ou navegador não informa a localização. Busque pelo bairro ou toque no mapa.',
    localizacaoNegada: 'Não deu para pegar sua localização: a permissão foi negada ou demorou demais. Busque pelo bairro ou toque no mapa.',
    falhaBusca: 'A busca não respondeu. Tente de novo em instantes.',
  },
} as const

export const carregando = {
  site: 'Carregando o site…',
  regioes: 'Carregando os números deste ponto…',
} as const

export type Manchete = { readonly antes: string; readonly numero: string; readonly depois: string }

export const resultado = {
  /** Fase aberta. Partes separadas para o número poder ser animado. */
  manchete: (ate: number): Manchete => ({
    antes: 'Perto daqui, você pode conversar com até',
    numero: numero(ate),
    depois: ate === 1
      ? 'pessoa que não votou em nenhum dos dois finalistas.'
      : 'pessoas que não votaram em nenhum dos dois finalistas.',
  }),
  notaTeto: '“Até” porque é o máximo possível: muita gente já decidiu, e conversa é convite, não garantia.',
  /** Fases fechadas: frase neutra, sem convite. */
  mancheteNeutra: (ate: number, nomes: Nomes, raio: string) =>
    `Num raio de ${raio}, ${contagem(ate, 'pessoa', 'pessoas')} ${ate === 1 ? 'não votou' : 'não votaram'} em ${nomes.alvo} nem em ${nomes.adversario} no 1º turno.`,
  parcela: {
    brancos: (n: number) => `${numero(n)} ${plural(n, 'votou', 'votaram')} em branco`,
    nulos: (n: number) => `${numero(n)} ${plural(n, 'anulou', 'anularam')}`,
    abstencao: (n: number) => `${numero(n)} ${plural(n, 'não foi votar', 'não foram votar')}`,
    candidato: (n: number, nome: string) => `${numero(n)} ${plural(n, 'votou', 'votaram')} em ${nome}`,
    outros: (n: number) => `${numero(n)} ${plural(n, 'votou', 'votaram')} em outros candidatos`,
  },
  decomposicao: (parcelas: readonly string[]) => `Dessas pessoas, ${emLista(parcelas)}.`,
  /** fracao = fracaoHumana(ate / eleitores) do núcleo ({ texto: "1 em cada 3", numerador: 1 }). */
  alcance: (eleitores: number, fracao: { readonly texto: string; readonly numerador: number }) =>
    `${contagem(eleitores, 'pessoa vota', 'pessoas votam')} neste raio: ${fracao.texto} ${fracao.numerador === 1 ? 'ficou' : 'ficaram'} fora dos dois finalistas.`,
} as const

export const alvoAqui = {
  porAqui: (alvo: string) => `Votos de ${alvo} por aqui`,
  nesteLocal: (alvo: string) => `Votos de ${alvo} neste local`,
  valor: (fracao: number, votosAlvo: number) => `${porcento(fracao)} dos votos válidos (${votos(votosAlvo)})`,
  notaValidos: 'Votos válidos são os dados a algum candidato. Brancos e nulos ficam de fora.',
  notaFolga: (alvo: string, limiar: number) =>
    `Aqui, ${alvo} teve ${porcento(limiar)} ou mais dos votos válidos. A conversa costuma render mais onde a disputa está apertada: vale olhar os locais vizinhos.`,
  ariaBarra: (alvo: string, fracao: number) => `${alvo}: ${porcento(fracao)} dos votos válidos. A marca do meio é 50%.`,
} as const

export type DadosDisputa = {
  readonly nomes: Nomes
  readonly votosAlvo: number
  readonly votosAdversario: number
  /** Reservatório da regra (contrato §3): abertos, ou abertos + outros. */
  readonly reservatorio: number
  readonly regra: RegraViravel
}

function placar(p: DadosDisputa, alvoNaFrente: boolean): string {
  const [primeiro, segundo] = alvoNaFrente ? [p.votosAlvo, p.votosAdversario] : [p.votosAdversario, p.votosAlvo]
  return `${numero(primeiro)} a ${numero(segundo)}`
}

const diferenca = (p: DadosDisputa): string => votos(Math.abs(p.votosAlvo - p.votosAdversario))

/** Reservatório igual à diferença: o núcleo classifica como "à frente"/"difícil" (a regra pede ">"), mas a frase não
 *  pode dizer "maior que" nem "mais do que" (veracidade). */
const igualOuMaior = (p: DadosDisputa): boolean => p.reservatorio === Math.abs(p.votosAlvo - p.votosAdversario)

/** Uma frase por classificação (contrato §3). Ordem e regras de cada uma estão no núcleo. */
export const disputa: Record<Classificacao, (p: DadosDisputa) => string> = {
  semVotos: () => 'Ainda não há votos válidos registrados aqui.',
  empate: (p) =>
    `Empate: ${votos(p.votosAlvo)} para cada um. E ${ficouFora(p.reservatorio, p.regra)}. Aqui, cada conversa pode desempatar.`,
  folga: (p) =>
    `${p.nomes.alvo} ficou bem à frente: ${placar(p, true)}. A vantagem é confortável; a conversa pode render mais onde a disputa está apertada.`,
  aDefender: (p) =>
    `${p.nomes.alvo} ficou à frente por ${diferenca(p)} (${placar(p, true)}). Mas ${ficouFora(p.reservatorio, p.regra)}, mais do que essa diferença. Aqui, conversar é cuidar da vantagem.`,
  alvoNaFrente: (p) =>
    `${p.nomes.alvo} ficou à frente por ${diferenca(p)} (${placar(p, true)}). A vantagem é ${igualOuMaior(p) ? 'igual ao' : 'maior que o'} número de pessoas que ficaram fora dos dois (${numero(p.reservatorio)}).`,
  aVirar: (p) =>
    `${p.nomes.adversario} ficou à frente por ${diferenca(p)} (${placar(p, false)}). Como ${ficouFora(p.reservatorio, p.regra)}, mais do que essa diferença, em tese dá para virar. É um teto, não uma previsão.`,
  dificil: (p) =>
    `${p.nomes.adversario} ficou à frente por ${diferenca(p)} (${placar(p, false)}), ${igualOuMaior(p) ? 'o mesmo número de' : 'mais do que as'} pessoas que ficaram fora dos dois (${numero(p.reservatorio)}). Virar aqui é difícil, mas para presidente todo voto soma no total do país.`,
}

export const lista = {
  titulo: 'Locais de votação perto do ponto',
  ordenar: 'Organizar a lista',
  perto: 'Mais gente',
  porBairro: 'Por bairro',
  raio: (raio: string) => `Num raio de ${raio}`,
  legendaComResultado: 'Cor: quem ficou à frente no 1º turno. Miolo: onde a conversa pode mudar o lado.',
  legendaSemResultado: 'Sem resultado ainda',
  itemDetalhe: (partes: { bairro: string; distancia: string; eleitores: number; alvo: string; fracaoAlvo: number | null }) =>
    [partes.bairro, partes.distancia, contagem(partes.eleitores, 'pessoa', 'pessoas'),
      partes.fracaoAlvo === null ? '' : `${partes.alvo} ${porcento(partes.fracaoAlvo)}`]
      .filter((p) => p !== '').join(' · '),
  itemAte: (ate: number) => `até ${numero(ate)}`,
  itemAteAria: (ate: number) => `até ${contagem(ate, 'pessoa', 'pessoas')} para conversar`,
  bairroResumo: (r: { ate: number; locais: number; eleitores: number; distancia: string }) =>
    `até ${numero(r.ate)} · ${contagem(r.locais, 'local', 'locais')} · ${contagem(r.eleitores, 'pessoa', 'pessoas')} · a partir de ${r.distancia}`,
  notaSemBairro: (n: number) =>
    `${contagem(n, 'local', 'locais')} sem bairro no cadastro do TSE ${plural(n, 'aparece', 'aparecem')} só em “Mais gente”.`,
  notaSemResultado: (n: number) => `${contagem(n, 'local', 'locais')} neste raio ainda sem resultado nos dados.`,
  notaOrdem: 'Ordem: do maior “até” para o menor; no empate, o mais perto primeiro.',
} as const

export const vazio = {
  semResultado: {
    titulo: 'Ainda sem resultado por aqui',
    texto: 'Há locais de votação neste raio, mas o resultado das seções deles ainda não está nos nossos dados. Tente um ponto vizinho.',
  },
  semLocal: {
    titulo: (raio: string) => `Nenhum local de votação num raio de ${raio}`,
    texto: (raio: string) => `Não achamos local de votação num raio de ${raio} deste ponto. Tente um ponto mais perto do centro do bairro ou da cidade.`,
  },
} as const

export const erroDados = {
  titulo: 'Não deu para carregar os dados',
  texto: 'Pode ser a conexão. Preferimos não mostrar número nenhum a mostrar um número errado.',
  tentar: 'Tentar de novo',
  tentando: 'Tentando de novo…',
} as const
