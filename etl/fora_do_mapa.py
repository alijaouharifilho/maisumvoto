"""Locais de votação que ficam fora do mapa, das células, dos pontos, da busca e do CEP (decisão do responsável, 05/10/2026).

Continuam em tudo que é total: seções, aptos, comparecimento, votos, "até" do país e da UF, arquivos de seções e a
conferência com o resultado oficial. No índice, são contados em `eleitoresForaDoMapa` (por motivo), no Brasil e por UF.

Critério: o campo CD_TIPO_LOCAL do cadastro do TSE (eleitorado_local_votacao), nunca o nome do local.
- 2 "Voto em trânsito": seções de quem pediu para votar fora do próprio domicílio eleitoral; não são vizinhos do lugar.
- 3 "Preso provisório": unidades prisionais e unidades de internação de adolescentes (o TSE põe as duas neste tipo:
  em 2026 há "Fundação Casa", "CASE" e similares aqui).
- 1 "Convencional" e 4 "Temporário" (prédio que substitui o de sempre) continuam no mapa.

Os pares código/descrição foram lidos dos próprios arquivos de 2026 (o arquivo traz CD_TIPO_LOCAL e DS_TIPO_LOCAL).
`validar_tipos` confere a descrição de cada código em toda rodada e para tudo se aparecer código novo: se o TSE mudar
a tabela, o ETL falha alto em vez de pôr presídio no mapa ou tirar escola dele.
Padrão no nome foi avaliado e descartado: dá falso positivo ("Colégio Estadual Fernando Presídio", "Núcleo Prisional
... da Polícia Penal" com 600 eleitores em seções comuns) e não acha nenhum local que o campo não ache.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence

import pandas as pd

from etl.busca import normalizar
from etl.carregar_tse import ErroEntrada

COLUNA_CODIGO = "cd_tipo_local"
COLUNA_DESCRICAO = "tipo_local"
COLUNA_MOTIVO = "motivo_fora"
CHAVE_LOCAL = ["uf", "mun", "zona", "nr_local"]

# Código do TSE → descrição normalizada esperada (validação a cada rodada).
TIPOS_CONHECIDOS: Mapping[int, str] = {
    1: "convencional",
    2: "voto em transito",
    3: "preso provisorio",
    4: "temporario",
}
# Código do TSE → motivo publicado no índice (chave de `eleitoresForaDoMapa`).
MOTIVOS: Mapping[int, str] = {2: "votoEmTransito", 3: "presoProvisorio"}
MOTIVOS_PUBLICADOS: tuple[str, ...] = tuple(sorted(MOTIVOS.values()))


def validar_tipos(cadastro: pd.DataFrame) -> list[str]:
    """Erro se um código vier com outra descrição ou se aparecer código novo; aviso se um local mistura tipos."""
    pares = cadastro[[COLUNA_CODIGO, COLUNA_DESCRICAO]].drop_duplicates()
    for codigo, descricao in pares.itertuples(index=False):
        esperado = TIPOS_CONHECIDOS.get(int(codigo))
        if esperado is None:
            raise ErroEntrada(f"tipo de local desconhecido no cadastro: {codigo} '{descricao}' (decida se entra no mapa"
                              " em etl/fora_do_mapa.py)")
        if normalizar(descricao) != esperado:
            raise ErroEntrada(f"tipo de local {codigo} veio como '{descricao}', esperado '{esperado}'"
                              " (a tabela do TSE mudou? revise etl/fora_do_mapa.py)")
    tipos_por_local = cadastro.groupby(CHAVE_LOCAL)[COLUNA_CODIGO].nunique()
    misturados = int((tipos_por_local > 1).sum())
    return [f"{misturados} locais com seções de tipos diferentes (vale o tipo da 1ª seção)"] if misturados else []


def separar(locais: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """(locais do mapa, locais fora do mapa com a coluna `motivo_fora`)."""
    motivo = locais[COLUNA_CODIGO].map(lambda c: MOTIVOS.get(int(c), ""))
    fora = motivo != ""
    no_mapa = locais[~fora].reset_index(drop=True)
    excluidos = locais[fora].assign(**{COLUNA_MOTIVO: motivo[fora]}).reset_index(drop=True)
    return no_mapa, excluidos


def contar(fora: pd.DataFrame, ufs: Sequence[str] | None = None) -> dict[str, int]:
    """Eleitores (Σ aptos das seções) por motivo; todos os motivos aparecem, mesmo com zero."""
    recorte = fora if ufs is None else fora[fora["uf"].isin(ufs)]
    return {m: int(recorte.loc[recorte[COLUNA_MOTIVO] == m, "eleitores"].sum()) for m in MOTIVOS_PUBLICADOS}


def resumo(fora: pd.DataFrame) -> dict[str, dict[str, int]]:
    """Para o relatório da rodada: locais, seções e eleitores por motivo."""
    grupos = {m: fora[fora[COLUNA_MOTIVO] == m] for m in MOTIVOS_PUBLICADOS}
    return {m: {"locais": len(g), "secoes": int(g["n_secoes"].sum()), "eleitores": int(g["eleitores"].sum())}
            for m, g in grupos.items()}
