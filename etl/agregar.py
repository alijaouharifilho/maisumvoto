"""Seção → local de votação → região.

- Votos nominais por seção vêm de votacao_secao; aptos/comparecimento/abstenção/brancos/nulos, do detalhe.
- Números em `reclassificarComoNulo` somam em nulos e saem de nominais (a totalização oficial fez isso).
- Junção com o cadastro por (UF, município, zona, seção): o nº do local vem do cadastro (local efetivamente usado).
- Região = locais do mesmo município no mesmo ponto (lat/lon com 4 casas); id = local de menor (zona, nº).
"""

from __future__ import annotations

import itertools
import re
import unicodedata
from collections import Counter
from collections.abc import Iterable, Sequence

import pandas as pd

NOMINAL = "n:"
VOTAVEIS_NAO_NOMINAIS = frozenset({"95", "96"})  # branco e nulo: vêm do detalhe
CHAVE_SECAO = ["uf", "mun", "zona", "secao"]
CHAVE_LOCAL = ["uf", "mun", "zona", "nr_local"]
CAMPOS_SOMA = ["comparecimento", "abstencao", "brancos", "nulos"]
CASAS_REGIAO = 4
CASAS_PUBLICADAS = 5
PREPOSICOES = frozenset({"de", "da", "do", "das", "dos", "e", "del"})
# Siglas de escola, universidade e instituição que ficam em maiúsculas ("EE", "EMEF", "UERJ"; também "E.E.").
# Só as que não são palavra comum: "em" (preposição) e "ceu" (céu) ficam de fora.
SIGLAS = frozenset({
    "ee", "eee", "eef", "eeef", "eem", "eeem", "eeefm", "eemti", "emef", "emei", "emeif", "emeb", "emefm", "cmei",
    "cei", "cem", "cef", "ced", "caic", "ciep", "etec", "fatec", "senai", "sesi", "sesc", "senac", "apae", "inss",
    "uerj", "ufrj", "ufpr", "ufmg", "ufba", "ufpe", "ufsc", "ufrgs", "usp", "unesp", "unicamp", "ifro", "ifpr",
    "ifsp", "ifba", "ifsc", "ifrn", "ifsul", "unef", "cefet", "ceeja", "eja", "eeb", "eebm",
})
_SIGLA_COM_PONTOS = re.compile(r"^(?:[^\W\d_]\.){2,}$")  # "E.E.", "E.e.b." (escola de educação básica, SC)
_ROMANO = re.compile(r"^(?=[IVX])X{0,3}(IX|IV|V?I{0,3})$")
_VOGAIS = frozenset("aeiouy")
_MAX_EXEMPLOS = 3


# ── caixa de título pt-BR ──


def _sem_vogal(letras: str) -> bool:
    base = unicodedata.normalize("NFKD", letras.lower())
    return not any(c in _VOGAIS for c in base)


def _capitalizar(parte: str) -> str:
    letras = "".join(c for c in parte if c.isalpha())
    if not letras or any(c.isdigit() for c in parte) or "/" in parte:
        return parte.upper()
    sigla = letras.lower() in SIGLAS or _SIGLA_COM_PONTOS.match(parte) is not None
    if _ROMANO.match(letras.upper()) or _sem_vogal(letras) or sigla:
        return parte.upper()
    i = next(i for i, c in enumerate(parte) if c.isalpha())
    return parte[:i] + parte[i].upper() + parte[i + 1 :].lower()


def _parte_titulo(parte: str, primeira: bool) -> str:
    if "'" in parte:
        antes, depois = parte.split("'", 1)
        prefixo = antes.lower() if len(antes) == 1 and not primeira else _capitalizar(antes)
        return f"{prefixo}'{_capitalizar(depois)}"
    if not primeira and parte.lower() in PREPOSICOES:
        return parte.lower()
    return _capitalizar(parte)


def titulo_ptbr(texto: str) -> str:
    palavras = []
    for i, palavra in enumerate(texto.split()):
        partes = [_parte_titulo(p, i == 0 and j == 0) for j, p in enumerate(palavra.split("-"))]
        palavras.append("-".join(partes))
    return " ".join(palavras)


# ── seções ──


def colunas_nominais(df: pd.DataFrame) -> list[str]:
    return sorted(c for c in df.columns if c.startswith(NOMINAL))


def _avisar(rotulo: str, linhas: pd.DataFrame) -> list[str]:
    if linhas.empty:
        return []
    exemplos = ", ".join("/".join(str(v) for v in t) for t in linhas[CHAVE_SECAO].head(_MAX_EXEMPLOS).itertuples(index=False))
    return [f"{len(linhas)} seções {rotulo} (ex.: {exemplos})"]


def secoes_com_votos(detalhe: pd.DataFrame, votos: pd.DataFrame, reclassificar: Sequence[str]) -> tuple[pd.DataFrame, list[str]]:
    """Uma linha por seção do detalhe, com uma coluna `n:{número}` por candidato."""
    nominais = votos[~votos["numero"].isin(VOTAVEIS_NAO_NOMINAIS)]
    largura = nominais.groupby([*CHAVE_SECAO, "numero"])["votos"].sum().unstack("numero", fill_value=0)
    largura.columns = [NOMINAL + str(c) for c in largura.columns]
    largura = largura.reset_index() if len(largura) else pd.DataFrame(columns=CHAVE_SECAO)
    orfas = largura.merge(detalhe[CHAVE_SECAO], on=CHAVE_SECAO, how="left", indicator=True)
    avisos = _avisar("com votos e sem seção no detalhe", orfas[orfas["_merge"] == "left_only"])
    secoes = detalhe.merge(largura, on=CHAVE_SECAO, how="left")
    colunas = colunas_nominais(secoes)
    secoes[colunas] = secoes[colunas].fillna(0).astype("int64")
    anular = [NOMINAL + n for n in reclassificar if NOMINAL + n in secoes.columns]
    secoes["nulos"] = secoes["nulos"] + secoes[anular].sum(axis=1).astype("int64")
    secoes = secoes.drop(columns=anular)
    fechamento = secoes["brancos"] + secoes["nulos"] + secoes[colunas_nominais(secoes)].sum(axis=1)
    incoerentes = secoes[secoes["instalada"] & (fechamento != secoes["comparecimento"])]
    avisos += _avisar("em que brancos+nulos+nominais ≠ comparecimento", incoerentes)
    return secoes, avisos


def nominais_de(linha: dict | pd.Series, colunas: Iterable[str]) -> dict[str, int]:
    return {c[len(NOMINAL):]: int(linha[c]) for c in colunas if int(linha[c]) > 0}


def totais(secoes: pd.DataFrame) -> dict:
    somas = secoes[["aptos", *CAMPOS_SOMA, *colunas_nominais(secoes)]].sum()
    return {
        "secoes": len(secoes),
        "aptos": int(somas["aptos"]),
        **{c: int(somas[c]) for c in CAMPOS_SOMA},
        "nominais": nominais_de(somas, colunas_nominais(secoes)),
    }


# ── locais ──


def _com_titulos(locais: pd.DataFrame) -> pd.DataFrame:
    return locais.assign(**{c: [titulo_ptbr(x) for x in locais[c]] for c in ["municipio", "nome", "endereco", "bairro"]})


def montar_locais(secoes: pd.DataFrame, cadastro: pd.DataFrame) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Locais com eleitorado (Σ aptos), lista de seções e somas só das seções com resultado."""
    juntas = secoes.merge(cadastro.drop(columns=["eleitores"], errors="ignore"), on=CHAVE_SECAO, how="left",
                          indicator=True)
    sem_cadastro = juntas.loc[juntas["_merge"] == "left_only", [*CHAVE_SECAO, "aptos"]].reset_index(drop=True)
    ok = juntas[juntas["_merge"] == "both"].drop(columns="_merge")
    soma = ["aptos", *CAMPOS_SOMA, *colunas_nominais(ok)]
    instaladas = ok[soma].mul(ok["instalada"].astype("int64"), axis=0).rename(columns={"aptos": "v_aptos"})
    ok = pd.concat([ok.drop(columns=CAMPOS_SOMA + colunas_nominais(ok)), instaladas], axis=1)
    grupos = ok.sort_values([*CHAVE_LOCAL, "secao"]).groupby(CHAVE_LOCAL, sort=True)
    primeiros = grupos[["municipio", "nome", "endereco", "bairro", "cep", "cd_tipo_local", "tipo_local", "lat",
                        "lon"]].first()
    somas = grupos[list(instaladas.columns)].sum()
    extras = grupos.agg(eleitores=("aptos", "sum"), n_secoes=("secao", "size"), n_instaladas=("instalada", "sum"))
    lista = grupos["secao"].agg(lambda s: [int(x) for x in s]).rename("secoes")
    locais = pd.concat([primeiros, extras, lista, somas], axis=1).reset_index()
    locais["tem_resultado"] = locais["n_instaladas"] > 0
    return _com_titulos(locais), sem_cadastro


# ── regiões ──


def atribuir_regioes(locais: pd.DataFrame) -> pd.DataFrame:
    """Acrescenta regiao (id), lat_regiao e lon_regiao. `locais` precisa ter posição (lat/lon finais)."""
    df = locais.assign(lat4=locais["lat"].round(CASAS_REGIAO), lon4=locais["lon"].round(CASAS_REGIAO))
    df = df.sort_values(["uf", "mun", "lat4", "lon4", "zona", "nr_local"])
    rep = df.groupby(["uf", "mun", "lat4", "lon4"], sort=False)[["zona", "nr_local", "lat", "lon"]].transform("first")
    ids = [f"{u.lower()}-{m}-{int(z):04d}-{int(n):04d}" for u, m, z, n in zip(df["uf"], df["mun"], rep["zona"], rep["nr_local"], strict=True)]
    return df.assign(
        regiao=ids,
        lat_regiao=[round(float(x), CASAS_PUBLICADAS) for x in rep["lat"]],
        lon_regiao=[round(float(x), CASAS_PUBLICADAS) for x in rep["lon"]],
    ).drop(columns=["lat4", "lon4"])


def _bairro(locais: list[dict]) -> str:
    contagem = Counter(loc["bairro"] for loc in locais if loc["bairro"])
    if not contagem:
        return ""
    peso = Counter()
    for loc in locais:
        peso[loc["bairro"]] += int(loc["eleitores"])
    return min(contagem, key=lambda b: (-contagem[b], -peso[b], b))


def votos_de_locais(locais: list[dict], colunas: list[str]) -> dict | None:
    com = [loc for loc in locais if loc["tem_resultado"]]
    if not com:
        return None
    soma = {c: sum(int(loc[c]) for loc in com) for c in ["v_aptos", *CAMPOS_SOMA, *colunas]}
    return {"aptos": soma["v_aptos"], **{c: soma[c] for c in CAMPOS_SOMA}, "nominais": nominais_de(soma, colunas)}


def _regiao(locais: list[dict], colunas: list[str]) -> dict:
    primeiro = locais[0]
    return {
        "id": primeiro["regiao"],
        "uf": primeiro["uf"],
        "mun": primeiro["mun"],
        "municipio": primeiro["municipio"],
        "bairro": _bairro(locais),
        "lat": primeiro["lat_regiao"],
        "lon": primeiro["lon_regiao"],
        # A da coordenada publicada, que é a do local representante (o primeiro): uma escola da reserva que cai no
        # mesmo ponto de uma do TSE não põe o aviso de "posição não confirmada" na região inteira.
        "posicao": primeiro["posicao"],
        "locais": [
            {"nome": loc["nome"], "endereco": loc["endereco"], "cep": loc["cep"], "zona": int(loc["zona"]),
             "nr": int(loc["nr_local"]), "secoes": list(loc["secoes"])}
            for loc in locais
        ],
        "eleitores": sum(int(loc["eleitores"]) for loc in locais),
        "secoes": sum(int(loc["n_secoes"]) for loc in locais),
        "votos": votos_de_locais(locais, colunas),
    }


def montar_regioes(locais: pd.DataFrame) -> list[dict]:
    """Regiões (formato do CONTRATO §2.2), ordenadas por id. `locais` só com os que têm posição."""
    com_regiao = locais if "regiao" in locais.columns else atribuir_regioes(locais)
    ordenados = com_regiao.sort_values(["regiao", "zona", "nr_local"])
    colunas = colunas_nominais(ordenados)
    registros = ordenados.to_dict("records")
    return [_regiao(list(g), colunas) for _, g in itertools.groupby(registros, key=lambda r: r["regiao"])]
