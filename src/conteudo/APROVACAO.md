# Aprovação dos textos antes de publicar

Quem aprova: **o operador nomeado em `config/candidatura.json` › `site.responsavel`** .
Todos os textos foram redigidos do zero para este site; nenhum veio de campanha, partido ou do site original.
Marque cada item depois de ler o texto **com os valores da configuração** (nomes, datas, raio). Mudou um texto?
Desmarque e releia. Mudou o comportamento do site (ex.: entrou marcação ou analytics)? Reescreva a privacidade e reaprove.

Como ler:
- `textos.*` fica em `src/conteudo/textos/*.ts`; as funções recebem nomes e números por parâmetro (vindos da config).
- `roteiros.json`, `sobre.md` e `privacidade.md` têm chaves entre chaves duplas, preenchidas por `src/conteudo/modelo.ts`.
- Toda citação do plano (`trecho` + `pagina`) é conferida por programa contra o PDF:
  `npm run py -- ferramentas/conferir_citacoes.py` tem de terminar com **0 falhas**. O que você aprova nelas é a
  **escolha** do trecho e o **título ou resumo** nosso; a literalidade fica com o programa.

> **Revisão de tom e comparação entre os planos (06/10/2026): precisa de nova aprovação.** Os itens desmarcados
> abaixo mudaram depois da aprovação anterior: cartões do plano reescritos (resumo fiel à página, perguntas mais
> leves), roteiros com tom mais calmo, “disputa” trocada por “resultado” na interface, mapa com a cor de quem ficou
> à frente, responsável do site numa linha discreta no fim da página Sobre e a página nova que compara os dois
> planos (seção 18). Os trechos citados continuam conferidos por programa (0 falhas).

## 0. Bloqueios que não são texto (o portão de publicação depende deles)

- [x] `config/candidatura.json` › `site.responsavel.nome` e `.contato` preenchidos (hoje `null`: rodapé, Sobre e Privacidade mostram “a definir” e `npm run checar:publicacao` bloqueia).
- [x] Hospedagem definida e informada na página de privacidade (`site.hospedagem` = Vercel, escolha do responsável em 06/10/2026); validação jurídica da hospedagem adiada junto com o item do advogado.
- [x] Na Vercel, a privacidade continua verdadeira: sem Web Analytics, sem Speed Insights e sem Log Drains; no plano Pro, Observability Plus desligado; nenhum script da Vercel no site de produção. (MUDOU em 06/10/2026.)
- **Não se aplica enquanto a hospedagem for a Vercel** (plano B, servidor próprio). Se voltar para o servidor próprio, reabrir este item: o deploy faz o que a privacidade promete: registro de acessos **sem IP**; registro de erros que pode, raramente, ter IP, apagado em até 7 dias (`logrotate` com `rotate 7`, deploy/README.md); tudo apagado até 31/10/2026; sem cookies; sem analytics de terceiros; fontes do texto servidas pelo próprio site (letras e ícones do mapa vêm do OpenFreeMap).
- [x] As fases funcionam como os textos dizem (no dia da votação: sem mapa, sem busca, sem compartilhar).
- **Adiado pelo responsável em 06/10/2026:** validação por advogado eleitoralista (recomendada no checklist legal do plano). Não foi feita antes da publicação; continua pendente.

## 1. Identidade e metadados (title, description, OG)

Arquivo: `src/conteudo/textos/moldura.ts`

- [x] `textos.meta.titulo()`
- [ ] `textos.meta.descricao()` — declara apoio e que não é oficial (Lei 9.504, art. 57-B, §2º; 57-H) — MUDOU na revisão de tom (06/10/2026): “qual foi o resultado ali”
- [x] `textos.meta.ogTitulo()`
- [x] `textos.meta.ogDescricao` — também no `index.html` estático (prévia de link sem JS): diz “de apoio a um candidato; não é oficial”, sem nome (06/10/2026)
- [x] `textos.meta.ogImagemAlt`

## 2. Cabeçalho e navegação

Arquivo: `src/conteudo/textos/moldura.ts`

- [x] `textos.navegacao.rotulo`
- [x] `textos.navegacao.marcaAria()`
- [x] `textos.navegacao.rotas.mapa`
- [x] `textos.navegacao.rotas.prosa`
- [x] `textos.navegacao.rotas.plano`
- [x] `textos.navegacao.rotas.sobre`
- [x] `textos.navegacao.pular`

## 3. Tela do mapa: abertura, mapa e busca

Arquivo: `src/conteudo/textos/mapa.ts`

- [x] `textos.abertura.selo()`
- [x] `textos.abertura.titulo()`
- [ ] `textos.abertura.chamada()` — MUDOU na revisão de tom (06/10/2026): “quantas dessas pessoas votam ali, qual foi o resultado”
- [ ] `textos.abertura.chamadaConsulta()` — NOVO (06/10/2026): a abertura nas fases fechadas (pausa, votação, encerrada), sem convite para conversar; MUDOU na revisão de tom (06/10/2026): “o resultado de cada local”
- [x] `textos.abertura.brasilAte`
- [x] `textos.abertura.brasilViraveis` — MUDOU (06/10/2026): “pontos do mapa (locais de votação)”, porque a conta é por ponto do mapa
- [x] `textos.abertura.notaViraveis()` — rotula “dá para virar” como teto
- [x] `textos.mapa.dica` — MUDOU (06/10/2026): “Toque ou clique no mapa…” (vale para celular e computador)
- [x] `textos.mapa.falhou` e `textos.mapa.tentarDeNovo` — NOVOS (06/10/2026): quando o mapa não abre no aparelho
- [x] `textos.mapa.rotulo`
- [x] `textos.mapa.atribuicao`
- [x] `textos.mapa.controles` (botões de zoom do mapa e dicas: aproximar, afastar, norte, créditos, correção; NOVOS em 06/10/2026: `quadro`, nome curto do quadro do mapa para o leitor de tela, e `doisDedos`, `zoomWindows`, `zoomMac`, avisos de gesto do mapa)
- [x] `textos.busca.rotulo`
- [x] `textos.busca.placeholder`
- [x] `textos.busca.buscar`
- [x] `textos.busca.buscando`
- [x] `textos.busca.minhaLocalizacao`
- [x] `textos.busca.localizando`
- [x] `textos.busca.dica` — MUDOU (06/10/2026): “ou escolha no mapa”
- [x] `textos.busca.sugestoes()`
- [x] `textos.busca.cepAproximado()` — NOVO (06/10/2026): CEP de casa que não é de local de votação leva ao CEP de local do mesmo setor, rotulado “Perto do CEP …”
- [x] `textos.busca.origem.link`
- [x] `textos.busca.origem.mapa`
- [x] `textos.busca.origem.localizacao`
- [x] `textos.busca.erros.curto()`
- [x] `textos.busca.erros.nadaEncontrado` — MUDOU (06/10/2026): o exemplo agora é “Boa Viagem, Recife” (“Centro, Recife” não existe no cadastro); o teste `testes/busca-dados.test.ts` confere que o exemplo acha o lugar
- [x] `textos.busca.erros.cepNaoEncontrado`
- [x] `textos.busca.erros.localizacaoIndisponivel`
- [x] `textos.busca.erros.localizacaoNegada`
- [x] `textos.busca.erros.falhaBusca`
- [x] `textos.carregando.site`
- [x] `textos.carregando.regioes`

## 4. Tela do mapa: resultado, % do alvo e disputa

Arquivo: `src/conteudo/textos/mapa.ts`

- [x] `textos.resultado.manchete()` — sempre “até”: teto, nunca previsão
- [x] `textos.resultado.notaTeto` — explica o “até”
- [x] `textos.resultado.mancheteNeutra()`
- [x] `textos.resultado.parcela.brancos()`
- [x] `textos.resultado.parcela.nulos()`
- [x] `textos.resultado.parcela.abstencao()`
- [x] `textos.resultado.parcela.candidato()`
- [x] `textos.resultado.parcela.outros()`
- [x] `textos.resultado.decomposicao()`
- [x] `textos.resultado.alcance()`
- [x] `textos.alvoAqui.porAqui()`
- [x] `textos.alvoAqui.nesteLocal()`
- [x] `textos.alvoAqui.valor()`
- [x] `textos.alvoAqui.notaValidos`
- [ ] `textos.alvoAqui.notaFolga()` — MUDOU (06/10/2026): “teve N% ou mais” (a regra é ≥); MUDOU na revisão de tom (06/10/2026): “onde o resultado foi mais equilibrado”
- [x] `textos.alvoAqui.ariaBarra()`
- [x] `textos.disputa.semVotos()`
- [x] `textos.disputa.empate()`
- [ ] `textos.disputa.folga()` — MUDOU na revisão de tom (06/10/2026): “onde o resultado foi mais equilibrado”
- [x] `textos.disputa.aDefender()`
- [x] `textos.disputa.alvoNaFrente()` — MUDOU (06/10/2026): diz “igual ao número” quando a vantagem é igual ao reservatório (184 locais em 2026)
- [x] `textos.disputa.aVirar()` — tem de dizer “teto, não previsão”
- [ ] `textos.disputa.dificil()` — MUDOU (06/10/2026): diz “o mesmo número de pessoas” no empate entre diferença e reservatório; MUDOU na revisão de tom (06/10/2026): sai “Virar aqui é difícil”, fica “Mesmo assim, para presidente, todo voto soma no total do país.”

## 5. Tela do mapa: lista, vazios e erro de dados

Arquivo: `src/conteudo/textos/mapa.ts`

- [x] `textos.lista.titulo`
- [x] `textos.lista.ordenar`
- [x] `textos.lista.perto` — MUDOU (06/10/2026): “Mais gente” (a lista é pelo maior “até”, não pela distância)
- [x] `textos.lista.porBairro`
- [x] `textos.lista.raio()`
- [ ] `textos.lista.legendaComResultado` — MUDOU (06/10/2026): “Cor: quem ficou à frente no 1º turno. Miolo: onde, em tese, o resultado pode mudar.”
- [ ] `textos.legendaMapa.*` — NOVO (06/10/2026): uma entrada por símbolo do mapa e da lista. Verde = <alvo> à frente, vermelho = <adversário> à frente, âmbar = empate, branco = sem votos válidos; o miolo âmbar marca “em tese dá para virar” (vermelho) e “vantagem a defender” (verde)
- [x] `textos.lista.legendaSemResultado`
- [x] `textos.lista.itemDetalhe()`
- [x] `textos.lista.itemAte()`
- [x] `textos.lista.itemAteAria()`
- [x] `textos.lista.bairroResumo()`
- [x] `textos.lista.notaSemBairro()`
- [x] `textos.lista.notaSemResultado()`
- [x] `textos.lista.notaOrdem`
- [x] `textos.vazio.semResultado.titulo`
- [x] `textos.vazio.semResultado.texto`
- [x] `textos.vazio.semLocal.titulo()` — MUDOU (06/10/2026): “num raio de”
- [x] `textos.vazio.semLocal.texto()`
- [x] `textos.erroDados.titulo`
- [x] `textos.erroDados.texto`
- [x] `textos.erroDados.tentar`
- [x] `textos.erroDados.tentando`

## 6. Ficha do local

Arquivo: `src/conteudo/textos/moldura.ts`

- [x] `textos.ficha.voltar`
- [x] `textos.ficha.fecharAria`
- [x] `textos.ficha.subtitulo()`
- [x] `textos.ficha.eleitorado()`
- [x] `textos.ficha.semResultado`
- [x] `textos.ficha.principal()`
- [x] `textos.ficha.principalNeutra()`
- [x] `textos.ficha.secaoConversa`
- [x] `textos.ficha.grupo()`
- [x] `textos.ficha.secaoLocais`
- [x] `textos.ficha.comoChegar`
- [x] `textos.ficha.googleMaps`
- [x] `textos.ficha.waze`
- [x] `textos.ficha.avisoExterno`
- [x] `textos.ficha.posicaoReserva` — MUDOU (06/10/2026): “Posição tirada de outra base: a coordenada do cadastro do TSE faltava ou não batia com o lugar”
- [x] `textos.ficha.zona()`

## 7. Compartilhar

Arquivo: `src/conteudo/textos/moldura.ts`

- [x] `textos.compartilhar.titulo`
- [x] `textos.compartilhar.texto`
- [x] `textos.compartilhar.passos[3]`
- [x] `textos.compartilhar.regra` — não adicionar ninguém a grupo sem o sim da pessoa; sem disparo em massa (57-B, §3º) — MUDOU (06/10/2026)
- [x] `textos.compartilhar.botao`
- [ ] `textos.compartilhar.mensagem()` — MUDOU na revisão de tom (06/10/2026): “o resultado de cada um”. MUDOU (06/10/2026): “Site independente de apoio a <alvo>, não é oficial”. MENSAGEM PRONTA: revisão humana obrigatória (Res. 23.610, art. 28, §6º-B); sem dado pessoal; enviada só por wa.me, iniciada pela pessoa

## 8. Fases do calendário e aviso do dia da votação

Arquivo: `src/conteudo/textos/moldura.ts`

- [x] `textos.fases.campanha()`
- [x] `textos.fases.retaFinal()`
- [x] `textos.fases.pausa()` — MUDOU (06/10/2026): “terminou no sábado…” e o prazo leva “(horário de Brasília)”
- [x] `textos.fases.votacao()` — idem; MUDOU (06/10/2026): “Dia de votação: …” (sem “Hoje”, que ficava errado na madrugada de 26/10 e no Acre)
- [x] `textos.fases.encerrada()`
- [x] `textos.diaDaVotacao.titulo` — MUDOU (06/10/2026): “Dia de votação”. Publicar ANTES do fim da conversa; nenhuma orientação de abordagem no dia
- [x] `textos.diaDaVotacao.paragrafos[3]` — idem; conferir que nada pede voto

## 9. Rodapé

Arquivo: `src/conteudo/textos/moldura.ts`

- [x] `textos.rodape.natureza()` — apoio declarado + “não é oficial” (bloqueante A4)
- [ ] `textos.rodape.responsavel()` — SAIU do rodapé (06/10/2026, pedido do responsável): nome e contato agora ficam numa linha discreta no fim da página Sobre (`textos.paginas.sobre.responsavel()`, seção 10) e na privacidade (controlador). O site continua identificado, não anônimo (57-D), e o portão de publicação continua exigindo o responsável na config
- [x] `textos.rodape.dados`
- [x] `textos.rodape.sobre`
- [x] `textos.rodape.privacidade`

## 10. Páginas Conversa, Plano e Sobre (títulos e rótulos)

Arquivo: `src/conteudo/textos/moldura.ts`

- [x] `textos.paginas.prosa.titulo`
- [x] `textos.paginas.prosa.chamada`
- [x] `textos.paginas.prosa.chamadaConsulta()`
- [x] `textos.paginas.prosa.indice`
- [x] `textos.paginas.prosa.passos`
- [x] `textos.paginas.prosa.pontes`
- [x] `textos.paginas.prosa.cuidados`
- [x] `textos.paginas.prosa.emPreparo`
- [x] `textos.paginas.plano.titulo()`
- [x] `textos.paginas.plano.chamada` — MUDOU (06/10/2026): explica o cartão (número oficial + pergunta + trecho literal)
- [x] `textos.paginas.plano.dadosConferidos()` — NOVO (06/10/2026): “Números conferidos nas fontes …”
- [x] `textos.paginas.plano.fonte`, `.porQue`, `.paraPuxar`, `.cuidado`, `.oQueOPlanoDiz()` — NOVOS (06/10/2026): rótulos do cartão
- [x] `textos.paginas.plano.copiar`, `.copiado`, `.copiaFalhou` — NOVOS (06/10/2026): botão de copiar a pergunta
- [x] `textos.paginas.plano.nomeNoPlano()`
- [x] `textos.paginas.plano.intervalo()`
- [x] `textos.paginas.plano.pagina()`
- [x] `textos.paginas.plano.paginaComplemento` — SUBSTITUI `paginaAria` (06/10/2026): o link “p. N” é lido como “p. N do plano no PDF do TSE (abre em outra aba)”
- [x] `textos.paginas.plano.pdfCompleto`
- [x] `textos.paginas.plano.conferido()` — MUDOU (06/10/2026): “na segunda-feira, 05/10”
- [x] `textos.paginas.sobre.titulo`
- [x] `textos.paginas.sobre.privacidade`
- [ ] `textos.paginas.sobre.responsavel()` — NOVO (06/10/2026): “Responsável pelo site: <nome> · <contato>”, em letra pequena no fim da página Sobre
- [ ] `textos.paginas.abasPlano.rotulo`, `.propostas()`, `.comparar` — NOVOS (06/10/2026): as duas abas da seção Plano (“Propostas de <alvo>” e “Comparar os planos”); no menu, “Plano” fica marcado nas duas
- [ ] `textos.paginas.comparar.titulo`, `.chamada()`, `.indice`, `.planoDe()`, `.pdfDe()`, `.emComum`, `.diferenca`, `.paginaComplemento()`, `.conferido()` — NOVOS (06/10/2026): a página #/comparar (conteúdo na seção 18)

## 11. Acessibilidade e mensagens do sistema

Arquivo: `src/conteudo/textos/moldura.ts`

- [x] `textos.classificacaoAria.semVotos()`
- [x] `textos.classificacaoAria.empate()`
- [x] `textos.classificacaoAria.folga()`
- [x] `textos.classificacaoAria.aDefender()`
- [x] `textos.classificacaoAria.alvoNaFrente()`
- [x] `textos.classificacaoAria.aVirar()`
- [x] `textos.classificacaoAria.dificil()`
- [x] `textos.acessibilidade.lista`
- [x] `textos.acessibilidade.marcador()`
- [x] `textos.acessibilidade.marcadorSemResultado()`
- [x] `textos.acessibilidade.pontoEscolhido`
- [x] `textos.acessibilidade.abrirFicha()`
- [x] `textos.acessibilidade.novaAba`
- [x] `textos.acessibilidade.carregando`
- [x] `textos.acessibilidade.anuncioPonto()` e `anuncioSemLocal()` — NOVOS (06/10/2026): o que o leitor de tela ouve depois de escolher um ponto (origem, manchete e quantos locais)
- [x] `textos.sistema.versaoNova`
- [x] `textos.sistema.recarregar`
- [x] `textos.sistema.erroTela`
- [x] `textos.sistema.modoExemplo` — só aparece em preview com ?exemplo

## 12. Plano de governo — `src/conteudo/plano.json` (cartões de conversa — MUDOU na revisão de tom (06/10/2026))

Cada proposta é um cartão: **em uma frase**, **um número com fonte**, **por que faz sentido**, **uma pergunta para
puxar conversa** e, quando há risco de exagero, um **cuidado ao falar**. Na revisão de tom, os resumos foram
refeitos lendo a página inteira do plano (o que ele propõe de fato), as perguntas ficaram mais leves e, onde o
trecho não explicava a proposta, ele foi trocado por outro da mesma página. O trecho entre aspas continua literal
e com a página (conferido por programa). Em cada cartão, confira:
1. a frase simples não distorce o trecho do plano;
2. o número: abra o link e ache o trecho de conferência (alguns sites oficiais bloqueiam robôs, mas abrem no navegador);
3. o “por que faz sentido” não promete resultado nem ataca pessoa, partido ou candidato;
4. a pergunta é respeitosa e o cuidado protege quem fala.

- [x] `documento.url` abre o PDF oficial do TSE, e `#page=N` cai na página certa
- [x] `dadosConferidosEm` (2026-10-06): antes de publicar, reconfira os números que mudam rápido — Bolsa Família (mensal), PNAD Contínua (nova divulgação no fim de outubro) e fila do INSS
- [ ] `capitulos[0]` **Segurança na porta de casa** (no plano: Brasil sem Medo, p. 13–16): `titulo` e `chamada` (“O que o plano propõe para a segurança: facções, maioridade penal, fronteira, presídios, proteção de mulheres com medida protetiva e mais verba federal.”)
  - [ ] `capitulos[0].propostas[0]` **Facções classificadas como narcoterroristas** (p. 13) — **4 em cada 10** brasileiros de 16 anos ou mais dizem que o crime organizado atua no seu bairro — [Fórum Brasileiro de Segurança Pública (pesquisa feita pelo Datafolha), "Medo do crime e eleições 2026", resumo executivo, p. 5](https://forumseguranca.org.br/wp-content/uploads/2026/05/os-gatilhos-da-inseguranca-resumo-executivo-2026.pdf), 2026. Conferir: “41,2% dos brasileiros com 16 anos ou mais reconhecem a presença, em seu bairro, de grupos criminosos organizados ligados ao tráfico ou a milícias”. Pergunta: “O que você acha de o governo seguir o dinheiro das facções e bloquear os bens delas?” Cuidado: A lei antiterrorismo de hoje não inclui facções; é isso que a proposta quer mudar. Se a pessoa não quiser falar do bairro, respeite.
  - [ ] `capitulos[0].propostas[1]` **Maioridade penal aos 16 anos** (p. 13) — **3 anos** é o tempo máximo de internação de um adolescente infrator, pelo ECA — [Estatuto da Criança e do Adolescente (Lei 8.069/1990), art. 121, § 3º](https://www.planalto.gov.br/ccivil_03/leis/l8069.htm), 1990. Conferir: “Em nenhuma hipótese o período máximo de internação excederá a três anos.”. Pergunta: “Na sua opinião, como o país deveria lidar com crimes graves cometidos por adolescentes?” Cuidado: Mudar a idade penal exige emenda à Constituição, votada pelo Congresso: o presidente não decide isso sozinho.
  - [ ] `capitulos[0].propostas[2]` **Sistema Nacional de Fronteira** (p. 14) — **quase 17 mil km** de fronteira por terra, com 10 países vizinhos — [Fundação Alexandre de Gusmão (FUNAG/Itamaraty), "Brasil – Fronteiras Terrestres", com dados das Comissões Demarcadoras de Limites](https://www.gov.br/funag/pt-br/ipri/arquivos-ipri/arquivos-estatisticas/fronteiras-terrestres-brasil-13052015.pdf), 2015. Conferir: “O Brasil possui fronteiras com 10 dos 12 outros países da América do Sul, com extensão total de 16.885,7 km.”. Pergunta: “Como você vê a ideia de usar as Forças Armadas para vigiar a fronteira?” Cuidado: O plano não cita fonte para o “100%”; por isso, prefira falar do tamanho da fronteira, que tem fonte.
  - [ ] `capitulos[0].propostas[3]` **Novos presídios de segurança máxima** (p. 14) — **1.040 vagas** é a capacidade somada dos 5 presídios federais de segurança máxima do país — [Secretaria Nacional de Políticas Penais (Senappen/Ministério da Justiça), Relatório de Informações Penais – 2º semestre de 2025, p. 15](https://www.gov.br/senappen/pt-br/servicos/sisdepen/relatorios/relatorios-de-informacoes-penitenciarias/relatorio-do-2o-semestre-de-2025.pdf), 2025. Conferir: “Adicionalmente, no Sistema Penitenciário Federal, são estes os quantitativos: DF: 208, MS: 208, RO: 208, RN: 208, PR: 208. Total = 1.040”. Pergunta: “O que você acha de isolar chefes de facção em presídios sem acesso a celular?” Cuidado: No fim de 2025, os presídios federais ainda tinham vagas livres; por isso, evite dizer que estão lotados.
  - [ ] `capitulos[0].propostas[4]` **Tornozeleira em agressor com medida protetiva** (p. 14) — **362 por dia** registros policiais de medida protetiva descumprida no Brasil em 2025 (132 mil no ano) — [Fórum Brasileiro de Segurança Pública, 20º Anuário Brasileiro de Segurança Pública 2026, p. 172 (dados das secretarias estaduais de segurança e polícias civis)](https://forumseguranca.org.br/wp-content/uploads/2026/07/anuario-2026.pdf), 2025. Conferir: “Foram 132.025 registros de descumprimento de MPU no ano, taxa 16,7% superior à de 2024. Em termos concretos, são 362 descumprimentos por dia”. Pergunta: “Na sua opinião, o que ajudaria a garantir que a medida protetiva seja cumprida?” Cuidado: São registros de descumprimento, não o número de mulheres. A lei já prevê tornozeleira em casos de risco; a proposta quer ampliar.
  - [ ] `capitulos[0].propostas[5]` **O dobro de dinheiro federal para a segurança** (p. 15) — **8 em cada 10 reais** gastos com segurança pública em 2025 saíram dos cofres dos estados e do DF — [Fórum Brasileiro de Segurança Pública, 20º Anuário Brasileiro de Segurança Pública 2026, p. 328 (dados do Tesouro Nacional/SICONFI)](https://forumseguranca.org.br/wp-content/uploads/2026/07/anuario-2026.pdf), 2025. Conferir: “as Unidades da Federação ampliaram suas despesas em 6,2% no período, alcançando R$ 131,25 bilhões — e respondendo por aproximadamente 80,5% de todo o gasto brasileiro em segurança pública”. Pergunta: “Como você vê a ideia de o governo federal dobrar o investimento em segurança pública?”
- [ ] `capitulos[1]` **Mulheres no centro** (no plano: Brasil por Elas, p. 17–22): `titulo` e `chamada` (“Proteger a mulher da violência e facilitar a vida dela: atendimento num lugar só, ajuda pelo celular, casa no nome dela, creche e saúde.”)
  - [ ] `capitulos[1].propostas[0]` **Um lugar só para resolver a vida** (p. 17) — **3 em cada 10** prefeituras ofereciam atendimento especializado à mulher vítima de violência em 2023 — [IBGE – Perfil dos Municípios Brasileiros 2023 (pesquisa MUNIC), p. 63](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102130.pdf), 2023. Conferir: “somente 30,5% dos Municípios ofereciam serviços especializados de atendimento à violência contra a mulher”. Pergunta: “Você já perdeu um dia inteiro indo de um lugar a outro para resolver um problema?” Cuidado: O número conta só serviços das prefeituras; delegacias e serviços do estado ficam de fora.
  - [ ] `capitulos[1].propostas[1]` **Pedir ajuda pelo celular** (p. 19) — **47%** das mulheres agredidas em 12 meses não fizeram nada depois da agressão mais grave — [Pesquisa Visível e Invisível, 5ª edição – Fórum Brasileiro de Segurança Pública e Datafolha (2025), p. 33](https://forumseguranca.org.br/wp-content/uploads/2025/03/relatorio-visivel-e-invisivel-5ed-2025.pdf), 2025. Conferir: “47,4% das vítimas não fizeram nada após o episódio mais grave de violência”. Pergunta: “Você conhece alguma mulher que precisou de ajuda e não sabia a quem pedir?”
  - [ ] `capitulos[1].propostas[2]` **Casa no nome dela** (p. 20) — **Mais da metade** dos lares do Brasil tinham uma mulher como responsável em 2025 — [IBGE – PNAD Contínua 2025, tabela 6788 do Sidra (domicílios por sexo do responsável)](https://apisidra.ibge.gov.br/values/t/6788/n1/all/v/162/p/2025/c293/all/c460/45902), 2025. Conferir: “Domicílios (Mil unidades), Brasil, 2025 – Total: 79305; Mulheres: 41522”. Pergunta: “Você conhece alguma mulher que mora há anos numa casa que não está no nome dela?”
  - [ ] `capitulos[1].propostas[3]` **Voucher-creche quando faltar vaga pública** (p. 21) — **1 em cada 3** crianças de 2 e 3 anos fora da creche não tem vaga ou creche perto — [IBGE – PNAD Contínua Educação 2025 (informativo), p. 6](https://biblioteca.ibge.gov.br/visualizacao/livros/liv102286_informativo.pdf), 2025. Conferir: “O segundo motivo mais citado foi não ter escola/creche na localidade, falta de vaga ou a não aceitação da matrícula por causa da idade da criança. [...] entre as de 2 a 3 anos, o percentual foi de 33,4%.”. Pergunta: “Aqui no bairro é fácil conseguir vaga na creche?” Cuidado: O “1 em cada 3” vale para as crianças que estão fora da creche, não para todas.
  - [ ] `capitulos[1].propostas[4]` **Saúde da mulher perto de casa** (p. 21) — **79 mil** novos casos de câncer de mama esperados por ano no Brasil, de 2026 a 2028 — [INCA (Ministério da Saúde) – Estimativa 2026: Incidência de Câncer no Brasil, p. 41](https://ninho.inca.gov.br/jspui/bitstream/123456789/17914/1/Estima2026_completo%20(1).pdf), 2026. Conferir: “O número estimado de casos novos de câncer de mama no Brasil, para cada ano do triênio de 2026 a 2028, é de 78.610 casos”. Pergunta: “Você ou alguém da família já esperou muito para fazer mamografia ou preventivo?” Cuidado: 79 mil é uma estimativa do INCA para cada ano, não uma contagem.
- [ ] `capitulos[2]` **Menos fila, mais tempo** (no plano: Brasil sem Fila, p. 23–28): `titulo` e `chamada` (“Menos tempo perdido em fila: serviços do governo pela internet, saúde conectada, INSS cobrado pelo tempo de espera e título da terra.”)
  - [ ] `capitulos[2].propostas[0]` **Serviços federais pela internet** (p. 25) — **175 milhões** contas ativas no gov.br, usado para acessar serviços do governo, até maio de 2026 — [Ministério da Gestão e da Inovação em Serviços Públicos — Secretaria de Governo Digital (página Governo Digital, gov.br)](https://www.gov.br/governodigital/pt-br), 2026. Conferir: “175 milhões de contas ativas GOV.BR (até mai/26)”. Pergunta: “Você já teve que faltar ao trabalho para resolver alguma coisa no governo?” Cuidado: São contas por CPF, de todas as idades; por isso, evite dizer que quase todo adulto usa.
  - [ ] `capitulos[2].propostas[1]` **Sem levar o mesmo papel duas vezes** (p. 25) — **2018** ano da lei que proíbe o governo de pedir documento que ele mesmo emitiu — [Lei nº 13.726/2018 (Lei da Desburocratização), art. 3º, § 3º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13726.htm), 2018. Conferir: “não poderão exigir do cidadão a apresentação de certidão ou documento expedido por outro órgão ou entidade do mesmo Poder”. Pergunta: “Já te pediram cópia de um documento que o próprio governo tinha emitido?” Cuidado: A lei tem exceções; por isso, evite dizer que o governo nunca pode pedir um documento de novo.
  - [ ] `capitulos[2].propostas[2]` **Prontuário único de saúde** (p. 26) — **menos de 4 em cada 10** locais de saúde conseguem enviar ou receber resultado de exame de laboratório pelo sistema — [Pesquisa TIC Saúde 2025 — Cetic.br / Comitê Gestor da Internet no Brasil (CGI.br)](https://cetic.br/pt/noticia/uso-de-inteligencia-artificial-avanca-na-saude-brasileira-mas-ainda-se-concentra-em-tarefas-operacionais/), 2025. Conferir: “37% podem enviar ou receber resultados de exames laboratoriais (47% dos públicos e 29% dos privados)”. Pergunta: “Você já teve que repetir um exame porque o resultado não chegou ao outro médico?”
  - [ ] `capitulos[2].propostas[3]` **Consulta e exame marcados mais rápido** (p. 26) — **1 em cada 3** locais de saúde oferece marcação de consulta pela internet, em 2025 — [Pesquisa TIC Saúde 2025 — Cetic.br / Comitê Gestor da Internet no Brasil (CGI.br)](https://cetic.br/pt/noticia/uso-de-inteligencia-artificial-avanca-na-saude-brasileira-mas-ainda-se-concentra-em-tarefas-operacionais/), 2025. Conferir: “o agendamento de consultas por 34% e o de exames por 32%”. Pergunta: “Aqui na região, quanto tempo demora para marcar uma consulta pelo SUS?”
  - [ ] `capitulos[2].propostas[4]` **INSS digital e medido pela espera** (p. 26) — **1,5 milhão** pedidos na fila do INSS em julho de 2026, esperando análise ou documento do cidadão — [INSS — Transparência Previdenciária, julho de 2026](https://www.gov.br/inss/pt-br/portal-de-transparencia/transparencia-previdenciaria-julho-26.pdf), 2026. Conferir: “Estoque Total 1.546 Mil”. Pergunta: “Você conhece alguém que esperou meses por aposentadoria ou auxílio do INSS?” Cuidado: O número conta pedidos, não pessoas. A fila diminuiu em 2026; por isso, evite dizer que está crescendo.
  - [ ] `capitulos[2].propostas[5]` **Documento da terra para o pequeno produtor** (p. 27) — **219 mil** sítios da agricultura familiar que esperavam o título definitivo da terra, em 2017 — [IBGE — Censo Agropecuário 2017, tabela 6778 (Sidra)](https://sidra.ibge.gov.br/tabela/6778), 2017. Conferir: “Número de estabelecimentos agropecuários | Agricultura familiar - sim | Concessionário(a) ou assentado(a) aguardando titulação definitiva | 219478”. Pergunta: “Você conhece alguém do campo que trabalha a terra há anos e ainda não tem o título?” Cuidado: O dado é de 2017, do último Censo Agropecuário; por isso, evite apresentá-lo como o número de hoje.
- [ ] `capitulos[3]` **Conta que cabe no mês** (no plano: Brasil Mais Barato, p. 29–33): `titulo` e `chamada` (“Fazer o dinheiro render mais: menos imposto nas compras, na luz e no combustível, frete mais barato e benefício social longe das apostas.”)
  - [ ] `capitulos[3].propostas[0]` **Imposto menor no que se compra** (p. 30) — **28%** previsão da taxa padrão do novo imposto sobre o que a gente compra — [Comitê Gestor do IBS, Resolução CGIBS nº 14/2026 (com base em estimativas do Ministério da Fazenda)](https://www.cgibs.gov.br/upload/arquivos/202607/31144942-resoluc-ao-cgibs-n-14-de-29-de-julho-de-2026-proposta-percentual-ibs-cgibs-2027.pdf), 2026. Conferir: “a alíquota-padrão conjunta do IBS e da CBS situar-se-ia em torno de 28%”. Pergunta: “Já aconteceu de você conferir na nota do mercado quanto foi de imposto?” Cuidado: 28% é a taxa padrão prevista, e a cesta básica tem alíquota zero. Melhor não dizer que o arroz vai pagar 28%.
  - [ ] `capitulos[3].propostas[1]` **Conta de luz que dá para entender** (p. 31) — **R$ 49 bilhões** orçamento de 2025 da CDE, fundo de subsídios bancado principalmente pela conta de luz — [ANEEL, Resolução Homologatória nº 3.484/2025 (texto publicado pela CCEE, gestora da CDE)](https://www.ccee.org.br/documents/80415/30313868/reh20253484ti.pdf/24ea283b-93b3-c901-624e-c0dfdc7054f1), 2025. Conferir: “CDE de 2025, no valor de R$ 49.227.181.970,31”. Pergunta: “Já aconteceu de você tentar entender a conta de luz e ficar com dúvida?”
  - [ ] `capitulos[3].propostas[2]` **Subsídios menores, tarifa social mantida** (p. 31) — **80 kWh** de luz por mês com desconto total para família de baixa renda na Tarifa Social — [Lei nº 12.212/2010, art. 1º, com redação dada pela Lei nº 15.235/2025](https://www.planalto.gov.br/ccivil_03/_ato2007-2010/2010/lei/l12212.htm), 2025. Conferir: “para a parcela do consumo de energia elétrica inferior ou igual a 80 kWh/mês (oitenta quilowatts-hora por mês), o desconto será de 100% (cem por cento)”. Pergunta: “Na sua família ou na vizinhança, alguém tem o desconto da tarifa social na luz?”
  - [ ] `capitulos[3].propostas[3]` **Menos imposto na luz e no combustível** (p. 31) — **R$ 1,57** de imposto estadual (ICMS) em cada litro de gasolina, igual em todo o país — [Confaz, Convênio ICMS nº 112/2025 (valor em vigor desde 1º/01/2026)](https://www.confaz.fazenda.gov.br/legislacao/convenios/2025/CV112_25), 2026. Conferir: “em R$ 1,57 por litro, para a gasolina e etanol anidro combustível”. Pergunta: “Na sua casa, como estão a conta de luz e o gasto com combustível ou passagem?” Cuidado: Vale lembrar que o ICMS é dos estados: o presidente não reduz esse valor sozinho.
  - [ ] `capitulos[3].propostas[4]` **Frete mais barato e safra protegida** (p. 31) — **Quase 70%** da carga transportada no país vai de caminhão, medida em peso e distância — [Infra S.A./ONTL, Panorama do Transporte Rodoviário de Cargas no Brasil (2026)](https://ontl.infrasa.gov.br/wp-content/uploads/2026/09/Panorama-do-Transporte-Rodoviario-de-Cargas-do-Brasil.pdf), 2021. Conferir: “o setor rodoviário é responsável por 68,5% da movimentação em Tonelada-Quilômetro Útil (TKU)”. Pergunta: “Já aconteceu de você notar um alimento mudar muito de preço de um mês para o outro?”
  - [ ] `capitulos[3].propostas[5]` **Benefício social fora das apostas** (p. 33) — **R$ 3 bilhões** enviados às bets via Pix por pessoas de famílias do Bolsa Família em um mês — [Banco Central do Brasil, Estudo Especial nº 119/2024 (estimativa para agosto de 2024)](https://www.bcb.gov.br/conteudo/relatorioinflacao/EstudosEspeciais/EE119_Analise_tecnica_sobre_o_mercado_de_apostas_online_no_Brasil_e_o_perfil_dos_apostadores.pdf), 2024. Conferir: “estima-se que, em agosto de 2024, 5 milhões de pessoas pertencentes a famílias beneficiárias do Bolsa Família (PBF) enviaram R$ 3 bilhões às empresas de aposta utilizando a plataforma Pix”. Pergunta: “Como você vê as apostas pelo celular hoje em dia?” Cuidado: É estimativa do Banco Central e não separa o benefício de outras rendas. Evite dizer que o Bolsa Família foi para a aposta.
- [ ] `capitulos[4]` **Escola, saúde e cuidado** (no plano: Brasil que Prepara, p. 34–41): `titulo` e `chamada` (“Escola melhor, da alfabetização ao curso técnico, e mais cuidado no SUS, inclusive para pessoas com autismo.”)
  - [ ] `capitulos[4].propostas[0]` **Alfabetizar pelo método fônico** (p. 35) — **1 em cada 3** crianças da escola pública terminou o 2º ano sem estar alfabetizada — [Inep, Indicador Criança Alfabetizada 2025](https://download.inep.gov.br/avaliacao_da_alfabetizacao/resultados/brasil_2025.pdf), 2025. Conferir: “Resultado 2025 Nacional 66% [...] Rede Pública”. Pergunta: “Tem criança aprendendo a ler na sua família? Como está sendo?” Cuidado: O índice vem melhorando nos últimos anos, então evite dizer que a alfabetização piorou.
  - [ ] `capitulos[4].propostas[1]` **Mais escolas cívico-militares** (p. 35) — **21%** da aula vai para manter a ordem, contam professores do 6º ao 9º ano — [OCDE, pesquisa TALIS 2024 (professores do 6º ao 9º ano)](https://www.oecd.org/en/publications/results-from-talis-2024-country-notes_e127f9e2-en/brazil_1e93d3b5-en.html), 2024. Conferir: “spending 21% of class time on keeping order in the classroom (higher than the OECD average 15%)”. Pergunta: “Como você vê a disciplina nas escolas aqui do bairro?” Cuidado: Não há dado oficial de que essas escolas melhoram as notas. Prefira falar de disciplina e de tempo de aula.
  - [ ] `capitulos[4].propostas[2]` **Escola o dia inteiro** (p. 35) — **1 em cada 4** matrículas da escola pública é de tempo integral (aula o dia todo) — [Inep, Censo Escolar 2025](https://download.inep.gov.br/censo_escolar/resultados/2025/apresentacao_coletiva.pdf), 2025. Conferir: “Percentual de matrículas presenciais em tempo integral na rede pública [...] Educação básica - ensino regular [...] 25,8%”. Pergunta: “Aqui no bairro, com quem as crianças ficam no horário em que não têm aula?”
  - [ ] `capitulos[4].propostas[3]` **Profissão já no ensino médio** (p. 36) — **1 em cada 5** matrículas do ensino médio público vem com curso técnico (ou magistério) junto — [Inep, Censo Escolar 2025](https://download.inep.gov.br/censo_escolar/resultados/2025/apresentacao_coletiva.pdf), 2025. Conferir: “Razão entre matrículas de cursos técnicos* articulados (integrados ou concomitantes) ao ensino médio regular e o total de matrículas do ensino médio regular, por unidade da federação na rede pública - Brasil – 2025 [...] Brasil 20,1%”. Pergunta: “Na sua família, tem jovem terminando o ensino médio? O que ele pensa em fazer depois?”
  - [ ] `capitulos[4].propostas[4]` **Tabela do SUS que cubra o custo real** (p. 37) — **R$ 10** é o valor da tabela do SUS por consulta com especialista, o mesmo de 2008 — [Ministério da Saúde, Tabela SUS (SIGTAP), setembro de 2026](http://sigtap.datasus.gov.br/tabela-unificada/app/sec/procedimento/exibir/0301010072/09/2026), 2026. Conferir: “0301010072CONSULTA MEDICA EM ATENÇÃO ESPECIALIZADA [...] 000000001000”. Pergunta: “Você ou alguém da família já precisou de consulta com especialista pelo SUS? Como foi?” Cuidado: R$ 10 é o valor de referência federal, e prefeituras e estados completam. Evite dizer que o médico ganha R$ 10.
  - [ ] `capitulos[4].propostas[5]` **Centros de referência em autismo** (p. 39) — **2,4 milhões** de pessoas no Brasil já foram diagnosticadas com autismo, 1,2% da população — [IBGE, Censo Demográfico 2022](https://educa.ibge.gov.br/jovens/materias-especiais/22700-censo-2022-contou-2-4-milhoes-de-pessoas-diagnosticadas-com-autismo-no-brasil.html), 2022. Conferir: “os resultados mostraram que 2,4 milhões de pessoas foram diagnosticadas, o que corresponde a 1,2% da população residente no Brasil”. Pergunta: “Você conhece alguma família com uma pessoa autista? Como tem sido o atendimento por aqui?” Cuidado: O plano não diz quantos centros serão nem onde ficarão. Evite prometer um centro na cidade.
- [ ] `capitulos[5]` **Trabalho, renda e casa própria** (no plano: Brasil que Prospera, p. 42–48): `titulo` e `chamada` (“Manter a ajuda a quem precisa e abrir caminho para o emprego com carteira, o negócio próprio e a casa própria.”)
  - [ ] `capitulos[5].propostas[0]` **Programas sociais continuam** (p. 42) — **mais de 19 milhões** de famílias recebem o Bolsa Família (setembro de 2026) — [Ministério do Desenvolvimento e Assistência Social (MDS)](https://www.gov.br/mds/pt-br/noticias/bolsa-familia-pagamentos-de-setembro-comecam-nesta-quinta-feira-17-09), 2026. Conferir: “o valor médio de R$ 678,18 para 19,29 milhões de famílias no Brasil”. Pergunta: “Como você vê a ideia de manter os programas sociais e combater as fraudes?”
  - [ ] `capitulos[5].propostas[1]` **Tentar um emprego sem perder o benefício** (p. 43) — **até 5 meses** é quanto dura o seguro-desemprego pela regra geral (de 3 a 5 parcelas) — [Lei 7.998/1990, art. 4º (texto dado pela Lei 13.134/2015)](https://www.planalto.gov.br/ccivil_03/leis/l7998.htm), 2015. Conferir: “por período máximo variável de 3 (três) a 5 (cinco) meses”. Pergunta: “Já aconteceu de alguém perto de você ficar na dúvida entre o benefício e um emprego?” Cuidado: A lei já dá prioridade para voltar ao benefício; a proposta é a volta imediata e sem fila. Evite dizer que hoje não existe volta.
  - [ ] `capitulos[5].propostas[2]` **Mais carteira assinada** (p. 43) — **quase 14 milhões** de empregados do setor privado trabalham sem carteira assinada (junho a agosto de 2026) — [IBGE, PNAD Contínua (trimestre de junho a agosto de 2026)](https://agenciadenoticias.ibge.gov.br/agencia-sala-de-imprensa/2013-agencia-de-noticias/releases/48148-pnad-continua-taxa-de-desocupacao-e-de-5-3-e-taxa-de-subutilizacao-e-de-13-1-no-trimestre-encerrado-em-agosto), 2026. Conferir: “O número de empregados sem carteira no setor privado (13,7 milhões) ficou estável no trimestre e no ano.”. Pergunta: “Você ou alguém de casa já trabalhou sem carteira assinada? Como foi?”
  - [ ] `capitulos[5].propostas[3]` **Vaga para quem tem 50 anos ou mais** (p. 44) — **1,7 milhão** de desempregados (todas as idades) procuram trabalho há 1 ano ou mais (abr.–jun. 2026) — [IBGE, PNAD Contínua trimestral, tabela Sidra 1616](https://sidra.ibge.gov.br/tabela/1616), 2026. Conferir: “2º trimestre 2026 | De 1 ano a menos de 2 anos | Mil pessoas | 635; 2 anos ou mais | Mil pessoas | 1058”. Pergunta: “Você conhece alguém com 50 anos ou mais que procura emprego faz tempo?” Cuidado: O número inclui todas as idades, então evite dizer que a maioria tem mais de 50 anos.
  - [ ] `capitulos[5].propostas[4]` **Ajuda para abrir o primeiro negócio** (p. 45) — **27%** dos trabalhadores por conta própria tinham CNPJ em 2025; a maioria trabalha sem empresa aberta — [IBGE, PNAD Contínua – Características adicionais do mercado de trabalho 2025](https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/48112-em-2025-taxa-de-sindicalizacao-fica-em-8-8-da-populacao-ocupada), 2025. Conferir: “Proporção da população ocupada por conta própria com CNPJ saltou de 15,0%, em 2012, para o seu ápice histórico de 27,1%, em 2025.”. Pergunta: “Você conhece alguém que trabalha por conta e pensa em abrir a própria empresa?”
  - [ ] `capitulos[5].propostas[5]` **Casa própria com juro menor** (p. 47) — **quase 1 em cada 4** lares no Brasil era alugado em 2025 (18,9 milhões de moradias) — [IBGE, PNAD Contínua – Características dos domicílios e dos moradores 2025](https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/46449-domicilios-alugados-cresceram-mais-de-50-desde-2016), 2025. Conferir: “Quase um quarto dos domicílios brasileiros são alugados”. Pergunta: “Na sua família, alguém sonha em sair do aluguel e ter a casa própria?” Cuidado: O Casa Verde e Amarela foi substituído pelo Minha Casa, Minha Vida em 2023: se o vizinho comentar, ele tem razão.
- [ ] `capitulos[6]` **Obras, transporte e emprego** (no plano: Brasil que Cresce, p. 49–64): `titulo` e `chamada` (“Fazer o país crescer mais: estradas e trilhos, transporte na cidade, floresta protegida e portas abertas ao mundo.”)
  - [ ] `capitulos[6].propostas[0]` **Meta de crescer 4% ao ano** (p. 49) — **2,3%** crescimento da economia brasileira em 2025 — [IBGE, Contas Nacionais Trimestrais (divulgado em 03/03/2026)](https://agenciadenoticias.ibge.gov.br/agencia-noticias/2012-agencia-de-noticias/noticias/45969-pib-cresce-2-3-em-2025), 2025. Conferir: “O Produto Interno Bruto (PIB) do país encerrou 2025 com crescimento de 2,3%.”. Pergunta: “Como você vê as oportunidades de trabalho na sua região hoje?”
  - [ ] `capitulos[6].propostas[1]` **Estradas, ferrovias, portos e aeroportos** (p. 51) — **quase 70%** da carga transportada no Brasil vai de caminhão, contando peso e distância — [Infra S.A./ONTL (Ministério dos Transportes), Panorama do Transporte Rodoviário de Cargas no Brasil](https://ontl.infrasa.gov.br/wp-content/uploads/2026/09/Panorama-do-Transporte-Rodoviario-de-Cargas-do-Brasil.pdf), 2021. Conferir: “Os dados de 2021 mostram que o setor rodoviário é responsável por 68,5% da movimentação em Tonelada-Quilômetro Útil (TKU)”. Pergunta: “Na sua região, qual obra de transporte faria mais diferença?”
  - [ ] `capitulos[6].propostas[2]` **Prioridade no crédito para metrô, trem e ônibus** (p. 51) — **1,3 milhão** de trabalhadores levam mais de 2 horas para chegar ao trabalho — [IBGE, Censo Demográfico 2022: deslocamentos para o trabalho (divulgado em 09/10/2025)](https://educa.ibge.gov.br/jovens/materias-especiais/23064-censo-2022-como-a-populacao-se-desloca-para-estudar-e-trabalhar.html), 2022. Conferir: “perto de 1,3 milhão de pessoas levam mais de duas horas para chegar ao local de trabalho”. Pergunta: “Quanto tempo você leva para chegar ao trabalho? Como é esse caminho?”
  - [ ] `capitulos[6].propostas[3]` **Desmatamento ilegal zero até 2029** (p. 58) — **5,7 mil km²** de floresta desmatada na Amazônia Legal em um ano (ago/2024 a jul/2025) — [INPE, Prodes (taxa consolidada, publicada em 18/08/2026)](https://www.gov.br/inpe/pt-br/assuntos/ultimas-noticias/sistema-do-inpe-aponta-5-731-km2-de-desmatamento-na-amazonia-em-2025), 2025. Conferir: “A taxa consolidada de desmatamento na Amazônia Legal em 2025 é de 5.731 km²”. Pergunta: “Como você vê a ideia de proteger a floresta e, ao mesmo tempo, apoiar quem produz?” Cuidado: Vale lembrar: o número soma desmatamento legal e ilegal, e caiu em relação ao ano anterior.
  - [ ] `capitulos[6].propostas[4]` **Trem ligando capitais do Nordeste** (p. 60) — **2** linhas regulares de trem de passageiros nas grandes ferrovias do país — [ANTT (Agência Nacional de Transportes Terrestres), página Trens regulares](https://www.gov.br/antt/pt-br/assuntos/passageiros/passageiros-ferroviarios/passageiros-ferroviarios), 2026. Conferir: “Atualmente, existem duas linhas de trens de passageiros regulares na malha ferroviária concedida brasileira.”. Pergunta: “Você já viajou entre capitais do Nordeste? Pegaria um trem, se tivesse um?”
  - [ ] `capitulos[6].propostas[5]` **Retomar a entrada na OCDE** (p. 63) — **38** países são membros da OCDE; o Brasil é um dos 8 candidatos a entrar — [OCDE, página oficial Members and partners](https://www.oecd.org/en/about/members-partners.html), 2026. Conferir: “The OECD's 38 Member countries span the world”. Pergunta: “Você já tinha ouvido falar da OCDE? O que acha de o Brasil fazer parte?” Cuidado: Fale da proposta sem culpar ninguém pela pausa no processo de entrada.
- [ ] `capitulos[7]` **Regras iguais para todos** (no plano: Brasil que Cumpre a Constituição, p. 65–67): `titulo` e `chamada` (“Mudanças no funcionamento do STF, fim da reeleição para presidente e liberdade para criticar qualquer governo.”)
  - [ ] `capitulos[7].propostas[0]` **Parlamentar julgado fora do STF** (p. 65) — **11** ministros no STF: cuidam da Constituição e também julgam crimes de deputados e senadores — [Constituição Federal, arts. 101 e 102 (Planalto)](https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm), 1988. Conferir: “O Supremo Tribunal Federal compõe-se de onze Ministros”. Pergunta: “O que você acha de deputados e senadores serem julgados por outros tribunais, e não pelo STF?” Cuidado: Vale lembrar: desde 2018, o STF só julga crimes de parlamentares cometidos no mandato e ligados à função.
  - [ ] `capitulos[7].propostas[1]` **Mais decisões em grupo no STF** (p. 65) — **8 em cada 10** decisões do STF em 2025 foram tomadas por um ministro sozinho — [Supremo Tribunal Federal, Relatório de Atividades 2025 (série STF Dados)](https://noticias.stf.jus.br/postsnoticias/maioria-das-decisoes-individuais-do-stf-trata-do-andamento-dos-processos/), 2025. Conferir: “O STF proferiu 94.934 decisões monocráticas no ano, o equivalente a cerca de 80% de todas as decisões registradas no período.”. Pergunta: “Como você vê a ideia de decisões importantes do STF serem tomadas pelo grupo de ministros?” Cuidado: Cerca de 3 em cada 4 decisões individuais são de rotina. Fale da regra, sem citar nomes de ministros.
  - [ ] `capitulos[7].propostas[2]` **Quarentena antes de ir para o STF** (p. 65) — **6 meses** espera que a lei já exige de ex-ministro antes de trabalhar em empresa da área — [Lei 12.813/2013 (Lei de Conflito de Interesses), arts. 2º e 6º (Planalto)](https://www.planalto.gov.br/ccivil_03/_ato2011-2014/2013/lei/l12813.htm), 2013. Conferir: “II - no período de 6 (seis) meses, contado da data da dispensa, exoneração, destituição, demissão ou aposentadoria”. Pergunta: “O que você acha de quem sai do governo esperar um tempo antes de ir para o STF?” Cuidado: Fale da regra, sem citar nomes de ministros nem de governos.
  - [ ] `capitulos[7].propostas[3]` **Fim da reeleição para presidente** (p. 66) — **1997** ano em que a Constituição passou a permitir a reeleição de presidente — [Emenda Constitucional 16/1997 (Planalto)](https://www.planalto.gov.br/ccivil_03/constituicao/emendas/emc/emc16.htm), 1997. Conferir: “EMENDA CONSTITUCIONAL Nº 16, DE 04 DE JUNHO DE 1997 [...] poderão ser reeleitos para um único período subseqüente.”. Pergunta: “O que você acha de acabar com a reeleição para presidente?” Cuidado: Acabar com a reeleição exige uma emenda à Constituição, votada pelo Congresso.
  - [ ] `capitulos[7].propostas[4]` **Liberdade para criticar qualquer governo** (p. 67) — **1988** ano da Constituição que proíbe "toda e qualquer censura de natureza política" — [Constituição Federal, art. 220, § 2º (Planalto)](https://www.planalto.gov.br/ccivil_03/constituicao/constituicao.htm), 1988. Conferir: “CONSTITUIÇÃO DA REPÚBLICA FEDERATIVA DO BRASIL DE 1988 [...] § 2º É vedada toda e qualquer censura de natureza política, ideológica e artística.”. Pergunta: “Como você vê a liberdade de criticar qualquer governo, de qualquer lado?” Cuidado: Fale do princípio, que vale para qualquer governo, sem acusar pessoas nem governos.
- [ ] `capitulos[8]` **Contas em ordem** (no plano: Brasil que Não Volta Atrás, p. 68–73): `titulo` e `chamada` (“Governo mais enxuto, salários dentro do teto, estatais avaliadas caso a caso, contas equilibradas e mais controle nos descontos do INSS.”)
  - [ ] `capitulos[8].propostas[0]` **Pelo menos 10 ministérios a menos** (p. 69) — **38** ministérios e órgãos com status de ministério no governo federal em 2026 — [Lei nº 14.600/2023, arts. 17 e 18 (texto compilado no site do Planalto)](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2023/lei/l14600.htm), 2026. Conferir: “Art. 17. Os Ministérios são os seguintes: I - Ministério da Agricultura e Pecuária; [...] XII-A Ministério do Empreendedorismo, da Microempresa e da Empresa de Pequeno Porte; [...] XXXI - Controladoria-Geral da União. Art. 18. São Ministros de Estado: I - os titulares dos Ministérios; [...] VII - o Advogado-Geral da União.”. Pergunta: “O que você acha de o governo federal ter menos ministérios?”
  - [ ] `capitulos[8].propostas[1]` **Salários do serviço público dentro do teto** (p. 69) — **R$ 46 mil** por mês: teto do salário no serviço público, igual ao de ministro do STF — [Supremo Tribunal Federal, Informativo STF nº 1210 (8/4/2026), teses do julgamento de 25/03/2026 (valor fixado pela Lei nº 14.520/2023)](https://www.stf.jus.br/arquivo/informativo/documento/informativo1210.htm), 2026. Conferir: “reafirma o atual valor do teto constitucional, mantido em R$ 46.366,19, subsídio dos Ministros do Supremo Tribunal Federal”. Pergunta: “Como você vê os auxílios que levam alguns salários públicos acima do teto?” Cuidado: Em 2026, o STF derrubou vários auxílios, mas alguns extras continuam. Por isso, não diga que eles acabaram.
  - [ ] `capitulos[8].propostas[2]` **Venda de estatais, caso a caso** (p. 70) — **44** empresas estatais que o governo federal controla diretamente (sem contar as subsidiárias) — [Ministério da Gestão e da Inovação (Sest), página do Boletim Trimestral das Estatais](https://www.gov.br/gestao/pt-br/assuntos/estatais/transparencia/boletim-trimestral-sest), 2026. Conferir: “O boletim traz resultados operacionais de todas as 44 estatais”. Pergunta: “Para você, em que áreas faz sentido o governo ter empresa própria?” Cuidado: O plano não diz quais estatais seriam vendidas. Evite citar nomes de empresas.
  - [ ] `capitulos[8].propostas[3]` **Gastar dentro do orçamento** (p. 71) — **quase R$ 1,2 trilhão** em juros da dívida do setor público em 12 meses, até agosto de 2026 — [Banco Central do Brasil, Estatísticas Fiscais (nota para a imprensa de 30/09/2026)](https://www.bcb.gov.br/content/estatisticas/hist_estatisticasfiscais/202609_Texto_de_estatisticas_fiscais.pdf), 2026. Conferir: “No acumulado em doze meses até agosto, os juros nominais alcançaram R$1.182,2 bilhões (8,86% do PIB)”. Pergunta: “O que você acha de o governo gastar só o que cabe no orçamento?” Cuidado: O número é o custo dos juros no período, não o dinheiro já pago. Fale do problema, sem culpar ninguém.
  - [ ] `capitulos[8].propostas[4]` **Pacote contra fraude no INSS** (p. 72) — **R$ 1,3 bilhão** descontado por associações dos benefícios do INSS em 2023, mais que o dobro de 2021 — [Controladoria-Geral da União (CGU), Relatório de Auditoria nº 1675291 (publicado em 23/04/2025)](https://eaud.cgu.gov.br/relatorio/1675762), 2023. Conferir: “de R$ 536,3 milhões em 2021 a R$ 1,3 bilhão em 2023, podendo alcançar R$ 2,6 bilhões em 2024”. Pergunta: “Já aconteceu de você ou alguém da família ter um desconto não reconhecido no benefício do INSS?” Cuidado: O número é o total descontado por associações, não o valor de fraude comprovada.
  - [ ] `capitulos[8].propostas[5]` **Desconto no benefício só com autorização** (p. 73) — **quase 98 em cada 100** aposentados e pensionistas ouvidos pela CGU disseram não ter autorizado o desconto de associação — [Controladoria-Geral da União (CGU), Relatório de Auditoria nº 1675291 (entrevistas de 17/04 a 04/07/2024)](https://eaud.cgu.gov.br/relatorio/1675762), 2024. Conferir: “1.242 beneficiários entrevistados (97,6%) informaram não ter autorizado o desconto”. Pergunta: “O que você acha de todo desconto no benefício precisar da confirmação do próprio aposentado?” Cuidado: Vale lembrar: o número vem de entrevistas com uma amostra, não de todos os descontos.

## 13. Roteiros de conversa — `src/conteudo/roteiros.json` (MUDOU na revisão de tom (06/10/2026))

Na revisão de tom: frases-guia e fechamentos mais calmos, sem cobrar a pessoa; pontes com a proposta (não o
diagnóstico) e citações novas onde a anterior soava como ataque. Os cuidados legais ficaram palavra por palavra.

- [ ] `geral.titulo` e `geral.fraseGuia`
- [ ] `geral.passos` (8 passos)
- [ ] `geral.cuidados` (10 cuidados): não insistir, não adicionar a grupo sem o sim da pessoa, nunca pôr a urna em dúvida, nada no dia da votação, compra de voto é crime, não oferecer carona nem transporte, não imprimir panfleto por conta própria
- [ ] `fichas.abstencao` **Quem não foi votar**
  - [ ] `fichas.abstencao.titulo` e `fichas.abstencao.fraseGuia` (“Primeiro, escute. Cada pessoa teve seu motivo para não ir, e a conversa começa por ele.”)
  - [ ] `fichas.abstencao.contexto` (3 parágrafos; fatos na seção 16)
  - [ ] `fichas.abstencao.passos` (6 passos)
  - [ ] `fichas.abstencao.pontes[0]` “Tempo perdido em fila”: `tema` e `texto` (citações p. 25, 26)
  - [ ] `fichas.abstencao.pontes[1]` “Conta de luz e combustível”: `tema` e `texto` (citações p. 31, 31)
  - [ ] `fichas.abstencao.pontes[2]` “Segurança no bairro”: `tema` e `texto` (citações p. 15, 13)
  - [ ] `fichas.abstencao.pontes[3]` “Creche”: `tema` e `texto` (citações p. 21, 21)
  - [ ] `fichas.abstencao.cuidados` (7 cuidados)
- [ ] `fichas.branco` **Quem votou em branco**
  - [ ] `fichas.branco.titulo` e `fichas.branco.fraseGuia` (“Votar em branco também é um recado. Pergunte, com interesse, qual foi.”)
  - [ ] `fichas.branco.contexto` (2 parágrafos; fatos na seção 16)
  - [ ] `fichas.branco.passos` (6 passos)
  - [ ] `fichas.branco.pontes[0]` “Mudanças na política”: `tema` e `texto` (citações p. 66, 65)
  - [ ] `fichas.branco.pontes[1]` “Governo que gasta menos consigo mesmo”: `tema` e `texto` (citações p. 69, 69)
  - [ ] `fichas.branco.pontes[2]` “Programas sociais”: `tema` e `texto` (citações p. 42, 42)
  - [ ] `fichas.branco.cuidados` (6 cuidados)
- [ ] `fichas.nulo` **Quem anulou o voto**
  - [ ] `fichas.nulo.titulo` e `fichas.nulo.fraseGuia` (“Anular pode ser protesto ou engano. Pergunte com calma, sem cobrar.”)
  - [ ] `fichas.nulo.contexto` (3 parágrafos; fatos na seção 16)
  - [ ] `fichas.nulo.passos` (6 passos)
  - [ ] `fichas.nulo.pontes[0]` “Estatal longe da política”: `tema` e `texto` (citações p. 70, 70)
  - [ ] `fichas.nulo.pontes[1]` “Aposentado protegido de fraude”: `tema` e `texto` (citações p. 72, 73)
  - [ ] `fichas.nulo.pontes[2]` “Direito de reclamar”: `tema` e `texto` (citações p. 67)
  - [ ] `fichas.nulo.cuidados` (6 cuidados)
- [x] `fichas.cury`: **fase 2, sem texto** (status `fase2`; não aparece no site)
- [x] `fichas.renan`: **fase 2, sem texto** (status `fase2`; não aparece no site)
- [x] `fichas.caiado`: **fase 2, sem texto** (status `fase2`; não aparece no site)
- [x] `fichas.zema`: **fase 2, sem texto** (status `fase2`; não aparece no site)

## 14. Página Sobre — `src/conteudo/sobre.md`

- [ ] Quem faz (apoio declarado, “não é oficial”, sem anúncios, doações ou impulsionamento) — MUDOU (06/10/2026): o responsável saiu deste parágrafo e foi para uma linha discreta no fim da página
- [ ] Para que serve — MUDOU na revisão de tom (06/10/2026): “o resultado de cada local”
- [x] Como ler os números (“até”, “dá para virar”, “vantagem a defender”, “folga” — todos como teto)
- [x] De onde vêm os números (TSE CC-BY com nota de modificação, conferência, reclassificação, reserva MIT, locais sem posição, voto em trânsito e presos provisórios fora do mapa, eleitores no exterior fora do número “no Brasil” — NOVO em 06/10/2026, com `{{exterior.ate}}` vindo do índice —, IBGE, plano, mapa, fontes)
- [x] Limitações
- [x] Atualização (data do índice)

## 15. Aviso de privacidade — `src/conteudo/privacidade.md`

- [x] Versão (data) e site
- [x] Quem cuida dos dados (controlador e contato)
- [x] O que o site não faz (cookies, analytics, conta, busca)
- [x] Sua localização (fica no aparelho; o que os pedidos revelam; link arredondado)
- [x] O que outros serviços recebem (hospedagem Vercel, nos EUA — MUDOU em 06/10/2026: transferência internacional, LGPD art. 33; OpenFreeMap, Google Maps e Waze, WhatsApp) — MUDOU (06/10/2026): OpenFreeMap também entrega letras e ícones do mapa e sabe que o pedido vem do site; empresa sediada na Hungria, pode usar a Cloudflare (EUA): transferência internacional (LGPD, art. 33). Fonte: openfreemap.org/privacy, atualizada em 04/10/2026 — reconferir antes de publicar
- [x] O que fica registrado — MUDOU (06/10/2026, Vercel): nós não guardamos IP; o painel da hospedagem mostra registros técnicos por pouco tempo e a visão do tráfego por IP (proteção contra ataques) cobre só as últimas 24 h; apagamos o que estiver sob nosso controle até 31/10/2026
- [x] Para que usamos
- [x] Seus direitos (LGPD, arts. 18 e 19; ANPD)

## 16. Afirmações de fato e de lei nos textos (conferir a fonte antes de aprovar)

- [x] “Branco e nulo ficam fora dos votos válidos; no 2º turno vence quem tiver a maioria dos votos válidos” — Lei 9.504/1997, art. 2º, caput e §1º (`fichas.branco.contexto`, `fichas.nulo.contexto`, `textos.alvoAqui.notaValidos`, Sobre).
- [x] “Voto em branco não vai para quem está na frente” e “muitos votos nulos não cancelam a eleição” — consequência do art. 2º; o art. 224 do Código Eleitoral trata de nulidade por vício, não do voto nulo do eleitor (`fichas.branco.cuidados`, `fichas.nulo.cuidados`). Conferir com o advogado.
- [x] “Abstenção foi o maior grupo fora dos dois finalistas no país” — resultado oficial do TSE do 1º turno (abstenção 33.469.244; brancos 2.300.798; nulos 3.674.249) (`fichas.abstencao.contexto`).
- [x] “Quem faltou no 1º turno continua podendo votar no 2º” (`fichas.abstencao.contexto`).
- [x] “Na urna, número inexistente mostra aviso de voto nulo; dá para apertar CORRIGE” (`fichas.nulo.contexto`, `fichas.nulo.passos`).
- [x] “Local de votação no aplicativo e-Título e no site do TSE” (`fichas.abstencao.passos`, `textos.diaDaVotacao`).
- [x] “Oferecer vantagem em troca de voto é crime eleitoral” — Código Eleitoral, art. 299 (`geral.cuidados`).
- [x] “Votos no nº de `reclassificarComoNulo` contados como nulos no resultado oficial” — nulos técnicos do resultado oficial; confirmado pelo portão de totais do ETL a cada rodada (Sobre).
- [x] “Locais sem posição confiável entram nos totais do país e dos estados” — confirmar com a saída do ETL (`indice.brasil` e `indice.ufs[UF].eleitoresSemPosicao`) (Sobre).
- [x] “Seções de voto em trânsito e de presos provisórios (presídios e internação de adolescentes) ficam fora do mapa e da busca, mas entram nos totais” — critério `CD_TIPO_LOCAL` 2 e 3 do cadastro do TSE; contagem em `indice.brasil.eleitoresForaDoMapa` e `indice.ufs[UF].eleitoresForaDoMapa` (Sobre; decisão do responsável de 05/10/2026).
- [x] Privacidade: o comportamento descrito (sem cookies, nós não guardamos IP, retenção curta no painel da Vercel conforme a documentação dela, busca por até quatro prefixos de três letras, fontes do texto próprias, OpenFreeMap na Hungria/Cloudflare) tem de bater com o site publicado.
- [x] “Não ofereça carona nem transporte para votar: levar eleitor perto da eleição é crime eleitoral (Código Eleitoral, art. 302; Lei 6.091/1974)” (`geral.cuidados`, `fichas.abstencao.cuidados`, NOVO em 06/10/2026). O art. 302 do Código Eleitoral foi conferido no texto local; **a Lei 6.091/1974 (arts. 5º e 11) não está nos textos locais: conferir com o advogado antes de aprovar**.
- [x] “Material impresso de campanha é feito pela campanha, com CNPJ ou CPF de quem fez e tiragem” — Lei 9.504, art. 38, caput e §1º, conferido no texto local (`geral.cuidados`, NOVO em 06/10/2026).
- [x] “Nulo é, quase sempre, o voto em número que não existe… uma parte pequena foi para candidato com registro negado” — 5.246 dos 3.674.249 nulos foram para o nº 28 (resultado oficial); Código Eleitoral, art. 175, §3º (`fichas.nulo.contexto`, MUDOU em 06/10/2026).

- [ ] Afirmações dentro dos **cuidados** dos cartões do plano (MUDOU na revisão de tom (06/10/2026): os mesmos fatos, em tom de conselho; NOVOS cuidados sobre o próprio plano, sem fonte externa: o plano não cita fonte para o “100%” das facções (p. 14), não diz quantos centros de autismo nem onde, e não diz quais estatais seriam vendidas. NOVO em 06/10/2026; vieram da verificação das fontes, conferir antes de aprovar): a lei antiterrorismo (Lei 13.260/2016) não inclui facções; o sistema penitenciário federal tinha vagas sobrando no fim de 2025 (Senappen); a lei já prevê tornozeleira em agressor em casos de risco; a fila do INSS diminuiu em 2026; o ICMS é estadual; a cesta básica tem alíquota zero no novo imposto; o índice de alfabetização vem melhorando (Inep); não há dado oficial de que escolas cívico-militares melhoram notas; a tabela do SUS é valor de referência federal, completado por estados e prefeituras; a Lei 14.601/2023 já dá prioridade de retorno ao benefício; o Casa Verde e Amarela foi substituído pelo Minha Casa, Minha Vida (Lei 14.620/2023); o Prodes soma desmatamento legal e ilegal; desde 2018 o STF só julga parlamentar por crime do mandato e ligado à função; cerca de 3 em 4 decisões individuais do STF são de rotina; em 2026 o STF derrubou auxílios de juízes e promotores, mas ainda há extras; os números da CGU são descontos de associações (não fraude comprovada) e amostra de entrevistas.

## 17. Textos gerados fora de src/conteudo — `nucleo/frases.ts` (aprovar também)

- [x] `fracaoHumana`: “1 em cada 3”, “mais de …”, “quase …”, “menos de 1%”, “mais de 99%” (usada em `textos.resultado.alcance`).
- [x] `cercaDe`: “cerca de N”.
- [x] `formatarDistancia`: “350 m”, “1,2 km”.
- [x] `nomeLocal`: título do item da lista e da ficha, “<local> e mais N”.
- [x] `nomeRegiao`: “bairro, município”.

## 18. Comparação entre os planos — `src/conteudo/comparacao.json` (NOVO em 06/10/2026)

Página #/comparar: os mesmos assuntos nos dois planos registrados no TSE. Cada lado tem um resumo nosso e
trechos literais com a página (conferidos por programa contra os dois PDFs, fonte `adversario` =
`dados/fontes/plano-<adversário>.pdf`, SHA-256 `e1c162c20c81…`). Em cada assunto, confira:
1. os dois resumos são fiéis ao que cada plano diz, com o mesmo cuidado e o mesmo tom para os dois lados;
2. nenhum lado ficou com um trecho escolhido para parecer pior do que o plano é;
3. “em comum” e “a diferença” descrevem propostas, sem adjetivo, sem ataque e sem dizer qual é melhor.

- [ ] `documentoAdversario.url` abre o PDF oficial do TSE (84 páginas), e `#page=N` cai na página certa
- [ ] `temas[0]` **Segurança pública** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 13, 13 × p. 30, 27 do outro plano)
- [ ] `temas[1]` **Saúde** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 37, 26 × p. 37, 38 do outro plano)
- [ ] `temas[2]` **Educação** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 35, 35 × p. 31, 32 do outro plano)
- [ ] `temas[3]` **Trabalho e emprego** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 43, 44 × p. 75, 74 do outro plano)
- [ ] `temas[4]` **Combate à pobreza e programas sociais** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 42, 43 × p. 18, 24 do outro plano)
- [ ] `temas[5]` **Impostos e custo de vida** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 30, 31 × p. 49, 48 do outro plano)
- [ ] `temas[6]` **Moradia** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 47, 47 × p. 45, 46 do outro plano)
- [ ] `temas[7]` **Meio ambiente** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 58, 57 × p. 70, 72 do outro plano)
- [ ] `temas[8]` **Mulheres** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 17, 19 × p. 21, 21 do outro plano)
- [ ] `temas[9]` **Economia e contas públicas** — pergunta, resumos, “em comum” e “a diferença” (citações: p. 71, 69 × p. 49, 49 do outro plano)

---

Aprovado por: ______________________  Data: __________

Registro anterior: aprovação dada pelo responsável na conversa de 06/10/2026 ("aprovo tudo. adv fica pra depois"), depois de ver o site pela prévia e ler os textos que não aparecem navegando. A validação jurídica ficou adiada (item no topo).

Revisão de tom e comparação (06/10/2026): textos mudados depois da aprovação anterior; aguardam nova leitura e a aprovação do responsável.
