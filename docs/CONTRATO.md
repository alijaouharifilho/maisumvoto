# Contrato de dados — ETL (Python) ⇄ site (TypeScript)

Versão do esquema: **1**. Este arquivo é a fonte de verdade do formato de `public/dados/`.
Tipos TypeScript equivalentes: `nucleo/tipos.ts`. Validação em runtime no front: `nucleo/esquemas.ts` (zod).
Teste que amarra os dois lados: `testes/contrato.test.ts` (valida a saída real do ETL contra os esquemas).

Regras gerais:
- **Dados neutros.** Votos sempre por número de candidato (`nominais: {"22": n, "13": n, ...}`). Nenhum arquivo de dados tem campo com nome de candidato. Alvo/adversário vêm de `config/candidatura.json`.
- **Números de candidato são strings de 2 dígitos.**
- **Reclassificação.** Votos nominais em números de `reclassificarComoNulo` (hoje `"28"`) somam em `nulos` e não aparecem em `nominais`. Motivo: o CSV do TSE traz como nominal o que a totalização oficial contou como nulo.
- **Coordenadas** com 5 casas decimais. Graus decimais WGS84.
- **JSON compacto** (sem espaços), UTF-8, chaves ordenadas (para a versão ser determinística).
- **Nenhum CPF, título de eleitor ou dado pessoal** em nenhum arquivo. Telefone que o cadastro do TSE traz embutido
  no nome ou no endereço do local sai na leitura (`etl/telefone.py`); o ETL não publica se ainda achar algo com cara
  de CPF, título, telefone ou e-mail na saída (`etl/conferir.py`).
- Arquivos imutáveis dentro de uma `versao`; o front pede tudo (menos o índice) com `?v=<versao>`.

## 1. Chaves

| Chave | Regra | Exemplo |
|---|---|---|
| célula | `` `${floor(lat/c)}_${floor(lon/c)}` `` com `c = indice.celulaGraus` (0,25) | Curitiba (-25.4284, -49.2733) → `-102_-198` |
| quadrado | `` `${floor(lat)}_${floor(lon)}` `` | → `-26_-50` |
| região (id) | `{uf minúsc.}-{mun5}-{zona4}-{nr4}` do **local representante** = menor `(zona, nº do local)` entre os locais da região. Não depende da coordenada | `pr-75353-0001-1015` |
| seção | arquivo `secoes/{uf minúsc.}/{mun5}-{zona4}.json`, chave = nº da seção (string, sem zeros à esquerda) | `secoes/pr/75353-0001.json` → `"123"` |
| busca | 3 primeiras letras da palavra-chave normalizada (regras em `config/busca.json`, §5). Nome do arquivo = prefixo, com `_` no fim se for nome de dispositivo do Windows (`con`, `prn`, `aux`, `nul`), que o Git no Windows recusa | "São José dos Pinhais" → `pin`; "Contagem" → `con_.json` |
| CEP | 3 primeiros dígitos | `80010000` → `cep/800.json` |
| link | `#/mapa/@{H(lat)},{H(lon)}` com `H(x) = (floor(x/g + 0.5) · g).toFixed(3)`, `g = gradeLinkGraus` (0,005). O site arredonda o ponto escolhido (busca, GPS, toque) para esta grade **antes** de calcular o raio: tela, link e mensagem mostram o mesmo número | `#/mapa/@-25.430,-49.275` |

`mun5` = código de município **do TSE** com 5 dígitos (zero à esquerda). `zona4`/`nr4` = 4 dígitos.

## 2. Arquivos

### 2.1 `indice.json` (sem `?v`; cache curto)
```jsonc
{
  "esquema": 1,
  "versao": "a1b2c3d4e5f6",            // 12 hex = sha256 do conteúdo canônico de TODOS os outros arquivos (sem carimbos de hora)
  "geradoEm": "2026-10-06T12:00:00Z",   // só aqui; não entra no hash
  "eleicao": { "codigo": "6257", "pleito": "3220", "turno": 1, "cargo": "1" },
  "celulaGraus": 0.25,
  "candidatos": { "22": { "nome": "FLÁVIO BOLSONARO", "partido": "PL" }, "13": { "nome": "LULA", "partido": "PT" } },
  "brasil": {                          // seções do Brasil (sem exterior)
    "secoes": 497897, "aptos": 0, "comparecimento": 0, "abstencao": 0, "brancos": 0, "nulos": 0,
    "nominais": { "22": 0, "13": 0 },
    "regioes": 0, "regioesNoMapa": 0,
    "ate": 0,                          // Σ (brancos+nulos+abstencao+outros) — simétrico, não depende do alvo
    "classificacao": { "semVotos": 0, "empate": 0, "folga": 0, "aDefender": 0, "alvoNaFrente": 0, "aVirar": 0, "dificil": 0 },
    "viraveis": { "abertos": 0, "abertosMaisOutros": 0 },
    "eleitoresForaDoMapa": { "presoProvisorio": 0, "votoEmTransito": 0 }   // §2.1.1
  },
  "exterior": { "secoes": 1351, "aptos": 0, "comparecimento": 0, "abstencao": 0, "brancos": 0, "nulos": 0, "nominais": {} },
  "ufs": { "PR": { "secoes": 0, "aptos": 0, "regioes": 0, "regioesNoMapa": 0, "eleitoresSemPosicao": 0, "eleitoresPosicaoReserva": 0 /* Σ eleitores das regiões com posicao "reserva" */,
                  "eleitoresForaDoMapa": { "presoProvisorio": 0, "votoEmTransito": 0 }, "ate": 0 } },
  "quadrados": ["-26_-50"],             // quadrados de 1° que existem em pontos/ (o front só pede estes)
  "conferencia": { "ok": true, "referencia": "resultados.tse.jus.br EA20", "diferencas": [] },
  "fontes": [ { "id": "votacao_secao", "url": "https://cdn.tse.jus.br/...", "dataGeracao": "05/10/2026 13:58:00", "sha256": "..." } ]
}
```
`classificacao` e `viraveis` são calculados pelo ETL com a config (alvo/adversário/limiar). Todo o resto é neutro.

#### 2.1.1 Locais fora do mapa (`eleitoresForaDoMapa`)
Locais de **voto em trânsito** e de **preso provisório** (unidades prisionais e de internação de adolescentes) não
entram em `celulas/`, `pontos/`, `busca/` nem `cep/`, e não contam em `regioes`, `regioesNoMapa`, `classificacao` e
`viraveis` (não são lugar de conversa entre vizinhos). **Continuam** em `secoes`, `aptos`, `comparecimento`, votos,
`ate`, nos arquivos `secoes/` e na `conferencia` com o resultado oficial.
- Critério: campo `CD_TIPO_LOCAL` do cadastro do TSE — `2` = "Voto em trânsito" → `votoEmTransito`; `3` = "Preso
  provisório" → `presoProvisorio`. `1` (Convencional) e `4` (Temporário) ficam no mapa. Nunca o nome do local
  (falso positivo: "Colégio Estadual Fernando Presídio"). Código novo ou descrição trocada param o ETL
  (`etl/fora_do_mapa.py`).
- Valor = Σ aptos das seções desses locais, por motivo; as duas chaves sempre presentes (zero quando não há).
- Identidade por UF: `aptos = Σ eleitores das regiões no mapa + eleitoresSemPosicao + Σ eleitoresForaDoMapa`.
- O portão de cobertura de posição (≥ 99,5%) mede só o eleitorado que deveria estar no mapa:
  `(aptos − foraDoMapa − semPosicao) / (aptos − foraDoMapa)`.

### 2.2 `celulas/{celula}.json` — `Regiao[]`
```ts
type Regiao = {
  id: string;              // §1
  uf: string;              // "PR"
  mun: string;             // código TSE, 5 dígitos
  municipio: string;       // "CURITIBA" → título em caixa normal ("Curitiba") — o ETL já entrega em caixa de título
  bairro: string;          // "" quando não há
  lat: number; lon: number;
  posicao: "tse" | "reserva";   // de onde veio a coordenada publicada, que é a do local representante (o do id):
                                // "reserva" = conjunto MIT (a do cadastro do TSE faltava, caía fora do município,
                                // era repetida em outro município ou era um ponto-padrão; etl/coordenadas.py)
  locais: { nome: string; endereco: string; cep: string; zona: number; nr: number; secoes: number[] }[];
  eleitores: number;       // Σ aptos das seções da região
  secoes: number;          // quantidade de seções
  votos: {                 // null se nenhuma seção da região tem resultado
    aptos: number; comparecimento: number; abstencao: number;
    brancos: number; nulos: number;
    nominais: Record<string, number>;
  } | null;
};
```
Regiões sem posição confiável **não entram** em células nem em pontos (são contadas em `indice.ufs[UF].eleitoresSemPosicao`).
Locais de voto em trânsito e de preso provisório também não (§2.1.1; contados em `eleitoresForaDoMapa`).
Ordenação dentro do arquivo: por `id`.

### 2.3 `pontos/resumo.json` e `pontos/{quadrado}.json`
`{ "escala": number, "d": number[] }` — pares `[Δlat, Δlon]` inteiros: `q = round(grau × escala)`, pares únicos ordenados por (lat, lon), cada par gravado como diferença do anterior (o primeiro, diferença de `[0,0]`).
Decodificação: `la += d[i]; lo += d[i+1]; ponto = [la/escala, lo/escala]`.
`resumo` usa escala 20 (≈5 km); quadrados usam escala 1000 (≈100 m). Só regiões **com votos** entram.

### 2.4 `secoes/{uf}/{mun5}-{zona4}.json`
`{ "secoes": { "123": { "aptos": n, "comparecimento": n, "brancos": n, "nulos": n, "nominais": {"22": n, ...} } } }`
Meta: maior arquivo < 300 KB.

### 2.5 `busca/{prefixo}.json` — `ItemBusca[]`
```ts
type ItemBusca = {
  t: "m" | "b" | "l";      // município | bairro | local de votação
  n: string;               // nome exibível
  m?: string;              // município (para b e l)
  uf: string;
  lat: number; lon: number;// m e b: posição da região medoide do grupo (a que minimiza Σ eleitores × distância às
                           // outras regiões do grupo); l: posição da região do local. Sempre a de uma região
                           // publicada: o ponto da busca nunca cai num vazio sem local a raioKm (portão do ETL).
  e: number;               // eleitorado (peso de ordenação)
};
```
Um item entra no arquivo do prefixo de **cada** palavra-chave boa do seu nome (§5). Ordenado por `e` decrescente.

### 2.6 `cep/{3 dígitos}.json`
`{ "80010000": { "lat": n, "lon": n, "m": "Curitiba", "uf": "PR", "b": "Centro" } }` — CEP dos locais de votação (cadastro do TSE), na posição da região medoide quando há vários locais no mesmo CEP (como em §2.5; nunca um centro ponderado, que pode cair num vazio). CEP ausente ou inválido no cadastro é ignorado, e também o CEP fora da faixa dos Correios da UF do local (o cadastro tem, por exemplo, escola de Curitiba com CEP de Belo Horizonte; `etl/publicar.py`, `FAIXAS_CEP_UF`). Locais fora do mapa (§2.1.1) não entram.

## 3. Métricas (iguais em `nucleo/metricas.ts` e `etl/metricas.py`; casos em `testes/golden/metricas.json`)

Com `N = nominais`, `α = alvo.numero`, `δ = adversario.numero`:
- `a = N[α] ?? 0`, `d = N[δ] ?? 0`, `V = Σ N` (válidos), `O = V − a − d` (outros)
- `A = brancos + nulos + abstencao` (abertos); `T = A + O` (**até**)
- `p = a / V` se `V > 0`, senão `null`
- reservatório `R = A` se `regraViravel = "abertos"`; `R = A + O` se `"abertosMaisOutros"`
- **classificação** (primeira que se aplica):
  1. `semVotos`: `V = 0`
  2. `empate`: `a = d`
  3. `folga`: `a > d ∧ p ≥ limiarFolga`
  4. `aDefender`: `a > d ∧ R > a − d`
  5. `alvoNaFrente`: `a > d`
  6. `aVirar`: `d > a ∧ R > d − a`
  7. `dificil`: caso contrário
- **virável** (por regra `r`): `d > a ∧ R_r > d − a` — `indice.brasil.viraveis` traz as duas regras.

## 4. Geo
- Haversine: `dist = 12742 · asin(√h)` km, `h = sin²(Δφ/2) + cos φ₁ cos φ₂ sin²(Δλ/2)`.
- Raio: regiões com `dist ≤ raioKm` (1 km). Células tocadas: caixa `Δφ = R/111`, `Δλ = R/(111·cos φ)`.

## 5. Busca (regras em `config/busca.json`)
1. `normalizar(s)`: NFKD → remove diacríticos → minúsculas → `[^a-z0-9 ]` vira espaço → colapsa espaços → trim.
2. `palavrasChave(nome)`: palavras de `normalizar(nome)` com ≥ `minLetrasPalavraChave` letras e fora de `genericas`; se nenhuma, as com ≥ `minLetrasReserva` fora de `genericas`; se ainda nenhuma, todas com ≥ 3.
3. **Índice (ETL):** o item entra no arquivo de `palavra[0:tamanhoPrefixo]` de cada palavra-chave do seu `n` e do `n` sem apóstrofo (`'` e `’` apagados: "Sant'Ana" também vale como "santana", "d'Ávila" como "davila"). No casamento (item 4), as palavras das duas grafias valem.
4. **Consulta (front):** texto até a 1ª vírgula = termos `p`; depois da vírgula = termos `r`.
   **Arquivos** (`prefixosConsulta`): as palavras-chave de cada trecho inicial de `p` (`p[0..1]`, `p[0..2]`, …, `p`
   inteiro), sem repetir, as que não estão em `genericas` primeiro (na ordem em que aparecem) e as genéricas depois;
   o prefixo de cada uma, sem repetir; no máximo **4** arquivos (`MAX_ARQUIVOS_CONSULTA`), pedidos juntos e unidos
   sem item repetido. Motivo: o índice só usa as palavras do próprio nome (item 3); em "Tijuca Rio de Janeiro" a
   palavra mais longa é da cidade, e só o arquivo dela (`jan`) não tem o bairro. Medido em 05/10/2026 nos 2.000
   bairros com mais eleitores: "bairro cidade" sem vírgula falhava em 1.084 com o arquivo único, 0 com esta regra
   (média de 2,78 arquivos por consulta).
   Casa se todo termo de `p` é prefixo de alguma palavra de `normalizar(n)` ou do lugar, e todo termo de `r` é prefixo
   de alguma palavra do lugar (`normalizar(m ?? n)` + `uf` minúsc.). **Exato** = `p` igual a `normalizar(n)`, ou ao
   nome seguido da cidade e/ou da UF ("tijuca rio de janeiro", "tijuca rio de janeiro rj", "curitiba pr").
   Ordem: exatos primeiro, depois `e` desc. Limite `maxResultados`.
   **Direto ao ponto** (`escolhaDireta`): um só resultado; ou, com vírgula, um só bairro/município com `normalizar(n) == p`;
   ou, sem vírgula, um só bairro/município cujo nome com a cidade/UF é `p`. Só o nome ("Curitiba") mostra a lista;
   local de votação nunca vai direto.
5. **CEP:** texto que casa `^\d{2}\.?\d{3}[-\s]?\d{3}$` (80010-000, 80010000, 80.010-000, 80010 000) vai para
   `cep/{3 dígitos}.json`. CEP ausente do arquivo (o de casa quase nunca é de local de votação): usa o CEP do arquivo
   do mesmo setor (5 primeiros dígitos) ou, sem nenhum, do mesmo subsetor (4) com numeração mais próxima (empate: o
   menor), rotulado "Perto do CEP …". Sem nem isso: "CEP não está entre os dos locais de votação".
