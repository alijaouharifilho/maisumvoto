"""Busca local (CONTRATO §5). As regras vêm de config/busca.json e valem igual para o front."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Mapping

import pandas as pd

from etl.config import RegrasBusca
from etl.geo import medoides_por_grupo

_NAO_ALFANUM = re.compile(r"[^a-z0-9 ]")
_ESPACOS = re.compile(r" +")
# 80010-000, 80010000, 80.010-000 e 80010 000 (com ponto é o formato tradicional dos Correios).
_CEP = re.compile(r"^(\d{2})\.?(\d{3})[-\s]?(\d{3})$")
_TAMANHO_MINIMO_ULTIMO_RECURSO = 3
_APOSTROFO = re.compile(r"['’]")
MAX_ARQUIVOS_CONSULTA = 4
# Nomes de dispositivo do Windows (CON, PRN, AUX, NUL, COM1–9, LPT1–9) não podem ser nome de arquivo:
# o Git no Windows recusa "aux.json" e "con.json". Esses prefixos ganham "_" no nome (CONTRATO §1).
_RESERVADO_WINDOWS = re.compile(r"^(con|prn|aux|nul|com\d|lpt\d)$")


def arquivo_da_busca(prefixo: str) -> str:
    """Nome do arquivo de busca (sem .json): igual ao prefixo, ou com "_" se for nome reservado do Windows."""
    return f"{prefixo}_" if _RESERVADO_WINDOWS.match(prefixo) else prefixo


def normalizar(texto: str) -> str:
    decomposto = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in decomposto if not unicodedata.combining(c))
    minusculo = _NAO_ALFANUM.sub(" ", sem_acento.lower())
    return _ESPACOS.sub(" ", minusculo).strip()


def _unicas(palavras: Iterable[str]) -> list[str]:
    return list(dict.fromkeys(palavras))


def palavras_chave(nome: str, regras: RegrasBusca) -> list[str]:
    palavras = normalizar(nome).split()
    boas = [p for p in palavras if len(p) >= regras.min_letras_palavra_chave and p not in regras.genericas]
    if not boas:
        boas = [p for p in palavras if len(p) >= regras.min_letras_reserva and p not in regras.genericas]
    if not boas:
        boas = [p for p in palavras if len(p) >= _TAMANHO_MINIMO_ULTIMO_RECURSO]
    return _unicas(boas)


def prefixos_consulta(texto: str, regras: RegrasBusca) -> list[str]:
    """Arquivos que o front pede (CONTRATO §5.4; espelho de nucleo/busca.ts, conferido pelo golden).

    O índice põe cada item só nos arquivos das palavras do próprio nome: numa consulta sem vírgula
    ("Tijuca Rio de Janeiro"), a palavra mais longa pode ser a da cidade. Juntam-se as palavras-chave de cada
    trecho inicial do texto antes da vírgula, as não genéricas primeiro, sem prefixo repetido, até o máximo.
    """
    termos = normalizar(texto.split(",", 1)[0]).split()
    chaves = _unicas(c for i in range(len(termos)) for c in palavras_chave(" ".join(termos[: i + 1]), regras))
    ordenadas = [c for c in chaves if c not in regras.genericas] + [c for c in chaves if c in regras.genericas]
    return _unicas(c[: regras.tamanho_prefixo] for c in ordenadas)[:MAX_ARQUIVOS_CONSULTA]


def chave_cep(texto: str) -> tuple[str, str] | None:
    casamento = _CEP.match(texto.strip())
    if not casamento:
        return None
    chave = casamento.group(1) + casamento.group(2) + casamento.group(3)
    return chave[:3], chave


def _ordem(item: Mapping) -> tuple:
    return (-item["e"], item["n"], item.get("m", ""), item["uf"], item["t"], item["lat"], item["lon"])


def sem_apostrofo(texto: str) -> str:
    """Grafia comum de nome com apóstrofo: "Sant'Ana" → "SantAna" (normalizado: "santana"), "d'Ávila" → "dÁvila"."""
    return _APOSTROFO.sub("", texto)


def indexar(itens: Iterable[Mapping], regras: RegrasBusca) -> dict[str, list[dict]]:
    """Cada item entra no arquivo do prefixo de cada palavra-chave do seu nome (e da grafia sem apóstrofo, para
    "Santana do Livramento" e "Dias Davila" acharem Sant'Ana e d'Ávila); ordem por `e` decrescente."""
    arquivos: dict[str, list[dict]] = {}
    for item in itens:
        nomes = (item["n"], sem_apostrofo(item["n"]))
        prefixos = _unicas(p[: regras.tamanho_prefixo] for nome in nomes for p in palavras_chave(nome, regras))
        for prefixo in prefixos:
            arquivos.setdefault(prefixo, []).append(dict(item))
    return {prefixo: sorted(lista, key=_ordem) for prefixo, lista in sorted(arquivos.items())}


# ── itens do índice (municípios, bairros e locais de votação) ──

CASAS = 5


def _agrupados(locais: pd.DataFrame, tipo: str, chave: list[str], nome: str) -> list[dict]:
    """Um item por grupo: `e` = eleitorado do grupo; posição = a da região medoide (CONTRATO §2.5, `etl/geo.py`)."""
    eleitores = locais.groupby(chave, sort=True)["eleitores"].sum().rename("e").reset_index()
    juntos = eleitores.merge(medoides_por_grupo(locais, chave), on=chave, how="inner")
    itens = []
    for r in juntos.to_dict("records"):
        item = {"t": tipo, "n": r[nome], "uf": r["uf"], "lat": round(r["lat"], CASAS), "lon": round(r["lon"], CASAS),
                "e": int(r["e"])}
        if tipo != "m":
            item["m"] = r["municipio"]
        itens.append(item)
    return itens


def itens_busca(locais: pd.DataFrame) -> list[dict]:
    """Municípios e bairros (na região medoide do grupo) e locais com posição."""
    municipios = _agrupados(locais, "m", ["uf", "mun", "municipio"], "municipio")
    com_bairro = locais[locais["bairro"] != ""]
    bairros = _agrupados(com_bairro, "b", ["uf", "mun", "municipio", "bairro"], "bairro")
    posicionados = locais[locais["lat_regiao"].notna()]
    chave_local = ["uf", "municipio", "nome", "lat_regiao", "lon_regiao"]
    somados = posicionados.groupby(chave_local, sort=True, as_index=False)["eleitores"].sum()
    locais_itens = [
        {"t": "l", "n": r.nome, "m": r.municipio, "uf": r.uf, "lat": float(r.lat_regiao), "lon": float(r.lon_regiao),
         "e": int(r.eleitores)}
        for r in somados.itertuples(index=False)
    ]
    return municipios + bairros + locais_itens
