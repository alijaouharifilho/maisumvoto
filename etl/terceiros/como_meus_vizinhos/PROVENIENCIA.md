# Proveniência — coordenadas de reserva (MIT)

| Campo | Valor |
|---|---|
| Arquivo | `locais_votacao_2018_2022.parquet` |
| Projeto de origem | [juliosaulo/como-meus-vizinhos-votam](https://github.com/juliosaulo/como-meus-vizinhos-votam) |
| Caminho no projeto | `dados_importados/locais_votacao_2018_2022.parquet` |
| Commit | `578d1bbce94986a2110b7b518993479dfeef1c0d` (04/10/2026) |
| Licença | MIT — `Copyright (c) 2026 Julio Saulo` (texto integral em `LICENSE`, nesta pasta) |
| SHA-256 | `f7a3231039d3d8fc031a5b9015af6f2cd1c8364e29b9ef0e8351f3492df41d2f` |
| Tamanho | 5.573.297 bytes; 93.658 locais de 2018/2022; ~84% com coordenada |
| Copiado em | 05/10/2026, sem modificação |

## O que é

Coordenada de cada local de votação usado em 2018 e/ou 2022, obtida pelo autor do projeto de origem
casando nome e endereço do local com o CNEFE (IBGE). Chave: `{UF}_{município TSE 5 dígitos}_{zona}_{nº do local}`.

## Como o ETL usa (`etl/coordenadas.py`)

Só como **reserva**, nunca como fonte principal:

1. Vale a coordenada do cadastro do TSE de 2026 quando ela cai dentro do município (malha do IBGE, tolerância de 2 km).
2. Se não cai (ou falta, ou é suspeita, ou é um ponto-padrão que junta 3 ou mais locais de endereços diferentes a
   até ~30 m), procura o mesmo `{UF}_{município}_{zona}_{local}` aqui. Este conjunto também serve de indício: um
   ponto-padrão que ele confirma (todo local conhecido a até 500 m) fica com a coordenada do TSE.
3. Coordenada daqui repetida por locais de nomes que não batem entre si é genérica (centro da localidade) e não
   posiciona ninguém, salvo `status_geocodificacao = revisao_manual_aceito`.
4. A reserva só é aceita se **o nome do local bate** (≥ 50% das palavras significativas do nome mais curto
   aparecem no outro) **e** o ponto também cai dentro do município.
5. Senão, o local fica sem posição: fora do mapa e contado em `indice.ufs[UF].eleitoresSemPosicao`.

Regiões posicionadas pela reserva saem com `posicao: "reserva"` em `public/dados/celulas/*.json`.

## Atribuição

A atribuição pública está em `NOTICE.md` (raiz do repositório) e deve aparecer na página "Sobre" do site.
