<!-- Texto-modelo: os nomes entre chaves duplas são preenchidos pelo site (src/conteudo/modelo.ts). Revisão: src/conteudo/APROVACAO.md -->

# Sobre o {{site.nome}}

## Quem faz

O {{site.nome}} é um site independente, de apoio a {{alvo.nomeUrna}} ({{alvo.numero}}) no 2º turno. **Não é o site oficial de nenhuma campanha, candidato ou partido.**

Responsável: {{responsavel.nome}}. Contato: {{responsavel.contato}}.

O site não tem anúncios, não aceita doações e não paga para aparecer em redes sociais nem em buscadores.

## Para que serve

Você escolhe um ponto no mapa. O site mostra onde votam, ali perto, pessoas que no 1º turno não votaram em nenhum dos dois finalistas, como foi a disputa em cada local e que assunto puxar.

A ideia é conversa pessoal, de vizinho para vizinho, com respeito. A conversa vai até {{fimConversa}}. No dia da votação, o site fica só para consulta.

## Como ler os números

- **“Até”** soma, num raio de {{raio}}, quem não foi votar, quem votou em branco, quem anulou e quem votou em outros candidatos no 1º turno. É um teto: o máximo de pessoas com quem dá para conversar, não quantas vão mudar de voto.
- **“Dá para virar”** quer dizer que {{adversario.nomeUrna}} ficou à frente no local e que {{reservatorio}} somam mais do que a diferença. Também é teto: só aconteceria se todas essas pessoas escolhessem {{alvo.nomeUrna}}. Não é previsão nem pesquisa.
- **“Vantagem a defender”** quer dizer que {{alvo.nomeUrna}} ficou à frente, mas {{reservatorio}} somam mais do que a vantagem.
- **“Folga”** quer dizer que {{alvo.nomeUrna}} teve {{limiarFolga}} ou mais dos votos válidos no local.
- **Votos válidos** são os dados a algum candidato. Brancos e nulos ficam de fora da conta, como manda a lei.
- Cada ponto do mapa reúne os locais de votação que ficam no mesmo lugar (a mesma coordenada no cadastro). O site não mostra nenhum dado de eleitor: só totais por seção eleitoral, publicados pelo TSE.

## De onde vêm os números

- **Votos por seção, comparecimento, abstenção, brancos e nulos, e o cadastro dos locais de votação:** Portal de Dados Abertos do Tribunal Superior Eleitoral (TSE), licença Creative Commons Atribuição (CC-BY). **Os dados foram modificados por nós:** somados por local de votação e por ponto do mapa, com as coordenadas conferidas contra a malha dos municípios do IBGE.
- **Conferência:** antes de cada publicação, os totais do país e de cada estado são comparados com o resultado oficial do TSE. Se não baterem, nada é publicado.
- **Votos no número {{reclassificados}}:** o arquivo por seção do TSE traz esses votos como se fossem para um candidato, mas o resultado oficial os conta como nulos. Seguimos o resultado oficial: aqui eles aparecem como nulos.
- **Posição de reserva:** quando a coordenada do cadastro do TSE falta, cai fora do município, se repete em outro município ou é um ponto-padrão que junta locais de lugares diferentes, usamos a posição do mesmo local num levantamento público de 2018 a 2022 do projeto [Como meus vizinhos votam](https://github.com/juliosaulo/como-meus-vizinhos-votam) (licença MIT, © 2026 Julio Saulo). Esses locais têm um aviso na ficha.
- **Locais sem posição confiável** não aparecem no mapa, mas entram nos totais do país e dos estados.
- **Eleitores no exterior:** as seções fora do país não aparecem no mapa nem no número “no Brasil” da abertura ({{exterior.ate}} pessoas que não votaram em nenhum dos dois finalistas votam no exterior); entram nos totais e na conferência com o resultado oficial do país.
- **Voto em trânsito e presos provisórios:** as seções de voto em trânsito e as instaladas em presídios e em unidades de internação de adolescentes ficam fora do mapa e da busca, porque não são lugar de conversa entre vizinhos, mas os votos delas entram nos totais do país e dos estados.
- **Malha dos municípios:** Instituto Brasileiro de Geografia e Estatística (IBGE).
- **Plano de governo:** trechos copiados ao pé da letra do [PDF registrado no TSE]({{plano.url}}), cada um com a página. Um programa confere cada trecho contra a página do PDF antes de publicar.
- **Mapa:** © colaboradores do OpenStreetMap (licença ODbL). Desenho do mapa servido pelo OpenFreeMap, no esquema OpenMapTiles.
- **Fontes tipográficas:** Bricolage Grotesque e Atkinson Hyperlegible Next, licença SIL Open Font License 1.1.

## Limitações

- Os números são do 1º turno. Muita gente pode ter mudado de ideia desde então; o site não sabe e não tenta adivinhar.
- O “até” conta pessoas, não intenções. Boa parte de quem não votou em nenhum dos dois já decidiu o voto, e tudo bem.
- No cadastro do TSE, a coordenada de alguns locais é imprecisa. Conferimos os erros mais grosseiros, mas um ponto pode estar a algumas quadras do lugar certo. Confira o endereço na ficha antes de ir.
- Seções que ainda não têm resultado nos dados aparecem como “sem resultado ainda”.
- Os roteiros de conversa são sugestões nossas, não falas oficiais de campanha.
- O site não faz pesquisa nem mostra intenção de voto.

## Atualização

Dados gerados em {{atualizadoEm}}.
