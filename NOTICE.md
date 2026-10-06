# Atribuições e licenças de terceiros

Este projeto foi escrito do zero. Não contém código, texto, CSS ou roteiro do site
"Onde dá pra conversar" (repositório sem licença); apenas o conceito público serviu de inspiração.

## Dados

- **Tribunal Superior Eleitoral (TSE)** — Portal de Dados Abertos (`dadosabertos.tse.jus.br`, arquivos em
  `cdn.tse.jus.br/estatistica/sead/odsele/`) e resultados oficiais (`resultados.tse.jus.br`).
  Licença: Creative Commons Atribuição (CC-BY). **Os dados foram modificados**: agregados por local de
  votação e por região geográfica, votos no nº 28 reclassificados como nulos (como na totalização oficial),
  coordenadas validadas contra a malha municipal do IBGE.
- **Instituto Brasileiro de Geografia e Estatística (IBGE)** — malha municipal (API de malhas `servicodados.ibge.gov.br`). Fonte: IBGE.
- **Como meus vizinhos votam** — conjunto de coordenadas de locais de votação 2018/2022, usado só como
  reserva quando a coordenada do TSE falta, cai a mais de 2 km do município ou é suspeita (repetida entre
  municípios) — e apenas se o nome do local confere e o ponto cai dentro do município.
  © 2026 Julio Saulo — Licença MIT — https://github.com/juliosaulo/como-meus-vizinhos-votam
  (texto da licença em `etl/terceiros/como_meus_vizinhos/LICENSE`).

## Mapa

- **OpenStreetMap** — © colaboradores do OpenStreetMap, dados sob ODbL (atribuição visível no mapa).
- **OpenFreeMap** — tiles vetoriais (https://openfreemap.org), esquema OpenMapTiles (© OpenMapTiles).
- **Estilo Positron** (OpenFreeMap/OpenMapTiles) — código BSD-3-Clause, desenho CC-BY 4.0; recolorido em
  `public/mapa/estilo.json`.
- **MapLibre GL JS** — licença BSD-3-Clause; redistribuído em `public/mapa/maplibre-<versão>/` com o `LICENSE.txt`.

## Fontes tipográficas

- **Bricolage Grotesque** — SIL Open Font License 1.1 (via Fontsource).
- **Atkinson Hyperlegible Next** — SIL Open Font License 1.1 (via Fontsource), Braille Institute of America.

## Plano de governo

- Trechos citados do plano de governo registrado no TSE (proposta de governo do candidato nº 22, 2026),
  sempre literais, curtos, com número de página e link para o PDF oficial (Lei 9.610, art. 46, III):
  https://www.tse.jus.br/eleicoes/eleicoes-2026-content/arquivos/proposta-pl/@@display-file/file/proposta-pl.pdf
  (SHA-256 em `dados/fontes/plano-22.sha256`).
