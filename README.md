# Mais um voto

Mapa para conversar com quem ainda pode decidir o 2º turno de 2026. Para qualquer ponto do país, o site mostra
quantas pessoas votam ali que **não votaram em nenhum dos dois finalistas** no 1º turno (abstenção, brancos, nulos
e eleitores de outros candidatos), o resultado de cada local de votação e o que conversar, com propostas do
plano de governo citadas ao pé da letra.

Site independente de apoio ao candidato definido em `config/candidatura.json`. Não é o site oficial de nenhuma
campanha, candidato ou partido. Dados públicos do Tribunal Superior Eleitoral.

**No ar:** https://maisumvoto.vercel.app

## Como funciona

1. **Dados** (`etl/`, Python). Baixa os arquivos de dados abertos do TSE (votação por seção, detalhe da apuração,
   cadastro de locais de votação e candidatos), soma tudo e confere com o resultado oficial publicado pelo TSE:
   se qualquer total do Brasil, de uma UF ou do exterior não bater, nada é publicado. Valida a posição de cada
   local contra a malha de municípios do IBGE e grava arquivos JSON estáticos em `public/dados/`.
2. **Site** (`src/` e `nucleo/`, React + TypeScript). Estático, sem servidor de aplicação. No navegador, junta os
   locais num raio de 1 km do ponto escolhido, calcula o "até" (quantas pessoas, no máximo, dá para chamar para a
   conversa), a disputa e a lista de locais. O mapa usa MapLibre com tiles do OpenFreeMap.
3. **Conteúdo** (`src/conteudo/`). Roteiros de conversa e cartões do plano de governo: cada proposta em uma frase,
   um número oficial com fonte, por que faz sentido e uma pergunta para puxar o assunto; e uma comparação, por
   assunto, entre os planos dos dois finalistas. Todo trecho citado é conferido contra o PDF registrado no TSE, e
   todos os textos passam pela aprovação do responsável (`src/conteudo/APROVACAO.md`).
4. **Publicação** (Vercel). Cada push no `main` publica, desde que a trava de produção deixe (ver abaixo).

## Estrutura

| Pasta | O que tem |
|---|---|
| `config/` | `candidatura.json` (candidatos, datas, limiares, responsável) e `busca.json` (regras da busca) |
| `etl/` | Download, conferência e montagem dos dados do TSE |
| `nucleo/` | Regras puras: métricas, raio, busca, calendário, frases em pt-BR |
| `src/` | Aplicação (páginas, componentes, mapa, carregamento de dados) e o conteúdo editorial |
| `public/dados/` | Dados gerados pelo ETL (versionados; a Vercel publica a partir do repositório) |
| `testes/` | Testes do núcleo, do site, do ETL e de ponta a ponta (Playwright) |
| `deploy/` | Cabeçalhos de segurança e congelamento eleitoral (com os testes da publicação) |
| `ferramentas/` | Scripts de apoio: trava de publicação e conferência das citações |
| `docs/CONTRATO.md` | Formato de todos os arquivos de dados |

Números e nomes de candidatos só aparecem em `config/` e `src/conteudo/`; um teste falha se aparecerem em
qualquer outro lugar do código.

## Requisitos

- Node 22 ou mais novo.
- Python 3.12 ou mais novo, só para gerar os dados. No Windows, use o executável do Python, não o atalho da
  Microsoft Store.

## Primeira vez

```bash
npm install
python -m venv .venv
.venv/Scripts/python -m pip install -r etl/requirements.txt   # Linux/macOS: .venv/bin/python
npx playwright install chromium
```

## Gerar os dados

```bash
npm run dados
```

Leva cerca de 2 minutos. Os arquivos brutos ficam em `dados/bruto/` e só são baixados de novo se o TSE os
atualizar. Para uma rodada rápida de uma UF, sem baixar nada: `npm run dados -- --sem-baixar --uf RR`.
Depois de gerar, commite `public/dados/`.

## Desenvolver e testar

```bash
npm run dev         # http://127.0.0.1:5150
npm run verificar   # lint, tipos, testes do site, do deploy e do ETL, e conferência das citações
npm run e2e         # build + testes de ponta a ponta em http://127.0.0.1:5151
```

Não há teste automático no GitHub: rode `npm run verificar` (e, se mexeu na tela, `npm run e2e`) antes de cada
push no `main`. A Vercel ainda confere os tipos e monta o site a cada envio.

Para mostrar o build por um túnel (ex.: ngrok), coloque o endereço do túnel em `PREVIEW_HOSTS_EXTRAS`, no arquivo
`.env.local` (fora do git), e rode `npm run preview`. Nunca exponha o servidor de desenvolvimento.

## Publicar

A Vercel monta o site a partir deste repositório (`vercel.json`). Prévias (qualquer branch que não seja `main`)
montam sempre e ficam protegidas. A produção passa antes por `ferramentas/build-vercel.mjs`, que recusa o build,
mantendo no ar a versão anterior, quando:

- falta o responsável ou a hospedagem em `config/candidatura.json` (Lei 9.504/1997, art. 57-D: é proibido o
  anonimato);
- os dados não batem com o resultado oficial;
- `src/conteudo/APROVACAO.md` não está inteiro marcado e assinado;
- está no período de congelamento: das 20h de 24/10 às 2h de 26/10, horário de Brasília (`deploy/CONGELAMENTO.md`).

Para ver localmente o que a produção exigiria:

```bash
npm run checar:publicacao
```

O domínio usado nas prévias de link (WhatsApp, redes sociais) vem da própria Vercel: o domínio próprio, se houver,
ou o endereço `vercel.app` do projeto.

## Calendário

| Quando | O que acontece |
|---|---|
| até 24/10, 22h | Período de conversa. |
| 24/10, 20h | Último deploy normal (a trava recusa depois disso). |
| 25/10 | Dia da votação: o site mostra só um aviso, sem mapa, busca ou roteiros. Muda sozinho, pelo relógio. |
| depois de 26/10, 2h | Fim do congelamento. O site fica como consulta. |

## Privacidade

Sem cadastro, sem cookies e sem ferramentas de análise de terceiros. A localização do aparelho, quando o usuário
pede, fica no próprio aparelho. Detalhes em `src/conteudo/privacidade.md`.

## Créditos

Dados do TSE (CC-BY, com modificações) e do IBGE; mapa © colaboradores do OpenStreetMap e OpenFreeMap; demais
atribuições e licenças em `NOTICE.md`.

Responsável: Ali Jaouhari Filho.
