// Textos da moldura e das telas fora do mapa: metadados, navegação, ficha, compartilhar, fases do calendário,
// rodapé, páginas de conteúdo, acessibilidade e mensagens do sistema.
import type { Classificacao, IdFase } from '../../../nucleo/tipos.ts'
import { contagem, formatarNumero as numero, listaHumana as emLista, plural } from '../../../nucleo/frases.ts'
import type { Apoiado, Nomes, Responsavel } from './tipos.ts'

/** "no sábado, 24/10, às 22h" / "na segunda-feira, 05/10": a data por extenso com a preposição certa. */
export function naData(data: string): string {
  return `${/^(sábado|domingo)/.test(data) ? 'no' : 'na'} ${data}`
}

export const meta = {
  titulo: (nomeSite: string) => `${nomeSite}: mapa para conversar antes do 2º turno`,
  descricao: (apoiado: Apoiado) =>
    `Escolha um ponto no mapa e veja onde votam pessoas que não votaram em nenhum dos dois finalistas no 1º turno, como foi a disputa ali e o que conversar. Site independente de apoio a ${apoiado.nome} (${apoiado.numero}); não é oficial.`,
  ogTitulo: (nomeSite: string) => `${nomeSite}: uma conversa de cada vez`,
  /** Vai também no index.html estático (robôs de prévia não rodam JS): sem nome, mas dizendo que é de apoio e não
   *  é oficial (item A4 do checklist; testes/front/identidade.test.ts confere a igualdade). */
  ogDescricao: 'Veja perto de você onde tem gente para conversar antes do 2º turno. Site independente de apoio a um candidato; não é oficial. Dados públicos do TSE.',
  ogImagemAlt: 'Balão de conversa com um pino de mapa dentro, em verde e âmbar.',
} as const

export const navegacao = {
  rotulo: 'Seções do site',
  marcaAria: (nomeSite: string) => `${nomeSite}: voltar ao mapa`,
  rotas: { mapa: 'Mapa', prosa: 'Conversa', plano: 'Plano', sobre: 'Sobre' },
  pular: 'Pular para o conteúdo',
} as const

export const ficha = {
  voltar: 'Voltar para a lista',
  fecharAria: 'Fechar a ficha e voltar para a lista',
  subtitulo: (l: { bairro: string; municipio: string; uf: string; distancia: string }) =>
    `${[l.bairro, `${l.municipio} – ${l.uf}`].filter((p) => p !== '').join(', ')} · a ${l.distancia} do ponto`,
  eleitorado: (n: number) => `${contagem(n, 'pessoa vota', 'pessoas votam')} aqui.`,
  semResultado: 'O resultado das seções deste local ainda não está nos nossos dados.',
  principal: (ate: number) =>
    `Aqui, até ${contagem(ate, 'pessoa', 'pessoas')} ${plural(ate, 'não votou', 'não votaram')} em nenhum dos dois finalistas.`,
  principalNeutra: (ate: number, nomes: Nomes) =>
    `Aqui, ${contagem(ate, 'pessoa', 'pessoas')} ${plural(ate, 'não votou', 'não votaram')} em ${nomes.alvo} nem em ${nomes.adversario} no 1º turno.`,
  secaoConversa: 'Como puxar conversa aqui',
  grupo: (titulo: string, n: number) => `${titulo} · ${numero(n)}`,
  secaoLocais: 'Locais de votação',
  comoChegar: 'Como chegar',
  googleMaps: 'Como chegar (Google Maps)',
  waze: 'Abrir no Waze',
  avisoExterno: 'Abre um serviço de mapas de fora deste site.',
  posicaoReserva:
    'Posição tirada de outra base: a coordenada do cadastro do TSE faltava ou não batia com o lugar, então usamos a posição deste local num levantamento público de 2018 a 2022. Confira o endereço antes de ir.',
  zona: (zona: number, secoes: readonly number[]) =>
    `Zona ${zona}: ${plural(secoes.length, 'seção', 'seções')} ${emLista(secoes.map(String))}`,
} as const

export type DadosMensagem = {
  readonly nomeSite: string
  readonly alvo: string
  /** Endereço com o ponto arredondado (contrato §1, "link"), ou a raiz do site se não houver ponto. */
  readonly link: string
  /** "Até" do ponto; omitir fora das fases abertas ou sem ponto. */
  readonly ate?: number
}

export const compartilhar = {
  titulo: 'Leve a conversa adiante',
  texto: 'Conversar junto é mais fácil. Chame quem topar e dividam as ruas.',
  passos: [
    'Chame quem quiser ajudar, uma pessoa de cada vez.',
    'Mande o link do ponto para combinar onde conversar.',
    'Combinem dia e hora e dividam as ruas, para ninguém bater na mesma porta duas vezes.',
  ],
  regra:
    'Só entra em grupo quem pedir ou aceitar entrar. Não adicione ninguém sem o sim da pessoa e não dispare mensagens em massa: compartilhar é convite, não corrente.',
  botao: 'Compartilhar no WhatsApp',
  /** Mensagem do wa.me. Sem nenhum dado pessoal: só o número público do ponto e o link arredondado. */
  mensagem: (m: DadosMensagem) =>
    [
      m.ate === undefined
        ? 'Achei um mapa que mostra onde votam pessoas que não votaram em nenhum dos dois finalistas no 1º turno.'
        : `Perto deste ponto, até ${contagem(m.ate, 'pessoa', 'pessoas')} ${plural(m.ate, 'não votou', 'não votaram')} em nenhum dos dois finalistas no 1º turno.`,
      `O ${m.nomeSite} mostra esses lugares, como foi a disputa em cada um e o que conversar, com trechos do plano de ${m.alvo}. Site independente de apoio a ${m.alvo}, não é oficial.`,
      m.link,
      'Se for repassar: só para quem topar, sem adicionar ninguém a grupo e sem envio em massa.',
    ].join('\n\n'),
} as const

/** Faixas de fase (config: calendario.fases). fimConversa = prazo formatado do fim da última fase aberta. */
export const fases: Record<IdFase, (fimConversa: string) => string> = {
  campanha: (fim) => `A conversa vai até ${fim}.`,
  retaFinal: (fim) => `Reta final: a conversa vai até ${fim}. Depois disso, o site fica só para consulta.`,
  pausa: (fim) => `A conversa terminou ${naData(fim)}. O site segue aberto só para consulta.`,
  votacao: () => 'Dia de votação: o site está só em modo de consulta.',
  encerrada: () => 'A votação terminou. Os números do 1º turno continuam aqui para consulta.',
}

/** Tela estática do dia da votação. Publicada antes do fim da conversa; nenhuma orientação de abordagem. */
export const diaDaVotacao = {
  titulo: 'Dia de votação',
  paragrafos: [
    'No dia da votação, o site fica parado: sem mapa, sem busca e sem roteiro de conversa.',
    'Para saber onde você vota, use o aplicativo e-Título ou o site do TSE.',
    'Bom voto. Respeite a escolha de cada um.',
  ],
} as const

export const rodape = {
  natureza: (apoiado: Apoiado) =>
    `Site independente de apoio a ${apoiado.nome} (${apoiado.numero}). Não é o site oficial de nenhuma campanha, candidato ou partido.`,
  responsavel: (r: Responsavel) =>
    r.nome === null ? 'Responsável: a definir' : `Responsável: ${r.nome}${r.contato === null ? '' : ` · ${r.contato}`}`,
  dados: 'Dados: Tribunal Superior Eleitoral (CC-BY), com modificações. Mapa: © colaboradores do OpenStreetMap, OpenFreeMap.',
  sobre: 'Sobre e método',
  privacidade: 'Privacidade',
} as const

export const paginas = {
  prosa: {
    titulo: 'Como puxar conversa',
    chamada:
      'Roteiros curtos para conversar com respeito com quem não votou em nenhum dos dois finalistas. Cada proposta citada vem com a página do plano registrado no TSE.',
    chamadaConsulta: (fimConversa: string) => `Material de consulta. A conversa terminou ${naData(fimConversa)}.`,
    indice: 'Neste material',
    passos: 'Passo a passo',
    pontes: 'Assuntos para puxar',
    cuidados: 'Cuidados',
    emPreparo: 'Roteiros para quem votou em outros candidatos: em preparação.',
  },
  plano: {
    titulo: (alvo: string) => `O plano de ${alvo}`,
    chamada:
      'Cada proposta em poucas palavras, com um número oficial que mostra por que ela faz sentido e uma pergunta para puxar conversa. No fim de cada cartão, o trecho do plano registrado no TSE, ao pé da letra e com a página.',
    dadosConferidos: (data: string) => `Números conferidos nas fontes ${naData(data)}.`,
    fonte: 'Fonte:',
    porQue: 'Por que faz sentido',
    paraPuxar: 'Para puxar conversa',
    copiar: 'Copiar a pergunta',
    copiado: 'Pergunta copiada.',
    copiaFalhou: 'Não deu para copiar. Selecione a pergunta e copie.',
    cuidado: 'Cuidado ao falar:',
    oQueOPlanoDiz: (pagina: number) => `O que o plano diz (p. ${pagina})`,
    nomeNoPlano: (nome: string) => `No plano: “${nome}”`,
    intervalo: (inicio: number, fim: number) => `páginas ${inicio} a ${fim}`,
    pagina: (n: number) => `p. ${n}`,
    /** Completa "p. N" só para o leitor de tela: o nome do link começa pelo texto visível (WCAG 2.5.3). */
    paginaComplemento: 'do plano no PDF do TSE',
    pdfCompleto: 'Ler o plano completo (PDF do TSE)',
    conferido: (data: string) => `Trechos conferidos página a página contra o PDF ${naData(data)}.`,
  },
  sobre: { titulo: 'Sobre', privacidade: 'Privacidade' },
} as const

/** Rótulo de acessibilidade de cada classificação (marcadores e filtros). */
export const classificacaoAria: Record<Classificacao, (nomes: Nomes) => string> = {
  semVotos: () => 'sem votos válidos',
  empate: () => 'empate',
  folga: (n) => `${n.alvo} com folga`,
  aDefender: (n) => `${n.alvo} à frente, vantagem a defender`,
  alvoNaFrente: (n) => `${n.alvo} à frente`,
  aVirar: (n) => `${n.adversario} à frente, em tese dá para virar`,
  dificil: (n) => `${n.adversario} bem à frente`,
}

export const acessibilidade = {
  lista: 'Locais de votação, do maior “até” para o menor',
  marcador: (local: string, situacao: string) => `${local}: ${situacao}`,
  marcadorSemResultado: (local: string) => `${local}: sem resultado ainda`,
  pontoEscolhido: 'Ponto escolhido',
  abrirFicha: (local: string) => `Abrir a ficha de ${local}`,
  novaAba: '(abre em outra aba)',
  carregando: 'Carregando',
  /** Região viva da tela do mapa (sempre montada): o que mudou depois de escolher um ponto, para o leitor de tela. */
  anuncioPonto: (origem: string, frase: string, locais: number) =>
    `${origem}. ${frase} ${contagem(locais, 'local de votação', 'locais de votação')} na lista.`,
  anuncioSemLocal: (origem: string, titulo: string) => `${origem}. ${titulo}.`,
} as const

export const sistema = {
  versaoNova: 'Saiu uma versão nova do site.',
  recarregar: 'Recarregar a página',
  erroTela: 'Algo deu errado nesta tela.',
  modoExemplo: 'Dados de exemplo: números fictícios, só para teste. Não use para conversar.',
} as const
